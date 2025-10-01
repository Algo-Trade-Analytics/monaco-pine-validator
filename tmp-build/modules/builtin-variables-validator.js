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
import { DISPLAY_CONSTANTS_EXTENDED as DISPLAY_CONSTANTS, TIMEFRAME_CONSTANTS, CURRENCY_CONSTANTS } from '../core/constants-registry';
import { Codes } from '../core/codes';
import { visit } from '../core/ast/traversal';
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
export class BuiltinVariablesValidator {
    constructor() {
        this.name = 'BuiltinVariablesValidator';
        this.priority = 70; // Lower priority - these are edge case constants
        this.errors = [];
        this.warnings = [];
        this.info = [];
        // Usage tracking
        this.timeframeConstantUsage = new Map();
        this.displayConstantUsage = new Map();
        this.extendConstantUsage = new Map();
        this.formatConstantUsage = new Map();
        this.currencyConstantUsage = new Map();
        this.scaleConstantUsage = new Map();
        this.adjustmentConstantUsage = new Map();
        this.backadjustmentConstantUsage = new Map();
    }
    getDependencies() {
        return ['CoreValidator'];
    }
    validate(context, config) {
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
        const astContext = this.getAstContext(config);
        const program = astContext?.ast;
        if (!program) {
            return {
                isValid: true,
                errors: [],
                warnings: [],
                info: [],
                typeMap: this.context.typeMap ?? new Map(),
                scriptType: this.context.scriptType ?? null,
            };
        }
        this.collectConstantsFromAst(program);
        // Provide usage information
        this.analyzeConstantUsage();
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap: this.context.typeMap ?? new Map(),
            scriptType: this.context.scriptType ?? null,
        };
    }
    getAstContext(config) {
        if (!config.ast || config.ast.mode === 'disabled') {
            return null;
        }
        return 'ast' in this.context ? this.context : null;
    }
    collectConstantsFromAst(program) {
        visit(program, {
            MemberExpression: {
                enter: ({ node }) => {
                    const constant = this.getMemberQualifiedName(node);
                    if (!constant) {
                        return;
                    }
                    const position = node.loc.start ?? node.property.loc?.start;
                    const line = position?.line ?? 1;
                    const column = position?.column ?? 1;
                    this.recordConstantUsage(constant, line, column);
                },
            },
        });
    }
    getMemberQualifiedName(member) {
        if (member.computed) {
            return null;
        }
        const objectName = this.getExpressionQualifiedName(member.object);
        if (!objectName) {
            return null;
        }
        return `${objectName}.${member.property.name}`;
    }
    getExpressionQualifiedName(expression) {
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
    incrementUsage(map, constant) {
        map.set(constant, (map.get(constant) || 0) + 1);
    }
    addConstantInfo(code, message, line, column) {
        this.info.push({
            code,
            message,
            line,
            column,
            severity: 'info'
        });
    }
    recordConstantUsage(constant, line, column) {
        if (TIMEFRAME_CONSTANTS.has(constant)) {
            this.incrementUsage(this.timeframeConstantUsage, constant);
            this.addConstantInfo(Codes.TIMEFRAME_CONSTANT, `Timeframe constant '${constant}' detected`, line, column);
            return;
        }
        if (DISPLAY_CONSTANTS.has(constant)) {
            this.incrementUsage(this.displayConstantUsage, constant);
            this.addConstantInfo(Codes.DISPLAY_CONSTANT, `Display constant '${constant}' detected`, line, column);
            return;
        }
        if (EXTEND_CONSTANTS.has(constant)) {
            this.incrementUsage(this.extendConstantUsage, constant);
            this.addConstantInfo(Codes.EXTEND_CONSTANT, `Extend constant '${constant}' detected`, line, column);
            return;
        }
        if (FORMAT_CONSTANTS.has(constant)) {
            this.incrementUsage(this.formatConstantUsage, constant);
            this.addConstantInfo(Codes.FORMAT_CONSTANT, `Format constant '${constant}' detected`, line, column);
            return;
        }
        if (CURRENCY_CONSTANTS.has(constant)) {
            this.incrementUsage(this.currencyConstantUsage, constant);
            this.addConstantInfo(Codes.CURRENCY_CONSTANT, `Currency constant '${constant}' detected`, line, column);
            return;
        }
        if (SCALE_CONSTANTS.has(constant)) {
            this.incrementUsage(this.scaleConstantUsage, constant);
            this.addConstantInfo(Codes.SCALE_CONSTANT, `Scale constant '${constant}' detected`, line, column);
            return;
        }
        if (ADJUSTMENT_CONSTANTS.has(constant)) {
            this.incrementUsage(this.adjustmentConstantUsage, constant);
            this.addConstantInfo(Codes.ADJUSTMENT_CONSTANT, `Adjustment constant '${constant}' detected`, line, column);
            return;
        }
        if (BACKADJUSTMENT_CONSTANTS.has(constant)) {
            this.incrementUsage(this.backadjustmentConstantUsage, constant);
            this.addConstantInfo(Codes.BACKADJUSTMENT_CONSTANT, `Backadjustment constant '${constant}' detected`, line, column);
        }
    }
    analyzeConstantUsage() {
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
