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

interface StrategyTextCall {
  line: number;
  column: number;
  args: string[];
  namedArgs: Map<string, string>;
}

interface StrategyTextData {
  strategyCalls: StrategyTextCall[];
  entryCalls: StrategyTextCall[];
  exitCalls: StrategyTextCall[];
  closeCalls: StrategyTextCall[];
  cancelCalls: StrategyTextCall[];
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

    if (this.astContext?.ast) {
      this.validateWithAst(this.astContext.ast);
    }

    this.validateWithText();

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

  private validateWithText(): void {
    const lines = this.getSourceLines();
    if (lines.length === 0) {
      return;
    }

    const data = this.collectStrategyDataText(lines);
    this.debug({ phase: 'text-data', data });
    this.validateTextStrategyRealism(data);
    this.validateTextRiskManagement(data);
    this.validateTextPositionSize(data);
    this.validateTextExitStrategy(data);
  }

  private collectStrategyDataText(lines: string[]): StrategyTextData {
    const data: StrategyTextData = {
      strategyCalls: [],
      entryCalls: [],
      exitCalls: [],
      closeCalls: [],
      cancelCalls: [],
      hasRiskIdentifier: false,
    };

    const callRegex = /strategy(?:\.[A-Za-z_]+)?\s*\(/g;

    for (let index = 0; index < lines.length; index++) {
      const rawLine = lines[index];
      const lineWithoutComment = this.stripInlineComment(rawLine);
      const trimmed = lineWithoutComment.trim();
      if (!trimmed) {
        continue;
      }

      if (!data.hasRiskIdentifier && /\b(stop_loss|take_profit|trail_stop)\b/.test(trimmed)) {
        data.hasRiskIdentifier = true;
      }

      callRegex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = callRegex.exec(lineWithoutComment)) !== null) {
        const parenIndexInMatch = match[0].indexOf('(');
        if (parenIndexInMatch === -1) {
          continue;
        }

        const qualifiedNameRaw = lineWithoutComment
          .slice(match.index, match.index + parenIndexInMatch)
          .trim();
        const qualifiedName = qualifiedNameRaw.length > 0 ? qualifiedNameRaw : 'strategy';
        const openParenIndex = match.index + parenIndexInMatch;
        const argsSection = this.extractArgumentsSectionFromText(lines, index, openParenIndex + 1);
        const args = this.splitArgumentsText(argsSection);
        const namedArgs = this.parseNamedArguments(args);

        const call: StrategyTextCall = {
          line: index + 1,
          column: openParenIndex + 1,
          args,
          namedArgs,
        };

        if (qualifiedName === 'strategy') {
          data.strategyCalls.push(call);
        } else if (qualifiedName === 'strategy.entry') {
          data.entryCalls.push(call);
        } else if (qualifiedName === 'strategy.exit') {
          data.exitCalls.push(call);
        } else if (qualifiedName === 'strategy.close') {
          data.closeCalls.push(call);
        } else if (qualifiedName === 'strategy.cancel') {
          data.cancelCalls.push(call);
        }
      }
    }

    return data;
  }

  private validateTextStrategyRealism(data: StrategyTextData): void {
    if (data.strategyCalls.length === 0) {
      return;
    }

    const hasCommission = data.strategyCalls.some((call) =>
      call.namedArgs.has('commission_type') || call.namedArgs.has('commission_value'),
    );

    if (!hasCommission && !this.hasWarning('PSV6-STRATEGY-REALISM')) {
      const location = data.strategyCalls[0];
      this.addWarning(
        location.line,
        location.column,
        'Strategy lacks commission settings for realistic backtesting',
        'PSV6-STRATEGY-REALISM',
        'Add commission_type and commission_value parameters to strategy()',
      );
    }
  }

  private validateTextRiskManagement(data: StrategyTextData): void {
    if (data.strategyCalls.length === 0) {
      return;
    }

    const hasRiskManagement =
      data.exitCalls.length > 0 || data.closeCalls.length > 0 || data.hasRiskIdentifier;

    if (!hasRiskManagement && data.strategyCalls.length > 0 && !this.hasInfo('PSV6-STRATEGY-RISK')) {
      const location = data.strategyCalls[0];
      this.addInfo(
        location.line,
        location.column,
        'Consider adding risk management features to your strategy',
        'PSV6-STRATEGY-RISK',
        'Add stop loss, take profit, or trailing stop orders',
      );
    }
  }

  private validateTextPositionSize(data: StrategyTextData): void {
    for (const call of data.entryCalls) {
      const qtyArg = call.namedArgs.get('qty');
      if (!qtyArg) {
        continue;
      }

      const numericMatch = qtyArg.match(/^-?\d+(?:\.\d+)?$/);
      if (numericMatch) {
        const value = Number(numericMatch[0]);
        if (!Number.isNaN(value) && value > POSITION_SIZE_THRESHOLD && !this.hasWarning('PSV6-STRATEGY-POSITION-SIZE')) {
          this.addWarning(
            call.line,
            call.column,
            'Excessive position size may not be realistic',
            'PSV6-STRATEGY-POSITION-SIZE',
            'Consider using a more realistic position size',
          );
        }
      }
    }
  }

  private validateTextExitStrategy(data: StrategyTextData): void {
    if (data.strategyCalls.length === 0 || data.entryCalls.length === 0) {
      return;
    }

    const hasExit =
      data.exitCalls.length > 0 || data.closeCalls.length > 0 || data.cancelCalls.length > 0;

    if (!hasExit && !this.hasWarning('PSV6-STRATEGY-NO-EXIT')) {
      const location = data.entryCalls[0];
      this.addWarning(
        location.line,
        location.column,
        'Strategy has entry conditions but no exit strategy',
        'PSV6-STRATEGY-NO-EXIT',
        'Add strategy.exit() or strategy.close() calls',
      );
    }
  }

  private extractArgumentsSectionFromText(
    lines: string[],
    startLine: number,
    startColumn: number,
  ): string {
    let buffer = '';
    let depth = 1;
    let lineIndex = startLine;
    let columnIndex = startColumn;
    let inString = false;
    let stringDelimiter: string | null = null;

    while (lineIndex < lines.length && depth > 0) {
      const line = lines[lineIndex];
      for (let i = columnIndex; i < line.length; i++) {
        const char = line[i];

        if (inString) {
          buffer += char;
          if (char === stringDelimiter && line[i - 1] !== '\\') {
            inString = false;
            stringDelimiter = null;
          }
          continue;
        }

        if (char === '"' || char === "'") {
          inString = true;
          stringDelimiter = char;
          buffer += char;
          continue;
        }

        if (char === '(') {
          depth += 1;
          buffer += char;
          continue;
        }

        if (char === ')') {
          depth -= 1;
          if (depth === 0) {
            return buffer.trim();
          }
          buffer += char;
          continue;
        }

        buffer += char;
      }

      buffer += ' ';
      lineIndex += 1;
      columnIndex = 0;
    }

    return buffer.trim();
  }

  private splitArgumentsText(text: string): string[] {
    const args: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar: string | null = null;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (inString) {
        current += char;
        if (char === stringChar && text[i - 1] !== '\\') {
          inString = false;
          stringChar = null;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        current += char;
        continue;
      }

      if (char === '(') {
        depth += 1;
        current += char;
        continue;
      }

      if (char === ')') {
        depth -= 1;
        current += char;
        continue;
      }

      if (char === ',' && depth === 0) {
        if (current.trim().length > 0) {
          args.push(current.trim());
        }
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim().length > 0) {
      args.push(current.trim());
    }

    return args;
  }

  private parseNamedArguments(args: string[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const arg of args) {
      const equalsIndex = arg.indexOf('=');
      if (equalsIndex === -1) {
        continue;
      }
      const name = arg.slice(0, equalsIndex).trim();
      if (!name) {
        continue;
      }
      const value = arg.slice(equalsIndex + 1).trim();
      map.set(name, value);
    }
    return map;
  }

  private getSourceLines(): string[] {
    if (!this.context) {
      return [];
    }

    if (Array.isArray(this.context.cleanLines) && this.context.cleanLines.length > 0) {
      return [...this.context.cleanLines];
    }

    if (Array.isArray(this.context.lines) && this.context.lines.length > 0) {
      return [...this.context.lines];
    }

    if (Array.isArray(this.context.rawLines) && this.context.rawLines.length > 0) {
      return [...this.context.rawLines];
    }

    return [];
  }

  private stripInlineComment(line: string): string {
    const commentIndex = line.indexOf('//');
    return commentIndex >= 0 ? line.slice(0, commentIndex) : line;
  }

  private hasWarning(code: string): boolean {
    return this.warnings.some((warning) => warning.code === code);
  }

  private hasInfo(code: string): boolean {
    return this.info.some((info) => info.code === code);
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
