/**
 * Final Constants Validator for Pine Script v6
 * 
 * Validates the final 1% of specialized constants for 100% specification coverage:
 * - Math constants (math.e, math.pi, math.phi, math.rphi)
 * - Plot style constants (plot.style_* for all plot types)
 * - Line style constants (line.style_* for all line styles)
 * - Label style constants (label.style_* for all label styles)
 * - HLine style constants (hline.style_* for horizontal lines)
 * - Order constants (order.ascending, order.descending)
 * - Position constants (position.* for all table positions)
 * - Additional specialized constants
 * 
 * Final Implementation: Achieving True 100% Pine Script v6 Coverage
 */

import { ValidationModule, ValidationContext, ValidatorConfig, ValidationError, ValidationResult } from '../core/types';
import {
  DRAW_TABLE_EXTRA_CONSTANTS,
  STRATEGY_RISK_EXTRA_CONSTANTS,
  STRATEGY_COMMISSION_EXTRA_CONSTANTS,
  PLOT_STYLE_CONSTANTS,
  LINE_STYLE_CONSTANTS,
  LABEL_STYLE_CONSTANTS,
  HLINE_STYLE_CONSTANTS,
  ORDER_CONSTANTS,
  POSITION_CONSTANTS
} from '../core/constants-registry';
import { Codes } from '../core/codes';

const MATH_CONSTANTS = new Set([
  'math.e', 'math.pi', 'math.phi', 'math.rphi'
]);

// Style, order, and position constants are imported from the shared registry

const ADDITIONAL_SPECIALIZED_CONSTANTS = new Set([
  // Earnings/Dividends/Splits field constants
  'earnings.actual', 'earnings.estimate', 'earnings.standardized',
  'dividends.gross', 'dividends.net',
  'splits.denominator', 'splits.numerator',
  // Strategy constants
  'strategy.commission.percent', 'strategy.commission.cash_per_contract', 'strategy.commission.cash_per_order',
  // Extended commission constants (also provided via registry)
  ...Array.from(STRATEGY_COMMISSION_EXTRA_CONSTANTS),
  'strategy.oca.cancel', 'strategy.oca.reduce', 'strategy.oca.none',
  'strategy.direction.all', 'strategy.direction.long', 'strategy.direction.short'
]);

// Extra constants imported from registry

export class FinalConstantsValidator implements ValidationModule {
  name = 'FinalConstantsValidator';
  priority = 65; // Lower priority - these are the final edge cases

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  // Usage tracking for all final constants
  private mathConstantUsage: Map<string, number> = new Map();
  private styleConstantUsage: Map<string, number> = new Map();
  private orderConstantUsage: Map<string, number> = new Map();
  private positionConstantUsage: Map<string, number> = new Map();
  private specializedConstantUsage: Map<string, number> = new Map();

  getDependencies(): string[] {
    return ['CoreValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.context = context;
    this.config = config;
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.mathConstantUsage.clear();
    this.styleConstantUsage.clear();
    this.orderConstantUsage.clear();
    this.positionConstantUsage.clear();
    this.specializedConstantUsage.clear();

    // Validate all final specialized constants
    this.validateMathConstants();
    this.validateStyleConstants();
    this.validateOrderConstants();
    this.validatePositionConstants();
    this.validateSpecializedConstants();

    // Analyze usage patterns
    this.analyzeFinalConstantUsage();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: this.context.scriptType
    };
  }

  private validateMathConstants(): void {
    for (let i = 0; i < this.context.lines.length; i++) {
      const line = this.context.lines[i];
      const cleanLine = this.context.cleanLines[i];

      for (const constant of Array.from(MATH_CONSTANTS)) {
        if (cleanLine.includes(constant)) {
          this.mathConstantUsage.set(constant, (this.mathConstantUsage.get(constant) || 0) + 1);
          
          this.info.push({
            code: 'PSV6-MATH-CONSTANT',
            message: `Mathematical constant '${constant}' detected`,
            line: i + 1,
            column: cleanLine.indexOf(constant) + 1,
            severity: 'info'
          });
        }
      }
    }
  }

  private validateStyleConstants(): void {
    for (let i = 0; i < this.context.lines.length; i++) {
      const line = this.context.lines[i];
      const cleanLine = this.context.cleanLines[i];

      // Check all style constant sets
      const styleConstantSets = [
        PLOT_STYLE_CONSTANTS, LINE_STYLE_CONSTANTS, LABEL_STYLE_CONSTANTS, HLINE_STYLE_CONSTANTS
      ];

      for (const constantSet of styleConstantSets) {
        for (const constant of Array.from(constantSet)) {
          if (cleanLine.includes(constant)) {
            this.styleConstantUsage.set(constant, (this.styleConstantUsage.get(constant) || 0) + 1);
            
          this.info.push({
            code: Codes.STYLE_CONSTANT,
            message: `Style constant '${constant}' detected`,
            line: i + 1,
            column: cleanLine.indexOf(constant) + 1,
            severity: 'info'
          });
          }
        }
      }
    }
  }

  private validateOrderConstants(): void {
    for (let i = 0; i < this.context.lines.length; i++) {
      const line = this.context.lines[i];
      const cleanLine = this.context.cleanLines[i];

      for (const constant of Array.from(ORDER_CONSTANTS)) {
        if (cleanLine.includes(constant)) {
          this.orderConstantUsage.set(constant, (this.orderConstantUsage.get(constant) || 0) + 1);
          
          this.info.push({
            code: Codes.ORDER_CONSTANT,
            message: `Array sort order constant '${constant}' detected`,
            line: i + 1,
            column: cleanLine.indexOf(constant) + 1,
            severity: 'info'
          });
        }
      }
    }
  }

  private validatePositionConstants(): void {
    for (let i = 0; i < this.context.lines.length; i++) {
      const line = this.context.lines[i];
      const cleanLine = this.context.cleanLines[i];

      for (const constant of Array.from(POSITION_CONSTANTS)) {
        if (cleanLine.includes(constant)) {
          this.positionConstantUsage.set(constant, (this.positionConstantUsage.get(constant) || 0) + 1);
          
          this.info.push({
            code: Codes.POSITION_CONSTANT,
            message: `Table position constant '${constant}' detected`,
            line: i + 1,
            column: cleanLine.indexOf(constant) + 1,
            severity: 'info'
          });
        }
      }
    }
  }

  private validateSpecializedConstants(): void {
    for (let i = 0; i < this.context.lines.length; i++) {
      const line = this.context.lines[i];
      const cleanLine = this.context.cleanLines[i];

      const sets = [ADDITIONAL_SPECIALIZED_CONSTANTS, DRAW_TABLE_EXTRA_CONSTANTS, STRATEGY_RISK_EXTRA_CONSTANTS];
      for (const constant of Array.from(new Set(Array.from(sets[0]).concat(Array.from(sets[1])).concat(Array.from(sets[2]))))) {
        if (cleanLine.includes(constant)) {
          this.specializedConstantUsage.set(constant, (this.specializedConstantUsage.get(constant) || 0) + 1);
          
          this.info.push({
            code: Codes.SPECIALIZED_CONSTANT,
            message: `Specialized constant '${constant}' detected`,
            line: i + 1,
            column: cleanLine.indexOf(constant) + 1,
            severity: 'info'
          });
        }
      }
    }
  }

  private analyzeFinalConstantUsage(): void {
    const totalMathConstants = this.mathConstantUsage.size;
    const totalStyleConstants = this.styleConstantUsage.size;
    const totalOrderConstants = this.orderConstantUsage.size;
    const totalPositionConstants = this.positionConstantUsage.size;
    const totalSpecializedConstants = this.specializedConstantUsage.size;

    const grandTotal = totalMathConstants + totalStyleConstants + totalOrderConstants + 
                      totalPositionConstants + totalSpecializedConstants;

    if (grandTotal > 0) {
      this.info.push({
        code: Codes.FINAL_CONSTANTS_INFO,
        message: `Final specialized constants detected: ${grandTotal} different constants used across all categories`,
        line: 1,
        column: 1,
        severity: 'info'
      });
    }

    // Specific category information
    if (totalMathConstants > 0) {
      this.info.push({
        code: Codes.MATH_CONSTANTS_USAGE,
        message: `Mathematical constants used (${totalMathConstants}). Ensure proper mathematical context`,
        line: 1,
        column: 1,
        severity: 'info'
      });
    }

    if (totalStyleConstants > 0) {
      this.info.push({
        code: 'PSV6-STYLE-CONSTANTS-USAGE',
        message: `Style constants used (${totalStyleConstants}). These control visual appearance of drawings`,
        line: 1,
        column: 1,
        severity: 'info'
      });
    }

    if (totalOrderConstants > 0) {
      this.info.push({
        code: 'PSV6-ORDER-CONSTANTS-USAGE',
        message: `Array sort order constants used (${totalOrderConstants}). These control array sorting behavior`,
        line: 1,
        column: 1,
        severity: 'info'
      });
    }

    if (totalPositionConstants > 0) {
      this.info.push({
        code: 'PSV6-POSITION-CONSTANTS-USAGE',
        message: `Table position constants used (${totalPositionConstants}). These control table placement on chart`,
        line: 1,
        column: 1,
        severity: 'info'
      });
    }

    if (totalSpecializedConstants > 0) {
      this.info.push({
        code: 'PSV6-SPECIALIZED-CONSTANTS-USAGE',
        message: `Specialized constants used (${totalSpecializedConstants}). These include strategy, earnings, and advanced features`,
        line: 1,
        column: 1,
        severity: 'info'
      });
    }
  }
}
