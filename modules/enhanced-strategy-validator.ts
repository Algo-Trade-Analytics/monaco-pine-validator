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

  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private astContext: AstValidationContext | null = null;
  private usingAst = false;

  getDependencies(): string[] {
    return ['CoreValidator', 'SyntaxValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.astContext = this.getAstContext(config);
    this.usingAst = !!this.astContext?.ast;

    if (this.usingAst && this.astContext?.ast) {
      this.validateWithAst(this.astContext.ast);
    } else {
      this.validateLegacy();
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

  // ──────────────────────────────────────────────────────────────────────────
  // AST validation
  // ──────────────────────────────────────────────────────────────────────────

  private validateWithAst(program: ProgramNode): void {
    const data = this.collectAstStrategyData(program);

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
  // Legacy validation
  // ──────────────────────────────────────────────────────────────────────────

  private validateLegacy(): void {
    const lines = this.context.cleanLines.length ? this.context.cleanLines : this.context.lines;

    this.validateLegacyStrategyRealism(lines);
    this.validateLegacyRiskManagement(lines);
    this.validateLegacyPositionSize(lines);
    this.validateLegacyExitStrategy(lines);
  }

  private validateLegacyStrategyRealism(lines: string[]): void {
    let hasStrategy = false;
    let hasCommission = false;

    for (const line of lines) {
      if (/strategy\s*\(/.test(line)) {
        hasStrategy = true;
        if (/commission_type|commission_value/.test(line)) {
          hasCommission = true;
        }
      }
    }

    if (hasStrategy && !hasCommission) {
      this.addWarning(
        1,
        1,
        'Strategy lacks commission settings for realistic backtesting',
        'PSV6-STRATEGY-REALISM',
        'Add commission_type and commission_value parameters to strategy()',
      );
    }
  }

  private validateLegacyRiskManagement(lines: string[]): void {
    let hasStrategy = false;
    let hasRiskManagement = false;

    for (const line of lines) {
      if (/strategy\s*\(/.test(line)) {
        hasStrategy = true;
      }

      if (/strategy\.exit|strategy\.close|stop_loss|take_profit|trail_stop/.test(line)) {
        hasRiskManagement = true;
      }
    }

    if (hasStrategy && !hasRiskManagement) {
      this.addInfo(
        1,
        1,
        'Consider adding risk management features to your strategy',
        'PSV6-STRATEGY-RISK',
        'Add stop loss, take profit, or trailing stop orders',
      );
    }
  }

  private validateLegacyPositionSize(lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const qtyMatch = line.match(/qty\s*=\s*(\d+)/);
      if (!qtyMatch) {
        continue;
      }

      const qty = parseInt(qtyMatch[1], 10);
      if (Number.isNaN(qty) || qty <= POSITION_SIZE_THRESHOLD) {
        continue;
      }

      this.addWarning(
        i + 1,
        1,
        'Excessive position size may not be realistic',
        'PSV6-STRATEGY-POSITION-SIZE',
        'Consider using a more realistic position size',
      );
    }
  }

  private validateLegacyExitStrategy(lines: string[]): void {
    let hasStrategy = false;
    let hasEntry = false;
    let hasExit = false;

    for (const line of lines) {
      if (/strategy\s*\(/.test(line)) {
        hasStrategy = true;
      }

      if (/strategy\.entry/.test(line)) {
        hasEntry = true;
      }

      if (/strategy\.exit|strategy\.close|strategy\.cancel/.test(line)) {
        hasExit = true;
      }
    }

    if (hasStrategy && hasEntry && !hasExit) {
      this.addWarning(
        1,
        1,
        'Strategy has entry conditions but no exit strategy',
        'PSV6-STRATEGY-NO-EXIT',
        'Add strategy.exit() or strategy.close() calls',
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Shared helpers
  // ──────────────────────────────────────────────────────────────────────────

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
    this.usingAst = false;
  }

  private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  private addInfo(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.info.push({ line, column, message, severity: 'info', code, suggestion });
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    return isAstValidationContext(this.context) && this.context.ast
      ? (this.context as AstValidationContext)
      : null;
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
