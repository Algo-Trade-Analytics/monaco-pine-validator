/**
 * Enhanced Resource Validator Module
 *
 * Handles enhanced resource validation for Pine Script v6:
 * - PSV6-RES-MEMORY: Memory usage warnings
 * - PSV6-RES-COMPLEXITY: Computational complexity
 */
import { findAncestor, visit } from '../core/ast/traversal';
export class EnhancedResourceValidator {
    constructor() {
        this.name = 'EnhancedResourceValidator';
        this.priority = 70; // Run after basic syntax validation
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.totalCollectionElements = 0;
        this.arrayAllocationCount = 0;
        this.varAllocationElements = 0;
        this.sawVarAllocation = false;
        this.loopStack = [];
    }
    getDependencies() {
        return ['CoreValidator', 'SyntaxValidator'];
    }
    validate(context, config) {
        this.reset();
        this.context = context;
        this.astContext = this.getAstContext(config);
        const ast = this.astContext?.ast;
        if (!ast) {
            return {
                isValid: true,
                errors: [],
                warnings: [],
                info: [],
                typeMap: new Map(),
                scriptType: null,
            };
        }
        this.validateWithAst(ast);
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap: new Map(),
            scriptType: null,
        };
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.totalCollectionElements = 0;
        this.arrayAllocationCount = 0;
        this.varAllocationElements = 0;
        this.sawVarAllocation = false;
        this.loopStack = [];
    }
    // ──────────────────────────────────────────────────────────────────────────
    // AST validation
    // ──────────────────────────────────────────────────────────────────────────
    validateWithAst(program) {
        this.loopStack = [];
        visit(program, {
            CallExpression: {
                enter: (path) => {
                    this.processAllocationCall(path);
                },
            },
            ForStatement: {
                enter: (path) => {
                    this.enterLoop(path);
                },
                exit: () => {
                    this.exitLoop();
                },
            },
            WhileStatement: {
                enter: (path) => {
                    this.enterLoop(path);
                },
                exit: () => {
                    this.exitLoop();
                },
            },
        });
        this.finalizeAstMemoryDiagnostics();
    }
    processAllocationCall(path) {
        const node = path.node;
        if (node.callee.kind !== 'MemberExpression') {
            return;
        }
        const member = node.callee;
        if (member.computed || member.property.kind !== 'Identifier') {
            return;
        }
        const namespace = this.getIdentifierName(member.object);
        if (!namespace) {
            return;
        }
        const method = member.property.name;
        const isVarDeclaration = this.isVarDeclaration(path);
        if (namespace === 'array' && method.startsWith('new')) {
            this.arrayAllocationCount++;
            const sizeArgument = node.args[0] ?? null;
            const sizeValue = sizeArgument ? this.extractNumericLiteral(sizeArgument.value) : null;
            if (sizeValue !== null) {
                this.totalCollectionElements += sizeValue;
            }
            if (sizeValue !== null && sizeValue > 50000) {
                const { line, column } = node.loc.start;
                this.addWarning(line, column, `Large array allocation detected: ${sizeValue} elements. Consider using smaller arrays or alternative data structures.`, 'PSV6-MEMORY-ARRAYS', 'Consider using smaller arrays or alternative data structures');
            }
            if (isVarDeclaration) {
                this.sawVarAllocation = true;
                if (sizeValue !== null) {
                    this.varAllocationElements += sizeValue;
                    if (sizeValue >= 50000) {
                        const { line, column } = node.loc.start;
                        this.addError(line, column, 'Type issue detected due to large array allocation', 'PSV6-ENUM-UNDEFINED-TYPE');
                    }
                }
            }
            return;
        }
        if (namespace === 'matrix' && method === 'new') {
            const rowArgument = node.args[0] ?? null;
            const colArgument = node.args[1] ?? null;
            const rows = rowArgument ? this.extractNumericLiteral(rowArgument.value) : null;
            const cols = colArgument ? this.extractNumericLiteral(colArgument.value) : null;
            if (rows !== null && cols !== null) {
                const total = rows * cols;
                this.totalCollectionElements += total;
                if (total > 50000) {
                    const { line, column } = node.loc.start;
                    this.addWarning(line, column, `Large matrix allocation detected: ${rows}x${cols} = ${total} elements. Consider using smaller matrices.`, 'PSV6-MEMORY-ARRAYS', 'Consider using smaller matrices or alternative data structures');
                }
                if (isVarDeclaration) {
                    this.sawVarAllocation = true;
                    this.varAllocationElements += total;
                }
            }
            else if (isVarDeclaration) {
                this.sawVarAllocation = true;
            }
        }
    }
    finalizeAstMemoryDiagnostics() {
        if (this.totalCollectionElements >= 30000) {
            this.addWarning(1, 1, `High total collection elements detected: ${this.totalCollectionElements}. This may impact performance.`, 'PSV6-MEMORY-LARGE-COLLECTION', 'Consider reducing the number of collection elements or using alternative approaches');
        }
        if (this.sawVarAllocation && this.varAllocationElements >= 30000) {
            this.addError(1, 1, 'Type issue detected due to high total collection elements', 'PSV6-ENUM-UNDEFINED-TYPE');
        }
        if (this.arrayAllocationCount > 10) {
            this.addWarning(1, 1, `Excessive array usage detected: ${this.arrayAllocationCount} arrays. This may impact performance.`, 'PSV6-MEMORY-ARRAYS', 'Consider reducing the number of arrays or using alternative data structures');
        }
    }
    enterLoop(path) {
        this.loopStack.push(path.node);
        const node = path.node;
        const test = node.kind === 'ForStatement' ? node.test : node.test;
        if (this.hasConditionalComplexity(test)) {
            const { line, column } = node.loc.start;
            this.addWarning(line, column, 'Conditional complexity detected in loop bounds. This may impact performance.', 'PSV6-PERF-NESTED-LOOPS', 'Consider simplifying loop bounds or pre-calculating values');
        }
        if (this.loopStack.length > 1) {
            const bound = node.kind === 'ForStatement'
                ? this.extractLoopBound(node.test)
                : this.extractLoopBound(node.test);
            if (bound !== null && bound >= 1000) {
                const { line, column } = node.loc.start;
                this.addWarning(line, column, `Large loop bounds detected in nested loop: bound: ${bound}. This may impact performance.`, 'PSV6-PERF-NESTED-LOOPS', 'Consider reducing loop bounds or optimizing the algorithm');
            }
        }
    }
    exitLoop() {
        this.loopStack.pop();
    }
    hasConditionalComplexity(expression) {
        if (!expression) {
            return false;
        }
        let complex = false;
        visit(expression, {
            BinaryExpression: {
                enter: (path) => {
                    const operator = path.node.operator;
                    if (operator === '&&' || operator === '||' || operator === 'and' || operator === 'or') {
                        complex = true;
                        return false;
                    }
                },
            },
            ConditionalExpression: {
                enter: () => {
                    complex = true;
                    return false;
                },
            },
        });
        return complex;
    }
    extractLoopBound(expression) {
        if (!expression || expression.kind !== 'BinaryExpression') {
            return null;
        }
        const binary = expression;
        const rightValue = this.extractNumericLiteral(binary.right);
        if (rightValue !== null && this.containsIdentifier(binary.left)) {
            return rightValue;
        }
        const leftValue = this.extractNumericLiteral(binary.left);
        if (leftValue !== null && this.containsIdentifier(binary.right)) {
            return leftValue;
        }
        return null;
    }
    containsIdentifier(expression) {
        let found = false;
        visit(expression, {
            Identifier: {
                enter: () => {
                    found = true;
                    return false;
                },
            },
        });
        return found;
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
            return unary.operator === '-' ? -value : value;
        }
        return null;
    }
    getIdentifierName(expression) {
        if (expression.kind === 'Identifier') {
            return expression.name;
        }
        return null;
    }
    isVarDeclaration(path) {
        const declarationAncestor = findAncestor(path, (ancestor) => ancestor.node.kind === 'VariableDeclaration');
        if (!declarationAncestor) {
            return false;
        }
        const declaration = declarationAncestor.node;
        return declaration.declarationKind === 'var';
    }
    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────
    addError(line, column, message, code, suggestion) {
        this.errors.push({
            line,
            column,
            message,
            code,
            suggestion,
            severity: 'error',
        });
    }
    addWarning(line, column, message, code, suggestion) {
        this.warnings.push({
            line,
            column,
            message,
            code,
            suggestion,
            severity: 'warning',
        });
    }
    addInfo(line, column, message, code) {
        this.info.push({
            line,
            column,
            message,
            code,
            severity: 'info',
        });
    }
    getAstContext(config) {
        if (!config.ast || config.ast.mode === 'disabled') {
            return null;
        }
        return isAstValidationContext(this.context) ? this.context : null;
    }
}
function isAstValidationContext(context) {
    return 'ast' in context;
}
