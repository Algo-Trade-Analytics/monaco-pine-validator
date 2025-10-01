import { findAncestor, visit } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';
import { getNodeSource, getSourceLine } from '../core/ast/source-utils';
export class VaripValidator {
    constructor() {
        this.name = 'VaripValidator';
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.astVaripDeclarations = [];
        this.astVaripNames = new Set();
        this.astAssignmentErrorSites = new Set();
        this.astBarstateWarningSites = new Set();
    }
    getDependencies() {
        return ['SyntaxValidator', 'TypeValidator'];
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
                typeMap: context.typeMap,
                scriptType: context.scriptType,
            };
        }
        this.validateWithAst(ast);
        return {
            isValid: this.errors.length === 0,
            errors: this.errors.map((error) => ({ ...error, severity: 'error' })),
            warnings: this.warnings.map((warning) => ({ ...warning, severity: 'warning' })),
            info: this.info.map((info) => ({ ...info, severity: 'info' })),
            typeMap: context.typeMap,
            scriptType: context.scriptType,
        };
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astVaripDeclarations = [];
        this.astVaripNames.clear();
        this.astAssignmentErrorSites.clear();
        this.astBarstateWarningSites.clear();
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
    validateWithAst(program) {
        this.collectVaripDeclarations(program);
        this.validateVaripDeclarationsAst();
        this.validateVaripScopeAst();
        this.validateVaripAssignmentsAst(program);
        this.validateVaripPerformanceAst();
    }
    collectVaripDeclarations(program) {
        visit(program, {
            VariableDeclaration: {
                enter: (path) => {
                    const node = path.node;
                    if (node.declarationKind !== 'varip') {
                        return;
                    }
                    const name = node.identifier.name;
                    const { line, column } = node.loc.start;
                    const inFunction = Boolean(findAncestor(path, (ancestor) => ancestor.node.kind === 'FunctionDeclaration'));
                    const inLoop = Boolean(findAncestor(path, (ancestor) => ancestor.node.kind === 'ForStatement' || ancestor.node.kind === 'WhileStatement'));
                    this.astVaripDeclarations.push({
                        name,
                        node,
                        initializer: node.initializer,
                        line,
                        column,
                        inFunction,
                        inLoop,
                    });
                    this.astVaripNames.add(name);
                },
            },
        });
    }
    validateVaripDeclarationsAst() {
        for (const declaration of this.astVaripDeclarations) {
            const { initializer, line, column, name } = declaration;
            if (!initializer) {
                this.addError(line, column, 'Invalid varip declaration syntax. Expected: varip <type> <name> = <value>', 'PSV6-VARIP-SYNTAX');
                this.addError(line, column, 'varip declaration must include an initial value', 'PSV6-VARIP-INITIAL-VALUE');
                continue;
            }
            if (!this.isLiteralInitializer(initializer)) {
                this.addWarning(line, column, `varip '${name}' should be initialized with a literal value for better performance`, 'PSV6-VARIP-LITERAL-INIT');
            }
            const metadata = this.astContext?.typeEnvironment.nodeTypes.get(initializer) ?? null;
            if (!metadata || metadata.kind === 'unknown') {
                this.addWarning(line, column, `Could not infer type for varip '${name}'. Consider explicit type declaration`, 'PSV6-VARIP-TYPE-INFERENCE');
            }
            if (name.length < 3) {
                this.addWarning(line, column, `varip '${name}' should have a more descriptive name`, 'PSV6-VARIP-NAMING');
            }
            if (!/^(intrabar|bar|count|state|flag|persist)/i.test(name)) {
                this.addInfo(line, column, `Consider using descriptive prefixes like 'intrabar_' or 'bar_' for varip variables`, 'PSV6-VARIP-NAMING-SUGGESTION');
            }
        }
    }
    validateVaripScopeAst() {
        for (const declaration of this.astVaripDeclarations) {
            if (declaration.inFunction) {
                this.addError(declaration.line, declaration.column, 'varip declarations are not allowed inside functions', 'PSV6-VARIP-SCOPE-FUNCTION');
            }
            if (declaration.inLoop) {
                this.addError(declaration.line, declaration.column, 'varip declarations are not allowed inside loops', 'PSV6-VARIP-SCOPE-LOOP');
            }
        }
    }
    validateVaripAssignmentsAst(program) {
        visit(program, {
            AssignmentStatement: {
                enter: (path) => {
                    const statement = path.node;
                    const left = statement.left;
                    if (left.kind !== 'Identifier') {
                        return;
                    }
                    const identifier = left;
                    const name = identifier.name;
                    if (!this.astVaripNames.has(name)) {
                        return;
                    }
                    const { line, column } = identifier.loc.start;
                    const operatorInfo = this.resolveAssignmentOperator(statement, left);
                    const operator = operatorInfo?.operator ?? '=';
                    if (!this.isAllowedAssignmentOperator(operator)) {
                        const siteKey = `${line}:${name}`;
                        if (!this.astAssignmentErrorSites.has(siteKey)) {
                            this.astAssignmentErrorSites.add(siteKey);
                            this.addError(line, column, `varip '${name}' should use ':=' for assignment, not '${operator}'`, 'PSV6-VARIP-ASSIGNMENT');
                        }
                        return;
                    }
                    if (this.assignmentHasBarstateGuard(path, statement)) {
                        return;
                    }
                    const warningKey = `${line}:${name}`;
                    if (this.astBarstateWarningSites.has(warningKey)) {
                        return;
                    }
                    this.astBarstateWarningSites.add(warningKey);
                    this.addWarning(line, column, `varip '${name}' modification should consider barstate conditions for proper intrabar behavior`, 'PSV6-VARIP-BARSTATE');
                },
            },
        });
    }
    assignmentHasBarstateGuard(path, statement) {
        if (statement.right && this.expressionContainsBarstateGuard(statement.right)) {
            return true;
        }
        let current = path.parent;
        while (current) {
            if (current.node.kind === 'IfStatement') {
                const ifNode = current.node;
                if (this.expressionContainsBarstateGuard(ifNode.test)) {
                    return true;
                }
            }
            current = current.parent;
        }
        const rawLine = getSourceLine(this.context, statement.loc.start.line);
        if (this.lineHasBarstateGuard(rawLine)) {
            return true;
        }
        const source = getNodeSource(this.context, statement);
        return this.lineHasBarstateGuard(source);
    }
    expressionContainsBarstateGuard(expression) {
        let found = false;
        visit(expression, {
            MemberExpression: {
                enter: (memberPath) => {
                    if (found) {
                        return false;
                    }
                    const member = memberPath.node;
                    if (member.computed || member.object.kind !== 'Identifier') {
                        return;
                    }
                    const objectIdentifier = member.object;
                    if (objectIdentifier.name !== 'barstate') {
                        return;
                    }
                    const property = member.property;
                    if (property.name === 'isconfirmed' || property.name === 'isnew') {
                        found = true;
                        return false;
                    }
                },
            },
        });
        return found;
    }
    lineHasBarstateGuard(line) {
        return line.includes('barstate.isconfirmed') || line.includes('barstate.isnew');
    }
    isAllowedAssignmentOperator(operator) {
        if (operator === '=') {
            return false;
        }
        switch (operator) {
            case ':=':
            case '+=':
            case '-=':
            case '*=':
            case '/=':
            case '%=':
                return true;
            default:
                return false;
        }
    }
    validateVaripPerformanceAst() {
        const varipCount = this.astVaripDeclarations.length;
        if (varipCount > 10) {
            this.addWarning(1, 1, `High number of varip variables (${varipCount}). Consider if all are necessary for performance`, 'PSV6-VARIP-PERFORMANCE');
        }
        const scriptType = this.context.scriptType ?? null;
        if (scriptType === 'strategy' && varipCount > 5) {
            this.addWarning(1, 1, 'Strategy scripts should minimize varip usage for better backtesting accuracy', 'PSV6-VARIP-STRATEGY');
        }
    }
    resolveAssignmentOperator(statement, left) {
        const rawLine = getSourceLine(this.context, statement.loc.start.line);
        const fromLine = this.resolveAssignmentOperatorFromLine(rawLine, left.loc.end.column);
        if (fromLine) {
            return fromLine;
        }
        const source = getNodeSource(this.context, statement);
        const match = source.match(/(:=|\+=|-=|\*=|\/=|%=|=)/);
        if (!match || match.index === undefined) {
            return null;
        }
        const operator = match[1];
        const rhs = source.slice(match.index + match[1].length);
        return { operator, rhs };
    }
    resolveAssignmentOperatorFromLine(line, expressionEndColumn) {
        if (!line) {
            return null;
        }
        const sliceStart = Math.max(0, Math.min(line.length, expressionEndColumn - 1));
        const afterLeft = line.slice(sliceStart);
        const match = afterLeft.match(/^(\s*)(:=|\+=|-=|\*=|\/=|%=|=)/);
        if (!match) {
            return null;
        }
        const operator = match[2];
        const rhs = afterLeft.slice(match[0].length);
        return { operator, rhs };
    }
    isLiteralInitializer(initializer) {
        switch (initializer.kind) {
            case 'NumberLiteral':
            case 'StringLiteral':
            case 'BooleanLiteral':
            case 'NullLiteral':
                return true;
            default:
                return false;
        }
    }
    getAstContext(config) {
        return ensureAstContext(this.context, config);
    }
}
