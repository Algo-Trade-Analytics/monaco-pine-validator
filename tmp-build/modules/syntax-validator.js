/**
 * Syntax validation module for Pine Script v6
 * Handles basic syntax validation, script declarations, and structural checks
 */
import { KEYWORDS, NAMESPACES, PSEUDO_VARS } from '../core/constants';
import { ensureAstContext } from '../core/ast/context-utils';
import { getSourceLines as computeSourceLines } from '../core/ast/source-utils';
import { visit } from '../core/ast/traversal';
import { PineLexer, LParen, RParen, LBracket, RBracket } from '../core/ast/parser/tokens';
export class SyntaxValidator {
    constructor() {
        this.name = 'SyntaxValidator';
        this.astContext = null;
        this.astDiagnostics = null;
        this.errors = [];
        this.warnings = [];
        this.info = [];
    }
    getDependencies() {
        return [];
    }
    validate(context, config) {
        this.reset();
        this.context = context;
        this.config = config;
        this.astContext = this.getAstContext(context, config);
        this.astDiagnostics = this.getAstDiagnostics(context);
        if (!this.astContext?.ast) {
            this.validateTextFallback();
            if (this.errors.length === 0) {
                this.reportParseDiagnostics();
            }
            return this.buildResult();
        }
        this.validateWithAst(this.astContext.ast);
        this.validateOverallStructure();
        return this.buildResult();
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.astDiagnostics = null;
    }
    validateWithAst(program) {
        this.validateVersionDirectivesAst(program.directives);
        this.validateScriptDeclarationsAst(program);
        visit(program, {
            FunctionDeclaration: {
                enter: (path) => this.validateFunctionDeclarationAst(path.node),
            },
            VariableDeclaration: {
                enter: (path) => this.validateVariableDeclarationAst(path.node),
            },
            AssignmentStatement: {
                enter: (path) => this.validateAssignmentAst(path),
            },
            BinaryExpression: {
                enter: (path) => this.validateBinaryOperatorAst(path.node),
            },
            UnaryExpression: {
                enter: (path) => this.validateUnaryOperatorAst(path.node),
            },
        });
    }
    validateVersionDirectivesAst(directives) {
        if (directives.length === 0) {
            return;
        }
        const [primary, ...duplicates] = directives;
        const line = primary.loc.start.line;
        const column = primary.loc.start.column;
        this.context.hasVersion = true;
        this.context.firstVersionLine = line;
        this.context.version = primary.version;
        if (this.config.targetVersion && primary.version !== this.config.targetVersion) {
            const severity = primary.version < this.config.targetVersion ? 'error' : 'warning';
            this.addBySeverity(severity, line, column, `Script declares //@version=${primary.version} but targetVersion is ${this.config.targetVersion}.`, 'PS001');
        }
        if (line !== 1 && !this.onlyCommentsAbove(line)) {
            this.addWarning(line, column, 'Version directive should be on the first line.', 'PSW01');
        }
        if (primary.version < 5) {
            this.addWarning(line, column, `Pine version ${primary.version} is deprecated. Prefer v5 or v6.`, 'PSW02');
        }
        for (const duplicate of duplicates) {
            this.addError(duplicate.loc.start.line, duplicate.loc.start.column, 'Multiple //@version directives. Only one allowed.', 'PS002');
        }
    }
    validateScriptDeclarationsAst(program) {
        const scriptDeclarations = program.body.filter((statement) => statement.kind === 'ScriptDeclaration');
        if (scriptDeclarations.length === 0) {
            return;
        }
        const [primary, ...duplicates] = scriptDeclarations;
        this.context.scriptType = primary.scriptType;
        const firstStatement = this.getFirstStatementLine(program.body);
        if (firstStatement !== null && primary.loc.start.line !== firstStatement) {
            this.addInfo(firstStatement, 1, 'Consider placing the script declaration at the top for clarity.', 'PSI01');
        }
        for (const duplicate of duplicates) {
            if (duplicate.scriptType !== primary.scriptType) {
                this.addError(duplicate.loc.start.line, duplicate.loc.start.column, `Multiple script declarations not allowed (already '${primary.scriptType}').`, 'PS004B');
            }
        }
    }
    validateFunctionDeclarationAst(node) {
        const identifier = node.identifier;
        if (!identifier) {
            return;
        }
        const name = identifier.name;
        const parts = name.split('.');
        const invalid = parts.find((part) => KEYWORDS.has(part));
        if (!invalid) {
            return;
        }
        const isMethod = this.isMethodDeclaration(node);
        const label = isMethod ? 'Method' : 'Function';
        this.addError(node.loc.start.line, node.loc.start.column, `${label} name '${invalid}' conflicts with a Pine keyword.`, 'PS006');
    }
    validateVariableDeclarationAst(node) {
        const name = node.identifier.name;
        if (KEYWORDS.has(name) || PSEUDO_VARS.has(name)) {
            this.addError(node.loc.start.line, node.loc.start.column, `Identifier '${name}' conflicts with a Pine keyword/builtin.`, 'PS007');
        }
    }
    validateAssignmentAst(path) {
        const assignment = path.node;
        if (!assignment.left) {
            return;
        }
        const operator = assignment.operator ?? '=';
        const left = assignment.left;
        if (left.kind === 'TupleExpression') {
            this.validateTupleAssignmentAst(assignment, operator);
            return;
        }
        if (left.kind === 'MemberExpression') {
            const member = left;
            if (!member.computed && operator === '=') {
                const rootName = this.getMemberRoot(member);
                if (!rootName) {
                    return;
                }
                const propertyName = member.property.name;
                if (NAMESPACES.has(rootName) || KEYWORDS.has(rootName) || KEYWORDS.has(`${rootName}.${propertyName}`)) {
                    return;
                }
                if (rootName !== 'this' && !this.isIdentifierDeclared(rootName)) {
                    return;
                }
                const target = `${rootName}.${propertyName}`;
                this.addError(assignment.loc.start.line, assignment.loc.start.column, `Use ':=' to assign to '${target}'. '=' is reserved for the first assignment.`, 'PS016');
            }
            return;
        }
        if (left.kind === 'IndexExpression') {
            const baseName = this.getIndexBaseName(left);
            if (!baseName) {
                return;
            }
            const declared = this.isIdentifierDeclared(baseName);
            if (declared) {
                return;
            }
            if (operator === ':=') {
                this.addError(assignment.loc.start.line, assignment.loc.start.column, `Variable '${baseName}' not declared before ':=' on element.`, 'PS016A');
            }
            else if (operator.length === 2 && operator.endsWith('=')) {
                const op = operator[0];
                this.addError(assignment.loc.start.line, assignment.loc.start.column, `Variable '${baseName}' not declared before '${op}=' on element.`, 'PS017A');
            }
        }
    }
    getFirstStatementLine(body) {
        let firstLine = null;
        for (const statement of body) {
            const line = statement.loc?.start.line ?? null;
            if (line === null) {
                continue;
            }
            if (firstLine === null || line < firstLine) {
                firstLine = line;
            }
        }
        return firstLine;
    }
    validateTupleAssignmentAst(assignment, operator) {
        const tuple = assignment.left;
        if (operator.includes(':=')) {
            this.addError(assignment.loc.start.line, assignment.loc.start.column, 'Tuple destructuring must use "=" (not ":=").', 'PST03');
        }
        const hasEmptySlot = tuple.elements.some((element) => element == null);
        if (hasEmptySlot) {
            this.addWarning(assignment.loc.start.line, tuple.loc.start.column, 'Empty slot in destructuring tuple.', 'PST02');
        }
    }
    validateBinaryOperatorAst(node) {
        const invalidOps = new Map([
            ['===', "Operator '===' is not valid in Pine Script."],
            ['!==', "Operator '!==' is not valid in Pine Script."],
            ['^', "Operator '^' is not valid in Pine Script."],
            ['&&', "Operator '&&' is not valid in Pine Script. Use 'and'/'or' instead."],
            ['||', "Operator '||' is not valid in Pine Script. Use 'and'/'or' instead."],
        ]);
        const message = invalidOps.get(node.operator);
        if (message) {
            this.addWarning(node.loc.start.line, node.loc.start.column, message, 'PSO01');
        }
    }
    validateUnaryOperatorAst(node) {
        const operator = node.operator;
        if (operator === '!') {
            this.addWarning(node.loc.start.line, node.loc.start.column, "Operator '!' is not valid in Pine. Use 'not'.", 'PSO01');
            return;
        }
        if (operator === '++' || operator === '--' || operator === '~') {
            this.addWarning(node.loc.start.line, node.loc.start.column, `Operator '${operator}' is not valid in Pine Script.`, 'PSO01');
        }
    }
    validateOverallStructure() {
        const source = this.getSourceLines();
        const hasContent = source.some((line) => line.trim() !== '');
        if (!hasContent) {
            this.addError(1, 1, 'Script is empty.', 'PS-EMPTY');
        }
    }
    onlyCommentsAbove(line) {
        const sourceLines = this.getSourceLines();
        return sourceLines.slice(0, Math.max(0, line - 1)).every((raw) => {
            const trimmed = (raw || '').trim();
            if (trimmed === '')
                return true;
            if (/^\/{2}/.test(trimmed))
                return true;
            if (/^\/\*/.test(trimmed) || /^\*/.test(trimmed) || /^\*\//.test(trimmed))
                return true;
            return false;
        });
    }
    isMethodDeclaration(node) {
        return Array.isArray(node.modifiers) && node.modifiers.includes('method');
    }
    getMemberRoot(member) {
        let current = member.object;
        while (current.kind === 'MemberExpression') {
            current = current.object;
        }
        if (current.kind === 'Identifier') {
            return current.name;
        }
        return null;
    }
    getIndexBaseName(node) {
        let current = node.object;
        while (current.kind === 'MemberExpression') {
            current = current.object;
        }
        if (current.kind === 'Identifier') {
            return current.name;
        }
        return null;
    }
    isIdentifierDeclared(name) {
        if (this.context.declaredVars.has(name) || this.context.typeMap.has(name)) {
            return true;
        }
        if (this.astContext) {
            const record = this.astContext.symbolTable.get(name);
            if (record && record.declarations.length > 0) {
                return true;
            }
        }
        return false;
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
    addBySeverity(severity, line, column, message, code) {
        if (severity === 'error') {
            this.addError(line, column, message, code);
        }
        else {
            this.addWarning(line, column, message, code);
        }
    }
    getAstContext(context, config) {
        if (!config.ast || config.ast.mode === 'disabled') {
            return null;
        }
        const ensured = ensureAstContext(context, config);
        if (ensured) {
            return ensured;
        }
        return isAstValidationContext(context) ? context : null;
    }
    getAstDiagnostics(context) {
        return isAstValidationContext(context) ? context.astDiagnostics ?? null : null;
    }
    reportParseDiagnostics() {
        const diagnostics = this.astDiagnostics;
        if (!diagnostics || diagnostics.syntaxErrors.length === 0) {
            return;
        }
        for (const error of diagnostics.syntaxErrors) {
            const details = error.details;
            const line = details?.lineno ?? 1;
            const column = details?.offset ?? 1;
            const message = error.message || 'Syntax error detected.';
            this.addWarning(line, column, message, 'PSV6-SYNTAX-ERROR');
        }
    }
    validateTextFallback() {
        const source = this.getSourceText();
        if (!source.trim()) {
            return;
        }
        const lexResult = PineLexer.tokenize(source);
        this.reportLexErrors(lexResult.errors);
        const stack = [];
        for (const token of lexResult.tokens) {
            const tokenType = token.tokenType;
            if (tokenType === LParen) {
                stack.push({ token, char: '(' });
                continue;
            }
            if (tokenType === LBracket) {
                stack.push({ token, char: '[' });
                continue;
            }
            if (tokenType === RParen) {
                const last = stack.pop();
                if (!last || last.char !== '(') {
                    this.addError(token.startLine ?? 1, token.startColumn ?? 1, "Unexpected ')'.", 'PSV6-SYNTAX-ERROR');
                }
                continue;
            }
            if (tokenType === RBracket) {
                const last = stack.pop();
                if (!last || last.char !== '[') {
                    this.addError(token.startLine ?? 1, token.startColumn ?? 1, "Unexpected ']'.", 'PSV6-SYNTAX-ERROR');
                }
            }
        }
        while (stack.length > 0) {
            const unmatched = stack.pop();
            const closing = unmatched.char === '(' ? ')' : ']';
            this.addError(unmatched.token.startLine ?? 1, unmatched.token.startColumn ?? 1, `Missing closing '${closing}' for opening '${unmatched.char}'.`, 'PSV6-SYNTAX-ERROR');
        }
    }
    reportLexErrors(errors) {
        if (!Array.isArray(errors) || errors.length === 0) {
            return;
        }
        for (const error of errors) {
            const line = error.line ?? 1;
            const column = error.column ?? 1;
            const message = error.message || 'Lexing error detected.';
            this.addError(line, column, message, 'PSV6-LEXER-ERROR');
        }
    }
    getSourceLines() {
        return computeSourceLines(this.context);
    }
    getSourceText() {
        return this.getSourceLines().join('\n');
    }
    buildResult() {
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap: this.context.typeMap,
            scriptType: this.context.scriptType,
        };
    }
}
function isAstValidationContext(context) {
    return 'ast' in context;
}
