/**
 * Switch Statement Validation Module for Pine Script v6
 * Handles validation of switch statements, case values, and default clauses
 */
import { visit } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';
import { getSourceLines } from '../core/ast/source-utils';
export class SwitchValidator {
    constructor() {
        this.name = 'SwitchValidator';
        this.priority = 95; // Runs before TypeInferenceValidator to provide switch type information
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
        this.context = context;
        this.astContext = ensureAstContext(context, config);
        const ast = this.astContext?.ast;
        if (!ast) {
            return {
                isValid: true,
                errors: [],
                warnings: [],
                info: [],
                typeMap: new Map(),
                scriptType: context.scriptType,
            };
        }
        this.validateSwitchStatementsAst(ast);
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap: new Map(),
            scriptType: context.scriptType,
        };
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
    }
    addError(line, column, message, code, suggestion) {
        this.errors.push({ line, column, message, severity: 'error', code, suggestion });
    }
    addWarning(line, column, message, code, suggestion) {
        this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
    }
    addInfo(line, column, message, code, suggestion) {
        this.info.push({ line, column, message, severity: 'info', code, suggestion });
    }
    validateSwitchStatementsAst(program) {
        visit(program, {
            SwitchStatement: {
                enter: (path) => {
                    const statement = path.node;
                    this.processAstSwitchStatement(statement);
                },
            },
        });
    }
    processAstSwitchStatement(statement) {
        this.validateSwitchExpressionAst(statement);
        const seenCases = new Map();
        const returnTypes = new Set();
        let hasDefault = false;
        for (const caseNode of statement.cases) {
            if (caseNode.test) {
                this.validateAstCaseValue(caseNode);
                this.detectAstDuplicateCase(caseNode, seenCases);
            }
            else {
                hasDefault = true;
            }
            const typeLabel = this.inferAstCaseReturnType(caseNode);
            if (typeLabel) {
                returnTypes.add(typeLabel);
            }
        }
        if (!hasDefault) {
            const { line, column } = statement.loc.start;
            this.addWarning(line, column, 'Switch statement should include a default clause.', 'PSV6-SWITCH-NO-DEFAULT');
        }
        if (statement.cases.length > 20) {
            const { line, column } = statement.loc.start;
            this.addWarning(line, column, `Switch statement has ${statement.cases.length} cases, consider refactoring.`, 'PSV6-SWITCH-TOO-MANY-CASES');
        }
        if (returnTypes.size > 1) {
            const { line, column } = statement.loc.start;
            this.addError(line, column, 'Switch statement cases must have consistent return types.', 'PSV6-SWITCH-RETURN-TYPE');
        }
        const nestingDepth = this.computeSwitchNestingDepth(statement);
        if (nestingDepth > 2) {
            const { line, column } = statement.loc.start;
            this.addWarning(line, column, `Switch statement has deep nesting (${nestingDepth} levels), consider refactoring.`, 'PSV6-SWITCH-DEEP-NESTING');
        }
        this.validateSwitchStyleAst(statement.cases);
        this.applyResultBindingTypes(statement, returnTypes);
    }
    validateSwitchExpressionAst(statement) {
        const expression = statement.discriminant;
        if (!expression) {
            const { line, column } = statement.loc.start;
            this.addError(line, column, 'Switch statement requires an expression.', 'PSV6-SWITCH-SYNTAX');
            return;
        }
        switch (expression.kind) {
            case 'StringLiteral':
            case 'Identifier':
            case 'MemberExpression':
            case 'CallExpression':
                return;
            case 'NumberLiteral': {
                const { line, column } = expression.loc.start;
                this.addError(line, column, 'Switch expression should be a string, not a number. Use string conversion or string literal.', 'PSV6-SWITCH-TYPE');
                return;
            }
            case 'BooleanLiteral': {
                const { line, column } = expression.loc.start;
                this.addError(line, column, 'Switch expression should be a string, not a boolean. Use string conversion or string literal.', 'PSV6-SWITCH-TYPE');
                return;
            }
            default:
                return;
        }
    }
    validateAstCaseValue(caseNode) {
        const test = caseNode.test;
        if (!test) {
            return;
        }
        const { line, column } = test.loc.start;
        if (test.kind === 'NumberLiteral') {
            this.addError(line, column, 'Case value should be a string, not a number. Use string literal.', 'PSV6-SWITCH-CASE-TYPE');
        }
        else if (test.kind === 'BooleanLiteral') {
            this.addError(line, column, 'Case value should be a string, not a boolean. Use string literal.', 'PSV6-SWITCH-CASE-TYPE');
        }
    }
    detectAstDuplicateCase(caseNode, seen) {
        const test = caseNode.test;
        if (!test) {
            return;
        }
        const key = this.describeCaseTest(test);
        if (!key) {
            return;
        }
        const { line, column } = test.loc.start;
        if (seen.has(key)) {
            this.addError(line, column, `Duplicate case value: ${key}`, 'PSV6-SWITCH-DUPLICATE-CASE');
            return;
        }
        seen.set(key, { line, column });
    }
    describeCaseTest(expression) {
        switch (expression.kind) {
            case 'StringLiteral':
                return `"${expression.value}"`;
            case 'Identifier':
                return expression.name;
            case 'MemberExpression':
                return `${this.describeCaseTest(expression.object)}.${expression.property.name}`;
            case 'NumberLiteral':
                return String(expression.value);
            case 'BooleanLiteral':
                return expression.value ? 'true' : 'false';
            case 'CallExpression':
                return `${this.describeCaseTest(expression.callee)}(...)`;
            case 'IndexExpression':
                return `${this.describeCaseTest(expression.object)}[...]`;
            default:
                return expression.kind;
        }
    }
    inferAstCaseReturnType(caseNode) {
        if (!this.astContext) {
            return null;
        }
        const expression = this.extractCaseExpression(caseNode);
        if (!expression) {
            return 'unknown';
        }
        const metadata = this.astContext.typeEnvironment.nodeTypes.get(expression);
        const described = this.describeTypeMetadata(metadata ?? null);
        return described ?? 'unknown';
    }
    extractCaseExpression(caseNode) {
        if (caseNode.consequent.length === 0) {
            return null;
        }
        const first = caseNode.consequent[0];
        if (first.kind === 'ExpressionStatement') {
            return first.expression;
        }
        if (first.kind === 'AssignmentStatement') {
            return first.right ?? null;
        }
        if (first.kind === 'ReturnStatement') {
            return first.argument ?? null;
        }
        if (first.kind === 'VariableDeclaration') {
            return first.initializer ?? null;
        }
        return null;
    }
    describeTypeMetadata(metadata) {
        if (!metadata) {
            return null;
        }
        return metadata.kind;
    }
    applyResultBindingTypes(statement, returnTypes) {
        if (!statement.resultBinding) {
            return;
        }
        const metadata = this.astContext?.typeEnvironment?.nodeTypes.get(statement);
        let inferred = this.describeTypeMetadata(metadata ?? null);
        if (!inferred || inferred === 'unknown') {
            inferred = returnTypes.values().next().value ?? null;
        }
        if (!inferred || inferred === 'unknown') {
            return;
        }
        this.assignResultBinding(statement.resultBinding, inferred);
    }
    assignResultBinding(binding, typeLabel) {
        if (!binding) {
            return;
        }
        switch (binding.kind) {
            case 'assignment':
            case 'variableDeclaration':
                this.assignTargetType(binding.target, typeLabel);
                break;
            case 'tupleAssignment':
                if (binding.target.kind === 'TupleExpression') {
                    const tuple = binding.target;
                    tuple.elements.forEach((element) => {
                        if (element && element.kind === 'Identifier') {
                            this.assignIdentifierType(element, typeLabel);
                        }
                    });
                }
                else {
                    this.assignTargetType(binding.target, typeLabel);
                }
                break;
            default:
                break;
        }
    }
    assignTargetType(target, typeLabel) {
        if (target.kind === 'Identifier') {
            this.assignIdentifierType(target, typeLabel);
            return;
        }
        const line = target.loc.start.line;
        const column = target.loc.start.column;
        this.updateTypeMap(`__expr_${line}_${column}`, line, column, typeLabel);
    }
    assignIdentifierType(identifier, typeLabel) {
        this.updateTypeMap(identifier.name, identifier.loc.start.line, identifier.loc.start.column, typeLabel);
    }
    updateTypeMap(name, line, column, typeLabel) {
        if (!this.context.typeMap) {
            this.context.typeMap = new Map();
        }
        const existing = this.context.typeMap.get(name);
        const typeInfo = existing ?? {
            type: typeLabel,
            isConst: false,
            isSeries: typeLabel === 'series',
            declaredAt: { line, column },
            usages: [],
        };
        typeInfo.type = typeLabel;
        typeInfo.isConst = typeInfo.isConst ?? false;
        typeInfo.isSeries = typeLabel === 'series' ? true : (typeInfo.isSeries ?? false);
        this.context.typeMap.set(name, typeInfo);
    }
    computeSwitchNestingDepth(statement) {
        let maxDepth = 1;
        const visitSwitch = (node, depth) => {
            if (depth > maxDepth) {
                maxDepth = depth;
            }
            node.cases.forEach((caseNode) => {
                if (caseNode.test) {
                    visitExpression(caseNode.test, depth + 1);
                }
                caseNode.consequent.forEach((stmt) => visitStatementNode(stmt, depth + 1));
            });
        };
        const visitStatementNode = (stmt, depth) => {
            if (!stmt) {
                return;
            }
            switch (stmt.kind) {
                case 'SwitchStatement':
                    visitSwitch(stmt, depth);
                    break;
                case 'ExpressionStatement':
                    visitExpression(stmt.expression, depth);
                    break;
                case 'ReturnStatement':
                    visitExpression(stmt.argument, depth);
                    break;
                case 'AssignmentStatement':
                    visitExpression(stmt.right, depth);
                    break;
                case 'VariableDeclaration':
                    visitExpression(stmt.initializer, depth);
                    break;
                case 'BlockStatement':
                    stmt.body?.forEach((inner) => visitStatementNode(inner, depth));
                    break;
                default:
                    break;
            }
        };
        const visitExpression = (expr, depth) => {
            if (!expr) {
                return;
            }
            if (expr.kind === 'SwitchStatement') {
                visitSwitch(expr, depth);
                return;
            }
            switch (expr.kind) {
                case 'ConditionalExpression': {
                    const conditional = expr;
                    visitExpression(conditional.test, depth);
                    visitExpression(conditional.consequent, depth);
                    visitExpression(conditional.alternate, depth);
                    break;
                }
                case 'BinaryExpression': {
                    const binary = expr;
                    visitExpression(binary.left, depth);
                    visitExpression(binary.right, depth);
                    break;
                }
                case 'UnaryExpression': {
                    const unary = expr;
                    visitExpression(unary.argument, depth);
                    break;
                }
                case 'CallExpression': {
                    const call = expr;
                    visitExpression(call.callee, depth);
                    call.args.forEach((arg) => visitExpression(arg.value, depth));
                    break;
                }
                case 'MemberExpression': {
                    const member = expr;
                    visitExpression(member.object, depth);
                    break;
                }
                case 'TupleExpression': {
                    const tuple = expr;
                    tuple.elements.forEach((element) => visitExpression(element ?? null, depth));
                    break;
                }
                case 'ArrayLiteral': {
                    const arrayLiteral = expr;
                    arrayLiteral.elements.forEach((element) => visitExpression(element ?? null, depth));
                    break;
                }
                default:
                    break;
            }
        };
        visitSwitch(statement, 1);
        return maxDepth;
    }
    validateSwitchStyleAst(cases) {
        if (cases.length === 0) {
            return;
        }
        this.validateCaseFormattingAst(cases);
        if (cases.some((caseNode) => !caseNode.test)) {
            this.validateDefaultClausePlacementAst(cases);
        }
    }
    validateCaseFormattingAst(cases) {
        if (cases.length <= 1) {
            return;
        }
        const sourceLines = getSourceLines(this.context);
        const indentations = cases.map((caseNode) => {
            const line = caseNode.loc.start.line;
            const sourceLine = sourceLines[line - 1] ?? '';
            return sourceLine.length - sourceLine.trimStart().length;
        });
        const [firstIndent, ...rest] = indentations;
        const mismatchIndex = rest.findIndex((indent) => indent !== firstIndent);
        if (mismatchIndex === -1) {
            return;
        }
        const caseNode = cases[mismatchIndex + 1];
        const { line } = caseNode.loc.start;
        this.addInfo(line, 1, 'Switch cases should have consistent indentation', 'PSV6-SWITCH-STYLE-INDENTATION');
    }
    validateDefaultClausePlacementAst(cases) {
        const defaultIndex = cases.findIndex((caseNode) => !caseNode.test);
        if (defaultIndex === -1 || defaultIndex === cases.length - 1) {
            return;
        }
        const defaultCase = cases[defaultIndex];
        const { line, column } = defaultCase.loc.start;
        this.addInfo(line, column, 'Default clause should be placed at the end of switch statement', 'PSV6-SWITCH-STYLE-DEFAULT-PLACEMENT');
    }
}
