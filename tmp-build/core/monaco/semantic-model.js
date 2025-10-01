function toRange(node) {
    if (!node || !node.loc) {
        return undefined;
    }
    const { start, end } = node.loc;
    return {
        start: { line: start.line, column: start.column },
        end: { line: end.line, column: end.column },
    };
}
function serialiseSymbolLocation(location) {
    return {
        line: location.line,
        column: location.column,
        range: toRange(location.node),
    };
}
function serialiseSymbolTable(records) {
    const entries = [];
    for (const record of records.values()) {
        entries.push({
            name: record.name,
            kind: record.kind,
            declarations: record.declarations.map(serialiseSymbolLocation),
            references: record.references.map(serialiseSymbolLocation),
        });
    }
    return entries;
}
function serialiseScopeGraph(scopeGraph) {
    const nodes = [];
    for (const [id, node] of scopeGraph.nodes.entries()) {
        nodes.push({
            id,
            kind: node.kind,
            parent: node.parent,
            children: Array.from(node.children),
            symbols: Array.from(node.symbols),
        });
    }
    return {
        root: scopeGraph.root,
        nodes,
    };
}
function serialiseControlFlowNode(node) {
    return {
        id: node.id,
        kind: node.kind,
        predecessors: Array.from(node.predecessors),
        successors: node.successors.map((edge) => ({ target: edge.target, kind: edge.kind })),
        range: toRange(node.astNode),
    };
}
function serialiseControlFlowGraphInternal(graph) {
    const nodes = [];
    for (const node of graph.nodes.values()) {
        nodes.push(serialiseControlFlowNode(node));
    }
    return {
        entry: graph.entry,
        exit: graph.exit,
        nodes,
    };
}
function serialiseIdentifierTypes(environment) {
    const entries = [];
    for (const [identifier, metadata] of environment.identifiers.entries()) {
        entries.push({
            identifier,
            metadata: {
                kind: metadata.kind,
                certainty: metadata.certainty,
                sources: [...metadata.sources],
            },
        });
    }
    return entries;
}
export function createSemanticModel(context) {
    return {
        ast: context.ast ?? null,
        symbols: serialiseSymbolTable(context.symbolTable),
        scopes: serialiseScopeGraph(context.scopeGraph),
        controlFlow: serialiseControlFlowGraphInternal(context.controlFlowGraph),
        types: serialiseIdentifierTypes(context.typeEnvironment),
    };
}
export function createHoverEntries(_context, result, model) {
    const typeMap = result.typeMap;
    const inferredTypes = new Map();
    for (const entry of model.types) {
        inferredTypes.set(entry.identifier, entry.metadata);
    }
    const entries = [];
    for (const symbol of model.symbols) {
        const typeInfo = typeMap.get(symbol.name);
        const inferred = inferredTypes.get(symbol.name);
        entries.push({
            name: symbol.name,
            kind: symbol.kind,
            declarations: symbol.declarations,
            references: symbol.references,
            type: typeInfo?.type,
            isConst: typeInfo?.isConst,
            isSeries: typeInfo?.isSeries,
            elementType: typeInfo?.elementType,
            enumType: typeInfo?.enumType,
            udtName: typeInfo?.udtName,
            inferredType: inferred,
        });
    }
    return entries;
}
