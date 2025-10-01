import { visit } from '../core/ast/traversal';
export class UDTValidator {
    constructor() {
        this.name = 'UDTValidator';
        this.priority = 95; // High priority - must run before TypeInferenceValidator
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astMethodMetadata = [];
        this.astMethodMetadataMap = new WeakMap();
        this.udtTypes = new Map();
        this.udtDeclarations = [];
        this.errorKeys = new Set();
        this.warningKeys = new Set();
        this.infoKeys = new Set();
        this.allowedInstanceMethods = new Set([
            'push', 'pop', 'get', 'set', 'size', 'clear', 'reverse', 'sort', 'sort_indices', 'copy', 'slice', 'concat', 'fill', 'from', 'from_example',
            'indexof', 'lastindexof', 'includes', 'binary_search', 'binary_search_leftmost', 'binary_search_rightmost', 'range', 'remove', 'insert',
            'unshift', 'shift', 'first', 'last', 'max', 'min', 'median', 'mode', 'abs', 'sum', 'avg', 'stdev', 'variance', 'standardize', 'covariance',
            'percentile_linear_interpolation', 'percentile_nearest_rank', 'percentrank', 'some', 'every', 'delete'
        ]);
    }
    getDependencies() {
        return ['SyntaxValidator', 'TypeValidator'];
    }
    validate(context, config) {
        this.reset();
        this.context = context;
        const astContext = this.getAstContext(config);
        const program = astContext?.ast ?? null;
        if (!program) {
            return {
                isValid: true,
                errors: [],
                warnings: [],
                info: [],
                typeMap: context.typeMap ?? new Map(),
                scriptType: context.scriptType ?? null,
            };
        }
        this.validateWithAst(program);
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap: context.typeMap ?? new Map(),
            scriptType: context.scriptType ?? null,
        };
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astMethodMetadata = [];
        this.astMethodMetadataMap = new WeakMap();
        this.udtTypes.clear();
        this.udtDeclarations = [];
        this.errorKeys.clear();
        this.warningKeys.clear();
        this.infoKeys.clear();
    }
    addError(line, column, message, code) {
        const key = `${line}:${column}:${code}`;
        if (this.errorKeys.has(key)) {
            return;
        }
        this.errorKeys.add(key);
        this.errors.push({ line, column, message, code, severity: 'error' });
    }
    addWarning(line, column, message, code) {
        const key = `${line}:${column}:${code}`;
        if (this.warningKeys.has(key)) {
            return;
        }
        this.warningKeys.add(key);
        this.warnings.push({ line, column, message, code, severity: 'warning' });
    }
    addInfo(line, column, message, code) {
        const key = `${line}:${column}:${code}`;
        if (this.infoKeys.has(key)) {
            return;
        }
        this.infoKeys.add(key);
        this.info.push({
            line,
            column,
            message,
            code,
            severity: 'info'
        });
    }
    validateWithAst(program) {
        this.collectUdtDataFromAst(program);
        this.validateUDTDeclarations();
        this.validateMethodDeclarationsAst();
        this.validateMethodCallsAndFieldsAst(program);
    }
    collectUdtDataFromAst(program) {
        this.udtDeclarations = [];
        this.udtTypes.clear();
        this.astMethodMetadata = [];
        this.astMethodMetadataMap = new WeakMap();
        visit(program, {
            TypeDeclaration: {
                enter: (path) => {
                    this.handleAstTypeDeclaration(path.node);
                },
            },
            FunctionDeclaration: {
                enter: (path) => {
                    this.handleAstFunctionDeclaration(path.node);
                },
            },
        });
    }
    handleAstTypeDeclaration(node) {
        const udtName = node.identifier.name;
        const fields = [];
        const seenFieldNames = new Set();
        for (const field of node.fields) {
            const fieldName = field.identifier.name;
            const typeString = field.typeAnnotation ? this.stringifyAstTypeReference(field.typeAnnotation) : 'unknown';
            // Check for duplicate field names
            if (seenFieldNames.has(fieldName)) {
                this.addError(field.loc.start.line, field.loc.start.column, `Duplicate field '${fieldName}' in UDT '${udtName}'`, 'PSV6-UDT-DUPLICATE-FIELD');
                continue; // Skip adding this duplicate field
            }
            seenFieldNames.add(fieldName);
            fields.push({ name: fieldName, type: typeString });
            const parsedType = this.parseFieldType(typeString);
            const typeInfo = {
                type: parsedType.baseType,
                isConst: false,
                isSeries: parsedType.baseType === 'series',
                declaredAt: { line: field.loc.start.line, column: field.loc.start.column },
                usages: [],
            };
            if (parsedType.elementType) {
                typeInfo.elementType = parsedType.elementType;
            }
            if (parsedType.udtName) {
                typeInfo.udtName = parsedType.udtName;
            }
            this.context.typeMap.set(`${udtName}.${fieldName}`, typeInfo);
        }
        const declaration = {
            name: udtName,
            line: node.loc.start.line,
            fields: [...fields],
            methods: [],
        };
        this.udtDeclarations.push(declaration);
        const existing = this.udtTypes.get(udtName);
        const methods = existing?.methods ?? [];
        const info = {
            name: udtName,
            fields: [...fields],
            methods,
            line: node.loc.start.line,
        };
        this.udtTypes.set(udtName, info);
        this.context.typeMap.set(udtName, {
            type: 'udt',
            isConst: false,
            isSeries: false,
            declaredAt: { line: node.loc.start.line, column: node.loc.start.column },
            usages: [],
        });
        if (this.context.usedVars) {
            this.context.usedVars.add(udtName);
        }
    }
    handleAstFunctionDeclaration(node) {
        if (!node.identifier) {
            return;
        }
        const fullName = node.identifier.name;
        const firstParam = node.params[0] ?? null;
        const hasThis = Boolean(firstParam && firstParam.identifier.name === 'this');
        const hasMethodModifier = node.modifiers?.includes('method') ?? false;
        const isMethodCandidate = fullName.includes('.') || hasThis || hasMethodModifier;
        if (!isMethodCandidate) {
            return;
        }
        const methodName = fullName.includes('.') ? fullName.split('.').pop() ?? fullName : fullName;
        let udtName = null;
        if (fullName.includes('.')) {
            const [maybeType] = fullName.split('.');
            if (maybeType) {
                udtName = maybeType;
            }
        }
        let thisTypeName = null;
        if (firstParam?.typeAnnotation) {
            const parsed = this.parseFieldType(this.stringifyAstTypeReference(firstParam.typeAnnotation));
            if (parsed.baseType === 'udt' && parsed.udtName) {
                thisTypeName = parsed.udtName;
            }
            else if (parsed.baseType !== 'unknown') {
                thisTypeName = parsed.baseType;
            }
        }
        if (!udtName && thisTypeName && this.udtTypes.has(thisTypeName)) {
            udtName = thisTypeName;
        }
        const metadata = {
            node,
            methodName,
            udtName,
            hasThis,
            thisParam: firstParam ?? null,
            thisTypeName,
            line: node.loc.start.line,
            column: node.loc.start.column,
        };
        this.astMethodMetadata.push(metadata);
        this.astMethodMetadataMap.set(node, metadata);
        if (udtName) {
            const udtInfo = this.udtTypes.get(udtName) ?? {
                name: udtName,
                fields: [],
                methods: [],
                line: node.loc.start.line,
            };
            udtInfo.methods.push({ name: methodName, line: node.loc.start.line, hasThis, thisType: thisTypeName ?? undefined });
            this.udtTypes.set(udtName, udtInfo);
        }
    }
    validateMethodDeclarationsAst() {
        for (const metadata of this.astMethodMetadata) {
            if (!metadata.hasThis) {
                this.addError(metadata.line, metadata.column, `Method '${metadata.methodName}' must have 'this' as first parameter`, 'PSV6-METHOD-THIS');
                continue;
            }
            if (!metadata.thisParam?.typeAnnotation) {
                this.addInfo(metadata.line, metadata.column, "Consider adding type annotation to 'this' parameter", 'PSV6-METHOD-TYPE');
            }
        }
    }
    validateMethodCallsAndFieldsAst(program) {
        const scopeStack = [new Map()];
        visit(program, {
            FunctionDeclaration: {
                enter: (path) => {
                    scopeStack.push(new Map());
                    const metadata = this.astMethodMetadataMap.get(path.node) ?? null;
                    if (metadata?.hasThis) {
                        const udtName = metadata.thisTypeName ?? metadata.udtName;
                        if (udtName) {
                            this.assignVariableType('this', { kind: 'udt', name: udtName }, scopeStack);
                        }
                        else {
                            this.assignVariableType('this', { kind: 'unknown', name: 'this' }, scopeStack);
                        }
                    }
                    for (const param of path.node.params) {
                        if (param.identifier.name === 'this') {
                            continue;
                        }
                        const paramType = this.interpretTypeReference(param.typeAnnotation);
                        if (paramType) {
                            this.assignVariableType(param.identifier.name, paramType, scopeStack);
                        }
                    }
                },
                exit: () => {
                    scopeStack.pop();
                },
            },
            BlockStatement: {
                enter: () => {
                    scopeStack.push(new Map());
                },
                exit: () => {
                    scopeStack.pop();
                },
            },
            VariableDeclaration: {
                enter: (path) => {
                    this.recordAstVariableDeclaration(path.node, scopeStack);
                },
            },
            AssignmentStatement: {
                enter: (path) => {
                    this.recordAstAssignment(path.node, scopeStack);
                },
            },
            CallExpression: {
                enter: (path) => {
                    this.validateAstMethodCall(path.node, scopeStack);
                },
            },
            MemberExpression: {
                enter: (path) => {
                    this.validateAstFieldAccess(path, scopeStack);
                },
            },
        });
    }
    recordAstVariableDeclaration(node, scopeStack) {
        const name = node.identifier.name;
        const location = { line: node.identifier.loc.start.line, column: node.identifier.loc.start.column };
        const isConst = node.declarationKind === 'const';
        const annotationType = this.interpretTypeReference(node.typeAnnotation);
        if (annotationType) {
            this.assignVariableType(name, annotationType, scopeStack);
            this.storeVariableType(name, location, annotationType, isConst);
        }
        if (node.initializer) {
            const initializerType = this.inferAstExpressionVariableType(node.initializer, scopeStack);
            if (initializerType) {
                this.assignVariableType(name, initializerType, scopeStack);
                this.storeVariableType(name, location, initializerType, isConst);
            }
        }
    }
    recordAstAssignment(node, scopeStack) {
        if (node.left.kind !== 'Identifier' || !node.right) {
            return;
        }
        const identifier = node.left;
        const inferredType = this.inferAstExpressionVariableType(node.right, scopeStack);
        if (!inferredType) {
            return;
        }
        this.assignVariableType(identifier.name, inferredType, scopeStack);
        const loc = { line: identifier.loc.start.line, column: identifier.loc.start.column };
        this.storeVariableType(identifier.name, loc, inferredType, false);
    }
    validateAstMethodCall(node, scopeStack) {
        if (node.callee.kind !== 'MemberExpression') {
            return;
        }
        const member = node.callee;
        if (member.computed || member.object.kind !== 'Identifier') {
            return;
        }
        const objectIdentifier = member.object;
        const objectName = objectIdentifier.name;
        if (objectName === 'this') {
            return;
        }
        const methodName = member.property.name;
        if (this.allowedInstanceMethods.has(methodName)) {
            return;
        }
        const objectType = this.resolveVariableType(objectName, scopeStack);
        if (!objectType || objectType.kind === 'udt' || objectType.kind === 'unknown') {
            return;
        }
        const line = member.property.loc.start.line;
        const column = member.property.loc.start.column;
        this.addWarning(line, column, `Method '${methodName}' called on primitive type variable '${objectName}'`, 'PSV6-METHOD-INVALID');
    }
    validateAstFieldAccess(path, scopeStack) {
        const node = path.node;
        if (node.computed) {
            return;
        }
        const parent = path.parent;
        if (parent &&
            parent.node.kind === 'CallExpression' &&
            (parent.key === 'callee' || parent.key === 'expression')) {
            return;
        }
        if (node.object.kind !== 'Identifier') {
            return;
        }
        const objectIdentifier = node.object;
        const objectName = objectIdentifier.name;
        const objectType = this.resolveVariableType(objectName, scopeStack);
        if (!objectType || objectType.kind !== 'udt') {
            return;
        }
        const udtInfo = this.udtTypes.get(objectType.name);
        if (!udtInfo) {
            return;
        }
        const fieldName = node.property.name;
        const field = udtInfo.fields.find((entry) => entry.name === fieldName);
        const line = node.property.loc.start.line;
        const column = node.property.loc.start.column;
        if (!field) {
            this.addError(line, column, `Field '${fieldName}' does not exist in UDT '${objectType.name}'`, 'PSV6-UDT-FIELD-NOT-FOUND');
            return;
        }
        const parsedType = this.parseFieldType(field.type);
        const typeInfo = {
            type: parsedType.baseType,
            isConst: false,
            isSeries: parsedType.baseType === 'series',
            declaredAt: { line, column },
            usages: [],
        };
        if (parsedType.elementType) {
            typeInfo.elementType = parsedType.elementType;
        }
        if (parsedType.udtName) {
            typeInfo.udtName = parsedType.udtName;
        }
        this.context.typeMap.set(`${objectName}.${fieldName}`, typeInfo);
    }
    assignVariableType(name, type, scopeStack) {
        if (!scopeStack.length) {
            return;
        }
        scopeStack[scopeStack.length - 1].set(name, type);
    }
    storeVariableType(name, location, record, isConst) {
        const existing = this.context.typeMap.get(name);
        const declaredAt = existing?.declaredAt ?? location;
        const usages = existing?.usages ?? [];
        const info = {
            type: this.mapVariableRecordToType(record),
            isConst: existing?.isConst ?? isConst,
            isSeries: existing?.isSeries ??
                (record.kind === 'primitive' && (record.name === 'series' || record.name === 'series float' || record.name === 'series int')),
            declaredAt,
            usages,
        };
        if (record.kind === 'udt') {
            info.udtName = record.name;
        }
        else if (existing?.udtName) {
            info.udtName = existing.udtName;
        }
        if (existing?.elementType) {
            info.elementType = existing.elementType;
        }
        if (existing?.keyType) {
            info.keyType = existing.keyType;
        }
        if (existing?.valueType) {
            info.valueType = existing.valueType;
        }
        if (existing?.enumType) {
            info.enumType = existing.enumType;
        }
        this.context.typeMap.set(name, info);
    }
    mapVariableRecordToType(record) {
        if (record.kind === 'udt') {
            return 'udt';
        }
        if (record.kind === 'primitive') {
            const primitive = record.name.toLowerCase();
            switch (primitive) {
                case 'int':
                case 'float':
                case 'bool':
                case 'string':
                case 'color':
                case 'series':
                case 'line':
                case 'label':
                case 'box':
                case 'table':
                case 'linefill':
                case 'polyline':
                case 'chart.point':
                case 'array':
                case 'matrix':
                case 'map':
                    return primitive;
                default:
                    return 'unknown';
            }
        }
        return 'unknown';
    }
    resolveVariableType(name, scopeStack) {
        for (let index = scopeStack.length - 1; index >= 0; index--) {
            const scope = scopeStack[index];
            if (scope.has(name)) {
                return scope.get(name);
            }
        }
        return null;
    }
    interpretTypeReference(type) {
        if (!type) {
            return null;
        }
        const typeString = this.stringifyAstTypeReference(type);
        const parsed = this.parseFieldType(typeString);
        if (parsed.baseType === 'udt') {
            const name = parsed.udtName ?? typeString;
            return { kind: 'udt', name };
        }
        if (parsed.baseType === 'unknown') {
            return { kind: 'unknown', name: 'unknown' };
        }
        return { kind: 'primitive', name: parsed.baseType };
    }
    inferAstExpressionVariableType(expression, scopeStack) {
        switch (expression.kind) {
            case 'Identifier': {
                const identifier = expression;
                return this.resolveVariableType(identifier.name, scopeStack);
            }
            case 'CallExpression': {
                const call = expression;
                if (call.callee.kind === 'MemberExpression') {
                    const member = call.callee;
                    if (!member.computed) {
                        if (member.object.kind === 'Identifier' && member.property.name === 'new') {
                            return { kind: 'udt', name: member.object.name };
                        }
                        if (member.object.kind === 'Identifier') {
                            const objectType = this.resolveVariableType(member.object.name, scopeStack);
                            if (objectType?.kind === 'udt') {
                                const udtInfo = this.udtTypes.get(objectType.name);
                                const field = udtInfo?.fields.find((entry) => entry.name === member.property.name);
                                if (field) {
                                    const parsed = this.parseFieldType(field.type);
                                    if (parsed.baseType === 'udt' && parsed.udtName) {
                                        return { kind: 'udt', name: parsed.udtName };
                                    }
                                    if (parsed.baseType !== 'unknown') {
                                        return { kind: 'primitive', name: parsed.baseType };
                                    }
                                }
                            }
                        }
                    }
                }
                else if (call.callee.kind === 'Identifier') {
                    const callee = call.callee;
                    if (callee.name.includes('.')) {
                        const [maybeType, property] = callee.name.split('.');
                        if (property === 'new' && maybeType) {
                            return { kind: 'udt', name: maybeType };
                        }
                    }
                }
                return null;
            }
            case 'MemberExpression': {
                const member = expression;
                if (member.computed || member.object.kind !== 'Identifier') {
                    return null;
                }
                const objectType = this.resolveVariableType(member.object.name, scopeStack);
                if (objectType?.kind !== 'udt') {
                    return null;
                }
                const udtInfo = this.udtTypes.get(objectType.name);
                const field = udtInfo?.fields.find((entry) => entry.name === member.property.name);
                if (!field) {
                    return null;
                }
                const parsed = this.parseFieldType(field.type);
                if (parsed.baseType === 'udt' && parsed.udtName) {
                    return { kind: 'udt', name: parsed.udtName };
                }
                if (parsed.baseType !== 'unknown') {
                    return { kind: 'primitive', name: parsed.baseType };
                }
                return null;
            }
            default:
                return null;
        }
    }
    stringifyAstTypeReference(type) {
        const base = type.name.name;
        if (!type.generics.length) {
            return base;
        }
        const generics = type.generics.map((generic) => this.stringifyAstTypeReference(generic));
        return `${base}<${generics.join(', ')}>`;
    }
    validateUDTDeclarations() {
        // Check for duplicate UDT names
        const udtNames = new Map();
        // Collect all UDT names and their line numbers
        for (const declaration of this.udtDeclarations) {
            if (!udtNames.has(declaration.name)) {
                udtNames.set(declaration.name, []);
            }
            udtNames.get(declaration.name).push(declaration.line);
        }
        // Check for duplicates
        for (const [udtName, lines] of udtNames.entries()) {
            if (lines.length > 1) {
                // Report error for all duplicate declarations except the first one
                for (let i = 1; i < lines.length; i++) {
                    this.addError(lines[i], 1, `Duplicate UDT name '${udtName}' (first declared at line ${lines[0]})`, 'PSV6-UDT-DUPLICATE');
                }
            }
        }
        // Check for empty UDTs
        for (const [udtName, udtInfo] of this.udtTypes.entries()) {
            if (udtInfo.fields.length === 0 && udtInfo.methods.length === 0) {
                this.addWarning(udtInfo.line, 1, `UDT '${udtName}' has no fields or methods`, 'PSV6-UDT-EMPTY');
            }
        }
    }
    parseFieldType(type) {
        const trimmed = type.trim();
        if (trimmed.startsWith('array<') && trimmed.endsWith('>')) {
            const inner = this.extractGenericInner(trimmed);
            return { baseType: 'array', elementType: inner };
        }
        if (trimmed.startsWith('map<') && trimmed.endsWith('>')) {
            const inner = this.extractGenericInner(trimmed);
            const [keyType, valueType] = this.splitGenericParameters(inner);
            return { baseType: 'map', elementType: (valueType ?? 'unknown').trim() };
        }
        if (trimmed.startsWith('matrix<') && trimmed.endsWith('>')) {
            const inner = this.extractGenericInner(trimmed);
            return { baseType: 'matrix', elementType: inner };
        }
        const primitiveTypes = [
            'int', 'float', 'bool', 'string', 'color', 'series', 'line', 'label', 'box', 'table', 'linefill', 'polyline', 'chart.point', 'array', 'matrix', 'map', 'udt', 'unknown'
        ];
        if (primitiveTypes.includes(trimmed)) {
            return { baseType: trimmed };
        }
        return { baseType: 'udt', udtName: trimmed };
    }
    extractGenericInner(type) {
        const start = type.indexOf('<');
        const end = type.lastIndexOf('>');
        if (start === -1 || end === -1 || end <= start) {
            return type;
        }
        return type.substring(start + 1, end).trim();
    }
    splitGenericParameters(inner) {
        const parts = [];
        let current = '';
        let depth = 0;
        for (let i = 0; i < inner.length; i++) {
            const ch = inner[i];
            if (ch === '<') {
                depth++;
                current += ch;
                continue;
            }
            if (ch === '>') {
                depth--;
                current += ch;
                continue;
            }
            if (ch === ',' && depth === 0) {
                parts.push(current.trim());
                current = '';
                continue;
            }
            current += ch;
        }
        if (current.trim()) {
            parts.push(current.trim());
        }
        return parts;
    }
    getAstContext(config) {
        if (!config.ast || config.ast.mode === 'disabled') {
            return null;
        }
        return isAstValidationContext(this.context) && this.context.ast ? this.context : null;
    }
}
function isAstValidationContext(context) {
    return 'ast' in context;
}
