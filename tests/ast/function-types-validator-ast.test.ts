import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { FunctionTypesValidator } from '../../modules/functions/function-types';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createBlock,
  createFunctionDeclaration,
  createIdentifier,
  createIfStatement,
  createNumberLiteral,
  createProgram,
  createReturn,
  createStringLiteral,
} from './fixtures';

class FunctionTypesHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new FunctionTypesValidator());
  }

  protected runCoreValidation(): void {}
}

class FunctionTypesDisabledHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new FunctionTypesValidator());
  }

  protected runCoreValidation(): void {}
}

describe('FunctionTypesValidator (AST)', () => {
  it('reports inconsistent return types when AST shows multiple distinct kinds', () => {
    const fnIdentifier = createIdentifier('mix', 0, 1);
    const firstReturn = createReturn(createNumberLiteral(1, '1', 4, 2), 4, 5, 2);
    const secondReturn = createReturn(createStringLiteral('two', '"two"', 4, 3), 4, 9, 3);
    const body = createBlock([firstReturn, secondReturn], 4, 9, 2, 3);
    const fn = createFunctionDeclaration(fnIdentifier, [], body, 0, 9, 1, 3);
    const program = createProgram([fn], 0, 9, 1, 3);
    const source = ['mix() =>', '    1', '    "two"'].join('\n');

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new FunctionTypesHarness(service);

    const result = harness.validate(source);
    expect(result.errors.map((error) => error.code)).toContain('PSV6-FUNCTION-RETURN-TYPE');
  });

  it('warns about high complexity when AST detects many branching points', () => {
    const fnIdentifier = createIdentifier('analyze', 0, 1);
    const statements = Array.from({ length: 11 }, (_, index) => {
      const line = 2 + index;
      const condition = createIdentifier(`cond${index}`, 4, line);
      const consequent = createBlock([], 8, 12, line, line);
      return createIfStatement(condition, consequent, null, 4, 12, line);
    });
    const body = createBlock(statements, 4, 12, 2, 12);
    const fn = createFunctionDeclaration(fnIdentifier, [], body, 0, 12, 1, 12);
    const program = createProgram([fn], 0, 12, 1, 12);
    const source = ['analyze() =>', ...statements.map((_, index) => `    if cond${index}`)].join('\n');

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new FunctionTypesHarness(service);

    const result = harness.validate(source);
    expect(result.warnings.map((warning) => warning.code)).toContain('PSV6-FUNCTION-COMPLEXITY');
  });

  it('warns about very long functions when AST body spans many lines', () => {
    const fnIdentifier = createIdentifier('long', 0, 1);
    const returns = Array.from({ length: 55 }, (_, index) => {
      const line = 2 + index;
      const literal = createNumberLiteral(index, `${index}`, 4, line);
      return createReturn(literal, 4, 4 + `${index}`.length, line);
    });
    const bodyStart = returns[0].range[0];
    const bodyEnd = returns[returns.length - 1].range[1];
    const body = createBlock(returns, bodyStart, bodyEnd, 2, 56);
    const fn = createFunctionDeclaration(fnIdentifier, [], body, 0, bodyEnd, 1, 56);
    const program = createProgram([fn], 0, bodyEnd, 1, 56);
    const source = ['long() =>', ...returns.map((_, index) => `    ${index}`)].join('\n');

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new FunctionTypesHarness(service);

    const result = harness.validate(source);
    expect(result.warnings.map((warning) => warning.code)).toContain('PSV6-FUNCTION-LENGTH');
  });

  it('returns no diagnostics when AST mode is disabled', () => {
    const harness = new FunctionTypesDisabledHarness();

    const result = harness.validate('noop() => 0');

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });
});
