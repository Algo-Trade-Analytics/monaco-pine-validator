import { describe, expect, it } from 'vitest';
import { Assign, Constant, Expr, FunctionDef, Name, Script } from '../../pynescript/ast/node';
import { NodeVisitor } from '../../pynescript/ast/visitor';
import { NodeTransformer } from '../../pynescript/ast/transformer';

describe('PineScript AST visitor infrastructure', () => {
  it('dispatches to type-specific visit methods', () => {
    const script = new Script({
      body: [
        new FunctionDef({
          name: 'dispatch',
          body: [
            new Expr({
              value: new Name({ id: 'identifier' }),
            }),
          ],
        }),
      ],
    });

    class RecordingVisitor extends NodeVisitor {
      readonly visited: string[] = [];

      override visit_FunctionDef(node: FunctionDef) {
        this.visited.push(`FunctionDef:${node.name}`);
        return this.genericVisit(node);
      }

      override visit_Name(node: Name) {
        this.visited.push(`Name:${node.id}`);
        return node;
      }
    }

    const visitor = new RecordingVisitor();
    visitor.visit(script);

    expect(visitor.visited).toEqual(['FunctionDef:dispatch', 'Name:identifier']);
  });

  it('transforms nodes recursively and supports removal', () => {
    const script = new Script({
      body: [
        new FunctionDef({
          name: 'transform',
          body: [
            new Assign({
              target: new Name({ id: 'x' }),
              value: new Constant({ value: 1 }),
            }),
            new Expr({
              value: new Name({ id: 'remove' }),
            }),
          ],
        }),
      ],
    });

    class Transformer extends NodeTransformer {
      override visit_Name(node: Name) {
        if (node.id === 'x') {
          return new Name({ id: 'y' });
        }
        if (node.id === 'remove') {
          return null;
        }
        return node;
      }

      override visit_Assign(node: Assign) {
        const replacement = super.genericVisit(node) as Assign;
        return [replacement, new Assign({
          target: new Name({ id: 'y' }),
          value: new Constant({ value: 2 }),
        })];
      }

      override visit_Expr() {
        return null;
      }
    }

    const transformer = new Transformer();
    const result = transformer.visit(script) as Script;
    const fn = result.body[0] as FunctionDef;

    expect(fn.body.length).toBe(2);
    const [firstAssign, secondAssign] = fn.body as Assign[];
    expect((firstAssign.target as Name).id).toBe('y');
    expect((secondAssign.target as Name).id).toBe('y');
    expect(fn.body.every((node) => node instanceof Assign)).toBe(true);
  });
});
