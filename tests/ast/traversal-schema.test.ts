import { describe, expect, it } from 'vitest';
import {
  type ForStatementNode,
  type FunctionDeclarationNode,
  type ProgramNode,
} from '../../core/ast/nodes';
import {
  createPath,
  findAncestor,
  visit,
  visitChildren,
  type NodePath,
} from '../../core/ast/traversal';
import {
  createControlFlowFixture,
  createIndicatorScriptFixture,
  createNamespaceAccessFixture,
  createSwitchMatrixFixture,
} from './fixtures';

describe('core AST nodes traversal', () => {
  it('performs a pre-order traversal across the tree', () => {
    const program = createIndicatorScriptFixture();
    const visited: string[] = [];

    visit(program, {
      Program: { enter: () => { visited.push('Program'); return undefined; } },
      VersionDirective: { enter: () => { visited.push('VersionDirective'); return undefined; } },
      ScriptDeclaration: { enter: () => { visited.push('ScriptDeclaration'); return undefined; } },
      FunctionDeclaration: { enter: () => { visited.push('FunctionDeclaration'); return undefined; } },
      Parameter: { enter: () => { visited.push('Parameter'); return undefined; } },
      BlockStatement: { enter: () => { visited.push('BlockStatement'); return undefined; } },
      ReturnStatement: { enter: () => { visited.push('ReturnStatement'); return undefined; } },
      ExpressionStatement: { enter: () => { visited.push('ExpressionStatement'); return undefined; } },
      CallExpression: { enter: () => { visited.push('CallExpression'); return undefined; } },
      Argument: {
        enter: (path) => {
          visited.push(path.node.name ? `Argument:${path.node.name.name}` : 'Argument');
          return undefined;
        },
      },
      Identifier: { enter: (path) => { visited.push(`Identifier:${path.node.name}`); return undefined; } },
      StringLiteral: { enter: (path) => { visited.push(`String:${path.node.value}`); return undefined; } },
      NumberLiteral: { enter: (path) => { visited.push(`Number:${path.node.value}`); return undefined; } },
    });

    expect(visited).toEqual([
      'Program',
      'VersionDirective',
      'ScriptDeclaration',
      'Identifier:example',
      'Argument:title',
      'Identifier:title',
      'String:Example',
      'FunctionDeclaration',
      'Identifier:foo',
      'Parameter',
      'Identifier:x',
      'BlockStatement',
      'ReturnStatement',
      'Identifier:x',
      'ExpressionStatement',
      'CallExpression',
      'Identifier:foo',
      'Argument',
      'Number:1',
    ]);
  });

  it('allows visitors to skip child traversal', () => {
    const program = createIndicatorScriptFixture();
    const visited: string[] = [];

    visit(program, {
      BlockStatement: { enter: () => 'skip' },
      ReturnStatement: { enter: () => visited.push('ReturnStatement') },
    });

    expect(visited).toEqual([]);
  });

  it('finds the nearest ancestor that matches the predicate', () => {
    const program = createIndicatorScriptFixture();
    let assertionCount = 0;

    visit(program, {
      Identifier: {
        enter: (path) => {
          if (path.parent?.node.kind === 'ReturnStatement') {
            const fnAncestor = findAncestor(path, (ancestor): ancestor is NodePath<FunctionDeclarationNode> => {
              return ancestor.node.kind === 'FunctionDeclaration';
            });
            expect(fnAncestor).not.toBeNull();
            expect(fnAncestor?.node.identifier?.name).toBe('foo');
            assertionCount += 1;
          }
        },
      },
    });

    expect(assertionCount).toBe(1);
  });

  it('iterates direct children in declaration order', () => {
    const program = createIndicatorScriptFixture();
    let fnPath: NodePath | null = null;

    visit(program, {
      FunctionDeclaration: {
        enter: (path) => {
          if (!fnPath) {
            fnPath = path;
          }
        },
      },
    });

    expect(fnPath).not.toBeNull();

    const childKinds: string[] = [];
    const childKeys: Array<string | null> = [];
    const childIndexes: Array<number | null> = [];

    visitChildren(fnPath!, (child) => {
      childKinds.push(child.node.kind);
      childKeys.push(child.key);
      childIndexes.push(child.index);
    });

    expect(childKinds).toEqual(['Identifier', 'Parameter', 'BlockStatement']);
    expect(childKeys).toEqual(['identifier', 'params', 'body']);
    expect(childIndexes).toEqual([null, 0, null]);
  });

  it('visits member expressions and their identifiers', () => {
    const program = createNamespaceAccessFixture();
    const visited: string[] = [];

    visit(program, {
      MemberExpression: { enter: () => visited.push('MemberExpression') },
      Identifier: { enter: (path) => visited.push(`Identifier:${path.node.name}`) },
    });

    expect(visited).toEqual([
      'Identifier:tf',
      'MemberExpression',
      'Identifier:timeframe',
      'Identifier:period',
      'Identifier:isDaily',
      'MemberExpression',
      'Identifier:timeframe',
      'Identifier:isdaily',
    ]);
  });

  it('walks control flow statements and conditional expressions', () => {
    const program: ProgramNode = createControlFlowFixture();

    const visited: string[] = [];

    visit(program, {
      IfStatement: { enter: () => visited.push('IfStatement') },
      ConditionalExpression: { enter: () => visited.push('ConditionalExpression') },
      WhileStatement: { enter: () => visited.push('WhileStatement') },
      ForStatement: { enter: () => visited.push('ForStatement') },
      VariableDeclaration: { enter: (path) => visited.push(`Var:${path.node.identifier.name}`) },
      Identifier: { enter: (path) => visited.push(`Identifier:${path.node.name}`) },
    });

    expect(visited).toEqual([
      'IfStatement',
      'Identifier:ifCond',
      'ConditionalExpression',
      'Identifier:flag',
      'Identifier:foo',
      'Identifier:bar',
      'WhileStatement',
      'Identifier:loopGuard',
      'Var:loopResult',
      'Identifier:loopResult',
      'Identifier:loopGuard',
      'ForStatement',
      'Var:idx',
      'Identifier:idx',
      'Identifier:hasNext',
      'Identifier:idx',
      'Identifier:idx',
    ]);

    const forStatement = program.body[2] as ForStatementNode;
    const forPath = createPath(forStatement, null, 'body', 2);
    const forChildKeys: Array<string | null> = [];
    visitChildren(forPath, (child) => {
      forChildKeys.push(child.key);
    });
    expect(forChildKeys).toEqual(['initializer', 'test', 'update', 'body']);
  });

  it('walks switch statements, matrix literals, and index expressions', () => {
    const program = createSwitchMatrixFixture();
    const visited: string[] = [];

    visit(program, {
      SwitchStatement: { enter: () => visited.push('SwitchStatement') },
      SwitchCase: {
        enter: (path) => {
          visited.push(path.node.test ? 'SwitchCase:test' : 'SwitchCase:default');
        },
      },
      MatrixLiteral: { enter: () => visited.push('MatrixLiteral') },
      IndexExpression: { enter: () => visited.push('IndexExpression') },
    });

    expect(visited).toEqual([
      'MatrixLiteral',
      'SwitchStatement',
      'SwitchCase:test',
      'SwitchCase:test',
      'IndexExpression',
      'SwitchCase:default',
    ]);
  });
});
