/**
 * Array validation module for Pine Script v6
 * Handles array declarations, operations, performance, and best practices
 */
import { findAncestor, visit } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';
import { getNodeSource } from '../core/ast/source-utils';
const VALID_ARRAY_ELEMENT_TYPES = new Set([
    'int',
    'float',
    'bool',
    'string',
    'color',
    'line',
    'label',
    'box',
    'table',
    'linefill',
    'chart.point',
]);
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
const ARRAY_METHOD_SPECS = [
    { name: 'array.push', params: 2, description: 'array.push(id, value)' },
    { name: 'array.pop', params: 1, description: 'array.pop(id)' },
    { name: 'array.get', params: 2, description: 'array.get(id, index)' },
    { name: 'array.set', params: 3, description: 'array.set(id, index, value)' },
    { name: 'array.size', params: 1, description: 'array.size(id)' },
    { name: 'array.clear', params: 1, description: 'array.clear(id)' },
    { name: 'array.reverse', params: 1, description: 'array.reverse(id)' },
    { name: 'array.sort', params: 1, description: 'array.sort(id)' },
    { name: 'array.sort_indices', params: 1, description: 'array.sort_indices(id)' },
    { name: 'array.copy', params: 1, description: 'array.copy(id)' },
    { name: 'array.slice', params: 3, description: 'array.slice(id, start, end)' },
    { name: 'array.concat', params: 2, description: 'array.concat(id, other)' },
    { name: 'array.fill', params: 2, description: 'array.fill(id, value)' },
    { name: 'array.from', description: 'array.from(source, ...values)' },
    { name: 'array.from_example', description: 'array.from_example(id, example)' },
    { name: 'array.indexof', params: 2, description: 'array.indexof(id, value)' },
    { name: 'array.lastindexof', params: 2, description: 'array.lastindexof(id, value)' },
    { name: 'array.includes', params: 2, description: 'array.includes(id, value)' },
    { name: 'array.binary_search', description: 'array.binary_search(id, value, comparator?)' },
    { name: 'array.binary_search_leftmost', description: 'array.binary_search_leftmost(id, value)' },
    { name: 'array.binary_search_rightmost', description: 'array.binary_search_rightmost(id, value)' },
    { name: 'array.range', params: 3, description: 'array.range(id, start, end)' },
    { name: 'array.remove', params: 2, description: 'array.remove(id, index)' },
    { name: 'array.insert', params: 3, description: 'array.insert(id, index, value)' },
    { name: 'array.first', params: 1, description: 'array.first(id)' },
    { name: 'array.last', params: 1, description: 'array.last(id)' },
    { name: 'array.max', params: 1, description: 'array.max(id)' },
    { name: 'array.min', params: 1, description: 'array.min(id)' },
    { name: 'array.median', params: 1, description: 'array.median(id)' },
    { name: 'array.mode', params: 1, description: 'array.mode(id)' },
    { name: 'array.abs', params: 1, description: 'array.abs(id)' },
    { name: 'array.sum', params: 1, description: 'array.sum(id)' },
    { name: 'array.avg', params: 1, description: 'array.avg(id)' },
    { name: 'array.stdev', params: 1, description: 'array.stdev(id)' },
    { name: 'array.variance', params: 1, description: 'array.variance(id)' },
    { name: 'array.standardize', params: 1, description: 'array.standardize(id)' },
    { name: 'array.covariance', params: 2, description: 'array.covariance(id, other)' },
    { name: 'array.percentile_linear_interpolation', description: 'array.percentile_linear_interpolation(id, percentile)' },
    { name: 'array.percentile_nearest_rank', description: 'array.percentile_nearest_rank(id, percentile)' },
    { name: 'array.percentrank', description: 'array.percentrank(id, percentile)' },
    { name: 'array.some', params: 2, description: 'array.some(id, predicate)' },
    { name: 'array.every', params: 2, description: 'array.every(id, predicate)' },
];
const EXPENSIVE_ARRAY_METHODS = new Set(['array.reverse', 'array.sort', 'array.copy']);
export class ArrayValidator {
    constructor() {
        this.name = 'ArrayValidator';
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        // Array tracking
        this.arrayDeclarations = new Map();
        this.arrayAllocations = 0;
        this.arrayUsage = new Map();
        this.knownUdtTypes = new Set();
    }
    getDependencies() {
        return ['FunctionValidator'];
    }
    getPriority() {
        return 80; // Run after FunctionValidator to benefit from function type information
    }
    validate(context, config) {
        this.reset();
        this.context = context;
        this.astContext = this.getAstContext(config);
        if (!this.astContext?.ast) {
            return {
                isValid: true,
                errors: [],
                warnings: [],
                info: [],
                typeMap: context.typeMap,
                scriptType: context.scriptType,
            };
        }
        this.knownUdtTypes = this.collectKnownUdtTypes();
        this.collectArrayDataAst(this.astContext.ast);
        this.validateArrayPerformanceAst();
        this.validateArrayBestPracticesAst();
        return {
            isValid: this.errors.length === 0,
            errors: this.errors.map(e => ({ ...e, severity: 'error' })),
            warnings: this.warnings.map(w => ({ ...w, severity: 'warning' })),
            info: this.info.map(i => ({ ...i, severity: 'info' })),
            typeMap: context.typeMap,
            scriptType: context.scriptType
        };
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.arrayDeclarations.clear();
        this.arrayAllocations = 0;
        this.arrayUsage.clear();
        this.knownUdtTypes.clear();
    }
    addError(line, column, message, code) {
        this.errors.push({ line, column, message, code });
    }
    addWarning(line, column, message, code) {
        this.warnings.push({ line, column, message, code });
    }
    addInfo(line, column, message, code) {
        this.info.push({ line, column, message, code });
    }
    collectArrayDataAst(program) {
        const loopStack = [];
        visit(program, {
            ForStatement: {
                enter: (path) => {
                    loopStack.push(path);
                },
                exit: () => {
                    loopStack.pop();
                },
            },
            WhileStatement: {
                enter: (path) => {
                    loopStack.push(path);
                },
                exit: () => {
                    loopStack.pop();
                },
            },
            RepeatStatement: {
                enter: (path) => {
                    loopStack.push(path);
                },
                exit: () => {
                    loopStack.pop();
                },
            },
            VariableDeclaration: {
                enter: (path) => {
                    this.registerArrayTypeAnnotation(path.node);
                },
            },
            CallExpression: {
                enter: (path) => {
                    const call = path.node;
                    const qualifiedName = this.getExpressionQualifiedName(call.callee);
                    if (!qualifiedName || !qualifiedName.startsWith('array.')) {
                        return;
                    }
                    if (qualifiedName.startsWith('array.new')) {
                        this.handleArrayCreationAst(qualifiedName, call, path);
                    }
                    else {
                        this.handleArrayMethodCallAst(qualifiedName, call, path, loopStack.length > 0);
                    }
                },
            },
        });
    }
    registerArrayTypeAnnotation(declaration) {
        const typeAnnotation = declaration.typeAnnotation;
        if (!typeAnnotation) {
            return;
        }
        const elementType = this.extractArrayAnnotationElement(typeAnnotation);
        if (!elementType) {
            return;
        }
        const identifier = declaration.identifier;
        const name = identifier.name;
        const line = identifier.loc.start.line;
        const column = identifier.loc.start.column;
        const existing = this.arrayDeclarations.get(name);
        const size = existing?.size ?? 0;
        this.arrayDeclarations.set(name, {
            type: elementType,
            elementType,
            size,
            line,
            column,
        });
        this.context.typeMap.set(name, {
            type: 'array',
            isConst: declaration.declarationKind === 'const',
            isSeries: false,
            declaredAt: { line, column },
            usages: [],
            elementType,
        });
    }
    handleArrayCreationAst(qualifiedName, call, path) {
        if (process.env.DEBUG_ARRAY === '1') {
            // eslint-disable-next-line no-console
            console.log('[ArrayValidator] creation', {
                qualifiedName,
                args: call.args.map(arg => this.getExpressionText(arg.value)),
                typeArguments: Array.isArray(call.typeArguments)
                    ? call.typeArguments.map(arg => this.formatTypeReference(arg))
                    : null,
                loc: call.loc,
            });
        }
        this.arrayAllocations++;
        const target = this.extractArrayAssignmentTarget(path);
        const line = call.loc.start.line;
        const column = call.loc.start.column;
        const elementType = this.inferArrayElementTypeFromCall(qualifiedName, call);
        const typeValid = elementType && elementType !== 'unknown'
            ? this.validateArrayType(elementType, line, column)
            : false;
        const size = this.extractArraySizeFromCall(qualifiedName, call);
        if (typeof size === 'number') {
            this.validateArraySize(size, line, column);
        }
        const genericType = this.extractCallGenericElementType(call);
        const usesTypedConstructor = qualifiedName in ARRAY_TYPED_CONSTRUCTORS;
        const usesGenerics = Boolean(genericType);
        const usesLegacySyntax = !usesTypedConstructor && !usesGenerics;
        let hasSyntaxError = false;
        if (!usesTypedConstructor && !usesGenerics && call.args.length === 0) {
            hasSyntaxError = true;
        }
        if (usesTypedConstructor && call.args.length === 0) {
            hasSyntaxError = true;
        }
        if (usesLegacySyntax) {
            if (call.args.length === 0) {
                hasSyntaxError = true;
            }
            else if (call.args.length === 1) {
                const firstArgType = this.resolveTypeIdentifier(call.args[0].value);
                if (!firstArgType) {
                    hasSyntaxError = true;
                }
                else {
                    hasSyntaxError = true;
                }
            }
        }
        if (!typeValid && elementType && elementType !== 'unknown') {
            hasSyntaxError = true;
        }
        if (!elementType || elementType === 'unknown') {
            hasSyntaxError = true;
        }
        if (target) {
            const info = this.arrayDeclarations.get(target.name) ?? {
                type: elementType,
                elementType,
                size: typeof size === 'number' ? size : 0,
                line: target.line,
                column: target.column,
            };
            info.type = elementType;
            info.elementType = elementType;
            if (typeof size === 'number') {
                info.size = size;
            }
            info.line = target.line;
            info.column = target.column;
            this.arrayDeclarations.set(target.name, info);
            this.context.typeMap.set(target.name, {
                type: 'array',
                isConst: false,
                isSeries: false,
                declaredAt: { line: target.line, column: target.column },
                usages: [],
                elementType,
            });
        }
        if (hasSyntaxError) {
            const name = target?.name ?? this.getExpressionText(call.callee);
            this.addError(line, column, `Invalid array declaration syntax for '${name}'.`, 'PSV6-ARRAY-INVALID-SYNTAX');
        }
    }
    handleArrayMethodCallAst(qualifiedName, call, _path, inLoop) {
        const line = call.loc.start.line;
        const column = call.loc.start.column;
        const spec = ARRAY_METHOD_SPECS.find((entry) => entry.name === qualifiedName);
        const args = call.args;
        if (spec?.params !== undefined && args.length !== spec.params) {
            this.addError(line, column, `Invalid parameter count for ${qualifiedName}. Expected ${spec.params}, got ${args.length}. Usage: ${spec.description}`, 'PSV6-ARRAY-METHOD-PARAMS');
        }
        const arrayArgument = args[0]?.value ?? null;
        const arrayName = arrayArgument ? this.validateArrayVariableAst(arrayArgument, line, column) : null;
        if (qualifiedName === 'array.get' && arrayName && args[1]) {
            this.validateArrayIndexAst(arrayName, args[1], line, column);
        }
        if (qualifiedName === 'array.set' && arrayName) {
            if (args[1]) {
                this.validateArrayIndexAst(arrayName, args[1], line, column);
            }
            if (args[2]) {
                this.validateArrayValueTypeAst(arrayName, args[2].value, line, column, 'set');
            }
        }
        if (qualifiedName === 'array.push' && arrayName && args[1]) {
            this.validateArrayValueTypeAst(arrayName, args[1].value, line, column, 'push');
        }
        if (qualifiedName === 'array.push' && arrayName) {
            this.recordArrayUsage(arrayName, 'push', line);
        }
        if (qualifiedName === 'array.set' && arrayName) {
            this.recordArrayUsage(arrayName, 'set', line);
        }
        if (qualifiedName === 'array.clear' && arrayName) {
            this.recordArrayUsage(arrayName, 'clear', line);
        }
        if (inLoop && EXPENSIVE_ARRAY_METHODS.has(qualifiedName)) {
            this.addWarning(line, column, `Expensive array operation '${qualifiedName}' detected in loop`, 'PSV6-ARRAY-PERF-LOOP');
        }
    }
    extractArrayAssignmentTarget(path) {
        const declarationPath = findAncestor(path, (ancestor) => {
            return ancestor.node.kind === 'VariableDeclaration';
        });
        if (declarationPath) {
            const declaration = declarationPath.node;
            if (declaration.initializer === path.node) {
                const identifier = declaration.identifier;
                return {
                    name: identifier.name,
                    line: identifier.loc.start.line,
                    column: identifier.loc.start.column,
                };
            }
        }
        const assignmentPath = findAncestor(path, (ancestor) => {
            return ancestor.node.kind === 'AssignmentStatement';
        });
        if (assignmentPath) {
            const assignment = assignmentPath.node;
            if (assignment.right === path.node && assignment.left.kind === 'Identifier') {
                const identifier = assignment.left;
                return {
                    name: identifier.name,
                    line: identifier.loc.start.line,
                    column: identifier.loc.start.column,
                };
            }
        }
        return null;
    }
    inferArrayElementTypeFromCall(qualifiedName, call) {
        const typedConstructor = ARRAY_TYPED_CONSTRUCTORS[qualifiedName];
        if (typedConstructor) {
            return typedConstructor;
        }
        const genericType = this.extractCallGenericElementType(call);
        if (genericType) {
            return genericType;
        }
        if (qualifiedName === 'array.new' && call.args.length > 0) {
            const first = call.args[0];
            const literalType = this.resolveTypeIdentifier(first.value);
            if (literalType) {
                return literalType;
            }
        }
        return 'unknown';
    }
    extractArraySizeFromCall(qualifiedName, call) {
        if (qualifiedName in ARRAY_TYPED_CONSTRUCTORS) {
            const firstArgument = call.args[0]?.value;
            return firstArgument ? this.extractNumericLiteral(firstArgument) ?? 0 : 0;
        }
        const genericType = this.extractCallGenericElementType(call);
        if (qualifiedName === 'array.new' && genericType) {
            const sizeArgument = call.args[0]?.value;
            return sizeArgument ? this.extractNumericLiteral(sizeArgument) ?? 0 : 0;
        }
        if (qualifiedName === 'array.new' && call.args.length >= 2) {
            const sizeArgument = call.args[1]?.value;
            return sizeArgument ? this.extractNumericLiteral(sizeArgument) ?? 0 : 0;
        }
        return null;
    }
    validateArrayVariableAst(argument, line, column) {
        const name = this.getIdentifierName(argument);
        if (!name) {
            return null;
        }
        if (this.isArrayIdentifier(name)) {
            return name;
        }
        if (this.isFunctionParameter(name)) {
            return name;
        }
        this.addError(line, column, `Variable '${name}' is not declared as an array`, 'PSV6-ARRAY-NOT-ARRAY');
        return name;
    }
    validateArrayIndexAst(arrayName, argument, line, column) {
        const arrayInfo = this.arrayDeclarations.get(arrayName);
        if (!arrayInfo) {
            return;
        }
        const value = this.extractNumericLiteral(argument.value);
        if (value === null) {
            return;
        }
        const size = arrayInfo.size;
        if (value >= size && size > 0) {
            this.addWarning(line, column, `Array index ${value} is out of bounds for array of size ${size}`, 'PSV6-ARRAY-INDEX-BOUNDS');
        }
        if (value < 0 && Math.abs(value) > size) {
            this.addWarning(line, column, `Negative array index ${value} is out of bounds for array of size ${size}`, 'PSV6-ARRAY-INDEX-BOUNDS');
        }
    }
    validateArrayValueTypeAst(arrayName, expression, line, column, operation) {
        const arrayInfo = this.arrayDeclarations.get(arrayName);
        if (!arrayInfo) {
            return;
        }
        const valueType = this.inferExpressionTypeAst(expression);
        if (!valueType || valueType === 'unknown' || arrayInfo.elementType === 'unknown') {
            return;
        }
        if (!this.areTypesCompatible(arrayInfo.elementType, valueType)) {
            const action = operation === 'push' ? 'push' : 'set';
            this.addError(line, column, `Type mismatch: cannot ${action} ${valueType} ${operation === 'push' ? 'to' : 'in'} ${arrayInfo.elementType} array '${arrayName}'`, 'PSV6-ARRAY-TYPE-MISMATCH');
        }
    }
    recordArrayUsage(name, kind, line) {
        const usage = this.arrayUsage.get(name) ?? { pushes: [], sets: [], clears: [] };
        if (kind === 'push') {
            usage.pushes.push(line);
        }
        else if (kind === 'set') {
            usage.sets.push(line);
        }
        else if (kind === 'clear') {
            usage.clears.push(line);
        }
        this.arrayUsage.set(name, usage);
    }
    extractCallGenericElementType(call) {
        if (Array.isArray(call.typeArguments) && call.typeArguments.length > 0) {
            const first = call.typeArguments[0];
            const formatted = this.formatTypeReference(first);
            if (formatted) {
                return formatted;
            }
        }
        return null;
    }
    resolveTypeIdentifier(expression) {
        if (expression.kind === 'Identifier') {
            return expression.name;
        }
        if (expression.kind === 'StringLiteral') {
            const raw = this.getExpressionText(expression).replace(/^['"]|['"]$/g, '');
            return raw;
        }
        return null;
    }
    extractArrayAnnotationElement(type) {
        if (type.name.name === 'array' && type.generics.length > 0) {
            const generic = type.generics[0];
            return this.formatTypeReference(generic);
        }
        return null;
    }
    formatTypeReference(type) {
        const base = type.name.name;
        if (!base) {
            return '';
        }
        if (!Array.isArray(type.generics) || type.generics.length === 0) {
            return base;
        }
        const generics = type.generics
            .map((generic) => this.formatTypeReference(generic))
            .filter((name) => name.length > 0);
        if (generics.length === 0) {
            return base;
        }
        return `${base}<${generics.join(', ')}>`;
    }
    isArrayIdentifier(name) {
        const info = this.arrayDeclarations.get(name);
        if (info) {
            return true;
        }
        const typeInfo = this.context.typeMap.get(name);
        if (typeInfo?.type === 'array') {
            return true;
        }
        return false;
    }
    isFunctionParameter(name) {
        if (!this.astContext) {
            return false;
        }
        const record = this.astContext.symbolTable.get(name);
        if (!record) {
            return false;
        }
        const kinds = record.metadata?.declarationKinds ?? [];
        return kinds.includes('parameter');
    }
    inferExpressionTypeAst(expression) {
        switch (expression.kind) {
            case 'StringLiteral':
                return 'string';
            case 'BooleanLiteral':
                return 'bool';
            case 'NullLiteral':
                return 'unknown';
            case 'NumberLiteral': {
                const number = expression;
                const raw = number.raw ?? '';
                const isFloat = raw.includes('.') || /[eE]/.test(raw);
                return !isFloat && Number.isInteger(number.value) ? 'int' : 'float';
            }
            case 'Identifier': {
                const name = expression.name;
                const arrayInfo = this.arrayDeclarations.get(name);
                if (arrayInfo) {
                    return 'array';
                }
                const typeInfo = this.context.typeMap.get(name);
                if (typeInfo) {
                    return typeInfo.elementType ?? typeInfo.type;
                }
                return 'unknown';
            }
            case 'MemberExpression': {
                const text = this.getExpressionText(expression);
                if (text.startsWith('color.') || text.startsWith('#') || text.startsWith('rgb')) {
                    return 'color';
                }
                return 'unknown';
            }
            case 'CallExpression': {
                const call = expression;
                const qualified = this.getExpressionQualifiedName(call.callee);
                if (!qualified) {
                    return 'unknown';
                }
                if (qualified === 'array.get' && call.args.length > 0) {
                    const name = this.getIdentifierName(call.args[0].value);
                    if (name) {
                        const info = this.arrayDeclarations.get(name);
                        if (info) {
                            return info.elementType;
                        }
                    }
                }
                if (qualified.startsWith('array.new')) {
                    return 'array';
                }
                if (qualified.startsWith('ta.')) {
                    return 'series';
                }
                if (qualified.startsWith('math.')) {
                    return 'float';
                }
                return 'unknown';
            }
            case 'BinaryExpression': {
                const binary = expression;
                if (binary.operator === '+') {
                    const leftType = this.inferExpressionTypeAst(binary.left);
                    const rightType = this.inferExpressionTypeAst(binary.right);
                    if (leftType === 'string' || rightType === 'string') {
                        return 'string';
                    }
                    if (leftType === 'float' || rightType === 'float') {
                        return 'float';
                    }
                    return 'int';
                }
                return 'float';
            }
            default:
                return 'unknown';
        }
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
            if (unary.operator === '-') {
                return -value;
            }
            if (unary.operator === '+') {
                return value;
            }
        }
        return null;
    }
    getIdentifierName(expression) {
        if (expression.kind === 'Identifier') {
            return expression.name;
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
    getExpressionText(expression) {
        switch (expression.kind) {
            case 'Identifier':
                return expression.name;
            case 'MemberExpression': {
                const member = expression;
                if (member.computed) {
                    return getNodeSource(this.context, member);
                }
                const objectText = this.getExpressionText(member.object);
                return `${objectText}.${member.property.name}`;
            }
            default:
                return getNodeSource(this.context, expression);
        }
    }
    getAstContext(config) {
        if (!config.ast || config.ast.mode === 'disabled') {
            return null;
        }
        return ensureAstContext(this.context, config);
    }
    collectKnownUdtTypes() {
        const result = new Set();
        if (this.astContext?.symbolTable) {
            for (const record of this.astContext.symbolTable.values()) {
                if (record.kind === 'type') {
                    result.add(record.name);
                }
            }
        }
        if (this.context.typeMap instanceof Map) {
            for (const [name, info] of this.context.typeMap.entries()) {
                if (info?.type === 'udt') {
                    result.add(name);
                }
            }
        }
        return result;
    }
    validateArrayPerformanceAst() {
        if (this.arrayAllocations > 5) {
            this.addWarning(1, 1, `Too many array allocations (${this.arrayAllocations}). Consider reusing arrays or using fewer arrays.`, 'PSV6-ARRAY-PERF-ALLOCATION');
        }
        for (const [name, info] of this.arrayDeclarations) {
            if (info.size > 10000) {
                this.addWarning(info.line, info.column, `Large array '${name}' with size ${info.size}. Consider performance implications.`, 'PSV6-ARRAY-PERF-LARGE');
            }
        }
    }
    validateArrayBestPracticesAst() {
        this.validateArrayNaming();
        this.validateArrayInitializationAst();
        this.validateArrayMemoryManagementAst();
    }
    validateArrayInitializationAst() {
        for (const [name, info] of this.arrayDeclarations) {
            const usage = this.arrayUsage.get(name);
            if (!usage) {
                this.addInfo(info.line, info.column, `Array '${name}' is declared but never initialized. Consider adding initial values.`, 'PSV6-ARRAY-INITIALIZATION-SUGGESTION');
                continue;
            }
            const hasInitialization = [...usage.pushes, ...usage.sets].some((line) => line >= info.line);
            if (!hasInitialization) {
                this.addInfo(info.line, info.column, `Array '${name}' is declared but never initialized. Consider adding initial values.`, 'PSV6-ARRAY-INITIALIZATION-SUGGESTION');
            }
        }
    }
    validateArrayMemoryManagementAst() {
        for (const [name, info] of this.arrayDeclarations) {
            const usage = this.arrayUsage.get(name);
            if (!usage) {
                continue;
            }
            const hasPush = usage.pushes.length > 0;
            const hasClear = usage.clears.length > 0;
            if (hasPush && !hasClear && info.size > 100) {
                this.addInfo(info.line, info.column, `Array '${name}' grows but is never cleared. Consider using array.clear() for memory management.`, 'PSV6-ARRAY-MEMORY-SUGGESTION');
            }
        }
    }
    validateArrayType(type, lineNum, column = 1) {
        if (!type || type === 'unknown') {
            return false;
        }
        const validTypes = [...VALID_ARRAY_ELEMENT_TYPES];
        const typeInfo = this.context.typeMap.get(type);
        const isUDT = typeInfo?.type === 'udt';
        const isDeclaredType = this.knownUdtTypes.has(type);
        const isValid = validTypes.includes(type) || isUDT || isDeclaredType;
        if (!isValid) {
            this.addError(lineNum, column, `Invalid array type: ${type}. Valid types are: ${validTypes.join(', ')}`, 'PSV6-ARRAY-INVALID-TYPE');
        }
        return isValid;
    }
    validateArraySize(size, lineNum, column = 1) {
        // Allow zero-size arrays (common initialization pattern)
        if (size < 0) {
            this.addError(lineNum, column, `Array size must be non-negative, got: ${size}`, 'PSV6-ARRAY-INVALID-SIZE');
        }
        else if (size > 100000) {
            this.addError(lineNum, column, `Array size (${size}) exceeds the maximum limit of 100,000`, 'PSV6-ARRAY-SIZE-LIMIT');
        }
    }
    validateArrayNaming() {
        for (const [varName, arrayInfo] of this.arrayDeclarations) {
            // Check for poor naming conventions
            if (varName.length <= 2 || /^[a-z]$/.test(varName) || /^arr\d*$/.test(varName)) {
                this.addInfo(arrayInfo.line, 1, `Consider using more descriptive names for arrays. '${varName}' could be improved.`, 'PSV6-ARRAY-NAMING-SUGGESTION');
            }
        }
    }
    areTypesCompatible(expectedType, actualType) {
        if (expectedType === actualType) {
            return true;
        }
        if (expectedType === 'float' && (actualType === 'int' || actualType === 'float')) {
            return true;
        }
        if (expectedType === 'int' && actualType === 'int') {
            return true;
        }
        if (expectedType === 'float' && actualType === 'series') {
            return true;
        }
        return false;
    }
}
