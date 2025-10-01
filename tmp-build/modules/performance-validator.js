/**
 * Performance analysis module for Pine Script v6
 * Handles performance optimization suggestions, memory usage analysis, and computational complexity
 */
import { visit } from '../core/ast/traversal';
export class PerformanceValidator {
    constructor() {
        this.name = 'PerformanceValidator';
        this.errors = [];
        this.astContext = null;
        this.loopStack = [];
        this.controlDepth = 1;
        this.maxNestingDepth = 1;
        this.arrayAllocationCount = 0;
        this.matrixAllocationCount = 0;
        this.mapAllocationCount = 0;
        this.requestCallCount = 0;
        this.plotCallCount = 0;
        this.alertCallCount = 0;
        this.expensiveFunctionCounts = new Map();
        this.duplicateExpensiveWarnings = new Set();
    }
    getDependencies() {
        return ['SyntaxValidator'];
    }
    validate(context, config) {
        this.reset();
        if (!config.enablePerformanceAnalysis) {
            return {
                isValid: this.errors.length === 0,
                errors: this.errors,
                warnings: [],
                info: [],
                typeMap: new Map(),
                scriptType: null,
            };
        }
        this.astContext = this.getAstContext(context, config);
        if (!this.astContext?.ast) {
            return {
                isValid: true,
                errors: [],
                warnings: [],
                info: [],
                typeMap: new Map(),
                scriptType: null,
            };
        }
        this.collectPerformanceDataAst(this.astContext.ast);
        this.finalizeAstDiagnostics();
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: [],
            info: [],
            typeMap: new Map(),
            scriptType: null,
        };
    }
    collectPerformanceDataAst(program) {
        this.loopStack = [];
        this.controlDepth = 1;
        this.maxNestingDepth = 1;
        this.expensiveFunctionCounts.clear();
        this.duplicateExpensiveWarnings.clear();
        this.arrayAllocationCount = 0;
        this.matrixAllocationCount = 0;
        this.mapAllocationCount = 0;
        this.requestCallCount = 0;
        this.plotCallCount = 0;
        this.alertCallCount = 0;
        visit(program, {
            BlockStatement: {
                enter: () => {
                    this.controlDepth++;
                    this.maxNestingDepth = Math.max(this.maxNestingDepth, this.controlDepth);
                },
                exit: () => {
                    this.controlDepth = Math.max(1, this.controlDepth - 1);
                },
            },
            ForStatement: {
                enter: (path) => {
                    this.enterLoop(path.node);
                },
                exit: () => {
                    this.exitLoop();
                },
            },
            WhileStatement: {
                enter: (path) => {
                    this.enterLoop(path.node);
                },
                exit: () => {
                    this.exitLoop();
                },
            },
            CallExpression: {
                enter: (path) => {
                    this.processAstCall(path.node, this.loopStack.length > 0);
                },
            },
        });
    }
    finalizeAstDiagnostics() {
        if (this.maxNestingDepth > 6) {
            this.addWarning(1, 1, `High nesting depth (${this.maxNestingDepth} levels) may impact readability and performance.`, 'PSV6-PERF-HIGH-NESTING', 'Consider refactoring to reduce nesting depth by extracting functions or using early returns.');
        }
        if (this.arrayAllocationCount > 10) {
            this.addWarning(1, 1, `High number of array allocations (${this.arrayAllocationCount}). Consider consolidating or reusing arrays.`, 'PSV6-MEMORY-EXCESSIVE-ARRAYS', 'Consider using fewer arrays or reusing existing ones to reduce memory usage.');
        }
        if (this.matrixAllocationCount > 5) {
            this.addWarning(1, 1, `High number of matrix allocations (${this.matrixAllocationCount}). Consider consolidating matrices.`, 'PSV6-MEMORY-EXCESSIVE-MATRICES', 'Consider using fewer matrices or alternative data structures.');
        }
        if (this.mapAllocationCount > 5) {
            this.addWarning(1, 1, `High number of map allocations (${this.mapAllocationCount}). Consider consolidating maps.`, 'PSV6-MEMORY-EXCESSIVE-MAPS', 'Consider using fewer maps or alternative data structures.');
        }
        if (this.requestCallCount > 5) {
            this.addWarning(1, 1, `High number of request calls (${this.requestCallCount}) may impact performance.`, 'PSV6-PERF-EXCESSIVE-REQUESTS', 'Consider consolidating requests or using request.security with multiple expressions.');
        }
        if (this.plotCallCount > 10) {
            this.addWarning(1, 1, `High number of plot calls (${this.plotCallCount}) may impact rendering performance.`, 'PSV6-PERF-EXCESSIVE-PLOTS', 'Consider reducing the number of plots or using conditional plotting.');
        }
        if (this.alertCallCount > 20) {
            this.addWarning(1, 1, `High number of alert calls (${this.alertCallCount}) may impact performance.`, 'PSV6-PERF-EXCESSIVE-ALERTS', 'Consider consolidating alerts or using alertcondition instead of multiple alert calls.');
        }
        if (this.alertCallCount >= 2) {
            this.addError(1, 1, `Multiple alert conditions detected (${this.alertCallCount}). Consider consolidating or documenting alert logic.`, 'PSV6-PERF-ALERT-CONSOLIDATE', 'Reduce duplicate alerts or combine conditions when possible.');
        }
    }
    processAstCall(node, inLoop) {
        const qualifiedName = this.getExpressionQualifiedName(node.callee);
        if (!qualifiedName) {
            return;
        }
        if (qualifiedName.startsWith('array.new')) {
            this.arrayAllocationCount++;
            this.handleArrayAllocation(node);
        }
        else if (qualifiedName.startsWith('matrix.new')) {
            this.matrixAllocationCount++;
            this.handleMatrixAllocation(node);
        }
        else if (qualifiedName.startsWith('map.new')) {
            this.mapAllocationCount++;
        }
        if (this.isExpensiveFunction(qualifiedName)) {
            this.handleExpensiveFunction(node, qualifiedName, inLoop);
        }
        if (this.isExpensiveNamespace(qualifiedName) && this.controlDepth > 4) {
            this.addInfo(node.loc.start.line, node.loc.start.column, `Expensive operation in deeply nested context (depth: ${this.controlDepth}).`, 'PSV6-PERF-DEEP-NESTING', 'Consider moving expensive operations to a higher scope or extracting to a function.');
        }
        if (qualifiedName.startsWith('request.')) {
            this.requestCallCount++;
        }
        if (this.isPlotFunction(qualifiedName)) {
            this.plotCallCount++;
        }
        if (this.isAlertFunction(qualifiedName)) {
            this.alertCallCount++;
        }
    }
    handleArrayAllocation(node) {
        const size = this.getNumericLiteralValue(node.args[0]?.value ?? null);
        if (size !== null && size > 10000) {
            this.addWarning(node.loc.start.line, node.loc.start.column, `Large array allocation (${size} elements) may impact memory usage.`, 'PSV6-MEMORY-LARGE-ARRAY', 'Consider using a smaller size or dynamic allocation if possible.');
        }
    }
    handleMatrixAllocation(node) {
        const rows = this.getNumericLiteralValue(node.args[0]?.value ?? null);
        const cols = this.getNumericLiteralValue(node.args[1]?.value ?? null);
        if (rows !== null && cols !== null) {
            const total = rows * cols;
            if (total > 1000) {
                this.addWarning(node.loc.start.line, node.loc.start.column, `Large matrix allocation (${rows}x${cols} = ${total} elements) may impact memory usage.`, 'PSV6-MEMORY-LARGE-MATRIX', 'Consider using a smaller matrix or alternative data structure.');
            }
        }
    }
    handleExpensiveFunction(node, qualifiedName, inLoop) {
        if (inLoop) {
            const severity = this.isVeryExpensiveFunction(qualifiedName) ? 'error' : 'warning';
            this.addDiagnostic(severity, node.loc.start.line, node.loc.start.column, `Expensive function '${qualifiedName}' detected in loop may impact performance.`, 'PSV6-PERF-EXPENSIVE-IN-LOOP', 'Move expensive calculations outside the loop or cache their results.');
        }
        const key = `${qualifiedName}:${node.loc.start.line}`;
        const count = (this.expensiveFunctionCounts.get(key) ?? 0) + 1;
        this.expensiveFunctionCounts.set(key, count);
        if (count > 1 && !this.duplicateExpensiveWarnings.has(key)) {
            this.duplicateExpensiveWarnings.add(key);
            this.addWarning(node.loc.start.line, node.loc.start.column, `Multiple calls to expensive function '${qualifiedName}' on the same line.`, 'PSV6-PERF-MULTIPLE-EXPENSIVE', 'Consider caching the result or splitting into multiple lines.');
        }
    }
    enterLoop(node) {
        if (this.loopStack.length > 0) {
            const parent = this.loopStack[this.loopStack.length - 1];
            parent.maxDepth = Math.max(parent.maxDepth, 2);
        }
        this.loopStack.push({ node, maxDepth: 1 });
    }
    exitLoop() {
        const loopInfo = this.loopStack.pop();
        if (!loopInfo) {
            return;
        }
        if (loopInfo.maxDepth > 1) {
            this.addWarning(loopInfo.node.loc.start.line, loopInfo.node.loc.start.column, `Nested loops detected (${loopInfo.maxDepth} levels) may impact performance.`, 'PSV6-PERF-NESTED-LOOPS', 'Consider optimizing the algorithm or reducing the number of nested iterations.');
        }
        if (this.loopStack.length > 0) {
            const parent = this.loopStack[this.loopStack.length - 1];
            parent.maxDepth = Math.max(parent.maxDepth, loopInfo.maxDepth + 1);
        }
    }
    isExpensiveFunction(name) {
        return [
            'ta.highest',
            'ta.lowest',
            'ta.pivothigh',
            'ta.pivotlow',
            'ta.correlation',
            'ta.linreg',
            'ta.percentile_linear_interpolation',
            'ta.percentile_nearest_rank',
            'ta.percentrank',
            'request.security',
            'request.dividends',
            'request.earnings',
        ].includes(name);
    }
    isVeryExpensiveFunction(name) {
        return ['ta.highest', 'ta.lowest', 'ta.pivothigh', 'ta.pivotlow', 'ta.correlation', 'ta.linreg'].includes(name);
    }
    isExpensiveNamespace(name) {
        return name.startsWith('ta.') || name.startsWith('request.') || name.startsWith('math.');
    }
    isPlotFunction(name) {
        return name === 'plot' || name.startsWith('plot');
    }
    isAlertFunction(name) {
        return (name === 'alert' ||
            name === 'alertcondition' ||
            name.startsWith('alert.') ||
            name.startsWith('alertcondition.'));
    }
    getExpressionQualifiedName(expression) {
        if (expression.kind === 'Identifier') {
            return expression.name;
        }
        if (expression.kind === 'MemberExpression') {
            const member = expression;
            if (member.computed) {
                return null;
            }
            const objectName = this.getExpressionQualifiedName(member.object);
            if (!objectName) {
                return null;
            }
            return `${objectName}.${member.property.name}`;
        }
        return null;
    }
    getNumericLiteralValue(expression) {
        if (!expression) {
            return null;
        }
        if (expression.kind === 'NumberLiteral') {
            return expression.value;
        }
        if (expression.kind === 'UnaryExpression') {
            const unary = expression;
            if (unary.argument.kind === 'NumberLiteral') {
                const value = unary.argument.value;
                return unary.operator === '-' ? -value : value;
            }
        }
        return null;
    }
    addDiagnostic(severity, line, column, message, code, suggestion) {
        this.errors.push({ line, column, message, severity, code, suggestion });
    }
    addWarning(line, column, message, code, suggestion) {
        this.addDiagnostic('warning', line, column, message, code, suggestion);
    }
    addError(line, column, message, code, suggestion) {
        this.addDiagnostic('error', line, column, message, code, suggestion);
    }
    addInfo(line, column, message, code, suggestion) {
        this.addDiagnostic('info', line, column, message, code, suggestion);
    }
    reset() {
        this.errors = [];
        this.astContext = null;
        this.loopStack = [];
        this.controlDepth = 1;
        this.maxNestingDepth = 1;
        this.arrayAllocationCount = 0;
        this.matrixAllocationCount = 0;
        this.mapAllocationCount = 0;
        this.requestCallCount = 0;
        this.plotCallCount = 0;
        this.alertCallCount = 0;
        this.expensiveFunctionCounts = new Map();
        this.duplicateExpensiveWarnings = new Set();
    }
    getAstContext(context, config) {
        if (!config.ast || config.ast.mode === 'disabled') {
            return null;
        }
        return isAstValidationContext(context) && context.ast ? context : null;
    }
}
function isAstValidationContext(context) {
    return 'ast' in context;
}
