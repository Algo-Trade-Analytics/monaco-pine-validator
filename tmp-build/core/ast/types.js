export function createEmptySymbolTable() {
    return new Map();
}
export function createEmptyScopeGraph() {
    return {
        root: null,
        nodes: new Map(),
    };
}
export function createEmptyControlFlowGraph() {
    return {
        entry: null,
        exit: null,
        nodes: new Map(),
    };
}
export function createSymbolRecord(name, kind, location) {
    return {
        name,
        kind,
        declarations: location ? [location] : [],
        references: [],
    };
}
export function createSymbolLocation(node, line, column) {
    return { node, line, column };
}
export function createEmptyTypeEnvironment() {
    return {
        nodeTypes: new WeakMap(),
        identifiers: new Map(),
    };
}
export function createTypeMetadata(kind, source, certainty = 'inferred') {
    return { kind, certainty, sources: [source] };
}
export function cloneTypeMetadata(metadata, overrides = {}) {
    const sources = [...metadata.sources];
    if (overrides.addSource && !sources.includes(overrides.addSource)) {
        sources.push(overrides.addSource);
    }
    const { addSource: _ignored, ...rest } = overrides;
    return {
        kind: rest.kind ?? metadata.kind,
        certainty: rest.certainty ?? metadata.certainty,
        sources,
    };
}
export function createAstDiagnostics(errors = []) {
    return { syntaxErrors: [...errors] };
}
