import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { StringFunctionsValidator } from '../../modules/string-functions-validator';
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

class StringFunctionsHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new StringFunctionsValidator());
  }

  protected runCoreValidation(): void {}
}

describe('StringFunctionsValidator (AST)', () => {
  it('flags non-string parameters passed to string helpers', () => {
    const resultIdentifier = createIdentifier('result', 0, 1);
    const strIdentifier = createIdentifier('str', 9, 1);
    const lengthIdentifier = createIdentifier('length', 13, 1);
    const callee = createMemberExpression(strIdentifier, lengthIdentifier, 9, 19, 1);

    const numberLiteral = createNumberLiteral(123, '123', 20, 1);
    const argument = createArgument(numberLiteral, 20, 23, 1);

    const call = createCallExpression(callee, [argument], 9, 24, 1);
    const assignment = createAssignmentStatement(resultIdentifier, call, 0, 24, 1);
    const program = createProgram([assignment], 0, 24, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new StringFunctionsHarness(service);

    const result = harness.validate('result = str.length(123)');
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-FUNCTION-PARAM-TYPE');
  });

  it('validates str.format placeholders against provided arguments', () => {
    const formattedIdentifier = createIdentifier('formatted', 0, 1);
    const strIdentifier = createIdentifier('str', 12, 1);
    const formatIdentifier = createIdentifier('format', 16, 1);
    const callee = createMemberExpression(strIdentifier, formatIdentifier, 12, 22, 1);

    const formatLiteral = createStringLiteral('{0} {1}', '"{0} {1}"', 23, 1);
    const formatArgument = createArgument(formatLiteral, 23, 32, 1);

    const closeIdentifier = createIdentifier('close', 34, 1);
    const closeArgument = createArgument(closeIdentifier, 34, 39, 1);

    const call = createCallExpression(callee, [formatArgument, closeArgument], 12, 40, 1);
    const assignment = createAssignmentStatement(formattedIdentifier, call, 0, 40, 1);
    const program = createProgram([assignment], 0, 40, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new StringFunctionsHarness(service);

    const source = 'formatted = str.format("{0} {1}", close)';
    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-STR-FORMAT-INVALID');
  });

  it('warns when expensive string operations execute inside loops', () => {
    const strIdentifier = createIdentifier('str', 8, 2);
    const replaceIdentifier = createIdentifier('replace', 12, 2);
    const callee = createMemberExpression(strIdentifier, replaceIdentifier, 8, 21, 2);

    const firstLiteral = createStringLiteral('a', '"a"', 22, 2);
    const firstArgument = createArgument(firstLiteral, 22, 25, 2);

    const secondLiteral = createStringLiteral('b', '"b"', 27, 2);
    const secondArgument = createArgument(secondLiteral, 27, 30, 2);

    const thirdLiteral = createStringLiteral('c', '"c"', 32, 2);
    const thirdArgument = createArgument(thirdLiteral, 32, 35, 2);

    const call = createCallExpression(callee, [firstArgument, secondArgument, thirdArgument], 8, 36, 2);
    const statement = createExpressionStatement(call, 8, 36, 2);
    const block = createBlock([statement], 8, 36, 2, 2);

    const loop = createForStatement(null, null, null, block, 0, 36, 1);
    const program = createProgram([loop], 0, 36, 1, 2);

    const source = 'for i = 0 to 1\n    str.replace("a", "b", "c")';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new StringFunctionsHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-STR-PERF-LOOP');
  });

  it('reports string concatenation performance guidance from AST traversal', () => {
    const greetingIdentifier = createIdentifier('greeting', 0, 1);

    const helloLiteral = createStringLiteral('Hello', '"Hello"', 11, 1);
    const nameIdentifier = createIdentifier('name', 20, 1);
    const exclamationLiteral = createStringLiteral('!', '"!"', 27, 1);

    const firstConcat = createBinaryExpression('+', helloLiteral, nameIdentifier, 18, 24, 1);
    const fullConcat = createBinaryExpression('+', firstConcat, exclamationLiteral, 18, 28, 1);

    const assignment = createAssignmentStatement(greetingIdentifier, fullConcat, 0, 28, 1);
    const program = createProgram([assignment], 0, 28, 1, 1);

    const source = 'greeting = "Hello" + name + "!"';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new StringFunctionsHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);
    const infoCodes = result.info.map((info) => info.code);

    expect(warningCodes).toContain('PSV6-STR-PERF-CONCAT');
    expect(infoCodes).toContain('PSV6-STR-FORMAT-SUGGESTION');
  });
});
