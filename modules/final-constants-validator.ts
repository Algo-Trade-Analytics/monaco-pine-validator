/**
 * Final Constants Validator for Pine Script v6
 * 
 * Validates the remaining specialized constants that are easy to miss during manual
 * spot checks:
 * - Math constants (math.e, math.pi, math.phi, math.rphi)
 * - Plot style constants (plot.style_* for all plot types)
 * - Line style constants (line.style_* for all line styles)
 * - Label style constants (label.style_* for all label styles)
 * - HLine style constants (hline.style_* for horizontal lines)
 * - Order constants (order.ascending, order.descending)
 * - Position constants (position.* for all table positions)
 * - Additional specialized constants
 *
 * This module was introduced during the final audit pass for the legacy validator to
 * ensure these constants were exercised.  The surrounding documentation used to claim
 * it unlocked "true 100% coverage", but the broader suite now depends on AST data and
 * currently fails when the validator runs without it.
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
import { visit } from '../core/ast/traversal';
import type { ExpressionNode, MemberExpressionNode, ProgramNode } from '../core/ast/nodes';

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

const STYLE_CONSTANT_SETS = [
  PLOT_STYLE_CONSTANTS,
  LINE_STYLE_CONSTANTS,
  LABEL_STYLE_CONSTANTS,
  HLINE_STYLE_CONSTANTS,
] as const;

const SPECIALIZED_CONSTANT_SETS = [
  ADDITIONAL_SPECIALIZED_CONSTANTS,
  DRAW_TABLE_EXTRA_CONSTANTS,
  STRATEGY_RISK_EXTRA_CONSTANTS,
] as const;

const ALL_SPECIALIZED_CONSTANTS = new Set<string>(
  SPECIALIZED_CONSTANT_SETS.flatMap((set) => Array.from(set)),
);

export class FinalConstantsValidator implements ValidationModule {
  name = 'FinalConstantsValidator';
  priority = 65; // Lower priority - these are the final edge cases

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;

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
    this.reset();

    const astContext = this.getAstContext(config);
    if (!astContext?.ast) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: context.scriptType,
      };
    }

    this.collectConstantsFromAst(astContext.ast);

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

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.mathConstantUsage.clear();
    this.styleConstantUsage.clear();
    this.orderConstantUsage.clear();
    this.positionConstantUsage.clear();
    this.specializedConstantUsage.clear();
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    return 'ast' in this.context ? (this.context as AstValidationContext) : null;
  }

  private collectConstantsFromAst(program: ProgramNode): void {
    visit(program, {
      MemberExpression: {
        enter: ({ node }) => {
          const constant = this.getMemberQualifiedName(node as MemberExpressionNode);
          if (!constant) {
            return;
          }

          const position = node.property.loc?.start ?? node.loc.start;
          const line = position.line ?? 1;
          const column = position.column ?? 1;
          this.recordConstantUsage(constant, line, column);
        },
      },
    });
  }

  private getMemberQualifiedName(member: MemberExpressionNode): string | null {
    if (member.computed) {
      return null;
    }

    const objectName = this.getExpressionQualifiedName(member.object);
    if (!objectName) {
      return null;
    }

    return `${objectName}.${member.property.name}`;
  }

  private getExpressionQualifiedName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return expression.name;
    }

    if (expression.kind === 'MemberExpression') {
      if (expression.computed) {
        return null;
      }

      const objectName = this.getExpressionQualifiedName(expression.object);
      if (!objectName) {
        return null;
      }

      return `${objectName}.${expression.property.name}`;
    }

    return null;
  }

  private incrementUsage(map: Map<string, number>, constant: string): void {
    map.set(constant, (map.get(constant) || 0) + 1);
  }

  private addConstantInfo(code: string, message: string, line: number, column: number): void {
    this.info.push({
      code,
      message,
      line,
      column,
      severity: 'info'
    });
  }

  private recordConstantUsage(constant: string, line: number, column: number): boolean {
    if (MATH_CONSTANTS.has(constant)) {
      this.incrementUsage(this.mathConstantUsage, constant);
      this.addConstantInfo('PSV6-MATH-CONSTANT', `Mathematical constant '${constant}' detected`, line, column);
      return true;
    }

    for (const constantSet of STYLE_CONSTANT_SETS) {
      if (constantSet.has(constant)) {
        this.incrementUsage(this.styleConstantUsage, constant);
        this.addConstantInfo(Codes.STYLE_CONSTANT, `Style constant '${constant}' detected`, line, column);
        return true;
      }
    }

    if (ORDER_CONSTANTS.has(constant)) {
      this.incrementUsage(this.orderConstantUsage, constant);
      this.addConstantInfo(Codes.ORDER_CONSTANT, `Array sort order constant '${constant}' detected`, line, column);
      return true;
    }

    if (POSITION_CONSTANTS.has(constant)) {
      this.incrementUsage(this.positionConstantUsage, constant);
      this.addConstantInfo(Codes.POSITION_CONSTANT, `Table position constant '${constant}' detected`, line, column);
      return true;
    }

    if (ALL_SPECIALIZED_CONSTANTS.has(constant)) {
      this.incrementUsage(this.specializedConstantUsage, constant);
      this.addConstantInfo(Codes.SPECIALIZED_CONSTANT, `Specialized constant '${constant}' detected`, line, column);
      return true;
    }

    return false;
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
