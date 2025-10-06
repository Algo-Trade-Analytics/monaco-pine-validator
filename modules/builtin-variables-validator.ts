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

import {
  type AstValidationContext,
  type ValidationContext,
  type ValidationError,
  type ValidationModule,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';
import { ValidationHelper } from '../core/validation-helper';
import {
  DISPLAY_CONSTANTS_EXTENDED as DISPLAY_CONSTANTS,
  TIMEFRAME_CONSTANTS,
  CURRENCY_CONSTANTS,
  EXTEND_CONSTANTS,
  FORMAT_CONSTANTS,
  SCALE_CONSTANTS,
  ADJUSTMENT_CONSTANTS,
  BACKADJUSTMENT_CONSTANTS
} from '../core/constants-registry';
import { Codes } from '../core/codes';
import { visitQualifiedMembers, updateUsage } from '../core/ast/member-utils';
import type { ProgramNode } from '../core/ast/nodes';

// TIMEFRAME_CONSTANTS and CURRENCY_CONSTANTS now imported from shared registry
// DISPLAY_CONSTANTS now imported from shared registry

export class BuiltinVariablesValidator implements ValidationModule {
  name = 'BuiltinVariablesValidator';
  priority = 70; // Lower priority - these are edge case constants

  private helper = new ValidationHelper();
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
    this.helper.reset();
    this.timeframeConstantUsage.clear();
    this.displayConstantUsage.clear();
    this.extendConstantUsage.clear();
    this.formatConstantUsage.clear();
    this.currencyConstantUsage.clear();
    this.scaleConstantUsage.clear();
    this.adjustmentConstantUsage.clear();
    this.backadjustmentConstantUsage.clear();

    const astContext = this.getAstContext(config);
    const program = astContext?.ast;

    if (!program) {
      return this.helper.buildResult(context);
    }

    this.collectConstantsFromAst(program);

    // Provide usage information
    this.analyzeConstantUsage();

    return this.helper.buildResult(context);
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    return 'ast' in this.context ? (this.context as AstValidationContext) : null;
  }

  private collectConstantsFromAst(program: ProgramNode): void {
    visitQualifiedMembers(program, ({ name, line, column }) => {
      this.recordConstantUsage(name, line, column);
    });
  }

  private addConstantInfo(code: string, message: string, line: number, column: number): void {
    this.helper.addInfo(line, column, message, code);
  }

  private recordConstantUsage(constant: string, line: number, column: number): void {
    if (TIMEFRAME_CONSTANTS.has(constant)) {
      updateUsage(this.timeframeConstantUsage, constant);
      this.addConstantInfo(Codes.TIMEFRAME_CONSTANT, `Timeframe constant '${constant}' detected`, line, column);
      return;
    }

    if (DISPLAY_CONSTANTS.has(constant)) {
      updateUsage(this.displayConstantUsage, constant);
      this.addConstantInfo(Codes.DISPLAY_CONSTANT, `Display constant '${constant}' detected`, line, column);
      return;
    }

    if (EXTEND_CONSTANTS.has(constant)) {
      updateUsage(this.extendConstantUsage, constant);
      this.addConstantInfo(Codes.EXTEND_CONSTANT, `Extend constant '${constant}' detected`, line, column);
      return;
    }

    if (FORMAT_CONSTANTS.has(constant)) {
      updateUsage(this.formatConstantUsage, constant);
      this.addConstantInfo(Codes.FORMAT_CONSTANT, `Format constant '${constant}' detected`, line, column);
      return;
    }

    if (CURRENCY_CONSTANTS.has(constant)) {
      updateUsage(this.currencyConstantUsage, constant);
      this.addConstantInfo(Codes.CURRENCY_CONSTANT, `Currency constant '${constant}' detected`, line, column);
      return;
    }

    if (SCALE_CONSTANTS.has(constant)) {
      updateUsage(this.scaleConstantUsage, constant);
      this.addConstantInfo(Codes.SCALE_CONSTANT, `Scale constant '${constant}' detected`, line, column);
      return;
    }

    if (ADJUSTMENT_CONSTANTS.has(constant)) {
      updateUsage(this.adjustmentConstantUsage, constant);
      this.addConstantInfo(Codes.ADJUSTMENT_CONSTANT, `Adjustment constant '${constant}' detected`, line, column);
      return;
    }

    if (BACKADJUSTMENT_CONSTANTS.has(constant)) {
      updateUsage(this.backadjustmentConstantUsage, constant);
      this.addConstantInfo(Codes.BACKADJUSTMENT_CONSTANT, `Backadjustment constant '${constant}' detected`, line, column);
    }
  }

  private analyzeConstantUsage(): void {
    const totalConstants = this.timeframeConstantUsage.size + this.displayConstantUsage.size + 
                          this.extendConstantUsage.size + this.formatConstantUsage.size + 
                          this.currencyConstantUsage.size + this.scaleConstantUsage.size +
                          this.adjustmentConstantUsage.size + this.backadjustmentConstantUsage.size;

    if (totalConstants > 0) {
      this.helper.addInfo(1, 1, `Specialized built-in variables detected: ${totalConstants} different constants used`, Codes.BUILTIN_VARS_INFO);
    }

    // Provide recommendations for common usage patterns
    if (this.currencyConstantUsage.size > 0) {
      this.helper.addInfo(1, 1, 'Currency constants used. Ensure strategy declaration includes appropriate currency parameter', Codes.CURRENCY_USAGE);
    }

    if (this.displayConstantUsage.size > 0) {
      this.helper.addInfo(1, 1, 'Display constants used. These control where plot information appears in the interface', Codes.DISPLAY_USAGE);
    }

    if (this.scaleConstantUsage.size > 0) {
      this.helper.addInfo(1, 1, 'Scale constants used. These control price scale positioning for indicators', Codes.SCALE_USAGE);
    }

    if (this.adjustmentConstantUsage.size > 0 || this.backadjustmentConstantUsage.size > 0) {
      this.helper.addInfo(1, 1, 'Adjustment constants used. These control dividend/split adjustments in data requests', Codes.ADJUSTMENT_USAGE);
    }
  }
}
