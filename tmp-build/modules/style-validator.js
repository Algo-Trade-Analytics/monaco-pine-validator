/**
 * Code style and quality validation module for Pine Script v6
 * Handles naming conventions, magic numbers, complexity analysis, and code organization
 */
import { visit } from '../core/ast/traversal';
export class StyleValidator {
    constructor() {
        this.name = 'StyleValidator';
        this.errors = [];
        this.warnings = [];
        this.info = [];
    }
    getDependencies() {
        return ['SyntaxValidator'];
    }
    validate(context, config) {
        this.reset();
        this.context = context;
        const astContext = this.getAstContext(config);
        const program = astContext?.ast ?? null;
        if (!program) {
            return {
                isValid: true,
                errors: this.errors,
                warnings: this.warnings,
                info: this.info,
                typeMap: context.typeMap,
                scriptType: context.scriptType,
            };
        }
        this.runAstAnalysis(program);
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap: context.typeMap,
            scriptType: context.scriptType,
        };
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
    }
    runAstAnalysis(program) {
        this.analyzeVariableNamingAst(program);
        this.analyzeMagicNumbersAst(program);
        this.analyzeFunctionComplexityAst(program);
        this.analyzeCodeOrganizationAst(program);
    }
    analyzeVariableNamingAst(program) {
        const poorNames = new Map();
        visit(program, {
            VariableDeclaration: {
                enter: (path) => {
                    const identifier = path.node.identifier;
                    this.recordPoorVariableName(identifier, poorNames);
                },
            },
            AssignmentStatement: {
                enter: (path) => {
                    const identifier = this.extractIdentifier(path.node.left);
                    if (identifier) {
                        this.recordPoorVariableName(identifier, poorNames);
                    }
                },
            },
        });
        if (poorNames.size > 0) {
            const names = Array.from(poorNames.keys());
            const preview = names.slice(0, 5).join(', ');
            const suffix = names.length > 5 ? '...' : '';
            const firstLocation = poorNames.get(names[0]);
            this.addInfo(firstLocation.line, firstLocation.column, `Poor variable naming detected: ${preview}${suffix}`, 'PSV6-STYLE-NAMING', 'Use descriptive variable names that clearly indicate their purpose (e.g., sma_20 instead of x).');
        }
    }
    recordPoorVariableName(identifier, store) {
        const name = identifier.name;
        if (!this.isPoorVariableName(name)) {
            return;
        }
        if (!store.has(name)) {
            store.set(name, { line: identifier.loc.start.line, column: identifier.loc.start.column });
        }
    }
    extractIdentifier(expression) {
        if (!expression) {
            return null;
        }
        if (expression.kind === 'Identifier') {
            return expression;
        }
        return null;
    }
    analyzeMagicNumbersAst(program) {
        const numbers = [];
        visit(program, {
            NumberLiteral: {
                enter: (path) => {
                    const record = this.resolveNumericLiteral(path);
                    if (!record) {
                        return;
                    }
                    if (!this.isMagicNumberValue(record.value)) {
                        return;
                    }
                    numbers.push({ raw: record.raw, line: record.line, column: record.column });
                },
            },
        });
        if (numbers.length > 0) {
            const uniqueValues = [...new Set(numbers.map((entry) => entry.raw))];
            const preview = uniqueValues.slice(0, 3).join(', ');
            const suffix = uniqueValues.length > 3 ? '...' : '';
            const location = numbers[0];
            this.addInfo(location.line, location.column, `Magic numbers detected: ${preview}${suffix}`, 'PSV6-STYLE-MAGIC', 'Consider defining named constants for magic numbers to improve readability and maintainability.');
        }
    }
    resolveNumericLiteral(path) {
        const { node } = path;
        let value = node.value;
        let raw = node.raw;
        let line = node.loc.start.line;
        let column = node.loc.start.column;
        const parent = path.parent;
        if (parent?.node.kind === 'UnaryExpression') {
            const unary = parent.node;
            if (unary.operator === '-') {
                value = -value;
                raw = `-${raw}`;
                line = unary.loc.start.line;
                column = unary.loc.start.column;
            }
        }
        return { value, raw, line, column };
    }
    analyzeFunctionComplexityAst(program) {
        visit(program, {
            FunctionDeclaration: {
                enter: (path) => {
                    const fn = path.node;
                    const complexity = this.calculateFunctionComplexityAst(fn);
                    const name = fn.identifier?.name ?? 'anonymous function';
                    const location = fn.identifier ?? fn;
                    if (complexity > 5) {
                        this.addWarning(location.loc.start.line, location.loc.start.column, `Function '${name}' has high complexity (${complexity} conditions).`, 'PSV6-STYLE-COMPLEXITY', 'Consider breaking down complex functions into smaller, more focused functions.');
                    }
                    const length = fn.body.loc.end.line - fn.body.loc.start.line + 1;
                    if (length > 20) {
                        this.addInfo(location.loc.start.line, location.loc.start.column, `Function '${name}' is quite long (${length} lines).`, 'PSV6-STYLE-FUNCTION-LENGTH', 'Consider breaking long functions into smaller, more manageable pieces.');
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
    analyzeCodeOrganizationAst(program) {
        let taCount = 0;
        let plotCount = 0;
        let inputCount = 0;
        const operations = [];
        let firstInputLine = null;
        let firstCalculationLine = null;
        for (const statement of program.body) {
            const operation = this.getOperationTypeFromStatement(statement);
            const containsTa = this.statementContainsOperation(statement, 'calculation');
            const containsPlot = this.statementContainsOperation(statement, 'plot');
            const containsInput = this.statementContainsOperation(statement, 'input');
            if (containsTa) {
                taCount += 1;
            }
            if (containsPlot) {
                plotCount += 1;
            }
            if (containsInput) {
                inputCount += 1;
            }
            if (containsInput && firstInputLine === null) {
                firstInputLine = statement.loc.start.line;
            }
            if ((containsTa || this.isCalculationDeclaration(statement)) && firstCalculationLine === null) {
                firstCalculationLine = statement.loc.start.line;
            }
            if (operation !== 'other') {
                operations.push({ type: operation, line: statement.loc.start.line, column: statement.loc.start.column });
            }
        }
        if (taCount >= 3 && plotCount >= 1) {
            const anchor = operations.find((entry) => entry.type === 'calculation') ?? operations[0];
            const line = anchor?.line ?? 1;
            const column = anchor?.column ?? 1;
            this.addInfo(line, column, 'Consider organizing code into logical sections: inputs, calculations, and plots.', 'PSV6-STYLE-ORGANIZATION', 'Group related operations together: inputs at the top, calculations in the middle, plots at the bottom.');
        }
        if (this.hasMixedSections(operations)) {
            const anchor = operations[1] ?? operations[0];
            const line = anchor?.line ?? 1;
            const column = anchor?.column ?? 1;
            this.addInfo(line, column, 'Code sections appear mixed. Consider grouping related operations.', 'PSV6-STYLE-MIXED-SECTIONS', 'Organize code into clear sections: inputs, variables, calculations, conditions, and outputs.');
        }
        if (firstInputLine !== null && firstCalculationLine !== null && firstInputLine > firstCalculationLine) {
            this.addWarning(firstInputLine, 1, 'Inputs should be declared before calculations.', 'PSV6-STYLE-INPUT-PLACEMENT', 'Move input declarations to the top of the script, before any calculations.');
        }
    }
    getOperationTypeFromStatement(statement) {
        const containsInput = this.statementContainsOperation(statement, 'input');
        if (containsInput) {
            return 'input';
        }
        if (this.statementContainsOperation(statement, 'calculation')) {
            return 'calculation';
        }
        if (this.statementContainsOperation(statement, 'plot')) {
            return 'plot';
        }
        if (this.statementContainsOperation(statement, 'strategy')) {
            return 'strategy';
        }
        if (this.isCalculationDeclaration(statement)) {
            return 'calculation';
        }
        return 'other';
    }
    isCalculationDeclaration(statement) {
        return statement.kind === 'VariableDeclaration' &&
            (statement.declarationKind === 'var' || statement.declarationKind === 'varip' || statement.declarationKind === 'const');
    }
    hasMixedSections(operations) {
        if (operations.length < 3) {
            return false;
        }
        for (let index = 1; index < operations.length - 1; index++) {
            const prev = operations[index - 1];
            const current = operations[index];
            const next = operations[index + 1];
            if (prev.type !== 'other' &&
                next.type !== 'other' &&
                current.type !== 'other' &&
                current.type !== prev.type &&
                current.type !== next.type) {
                return true;
            }
        }
        return false;
    }
    statementContainsOperation(statement, kind) {
        if (statement.kind === 'ExpressionStatement') {
            return this.expressionContainsOperation(statement.expression, kind);
        }
        if (statement.kind === 'VariableDeclaration') {
            const declaration = statement;
            if (declaration.initializer && this.expressionContainsOperation(declaration.initializer, kind)) {
                return true;
            }
            if (kind === 'calculation') {
                return this.isCalculationDeclaration(declaration);
            }
        }
        if (statement.kind === 'AssignmentStatement') {
            const assignment = statement;
            return this.expressionContainsOperation(assignment.right ?? assignment.left, kind);
        }
        return false;
    }
    expressionContainsOperation(expression, kind) {
        if (!expression) {
            return false;
        }
        if (expression.kind === 'CallExpression') {
            if (this.getOperationFromCall(expression) === kind) {
                return true;
            }
            if (this.expressionContainsOperation(expression.callee, kind)) {
                return true;
            }
            return expression.args.some((arg) => this.expressionContainsOperation(arg.value, kind));
        }
        if (expression.kind === 'MemberExpression') {
            const member = expression;
            if (kind === 'strategy' && this.isIdentifierWithName(member.object, 'strategy')) {
                return true;
            }
            return this.expressionContainsOperation(member.object, kind);
        }
        if (expression.kind === 'BinaryExpression') {
            const binary = expression;
            return (this.expressionContainsOperation(binary.left, kind) ||
                this.expressionContainsOperation(binary.right, kind));
        }
        if (expression.kind === 'UnaryExpression') {
            const unary = expression;
            return this.expressionContainsOperation(unary.argument, kind);
        }
        if (expression.kind === 'ConditionalExpression') {
            const ternary = expression;
            return (this.expressionContainsOperation(ternary.test, kind) ||
                this.expressionContainsOperation(ternary.consequent, kind) ||
                this.expressionContainsOperation(ternary.alternate, kind));
        }
        if (expression.kind === 'TupleExpression') {
            return expression.elements.some((element) => this.expressionContainsOperation(element ?? null, kind));
        }
        if (expression.kind === 'ArrayLiteral') {
            return expression.elements.some((element) => this.expressionContainsOperation(element ?? null, kind));
        }
        if (expression.kind === 'IndexExpression') {
            return this.expressionContainsOperation(expression.object, kind) ||
                this.expressionContainsOperation(expression.index, kind);
        }
        return false;
    }
    getOperationFromCall(call) {
        const callee = call.callee;
        if (callee.kind === 'Identifier') {
            if (callee.name === 'plot') {
                return 'plot';
            }
            if (callee.name.startsWith('plot')) {
                return 'plot';
            }
        }
        if (callee.kind === 'MemberExpression') {
            const member = callee;
            if (this.isIdentifierWithName(member.object, 'ta')) {
                return 'calculation';
            }
            if (this.isIdentifierWithName(member.object, 'input')) {
                return 'input';
            }
            if (this.isIdentifierWithName(member.object, 'plot')) {
                return 'plot';
            }
            if (this.isIdentifierWithName(member.object, 'strategy')) {
                return 'strategy';
            }
        }
        return null;
    }
    isIdentifierWithName(expression, name) {
        return expression.kind === 'Identifier' && expression.name === name;
    }
    isPoorVariableName(name) {
        if (name.length === 1 && !['i', 'j', 'k', 'x', 'y', 'z'].includes(name)) {
            return true;
        }
        if (name.length <= 2 && !['pi', 'na', 'hl2', 'hlc3', 'ohlc4'].includes(name)) {
            return true;
        }
        const poorNames = ['temp', 'tmp', 'val', 'value', 'data', 'result', 'res', 'var', 'variable'];
        return poorNames.includes(name.toLowerCase());
    }
    isMagicNumberValue(value) {
        const magnitude = Math.abs(value);
        const commonValues = [0, 1, 2, 3, 4, 5, 10, 100, 1000, 10000];
        if (commonValues.includes(magnitude)) {
            return false;
        }
        return magnitude >= 20;
    }
    addInfo(line, column, message, code, suggestion) {
        this.info.push({ line, column, message, severity: 'info', code, suggestion });
    }
    addWarning(line, column, message, code, suggestion) {
        this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
    }
    addError(line, column, message, code, suggestion) {
        this.errors.push({ line, column, message, severity: 'error', code, suggestion });
    }
    getAstContext(config) {
        if (!config.ast || config.ast.mode === 'disabled') {
            return null;
        }
        return 'ast' in this.context ? this.context : null;
    }
}
