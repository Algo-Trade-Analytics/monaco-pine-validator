/**
 * Enhanced Performance Validator Module
 *
 * Handles enhanced performance validation for Pine Script v6:
 * - PSV6-PERF-NESTED-TA: Expensive TA helpers inside nested loops
 * - PSV6-REPAINT-SECURITY: request.security usage without confirmation
 * - PSV6-REPAINT-LOOKAHEAD: lookahead enabled in request.security
 * - PSV6-FUTURE-DATA: Negative history references
 * - PSV6-REPAINT-HTF: Higher timeframe data without confirmation
 * - PSV6-PERF-ALERT-CONSOLIDATE: Multiple alert/alertcondition calls
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidationError,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';
import {
  type ArgumentNode,
  type CallExpressionNode,
  type ExpressionNode,
  type IdentifierNode,
  type IndexExpressionNode,
  type MemberExpressionNode,
  type NumberLiteralNode,
  type ProgramNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';

const EXPENSIVE_FUNCTIONS_IN_LOOPS = new Set<string>([
  'pivothigh',
  'pivotlow',
  'request.security',
  'request.security_lower_tf',
  'ta.highest',
  'ta.lowest',
  'ta.pivothigh',
  'ta.pivotlow',
  'highest',
  'lowest',
]);

const HISTORY_SERIES_IDENTIFIERS = new Set<string>(['close', 'open', 'high', 'low']);

export class EnhancedPerformanceValidator implements ValidationModule {
  name = 'EnhancedPerformanceValidator';
  priority = 70;

  private context!: ValidationContext;

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];

  private astContext: AstValidationContext | null = null;

  getDependencies(): string[] {
    return ['CoreValidator', 'SyntaxValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.astContext = this.getAstContext(config);

    const ast = this.astContext?.ast;
    if (!ast) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: null,
      };
    }

    this.validateWithAst(ast);

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: null,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AST validation
  // ──────────────────────────────────────────────────────────────────────────
  private validateWithAst(program: ProgramNode): void {
    let loopDepth = 0;
    let hasRequestSecurity = false;
    let hasBarstateConfirmed = false;
    let hasHtfData = false;
    let firstRequestPosition: { line: number; column: number } | null = null;
    const alertCalls: CallExpressionNode[] = [];

    visit(program, {
      ForStatement: {
        enter: () => {
          loopDepth++;
        },
        exit: () => {
          loopDepth = Math.max(loopDepth - 1, 0);
        },
      },
      WhileStatement: {
        enter: () => {
          loopDepth++;
        },
        exit: () => {
          loopDepth = Math.max(loopDepth - 1, 0);
        },
      },
      CallExpression: {
        enter: (path: NodePath<CallExpressionNode>) => {
          const node = path.node;
          const calleeName = this.getCalleeName(node.callee);

          if (calleeName && loopDepth >= 2 && EXPENSIVE_FUNCTIONS_IN_LOOPS.has(calleeName)) {
            const { line, column } = node.loc.start;
            this.addError(
              line,
              column,
              `Expensive function '${calleeName}' called in nested loop may impact performance`,
              'PSV6-PERF-NESTED-TA',
              `Consider moving '${calleeName}' outside the loop or caching its result`,
            );
          }

          if (calleeName === 'request.security') {
            hasRequestSecurity = true;
            firstRequestPosition ??= { ...node.loc.start };
            if (this.handleRequestSecurityCall(node)) {
              hasHtfData = true;
            }
          }

          if (calleeName === 'alert' || calleeName === 'alertcondition') {
            alertCalls.push(node);
          }
        },
      },
      MemberExpression: {
        enter: (path: NodePath<MemberExpressionNode>) => {
          const member = path.node;
          if (
            member.object.kind === 'Identifier' &&
            (member.object as IdentifierNode).name === 'barstate' &&
            member.property.name === 'isconfirmed'
          ) {
            hasBarstateConfirmed = true;
          }
        },
      },
      IndexExpression: {
        enter: (path: NodePath<IndexExpressionNode>) => {
          this.validateNegativeHistoryReference(path.node);
        },
      },
    });

    if (hasRequestSecurity && !hasBarstateConfirmed) {
      const position = firstRequestPosition ?? { line: 1, column: 1 };
      this.addWarning(
        position.line,
        position.column,
        'request.security used without barstate.isconfirmed may cause repainting',
        'PSV6-REPAINT-SECURITY',
        'Use barstate.isconfirmed to prevent repainting',
      );
    }

    if (hasHtfData && !hasBarstateConfirmed) {
      const position = firstRequestPosition ?? { line: 1, column: 1 };
      this.addWarning(
        position.line,
        position.column,
        'Higher timeframe data used without confirmation may cause repainting',
        'PSV6-REPAINT-HTF',
        'Use barstate.isconfirmed when accessing HTF data',
      );
    }

    if (alertCalls.length >= 2) {
      const location = alertCalls[1]?.loc.start ?? { line: 1, column: 1 };
      this.addWarning(
        location.line,
        location.column,
        `Multiple alert conditions detected (${alertCalls.length}). Consider consolidating or documenting alert logic.`,
        'PSV6-PERF-ALERT-CONSOLIDATE',
        'Reduce duplicate alerts or combine conditions when possible.',
      );
    }
  }

  private handleRequestSecurityCall(call: CallExpressionNode): boolean {
    let hasHtfReference = false;

    for (const argument of call.args) {
      if (argument.name?.name === 'lookahead' && this.argumentEnablesLookahead(argument)) {
        const { line, column } = argument.loc.start;
        this.addWarning(
          line,
          column,
          'request.security with lookahead enabled may cause repainting',
          'PSV6-REPAINT-LOOKAHEAD',
          'Consider using barstate.isconfirmed to prevent repainting',
        );
      }

      if (argument.name?.name === 'timeframe') {
        hasHtfReference = true;
      }

      if (this.expressionReferencesTimeframe(argument.value)) {
        hasHtfReference = true;
      }
    }

    return hasHtfReference;
  }

  private validateNegativeHistoryReference(node: IndexExpressionNode): void {
    if (node.index.kind !== 'NumberLiteral') {
      return;
    }

    const index = node.index as NumberLiteralNode;
    if (index.value >= 0) {
      return;
    }

    const baseName = this.resolveIdentifierName(node.object);
    if (!baseName || !HISTORY_SERIES_IDENTIFIERS.has(baseName)) {
      return;
    }

    const { line, column } = index.loc.start;
    this.addError(
      line,
      column,
      'Negative history reference may cause future data leakage',
      'PSV6-FUTURE-DATA',
      'Use positive history references only',
    );
  }

  private argumentEnablesLookahead(argument: ArgumentNode): boolean {
    const value = argument.value;

    if (value.kind === 'StringLiteral') {
      return value.value.toLowerCase() === 'barmerge.lookahead_on';
    }

    if (value.kind === 'MemberExpression') {
      const memberName = this.getCalleeName(value);
      return memberName === 'barmerge.lookahead_on';
    }

    return false;
  }

  private expressionReferencesTimeframe(expression: ExpressionNode): boolean {
    switch (expression.kind) {
      case 'Identifier':
        return (expression as IdentifierNode).name === 'timeframe';
      case 'MemberExpression': {
        const member = expression as MemberExpressionNode;
        if (member.object.kind === 'Identifier' && (member.object as IdentifierNode).name === 'timeframe') {
          return true;
        }
        return this.expressionReferencesTimeframe(member.object);
      }
      case 'CallExpression': {
        const call = expression as CallExpressionNode;
        if (this.expressionReferencesTimeframe(call.callee)) {
          return true;
        }
        return call.args.some((arg) => this.expressionReferencesTimeframe(arg.value));
      }
      case 'IndexExpression': {
        const index = expression as IndexExpressionNode;
        return (
          this.expressionReferencesTimeframe(index.object) ||
          this.expressionReferencesTimeframe(index.index)
        );
      }
      case 'UnaryExpression':
      case 'BinaryExpression':
      case 'ConditionalExpression':
      case 'TupleExpression':
        // Composite expressions expose child nodes on generic properties
        return Object.values(expression).some((value) => {
          if (Array.isArray(value)) {
            return value.some((item) =>
              typeof item === 'object' && item && 'kind' in item
                ? this.expressionReferencesTimeframe(item as ExpressionNode)
                : false,
            );
          }
          return typeof value === 'object' && value && 'kind' in value
            ? this.expressionReferencesTimeframe(value as ExpressionNode)
            : false;
        });
      default:
        return false;
    }
  }

  private getCalleeName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }

    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      const objectName = this.getCalleeName(member.object);
      if (!objectName) {
        return null;
      }
      return `${objectName}.${member.property.name}`;
    }

    return null;
  }

  private resolveIdentifierName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }

    if (expression.kind === 'MemberExpression') {
      return this.getCalleeName(expression);
    }

    return null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Utilities
  // ──────────────────────────────────────────────────────────────────────────
  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
  }

  private addError(line: number, column: number, message: string, code: string, suggestion?: string): void {
    this.errors.push({ line, column, message, code, suggestion, severity: 'error' });
  }

  private addWarning(line: number, column: number, message: string, code: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, code, suggestion, severity: 'warning' });
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    return isAstValidationContext(this.context) && this.context.ast ? (this.context as AstValidationContext) : null;
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
