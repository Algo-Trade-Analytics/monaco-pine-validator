import { ChevrotainAstService } from './service';
import { buildScopeGraph } from './scope';
import { inferTypes } from './type-inference';
import { buildControlFlowGraph } from './control-flow';
import { createAstDiagnostics, createEmptyControlFlowGraph, createEmptyScopeGraph, createEmptySymbolTable, createEmptyTypeEnvironment, } from './types';
const DEFAULT_AST_FILENAME = 'input.pine';
function ensureAstService(config) {
    const astConfig = config.ast ?? (config.ast = { mode: 'primary', service: undefined });
    if (astConfig.mode === 'disabled') {
        return new ChevrotainAstService();
    }
    if (!astConfig.service) {
        astConfig.service = new ChevrotainAstService();
    }
    return astConfig.service;
}
function getSourceFromContext(context) {
    if (typeof context.sourceText === 'string' && context.sourceText.length > 0) {
        return context.sourceText;
    }
    if (Array.isArray(context.rawLines) && context.rawLines.length > 0) {
        const joined = context.rawLines.join('\n');
        context.sourceText = joined;
        return joined;
    }
    if (Array.isArray(context.cleanLines) && context.cleanLines.length > 0) {
        const joined = context.cleanLines.join('\n');
        context.sourceText = joined;
        return joined;
    }
    if (Array.isArray(context.lines) && context.lines.length > 0) {
        const joined = context.lines.join('\n');
        context.sourceText = joined;
        return joined;
    }
    return '';
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
export function isAstValidationContext(context) {
    return 'ast' in context;
}
export function ensureAstContext(context, config) {
    if (config.ast?.mode === 'disabled') {
        return null;
    }
    if (!isAstValidationContext(context)) {
        Object.assign(context, {
            ast: null,
            astDiagnostics: createAstDiagnostics(),
            scopeGraph: createEmptyScopeGraph(),
            symbolTable: createEmptySymbolTable(),
            typeEnvironment: createEmptyTypeEnvironment(),
            controlFlowGraph: createEmptyControlFlowGraph(),
        });
    }
    const astContext = context;
    if (astContext.ast) {
        // Assume accompanying structures already populated; ensure diagnostics exist
        astContext.astDiagnostics = normaliseDiagnostics(astContext.astDiagnostics);
        if (!astContext.scopeGraph) {
            astContext.scopeGraph = createEmptyScopeGraph();
        }
        if (!astContext.symbolTable) {
            astContext.symbolTable = createEmptySymbolTable();
        }
        if (!astContext.typeEnvironment) {
            astContext.typeEnvironment = createEmptyTypeEnvironment();
        }
        if (!astContext.controlFlowGraph) {
            astContext.controlFlowGraph = createEmptyControlFlowGraph();
        }
        return astContext;
    }
    const source = getSourceFromContext(context);
    if (!source.trim()) {
        return null;
    }
    const service = ensureAstService(config);
    try {
        if (process.env.DEBUG_MODULE_HARNESS === '1') {
            console.log('[ensureAstContext] parsing source snippet', source.slice(0, 80));
        }
        const serviceResult = service.parse(source, {
            filename: DEFAULT_AST_FILENAME,
            allowErrors: true,
        });
        const result = ensureAstParseResult(serviceResult);
        astContext.ast = result.ast;
        astContext.astDiagnostics = result.diagnostics;
        if (result.ast) {
            const { scopeGraph, symbolTable } = buildScopeGraph(result.ast);
            astContext.scopeGraph = scopeGraph;
            astContext.symbolTable = symbolTable;
            astContext.typeEnvironment = inferTypes(result.ast);
            astContext.controlFlowGraph = buildControlFlowGraph(result.ast);
        }
        else {
            astContext.scopeGraph = createEmptyScopeGraph();
            astContext.symbolTable = createEmptySymbolTable();
            astContext.typeEnvironment = createEmptyTypeEnvironment();
            astContext.controlFlowGraph = createEmptyControlFlowGraph();
        }
    }
    catch (error) {
        astContext.ast = null;
        astContext.astDiagnostics = createAstDiagnostics();
        astContext.scopeGraph = createEmptyScopeGraph();
        astContext.symbolTable = createEmptySymbolTable();
        astContext.typeEnvironment = createEmptyTypeEnvironment();
        astContext.controlFlowGraph = createEmptyControlFlowGraph();
        return null;
    }
    return astContext.ast ? astContext : null;
}
