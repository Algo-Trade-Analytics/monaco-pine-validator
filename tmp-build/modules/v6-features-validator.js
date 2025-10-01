/**
 * Pine Script v6 features validator
 *
 * Historically this module offered lightweight heuristics for the new
 * language features introduced in Pine Script v6 by scanning raw source
 * lines.  Most responsibilities have since migrated to dedicated
 * validators that operate on the shared AST and semantic context.  The
 * remaining logic focuses on compatibility guidance that is still unique
 * to this module using the shared AST data when available.
 */
import { visit } from '../core/ast/traversal';
import { KEYWORDS, NAMESPACES } from '../core/constants';
const TEXT_FORMAT_FUNCTIONS = new Set(['format_bold', 'format_italic', 'format_color', 'format_size']);
const REQUEST_INFO_FUNCTIONS = new Set(['dividends', 'earnings', 'splits']);
export class V6FeaturesValidator {
    constructor() {
        this.name = 'V6FeaturesValidator';
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.astTypeEnvironment = null;
    }
    getDependencies() {
        return ['SyntaxValidator'];
    }
    validate(context, config) {
        this.reset();
        this.context = context;
        if (config.targetVersion !== 6) {
            return this.buildResult();
        }
        if (!isAstContext(context) || !context.ast || (config.ast && config.ast.mode === 'disabled')) {
            return this.buildResult();
        }
        this.astContext = context;
        this.astTypeEnvironment = context.typeEnvironment;
        this.validateWithAst(context.ast);
        return this.buildResult();
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.astTypeEnvironment = null;
    }
    buildResult() {
        const toValidationError = (entry, severity) => ({
            ...entry,
            severity,
        });
        return {
            isValid: this.errors.length === 0,
            errors: this.errors.map((entry) => toValidationError(entry, 'error')),
            warnings: this.warnings.map((entry) => toValidationError(entry, 'warning')),
            info: this.info.map((entry) => toValidationError(entry, 'info')),
            typeMap: this.context.typeMap,
            scriptType: this.context.scriptType,
        };
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
        visit(program, {
            SwitchStatement: {
                enter: (path) => this.processSwitchStatement(path.node),
            },
            VariableDeclaration: {
                enter: (path) => this.processVariableDeclaration(path.node),
            },
            TypeDeclaration: {
                enter: (path) => this.processTypeDeclaration(path.node),
            },
            EnumDeclaration: {
                enter: (path) => this.processEnumDeclaration(path.node),
            },
            CallExpression: {
                enter: (path) => this.processCallExpression(path.node),
            },
            IndexExpression: {
                enter: (path) => this.processIndexExpression(path.node),
            },
        });
    }
    processSwitchStatement(node) {
        const { line, column } = node.loc.start;
        const switchType = this.getExpressionType(node.discriminant);
        if (node.cases.length === 0) {
            this.addWarning(line, column, 'Switch statement requires at least one case clause.', 'PSV6-SWITCH-NO-CASES');
        }
        let defaultEncountered = false;
        for (const switchCase of node.cases) {
            const { line: caseLine, column: caseColumn } = switchCase.loc.start;
            if (switchCase.test === null) {
                if (!switchCase.consequent.length) {
                    this.addError(caseLine, caseColumn, 'Default clause requires a result expression.', 'PSV6-SWITCH-DEFAULT-RESULT');
                }
                if (defaultEncountered) {
                    this.addError(caseLine, caseColumn, 'Switch statement can only have one default clause.', 'PSV6-SWITCH-MULTIPLE-DEFAULT');
                }
                defaultEncountered = true;
                continue;
            }
            if (!switchCase.consequent.length) {
                this.addError(caseLine, caseColumn, 'Case clause requires a result expression.', 'PSV6-SWITCH-CASE-RESULT');
            }
            const caseType = this.getExpressionType(switchCase.test);
            if (switchType && caseType && switchType !== caseType) {
                this.addWarning(caseLine, caseColumn, `Case value type '${caseType}' may not be compatible with switch expression type '${switchType}'.`, 'PSV6-SWITCH-TYPE-MISMATCH');
            }
        }
        if (!defaultEncountered) {
            this.addInfo(line, column, 'Consider adding a default clause to handle unexpected values.', 'PSV6-SWITCH-NO-DEFAULT');
        }
    }
    processVariableDeclaration(node) {
        if (node.declarationKind === 'varip' && this.context.scriptType === 'library') {
            const { line, column } = node.identifier.loc.start;
            this.addError(line, column, 'varip variables are not allowed in libraries.', 'PSV6-VARIP-LIBRARY');
        }
    }
    processTypeDeclaration(node) {
        const typeName = node.identifier.name;
        if (KEYWORDS.has(typeName) || NAMESPACES.has(typeName)) {
            const { line, column } = node.identifier.loc.start;
            this.addError(line, column, `Type name '${typeName}' conflicts with a built-in keyword or type.`, 'PSV6-UDT-CONFLICT');
        }
    }
    processEnumDeclaration(node) {
        const enumName = node.identifier.name;
        if (KEYWORDS.has(enumName) || NAMESPACES.has(enumName)) {
            const { line, column } = node.identifier.loc.start;
            this.addError(line, column, `Enum name '${enumName}' conflicts with a built-in keyword or type.`, 'PSV6-ENUM-CONFLICT');
        }
    }
    processCallExpression(node) {
        const path = this.getMemberPath(node.callee);
        if (!path || path.length === 0) {
            return;
        }
        const namespace = path[0];
        const member = path[1] ?? null;
        const { line, column } = node.loc.start;
        if (namespace === 'request' && member === 'security') {
            if (this.hasDynamicSeriesArgument(node.args)) {
                this.addInfo(line, column, 'Dynamic data requests with series string arguments are supported in v6.', 'PSV6-DYNAMIC-REQUEST');
            }
        }
        else if (namespace === 'request' && member && REQUEST_INFO_FUNCTIONS.has(member)) {
            this.addInfo(line, column, `request.${member} is available in Pine Script v6.`, 'PSV6-REQUEST-FUNCTION');
        }
        if (namespace === 'text' && member && TEXT_FORMAT_FUNCTIONS.has(member)) {
            const functionName = `text.${member}`;
            this.addInfo(line, column, `${functionName} is available in Pine Script v6 for text formatting.`, 'PSV6-TEXT-FORMAT');
            if ((member === 'format_bold' || member === 'format_italic') && !this.firstArgumentIsString(node.args)) {
                this.addWarning(line, column, `${functionName} requires a string argument.`, 'PSV6-TEXT-FORMAT-STRING');
            }
            if (member === 'format_color' && !this.hasColorArgument(node.args)) {
                this.addWarning(line, column, `${functionName} requires a color argument.`, 'PSV6-TEXT-FORMAT-COLOR');
            }
        }
    }
    processIndexExpression(node) {
        if (node.index.kind === 'NumberLiteral' && node.index.value === 0) {
            const { line, column } = node.index.loc.start;
            this.addInfo(line, column, 'History reference [0] is equivalent to the current value.', 'PSV6-HISTORY-ZERO');
        }
    }
    hasDynamicSeriesArgument(args) {
        return args.some((arg) => {
            const path = this.getMemberPath(arg.value);
            if (!path || path.length < 2) {
                return false;
            }
            return ((path[0] === 'timeframe' && path[1] === 'period') ||
                (path[0] === 'syminfo' && path[1] === 'tickerid'));
        });
    }
    firstArgumentIsString(args) {
        if (args.length === 0) {
            return false;
        }
        return this.isStringExpression(args[0].value);
    }
    hasColorArgument(args) {
        if (args.length < 2) {
            return false;
        }
        return this.isColorExpression(args[1].value);
    }
    getMemberPath(expression) {
        if (expression.kind === 'Identifier') {
            return [expression.name];
        }
        if (expression.kind === 'MemberExpression') {
            const member = expression;
            if (member.computed) {
                return null;
            }
            const objectPath = this.getMemberPath(member.object);
            if (!objectPath) {
                return null;
            }
            return [...objectPath, member.property.name];
        }
        return null;
    }
    isStringExpression(expression) {
        const type = this.getExpressionType(expression);
        if (type === 'string') {
            return true;
        }
        return expression.kind === 'StringLiteral';
    }
    isColorExpression(expression) {
        const type = this.getExpressionType(expression);
        if (type === 'color') {
            return true;
        }
        if (expression.kind === 'MemberExpression') {
            const path = this.getMemberPath(expression);
            return !!path && path[0] === 'color';
        }
        if (expression.kind === 'CallExpression') {
            const path = this.getMemberPath(expression.callee);
            return !!path && path[0] === 'color';
        }
        return false;
    }
    getExpressionType(expression) {
        if (this.astTypeEnvironment) {
            const metadata = this.astTypeEnvironment.nodeTypes.get(expression);
            const described = this.describeTypeMetadata(metadata);
            if (described && described !== 'unknown') {
                return described;
            }
            if (expression.kind === 'Identifier') {
                const identifier = expression;
                const identifierMetadata = this.astTypeEnvironment.identifiers.get(identifier.name);
                const identifierType = this.describeTypeMetadata(identifierMetadata);
                if (identifierType && identifierType !== 'unknown') {
                    return identifierType;
                }
            }
        }
        return this.inferLiteralType(expression);
    }
    describeTypeMetadata(metadata) {
        return metadata ? metadata.kind : null;
    }
    inferLiteralType(expression) {
        switch (expression.kind) {
            case 'NumberLiteral':
                return Number.isInteger(expression.value) ? 'int' : 'float';
            case 'BooleanLiteral':
                return 'bool';
            case 'StringLiteral':
                return 'string';
            default:
                return null;
        }
    }
}
function isAstContext(context) {
    return 'ast' in context;
}
