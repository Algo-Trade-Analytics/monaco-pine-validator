import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

const createValidator = () => new EnhancedModularValidator({
  version: '6',
  scriptType: 'strategy',
  strictMode: true,
});

describe('PSV6-STRATEGY-FUNCTIONS: Strategy Functions Validation (TDD)', () => {
  describe('PSV6-STRATEGY-ENTRY: Entry Functions', () => {
    it('should validate strategy.entry() function', () => {
      const code = `
//@version=6
strategy("Entry Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.entry() with all parameters', () => {
      const code = `
//@version=6
strategy("Entry Full Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, qty=1, limit=100.0, stop=95.0, oca_name="MyOCA", oca_type=strategy.oca.cancel, comment="Entry comment")
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.entry() with qty parameter', () => {
      const code = `
//@version=6
strategy("Entry Qty Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, qty=0.5)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.entry() with limit parameter', () => {
      const code = `
//@version=6
strategy("Entry Limit Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, limit=100.0)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.entry() with stop parameter', () => {
      const code = `
//@version=6
strategy("Entry Stop Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, stop=95.0)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.entry() with oca_name parameter', () => {
      const code = `
//@version=6
strategy("Entry OCA Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, oca_name="MyOCA")
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.entry() with oca_type parameter', () => {
      const code = `
//@version=6
strategy("Entry OCA Type Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, oca_type=strategy.oca.cancel)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.entry() with comment parameter', () => {
      const code = `
//@version=6
strategy("Entry Comment Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, comment="Entry comment")
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-STRATEGY-EXIT: Exit Functions', () => {
    it('should validate strategy.close() function', () => {
      const code = `
//@version=6
strategy("Close Test", overlay=true)

if ta.crossunder(close, ta.sma(close, 20))
    strategy.close("Long")
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.close() with all parameters', () => {
      const code = `
//@version=6
strategy("Close Full Test", overlay=true)

if ta.crossunder(close, ta.sma(close, 20))
    strategy.close("Long", qty=1, comment="Close comment")
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.close_all() function', () => {
      const code = `
//@version=6
strategy("Close All Test", overlay=true)

if ta.crossunder(close, ta.sma(close, 20))
    strategy.close_all()
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.close_all() with comment', () => {
      const code = `
//@version=6
strategy("Close All Comment Test", overlay=true)

if ta.crossunder(close, ta.sma(close, 20))
    strategy.close_all(comment="Close all positions")
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.cancel() function', () => {
      const code = `
//@version=6
strategy("Cancel Test", overlay=true)

if ta.crossunder(close, ta.sma(close, 20))
    strategy.cancel("Long")
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.cancel_all() function', () => {
      const code = `
//@version=6
strategy("Cancel All Test", overlay=true)

if ta.crossunder(close, ta.sma(close, 20))
    strategy.cancel_all()
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-STRATEGY-ORDER: Order Functions', () => {
    it('should validate strategy.order() function', () => {
      const code = `
//@version=6
strategy("Order Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.order("Long", strategy.long, 1)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.order() with all parameters', () => {
      const code = `
//@version=6
strategy("Order Full Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.order("Long", strategy.long, 1, limit=100.0, stop=95.0, oca_name="MyOCA", oca_type=strategy.oca.cancel, comment="Order comment")
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.order() with limit parameter', () => {
      const code = `
//@version=6
strategy("Order Limit Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.order("Long", strategy.long, 1, limit=100.0)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.order() with stop parameter', () => {
      const code = `
//@version=6
strategy("Order Stop Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.order("Long", strategy.long, 1, stop=95.0)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-STRATEGY-PARAMETERS: Strategy Parameter Validation', () => {
    it('should validate strategy() function with basic parameters', () => {
      const code = `
//@version=6
strategy("Basic Strategy", overlay=true)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy() function with all parameters', () => {
      const code = `
//@version=6
strategy("Full Strategy", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10, initial_capital=10000, currency=currency.USD, commission_type=strategy.commission.percent, commission_value=0.1, slippage=2, process_orders_on_close=true, close_entries_rule=ANY, default_qty_type=strategy.percent_of_equity, default_qty_value=10, pyramiding=1, calc_on_order_fills=true, calc_on_every_tick=true, max_bars_back=500, max_boxes_count=500, max_lines_count=500, max_labels_count=500)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy() with default_qty_type parameter', () => {
      const code = `
//@version=6
strategy("Qty Type Strategy", overlay=true, default_qty_type=strategy.percent_of_equity)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy() with default_qty_value parameter', () => {
      const code = `
//@version=6
strategy("Qty Value Strategy", overlay=true, default_qty_value=10)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy() with initial_capital parameter', () => {
      const code = `
//@version=6
strategy("Capital Strategy", overlay=true, initial_capital=10000)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy() with currency parameter', () => {
      const code = `
//@version=6
strategy("Currency Strategy", overlay=true, currency=currency.USD)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy() with commission_type parameter', () => {
      const code = `
//@version=6
strategy("Commission Type Strategy", overlay=true, commission_type=strategy.commission.percent)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy() with commission_value parameter', () => {
      const code = `
//@version=6
strategy("Commission Value Strategy", overlay=true, commission_value=0.1)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy() with slippage parameter', () => {
      const code = `
//@version=6
strategy("Slippage Strategy", overlay=true, slippage=2)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy() with process_orders_on_close parameter', () => {
      const code = `
//@version=6
strategy("Process Orders Strategy", overlay=true, process_orders_on_close=true)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy() with close_entries_rule parameter', () => {
      const code = `
//@version=6
strategy("Close Entries Strategy", overlay=true, close_entries_rule=ANY)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy() with pyramiding parameter', () => {
      const code = `
//@version=6
strategy("Pyramiding Strategy", overlay=true, pyramiding=1)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy() with calc_on_order_fills parameter', () => {
      const code = `
//@version=6
strategy("Calc Order Fills Strategy", overlay=true, calc_on_order_fills=true)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy() with calc_on_every_tick parameter', () => {
      const code = `
//@version=6
strategy("Calc Every Tick Strategy", overlay=true, calc_on_every_tick=true)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy() with max_bars_back parameter', () => {
      const code = `
//@version=6
strategy("Max Bars Back Strategy", overlay=true, max_bars_back=500)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy() with max_boxes_count parameter', () => {
      const code = `
//@version=6
strategy("Max Boxes Strategy", overlay=true, max_boxes_count=500)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy() with max_lines_count parameter', () => {
      const code = `
//@version=6
strategy("Max Lines Strategy", overlay=true, max_lines_count=500)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy() with max_labels_count parameter', () => {
      const code = `
//@version=6
strategy("Max Labels Strategy", overlay=true, max_labels_count=500)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-STRATEGY-PERFORMANCE: Strategy Performance Validation', () => {
    it('should warn on too many strategy function calls', () => {
      const code = `
//@version=6
strategy("Performance Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long1", strategy.long)
    strategy.entry("Long2", strategy.long)
    strategy.entry("Long3", strategy.long)
    strategy.entry("Long4", strategy.long)
    strategy.entry("Long5", strategy.long)
      `;
      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-STRATEGY-PERF-MANY-CALLS')).toBe(true);
    });

    it('should warn on expensive strategy operations in loops', () => {
      const code = `
//@version=6
strategy("Loop Performance Test", overlay=true)

for i = 1 to 10
    if ta.crossover(close, ta.sma(close, 20))
        strategy.entry("Long" + str.tostring(i), strategy.long)
      `;
      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-STRATEGY-PERF-LOOP')).toBe(true);
    });

    it('should warn on nested strategy function calls', () => {
      const code = `
//@version=6
strategy("Nested Performance Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, limit=strategy.position_size * 1.1)
      `;
      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-STRATEGY-PERF-NESTED')).toBe(true);
    });
  });

  describe('PSV6-STRATEGY-BEST-PRACTICES: Strategy Best Practices', () => {
    it('should suggest using strategy.position_size instead of manual calculations', () => {
      const code = `
//@version=6
strategy("Position Size Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, qty=1000)
      `;
      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-STRATEGY-POSITION-SIZE-SUGGESTION')).toBe(true);
    });

    it('should suggest using strategy.risk instead of manual risk calculations', () => {
      const code = `
//@version=6
strategy("Risk Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, stop=close * 0.95)
      `;
      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-STRATEGY-RISK-SUGGESTION')).toBe(true);
    });

    it('should suggest using strategy.equity instead of manual equity calculations', () => {
      const code = `
//@version=6
strategy("Equity Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, qty=10000)
      `;
      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-STRATEGY-EQUITY-SUGGESTION')).toBe(true);
    });

    it('should suggest using strategy.initial_capital instead of manual capital calculations', () => {
      const code = `
//@version=6
strategy("Capital Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, qty=5000)
      `;
      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-STRATEGY-CAPITAL-SUGGESTION')).toBe(true);
    });

    it('should suggest using strategy.commission instead of manual commission calculations', () => {
      const code = `
//@version=6
strategy("Commission Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, qty=1000)
      `;
      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-STRATEGY-COMMISSION-SUGGESTION')).toBe(true);
    });
  });

  describe('PSV6-STRATEGY-COMPLEX: Complex Strategy Scenarios', () => {
    it('should handle multiple strategy function calls in complex expressions', () => {
      const code = `
//@version=6
strategy("Complex Strategy Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, qty=1, limit=close * 1.01, stop=close * 0.99, comment="Long entry")
    strategy.entry("Short", strategy.short, qty=1, limit=close * 0.99, stop=close * 1.01, comment="Short entry")
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle strategy functions in conditional expressions', () => {
      const code = `
//@version=6
strategy("Conditional Strategy Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, qty=1)
else if ta.crossunder(close, ta.sma(close, 20))
    strategy.entry("Short", strategy.short, qty=1)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle strategy functions in loops', () => {
      const code = `
//@version=6
strategy("Loop Strategy Test", overlay=true)

for i = 1 to 3
    if ta.crossover(close, ta.sma(close, 20))
        strategy.entry("Long" + str.tostring(i), strategy.long, qty=1)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle strategy functions in functions', () => {
      const code = `
//@version=6
strategy("Function Strategy Test", overlay=true)

f_entry() =>
    if ta.crossover(close, ta.sma(close, 20))
        strategy.entry("Long", strategy.long, qty=1)

f_entry()
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-STRATEGY-EDGE-CASES: Strategy Edge Cases', () => {
    it('should handle strategy functions with na values', () => {
      const code = `
//@version=6
strategy("NA Strategy Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, qty=na)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle strategy functions with variable parameters', () => {
      const code = `
//@version=6
strategy("Variable Strategy Test", overlay=true)

qty_val = 1.5
limit_val = close * 1.01
stop_val = close * 0.99

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, qty=qty_val, limit=limit_val, stop=stop_val)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle strategy functions with calculated parameters', () => {
      const code = `
//@version=6
strategy("Calculated Strategy Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, qty=math.round(close / 100), limit=close + ta.atr(14), stop=close - ta.atr(14))
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle strategy functions with string concatenation', () => {
      const code = `
//@version=6
strategy("String Strategy Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long" + str.tostring(bar_index), strategy.long, qty=1)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle strategy functions with array parameters', () => {
      const code = `
//@version=6
strategy("Array Strategy Test", overlay=true)

if ta.crossover(close, ta.sma(close, 20))
    strategy.entry("Long", strategy.long, qty=1, comment="Entry at " + str.tostring(close))
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-STRATEGY-METRICS: Built-in performance metrics', () => {
    it('should accept percentage-based strategy metrics', () => {
      const code = `
//@version=6
strategy("Metrics Test", overlay=true)

if ta.crossover(close, ta.sma(close, 10))
    strategy.entry("Long", strategy.long)

netPercent = strategy.netprofit_percent
grossPercent = strategy.grossprofit_percent
drawdownPercent = strategy.max_drawdown_percent
runupPercent = strategy.max_runup_percent
openPercent = strategy.openprofit_percent
avgTradePercent = strategy.avg_trade_percent
direction = strategy.direction
entryName = strategy.position_entry_name

plot(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
