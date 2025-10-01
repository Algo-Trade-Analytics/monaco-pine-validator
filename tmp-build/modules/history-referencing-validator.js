/**
 * History Referencing validation module for Pine Script v6
 * Handles validation of history references, performance analysis, and scope validation
 */
import { findAncestor, visit } from '../core/ast/traversal';
function isAstValidationContext(context) {
    return 'ast' in context;
}
const BUILTIN_HISTORY_TYPES = {
    close: 'float',
    open: 'float',
    high: 'float',
    low: 'float',
    volume: 'float',
    time: 'int',
    bar_index: 'int',
    hl2: 'float',
    hlc3: 'float',
    ohlc4: 'float',
    hlcc4: 'float',
};
export class HistoryReferencingValidator {
    constructor() {
        this.name = 'HistoryReferencingValidator';
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
    }
    getDependencies() {
        return ['SyntaxValidator', 'TypeValidator'];
    }
    validate(context, config) {
        this.reset();
        this.config = config;
        if (!isAstValidationContext(context) || !context.ast) {
            return {
                isValid: true,
                errors: [],
                warnings: [],
                info: [],
                typeMap: new Map(),
                scriptType: null,
            };
        }
        this.astContext = context;
        this.validateHistoryWithAst(context.ast);
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap: new Map(),
            scriptType: null
        };
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
    }
    addError(line, column, message, code, suggestion) {
        this.errors.push({
            line,
            column,
            message,
            code,
            suggestion,
            severity: 'error'
        });
    }
    addWarning(line, column, message, code) {
        this.warnings.push({
            line,
            column,
            message,
            code,
            severity: 'warning'
        });
    }
    addInfo(line, column, message, code) {
        this.info.push({
            line,
            column,
            message,
            code,
            severity: 'info'
        });
    }
    validateHistoryWithAst(program) {
        if (!this.astContext) {
            return;
        }
        const varipVariables = new Set();
        const warnedLoops = new Set();
        visit(program, {
            VariableDeclaration: {
                enter: (path) => {
                    const node = path.node;
                    const identifierName = node.identifier.name;
                    if (node.declarationKind === 'varip') {
                        varipVariables.add(identifierName);
                        if (node.initializer && this.expressionHasHistoryReference(node.initializer)) {
                            const { line, column } = node.loc.start;
                            this.addError(line, column, 'History references are not allowed in varip assignments.', 'PSV6-HISTORY-VARIP-CONTEXT');
                        }
                    }
                    if (node.typeAnnotation && node.initializer) {
                        this.validateHistoryTypeMismatchAst(node);
                    }
                },
            },
            AssignmentStatement: {
                enter: (path) => {
                    const node = path.node;
                    if (!node.right) {
                        return;
                    }
                    const targetName = this.getIdentifierName(node.left);
                    if (!targetName || !varipVariables.has(targetName)) {
                        return;
                    }
                    if (!this.expressionHasHistoryReference(node.right)) {
                        return;
                    }
                    const { line, column } = node.loc.start;
                    this.addError(line, column, 'History references are not allowed in varip assignments.', 'PSV6-HISTORY-VARIP-CONTEXT');
                },
            },
            CallExpression: {
                enter: (path) => {
                    const node = path.node;
                    for (const argument of node.args) {
                        if (!this.expressionHasHistoryReference(argument.value)) {
                            continue;
                        }
                        const { line, column } = argument.value.loc.start;
                        this.addWarning(line, column, 'History reference used in function parameter. Consider caching the value before calling the function.', 'PSV6-HISTORY-FUNCTION-PARAM');
                    }
                },
            },
            IndexExpression: {
                enter: (path) => {
                    this.processAstIndexExpression(path, warnedLoops);
                },
            },
        });
    }
    processAstIndexExpression(path, warnedLoops) {
        if (!this.isHistoryReference(path.node)) {
            return;
        }
        this.checkNegativeHistoryIndex(path.node);
        this.checkLargeHistoryIndex(path.node);
        this.checkNestedHistoryReference(path);
        this.checkHistoryReferenceInLoop(path, warnedLoops);
    }
    checkNegativeHistoryIndex(node) {
        const numericIndex = this.extractNumericLiteral(node.index);
        if (numericIndex === null || numericIndex >= 0) {
            return;
        }
        const { line, column } = node.index.loc.start;
        const targetVersion = this.config.targetVersion ?? 6;
        if (targetVersion < 6) {
            this.addError(line, column, 'Invalid history reference: negative indexes are not allowed.', 'PSV6-HISTORY-INVALID-INDEX');
            return;
        }
        const metadata = this.resolveExpressionType(node.object);
        const isSeries = !metadata || metadata.kind === 'series';
        if (!isSeries) {
            return;
        }
        this.addError(line, column, 'Invalid history reference: negative indexes are not allowed for series data.', 'PSV6-HISTORY-INVALID-INDEX', 'Use positive indices like close[1] for historical data, or array.get(myArray, -1) for arrays.');
        this.addError(line, column, 'History references cannot look into the future. Negative offsets access future bars.', 'PSV6-FUTURE-DATA', 'Replace negative indices with positive history references like close[1] or cache future values explicitly.');
    }
    checkLargeHistoryIndex(node) {
        const numericIndex = this.extractNumericLiteral(node.index);
        if (numericIndex === null || numericIndex <= 1000) {
            return;
        }
        const { line, column } = node.index.loc.start;
        this.addWarning(line, column, `Large history index: ${numericIndex}. Consider using request.security() for historical data beyond 1000 bars`, 'PSV6-HISTORY-LARGE-INDEX');
    }
    checkNestedHistoryReference(path) {
        const ancestorIndex = findAncestor(path, (ancestor) => ancestor.node.kind === 'IndexExpression');
        if (ancestorIndex) {
            return;
        }
        if (!this.expressionHasHistoryReference(path.node.index)) {
            return;
        }
        const { line, column } = path.node.loc.start;
        this.addWarning(line, column, 'Nested history reference detected. This can impact performance.', 'PSV6-HISTORY-PERF-NESTED');
    }
    checkHistoryReferenceInLoop(path, warnedLoops) {
        const loopAncestor = findAncestor(path, (ancestor) => {
            const kind = ancestor.node.kind;
            return kind === 'ForStatement' || kind === 'WhileStatement';
        });
        if (!loopAncestor) {
            return;
        }
        const loopNode = loopAncestor.node;
        if (warnedLoops.has(loopNode)) {
            return;
        }
        warnedLoops.add(loopNode);
        const { line, column } = path.node.loc.start;
        const loopLine = loopNode.loc.start.line;
        this.addWarning(line, column, `History reference in loop (line ${loopLine}). Consider caching historical values outside the loop for better performance`, 'PSV6-HISTORY-PERF-LOOP');
    }
    validateHistoryTypeMismatchAst(declaration) {
        const declaredType = this.getTypeAnnotationName(declaration.typeAnnotation);
        if (!declaredType || !declaration.initializer) {
            return;
        }
        const historyReference = this.findFirstHistoryReference(declaration.initializer);
        if (!historyReference?.identifier) {
            return;
        }
        const expectedType = BUILTIN_HISTORY_TYPES[historyReference.identifier];
        if (!expectedType) {
            return;
        }
        if (declaredType === expectedType) {
            return;
        }
        if (declaredType === 'float' && expectedType === 'int') {
            return;
        }
        const { line, column } = declaration.loc.start;
        this.addWarning(line, column, `Type mismatch: declared as '${declaredType}' but '${historyReference.identifier}[...]' yields a different type`, 'PSV6-HISTORY-TYPE-MISMATCH');
    }
    findFirstHistoryReference(expression) {
        let reference = null;
        visit(expression, {
            IndexExpression: {
                enter: (path) => {
                    const node = path.node;
                    if (reference || !this.isHistoryReference(node)) {
                        return;
                    }
                    reference = {
                        node,
                        identifier: this.getIdentifierName(node.object),
                    };
                    return false;
                },
            },
        });
        return reference;
    }
    expressionHasHistoryReference(expression) {
        let hasHistory = false;
        visit(expression, {
            IndexExpression: {
                enter: (path) => {
                    const node = path.node;
                    if (!this.isHistoryReference(node)) {
                        return;
                    }
                    hasHistory = true;
                    return false;
                },
            },
        });
        return hasHistory;
    }
    isHistoryReference(node) {
        const metadata = this.resolveExpressionType(node.object);
        if (metadata) {
            if (metadata.kind === 'series') {
                return true;
            }
            if (metadata.kind === 'matrix') {
                return false;
            }
            if (metadata.kind !== 'unknown') {
                const identifier = this.getIdentifierName(node.object);
                return !!(identifier && BUILTIN_HISTORY_TYPES[identifier]);
            }
        }
        const identifier = this.getIdentifierName(node.object);
        if (identifier) {
            return !!BUILTIN_HISTORY_TYPES[identifier];
        }
        return !metadata || metadata.kind === 'unknown';
    }
    resolveExpressionType(expression) {
        if (!this.astContext) {
            return null;
        }
        const { typeEnvironment } = this.astContext;
        const direct = typeEnvironment.nodeTypes.get(expression);
        if (direct) {
            return direct;
        }
        if (expression.kind === 'Identifier') {
            return typeEnvironment.identifiers.get(expression.name) ?? null;
        }
        return null;
    }
    extractNumericLiteral(expression) {
        if (expression.kind === 'NumberLiteral') {
            return expression.value;
        }
        if (expression.kind === 'UnaryExpression') {
            const unary = expression;
            const value = this.extractNumericLiteral(unary.argument);
            if (value === null) {
                return null;
            }
            if (unary.operator === '-') {
                return -value;
            }
            if (unary.operator === '+') {
                return value;
            }
        }
        return null;
    }
    getTypeAnnotationName(type) {
        if (!type) {
            return null;
        }
        return type.name.name;
    }
    getIdentifierName(expression) {
        if (expression.kind === 'Identifier') {
            return expression.name;
        }
        return null;
    }
}
