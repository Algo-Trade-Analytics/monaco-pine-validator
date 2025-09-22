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
import { extractArgs, parseArgs } from '../core/arg-parser';

export class TickerFunctionsValidator implements ValidationModule {
  name = 'TickerFunctionsValidator';
  priority = 66;

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;
  private usingAst = false;

  getDependencies(): string[] {
    return ['CoreValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.astContext = this.getAstContext(config);
    this.usingAst = !!this.astContext?.ast;

    if (this.usingAst && this.astContext?.ast) {
      this.collectTickerCallDataAst(this.astContext.ast);
    } else {
      this.validateLegacyLines();
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: context.scriptType,
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
    this.usingAst = false;
  }

  private validateLegacyLines(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const ln = i + 1;

      if (/\bticker\.modify\s*\(/.test(line)) {
        this.info.push({
          code: 'PSV6-TICKER-MODIFY',
          message: 'Detected ticker.modify usage',
          line: ln,
          column: line.indexOf('ticker.modify') + 1,
          severity: 'info',
        });

        const argsStr = extractArgs(line, 'ticker.modify');
        const parsed = parseArgs(argsStr);
        const allowedNamed = new Set(['session', 'adjustment', 'backadjustment', 'settlement_as_close']);

        for (const name of parsed.named.keys()) {
          if (!allowedNamed.has(name)) {
            this.errors.push({
              code: 'PSV6-TICKER-MODIFY-UNKNOWN-PARAM',
              message: `Unknown parameter '${name}' in ticker.modify`,
              line: ln,
              column: Math.max(1, line.indexOf(name) + 1),
              severity: 'error',
            });
          }
        }

        const named = parsed.named;
        const valStr = (k: string) => (named.get(k) || '').trim();

        if (named.has('settlement_as_close')) {
          this.info.push({
            code: 'PSV6-TICKER-SETTLEMENT',
            message: 'Detected settlement_as_close parameter in ticker.modify',
            line: ln,
            column: Math.max(1, line.indexOf('settlement_as_close') + 1),
            severity: 'info',
          });
          const v = valStr('settlement_as_close');
          if (!/\bsettlement_as_close\.(?:on|off|inherit)\b/.test(v)) {
            this.errors.push({
              code: 'PSV6-TICKER-SETTLEMENT-VALUE',
              message: `Invalid settlement_as_close value: ${v}`,
              line: ln,
              column: Math.max(1, line.indexOf('settlement_as_close') + 1),
              severity: 'error',
            });
          }
        }
        if (named.has('adjustment')) {
          const v = valStr('adjustment');
          if (!/\badjustment\.(?:dividends|splits|none)\b/.test(v)) {
            this.errors.push({
              code: 'PSV6-TICKER-ADJ-VALUE',
              message: `Invalid adjustment value: ${v}`,
              line: ln,
              column: Math.max(1, line.indexOf('adjustment') + 1),
              severity: 'error',
            });
          }
        }
        if (named.has('backadjustment')) {
          const v = valStr('backadjustment');
          if (!/\bbackadjustment\.(?:inherit|on|off)\b/.test(v)) {
            this.errors.push({
              code: 'PSV6-TICKER-BACKADJ-VALUE',
              message: `Invalid backadjustment value: ${v}`,
              line: ln,
              column: Math.max(1, line.indexOf('backadjustment') + 1),
              severity: 'error',
            });
          }
        }
        if (named.has('session')) {
          const v = valStr('session');
          if (!/\bsession\.(?:extended|regular)\b/.test(v)) {
            this.errors.push({
              code: 'PSV6-TICKER-SESSION-VALUE',
              message: `Invalid session value: ${v}`,
              line: ln,
              column: Math.max(1, line.indexOf('session') + 1),
              severity: 'error',
            });
          }
        }
      }

      if (/\bticker\.renko\s*\(/.test(line)) {
        this.info.push({
          code: 'PSV6-TICKER-RENKO',
          message: 'Detected ticker.renko specialized constructor',
          line: ln,
          column: line.indexOf('ticker.renko') + 1,
          severity: 'info',
        });

        const args = parseArgs(extractArgs(line, 'ticker.renko'));
        if (args.positional.length >= 2) {
          const sizeType = args.positional[1].trim();
          if (!/^"ATR"$/i.test(sizeType)) {
            this.errors.push({
              code: 'PSV6-TICKER-RENKO-SIZETYPE',
              message: `Unexpected renko size type: ${sizeType}. Expected "ATR"`,
              line: ln,
              column: line.indexOf(sizeType) + 1,
              severity: 'error',
            });
          }
        }
        if (args.positional.length >= 3) {
          const sizeVal = args.positional[2].trim();
          if (!/^\d+(?:\.\d+)?$/.test(sizeVal)) {
            this.errors.push({
              code: 'PSV6-TICKER-RENKO-SIZE-TYPE',
              message: `Renko size must be numeric literal, got: ${sizeVal}`,
              line: ln,
              column: line.indexOf(sizeVal) + 1,
              severity: 'error',
            });
          }
        }
        if (args.named.has('request_wicks')) {
          const v = args.named.get('request_wicks')!.trim();
          if (!/^(true|false)$/.test(v)) {
            this.errors.push({
              code: 'PSV6-TICKER-RENKO-WICKS-TYPE',
              message: `request_wicks must be bool literal, got: ${v}`,
              line: ln,
              column: line.indexOf('request_wicks') + 1,
              severity: 'error',
            });
          }
        }
        if (args.named.has('source')) {
          const v = args.named.get('source')!.trim();
          if (!/^"OHLC"$/.test(v)) {
            this.errors.push({
              code: 'PSV6-TICKER-RENKO-SOURCE',
              message: `source must be "OHLC" for advanced renko, got: ${v}`,
              line: ln,
              column: line.indexOf('source') + 1,
              severity: 'error',
            });
          }
        }
      }

      if (/\bticker\.pointfigure\s*\(/.test(line)) {
        this.info.push({
          code: 'PSV6-TICKER-PNF',
          message: 'Detected ticker.pointfigure specialized constructor',
          line: ln,
          column: line.indexOf('ticker.pointfigure') + 1,
          severity: 'info',
        });
        const args = parseArgs(extractArgs(line, 'ticker.pointfigure'));
        if (args.positional.length >= 2) {
          const src = args.positional[1].trim();
          if (!/^"hl"$/i.test(src)) {
            this.errors.push({
              code: 'PSV6-TICKER-PNF-SOURCE',
              message: `pointfigure source should be "hl", got: ${src}`,
              line: ln,
              column: line.indexOf(src) + 1,
              severity: 'error',
            });
          }
        }
        if (args.positional.length >= 3) {
          const typ = args.positional[2].trim();
          if (!/^"PercentageLTP"$/i.test(typ)) {
            this.errors.push({
              code: 'PSV6-TICKER-PNF-SIZE-TYPE',
              message: `pointfigure sizing type should be "PercentageLTP", got: ${typ}`,
              line: ln,
              column: line.indexOf(typ) + 1,
              severity: 'error',
            });
          }
        }
        if (args.positional.length >= 4) {
          const box = args.positional[3].trim();
          if (!/^\d+(?:\.\d+)?$/.test(box)) {
            this.errors.push({
              code: 'PSV6-TICKER-PNF-BOXSIZE',
              message: `pointfigure box size must be numeric literal, got: ${box}`,
              line: ln,
              column: line.indexOf(box) + 1,
              severity: 'error',
            });
          }
        }
        if (args.positional.length >= 5) {
          const rev = args.positional[4].trim();
          if (!/^\d+$/.test(rev)) {
            this.errors.push({
              code: 'PSV6-TICKER-PNF-REVERSAL-TYPE',
              message: `pointfigure reversal must be integer literal, got: ${rev}`,
              line: ln,
              column: line.indexOf(rev) + 1,
              severity: 'error',
            });
          }
        }
      }

      if (/\bticker\.kagi\s*\(/.test(line)) {
        this.info.push({
          code: 'PSV6-TICKER-KAGI',
          message: 'Detected ticker.kagi specialized constructor',
          line: ln,
          column: line.indexOf('ticker.kagi') + 1,
          severity: 'info',
        });
        const args = parseArgs(extractArgs(line, 'ticker.kagi'));
        if (args.named.has('param')) {
          const p = args.named.get('param')!.trim();
          if (!/^\d+(?:\.\d+)?$/.test(p)) {
            this.errors.push({
              code: 'PSV6-TICKER-KAGI-PARAM-TYPE',
              message: `kagi param must be numeric literal, got: ${p}`,
              line: ln,
              column: line.indexOf('param') + 1,
              severity: 'error',
            });
          }
        }
        if (args.named.has('style')) {
          const s = args.named.get('style')!.trim();
          if (!/^"ATR"$/i.test(s)) {
            this.errors.push({
              code: 'PSV6-TICKER-KAGI-STYLE',
              message: `kagi style must be "ATR" for advanced usage, got: ${s}`,
              line: ln,
              column: line.indexOf('style') + 1,
              severity: 'error',
            });
          }
        }
      }

      if (/\bticker\.heikinashi\s*\(/.test(line)) {
        this.info.push({
          code: 'PSV6-TICKER-HEIKIN',
          message: 'Detected ticker.heikinashi transform',
          line: ln,
          column: line.indexOf('ticker.heikinashi') + 1,
          severity: 'info',
        });
      }
      if (/\bticker\.inherit\s*\(/.test(line)) {
        this.info.push({
          code: 'PSV6-TICKER-INHERIT',
          message: 'Detected ticker.inherit usage',
          line: ln,
          column: line.indexOf('ticker.inherit') + 1,
          severity: 'info',
        });
      }
      if (/\bticker\.new\s*\(/.test(line)) {
        this.info.push({
          code: 'PSV6-TICKER-NEW',
          message: 'Detected ticker.new usage',
          line: ln,
          column: line.indexOf('ticker.new') + 1,
          severity: 'info',
        });
      }
    }
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
        this.info.push({
          code: 'PSV6-TICKER-HEIKIN',
          message: 'Detected ticker.heikinashi transform',
          line,
          column,
          severity: 'info',
        });
        break;
      case 'ticker.inherit':
        this.info.push({
          code: 'PSV6-TICKER-INHERIT',
          message: 'Detected ticker.inherit usage',
          line,
          column,
          severity: 'info',
        });
        break;
      case 'ticker.new':
        this.info.push({
          code: 'PSV6-TICKER-NEW',
          message: 'Detected ticker.new usage',
          line,
          column,
          severity: 'info',
        });
        break;
      default:
        break;
    }
  }

  private handleTickerModifyAst(call: CallExpressionNode, line: number, column: number): void {
    this.info.push({
      code: 'PSV6-TICKER-MODIFY',
      message: 'Detected ticker.modify usage',
      line,
      column,
      severity: 'info',
    });

    const allowedNamed = new Set(['session', 'adjustment', 'backadjustment', 'settlement_as_close']);
    const namedArgs = this.extractNamedArguments(call.args);

    for (const [name, argument] of namedArgs) {
      if (!allowedNamed.has(name)) {
        this.errors.push({
          code: 'PSV6-TICKER-MODIFY-UNKNOWN-PARAM',
          message: `Unknown parameter '${name}' in ticker.modify`,
          line,
          column: this.getArgumentColumn(argument),
          severity: 'error',
        });
      }
    }

    const settlementArg = namedArgs.get('settlement_as_close');
    if (settlementArg) {
      this.info.push({
        code: 'PSV6-TICKER-SETTLEMENT',
        message: 'Detected settlement_as_close parameter in ticker.modify',
        line,
        column: this.getArgumentColumn(settlementArg),
        severity: 'info',
      });
      const value = this.getArgumentValueText(settlementArg);
      if (!/\bsettlement_as_close\.(?:on|off|inherit)\b/.test(value)) {
        this.errors.push({
          code: 'PSV6-TICKER-SETTLEMENT-VALUE',
          message: `Invalid settlement_as_close value: ${value}`,
          line,
          column: this.getArgumentColumn(settlementArg),
          severity: 'error',
        });
      }
    }

    const adjustmentArg = namedArgs.get('adjustment');
    if (adjustmentArg) {
      const value = this.getArgumentValueText(adjustmentArg);
      if (!/\badjustment\.(?:dividends|splits|none)\b/.test(value)) {
        this.errors.push({
          code: 'PSV6-TICKER-ADJ-VALUE',
          message: `Invalid adjustment value: ${value}`,
          line,
          column: this.getArgumentColumn(adjustmentArg),
          severity: 'error',
        });
      }
    }

    const backAdjustmentArg = namedArgs.get('backadjustment');
    if (backAdjustmentArg) {
      const value = this.getArgumentValueText(backAdjustmentArg);
      if (!/\bbackadjustment\.(?:inherit|on|off)\b/.test(value)) {
        this.errors.push({
          code: 'PSV6-TICKER-BACKADJ-VALUE',
          message: `Invalid backadjustment value: ${value}`,
          line,
          column: this.getArgumentColumn(backAdjustmentArg),
          severity: 'error',
        });
      }
    }

    const sessionArg = namedArgs.get('session');
    if (sessionArg) {
      const value = this.getArgumentValueText(sessionArg);
      if (!/\bsession\.(?:extended|regular)\b/.test(value)) {
        this.errors.push({
          code: 'PSV6-TICKER-SESSION-VALUE',
          message: `Invalid session value: ${value}`,
          line,
          column: this.getArgumentColumn(sessionArg),
          severity: 'error',
        });
      }
    }
  }

  private handleTickerRenkoAst(call: CallExpressionNode, line: number, column: number): void {
    this.info.push({
      code: 'PSV6-TICKER-RENKO',
      message: 'Detected ticker.renko specialized constructor',
      line,
      column,
      severity: 'info',
    });

    const { positional, named } = this.partitionArguments(call.args);

    if (positional.length >= 2) {
      const sizeType = this.getArgumentValueText(positional[1]);
      if (!/^"ATR"$/i.test(sizeType)) {
        this.errors.push({
          code: 'PSV6-TICKER-RENKO-SIZETYPE',
          message: `Unexpected renko size type: ${sizeType}. Expected "ATR"`,
          line,
          column: this.getArgumentColumn(positional[1]),
          severity: 'error',
        });
      }
    }

    if (positional.length >= 3) {
      const sizeValue = this.getArgumentValueText(positional[2]);
      if (!/^\d+(?:\.\d+)?$/.test(sizeValue)) {
        this.errors.push({
          code: 'PSV6-TICKER-RENKO-SIZE-TYPE',
          message: `Renko size must be numeric literal, got: ${sizeValue}`,
          line,
          column: this.getArgumentColumn(positional[2]),
          severity: 'error',
        });
      }
    }

    const requestWicks = named.get('request_wicks');
    if (requestWicks) {
      const value = this.getArgumentValueText(requestWicks);
      if (!/^(true|false)$/.test(value)) {
        this.errors.push({
          code: 'PSV6-TICKER-RENKO-WICKS-TYPE',
          message: `request_wicks must be bool literal, got: ${value}`,
          line,
          column: this.getArgumentColumn(requestWicks),
          severity: 'error',
        });
      }
    }

    const sourceArg = named.get('source');
    if (sourceArg) {
      const value = this.getArgumentValueText(sourceArg);
      if (!/^"OHLC"$/.test(value)) {
        this.errors.push({
          code: 'PSV6-TICKER-RENKO-SOURCE',
          message: `source must be "OHLC" for advanced renko, got: ${value}`,
          line,
          column: this.getArgumentColumn(sourceArg),
          severity: 'error',
        });
      }
    }
  }

  private handleTickerPointFigureAst(call: CallExpressionNode, line: number, column: number): void {
    this.info.push({
      code: 'PSV6-TICKER-PNF',
      message: 'Detected ticker.pointfigure specialized constructor',
      line,
      column,
      severity: 'info',
    });

    const { positional } = this.partitionArguments(call.args);

    if (positional.length >= 2) {
      const source = this.getArgumentValueText(positional[1]);
      if (!/^"hl"$/i.test(source)) {
        this.errors.push({
          code: 'PSV6-TICKER-PNF-SOURCE',
          message: `pointfigure source should be "hl", got: ${source}`,
          line,
          column: this.getArgumentColumn(positional[1]),
          severity: 'error',
        });
      }
    }

    if (positional.length >= 3) {
      const sizeType = this.getArgumentValueText(positional[2]);
      if (!/^"PercentageLTP"$/i.test(sizeType)) {
        this.errors.push({
          code: 'PSV6-TICKER-PNF-SIZE-TYPE',
          message: `pointfigure sizing type should be "PercentageLTP", got: ${sizeType}`,
          line,
          column: this.getArgumentColumn(positional[2]),
          severity: 'error',
        });
      }
    }

    if (positional.length >= 4) {
      const boxSize = this.getArgumentValueText(positional[3]);
      if (!/^\d+(?:\.\d+)?$/.test(boxSize)) {
        this.errors.push({
          code: 'PSV6-TICKER-PNF-BOXSIZE',
          message: `pointfigure box size must be numeric literal, got: ${boxSize}`,
          line,
          column: this.getArgumentColumn(positional[3]),
          severity: 'error',
        });
      }
    }

    if (positional.length >= 5) {
      const reversal = this.getArgumentValueText(positional[4]);
      if (!/^\d+$/.test(reversal)) {
        this.errors.push({
          code: 'PSV6-TICKER-PNF-REVERSAL-TYPE',
          message: `pointfigure reversal must be integer literal, got: ${reversal}`,
          line,
          column: this.getArgumentColumn(positional[4]),
          severity: 'error',
        });
      }
    }
  }

  private handleTickerKagiAst(call: CallExpressionNode, line: number, column: number): void {
    this.info.push({
      code: 'PSV6-TICKER-KAGI',
      message: 'Detected ticker.kagi specialized constructor',
      line,
      column,
      severity: 'info',
    });

    const namedArgs = this.extractNamedArguments(call.args);

    const paramArg = namedArgs.get('param');
    if (paramArg) {
      const value = this.getArgumentValueText(paramArg);
      if (!/^\d+(?:\.\d+)?$/.test(value)) {
        this.errors.push({
          code: 'PSV6-TICKER-KAGI-PARAM-TYPE',
          message: `kagi param must be numeric literal, got: ${value}`,
          line,
          column: this.getArgumentColumn(paramArg),
          severity: 'error',
        });
      }
    }

    const styleArg = namedArgs.get('style');
    if (styleArg) {
      const value = this.getArgumentValueText(styleArg);
      if (!/^"ATR"$/i.test(value)) {
        this.errors.push({
          code: 'PSV6-TICKER-KAGI-STYLE',
          message: `kagi style must be "ATR" for advanced usage, got: ${value}`,
          line,
          column: this.getArgumentColumn(styleArg),
          severity: 'error',
        });
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
          return this.getNodeSource(member);
        }
        const objectText = this.getExpressionText(member.object);
        return `${objectText}.${member.property.name}`;
      }
      case 'CallExpression':
        return this.getNodeSource(expression);
      default:
        return this.getNodeSource(expression);
    }
  }

  private getNodeSource(node: ExpressionNode | ArgumentNode | CallExpressionNode): string {
    const lines = this.context.lines ?? [];
    if (!node.loc) {
      return '';
    }
    const startLineIndex = Math.max(0, node.loc.start.line - 1);
    const endLineIndex = Math.max(0, node.loc.end.line - 1);
    if (startLineIndex === endLineIndex) {
      const line = lines[startLineIndex] ?? '';
      return line.slice(node.loc.start.column - 1, Math.max(node.loc.start.column - 1, node.loc.end.column - 1));
    }
    const parts: string[] = [];
    const firstLine = lines[startLineIndex] ?? '';
    parts.push(firstLine.slice(node.loc.start.column - 1));
    for (let index = startLineIndex + 1; index < endLineIndex; index++) {
      parts.push(lines[index] ?? '');
    }
    const lastLine = lines[endLineIndex] ?? '';
    parts.push(lastLine.slice(0, Math.max(0, node.loc.end.column - 1)));
    return parts.join('\n');
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
