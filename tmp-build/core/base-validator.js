/**
 * Base validator class for the modular Pine Script v6 validator
 */
import { createAstDiagnostics, createEmptyControlFlowGraph, createEmptyScopeGraph, createEmptySymbolTable, createEmptyTypeEnvironment, } from './ast/types';
import { ChevrotainAstService, createNullAstService } from './ast/service';
import { buildScopeGraph } from './ast/scope';
import { inferTypes } from './ast/type-inference';
import { buildControlFlowGraph } from './ast/control-flow';
const DEFAULT_AST_FILENAME = 'input.pine';
const AST_PARSE_ERROR_CODE = 'AST-PARSE';
const DEFAULT_AST_CONFIG = {
    mode: 'primary',
    service: null,
};
function mergeValidatorConfig(layers) {
    const config = {
        targetVersion: 6,
        strictMode: false,
        allowDeprecated: true,
        enableTypeChecking: true,
        enableControlFlowAnalysis: true,
        enablePerformanceAnalysis: false,
        enableCustomRuleRawScan: true,
        customRules: [],
        ignoredCodes: [],
    };
    const ast = { ...DEFAULT_AST_CONFIG };
    for (const layer of layers) {
        if (!layer) {
            continue;
        }
        const { ast: astLayer, ...rest } = layer;
        Object.assign(config, rest);
        if (astLayer) {
            if (astLayer.mode !== undefined) {
                ast.mode = astLayer.mode;
            }
            if (astLayer.service !== undefined) {
                ast.service = astLayer.service;
            }
        }
    }
    if (ast.mode === 'disabled') {
        ast.service = null;
    }
    else if (!ast.service) {
        ast.service = new ChevrotainAstService();
    }
    config.customRules = Array.isArray(config.customRules) ? [...config.customRules] : [];
    config.ignoredCodes = Array.isArray(config.ignoredCodes) ? [...config.ignoredCodes] : [];
    config.ast = ast;
    return { config, ast };
}
function normaliseDiagnostics(diagnostics) {
    if (!diagnostics) {
        return createAstDiagnostics();
    }
    return {
        syntaxErrors: Array.isArray(diagnostics.syntaxErrors)
            ? [...diagnostics.syntaxErrors]
            : [],
    };
}
function ensureAstParseResult(result) {
    if (!result) {
        return { ast: null, diagnostics: createAstDiagnostics() };
    }
    return {
        ast: result.ast ?? null,
        diagnostics: normaliseDiagnostics(result.diagnostics),
    };
}
export class BaseValidator {
    constructor(config = {}) {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.typeMap = new Map();
        this.modules = [];
        // State tracking
        this.declared = new Map();
        this.declIndent = new Map();
        this.declaredSites = new Set();
        this.constNames = new Set();
        this.functionNames = new Set();
        this.methodNames = new Set();
        this.functionParams = new Map();
        this.functionHeaderLine = new Map();
        this.used = new Set();
        this.paramUsage = new Map();
        this.typeFields = new Map();
        // Scope tracking
        this.scopeStack = [];
        this.indentStack = [];
        this.paren = 0;
        this.bracket = 0;
        this.brace = 0;
        // Script state
        this.hasVersion = false;
        this.firstVersionLine = null;
        this.scriptType = null;
        this.scriptDeclParsed = false;
        this.sawBrace = false;
        this.sawTabIndent = false;
        this.sawSpaceIndent = false;
        this.baseConfigOverrides = {
            ...config,
            ast: config.ast ? { ...config.ast } : undefined,
        };
        const { config: mergedConfig, ast } = mergeValidatorConfig([this.baseConfigOverrides]);
        this.config = mergedConfig;
        this.astConfig = ast;
        this.astService = this.astConfig.service ?? createNullAstService();
        if (!this.astConfig.service) {
            this.astConfig.service = this.astService;
        }
        this.context = this.createInitialContext();
    }
    /**
     * Register a validation module
     */
    registerModule(module) {
        this.modules.push(module);
    }
    /**
     * Main validation entry point
     */
    validate(code) {
        this.rebuildConfig();
        this.reset();
        this.prepareContext(code);
        this.runValidation();
        return this.buildResult();
    }
    rebuildConfig(...overrides) {
        const layers = [this.baseConfigOverrides, ...overrides];
        const { config, ast } = mergeValidatorConfig(layers);
        this.config = config;
        this.astConfig = ast;
        this.astService = this.astConfig.service ?? createNullAstService();
        if (!this.astConfig.service) {
            this.astConfig.service = this.astService;
        }
    }
    createInitialContext() {
        const baseContext = {
            lines: [],
            cleanLines: [],
            rawLines: [],
            sourceText: '',
            typeMap: this.typeMap,
            usedVars: this.used,
            declaredVars: this.declared,
            functionNames: this.functionNames,
            methodNames: this.methodNames,
            functionParams: this.functionParams,
            scriptType: null,
            version: this.config.targetVersion || 6,
            hasVersion: false,
            firstVersionLine: null,
        };
        const context = this.normaliseContext(baseContext);
        context.ast = null;
        context.astDiagnostics = createAstDiagnostics();
        context.scopeGraph = createEmptyScopeGraph();
        context.symbolTable = createEmptySymbolTable();
        context.typeEnvironment = createEmptyTypeEnvironment();
        context.controlFlowGraph = createEmptyControlFlowGraph();
        return context;
    }
    normaliseContext(context) {
        const astContext = context;
        if (typeof astContext.ast === 'undefined') {
            astContext.ast = null;
        }
        astContext.astDiagnostics = normaliseDiagnostics(astContext.astDiagnostics);
        if (!astContext.scopeGraph || !(astContext.scopeGraph.nodes instanceof Map)) {
            astContext.scopeGraph = createEmptyScopeGraph();
        }
        else {
            astContext.scopeGraph = {
                root: astContext.scopeGraph.root ?? null,
                nodes: astContext.scopeGraph.nodes,
            };
        }
        if (!(astContext.symbolTable instanceof Map)) {
            astContext.symbolTable = createEmptySymbolTable();
        }
        if (!astContext.typeEnvironment) {
            astContext.typeEnvironment = createEmptyTypeEnvironment();
        }
        if (!astContext.controlFlowGraph || !(astContext.controlFlowGraph.nodes instanceof Map)) {
            astContext.controlFlowGraph = createEmptyControlFlowGraph();
        }
        else {
            astContext.controlFlowGraph = {
                entry: astContext.controlFlowGraph.entry ?? null,
                exit: astContext.controlFlowGraph.exit ?? null,
                nodes: astContext.controlFlowGraph.nodes,
            };
        }
        if (!astContext.typeMap) {
            astContext.typeMap = this.typeMap;
        }
        return astContext;
    }
    parseAst(source) {
        this.context.ast = null;
        this.context.astDiagnostics = createAstDiagnostics();
        this.context.scopeGraph = createEmptyScopeGraph();
        this.context.symbolTable = createEmptySymbolTable();
        this.context.typeEnvironment = createEmptyTypeEnvironment();
        this.context.controlFlowGraph = createEmptyControlFlowGraph();
        if (!this.astConfig || this.astConfig.mode === 'disabled') {
            return;
        }
        const service = this.astConfig.service ?? this.astService ?? createNullAstService();
        this.astService = service;
        this.astConfig.service = service;
        try {
            const result = ensureAstParseResult(service.parse(source, { filename: DEFAULT_AST_FILENAME, allowErrors: true }));
            this.context.ast = result.ast;
            this.context.astDiagnostics = result.diagnostics;
            if (result.ast) {
                const { scopeGraph, symbolTable } = buildScopeGraph(result.ast);
                this.context.scopeGraph = scopeGraph;
                this.context.symbolTable = symbolTable;
                this.context.typeEnvironment = inferTypes(result.ast);
                this.context.controlFlowGraph = buildControlFlowGraph(result.ast);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.context.ast = null;
            this.context.astDiagnostics = createAstDiagnostics();
            this.context.scopeGraph = createEmptyScopeGraph();
            this.context.symbolTable = createEmptySymbolTable();
            this.context.typeEnvironment = createEmptyTypeEnvironment();
            this.context.controlFlowGraph = createEmptyControlFlowGraph();
            this.addWarning(1, 1, `AST parser error: ${message}`, AST_PARSE_ERROR_CODE);
        }
    }
    /**
     * Reset all state for a fresh validation run
     */
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.typeMap.clear();
        this.declared.clear();
        this.declIndent.clear();
        this.declaredSites.clear();
        this.constNames.clear();
        this.functionNames.clear();
        this.methodNames.clear();
        this.functionParams.clear();
        this.functionHeaderLine.clear();
        this.used.clear();
        this.paramUsage.clear();
        this.typeFields.clear();
        this.scopeStack = [{ indent: -1, params: new Set(), fnName: null, variables: new Set() }];
        this.indentStack = [0];
        this.paren = 0;
        this.bracket = 0;
        this.brace = 0;
        this.hasVersion = false;
        this.firstVersionLine = null;
        this.scriptType = null;
        this.scriptDeclParsed = false;
        this.sawBrace = false;
        this.sawTabIndent = false;
        this.sawSpaceIndent = false;
        this.context = this.createInitialContext();
    }
    /**
     * Prepare the validation context
     */
    prepareContext(code) {
        // Strip BOM and normalize newlines
        code = code.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
        const context = this.context;
        context.sourceText = code;
        context.rawLines = code.split('\n');
        context.lines = context.rawLines.slice();
        context.cleanLines = this.stripLineCommentsKeepingStrings(code).split('\n');
        context.scopeGraph = createEmptyScopeGraph();
        context.symbolTable = createEmptySymbolTable();
        context.typeEnvironment = createEmptyTypeEnvironment();
        context.controlFlowGraph = createEmptyControlFlowGraph();
        context.version = this.config.targetVersion || 6;
        this.parseAst(code);
        context.typeMap = this.typeMap;
        context.usedVars = this.used;
        context.declaredVars = this.declared;
        context.functionNames = this.functionNames;
        context.methodNames = this.methodNames;
        context.functionParams = this.functionParams;
        context.scriptType = this.scriptType;
        context.hasVersion = this.hasVersion;
        context.firstVersionLine = this.firstVersionLine;
    }
    /**
     * Run the validation process
     */
    runValidation() {
        // Run core validation first
        this.runCoreValidation();
        // Run registered modules
        for (const module of this.modules) {
            try {
                const moduleResult = module.validate(this.context, this.config);
                this.addErrors(moduleResult.errors);
                this.addWarnings(moduleResult.warnings);
                this.addInfoMessages(moduleResult.info);
            }
            catch (error) {
                this.addError(1, 1, `Error in ${module.name} module: ${error}`, 'MODULE-ERROR');
            }
        }
        // Apply custom rules
        this.applyCustomRules();
        // Filter ignored codes
        this.filterIgnoredCodes();
    }
    /**
     * Build the final validation result
     */
    buildResult() {
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap: this.context.typeMap,
            scriptType: this.scriptType
        };
    }
    /**
     * Add errors from a module
     */
    addErrors(errors) {
        for (const error of errors) {
            switch (error.severity) {
                case 'error':
                    this.errors.push(error);
                    break;
                case 'warning':
                    this.warnings.push(error);
                    break;
                case 'info':
                    this.info.push(error);
                    break;
            }
        }
    }
    /**
     * Add a single error
     */
    addError(line, column, message, code, suggestion) {
        this.errors.push({ line, column, message, severity: 'error', code, suggestion });
    }
    /**
     * Add a single warning
     */
    addWarning(line, column, message, code, suggestion) {
        this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
    }
    /**
     * Add a single info message
     */
    addInfo(line, column, message, code, suggestion) {
        this.info.push({ line, column, message, severity: 'info', code, suggestion });
    }
    /**
     * Add by severity
     */
    addBySeverity(sev, line, col, msg, code, sugg) {
        if (sev === 'error')
            this.addError(line, col, msg, code, sugg);
        else if (sev === 'warning')
            this.addWarning(line, col, msg, code, sugg);
        else
            this.addInfo(line, col, msg, code, sugg);
    }
    /**
     * Add multiple warnings
     */
    addWarnings(warnings) {
        for (const warning of warnings) {
            this.addWarning(warning.line, warning.column, warning.message, warning.code, warning.suggestion);
        }
    }
    /**
     * Add multiple info messages
     */
    addInfoMessages(info) {
        for (const infoMsg of info) {
            this.addInfo(infoMsg.line, infoMsg.column, infoMsg.message, infoMsg.code, infoMsg.suggestion);
        }
    }
    /**
     * Strip line comments while keeping strings intact
     */
    stripLineCommentsKeepingStrings(text) {
        const KEEP_VERSION = /^\uFEFF?\s*\/\/\s*@version=\d+\s*$/;
        let out = '';
        let inStr = null;
        let esc = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const nxt = text[i + 1] || '';
            // Detect and handle '//' comments
            if (!inStr && ch === '/' && nxt === '/') {
                // Get the full current line
                let bol = i;
                while (bol > 0 && text[bol - 1] !== '\n')
                    bol--;
                let eol = i;
                while (eol < text.length && text[eol] !== '\n')
                    eol++;
                const line = text.slice(bol, eol);
                if (KEEP_VERSION.test(line)) {
                    out += line;
                    i = eol - 1;
                    continue;
                }
                // Drop comment to EOL
                while (i < text.length && text[i] !== '\n')
                    i++;
                out += '\n';
                continue;
            }
            if (inStr) {
                out += ch;
                if (esc) {
                    esc = false;
                    continue;
                }
                if (ch === '\\') {
                    esc = true;
                    continue;
                }
                if (ch === inStr) {
                    inStr = null;
                }
                continue;
            }
            if (ch === '"' || ch === "'") {
                inStr = ch;
                out += ch;
                continue;
            }
            out += ch;
        }
        return out;
    }
    /**
     * Strip strings from a line
     */
    stripStrings(line) {
        return line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => ' '.repeat(m.length));
    }
    /**
     * Get current scope
     */
    currentScope() {
        return this.scopeStack[this.scopeStack.length - 1];
    }
    /**
     * Apply custom rules
     */
    applyCustomRules() {
        const rules = this.config.customRules || [];
        if (rules.length === 0) {
            return;
        }
        const enableRawScan = this.config.enableCustomRuleRawScan !== false;
        const astContext = this.context.ast ? this.context : null;
        for (const rule of rules) {
            const inferredMode = rule.mode
                ? rule.mode
                : rule.visitAst && rule.pattern
                    ? 'both'
                    : rule.visitAst
                        ? 'ast'
                        : 'raw';
            if (enableRawScan && rule.pattern && (inferredMode === 'raw' || inferredMode === 'both')) {
                for (let i = 0; i < this.context.cleanLines.length; i++) {
                    const line = this.context.cleanLines[i];
                    const lineNum = i + 1;
                    let match = false;
                    if (rule.pattern instanceof RegExp) {
                        match = rule.pattern.test(line);
                    }
                    else {
                        match = rule.pattern(line, lineNum, this.context);
                    }
                    if (match) {
                        this.addBySeverity(rule.severity, lineNum, 1, rule.message, rule.id, rule.suggestion);
                    }
                }
            }
            if (astContext && astContext.ast && rule.visitAst && (inferredMode === 'ast' || inferredMode === 'both')) {
                const matches = rule.visitAst(astContext.ast, astContext) ?? [];
                for (const match of matches) {
                    const line = match.line ?? 1;
                    const column = match.column ?? 1;
                    const message = match.message ?? rule.message;
                    const severity = match.severity ?? rule.severity;
                    const suggestion = match.suggestion ?? rule.suggestion;
                    const code = match.code ?? rule.id;
                    if (severity === 'info') {
                        this.addInfo(line, column, message, code, suggestion);
                    }
                    else {
                        this.addBySeverity(severity, line, column, message, code, suggestion);
                    }
                }
            }
        }
    }
    /**
     * Filter ignored codes
     */
    filterIgnoredCodes() {
        const ignore = new Set(this.config.ignoredCodes || []);
        const dedupe = (list) => {
            const seen = new Set();
            const out = [];
            for (const item of list) {
                if (ignore.has(item.code || ''))
                    continue;
                const key = `${item.severity}|${item.code || ''}|${item.line}|${item.column}|${item.message}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
                out.push(item);
            }
            return out;
        };
        this.errors = dedupe(this.errors);
        this.warnings = dedupe(this.warnings);
        this.info = dedupe(this.info);
    }
}
