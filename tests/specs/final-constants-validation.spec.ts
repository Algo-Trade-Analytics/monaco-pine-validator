import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { expectHas, expectLacks, expectValid } from './test-utils';

const createValidator = () => new EnhancedModularValidator({
  targetVersion: 6,
  strictMode: true,
  enablePerformanceAnalysis: true
});

describe('Final Constants Validation - 100% Coverage', () => {

  describe('PSV6-MATH-CONSTANTS: Mathematical Constants', () => {
    it('should validate math.pi and math.e usage', () => {
      const code = `//@version=6
indicator("Math Constants Test")

// Test mathematical constants
pi_value = math.pi
e_value = math.e
circle_area = pi_value * math.pow(2, 2)
exponential = math.exp(1) // Should be close to math.e

plot(circle_area)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-MATH-CONSTANT', 'PSV6-MATH-CONSTANTS-USAGE'] });
    });

    it('should validate math.phi and math.rphi (golden ratio constants)', () => {
      const code = `//@version=6
indicator("Golden Ratio Test")

// Test golden ratio constants
phi = math.phi          // Golden ratio
rphi = math.rphi        // Golden ratio conjugate
golden_sum = phi + rphi // Should equal 1

plot(golden_sum)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-MATH-CONSTANT'] });
    });
  });

  describe('PSV6-PLOT-STYLE-CONSTANTS: Plot Style Constants', () => {
    it('should validate all plot style constants', () => {
      const code = `//@version=6
indicator("Plot Styles Test")

// Test different plot styles
sma_20 = ta.sma(close, 20)
rsi_14 = ta.rsi(close, 14)

plot(sma_20, "Line", style=plot.style_line)
plot(high, "Area", style=plot.style_area, color=color.new(color.blue, 80))
plot(volume, "Histogram", style=plot.style_histogram)
plot(rsi_14, "Circles", style=plot.style_circles)
plot(low, "Columns", style=plot.style_columns)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-STYLE-CONSTANT', 'PSV6-STYLE-CONSTANTS-USAGE'] });
    });

    it('should validate stepline and area break styles', () => {
      const code = `//@version=6
indicator("Advanced Plot Styles")

// Test advanced plot styles
ema_10 = ta.ema(close, 10)
plot(ema_10, "Step Line", style=plot.style_stepline)
plot(ema_10 * 1.01, "Step Line Diamond", style=plot.style_stepline_diamond)
plot(ema_10 * 0.99, "Line Break", style=plot.style_linebr)
plot(ema_10 * 1.02, "Area Break", style=plot.style_areabr)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-STYLE-CONSTANT'] });
    });
  });

  describe('PSV6-LINE-STYLE-CONSTANTS: Line Style Constants', () => {
    it('should validate line style constants', () => {
      const code = `//@version=6
indicator("Line Styles Test", overlay=true)

// Test line style constants
if barstate.islast
    line.new(bar_index - 10, high, bar_index, high, style=line.style_solid)
    line.new(bar_index - 8, low, bar_index - 5, low, style=line.style_dotted)
    line.new(bar_index - 6, close, bar_index - 3, close, style=line.style_dashed)
    line.new(bar_index - 4, open, bar_index - 1, open, style=line.style_arrow_both)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-STYLE-CONSTANT'] });
    });

    it('should validate arrow line styles', () => {
      const code = `//@version=6
indicator("Arrow Line Styles", overlay=true)

// Test arrow line styles
if barstate.islast
    line.new(bar_index - 5, high, bar_index, high, style=line.style_arrow_left)
    line.new(bar_index - 5, low, bar_index, low, style=line.style_arrow_right)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-STYLE-CONSTANT'] });
    });
  });

  describe('PSV6-LABEL-STYLE-CONSTANTS: Label Style Constants', () => {
    it('should validate basic label styles', () => {
      const code = `//@version=6
indicator("Label Styles Test", overlay=true)

// Test basic label styles
if barstate.islast
    label.new(bar_index, high, "Triangle Up", style=label.style_triangleup)
    label.new(bar_index - 1, low, "Circle", style=label.style_circle)
    label.new(bar_index - 2, close, "Flag", style=label.style_flag)
    label.new(bar_index - 3, open, "Square", style=label.style_square)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-STYLE-CONSTANT'] });
    });

    it('should validate label position styles', () => {
      const code = `//@version=6
indicator("Label Position Styles", overlay=true)

// Test label position styles
if barstate.islast
    label.new(bar_index, high, "Label Up", style=label.style_label_up)
    label.new(bar_index - 1, low, "Label Down", style=label.style_label_down)
    label.new(bar_index - 2, close, "Label Center", style=label.style_label_center)
    label.new(bar_index - 3, open, "Upper Right", style=label.style_label_upper_right)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-STYLE-CONSTANT'] });
    });
  });

  describe('PSV6-HLINE-STYLE-CONSTANTS: HLine Style Constants', () => {
    it('should validate hline style constants', () => {
      const code = `//@version=6
indicator("HLine Styles Test")

// Test hline style constants
h1 = hline(50, "Solid Line", linestyle=hline.style_solid)
h2 = hline(30, "Dotted Line", linestyle=hline.style_dotted)
h3 = hline(70, "Dashed Line", linestyle=hline.style_dashed)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-STYLE-CONSTANT'] });
    });
  });

  describe('PSV6-ORDER-CONSTANTS: Array Sort Order Constants', () => {
    it('should validate order constants with array sorting', () => {
      const code = `//@version=6
indicator("Order Constants Test")

// Test order constants
prices = array.new<float>()
array.push(prices, close)
array.push(prices, open)
array.push(prices, high)
array.push(prices, low)

// Sort in different orders
array.sort(prices, order.ascending)
ascending_max = array.max(prices)

array.sort(prices, order.descending)  
descending_min = array.min(prices)

plot(ascending_max)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-ORDER-CONSTANT', 'PSV6-ORDER-CONSTANTS-USAGE'] });
    });
  });

  describe('PSV6-POSITION-CONSTANTS: Table Position Constants', () => {
    it('should validate table position constants', () => {
      const code = `//@version=6
indicator("Position Constants Test")

// Test table position constants
if barstate.islast
    var top_table = table.new(position.top_left, 2, 1)
    var center_table = table.new(position.middle_center, 2, 1)
    var bottom_table = table.new(position.bottom_right, 2, 1)
    
    table.cell(top_table, 0, 0, "Top Left")
    table.cell(center_table, 0, 0, "Center")
    table.cell(bottom_table, 0, 0, "Bottom Right")

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-POSITION-CONSTANT', 'PSV6-POSITION-CONSTANTS-USAGE'] });
    });
  });

  describe('PSV6-SPECIALIZED-CONSTANTS: Additional Specialized Constants', () => {
    it('should validate earnings and dividends field constants', () => {
      const code = `//@version=6
indicator("Earnings Dividends Constants")

// Test earnings and dividends field constants
earnings_actual = request.earnings("AAPL", earnings.actual)
earnings_estimate = request.earnings("AAPL", earnings.estimate)
dividends_gross = request.dividends("AAPL", dividends.gross)
dividends_net = request.dividends("AAPL", dividends.net)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-SPECIALIZED-CONSTANT'] });
    });

    it('should validate strategy constants', () => {
      const code = `//@version=6
strategy("Strategy Constants Test", commission_type=strategy.commission.percent)

// Test strategy constants
if close > open
    strategy.entry("Long", strategy.long, oca_type=strategy.oca.cancel)

// Test direction constants
strategy.risk.allow_entry_in(strategy.direction.long)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-SPECIALIZED-CONSTANT'] });
    });
  });

  describe('PSV6-FINAL-INTEGRATION: Complete Final Constants Integration', () => {
    it('should handle comprehensive usage of all final constants', () => {
      const code = `//@version=6
indicator("Complete Final Constants", overlay=true)

// Mathematical constants
pi_calc = math.pi * 2
phi_ratio = math.phi

// Array with order constants
values = array.from(3.14, 2.71, 1.61)
array.sort(values, order.descending)

// Plotting with styles
plot(close, "Main", style=plot.style_line)
plot(ta.sma(close, 20), "SMA", style=plot.style_stepline, color=color.blue)

// Drawing with styles
if barstate.islast
    line.new(bar_index - 5, low, bar_index, high, style=line.style_arrow_both)
    label.new(bar_index, close, "Final", style=label.style_label_center)
    
    var final_table = table.new(position.bottom_center, 1, 1)
    table.cell(final_table, 0, 0, "100% Coverage!")

// HLine with style
hline(close, "Reference", linestyle=hline.style_dashed)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { 
        info: ['PSV6-FINAL-CONSTANTS-INFO', 'PSV6-MATH-CONSTANTS-USAGE', 
               'PSV6-STYLE-CONSTANTS-USAGE', 'PSV6-ORDER-CONSTANTS-USAGE', 
               'PSV6-POSITION-CONSTANTS-USAGE'] 
      });
    });

    it('should provide info for scripts without final specialized constants', () => {
      const code = `//@version=6
indicator("Basic Script Without Final Constants")

// Simple script without final specialized constants
basic_sma = ta.sma(close, 20)
plot(basic_sma)`;
      
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      // Should not have final constants info messages
      expectLacks(result, { info: ['PSV6-FINAL-CONSTANTS-INFO'] });
    });
  });
});

