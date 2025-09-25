import type { AstValidationContext, ValidationResult } from '../types';
import type {
  ControlFlowEdgeKind,
  ControlFlowNode,
  ControlFlowNodeKind,
  ScopeGraph,
  ScopeKind,
  SymbolKind,
  SymbolLocation,
  SymbolRecord,
  TypeCertainty,
  TypeEnvironment,
  InferredTypeKind,
} from '../ast/types';
import type { Node, ProgramNode } from '../ast/nodes';

export interface SerializablePosition {
  readonly line: number;
  readonly column: number;
}

export interface SerializableRange {
  readonly start: SerializablePosition;
  readonly end: SerializablePosition;
}

export interface SerializableSymbolLocation {
  readonly line: number;
  readonly column: number;
  readonly range?: SerializableRange;
}

export interface SerializableSymbolRecord {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly declarations: readonly SerializableSymbolLocation[];
  readonly references: readonly SerializableSymbolLocation[];
}

export interface SerializableScopeNode {
  readonly id: string;
  readonly kind: ScopeKind;
  readonly parent: string | null;
  readonly children: readonly string[];
  readonly symbols: readonly string[];
}

export interface SerializableScopeGraph {
  readonly root: string | null;
  readonly nodes: readonly SerializableScopeNode[];
}

export interface SerializableControlFlowEdge {
  readonly target: string;
  readonly kind: ControlFlowEdgeKind;
}

export interface SerializableControlFlowNode {
  readonly id: string;
  readonly kind: ControlFlowNodeKind;
  readonly predecessors: readonly string[];
  readonly successors: readonly SerializableControlFlowEdge[];
  readonly range?: SerializableRange;
}

export interface SerializableControlFlowGraph {
  readonly entry: string | null;
  readonly exit: string | null;
  readonly nodes: readonly SerializableControlFlowNode[];
}

export interface SerializableTypeMetadata {
  readonly kind: InferredTypeKind;
  readonly certainty: TypeCertainty;
  readonly sources: readonly string[];
}

export interface SerializableIdentifierType {
  readonly identifier: string;
  readonly metadata: SerializableTypeMetadata;
}

export interface MonacoSemanticModel {
  readonly ast: ProgramNode | null;
  readonly symbols: readonly SerializableSymbolRecord[];
  readonly scopes: SerializableScopeGraph;
  readonly controlFlow: SerializableControlFlowGraph;
  readonly types: readonly SerializableIdentifierType[];
}

export interface MonacoHoverEntry {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly declarations: readonly SerializableSymbolLocation[];
  readonly references: readonly SerializableSymbolLocation[];
  readonly type?: string;
  readonly isConst?: boolean;
  readonly isSeries?: boolean;
  readonly elementType?: string;
  readonly enumType?: string;
  readonly udtName?: string;
  readonly inferredType?: SerializableTypeMetadata;
}

function toRange(node: Node | null): SerializableRange | undefined {
  if (!node || !node.loc) {
    return undefined;
  }
  const { start, end } = node.loc;
  return {
    start: { line: start.line, column: start.column },
    end: { line: end.line, column: end.column },
  };
}

function serialiseSymbolLocation(location: SymbolLocation): SerializableSymbolLocation {
  return {
    line: location.line,
    column: location.column,
    range: toRange(location.node),
  };
}

function serialiseSymbolTable(records: Map<string, SymbolRecord>): SerializableSymbolRecord[] {
  const entries: SerializableSymbolRecord[] = [];
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

function serialiseScopeGraph(scopeGraph: ScopeGraph): SerializableScopeGraph {
  const nodes: SerializableScopeNode[] = [];
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

function serialiseControlFlowNode(node: ControlFlowNode): SerializableControlFlowNode {
  return {
    id: node.id,
    kind: node.kind,
    predecessors: Array.from(node.predecessors),
    successors: node.successors.map((edge) => ({ target: edge.target, kind: edge.kind })),
    range: toRange(node.astNode),
  };
}

function serialiseControlFlowGraphInternal(graph: { entry: string | null; exit: string | null; nodes: Map<string, ControlFlowNode> }): SerializableControlFlowGraph {
  const nodes: SerializableControlFlowNode[] = [];
  for (const node of graph.nodes.values()) {
    nodes.push(serialiseControlFlowNode(node));
  }
  return {
    entry: graph.entry,
    exit: graph.exit,
    nodes,
  };
}

function serialiseIdentifierTypes(environment: TypeEnvironment): SerializableIdentifierType[] {
  const entries: SerializableIdentifierType[] = [];
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

export function createSemanticModel(context: AstValidationContext): MonacoSemanticModel {
  return {
    ast: context.ast ?? null,
    symbols: serialiseSymbolTable(context.symbolTable),
    scopes: serialiseScopeGraph(context.scopeGraph),
    controlFlow: serialiseControlFlowGraphInternal(context.controlFlowGraph),
    types: serialiseIdentifierTypes(context.typeEnvironment),
  };
}

export function createHoverEntries(
  _context: AstValidationContext,
  result: ValidationResult,
  model: MonacoSemanticModel,
): MonacoHoverEntry[] {
  const typeMap = result.typeMap;
  const inferredTypes = new Map<string, SerializableTypeMetadata>();
  for (const entry of model.types) {
    inferredTypes.set(entry.identifier, entry.metadata);
  }

  const entries: MonacoHoverEntry[] = [];
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
