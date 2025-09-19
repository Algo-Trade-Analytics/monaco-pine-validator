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
  Script,
  Switch,
} from '../../pynescript/ast/node';
import { StatementCollector } from '../../pynescript/ast/collector';

describe('StatementCollector', () => {
  it('collects statements from structural expressions', () => {
    const innerAssign = new Assign({
      target: new Name({ id: 'inner' }),
      value: new Constant({ value: 5 }),
    });

    const conditional = new If({
      test: new Name({ id: 'cond' }),
      body: [innerAssign],
      orelse: [new Break()],
    });

    const fn = new FunctionDef({
      name: 'collector',
      body: [
        new Assign({
          target: new Name({ id: 'x' }),
          value: new Constant({ value: 1 }),
        }),
        new Expr({ value: conditional }),
      ],
    });

    const switchExpr = new Switch({
      subject: new Name({ id: 'subject' }),
      cases: [
        new Case({
          pattern: new Constant({ value: 1 }),
          body: [new Continue()],
        }),
      ],
    });

    const script = new Script({
      body: [fn, new Expr({ value: switchExpr })],
    });

    const collector = new StatementCollector();
    const result = collector.visit(script) as Iterable<Assign>;
    const statements = Array.from(result);

    expect(statements.some((stmt) => stmt instanceof FunctionDef)).toBe(true);
    expect(statements.some((stmt) => stmt instanceof Assign)).toBe(true);
    expect(statements.some((stmt) => stmt instanceof Break)).toBe(true);
    expect(statements.some((stmt) => stmt instanceof Continue)).toBe(true);
    expect(statements.some((stmt) => stmt instanceof Expr)).toBe(true);
    expect(statements.some((stmt) => stmt === innerAssign)).toBe(true);
  });
});
