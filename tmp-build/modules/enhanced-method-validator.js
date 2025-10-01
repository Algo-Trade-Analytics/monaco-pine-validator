/**
 * Enhanced Method Validator Module
 *
 * Handles enhanced method validation for Pine Script v6:
 * - PSV6-METHOD-INVALID: Methods on non-UDT types
 */
import { visit } from '../core/ast/traversal';
export class EnhancedMethodValidator {
    constructor() {
        this.name = 'EnhancedMethodValidator';
        this.priority = 85; // Run after type validation
        this.allowedInstanceMethods = new Set([
            'push', 'pop', 'get', 'set', 'size', 'clear', 'reverse', 'sort', 'sort_indices', 'copy', 'slice', 'concat', 'fill', 'from',
            'from_example', 'indexof', 'lastindexof', 'includes', 'binary_search', 'binary_search_leftmost', 'binary_search_rightmost',
            'range', 'remove', 'insert', 'unshift', 'shift', 'first', 'last', 'max', 'min', 'median', 'mode', 'abs', 'sum', 'avg',
            'stdev', 'variance', 'standardize', 'covariance', 'percentile_linear_interpolation', 'percentile_nearest_rank',
            'percentrank', 'some', 'every', 'delete'
        ]);
        this.builtInNamespaces = {
            array: ['new', 'push', 'pop', 'get', 'set', 'size', 'clear'],
            matrix: ['new', 'get', 'set', 'rows', 'columns', 'clear'],
            map: ['new', 'get', 'put', 'remove', 'size', 'clear'],
            line: ['new', 'set_xy1', 'set_xy2', 'set_color', 'set_width', 'set_style', 'delete'],
            label: ['new', 'set_text', 'set_color', 'set_style', 'delete'],
            box: ['new', 'delete', 'set_bgcolor', 'set_border_color'],
            table: ['new', 'cell', 'cell_set_text', 'delete', 'clear'],
        };
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
    }
    getDependencies() {
        return ['CoreValidator', 'UDTValidator'];
    }
    validate(context, _config) {
        this.reset();
        this.context = context;
        void _config;
        this.astContext = isAstValidationContext(context) && context.ast ? context : null;
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
        this.validateUsingAst(this.astContext.ast);
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap: new Map(),
            scriptType: null,
        };
    }
    validateUsingAst(program) {
        const udtTypes = new Set();
        this.bootstrapUdtTypes(udtTypes);
        const scopeStack = [new Map()];
        visit(program, {
            TypeDeclaration: {
                enter: (path) => {
                    udtTypes.add(path.node.identifier.name);
                },
            },
            FunctionDeclaration: {
                enter: (path) => {
                    scopeStack.push(new Map());
                    for (const param of path.node.params) {
                        const typeName = this.resolveTypeReference(param.typeAnnotation);
                        this.assignIdentifierType(param.identifier.name, typeName, scopeStack);
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
                    this.recordVariableDeclaration(path.node, scopeStack, udtTypes);
                },
            },
            AssignmentStatement: {
                enter: (path) => {
                    this.recordAssignmentStatement(path.node, scopeStack, udtTypes);
                },
            },
            CallExpression: {
                enter: (path) => {
                    this.processAstMethodCall(path.node, scopeStack, udtTypes);
                },
            },
        });
    }
    processAstMethodCall(node, scopeStack, udtTypes) {
        if (node.callee.kind !== 'MemberExpression') {
            return;
        }
        const member = node.callee;
        if (member.computed || member.object.kind !== 'Identifier') {
            return;
        }
        const objectIdentifier = member.object;
        const objectName = objectIdentifier.name;
        const methodName = member.property.name;
        if (objectName === 'this') {
            return;
        }
        if (this.allowedInstanceMethods.has(methodName)) {
            return;
        }
        if (this.isBuiltInMethod(objectName, methodName)) {
            return;
        }
        const resolvedType = this.resolveIdentifierType(objectName, scopeStack);
        if (!resolvedType || resolvedType === 'unknown') {
            return;
        }
        if (resolvedType === 'udt' || udtTypes.has(resolvedType)) {
            return;
        }
        const line = member.property.loc.start.line;
        const column = member.property.loc.start.column;
        const message = `Method '${methodName}' called on non-UDT variable '${objectName}' of type '${resolvedType}'`;
        this.addWarning(line, column, message, 'PSV6-METHOD-INVALID');
    }
    recordVariableDeclaration(node, scopeStack, udtTypes) {
        const typeAnnotation = this.resolveTypeReference(node.typeAnnotation);
        if (typeAnnotation) {
            this.assignIdentifierType(node.identifier.name, typeAnnotation, scopeStack);
        }
        if (node.initializer) {
            const inferred = this.inferExpressionType(node.initializer, scopeStack, udtTypes);
            this.assignIdentifierType(node.identifier.name, inferred, scopeStack);
        }
    }
    recordAssignmentStatement(node, scopeStack, udtTypes) {
        if (node.left.kind !== 'Identifier' || !node.right) {
            return;
        }
        const identifier = node.left;
        const inferred = this.inferExpressionType(node.right, scopeStack, udtTypes);
        this.assignIdentifierType(identifier.name, inferred, scopeStack);
    }
    resolveTypeReference(typeAnnotation) {
        if (!typeAnnotation) {
            return null;
        }
        return typeAnnotation.name.name;
    }
    inferExpressionType(expression, scopeStack, udtTypes) {
        switch (expression.kind) {
            case 'NumberLiteral': {
                const literal = expression;
                const raw = literal.raw ?? `${literal.value ?? ''}`;
                return raw.includes('.') ? 'float' : 'int';
            }
            case 'BooleanLiteral':
                return 'bool';
            case 'StringLiteral':
                return 'string';
            case 'Identifier': {
                const identifier = expression;
                return this.resolveIdentifierType(identifier.name, scopeStack);
            }
            case 'CallExpression': {
                const call = expression;
                if (call.callee.kind === 'MemberExpression') {
                    const member = call.callee;
                    if (!member.computed && member.property.name === 'new' && member.object.kind === 'Identifier') {
                        const namespace = member.object.name;
                        if (udtTypes.has(namespace)) {
                            return namespace;
                        }
                        if (namespace in this.builtInNamespaces) {
                            return namespace;
                        }
                    }
                }
                return null;
            }
            case 'UnaryExpression': {
                const unary = expression;
                if (unary.argument.kind === 'NumberLiteral') {
                    const literal = unary.argument;
                    const raw = literal.raw ?? `${literal.value ?? ''}`;
                    return raw.includes('.') ? 'float' : 'int';
                }
                return null;
            }
            default:
                return null;
        }
    }
    resolveIdentifierType(name, scopeStack) {
        if (name === 'this') {
            return 'udt';
        }
        for (let index = scopeStack.length - 1; index >= 0; index--) {
            const scope = scopeStack[index];
            if (scope.has(name)) {
                return scope.get(name) ?? null;
            }
        }
        const contextType = this.getContextType(name);
        if (contextType) {
            return contextType;
        }
        const metadata = this.astContext?.typeEnvironment.identifiers.get(name);
        if (metadata) {
            return metadata.kind;
        }
        return null;
    }
    assignIdentifierType(name, typeName, scopeStack) {
        if (!typeName || typeName === 'unknown') {
            return;
        }
        for (let index = scopeStack.length - 1; index >= 0; index--) {
            const scope = scopeStack[index];
            if (scope.has(name)) {
                scope.set(name, typeName);
                return;
            }
        }
        scopeStack[scopeStack.length - 1].set(name, typeName);
    }
    getContextType(name) {
        const typeInfo = this.context.typeMap?.get(name);
        if (!typeInfo) {
            return null;
        }
        if (typeInfo.type === 'udt') {
            return typeInfo.udtName ?? name;
        }
        return typeInfo.type ?? null;
    }
    bootstrapUdtTypes(target) {
        if (!this.context.typeMap) {
            return;
        }
        for (const [name, info] of this.context.typeMap.entries()) {
            if (info.type === 'udt') {
                target.add(info.udtName ?? name);
            }
        }
    }
    isBuiltInMethod(varName, methodName) {
        return this.builtInNamespaces[varName]?.includes(methodName) ?? false;
    }
    addWarning(line, column, message, code) {
        this.warnings.push({
            line,
            column,
            message,
            severity: 'warning',
            code,
            suggestion: "Methods can only be called on User-Defined Type instances. Consider using a function instead.",
        });
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
    }
}
function isAstValidationContext(context) {
    return 'ast' in context;
}
