import { NS_MEMBERS, BUILTIN_FUNCTIONS_V6_RULES } from '../core/constants';
import { visit } from '../core/ast/traversal';
import { getNodeSource } from '../core/ast/source-utils';
export class MathFunctionsValidator {
    constructor() {
        this.name = 'MathFunctionsValidator';
        this.priority = 83; // High priority - Math functions are core Pine Script functionality, must run before FunctionValidator
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.mathFunctionCalls = new Map();
        this.mathFunctionCount = 0;
        this.complexMathExpressions = 0;
        this.repeatedCallCounts = new Map();
        this.astLineCallCounts = new Map();
    }
    getDependencies() {
        return ['TypeValidator', 'ScopeValidator'];
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
        this.collectMathDataAst(ast);
        this.validateMathPerformanceAst();
        this.validateMathBestPractices();
        const typeMap = new Map();
        for (const [funcName, funcInfo] of this.mathFunctionCalls) {
            typeMap.set(funcName, {
                type: funcInfo.returnType,
                isConst: false,
                isSeries: funcInfo.returnType === 'series',
                parameters: funcInfo.parameters
            });
        }
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap,
            scriptType: null
        };
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.mathFunctionCalls.clear();
        this.mathFunctionCount = 0;
        this.complexMathExpressions = 0;
        this.repeatedCallCounts.clear();
        this.astLineCallCounts.clear();
    }
    collectMathDataAst(program) {
        const loopStack = [];
        this.astLineCallCounts.clear();
        visit(program, {
            ForStatement: {
                enter: () => {
                    loopStack.push('for');
                },
                exit: () => {
                    loopStack.pop();
                },
            },
            WhileStatement: {
                enter: () => {
                    loopStack.push('while');
                },
                exit: () => {
                    loopStack.pop();
                },
            },
            CallExpression: {
                enter: (path) => {
                    this.processAstMathCall(path, loopStack.length > 0);
                },
            },
        });
    }
    processAstMathCall(path, inLoop) {
        const node = path.node;
        const qualifiedName = this.getExpressionQualifiedName(node.callee);
        if (!qualifiedName || !qualifiedName.startsWith('math.')) {
            return;
        }
        const memberName = qualifiedName.slice('math.'.length);
        if (!NS_MEMBERS.math || !NS_MEMBERS.math.has(memberName)) {
            this.addError(node.loc.start.line, node.loc.start.column, `PSV6-MATH-FUNCTION-UNKNOWN: Unknown Math function: ${qualifiedName}`, `Math function '${qualifiedName}' is not recognized. Check spelling and ensure it's a valid Pine Script v6 Math function.`);
            return;
        }
        this.mathFunctionCount++;
        const parameters = node.args.map((argument) => this.argumentToString(argument));
        const argumentNodes = node.args.map((argument) => argument.value);
        const returnType = this.getMathReturnType(qualifiedName);
        const isComplex = this.isComplexMathFunction(qualifiedName, parameters, argumentNodes);
        if (isComplex) {
            this.complexMathExpressions++;
        }
        const info = {
            name: qualifiedName,
            parameters,
            returnType,
            line: node.loc.start.line,
            column: node.loc.start.column,
            isComplex,
            argumentNodes,
            node,
            inLoop,
        };
        this.recordMathFunctionCall(info);
        this.trackRepeatedMathCalls(qualifiedName, parameters, node.loc.start.line, node.loc.start.column);
        const lineCount = (this.astLineCallCounts.get(node.loc.start.line) || 0) + 1;
        this.astLineCallCounts.set(node.loc.start.line, lineCount);
        if (lineCount > 1) {
            this.addWarning(node.loc.start.line, 1, 'PSV6-MATH-PERF-NESTED', 'Multiple Math operations on one line');
        }
        if (inLoop) {
            this.addWarning(node.loc.start.line, node.loc.start.column, 'PSV6-MATH-PERF-LOOP', 'Math operation in loop');
        }
        const nestedCalls = this.countNestedMathCalls(argumentNodes);
        if (nestedCalls > 2) {
            this.addWarning(node.loc.start.line, 1, 'PSV6-MATH-COMPLEXITY', 'Complex nested Math function calls detected. Consider breaking into separate variables for better performance.');
        }
        this.validateMathParameterTypes(qualifiedName, parameters, node.loc.start.line, node.loc.start.column, argumentNodes);
    }
    recordMathFunctionCall(info) {
        this.mathFunctionCalls.set(info.name, { ...info });
    }
    trackRepeatedMathCalls(functionName, parameters, line, column) {
        const signature = `${functionName}(${parameters.join(',')})`;
        const count = (this.repeatedCallCounts.get(signature) || 0) + 1;
        this.repeatedCallCounts.set(signature, count);
        if (count > 1) {
            this.addInfo(line, column, 'PSV6-MATH-CACHE-SUGGESTION', 'Consider caching repeated Math calculations to improve performance.');
        }
    }
    validateMathPerformanceAst() {
        if (this.mathFunctionCount > 3) {
            this.addWarning(0, 0, 'PSV6-MATH-PERF-MANY', `Too many Math function calls (${this.mathFunctionCount}). Consider optimizing for better performance.`);
        }
        if (this.complexMathExpressions > 1) {
            this.addWarning(0, 0, 'PSV6-MATH-PERF-NESTED', `Too many complex Math expressions (${this.complexMathExpressions}). Consider simplifying for better performance.`);
        }
    }
    validateMathParameterTypes(functionName, parameters, lineNumber, column, argumentNodes) {
        const functionRules = BUILTIN_FUNCTIONS_V6_RULES[functionName];
        if (!functionRules || !functionRules.parameters) {
            return; // No specific rules defined
        }
        const expectedParams = functionRules.parameters;
        // Check parameter count - be more lenient
        const requiredParams = expectedParams.filter((p) => p.required).length;
        if (parameters.length < requiredParams) {
            this.addError(lineNumber, column, 'PSV6-MATH-FUNCTION-PARAM', `Math function '${functionName}' requires at least ${requiredParams} parameters, got ${parameters.length}`);
        }
        // Check parameter types (basic validation) - only check required parameters
        parameters.forEach((param, index) => {
            if (index < expectedParams.length) {
                const expectedParam = expectedParams[index];
                const node = argumentNodes?.[index];
                if (expectedParam.required && !this.isValidMathParameter(param, expectedParam.type, node)) {
                    // Only error if it's clearly wrong (like passing a string to a numeric parameter)
                    if (expectedParam.type === 'float' && this.inferParameterType(param, node) === 'string') {
                        this.addError(lineNumber, column, 'PSV6-MATH-FUNCTION-PARAM', `Parameter ${index + 1} of '${functionName}' should be ${expectedParam.type}, got ${this.inferParameterType(param)}`);
                    }
                }
            }
        });
    }
    validateMathBestPractices() {
        // Check for reasonable parameter ranges
        for (const [funcName, funcInfo] of this.mathFunctionCalls) {
            this.checkMathParameterRanges(funcName, funcInfo);
        }
        // Check for Math function combinations
        this.checkMathCombinations();
    }
    checkMathParameterRanges(funcName, funcInfo) {
        // Check for extreme parameter values
        funcInfo.parameters.forEach((param, index) => {
            const argNode = funcInfo.argumentNodes?.[index];
            const numValue = this.extractNumericValue(param, argNode);
            if (numValue !== null) {
                // Check for extreme power parameters
                if (funcName.includes('pow') && index === 1) {
                    if (numValue > 10) {
                        this.addInfo(funcInfo.line, funcInfo.column, 'PSV6-MATH-PARAM-SUGGESTION', `Large power parameter (${numValue}) for '${funcName}'. Consider if this is necessary for your use case.`);
                    }
                }
                // Check for extreme period parameters
                if (funcName.includes('sum') || funcName.includes('avg') || funcName.includes('median') || funcName.includes('mode')) {
                    if (numValue > 500) {
                        this.addInfo(funcInfo.line, funcInfo.column, 'PSV6-MATH-PARAM-SUGGESTION', `Large period parameter (${numValue}) for '${funcName}'. Consider if this is necessary for your use case.`);
                    }
                }
            }
        });
    }
    checkMathCombinations() {
        const functionNames = Array.from(this.mathFunctionCalls.keys());
        // Check for good Math combinations
        const hasTrigonometric = functionNames.some(f => ['math.sin', 'math.cos', 'math.tan'].includes(f));
        const hasExponential = functionNames.some(f => ['math.pow', 'math.sqrt', 'math.exp', 'math.log'].includes(f));
        const hasStatistical = functionNames.some(f => ['math.sum', 'math.avg'].includes(f));
        if (hasTrigonometric && hasExponential) {
            this.addInfo(0, 0, 'PSV6-MATH-COMBINATION-SUGGESTION', 'Good combination of trigonometric and exponential functions detected. Consider using math.pow instead of manual multiplication.');
        }
        if (hasStatistical && hasExponential) {
            this.addInfo(0, 0, 'PSV6-MATH-COMBINATION-SUGGESTION', 'Good combination of statistical and exponential functions detected. Consider using math.sqrt for standard deviation calculations.');
        }
    }
    countNestedMathCalls(expressions) {
        let count = 0;
        const stack = [...expressions];
        while (stack.length) {
            const current = stack.pop();
            if (!current) {
                continue;
            }
            if (current.kind === 'CallExpression') {
                const call = current;
                const name = this.getExpressionQualifiedName(call.callee);
                if (name?.startsWith('math.')) {
                    count++;
                }
                for (const argument of call.args) {
                    stack.push(argument.value);
                }
                continue;
            }
            for (const child of this.getExpressionChildren(current)) {
                stack.push(child);
            }
        }
        return count;
    }
    getExpressionChildren(expression) {
        switch (expression.kind) {
            case 'BinaryExpression':
                return [expression.left, expression.right];
            case 'UnaryExpression':
                return [expression.argument];
            case 'ConditionalExpression': {
                const conditional = expression;
                return [conditional.test, conditional.consequent, conditional.alternate];
            }
            case 'MemberExpression':
                return [expression.object];
            case 'IndexExpression': {
                const index = expression;
                return [index.object, index.index];
            }
            case 'TupleExpression':
                return expression.elements.filter((element) => element !== null);
            case 'ArrayLiteral':
                return expression.elements.filter((element) => element !== null);
            case 'MatrixLiteral':
                return expression.rows.flat();
            default:
                return [];
        }
    }
    argumentToString(argument) {
        const valueText = getNodeSource(this.context, argument.value).trim();
        if (argument.name) {
            return `${argument.name.name}=${valueText}`;
        }
        return valueText;
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
    getAstContext(config) {
        if (config.ast && config.ast.mode === 'disabled') {
            return null;
        }
        if (!isAstValidationContext(this.context) || !this.context.ast) {
            return null;
        }
        return this.context;
    }
    extractNumericValue(param, node) {
        if (node) {
            if (node.kind === 'NumberLiteral') {
                return node.value;
            }
            if (node.kind === 'UnaryExpression') {
                const unary = node;
                const value = this.extractNumericValue(getNodeSource(this.context, unary.argument), unary.argument);
                if (value === null) {
                    return null;
                }
                return unary.operator === '-' ? -value : value;
            }
        }
        const trimmed = param.trim();
        if (!trimmed) {
            return null;
        }
        const match = trimmed.match(/^[+\-]?\d+(\.\d+)?$/);
        return match ? parseFloat(trimmed) : null;
    }
    getMathReturnType(functionName) {
        // Math functions typically return numeric values
        // Boolean functions (if any)
        const booleanFunctions = [
            'math.isnan', 'math.isinf', 'math.isfinite'
        ];
        if (booleanFunctions.includes(functionName)) {
            return 'bool';
        }
        // Default to series for most Math functions
        return 'series';
    }
    isComplexMathFunction(functionName, parameters, _argumentNodes) {
        // Functions with many parameters are considered complex
        if (parameters.length > 2)
            return true;
        // Specific complex functions
        const complexFunctions = [
            'math.pow', 'math.sum', 'math.avg'
        ];
        return complexFunctions.includes(functionName);
    }
    isValidMathParameter(param, expectedType, node) {
        const actualType = this.inferParameterType(param, node);
        // Basic type checking - Pine Script allows series qualifier for most parameters
        if (expectedType === 'float' && (actualType === 'float' || actualType === 'int' || actualType === 'series'))
            return true;
        if (expectedType === 'int' && (actualType === 'int' || actualType === 'series'))
            return true;
        if (expectedType === 'bool' && actualType === 'bool')
            return true;
        if (expectedType === 'string' && (actualType === 'string' || actualType === 'series'))
            return true;
        if (expectedType === 'series' && actualType === 'series')
            return true;
        // Special case: series variables like close, high, low are valid for float parameters
        const seriesVars = ['open', 'high', 'low', 'close', 'volume', 'hlc3', 'ohlc4', 'hl2'];
        if (expectedType === 'float' && seriesVars.includes(param))
            return true;
        return false;
    }
    inferParameterType(param, node) {
        if (node) {
            if (node.kind === 'NumberLiteral') {
                const value = node.value;
                return Number.isInteger(value) ? 'int' : 'float';
            }
            if (node.kind === 'UnaryExpression') {
                const unary = node;
                return this.inferParameterType(getNodeSource(this.context, unary.argument), unary.argument);
            }
            if (node.kind === 'BooleanLiteral') {
                return 'bool';
            }
            if (node.kind === 'StringLiteral') {
                return 'string';
            }
            if (node.kind === 'CallExpression') {
                const call = node;
                const name = this.getExpressionQualifiedName(call.callee);
                if (name?.startsWith('math.')) {
                    return 'series';
                }
            }
            if (node.kind === 'Identifier') {
                const identifier = node;
                const typeInfo = this.context.typeMap.get(identifier.name);
                if (typeInfo?.type) {
                    if (typeInfo.type === 'series' || typeInfo.type.startsWith('series')) {
                        return 'series';
                    }
                    return typeInfo.type;
                }
            }
            if (node.kind === 'MemberExpression') {
                const memberName = this.getExpressionQualifiedName(node);
                if (memberName?.includes('math.')) {
                    return 'series';
                }
            }
        }
        // Remove whitespace
        param = param.trim();
        // Check for numeric literals
        if (/^-?\d+\.?\d*$/.test(param)) {
            return param.includes('.') ? 'float' : 'int';
        }
        // Check for boolean literals
        if (param === 'true' || param === 'false') {
            return 'bool';
        }
        // Check for string literals
        if ((param.startsWith('"') && param.endsWith('"')) || (param.startsWith("'") && param.endsWith("'"))) {
            return 'string';
        }
        // Check for built-in variables (series)
        const seriesVars = ['open', 'high', 'low', 'close', 'volume', 'hlc3', 'ohlc4', 'hl2'];
        if (seriesVars.includes(param)) {
            return 'series';
        }
        // Check for Math function calls
        if (param.includes('math.')) {
            return 'series';
        }
        // Default to series for variables
        return 'series';
    }
    addError(line, column, code, message) {
        // Only generate errors for clearly invalid cases
        if (this.isClearlyInvalid(message, code)) {
            this.errors.push({
                line,
                column,
                code,
                message,
                severity: 'error'
            });
        }
        else {
            // Generate warnings for ambiguous cases
            this.warnings.push({
                line,
                column,
                code,
                message,
                severity: 'warning'
            });
        }
    }
    addWarning(line, column, code, message) {
        this.warnings.push({
            line,
            column,
            code,
            message,
            severity: 'warning'
        });
    }
    addInfo(line, column, code, message) {
        this.info.push({
            line,
            column,
            code,
            message,
            severity: 'info'
        });
    }
    isClearlyInvalid(message, code) {
        // Only generate errors for clearly invalid cases
        // Parameter type errors are clearly invalid
        if (code === 'PSV6-MATH-FUNCTION-PARAM') {
            return true;
        }
        // Parameter count errors are clearly invalid
        if (code === 'PSV6-MATH-PARAM-COUNT') {
            return true;
        }
        // Invalid math function usage is clearly invalid
        if (code === 'PSV6-MATH-INVALID') {
            return true;
        }
        // For performance and best practice issues, generate warnings
        return false;
    }
}
function isAstValidationContext(context) {
    return context.ast !== undefined;
}
