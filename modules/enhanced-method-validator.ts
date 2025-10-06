/**
 * Enhanced Method Validator Module
 *
 * Handles enhanced method validation for Pine Script v6:
 * - PSV6-METHOD-INVALID: Methods on non-UDT types
 */

import {
  type AstValidationContext,
  type ValidationContext,
  type ValidationError,
  type ValidationModule,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';
import { Codes } from '../core/codes';
import { ValidationHelper } from '../core/validation-helper';
import {
  type AssignmentStatementNode,
  type CallExpressionNode,
  type ExpressionNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type NumberLiteralNode,
  type ProgramNode,
  type TypeReferenceNode,
  type UnaryExpressionNode,
  type VariableDeclarationNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';

export class EnhancedMethodValidator implements ValidationModule {
  name = 'EnhancedMethodValidator';
  priority = 85; // Run after type validation

  private helper = new ValidationHelper();

  private readonly allowedInstanceMethods = new Set([
    'push', 'pop', 'get', 'set', 'size', 'clear', 'reverse', 'sort', 'sort_indices', 'copy', 'slice', 'concat', 'fill', 'from',
    'from_example', 'indexof', 'lastindexof', 'includes', 'binary_search', 'binary_search_leftmost', 'binary_search_rightmost',
    'range', 'remove', 'insert', 'unshift', 'shift', 'first', 'last', 'max', 'min', 'median', 'mode', 'abs', 'sum', 'avg',
    'stdev', 'variance', 'standardize', 'covariance', 'percentile_linear_interpolation', 'percentile_nearest_rank',
    'percentrank', 'some', 'every', 'delete'
  ]);

  private readonly builtInNamespaces: Record<string, string[]> = {
    array: ['new', 'push', 'pop', 'get', 'set', 'size', 'clear'],
    matrix: ['new', 'get', 'set', 'rows', 'columns', 'clear'],
    map: ['new', 'get', 'put', 'remove', 'size', 'clear'],
    line: ['new', 'set_xy1', 'set_xy2', 'set_color', 'set_width', 'set_style', 'delete'],
    label: ['new', 'set_text', 'set_color', 'set_style', 'delete'],
    box: ['new', 'delete', 'set_bgcolor', 'set_border_color'],
    table: ['new', 'cell', 'cell_set_text', 'delete', 'clear'],
  };

  private context!: ValidationContext;
  private astContext: AstValidationContext | null = null;

  getDependencies(): string[] {
    return ['CoreValidator', 'UDTValidator'];
  }

  validate(context: ValidationContext, _config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    void _config;

    this.astContext = isAstValidationContext(context) && context.ast ? context : null;

    if (!this.astContext?.ast) {
      return this.helper.buildResult(context);
    }

    this.validateUsingAst(this.astContext.ast);

    return this.helper.buildResult(context);
  }

  private validateUsingAst(program: ProgramNode): void {
    const udtTypes = new Set<string>();
    this.bootstrapUdtTypes(udtTypes);

    const scopeStack: Array<Map<string, string>> = [new Map()];

    visit(program, {
      TypeDeclaration: {
        enter: (path) => {
          udtTypes.add(path.node.identifier.name);
        },
      },
      FunctionDeclaration: {
        enter: (path) => {
          scopeStack.push(new Map());
          for (const param of path.node.params) {
            const typeName = this.resolveTypeReference(param.typeAnnotation);
            this.assignIdentifierType(param.identifier.name, typeName, scopeStack);
          }
        },
        exit: () => {
          scopeStack.pop();
        },
      },
      BlockStatement: {
        enter: () => {
          scopeStack.push(new Map());
        },
        exit: () => {
          scopeStack.pop();
        },
      },
      VariableDeclaration: {
        enter: (path: NodePath<VariableDeclarationNode>) => {
          this.recordVariableDeclaration(path.node, scopeStack, udtTypes);
        },
      },
      AssignmentStatement: {
        enter: (path: NodePath<AssignmentStatementNode>) => {
          this.recordAssignmentStatement(path.node, scopeStack, udtTypes);
        },
      },
      CallExpression: {
        enter: (path: NodePath<CallExpressionNode>) => {
          this.processAstMethodCall(path.node, scopeStack, udtTypes);
        },
      },
    });
  }

  private processAstMethodCall(
    node: CallExpressionNode,
    scopeStack: Array<Map<string, string>>,
    udtTypes: Set<string>,
  ): void {
    if (node.callee.kind !== 'MemberExpression') {
      return;
    }
    const member = node.callee as MemberExpressionNode;
    if (member.computed || member.object.kind !== 'Identifier') {
      return;
    }

    const objectIdentifier = member.object as IdentifierNode;
    const objectName = objectIdentifier.name;
    const methodName = member.property.name;

    if (objectName === 'this') {
      return;
    }

    if (this.allowedInstanceMethods.has(methodName)) {
      return;
    }
    if (this.isBuiltInMethod(objectName, methodName)) {
      return;
    }

    const resolvedType = this.resolveIdentifierType(objectName, scopeStack);
    if (!resolvedType || resolvedType === 'unknown') {
      return;
    }
    if (resolvedType === 'udt' || udtTypes.has(resolvedType)) {
      return;
    }

    const line = member.property.loc.start.line;
    const column = member.property.loc.start.column;
    const message = `Method '${methodName}' called on non-UDT variable '${objectName}' of type '${resolvedType}'`;
    this.helper.addWarning(line, column, message, Codes.METHOD_INVALID);
  }

  private recordVariableDeclaration(
    node: VariableDeclarationNode,
    scopeStack: Array<Map<string, string>>,
    udtTypes: Set<string>,
  ): void {
    const typeAnnotation = this.resolveTypeReference(node.typeAnnotation);
    if (typeAnnotation) {
      this.assignIdentifierType(node.identifier.name, typeAnnotation, scopeStack);
    }
    if (node.initializer) {
      const inferred = this.inferExpressionType(node.initializer, scopeStack, udtTypes);
      this.assignIdentifierType(node.identifier.name, inferred, scopeStack);
    }
  }

  private recordAssignmentStatement(
    node: AssignmentStatementNode,
    scopeStack: Array<Map<string, string>>,
    udtTypes: Set<string>,
  ): void {
    if (node.left.kind !== 'Identifier' || !node.right) {
      return;
    }
    const identifier = node.left as IdentifierNode;
    const inferred = this.inferExpressionType(node.right, scopeStack, udtTypes);
    this.assignIdentifierType(identifier.name, inferred, scopeStack);
  }

  private resolveTypeReference(typeAnnotation: TypeReferenceNode | null): string | null {
    if (!typeAnnotation) {
      return null;
    }
    return typeAnnotation.name.name;
  }

  private inferExpressionType(
    expression: ExpressionNode,
    scopeStack: Array<Map<string, string>>,
    udtTypes: Set<string>,
  ): string | null {
    switch (expression.kind) {
      case 'NumberLiteral': {
        const literal = expression as NumberLiteralNode;
        const raw = literal.raw ?? `${literal.value ?? ''}`;
        return raw.includes('.') ? 'float' : 'int';
      }
      case 'BooleanLiteral':
        return 'bool';
      case 'StringLiteral':
        return 'string';
      case 'Identifier': {
        const identifier = expression as IdentifierNode;
        return this.resolveIdentifierType(identifier.name, scopeStack);
      }
      case 'CallExpression': {
        const call = expression as CallExpressionNode;
        if (call.callee.kind === 'MemberExpression') {
          const member = call.callee as MemberExpressionNode;
          if (!member.computed && member.property.name === 'new' && member.object.kind === 'Identifier') {
            const namespace = (member.object as IdentifierNode).name;
            if (udtTypes.has(namespace)) {
              return namespace;
            }
            if (namespace in this.builtInNamespaces) {
              return namespace;
            }
          }
        }
        return null;
      }
      case 'UnaryExpression': {
        const unary = expression as UnaryExpressionNode;
        if (unary.argument.kind === 'NumberLiteral') {
          const literal = unary.argument as NumberLiteralNode;
          const raw = literal.raw ?? `${literal.value ?? ''}`;
          return raw.includes('.') ? 'float' : 'int';
        }
        return null;
      }
      default:
        return null;
    }
  }

  private resolveIdentifierType(name: string, scopeStack: Array<Map<string, string>>): string | null {
    if (name === 'this') {
      return 'udt';
    }

    for (let index = scopeStack.length - 1; index >= 0; index--) {
      const scope = scopeStack[index];
      if (scope.has(name)) {
        return scope.get(name) ?? null;
      }
    }

    const contextType = this.getContextType(name);
    if (contextType) {
      return contextType;
    }

    const metadata = this.astContext?.typeEnvironment.identifiers.get(name);
    if (metadata) {
      return metadata.kind;
    }

    return null;
  }

  private assignIdentifierType(
    name: string,
    typeName: string | null,
    scopeStack: Array<Map<string, string>>,
  ): void {
    if (!typeName || typeName === 'unknown') {
      return;
    }
    for (let index = scopeStack.length - 1; index >= 0; index--) {
      const scope = scopeStack[index];
      if (scope.has(name)) {
        scope.set(name, typeName);
        return;
      }
    }
    scopeStack[scopeStack.length - 1].set(name, typeName);
  }

  private getContextType(name: string): string | null {
    const typeInfo = this.context.typeMap?.get(name);
    if (!typeInfo) {
      return null;
    }
    if (typeInfo.type === 'udt') {
      return typeInfo.udtName ?? name;
    }
    return typeInfo.type ?? null;
  }

  private bootstrapUdtTypes(target: Set<string>): void {
    if (!this.context.typeMap) {
      return;
    }
    for (const [name, info] of this.context.typeMap.entries()) {
      if (info.type === 'udt') {
        target.add(info.udtName ?? name);
      }
    }
  }

  private isBuiltInMethod(varName: string, methodName: string): boolean {
    return this.builtInNamespaces[varName]?.includes(methodName) ?? false;
  }


  private reset(): void {
    this.helper.reset();
    this.astContext = null;
  }

}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
