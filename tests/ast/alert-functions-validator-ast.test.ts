import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { AlertFunctionsValidator } from '../../modules/alert-functions-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createBlock,
  createBooleanLiteral,
  createCallExpression,
  createExpressionStatement,
  createForStatement,
  createIdentifier,
  createIfStatement,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
  createVariableDeclaration,
} from './fixtures';

class AlertValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new AlertFunctionsValidator());
  }

  protected runCoreValidation(): void {}
}

describe('AlertFunctionsValidator (AST)', () => {
  it('reports empty alert messages and valid frequency usage', () => {
    const alertIdentifier = createIdentifier('alert', 0, 1);
    const message = createStringLiteral('', '""', 6, 1);
    const freqObject = createIdentifier('alert', 10, 1);
    const freqProperty = createIdentifier('freq_once_per_bar', 16, 1);
    const freqMember = createMemberExpression(freqObject, freqProperty, 10, 34, 1);
    const messageArgument = createArgument(message, 6, 8, 1);
    const freqArgument = createArgument(freqMember, 10, 34, 1);
    const call = createCallExpression(alertIdentifier, [messageArgument, freqArgument], 0, 35, 1);
    const statement = createExpressionStatement(call, 0, 35, 1);
    const program = createProgram([statement], 0, 35, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new AlertValidatorHarness(service);

    const result = harness.validate('alert("", alert.freq_once_per_bar)');

    const warningCodes = result.warnings.map((warning) => warning.code);
    const infoCodes = result.info.map((info) => info.code);

    expect(warningCodes).toContain('PSV6-ALERT-EMPTY-MESSAGE');
    expect(infoCodes).toEqual(expect.arrayContaining(['PSV6-ALERT-FREQ-VALID', 'PSV6-ALERT-FREQ-USAGE']));
  });

  it('flags invalid alert frequencies', () => {
    const alertIdentifier = createIdentifier('alert', 0, 1);
    const message = createStringLiteral('msg', '"msg"', 6, 1);
    const freqObject = createIdentifier('alert', 12, 1);
    const freqProperty = createIdentifier('freq_unknown', 18, 1);
    const freqMember = createMemberExpression(freqObject, freqProperty, 12, 26, 1);
    const messageArgument = createArgument(message, 6, 11, 1);
    const freqArgument = createArgument(freqMember, 12, 26, 1);
    const call = createCallExpression(alertIdentifier, [messageArgument, freqArgument], 0, 27, 1);
    const statement = createExpressionStatement(call, 0, 27, 1);
    const program = createProgram([statement], 0, 27, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new AlertValidatorHarness(service);

    const result = harness.validate('alert("msg", alert.freq_unknown)');
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-ALERT-FREQ-INVALID');
  });

  it('emits alert condition warnings for simple conditions and empty titles', () => {
    const alertConditionIdentifier = createIdentifier('alertcondition', 0, 1);
    const condition = createBooleanLiteral(true, 16, 1);
    const title = createStringLiteral('', '""', 22, 1);
    const conditionArgument = createArgument(condition, 16, 20, 1);
    const titleArgument = createArgument(title, 22, 24, 1);
    const call = createCallExpression(alertConditionIdentifier, [conditionArgument, titleArgument], 0, 25, 1);
    const statement = createExpressionStatement(call, 0, 25, 1);
    const program = createProgram([statement], 0, 25, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new AlertValidatorHarness(service);

    const result = harness.validate('alertcondition(true, "")');
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toEqual(
      expect.arrayContaining(['PSV6-ALERTCONDITION-SIMPLE', 'PSV6-ALERTCONDITION-NO-TITLE']),
    );
  });

  it('detects alerts inside conditionals and loops', () => {
    const alertIdentifier = createIdentifier('alert', 8, 2);
    const message = createStringLiteral('hit', '"hit"', 14, 2);
    const alertArgument = createArgument(message, 14, 19, 2);
    const alertCall = createCallExpression(alertIdentifier, [alertArgument], 8, 20, 2);
    const alertStatement = createExpressionStatement(alertCall, 8, 20, 2);

    const ifBlock = createBlock([alertStatement], 8, 20, 2, 2);
    const ifTest = createIdentifier('trigger', 3, 2);
    const ifStatement = createIfStatement(ifTest, ifBlock, null, 0, 20, 2);

    const loopInitializerIdentifier = createIdentifier('i', 5, 3);
    const loopInitializer = createVariableDeclaration(
      loopInitializerIdentifier,
      0,
      5,
      3,
      { initializer: createNumberLiteral(0, '0', 8, 3) },
    );
    const loopTest = createNumberLiteral(1, '1', 8, 3);
    const loopUpdate = createIdentifier('update', 12, 3);

    const loopAlertIdentifier = createIdentifier('alert', 4, 4);
    const loopMessage = createStringLiteral('hit', '"hit"', 10, 4);
    const loopArgument = createArgument(loopMessage, 10, 15, 4);
    const loopCall = createCallExpression(loopAlertIdentifier, [loopArgument], 4, 16, 4);
    const loopStatement = createExpressionStatement(loopCall, 4, 16, 4);

    const loopBody = createBlock([loopStatement], 4, 16, 4, 4);
    const forStatement = createForStatement(loopInitializer, loopTest, loopUpdate, loopBody, 0, 20, 3);

    const program = createProgram([ifStatement, forStatement], 0, 40, 1, 4);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new AlertValidatorHarness(service);

    const result = harness.validate('if trigger\n    alert("hit")\nfor i = 0 to 1\n    alert("hit")');
    const warningCodes = result.warnings.map((warning) => warning.code);
    const infoCodes = result.info.map((info) => info.code);

    expect(infoCodes).toContain('PSV6-ALERT-CONDITIONAL-TIMING');
    expect(warningCodes).toContain('PSV6-ALERT-IN-LOOP');
  });
});
