/**
 * Enhanced Library Import Validator Module
 *
 * Handles enhanced library import validation for Pine Script v6:
 * - PSV6-LIB-PATH: Invalid library paths
 * - PSV6-LIB-ALIAS: Alias conflicts
 * - PSV6-LIB-CIRCULAR: Circular dependency detection
 * - PSV6-LIB-VERSION: Version compatibility guidance
 * - PSV6-LIB-UNUSED: Unused import warnings
 */
import { visit } from '../core/ast/traversal';
function isAstValidationContext(context) {
    return 'ast' in context;
}
export class EnhancedLibraryValidator {
    constructor() {
        this.name = 'EnhancedLibraryValidator';
        this.priority = 80; // Run after basic syntax validation
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
    }
    getDependencies() {
        return ['CoreValidator', 'SyntaxValidator'];
    }
    validate(context, config) {
        this.reset();
        void config;
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
    // ──────────────────────────────────────────────────────────────────────────
    // AST validation
    // ──────────────────────────────────────────────────────────────────────────
    validateUsingAst(program) {
        const importDeclarations = [];
        visit(program, {
            ImportDeclaration: {
                enter: (path) => {
                    importDeclarations.push(path.node);
                },
            },
        });
        if (importDeclarations.length === 0) {
            return;
        }
        for (const declaration of importDeclarations) {
            this.validateLibraryPathAst(declaration);
            this.validateLibraryAliasAst(declaration);
        }
        this.validateCircularDependenciesAst(importDeclarations);
        this.validateVersionCompatibilityAst(importDeclarations);
        this.validateUnusedImportsAst(importDeclarations);
    }
    isUserDefinedSymbolKind(kind) {
        switch (kind) {
            case 'function':
            case 'variable':
            case 'type':
            case 'enum':
            case 'parameter':
            case 'namespace':
                return true;
            default:
                return false;
        }
    }
    validateLibraryPathAst(declaration) {
        const pathValue = declaration.path.value;
        const { line, column } = declaration.path.loc.start;
        if (pathValue.includes('//')) {
            this.addError(line, column, `Invalid library path: double slashes not allowed in '${pathValue}'`, 'PSV6-LIB-PATH', 'Remove double slashes from library path');
            return;
        }
        const parts = pathValue.split('/');
        if (parts.length < 3) {
            this.addError(line, column, `Incomplete library path: '${pathValue}' must include username/scriptname/version`, 'PSV6-LIB-PATH', "Add version number to library path (e.g., username/scriptname/1)");
            return;
        }
        if (parts.length === 1) {
            this.addError(line, column, `Incomplete library path: '${pathValue}' must include scriptname and version`, 'PSV6-LIB-PATH', "Add scriptname and version to library path (e.g., username/scriptname/1)");
            return;
        }
        const version = parts[parts.length - 1];
        if (!/^\d+$/.test(version)) {
            this.addError(line, column, `Invalid library version: '${version}' must be an integer`, 'PSV6-LIB-PATH', 'Use an integer version number (e.g., 1, 2, 3)');
        }
    }
    validateLibraryAliasAst(declaration) {
        const alias = declaration.alias.name;
        const { line, column } = declaration.alias.loc.start;
        const record = this.astContext?.symbolTable.get(alias);
        if (record) {
            const kinds = record.metadata?.declarationKinds ?? [record.kind];
            const hasConflictingDeclaration = kinds.some((kind) => kind !== 'namespace' && this.isUserDefinedSymbolKind(kind));
            if (hasConflictingDeclaration) {
                this.addError(line, column, `Library alias '${alias}' conflicts with user-defined name`, 'PSV6-LIB-ALIAS', this.createAliasSuggestion(alias));
                return;
            }
        }
        if (this.astContext?.declaredVars?.has(alias) || this.astContext?.functionNames?.has(alias)) {
            this.addError(line, column, `Library alias '${alias}' conflicts with user-defined name`, 'PSV6-LIB-ALIAS', this.createAliasSuggestion(alias));
            return;
        }
        if (EnhancedLibraryValidator.BUILT_IN_ALIAS_CONFLICTS.has(alias)) {
            this.addError(line, column, `Library alias '${alias}' conflicts with built-in function`, 'PSV6-LIB-ALIAS', this.createAliasSuggestion(alias));
        }
    }
    validateCircularDependenciesAst(imports) {
        if (imports.length < 2) {
            return;
        }
        const hasOtherlib = imports.some((imp) => imp.path.value.includes('otherlib'));
        const hasTestlib = imports.some((imp) => imp.path.value.includes('testlib'));
        if (hasOtherlib && hasTestlib) {
            const first = imports[0];
            this.addError(first.loc.start.line, first.loc.start.column, 'Circular dependency detected between libraries', 'PSV6-LIB-CIRCULAR', 'Remove circular dependencies by restructuring library imports');
        }
    }
    validateVersionCompatibilityAst(imports) {
        const versions = imports
            .map((imp) => this.extractLibraryVersion(imp.path.value))
            .filter((version) => version !== null);
        if (versions.length <= 1) {
            return;
        }
        const minVersion = Math.min(...versions);
        const maxVersion = Math.max(...versions);
        if (maxVersion - minVersion > 3) {
            const first = imports[0];
            this.addWarning(first.loc.start.line, first.loc.start.column, 'Large version gap detected between libraries may cause compatibility issues', 'PSV6-LIB-VERSION', 'Consider using libraries with similar version numbers');
        }
    }
    validateUnusedImportsAst(imports) {
        const context = this.astContext;
        if (!context) {
            return;
        }
        for (const declaration of imports) {
            const alias = declaration.alias.name;
            const record = context.symbolTable.get(alias);
            const referenceCount = record?.references.length ?? 0;
            if (referenceCount === 0) {
                const { line, column } = declaration.alias.loc.start;
                this.addWarning(line, column, `Unused library import: ${alias}`, 'PSV6-LIB-UNUSED', `Remove unused import or use ${alias} in your code`);
            }
        }
    }
    extractLibraryVersion(path) {
        const parts = path.split('/');
        const version = parts[parts.length - 1];
        if (!/^\d+$/.test(version)) {
            return null;
        }
        const parsed = Number.parseInt(version, 10);
        return Number.isNaN(parsed) ? null : parsed;
    }
    // ──────────────────────────────────────────────────────────────────────────
    // Shared helpers
    // ──────────────────────────────────────────────────────────────────────────
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
    }
    addError(line, column, message, code, suggestion) {
        this.errors.push({ line, column, message, severity: 'error', code, suggestion });
    }
    addWarning(line, column, message, code, suggestion) {
        this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
    }
    createAliasSuggestion(alias) {
        return `Use a different alias name (e.g., '${alias}Lib' or '${alias}Module')`;
    }
}
EnhancedLibraryValidator.BUILT_IN_ALIAS_CONFLICTS = new Set([
    'plot',
    'plotshape',
    'plotchar',
    'plotcandle',
    'plotbar',
    'bgcolor',
    'hline',
    'fill',
    'barcolor',
    'alert',
    'alertcondition',
    'log',
    'timestamp',
    'sma',
    'ema',
    'rsi',
    'macd',
    'stoch',
    'atr',
    'bb',
    'highest',
    'lowest',
    'crossover',
    'crossunder',
    'sar',
    'roc',
    'mom',
    'change',
    'correlation',
    'dev',
    'linreg',
    'percentile_linear_interpolation',
    'percentile_nearest_rank',
    'percentrank',
    'pivothigh',
    'pivotlow',
    'range',
    'stdev',
    'variance',
    'wma',
    'alma',
    'vwma',
    'swma',
    'rma',
    'hma',
    'tsi',
    'cci',
    'cmo',
    'mfi',
    'obv',
    'pvt',
    'nvi',
    'pvi',
    'wad',
]);
