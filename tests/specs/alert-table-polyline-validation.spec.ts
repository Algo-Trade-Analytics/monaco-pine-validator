/**
 * Alert, Table & Polyline Functions Validation Tests (TDD)
 * 
 * PHASE 12 - FINAL PHASE TO 80% COVERAGE
 * Coverage Gap: Mixed (18 functions untested)
 * 
 * Following TDD: These tests are written FIRST and will initially FAIL
 * until the validators are extended.
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../..';

describe('Alert, Table & Polyline Functions Validation (TDD)', () => {
  const createValidator = () => new EnhancedModularValidator({
    targetVersion: 6,
    strictMode: true,
    enablePerformanceAnalysis: true
  });

  // ============================================================================
  // Category 1: Alert Functions
  // ============================================================================

  describe('PSV6-ALERT-FUNCTIONS: Alert Functions', () => {
    
    it('should validate alert() function', () => {
      const code = `
//@version=6
indicator("Alert Function")

crossover = ta.crossover(close, ta.sma(close, 20))
if crossover
    alert("Price crossed above SMA", alert.freq_once_per_bar)

plot(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate alert() with different frequencies', () => {
      const code = `
//@version=6
indicator("Alert Frequencies")

condition = close > open

// Different alert frequencies
if condition
    alert("Once per bar", alert.freq_once_per_bar)
    
if ta.crossover(close, ta.sma(close, 20))
    alert("Once per bar close", alert.freq_once_per_bar_close)
    
if high > ta.highest(high, 50)
    alert("All alerts", alert.freq_all)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate alertcondition()', () => {
      const code = `
//@version=6
indicator("Alert Condition")

bullishCross = ta.crossover(ta.ema(close, 12), ta.ema(close, 26))
bearishCross = ta.crossunder(ta.ema(close, 12), ta.ema(close, 26))

alertcondition(bullishCross, "Bullish Cross", "EMA 12 crossed above EMA 26")
alertcondition(bearishCross, "Bearish Cross", "EMA 12 crossed below EMA 26")

plot(ta.ema(close, 12))
plot(ta.ema(close, 26))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate alert.freq_* constants', () => {
      const code = `
//@version=6
indicator("Alert Frequencies")

condition = close > ta.sma(close, 20)

// Test all frequency constants
if condition and alert.freq_once_per_bar
    alert("Frequency check 1")
    
if condition and alert.freq_once_per_bar_close
    alert("Frequency check 2")
    
if condition and alert.freq_all
    alert("Frequency check 3")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 2: Advanced Table Functions
  // ============================================================================

  describe('PSV6-TABLE-ADVANCED: Advanced Table Functions', () => {
    
    it('should validate table.clear()', () => {
      const code = `
//@version=6
indicator("Table Clear", overlay=true)

var table myTable = table.new(position.top_right, 2, 2)

if bar_index == 100
    table.clear(myTable)
    
table.cell(myTable, 0, 0, "New Data")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate table.delete()', () => {
      const code = `
//@version=6
indicator("Table Delete", overlay=true)

var table myTable = na

if bar_index == 50
    myTable := table.new(position.top_right, 2, 2)
    table.cell(myTable, 0, 0, "Data")
    
if bar_index == 100
    table.delete(myTable)
    myTable := na
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate table.cell_set_* functions', () => {
      const code = `
//@version=6
indicator("Table Cell Setters", overlay=true)

var table myTable = table.new(position.top_right, 1, 1)
table.cell(myTable, 0, 0, "Initial")

// Update cell properties
table.cell_set_text(myTable, 0, 0, "Updated")
table.cell_set_bgcolor(myTable, 0, 0, color.new(color.blue, 80))
table.cell_set_text_color(myTable, 0, 0, color.white)
table.cell_set_text_size(myTable, 0, 0, size.large)
table.cell_set_text_halign(myTable, 0, 0, text.align_center)
table.cell_set_text_valign(myTable, 0, 0, text.align_center)
table.cell_set_tooltip(myTable, 0, 0, "Tooltip text")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate table.set_* table-level setters', () => {
      const code = `
//@version=6
indicator("Table Setters", overlay=true)

var table myTable = table.new(position.top_right, 2, 2)

// Set table-level properties
table.set_position(myTable, position.bottom_left)
table.set_bgcolor(myTable, color.new(color.white, 90))
table.set_frame_color(myTable, color.blue)
table.set_frame_width(myTable, 2)
table.set_border_color(myTable, color.gray)
table.set_border_width(myTable, 1)

table.cell(myTable, 0, 0, "Data")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate dynamic table construction', () => {
      const code = `
//@version=6
indicator("Dynamic Table", overlay=true)

var table statsTable = table.new(position.top_right, 2, 5)

if barstate.islast
    // Headers
    table.cell(statsTable, 0, 0, "Metric", bgcolor=color.gray, text_color=color.white)
    table.cell(statsTable, 1, 0, "Value", bgcolor=color.gray, text_color=color.white)
    
    // Data rows
    table.cell(statsTable, 0, 1, "High")
    table.cell(statsTable, 1, 1, str.tostring(high, "#.##"))
    
    table.cell(statsTable, 0, 2, "Low")
    table.cell(statsTable, 1, 2, str.tostring(low, "#.##"))
    
    table.cell(statsTable, 0, 3, "Volume")
    table.cell(statsTable, 1, 3, str.tostring(volume, "#,###"))
    
    table.cell(statsTable, 0, 4, "Range")
    table.cell(statsTable, 1, 4, str.tostring(high - low, "#.##"))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 3: Advanced Polyline Functions
  // ============================================================================

  describe('PSV6-POLYLINE-ADVANCED: Advanced Polyline Functions', () => {
    
    it('should validate polyline.delete()', () => {
      const code = `
//@version=6
indicator("Polyline Delete", overlay=true)

var polyline myPolyline = na

if bar_index % 20 == 0
    if not na(myPolyline)
        polyline.delete(myPolyline)
    
    points = array.new<chart.point>()
    array.push(points, chart.point.now(high))
    array.push(points, chart.point.now(low))
    myPolyline := polyline.new(points)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate polyline.all array', () => {
      const code = `
//@version=6
indicator("Polyline All", overlay=true)

if bar_index % 10 == 0
    points = array.new<chart.point>()
    array.push(points, chart.point.now(high))
    array.push(points, chart.point.now(low))
    polyline.new(points)

// Access all polylines
allPolylines = polyline.all
count = array.size(allPolylines)
label.new(bar_index, high, "Polylines: " + str.tostring(count))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate polyline with closed parameter', () => {
      const code = `
//@version=6
indicator("Closed Polyline", overlay=true)

if bar_index == 50
    points = array.new<chart.point>()
    array.push(points, chart.point.from_index(bar_index-10, high[10]))
    array.push(points, chart.point.from_index(bar_index-5, low[5]))
    array.push(points, chart.point.now(high))
    
    // Create closed polyline (forms a polygon)
    polyline.new(points, closed=true, line_color=color.blue, fill_color=color.new(color.blue, 80))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate polyline styling options', () => {
      const code = `
//@version=6
indicator("Polyline Styling", overlay=true)

if bar_index % 20 == 0
    points = array.new<chart.point>()
    for i = 0 to 5
        array.push(points, chart.point.from_index(bar_index - i * 2, close[i * 2]))
    
    polyline.new(
         points,
         closed=false,
         curved=true,
         line_color=color.blue,
         line_width=2,
         line_style=line.style_solid)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate polyline with dynamic points', () => {
      const code = `
//@version=6
indicator("Dynamic Polyline", overlay=true)

var array<chart.point> trendPoints = array.new<chart.point>()

// Collect swing highs
if ta.pivothigh(high, 5, 5)
    array.push(trendPoints, chart.point.from_index(bar_index[5], high[5]))
    
    // Keep only last 10 points
    if array.size(trendPoints) > 10
        array.shift(trendPoints)
    
    // Draw polyline through swing highs
    if array.size(trendPoints) > 1
        polyline.new(trendPoints, line_color=color.red, line_width=2)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('PSV6-INTEGRATION-FINAL: Final Integration Tests', () => {
    
    it('should validate comprehensive dashboard with alerts', () => {
      const code = `
//@version=6
indicator("Complete Dashboard", overlay=true)

// Calculations
sma20 = ta.sma(close, 20)
sma50 = ta.sma(close, 50)
rsi = ta.rsi(close, 14)
volume_avg = ta.sma(volume, 20)

// Alerts
bullishCross = ta.crossover(sma20, sma50)
bearishCross = ta.crossunder(sma20, sma50)

if bullishCross
    alert("Bullish crossover detected!", alert.freq_once_per_bar)
    
if bearishCross
    alert("Bearish crossover detected!", alert.freq_once_per_bar)

// Table dashboard
var table dashboard = table.new(position.top_right, 2, 5, bgcolor=color.new(color.white, 95))

if barstate.islast
    // Headers
    table.cell(dashboard, 0, 0, "Indicator", bgcolor=color.gray, text_color=color.white)
    table.cell(dashboard, 1, 0, "Value", bgcolor=color.gray, text_color=color.white)
    
    // Data
    table.cell(dashboard, 0, 1, "SMA 20")
    table.cell(dashboard, 1, 1, str.tostring(sma20, "#.##"))
    
    table.cell(dashboard, 0, 2, "SMA 50")
    table.cell(dashboard, 1, 2, str.tostring(sma50, "#.##"))
    
    table.cell(dashboard, 0, 3, "RSI")
    table.cell(dashboard, 1, 3, str.tostring(rsi, "#.##"), 
               bgcolor=rsi > 70 ? color.new(color.red, 80) : 
                       rsi < 30 ? color.new(color.green, 80) : na)
    
    table.cell(dashboard, 0, 4, "Volume Ratio")
    table.cell(dashboard, 1, 4, str.tostring(volume / volume_avg, "#.##"))

// Plot
plot(sma20, "SMA 20", color=color.blue)
plot(sma50, "SMA 50", color=color.orange)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate advanced visualization with polylines', () => {
      const code = `
//@version=6
indicator("Advanced Visualization", overlay=true)

// Collect pivot points
var array<chart.point> pivotHighs = array.new<chart.point>()
var array<chart.point> pivotLows = array.new<chart.point>()

ph = ta.pivothigh(high, 5, 5)
pl = ta.pivotlow(low, 5, 5)

if ph
    array.push(pivotHighs, chart.point.from_index(bar_index[5], high[5]))
    if array.size(pivotHighs) > 20
        array.shift(pivotHighs)
        
if pl
    array.push(pivotLows, chart.point.from_index(bar_index[5], low[5]))
    if array.size(pivotLows) > 20
        array.shift(pivotLows)

// Draw trend lines
if barstate.islast
    if array.size(pivotHighs) > 1
        polyline.new(pivotHighs, line_color=color.red, line_width=2)
    
    if array.size(pivotLows) > 1
        polyline.new(pivotLows, line_color=color.green, line_width=2)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Error Cases
  // ============================================================================

  describe('PSV6-ERRORS-FINAL: Final Error Cases', () => {
    
    it('should error on alert without condition', () => {
      const code = `
//@version=6
indicator("Alert No Condition")

// Alert without proper condition check
alert("Always alerting")  // Should be inside if condition
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should error on invalid table indices', () => {
      const code = `
//@version=6
indicator("Invalid Table Index", overlay=true)

var table myTable = table.new(position.top_right, 2, 2)
table.cell(myTable, 5, 5, "Out of bounds")  // Indices out of range
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should error on polyline with insufficient points', () => {
      const code = `
//@version=6
indicator("Insufficient Points", overlay=true)

points = array.new<chart.point>()
array.push(points, chart.point.now(close))  // Only 1 point
polyline.new(points)  // Need at least 2 points
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Best Practices
  // ============================================================================

  describe('PSV6-BEST-PRACTICES-FINAL: Final Best Practices', () => {
    
    it('should validate conditional alerts', () => {
      const code = `
//@version=6
indicator("Conditional Alerts")

condition = ta.crossover(close, ta.sma(close, 20))

// Good: Alert only when condition is true
if condition
    alert("Crossover detected", alert.freq_once_per_bar)
    
plot(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate managing drawing limits', () => {
      const code = `
//@version=6
indicator("Drawing Limits", overlay=true, max_polylines_count=50)

var array<polyline> polylines = array.new<polyline>()

if bar_index % 10 == 0
    // Clean up old polylines when approaching limit
    if array.size(polylines) >= 45
        oldest = array.shift(polylines)
        polyline.delete(oldest)
    
    // Create new polyline
    points = array.new<chart.point>()
    array.push(points, chart.point.now(high))
    array.push(points, chart.point.now(low))
    newPoly = polyline.new(points)
    array.push(polylines, newPoly)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

