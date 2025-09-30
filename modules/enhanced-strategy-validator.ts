/**
 * Enhanced Strategy Validator Module
 *
 * Handles strategy-specific validation for Pine Script v6:
 * - PSV6-STRATEGY-REALISM: Missing commission settings
 * - PSV6-STRATEGY-RISK: Risk management suggestions
 * - PSV6-STRATEGY-POSITION-SIZE: Excessive position size
 * - PSV6-STRATEGY-NO-EXIT: Missing exit strategy
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
  type ArgumentNode,
  type CallExpressionNode,
  type ExpressionNode,
  type MemberExpressionNode,
  type NumberLiteralNode,
  type ProgramNode,
  type UnaryExpressionNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';

interface StrategyCallRecord {
  node: CallExpressionNode;
  namedArgs: Map<string, ArgumentNode>;
}

interface StrategyAstData {
  strategyCalls: StrategyCallRecord[];
  entryCalls: StrategyCallRecord[];
  exitCalls: StrategyCallRecord[];
  closeCalls: StrategyCallRecord[];
  cancelCalls: StrategyCallRecord[];
  hasRiskIdentifier: boolean;
}

const POSITION_SIZE_THRESHOLD = 100_000;
const RISK_IDENTIFIER_NAMES = new Set(['stop_loss', 'take_profit', 'trail_stop']);

export class EnhancedStrategyValidator implements ValidationModule {
  name = 'EnhancedStrategyValidator';
  priority = 75; // Run after basic syntax validation

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private astContext: AstValidationContext | null = null;
  private context: ValidationContext | null = null;

  private debug(payload: unknown): void {
    if (process.env.DEBUG_ENH_STRATEGY === '1') {
      console.log('[EnhancedStrategyValidator]', payload);
    }
  }

  getDependencies(): string[] {
    return ['CoreValidator', 'SyntaxValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();

    this.context = context;

    this.astContext = ensureAstContext(context, config);

    const program = this.astContext?.ast ?? null;
    if (!program) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: null,
      };
    }

    this.validateWithAst(program);

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
    const data = this.collectAstStrategyData(program);
    this.debug({ phase: 'ast', data });

    this.validateAstStrategyRealism(data);
    this.validateAstRiskManagement(data);
    this.validateAstPositionSize(data);
    this.validateAstExitStrategy(data);
  }

  private collectAstStrategyData(program: ProgramNode): StrategyAstData {
    const data: StrategyAstData = {
      strategyCalls: [],
      entryCalls: [],
      exitCalls: [],
      closeCalls: [],
      cancelCalls: [],
      hasRiskIdentifier: false,
    };

    visit(program, {
      Identifier: {
        enter: (path) => {
          if (RISK_IDENTIFIER_NAMES.has(path.node.name)) {
            data.hasRiskIdentifier = true;
          }
        },
      },
      CallExpression: {
        enter: (path) => {
          this.processAstCall(path as NodePath<CallExpressionNode>, data);
        },
      },
    });

    return data;
  }

  private processAstCall(path: NodePath<CallExpressionNode>, data: StrategyAstData): void {
    const node = path.node;
    const qualifiedName = this.getExpressionQualifiedName(node.callee);
    if (!qualifiedName) {
      return;
    }

    const namedArgs = this.collectNamedArguments(node.args);
    if (qualifiedName === 'strategy') {
      data.strategyCalls.push({ node, namedArgs });
      return;
    }

    if (qualifiedName === 'strategy.entry') {
      data.entryCalls.push({ node, namedArgs });
      return;
    }

    if (qualifiedName === 'strategy.exit') {
      data.exitCalls.push({ node, namedArgs });
      return;
    }

    if (qualifiedName === 'strategy.close') {
      data.closeCalls.push({ node, namedArgs });
      return;
    }

    if (qualifiedName === 'strategy.cancel') {
      data.cancelCalls.push({ node, namedArgs });
    }
  }

  private validateAstStrategyRealism(data: StrategyAstData): void {
    if (!data.strategyCalls.length) {
      return;
    }

    const hasCommission = data.strategyCalls.some((call) =>
      call.namedArgs.has('commission_type') || call.namedArgs.has('commission_value'),
    );

    if (!hasCommission) {
      const location = data.strategyCalls[0].node.loc.start;
      this.addWarning(
        location.line,
        location.column,
        'Strategy lacks commission settings for realistic backtesting',
        'PSV6-STRATEGY-REALISM',
        'Add commission_type and commission_value parameters to strategy()',
      );
    }
  }

  private validateAstRiskManagement(data: StrategyAstData): void {
    if (!data.strategyCalls.length) {
      return;
    }

    const hasRiskManagement =
      data.exitCalls.length > 0 || data.closeCalls.length > 0 || data.hasRiskIdentifier;

    if (!hasRiskManagement) {
      const location = data.strategyCalls[0].node.loc.start;
      this.addInfo(
        location.line,
        location.column,
        'Consider adding risk management features to your strategy',
        'PSV6-STRATEGY-RISK',
        'Add stop loss, take profit, or trailing stop orders',
      );
    }
  }

  private validateAstPositionSize(data: StrategyAstData): void {
    for (const call of data.entryCalls) {
      const qtyArg = call.namedArgs.get('qty');
      if (!qtyArg) {
        continue;
      }

      const value = this.getNumericLiteralValue(qtyArg.value);
      if (value !== null && value > POSITION_SIZE_THRESHOLD) {
        const location = qtyArg.value.loc.start;
        this.addWarning(
          location.line,
          location.column,
          'Excessive position size may not be realistic',
          'PSV6-STRATEGY-POSITION-SIZE',
          'Consider using a more realistic position size',
        );
      }
    }
  }

  private validateAstExitStrategy(data: StrategyAstData): void {
    if (!data.strategyCalls.length || !data.entryCalls.length) {
      return;
    }

    const hasExit =
      data.exitCalls.length > 0 || data.closeCalls.length > 0 || data.cancelCalls.length > 0;

    if (!hasExit) {
      const location = data.entryCalls[0].node.loc.start;
      this.addWarning(
        location.line,
        location.column,
        'Strategy has entry conditions but no exit strategy',
        'PSV6-STRATEGY-NO-EXIT',
        'Add strategy.exit() or strategy.close() calls',
      );
    }
  }

  private collectNamedArguments(args: ArgumentNode[]): Map<string, ArgumentNode> {
    const map = new Map<string, ArgumentNode>();
    for (const arg of args) {
      if (arg.name) {
        map.set(arg.name.name, arg);
      }
    }
    return map;
  }

  private getNumericLiteralValue(expression: ExpressionNode): number | null {
    if (expression.kind === 'NumberLiteral') {
      return (expression as NumberLiteralNode).value;
    }

    if (expression.kind === 'UnaryExpression') {
      const unary = expression as UnaryExpressionNode;
      if (unary.operator === '+' || unary.operator === '-') {
        const value = this.getNumericLiteralValue(unary.argument);
        if (value === null) {
          return null;
        }
        return unary.operator === '-' ? -value : value;
      }
    }

    return null;
  }

  private getExpressionQualifiedName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as { kind: 'Identifier'; name: string }).name;
    }

    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      const objectName = this.getExpressionQualifiedName(member.object);
      if (!objectName) {
        return null;
      }
      return `${objectName}.${member.property.name}`;
    }

    return null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Shared helpers
  // ──────────────────────────────────────────────────────────────────────────

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
    this.context = null;
  }

  private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  private addInfo(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.info.push({ line, column, message, severity: 'info', code, suggestion });
  }
}
