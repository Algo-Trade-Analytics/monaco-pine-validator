import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { DynamicDataValidator } from '../../modules/dynamic-data-validator';
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
  createIndexExpression,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
  createVariableDeclaration,
} from './fixtures';

class DynamicDataValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new DynamicDataValidator());
  }

  protected runCoreValidation(): void {}
}

class DisabledDynamicDataValidatorHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new DynamicDataValidator());
  }

  protected runCoreValidation(): void {}
}

describe('DynamicDataValidator (AST)', () => {
  it('returns no diagnostics when AST mode is disabled', () => {
    const harness = new DisabledDynamicDataValidatorHarness();
    const result = harness.validate('request.security("AAPL", "D", close)');

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });

  it('reports unknown request members', () => {
    const source = 'request.unknown()';
    const requestIdentifier = createIdentifier('request', 0, 1);
    const memberIdentifier = createIdentifier('unknown', 8, 1);
    const callee = createMemberExpression(requestIdentifier, memberIdentifier, 0, source.length - 2, 1);
    const call = createCallExpression(callee, [], 0, source.length, 1);
    const statement = createExpressionStatement(call, 0, source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new DynamicDataValidatorHarness(service);

    const result = harness.validate(source);
    expect(result.errors.map((error) => error.code)).toContain('PSV6-REQUEST-UNKNOWN');
  });

  it('warns about dynamic symbol and timeframe parameters for request.security', () => {
    const source = 'request.security(symbol, timeframe, close)';
    const requestIdentifier = createIdentifier('request', 0, 1);
    const securityIdentifier = createIdentifier('security', 8, 1);
    const callee = createMemberExpression(requestIdentifier, securityIdentifier, 0, 16, 1);

    const symbolIdentifier = createIdentifier('symbol', source.indexOf('symbol'), 1);
    const timeframeIdentifier = createIdentifier('timeframe', source.indexOf('timeframe'), 1);
    const closeIdentifier = createIdentifier('close', source.indexOf('close'), 1);

    const symbolArgument = createArgument(symbolIdentifier, source.indexOf('symbol'), source.indexOf('symbol') + 'symbol'.length, 1);
    const timeframeArgument = createArgument(
      timeframeIdentifier,
      source.indexOf('timeframe'),
      source.indexOf('timeframe') + 'timeframe'.length,
      1,
    );
    const closeArgument = createArgument(closeIdentifier, source.indexOf('close'), source.length - 1, 1);

    const call = createCallExpression(callee, [symbolArgument, timeframeArgument, closeArgument], 0, source.length, 1);
    const statement = createExpressionStatement(call, 0, source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new DynamicDataValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);
    const infoCodes = result.info.map((info) => info.code);

    expect(warningCodes).toEqual(
      expect.arrayContaining(['PSV6-REQUEST-DYNAMIC-SYMBOL', 'PSV6-REQUEST-DYNAMIC-TIMEFRAME'])
    );
    expect(infoCodes).toContain('PSV6-REQUEST-DYNAMIC-V6');
  });

  it('emits loop performance warnings for request calls', () => {
    const requestIdentifier = createIdentifier('request', 12, 2);
    const securityIdentifier = createIdentifier('security', 20, 2);
    const callee = createMemberExpression(requestIdentifier, securityIdentifier, 12, 28, 2);

    const symbolLiteral = createStringLiteral('AAPL', '"AAPL"', 29, 2);
    const timeframeLiteral = createStringLiteral('D', '"D"', 36, 2);
    const closeIdentifier = createIdentifier('close', 41, 2);

    const args = [
      createArgument(symbolLiteral, 29, 35, 2),
      createArgument(timeframeLiteral, 36, 39, 2),
      createArgument(closeIdentifier, 41, 46, 2),
    ];
    const requestCall = createCallExpression(callee, args, 12, 47, 2);
    const requestStatement = createExpressionStatement(requestCall, 12, 47, 2);

    const initializer = createVariableDeclaration(createIdentifier('i', 5, 2), 5, 10, 2, {
      initializer: createNumberLiteral(0, '0', 9, 2),
    });
    const testExpression = createNumberLiteral(10, '10', 14, 2);
    const updateExpression = createIdentifier('i', 18, 2);
    const loopBody = createBlock([requestStatement], 8, 47, 2, 2);
    const loop = createForStatement(initializer, testExpression, updateExpression, loopBody, 0, 47, 2);
    const program = createProgram([loop], 0, 47, 1, 2);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new DynamicDataValidatorHarness(service);

    const result = harness.validate('for i = 0 to 10\n    request.security("AAPL", "D", close)');
    const warningCodes = result.warnings.map((warning) => warning.code);
    const infoCodes = result.info.map((info) => info.code);

    expect(warningCodes).toContain('PSV6-REQUEST-PERF-LOOP');
    expect(infoCodes).toContain('PSV6-REQUEST-DYNAMIC-V6');
  });

  it('flags dynamic request usage inside conditionals', () => {
    const requestIdentifier = createIdentifier('request', 8, 2);
    const securityIdentifier = createIdentifier('security', 16, 2);
    const callee = createMemberExpression(requestIdentifier, securityIdentifier, 8, 24, 2);

    const symbolLiteral = createStringLiteral('AAPL', '"AAPL"', 25, 2);
    const timeframeLiteral = createStringLiteral('D', '"D"', 32, 2);
    const seriesIdentifier = createIdentifier('close', 37, 2);
    const indexExpression = createIndexExpression(seriesIdentifier, createNumberLiteral(1, '1', 43, 2), 37, 44, 2);

    const args = [
      createArgument(symbolLiteral, 25, 31, 2),
      createArgument(timeframeLiteral, 32, 35, 2),
      createArgument(indexExpression, 37, 44, 2),
    ];
    const requestCall = createCallExpression(callee, args, 8, 45, 2);
    const requestStatement = createExpressionStatement(requestCall, 8, 45, 2);

    const test = createBooleanLiteral(true, 3, 2);
    const block = createBlock([requestStatement], 8, 45, 2, 2);
    const ifStatement = createIfStatement(test, block, null, 0, 45, 2);
    const program = createProgram([ifStatement], 0, 45, 1, 2);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new DynamicDataValidatorHarness(service);

    const result = harness.validate('if true\n    request.security("AAPL", "D", close[1])');
    const warningCodes = result.warnings.map((warning) => warning.code);
    const infoCodes = result.info.map((info) => info.code);

    expect(warningCodes).toContain('PSV6-REQUEST-DYNAMIC-CONDITIONAL');
    expect(infoCodes).toContain('PSV6-REQUEST-DYNAMIC-V6');
  });

  it('validates financial identifiers and period arguments', () => {
    const requestIdentifier = createIdentifier('request', 0, 1);
    const financialIdentifier = createIdentifier('financial', 8, 1);
    const callee = createMemberExpression(requestIdentifier, financialIdentifier, 0, 17, 1);

    const symbolLiteral = createStringLiteral('AAPL', '"AAPL"', 18, 1);
    const idLiteral = createStringLiteral('BAD', '"BAD"', 25, 1);
    const periodLiteral = createStringLiteral('XYZ', '"XYZ"', 32, 1);

    const args = [
      createArgument(symbolLiteral, 18, 24, 1),
      createArgument(idLiteral, 25, 30, 1),
      createArgument(periodLiteral, 32, 37, 1),
    ];
    const call = createCallExpression(callee, args, 0, 38, 1);
    const statement = createExpressionStatement(call, 0, 38, 1);
    const program = createProgram([statement], 0, 38, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new DynamicDataValidatorHarness(service);

    const result = harness.validate('request.financial("AAPL", "BAD", "XYZ")');
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toEqual(
      expect.arrayContaining(['PSV6-REQUEST-FINANCIAL-ID', 'PSV6-REQUEST-FINANCIAL-PERIOD'])
    );
  });

  it('errors when request.seed lacks an expression', () => {
    const requestIdentifier = createIdentifier('request', 0, 1);
    const seedIdentifier = createIdentifier('seed', 8, 1);
    const callee = createMemberExpression(requestIdentifier, seedIdentifier, 0, 12, 1);

    const sourceLiteral = createStringLiteral('repo', '"repo"', 13, 1);
    const fileLiteral = createStringLiteral('file', '"file"', 20, 1);
    const naIdentifier = createIdentifier('na', 27, 1);

    const args = [
      createArgument(sourceLiteral, 13, 19, 1),
      createArgument(fileLiteral, 20, 26, 1),
      createArgument(naIdentifier, 27, 29, 1),
    ];
    const call = createCallExpression(callee, args, 0, 30, 1);
    const statement = createExpressionStatement(call, 0, 30, 1);
    const program = createProgram([statement], 0, 30, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new DynamicDataValidatorHarness(service);

    const result = harness.validate('request.seed("repo", "file", na)');
    expect(result.errors.map((error) => error.code)).toContain('PSV6-REQUEST-SEED-EXPRESSION');
  });
});
