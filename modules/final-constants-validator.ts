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
  DISPLAY_CONSTANTS_EXTENDED,
  STRATEGY_RISK_EXTRA_CONSTANTS,
  STRATEGY_COMMISSION_EXTRA_CONSTANTS,
  PLOT_STYLE_CONSTANTS,
  LINE_STYLE_CONSTANTS,
  LABEL_STYLE_CONSTANTS,
  HLINE_STYLE_CONSTANTS,
  ORDER_CONSTANTS,
  POSITION_CONSTANTS,
  XLOC_YLOC_CONSTANTS,
  EXTEND_CONSTANTS,
  LOCATION_CONSTANTS,
  SHAPE_CONSTANTS,
  SIZE_CONSTANTS
} from '../core/constants-registry';
import { TEXT_ALIGNMENT_CONSTANTS, TEXT_SIZE_CONSTANTS } from '../core/constants';
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
  private infoKeys = new Set<string>();

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
    this.infoKeys.clear();
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

          if (!this.shouldInspectConstant(constant)) {
            return;
          }

          const position = node.property.loc?.start ?? node.loc.start;
          const line = position.line ?? 1;
          const column = position.column ?? 1;
          const recognized = this.recordConstantUsage(constant, line, column);
          if (!recognized) {
            this.flagInvalidConstant(constant, line, column);
          }
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

  private shouldInspectConstant(constant: string): boolean {
    if (MATH_CONSTANTS.has(constant)) {
      return true;
    }

    if (ALL_SPECIALIZED_CONSTANTS.has(constant)) {
      return true;
    }

    const prefixes = [
      'position.',
      'xloc.',
      'yloc.',
      'text.align',
      'size.',
      'extend.',
      'line.style',
      'label.style',
      'plot.style',
      'hline.style',
      'location.',
      'shape.',
      'order.',
      'display.',
    ];

    return prefixes.some((prefix) => constant.startsWith(prefix));
  }

  private incrementUsage(map: Map<string, number>, constant: string): void {
    map.set(constant, (map.get(constant) || 0) + 1);
  }

  private addConstantInfo(code: string, message: string, line: number, column: number, key?: string): void {
    const dedupeKey = key ?? code;
    if (this.infoKeys.has(dedupeKey)) {
      return;
    }
    this.infoKeys.add(dedupeKey);
    this.info.push({
      code,
      message,
      line,
      column,
      severity: 'info'
    });
  }

  private addError(line: number, column: number, message: string, code: string, suggestion?: string): void {
    this.errors.push({
      line,
      column,
      message,
      severity: 'error',
      code,
      suggestion,
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
        if (process.env.DEBUG_FINAL_CONSTANTS === '1') {
          console.log('[FinalConstantsValidator] recognized style constant', constant);
        }
        this.incrementUsage(this.styleConstantUsage, constant);
        this.addConstantInfo(Codes.STYLE_CONSTANT, `Style constant '${constant}' detected`, line, column, `style:${constant}`);
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

    if (XLOC_YLOC_CONSTANTS.has(constant)) {
      this.addConstantInfo(Codes.CONST_XYLOC_INVALID, `Location constant '${constant}' detected`, line, column);
      return true;
    }

    if (TEXT_ALIGNMENT_CONSTANTS.has(constant)) {
      this.addConstantInfo(Codes.CONST_TEXT_ALIGN_INVALID, `Text alignment constant '${constant}' detected`, line, column);
      return true;
    }

    if (TEXT_SIZE_CONSTANTS.has(constant) || SIZE_CONSTANTS.has(constant)) {
      this.addConstantInfo(Codes.CONST_SIZE_INVALID, `Size constant '${constant}' detected`, line, column);
      return true;
    }

    if (EXTEND_CONSTANTS.has(constant)) {
      // The built-in variables validator already surfaces extend constant usage.
      // We still mark the constant as recognised so invalid variants continue to
      // flow through to the error handling below, but avoid emitting a second
      // info message that would duplicate the existing PSV6-EXTEND-CONSTANT
      // diagnostic.
      return true;
    }

    if (LOCATION_CONSTANTS.has(constant)) {
      this.addConstantInfo(Codes.CONST_LOCATION_INVALID, `Shape location constant '${constant}' detected`, line, column);
      return true;
    }

    if (SHAPE_CONSTANTS.has(constant)) {
      this.addConstantInfo(Codes.CONST_SHAPE_INVALID, `Shape constant '${constant}' detected`, line, column);
      return true;
    }

    if (DISPLAY_CONSTANTS_EXTENDED.has(constant)) {
      // Display constants are also covered by the built-in variables validator.
      // Recognise the constant to keep invalid-path guarding, but do not emit a
      // duplicate PSV6-DISPLAY-CONSTANT info diagnostic from this module.
      return true;
    }

    if (ALL_SPECIALIZED_CONSTANTS.has(constant)) {
      this.incrementUsage(this.specializedConstantUsage, constant);
      this.addConstantInfo(Codes.SPECIALIZED_CONSTANT, `Specialized constant '${constant}' detected`, line, column, `special:${constant}:${line}:${column}`);
      return true;
    }

    return false;
  }

  private flagInvalidConstant(constant: string, line: number, column: number): void {
    if (process.env.DEBUG_FINAL_CONSTANTS === '1') {
      console.log('[FinalConstantsValidator] invalid constant detected', constant, { line, column });
    }
    const prefix = constant.split('.')[0];
    const validList = (set: Set<string>): string => Array.from(set).sort().join(', ');

    if (constant.startsWith('position.')) {
      this.addError(
        line,
        column,
        `Unknown table position constant '${constant}'.`,
        Codes.CONST_POSITION_INVALID,
        `Use one of: ${validList(POSITION_CONSTANTS)}`,
      );
      return;
    }

    if (constant.startsWith('xloc.') || constant.startsWith('yloc.')) {
      this.addError(
        line,
        column,
        `Unknown location constant '${constant}'.`,
        Codes.CONST_XYLOC_INVALID,
        `Use one of: ${validList(XLOC_YLOC_CONSTANTS)}`,
      );
      return;
    }

    if (constant.startsWith('text.align')) {
      this.addError(
        line,
        column,
        `Unknown text alignment constant '${constant}'.`,
        Codes.CONST_TEXT_ALIGN_INVALID,
        `Use one of: ${validList(TEXT_ALIGNMENT_CONSTANTS)}`,
      );
      return;
    }

    if (constant.startsWith('size.')) {
      this.addError(
        line,
        column,
        `Unknown size constant '${constant}'.`,
        Codes.CONST_SIZE_INVALID,
        `Use one of: ${validList(SIZE_CONSTANTS)}`,
      );
      return;
    }

    if (constant.startsWith('extend.')) {
      this.addError(
        line,
        column,
        `Unknown extend constant '${constant}'.`,
        Codes.CONST_EXTEND_INVALID,
        `Use one of: ${validList(EXTEND_CONSTANTS)}`,
      );
      return;
    }

    if (constant.startsWith('line.style')) {
      this.addError(
        line,
        column,
        `Unknown line style constant '${constant}'.`,
        Codes.CONST_LINE_STYLE_INVALID,
        `Use one of: ${validList(LINE_STYLE_CONSTANTS)}`,
      );
      return;
    }

    if (constant.startsWith('label.style')) {
      this.addError(
        line,
        column,
        `Unknown label style constant '${constant}'.`,
        Codes.CONST_LABEL_STYLE_INVALID,
        `Use one of: ${validList(LABEL_STYLE_CONSTANTS)}`,
      );
      return;
    }

    if (constant.startsWith('plot.style')) {
      this.addError(
        line,
        column,
        `Unknown plot style constant '${constant}'.`,
        Codes.CONST_PLOT_STYLE_INVALID,
        `Use one of: ${validList(PLOT_STYLE_CONSTANTS)}`,
      );
      return;
    }

    if (constant.startsWith('location.')) {
      this.addError(
        line,
        column,
        `Unknown shape location constant '${constant}'.`,
        Codes.CONST_LOCATION_INVALID,
        `Use one of: ${validList(LOCATION_CONSTANTS)}`,
      );
      return;
    }

    if (constant.startsWith('shape.')) {
      this.addError(
        line,
        column,
        `Unknown shape constant '${constant}'.`,
        Codes.CONST_SHAPE_INVALID,
        `Use one of: ${validList(SHAPE_CONSTANTS)}`,
      );
      return;
    }

    if (constant.startsWith('order.')) {
      this.addError(
        line,
        column,
        `Unknown order constant '${constant}'.`,
        Codes.CONST_ORDER_INVALID,
        `Use one of: ${validList(ORDER_CONSTANTS)}`,
      );
      return;
    }

    if (constant.startsWith('display.')) {
      this.addError(
        line,
        column,
        `Unknown display constant '${constant}'.`,
        Codes.CONST_DISPLAY_INVALID,
        `Use one of: ${validList(DISPLAY_CONSTANTS_EXTENDED)}`,
      );
      return;
    }

    if (prefix === 'text') {
      this.addError(
        line,
        column,
        `Unknown text constant '${constant}'.`,
        Codes.CONST_TEXT_ALIGN_INVALID,
        'Check the Pine Script reference for supported text constants.',
      );
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
