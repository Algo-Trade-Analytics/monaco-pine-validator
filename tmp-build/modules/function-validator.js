import { ensureAstContext } from '../core/ast/context-utils';
import { visit } from '../core/ast/traversal';
import { BUILTIN_FUNCTIONS_V6_RULES, NAMESPACES, NS_MEMBERS } from '../core/constants';
import { getNodeSource, getSourceLine, getSourceLines } from '../core/ast/source-utils';
export class FunctionValidator {
    constructor() {
        this.name = 'FunctionValidator';
        this.priority = 85; // High priority - functions are core to Pine Script
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.errorKeys = new Set();
        this.warningKeys = new Set();
        this.infoKeys = new Set();
        // Function tracking (extracted from EnhancedPineScriptValidator)
        this.functionNames = new Set();
        this.methodNames = new Set();
        this.functionParams = new Map();
        this.functionHeaderLine = new Map();
        this.paramUsage = new Map();
        this.userFunctions = new Map();
        this.functionCalls = [];
        this.booleanFunctionAssignments = new Map();
        this.astProgram = null;
        this.seriesLikeIdentifiers = new Set();
        this.allowedInstanceMethods = new Set([
            'push', 'pop', 'get', 'set', 'size', 'clear', 'reverse', 'sort', 'sort_indices', 'copy', 'slice', 'concat', 'fill', 'from', 'from_example',
            'indexof', 'lastindexof', 'includes', 'binary_search', 'binary_search_leftmost', 'binary_search_rightmost', 'range', 'remove', 'insert',
            'unshift', 'shift', 'first', 'last', 'max', 'min', 'median', 'mode', 'abs', 'sum', 'avg', 'stdev', 'variance', 'standardize', 'covariance',
            'percentile_linear_interpolation', 'percentile_nearest_rank', 'percentrank', 'some', 'every', 'delete'
        ]);
    }
    isDebugEnabled() {
        const env = globalThis?.process?.env;
        return !!env && env.DEBUG_FUNC === '1';
    }
    getDependencies() {
        return ['SyntaxValidator']; // Depends on basic syntax validation
    }
    extractParamName(param) {
        const withoutDefault = param.split('=')[0]?.trim() ?? '';
        const cleaned = withoutDefault.replace(/<[^>]*>/g, '').trim();
        if (!cleaned)
            return '';
        const tokens = cleaned.split(/\s+/);
        return tokens[tokens.length - 1] ?? '';
    }
    computeRequiredParams(params) {
        return params.reduce((count, param) => {
            return count + (param.includes('=') ? 0 : 1);
        }, 0);
    }
    createFunctionInfo(name, params, line, column, isMethod, options = {}) {
        const parameterNames = params.map(p => this.extractParamName(p)).filter(Boolean);
        const totalParams = params.length;
        const requiredParams = this.computeRequiredParams(params);
        const implicitOffset = isMethod ? 1 : 0;
        const info = {
            name,
            parameters: parameterNames,
            returnType: 'unknown',
            line,
            column,
            isMethod,
            implicitOffset,
            requiredParams,
            totalParams,
            rawParams: params,
            node: options.node,
            identifier: options.identifier,
        };
        return info;
    }
    createSignatureMeta(params, isMethod, line) {
        return {
            rawParams: params,
            requiredParams: this.computeRequiredParams(params),
            totalParams: params.length,
            implicitOffset: isMethod ? 1 : 0,
            line,
            isMethod
        };
    }
    signatureHasExplicitTypes(params) {
        return params.every((param, index) => {
            const trimmed = param.split('=')[0]?.trim() ?? '';
            if (!trimmed)
                return false;
            if (index === 0 && /^this\b/.test(trimmed))
                return true;
            const tokens = trimmed.replace(/<[^>]*>/g, '').trim().split(/\s+/);
            return tokens.length >= 2;
        });
    }
    registerFunctionSignature(name, params, lineNum, isMethod, checkDuplicateParams = true) {
        this.functionNames.add(name);
        const signature = this.createSignatureMeta(params, isMethod, lineNum);
        this.addFunctionSignature(name, signature);
        const funcInfo = this.createFunctionInfo(name, params, lineNum, 1, isMethod);
        this.addUserFunction(name, funcInfo);
        if (!checkDuplicateParams) {
            return;
        }
        const seen = new Set();
        funcInfo.parameters.forEach((paramName, idx) => {
            if (!paramName)
                return;
            if (funcInfo.isMethod && idx === 0 && paramName === 'this') {
                if (seen.has(paramName)) {
                    this.addError(lineNum, 1, `Duplicate 'this' parameter in method '${name}'.`, 'PSDUP01');
                }
                seen.add(paramName);
                return;
            }
            if (seen.has(paramName)) {
                this.addError(lineNum, 1, `Duplicate parameter '${paramName}' in function '${name}'.`, 'PSDUP01');
            }
            seen.add(paramName);
        });
    }
    addFunctionSignature(name, signature) {
        if (!this.functionParams.has(name)) {
            this.functionParams.set(name, []);
        }
        this.functionParams.get(name).push(signature);
        if (!this.functionHeaderLine.has(name)) {
            this.functionHeaderLine.set(name, signature.line);
        }
    }
    addUserFunction(name, info) {
        if (!this.userFunctions.has(name)) {
            this.userFunctions.set(name, []);
        }
        this.userFunctions.get(name).push(info);
    }
    validate(context, config) {
        this.reset();
        this.context = context;
        this.config = config;
        this.astContext = this.getAstContext(config);
        if (!this.astContext && config.ast?.mode !== 'disabled') {
            this.astContext = ensureAstContext(context, config);
        }
        const program = this.astContext?.ast ?? null;
        if (!program) {
            return this.buildResult();
        }
        this.initializeSeriesLikeIdentifiers(program);
        // Extract comprehensive function validation logic from EnhancedPineScriptValidator
        // NOTE: FunctionDeclarationsValidator also collects functions, but this module needs its own
        // collection for complete validation. Future optimization: coordinate with FunctionDeclarationsValidator
        this.collectFunctionsFromAst(program);
        if (this.isDebugEnabled()) {
            console.log('[FunctionValidator] collected names', Array.from(this.functionNames));
            console.log('[FunctionValidator] collected params map', Array.from(this.functionParams.entries()));
            console.log('[FunctionValidator] userFunctions', Array.from(this.userFunctions.keys()));
        }
        // Update the shared context with function information early so downstream checks see method definitions
        if (this.context.functionNames) {
            for (const funcName of this.functionNames) {
                this.context.functionNames.add(funcName);
            }
        }
        this.validateFunctionCalls();
        this.validateUserFunctions();
        this.checkUnusedParameters();
        this.validateDuplicateFunctions();
        this.validateInconsistentReturnTypes();
        this.validatePerformanceIssues();
        this.validateFunctionComplexity();
        // Update the shared context with function information
        // Function metadata already shared before validation
        if (this.isDebugEnabled()) {
            console.log('[FunctionValidator] final errors', this.errors.map(e => e.code));
        }
        return this.buildResult();
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.functionNames.clear();
        this.methodNames.clear();
        this.functionParams.clear();
        this.functionHeaderLine.clear();
        this.paramUsage.clear();
        this.userFunctions.clear();
        this.functionCalls = [];
        this.booleanFunctionAssignments.clear();
        this.astProgram = null;
        this.astContext = null;
        this.errorKeys.clear();
        this.warningKeys.clear();
        this.infoKeys.clear();
        this.seriesLikeIdentifiers.clear();
    }
    initializeSeriesLikeIdentifiers(program) {
        this.seriesLikeIdentifiers.clear();
        for (const builtin of FunctionValidator.BUILTIN_SERIES_IDENTIFIERS) {
            this.seriesLikeIdentifiers.add(builtin);
        }
        const typeEnv = this.astContext?.typeEnvironment ?? null;
        if (typeEnv) {
            for (const [identifier, metadata] of typeEnv.identifiers.entries()) {
                if (metadata.kind === 'series') {
                    this.seriesLikeIdentifiers.add(identifier);
                }
            }
        }
        for (const [name, info] of this.context.typeMap.entries()) {
            if (name.includes('.')) {
                continue;
            }
            if (info.type === 'series' || info.isSeries) {
                this.seriesLikeIdentifiers.add(name);
            }
        }
    }
    addError(line, column, message, code, suggestion) {
        const key = `${line}:${column}:${code ?? message}`;
        if (this.errorKeys.has(key)) {
            return;
        }
        if (this.isDebugEnabled() && code && (code === 'PSV6-FUNCTION-UNKNOWN' || code === 'PSV6-FUNCTION-NAMESPACE')) {
            console.log('[FunctionValidator] addError', { line, column, code, message });
        }
        this.errorKeys.add(key);
        this.errors.push({ line, column, message, severity: 'error', code, suggestion });
    }
    addWarning(line, column, message, code, suggestion) {
        const key = `${line}:${column}:${code ?? message}`;
        if (this.warningKeys.has(key)) {
            return;
        }
        this.warningKeys.add(key);
        this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
    }
    addInfo(line, column, message, code, suggestion) {
        const key = `${line}:${column}:${code ?? message}`;
        if (this.infoKeys.has(key)) {
            return;
        }
        this.infoKeys.add(key);
        this.info.push({ line, column, message, severity: 'info', code, suggestion });
    }
    buildResult() {
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap: new Map(),
            scriptType: null,
        };
    }
    collectFunctionsFromAst(program) {
        visit(program, {
            FunctionDeclaration: {
                enter: (path) => {
                    this.processAstFunctionDeclaration(path.node);
                },
            },
        });
    }
    processAstFunctionDeclaration(fn) {
        if (!fn.identifier) {
            return;
        }
        const fullName = fn.identifier.name;
        const params = fn.params.map((param) => this.formatAstParameter(param));
        const paramNames = fn.params.map((param) => param.identifier.name).filter(Boolean);
        const line = fn.loc?.start.line ?? 1;
        const column = fn.loc?.start.column ?? 1;
        const hasThisParam = fn.params.length > 0 && fn.params[0].identifier.name === 'this';
        const isMethodCandidate = fullName.includes('.');
        const isMethod = isMethodCandidate && hasThisParam;
        const storeName = isMethod ? fullName.split('.').pop() ?? fullName : fullName;
        if (isMethod) {
            this.methodNames.add(storeName);
            this.context.methodNames?.add(storeName);
        }
        this.storeAstFunctionSignature(storeName, params, line, column, isMethod, paramNames, {
            checkDuplicates: true,
            node: fn,
            identifier: fn.identifier,
        });
        if (isMethod && fullName !== storeName) {
            this.storeAstFunctionSignature(fullName, params, line, column, isMethod, paramNames, { checkDuplicates: false });
        }
    }
    storeAstFunctionSignature(name, params, line, column, isMethod, paramNames, options = {}) {
        this.functionNames.add(name);
        const signature = this.createSignatureMeta(params, isMethod, line);
        this.addFunctionSignature(name, signature);
        if (!this.functionHeaderLine.has(name)) {
            this.functionHeaderLine.set(name, line);
        }
        if (!this.context.functionParams.has(name)) {
            this.context.functionParams.set(name, params);
        }
        const info = this.createFunctionInfo(name, params, line, column, isMethod, {
            node: options.node,
            identifier: options.identifier,
        });
        this.addUserFunction(name, info);
        if (options.checkDuplicates === false) {
            return;
        }
        const seen = new Set();
        for (const [index, paramName] of paramNames.entries()) {
            if (!paramName) {
                continue;
            }
            if (seen.has(paramName)) {
                const message = paramName === 'this' && isMethod
                    ? `Duplicate 'this' parameter in method '${name}'.`
                    : `Duplicate parameter '${paramName}' in function '${name}'.`;
                this.addError(line, column, message, 'PSDUP01');
            }
            seen.add(paramName);
        }
    }
    formatAstParameter(param) {
        const typeAnnotation = param.typeAnnotation ? `${this.stringifyAstTypeReference(param.typeAnnotation)} ` : '';
        const name = param.identifier.name;
        const defaultValue = param.defaultValue ? ' = <default>' : '';
        return `${typeAnnotation}${name}${defaultValue}`.trim();
    }
    stringifyAstTypeReference(type) {
        const base = type.name.name;
        if (!type.generics.length) {
            return base;
        }
        const generics = type.generics.map((generic) => this.stringifyAstTypeReference(generic));
        return `${base}<${generics.join(', ')}>`;
    }
    /**
     * Validate function calls (extracted from UltimateValidator.validateFunctionCalls)
     */
    validateFunctionCalls() {
        if (this.astContext?.ast) {
            this.collectFunctionCallsFromAst(this.astContext.ast);
            if (this.isDebugEnabled()) {
                console.log('[FunctionValidator] collected calls', this.functionCalls.map(call => ({ name: call.name, args: call.arguments })));
            }
        }
        // Validate all collected function calls
        for (const call of this.functionCalls) {
            this.validateSingleFunctionCall(call);
        }
        this.validateBooleanVariableUsagesAst();
    }
    collectFunctionCallsFromAst(program) {
        this.astProgram = program;
        const loopStack = [];
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
            RepeatStatement: {
                enter: () => {
                    loopStack.push('repeat');
                },
                exit: () => {
                    loopStack.pop();
                },
            },
            CallExpression: {
                enter: (path) => {
                    const node = path.node;
                    const qualifiedName = this.getExpressionQualifiedName(node.callee);
                    if (!qualifiedName || /^(indicator|strategy|library)$/.test(qualifiedName)) {
                        return;
                    }
                    const line = node.loc?.start.line ?? 1;
                    const column = node.loc?.start.column ?? 1;
                    const args = node.args.map((argument) => this.argumentToString(argument));
                    const startIndex = Math.max(0, column - 1);
                    this.functionCalls.push({
                        name: qualifiedName,
                        arguments: args,
                        line,
                        column,
                        startIndex,
                        inLoop: loopStack.length > 0,
                        astNode: node,
                        astPath: path,
                    });
                },
            },
        });
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
    argumentToString(argument) {
        const valueText = getNodeSource(this.context, argument.value).trim();
        if (argument.name) {
            return `${argument.name.name}=${valueText}`;
        }
        return valueText;
    }
    isArgumentCountCompatible(requiredParams, totalParams, implicitOffset, provided) {
        const min = Math.max(0, requiredParams - implicitOffset);
        const max = Math.max(0, totalParams - implicitOffset);
        return provided >= min && provided <= max;
    }
    findMatchingSignatureMeta(signatures, provided) {
        for (const signature of signatures) {
            if (this.isArgumentCountCompatible(signature.requiredParams, signature.totalParams, signature.implicitOffset, provided)) {
                return signature;
            }
        }
        return null;
    }
    findMatchingFunctionInfo(overloads, provided) {
        for (const info of overloads) {
            if (this.isArgumentCountCompatible(info.requiredParams, info.totalParams, info.implicitOffset, provided)) {
                return info;
            }
        }
        return null;
    }
    validateSingleFunctionCall(call) {
        // Delegate namespaced built-ins to specialized modules to avoid double-validation
        if (call.name.includes('.')) {
            const parts = call.name.split('.');
            const namespace = parts[0];
            const funcName = parts[parts.length - 1];
            // Handle chained object method calls like this.start.move()
            const declaredVars = this.context.declaredVars ?? new Map();
            const baseLooksLikeVariable = namespace === 'this' || (!NAMESPACES.has(namespace) && declaredVars.has(namespace));
            if (!NAMESPACES.has(namespace) || baseLooksLikeVariable) {
                if (!(parts.length === 2 && funcName === 'new' && this.isUDTConstructor(namespace))) {
                    this.validateObjectMethodCall(parts, call);
                    return;
                }
            }
            const delegatedNamespaces = new Set(['ta', 'math', 'str', 'input', 'line', 'label', 'box', 'table', 'map', 'strategy', 'array', 'matrix', 'polyline']);
            // In library scripts, restrict certain namespaces explicitly to match TDD expectations
            if (this.context.scriptType === 'library') {
                if (namespace === 'strategy') {
                    this.addError(call.line, call.column, `Unknown function in library context: ${call.name}`, 'PSV6-FUNCTION-UNKNOWN');
                    return;
                }
                if (namespace === 'input') {
                    this.addError(call.line, call.column, `Function '${call.name}' is not allowed in libraries`, 'PSV6-FUNCTION-NAMESPACE');
                    return;
                }
            }
            if (delegatedNamespaces.has(namespace)) {
                // If function is in the wrong namespace, surface a namespace error
                const members = NS_MEMBERS[namespace];
                if (!members || (members instanceof Set && !members.has(funcName))) {
                    const fullQualified = call.name;
                    if (parts.length > 2 && BUILTIN_FUNCTIONS_V6_RULES[fullQualified]) {
                        this.validateReturnTypeUsage(fullQualified, call);
                        return;
                    }
                    const correct = this.findCorrectNamespace(funcName);
                    if (correct) {
                        this.addError(call.line, call.column, `Function '${funcName}' should be in '${correct}' namespace, not '${namespace}'`, 'PSV6-FUNCTION-NAMESPACE');
                        return;
                    }
                }
                // For delegated namespaces (except strategy), still run return-type usage checks (e.g., bool in arithmetic)
                if (namespace !== 'strategy') {
                    this.validateReturnTypeUsage(call.name, call);
                }
                // Let specialized modules handle namespaced calls (str, ta, math, input, line, label, box, table, map, strategy)
                return;
            }
            // Otherwise, validate as built-in
            this.validateBuiltInFunctionCall(call);
            return;
        }
        // Non-namespaced function
        this.validateUserFunctionCall(call);
    }
    validateObjectMethodCall(parts, originalCall) {
        const qualifiedName = parts.join('.');
        if (this.userFunctions.has(qualifiedName) || this.functionParams.has(qualifiedName)) {
            const qualifiedCall = {
                name: qualifiedName,
                arguments: originalCall.arguments,
                line: originalCall.line,
                column: originalCall.column,
                startIndex: originalCall.startIndex
            };
            this.validateUserFunctionCall(qualifiedCall);
            return;
        }
        const methodName = parts[parts.length - 1];
        const baseName = parts[0];
        const baseTypeInfo = this.context.typeMap.get(baseName);
        if (baseName === 'this' || baseTypeInfo?.type === 'udt' || this.isVariableAssignedUDTConstructor(baseName) || this.isUDTConstructor(baseName)) {
            return;
        }
        if (this.allowedInstanceMethods.has(methodName)) {
            return;
        }
        const methodCall = {
            name: methodName,
            arguments: originalCall.arguments,
            line: originalCall.line,
            column: originalCall.column,
            startIndex: originalCall.startIndex
        };
        this.validateUserFunctionCall(methodCall);
    }
    validateBuiltInFunctionCall(call) {
        // Handle script declarations (indicator, strategy, library)
        if (['indicator', 'strategy', 'library'].includes(call.name)) {
            // These are script declarations, not function calls - skip validation
            return;
        }
        let rules;
        let fullName;
        // Check if it's a namespaced function
        if (call.name.includes('.')) {
            const parts = call.name.split('.');
            const namespace = parts[0];
            const funcName = parts[parts.length - 1];
            // Check if namespace is valid
            if (!NAMESPACES.has(namespace)) {
                // Check if it's a UDT constructor (e.g., Point.new, PriceBar.new)
                if (funcName === 'new' && this.isUDTConstructor(namespace)) {
                    // This is a UDT constructor call, which is valid
                    return;
                }
                // Check if it's a UDT method call (e.g., p1.distance, p2.move)
                const varTypeInfo = this.context.typeMap.get(namespace);
                if (varTypeInfo?.type === 'udt') {
                    // This is a UDT method call, which is valid
                    return;
                }
                // Check if this variable is assigned a UDT constructor in the code
                if (this.isVariableAssignedUDTConstructor(namespace)) {
                    // This is likely a UDT method call, which is valid
                    return;
                }
                // Check if it's a UDT constructor (e.g., Point.new)
                if (this.isUDTConstructor(namespace)) {
                    // This is a UDT constructor, which is valid
                    return;
                }
                this.addError(call.line, call.column, `Invalid namespace: ${namespace}`, 'PSV6-FUNCTION-NAMESPACE');
                return;
            }
            // Get function rules
            fullName = call.name;
            rules = BUILTIN_FUNCTIONS_V6_RULES[fullName] ?? BUILTIN_FUNCTIONS_V6_RULES[`${namespace}.${funcName}`];
            // Check if it's a known built-in function (even if not in rules)
            if (!rules && !this.context.functionNames.has(fullName)) {
                // Check if the function exists in a different namespace
                const correctNamespace = this.findCorrectNamespace(funcName);
                if (correctNamespace) {
                    this.addError(call.line, call.column, `Function '${funcName}' should be in '${correctNamespace}' namespace, not '${namespace}'`, 'PSV6-FUNCTION-NAMESPACE');
                }
                else {
                    this.addError(call.line, call.column, `Unknown function: ${call.name}`, 'PSV6-FUNCTION-UNKNOWN');
                }
                return;
            }
        }
        else {
            // Handle non-namespaced functions (like plot, hline, etc.)
            fullName = call.name;
            rules = BUILTIN_FUNCTIONS_V6_RULES[call.name];
            // Check if it's a known built-in function (even if not in rules)
            if (!rules && !this.context.functionNames.has(call.name)) {
                // Allow pseudo-constructor style initializers like: var polyline_id = polyline(na)
                if (call.name === 'polyline' && call.arguments.length === 1) {
                    return;
                }
                this.addError(call.line, call.column, `Unknown function: ${call.name}`, 'PSV6-FUNCTION-UNKNOWN');
                return;
            }
        }
        // Validate deprecated parameters (extracted from UltimateValidator)
        if (rules && rules.deprecatedParams) {
            const argsString = call.arguments.join(',');
            for (const param of rules.deprecatedParams) {
                if (new RegExp(`\\b${param}\\s*=`).test(argsString)) {
                    this.addError(call.line, call.column, `Parameter '${param}' was removed in Pine v6. ${rules.v6Changes || ''}`, 'PSV6-DEP-PARAM');
                }
            }
        }
        // Validate parameter count and types
        this.validateFunctionParameters(fullName, rules || {}, call);
        // Validate return type usage in expressions
        this.validateReturnTypeUsage(fullName, call);
    }
    getNamedArgumentNames(call) {
        const names = new Set();
        if (call.astNode) {
            for (const arg of call.astNode.args) {
                if (arg.name) {
                    names.add(arg.name.name);
                }
            }
            return names;
        }
        for (const argument of call.arguments) {
            const eqIndex = argument.indexOf('=');
            if (eqIndex === -1)
                continue;
            const name = argument.slice(0, eqIndex).trim();
            if (name) {
                names.add(name);
            }
        }
        return names;
    }
    getFunctionParameterCandidates(rules) {
        const candidates = [];
        const addCandidate = (parameters) => {
            if (!Array.isArray(parameters) || parameters.length === 0) {
                return;
            }
            const required = parameters.reduce((count, param) => {
                if (!param || typeof param !== 'object') {
                    return count;
                }
                return count + (param.required === false ? 0 : 1);
            }, 0);
            candidates.push({ parameters, required, max: parameters.length });
        };
        if (rules && Array.isArray(rules.parameters)) {
            addCandidate(rules.parameters);
        }
        if (rules && Array.isArray(rules.overloads)) {
            for (const overload of rules.overloads) {
                if (overload && Array.isArray(overload.parameters)) {
                    addCandidate(overload.parameters);
                }
            }
        }
        return candidates;
    }
    selectFunctionParameterSet(rules, call) {
        const candidates = this.getFunctionParameterCandidates(rules);
        if (candidates.length === 0) {
            return null;
        }
        const namedArgs = this.getNamedArgumentNames(call);
        const argumentCount = call.arguments.length;
        const viable = candidates.filter((candidate) => {
            if (argumentCount < candidate.required || argumentCount > candidate.max) {
                return false;
            }
            if (namedArgs.size === 0) {
                return true;
            }
            const parameterNames = new Set();
            for (const parameter of candidate.parameters) {
                if (!parameter || typeof parameter !== 'object')
                    continue;
                if (typeof parameter.name === 'string') {
                    parameterNames.add(parameter.name);
                }
            }
            for (const name of namedArgs) {
                if (!parameterNames.has(name)) {
                    if (call.name === 'fill' && process.env.DEBUG_FUNC === '1') {
                        console.log('[FunctionValidator] fill missing named parameter', name, 'candidate parameters', Array.from(parameterNames));
                    }
                    return false;
                }
            }
            return true;
        });
        if (viable.length === 0) {
            if (call.name === 'fill' && process.env.DEBUG_FUNC === '1') {
                console.log('[FunctionValidator] fill no viable candidate', { argumentCount, namedArgs: Array.from(namedArgs), candidates: candidates.map(c => ({ required: c.required, max: c.max, names: c.parameters.map((p) => p && p.name) })) });
            }
            return null;
        }
        viable.sort((a, b) => {
            if (b.required !== a.required) {
                return b.required - a.required;
            }
            return a.max - b.max;
        });
        return viable[0];
    }
    validateFunctionParameters(funcName, rules, call) {
        const match = this.selectFunctionParameterSet(rules, call);
        if (!match) {
            const candidates = this.getFunctionParameterCandidates(rules);
            if (candidates.length === 0) {
                return;
            }
            const rangeLabel = candidates
                .map((candidate) => candidate.required === candidate.max
                ? `${candidate.required}`
                : `${candidate.required}-${candidate.max}`)
                .join(', ');
            this.addError(call.line, call.column, `Function ${funcName} does not accept ${call.arguments.length} parameters. Allowed counts: ${rangeLabel}`, 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        const params = match.parameters;
        const requiredParams = match.required;
        if (call.arguments.length < requiredParams) {
            this.addError(call.line, call.column, `Function ${funcName} expects at least ${requiredParams} parameters, got ${call.arguments.length}`, 'PSV6-FUNCTION-PARAM-COUNT');
        }
        if (call.arguments.length > params.length) {
            this.addError(call.line, call.column, `Function ${funcName} expects at most ${params.length} parameters, got ${call.arguments.length}`, 'PSV6-FUNCTION-PARAM-COUNT');
        }
        // Validate parameter types and qualifiers (extracted from UltimateValidator)
        for (let i = 0; i < params.length && i < call.arguments.length; i++) {
            const param = params[i];
            const arg = call.arguments[i];
            // Check if this is a named parameter
            if (arg.includes('=')) {
                const [paramName, paramValue] = arg.split('=');
                if (paramName.trim() !== param.name) {
                    // This is not the parameter we're looking for, skip validation
                    continue;
                }
                const argValue = paramValue.trim();
                // Skip validation if parameter is not required and not provided
                if (param.required === false && !argValue) {
                    continue;
                }
                this.validateParameterType(funcName, param, argValue, call.line, call.column);
            }
            else {
                // Positional parameter
                const argValue = arg.trim();
                // Skip validation if parameter is not required and not provided
                if (param.required === false && !argValue) {
                    continue;
                }
                this.validateParameterType(funcName, param, argValue, call.line, call.column);
            }
        }
    }
    validateParameterType(funcName, param, argValue, line, column) {
        const trimmedArg = argValue.trim();
        if (param.type === 'chart.point' && trimmedArg === 'na') {
            return;
        }
        // Validate parameter type
        if (param.type && !this.isValidParameterType(argValue, param.type)) {
            this.addError(line, column, `Parameter '${param.name}' of '${funcName}' should be ${param.type}, got ${this.inferArgumentType(argValue)}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
        // Validate qualifier: if 'simple' required but argument appears to be 'series', flag mismatch
        if (param.qualifier === 'simple') {
            const inferred = this.inferArgumentType(argValue);
            const looksSeries = this.argumentLooksSeries(argValue);
            if (inferred === 'series' || looksSeries) {
                this.addError(line, column, `Parameter '${param.name}' of '${funcName}' requires simple type, got series`, 'PSV6-FUNCTION-PARAM-TYPE');
            }
        }
        // Validate parameter constraints
        if (param.min !== undefined || param.max !== undefined) {
            const numValue = this.extractNumericValue(argValue);
            if (numValue !== null) {
                if (param.min !== undefined && numValue < param.min) {
                    this.addError(line, column, `The value for '${param.name}' must be >= ${param.min}, but it was ${numValue}.`, 'PSV6-002');
                }
                if (param.max !== undefined && numValue > param.max) {
                    this.addError(line, column, `The value for '${param.name}' must be <= ${param.max}, but it was ${numValue}.`, 'PSV6-PARAM-MAX');
                }
            }
        }
    }
    argumentLooksSeries(arg) {
        const value = arg.trim();
        if (!value) {
            return false;
        }
        if (/(?:barstate\.|ta\.|security\.|request\.)/.test(value)) {
            return true;
        }
        if (/\?.*?:/.test(value)) {
            return true;
        }
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(value) && this.seriesLikeIdentifiers.has(value)) {
            return true;
        }
        return false;
    }
    validateUserFunctionCall(call) {
        const overloads = this.userFunctions.get(call.name);
        if (!overloads || overloads.length === 0) {
            const fallbackSignatures = this.functionParams.get(call.name);
            const isMethod = this.methodNames.has(call.name);
            if (this.isDebugEnabled()) {
                console.log('[FunctionValidator] fallback lookup', call.name, 'signatures', fallbackSignatures, 'method?', isMethod);
            }
            if (fallbackSignatures && fallbackSignatures.length > 0) {
                const providedParams = call.arguments.length;
                const match = this.findMatchingSignatureMeta(fallbackSignatures, providedParams);
                if (!match) {
                    const first = fallbackSignatures[0];
                    const min = Math.max(0, first.requiredParams - first.implicitOffset);
                    const max = Math.max(0, first.totalParams - first.implicitOffset);
                    this.addError(call.line, call.column, `Function ${call.name} expects between ${min} and ${max} parameters, got ${providedParams}`, 'PSV6-FUNCTION-CALL-PARAM-COUNT');
                }
                return;
            }
            if (this.functionNames.has(call.name) || this.isInlineFunctionDeclaration(call.name)) {
                // Function was collected but lacks metadata (e.g., func declarations without detailed parsing)
                return;
            }
            // Check if it's a built-in function without namespace
            const directRules = BUILTIN_FUNCTIONS_V6_RULES[call.name];
            if (directRules) {
                // It's a standalone built-in function (like plot, int, float, etc.)
                this.validateBuiltInFunctionCall(call);
                return;
            }
            const builtInRules = Object.keys(BUILTIN_FUNCTIONS_V6_RULES).find(key => key.endsWith(`.${call.name}`));
            if (builtInRules) {
                this.addError(call.line, call.column, `Function ${call.name} requires namespace (e.g., ${builtInRules})`, 'PSV6-FUNCTION-NAMESPACE');
            }
            else if (this.context.functionNames && this.context.functionNames.has(call.name)) {
                // Known standalone built-in (e.g., alertcondition) without explicit rules — accept
                return;
            }
            else {
                // Allow pseudo-constructor style initializers
                if (call.name === 'polyline' && call.arguments.length === 1) {
                    return;
                }
                this.addError(call.line, call.column, `Unknown function: ${call.name}`, 'PSV6-FUNCTION-UNKNOWN');
            }
            return;
        }
        const providedParams = call.arguments.length;
        const match = this.findMatchingFunctionInfo(overloads, providedParams);
        if (!match) {
            const signature = overloads[0];
            const min = Math.max(0, signature.requiredParams - signature.implicitOffset);
            const max = Math.max(0, signature.totalParams - signature.implicitOffset);
            this.addError(call.line, call.column, `Function ${call.name} expects between ${min} and ${max} parameters, got ${providedParams}`, 'PSV6-FUNCTION-CALL-PARAM-COUNT');
            return;
        }
        // Track parameter usage
        const usageKey = match.name;
        if (!this.paramUsage.has(usageKey)) {
            this.paramUsage.set(usageKey, new Set());
        }
        const max = Math.max(0, match.totalParams - match.implicitOffset);
        const usable = Math.min(max, providedParams);
        for (let i = 0; i < usable; i++) {
            const paramName = match.parameters[i + match.implicitOffset];
            if (!paramName)
                continue;
            this.paramUsage.get(usageKey).add(paramName);
        }
    }
    validateUserFunctions() {
        // Validate function complexity and style
        for (const [, overloads] of this.userFunctions.entries()) {
            for (const func of overloads) {
                // Function complexity is now validated in the main validateFunctionComplexity() method
                this.validateFunctionStyle(func);
            }
        }
    }
    validateFunctionComplexity() {
        if (!this.astContext?.ast) {
            return;
        }
        this.validateFunctionComplexityAst();
    }
    validateFunctionComplexityAst() {
        const visited = new Set();
        for (const overloads of this.userFunctions.values()) {
            for (const func of overloads) {
                if (!func.node || visited.has(func.node)) {
                    continue;
                }
                visited.add(func.node);
                const complexity = this.calculateFunctionComplexityAst(func.node);
                if (complexity <= 10) {
                    continue;
                }
                const location = func.identifier ?? func.node.identifier ?? func.node;
                this.addWarning(location.loc.start.line, location.loc.start.column, `Function '${func.name}' has high complexity (${complexity}). Consider breaking it into smaller functions`, 'PSV6-FUNCTION-STYLE-COMPLEXITY');
            }
        }
    }
    calculateFunctionComplexityAst(fn) {
        let complexity = 1;
        visit(fn.body, {
            FunctionDeclaration: {
                enter: () => 'skip',
            },
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
        });
        return complexity;
    }
    validateFunctionStyle(func) {
        if (func.isMethod) {
            return; // Skip stylistic checks for methods to avoid noisy warnings
        }
        if (func.name.includes('.')) {
            return; // Skip style checks for namespaced functions (e.g., UDT static methods)
        }
        // Check function naming conventions
        if (func.name.length < 3 || !func.name.match(/^[a-z]/)) {
            this.addWarning(func.line, func.column, `Function name '${func.name}' should follow camelCase convention and be descriptive`, 'PSV6-FUNCTION-STYLE-NAMING');
        }
        // Check for function documentation
        if (!this.hasFunctionDocumentation(func.line)) {
            this.addWarning(func.line, func.column, `Function '${func.name}' should have documentation comment above it`, 'PSV6-FUNCTION-STYLE-DOCS');
        }
    }
    isInlineFunctionDeclaration(name) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`^\\s*(?:export\\s+)?${escaped}\\s*\\([^)]*\\)\\s*=>`);
        const lines = getSourceLines(this.context);
        return lines.some(line => pattern.test(line));
    }
    hasFunctionDocumentation(lineNum) {
        // Check if there's a comment above the function
        if (lineNum > 1) {
            const prevLine = getSourceLine(this.context, lineNum - 1);
            return prevLine.trim().startsWith('//');
        }
        return false;
    }
    checkUnusedParameters() {
        // Check for unused parameters (extracted from EnhancedPineScriptValidator)
        for (const [fn, overloads] of this.userFunctions.entries()) {
            if (/^(indicator|strategy|library)$/.test(fn))
                continue;
            const usedInFn = this.paramUsage.get(fn) ?? new Set();
            for (const func of overloads) {
                const line = func.line ?? (this.functionHeaderLine.get(fn) ?? 1);
                func.parameters.forEach((p, idx) => {
                    if (!p || p === '_' || (func.isMethod && idx === 0))
                        return;
                    if (fn.includes('.'))
                        return; // Skip dotted names to avoid noise
                    if (!usedInFn.has(p)) {
                        this.addWarning(line, func.column, `Parameter '${p}' in '${fn}' is never used.`, 'PSU-PARAM');
                    }
                });
            }
        }
    }
    // Helper methods
    isValidParameterType(arg, expectedType) {
        const actualType = this.inferArgumentType(arg);
        // Direct type match
        if (expectedType === actualType)
            return true;
        // Basic type checking with more flexible rules
        // Tolerate unknowns for object-like or collection types to avoid false negatives before type inference
        if ((expectedType === 'array' || expectedType === 'polyline') && actualType === 'unknown')
            return true;
        // Treat 'na' as compatible with numeric/series parameters
        if (actualType === 'na' && (expectedType === 'float' || expectedType === 'int' || expectedType === 'series' || expectedType === 'any'))
            return true;
        if (expectedType === 'series' && (actualType === 'series' || actualType === 'float' || actualType === 'int' || actualType === 'literal'))
            return true;
        if (expectedType === 'series' && actualType === 'unknown') {
            const identifierMatch = arg.trim().match(/^[A-Za-z_][A-Za-z0-9_]*$/);
            if (identifierMatch) {
                const id = identifierMatch[0];
                if (this.context.declaredVars.has(id) || this.context.typeMap.has(id)) {
                    return true;
                }
            }
            else {
                return true;
            }
        }
        if (expectedType === 'int' && (actualType === 'int' || actualType === 'float'))
            return true;
        if (expectedType === 'float' && (actualType === 'float' || actualType === 'int'))
            return true;
        if (expectedType === 'string' && (actualType === 'string' || actualType === 'series'))
            return true;
        if (expectedType === 'bool' && actualType === 'bool')
            return true;
        if (expectedType === 'color' && actualType === 'color')
            return true;
        if (expectedType === 'array' && actualType === 'array')
            return true;
        if (expectedType === 'matrix' && actualType === 'matrix')
            return true;
        if (expectedType === 'map' && actualType === 'map')
            return true;
        // Accept specialized drawing/object ids (e.g., line, label, box, table, polyline)
        const objectTypes = new Set(['line', 'label', 'box', 'table', 'polyline', 'linefill']);
        if (objectTypes.has(expectedType) && objectTypes.has(actualType))
            return true;
        // Accept common enum-like dotted constants for int parameters (e.g., line.style_solid, label.style_label_up, size.normal, location.top)
        if (expectedType === 'int') {
            const trimmed = arg.trim();
            if (/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
                const ns = trimmed.split('.')[0];
                const enumLikeNamespaces = new Set(['line', 'label', 'size', 'location', 'shape', 'table', 'text', 'display']);
                if (enumLikeNamespaces.has(ns))
                    return true;
            }
        }
        // Allow 'series' to be passed where 'float' is expected (common in Pine Script)
        if (expectedType === 'float' && actualType === 'series')
            return true;
        // Allow 'any' type to accept any argument
        if (expectedType === 'any')
            return true;
        return false;
    }
    inferArgumentType(arg) {
        const trimmed = arg.trim();
        // String literal
        if (trimmed.match(/^"[^"]*"$/) || trimmed.match(/^'[^']*'$/)) {
            return 'string';
        }
        // Numeric literal (including negative numbers and scientific notation)
        if (trimmed.match(/^[+\-]?\d+(\.\d+)?([eE][+\-]?\d+)?$/)) {
            return trimmed.includes('.') || /[eE]/.test(trimmed) ? 'float' : 'int';
        }
        // Boolean literal
        if (trimmed === 'true' || trimmed === 'false') {
            return 'bool';
        }
        // Hex color literal
        if (/^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/.test(trimmed)) {
            return 'color';
        }
        // Color literal
        if (trimmed.match(/^color\./)) {
            return 'color';
        }
        // Check for built-in variables (series)
        if (['open', 'high', 'low', 'close', 'volume', 'time', 'bar_index', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'].includes(trimmed)) {
            return 'series';
        }
        // Check for type names (for array.new, matrix.new, etc.)
        if (['int', 'float', 'bool', 'string', 'color', 'line', 'label', 'box', 'table', 'array', 'matrix', 'map'].includes(trimmed)) {
            return 'string'; // Type names are treated as strings in function parameters
        }
        // Check for function calls (e.g., ta.sma(close, 20))
        if (trimmed.includes('(') && trimmed.includes(')')) {
            const funcMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*\.?[A-Za-z_][A-Za-z0-9_]*)\s*\(/);
            if (funcMatch) {
                const funcName = funcMatch[1];
                return this.getFunctionReturnType(funcName);
            }
        }
        // Check for field access (e.g., bar.close)
        if (trimmed.includes('.') && !trimmed.includes('(')) {
            const parts = trimmed.split('.');
            if (parts.length === 2) {
                const [variableName, fieldName] = parts;
                const fieldKey = `${variableName}.${fieldName}`;
                // Check if the field type is in the type map (set by UDTValidator)
                const fieldTypeInfo = this.context.typeMap.get(fieldKey);
                if (fieldTypeInfo && fieldTypeInfo.type !== 'unknown') {
                    return fieldTypeInfo.type;
                }
            }
        }
        // Check for namespace access (e.g., ta.sma, color.blue)
        if (trimmed.includes('.')) {
            const parts = trimmed.split('.');
            if (parts.length === 2) {
                const [namespace, member] = parts;
                // For now, assume namespace members return appropriate types
                if (namespace === 'ta')
                    return 'series'; // Most ta functions return series
                if (namespace === 'math')
                    return 'float'; // Most math functions return float
                if (namespace === 'str')
                    return 'string'; // Most str functions return string
                if (namespace === 'color')
                    return 'color'; // Color namespace returns color
                if (namespace === 'input')
                    return 'input'; // Input namespace returns input
                if (namespace === 'array')
                    return 'array';
                if (namespace === 'map')
                    return 'map';
                if (namespace === 'alert')
                    return 'string'; // Alert frequency/constants behave like strings
                if (namespace === 'session')
                    return 'string';
                if (namespace === 'timezone')
                    return 'string';
                if (namespace === 'timeframe')
                    return 'string';
                return 'unknown';
            }
        }
        // Check if it's a variable reference
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
            // Look up in context type map first (this is the most reliable source)
            const typeInfo = this.context.typeMap.get(trimmed);
            if (typeInfo && typeInfo.type !== 'unknown') {
                if (typeInfo.type === 'udt' && typeInfo.udtName) {
                    const alias = typeInfo.udtName.toLowerCase();
                    const primitiveAliases = new Map([
                        ['color', 'color'],
                        ['line', 'line'],
                        ['label', 'label'],
                        ['box', 'box'],
                        ['table', 'table'],
                        ['linefill', 'linefill'],
                        ['polyline', 'polyline'],
                        ['chart.point', 'chart.point'],
                    ]);
                    if (primitiveAliases.has(alias)) {
                        return primitiveAliases.get(alias);
                    }
                }
                return typeInfo.type;
            }
            // Check if this variable is assigned a function call
            const functionType = this.isVariableAssignedFunction(trimmed);
            if (functionType) {
                return functionType;
            }
            // Check for common built-in variables that might not be in type map
            if (['open', 'high', 'low', 'close', 'volume', 'time', 'bar_index', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'].includes(trimmed)) {
                return 'series';
            }
            // Check for common built-in constants
            if (['true', 'false', 'na'].includes(trimmed)) {
                return trimmed === 'na' ? 'unknown' : 'bool';
            }
            // Check for color constants
            if (trimmed.startsWith('color.')) {
                return 'color';
            }
            // Check for shape constants
            if (trimmed.startsWith('shape.')) {
                return 'int';
            }
            // Check for location constants
            if (trimmed.startsWith('location.')) {
                return 'int';
            }
            // Check for syminfo properties
            if (trimmed.startsWith('syminfo.')) {
                if (trimmed === 'syminfo.minmove' || trimmed === 'syminfo.pointvalue') {
                    return 'float';
                }
                return 'string';
            }
            // Check if it's a built-in constant in usedVars
            if (this.context.usedVars && this.context.usedVars.has(trimmed)) {
                // Determine type based on the constant name
                if (trimmed.startsWith('color.')) {
                    return 'color';
                }
                else if (trimmed.startsWith('shape.') || trimmed.startsWith('location.')) {
                    return 'int';
                }
            }
            // Check for common built-in functions that return series
            if (['plot', 'plotshape', 'plotchar', 'plotcandle', 'plotbar', 'bgcolor', 'hline', 'fill', 'barcolor'].includes(trimmed)) {
                return 'series';
            }
        }
        // Default to unknown
        return 'unknown';
    }
    extractNumericValue(arg) {
        const match = arg.match(/^[+\-]?\d+(\.\d+)?$/);
        return match ? parseFloat(match[0]) : null;
    }
    validateReturnTypeUsage(funcName, call) {
        const returnType = this.getFunctionReturnType(funcName);
        if (call.astPath && this.astContext?.ast) {
            const handled = this.validateReturnTypeUsageAst(funcName, call, returnType);
            if (handled) {
                return;
            }
        }
    }
    validateReturnTypeUsageAst(funcName, call, returnType) {
        const path = call.astPath;
        if (!path) {
            return false;
        }
        const location = call.astNode?.loc?.start ?? { line: call.line, column: call.column };
        const parent = path.parent;
        if (!parent) {
            return false;
        }
        if (parent.node.kind === 'VariableDeclaration' && parent.key === 'initializer') {
            const declaration = parent.node;
            if (declaration.identifier.kind === 'Identifier'
                && (returnType === 'bool' || this.isBooleanFunction(funcName))) {
                this.booleanFunctionAssignments.set(declaration.identifier.name, {
                    funcName,
                });
            }
            else if (declaration.identifier.kind === 'Identifier') {
                this.booleanFunctionAssignments.delete(declaration.identifier.name);
            }
            return false;
        }
        if (parent.node.kind === 'AssignmentStatement' && parent.key === 'right') {
            const assignment = parent.node;
            if (assignment.left.kind === 'Identifier') {
                const identifier = assignment.left;
                const operator = assignment.operator ?? '=';
                if (operator !== '=' && (returnType === 'bool' || this.isBooleanFunction(funcName))) {
                    this.addError(location.line, location.column, `Boolean function '${funcName}' cannot be used in arithmetic operations`, 'PSV6-FUNCTION-RETURN-TYPE');
                    return true;
                }
                if (operator === '=' && (returnType === 'bool' || this.isBooleanFunction(funcName))) {
                    this.booleanFunctionAssignments.set(identifier.name, {
                        funcName,
                    });
                }
                else if (operator === '=') {
                    this.booleanFunctionAssignments.delete(identifier.name);
                }
            }
            return false;
        }
        if (parent.node.kind === 'BinaryExpression') {
            const binary = parent.node;
            const otherOperand = path.key === 'left' ? binary.right : path.key === 'right' ? binary.left : null;
            if (!otherOperand) {
                return false;
            }
            const operator = binary.operator;
            if ((returnType === 'bool' || this.isBooleanFunction(funcName)) && this.isArithmeticOperator(operator, otherOperand)) {
                this.addError(location.line, location.column, `Boolean function '${funcName}' cannot be used in arithmetic operations`, 'PSV6-FUNCTION-RETURN-TYPE');
                return true;
            }
            if (returnType !== 'string'
                && operator === '+'
                && this.isStringExpression(otherOperand)) {
                this.addError(location.line, location.column, `Function '${funcName}' returns ${returnType}, cannot be used in string operations`, 'PSV6-FUNCTION-RETURN-TYPE');
                return true;
            }
            return false;
        }
        if (parent.node.kind === 'UnaryExpression'
            && (returnType === 'bool' || this.isBooleanFunction(funcName))) {
            const unary = parent.node;
            if (unary.operator === '+' || unary.operator === '-') {
                this.addError(location.line, location.column, `Boolean function '${funcName}' cannot be used in arithmetic operations`, 'PSV6-FUNCTION-RETURN-TYPE');
                return true;
            }
        }
        return false;
    }
    validateBooleanVariableUsagesAst() {
        if (!this.astProgram || this.booleanFunctionAssignments.size === 0) {
            return;
        }
        const warned = new Set();
        visit(this.astProgram, {
            Identifier: {
                enter: (path) => {
                    const name = path.node.name;
                    const assignmentInfo = this.booleanFunctionAssignments.get(name);
                    if (!assignmentInfo) {
                        return;
                    }
                    if (this.isIdentifierAssignmentTarget(path)) {
                        return;
                    }
                    const parent = path.parent;
                    if (!parent) {
                        return;
                    }
                    const usageKey = `${name}:${path.node.loc.start.line}:${path.node.loc.start.column}`;
                    if (parent.node.kind === 'BinaryExpression') {
                        const binary = parent.node;
                        if (!this.isBooleanArithmeticOperator(binary.operator)) {
                            return;
                        }
                        if (warned.has(usageKey)) {
                            return;
                        }
                        warned.add(usageKey);
                        this.addError(path.node.loc.start.line, path.node.loc.start.column, `Variable '${name}' contains boolean result from '${assignmentInfo.funcName}' and cannot be used in arithmetic operations`, 'PSV6-FUNCTION-RETURN-TYPE');
                        return;
                    }
                    if (parent.node.kind === 'UnaryExpression') {
                        const unary = parent.node;
                        if (unary.operator === '+' || unary.operator === '-') {
                            if (warned.has(usageKey)) {
                                return;
                            }
                            warned.add(usageKey);
                            this.addError(path.node.loc.start.line, path.node.loc.start.column, `Variable '${name}' contains boolean result from '${assignmentInfo.funcName}' and cannot be used in arithmetic operations`, 'PSV6-FUNCTION-RETURN-TYPE');
                        }
                    }
                },
            },
        });
    }
    isBooleanArithmeticOperator(operator) {
        return operator === '+' || operator === '-' || operator === '*' || operator === '/' || operator === '%' || operator === '^' || operator === '|' || operator === '&';
    }
    isIdentifierAssignmentTarget(path) {
        const parent = path.parent;
        if (!parent) {
            return false;
        }
        if (parent.node.kind === 'VariableDeclaration' && parent.key === 'identifier') {
            return true;
        }
        if (parent.node.kind === 'AssignmentStatement' && parent.key === 'left') {
            return true;
        }
        return false;
    }
    isArithmeticOperator(operator, otherOperand) {
        const arithmeticOperators = new Set(['+', '-', '*', '/', '%', '^', '|', '&']);
        if (!arithmeticOperators.has(operator)) {
            return false;
        }
        if (operator === '+' && this.isStringExpression(otherOperand)) {
            return false;
        }
        return true;
    }
    isStringExpression(expression) {
        if (expression.kind === 'StringLiteral') {
            return true;
        }
        const typeKind = this.getExpressionTypeKind(expression);
        return typeKind === 'string';
    }
    getExpressionTypeKind(expression) {
        if (!this.astContext) {
            return null;
        }
        const { typeEnvironment } = this.astContext;
        const direct = typeEnvironment.nodeTypes.get(expression);
        if (direct) {
            return direct.kind;
        }
        if (expression.kind === 'Identifier') {
            const identifier = expression;
            const fromIdentifiers = typeEnvironment.identifiers.get(identifier.name);
            return fromIdentifiers?.kind ?? null;
        }
        return null;
    }
    isBooleanFunction(funcName) {
        const booleanFunctions = [
            'ta.crossover', 'ta.crossunder', 'ta.rising', 'ta.falling'
        ];
        return booleanFunctions.includes(funcName);
    }
    validateDuplicateFunctions() {
        for (const [funcName, signatures] of this.functionParams.entries()) {
            if (signatures.length <= 1)
                continue;
            const seen = new Map();
            let hasExactDuplicate = false;
            for (const signature of signatures) {
                const signatureKey = signature.rawParams.join('|');
                if (seen.has(signatureKey)) {
                    const firstLine = seen.get(signatureKey);
                    this.addError(signature.line, 1, `Duplicate function signature '${funcName}' (first declared at line ${firstLine})`, 'PSV6-FUNCTION-DUPLICATE');
                    hasExactDuplicate = true;
                }
                else {
                    seen.set(signatureKey, signature.line);
                }
            }
            if (hasExactDuplicate) {
                continue;
            }
            const typedOverloads = signatures.every(sig => this.signatureHasExplicitTypes(sig.rawParams));
            if (!typedOverloads) {
                const firstLine = signatures[0].line;
                for (let i = 1; i < signatures.length; i++) {
                    this.addError(signatures[i].line, 1, `Duplicate function name '${funcName}' (first declared at line ${firstLine})`, 'PSV6-FUNCTION-DUPLICATE');
                }
            }
        }
    }
    validateInconsistentReturnTypes() {
        if (!this.astContext?.ast) {
            return;
        }
        const visited = new Set();
        for (const overloads of this.userFunctions.values()) {
            for (const func of overloads) {
                if (!func.node || visited.has(func.node)) {
                    continue;
                }
                visited.add(func.node);
                const returnTypes = this.collectFunctionReturnTypes(func.node);
                const meaningful = Array.from(returnTypes).filter((kind) => kind !== 'unknown');
                if (meaningful.length > 1) {
                    const location = func.identifier ?? func.node.identifier ?? func.node;
                    this.addError(location.loc.start.line, location.loc.start.column, `Function '${func.name}' has inconsistent return types: ${meaningful.join(', ')}`, 'PSV6-FUNCTION-RETURN-TYPE');
                }
            }
        }
    }
    collectFunctionReturnTypes(fn) {
        const types = new Set();
        let sawReturn = false;
        visit(fn.body, {
            FunctionDeclaration: {
                enter: () => 'skip',
            },
            ReturnStatement: {
                enter: (path) => {
                    sawReturn = true;
                    const kind = this.getNodeTypeKind(path.node.argument);
                    types.add(kind ?? 'unknown');
                },
            },
        });
        if (!sawReturn) {
            types.add('void');
        }
        return types;
    }
    getNodeTypeKind(node) {
        if (!node) {
            return 'void';
        }
        const metadata = this.astContext?.typeEnvironment.nodeTypes.get(node) ?? null;
        if (!metadata) {
            return 'unknown';
        }
        return metadata.kind;
    }
    findCorrectNamespace(funcName) {
        // Check if the function exists in any namespace
        for (const [namespace, members] of Object.entries(NS_MEMBERS)) {
            if (members.has(funcName)) {
                return namespace;
            }
        }
        // Check if it's a standalone built-in function
        if (BUILTIN_FUNCTIONS_V6_RULES[funcName]) {
            return null; // It's a standalone function, no namespace needed
        }
        return null;
    }
    isUDTConstructor(namespace) {
        // Check if the namespace is a UDT type by looking in the context
        const typeInfo = this.context.typeMap.get(namespace);
        return typeInfo?.type === 'udt';
    }
    isVariableAssignedUDTConstructor(varName) {
        // Look through the code to see if this variable is assigned a UDT constructor
        const lines = getSourceLines(this.context);
        for (const line of lines) {
            // Check for assignment pattern: varName = UDTType.new(...)
            const assignmentMatch = line.match(new RegExp(`^\\s*${varName}\\s*=\\s*([A-Z][A-Za-z0-9_]*)\.new\\s*\\(`));
            if (assignmentMatch) {
                const udtTypeName = assignmentMatch[1];
                // Check if this UDT type exists in the context
                const udtTypeInfo = this.context.typeMap.get(udtTypeName);
                if (udtTypeInfo?.type === 'udt') {
                    return true;
                }
            }
        }
        return false;
    }
    isVariableAssignedFunction(varName) {
        // Look through the code to see if this variable is assigned a function call
        const lines = getSourceLines(this.context);
        for (const line of lines) {
            // Check for assignment pattern: varName = functionCall(...)
            const assignmentMatch = line.match(new RegExp(`^\\s*${varName}\\s*=\\s*([A-Za-z_][A-Za-z0-9_]*\\.[A-Za-z_][A-Za-z0-9_]*)\\s*\\(`));
            if (assignmentMatch) {
                const funcName = assignmentMatch[1];
                // Check if it's a built-in function
                if (BUILTIN_FUNCTIONS_V6_RULES[funcName] || (this.context.functionNames && this.context.functionNames.has(funcName)) || funcName.startsWith('strategy.')) {
                    // Infer return type based on function namespace
                    if (funcName.startsWith('ta.')) {
                        return 'series'; // Most TA functions return series
                    }
                    else if (funcName.startsWith('math.')) {
                        return 'float'; // Most math functions return float
                    }
                    else if (funcName.startsWith('str.')) {
                        // Special handling for specific string functions
                        if (funcName === 'str.tonumber') {
                            return 'float'; // str.tonumber returns float
                        }
                        else {
                            return 'string'; // Other string functions return string
                        }
                    }
                    else if (funcName.startsWith('color.')) {
                        return 'color'; // Color functions return color
                    }
                    else if (funcName.startsWith('array.')) {
                        // Array functions return various types
                        if (funcName === 'array.new') {
                            return 'array';
                        }
                        else {
                            // Let TypeInferenceValidator handle array.get and other array functions
                            return null;
                        }
                    }
                    else if (funcName.startsWith('matrix.')) {
                        // Matrix functions return various types
                        if (funcName === 'matrix.new') {
                            return 'matrix';
                        }
                        else {
                            // Let TypeInferenceValidator handle matrix.get and other matrix functions
                            return null;
                        }
                    }
                    else if (funcName === 'strategy.percent_of_equity') {
                        return 'float';
                    }
                    else if (funcName.startsWith('strategy.risk.')) {
                        return 'void';
                    }
                }
            }
        }
        return null;
    }
    validatePerformanceIssues() {
        this.validateExpensiveFunctionsInLoops();
        this.validateNestedExpensiveFunctionCalls();
        this.validateDuplicateFunctionCalls();
    }
    validateExpensiveFunctionsInLoops() {
        const expensiveFunctions = this.getExpensiveFunctionSet();
        for (const call of this.functionCalls) {
            if (!expensiveFunctions.has(call.name) || !call.inLoop) {
                continue;
            }
            this.addWarning(call.line, call.column, `Expensive function '${call.name}' called inside loop may impact performance`, 'PSV6-FUNCTION-PERF-LOOP');
        }
    }
    validateNestedExpensiveFunctionCalls() {
        const expensiveFunctions = this.getExpensiveFunctionSet();
        const countByLine = new Map();
        for (const call of this.functionCalls) {
            if (!expensiveFunctions.has(call.name)) {
                continue;
            }
            const entry = countByLine.get(call.line) ?? { count: 0, column: call.column };
            entry.count += 1;
            entry.column = Math.min(entry.column, call.column);
            countByLine.set(call.line, entry);
        }
        for (const [line, info] of countByLine.entries()) {
            if (info.count > 2) {
                this.addWarning(line, info.column, `Multiple expensive function calls (${info.count}) on one line may impact performance`, 'PSV6-FUNCTION-PERF-NESTED');
            }
        }
    }
    validateDuplicateFunctionCalls() {
        const signatureCounts = new Map();
        for (const call of this.functionCalls) {
            const signature = `${call.name}(${call.arguments.join(',')})`;
            const entry = signatureCounts.get(signature);
            if (entry) {
                entry.count += 1;
                entry.column = Math.min(entry.column, call.column);
            }
            else {
                signatureCounts.set(signature, { count: 1, line: call.line, column: call.column });
            }
        }
        for (const [signature, info] of signatureCounts.entries()) {
            if (info.count > 2) {
                this.addWarning(info.line, info.column, `Function call '${signature}' is repeated ${info.count} times. Consider caching the result to improve performance`, 'PSV6-FUNCTION-PERF-DUPLICATE');
            }
        }
    }
    getExpensiveFunctionSet() {
        return new Set([
            'ta.sma', 'ta.ema', 'ta.rsi', 'ta.macd', 'ta.stoch', 'ta.atr', 'ta.bb',
            'ta.highest', 'ta.lowest', 'ta.sar', 'ta.roc', 'ta.mom', 'ta.change',
            'ta.correlation', 'ta.dev', 'ta.linreg', 'ta.percentile_linear_interpolation',
            'ta.percentile_nearest_rank', 'ta.percentrank', 'ta.pivothigh', 'ta.pivotlow',
            'ta.range', 'ta.stdev', 'ta.variance', 'ta.wma', 'ta.alma', 'ta.vwma', 'ta.swma',
            'ta.rma', 'ta.hma', 'ta.tsi', 'ta.cci', 'ta.cmo', 'ta.mfi', 'ta.obv', 'ta.pvt',
            'ta.nvi', 'ta.pvi', 'ta.wad', 'request.security', 'request.security_lower_tf'
        ]);
    }
    getFunctionReturnType(funcName) {
        // TA functions that return boolean
        const taBooleanFunctions = [
            'ta.crossover', 'ta.crossunder', 'ta.rising', 'ta.falling'
        ];
        // TA functions that return float
        const taFloatFunctions = [
            'ta.sma', 'ta.ema', 'ta.rsi', 'ta.macd', 'ta.stoch', 'ta.atr', 'ta.bb', 'ta.highest', 'ta.lowest',
            'ta.sar', 'ta.roc', 'ta.mom', 'ta.change', 'ta.correlation', 'ta.dev', 'ta.linreg',
            'ta.percentile_linear_interpolation', 'ta.percentile_nearest_rank', 'ta.percentrank', 'ta.pivothigh',
            'ta.pivotlow', 'ta.range', 'ta.stdev', 'ta.variance', 'ta.wma', 'ta.alma', 'ta.vwma', 'ta.swma',
            'ta.rma', 'ta.hma', 'ta.tsi', 'ta.cci', 'ta.cmo', 'ta.mfi', 'ta.obv', 'ta.pvt', 'ta.nvi',
            'ta.pvi', 'ta.wad'
        ];
        // Math functions
        if (funcName.startsWith('math.'))
            return 'float';
        // String functions
        if (funcName.startsWith('str.'))
            return 'string';
        // Strategy sizing helpers
        if (funcName === 'strategy.percent_of_equity')
            return 'float';
        // Strategy risk management functions
        if (funcName.startsWith('strategy.risk.'))
            return 'void';
        // Core strategy order functions
        if (funcName === 'strategy.entry' || funcName === 'strategy.order' || funcName === 'strategy.close' || funcName === 'strategy.close_all' || funcName === 'strategy.cancel' || funcName === 'strategy.cancel_all')
            return 'void';
        // Color functions
        if (funcName.startsWith('color.'))
            return 'color';
        // Input functions
        if (funcName.startsWith('input.'))
            return 'input';
        // Array namespace
        if (funcName.startsWith('array.')) {
            const member = funcName.split('.')[1];
            if (['new', 'copy', 'slice', 'from'].includes(member))
                return 'array';
            if (['size', 'indexof', 'lastindexof', 'includes'].includes(member))
                return 'int';
            if (member === 'get')
                return 'unknown';
            if (['push', 'pop', 'set', 'clear', 'reverse', 'sort', 'remove', 'insert', 'unshift', 'shift', 'fill'].includes(member))
                return 'void';
            return 'array';
        }
        // Map functions
        if (funcName.startsWith('map.')) {
            const member = funcName.split('.')[1];
            if (member === 'new' || member === 'copy')
                return 'map';
            if (member === 'size')
                return 'int';
            if (member === 'contains')
                return 'bool';
            if (member === 'get')
                return 'unknown'; // element type resolved by TypeInference module
            if (member === 'keys' || member === 'values')
                return 'array';
            if (['put', 'remove', 'clear', 'put_all'].includes(member))
                return 'void';
            return 'map';
        }
        // Matrix namespace
        if (funcName.startsWith('matrix.')) {
            const member = funcName.split('.')[1];
            if (member === 'new' || member === 'copy' || member === 'transpose')
                return 'matrix';
            if (['rows', 'columns', 'elements_count'].includes(member))
                return 'int';
            if (member === 'get')
                return 'unknown';
            if (['set', 'clear', 'fill', 'reverse', 'sort', 'remove_row', 'remove_col', 'swap_rows', 'swap_columns'].includes(member))
                return 'void';
            return 'matrix';
        }
        // Specific TA function return types
        if (taBooleanFunctions.includes(funcName))
            return 'bool';
        if (taFloatFunctions.includes(funcName))
            return 'series';
        // General TA functions (default to series)
        if (funcName.startsWith('ta.'))
            return 'series';
        // Plotting functions
        if (['plot', 'plotshape', 'plotchar', 'plotcandle', 'plotbar', 'bgcolor', 'hline', 'fill', 'barcolor'].includes(funcName)) {
            return 'series';
        }
        // Check if it's a user-defined function
        if (this.context.functionNames && this.context.functionNames.has(funcName)) {
            // For now, assume user functions return series
            return 'series';
        }
        // Default for most functions
        return 'series';
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
FunctionValidator.BUILTIN_SERIES_IDENTIFIERS = new Set([
    'open',
    'high',
    'low',
    'close',
    'volume',
    'time',
    'bar_index',
    'hl2',
    'hlc3',
    'ohlc4',
    'hlcc4',
]);
function isAstValidationContext(context) {
    return 'ast' in context;
}
