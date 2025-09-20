import { describe, expect, it } from 'vitest';
import { createChevrotainAstService } from '../../core/ast/parser';
import { inferProgramTypes } from '../../core/ast/type-inference';

const service = createChevrotainAstService();

describe('AST type inference', () => {
  it('infers literal types for declarations', () => {
    const source = `//@version=6\nindicator("Demo")\nvar foo = 1\nbar = "text"\nbaz = true`;
    const { ast, diagnostics } = service.parse(source);
    expect(diagnostics.syntaxErrors).toEqual([]);

    const { types } = inferProgramTypes(ast);

    expect(types.get('foo')).toMatchObject({ kind: 'float', isSeries: true });
    expect(types.get('bar')).toMatchObject({ kind: 'string', isSeries: false });
    expect(types.get('baz')).toMatchObject({ kind: 'bool', isSeries: false });
  });

  it('propagates identifier assignments', () => {
    const source = `//@version=6\nindicator("Demo")\nvar foo = 10\nbar = foo\nqux = plot(bar)`;
    const { ast } = service.parse(source);

    const { types } = inferProgramTypes(ast);

    expect(types.get('bar')).toMatchObject({ kind: 'float' });
    expect(types.get('qux')).toMatchObject({ kind: 'unknown', isSeries: true });
  });

  it('records multiple assignment sources for the same identifier', () => {
    const source = `//@version=6\nindicator("Demo")\nvalue = 1\nvalue = "two"`;
    const { ast } = service.parse(source);

    const { types } = inferProgramTypes(ast);
    const annotation = types.get('value');

    expect(annotation?.kind).toBe('unknown');
    expect(annotation?.sources.length).toBeGreaterThanOrEqual(4);
  });
});
