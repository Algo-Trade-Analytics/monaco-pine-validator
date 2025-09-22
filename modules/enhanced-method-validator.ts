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

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private astContext: AstValidationContext | null = null;
  private usingAst = false;

  getDependencies(): string[] {
    return ['CoreValidator', 'UDTValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;

    this.astContext = this.getAstContext(config);
    this.usingAst = !!this.astContext?.ast;

    if (this.usingAst && this.astContext?.ast) {
      this.validateUsingAst(this.astContext.ast);
    } else {
      this.validateUsingLegacy();
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: null,
    };
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

  private validateUsingLegacy(): void {
    const udtTypes = this.collectUDTTypes(this.context.lines);
    for (let index = 0; index < this.context.lines.length; index++) {
      const line = this.context.lines[index];
      this.validateMethodCallsOnNonUDT(line, index + 1, udtTypes, this.context.lines);
    }
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
    this.addWarning(line, column, message, 'PSV6-METHOD-INVALID');
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

  private validateMethodCallsOnNonUDT(
    line: string,
    lineNum: number,
    udtTypes: Set<string>,
    lines: string[],
  ): void {
    const methodCallMatch = line.match(/\b(\w+)\.(\w+)\s*\(/g);
    if (!methodCallMatch) {
      return;
    }
    for (const match of methodCallMatch) {
      const fullMatch = match.match(/\b(\w+)\.(\w+)\s*\(/);
      if (!fullMatch) {
        continue;
      }
      const [, varName, methodName] = fullMatch;
      if (this.allowedInstanceMethods.has(methodName)) {
        continue;
      }
      if (this.isBuiltInMethod(varName, methodName)) {
        continue;
      }

      const varType = this.getVariableType(varName, lines, lineNum);
      if (!udtTypes.has(varType) && varType !== 'unknown') {
        const column = line.indexOf(match) + 1;
        const message = `Method '${methodName}' called on non-UDT variable '${varName}' of type '${varType}'`;
        this.addWarning(lineNum, column, message, 'PSV6-METHOD-INVALID');
      }
    }
  }

  private collectUDTTypes(lines: string[]): Set<string> {
    const udtTypes = new Set<string>();
    for (const line of lines) {
      const typeMatch = line.match(/^\s*type\s+(\w+)/);
      if (typeMatch) {
        udtTypes.add(typeMatch[1]);
      }
    }
    return udtTypes;
  }

  private isBuiltInMethod(varName: string, methodName: string): boolean {
    return this.builtInNamespaces[varName]?.includes(methodName) ?? false;
  }

  private getVariableType(varName: string, lines: string[], currentLine: number): string {
    for (let i = 0; i < currentLine - 1; i++) {
      const line = lines[i];
      const typedDeclMatch = line.match(new RegExp(`\\b(int|float|bool|string|color|line|label|box|table|array|matrix|map)\\s+${varName}\\s*=`));
      if (typedDeclMatch) {
        return typedDeclMatch[1];
      }
      const simpleDeclMatch = line.match(new RegExp(`\\b${varName}\\s*=\\s*([^\\n]+)`));
      if (simpleDeclMatch) {
        const value = simpleDeclMatch[1].trim();
        return this.inferTypeFromValue(value);
      }
    }
    return 'unknown';
  }

  private inferTypeFromValue(value: string): string {
    const trimmed = value.trim();
    if (/^-?\d+$/.test(trimmed)) return 'int';
    if (/^-?\d*\.\d+$/.test(trimmed)) return 'float';
    if (/^["'].*["']$/.test(trimmed)) return 'string';
    if (trimmed === 'true' || trimmed === 'false') return 'bool';
    if (trimmed.startsWith('color.')) return 'color';
    if (trimmed.includes('array.new')) return 'array';
    if (trimmed.includes('matrix.new')) return 'matrix';
    if (trimmed.includes('map.new')) return 'map';
    if (trimmed.includes('line.new')) return 'line';
    if (trimmed.includes('label.new')) return 'label';
    if (trimmed.includes('box.new')) return 'box';
    if (trimmed.includes('table.new')) return 'table';
    return 'unknown';
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({
      line,
      column,
      message,
      severity: 'warning',
      code,
      suggestion: "Methods can only be called on User-Defined Type instances. Consider using a function instead.",
    });
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
    this.usingAst = false;
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    return isAstValidationContext(this.context) ? (this.context as AstValidationContext) : null;
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
