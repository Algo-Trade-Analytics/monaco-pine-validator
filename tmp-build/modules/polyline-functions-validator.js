import { visit } from '../core/ast/traversal';
import { getNodeSource } from '../core/ast/source-utils';
export class PolylineFunctionsValidator {
    constructor() {
        this.name = 'PolylineFunctionsValidator';
        this.priority = 86;
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.calls = [];
        this.idVars = new Set();
        this.typeMapUpdates = new Map();
    }
    getDependencies() {
        return ['FunctionValidator'];
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
                typeMap: new Map(),
                scriptType: null,
            };
        }
        this.collectPolylineDataFromAst(ast);
        // best practices
        this.checkBestPractices();
        this.checkTooManyOperations();
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap: this.typeMapUpdates,
            scriptType: null
        };
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.calls = [];
        this.idVars.clear();
        this.typeMapUpdates.clear();
    }
    collectPolylineDataFromAst(program) {
        visit(program, {
            VariableDeclaration: {
                enter: (path) => {
                    this.registerAstPolylineDeclaration(path.node);
                },
            },
            AssignmentStatement: {
                enter: (path) => {
                    this.registerAstPolylineAssignment(path.node);
                },
            },
            CallExpression: {
                enter: (path) => {
                    this.processAstCall(path.node);
                },
            },
        });
    }
    processAstCall(call) {
        if (call.callee.kind !== 'MemberExpression') {
            return;
        }
        const member = call.callee;
        if (member.computed || !this.isPolylineMember(member)) {
            return;
        }
        const functionName = member.property.name;
        const args = call.args.map((argument) => this.getArgumentText(argument));
        const line = member.property.loc.start.line;
        const column = member.property.loc.start.column;
        this.calls.push({ fn: functionName, line, column, args });
        this.validateCall(functionName, args, line, column);
    }
    registerAstPolylineDeclaration(declaration) {
        if (!declaration.initializer || declaration.initializer.kind !== 'CallExpression') {
            return;
        }
        const call = declaration.initializer;
        if (!this.isPolylineNewCall(call)) {
            return;
        }
        this.registerPolylineIdentifier(declaration.identifier);
    }
    registerAstPolylineAssignment(assignment) {
        if (!assignment.right || assignment.right.kind !== 'CallExpression') {
            return;
        }
        const call = assignment.right;
        if (!this.isPolylineNewCall(call)) {
            return;
        }
        const identifier = this.extractAssignedIdentifier(assignment.left);
        if (!identifier) {
            return;
        }
        this.registerPolylineIdentifier(identifier);
    }
    registerPolylineIdentifier(identifier) {
        const name = identifier.name;
        if (!name) {
            return;
        }
        this.idVars.add(name);
        const line = identifier.loc?.start.line ?? 1;
        const column = identifier.loc?.start.column ?? 1;
        const typeInfo = {
            type: 'unknown',
            isConst: false,
            isSeries: false,
            declaredAt: { line, column },
            usages: [],
        };
        this.typeMapUpdates.set(name, typeInfo);
        if (this.context.typeMap) {
            this.context.typeMap.set(name, typeInfo);
        }
    }
    isPolylineMember(member) {
        if (member.computed) {
            return false;
        }
        return this.isPolylineIdentifier(member.object);
    }
    isPolylineIdentifier(expression) {
        if (expression.kind === 'Identifier') {
            return expression.name === 'polyline';
        }
        return false;
    }
    isPolylineNewCall(call) {
        if (call.callee.kind !== 'MemberExpression') {
            return false;
        }
        const member = call.callee;
        return !member.computed && this.isPolylineIdentifier(member.object) && member.property.name === 'new';
    }
    extractAssignedIdentifier(expression) {
        if (expression.kind === 'Identifier') {
            return expression;
        }
        return null;
    }
    validateCall(fn, args, line, column) {
        switch (fn) {
            case 'new':
                if (args.length < 1) {
                    this.addError(line, column, 'polyline.new requires points array parameter', 'PSV6-POLYLINE-NEW-PARAMS');
                    return;
                }
                if (!this.isArrayArg(args[0])) {
                    this.addWarning(line, column, 'polyline.new points should be an array', 'PSV6-POLYLINE-NEW-POINTS-TYPE');
                }
                else {
                    // Heuristic: points should be an array of line references
                    const pointsCheck = this.isPointsArrayOfLines(args[0]);
                    if (!pointsCheck.ok) {
                        this.addWarning(line, column, pointsCheck.message, pointsCheck.code);
                    }
                }
                // optional style,color,width
                this.addInfo(line, column, 'Polyline created', 'PSV6-POLYLINE-NEW-INFO');
                break;
            case 'delete':
                if (args.length < 1) {
                    this.addError(line, column, 'polyline.delete requires (id)', 'PSV6-POLYLINE-DELETE-PARAMS');
                    return;
                }
                this.validateIdArg(args[0], line, column);
                if (args[0].trim() === 'na') {
                    this.addError(line, column, 'polyline id cannot be na', 'PSV6-POLYLINE-ID-NA');
                }
                else if (this.isEmptyString(args[0])) {
                    this.addWarning(line, column, 'Empty string id is suspicious', 'PSV6-POLYLINE-ID-STRING');
                }
                else {
                    this.addInfo(line, column, 'Polyline deleted', 'PSV6-POLYLINE-DELETE-INFO');
                }
                break;
        }
        // Complexity hint for nested expressions in arguments
        if (args.some(a => this.isComplex(a))) {
            this.addWarning(line, column, 'Complex polyline expression', 'PSV6-POLYLINE-COMPLEXITY');
        }
    }
    checkBestPractices() {
        const hasNew = this.calls.some(c => c.fn === 'new');
        const hasDelete = this.calls.some(c => c.fn === 'delete');
        if (hasNew && hasDelete) {
            this.addInfo(1, 1, 'Good polyline lifecycle management (create/delete)', 'PSV6-POLYLINE-BEST-PRACTICE');
        }
        else if (hasNew && !hasDelete) {
            this.addInfo(1, 1, 'Consider deleting polylines to free resources', 'PSV6-POLYLINE-MEMORY-SUGGESTION');
        }
    }
    checkTooManyOperations() {
        const count = this.calls.length;
        if (count > 12) {
            this.addWarning(1, 1, 'Many polyline operations detected', 'PSV6-POLYLINE-PERF-MANY-CALLS');
        }
        const newCount = this.calls.filter(c => c.fn === 'new').length;
        if (newCount > 50) {
            this.addError(1, 1, 'Polyline object limit exceeded', 'PSV6-POLYLINE-LIMIT-EXCEEDED');
        }
    }
    // utils
    isArrayArg(s) {
        const t = s.trim();
        // Heuristics: accept identifiers (actual type may be provided by ArrayValidator later)
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t))
            return true;
        return /\barray\./.test(t) || /^\[.*\]$/.test(t);
    }
    isPointsArrayOfLines(s) {
        const t = s.trim();
        // Clearly OK cases
        if (/\barray\.new\s*<\s*line\s*>/i.test(t))
            return { ok: true, message: '', code: '' };
        if (/\barray\.from\s*\(/.test(t) && /\bline\./.test(t))
            return { ok: true, message: '', code: '' };
        if (/^\[.*\]$/.test(t) && /\bline\./.test(t))
            return { ok: true, message: '', code: '' };
        // Unknown variable or expression — don't flag hard, but suggest
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t))
            return { ok: true, message: '', code: '' };
        // Looks like an array, but not of line references
        if (/^\[.*\]$/.test(t) || /\barray\./.test(t)) {
            return { ok: false, message: 'points should be an array of line references', code: 'PSV6-POLYLINE-POINTS-CONTENT-TYPE' };
        }
        return { ok: true, message: '', code: '' };
    }
    validateIdArg(s, line, column) {
        const t = s.trim();
        if (t === 'na')
            return;
        if (/^\s*polyline\.new\s*\(/.test(t))
            return;
        // If simple identifier but not seen before, warn (soft check)
        const m = t.match(/^[A-Za-z_][A-Za-z0-9_]*$/);
        if (m && !this.idVars.has(m[0])) {
            this.addWarning(line, column, 'Unknown polyline id reference', 'PSV6-POLYLINE-ID-UNKNOWN');
        }
    }
    isEmptyString(s) { const t = s.trim(); return t === '""' || t === "''"; }
    isComplex(s) { const t = s.trim(); return /\bta\./.test(t) || /\(/.test(t) || /\+|\-|\*|\//.test(t); }
    addError(line, column, message, code) {
        this.errors.push({ line, column, message, code, severity: 'error' });
    }
    addWarning(line, column, message, code) {
        this.warnings.push({ line, column, message, code, severity: 'warning' });
    }
    addInfo(line, column, message, code) {
        this.info.push({ line, column, message, code, severity: 'info' });
    }
    getArgumentText(argument) {
        const valueText = this.getExpressionText(argument.value).trim();
        if (argument.name) {
            return `${argument.name.name}=${valueText}`;
        }
        return valueText;
    }
    getExpressionText(expression) {
        switch (expression.kind) {
            case 'Identifier':
                return expression.name;
            case 'CallExpression':
                return getNodeSource(this.context, expression);
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
        return isAstValidationContext(this.context) ? this.context : null;
    }
}
function isAstValidationContext(context) {
    return 'ast' in context;
}
