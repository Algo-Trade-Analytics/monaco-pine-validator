/**
 * Enhanced Semantic Validator Module
 *
 * Handles enhanced semantic validation for Pine Script v6:
 * - PSV6-TYPE-FLOW: Advanced type checking
 * - PSV6-TYPE-INFERENCE: Type inference suggestions
 */
import { visit } from '../core/ast/traversal';
function isAstValidationContext(context) {
    return 'ast' in context;
}
export class EnhancedSemanticValidator {
    constructor() {
        this.name = 'EnhancedSemanticValidator';
        this.priority = 85; // Run after type validation
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
    }
    getDependencies() {
        return ['CoreValidator', 'TypeValidator'];
    }
    validate(context, config) {
        this.reset();
        this.config = config;
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
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
    }
    addError(line, column, message, code, suggestion) {
        this.errors.push({
            line,
            column,
            message,
            severity: 'error',
            code,
            suggestion,
        });
    }
    addInfo(line, column, message, code, suggestion) {
        if (this.config.enableInfo === false) {
            return;
        }
        this.info.push({
            line,
            column,
            message,
            severity: 'info',
            code,
            suggestion,
        });
    }
    validateWithAst(program) {
        if (!this.astContext) {
            return;
        }
        const typedVariables = new Set();
        const inputVariables = new Set();
        visit(program, {
            VariableDeclaration: {
                enter: (path) => {
                    const node = path.node;
                    this.handleAstVariableDeclaration(node, typedVariables, inputVariables);
                },
            },
            AssignmentStatement: {
                enter: (path) => {
                    const node = path.node;
                    this.handleAstAssignment(node, typedVariables);
                },
            },
            FunctionDeclaration: {
                enter: (path) => {
                    const node = path.node;
                    this.handleAstFunctionDeclaration(node);
                },
            },
        });
    }
    handleAstVariableDeclaration(node, typedVariables, inputVariables) {
        const name = node.identifier.name;
        if (node.typeAnnotation) {
            typedVariables.add(name);
        }
        const typeInfo = this.interpretTypeReference(node.typeAnnotation);
        if (typeInfo.qualifier === 'input') {
            inputVariables.add(name);
        }
        if (!node.initializer || !this.astContext) {
            return;
        }
        const initializerType = this.getExpressionType(node.initializer);
        if (this.shouldFlagSeriesToSimple(typeInfo, initializerType)) {
            const { line, column } = node.loc.start;
            this.addError(line, column, "Cannot assign series value to simple variable. Use [0] to get the current value.", 'PSV6-TYPE-FLOW', 'Use [0] to get the current value from a series');
        }
        if (typeInfo.qualifier === 'series' &&
            this.expressionUsesIdentifiers(node.initializer, inputVariables)) {
            const { line, column } = node.loc.start;
            this.addError(line, column, 'Input value assigned to series variable may cause issues. Consider the context.', 'PSV6-TYPE-FLOW', 'Ensure input values are used appropriately in series context');
        }
        if (!node.typeAnnotation && this.isComplexExpression(node.initializer)) {
            const { line, column } = node.loc.start;
            this.addInfo(line, column, 'Consider adding explicit type annotation for better code clarity.', 'PSV6-TYPE-INFERENCE', 'Add explicit type annotation (e.g., int myVar = 42)');
        }
    }
    handleAstAssignment(node, typedVariables) {
        if (!node.right || node.left.kind !== 'Identifier') {
            return;
        }
        const identifier = node.left;
        if (typedVariables.has(identifier.name)) {
            return;
        }
        if (!this.isComplexExpression(node.right)) {
            return;
        }
        const { line, column } = node.loc.start;
        this.addInfo(line, column, 'Consider adding explicit type annotation for better code clarity.', 'PSV6-TYPE-INFERENCE', 'Add explicit type annotation (e.g., int myVar = 42)');
    }
    handleAstFunctionDeclaration(node) {
        if (node.returnType) {
            return;
        }
        const identifier = node.identifier?.name ?? null;
        if (!identifier) {
            return;
        }
        if (!this.shouldHaveReturnType(identifier) && !this.blockContainsConditional(node)) {
            return;
        }
        const { line, column } = node.loc.start;
        this.addInfo(line, column, 'Consider adding explicit return type annotation for function clarity.', 'PSV6-TYPE-INFERENCE', 'Add explicit return type annotation (e.g., int myFunction() => ...)');
    }
    blockContainsConditional(node) {
        let found = false;
        visit(node.body, {
            ConditionalExpression: {
                enter: () => {
                    found = true;
                    return false;
                },
            },
        });
        return found;
    }
    shouldHaveReturnType(funcName) {
        const returnTypeFunctions = [
            'calculate',
            'compute',
            'get',
            'find',
            'search',
            'check',
            'validate',
            'process',
            'transform',
            'convert',
            'parse',
            'format',
            'build',
            'create',
        ];
        return returnTypeFunctions.some((prefix) => funcName.toLowerCase().startsWith(prefix));
    }
    interpretTypeReference(reference) {
        if (!reference) {
            return { qualifier: null, baseType: null };
        }
        const name = reference.name.name;
        if (name === 'series' || name === 'simple' || name === 'input') {
            const base = reference.generics[0] ? this.stringifyTypeReference(reference.generics[0]) : null;
            return { qualifier: name, baseType: base };
        }
        return { qualifier: null, baseType: name };
    }
    stringifyTypeReference(reference) {
        const base = reference.name.name;
        if (reference.generics.length === 0) {
            return base;
        }
        const generic = reference.generics.map((child) => this.stringifyTypeReference(child)).join(', ');
        return `${base}<${generic}>`;
    }
    getExpressionType(expression) {
        return this.astContext?.typeEnvironment.nodeTypes.get(expression) ?? null;
    }
    shouldFlagSeriesToSimple(typeInfo, initializerType) {
        if (!initializerType || initializerType.kind !== 'series') {
            return false;
        }
        if (typeInfo.qualifier === 'series') {
            return false;
        }
        if (typeInfo.qualifier === 'input') {
            return false;
        }
        if (typeInfo.qualifier === 'simple') {
            return true;
        }
        if (typeInfo.baseType && this.isPrimitiveType(typeInfo.baseType)) {
            return true;
        }
        return false;
    }
    isPrimitiveType(name) {
        return ['int', 'float', 'bool', 'string', 'color'].includes(name);
    }
    expressionUsesIdentifiers(expression, identifiers) {
        let found = false;
        visit(expression, {
            Identifier: {
                enter: (path) => {
                    const identifier = path.node;
                    if (identifiers.has(identifier.name)) {
                        found = true;
                        return false;
                    }
                    return undefined;
                },
            },
        });
        return found;
    }
    isComplexExpression(expression) {
        switch (expression.kind) {
            case 'ConditionalExpression':
                return true;
            case 'BinaryExpression': {
                const binary = expression;
                return ['+', '-', '*', '/', '%', '^'].includes(binary.operator);
            }
            case 'CallExpression': {
                const call = expression;
                const calleeName = this.resolveCalleeName(call.callee);
                return Boolean(calleeName && (calleeName.startsWith('ta.') || calleeName.startsWith('request.')));
            }
            default:
                return false;
        }
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
            return objectName ? `${objectName}.${member.property.name}` : null;
        }
        return null;
    }
}
