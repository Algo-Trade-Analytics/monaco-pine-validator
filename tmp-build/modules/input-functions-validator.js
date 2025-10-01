/**
 * Input Functions Validator
 *
 * Validates Pine Script v6 Input functions and operations:
 * - Input function parameter validation
 * - Input type validation (int, float, bool, string, color, source, timeframe, session, symbol, resolution)
 * - Input parameter validation (minval, maxval, step, options, group, tooltip, inline, confirm)
 * - Input performance analysis
 * - Input best practices suggestions
 *
 * Priority 1.3: CRITICAL GAPS - Input Functions (0% Coverage)
 */
import { findAncestor, visit } from '../core/ast/traversal';
import { getNodeSource } from '../core/ast/source-utils';
const INPUT_RETURN_TYPES = {
    int: { type: 'int' },
    float: { type: 'float' },
    bool: { type: 'bool' },
    string: { type: 'string' },
    color: { type: 'color' },
    source: { type: 'series', isSeries: true },
    timeframe: { type: 'string' },
    session: { type: 'string' },
    symbol: { type: 'string' },
    resolution: { type: 'string' },
};
export class InputFunctionsValidator {
    constructor() {
        this.name = 'InputFunctionsValidator';
        this.priority = 87; // High priority - input functions are essential for Pine Script
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        // Input function tracking
        this.inputFunctionCalls = [];
        this.inputCount = 0;
    }
    getDependencies() {
        return ['TypeValidator', 'FunctionValidator'];
    }
    validate(context, config) {
        this.reset();
        this.context = context;
        this.config = config;
        this.astContext = this.getAstContext(config);
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
        this.collectInputFunctionDataAst(this.astContext.ast);
        // Post-process validations
        this.validateInputPerformance();
        this.validateInputBestPractices();
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
        this.inputFunctionCalls = [];
        this.inputCount = 0;
    }
    addError(line, column, message, code, suggestion) {
        // Only generate errors for clearly invalid cases
        if (this.isClearlyInvalid(message, code)) {
            this.errors.push({ line, column, message, severity: 'error', code, suggestion });
        }
        else {
            // Generate warnings for ambiguous cases
            this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
        }
    }
    addWarning(line, column, message, code, suggestion) {
        this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
    }
    addInfo(line, column, message, code, suggestion) {
        this.info.push({ line, column, message, severity: 'info', code, suggestion });
    }
    isClearlyInvalid(message, code) {
        // Only generate errors for clearly invalid cases
        // Parameter type errors are clearly invalid
        if (code === 'PSV6-FUNCTION-PARAM-TYPE') {
            return true;
        }
        // Parameter count errors are clearly invalid
        if (code === 'PSV6-FUNCTION-PARAM-COUNT') {
            return true;
        }
        // Unknown input function errors are clearly invalid
        if (code === 'PSV6-INPUT-UNKNOWN-FUNCTION') {
            return true;
        }
        // Invalid input function usage is clearly invalid
        if (code === 'PSV6-INPUT-INVALID') {
            return true;
        }
        // Defval type mismatch should be an error
        if (code === 'PSV6-INPUT-DEFVAL-TYPE') {
            return true;
        }
        // For performance and best practice issues, generate warnings
        return false;
    }
    collectInputFunctionDataAst(program) {
        visit(program, {
            CallExpression: {
                enter: (path) => {
                    this.processAstInputCall(path);
                },
            },
        });
    }
    processAstInputCall(path) {
        const node = path.node;
        const qualifiedName = this.getExpressionQualifiedName(node.callee);
        if (!qualifiedName || !qualifiedName.startsWith('input.')) {
            return;
        }
        const functionName = qualifiedName.slice('input.'.length);
        const args = [];
        const parameters = new Map();
        for (const argument of node.args) {
            const valueText = this.getNodeSource(argument.value).trim();
            if (argument.name) {
                parameters.set(argument.name.name, valueText);
            }
            else {
                args.push(valueText);
            }
        }
        const callInfo = {
            name: functionName,
            line: node.loc.start.line,
            column: node.loc.start.column,
            arguments: args,
            parameters,
            assignedName: this.getAssignedIdentifier(path),
        };
        this.recordInputFunctionCall(callInfo);
        this.validateInputFunction(functionName, args, parameters, callInfo.line, callInfo.column);
    }
    validateInputFunction(functionName, args, parameters, lineNum, column) {
        switch (functionName) {
            case 'int':
                this.validateInputInt(args, parameters, lineNum, column);
                break;
            case 'float':
                this.validateInputFloat(args, parameters, lineNum, column);
                break;
            case 'bool':
                this.validateInputBool(args, parameters, lineNum, column);
                break;
            case 'string':
                this.validateInputString(args, parameters, lineNum, column);
                break;
            case 'color':
                this.validateInputColor(args, parameters, lineNum, column);
                break;
            case 'source':
                this.validateInputSource(args, parameters, lineNum, column);
                break;
            case 'timeframe':
                this.validateInputTimeframe(args, parameters, lineNum, column);
                break;
            case 'session':
                this.validateInputSession(args, parameters, lineNum, column);
                break;
            case 'symbol':
                this.validateInputSymbol(args, parameters, lineNum, column);
                break;
            case 'resolution':
                this.validateInputResolution(args, parameters, lineNum, column);
                break;
            default:
                this.addError(lineNum, column, `Unknown input function: input.${functionName}`, 'PSV6-INPUT-UNKNOWN-FUNCTION');
        }
    }
    recordInputFunctionCall(call) {
        this.inputFunctionCalls.push({
            ...call,
            arguments: [...call.arguments],
            parameters: new Map(call.parameters),
        });
        this.registerInputVariableType(call.assignedName, call.name, call.line, call.column);
        this.inputCount++;
    }
    registerInputVariableType(name, functionName, line, column) {
        if (!name) {
            return;
        }
        const returnSpec = INPUT_RETURN_TYPES[functionName];
        if (!returnSpec) {
            return;
        }
        if (!this.context.typeMap) {
            this.context.typeMap = new Map();
        }
        const existing = this.context.typeMap.get(name);
        const typeInfo = existing ?? {
            type: returnSpec.type,
            isConst: false,
            isSeries: Boolean(returnSpec.isSeries),
            declaredAt: { line, column },
            usages: [],
        };
        if (existing) {
            typeInfo.type = returnSpec.type;
            typeInfo.isSeries = Boolean(returnSpec.isSeries);
            typeInfo.declaredAt = typeInfo.declaredAt ?? { line, column };
        }
        this.context.typeMap.set(name, typeInfo);
        this.context.declaredVars?.set?.(name, line);
    }
    validateInputInt(args, parameters, lineNum, column) {
        // input.int() requires at least 1 parameter (default value) or named defval
        if (args.length < 1 && !parameters.has('defval')) {
            this.addError(lineNum, column, 'input.int() requires at least 1 parameter (default value)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate default value
        const hasNamedDef = parameters.has('defval');
        const defArgInt = parameters.get('defval') ?? args[0];
        const defaultValue = this.extractNumericValue(defArgInt ?? '');
        if (!hasNamedDef && defaultValue === null && (defArgInt ?? '').trim() !== 'na') {
            // Only warn; tests expect valid scenarios to remain error-free
            this.addWarning(lineNum, column, 'Default value should be an integer or na', 'PSV6-INPUT-DEFAULT-TYPE');
            // Clearly invalid: string or bool passed as default
            const def = (defArgInt ?? '').trim().toLowerCase();
            if (/^".*"$/.test(def) || def === 'true' || def === 'false') {
                this.addError(lineNum, column, 'Invalid parameter type for input.int default', 'PSV6-FUNCTION-PARAM-TYPE');
            }
        }
        // Validate parameters
        this.validateInputParameters(parameters, lineNum, column, 'int', defArgInt);
    }
    validateInputFloat(args, parameters, lineNum, column) {
        // input.float() requires at least 2 parameters (default value and title) or named defval+title
        if (args.length < 2 && !(parameters.has('defval') && parameters.has('title'))) {
            this.addError(lineNum, column, 'input.float() requires at least 2 parameters (default, title)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate default value
        const hasNamedDefF = parameters.has('defval');
        const defArgFloat = parameters.get('defval') ?? args[0];
        const defaultValue = this.extractNumericValue(defArgFloat ?? '');
        if (!hasNamedDefF && defaultValue === null && (defArgFloat ?? '').trim() !== 'na') {
            this.addWarning(lineNum, column, 'Default value should be a float or na', 'PSV6-INPUT-DEFAULT-TYPE');
            const def = (defArgFloat ?? '').trim().toLowerCase();
            if (/^".*"$/.test(def) || def === 'true' || def === 'false') {
                this.addError(lineNum, column, 'Invalid parameter type for input.float default', 'PSV6-FUNCTION-PARAM-TYPE');
            }
        }
        // Validate parameters
        this.validateInputParameters(parameters, lineNum, column, 'float', defArgFloat);
    }
    validateInputBool(args, parameters, lineNum, column) {
        if (args.length < 2 && !(parameters.has('defval') && parameters.has('title'))) {
            this.addError(lineNum, column, 'input.bool() requires at least 2 parameters (default, title)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate default value
        const hasNamedDefB = parameters.has('defval');
        const defArgBool = (parameters.get('defval') ?? args[0] ?? '').trim().toLowerCase();
        const defaultValue = defArgBool;
        if (!hasNamedDefB && !['true', 'false', 'na'].includes(defaultValue)) {
            this.addWarning(lineNum, column, 'Default value should be true, false, or na', 'PSV6-INPUT-DEFAULT-TYPE');
            // Clearly invalid default type for bool
            if (/^".*"$/.test(defaultValue) || /^[+\-]?\d+(?:\.\d+)?$/.test(defaultValue)) {
                this.addError(lineNum, column, 'Invalid parameter type for input.bool default', 'PSV6-FUNCTION-PARAM-TYPE');
            }
        }
        // Validate parameters
        this.validateInputParameters(parameters, lineNum, column, 'bool', defArgBool);
    }
    validateInputString(args, parameters, lineNum, column) {
        if (args.length < 2 && !(parameters.has('defval') && parameters.has('title'))) {
            this.addError(lineNum, column, 'input.string() requires at least 2 parameters (default, title)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate default value (should be string literal or constant)
        const hasNamedDefS = parameters.has('defval');
        const defArgStr = parameters.get('defval') ?? args[0];
        if (!hasNamedDefS && !this.isStringLike(defArgStr ?? '')) {
            this.addWarning(lineNum, column, 'Default value should be a string literal', 'PSV6-INPUT-DEFAULT-TYPE');
        }
        // Validate parameters
        this.validateInputParameters(parameters, lineNum, column, 'string', defArgStr);
        // Special validation for string inputs
        this.validateStringInputParameters(parameters, lineNum, column);
    }
    validateInputColor(args, parameters, lineNum, column) {
        if (args.length < 2 && !(parameters.has('defval') && parameters.has('title'))) {
            this.addError(lineNum, column, 'input.color() requires at least 2 parameters (default, title)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate default value (should be color expression)
        const hasNamedDefC = parameters.has('defval');
        const defArgColor = (parameters.get('defval') ?? args[0] ?? '').trim();
        if (!hasNamedDefC && !this.isColorExpression(defArgColor)) {
            this.addWarning(lineNum, column, 'Default value should be a color expression', 'PSV6-INPUT-DEFAULT-TYPE');
        }
        // Validate parameters
        this.validateInputParameters(parameters, lineNum, column, 'color', defArgColor);
    }
    validateInputSource(args, parameters, lineNum, column) {
        if (args.length < 2 && !(parameters.has('defval') && parameters.has('title'))) {
            this.addError(lineNum, column, 'input.source() requires at least 2 parameters (default, title)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate default value (should be series)
        const hasNamedDefSrc = parameters.has('defval');
        const defArgSource = (parameters.get('defval') ?? args[0] ?? '').trim();
        if (!hasNamedDefSrc && !this.isSeriesExpression(defArgSource)) {
            this.addWarning(lineNum, column, 'Default value should be a series expression', 'PSV6-INPUT-DEFAULT-TYPE');
        }
        // Validate parameters
        this.validateInputParameters(parameters, lineNum, column, 'source', defArgSource);
    }
    validateInputTimeframe(args, parameters, lineNum, column) {
        if (args.length < 2 && !(parameters.has('defval') && parameters.has('title'))) {
            this.addError(lineNum, column, 'input.timeframe() requires at least 2 parameters (default, title)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate default value (should be timeframe string)
        const defaultValue = args[0];
        if (this.isStringLiteral(defaultValue) && !this.isValidTimeframe(defaultValue)) {
            this.addWarning(lineNum, column, 'Default value should be a valid timeframe string', 'PSV6-INPUT-DEFAULT-TYPE');
        }
        // Validate parameters
        this.validateInputParameters(parameters, lineNum, column, 'timeframe', args[0]);
    }
    validateInputSession(args, parameters, lineNum, column) {
        if (args.length < 2 && !(parameters.has('defval') && parameters.has('title'))) {
            this.addError(lineNum, column, 'input.session() requires at least 2 parameters (default, title)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate default value (should be session string)
        const defaultValue = args[0];
        if (this.isStringLiteral(defaultValue) && !this.isValidSession(defaultValue)) {
            this.addWarning(lineNum, column, 'Default value should be a valid session string', 'PSV6-INPUT-DEFAULT-TYPE');
        }
        // Validate parameters
        this.validateInputParameters(parameters, lineNum, column, 'session', args[0]);
    }
    validateInputSymbol(args, parameters, lineNum, column) {
        if (args.length < 2 && !(parameters.has('defval') && parameters.has('title'))) {
            this.addError(lineNum, column, 'input.symbol() requires at least 2 parameters (default, title)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate default value (should be string literal)
        if (!this.isStringLiteral(args[0])) {
            this.addWarning(lineNum, column, 'Default value should be a string literal', 'PSV6-INPUT-DEFAULT-TYPE');
        }
        // Validate parameters
        this.validateInputParameters(parameters, lineNum, column, 'symbol', args[0]);
    }
    validateInputResolution(args, parameters, lineNum, column) {
        if (args.length < 2 && !(parameters.has('defval') && parameters.has('title'))) {
            this.addError(lineNum, column, 'input.resolution() requires at least 2 parameters (default, title)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate default value (should be string literal)
        if (!this.isStringLiteral(args[0])) {
            this.addWarning(lineNum, column, 'Default value should be a string literal', 'PSV6-INPUT-DEFAULT-TYPE');
        }
        // Validate parameters
        this.validateInputParameters(parameters, lineNum, column, 'resolution', args[0]);
    }
    validateInputParameters(parameters, lineNum, column, inputType, defaultArg) {
        // Resolve defval override for downstream comparisons
        const resolvedDefaultArg = parameters.has('defval') ? parameters.get('defval') : (defaultArg ?? '');
        for (const [paramName, paramValue] of parameters) {
            switch (paramName) {
                case 'defval':
                    this.validateDefvalParameter(paramValue, inputType, lineNum, column);
                    break;
                case 'title':
                    this.validateTitleParameter(paramValue, lineNum, column);
                    break;
                case 'minval':
                    this.validateMinvalParameter(paramValue, inputType, lineNum, column, resolvedDefaultArg);
                    break;
                case 'maxval':
                    this.validateMaxvalParameter(paramValue, inputType, lineNum, column, resolvedDefaultArg);
                    break;
                case 'step':
                    this.validateStepParameter(paramValue, inputType, lineNum, column);
                    break;
                case 'options':
                    this.validateOptionsParameter(paramValue, lineNum, column);
                    break;
                case 'group':
                    this.validateGroupParameter(paramValue, lineNum, column);
                    break;
                case 'tooltip':
                    this.validateTooltipParameter(paramValue, lineNum, column);
                    break;
                case 'inline':
                    this.validateInlineParameter(paramValue, lineNum, column);
                    break;
                case 'confirm':
                    this.validateConfirmParameter(paramValue, lineNum, column);
                    break;
                case 'multiline':
                    this.validateMultilineParameter(paramValue, lineNum, column);
                    break;
                default:
                    this.addWarning(lineNum, column, `Unknown input parameter: ${paramName}`, 'PSV6-INPUT-UNKNOWN-PARAMETER');
            }
        }
    }
    validateDefvalParameter(value, inputType, lineNum, column) {
        const v = value?.trim() ?? '';
        switch (inputType) {
            case 'int': {
                const n = this.extractNumericValue(v);
                if (n === null || !/^[-+]?\d+$/.test(v.replace(/^['"]|['"]$/g, ''))) {
                    this.addError(lineNum, column, 'defval must be an integer for input.int', 'PSV6-INPUT-DEFVAL-TYPE');
                }
                break;
            }
            case 'float': {
                const n = this.extractNumericValue(v);
                if (n === null) {
                    this.addError(lineNum, column, 'defval must be a number for input.float', 'PSV6-INPUT-DEFVAL-TYPE');
                }
                break;
            }
            case 'bool': {
                const b = v.toLowerCase();
                if (!(b === 'true' || b === 'false')) {
                    this.addError(lineNum, column, 'defval must be true/false for input.bool', 'PSV6-INPUT-DEFVAL-TYPE');
                }
                break;
            }
            case 'string': {
                if (!this.isStringLike(v)) {
                    this.addError(lineNum, column, 'defval must be a string literal for input.string', 'PSV6-INPUT-DEFVAL-TYPE');
                }
                break;
            }
            case 'color': {
                if (!this.isColorExpression(v)) {
                    this.addError(lineNum, column, 'defval must be a color expression for input.color', 'PSV6-INPUT-DEFVAL-TYPE');
                }
                break;
            }
            case 'source': {
                if (!this.isSeriesExpression(v)) {
                    this.addError(lineNum, column, 'defval must be a series (e.g., close) for input.source', 'PSV6-INPUT-DEFVAL-TYPE');
                }
                break;
            }
            case 'timeframe':
            case 'session':
            case 'symbol':
            case 'resolution': {
                if (!this.isStringLike(v)) {
                    this.addError(lineNum, column, `defval must be a string literal for input.${inputType}`, 'PSV6-INPUT-DEFVAL-TYPE');
                }
                break;
            }
        }
    }
    validateTitleParameter(value, lineNum, column) {
        if (!this.isStringLike(value)) {
            this.addWarning(lineNum, column, 'title parameter should be a string literal', 'PSV6-INPUT-TITLE-WARNING');
            return;
        }
        const clean = this.extractStringLiteralValue(value);
        if (clean && clean.length > 80) {
            this.addInfo(lineNum, column, 'Input title is long; consider shortening', 'PSV6-INPUT-TITLE-LENGTH');
        }
    }
    validateMinvalParameter(value, inputType, lineNum, column, defaultArg) {
        const numValue = this.extractNumericValue(value);
        if (numValue === null) {
            this.addError(lineNum, column, 'minval parameter should be a numeric value', 'PSV6-INPUT-PARAM-TYPE');
            return;
        }
        // Check for reasonable minval values
        if (numValue < -1000000 || numValue > 1000000) {
            this.addWarning(lineNum, column, 'minval parameter has an extreme value', 'PSV6-INPUT-MINVAL-WARNING');
        }
        // Suggest when minval > default value
        if (defaultArg) {
            const def = this.extractNumericValue(defaultArg);
            if (def !== null && numValue > def) {
                this.addWarning(lineNum, column, 'minval is greater than the default value', 'PSV6-INPUT-MINVAL-WARNING');
            }
        }
    }
    validateMaxvalParameter(value, inputType, lineNum, column, defaultArg) {
        const numValue = this.extractNumericValue(value);
        if (numValue === null) {
            this.addError(lineNum, column, 'maxval parameter should be a numeric value', 'PSV6-INPUT-PARAM-TYPE');
            return;
        }
        // Check for reasonable maxval values
        if (numValue < -1000000 || numValue > 1000000) {
            this.addWarning(lineNum, column, 'maxval parameter has an extreme value', 'PSV6-INPUT-MAXVAL-WARNING');
        }
        // Suggest when maxval < default value
        if (defaultArg) {
            const def = this.extractNumericValue(defaultArg);
            if (def !== null && numValue < def) {
                this.addWarning(lineNum, column, 'maxval is less than the default value', 'PSV6-INPUT-MAXVAL-WARNING');
            }
        }
    }
    validateStepParameter(value, inputType, lineNum, column) {
        const numValue = this.extractNumericValue(value);
        if (numValue === null) {
            this.addError(lineNum, column, 'step parameter should be a numeric value', 'PSV6-INPUT-PARAM-TYPE');
            return;
        }
        if (numValue <= 0) {
            this.addWarning(lineNum, column, 'step parameter should be positive', 'PSV6-INPUT-STEP-WARNING');
        }
        if (numValue < 0.0001) {
            this.addWarning(lineNum, column, 'step parameter is very small', 'PSV6-INPUT-STEP-WARNING');
        }
    }
    validateOptionsParameter(value, lineNum, column) {
        const trimmed = value.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            const inner = trimmed.substring(1, trimmed.length - 1);
            const elements = this.splitTopLevelList(inner);
            const invalid = elements.filter(element => element && !this.isStringLike(element));
            if (invalid.length > 0) {
                this.addWarning(lineNum, column, 'options array should contain string literals or string constants', 'PSV6-INPUT-OPTIONS-WARNING');
            }
            return;
        }
        if (this.isStringLike(trimmed)) {
            const typeInfo = this.context.typeMap.get(trimmed);
            if (typeInfo?.type === 'array') {
                return;
            }
        }
        this.addWarning(lineNum, column, 'options parameter should be an array', 'PSV6-INPUT-OPTIONS-WARNING');
    }
    validateGroupParameter(value, lineNum, column) {
        // Group parameter should be a string literal
        if (!this.isStringLike(value)) {
            this.addWarning(lineNum, column, 'group parameter should be a string literal', 'PSV6-INPUT-GROUP-WARNING');
        }
    }
    validateTooltipParameter(value, lineNum, column) {
        // Tooltip parameter should be a string literal
        if (!this.isStringLike(value)) {
            this.addWarning(lineNum, column, 'tooltip parameter should be a string literal', 'PSV6-INPUT-TOOLTIP-WARNING');
            return;
        }
        const clean = this.extractStringLiteralValue(value);
        if (clean) {
            if (clean.length > 120) {
                this.addInfo(lineNum, column, 'Tooltip seems long; keep it concise for IDE UI', 'PSV6-INPUT-TOOLTIP-LENGTH');
            }
            if (/\n{2,}/.test(clean)) {
                this.addWarning(lineNum, column, 'Tooltip contains multiple newlines; simplify formatting', 'PSV6-INPUT-TOOLTIP-FORMAT');
            }
        }
    }
    validateInlineParameter(value, lineNum, column) {
        // Inline parameter should be a string literal
        if (!this.isStringLike(value)) {
            this.addWarning(lineNum, column, 'inline parameter should be a string literal', 'PSV6-INPUT-INLINE-WARNING');
        }
    }
    validateConfirmParameter(value, lineNum, column) {
        const boolValue = value.trim().toLowerCase();
        if (!['true', 'false'].includes(boolValue)) {
            this.addWarning(lineNum, column, 'confirm parameter should be true or false', 'PSV6-INPUT-CONFIRM-WARNING');
        }
    }
    validateMultilineParameter(value, lineNum, column) {
        const boolValue = value.trim().toLowerCase();
        if (!['true', 'false'].includes(boolValue)) {
            this.addWarning(lineNum, column, 'multiline parameter should be true or false', 'PSV6-INPUT-MULTILINE-WARNING');
        }
    }
    validateStringInputParameters(parameters, lineNum, column) {
        // Validate options parameter for string inputs
        if (parameters.has('options')) {
            const optionsValue = parameters.get('options');
            // This is a basic check - in a real implementation, you'd parse the array
            if (optionsValue.includes('[]') || optionsValue === '[]') {
                this.addWarning(lineNum, column, 'Empty options array for string input', 'PSV6-INPUT-OPTIONS-WARNING');
            }
        }
    }
    validateInputPerformance() {
        // Check for too many input functions
        if (this.inputCount > 15) {
            this.addWarning(1, 1, `Too many input functions detected (${this.inputCount}). Consider grouping related inputs.`, 'PSV6-INPUT-TOO-MANY');
        }
        // Check for complex input expressions
        for (const call of this.inputFunctionCalls) {
            const defaultArg = call.parameters.get('defval') ?? call.arguments[0];
            if (this.hasComplexExpression(defaultArg ?? '')) {
                this.addWarning(call.line, call.column, 'Complex expression used as input default value. Consider using simpler expressions.', 'PSV6-INPUT-COMPLEX-EXPRESSION');
            }
        }
    }
    validateInputBestPractices() {
        // Check for poor variable naming
        const poorNames = new Set(['a', 'b', 'c', 'x', 'y', 'z', 'temp', 'flag', 'val', 'value']);
        for (const call of this.inputFunctionCalls) {
            const variableName = call.assignedName;
            if (variableName && poorNames.has(variableName)) {
                this.addInfo(call.line, call.column, `Consider using a more descriptive name instead of '${variableName}'`, 'PSV6-INPUT-NAMING-SUGGESTION');
            }
        }
        // Check for missing tooltips
        let inputsWithoutTooltips = 0;
        for (const call of this.inputFunctionCalls) {
            if (!call.parameters.has('tooltip')) {
                inputsWithoutTooltips++;
            }
        }
        if (inputsWithoutTooltips > this.inputCount * 0.5) {
            this.addInfo(1, 1, 'Consider adding tooltips to input functions to improve user experience', 'PSV6-INPUT-TOOLTIP-SUGGESTION');
        }
        // Check for input grouping
        const groups = new Set();
        for (const call of this.inputFunctionCalls) {
            if (call.parameters.has('group')) {
                groups.add(call.parameters.get('group'));
            }
        }
        if (this.inputCount >= 4 && groups.size === 0) {
            this.addInfo(1, 1, 'Consider grouping related input functions using the group parameter', 'PSV6-INPUT-GROUP-SUGGESTION');
        }
        // Check for reasonable default values
        for (const call of this.inputFunctionCalls) {
            const defaultValue = call.parameters.get('defval') ?? call.arguments[0];
            if (this.isUnreasonableDefault(defaultValue)) {
                this.addInfo(call.line, call.column, 'Consider using a more reasonable default value', 'PSV6-INPUT-DEFAULT-SUGGESTION');
            }
        }
    }
    getAssignedIdentifier(path) {
        const assignment = findAncestor(path, (ancestor) => {
            return ancestor.node.kind === 'AssignmentStatement';
        });
        if (assignment && assignment.node.right === path.node) {
            const left = assignment.node.left;
            if (left.kind === 'Identifier') {
                return left.name;
            }
        }
        const declaration = findAncestor(path, (ancestor) => {
            return ancestor.node.kind === 'VariableDeclaration';
        });
        if (declaration && declaration.node.initializer === path.node) {
            return declaration.node.identifier.name;
        }
        return null;
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
    getNodeSource(node) {
        return getNodeSource(this.context, node);
    }
    getAstContext(config) {
        if (!config.ast || config.ast.mode === 'disabled') {
            return null;
        }
        return isAstValidationContext(this.context) ? this.context : null;
    }
    // Helper methods
    extractNumericValue(arg) {
        if (!arg)
            return null;
        const trimmed = arg.trim();
        const match = trimmed.match(/^[+\-]?\d+(\.\d+)?$/);
        return match ? parseFloat(trimmed) : null;
    }
    splitTopLevelList(value) {
        const elements = [];
        let current = '';
        let depth = 0;
        let inString = false;
        let stringChar = '';
        for (let i = 0; i < value.length; i++) {
            const ch = value[i];
            if (!inString && (ch === '"' || ch === '\'')) {
                inString = true;
                stringChar = ch;
                current += ch;
                continue;
            }
            if (inString) {
                current += ch;
                if (ch === stringChar) {
                    inString = false;
                    stringChar = '';
                }
                continue;
            }
            if (ch === '[' || ch === '(' || ch === '{' || ch === '<') {
                depth++;
                current += ch;
                continue;
            }
            if (ch === ']' || ch === ')' || ch === '}' || ch === '>') {
                depth = Math.max(0, depth - 1);
                current += ch;
                continue;
            }
            if (ch === ',' && depth === 0) {
                elements.push(current.trim());
                current = '';
                continue;
            }
            current += ch;
        }
        if (current.trim()) {
            elements.push(current.trim());
        }
        return elements;
    }
    extractStringLiteralValue(value) {
        if (!this.isStringLiteral(value)) {
            return null;
        }
        return value.replace(/^"|"$|^'|'$/g, '');
    }
    isStringLike(arg) {
        if (!arg)
            return false;
        const trimmed = arg.trim();
        if (!trimmed)
            return false;
        if (this.isStringLiteral(trimmed)) {
            return true;
        }
        const identifierMatch = trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*$/);
        if (identifierMatch) {
            const typeInfo = this.context.typeMap.get(trimmed);
            if (typeInfo && (typeInfo.type === 'string' || typeInfo.enumType === 'string')) {
                return true;
            }
            if (/^[A-Z0-9_]+$/.test(trimmed)) {
                return true;
            }
        }
        return false;
    }
    isStringLiteral(arg) {
        const trimmed = arg.trim();
        return (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'"));
    }
    isColorExpression(value) {
        const trimmed = value.trim();
        return trimmed.includes('color.') ||
            trimmed.startsWith('#') ||
            trimmed.startsWith('rgb') ||
            trimmed === 'na';
    }
    isSeriesExpression(value) {
        const trimmed = value.trim();
        const seriesKeywords = ['close', 'open', 'high', 'low', 'volume', 'hl2', 'hlc3', 'ohlc4'];
        return seriesKeywords.some(keyword => trimmed.includes(keyword));
    }
    isValidTimeframe(value) {
        const cleanValue = value.replace(/^"|"$|^'|'$/g, '');
        const timeframePattern = /^\d+[DWMYH]?$/;
        return timeframePattern.test(cleanValue);
    }
    isValidSession(value) {
        const cleanValue = value.replace(/^"|"$|^'|'$/g, '');
        const sessionPattern = /^\d{4}-\d{4}$/;
        return sessionPattern.test(cleanValue);
    }
    hasComplexExpression(expression) {
        const complexPatterns = [
            /ta\./,
            /math\./,
            /str\./,
            /\(/,
            /\+|\-|\*|\//
        ];
        return complexPatterns.some(pattern => pattern.test(expression));
    }
    isUnreasonableDefault(value) {
        if (!value)
            return false;
        const numValue = this.extractNumericValue(value);
        if (numValue !== null) {
            return Math.abs(numValue) > 100000 || (numValue !== 0 && Math.abs(numValue) < 0.000001);
        }
        const cleanValue = value.replace(/^"|"$|^'|'$/g, '');
        return cleanValue.length > 100;
    }
    // Getter methods for other modules
    getInputFunctionCalls() {
        return [...this.inputFunctionCalls];
    }
    getInputCount() {
        return this.inputCount;
    }
}
function isAstValidationContext(context) {
    return 'ast' in context;
}
