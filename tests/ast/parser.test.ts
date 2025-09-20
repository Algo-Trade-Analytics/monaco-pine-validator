import { describe, expect, it } from 'vitest';
import { createChevrotainAstService } from '../../core/ast/parser';

const service = createChevrotainAstService();

describe('Chevrotain-based Pine parser', () => {
  it('parses version directives, declarations, and assignments', () => {
    const source = `//@version=6\nindicator("My script", overlay=true)\nvar foo = 1\nfoo = bar`;

    const { ast, diagnostics } = service.parse(source);

    expect(diagnostics.syntaxErrors).toEqual([]);
    expect(ast?.version?.value).toBe(6);
    expect(ast?.body).toHaveLength(3);

    const [declaration, variable, assignment] = ast!.body;
    expect(declaration.kind).toBe('IndicatorDeclaration');
    expect(variable.kind).toBe('VariableDeclaration');
    expect(assignment.kind).toBe('AssignmentStatement');

    if (declaration.kind === 'IndicatorDeclaration') {
      expect(declaration.call.args[0]?.value.kind).toBe('StringLiteral');
    }
  });

  it('returns syntax diagnostics on malformed scripts', () => {
    const source = 'indicator("x" overlay=true';
    const { diagnostics } = service.parse(source);

    expect(diagnostics.syntaxErrors.length).toBeGreaterThan(0);
    const [error] = diagnostics.syntaxErrors;
    expect(error.message).toContain('Expecting token of type');
  });
});
