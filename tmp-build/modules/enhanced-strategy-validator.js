/**
 * Enhanced Strategy Validator Module
 *
 * Handles strategy-specific validation for Pine Script v6:
 * - PSV6-STRATEGY-REALISM: Missing commission settings
 * - PSV6-STRATEGY-RISK: Risk management suggestions
 * - PSV6-STRATEGY-POSITION-SIZE: Excessive position size
 * - PSV6-STRATEGY-NO-EXIT: Missing exit strategy
 * - PSV6-STRATEGY-CLOSEDTRADES: Closed trades property access
 * - PSV6-STRATEGY-OPENTRADES: Open trades property access
 * - PSV6-STRATEGY-UNCHECKED-ACCESS: Accessing trades without count check
 */
import { visit } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';
const POSITION_SIZE_THRESHOLD = 100000;
const RISK_IDENTIFIER_NAMES = new Set(['stop_loss', 'take_profit', 'trail_stop']);
// Valid strategy.closedtrades.* properties
const CLOSED_TRADES_PROPERTIES = new Set([
    'entry_price', 'entry_time', 'entry_bar_index', 'entry_id', 'entry_comment',
    'exit_price', 'exit_time', 'exit_bar_index', 'exit_id', 'exit_comment',
    'profit', 'profit_percent', 'commission', 'size', 'direction',
    'max_drawdown', 'max_runup',
]);
// Valid strategy.opentrades.* properties
const OPEN_TRADES_PROPERTIES = new Set([
    'entry_price', 'entry_time', 'entry_bar_index', 'entry_id', 'entry_comment',
    'profit', 'profit_percent', 'size', 'direction',
    'max_drawdown', 'max_runup',
]);
export class EnhancedStrategyValidator {
    constructor() {
        this.name = 'EnhancedStrategyValidator';
        this.priority = 75; // Run after basic syntax validation
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.context = null;
    }
    debug(payload) {
        if (process.env.DEBUG_ENH_STRATEGY === '1') {
            console.log('[EnhancedStrategyValidator]', payload);
        }
    }
    getDependencies() {
        return ['CoreValidator', 'SyntaxValidator'];
    }
    validate(context, config) {
        this.reset();
        this.context = context;
        this.astContext = ensureAstContext(context, config);
        const program = this.astContext?.ast ?? null;
        if (!program) {
            return {
                isValid: true,
                errors: [],
                warnings: [],
                info: [],
                typeMap: new Map(),
                scriptType: null,
            };
        }
        this.validateWithAst(program);
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap: new Map(),
            scriptType: null,
        };
    }
    // ──────────────────────────────────────────────────────────────────────────
    // AST validation
    // ──────────────────────────────────────────────────────────────────────────
    validateWithAst(program) {
        const data = this.collectAstStrategyData(program);
        this.debug({ phase: 'ast', data });
        this.validateAstStrategyRealism(data);
        this.validateAstRiskManagement(data);
        this.validateAstPositionSize(data);
        this.validateAstExitStrategy(data);
        this.validateAstTradePropertyAccess(data);
    }
    collectAstStrategyData(program) {
        const data = {
            strategyCalls: [],
            entryCalls: [],
            exitCalls: [],
            closeCalls: [],
            cancelCalls: [],
            hasRiskIdentifier: false,
            tradePropertyAccess: [],
            tradeCountChecks: new Set(),
        };
        visit(program, {
            ScriptDeclaration: {
                enter: (path) => {
                    const node = path.node;
                    if (node.scriptType === 'strategy') {
                        const namedArgs = this.collectNamedArguments(node.arguments);
                        data.strategyCalls.push({ node: node, namedArgs });
                    }
                },
            },
            Identifier: {
                enter: (path) => {
                    if (RISK_IDENTIFIER_NAMES.has(path.node.name)) {
                        data.hasRiskIdentifier = true;
                    }
                },
            },
            CallExpression: {
                enter: (path) => {
                    this.processAstCall(path, data);
                },
            },
            IfStatement: {
                enter: (path) => {
                    this.detectTradeCountCheck(path, data);
                },
            },
        });
        return data;
    }
    processAstCall(path, data) {
        const node = path.node;
        const qualifiedName = this.getExpressionQualifiedName(node.callee);
        if (!qualifiedName) {
            return;
        }
        const namedArgs = this.collectNamedArguments(node.args);
        // Support CallExpression-based strategy() calls (for backwards compatibility with tests)
        if (qualifiedName === 'strategy') {
            data.strategyCalls.push({ node, namedArgs });
            return;
        }
        if (qualifiedName === 'strategy.entry') {
            data.entryCalls.push({ node, namedArgs });
            return;
        }
        if (qualifiedName === 'strategy.exit') {
            data.exitCalls.push({ node, namedArgs });
            return;
        }
        if (qualifiedName === 'strategy.close') {
            data.closeCalls.push({ node, namedArgs });
            return;
        }
        if (qualifiedName === 'strategy.cancel') {
            data.cancelCalls.push({ node, namedArgs });
            return;
        }
        // Detect strategy.closedtrades.* property access
        if (qualifiedName?.startsWith('strategy.closedtrades.')) {
            const propertyName = qualifiedName.substring('strategy.closedtrades.'.length);
            if (CLOSED_TRADES_PROPERTIES.has(propertyName)) {
                const indexExpression = node.args[0]?.value ?? null;
                data.tradePropertyAccess.push({
                    node,
                    tradeCollection: 'closedtrades',
                    propertyName,
                    indexExpression,
                });
            }
            return;
        }
        // Detect strategy.opentrades.* property access
        if (qualifiedName?.startsWith('strategy.opentrades.')) {
            const propertyName = qualifiedName.substring('strategy.opentrades.'.length);
            if (OPEN_TRADES_PROPERTIES.has(propertyName)) {
                const indexExpression = node.args[0]?.value ?? null;
                data.tradePropertyAccess.push({
                    node,
                    tradeCollection: 'opentrades',
                    propertyName,
                    indexExpression,
                });
            }
        }
    }
    /**
     * Detect if condition checks strategy.closedtrades or strategy.opentrades count
     * Example: if strategy.closedtrades > 0
     */
    detectTradeCountCheck(path, data) {
        const test = path.node.test;
        if (test.kind !== 'BinaryExpression') {
            return;
        }
        const binary = test;
        const leftName = this.getExpressionQualifiedName(binary.left);
        const rightName = this.getExpressionQualifiedName(binary.right);
        // Check if strategy.closedtrades or strategy.opentrades is being compared
        if (leftName === 'strategy.closedtrades' || rightName === 'strategy.closedtrades') {
            data.tradeCountChecks.add('closedtrades');
        }
        if (leftName === 'strategy.opentrades' || rightName === 'strategy.opentrades') {
            data.tradeCountChecks.add('opentrades');
        }
    }
    validateAstStrategyRealism(data) {
        if (!data.strategyCalls.length) {
            return;
        }
        const hasCommission = data.strategyCalls.some((call) => call.namedArgs.has('commission_type') || call.namedArgs.has('commission_value'));
        if (!hasCommission) {
            const location = data.strategyCalls[0].node.loc.start;
            this.addWarning(location.line, location.column, 'Strategy lacks commission settings for realistic backtesting', 'PSV6-STRATEGY-REALISM', 'Add commission_type and commission_value parameters to strategy()');
        }
    }
    validateAstRiskManagement(data) {
        if (!data.strategyCalls.length) {
            return;
        }
        const hasRiskManagement = data.exitCalls.length > 0 || data.closeCalls.length > 0 || data.hasRiskIdentifier;
        if (!hasRiskManagement) {
            const location = data.strategyCalls[0].node.loc.start;
            this.addInfo(location.line, location.column, 'Consider adding risk management features to your strategy', 'PSV6-STRATEGY-RISK', 'Add stop loss, take profit, or trailing stop orders');
        }
    }
    validateAstPositionSize(data) {
        for (const call of data.entryCalls) {
            const qtyArg = call.namedArgs.get('qty');
            if (!qtyArg) {
                continue;
            }
            const value = this.getNumericLiteralValue(qtyArg.value);
            if (value !== null && value > POSITION_SIZE_THRESHOLD) {
                const location = qtyArg.value.loc.start;
                this.addWarning(location.line, location.column, 'Excessive position size may not be realistic', 'PSV6-STRATEGY-POSITION-SIZE', 'Consider using a more realistic position size');
            }
        }
    }
    validateAstExitStrategy(data) {
        if (!data.strategyCalls.length || !data.entryCalls.length) {
            return;
        }
        const hasExit = data.exitCalls.length > 0 || data.closeCalls.length > 0 || data.cancelCalls.length > 0;
        if (!hasExit) {
            const location = data.entryCalls[0].node.loc.start;
            this.addWarning(location.line, location.column, 'Strategy has entry conditions but no exit strategy', 'PSV6-STRATEGY-NO-EXIT', 'Add strategy.exit() or strategy.close() calls');
        }
    }
    /**
     * Validate strategy.closedtrades.* and strategy.opentrades.* property access
     */
    validateAstTradePropertyAccess(data) {
        for (const access of data.tradePropertyAccess) {
            // Warn if accessing trades without checking count first
            if (!data.tradeCountChecks.has(access.tradeCollection)) {
                const location = access.node.loc.start;
                this.addWarning(location.line, location.column, `Accessing strategy.${access.tradeCollection}.${access.propertyName}() without checking trade count first`, 'PSV6-STRATEGY-UNCHECKED-ACCESS', `Add a condition to check if strategy.${access.tradeCollection} > 0 before accessing trade properties`);
            }
            // Validate negative indices
            if (access.indexExpression) {
                const indexValue = this.getNumericLiteralValue(access.indexExpression);
                if (indexValue !== null && indexValue < 0) {
                    const location = access.indexExpression.loc.start;
                    this.addError(location.line, location.column, `Invalid negative index ${indexValue} for strategy.${access.tradeCollection}`, 'PSV6-STRATEGY-INVALID-INDEX');
                }
            }
            // Warn if trying to plot string properties (entry_id, exit_id, entry_comment, exit_comment)
            const stringProperties = new Set(['entry_id', 'exit_id', 'entry_comment', 'exit_comment']);
            if (stringProperties.has(access.propertyName)) {
                // Check if this is directly used in plot() call by looking at parent
                const parent = this.findCallParent(access.node);
                if (parent && this.getExpressionQualifiedName(parent.callee) === 'plot') {
                    const location = access.node.loc.start;
                    this.addError(location.line, location.column, `Cannot plot string property strategy.${access.tradeCollection}.${access.propertyName}()`, 'PSV6-STRATEGY-TYPE-ERROR', `Use label.new() instead of plot() for string values`);
                }
            }
        }
    }
    /**
     * Find parent CallExpression node (if any)
     */
    findCallParent(node) {
        // This is a simplified version - in a real implementation, we'd use the path from the visitor
        // For now, we'll skip this check
        return null;
    }
    addError(line, column, message, code, suggestion) {
        this.errors.push({ line, column, message, severity: 'error', code, suggestion });
    }
    collectNamedArguments(args) {
        const map = new Map();
        for (const arg of args) {
            if (arg.name) {
                map.set(arg.name.name, arg);
            }
        }
        return map;
    }
    getNumericLiteralValue(expression) {
        if (expression.kind === 'NumberLiteral') {
            return expression.value;
        }
        if (expression.kind === 'UnaryExpression') {
            const unary = expression;
            if (unary.operator === '+' || unary.operator === '-') {
                const value = this.getNumericLiteralValue(unary.argument);
                if (value === null) {
                    return null;
                }
                return unary.operator === '-' ? -value : value;
            }
        }
        return null;
    }
    getExpressionQualifiedName(expression) {
        if (expression.kind === 'Identifier') {
            return expression.name;
        }
        if (expression.kind === 'MemberExpression') {
            const member = expression;
            const objectName = this.getExpressionQualifiedName(member.object);
            if (!objectName) {
                return null;
            }
            return `${objectName}.${member.property.name}`;
        }
        return null;
    }
    // ──────────────────────────────────────────────────────────────────────────
    // Shared helpers
    // ──────────────────────────────────────────────────────────────────────────
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.context = null;
    }
    addWarning(line, column, message, code, suggestion) {
        this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
    }
    addInfo(line, column, message, code, suggestion) {
        this.info.push({ line, column, message, severity: 'info', code, suggestion });
    }
}
