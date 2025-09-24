import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { TimeDateFunctionsValidator } from '../../modules/time-date-functions-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createBinaryExpression,
  createBlock,
  createCallExpression,
  createExpressionStatement,
  createIdentifier,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
  createWhileStatement,
} from './fixtures';

class TimeDateValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new TimeDateFunctionsValidator());
  }

  protected runCoreValidation(): void {}
}

class DisabledTimeDateValidatorHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new TimeDateFunctionsValidator());
  }

  protected runCoreValidation(): void {}
}

describe('TimeDateFunctionsValidator (AST)', () => {
  it('returns no diagnostics when AST mode is disabled', () => {
    const harness = new DisabledTimeDateValidatorHarness();
    const result = harness.validate('time_close()');

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });

  it('emits missing parameter diagnostics for time_close', () => {
    const source = 'time_close()';
    const callee = createIdentifier('time_close', source.indexOf('time_close'), 1);
    const call = createCallExpression(callee, [], source.indexOf('time_close'), source.length, 1);
    const statement = createExpressionStatement(call, source.indexOf('time_close'), source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TimeDateValidatorHarness(service);
    const result = harness.validate(source);

    expect(result.errors.map((error) => error.code)).toContain('PSV6-TIME-CLOSE-PARAMS');
  });

  it('warns on invalid timezone member arguments', () => {
    const source = 'time_close("60", session.regular, timezone.unknown)';
    const callee = createIdentifier('time_close', source.indexOf('time_close'), 1);

    const timeframeLiteral = createStringLiteral('60', '"60"', source.indexOf('"60"'), 1);
    const timeframeArgument = createArgument(
      timeframeLiteral,
      source.indexOf('"60"'),
      source.indexOf('"60"') + '"60"'.length,
      1,
    );

    const sessionObject = createIdentifier('session', source.indexOf('session'), 1);
    const sessionProperty = createIdentifier('regular', source.indexOf('regular'), 1);
    const sessionMember = createMemberExpression(
      sessionObject,
      sessionProperty,
      source.indexOf('session'),
      source.indexOf('regular') + 'regular'.length,
      1,
    );
    const sessionArgument = createArgument(
      sessionMember,
      source.indexOf('session'),
      source.indexOf('regular') + 'regular'.length,
      1,
    );

    const timezoneObject = createIdentifier('timezone', source.indexOf('timezone'), 1);
    const timezoneProperty = createIdentifier('unknown', source.indexOf('unknown'), 1);
    const timezoneMember = createMemberExpression(
      timezoneObject,
      timezoneProperty,
      source.indexOf('timezone'),
      source.indexOf('unknown') + 'unknown'.length,
      1,
    );
    const timezoneArgument = createArgument(
      timezoneMember,
      source.indexOf('timezone'),
      source.indexOf('unknown') + 'unknown'.length,
      1,
    );

    const call = createCallExpression(
      callee,
      [timeframeArgument, sessionArgument, timezoneArgument],
      source.indexOf('time_close'),
      source.length,
      1,
    );
    const statement = createExpressionStatement(call, source.indexOf('time_close'), source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TimeDateValidatorHarness(service);
    const result = harness.validate(source);

    expect(result.warnings.map((warning) => warning.code)).toContain('PSV6-TIMEZONE-INVALID');
  });

  it('flags timestamp calls inside loops for performance guidance', () => {
    const source = ['while cond', '    timestamp(2024, 1, 1, 0, 0, 0)'].join('\n');

    const conditionIdentifier = createIdentifier('cond', source.indexOf('cond'), 1);

    const timestampStart = source.indexOf('timestamp');
    const args: ReturnType<typeof createArgument>[] = [];
    const rawArgs = ['2024', '1', '1', '0', '0', '0'];
    let currentIndex = timestampStart + 'timestamp'.length + 1; // position after '('
    for (const raw of rawArgs) {
      const valueIndex = source.indexOf(raw, currentIndex);
      const number = createNumberLiteral(Number(raw), raw, valueIndex, 2);
      args.push(createArgument(number, valueIndex, valueIndex + raw.length, 2));
      currentIndex = valueIndex + raw.length;
    }

    const call = createCallExpression(
      createIdentifier('timestamp', timestampStart, 2),
      args,
      timestampStart,
      source.indexOf(')', timestampStart) + 1,
      2,
    );
    const callStatement = createExpressionStatement(
      call,
      timestampStart,
      source.indexOf(')', timestampStart) + 1,
      2,
    );

    const block = createBlock([callStatement], timestampStart - 4, source.length, 2, 2);
    const whileStatement = createWhileStatement(
      conditionIdentifier,
      block,
      0,
      source.length,
      1,
    );

    const program = createProgram([whileStatement], 0, source.length, 1, 2);
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TimeDateValidatorHarness(service);
    const result = harness.validate(source);

    expect(result.warnings.map((warning) => warning.code)).toContain('PSV6-TIME-PERF-LOOP');
  });

  it('reports direct comparisons of time variables', () => {
    const source = 'hour == 10';
    const left = createIdentifier('hour', source.indexOf('hour'), 1);
    const right = createNumberLiteral(10, '10', source.indexOf('10'), 1);
    const comparison = createBinaryExpression('==', left, right, 0, source.length, 1);
    const statement = createExpressionStatement(comparison, 0, source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TimeDateValidatorHarness(service);
    const result = harness.validate(source);

    expect(result.warnings.map((warning) => warning.code)).toContain('PSV6-TIME-DIRECT-COMPARE');
  });

  it('emits guidance for arithmetic on time variables', () => {
    const source = 'hour + 1';
    const left = createIdentifier('hour', source.indexOf('hour'), 1);
    const right = createNumberLiteral(1, '1', source.indexOf('1'), 1);
    const expression = createBinaryExpression('+', left, right, 0, source.length, 1);
    const statement = createExpressionStatement(expression, 0, source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TimeDateValidatorHarness(service);
    const result = harness.validate(source);

    expect(result.info.map((info) => info.code)).toContain('PSV6-TIME-ARITHMETIC-INFO');
  });
});
