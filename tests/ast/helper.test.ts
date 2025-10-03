import { describe, expect, it } from 'vitest';
import {
  Assign,
  Break,
  Case,
  Constant,
  Continue,
  Expr,
  FunctionDef,
  If,
  Name,
  Param,
  Script,
  Switch,
  Arg,
  Call,
} from '../../pynescript/ast/node';
import {
  copyLocation,
  dump,
  fixMissingLocations,
  getSourceSegment,
  incrementLineno,
  iterChildNodes,
  iterFields,
  walk,
} from '../../pynescript/ast/helper';

function createSampleScript() {
  const assign = new Assign({
    target: new Name({ id: 'foo' }),
    value: new Constant({ value: 42 }),
  });

  const conditional = new If({
    test: new Name({ id: 'cond' }),
    body: [
      new Assign({
        target: new Name({ id: 'bar' }),
        value: new Constant({ value: 1 }),
      }),
    ],
    orelse: [new Break()],
  });

  const functionNode = new FunctionDef({
    name: 'test',
    args: [new Param({ name: 'x' })],
    body: [assign, new Expr({ value: conditional })],
  });

  const switchNode = new Switch({
    subject: new Name({ id: 'subject' }),
    cases: [
      new Case({
        pattern: new Constant({ value: 1 }),
        body: [new Continue()],
      }),
    ],
  });

  const callExpr = new Expr({
    value: new Call({
      func: new Name({ id: 'emit' }),
      args: [new Arg({ value: new Constant({ value: 0 }) })],
    }),
  });

  return new Script({
    body: [functionNode, callExpr, new Expr({ value: switchNode })],
  });
}

describe('PineScript AST helper utilities', () => {
  it('iterates declared fields in definition order', () => {
    const node = new FunctionDef({
      name: 'fn',
      args: [new Param({ name: 'a' })],
      body: [],
    });

    expect(Array.from(iterFields(node)).map(([field]) => field)).toEqual([
      'name',
      'args',
      'body',
      'method',
      'export',
      'annotations',
    ]);
  });

  it('iterates child nodes across nested lists', () => {
    const script = createSampleScript();
    const names = Array.from(iterChildNodes(script.body[0]!))
      .map((child) => child.constructor.name)
      .sort();
    expect(names).toEqual(['Assign', 'Expr', 'Param']);
  });

  it('copies positional information between nodes', () => {
    const original = new Assign({
      lineno: 10,
      col_offset: 2,
      end_lineno: 10,
      end_col_offset: 8,
    });
    const replacement = new Assign();
    copyLocation(replacement, original);

    expect(replacement.lineno).toBe(10);
    expect(replacement.col_offset).toBe(2);
    expect(replacement.end_lineno).toBe(10);
    expect(replacement.end_col_offset).toBe(8);
  });

  it('fills missing location information recursively', () => {
    const script = createSampleScript();
    const filled = fixMissingLocations(script);

    for (const node of walk(filled)) {
      const attributes = ((node.constructor as typeof Assign) as any)._attributes as
        | readonly string[]
        | undefined;
      if (attributes?.includes('lineno')) {
        expect((node as unknown as Record<string, unknown>).lineno).not.toBeNull();
        expect((node as unknown as Record<string, unknown>).end_lineno).not.toBeNull();
      }
    }
  });

  it('increments line numbers across the entire tree', () => {
    const script = createSampleScript();
    fixMissingLocations(script);
    incrementLineno(script, 3);

    const functionNode = script.body[0] as FunctionDef;
    expect(functionNode.lineno).toBe(4);
    expect(functionNode.end_lineno).toBe(4);

    const nestedAssign = (functionNode.body[0] as Assign);
    expect(nestedAssign.lineno).toBe(4);
    expect(nestedAssign.end_lineno).toBe(4);
  });

  it('extracts matching source segments', () => {
    const node = new Name({
      id: 'series',
      lineno: 1,
      col_offset: 4,
      end_lineno: 1,
      end_col_offset: 10,
    });
    const source = 'var series = 5\n';
    expect(getSourceSegment(source, node)).toBe('series');
    expect(getSourceSegment(source, node, { padded: true })).toBe('series');
  });

  it('walks nodes breadth-first', () => {
    const script = createSampleScript();
    const order = Array.from(walk(script)).map((node) => node.constructor.name);
    expect(order[0]).toBe('Script');
    expect(order).toContain('Assign');
    expect(order).toContain('FunctionDef');
    expect(order.indexOf('FunctionDef')).toBeLessThan(order.indexOf('Assign'));
  });

  it('formats nodes deterministically with dump()', () => {
    const node = new Name({ id: 'identifier' });
    expect(dump(node)).toBe('Name(id="identifier", ctx=null)');
    expect(() => dump({} as any)).toThrowError(/expected AST/);
  });
});
