/**
 * Enhanced Type Inference validation module for Pine Script v6
 * Handles advanced type inference, type compatibility, and type safety
 */
import { visit } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';
import { BUILTIN_FUNCTIONS_V6_RULES } from '../core/constants';
const SERIES_IDENTIFIERS = new Set(['open', 'high', 'low', 'close', 'volume']);
const ARITHMETIC_OPERATORS = new Set(['+', '-', '*', '/', '%', '^']);
const COMPARISON_OPERATORS = new Set(['==', '!=', '>', '<', '>=', '<=']);
const ARRAY_TYPED_CONSTRUCTORS = {
    'array.new_bool': 'bool',
    'array.new_box': 'box',
    'array.new_color': 'color',
    'array.new_float': 'float',
    'array.new_int': 'int',
    'array.new_label': 'label',
    'array.new_line': 'line',
    'array.new_linefill': 'linefill',
    'array.new_string': 'string',
    'array.new_table': 'table',
};
export class TypeInferenceValidator {
    constructor() {
        this.name = 'TypeInferenceValidator';
        this.priority = 90; // Run before FunctionValidator to ensure type inference is complete
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.astTypeEnvironment = null;
    }
    getDependencies() {
        return ['SyntaxValidator', 'TypeValidator'];
    }
    validate(context, config) {
        this.reset();
        this.context = context;
        this.config = config;
        this.astContext = this.getAstContext(config);
        this.astTypeEnvironment = this.astContext?.typeEnvironment ?? null;
        const ast = this.astContext?.ast ?? null;
        const program = ast ?? null;
        if (!program) {
            return {
                isValid: true,
                errors: [],
                warnings: [],
                info: [],
                typeMap: new Map(),
                scriptType: null,
            };
        }
        this.validateWithAst(program);
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
        this.astTypeEnvironment = null;
    }
    // ──────────────────────────────────────────────────────────────────────────
    // AST-backed validation
    // ──────────────────────────────────────────────────────────────────────────
    validateWithAst(program) {
        visit(program, {
            VariableDeclaration: {
                enter: (path) => this.handleVariableDeclaration(path.node),
            },
            AssignmentStatement: {
                enter: (path) => this.handleAssignment(path.node),
            },
            IfStatement: {
                enter: (path) => this.handleIfStatement(path.node),
            },
            CallExpression: {
                enter: (path) => this.handleCallExpression(path.node),
            },
            BinaryExpression: {
                enter: (path) => this.handleBinaryExpression(path.node),
            },
        });
    }
    handleVariableDeclaration(node) {
        const initializer = node.initializer;
        if (!initializer) {
            return;
        }
        const declaredInfo = node.typeAnnotation ? this.parseTypeReference(node.typeAnnotation) : null;
        const declaredType = declaredInfo?.type ?? null;
        const declaredElementType = declaredInfo?.elementType;
        const declaredValueType = declaredInfo?.valueType;
        const initializerType = this.getExpressionType(initializer);
        const collectionInfo = this.inferCollectionTypeFromExpression(initializer);
        const { line, column } = node.loc.start;
        if (this.isNaExpression(initializer)) {
            this.addWarning(line, column, "Assigning 'na' directly can lead to ambiguous comparisons. Prefer using na() helpers for checks.", 'PSV6-TYPE-SAFETY-NA-FUNCTION');
        }
        // Check if initializer is a request function call that can return na
        if (this.isRequestFunctionCall(initializer)) {
            this.addWarning(line, column, "Request functions can return 'na' values. Ensure proper null-checking or use nz() for safety.", 'PSV6-TYPE-SAFETY-NA-FUNCTION');
        }
        if (!declaredType || declaredType === 'unknown') {
            if (!initializerType || initializerType === 'unknown') {
                this.addWarning(line, column, `Unable to infer type for '${node.identifier.name}'. Consider adding an explicit annotation.`, 'PSV6-TYPE-INFERENCE-AMBIGUOUS');
            }
            if (this.isLiteralExpression(initializer)) {
                this.addInfo(line, column, `Consider annotating '${node.identifier.name}' with its literal type for readability.`, 'PSV6-TYPE-ANNOTATION-SUGGESTION');
            }
            if (collectionInfo) {
                this.registerVariableTypeInfo(node.identifier.name, collectionInfo.type, collectionInfo.elementType, collectionInfo.keyType, collectionInfo.valueType, line, column, node.declarationKind === 'const');
            }
            return;
        }
        if (!initializerType || initializerType === 'unknown') {
            this.addWarning(line, column, `Unable to infer type for '${node.identifier.name}' initializer.`, 'PSV6-TYPE-INFERENCE-AMBIGUOUS');
            return;
        }
        if (declaredType === 'int' && initializerType === 'float') {
            this.addWarning(line, column, `Implicit float-to-int conversion for '${node.identifier.name}'. Cast explicitly to avoid truncation.`, 'PSV6-TYPE-CONVERSION-FLOAT-TO-INT');
            return;
        }
        if (!this.areTypesCompatible(declaredType, initializerType)) {
            this.addError(line, column, `Type mismatch: cannot assign ${initializerType} to ${declaredType} variable '${node.identifier.name}'.`, 'PSV6-TYPE-ASSIGNMENT-MISMATCH');
            this.addError(line, column, `Type annotation '${declaredType}' does not match assigned value type '${initializerType}'.`, 'PSV6-TYPE-ANNOTATION-MISMATCH');
            return;
        }
        if (this.isLiteralExpression(initializer)) {
            this.addInfo(line, column, `Type annotation '${declaredType}' for '${node.identifier.name}' is redundant for literal assignment.`, 'PSV6-TYPE-ANNOTATION-REDUNDANT');
        }
        this.registerVariableTypeInfo(node.identifier.name, declaredType, declaredElementType ?? collectionInfo?.elementType, declaredInfo?.keyType ?? collectionInfo?.keyType, declaredValueType ?? collectionInfo?.valueType, line, column, node.declarationKind === 'const');
    }
    handleAssignment(node) {
        if (!node.right) {
            return;
        }
        const right = node.right;
        const { line, column } = right.loc.start;
        if (this.isNaExpression(right)) {
            this.addWarning(line, column, "Assigning 'na' directly can lead to ambiguous comparisons. Prefer using na() helpers for checks.", 'PSV6-TYPE-SAFETY-NA-FUNCTION');
        }
        // Check if right side is a request function call that can return na
        if (this.isRequestFunctionCall(right)) {
            this.addWarning(line, column, "Request functions can return 'na' values. Ensure proper null-checking or use nz() for safety.", 'PSV6-TYPE-SAFETY-NA-FUNCTION');
        }
        const valueType = this.getExpressionType(right);
        if (!valueType || valueType === 'unknown') {
            this.addWarning(line, column, 'Unable to determine assignment type. The resulting value will be treated as series.', 'PSV6-TYPE-INFERENCE-AMBIGUOUS');
        }
        if (node.left.kind === 'Identifier') {
            const identifier = node.left;
            if (valueType && valueType !== 'unknown') {
                this.registerVariableTypeInfo(identifier.name, valueType, undefined, undefined, undefined, identifier.loc.start.line, identifier.loc.start.column, false);
            }
            const inferredCollection = this.inferCollectionTypeFromExpression(right);
            if (inferredCollection) {
                this.registerVariableTypeInfo(identifier.name, inferredCollection.type, inferredCollection.elementType, inferredCollection.keyType, inferredCollection.valueType, identifier.loc.start.line, identifier.loc.start.column, false);
            }
        }
    }
    handleIfStatement(node) {
        const test = node.test;
        const testType = this.getExpressionType(test);
        if (testType === 'bool') {
            return;
        }
        const { line, column } = test.loc.start;
        const isSeriesIdentifier = test.kind === 'Identifier' && SERIES_IDENTIFIERS.has(test.name);
        const isNumericLiteral = test.kind === 'NumberLiteral';
        const isStringLiteral = test.kind === 'StringLiteral';
        if (isNumericLiteral || isStringLiteral || isSeriesIdentifier || testType === 'series') {
            this.addWarning(line, column, 'Non-boolean expression used as condition.', 'PSV6-TYPE-CONDITIONAL-TYPE');
            this.addWarning(line, column, `Implicit boolean conversion of '${testType ?? 'unknown'}' expression.`, 'PSV6-TYPE-CONVERSION-IMPLICIT-BOOL');
            return;
        }
        this.addWarning(line, column, `Implicit boolean conversion of '${testType ?? 'unknown'}' expression.`, 'PSV6-TYPE-CONVERSION-IMPLICIT-BOOL');
    }
    handleCallExpression(node) {
        const calleeName = this.resolveCalleeName(node.callee);
        if (!calleeName) {
            return;
        }
        if (calleeName === 'str.tostring' && node.args.length > 0) {
            const argumentType = this.getExpressionType(node.args[0].value);
            if (argumentType === 'string') {
                const { line, column } = node.args[0].value.loc.start;
                this.addInfo(line, column, 'Calling str.tostring on an existing string is redundant.', 'PSV6-TYPE-CONVERSION-REDUNDANT-STRING');
            }
        }
        if (calleeName === 'ta.sma') {
            this.validateTaSmaCall(node);
            return;
        }
        if (calleeName === 'math.max') {
            this.validateMathMaxCall(node);
            return;
        }
        if (calleeName === 'ta.crossover') {
            this.validateTaCrossoverCall(node);
        }
    }
    handleBinaryExpression(node) {
        if (this.isNaExpression(node.left) || this.isNaExpression(node.right)) {
            const { line, column } = node.loc.start;
            if (ARITHMETIC_OPERATORS.has(node.operator)) {
                this.addWarning(line, column, "Arithmetic with 'na' literal always yields 'na'; guard against na before performing operations.", 'PSV6-TYPE-SAFETY-NA-ARITHMETIC');
            }
            else if (COMPARISON_OPERATORS.has(node.operator)) {
                this.addWarning(line, column, "Comparisons with 'na' literal are unsafe. Use na() helpers like na(value) instead.", 'PSV6-TYPE-SAFETY-NA-COMPARISON');
            }
        }
        if (!ARITHMETIC_OPERATORS.has(node.operator)) {
            return;
        }
        const leftType = this.getExpressionType(node.left);
        const rightType = this.getExpressionType(node.right);
        if (!this.isImplicitNumericConversion(leftType, rightType)) {
            return;
        }
        const { line, column } = node.loc.start;
        this.addWarning(line, column, 'Implicit numeric conversion detected. Cast explicitly to clarify intent.', 'PSV6-TYPE-CONVERSION');
    }
    isImplicitNumericConversion(leftType, rightType) {
        if (!leftType || !rightType) {
            return false;
        }
        return ((leftType === 'int' && rightType === 'float') ||
            (leftType === 'float' && rightType === 'int'));
    }
    validateTaSmaCall(node) {
        if (node.args.length === 0) {
            return;
        }
        const sourceArg = node.args[0];
        const lengthArg = node.args[1];
        const sourceType = this.getExpressionType(sourceArg.value);
        if (sourceType && (sourceType === 'string' || sourceType === 'bool')) {
            const { line, column } = sourceArg.value.loc.start;
            this.addError(line, column, `ta.sma source expects numeric series but received ${sourceType}.`, 'PSV6-TYPE-FUNCTION-PARAM-MISMATCH');
        }
        if (lengthArg) {
            const lengthType = this.getExpressionType(lengthArg.value);
            const isIntegralLiteral = lengthArg.value.kind === 'NumberLiteral' && Number.isInteger(lengthArg.value.value);
            if (lengthType && lengthType !== 'int') {
                if (lengthType === 'float' && isIntegralLiteral) {
                    return;
                }
                const { line, column } = lengthArg.value.loc.start;
                this.addError(line, column, `ta.sma length expects int but received ${lengthType}.`, 'PSV6-TYPE-FUNCTION-PARAM-MISMATCH');
            }
        }
    }
    validateMathMaxCall(node) {
        const [firstArg, secondArg] = node.args;
        if (!firstArg || !secondArg) {
            return;
        }
        const firstType = this.getExpressionType(firstArg.value);
        const secondType = this.getExpressionType(secondArg.value);
        if (firstType && !this.isNumericType(firstType)) {
            const { line, column } = firstArg.value.loc.start;
            this.addError(line, column, `math.max expects numeric arguments but received ${firstType}.`, 'PSV6-TYPE-FUNCTION-PARAM-MISMATCH');
        }
        if (secondType && !this.isNumericType(secondType)) {
            const { line, column } = secondArg.value.loc.start;
            this.addError(line, column, `math.max expects numeric arguments but received ${secondType}.`, 'PSV6-TYPE-FUNCTION-PARAM-MISMATCH');
        }
    }
    validateTaCrossoverCall(node) {
        if (node.args.length < 2) {
            return;
        }
        const firstType = this.getExpressionType(node.args[0].value);
        const secondType = this.getExpressionType(node.args[1].value);
        if (firstType && (firstType === 'string' || firstType === 'bool')) {
            const { line, column } = node.args[0].value.loc.start;
            this.addError(line, column, `ta.crossover arguments must be numeric series but received ${firstType}.`, 'PSV6-TYPE-FUNCTION-PARAM-MISMATCH');
        }
        if (secondType && (secondType === 'string' || secondType === 'bool')) {
            const { line, column } = node.args[1].value.loc.start;
            this.addError(line, column, `ta.crossover arguments must be numeric series but received ${secondType}.`, 'PSV6-TYPE-FUNCTION-PARAM-MISMATCH');
        }
    }
    getExpressionType(expression) {
        let resolved = null;
        if (this.astTypeEnvironment) {
            const metadata = this.astTypeEnvironment.nodeTypes.get(expression);
            const described = this.describeTypeMetadata(metadata);
            if (described && described !== 'unknown') {
                resolved = described;
            }
            if (expression.kind === 'Identifier') {
                const name = expression.name;
                const identifierMetadata = this.astTypeEnvironment.identifiers.get(name);
                const identifierType = this.describeTypeMetadata(identifierMetadata ?? null);
                if (identifierType && identifierType !== 'unknown') {
                    resolved = resolved ? this.mergeIdentifierTypes(resolved, identifierType) : identifierType;
                }
                const mappedType = this.context.typeMap?.get(name);
                if (mappedType) {
                    const normalized = mappedType.type === 'series' ? 'series' : mappedType.type;
                    if (normalized && normalized !== 'unknown') {
                        resolved = resolved ? this.mergeIdentifierTypes(resolved, normalized) : normalized;
                    }
                }
            }
        }
        if ((!resolved || resolved === 'unknown' || resolved === 'udt') && expression.kind === 'Identifier') {
            const mappedType = this.context.typeMap?.get(expression.name);
            if (mappedType) {
                const normalized = mappedType.type === 'series' ? 'series' : mappedType.type;
                if (normalized && normalized !== 'unknown') {
                    resolved = normalized;
                }
            }
        }
        const shouldRefine = resolved === 'udt';
        if (resolved && resolved !== 'unknown' && !shouldRefine) {
            return resolved;
        }
        if (expression.kind === 'CallExpression') {
            const call = expression;
            const calleeName = this.resolveCalleeName(call.callee);
            if (calleeName) {
                const builtinReturn = this.getBuiltinReturnType(calleeName);
                if (builtinReturn) {
                    return this.normalizeType(builtinReturn);
                }
            }
        }
        if (expression.kind === 'ConditionalExpression') {
            const conditional = expression;
            const consequentType = this.getExpressionType(conditional.consequent);
            const alternateType = conditional.alternate ? this.getExpressionType(conditional.alternate) : null;
            const merged = this.mergeConditionalTypes(consequentType, alternateType);
            if (merged) {
                return merged;
            }
        }
        const literal = this.inferLiteralType(expression);
        if (literal) {
            return literal;
        }
        if (resolved && resolved !== 'unknown') {
            return resolved;
        }
        return null;
    }
    mergeIdentifierTypes(existing, candidate) {
        if (existing === candidate) {
            return existing;
        }
        if (existing === 'udt' && candidate !== 'unknown') {
            return candidate;
        }
        if (candidate === 'udt' && existing !== 'unknown') {
            return existing;
        }
        if (existing === 'float' && candidate === 'int') {
            return 'int';
        }
        if (candidate === 'float' && existing === 'int') {
            return 'int';
        }
        if (existing === 'series' || candidate === 'series') {
            return 'series';
        }
        return existing;
    }
    mergeConditionalTypes(consequentType, alternateType) {
        if (!consequentType && !alternateType) {
            return null;
        }
        if (consequentType && !alternateType) {
            return consequentType;
        }
        if (!consequentType && alternateType) {
            return alternateType;
        }
        if (consequentType === alternateType) {
            return consequentType;
        }
        const prioritized = new Set(['series', 'color', 'float', 'int', 'bool', 'string']);
        if (consequentType && alternateType) {
            if (prioritized.has(consequentType) && prioritized.has(alternateType)) {
                if (consequentType === 'series' || alternateType === 'series') {
                    return 'series';
                }
                if (consequentType === 'color' || alternateType === 'color') {
                    return 'color';
                }
                if ((consequentType === 'float' && alternateType === 'int') ||
                    (consequentType === 'int' && alternateType === 'float')) {
                    return 'float';
                }
                if (consequentType === 'bool' && alternateType === 'bool') {
                    return 'bool';
                }
                if (consequentType === 'string' && alternateType === 'string') {
                    return 'string';
                }
            }
        }
        return null;
    }
    describeTypeMetadata(metadata) {
        if (!metadata) {
            return null;
        }
        return metadata.kind;
    }
    getBuiltinReturnType(calleeName) {
        const rules = BUILTIN_FUNCTIONS_V6_RULES[calleeName];
        if (!rules) {
            return null;
        }
        if (typeof rules.returnType === 'string' && rules.returnType.length > 0) {
            return rules.returnType;
        }
        if (Array.isArray(rules.overloads)) {
            for (const overload of rules.overloads) {
                if (typeof overload.returnType === 'string' && overload.returnType.length > 0) {
                    return overload.returnType;
                }
            }
        }
        return null;
    }
    inferLiteralType(expression) {
        switch (expression.kind) {
            case 'NumberLiteral': {
                const literal = expression;
                return Number.isInteger(literal.value) ? 'int' : 'float';
            }
            case 'BooleanLiteral':
                return 'bool';
            case 'StringLiteral':
                return 'string';
            case 'ColorLiteral':
                return 'color';
            default:
                return null;
        }
    }
    isLiteralExpression(expression) {
        return (expression.kind === 'NumberLiteral' ||
            expression.kind === 'BooleanLiteral' ||
            expression.kind === 'StringLiteral' ||
            expression.kind === 'ColorLiteral');
    }
    isNaExpression(expression) {
        // Check for both Identifier('na') and NullLiteral (which the parser uses for na)
        if (expression.kind === 'NullLiteral') {
            return true;
        }
        return expression.kind === 'Identifier' && expression.name === 'na';
    }
    isRequestFunctionCall(expression) {
        if (expression.kind !== 'CallExpression') {
            return false;
        }
        const callExpr = expression;
        const callee = callExpr.callee;
        if (callee.kind === 'MemberExpression') {
            const member = callee;
            if (member.object.kind === 'Identifier') {
                const objName = member.object.name;
                const propName = member.property.name;
                // Check if it's a request.* function
                if (objName === 'request') {
                    const requestFunctions = new Set([
                        'security', 'security_lower_tf', 'financial', 'economic',
                        'quandl', 'dividends', 'splits', 'earnings', 'seed', 'currency_rate'
                    ]);
                    return requestFunctions.has(propName);
                }
            }
        }
        return false;
    }
    isNumericType(type) {
        return type === 'int' || type === 'float' || type === 'series';
    }
    areTypesCompatible(expected, actual) {
        if (!actual) {
            return false;
        }
        if (expected === actual) {
            return true;
        }
        if (expected === 'float' && actual === 'int') {
            return true;
        }
        if (expected === 'series' && this.isNumericType(actual)) {
            return true;
        }
        if (this.isNumericType(expected) && actual === 'series') {
            return true;
        }
        return false;
    }
    resolveCalleeName(expression) {
        if (expression.kind === 'Identifier') {
            return expression.name;
        }
        if (expression.kind === 'MemberExpression') {
            const member = expression;
            if (member.computed) {
                return null;
            }
            const objectName = this.resolveCalleeName(member.object);
            if (!objectName) {
                return null;
            }
            return `${objectName}.${member.property.name}`;
        }
        return null;
    }
    parseTypeReference(reference) {
        const baseType = this.normalizeType(reference.name.name);
        if (baseType === 'array' || baseType === 'matrix') {
            const generic = reference.generics[0];
            const elementType = generic ? this.formatTypeReference(generic) : undefined;
            return elementType ? { type: baseType, elementType } : { type: baseType };
        }
        if (baseType === 'map') {
            const generics = reference.generics.map((generic) => this.formatTypeReference(generic)).filter(Boolean);
            const keyType = generics.length > 1 ? generics[0] : 'string';
            const valueType = generics.length > 0 ? generics[generics.length - 1] : undefined;
            return {
                type: baseType,
                keyType,
                valueType,
            };
        }
        return { type: baseType };
    }
    formatTypeReference(reference) {
        const base = reference.name.name;
        if (!reference.generics.length) {
            return base;
        }
        const generics = reference.generics
            .map((generic) => this.formatTypeReference(generic))
            .filter((value) => value.length > 0);
        if (!generics.length) {
            return base;
        }
        return `${base}<${generics.join(', ')}>`;
    }
    inferCollectionTypeFromExpression(expression) {
        if (expression.kind !== 'CallExpression') {
            return null;
        }
        const call = expression;
        const calleeName = this.resolveCalleeName(call.callee);
        if (!calleeName) {
            return null;
        }
        if (calleeName.startsWith('array.new')) {
            const elementType = this.extractArrayElementType(call, calleeName);
            return elementType ? { type: 'array', elementType } : { type: 'array' };
        }
        if (calleeName === 'matrix.new') {
            const elementType = this.extractMatrixElementType(call);
            return elementType ? { type: 'matrix', elementType } : { type: 'matrix' };
        }
        if (calleeName === 'map.new') {
            const { keyType, valueType } = this.extractMapTypes(call);
            return {
                type: 'map',
                keyType,
                valueType,
            };
        }
        return null;
    }
    extractArrayElementType(call, calleeName) {
        if (Array.isArray(call.typeArguments) && call.typeArguments.length > 0) {
            const formatted = this.formatTypeReference(call.typeArguments[0]);
            if (formatted) {
                return formatted;
            }
        }
        const typedConstructor = ARRAY_TYPED_CONSTRUCTORS[calleeName];
        if (typedConstructor) {
            return typedConstructor;
        }
        if (calleeName === 'array.new' && call.args.length >= 2) {
            const resolved = this.resolveTypeIdentifier(call.args[0].value);
            if (resolved) {
                return resolved;
            }
        }
        return undefined;
    }
    extractMatrixElementType(call) {
        if (Array.isArray(call.typeArguments) && call.typeArguments.length > 0) {
            const formatted = this.formatTypeReference(call.typeArguments[0]);
            if (formatted) {
                return formatted;
            }
        }
        if (call.args.length >= 3) {
            const resolved = this.resolveTypeIdentifier(call.args[0].value);
            if (resolved) {
                return resolved;
            }
        }
        return undefined;
    }
    extractMapTypes(call) {
        if (Array.isArray(call.typeArguments) && call.typeArguments.length > 0) {
            const generics = call.typeArguments.map((arg) => this.formatTypeReference(arg)).filter(Boolean);
            const keyType = generics.length > 1 ? generics[0] : 'string';
            const valueType = generics.length > 0 ? generics[generics.length - 1] : undefined;
            return { keyType, valueType };
        }
        return { keyType: 'string' };
    }
    resolveTypeIdentifier(expression) {
        if (expression.kind === 'Identifier') {
            return expression.name;
        }
        if (expression.kind === 'StringLiteral') {
            return expression.value;
        }
        return null;
    }
    registerVariableTypeInfo(name, type, elementType, keyType, valueType, line, column, isConst) {
        if (!type || type === 'unknown') {
            return;
        }
        const normalizedElement = elementType && elementType !== 'unknown' ? elementType : undefined;
        const normalizedValue = valueType && valueType !== 'unknown' ? valueType : undefined;
        const normalizedKey = keyType && keyType !== 'unknown' ? keyType : type === 'map' ? 'string' : undefined;
        const existing = this.context.typeMap.get(name);
        if (existing) {
            const updated = { ...existing };
            let changed = false;
            if (!updated.type) {
                updated.type = type;
                updated.isSeries = type === 'series' || updated.isSeries;
                changed = true;
            }
            if (normalizedElement && (!updated.elementType || updated.elementType === 'unknown')) {
                updated.elementType = normalizedElement;
                changed = true;
            }
            if (normalizedKey && (!updated.keyType || updated.keyType === 'unknown')) {
                updated.keyType = normalizedKey;
                changed = true;
            }
            if (normalizedValue && (!updated.valueType || updated.valueType === 'unknown')) {
                updated.valueType = normalizedValue;
                changed = true;
            }
            if (changed) {
                this.context.typeMap.set(name, updated);
            }
            return;
        }
        const info = {
            type,
            isConst,
            isSeries: type === 'series',
            declaredAt: { line, column },
            usages: [],
        };
        if (normalizedElement) {
            info.elementType = normalizedElement;
        }
        if (normalizedKey) {
            info.keyType = normalizedKey;
        }
        if (normalizedValue) {
            info.valueType = normalizedValue;
        }
        this.context.typeMap.set(name, info);
    }
    getAstContext(config) {
        return ensureAstContext(this.context, config);
    }
    addError(line, column, message, code) {
        this.errors.push({
            line,
            column,
            message,
            code,
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
    getVariableType(varName) {
        const typeInfo = this.context.typeMap.get(varName);
        if (!typeInfo) {
            return null;
        }
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
    normalizeType(type) {
        // Normalize type strings to match the TypeInfo union type
        const validTypes = ['int', 'float', 'bool', 'string', 'color', 'series', 'line', 'label', 'box', 'table', 'array', 'matrix', 'map', 'udt'];
        if (validTypes.includes(type)) {
            return type;
        }
        // Handle common variations
        if (type === 'series bool' || type === 'series int' || type === 'series float') {
            return 'series';
        }
        // Treat Pine 'na' literal as numeric for compatibility
        if (type === 'na') {
            return 'float';
        }
        return 'unknown';
    }
}
