/**
 * Built-in Variables Validator for Pine Script v6
 * 
 * Validates specialized built-in variable constants:
 * - timeframe.* constants (isdaily, isweekly, ismonthly, etc.)
 * - display.* constants (all, data_window, none, pane, etc.)
 * - extend.* constants (both, none, left, right)
 * - format.* constants (inherit, price, volume)
 * - currency.* constants (USD, EUR, GBP, JPY, etc.)
 * - scale.* constants (if any exist)
 * 
 * Phase 3.5: Final 1% - Specialized Built-in Variables
 */

import { ValidationModule, ValidationContext, ValidatorConfig, ValidationError, ValidationResult } from '../core/types';
import { 
  DISPLAY_CONSTANTS_EXTENDED as DISPLAY_CONSTANTS,
  TIMEFRAME_CONSTANTS,
  CURRENCY_CONSTANTS
} from '../core/constants-registry';
import { findConstantsInLine } from '../core/scanner';
import { Codes } from '../core/codes';

// TIMEFRAME_CONSTANTS and CURRENCY_CONSTANTS now imported from shared registry
// DISPLAY_CONSTANTS now imported from shared registry

const EXTEND_CONSTANTS = new Set([
  'extend.both', 'extend.none', 'extend.left', 'extend.right'
]);

const FORMAT_CONSTANTS = new Set([
  'format.inherit', 'format.price', 'format.volume'
]);

const SCALE_CONSTANTS = new Set([
  'scale.left', 'scale.right', 'scale.none'
]);

const ADJUSTMENT_CONSTANTS = new Set([
  'adjustment.dividends', 'adjustment.splits', 'adjustment.none'
]);

const BACKADJUSTMENT_CONSTANTS = new Set([
  'backadjustment.inherit', 'backadjustment.on', 'backadjustment.off'
]);

export class BuiltinVariablesValidator implements ValidationModule {
  name = 'BuiltinVariablesValidator';
  priority = 70; // Lower priority - these are edge case constants

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  // Usage tracking
  private timeframeConstantUsage: Map<string, number> = new Map();
  private displayConstantUsage: Map<string, number> = new Map();
  private extendConstantUsage: Map<string, number> = new Map();
  private formatConstantUsage: Map<string, number> = new Map();
  private currencyConstantUsage: Map<string, number> = new Map();
  private scaleConstantUsage: Map<string, number> = new Map();
  private adjustmentConstantUsage: Map<string, number> = new Map();
  private backadjustmentConstantUsage: Map<string, number> = new Map();

  getDependencies(): string[] {
    return ['CoreValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.context = context;
    this.config = config;
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.timeframeConstantUsage.clear();
    this.displayConstantUsage.clear();
    this.extendConstantUsage.clear();
    this.formatConstantUsage.clear();
    this.currencyConstantUsage.clear();
    this.scaleConstantUsage.clear();
    this.adjustmentConstantUsage.clear();
    this.backadjustmentConstantUsage.clear();

    // Validate built-in variable constants
    this.validateTimeframeConstants();
    this.validateDisplayConstants();
    this.validateExtendConstants();
    this.validateFormatConstants();
    this.validateCurrencyConstants();
    this.validateScaleConstants();
    this.validateAdjustmentConstants();
    this.validateBackadjustmentConstants();

    // Provide usage information
    this.analyzeConstantUsage();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: this.context.scriptType
    };
  }

  private validateTimeframeConstants(): void {
    for (let i = 0; i < this.context.lines.length; i++) {
      const cleanLine = this.context.cleanLines[i];
      const hits = findConstantsInLine(cleanLine, TIMEFRAME_CONSTANTS);
      
      for (const hit of hits) {
        this.timeframeConstantUsage.set(hit.constant, (this.timeframeConstantUsage.get(hit.constant) || 0) + 1);
        
        this.info.push({
          code: Codes.TIMEFRAME_CONSTANT,
          message: `Timeframe constant '${hit.constant}' detected`,
          line: i + 1,
          column: hit.index + 1,
          severity: 'info'
        });
      }
    }
  }

  private validateDisplayConstants(): void {
    for (let i = 0; i < this.context.lines.length; i++) {
      const cleanLine = this.context.cleanLines[i];
      const hits = findConstantsInLine(cleanLine, DISPLAY_CONSTANTS);
      for (const h of hits) {
        this.displayConstantUsage.set(h.constant, (this.displayConstantUsage.get(h.constant) || 0) + 1);
        this.info.push({
          code: Codes.DISPLAY_CONSTANT,
          message: `Display constant '${h.constant}' detected`,
          line: i + 1,
          column: h.index + 1,
          severity: 'info'
        });
      }
    }
  }

  private validateExtendConstants(): void {
    for (let i = 0; i < this.context.lines.length; i++) {
      const cleanLine = this.context.cleanLines[i];
      const hits = findConstantsInLine(cleanLine, EXTEND_CONSTANTS);
      
      for (const hit of hits) {
        this.extendConstantUsage.set(hit.constant, (this.extendConstantUsage.get(hit.constant) || 0) + 1);
        
        this.info.push({
          code: Codes.EXTEND_CONSTANT,
          message: `Extend constant '${hit.constant}' detected`,
          line: i + 1,
          column: hit.index + 1,
          severity: 'info'
        });
      }
    }
  }

  private validateFormatConstants(): void {
    for (let i = 0; i < this.context.lines.length; i++) {
      const cleanLine = this.context.cleanLines[i];
      const hits = findConstantsInLine(cleanLine, FORMAT_CONSTANTS);
      
      for (const hit of hits) {
        this.formatConstantUsage.set(hit.constant, (this.formatConstantUsage.get(hit.constant) || 0) + 1);
        
        this.info.push({
          code: Codes.FORMAT_CONSTANT,
          message: `Format constant '${hit.constant}' detected`,
          line: i + 1,
          column: hit.index + 1,
          severity: 'info'
        });
      }
    }
  }

  private validateCurrencyConstants(): void {
    for (let i = 0; i < this.context.lines.length; i++) {
      const cleanLine = this.context.cleanLines[i];
      const hits = findConstantsInLine(cleanLine, CURRENCY_CONSTANTS);
      
      for (const hit of hits) {
        this.currencyConstantUsage.set(hit.constant, (this.currencyConstantUsage.get(hit.constant) || 0) + 1);
        
        this.info.push({
          code: Codes.CURRENCY_CONSTANT,
          message: `Currency constant '${hit.constant}' detected`,
          line: i + 1,
          column: hit.index + 1,
          severity: 'info'
        });
      }
    }
  }

  private validateScaleConstants(): void {
    for (let i = 0; i < this.context.lines.length; i++) {
      const line = this.context.lines[i];
      const cleanLine = this.context.cleanLines[i];

      for (const constant of Array.from(SCALE_CONSTANTS)) {
        if (cleanLine.includes(constant)) {
          this.scaleConstantUsage.set(constant, (this.scaleConstantUsage.get(constant) || 0) + 1);
          
          this.info.push({
            code: Codes.SCALE_CONSTANT,
            message: `Scale constant '${constant}' detected`,
            line: i + 1,
            column: cleanLine.indexOf(constant) + 1,
            severity: 'info'
          });
        }
      }
    }
  }

  private validateAdjustmentConstants(): void {
    for (let i = 0; i < this.context.lines.length; i++) {
      const line = this.context.lines[i];
      const cleanLine = this.context.cleanLines[i];

      for (const constant of Array.from(ADJUSTMENT_CONSTANTS)) {
        if (cleanLine.includes(constant)) {
          this.adjustmentConstantUsage.set(constant, (this.adjustmentConstantUsage.get(constant) || 0) + 1);
          
          this.info.push({
            code: Codes.ADJUSTMENT_CONSTANT,
            message: `Adjustment constant '${constant}' detected`,
            line: i + 1,
            column: cleanLine.indexOf(constant) + 1,
            severity: 'info'
          });
        }
      }
    }
  }

  private validateBackadjustmentConstants(): void {
    for (let i = 0; i < this.context.lines.length; i++) {
      const line = this.context.lines[i];
      const cleanLine = this.context.cleanLines[i];

      for (const constant of Array.from(BACKADJUSTMENT_CONSTANTS)) {
        if (cleanLine.includes(constant)) {
          this.backadjustmentConstantUsage.set(constant, (this.backadjustmentConstantUsage.get(constant) || 0) + 1);
          
          this.info.push({
            code: Codes.BACKADJUSTMENT_CONSTANT,
            message: `Backadjustment constant '${constant}' detected`,
            line: i + 1,
            column: cleanLine.indexOf(constant) + 1,
            severity: 'info'
          });
        }
      }
    }
  }

  private analyzeConstantUsage(): void {
    const totalConstants = this.timeframeConstantUsage.size + this.displayConstantUsage.size + 
                          this.extendConstantUsage.size + this.formatConstantUsage.size + 
                          this.currencyConstantUsage.size + this.scaleConstantUsage.size +
                          this.adjustmentConstantUsage.size + this.backadjustmentConstantUsage.size;

    if (totalConstants > 0) {
      this.info.push({
        code: Codes.BUILTIN_VARS_INFO,
        message: `Specialized built-in variables detected: ${totalConstants} different constants used`,
        line: 1,
        column: 1,
        severity: 'info'
      });
    }

    // Provide recommendations for common usage patterns
    if (this.currencyConstantUsage.size > 0) {
      this.info.push({
        code: Codes.CURRENCY_USAGE,
        message: 'Currency constants used. Ensure strategy declaration includes appropriate currency parameter',
        line: 1,
        column: 1,
        severity: 'info'
      });
    }

    if (this.displayConstantUsage.size > 0) {
      this.info.push({
        code: Codes.DISPLAY_USAGE,
        message: 'Display constants used. These control where plot information appears in the interface',
        line: 1,
        column: 1,
        severity: 'info'
      });
    }

    if (this.scaleConstantUsage.size > 0) {
      this.info.push({
        code: Codes.SCALE_USAGE,
        message: 'Scale constants used. These control price scale positioning for indicators',
        line: 1,
        column: 1,
        severity: 'info'
      });
    }

    if (this.adjustmentConstantUsage.size > 0 || this.backadjustmentConstantUsage.size > 0) {
      this.info.push({
        code: Codes.ADJUSTMENT_USAGE,
        message: 'Adjustment constants used. These control dividend/split adjustments in data requests',
        line: 1,
        column: 1,
        severity: 'info'
      });
    }
  }
}
