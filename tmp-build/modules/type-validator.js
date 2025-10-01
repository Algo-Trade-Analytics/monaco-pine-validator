/**
 * Type System Validation Module
 *
 * Handles type safety, type inference, and type-related validation for Pine Script v6.
 * Extracts type checking logic from EnhancedPineScriptValidator and UltimateValidator.
 */
import { visit } from '../core/ast/traversal';
export class TypeValidator {
    constructor() {
        this.name = 'TypeValidator';
        this.priority = 85; // High priority, runs after CoreValidator
        // Error tracking
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astDiagnosticSites = new Map();
        this.namespaceTypeHints = new Map([
            ['ta', 'series'],
            ['math', 'float'],
            ['str', 'string'],
            ['color', 'color'],
            ['line', 'line'],
            ['label', 'label'],
            ['box', 'box'],
            ['table', 'table'],
            ['polyline', 'polyline'],
            ['location', 'int'],
            ['size', 'int'],
            ['shape', 'int'],
            ['display', 'int'],
            ['text', 'string'],
            ['timeframe', 'string'],
            ['session', 'string'],
            ['syminfo', 'string'],
            ['alert', 'string'],
            ['strategy', 'series'],
            ['request', 'series'],
        ]);
        this.callReturnTypeHints = new Map([
            ['color.new', 'color'],
            ['color.rgb', 'color'],
            ['color.from_gradient', 'color'],
            ['color', 'color'],
        ]);
    }
    getDependencies() {
        return ['CoreValidator']; // Depends on core validation
    }
    validate(context, _config) {
        this.reset();
        if (!this.isAstContext(context) || !context.ast) {
            return {
                isValid: true,
                errors: this.errors,
                warnings: this.warnings,
                info: this.info,
                typeMap: new Map(),
                scriptType: null,
            };
        }
        this.validateWithAst(context);
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap: new Map(),
            scriptType: null,
        };
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astDiagnosticSites.clear();
    }
    validateWithAst(context) {
        if (!context.ast) {
            return;
        }
        this.emitAstVariableTypeMismatches(context);
        this.emitAstTernaryTypeConflicts(context);
        this.emitAstFunctionReturnTypeErrors(context);
        this.emitAstTypeConsistencyWarnings(context);
    }
    emitAstVariableTypeMismatches(context) {
        const program = context.ast;
        const environment = context.typeEnvironment;
        if (!program) {
            return;
        }
        visit(program, {
            VariableDeclaration: {
                enter: (path) => {
                    const declaration = path.node;
                    if (!declaration.typeAnnotation || !declaration.initializer) {
                        return;
                    }
                    const declaredType = this.resolveTypeReferenceName(declaration.typeAnnotation);
                    if (!declaredType) {
                        return;
                    }
                    const initializerMetadata = environment.nodeTypes.get(declaration.initializer);
                    if (!initializerMetadata || initializerMetadata.kind === 'unknown' || initializerMetadata.certainty === 'conflict') {
                        return;
                    }
                    const inferredType = this.describeTypeMetadata(initializerMetadata);
                    if (!inferredType) {
                        return;
                    }
                    const declaredBase = this.normaliseTypeName(declaredType);
                    if (!this.isKnownPrimitiveType(declaredBase)) {
                        return;
                    }
                    if (this.areTypesCompatible(declaredBase, inferredType)) {
                        return;
                    }
                    const line = declaration.identifier.loc.start.line;
                    const column = declaration.identifier.loc.start.column;
                    const key = `${line}:${declaration.identifier.name}`;
                    this.registerAstDiagnostic('PSV6-TYPE-MISMATCH', key);
                    this.addError(line, column, `Type mismatch: declared '${declaredType}' but assigned '${inferredType}'.`, 'PSV6-TYPE-MISMATCH');
                },
            },
        });
    }
    emitAstTernaryTypeConflicts(context) {
        const program = context.ast;
        const environment = context.typeEnvironment;
        if (!program) {
            return;
        }
        visit(program, {
            ConditionalExpression: {
                enter: (path) => {
                    const expression = path.node;
                    const consequentType = this.getExpressionTypeLabel(context, expression.consequent);
                    const alternateType = this.getExpressionTypeLabel(context, expression.alternate);
                    if (!consequentType || !alternateType) {
                        return;
                    }
                    const consequentIsNa = expression.consequent.kind === 'Identifier' && expression.consequent.name === 'na';
                    const alternateIsNa = expression.alternate.kind === 'Identifier' && expression.alternate.name === 'na';
                    if (consequentIsNa || alternateIsNa) {
                        return;
                    }
                    if (this.areTypesCompatible(consequentType, alternateType)) {
                        return;
                    }
                    const line = expression.loc.start.line;
                    const column = expression.loc.start.column;
                    const key = `${line}`;
                    this.registerAstDiagnostic('PSV6-TERNARY-TYPE', key);
                    this.addError(line, column, `Ternary operator type mismatch: '${consequentType}' vs '${alternateType}'.`, 'PSV6-TERNARY-TYPE');
                },
            },
        });
    }
    emitAstFunctionReturnTypeErrors(context) {
        const program = context.ast;
        if (!program) {
            return;
        }
        visit(program, {
            FunctionDeclaration: {
                enter: (path) => {
                    const fnNode = path.node;
                    const collected = new Set();
                    visit(fnNode.body, {
                        FunctionDeclaration: {
                            enter: () => 'skip',
                        },
                        ReturnStatement: {
                            enter: (returnPath) => {
                                const returnNode = returnPath.node;
                                if (!returnNode.argument) {
                                    collected.add('void');
                                    return;
                                }
                                const metadata = context.typeEnvironment.nodeTypes.get(returnNode.argument);
                                const typeLabel = this.describeTypeMetadata(metadata);
                                if (!typeLabel) {
                                    return;
                                }
                                collected.add(typeLabel);
                            },
                        },
                    });
                    if (collected.size <= 1) {
                        return;
                    }
                    const fnName = fnNode.identifier?.name ?? 'anonymous function';
                    const line = fnNode.loc.start.line;
                    const column = fnNode.loc.start.column;
                    const key = `${line}:${fnName}`;
                    this.registerAstDiagnostic('PSV6-FUNCTION-RETURN-TYPE', key);
                    this.addError(line, column, `Function '${fnName}' has inconsistent return types: ${Array.from(collected).join(', ')}.`, 'PSV6-FUNCTION-RETURN-TYPE');
                },
            },
        });
    }
    emitAstTypeConsistencyWarnings(context) {
        const program = context.ast;
        if (!program) {
            return;
        }
        const environment = context.typeEnvironment;
        const recorded = new Map();
        const trackAssignment = (identifier) => {
            const metadata = environment.nodeTypes.get(identifier);
            const typeLabel = this.describeTypeMetadata(metadata);
            if (!typeLabel) {
                return;
            }
            const normalised = this.normaliseTypeName(typeLabel);
            if (!this.isKnownPrimitiveType(normalised)) {
                return;
            }
            const previousType = recorded.get(identifier.name);
            if (!previousType) {
                recorded.set(identifier.name, normalised);
                return;
            }
            if (this.areTypesCompatible(previousType, normalised) || this.areTypesCompatible(normalised, previousType)) {
                recorded.set(identifier.name, normalised);
                return;
            }
            const line = identifier.loc.start.line;
            const column = identifier.loc.start.column;
            const key = `${line}:${identifier.name}`;
            this.registerAstDiagnostic('PSV6-TYPE-INCONSISTENT', key);
            this.addWarning(line, column, `Type mismatch: variable '${identifier.name}' previously typed as '${previousType}' but assigned '${normalised}'.`, 'PSV6-TYPE-INCONSISTENT');
            recorded.set(identifier.name, normalised);
        };
        visit(program, {
            VariableDeclaration: {
                enter: (path) => {
                    const declaration = path.node;
                    trackAssignment(declaration.identifier);
                },
            },
            AssignmentStatement: {
                enter: (path) => {
                    const assignment = path.node;
                    const target = assignment.left;
                    if (!target) {
                        return;
                    }
                    if (target.kind === 'Identifier') {
                        trackAssignment(target);
                        return;
                    }
                    if (target.kind === 'TupleExpression') {
                        const tuple = target;
                        tuple.elements.forEach((element) => {
                            if (element && element.kind === 'Identifier') {
                                trackAssignment(element);
                            }
                        });
                    }
                },
            },
        });
    }
    registerAstDiagnostic(code, key) {
        if (!this.astDiagnosticSites.has(code)) {
            this.astDiagnosticSites.set(code, new Set());
        }
        this.astDiagnosticSites.get(code).add(key);
    }
    isAstContext(context) {
        return 'ast' in context;
    }
    resolveTypeReferenceName(type) {
        if (!type) {
            return null;
        }
        const base = type.name.name;
        if (!type.generics.length) {
            return base;
        }
        const generics = type.generics
            .map((generic) => this.resolveTypeReferenceName(generic))
            .filter((name) => Boolean(name));
        if (!generics.length) {
            return base;
        }
        return `${base}<${generics.join(', ')}>`;
    }
    describeTypeMetadata(metadata) {
        if (!metadata) {
            return null;
        }
        if (metadata.kind === 'unknown') {
            return null;
        }
        return metadata.kind;
    }
    normaliseTypeName(name) {
        return name.split('<')[0];
    }
    areTypesCompatible(left, right) {
        if (left === 'na' || right === 'na') {
            return true;
        }
        if (left === right) {
            return true;
        }
        if (left === 'void' || right === 'void') {
            return true;
        }
        const numeric = new Set(['int', 'float']);
        if (numeric.has(left) && numeric.has(right)) {
            return true;
        }
        if (left === 'series' || right === 'series') {
            return true;
        }
        return false;
    }
    isKnownPrimitiveType(name) {
        const known = new Set([
            'int',
            'float',
            'bool',
            'string',
            'series',
            'color',
            'line',
            'label',
            'box',
            'table',
            'array',
            'matrix',
            'map',
            'void',
            'function',
        ]);
        return known.has(name);
    }
    getExpressionTypeLabel(context, expression) {
        if (!expression) {
            return null;
        }
        if (expression.kind === 'Identifier' && expression.name === 'na') {
            return 'na';
        }
        const metadata = context.typeEnvironment.nodeTypes.get(expression);
        const metadataLabel = this.describeTypeMetadata(metadata);
        if (metadataLabel && metadataLabel !== 'unknown') {
            return metadataLabel;
        }
        switch (expression.kind) {
            case 'NumberLiteral': {
                const literal = expression;
                return Number.isInteger(literal.value) ? 'int' : 'float';
            }
            case 'StringLiteral':
                return 'string';
            case 'BooleanLiteral':
                return 'bool';
            case 'NullLiteral':
                return 'void';
            case 'Identifier': {
                const identifier = expression;
                if (identifier.name === 'na') {
                    return 'na';
                }
                const typeInfo = context.typeMap.get(identifier.name);
                if (typeInfo && typeInfo.type !== 'unknown') {
                    return typeInfo.type;
                }
                const identifierMetadata = context.typeEnvironment.identifiers.get(identifier.name);
                const inferred = this.describeTypeMetadata(identifierMetadata);
                return inferred && inferred !== 'unknown' ? inferred : null;
            }
            case 'MemberExpression':
                return this.resolveMemberExpressionType(context, expression);
            case 'CallExpression': {
                const call = expression;
                const qualified = this.resolveQualifiedName(call.callee);
                if (qualified) {
                    const hint = this.lookupCallReturnType(qualified);
                    if (hint) {
                        return hint;
                    }
                }
                return null;
            }
            case 'UnaryExpression': {
                const unary = expression;
                return this.getExpressionTypeLabel(context, unary.argument);
            }
            case 'BinaryExpression': {
                const binary = expression;
                const left = this.getExpressionTypeLabel(context, binary.left);
                const right = this.getExpressionTypeLabel(context, binary.right);
                if (!left || !right) {
                    return null;
                }
                if (left === right) {
                    return left;
                }
                if (this.areTypesCompatible(left, right)) {
                    return left;
                }
                return null;
            }
            case 'ArrayLiteral':
                return 'array';
            case 'MatrixLiteral':
                return 'matrix';
            case 'ConditionalExpression': {
                const conditional = expression;
                const consequent = this.getExpressionTypeLabel(context, conditional.consequent);
                const alternate = this.getExpressionTypeLabel(context, conditional.alternate);
                if (consequent && alternate && this.areTypesCompatible(consequent, alternate)) {
                    return consequent;
                }
                return null;
            }
            default:
                return null;
        }
    }
    resolveMemberExpressionType(context, member) {
        const qualified = this.resolveQualifiedName(member);
        if (qualified) {
            const typeInfo = context.typeMap.get(qualified);
            if (typeInfo && typeInfo.type !== 'unknown') {
                return typeInfo.type;
            }
            const namespaceHint = this.namespaceTypeHints.get(qualified.split('.')[0] ?? '');
            if (namespaceHint) {
                return namespaceHint;
            }
        }
        const objectName = this.resolveQualifiedName(member.object);
        if (objectName) {
            const fieldKey = `${objectName}.${member.property.name}`;
            const fieldInfo = context.typeMap.get(fieldKey);
            if (fieldInfo && fieldInfo.type !== 'unknown') {
                return fieldInfo.type;
            }
        }
        return null;
    }
    resolveQualifiedName(expression) {
        if (expression.kind === 'Identifier') {
            return expression.name;
        }
        if (expression.kind === 'MemberExpression') {
            const member = expression;
            if (member.computed) {
                return null;
            }
            const objectName = this.resolveQualifiedName(member.object);
            if (!objectName) {
                return null;
            }
            return `${objectName}.${member.property.name}`;
        }
        return null;
    }
    lookupCallReturnType(name) {
        if (this.callReturnTypeHints.has(name)) {
            return this.callReturnTypeHints.get(name);
        }
        const namespace = name.split('.')[0] ?? '';
        return this.namespaceTypeHints.get(namespace) ?? null;
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
}
