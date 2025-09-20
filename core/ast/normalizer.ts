import type { IdentifierNode, ProgramNode } from './nodes';
import {
  type NodePath,
  type PathForKind,
  resetNodePathMetadata,
  setNodeScopeMetadata,
  traverse,
} from './traversal';
import {
  type AstNode,
  type ScopeGraph,
  type ScopeKind,
  type SymbolKind,
  type SymbolRecord,
  type SymbolTable,
  createEmptyScopeGraph,
  createEmptySymbolTable,
  createSymbolLocation,
  createSymbolRecord,
} from './types';

export interface AstNormalizationResult {
  scopeGraph: ScopeGraph;
  symbolTable: SymbolTable;
}

function isNamedArgument(path: PathForKind<'Identifier'>): boolean {
  return path.parentPath?.node.kind === 'Argument' && path.key === 'name';
}

function isDeclarationIdentifier(path: PathForKind<'Identifier'>): boolean {
  if (path.parentPath?.node.kind === 'VariableDeclaration' && path.key === 'identifier') {
    return true;
  }

  if (path.parentPath?.node.kind === 'FunctionDeclaration' && path.key === 'name') {
    return true;
  }

  if (path.parentPath?.node.kind === 'Parameter' && path.key === 'identifier') {
    return true;
  }

  return false;
}

function isCallCallee(path: PathForKind<'Identifier'>): boolean {
  return path.parentPath?.node.kind === 'CallExpression' && path.key === 'callee';
}

function locationFromIdentifier(identifier: IdentifierNode) {
  const { line, column } = identifier.loc.start;
  return createSymbolLocation(identifier, line, column);
}

function appendDeclaration(record: SymbolRecord, identifier: IdentifierNode): void {
  record.declarations.push(locationFromIdentifier(identifier));
}

function appendReference(record: SymbolRecord, identifier: IdentifierNode): void {
  record.references.push(locationFromIdentifier(identifier));
}

function ensureSymbol(
  table: SymbolTable,
  name: string,
  kind: SymbolKind,
): SymbolRecord {
  const existing = table.get(name);
  if (existing) {
    if (existing.kind === 'unknown' && kind !== 'unknown') {
      existing.kind = kind;
    }
    return existing;
  }
  const record = createSymbolRecord(name, kind);
  table.set(name, record);
  return record;
}

export function normaliseProgramAst(program: ProgramNode | null): AstNormalizationResult {
  const scopeGraph = createEmptyScopeGraph();
  const symbolTable = createEmptySymbolTable();

  if (!program) {
    return { scopeGraph, symbolTable };
  }

  resetNodePathMetadata();

  let scopeCounter = 0;
  const makeScopeId = (kind: ScopeKind): string => `${kind}-${scopeCounter++}`;

  const rootId = makeScopeId('module');
  scopeGraph.root = rootId;
  scopeGraph.nodes.set(rootId, {
    id: rootId,
    kind: 'module',
    parent: null,
    children: new Set(),
    symbols: new Set(),
  });

  const scopeStack: string[] = [rootId];
  const nodeScopes = new WeakMap<AstNode, string>();
  const scopeCreators = new WeakSet<AstNode>();

  const registerNodeScope = (node: AstNode, scopeId: string) => {
    nodeScopes.set(node, scopeId);
    setNodeScopeMetadata(node, scopeId);
  };

  registerNodeScope(program, rootId);

  const currentScopeId = () => scopeStack[scopeStack.length - 1] ?? rootId;

  const trackSymbolInScope = (scopeId: string, name: string) => {
    const scopeNode = scopeGraph.nodes.get(scopeId);
    if (scopeNode) {
      scopeNode.symbols.add(name);
    }
  };

  const createChildScope = (kind: ScopeKind, node: AstNode): string => {
    const id = makeScopeId(kind);
    const parentId = currentScopeId();
    const parentNode = scopeGraph.nodes.get(parentId);

    scopeGraph.nodes.set(id, {
      id,
      kind,
      parent: parentId,
      children: new Set(),
      symbols: new Set(),
    });

    parentNode?.children.add(id);
    scopeStack.push(id);
    scopeCreators.add(node);
    registerNodeScope(node, id);
    return id;
  };

  const assignExistingScope = (node: AstNode, scopeId: string) => {
    registerNodeScope(node, scopeId);
  };

  const resolveBlockScopeKind = (path: NodePath): ScopeKind => {
    const parentKind = path.parentPath?.node.kind;
    switch (parentKind) {
      case 'FunctionDeclaration':
        return 'function';
      case 'WhileStatement':
        return 'loop';
      case 'IfStatement':
        return 'conditional';
      default:
        return 'block';
    }
  };

  const determineScopeKind = (path: NodePath): ScopeKind | null => {
    if (path.node.kind === 'BlockStatement') {
      return resolveBlockScopeKind(path);
    }
    return null;
  };

  traverse(program, {
    enter(path: NodePath) {
      if (path.node.kind === 'Program') {
        path.metadata.scopeId = rootId;
        return;
      }

      const parentScope = currentScopeId();
      const scopeKind = determineScopeKind(path);

      if (scopeKind) {
        const scopeId = createChildScope(scopeKind, path.node as AstNode);
        path.metadata.scopeId = scopeId;
        return;
      }

      assignExistingScope(path.node as AstNode, parentScope);
      path.metadata.scopeId = parentScope;
    },
    exit(path: NodePath) {
      const scopeId = nodeScopes.get(path.node as AstNode);
      if (
        scopeId &&
        scopeId !== rootId &&
        scopeCreators.has(path.node as AstNode) &&
        scopeStack[scopeStack.length - 1] === scopeId
      ) {
        scopeStack.pop();
      }
    },
    VariableDeclaration(path: PathForKind<'VariableDeclaration'>) {
      const scopeId = currentScopeId();
      const identifier = path.node.identifier;
      const record = ensureSymbol(symbolTable, identifier.name, 'variable');
      record.kind = 'variable';
      appendDeclaration(record, identifier);
      record.metadata ??= {};
      record.metadata.storage = path.node.keyword;
      trackSymbolInScope(scopeId, identifier.name);
    },
    Identifier(path: PathForKind<'Identifier'>) {
      if (isDeclarationIdentifier(path) || isNamedArgument(path)) {
        return;
      }

      const scopeId = currentScopeId();

      if (isCallCallee(path)) {
        const record = ensureSymbol(symbolTable, path.node.name, 'function');
        appendReference(record, path.node);
        trackSymbolInScope(scopeId, path.node.name);
        return;
      }

      const record = ensureSymbol(symbolTable, path.node.name, 'variable');
      appendReference(record, path.node);
      trackSymbolInScope(scopeId, path.node.name);
    },
  });

  return { scopeGraph, symbolTable };
}
