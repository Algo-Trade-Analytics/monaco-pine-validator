/**
 * Enhanced Quality Validator Module
 *
 * Handles enhanced code quality validation for Pine Script v6:
 * - PSV6-QUALITY-COMPLEXITY: Cyclomatic complexity
 * - PSV6-QUALITY-DEPTH: Nesting depth warnings
 * - PSV6-QUALITY-LENGTH: Function length suggestions
 */
import { visit } from '../core/ast/traversal';
export class EnhancedQualityValidator {
    constructor() {
        this.name = 'EnhancedQualityValidator';
        this.priority = 60; // Run after other validations
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
    }
    getDependencies() {
        return ['CoreValidator', 'SyntaxValidator'];
    }
    validate(context, config) {
        this.reset();
        this.context = context;
        if (config.ast?.mode === 'disabled') {
            return {
                isValid: true,
                errors: [],
                warnings: [],
                info: [],
                typeMap: new Map(),
                scriptType: context.scriptType ?? null,
            };
        }
        this.astContext = this.getAstContext(config);
        const ast = this.astContext?.ast ?? null;
        if (!ast) {
            return {
                isValid: true,
                errors: [],
                warnings: [],
                info: [],
                typeMap: new Map(),
                scriptType: context.scriptType ?? null,
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
    // ──────────────────────────────────────────────────────────────────────────
    // AST validation
    // ──────────────────────────────────────────────────────────────────────────
    validateWithAst(program) {
        this.validateScriptComplexityAst(program);
        this.validateFunctionMetricsAst(program);
        this.validateNestingDepthAst(program);
    }
    validateScriptComplexityAst(program) {
        const complexity = this.calculateScriptComplexityAst(program);
        if (complexity >= 6) {
            this.addWarning(1, 0, `Script has high cyclomatic complexity (${complexity}). Consider breaking it into smaller functions.`, 'PSV6-QUALITY-COMPLEXITY', 'Refactor script to reduce complexity below 8');
        }
    }
    calculateScriptComplexityAst(program) {
        let complexity = 0;
        visit(program, {
            IfStatement: {
                enter: (path) => {
                    complexity += 1;
                    if (path.node.alternate) {
                        complexity += 1;
                    }
                },
            },
            ForStatement: {
                enter: () => {
                    complexity += 1;
                },
            },
            WhileStatement: {
                enter: () => {
                    complexity += 1;
                },
            },
            SwitchStatement: {
                enter: () => {
                    complexity += 1;
                },
            },
            SwitchCase: {
                enter: (path) => {
                    if (path.node.test) {
                        complexity += 1;
                    }
                },
            },
            ConditionalExpression: {
                enter: () => {
                    complexity += 1;
                },
            },
            BinaryExpression: {
                enter: (binaryPath) => {
                    const operator = binaryPath.node.operator;
                    if (operator === 'and' || operator === 'or') {
                        complexity += 1;
                    }
                },
            },
        });
        return complexity;
    }
    validateFunctionMetricsAst(program) {
        visit(program, {
            FunctionDeclaration: {
                enter: (path) => {
                    const fn = path.node;
                    const anchor = fn.identifier ?? fn;
                    const name = fn.identifier?.name ?? 'anonymous';
                    const complexity = this.calculateFunctionComplexityAst(fn);
                    if (complexity >= 6) {
                        this.addWarning(anchor.loc.start.line, anchor.loc.start.column, `Function '${name}' has high cyclomatic complexity (${complexity}). Consider breaking it into smaller functions.`, 'PSV6-QUALITY-COMPLEXITY', 'Refactor function to reduce complexity below 8');
                    }
                    const length = this.calculateFunctionLengthAst(fn);
                    if (length > 50) {
                        this.addWarning(anchor.loc.start.line, anchor.loc.start.column, `Function '${name}' is very long (${length} lines). Consider breaking it into smaller functions.`, 'PSV6-QUALITY-LENGTH', 'Refactor function to reduce length below 50 lines');
                    }
                },
            },
        });
    }
    calculateFunctionComplexityAst(fn) {
        let complexity = 0;
        visit(fn.body, {
            IfStatement: {
                enter: (path) => {
                    complexity += 1;
                    if (path.node.alternate) {
                        complexity += 1;
                    }
                },
            },
            ForStatement: {
                enter: () => {
                    complexity += 1;
                },
            },
            WhileStatement: {
                enter: () => {
                    complexity += 1;
                },
            },
            SwitchStatement: {
                enter: () => {
                    complexity += 1;
                },
            },
            SwitchCase: {
                enter: (path) => {
                    if (path.node.test) {
                        complexity += 1;
                    }
                },
            },
            ConditionalExpression: {
                enter: () => {
                    complexity += 1;
                },
            },
            BinaryExpression: {
                enter: (binaryPath) => {
                    const operator = binaryPath.node.operator;
                    if (operator === 'and' || operator === 'or') {
                        complexity += 1;
                    }
                },
            },
            FunctionDeclaration: {
                enter: () => 'skip',
            },
        });
        return complexity;
    }
    calculateFunctionLengthAst(fn) {
        const startLine = fn.body.loc.start.line;
        const endLine = fn.body.loc.end.line;
        if (endLine < startLine) {
            return 0;
        }
        return endLine - startLine + 1;
    }
    validateNestingDepthAst(program) {
        const { depth, line, column } = this.calculateMaxNestingDepthAst(program);
        if (depth >= 4) {
            this.addWarning(line, column, `Excessive nesting depth detected (${depth} levels). Consider extracting nested logic into separate functions.`, 'PSV6-QUALITY-DEPTH', 'Refactor nested code to reduce depth below 3 levels');
        }
    }
    calculateMaxNestingDepthAst(program) {
        let maxDepth = 0;
        let line = 1;
        let column = 0;
        const updateDepth = (depth, node) => {
            if (depth > maxDepth) {
                maxDepth = depth;
                line = node.loc.start.line;
                column = node.loc.start.column;
            }
        };
        const traverseBlock = (block, depth) => {
            if (!block) {
                return;
            }
            updateDepth(depth, block);
            for (const statement of block.body) {
                traverseStatement(statement, depth);
            }
        };
        const traverseStatement = (statement, depth) => {
            if (!statement) {
                return;
            }
            updateDepth(depth, statement);
            switch (statement.kind) {
                case 'BlockStatement': {
                    traverseBlock(statement, depth);
                    break;
                }
                case 'IfStatement': {
                    traverseStatement(statement.consequent, depth + 1);
                    if (statement.alternate) {
                        if (statement.alternate.kind === 'IfStatement') {
                            traverseStatement(statement.alternate, depth);
                        }
                        else {
                            traverseStatement(statement.alternate, depth + 1);
                        }
                    }
                    break;
                }
                case 'ForStatement': {
                    traverseBlock(statement.body, depth + 1);
                    break;
                }
                case 'WhileStatement': {
                    traverseBlock(statement.body, depth + 1);
                    break;
                }
                case 'SwitchStatement': {
                    for (const caseNode of statement.cases) {
                        const caseDepth = depth + 1;
                        updateDepth(caseDepth, caseNode);
                        for (const consequent of caseNode.consequent) {
                            traverseStatement(consequent, caseDepth + 1);
                        }
                    }
                    break;
                }
                case 'FunctionDeclaration': {
                    traverseBlock(statement.body, depth + 1);
                    break;
                }
                default:
                    break;
            }
        };
        for (const statement of program.body) {
            traverseStatement(statement, 0);
        }
        return { depth: maxDepth, line, column };
    }
    // ──────────────────────────────────────────────────────────────────────────
    // Shared helpers
    // ──────────────────────────────────────────────────────────────────────────
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
    }
    addWarning(line, column, message, code, suggestion) {
        this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
    }
    getAstContext(config) {
        if (config.ast && config.ast.mode === 'disabled') {
            return null;
        }
        if (!isAstValidationContext(this.context) || !this.context.ast) {
            return null;
        }
        return this.context;
    }
}
function isAstValidationContext(context) {
    return 'ast' in context;
}
