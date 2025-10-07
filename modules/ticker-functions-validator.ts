/**
 * Ticker Functions Validator for Pine Script v6
 * Covers specialized ticker.* constructors/modifiers and inheritance chains
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidatorConfig,
  type ValidationError,
  type ValidationResult,
} from '../core/types';
import { Codes } from '../core/codes';
import { ValidationHelper } from '../core/validation-helper';
import {
  type ArgumentNode,
  type BooleanLiteralNode,
  type CallExpressionNode,
  type ExpressionNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type NumberLiteralNode,
  type ProgramNode,
  type StringLiteralNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';
import { getNodeSource as extractNodeSource } from '../core/ast/source-utils';

export class TickerFunctionsValidator implements ValidationModule {
  name = 'TickerFunctionsValidator';
  priority = 66;

  private helper = new ValidationHelper();
  private context!: ValidationContext;
  private astContext: AstValidationContext | null = null;

  getDependencies(): string[] {
    return ['CoreValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.astContext = this.getAstContext(config);
    const ast = this.astContext?.ast;
    if (!ast) {
      return this.helper.buildResult(context);
    }

    this.collectTickerCallDataAst(ast);

    return this.helper.buildResult(context);
  }

  private reset(): void {
    this.helper.reset();
    this.astContext = null;
  }

  private collectTickerCallDataAst(program: ProgramNode): void {
    visit(program, {
      CallExpression: {
        enter: (path) => {
          this.processAstTickerCall(path as NodePath<CallExpressionNode>);
        },
      },
    });
  }

  private processAstTickerCall(path: NodePath<CallExpressionNode>): void {
    const call = path.node;
    const qualifiedName = this.getExpressionQualifiedName(call.callee);
    if (!qualifiedName || !qualifiedName.startsWith('ticker.')) {
      return;
    }

    const line = call.loc.start.line;
    const column = call.loc.start.column;

    switch (qualifiedName) {
      case 'ticker.modify':
        this.handleTickerModifyAst(call, line, column);
        break;
      case 'ticker.renko':
        this.handleTickerRenkoAst(call, line, column);
        break;
      case 'ticker.pointfigure':
        this.handleTickerPointFigureAst(call, line, column);
        break;
      case 'ticker.kagi':
        this.handleTickerKagiAst(call, line, column);
        break;
      case 'ticker.heikinashi':
        this.helper.addInfo(line, column, 'Detected ticker.heikinashi transform', 'PSV6-TICKER-HEIKIN');
        break;
      case 'ticker.inherit':
        this.helper.addInfo(line, column, 'Detected ticker.inherit usage', 'PSV6-TICKER-INHERIT');
        break;
      case 'ticker.new':
        this.helper.addInfo(line, column, 'Detected ticker.new usage', 'PSV6-TICKER-NEW');
        break;
      default:
        break;
    }
  }

  private handleTickerModifyAst(call: CallExpressionNode, line: number, column: number): void {
    this.helper.addInfo(line, column, 'Detected ticker.modify usage', 'PSV6-TICKER-MODIFY');

    const allowedNamed = new Set(['session', 'adjustment', 'backadjustment', 'settlement_as_close']);
    const namedArgs = this.extractNamedArguments(call.args);

    for (const [name, argument] of namedArgs) {
      if (!allowedNamed.has(name)) {
        this.helper.addError(line, this.getArgumentColumn(argument), `Unknown parameter '${name}' in ticker.modify`, 'PSV6-TICKER-MODIFY-UNKNOWN-PARAM');
      }
    }

    const settlementArg = namedArgs.get('settlement_as_close');
    if (settlementArg) {
      this.helper.addInfo(line, this.getArgumentColumn(settlementArg), 'Detected settlement_as_close parameter in ticker.modify', 'PSV6-TICKER-SETTLEMENT');
      const value = this.getArgumentValueText(settlementArg);
      if (!/\bsettlement_as_close\.(?:on|off|inherit)\b/.test(value)) {
        this.helper.addError(line, this.getArgumentColumn(settlementArg), `Invalid settlement_as_close value: ${value}`, 'PSV6-TICKER-SETTLEMENT-VALUE');
      }
    }

    const adjustmentArg = namedArgs.get('adjustment');
    if (adjustmentArg) {
      const value = this.getArgumentValueText(adjustmentArg);
      if (!/\badjustment\.(?:dividends|splits|none)\b/.test(value)) {
        this.helper.addError(line, this.getArgumentColumn(adjustmentArg), `Invalid adjustment value: ${value}`, 'PSV6-TICKER-ADJ-VALUE');
      }
    }

    const backAdjustmentArg = namedArgs.get('backadjustment');
    if (backAdjustmentArg) {
      const value = this.getArgumentValueText(backAdjustmentArg);
      if (!/\bbackadjustment\.(?:inherit|on|off)\b/.test(value)) {
        this.helper.addError(line, this.getArgumentColumn(backAdjustmentArg), `Invalid backadjustment value: ${value}`, 'PSV6-TICKER-BACKADJ-VALUE');
      }
    }

    const sessionArg = namedArgs.get('session');
    if (sessionArg) {
      const value = this.getArgumentValueText(sessionArg);
      if (!/\bsession\.(?:extended|regular)\b/.test(value)) {
        this.helper.addError(line, this.getArgumentColumn(sessionArg), `Invalid session value: ${value}`, 'PSV6-TICKER-SESSION-VALUE');
      }
    }
  }

  private handleTickerRenkoAst(call: CallExpressionNode, line: number, column: number): void {
    this.helper.addInfo(line, column, 'Detected ticker.renko specialized constructor', 'PSV6-TICKER-RENKO');

    const { positional, named } = this.partitionArguments(call.args);

    if (positional.length >= 2) {
      const sizeType = this.getArgumentValueText(positional[1]);
      if (!/^"ATR"$/i.test(sizeType)) {
        this.helper.addError(line, this.getArgumentColumn(positional[1]), `Unexpected renko size type: ${sizeType}. Expected "ATR"`, 'PSV6-TICKER-RENKO-SIZETYPE');
      }
    }

    if (positional.length >= 3) {
      const sizeValue = this.getArgumentValueText(positional[2]);
      if (!/^\d+(?:\.\d+)?$/.test(sizeValue)) {
        this.helper.addError(line, this.getArgumentColumn(positional[2]), `Renko size must be numeric literal, got: ${sizeValue}`, 'PSV6-TICKER-RENKO-SIZE-TYPE');
      }
    }

    const requestWicks = named.get('request_wicks');
    if (requestWicks) {
      const value = this.getArgumentValueText(requestWicks);
      if (!/^(true|false)$/.test(value)) {
        this.helper.addError(line, this.getArgumentColumn(requestWicks), `request_wicks must be bool literal, got: ${value}`, 'PSV6-TICKER-RENKO-WICKS-TYPE');
      }
    }

    const sourceArg = named.get('source');
    if (sourceArg) {
      const value = this.getArgumentValueText(sourceArg);
      if (!/^"OHLC"$/.test(value)) {
        this.helper.addError(line, this.getArgumentColumn(sourceArg), `source must be "OHLC" for advanced renko, got: ${value}`, 'PSV6-TICKER-RENKO-SOURCE');
      }
    }
  }

  private handleTickerPointFigureAst(call: CallExpressionNode, line: number, column: number): void {
    this.helper.addInfo(line, column, 'Detected ticker.pointfigure specialized constructor', 'PSV6-TICKER-PNF');

    const { positional } = this.partitionArguments(call.args);

    if (positional.length >= 2) {
      const source = this.getArgumentValueText(positional[1]);
      if (!/^"hl"$/i.test(source)) {
        this.helper.addError(line, this.getArgumentColumn(positional[1]), `pointfigure source should be "hl", got: ${source}`, 'PSV6-TICKER-PNF-SOURCE');
      }
    }

    if (positional.length >= 3) {
      const sizeType = this.getArgumentValueText(positional[2]);
      if (!/^"PercentageLTP"$/i.test(sizeType)) {
        this.helper.addError(line, this.getArgumentColumn(positional[2]), `pointfigure sizing type should be "PercentageLTP", got: ${sizeType}`, 'PSV6-TICKER-PNF-SIZE-TYPE');
      }
    }

    if (positional.length >= 4) {
      const boxSize = this.getArgumentValueText(positional[3]);
      if (!/^\d+(?:\.\d+)?$/.test(boxSize)) {
        this.helper.addError(line, this.getArgumentColumn(positional[3]), `pointfigure box size must be numeric literal, got: ${boxSize}`, 'PSV6-TICKER-PNF-BOXSIZE');
      }
    }

    if (positional.length >= 5) {
      const reversal = this.getArgumentValueText(positional[4]);
      if (!/^\d+$/.test(reversal)) {
        this.helper.addError(line, this.getArgumentColumn(positional[4]), `pointfigure reversal must be integer literal, got: ${reversal}`, 'PSV6-TICKER-PNF-REVERSAL-TYPE');
      }
    }
  }

  private handleTickerKagiAst(call: CallExpressionNode, line: number, column: number): void {
    this.helper.addInfo(line, column, 'Detected ticker.kagi specialized constructor', 'PSV6-TICKER-KAGI');

    const namedArgs = this.extractNamedArguments(call.args);

    const paramArg = namedArgs.get('param');
    if (paramArg) {
      const value = this.getArgumentValueText(paramArg);
      if (!/^\d+(?:\.\d+)?$/.test(value)) {
        this.helper.addError(line, this.getArgumentColumn(paramArg), `kagi param must be numeric literal, got: ${value}`, 'PSV6-TICKER-KAGI-PARAM-TYPE');
      }
    }

    const styleArg = namedArgs.get('style');
    if (styleArg) {
      const value = this.getArgumentValueText(styleArg);
      if (!/^"ATR"$/i.test(value)) {
        this.helper.addError(line, this.getArgumentColumn(styleArg), `kagi style must be "ATR" for advanced usage, got: ${value}`, 'PSV6-TICKER-KAGI-STYLE');
      }
    }
  }

  private partitionArguments(args: ArgumentNode[]): { positional: ArgumentNode[]; named: Map<string, ArgumentNode> } {
    const positional: ArgumentNode[] = [];
    const named = new Map<string, ArgumentNode>();
    for (const argument of args) {
      if (argument.name) {
        named.set(argument.name.name, argument);
      } else {
        positional.push(argument);
      }
    }
    return { positional, named };
  }

  private extractNamedArguments(args: ArgumentNode[]): Map<string, ArgumentNode> {
    return this.partitionArguments(args).named;
  }

  private getArgumentValueText(argument: ArgumentNode): string {
    return this.getExpressionText(argument.value);
  }

  private getArgumentColumn(argument: ArgumentNode): number {
    if (argument.name) {
      return argument.name.loc.start.column;
    }
    return argument.value.loc.start.column;
  }

  private getExpressionText(expression: ExpressionNode): string {
    switch (expression.kind) {
      case 'StringLiteral':
        return (expression as StringLiteralNode).raw;
      case 'NumberLiteral':
        return (expression as NumberLiteralNode).raw;
      case 'BooleanLiteral':
        return (expression as BooleanLiteralNode).value ? 'true' : 'false';
      case 'Identifier':
        return (expression as IdentifierNode).name;
      case 'MemberExpression': {
        const member = expression as MemberExpressionNode;
        if (member.computed) {
          return extractNodeSource(this.context, member);
        }
        const objectText = this.getExpressionText(member.object);
        return `${objectText}.${member.property.name}`;
      }
      case 'CallExpression':
        return extractNodeSource(this.context, expression);
      default:
        return extractNodeSource(this.context, expression);
    }
  }

  private getExpressionQualifiedName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }
    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (member.computed) {
        return null;
      }
      const objectName = this.getExpressionQualifiedName(member.object);
      if (!objectName) {
        return null;
      }
      return `${objectName}.${member.property.name}`;
    }
    return null;
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    return isAstValidationContext(this.context) ? (this.context as AstValidationContext) : null;
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return (context as AstValidationContext).ast !== undefined;
}
