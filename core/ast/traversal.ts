import type { AstNode, ProgramNode } from './nodes';

export interface NodePathMetadata {
  scopeId: string | null;
}

export interface NodePath<T extends AstNode = AstNode> {
  readonly node: T;
  readonly parent: AstNode | null;
  readonly parentPath: NodePath | null;
  readonly key: string | null;
  readonly index: number | null;
  readonly metadata: NodePathMetadata;
}

export type NodeKind = AstNode['kind'];

export type PathForKind<K extends NodeKind> = NodePath<Extract<AstNode, { kind: K }>>;

export type Visitor = {
  enter?(path: NodePath): void;
  exit?(path: NodePath): void;
} & {
  [K in NodeKind]?: (path: PathForKind<K>) => void;
};

let nodeMetadataStore = new WeakMap<AstNode, NodePathMetadata>();

function ensureMetadata(node: AstNode): NodePathMetadata {
  let metadata = nodeMetadataStore.get(node);
  if (!metadata) {
    metadata = { scopeId: null };
    nodeMetadataStore.set(node, metadata);
  }
  return metadata;
}

function createNodePath<T extends AstNode>(
  node: T,
  parentPath: NodePath | null,
  key: string | null,
  index: number | null,
): NodePath<T> {
  return {
    node,
    parent: parentPath?.node ?? null,
    parentPath,
    key,
    index,
    metadata: ensureMetadata(node),
  };
}

type ChildValue = AstNode | AstNode[] | null | undefined;

interface ChildEntry {
  key: string;
  value: ChildValue;
}

function getChildEntries(node: AstNode): ChildEntry[] {
  switch (node.kind) {
    case 'Program':
      return [
        { key: 'version', value: node.version },
        { key: 'body', value: node.body },
      ];
    case 'ScriptDeclaration':
      return [{ key: 'call', value: node.call }];
    case 'VariableDeclaration':
      return [
        { key: 'identifier', value: node.identifier },
        { key: 'value', value: node.value },
      ];
    case 'AssignmentStatement':
      return [
        { key: 'identifier', value: node.identifier },
        { key: 'value', value: node.value },
      ];
    case 'ExpressionStatement':
      return [{ key: 'expression', value: node.expression }];
    case 'CallExpression':
      return [
        { key: 'callee', value: node.callee },
        { key: 'args', value: node.args },
      ];
    case 'Argument':
      return [
        { key: 'name', value: node.name ?? null },
        { key: 'value', value: node.value },
      ];
    case 'BlockStatement':
      return [{ key: 'body', value: node.body }];
    case 'IfStatement':
      return [
        { key: 'test', value: node.test },
        { key: 'consequent', value: node.consequent },
        { key: 'alternate', value: node.alternate ?? null },
      ];
    case 'WhileStatement':
      return [
        { key: 'test', value: node.test },
        { key: 'body', value: node.body },
      ];
    case 'FunctionDeclaration':
      return [
        { key: 'name', value: node.name },
        { key: 'parameters', value: node.parameters },
        { key: 'body', value: node.body },
      ];
    case 'Parameter':
      return [
        { key: 'identifier', value: node.identifier },
        { key: 'defaultValue', value: node.defaultValue ?? null },
      ];
    case 'Identifier':
    case 'BooleanLiteral':
    case 'NumberLiteral':
    case 'StringLiteral':
    case 'VersionDirective':
      return [];
    default:
      return [];
  }
}

function* iterateChildren(path: NodePath): IterableIterator<NodePath> {
  for (const { key, value } of getChildEntries(path.node)) {
    if (!value) {
      continue;
    }
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const child = value[i];
        if (child) {
          yield createNodePath(child, path, key, i);
        }
      }
      continue;
    }
    yield createNodePath(value, path, key, null);
  }
}

function visit(path: NodePath, visitor: Visitor): void {
  visitor.enter?.(path);
  const handler = visitor[path.node.kind as NodeKind];
  if (handler) {
    (handler as (p: NodePath) => void)(path);
  }
  for (const child of iterateChildren(path)) {
    visit(child, visitor);
  }
  visitor.exit?.(path);
}

export function traverse(root: ProgramNode | null, visitor: Visitor): void {
  if (!root) {
    return;
  }
  visit(createNodePath(root, null, null, null), visitor);
}

export function ancestors(path: NodePath): NodePath[] {
  const lineage: NodePath[] = [];
  let current = path.parentPath;
  while (current) {
    lineage.push(current);
    current = current.parentPath;
  }
  return lineage;
}

export function findAncestor(path: NodePath, predicate: (candidate: NodePath) => boolean): NodePath | null {
  let current = path.parentPath;
  while (current) {
    if (predicate(current)) {
      return current;
    }
    current = current.parentPath;
  }
  return null;
}

export function findParent<K extends NodeKind>(path: NodePath, kind: K): PathForKind<K> | null {
  const result = findAncestor(path, (candidate): candidate is PathForKind<K> => candidate.node.kind === kind);
  return result as PathForKind<K> | null;
}

export function collectPaths(root: ProgramNode | null): NodePath[] {
  const paths: NodePath[] = [];
  traverse(root, {
    enter(path) {
      paths.push(path);
    },
  });
  return paths;
}

export function forEachChild(path: NodePath, iteratee: (child: NodePath) => void): void {
  for (const child of iterateChildren(path)) {
    iteratee(child);
  }
}

export function setNodeScopeMetadata(node: AstNode, scopeId: string | null): void {
  const metadata = ensureMetadata(node);
  metadata.scopeId = scopeId;
}

export function getNodeScopeMetadata(node: AstNode): NodePathMetadata | undefined {
  return nodeMetadataStore.get(node);
}

export function resetNodePathMetadata(): void {
  nodeMetadataStore = new WeakMap();
}
