import { describe, expect, it, vi } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import type { AstValidationContext, AstService } from '../../core/types';
import { createAstDiagnostics } from '../../core/ast/types';
import { type ProgramNode, createLocation, createPosition, createRange } from '../../core/ast/nodes';

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
    expect(context.typeEnvironment.identifiers.size).toBe(0);
    expect(context.typeEnvironment.nodeTypes).toBeInstanceOf(WeakMap);
    expect(context.controlFlowGraph.nodes.size).toBe(0);
  });

  it('populates AST data when the service succeeds', () => {
    const fakeAst: ProgramNode = {
      kind: 'Program',
      directives: [],
      body: [],
      loc: createLocation(createPosition(1, 1, 0), createPosition(1, 1, 0)),
      range: createRange(0, 0),
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
    expect(context.scopeGraph.root).toBe('scope-0');
    expect(context.scopeGraph.nodes.size).toBe(1);
    expect(context.symbolTable.size).toBe(0);
    expect(context.typeEnvironment.identifiers.size).toBe(0);
    expect(context.typeEnvironment.nodeTypes).toBeInstanceOf(WeakMap);
    expect(context.controlFlowGraph.entry).not.toBeNull();
    expect(context.controlFlowGraph.exit).not.toBeNull();
    expect(context.controlFlowGraph.nodes.size).toBe(2);
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
    expect(context.typeEnvironment.identifiers.size).toBe(0);
    expect(context.controlFlowGraph.nodes.size).toBe(0);
  });
});
