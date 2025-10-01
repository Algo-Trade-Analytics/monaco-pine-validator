/**
 * Scope Management Validation Module
 *
 * Handles variable scope, declaration validation, and access control for Pine Script v6.
 * Extracts scope management logic from EnhancedPineScriptValidator.
 */
import { KEYWORDS, NAMESPACES, PSEUDO_VARS, WILDCARD_IDENT } from '../core/constants';
import { visit } from '../core/ast/traversal';
export class ScopeValidator {
    constructor() {
        this.name = 'ScopeValidator';
        this.priority = 80; // High priority, runs after CoreValidator
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astDuplicateWarningSites = new Set();
        this.astShadowWarningSites = new Set();
        this.astUndefinedWarningSites = new Set();
        this.astInvalidIdentifierErrorSites = new Set();
        this.astKeywordErrorSites = new Set();
        this.astUdtFieldLocations = new Set();
    }
    getDependencies() {
        return ['CoreValidator']; // Depends on core validation
    }
    validate(context, _config) {
        this.reset();
        const astContext = this.isAstContext(context) && context.ast ? context : null;
        if (!astContext?.ast) {
            return {
                isValid: true,
                errors: [],
                warnings: [],
                info: [],
                typeMap: context.typeMap ?? new Map(),
                scriptType: context.scriptType ?? null,
            };
        }
        this.validateWithAst(astContext);
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
        this.astDuplicateWarningSites.clear();
        this.astShadowWarningSites.clear();
        this.astUndefinedWarningSites.clear();
        this.astInvalidIdentifierErrorSites.clear();
        this.astKeywordErrorSites.clear();
        this.astUdtFieldLocations.clear();
    }
    addError(line, column, message, code) {
        this.errors.push({ line, column, message, severity: 'error', code });
    }
    addWarning(line, column, message, code) {
        this.warnings.push({ line, column, message, severity: 'warning', code });
    }
    addInfo(line, column, message, code) {
        this.info.push({ line, column, message, severity: 'info', code });
    }
    isAstContext(context) {
        return 'ast' in context;
    }
    validateWithAst(context) {
        const program = context.ast;
        if (!program) {
            return;
        }
        this.collectAstUdtFieldLocations(program);
        const identifierPaths = this.collectAstIdentifierPaths(program);
        this.emitAstDuplicateDeclarationWarnings(context);
        this.emitAstShadowingWarnings(context);
        this.emitAstUndefinedReferenceWarnings(context, identifierPaths);
        this.emitAstIdentifierDeclarationErrors(context);
    }
    collectAstIdentifierPaths(program) {
        const paths = new Map();
        visit(program, {
            Identifier: {
                enter: (path) => {
                    paths.set(path.node, path);
                },
            },
        });
        return paths;
    }
    collectAstUdtFieldLocations(program) {
        this.astUdtFieldLocations.clear();
        visit(program, {
            TypeDeclaration: {
                enter: (path) => {
                    for (const field of path.node.fields) {
                        const { line, column } = field.identifier.loc.start;
                        this.astUdtFieldLocations.add(`${line}:${column}`);
                    }
                },
            },
        });
    }
    emitAstDuplicateDeclarationWarnings(context) {
        for (const record of context.symbolTable.values()) {
            const entries = this.extractAstDeclarationEntries(record);
            if (!entries.length) {
                continue;
            }
            const byScope = new Map();
            for (const entry of entries) {
                if (!entry.scopeId) {
                    continue;
                }
                if (!byScope.has(entry.scopeId)) {
                    byScope.set(entry.scopeId, []);
                }
                byScope.get(entry.scopeId).push(entry);
            }
            for (const declarations of byScope.values()) {
                if (declarations.length <= 1) {
                    continue;
                }
                const sorted = [...declarations].sort((a, b) => {
                    if (a.location.line === b.location.line) {
                        return a.location.column - b.location.column;
                    }
                    return a.location.line - b.location.line;
                });
                for (let i = 1; i < sorted.length; i++) {
                    const duplicate = sorted[i];
                    const siteKey = `${duplicate.location.line}:${record.name}`;
                    if (this.astDuplicateWarningSites.has(siteKey)) {
                        continue;
                    }
                    this.astDuplicateWarningSites.add(siteKey);
                    this.addWarning(duplicate.location.line, duplicate.location.column, `Identifier '${record.name}' already declared in this block; use ':=' to reassign.`, 'PSW03');
                }
            }
        }
    }
    shouldCheckAstIdentifierName(kind) {
        return kind === 'variable' || kind === 'unknown';
    }
    isValidIdentifierName(name) {
        return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
    }
    isKeywordCompatibleIdentifier(name) {
        if (!name) {
            return true;
        }
        if (KEYWORDS.has(name) || PSEUDO_VARS.has(name)) {
            return false;
        }
        return true;
    }
    emitAstShadowingWarnings(context) {
        for (const record of context.symbolTable.values()) {
            const entries = this.extractAstDeclarationEntries(record);
            if (entries.length <= 1) {
                continue;
            }
            for (const entry of entries) {
                if (!entry.scopeId) {
                    continue;
                }
                const shadowKey = `${entry.location.line}:${record.name}`;
                if (this.astShadowWarningSites.has(shadowKey)) {
                    continue;
                }
                let parentId = context.scopeGraph.nodes.get(entry.scopeId)?.parent ?? null;
                while (parentId) {
                    const ancestor = entries.find((candidate) => candidate.scopeId === parentId);
                    if (ancestor) {
                        this.astShadowWarningSites.add(shadowKey);
                        this.addWarning(entry.location.line, entry.location.column, `Identifier '${record.name}' shadows an outer declaration.`, 'PSW04');
                        break;
                    }
                    parentId = context.scopeGraph.nodes.get(parentId)?.parent ?? null;
                }
            }
        }
    }
    extractAstDeclarationEntries(record) {
        const metadata = record.metadata ?? {};
        const scopes = metadata.declarationScopes ?? [];
        const kinds = metadata.declarationKinds ?? [];
        const entries = [];
        record.declarations.forEach((location, index) => {
            const scopeId = scopes[index] ?? null;
            const kind = kinds[index] ?? record.kind;
            if (!this.shouldCheckAstDeclarationKind(kind)) {
                return;
            }
            const key = `${location.line}:${location.column}`;
            if (this.astUdtFieldLocations.has(key)) {
                return;
            }
            entries.push({
                scopeId,
                location: { line: location.line, column: location.column },
                kind,
            });
        });
        return entries;
    }
    shouldCheckAstDeclarationKind(kind) {
        return kind === 'variable' || kind === 'unknown' || kind === 'type';
    }
    emitAstUndefinedReferenceWarnings(context, identifierPaths) {
        const ignoredNames = this.createAstIgnoredNameSet(context);
        const declaredNames = new Set();
        for (const record of context.symbolTable.values()) {
            if (!record.declarations.length) {
                continue;
            }
            const metadataKinds = record.metadata?.declarationKinds ?? [];
            if (metadataKinds.length === 0) {
                declaredNames.add(record.name);
                continue;
            }
            if (metadataKinds.some((kind) => this.shouldCheckAstDeclarationKind(kind) || kind === 'parameter')) {
                declaredNames.add(record.name);
            }
        }
        for (const record of context.symbolTable.values()) {
            if (declaredNames.has(record.name)) {
                continue;
            }
            if (this.shouldIgnoreAstUndefinedName(record.name, ignoredNames)) {
                continue;
            }
            for (const reference of record.references) {
                const node = reference.node;
                if (!node || node.kind !== 'Identifier') {
                    continue;
                }
                if (!this.shouldEmitAstUndefinedForNode(node, identifierPaths)) {
                    continue;
                }
                const siteKey = `${reference.line}:${reference.column}:${record.name}`;
                if (this.astUndefinedWarningSites.has(siteKey)) {
                    continue;
                }
                this.astUndefinedWarningSites.add(siteKey);
                this.addWarning(reference.line, reference.column, `Potential undefined reference '${record.name}'.`, 'PSU02');
            }
        }
    }
    emitAstIdentifierDeclarationErrors(context) {
        for (const record of context.symbolTable.values()) {
            const entries = this.extractAstDeclarationEntries(record);
            if (!entries.length) {
                continue;
            }
            for (const entry of entries) {
                if (!this.shouldCheckAstIdentifierName(entry.kind)) {
                    continue;
                }
                const siteKey = `${entry.location.line}:${entry.location.column}:${record.name}`;
                if (!this.isValidIdentifierName(record.name)) {
                    if (this.astInvalidIdentifierErrorSites.has(siteKey)) {
                        continue;
                    }
                    this.astInvalidIdentifierErrorSites.add(siteKey);
                    this.addError(entry.location.line, entry.location.column, `Invalid identifier '${record.name}'.`, 'PS006');
                    continue;
                }
                if (!this.isKeywordCompatibleIdentifier(record.name)) {
                    if (this.astKeywordErrorSites.has(siteKey)) {
                        continue;
                    }
                    this.astKeywordErrorSites.add(siteKey);
                    this.addError(entry.location.line, entry.location.column, `Identifier '${record.name}' conflicts with a Pine keyword/builtin.`, 'PS007');
                }
            }
        }
    }
    createAstIgnoredNameSet(context) {
        const ignored = new Set();
        for (const name of KEYWORDS)
            ignored.add(name);
        for (const name of PSEUDO_VARS)
            ignored.add(name);
        for (const name of NAMESPACES)
            ignored.add(name);
        for (const name of WILDCARD_IDENT)
            ignored.add(name);
        context.functionNames.forEach((name) => ignored.add(name));
        context.methodNames.forEach((name) => ignored.add(name));
        context.usedVars.forEach((name) => ignored.add(name));
        context.declaredVars.forEach((_line, declaredName) => ignored.add(declaredName));
        for (const params of context.functionParams.values()) {
            for (const rawParam of params) {
                const cleaned = rawParam.trim().replace(/<[^>]*>/g, '');
                const fragments = cleaned.split(/\s+/);
                const identifier = fragments[fragments.length - 1];
                if (identifier) {
                    ignored.add(identifier);
                }
            }
        }
        ignored.add('this');
        return ignored;
    }
    shouldIgnoreAstUndefinedName(name, ignoredNames) {
        if (!name || ignoredNames.has(name)) {
            return true;
        }
        return false;
    }
    shouldEmitAstUndefinedForNode(node, identifierPaths) {
        const path = identifierPaths.get(node);
        if (!path) {
            return false;
        }
        const parent = path.parent;
        if (!parent) {
            return false;
        }
        const key = path.key;
        switch (parent.node.kind) {
            case 'VariableDeclaration':
            case 'TypeDeclaration':
            case 'TypeField':
            case 'FunctionDeclaration':
            case 'Parameter':
            case 'ScriptDeclaration':
                return key !== 'identifier';
            case 'AssignmentStatement':
                return key !== 'left';
            case 'CallExpression':
                return key !== 'callee';
            case 'MemberExpression':
                return key !== 'property';
            case 'Argument':
                return key !== 'name';
            case 'TypeReference':
                return false;
            default:
                break;
        }
        return true;
    }
}
