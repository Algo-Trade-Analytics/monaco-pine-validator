/**
 * Ticker Functions Validator for Pine Script v6
 * Covers specialized ticker.* constructors/modifiers and inheritance chains
 */

import { ValidationModule, ValidationContext, ValidatorConfig, ValidationError, ValidationResult } from '../core/types';
import { extractArgs, parseArgs } from '../core/arg-parser';

export class TickerFunctionsValidator implements ValidationModule {
  name = 'TickerFunctionsValidator';
  priority = 66;

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  getDependencies(): string[] {
    return ['CoreValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.context = context;
    this.config = config;
    this.errors = [];
    this.warnings = [];
    this.info = [];

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const ln = i + 1;

      // ticker.modify with advanced params
      if (/\bticker\.modify\s*\(/.test(line)) {
        this.info.push({
          code: 'PSV6-TICKER-MODIFY',
          message: 'Detected ticker.modify usage',
          line: ln,
          column: line.indexOf('ticker.modify') + 1,
          severity: 'info'
        });

        const argsStr = extractArgs(line, 'ticker.modify');
        const parsed = parseArgs(argsStr);
        const allowedNamed = new Set(['session','adjustment','backadjustment','settlement_as_close']);

        // Unknown named args
        for (const name of parsed.named.keys()) {
          if (!allowedNamed.has(name)) {
            this.errors.push({
              code: 'PSV6-TICKER-MODIFY-UNKNOWN-PARAM',
              message: `Unknown parameter '${name}' in ticker.modify` ,
              line: ln,
              column: Math.max(1, line.indexOf(name) + 1),
              severity: 'error'
            });
          }
        }

        // Validate named values if present
        const named = parsed.named;
        const valStr = (k: string) => (named.get(k) || '').trim();

        if (named.has('settlement_as_close')) {
          this.info.push({
            code: 'PSV6-TICKER-SETTLEMENT',
            message: 'Detected settlement_as_close parameter in ticker.modify',
            line: ln,
            column: Math.max(1, line.indexOf('settlement_as_close') + 1),
            severity: 'info'
          });
          const v = valStr('settlement_as_close');
          if (!/\bsettlement_as_close\.(?:on|off|inherit)\b/.test(v)) {
            this.errors.push({
              code: 'PSV6-TICKER-SETTLEMENT-VALUE',
              message: `Invalid settlement_as_close value: ${v}`,
              line: ln,
              column: Math.max(1, line.indexOf('settlement_as_close') + 1),
              severity: 'error'
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
              severity: 'error'
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
              severity: 'error'
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
              severity: 'error'
            });
          }
        }
      }

      // Specialized chart-type constructors
      if (/\bticker\.renko\s*\(/.test(line)) {
        this.info.push({
          code: 'PSV6-TICKER-RENKO',
          message: 'Detected ticker.renko specialized constructor',
          line: ln,
          column: line.indexOf('ticker.renko') + 1,
          severity: 'info'
        });

        const args = parseArgs(extractArgs(line, 'ticker.renko'));
        // Expected: symbol, sizeType, size, [request_wicks=bool], [source=str]
        if (args.positional.length >= 2) {
          const sizeType = args.positional[1].trim();
          if (!/^"ATR"$/i.test(sizeType)) {
            this.errors.push({
              code: 'PSV6-TICKER-RENKO-SIZETYPE',
              message: `Unexpected renko size type: ${sizeType}. Expected "ATR"`,
              line: ln,
              column: line.indexOf(sizeType) + 1,
              severity: 'error'
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
              severity: 'error'
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
              severity: 'error'
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
              severity: 'error'
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
          severity: 'info'
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
              severity: 'error'
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
              severity: 'error'
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
              severity: 'error'
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
              severity: 'error'
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
          severity: 'info'
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
              severity: 'error'
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
              severity: 'error'
            });
          }
        }
      }

      // Inheritance chain helpers
      if (/\bticker\.heikinashi\s*\(/.test(line)) {
        this.info.push({
          code: 'PSV6-TICKER-HEIKIN',
          message: 'Detected ticker.heikinashi transform',
          line: ln,
          column: line.indexOf('ticker.heikinashi') + 1,
          severity: 'info'
        });
      }
      if (/\bticker\.inherit\s*\(/.test(line)) {
        this.info.push({
          code: 'PSV6-TICKER-INHERIT',
          message: 'Detected ticker.inherit usage',
          line: ln,
          column: line.indexOf('ticker.inherit') + 1,
          severity: 'info'
        });
      }
      if (/\bticker\.new\s*\(/.test(line)) {
        this.info.push({
          code: 'PSV6-TICKER-NEW',
          message: 'Detected ticker.new usage',
          line: ln,
          column: line.indexOf('ticker.new') + 1,
          severity: 'info'
        });
      }
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: context.scriptType
    };
  }

}
