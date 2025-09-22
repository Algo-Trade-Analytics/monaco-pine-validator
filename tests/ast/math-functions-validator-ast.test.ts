import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { MathFunctionsValidator } from '../../modules/math-functions-validator';
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

class MathValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new MathFunctionsValidator());
  }

  protected runCoreValidation(): void {}
}

describe('MathFunctionsValidator (AST)', () => {
  it('warns on unknown math members', () => {
    const mathIdentifier = createIdentifier('math', 0, 1);
    const unknownIdentifier = createIdentifier('unknown', 5, 1);
    const callee = createMemberExpression(mathIdentifier, unknownIdentifier, 0, 12, 1);
    const call = createCallExpression(callee, [], 0, 14, 1);
    const statement = createExpressionStatement(call, 0, 14, 1);
    const program = createProgram([statement], 0, 14, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new MathValidatorHarness(service);

    const result = harness.validate('math.unknown()');
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-MATH-FUNCTION-UNKNOWN: Unknown Math function: math.unknown');
  });

  it('reports parameter type mismatches', () => {
    const mathIdentifier = createIdentifier('math', 0, 1);
    const powIdentifier = createIdentifier('pow', 5, 1);
    const callee = createMemberExpression(mathIdentifier, powIdentifier, 0, 8, 1);

    const firstArgumentValue = createStringLiteral('oops', '"oops"', 9, 1);
    const firstArgument = createArgument(firstArgumentValue, 9, 15, 1);

    const secondArgumentValue = createNumberLiteral(2, '2', 17, 1);
    const secondArgument = createArgument(secondArgumentValue, 17, 18, 1);

    const call = createCallExpression(callee, [firstArgument, secondArgument], 0, 19, 1);
    const statement = createExpressionStatement(call, 0, 19, 1);
    const program = createProgram([statement], 0, 19, 1, 1);

    const source = 'math.pow("oops", 2)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new MathValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-MATH-FUNCTION-PARAM');
  });

  it('flags math operations inside loops', () => {
    const mathIdentifier = createIdentifier('math', 4, 2);
    const sumIdentifier = createIdentifier('sum', 9, 2);
    const callee = createMemberExpression(mathIdentifier, sumIdentifier, 4, 12, 2);

    const closeIdentifier = createIdentifier('close', 13, 2);
    const closeArgument = createArgument(closeIdentifier, 13, 18, 2);

    const lengthLiteral = createNumberLiteral(5, '5', 20, 2);
    const lengthArgument = createArgument(lengthLiteral, 20, 21, 2);

    const call = createCallExpression(callee, [closeArgument, lengthArgument], 4, 22, 2);
    const statement = createExpressionStatement(call, 4, 22, 2);
    const block = createBlock([statement], 4, 22, 2, 2);

    const loop = createForStatement(null, null, null, block, 0, 22, 1);
    const program = createProgram([loop], 0, 22, 1, 2);

    const source = 'for i = 0 to 1\n    math.sum(close, 5)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new MathValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-MATH-PERF-LOOP');
  });

  it('warns about complex nested math expressions', () => {
    const mathIdentifier = createIdentifier('math', 0, 1);
    const powIdentifier = createIdentifier('pow', 5, 1);
    const powCallee = createMemberExpression(mathIdentifier, powIdentifier, 0, 8, 1);

    const innerMathIdentifier = createIdentifier('math', 9, 1);
    const sumIdentifier = createIdentifier('sum', 14, 1);
    const sumCallee = createMemberExpression(innerMathIdentifier, sumIdentifier, 9, 17, 1);

    const maxMathIdentifier = createIdentifier('math', 18, 1);
    const maxIdentifier = createIdentifier('max', 23, 1);
    const maxCallee = createMemberExpression(maxMathIdentifier, maxIdentifier, 18, 25, 1);
    const maxLeftArg = createArgument(createIdentifier('close', 26, 1), 26, 31, 1);
    const maxRightArg = createArgument(createIdentifier('close', 33, 1), 33, 38, 1);
    const maxCall = createCallExpression(maxCallee, [maxLeftArg, maxRightArg], 18, 39, 1);

    const minMathIdentifier = createIdentifier('math', 41, 1);
    const minIdentifier = createIdentifier('min', 46, 1);
    const minCallee = createMemberExpression(minMathIdentifier, minIdentifier, 41, 48, 1);
    const minLeftArg = createArgument(createIdentifier('open', 49, 1), 49, 53, 1);
    const minRightArg = createArgument(createIdentifier('open', 55, 1), 55, 59, 1);
    const minCall = createCallExpression(minCallee, [minLeftArg, minRightArg], 41, 60, 1);

    const sumFirstArg = createArgument(maxCall, 18, 39, 1);
    const sumSecondArg = createArgument(minCall, 41, 60, 1);
    const sumCall = createCallExpression(sumCallee, [sumFirstArg, sumSecondArg], 9, 61, 1);

    const sqrtMathIdentifier = createIdentifier('math', 63, 1);
    const sqrtIdentifier = createIdentifier('sqrt', 68, 1);
    const sqrtCallee = createMemberExpression(sqrtMathIdentifier, sqrtIdentifier, 63, 72, 1);
    const sqrtArgument = createArgument(createNumberLiteral(4, '4', 73, 1), 73, 74, 1);
    const sqrtCall = createCallExpression(sqrtCallee, [sqrtArgument], 63, 75, 1);

    const powFirstArgument = createArgument(sumCall, 9, 61, 1);
    const powSecondArgument = createArgument(sqrtCall, 63, 75, 1);
    const powCall = createCallExpression(powCallee, [powFirstArgument, powSecondArgument], 0, 76, 1);
    const statement = createExpressionStatement(powCall, 0, 76, 1);
    const program = createProgram([statement], 0, 76, 1, 1);

    const source = 'math.pow(math.sum(math.max(close, close), math.min(open, open)), math.sqrt(4))';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new MathValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-MATH-COMPLEXITY');
  });
});
