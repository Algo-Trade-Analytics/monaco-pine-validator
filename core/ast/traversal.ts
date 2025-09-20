import type { AstNode, ProgramNode } from './nodes';

export interface NodePath<T extends AstNode = AstNode> {
  readonly node: T;
  readonly parent: AstNode | null;
  readonly parentPath: NodePath | null;
  readonly key: string | null;
  readonly index: number | null;
}

export type NodeKind = AstNode['kind'];

export type PathForKind<K extends NodeKind> = NodePath<Extract<AstNode, { kind: K }>>;

export type Visitor = {
  enter?(path: NodePath): void;
  exit?(path: NodePath): void;
} & {
  [K in NodeKind]?: (path: PathForKind<K>) => void;
};

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
    case 'IndicatorDeclaration':
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
