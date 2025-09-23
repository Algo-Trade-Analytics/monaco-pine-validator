import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { FunctionValidator } from '../../modules/function-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createBinaryExpression,
  createBlock,
  createCallExpression,
  createExpressionStatement,
  createFunctionDeclaration,
  createIdentifier,
  createNumberLiteral,
  createParameter,
  createProgram,
  createReturn,
} from './fixtures';

class FunctionValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new FunctionValidator());
  }

  protected runCoreValidation(): void {}
}

describe('FunctionValidator (AST)', () => {
  it('reports unknown functions that are not declared', () => {
    const fooIdentifier = createIdentifier('foo', 0, 1);
    const call = createCallExpression(fooIdentifier, [], 0, 5, 1);
    const statement = createExpressionStatement(call, 0, 5, 1);
    const program = createProgram([statement], 0, 5, 1, 1);
    const source = 'foo()';

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new FunctionValidatorHarness(service);

    const result = harness.validate(source);
    expect(result.errors.map((error) => error.code)).toContain('PSV6-FUNCTION-UNKNOWN');
  });

  it('flags calls with too few arguments for user functions', () => {
    const fooIdentifier = createIdentifier('foo', 5, 1);
    const paramA = createParameter('a', 9, 1);
    const paramB = createParameter('b', 12, 1);
    const aIdentifier = createIdentifier('a', 4, 2);
    const bIdentifier = createIdentifier('b', 8, 2);
    const addition = createBinaryExpression('+', aIdentifier, bIdentifier, 4, 9, 2);
    const returnStatement = createReturn(addition, 4, 9, 2);
    const body = createBlock([returnStatement], 4, 9, 2, 2);
    const functionDeclaration = createFunctionDeclaration(fooIdentifier, [paramA, paramB], body, 0, 17, 1, 2);

    const callIdentifier = createIdentifier('foo', 0, 3);
    const numberLiteral = createNumberLiteral(1, '1', 4, 3);
    const numberArgument = createArgument(numberLiteral, 4, 5, 3);
    const callExpression = createCallExpression(callIdentifier, [numberArgument], 0, 6, 3);
    const callStatement = createExpressionStatement(callExpression, 0, 6, 3);

    const program = createProgram([functionDeclaration, callStatement], 0, 23, 1, 3);
    const source = ['func foo(a, b) =>', '    a + b', 'foo(1)'].join('\n');

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new FunctionValidatorHarness(service);

    const result = harness.validate(source);
    expect(result.errors.map((error) => error.code)).toContain('PSV6-FUNCTION-CALL-PARAM-COUNT');
  });

  it('warns when optional parameters are never supplied by callers', () => {
    const fooIdentifier = createIdentifier('foo', 5, 1);
    const paramA = createParameter('a', 9, 1);
    const paramB = createParameter('b', 12, 1);
    paramB.defaultValue = createNumberLiteral(0, '0', 16, 1);
    const returnIdentifier = createIdentifier('a', 22, 1);
    const returnStatement = createReturn(returnIdentifier, 22, 23, 1);
    const body = createBlock([returnStatement], 22, 23, 1, 1);
    const functionDeclaration = createFunctionDeclaration(fooIdentifier, [paramA, paramB], body, 0, 23, 1, 1);

    const callIdentifier = createIdentifier('foo', 0, 2);
    const numberLiteral = createNumberLiteral(1, '1', 4, 2);
    const numberArgument = createArgument(numberLiteral, 4, 5, 2);
    const callExpression = createCallExpression(callIdentifier, [numberArgument], 0, 6, 2);
    const callStatement = createExpressionStatement(callExpression, 0, 6, 2);

    const program = createProgram([functionDeclaration, callStatement], 0, 6, 1, 2);
    const source = ['func foo(a, b = 0) => a', 'foo(1)'].join('\n');

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new FunctionValidatorHarness(service);

    const result = harness.validate(source);
    expect(result.warnings.map((warning) => warning.code)).toContain('PSU-PARAM');
  });

  it('surfaces namespace errors when builtin helpers are missing their namespace', () => {
    const smaIdentifier = createIdentifier('sma', 0, 1);
    const closeIdentifier = createIdentifier('close', 4, 1);
    const closeArgument = createArgument(closeIdentifier, 4, 9, 1);
    const lengthLiteral = createNumberLiteral(14, '14', 11, 1);
    const lengthArgument = createArgument(lengthLiteral, 11, 13, 1);
    const callExpression = createCallExpression(smaIdentifier, [closeArgument, lengthArgument], 0, 14, 1);
    const statement = createExpressionStatement(callExpression, 0, 14, 1);
    const program = createProgram([statement], 0, 14, 1, 1);
    const source = 'sma(close, 14)';

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new FunctionValidatorHarness(service);

    const result = harness.validate(source);
    expect(result.errors.map((error) => error.code)).toContain('PSV6-FUNCTION-NAMESPACE');
  });
});
