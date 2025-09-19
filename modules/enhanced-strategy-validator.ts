/**
 * Enhanced Strategy Validator Module
 * 
 * Handles strategy-specific validation for Pine Script v6:
 * - PSV6-STRATEGY-REALISM: Missing commission settings
 * - PSV6-STRATEGY-RISK: Risk management suggestions
 * - PSV6-STRATEGY-POSITION-SIZE: Excessive position size
 * - PSV6-STRATEGY-NO-EXIT: Missing exit strategy
 */

import { ValidationModule } from '../core/types';

export class EnhancedStrategyValidator implements ValidationModule {
  name = 'EnhancedStrategyValidator';
  priority = 75; // Run after basic syntax validation

  getDependencies(): string[] {
    return ['CoreValidator', 'SyntaxValidator'];
  }

  validate(context: any, config: any): any {
    const result = {
      errors: [],
      warnings: [],
      info: [],
      typeMap: new Map()
    };

    this.validateStrategyRealism(context.lines, result);
    this.validateRiskManagement(context.lines, result);
    this.validatePositionSize(context.lines, result);
    this.validateExitStrategy(context.lines, result);

    return result;
  }

  /**
   * PSV6-STRATEGY-REALISM: Validate strategy has realistic commission settings
   */
  private validateStrategyRealism(lines: string[], result: any): void {
    let hasStrategy = false;
    let hasCommission = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for strategy declaration
      if (/strategy\s*\(/.test(line)) {
        hasStrategy = true;
        
        // Check for commission settings in the same line
        if (/commission_type|commission_value/.test(line)) {
          hasCommission = true;
        }
      }
    }

    if (hasStrategy && !hasCommission) {
      result.warnings.push({
        line: 1,
        column: 1,
        message: 'Strategy lacks commission settings for realistic backtesting',
        severity: 'warning',
        code: 'PSV6-STRATEGY-REALISM',
        suggestion: 'Add commission_type and commission_value parameters to strategy()'
      });
    }
  }

  /**
   * PSV6-STRATEGY-RISK: Suggest risk management for strategies
   */
  private validateRiskManagement(lines: string[], result: any): void {
    let hasStrategy = false;
    let hasRiskManagement = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for strategy declaration
      if (/strategy\s*\(/.test(line)) {
        hasStrategy = true;
      }

      // Check for risk management features
      if (/strategy\.exit|strategy\.close|stop_loss|take_profit|trail_stop/.test(line)) {
        hasRiskManagement = true;
      }
    }

    if (hasStrategy && !hasRiskManagement) {
      result.info.push({
        line: 1,
        column: 1,
        message: 'Consider adding risk management features to your strategy',
        severity: 'info',
        code: 'PSV6-STRATEGY-RISK',
        suggestion: 'Add stop loss, take profit, or trailing stop orders'
      });
    }
  }

  /**
   * PSV6-STRATEGY-POSITION-SIZE: Validate position size is reasonable
   */
  private validatePositionSize(lines: string[], result: any): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for strategy.entry with excessive qty
      const qtyMatch = line.match(/qty\s*=\s*(\d+)/);
      if (qtyMatch) {
        const qty = parseInt(qtyMatch[1]);
        if (qty > 100000) { // Arbitrary threshold for "excessive"
          result.warnings.push({
            line: lineNum,
            column: 1,
            message: 'Excessive position size may not be realistic',
            severity: 'warning',
            code: 'PSV6-STRATEGY-POSITION-SIZE',
            suggestion: 'Consider using a more realistic position size'
          });
        }
      }
    }
  }

  /**
   * PSV6-STRATEGY-NO-EXIT: Validate strategy has exit conditions
   */
  private validateExitStrategy(lines: string[], result: any): void {
    let hasStrategy = false;
    let hasEntry = false;
    let hasExit = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for strategy declaration
      if (/strategy\s*\(/.test(line)) {
        hasStrategy = true;
      }

      // Check for strategy.entry
      if (/strategy\.entry/.test(line)) {
        hasEntry = true;
      }

      // Check for exit strategies
      if (/strategy\.exit|strategy\.close|strategy\.cancel/.test(line)) {
        hasExit = true;
      }
    }

    if (hasStrategy && hasEntry && !hasExit) {
      result.warnings.push({
        line: 1,
        column: 1,
        message: 'Strategy has entry conditions but no exit strategy',
        severity: 'warning',
        code: 'PSV6-STRATEGY-NO-EXIT',
        suggestion: 'Add strategy.exit() or strategy.close() calls'
      });
    }
  }
}
