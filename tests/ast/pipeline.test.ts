import { describe, expect, it, vi } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import type { AstValidationContext, AstService } from '../../core/types';
import { createAstDiagnostics } from '../../core/ast/types';
import type { ProgramNode } from '../../core/ast/nodes';
import { createChevrotainAstService } from '../../core/ast/parser';

class TestValidator extends BaseValidator {
  protected runCoreValidation(): void {}

  exposeContext(): AstValidationContext {
    return this.context;
  }
}

describe('BaseValidator AST pipeline integration', () => {
  it('does not invoke the AST service when mode is disabled', () => {
    const parse = vi.fn(() => ({ ast: null, diagnostics: createAstDiagnostics() }));
    const service: AstService = { parse };

    const validator = new TestValidator({ ast: { mode: 'disabled', service } });
    const result = validator.validate('//@version=6\nindicator("noop")');

    expect(parse).not.toHaveBeenCalled();
    expect(result.warnings).toEqual([]);

    const context = validator.exposeContext();
    expect(context.ast).toBeNull();
    expect(context.astDiagnostics.syntaxErrors).toEqual([]);
    expect(context.scopeGraph.nodes.size).toBe(0);
    expect(context.symbolTable.size).toBe(0);
    expect(context.astTypes.size).toBe(0);
  });

  it('populates AST data when the service succeeds', () => {
    const fakeAst: ProgramNode = {
      kind: 'Program',
      version: null,
      body: [],
      loc: {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 1, offset: 0 },
      },
      range: [0, 0],
    };
    const parse = vi.fn(() => ({ ast: fakeAst, diagnostics: createAstDiagnostics() }));
    const service: AstService = { parse };

    const validator = new TestValidator({ ast: { mode: 'shadow', service } });
    const result = validator.validate('//@version=6\nindicator("example")');

    expect(parse).toHaveBeenCalledTimes(1);
    const [, options] = parse.mock.calls[0];
    expect(options?.filename).toBeDefined();

    expect(result.isValid).toBe(true);
    expect(result.warnings).toEqual([]);

    const context = validator.exposeContext();
    expect(context.ast).toBe(fakeAst);
    expect(context.astDiagnostics.syntaxErrors).toEqual([]);
    expect(context.astTypes.size).toBe(0);
  });

  it('records parser failures as warnings', () => {
    const parse = vi.fn(() => {
      throw new Error('parse failed');
    });
    const service: AstService = { parse };

    const validator = new TestValidator({ ast: { mode: 'shadow', service } });
    const result = validator.validate('//@version=6\nindicator("broken")');

    expect(parse).toHaveBeenCalled();
    expect(result.warnings.some((warning) => warning.code === 'AST-PARSE')).toBe(true);

    const context = validator.exposeContext();
    expect(context.ast).toBeNull();
    expect(context.astDiagnostics.syntaxErrors).toEqual([]);
    expect(context.astTypes.size).toBe(0);
  });

  it('stores inferred types in the AST context and symbol metadata', () => {
    const validator = new TestValidator({ ast: { mode: 'shadow', service: createChevrotainAstService() } });
    validator.validate(`//@version=6\nindicator("Demo")\nvar foo = 1\nbar = foo`);

    const context = validator.exposeContext();

    expect(context.astTypes.get('foo')).toMatchObject({ kind: 'float', isSeries: true });
    expect(context.astTypes.get('bar')).toMatchObject({ kind: 'float', isSeries: true });

    const fooRecord = context.symbolTable.get('foo');
    expect(fooRecord?.metadata).toMatchObject({ storage: 'var', type: 'float', isSeries: true });

    const barRecord = context.symbolTable.get('bar');
    expect(barRecord?.metadata).toMatchObject({ type: 'float', isSeries: true });
  });
});
