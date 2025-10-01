/**
 * Enhanced Boolean Logic Validator Module
 *
 * Handles enhanced boolean logic validation for Pine Script v6:
 * - PSV6-MIG-BOOL: Numeric literal conditions
 * - PSV6-BOOL-AND-ORDER: Expensive calc placed before cheap checks in AND chain
 * - PSV6-BOOL-OR-CONSTANT: Constant false placed before expensive calc in OR chain
 * - PSV6-BOOL-EXPENSIVE-CHAIN: Multiple expensive calcs inside boolean chain
 * - PSV6-FUNCTION-NAMESPACE: Non-boolean identifiers used as conditions
 */
import { EXPENSIVE_CALCULATION_FUNCTIONS } from '../core/constants';
import { visit } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';
export class EnhancedBooleanValidator {
    constructor() {
        this.name = 'EnhancedBooleanValidator';
        this.priority = 75; // Run after basic syntax validation
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
    }
    getDependencies() {
        return ['CoreValidator', 'SyntaxValidator', 'TypeInferenceValidator'];
    }
    validate(context, config) {
        this.reset();
        this.config = config;
        this.astContext = ensureAstContext(context, config);
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
        this.validateWithAst(this.astContext.ast);
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
        visit(program, {
            IfStatement: {
                enter: (path) => {
                    const node = path.node;
                    const test = node.test;
                    this.validateAstNumericLiteralCondition(test);
                    this.validateAstBooleanCondition(test);
                    if (this.config.enablePerformanceAnalysis) {
                        this.validateAstBooleanShortCircuit(test);
                    }
                },
            },
            AssignmentStatement: {
                enter: (path) => {
                    if (!this.config.enablePerformanceAnalysis) {
                        return;
                    }
                    const assignmentRight = path.node.right;
                    if (assignmentRight) {
                        this.validateAstBooleanShortCircuit(assignmentRight);
                    }
                },
            },
            VariableDeclaration: {
                enter: (path) => {
                    if (!this.config.enablePerformanceAnalysis) {
                        return;
                    }
                    const initializer = path.node.initializer;
                    if (initializer) {
                        this.validateAstBooleanShortCircuit(initializer);
                    }
                },
            },
        });
    }
    validateAstNumericLiteralCondition(test) {
        if (!this.isNumericLiteralExpression(test)) {
            return;
        }
        const literalText = this.getExpressionText(test);
        const { line, column } = test.loc.start;
        this.addError(line, column, `Numeric literal '${literalText}' used in if condition. Use boolean expressions instead.`, 'PSV6-MIG-BOOL', `Replace 'if (${literalText})' with 'if (${literalText} != 0)' or a proper boolean expression`);
    }
    validateAstBooleanCondition(test) {
        if (!this.astContext) {
            return;
        }
        if (this.isBooleanishExpression(test)) {
            return;
        }
        const metadata = this.astContext.typeEnvironment.nodeTypes.get(test);
        if (metadata) {
            if (this.isBooleanishMetadata(metadata) || metadata.kind === 'unknown') {
                return;
            }
            this.reportNonBooleanCondition(test);
            return;
        }
        if (test.kind === 'Identifier') {
            const identifier = test;
            const identifierMetadata = this.astContext.typeEnvironment.identifiers.get(identifier.name);
            if (identifierMetadata && !this.isBooleanishMetadata(identifierMetadata) && identifierMetadata.kind !== 'unknown') {
                this.reportNonBooleanCondition(test);
            }
            return;
        }
        if (test.kind === 'MemberExpression') {
            const member = test;
            const root = this.resolveBaseIdentifier(member.object);
            if (!root) {
                return;
            }
            const identifierMetadata = this.astContext.typeEnvironment.identifiers.get(root.name);
            if (identifierMetadata && !this.isBooleanishMetadata(identifierMetadata) && identifierMetadata.kind !== 'unknown') {
                this.reportNonBooleanCondition(test);
            }
        }
    }
    reportNonBooleanCondition(node) {
        const { line, column } = node.loc.start;
        this.addError(line, column, 'Non-boolean condition used in if', 'PSV6-FUNCTION-NAMESPACE');
    }
    validateAstBooleanShortCircuit(test) {
        const chains = this.collectBooleanChains(test);
        if (!chains.length) {
            return;
        }
        const { line, column } = test.loc.start;
        for (const chain of chains) {
            if (chain.operator === 'and') {
                this.evaluateAstAndChain(chain.clauses, line, column);
            }
            else {
                this.evaluateAstOrChain(chain.clauses, line, column);
            }
        }
    }
    collectBooleanChains(expression) {
        const chains = [];
        this.walkBooleanChains(expression, chains);
        return chains;
    }
    walkBooleanChains(expression, chains) {
        if (!expression) {
            return;
        }
        if (expression.kind === 'BinaryExpression') {
            const binary = expression;
            if (binary.operator === 'and' || binary.operator === 'or') {
                const operator = binary.operator;
                const clauses = [];
                this.flattenBooleanChain(binary, operator, clauses);
                if (clauses.length > 1) {
                    chains.push({ operator, clauses });
                }
                clauses.forEach((clause) => this.walkBooleanChains(clause, chains));
                return;
            }
            this.walkBooleanChains(binary.left, chains);
            this.walkBooleanChains(binary.right, chains);
            return;
        }
        if (expression.kind === 'UnaryExpression') {
            const unary = expression;
            this.walkBooleanChains(unary.argument, chains);
            return;
        }
        if (expression.kind === 'ConditionalExpression') {
            const conditional = expression;
            this.walkBooleanChains(conditional.test, chains);
            this.walkBooleanChains(conditional.consequent, chains);
            this.walkBooleanChains(conditional.alternate, chains);
            return;
        }
        if (expression.kind === 'CallExpression') {
            const call = expression;
            this.walkBooleanChains(call.callee, chains);
            call.args.forEach((argument) => this.walkBooleanChains(argument.value, chains));
            return;
        }
        if (expression.kind === 'MemberExpression') {
            const member = expression;
            this.walkBooleanChains(member.object, chains);
            return;
        }
        if (expression.kind === 'TupleExpression') {
            const tuple = expression;
            tuple.elements.forEach((element) => this.walkBooleanChains(element ?? null, chains));
            return;
        }
        if (expression.kind === 'ArrayLiteral') {
            const arrayLiteral = expression;
            arrayLiteral.elements.forEach((element) => this.walkBooleanChains(element ?? null, chains));
        }
    }
    flattenBooleanChain(expression, operator, clauses) {
        if (expression.kind === 'BinaryExpression') {
            const binary = expression;
            if (binary.operator === operator) {
                this.flattenBooleanChain(binary.left, operator, clauses);
                this.flattenBooleanChain(binary.right, operator, clauses);
                return;
            }
        }
        clauses.push(expression);
    }
    evaluateAstAndChain(clauses, line, column) {
        let cheapSeen = false;
        let orderIssue = false;
        let expensiveCount = 0;
        for (const clause of clauses) {
            const isExpensive = this.containsExpensiveCalcAst(clause);
            if (isExpensive) {
                expensiveCount += 1;
                if (!cheapSeen) {
                    orderIssue = true;
                }
            }
            else if (this.isCheapCheckAst(clause)) {
                cheapSeen = true;
            }
        }
        if (orderIssue) {
            this.addWarning(line, column, 'Expensive calculation appears before cheaper conditions in AND chain; reorder checks for better short-circuiting.', 'PSV6-BOOL-AND-ORDER');
        }
        if (expensiveCount > 1) {
            this.addWarning(line, column, 'Boolean chain contains multiple expensive calculations. Consider caching results or restructuring checks.', 'PSV6-BOOL-EXPENSIVE-CHAIN');
        }
    }
    evaluateAstOrChain(clauses, line, column) {
        let constantFalseSeen = false;
        let orderIssue = false;
        let expensiveCount = 0;
        for (const clause of clauses) {
            if (this.isConstantFalseAst(clause)) {
                constantFalseSeen = true;
            }
            const isExpensive = this.containsExpensiveCalcAst(clause);
            if (isExpensive) {
                expensiveCount += 1;
                if (constantFalseSeen) {
                    orderIssue = true;
                }
            }
        }
        if (orderIssue) {
            this.addWarning(line, column, 'Constant false clause precedes expensive calculation in OR chain; move cheap checks after the expensive call.', 'PSV6-BOOL-OR-CONSTANT');
        }
        if (expensiveCount > 1) {
            this.addWarning(line, column, 'Boolean chain contains multiple expensive calculations. Consider caching results or restructuring checks.', 'PSV6-BOOL-EXPENSIVE-CHAIN');
        }
    }
    containsExpensiveCalcAst(expression) {
        return this.expressionSome(expression, (node) => {
            if (node.kind !== 'CallExpression') {
                return false;
            }
            const call = node;
            const calleeName = this.getExpressionText(call.callee);
            if (!calleeName) {
                return false;
            }
            if (EXPENSIVE_CALCULATION_FUNCTIONS.has(calleeName)) {
                return true;
            }
            return /^request\.(security|security_lower_tf|economic|financial|seed)\b/.test(calleeName);
        });
    }
    isCheapCheckAst(expression) {
        if (this.isConstantTrueAst(expression) || this.isConstantFalseAst(expression)) {
            return true;
        }
        if (expression.kind === 'BinaryExpression') {
            const binary = expression;
            if (['==', '!=', '<', '>', '<=', '>='].includes(binary.operator)) {
                return true;
            }
        }
        if (expression.kind === 'MemberExpression') {
            const text = this.getExpressionText(expression);
            if (/^barstate\.(isconfirmed|isfirst|islast|isrealtime|isnew|ishistory|islastconfirmedhistory)\b/.test(text)) {
                return true;
            }
            if (/^strategy\.(position_size|opentrades)\b/.test(text)) {
                return true;
            }
        }
        return !this.containsCallExpressionAst(expression);
    }
    isConstantTrueAst(expression) {
        return expression.kind === 'BooleanLiteral' && expression.value === true;
    }
    isConstantFalseAst(expression) {
        return expression.kind === 'BooleanLiteral' && expression.value === false;
    }
    containsCallExpressionAst(expression) {
        return this.expressionSome(expression, (node) => node.kind === 'CallExpression');
    }
    isBooleanishExpression(expression) {
        if (!this.astContext) {
            return false;
        }
        const metadata = this.astContext.typeEnvironment.nodeTypes.get(expression);
        if (metadata && this.isBooleanishMetadata(metadata)) {
            return true;
        }
        switch (expression.kind) {
            case 'BooleanLiteral':
                return true;
            case 'UnaryExpression': {
                const unary = expression;
                if (['not', '!'].includes(unary.operator)) {
                    return this.isBooleanishExpression(unary.argument);
                }
                return false;
            }
            case 'BinaryExpression': {
                const binary = expression;
                if (['and', 'or'].includes(binary.operator)) {
                    return (this.isBooleanishExpression(binary.left) &&
                        this.isBooleanishExpression(binary.right));
                }
                if (['==', '!=', '<', '>', '<=', '>='].includes(binary.operator)) {
                    return true;
                }
                return false;
            }
            case 'CallExpression': {
                const call = expression;
                const calleeName = this.getExpressionText(call.callee);
                if (/^ta\.(crossover|crossunder|rising|falling|cross)\b/.test(calleeName)) {
                    return true;
                }
                if (/^str\.(contains|startswith|endswith)\b/.test(calleeName)) {
                    return true;
                }
                if (/^array\.get\b/.test(calleeName)) {
                    return true;
                }
                if (/^math\.(sign|round)\b/.test(calleeName)) {
                    return true;
                }
                return false;
            }
            case 'MemberExpression': {
                const text = this.getExpressionText(expression);
                if (/^barstate\.(isconfirmed|isfirst|islast|isrealtime|isnew|ishistory|islastconfirmedhistory)\b/.test(text)) {
                    return true;
                }
                if (/^strategy\.(position_size|opentrades)\b/.test(text)) {
                    return true;
                }
                return false;
            }
            case 'Identifier': {
                const identifier = expression;
                const identifierMetadata = this.astContext.typeEnvironment.identifiers.get(identifier.name);
                return !!identifierMetadata && this.isBooleanishMetadata(identifierMetadata);
            }
            default:
                return false;
        }
    }
    isBooleanishMetadata(metadata) {
        return metadata.kind === 'bool' || metadata.kind === 'series';
    }
    resolveBaseIdentifier(expression) {
        if (expression.kind === 'Identifier') {
            return expression;
        }
        if (expression.kind === 'MemberExpression') {
            const member = expression;
            return this.resolveBaseIdentifier(member.object);
        }
        return null;
    }
    expressionSome(expression, predicate) {
        if (!expression) {
            return false;
        }
        if (predicate(expression)) {
            return true;
        }
        switch (expression.kind) {
            case 'BinaryExpression': {
                const binary = expression;
                return (this.expressionSome(binary.left, predicate) ||
                    this.expressionSome(binary.right, predicate));
            }
            case 'UnaryExpression': {
                const unary = expression;
                return this.expressionSome(unary.argument, predicate);
            }
            case 'CallExpression': {
                const call = expression;
                if (this.expressionSome(call.callee, predicate)) {
                    return true;
                }
                return call.args.some((argument) => this.expressionSome(argument.value, predicate));
            }
            case 'ConditionalExpression': {
                const conditional = expression;
                return (this.expressionSome(conditional.test, predicate) ||
                    this.expressionSome(conditional.consequent, predicate) ||
                    this.expressionSome(conditional.alternate, predicate));
            }
            case 'MemberExpression': {
                const member = expression;
                return this.expressionSome(member.object, predicate);
            }
            case 'TupleExpression': {
                const tuple = expression;
                return tuple.elements.some((element) => this.expressionSome(element ?? null, predicate));
            }
            case 'ArrayLiteral': {
                const arrayLiteral = expression;
                return arrayLiteral.elements.some((element) => this.expressionSome(element ?? null, predicate));
            }
            default:
                return false;
        }
    }
    isNumericLiteralExpression(expression) {
        if (expression.kind === 'NumberLiteral') {
            return true;
        }
        if (expression.kind === 'UnaryExpression') {
            const unary = expression;
            return ['+', '-'].includes(unary.operator) && this.isNumericLiteralExpression(unary.argument);
        }
        return false;
    }
    getExpressionText(expression) {
        switch (expression.kind) {
            case 'Identifier':
                return expression.name;
            case 'NumberLiteral':
                return expression.raw ?? String(expression.value);
            case 'BooleanLiteral':
                return expression.value ? 'true' : 'false';
            case 'StringLiteral':
                return expression.raw ?? JSON.stringify(expression.value);
            case 'NullLiteral':
                return 'na';
            case 'UnaryExpression': {
                const unary = expression;
                return `${unary.operator}${this.getExpressionText(unary.argument)}`;
            }
            case 'BinaryExpression': {
                const binary = expression;
                const left = this.getExpressionText(binary.left);
                const right = this.getExpressionText(binary.right);
                return `${left} ${binary.operator} ${right}`;
            }
            case 'CallExpression': {
                const call = expression;
                const callee = this.getExpressionText(call.callee);
                const args = call.args.map((arg) => this.getExpressionText(arg.value));
                return `${callee}(${args.join(', ')})`;
            }
            case 'MemberExpression': {
                const member = expression;
                const object = this.getExpressionText(member.object);
                return `${object}.${member.property.name}`;
            }
            case 'ConditionalExpression': {
                const conditional = expression;
                return `${this.getExpressionText(conditional.test)} ? ${this.getExpressionText(conditional.consequent)} : ${this.getExpressionText(conditional.alternate)}`;
            }
            case 'TupleExpression': {
                const tuple = expression;
                return `[${tuple.elements.map((element) => (element ? this.getExpressionText(element) : '')).join(', ')}]`;
            }
            case 'ArrayLiteral': {
                const arrayLiteral = expression;
                return `[${arrayLiteral.elements
                    .map((element) => (element ? this.getExpressionText(element) : ''))
                    .join(', ')}]`;
            }
            default:
                return expression.kind;
        }
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
    addError(line, column, message, code, suggestion) {
        this.errors.push({ line, column, message, severity: 'error', code, suggestion });
    }
    addWarning(line, column, message, code, suggestion) {
        this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
    }
}
