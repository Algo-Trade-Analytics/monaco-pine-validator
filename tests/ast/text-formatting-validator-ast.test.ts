import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { TextFormattingValidator } from '../../modules/text-formatting-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createBlock,
  createCallExpression,
  createExpressionStatement,
  createForStatement,
  createIdentifier,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
} from './fixtures';

class TextFormattingValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new TextFormattingValidator());
  }

  protected runCoreValidation(): void {}
}

describe('TextFormattingValidator (AST)', () => {
  it('reports parameter mismatches between placeholders and arguments', () => {
    const strIdentifier = createIdentifier('str', 0, 1);
    const formatIdentifier = createIdentifier('format', 4, 1);
    const callee = createMemberExpression(strIdentifier, formatIdentifier, 0, 10, 1);

    const formatLiteral = createStringLiteral('{0} {1}', '"{0} {1}"', 11, 1);
    const formatArgument = createArgument(formatLiteral, 11, 20, 1);

    const valueLiteral = createNumberLiteral(1, '1', 22, 1);
    const valueArgument = createArgument(valueLiteral, 22, 23, 1);

    const call = createCallExpression(callee, [formatArgument, valueArgument], 0, 24, 1);
    const statement = createExpressionStatement(call, 0, 24, 1);
    const program = createProgram([statement], 0, 24, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TextFormattingValidatorHarness(service);

    const result = harness.validate('str.format("{0} {1}", 1)');
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-TEXT-PARAM-MISMATCH');
  });

  it('warns when numeric format placeholders receive non-numeric parameters', () => {
    const strIdentifier = createIdentifier('str', 0, 1);
    const formatIdentifier = createIdentifier('format', 4, 1);
    const callee = createMemberExpression(strIdentifier, formatIdentifier, 0, 25, 1);

    const formatLiteral = createStringLiteral('{0,number,#.##}', '"{0,number,#.##}"', 26, 1);
    const formatArgument = createArgument(formatLiteral, 26, 45, 1);

    const stringLiteral = createStringLiteral('oops', '"oops"', 47, 1);
    const stringArgument = createArgument(stringLiteral, 47, 53, 1);

    const call = createCallExpression(callee, [formatArgument, stringArgument], 0, 54, 1);
    const statement = createExpressionStatement(call, 0, 54, 1);
    const program = createProgram([statement], 0, 54, 1, 1);

    const source = 'str.format("{0,number,#.##}", "oops")';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TextFormattingValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-TEXT-NON-NUMERIC-FORMAT');
  });

  it('warns when text formatting executes inside loops', () => {
    const strIdentifier = createIdentifier('str', 4, 2);
    const formatIdentifier = createIdentifier('format', 8, 2);
    const callee = createMemberExpression(strIdentifier, formatIdentifier, 4, 14, 2);

    const formatLiteral = createStringLiteral('{0}', '"{0}"', 15, 2);
    const formatArgument = createArgument(formatLiteral, 15, 20, 2);

    const valueIdentifier = createIdentifier('value', 22, 2);
    const valueArgument = createArgument(valueIdentifier, 22, 27, 2);

    const call = createCallExpression(callee, [formatArgument, valueArgument], 4, 28, 2);
    const statement = createExpressionStatement(call, 4, 28, 2);
    const block = createBlock([statement], 4, 28, 2, 2);
    const loop = createForStatement(null, null, null, block, 0, 28, 1);
    const program = createProgram([loop], 0, 28, 1, 2);

    const source = 'for i = 0 to 1\n    str.format("{0}", value)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TextFormattingValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-TEXT-PERF-LOOP');
  });

  it('warns on complex text formatting with many placeholders', () => {
    const strIdentifier = createIdentifier('str', 0, 1);
    const formatIdentifier = createIdentifier('format', 4, 1);
    const callee = createMemberExpression(strIdentifier, formatIdentifier, 0, 30, 1);

    const formatLiteral = createStringLiteral('{0} {1} {2}', '"{0} {1} {2}"', 31, 1);
    const formatArgument = createArgument(formatLiteral, 31, 45, 1);

    const firstArgument = createArgument(createNumberLiteral(1, '1', 47, 1), 47, 48, 1);
    const secondArgument = createArgument(createNumberLiteral(2, '2', 50, 1), 50, 51, 1);
    const thirdArgument = createArgument(createNumberLiteral(3, '3', 53, 1), 53, 54, 1);

    const call = createCallExpression(
      callee,
      [formatArgument, firstArgument, secondArgument, thirdArgument],
      0,
      55,
      1,
    );
    const statement = createExpressionStatement(call, 0, 55, 1);
    const program = createProgram([statement], 0, 55, 1, 1);

    const source = 'str.format("{0} {1} {2}", 1, 2, 3)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TextFormattingValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-TEXT-PERF-COMPLEX');
  });
});
