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
import { visit } from '../core/ast/traversal';
import { TEXT_FORMAT_CONSTANTS_EXTENDED as TEXT_FORMAT_CONSTANTS, SESSION_ADVANCED_CONSTANTS, SYMINFO_ADVANCED_VARS, DAYOFWEEK_CONSTANTS, BARMERGE_CONSTANTS, XLOC_YLOC_CONSTANTS } from '../core/constants-registry';
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
const SYMINFO_ADDITIONAL_VARS = new Set([
    'syminfo.current_contract', 'syminfo.expiration_date', 'syminfo.mincontract',
    'syminfo.volumetype', 'syminfo.root',
    ...Array.from(SYMINFO_ADVANCED_VARS)
]);
const SETTLEMENT_CONSTANTS = new Set([
    'settlement_as_close.inherit', 'settlement_as_close.on', 'settlement_as_close.off'
]);
// dayofweek, barmerge, and x/y location constants are imported from registry
const FONT_CONSTANTS = new Set([
    'font.family_default', 'font.family_monospace'
]);
// TEXT_FORMAT_CONSTANTS imported from registry
const TEXT_WRAP_CONSTANTS = new Set([
    'text.wrap_none', 'text.wrap_auto'
]);
const ADDITIONAL_CONSTANT_SETS = [
    DAYOFWEEK_CONSTANTS,
    BARMERGE_CONSTANTS,
    SETTLEMENT_CONSTANTS,
    XLOC_YLOC_CONSTANTS,
    FONT_CONSTANTS,
    TEXT_FORMAT_CONSTANTS,
    TEXT_WRAP_CONSTANTS,
    SESSION_ADVANCED_CONSTANTS,
];
export class SyminfoVariablesValidator {
    constructor() {
        this.name = 'SyminfoVariablesValidator';
        this.priority = 68; // Lower priority - these are specialized variables
        this.errors = [];
        this.warnings = [];
        this.info = [];
        // Usage tracking
        this.syminfoUsage = new Map();
        this.constantUsage = new Map();
    }
    getDependencies() {
        return ['CoreValidator'];
    }
    validate(context, config) {
        this.reset();
        const astContext = this.getAstContext(context, config);
        if (!astContext?.ast) {
            return {
                isValid: true,
                errors: [],
                warnings: [],
                info: [],
                typeMap: new Map(),
                scriptType: context.scriptType
            };
        }
        this.collectSyminfoDataAst(astContext.ast);
        this.analyzeUsagePatterns();
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap: new Map(),
            scriptType: context.scriptType
        };
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.syminfoUsage.clear();
        this.constantUsage.clear();
    }
    analyzeUsagePatterns() {
        const totalSyminfoVars = this.syminfoUsage.size;
        const totalConstants = this.constantUsage.size;
        if (totalSyminfoVars > 0) {
            this.info.push({
                code: 'PSV6-SYMINFO-USAGE',
                message: `Advanced syminfo variables detected: ${totalSyminfoVars} different variables used`,
                line: 1,
                column: 1,
                severity: 'info'
            });
        }
        if (totalConstants > 0) {
            this.info.push({
                code: 'PSV6-CONSTANTS-USAGE',
                message: `Additional constants detected: ${totalConstants} different constants used`,
                line: 1,
                column: 1,
                severity: 'info'
            });
        }
        // Provide recommendations for financial data usage
        const hasFinancialVars = Array.from(this.syminfoUsage.keys()).some(key => key.includes('recommendations') || key.includes('target_price') || key.includes('employees'));
        if (hasFinancialVars) {
            this.info.push({
                code: 'PSV6-FINANCIAL-DATA-USAGE',
                message: 'Financial analysis variables used. Ensure symbol supports fundamental data',
                line: 1,
                column: 1,
                severity: 'info'
            });
        }
    }
    collectSyminfoDataAst(program) {
        visit(program, {
            MemberExpression: {
                enter: (path) => {
                    this.processAstMemberExpression(path);
                },
            },
        });
    }
    processAstMemberExpression(path) {
        const member = path.node;
        if (member.computed) {
            return;
        }
        const qualifiedName = this.getExpressionQualifiedName(member);
        if (!qualifiedName) {
            return;
        }
        const line = member.loc.start.line;
        const column = member.loc.start.column;
        if (this.recordSyminfoQualifiedName(qualifiedName, line, column)) {
            return;
        }
        this.recordConstantQualifiedName(qualifiedName, line, column);
    }
    recordSyminfoQualifiedName(name, line, column) {
        if (SYMINFO_COMPANY_VARS.has(name)) {
            this.recordSyminfoUsage(name, line, column, 'PSV6-SYMINFO-COMPANY', `Company information variable '${name}' detected`);
            return true;
        }
        if (SYMINFO_RECOMMENDATIONS_VARS.has(name)) {
            this.recordSyminfoUsage(name, line, column, 'PSV6-SYMINFO-RECOMMENDATIONS', `Analyst recommendations variable '${name}' detected`);
            return true;
        }
        if (SYMINFO_TARGET_PRICE_VARS.has(name)) {
            this.recordSyminfoUsage(name, line, column, 'PSV6-SYMINFO-TARGET-PRICE', `Price target variable '${name}' detected`);
            return true;
        }
        if (SYMINFO_ADDITIONAL_VARS.has(name)) {
            this.recordSyminfoUsage(name, line, column, 'PSV6-SYMINFO-ADDITIONAL', `Additional symbol info variable '${name}' detected`);
            return true;
        }
        return false;
    }
    recordSyminfoUsage(name, line, column, code, message) {
        this.syminfoUsage.set(name, (this.syminfoUsage.get(name) || 0) + 1);
        this.info.push({ code, message, line, column, severity: 'info' });
    }
    recordConstantQualifiedName(name, line, column) {
        if (!ADDITIONAL_CONSTANT_SETS.some((set) => set.has(name))) {
            return;
        }
        this.constantUsage.set(name, (this.constantUsage.get(name) || 0) + 1);
        this.info.push({
            code: 'PSV6-ADDITIONAL-CONSTANT',
            message: `Additional constant '${name}' detected`,
            line,
            column,
            severity: 'info',
        });
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
    getAstContext(context, config) {
        if (!config.ast || config.ast.mode === 'disabled') {
            return null;
        }
        return 'ast' in context ? context : null;
    }
}
