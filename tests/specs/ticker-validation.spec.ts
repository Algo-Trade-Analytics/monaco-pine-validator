import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

const createValidator = () => new EnhancedModularValidator({ targetVersion: 6, strictMode: true });

describe('Ticker Functions - Specialized Edge Cases', () => {
  it('validates ticker.modify with settlement_as_close and adjustments', () => {
    const code = `//@version=6
indicator("Ticker Modify Test")

sym = "NASDAQ:AAPL"
t1 = ticker.modify(sym, session=session.extended, adjustment=adjustment.dividends, backadjustment=backadjustment.inherit, settlement_as_close=settlement_as_close.on)
plot(close)`;

    const result = createValidator().validate(code);
    const infoCodes = result.info.map(i => i.code);
    expect(infoCodes).toContain('PSV6-TICKER-MODIFY');
    expect(infoCodes).toContain('PSV6-TICKER-SETTLEMENT');
  });

  it('validates specialized chart-type ticker constructors', () => {
    const code = `//@version=6
indicator("Ticker Chart Types")

_a = ticker.renko("AAPL", "ATR", 10, request_wicks=true, source="OHLC")
_b = ticker.pointfigure("MSFT", "hl", "PercentageLTP", 2.5, 3)
_c = ticker.kagi("SPY", param=1.5, style="ATR")
plot(close)`;

    const result = createValidator().validate(code);
    const infoCodes = result.info.map(i => i.code);
    expect(infoCodes).toContain('PSV6-TICKER-RENKO');
    expect(infoCodes).toContain('PSV6-TICKER-PNF');
    expect(infoCodes).toContain('PSV6-TICKER-KAGI');
  });

  it('validates advanced inheritance chains', () => {
    const code = `//@version=6
indicator("Ticker Inheritance")

base_ticker = ticker.new("NASDAQ", "AAPL", session.extended)
ha_ticker = ticker.heikinashi(base_ticker)
inherited_ticker = ticker.inherit(ha_ticker, "NASDAQ:MSFT")
complex_ticker = ticker.modify(ticker.heikinashi("NASDAQ:AAPL"), session=session.extended, adjustment=adjustment.splits, backadjustment=backadjustment.off, settlement_as_close=settlement_as_close.inherit)
plot(close)`;

    const result = createValidator().validate(code);
    const infoCodes = result.info.map(i => i.code);
    expect(infoCodes).toContain('PSV6-TICKER-NEW');
    expect(infoCodes).toContain('PSV6-TICKER-HEIKIN');
    expect(infoCodes).toContain('PSV6-TICKER-INHERIT');
    expect(infoCodes).toContain('PSV6-TICKER-MODIFY');
  });

  it('errors on unknown named parameter in ticker.modify', () => {
    const code = `//@version=6
indicator("Ticker Modify Unknown Param")
sym = "AAPL"
_ = ticker.modify(sym, foo=1, settlement_as_close=settlement_as_close.off)`;
    const result = createValidator().validate(code);
    expect(result.errors.some(e => e.code === 'PSV6-TICKER-MODIFY-UNKNOWN-PARAM')).toBe(true);
  });

  it('errors on invalid settlement_as_close value', () => {
    const code = `//@version=6
indicator("Ticker Modify Bad Settlement")
sym = "AAPL"
_ = ticker.modify(sym, settlement_as_close=settlement_as_close.bad)`;
    const result = createValidator().validate(code);
    expect(result.errors.some(e => e.code === 'PSV6-TICKER-SETTLEMENT-VALUE')).toBe(true);
  });

  it('errors on invalid renko parameters', () => {
    const code = `//@version=6
indicator("Ticker Renko Invalid")
_ = ticker.renko("AAPL", "WRONG", na, request_wicks=123, source="CLOSE")`;
    const result = createValidator().validate(code);
    expect(result.errors.some(e => e.code === 'PSV6-TICKER-RENKO-SIZETYPE')).toBe(true);
    expect(result.errors.some(e => e.code === 'PSV6-TICKER-RENKO-SIZE-TYPE')).toBe(true);
    expect(result.errors.some(e => e.code === 'PSV6-TICKER-RENKO-WICKS-TYPE')).toBe(true);
    expect(result.errors.some(e => e.code === 'PSV6-TICKER-RENKO-SOURCE')).toBe(true);
  });

  it('errors on invalid pointfigure parameters', () => {
    const code = `//@version=6
indicator("Ticker PnF Invalid")
_ = ticker.pointfigure("MSFT", "bad", "Other", na, 2.5)`;
    const result = createValidator().validate(code);
    expect(result.errors.some(e => e.code === 'PSV6-TICKER-PNF-SOURCE')).toBe(true);
    expect(result.errors.some(e => e.code === 'PSV6-TICKER-PNF-SIZE-TYPE')).toBe(true);
    expect(result.errors.some(e => e.code === 'PSV6-TICKER-PNF-BOXSIZE')).toBe(true);
    expect(result.errors.some(e => e.code === 'PSV6-TICKER-PNF-REVERSAL-TYPE')).toBe(true);
  });

  it('errors on invalid kagi parameters', () => {
    const code = `//@version=6
indicator("Ticker Kagi Invalid")
_ = ticker.kagi("SPY", param="x", style="foo")`;
    const result = createValidator().validate(code);
    expect(result.errors.some(e => e.code === 'PSV6-TICKER-KAGI-PARAM-TYPE')).toBe(true);
    expect(result.errors.some(e => e.code === 'PSV6-TICKER-KAGI-STYLE')).toBe(true);
  });
});
