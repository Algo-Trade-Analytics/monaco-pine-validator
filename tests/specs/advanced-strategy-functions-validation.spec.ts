import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { expectHas } from './test-utils';

const createValidator = () => new EnhancedModularValidator({
  targetVersion: 6,
  scriptType: 'strategy',
  strictMode: true,
  enablePerformanceAnalysis: true,
});

describe('Advanced Strategy Functions Validation', () => {
  describe('Strategy quantity constants', () => {
    it('accepts strategy.percent_of_equity in declaration', () => {
      const code = `//@version=6
strategy("Percent of Equity Test", default_qty_type=strategy.percent_of_equity, default_qty_value=10)

strategy.entry("Long", strategy.long)

plot(close)`;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects calling strategy.percent_of_equity as a function', () => {
      const code = `//@version=6
strategy("Percent of Equity Error Test")

qty = strategy.percent_of_equity(10.0)
strategy.entry("Long", strategy.long, qty=qty)`;
      const result = createValidator().validate(code);
      expectHas(result, { errors: ['PSV6-STRATEGY-CONSTANT-AS-FUNCTION'] });
    });

    it('accepts strategy.fixed in declaration', () => {
      const code = `//@version=6
strategy("Fixed Test", default_qty_type=strategy.fixed, default_qty_value=1)

strategy.entry("Long", strategy.long)

plot(close)`;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('accepts strategy.cash in declaration', () => {
      const code = `//@version=6
strategy("Cash Test", default_qty_type=strategy.cash, default_qty_value=1000)

strategy.entry("Long", strategy.long)

plot(close)`;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Strategy risk management helpers', () => {
    it('accepts strategy.risk.allow_entry_in', () => {
      const code = `//@version=6
strategy("Risk Allow Entry Test")

strategy.risk.allow_entry_in(strategy.long)
strategy.entry("Long", strategy.long)`;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-STRATEGY-RISK-MANAGEMENT'] });
    });

    it('flags missing parameters for strategy.risk.allow_entry_in', () => {
      const code = `//@version=6
strategy("Risk Allow Entry Error Test")

strategy.risk.allow_entry_in()`;
      const result = createValidator().validate(code);
      expectHas(result, { errors: ['PSV6-STRATEGY-ALLOW-ENTRY-PARAMS'] });
    });

    it('accepts strategy.risk.max_position_size', () => {
      const code = `//@version=6
strategy("Max Position Size Test")

strategy.risk.max_position_size(1000.0)
strategy.entry("Long", strategy.long)`;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-STRATEGY-POSITION-CONTROL'] });
    });

    it('flags zero value for strategy.risk.max_position_size', () => {
      const code = `//@version=6
strategy("Max Position Size Error Test")

strategy.risk.max_position_size(0)`;
      const result = createValidator().validate(code);
      expectHas(result, { errors: ['PSV6-STRATEGY-MAX-POSITION-SIZE'] });
    });

    it('accepts strategy.risk.max_drawdown', () => {
      const code = `//@version=6
strategy("Max Drawdown Test")

strategy.risk.max_drawdown(20.0)
strategy.entry("Long", strategy.long)`;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-STRATEGY-DRAWDOWN-PROTECTION'] });
    });
  });
});
