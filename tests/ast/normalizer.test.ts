import { describe, expect, it } from 'vitest';
import { createChevrotainAstService } from '../../core/ast/parser';
import { normaliseProgramAst } from '../../core/ast/normalizer';
import type {
  BlockStatementNode,
  FunctionDeclarationNode,
  IdentifierNode,
  IfStatementNode,
  ProgramNode,
  VariableDeclarationNode,
} from '../../core/ast/nodes';
import { traverse } from '../../core/ast/traversal';

const service = createChevrotainAstService();

describe('AST normaliser', () => {
  it('returns empty structures when no AST is provided', () => {
    const { scopeGraph, symbolTable } = normaliseProgramAst(null);

    expect(scopeGraph.root).toBeNull();
    expect(scopeGraph.nodes.size).toBe(0);
    expect(symbolTable.size).toBe(0);
  });

  it('builds a module scope with symbol metadata', () => {
    const source = `//@version=6\nindicator("Demo")\nvar foo = close\nbar = foo\nplot(bar)`;
    const { ast, diagnostics } = service.parse(source);

    expect(diagnostics.syntaxErrors).toEqual([]);

    const { scopeGraph, symbolTable } = normaliseProgramAst(ast);

    expect(scopeGraph.root).not.toBeNull();
    const rootId = scopeGraph.root!;
    const rootScope = scopeGraph.nodes.get(rootId);
    expect(rootScope).toBeDefined();
    expect(rootScope?.kind).toBe('module');
    expect(rootScope?.children.size).toBe(0);
    expect(rootScope?.symbols).toEqual(new Set(['foo', 'bar', 'plot', 'indicator', 'close']));

    const foo = symbolTable.get('foo');
    expect(foo).toBeDefined();
    expect(foo?.kind).toBe('variable');
    expect(foo?.declarations).toHaveLength(1);
    expect(foo?.references).toHaveLength(1);
    expect(foo?.metadata).toMatchObject({ storage: 'var' });

    const bar = symbolTable.get('bar');
    expect(bar).toBeDefined();
    expect(bar?.kind).toBe('variable');
    expect(bar?.declarations).toHaveLength(0);
    expect(bar?.references).toHaveLength(2);

    const plot = symbolTable.get('plot');
    expect(plot).toBeDefined();
    expect(plot?.kind).toBe('function');
    expect(plot?.declarations).toHaveLength(0);
    expect(plot?.references).toHaveLength(1);

    const indicator = symbolTable.get('indicator');
    expect(indicator).toBeDefined();
    expect(indicator?.kind).toBe('function');
    expect(indicator?.references).toHaveLength(1);
  });

  it('creates child scopes for blocks and propagates metadata onto node paths', () => {
    const dummyLoc = {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 1, offset: 0 },
    } as const;
    const makeIdentifier = (name: string): IdentifierNode => ({
      kind: 'Identifier',
      name,
      loc: dummyLoc,
      range: [0, 0] as const,
    });

    const globalVar: VariableDeclarationNode = {
      kind: 'VariableDeclaration',
      keyword: 'var',
      identifier: makeIdentifier('globalVar'),
      value: null,
      loc: dummyLoc,
      range: [0, 0] as const,
    };

    const functionBody: BlockStatementNode = {
      kind: 'BlockStatement',
      body: [
        {
          kind: 'VariableDeclaration',
          keyword: 'var',
          identifier: makeIdentifier('localVar'),
          value: null,
          loc: dummyLoc,
          range: [0, 0] as const,
        },
      ],
      loc: dummyLoc,
      range: [0, 0] as const,
    };

    const functionDecl: FunctionDeclarationNode = {
      kind: 'FunctionDeclaration',
      name: makeIdentifier('doStuff'),
      parameters: [],
      body: functionBody,
      loc: dummyLoc,
      range: [0, 0] as const,
    };

    const conditionalBlock: BlockStatementNode = {
      kind: 'BlockStatement',
      body: [
        {
          kind: 'VariableDeclaration',
          keyword: 'var',
          identifier: makeIdentifier('inner'),
          value: null,
          loc: dummyLoc,
          range: [0, 0] as const,
        },
      ],
      loc: dummyLoc,
      range: [0, 0] as const,
    };

    const ifStatement: IfStatementNode = {
      kind: 'IfStatement',
      test: makeIdentifier('condition'),
      consequent: conditionalBlock,
      alternate: null,
      loc: dummyLoc,
      range: [0, 0] as const,
    };

    const program: ProgramNode = {
      kind: 'Program',
      version: null,
      body: [globalVar, functionDecl, ifStatement],
      loc: dummyLoc,
      range: [0, 0] as const,
    };

    const { scopeGraph, symbolTable } = normaliseProgramAst(program);

    const rootId = scopeGraph.root!;
    const functionScope = Array.from(scopeGraph.nodes.values()).find(
      (node) => node.kind === 'function' && node.parent === rootId,
    );
    const conditionalScope = Array.from(scopeGraph.nodes.values()).find(
      (node) => node.kind === 'conditional' && node.parent === rootId,
    );

    expect(functionScope).toBeDefined();
    expect(conditionalScope).toBeDefined();

    expect(functionScope?.children.size).toBe(0);
    expect(conditionalScope?.children.size).toBe(0);

    expect(functionScope?.symbols.has('localVar')).toBe(true);
    expect(conditionalScope?.symbols.has('inner')).toBe(true);
    expect(scopeGraph.nodes.get(rootId)?.symbols.has('globalVar')).toBe(true);

    expect(symbolTable.get('localVar')?.declarations).toHaveLength(1);
    expect(symbolTable.get('inner')?.declarations).toHaveLength(1);

    traverse(program, {
      VariableDeclaration(path) {
        if (path.node.identifier.name === 'localVar') {
          expect(path.metadata.scopeId).toBe(functionScope?.id);
        }
        if (path.node.identifier.name === 'inner') {
          expect(path.metadata.scopeId).toBe(conditionalScope?.id);
        }
        if (path.node.identifier.name === 'globalVar') {
          expect(path.metadata.scopeId).toBe(rootId);
        }
      },
    });
  });
});
