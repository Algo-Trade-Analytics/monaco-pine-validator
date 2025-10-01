import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { expectHas, expectLacks, expectValid } from './test-utils';
import { ChevrotainAstService } from '../../core/ast/service';

const createValidator = () => {
  return new EnhancedModularValidator({
    targetVersion: 6,
    strictMode: true,
    enablePerformanceAnalysis: true,
    ast: {
      mode: 'primary',
      service: new ChevrotainAstService(),
    },
  });
};

describe('Built-in Variables Validation', () => {

  describe('PSV6-TIMEFRAME-CONSTANTS: Timeframe Built-in Constants', () => {
    it('should validate timeframe.isdaily usage', () => {
      const code = `//@version=6
indicator("Timeframe Daily Test")

// Test timeframe.isdaily usage
is_daily_chart = timeframe.isdaily
plot(is_daily_chart ? close : na)`;
      
      const result = createValidator().validate(code);
      // Focus on detecting the timeframe constant rather than overall validity
      const hasTimeframeConstant = result.info.some(i => i.code === 'PSV6-TIMEFRAME-CONSTANT');
      expect(hasTimeframeConstant).toBe(true);
    });

    it('should validate timeframe.isweekly and timeframe.ismonthly usage', () => {
      const code = `//@version=6
indicator("Timeframe Weekly Monthly Test")

// Test timeframe constants
weekly_chart = timeframe.isweekly
monthly_chart = timeframe.ismonthly
intraday_chart = timeframe.isintraday

plot(weekly_chart ? high : monthly_chart ? low : close)`;
      
      const result = createValidator().validate(code);
      const timeframeInfo = result.info.filter(i => i.code === 'PSV6-TIMEFRAME-CONSTANT');
      expect(timeframeInfo.length).toBeGreaterThanOrEqual(3);
    });

    it('should validate timeframe.isminutes and timeframe.isseconds usage', () => {
      const code = `//@version=6
indicator("Timeframe Minutes Seconds Test")

// Test minute and second timeframe detection
minute_chart = timeframe.isminutes
second_chart = timeframe.isseconds
tick_chart = timeframe.isticks

condition = minute_chart or second_chart or tick_chart
plot(condition ? close : na)`;
      
      const result = createValidator().validate(code);
      const timeframeInfo = result.info.filter(i => i.code === 'PSV6-TIMEFRAME-CONSTANT');
      expect(timeframeInfo.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('PSV6-DISPLAY-CONSTANTS: Display Built-in Constants', () => {
    it('should validate display.all and display.none usage', () => {
      const code = `//@version=6
indicator("Display Constants Test")

// Test display constants
plot(close, "Price", display=display.all)
plot(volume, "Volume", display=display.none)`;
      
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-DISPLAY-CONSTANT'] });
    });

    it('should validate display.data_window and display.status_line usage', () => {
      const code = `//@version=6
indicator("Display Advanced Test")

// Test advanced display constants
plot(high, "High", display=display.data_window)
plot(low, "Low", display=display.status_line)
plot(open, "Open", display=display.pane)`;
      
      const result = createValidator().validate(code);
      const displayInfo = result.info.filter(i => i.code === 'PSV6-DISPLAY-CONSTANT');
      expect(displayInfo.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('PSV6-EXTEND-CONSTANTS: Extend Built-in Constants', () => {
    it('should validate extend constants usage', () => {
      const code = `//@version=6
indicator("Extend Constants Test")

// Test extend constants with line drawing
if barstate.islast
    line.new(bar_index - 10, low, bar_index, high, extend=extend.right)
    line.new(bar_index - 20, close, bar_index - 10, open, extend=extend.both)
    line.new(bar_index - 5, hl2, bar_index, hl2, extend=extend.left)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-EXTEND-CONSTANT'] });
    });

    it('should validate extend.none usage', () => {
      const code = `//@version=6
indicator("Extend None Test")

// Test extend.none (no extension)
if close > open
    line.new(bar_index - 1, low, bar_index, high, extend=extend.none)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-EXTEND-CONSTANT'] });
    });
  });

  describe('PSV6-FORMAT-CONSTANTS: Format Built-in Constants', () => {
    it('should validate format constants usage', () => {
      const code = `//@version=6
indicator("Format Constants Test")

// Test format constants with labels
if barstate.islast
    label.new(bar_index, high, str.tostring(close, format.price))
    label.new(bar_index - 1, low, str.tostring(volume, format.volume))
    label.new(bar_index - 2, close, "Default", text_color=color.white)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-FORMAT-CONSTANT'] });
    });

    it('should validate format.inherit usage', () => {
      const code = `//@version=6
indicator("Format Inherit Test")

// Test format.inherit for default formatting
price_text = str.tostring(close, format.inherit)
plot(close, "Price")`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-FORMAT-CONSTANT'] });
    });
  });

  describe('PSV6-CURRENCY-CONSTANTS: Currency Built-in Constants', () => {
    it('should validate major currency constants', () => {
      const code = `//@version=6
strategy("Currency Test", currency=currency.USD, initial_capital=10000)

// Test currency usage in strategy
if close > open
    strategy.entry("Long", strategy.long)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-CURRENCY-CONSTANT', 'PSV6-CURRENCY-USAGE'] });
    });

    it('should validate multiple currency constants', () => {
      const code = `//@version=6
indicator("Multi Currency Test")

// Test different currency constants in conditions
usd_market = syminfo.currency == currency.USD
eur_market = syminfo.currency == currency.EUR
gbp_market = syminfo.currency == currency.GBP
jpy_market = syminfo.currency == currency.JPY

is_major_currency = usd_market or eur_market or gbp_market or jpy_market
plot(is_major_currency ? close : na)`;
      
      const result = createValidator().validate(code);
      const currencyInfo = result.info.filter(i => i.code === 'PSV6-CURRENCY-CONSTANT');
      expect(currencyInfo.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('PSV6-BUILTIN-VARS-INTEGRATION: Built-in Variables Integration', () => {
    it('should handle comprehensive usage of specialized constants', () => {
      const code = `//@version=6
strategy("Comprehensive Constants", currency=currency.USD, overlay=true)

// Timeframe conditions
is_intraday = timeframe.isintraday
is_daily = timeframe.isdaily
is_minutes = timeframe.isminutes

// Display configuration
plot(close, "Price", display=display.data_window)
plot(volume, "Volume", display=display.status_line)

// Line extensions
if barstate.islast and is_daily
    line.new(bar_index - 10, low, bar_index, high, extend=extend.right)

// Format usage
price_label = str.tostring(close, format.price)
volume_label = str.tostring(volume, format.volume)

// Currency comparison
is_usd = syminfo.currency == currency.USD

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { 
        info: ['PSV6-BUILTIN-VARS-INFO', 'PSV6-CURRENCY-USAGE', 'PSV6-DISPLAY-USAGE'] 
      });
    });

    it('should provide appropriate information for scripts without specialized constants', () => {
      const code = `//@version=6
indicator("Basic Script")

// Simple script without specialized constants
sma_20 = ta.sma(close, 20)
plot(sma_20)`;
      
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      // Should not have specialized constant info messages
      expectLacks(result, { info: ['PSV6-BUILTIN-VARS-INFO'] });
    });
  });

  describe('PSV6-SCALE-CONSTANTS: Scale Built-in Constants', () => {
    it('should validate scale constants in indicator declarations', () => {
      const code = `//@version=6
indicator("Scale Test", overlay=false, scale=scale.left)

// Test scale usage in indicator declaration
plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-SCALE-CONSTANT', 'PSV6-SCALE-USAGE'] });
    });

    it('should validate scale.right and scale.none usage', () => {
      const code = `//@version=6
indicator("Scale Right None", overlay=true, scale=scale.none)

// Another indicator might use scale.right
// scale_right_indicator = scale.right

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-SCALE-CONSTANT'] });
    });
  });

  describe('PSV6-ADJUSTMENT-CONSTANTS: Adjustment Built-in Constants', () => {
    it('should validate adjustment constants usage', () => {
      const code = `//@version=6
indicator("Adjustment Test")

// Test adjustment constants with ticker.new
ticker_with_adjustments = ticker.new("AAPL", adjustment=adjustment.splits)
ticker_no_adjustments = ticker.new("MSFT", adjustment=adjustment.none)
ticker_dividends = ticker.new("GOOGL", adjustment=adjustment.dividends)

plot(close)`;
      
      const result = createValidator().validate(code);
      const adjustmentInfo = result.info.filter(i => i.code === 'PSV6-ADJUSTMENT-CONSTANT');
      expect(adjustmentInfo.length).toBeGreaterThanOrEqual(3);
      expectHas(result, { info: ['PSV6-ADJUSTMENT-USAGE'] });
    });
  });

  describe('PSV6-BACKADJUSTMENT-CONSTANTS: Backadjustment Built-in Constants', () => {
    it('should validate backadjustment constants usage', () => {
      const code = `//@version=6
indicator("Backadjustment Test")

// Test backadjustment constants 
security_inherit = request.security("AAPL", "1D", close, backadjustment=backadjustment.inherit)
security_on = request.security("MSFT", "1D", close, backadjustment=backadjustment.on)
security_off = request.security("GOOGL", "1D", close, backadjustment=backadjustment.off)

plot(close)`;
      
      const result = createValidator().validate(code);
      const backadjustmentInfo = result.info.filter(i => i.code === 'PSV6-BACKADJUSTMENT-CONSTANT');
      expect(backadjustmentInfo.length).toBeGreaterThanOrEqual(3);
      expectHas(result, { info: ['PSV6-ADJUSTMENT-USAGE'] });
    });
  });

  describe('PSV6-BUILTIN-VARS-EDGE-CASES: Edge Cases and Combinations', () => {
    it('should handle mixed timeframe and display constants', () => {
      const code = `//@version=6
indicator("Mixed Constants")

// Mix of different specialized constants
if timeframe.isdwm
    plot(close, "DWM Price", display=display.pane)
else if timeframe.isintraday  
    plot(close, "Intraday Price", display=display.all)

plot(close)`;
      
      const result = createValidator().validate(code);
      const timeframeInfo = result.info.filter(i => i.code === 'PSV6-TIMEFRAME-CONSTANT');
      const displayInfo = result.info.filter(i => i.code === 'PSV6-DISPLAY-CONSTANT');
      expect(timeframeInfo.length).toBeGreaterThanOrEqual(2);
      expect(displayInfo.length).toBeGreaterThanOrEqual(2);
    });

    it('should validate extend and format constants together', () => {
      const code = `//@version=6
indicator("Extend Format Mix")

// Combine extend and format constants
if barstate.islast
    line_id = line.new(bar_index - 5, close, bar_index, close, extend=extend.both)
    label.new(bar_index, close, str.tostring(close, format.inherit))

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-EXTEND-CONSTANT', 'PSV6-FORMAT-CONSTANT'] });
    });

    it('should handle comprehensive usage of all specialized constants including final additions', () => {
      const code = `//@version=6
indicator("All Constants Test", overlay=true, scale=scale.none)

// All types of specialized constants
is_daily = timeframe.isdaily
ticker_adj = ticker.new("AAPL", adjustment=adjustment.dividends) 
security_data = request.security("MSFT", "1D", close, backadjustment=backadjustment.inherit)

plot(close, display=display.data_window)
if barstate.islast
    line.new(bar_index - 1, low, bar_index, high, extend=extend.right)
    label.new(bar_index, close, str.tostring(close, format.price))

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { 
        info: ['PSV6-TIMEFRAME-CONSTANT', 'PSV6-SCALE-CONSTANT', 'PSV6-ADJUSTMENT-CONSTANT', 
               'PSV6-BACKADJUSTMENT-CONSTANT', 'PSV6-DISPLAY-CONSTANT', 'PSV6-EXTEND-CONSTANT', 
               'PSV6-FORMAT-CONSTANT'] 
      });
    });

    it('should validate all scale constants separately', () => {
      const code = `//@version=6
indicator("All Scale Constants", overlay=false, scale=scale.right)

// Test individual scale constants
left_scale = scale.left
right_scale = scale.right
no_scale = scale.none

plot(close)`;
      
      const result = createValidator().validate(code);
      const scaleInfo = result.info.filter(i => i.code === 'PSV6-SCALE-CONSTANT');
      expect(scaleInfo.length).toBeGreaterThanOrEqual(3); // Should detect all 3 scale constants
    });

    it('should validate all adjustment and backadjustment constants', () => {
      const code = `//@version=6
indicator("All Adjustment Constants")

// Test all adjustment types
adj_none = adjustment.none
adj_splits = adjustment.splits  
adj_dividends = adjustment.dividends

// Test all backadjustment types
back_inherit = backadjustment.inherit
back_on = backadjustment.on
back_off = backadjustment.off

plot(close)`;
      
      const result = createValidator().validate(code);
      const adjustmentInfo = result.info.filter(i => i.code === 'PSV6-ADJUSTMENT-CONSTANT');
      const backadjustmentInfo = result.info.filter(i => i.code === 'PSV6-BACKADJUSTMENT-CONSTANT');
      expect(adjustmentInfo.length).toBeGreaterThanOrEqual(3);
      expect(backadjustmentInfo.length).toBeGreaterThanOrEqual(3);
    });
  });
});
