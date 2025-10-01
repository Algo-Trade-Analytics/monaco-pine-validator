import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { FunctionValidator } from '../../modules/function-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createAssignmentStatement,
  createBinaryExpression,
  createBlock,
  createCallExpression,
  createExpressionStatement,
  createFunctionDeclaration,
  createIdentifier,
  createIfStatement,
  createMemberExpression,
  createNumberLiteral,
  createParameter,
  createProgram,
  createReturn,
  createStringLiteral,
} from './fixtures';

class FunctionValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new FunctionValidator());
  }

  protected runCoreValidation(): void {}
}

class DisabledFunctionValidatorHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new FunctionValidator());
  }

  protected runCoreValidation(): void {}
}

describe('FunctionValidator (AST)', () => {
  it('returns no diagnostics when AST execution is disabled', () => {
    const harness = new DisabledFunctionValidatorHarness();
    const result = harness.validate('indicator("Example")');

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.info).toEqual([]);
  });

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

  it('emits PSV6-FUNCTION-RETURN-TYPE when boolean calls participate in arithmetic', () => {
    const taIdentifier = createIdentifier('ta', 9, 1);
    const crossoverIdentifier = createIdentifier('crossover', 12, 1);
    const callee = createMemberExpression(taIdentifier, crossoverIdentifier, 9, 21, 1);

    const closeArgument = createArgument(createIdentifier('close', 22, 1), 22, 27, 1);
    const openArgument = createArgument(createIdentifier('open', 29, 1), 29, 33, 1);
    const crossoverCall = createCallExpression(callee, [closeArgument, openArgument], 9, 34, 1);

    const addition = createBinaryExpression('+', crossoverCall, createNumberLiteral(1, '1', 37, 1), 9, 38, 1);
    const assignment = createAssignmentStatement(createIdentifier('result', 0, 1), addition, 0, 38, 1);

    const program = createProgram([assignment], 0, 38, 1, 1);
    const source = 'result = ta.crossover(close, open) + 1';

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new FunctionValidatorHarness(service);

    const result = harness.validate(source);
    expect(result.errors.map((error) => error.code)).toContain('PSV6-FUNCTION-RETURN-TYPE');
  });

  it('emits PSV6-FUNCTION-RETURN-TYPE when non-string calls concatenate strings', () => {
    const mathIdentifier = createIdentifier('math', 14, 1);
    const sqrtIdentifier = createIdentifier('sqrt', 19, 1);
    const callee = createMemberExpression(mathIdentifier, sqrtIdentifier, 14, 24, 1);

    const priceArgument = createArgument(createIdentifier('price', 25, 1), 25, 30, 1);
    const sqrtCall = createCallExpression(callee, [priceArgument], 14, 31, 1);
    const stringLiteral = createStringLiteral('units', '"units"', 34, 1);

    const addition = createBinaryExpression('+', sqrtCall, stringLiteral, 14, 41, 1);
    const assignment = createAssignmentStatement(createIdentifier('labelText', 0, 1), addition, 0, 41, 1);

    const program = createProgram([assignment], 0, 41, 1, 1);
    const source = 'labelText = math.sqrt(price) + "units"';

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new FunctionValidatorHarness(service);

    const result = harness.validate(source);
    expect(result.errors.map((error) => error.code)).toContain('PSV6-FUNCTION-RETURN-TYPE');
  });

  it('warns when function complexity exceeds the threshold using AST traversal', () => {
    const identifier = createIdentifier('complex', 5, 1);
    const statements = Array.from({ length: 11 }, (_, index) => {
      const line = index + 2;
      const condition = createIdentifier(`cond${index}`, 8, line);
      const consequent = createBlock([], 12, 14, line, line);
      return createIfStatement(condition, consequent, null, 8, 14, line);
    });
    const body = createBlock(statements, 0, 20, 1, 12);
    const fn = createFunctionDeclaration(identifier, [], body, 0, 20, 1, 12);
    const program = createProgram([fn], 0, 20, 1, 12);
    const source = ['func complex() =>', ...Array.from({ length: 11 }, () => '    if cond => 0')].join('\n');

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new FunctionValidatorHarness(service);

    const result = harness.validate(source);
    expect(result.warnings.map((warning) => warning.code)).toContain('PSV6-FUNCTION-STYLE-COMPLEXITY');
  });

  it('detects inconsistent return types with implicit arrow returns', () => {
    const funcIdentifier = createIdentifier('myFunc', 0, 1);
    const condition = createIdentifier('cond', 11, 1);
    const bullishLiteral = createStringLiteral('bullish', '"bullish"', 17, 2);
    const bullishStatement = createExpressionStatement(bullishLiteral, 17, 26, 2);
    const numberLiteral = createNumberLiteral(123, '123', 33, 4);
    const numberStatement = createExpressionStatement(numberLiteral, 33, 36, 4);
    const ifStatement = createIfStatement(condition, bullishStatement, numberStatement, 11, 36, 1);
    const body = createBlock([ifStatement], 0, 36, 1, 4);
    const fn = createFunctionDeclaration(funcIdentifier, [], body, 0, 36, 1, 4);
    const program = createProgram([fn], 0, 36, 1, 4);
    const source = 'myFunc() =>\n    if cond\n        "bullish"\n    else\n        123';

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new FunctionValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-FUNCTION-RETURN-TYPE');
  });

});
