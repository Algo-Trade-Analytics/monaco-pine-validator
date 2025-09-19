import { describe, expect, it } from 'vitest';
import * as Nodes from '../../pynescript/ast/node';

function isNodeConstructor(value: unknown): value is new (...args: any[]) => Nodes.AST {
  return (
    typeof value === 'function' &&
    (value === Nodes.AST || value.prototype instanceof Nodes.AST)
  );
}

describe('PineScript AST node definitions', () => {
  const constructors = Object.entries(Nodes)
    .filter(([, value]) => isNodeConstructor(value))
    .map(([name, value]) => ({ name, ctor: value as new () => Nodes.AST }));

  it('instantiates every AST node without arguments', () => {
    for (const { name, ctor } of constructors) {
      expect(() => new ctor()).not.toThrowError();
    }
  });

  it('applies initializer objects to node instances', () => {
    const assign = new Nodes.Assign({
      target: new Nodes.Name({ id: 'foo' }),
      value: new Nodes.Constant({ value: 42 }),
      type: new Nodes.Name({ id: 'series' })
    });

    expect(assign.target).toBeInstanceOf(Nodes.Name);
    expect((assign.target as Nodes.Name).id).toBe('foo');
    expect(assign.value).toBeInstanceOf(Nodes.Constant);
    expect((assign.value as Nodes.Constant).value).toBe(42);
    expect(assign.type).toBeInstanceOf(Nodes.Name);
    expect((assign.type as Nodes.Name).id).toBe('series');
  });

  it('creates fresh mutable field defaults for each instance', () => {
    for (const { name, ctor } of constructors) {
      const first = new ctor();
      const second = new ctor();
      const fields = (ctor as typeof Nodes.AST)._fields ?? [];
      for (const field of fields) {
        const firstValue = (first as any)[field];
        const secondValue = (second as any)[field];
        if (Array.isArray(firstValue)) {
          expect(firstValue, `${name}.${field} should be a new array`).not.toBe(secondValue);
        }
        if (firstValue && typeof firstValue === 'object' && firstValue.constructor === Object) {
          expect(firstValue, `${name}.${field} should be a new object`).not.toBe(secondValue);
        }
      }
    }
  });
});
