import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { InputFunctionsValidator } from '../../modules/input-functions-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createAssignmentStatement,
  createCallExpression,
  createExpressionStatement,
  createIdentifier,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
} from './fixtures';

class InputValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new InputFunctionsValidator());
  }

  protected runCoreValidation(): void {}
}

describe('InputFunctionsValidator (AST)', () => {
  it('reports unknown input members', () => {
    const source = 'input.unknown()';
    const inputIdentifier = createIdentifier('input', source.indexOf('input'), 1);
    const unknownIdentifier = createIdentifier('unknown', source.indexOf('unknown'), 1);
    const callee = createMemberExpression(inputIdentifier, unknownIdentifier, source.indexOf('input'), source.indexOf('unknown') + 'unknown'.length, 1);
    const call = createCallExpression(callee, [], 0, source.length, 1);
    const statement = createExpressionStatement(call, 0, source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new InputValidatorHarness(service);

    const result = harness.validate(source);
    const codes = result.errors.map((error) => error.code);

    expect(codes).toContain('PSV6-INPUT-UNKNOWN-FUNCTION');
  });

  it('validates parameter counts for positional arguments', () => {
    const source = 'input.float(5)';
    const inputIdentifier = createIdentifier('input', source.indexOf('input'), 1);
    const floatIdentifier = createIdentifier('float', source.indexOf('float'), 1);
    const callee = createMemberExpression(inputIdentifier, floatIdentifier, source.indexOf('input'), source.indexOf('float') + 'float'.length, 1);

    const numberStart = source.indexOf('5');
    const numberLiteral = createNumberLiteral(5, '5', numberStart, 1);
    const argument = createArgument(numberLiteral, numberStart, numberStart + 1, 1);

    const call = createCallExpression(callee, [argument], 0, source.length, 1);
    const statement = createExpressionStatement(call, 0, source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new InputValidatorHarness(service);

    const result = harness.validate(source);
    const codes = result.errors.map((error) => error.code);

    expect(codes).toContain('PSV6-FUNCTION-PARAM-COUNT');
  });

  it('flags invalid boolean defaults', () => {
    const source = 'input.bool("yes", "Title")';
    const inputIdentifier = createIdentifier('input', source.indexOf('input'), 1);
    const boolIdentifier = createIdentifier('bool', source.indexOf('bool'), 1);
    const callee = createMemberExpression(inputIdentifier, boolIdentifier, source.indexOf('input'), source.indexOf('bool') + 'bool'.length, 1);

    const yesStart = source.indexOf('"yes"');
    const yesLiteral = createStringLiteral('yes', '"yes"', yesStart, 1);
    const yesArgument = createArgument(yesLiteral, yesStart, yesStart + '"yes"'.length, 1);

    const titleStart = source.indexOf('"Title"');
    const titleLiteral = createStringLiteral('Title', '"Title"', titleStart, 1);
    const titleArgument = createArgument(titleLiteral, titleStart, titleStart + '"Title"'.length, 1);

    const call = createCallExpression(callee, [yesArgument, titleArgument], 0, source.length, 1);
    const statement = createExpressionStatement(call, 0, source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new InputValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(errorCodes).toContain('PSV6-FUNCTION-PARAM-TYPE');
    expect(warningCodes).toContain('PSV6-INPUT-DEFAULT-TYPE');
  });

  it('suggests descriptive variable names for poor assignments', () => {
    const source = 'a = input.int(1, "Length")';
    const inputIdentifier = createIdentifier('input', source.indexOf('input'), 1);
    const intIdentifier = createIdentifier('int', source.indexOf('int'), 1);
    const callee = createMemberExpression(inputIdentifier, intIdentifier, source.indexOf('input'), source.indexOf('int') + 'int'.length, 1);

    const oneStart = source.indexOf('1');
    const oneLiteral = createNumberLiteral(1, '1', oneStart, 1);
    const oneArgument = createArgument(oneLiteral, oneStart, oneStart + 1, 1);

    const lengthStart = source.indexOf('"Length"');
    const lengthLiteral = createStringLiteral('Length', '"Length"', lengthStart, 1);
    const lengthArgument = createArgument(lengthLiteral, lengthStart, lengthStart + '"Length"'.length, 1);

    const call = createCallExpression(callee, [oneArgument, lengthArgument], source.indexOf('input'), source.length, 1);
    const assignment = createAssignmentStatement(createIdentifier('a', source.indexOf('a'), 1), call, 0, source.length, 1);
    const program = createProgram([assignment], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new InputValidatorHarness(service);

    const result = harness.validate(source);
    const infoCodes = result.info.map((info) => info.code);

    expect(infoCodes).toContain('PSV6-INPUT-NAMING-SUGGESTION');
  });

  it('warns about complex default expressions', () => {
    const source = 'length = input.int(ta.sma(close, 14), "Length")';
    const inputIdentifier = createIdentifier('input', source.indexOf('input'), 1);
    const intIdentifier = createIdentifier('int', source.indexOf('int'), 1);
    const inputCallee = createMemberExpression(inputIdentifier, intIdentifier, source.indexOf('input'), source.indexOf('int') + 'int'.length, 1);

    const taIdentifier = createIdentifier('ta', source.indexOf('ta'), 1);
    const smaIdentifier = createIdentifier('sma', source.indexOf('sma'), 1);
    const taCallee = createMemberExpression(taIdentifier, smaIdentifier, source.indexOf('ta'), source.indexOf('sma') + 'sma'.length, 1);

    const closeStart = source.indexOf('close');
    const closeIdentifier = createIdentifier('close', closeStart, 1);
    const closeArgument = createArgument(closeIdentifier, closeStart, closeStart + 'close'.length, 1);

    const fourteenStart = source.indexOf('14');
    const fourteenLiteral = createNumberLiteral(14, '14', fourteenStart, 1);
    const fourteenArgument = createArgument(fourteenLiteral, fourteenStart, fourteenStart + '14'.length, 1);

    const taCall = createCallExpression(taCallee, [closeArgument, fourteenArgument], source.indexOf('ta'), source.indexOf(')') + 1, 1);
    const taArgument = createArgument(taCall, source.indexOf('ta'), source.indexOf(')') + 1, 1);

    const lengthStart = source.lastIndexOf('"Length"');
    const lengthLiteral = createStringLiteral('Length', '"Length"', lengthStart, 1);
    const lengthArgument = createArgument(lengthLiteral, lengthStart, lengthStart + '"Length"'.length, 1);

    const call = createCallExpression(inputCallee, [taArgument, lengthArgument], source.indexOf('input'), source.length, 1);
    const assignment = createAssignmentStatement(createIdentifier('length', source.indexOf('length'), 1), call, 0, source.length, 1);
    const program = createProgram([assignment], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new InputValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-INPUT-COMPLEX-EXPRESSION');
  });
});
