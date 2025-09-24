import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { TAFunctionsValidator } from '../../modules/ta-functions-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createAssignmentStatement,
  createBinaryExpression,
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

class TAValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new TAFunctionsValidator());
  }

  protected runCoreValidation(): void {}
}

class TAValidatorDisabledHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new TAFunctionsValidator());
  }

  protected runCoreValidation(): void {}
}

describe('TAFunctionsValidator (AST)', () => {
  it('reports unknown ta members', () => {
    const taIdentifier = createIdentifier('ta', 0, 1);
    const unknownIdentifier = createIdentifier('unknown', 3, 1);
    const callee = createMemberExpression(taIdentifier, unknownIdentifier, 0, 10, 1);
    const call = createCallExpression(callee, [], 0, 12, 1);
    const statement = createExpressionStatement(call, 0, 12, 1);
    const program = createProgram([statement], 0, 12, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TAValidatorHarness(service);

    const result = harness.validate('ta.unknown()');
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-TA-FUNCTION-UNKNOWN: Unknown TA function: ta.unknown');
  });

  it('validates parameter types', () => {
    const taIdentifier = createIdentifier('ta', 0, 1);
    const smaIdentifier = createIdentifier('sma', 3, 1);
    const callee = createMemberExpression(taIdentifier, smaIdentifier, 0, 6, 1);

    const firstArgumentValue = createStringLiteral('oops', '"oops"', 7, 1);
    const firstArgument = createArgument(firstArgumentValue, 7, 13, 1);

    const secondArgumentValue = createNumberLiteral(14, '14', 15, 1);
    const secondArgument = createArgument(secondArgumentValue, 15, 17, 1);

    const call = createCallExpression(callee, [firstArgument, secondArgument], 0, 18, 1);
    const statement = createExpressionStatement(call, 0, 18, 1);
    const program = createProgram([statement], 0, 18, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TAValidatorHarness(service);

    const result = harness.validate('ta.sma("oops", 14)');
    const codes = result.errors.map((error) => error.code);

    expect(codes).toContain('PSV6-TA-FUNCTION-PARAM');
  });

  it('warns when ta calls execute inside loops', () => {
    const taIdentifier = createIdentifier('ta', 4, 2);
    const smaIdentifier = createIdentifier('sma', 7, 2);
    const callee = createMemberExpression(taIdentifier, smaIdentifier, 4, 12, 2);

    const closeIdentifier = createIdentifier('close', 11, 2);
    const closeArgument = createArgument(closeIdentifier, 11, 16, 2);

    const lengthLiteral = createNumberLiteral(14, '14', 18, 2);
    const lengthArgument = createArgument(lengthLiteral, 18, 20, 2);

    const call = createCallExpression(callee, [closeArgument, lengthArgument], 4, 21, 2);
    const statement = createExpressionStatement(call, 4, 21, 2);
    const block = createBlock([statement], 4, 21, 2, 2);

    const loop = createForStatement(null, null, null, block, 0, 21, 1);
    const program = createProgram([loop], 0, 21, 1, 2);

    const source = 'for i = 0 to 1\n    ta.sma(close, 14)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TAValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-TA-PERF-LOOP');
  });

  it('flags boolean ta results used in arithmetic', () => {
    const taIdentifier = createIdentifier('ta', 8, 1);
    const crossoverIdentifier = createIdentifier('crossover', 11, 1);
    const callee = createMemberExpression(taIdentifier, crossoverIdentifier, 8, 20, 1);

    const closeIdentifier = createIdentifier('close', 21, 1);
    const closeArgument = createArgument(closeIdentifier, 21, 26, 1);

    const openIdentifier = createIdentifier('open', 28, 1);
    const openArgument = createArgument(openIdentifier, 28, 32, 1);

    const crossoverCall = createCallExpression(callee, [closeArgument, openArgument], 8, 33, 1);
    const boolAssignment = createAssignmentStatement(createIdentifier('cross', 0, 1), crossoverCall, 0, 33, 1);

    const crossReference = createIdentifier('cross', 9, 2);
    const numberLiteral = createNumberLiteral(1, '1', 17, 2);
    const addition = createBinaryExpression('+', crossReference, numberLiteral, 9, 18, 2);
    const arithmeticAssignment = createAssignmentStatement(createIdentifier('result', 0, 2), addition, 0, 18, 2);

    const program = createProgram([boolAssignment, arithmeticAssignment], 0, 33, 1, 2);

    const source = 'cross = ta.crossover(close, open)\nresult = cross + 1';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TAValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-FUNCTION-RETURN-TYPE');
  });

  it('returns no diagnostics when AST mode is disabled', () => {
    const harness = new TAValidatorDisabledHarness();

    const result = harness.validate('ta.sma(close, 14)');

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });
});
