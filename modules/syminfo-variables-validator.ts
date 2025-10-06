/**
 * Syminfo Variables Validator for Pine Script v6
 * 
 * Validates syminfo.* built-in variables including:
 * - Company information (employees, shareholders, shares_outstanding_*)
 * - Analyst recommendations (recommendations_buy, recommendations_sell, etc.)
 * - Price targets (target_price_average, target_price_high, etc.)
 * - Additional symbol info (current_contract, expiration_date, etc.)
 * - Financial data variables
 * 
 * Final Gap Closure: Comprehensive syminfo.* namespace validation
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidatorConfig,
  type ValidationError,
  type ValidationResult,
} from '../core/types';
import { ValidationHelper } from '../core/validation-helper';
import { type ProgramNode } from '../core/ast/nodes';
import { visitQualifiedMembers, updateUsage } from '../core/ast/member-utils';
import {
  TEXT_FORMAT_CONSTANTS_EXTENDED as TEXT_FORMAT_CONSTANTS,
  SESSION_ADVANCED_CONSTANTS,
  SYMINFO_ADVANCED_VARS,
  DAYOFWEEK_CONSTANTS,
  BARMERGE_CONSTANTS,
  XLOC_YLOC_CONSTANTS,
  SETTLEMENT_AS_CLOSE_CONSTANTS,
  FONT_CONSTANTS,
  TEXT_WRAP_CONSTANTS
} from '../core/constants-registry';

const SYMINFO_COMPANY_VARS = new Set([
  'syminfo.employees', 'syminfo.shareholders', 'syminfo.shares_outstanding_float',
  'syminfo.shares_outstanding_total', 'syminfo.sector', 'syminfo.industry', 'syminfo.country'
]);

const SYMINFO_RECOMMENDATIONS_VARS = new Set([
  'syminfo.recommendations_buy', 'syminfo.recommendations_buy_strong',
  'syminfo.recommendations_sell', 'syminfo.recommendations_sell_strong',
  'syminfo.recommendations_hold', 'syminfo.recommendations_total',
  'syminfo.recommendations_date'
]);

const SYMINFO_TARGET_PRICE_VARS = new Set([
  'syminfo.target_price_average', 'syminfo.target_price_high', 'syminfo.target_price_low',
  'syminfo.target_price_median', 'syminfo.target_price_estimates', 'syminfo.target_price_date'
]);

const SYMINFO_ADDITIONAL_VARS = new Set<string>([
  'syminfo.current_contract', 'syminfo.expiration_date', 'syminfo.mincontract',
  'syminfo.volumetype', 'syminfo.root',
  ...Array.from(SYMINFO_ADVANCED_VARS)
]);


const ADDITIONAL_CONSTANT_SETS = [
  DAYOFWEEK_CONSTANTS,
  BARMERGE_CONSTANTS,
  SETTLEMENT_AS_CLOSE_CONSTANTS,
  XLOC_YLOC_CONSTANTS,
  FONT_CONSTANTS,
  TEXT_FORMAT_CONSTANTS,
  TEXT_WRAP_CONSTANTS,
  SESSION_ADVANCED_CONSTANTS,
];

export class SyminfoVariablesValidator implements ValidationModule {
  name = 'SyminfoVariablesValidator';
  priority = 68; // Lower priority - these are specialized variables

  private helper = new ValidationHelper();

  // Usage tracking
  private syminfoUsage: Map<string, number> = new Map();
  private constantUsage: Map<string, number> = new Map();

  getDependencies(): string[] {
    return ['CoreValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();

    const astContext = this.getAstContext(context, config);
    if (!astContext?.ast) {
      return this.helper.buildResult(context);
    }

    this.collectSyminfoDataAst(astContext.ast);
    this.analyzeUsagePatterns();

    return this.helper.buildResult(context);
  }

  private reset(): void {
    this.helper.reset();
    this.syminfoUsage.clear();
    this.constantUsage.clear();
  }

  private analyzeUsagePatterns(): void {
    const totalSyminfoVars = this.syminfoUsage.size;
    const totalConstants = this.constantUsage.size;

    if (totalSyminfoVars > 0) {
      this.helper.addInfo(
        1,
        1,
        `Advanced syminfo variables detected: ${totalSyminfoVars} different variables used`,
        'PSV6-SYMINFO-USAGE'
      );
    }

    if (totalConstants > 0) {
      this.helper.addInfo(
        1,
        1,
        `Additional constants detected: ${totalConstants} different constants used`,
        'PSV6-CONSTANTS-USAGE'
      );
    }

    // Provide recommendations for financial data usage
    const hasFinancialVars = Array.from(this.syminfoUsage.keys()).some(key => 
      key.includes('recommendations') || key.includes('target_price') || key.includes('employees')
    );

    if (hasFinancialVars) {
      this.helper.addInfo(
        1,
        1,
        'Financial analysis variables used. Ensure symbol supports fundamental data',
        'PSV6-FINANCIAL-DATA-USAGE'
      );
    }
  }

  private collectSyminfoDataAst(program: ProgramNode): void {
    visitQualifiedMembers(program, ({ name, line, column }) => {
      if (this.recordSyminfoQualifiedName(name, line, column)) {
        return;
      }

      this.recordConstantQualifiedName(name, line, column);
    });
  }

  private recordSyminfoQualifiedName(name: string, line: number, column: number): boolean {
    if (SYMINFO_COMPANY_VARS.has(name)) {
      this.recordSyminfoUsage(
        name,
        line,
        column,
        'PSV6-SYMINFO-COMPANY',
        `Company information variable '${name}' detected`,
      );
      return true;
    }

    if (SYMINFO_RECOMMENDATIONS_VARS.has(name)) {
      this.recordSyminfoUsage(
        name,
        line,
        column,
        'PSV6-SYMINFO-RECOMMENDATIONS',
        `Analyst recommendations variable '${name}' detected`,
      );
      return true;
    }

    if (SYMINFO_TARGET_PRICE_VARS.has(name)) {
      this.recordSyminfoUsage(
        name,
        line,
        column,
        'PSV6-SYMINFO-TARGET-PRICE',
        `Price target variable '${name}' detected`,
      );
      return true;
    }

    if (SYMINFO_ADDITIONAL_VARS.has(name)) {
      this.recordSyminfoUsage(
        name,
        line,
        column,
        'PSV6-SYMINFO-ADDITIONAL',
        `Additional symbol info variable '${name}' detected`,
      );
      return true;
    }

    return false;
  }

  private recordSyminfoUsage(name: string, line: number, column: number, code: string, message: string): void {
    updateUsage(this.syminfoUsage, name);
    this.helper.addInfo(line, column, message, code);
  }

  private recordConstantQualifiedName(name: string, line: number, column: number): void {
    if (!ADDITIONAL_CONSTANT_SETS.some((set) => set.has(name))) {
      return;
    }

    updateUsage(this.constantUsage, name);
    this.helper.addInfo(
      line,
      column,
      `Additional constant '${name}' detected`,
      'PSV6-ADDITIONAL-CONSTANT'
    );
  }

  private getAstContext(context: ValidationContext, config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }

    return 'ast' in context ? (context as AstValidationContext) : null;
  }
}
