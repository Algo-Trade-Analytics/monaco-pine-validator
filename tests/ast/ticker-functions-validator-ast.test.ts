import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { TickerFunctionsValidator } from '../../modules/ticker-functions-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createCallExpression,
  createExpressionStatement,
  createIdentifier,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
} from './fixtures';

class TickerValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new TickerFunctionsValidator());
  }

  protected runCoreValidation(): void {}
}

class DisabledTickerValidatorHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new TickerFunctionsValidator());
  }

  protected runCoreValidation(): void {}
}

describe('TickerFunctionsValidator (AST)', () => {
  it('returns no diagnostics when AST mode is disabled', () => {
    const harness = new DisabledTickerValidatorHarness();
    const result = harness.validate('ticker.modify(symbol, adjustment=adjustment.dividends)');

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });

  it('flags unknown named parameters for ticker.modify calls', () => {
    const source = 'ticker.modify(symbol, weird=weird)';
    const tickerIdentifier = createIdentifier('ticker', source.indexOf('ticker'), 1);
    const modifyIdentifier = createIdentifier('modify', source.indexOf('modify'), 1);
    const callee = createMemberExpression(
      tickerIdentifier,
      modifyIdentifier,
      source.indexOf('ticker'),
      source.indexOf('modify') + 'modify'.length,
      1,
    );

    const symbolIdentifier = createIdentifier('symbol', source.indexOf('symbol'), 1);
    const symbolArgument = createArgument(
      symbolIdentifier,
      source.indexOf('symbol'),
      source.indexOf('symbol') + 'symbol'.length,
      1,
    );

    const weirdValue = createIdentifier('weird', source.lastIndexOf('weird'), 1);
    const weirdArgument = createArgument(
      weirdValue,
      source.indexOf('weird'),
      source.indexOf(')'),
      1,
      'weird',
    );

    const call = createCallExpression(
      callee,
      [symbolArgument, weirdArgument],
      source.indexOf('ticker'),
      source.indexOf(')') + 1,
      1,
    );
    const statement = createExpressionStatement(call, source.indexOf('ticker'), source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TickerValidatorHarness(service);

    const result = harness.validate(source);
    const codes = result.errors.map((error) => error.code);

    expect(codes).toContain('PSV6-TICKER-MODIFY-UNKNOWN-PARAM');
  });

  it('validates settlement_as_close values in ticker.modify', () => {
    const source = 'ticker.modify(symbol, settlement_as_close=wrong.value)';
    const tickerIdentifier = createIdentifier('ticker', source.indexOf('ticker'), 1);
    const modifyIdentifier = createIdentifier('modify', source.indexOf('modify'), 1);
    const callee = createMemberExpression(
      tickerIdentifier,
      modifyIdentifier,
      source.indexOf('ticker'),
      source.indexOf('modify') + 'modify'.length,
      1,
    );

    const symbolIdentifier = createIdentifier('symbol', source.indexOf('symbol'), 1);
    const symbolArgument = createArgument(
      symbolIdentifier,
      source.indexOf('symbol'),
      source.indexOf('symbol') + 'symbol'.length,
      1,
    );

    const wrongObject = createIdentifier('wrong', source.indexOf('wrong'), 1);
    const valueProperty = createIdentifier('value', source.indexOf('value'), 1);
    const wrongValue = createMemberExpression(
      wrongObject,
      valueProperty,
      source.indexOf('wrong'),
      source.indexOf('value') + 'value'.length,
      1,
    );
    const settlementArgument = createArgument(
      wrongValue,
      source.indexOf('settlement_as_close'),
      source.indexOf('value') + 'value'.length,
      1,
      'settlement_as_close',
    );

    const call = createCallExpression(
      callee,
      [symbolArgument, settlementArgument],
      source.indexOf('ticker'),
      source.length,
      1,
    );
    const statement = createExpressionStatement(call, source.indexOf('ticker'), source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TickerValidatorHarness(service);

    const result = harness.validate(source);
    const codes = result.errors.map((error) => error.code);

    expect(codes).toContain('PSV6-TICKER-SETTLEMENT-VALUE');
  });

  it('validates renko named parameters and positional arguments', () => {
    const source = 'ticker.renko(symbol, "oops", foo, request_wicks=1, source="HLC")';
    const tickerIdentifier = createIdentifier('ticker', source.indexOf('ticker'), 1);
    const renkoIdentifier = createIdentifier('renko', source.indexOf('renko'), 1);
    const callee = createMemberExpression(
      tickerIdentifier,
      renkoIdentifier,
      source.indexOf('ticker'),
      source.indexOf('renko') + 'renko'.length,
      1,
    );

    const symbolIdentifier = createIdentifier('symbol', source.indexOf('symbol'), 1);
    const symbolArgument = createArgument(
      symbolIdentifier,
      source.indexOf('symbol'),
      source.indexOf('symbol') + 'symbol'.length,
      1,
    );

    const sizeType = createStringLiteral('oops', '"oops"', source.indexOf('"oops"'), 1);
    const sizeTypeArgument = createArgument(
      sizeType,
      source.indexOf('"oops"'),
      source.indexOf('"oops"') + '"oops"'.length,
      1,
    );

    const fooIdentifier = createIdentifier('foo', source.indexOf('foo'), 1);
    const sizeArgument = createArgument(
      fooIdentifier,
      source.indexOf('foo'),
      source.indexOf('foo') + 'foo'.length,
      1,
    );

    const requestValue = createNumberLiteral(1, '1', source.indexOf('1'), 1);
    const requestArgument = createArgument(
      requestValue,
      source.indexOf('request_wicks'),
      source.indexOf('1') + 1,
      1,
      'request_wicks',
    );

    const sourceString = createStringLiteral('HLC', '"HLC"', source.indexOf('"HLC"'), 1);
    const sourceArgument = createArgument(
      sourceString,
      source.indexOf('source'),
      source.indexOf('"HLC"') + '"HLC"'.length,
      1,
      'source',
    );

    const call = createCallExpression(
      callee,
      [symbolArgument, sizeTypeArgument, sizeArgument, requestArgument, sourceArgument],
      source.indexOf('ticker'),
      source.length,
      1,
    );
    const statement = createExpressionStatement(call, source.indexOf('ticker'), source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TickerValidatorHarness(service);

    const result = harness.validate(source);
    const codes = result.errors.map((error) => error.code);

    expect(codes).toContain('PSV6-TICKER-RENKO-SIZETYPE');
    expect(codes).toContain('PSV6-TICKER-RENKO-WICKS-TYPE');
    expect(codes).toContain('PSV6-TICKER-RENKO-SOURCE');
  });

  it('validates pointfigure reversal argument', () => {
    const source = 'ticker.pointfigure(symbol, "hl", "PercentageLTP", 5, 1.5)';
    const tickerIdentifier = createIdentifier('ticker', source.indexOf('ticker'), 1);
    const pointFigureIdentifier = createIdentifier('pointfigure', source.indexOf('pointfigure'), 1);
    const callee = createMemberExpression(
      tickerIdentifier,
      pointFigureIdentifier,
      source.indexOf('ticker'),
      source.indexOf('pointfigure') + 'pointfigure'.length,
      1,
    );

    const symbolIdentifier = createIdentifier('symbol', source.indexOf('symbol'), 1);
    const symbolArgument = createArgument(
      symbolIdentifier,
      source.indexOf('symbol'),
      source.indexOf('symbol') + 'symbol'.length,
      1,
    );

    const hlLiteral = createStringLiteral('hl', '"hl"', source.indexOf('"hl"'), 1);
    const hlArgument = createArgument(
      hlLiteral,
      source.indexOf('"hl"'),
      source.indexOf('"hl"') + '"hl"'.length,
      1,
    );

    const sizeTypeLiteral = createStringLiteral(
      'PercentageLTP',
      '"PercentageLTP"',
      source.indexOf('"PercentageLTP"'),
      1,
    );
    const sizeTypeArgument = createArgument(
      sizeTypeLiteral,
      source.indexOf('"PercentageLTP"'),
      source.indexOf('"PercentageLTP"') + '"PercentageLTP"'.length,
      1,
    );

    const boxLiteral = createNumberLiteral(5, '5', source.indexOf(' 5') + 1, 1);
    const boxArgument = createArgument(
      boxLiteral,
      source.indexOf(' 5') + 1,
      source.indexOf(' 5') + 2,
      1,
    );

    const reversalLiteral = createNumberLiteral(1.5, '1.5', source.indexOf('1.5'), 1);
    const reversalArgument = createArgument(
      reversalLiteral,
      source.indexOf('1.5'),
      source.indexOf('1.5') + '1.5'.length,
      1,
    );

    const call = createCallExpression(
      callee,
      [symbolArgument, hlArgument, sizeTypeArgument, boxArgument, reversalArgument],
      source.indexOf('ticker'),
      source.length,
      1,
    );
    const statement = createExpressionStatement(call, source.indexOf('ticker'), source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TickerValidatorHarness(service);

    const result = harness.validate(source);
    const codes = result.errors.map((error) => error.code);

    expect(codes).toContain('PSV6-TICKER-PNF-REVERSAL-TYPE');
  });

  it('validates kagi param and style arguments', () => {
    const source = 'ticker.kagi(symbol, param=foo, style="SMA")';
    const tickerIdentifier = createIdentifier('ticker', source.indexOf('ticker'), 1);
    const kagiIdentifier = createIdentifier('kagi', source.indexOf('kagi'), 1);
    const callee = createMemberExpression(
      tickerIdentifier,
      kagiIdentifier,
      source.indexOf('ticker'),
      source.indexOf('kagi') + 'kagi'.length,
      1,
    );

    const symbolIdentifier = createIdentifier('symbol', source.indexOf('symbol'), 1);
    const symbolArgument = createArgument(
      symbolIdentifier,
      source.indexOf('symbol'),
      source.indexOf('symbol') + 'symbol'.length,
      1,
    );

    const fooIdentifier = createIdentifier('foo', source.indexOf('foo'), 1);
    const paramArgument = createArgument(
      fooIdentifier,
      source.indexOf('param'),
      source.indexOf('foo') + 'foo'.length,
      1,
      'param',
    );

    const styleLiteral = createStringLiteral('SMA', '"SMA"', source.indexOf('"SMA"'), 1);
    const styleArgument = createArgument(
      styleLiteral,
      source.indexOf('style'),
      source.indexOf('"SMA"') + '"SMA"'.length,
      1,
      'style',
    );

    const call = createCallExpression(
      callee,
      [symbolArgument, paramArgument, styleArgument],
      source.indexOf('ticker'),
      source.length,
      1,
    );
    const statement = createExpressionStatement(call, source.indexOf('ticker'), source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TickerValidatorHarness(service);

    const result = harness.validate(source);
    const codes = result.errors.map((error) => error.code);

    expect(codes).toContain('PSV6-TICKER-KAGI-PARAM-TYPE');
    expect(codes).toContain('PSV6-TICKER-KAGI-STYLE');
  });
});
