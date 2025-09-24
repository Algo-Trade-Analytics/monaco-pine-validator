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
} from '../core/ast/nodes';
import type { TypeMetadata } from '../core/ast/types';

export class TypeValidator implements ValidationModule {
  name = 'TypeValidator';
  priority = 85; // High priority, runs after CoreValidator

  // Error tracking
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];

  private astDiagnosticSites = new Map<string, Set<string>>();

  getDependencies(): string[] {
    return ['CoreValidator']; // Depends on core validation
  }

  validate(context: ValidationContext, _config: ValidatorConfig): ValidationResult {
    this.reset();
    if (!this.isAstContext(context) || !context.ast) {
      return {
        isValid: true,
        errors: this.errors,
        warnings: this.warnings,
        info: this.info,
        typeMap: new Map(),
        scriptType: null,
      };
    }

    this.validateWithAst(context);

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: null,
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
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
          this.addError(line, column, `Type mismatch: declared '${declaredType}' but assigned '${inferredType}'.`, 'PSV6-TYPE-MISMATCH');
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
          const metadata = environment.nodeTypes.get(expression);
          if (!metadata || metadata.certainty !== 'conflict') {
            return;
          }

          const consequentType = this.describeTypeMetadata(environment.nodeTypes.get(expression.consequent));
          const alternateType = this.describeTypeMetadata(environment.nodeTypes.get(expression.alternate));
          if (!consequentType || !alternateType) {
            return;
          }

          if (this.areTypesCompatible(consequentType, alternateType)) {
            return;
          }

          const line = expression.loc.start.line;
          const column = expression.loc.start.column;
          const key = `${line}`;
          this.registerAstDiagnostic('PSV6-TERNARY-TYPE', key);
          this.addError(line, column, `Ternary operator type mismatch: '${consequentType}' vs '${alternateType}'.`, 'PSV6-TERNARY-TYPE');
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
          this.addError(
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
      this.addWarning(
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
    if (left === right) {
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

  private addError(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.errors.push({ line, column, message, severity: 'error', code, suggestion });
  }

  private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  private addInfo(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.info.push({ line, column, message, severity: 'info', code, suggestion });
  }
}
