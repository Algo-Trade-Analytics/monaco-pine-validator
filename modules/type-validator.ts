/**
 * Type System Validation Module
 *
 * Handles type safety, type inference, and type-related validation for Pine Script v6.
 * Extracts type checking logic from EnhancedPineScriptValidator and UltimateValidator.
 */

import {
  ValidationModule,
  ValidationContext,
  ValidatorConfig,
  ValidationError,
  ValidationResult,
  AstValidationContext,
} from '../core/types';
import { Codes } from '../core/codes';
import { ValidationHelper } from '../core/validation-helper';
import { visit, type NodePath } from '../core/ast/traversal';
import type {
  VariableDeclarationNode,
  ConditionalExpressionNode,
  FunctionDeclarationNode,
  ReturnStatementNode,
  TypeReferenceNode,
  ExpressionNode,
  AssignmentStatementNode,
  IdentifierNode,
  TupleExpressionNode,
  NumberLiteralNode,
  StringLiteralNode,
  BooleanLiteralNode,
  NullLiteralNode,
  MemberExpressionNode,
  CallExpressionNode,
  UnaryExpressionNode,
  BinaryExpressionNode,
} from '../core/ast/nodes';
import type { TypeMetadata } from '../core/ast/types';

export class TypeValidator implements ValidationModule {
  name = 'TypeValidator';
  priority = 85; // High priority, runs after CoreValidator

  private helper = new ValidationHelper();
  private astDiagnosticSites = new Map<string, Set<string>>();

  getDependencies(): string[] {
    return ['CoreValidator']; // Depends on core validation
  }

  validate(context: ValidationContext, _config: ValidatorConfig): ValidationResult {
    this.reset();
    if (!this.isAstContext(context) || !context.ast) {
      return this.helper.buildResult(context);
    }

    this.validateWithAst(context);

    return this.helper.buildResult(context);
  }

  private reset(): void {
    this.helper.reset();
    this.astDiagnosticSites.clear();
  }

  private validateWithAst(context: AstValidationContext): void {
    if (!context.ast) {
      return;
    }

    this.emitAstVariableTypeMismatches(context);
    this.emitAstTernaryTypeConflicts(context);
    this.emitAstFunctionReturnTypeErrors(context);
    this.emitAstTypeConsistencyWarnings(context);
  }

  private emitAstVariableTypeMismatches(context: AstValidationContext): void {
    const program = context.ast;
    const environment = context.typeEnvironment;
    if (!program) {
      return;
    }

    visit(program, {
      VariableDeclaration: {
        enter: (path) => {
          const declaration = path.node as VariableDeclarationNode;
          if (!declaration.typeAnnotation || !declaration.initializer) {
            return;
          }

          const declaredType = this.resolveTypeReferenceName(declaration.typeAnnotation);
          if (!declaredType) {
            return;
          }

          const initializerMetadata = environment.nodeTypes.get(declaration.initializer);
          if (!initializerMetadata || initializerMetadata.kind === 'unknown' || initializerMetadata.certainty === 'conflict') {
            return;
          }

          const inferredType = this.describeTypeMetadata(initializerMetadata);
          if (!inferredType) {
            return;
          }

          const declaredBase = this.normaliseTypeName(declaredType);
          if (!this.isKnownPrimitiveType(declaredBase)) {
            return;
          }
          if (this.areTypesCompatible(declaredBase, inferredType)) {
            return;
          }

          const line = declaration.identifier.loc.start.line;
          const column = declaration.identifier.loc.start.column;
          const key = `${line}:${declaration.identifier.name}`;
          this.registerAstDiagnostic('PSV6-TYPE-MISMATCH', key);
          this.helper.addError(line, column, `Type mismatch: declared '${declaredType}' but assigned '${inferredType}'.`, 'PSV6-TYPE-MISMATCH');
        },
      },
    });
  }

  private emitAstTernaryTypeConflicts(context: AstValidationContext): void {
    const program = context.ast;
    const environment = context.typeEnvironment;
    if (!program) {
      return;
    }

    visit(program, {
      ConditionalExpression: {
        enter: (path) => {
          const expression = path.node as ConditionalExpressionNode;
          const consequentType = this.getExpressionTypeLabel(context, expression.consequent);
          const alternateType = this.getExpressionTypeLabel(context, expression.alternate);
          if (!consequentType || !alternateType) {
            return;
          }

          const consequentIsNa = expression.consequent.kind === 'Identifier' && (expression.consequent as IdentifierNode).name === 'na';
          const alternateIsNa = expression.alternate.kind === 'Identifier' && (expression.alternate as IdentifierNode).name === 'na';
          if (consequentIsNa || alternateIsNa) {
            return;
          }

          if (this.areTypesCompatible(consequentType, alternateType)) {
            return;
          }

          const line = expression.loc.start.line;
          const column = expression.loc.start.column;
          const key = `${line}`;
          this.registerAstDiagnostic('PSV6-TERNARY-TYPE', key);
          this.helper.addError(
            line,
            column,
            `Ternary operator type mismatch: '${consequentType}' vs '${alternateType}'.`,
            'PSV6-TERNARY-TYPE',
          );
        },
      },
    });
  }

  private emitAstFunctionReturnTypeErrors(context: AstValidationContext): void {
    const program = context.ast;
    if (!program) {
      return;
    }

    visit(program, {
      FunctionDeclaration: {
        enter: (path) => {
          const fnNode = path.node as FunctionDeclarationNode;
          const collected = new Set<string>();

          visit(fnNode.body, {
            FunctionDeclaration: {
              enter: () => 'skip',
            },
            ReturnStatement: {
              enter: (returnPath: NodePath<ReturnStatementNode>) => {
                const returnNode = returnPath.node;
                if (!returnNode.argument) {
                  collected.add('void');
                  return;
                }

                const metadata = context.typeEnvironment.nodeTypes.get(returnNode.argument as ExpressionNode);
                const typeLabel = this.describeTypeMetadata(metadata);
                if (!typeLabel) {
                  return;
                }
                collected.add(typeLabel);
              },
            },
          });

          if (collected.size <= 1) {
            return;
          }

          const fnName = fnNode.identifier?.name ?? 'anonymous function';
          const line = fnNode.loc.start.line;
          const column = fnNode.loc.start.column;
          const key = `${line}:${fnName}`;
          this.registerAstDiagnostic('PSV6-FUNCTION-RETURN-TYPE', key);
          this.helper.addError(
            line,
            column,
            `Function '${fnName}' has inconsistent return types: ${Array.from(collected).join(', ')}.`,
            'PSV6-FUNCTION-RETURN-TYPE',
          );
        },
      },
    });
  }

  private emitAstTypeConsistencyWarnings(context: AstValidationContext): void {
    const program = context.ast;
    if (!program) {
      return;
    }

    const environment = context.typeEnvironment;
    const recorded = new Map<string, string>();

    const trackAssignment = (identifier: IdentifierNode): void => {
      const metadata = environment.nodeTypes.get(identifier);
      const typeLabel = this.describeTypeMetadata(metadata);
      if (!typeLabel) {
        return;
      }

      const normalised = this.normaliseTypeName(typeLabel);
      if (!this.isKnownPrimitiveType(normalised)) {
        return;
      }

      const previousType = recorded.get(identifier.name);
      if (!previousType) {
        recorded.set(identifier.name, normalised);
        return;
      }

      if (this.areTypesCompatible(previousType, normalised) || this.areTypesCompatible(normalised, previousType)) {
        recorded.set(identifier.name, normalised);
        return;
      }

      const line = identifier.loc.start.line;
      const column = identifier.loc.start.column;
      const key = `${line}:${identifier.name}`;
      this.registerAstDiagnostic('PSV6-TYPE-INCONSISTENT', key);
      this.helper.addWarning(
        line,
        column,
        `Type mismatch: variable '${identifier.name}' previously typed as '${previousType}' but assigned '${normalised}'.`,
        'PSV6-TYPE-INCONSISTENT',
      );
      recorded.set(identifier.name, normalised);
    };

    visit(program, {
      VariableDeclaration: {
        enter: (path) => {
          const declaration = path.node as VariableDeclarationNode;
          trackAssignment(declaration.identifier);
        },
      },
      AssignmentStatement: {
        enter: (path) => {
          const assignment = path.node as AssignmentStatementNode;
          const target = assignment.left;
          if (!target) {
            return;
          }

          if (target.kind === 'Identifier') {
            trackAssignment(target as IdentifierNode);
            return;
          }

          if (target.kind === 'TupleExpression') {
            const tuple = target as TupleExpressionNode;
            tuple.elements.forEach((element) => {
              if (element && element.kind === 'Identifier') {
                trackAssignment(element as IdentifierNode);
              }
            });
          }
        },
      },
    });
  }

  private registerAstDiagnostic(code: string, key: string): void {
    if (!this.astDiagnosticSites.has(code)) {
      this.astDiagnosticSites.set(code, new Set());
    }
    this.astDiagnosticSites.get(code)!.add(key);
  }

  private isAstContext(context: ValidationContext): context is AstValidationContext {
    return 'ast' in context;
  }

  private resolveTypeReferenceName(type: TypeReferenceNode | null): string | null {
    if (!type) {
      return null;
    }

    const base = type.name.name;
    if (!type.generics.length) {
      return base;
    }

    const generics = type.generics
      .map((generic) => this.resolveTypeReferenceName(generic))
      .filter((name): name is string => Boolean(name));

    if (!generics.length) {
      return base;
    }

    return `${base}<${generics.join(', ')}>`;
  }

  private describeTypeMetadata(metadata: TypeMetadata | null | undefined): string | null {
    if (!metadata) {
      return null;
    }

    if (metadata.kind === 'unknown') {
      return null;
    }

    return metadata.kind;
  }

  private normaliseTypeName(name: string): string {
    return name.split('<')[0];
  }

  private areTypesCompatible(left: string, right: string): boolean {
    if (left === 'na' || right === 'na') {
      return true;
    }

    if (left === right) {
      return true;
    }

    if (left === 'void' || right === 'void') {
      return true;
    }

    const numeric = new Set(['int', 'float']);
    if (numeric.has(left) && numeric.has(right)) {
      return true;
    }

    if (left === 'series' || right === 'series') {
      return true;
    }

    return false;
  }

  private isKnownPrimitiveType(name: string): boolean {
    const known = new Set([
      'int',
      'float',
      'bool',
      'string',
      'series',
      'color',
      'line',
      'label',
      'box',
      'table',
      'array',
      'matrix',
      'map',
      'void',
      'function',
    ]);
    return known.has(name);
  }

  private getExpressionTypeLabel(context: AstValidationContext, expression: ExpressionNode | null): string | null {
    if (!expression) {
      return null;
    }

    if (expression.kind === 'Identifier' && (expression as IdentifierNode).name === 'na') {
      return 'na';
    }

    const metadata = context.typeEnvironment.nodeTypes.get(expression as ExpressionNode);
    const metadataLabel = this.describeTypeMetadata(metadata);
    if (metadataLabel && metadataLabel !== 'unknown') {
      return metadataLabel;
    }

    switch (expression.kind) {
      case 'NumberLiteral': {
        const literal = expression as NumberLiteralNode;
        return Number.isInteger(literal.value) ? 'int' : 'float';
      }
      case 'StringLiteral':
        return 'string';
      case 'BooleanLiteral':
        return 'bool';
      case 'NullLiteral':
        return 'void';
      case 'Identifier': {
        const identifier = expression as IdentifierNode;
        if (identifier.name === 'na') {
          return 'na';
        }
        const typeInfo = context.typeMap.get(identifier.name);
        if (typeInfo && typeInfo.type !== 'unknown') {
          return typeInfo.type;
        }
        const identifierMetadata = context.typeEnvironment.identifiers.get(identifier.name);
        const inferred = this.describeTypeMetadata(identifierMetadata);
        return inferred && inferred !== 'unknown' ? inferred : null;
      }
      case 'MemberExpression':
        return this.resolveMemberExpressionType(context, expression as MemberExpressionNode);
      case 'CallExpression': {
        const call = expression as CallExpressionNode;
        const qualified = this.resolveQualifiedName(call.callee);
        if (qualified) {
          const hint = this.lookupCallReturnType(qualified);
          if (hint) {
            return hint;
          }
        }
        return null;
      }
      case 'UnaryExpression': {
        const unary = expression as UnaryExpressionNode;
        return this.getExpressionTypeLabel(context, unary.argument);
      }
      case 'BinaryExpression': {
        const binary = expression as BinaryExpressionNode;
        const left = this.getExpressionTypeLabel(context, binary.left);
        const right = this.getExpressionTypeLabel(context, binary.right);
        if (!left || !right) {
          return null;
        }
        if (left === right) {
          return left;
        }
        if (this.areTypesCompatible(left, right)) {
          return left;
        }
        return null;
      }
      case 'ArrayLiteral':
        return 'array';
      case 'MatrixLiteral':
        return 'matrix';
      case 'ConditionalExpression': {
        const conditional = expression as ConditionalExpressionNode;
        const consequent = this.getExpressionTypeLabel(context, conditional.consequent);
        const alternate = this.getExpressionTypeLabel(context, conditional.alternate);
        if (consequent && alternate && this.areTypesCompatible(consequent, alternate)) {
          return consequent;
        }
        return null;
      }
      default:
        return null;
    }
  }

  private resolveMemberExpressionType(context: AstValidationContext, member: MemberExpressionNode): string | null {
    const qualified = this.resolveQualifiedName(member);
    if (qualified) {
      const typeInfo = context.typeMap.get(qualified);
      if (typeInfo && typeInfo.type !== 'unknown') {
        return typeInfo.type;
      }

      const namespaceHint = this.namespaceTypeHints.get(qualified.split('.')[0] ?? '');
      if (namespaceHint) {
        return namespaceHint;
      }
    }

    const objectName = this.resolveQualifiedName(member.object);
    if (objectName) {
      const fieldKey = `${objectName}.${member.property.name}`;
      const fieldInfo = context.typeMap.get(fieldKey);
      if (fieldInfo && fieldInfo.type !== 'unknown') {
        return fieldInfo.type;
      }
    }

    return null;
  }

  private resolveQualifiedName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }
    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (member.computed) {
        return null;
      }
      const objectName = this.resolveQualifiedName(member.object);
      if (!objectName) {
        return null;
      }
      return `${objectName}.${member.property.name}`;
    }
    return null;
  }

  private lookupCallReturnType(name: string): string | null {
    if (this.callReturnTypeHints.has(name)) {
      return this.callReturnTypeHints.get(name)!;
    }
    const namespace = name.split('.')[0] ?? '';
    return this.namespaceTypeHints.get(namespace) ?? null;
  }

  private readonly namespaceTypeHints = new Map<string, string>([
    ['ta', 'series'],
    ['math', 'float'],
    ['str', 'string'],
    ['color', 'color'],
    ['line', 'line'],
    ['label', 'label'],
    ['box', 'box'],
    ['table', 'table'],
    ['polyline', 'polyline'],
    ['location', 'int'],
    ['size', 'int'],
    ['shape', 'int'],
    ['display', 'int'],
    ['text', 'string'],
    ['timeframe', 'string'],
    ['session', 'string'],
    ['syminfo', 'string'],
    ['alert', 'string'],
    ['strategy', 'series'],
    ['request', 'series'],
  ]);

  private readonly callReturnTypeHints = new Map<string, string>([
    ['color.new', 'color'],
    ['color.rgb', 'color'],
    ['color.from_gradient', 'color'],
    ['color', 'color'],
  ]);

}
