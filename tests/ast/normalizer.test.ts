import { describe, expect, it } from 'vitest';
import { createChevrotainAstService } from '../../core/ast/parser';
import { normaliseProgramAst } from '../../core/ast/normalizer';

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
});
