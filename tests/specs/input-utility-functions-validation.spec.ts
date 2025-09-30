/**
 * Input Utility Functions Validation Tests (TDD)
 * 
 * PHASE 6 - MEDIUM PRIORITY
 * Coverage Gap: 38% (19/50 input functions untested)
 * 
 * Following TDD: These tests are written FIRST and will initially FAIL
 * until the Input Functions Validator is extended.
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../..';

describe('Input Utility Functions Validation (TDD)', () => {
  const createValidator = () => new EnhancedModularValidator({
    version: '6',
    scriptType: 'indicator',
    strictMode: true,
    enableWarnings: true
  });

  // ============================================================================
  // Category 1: Basic Input Functions
  // ============================================================================

  describe('PSV6-INPUT-BASIC: Basic Input Functions', () => {
    
    it('should validate input.bool()', () => {
      const code = `
//@version=6
indicator("Boolean Input")

useSma = input.bool(true, title="Use SMA")

if useSma
    plot(ta.sma(close, 20))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.int()', () => {
      const code = `
//@version=6
indicator("Integer Input")

length = input.int(14, title="Length", minval=1, maxval=500)
plot(ta.sma(close, length))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.float()', () => {
      const code = `
//@version=6
indicator("Float Input")

multiplier = input.float(2.0, title="Multiplier", minval=0.1, maxval=10.0, step=0.1)
plot(close * multiplier)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.string()', () => {
      const code = `
//@version=6
indicator("String Input")

maType = input.string("SMA", title="MA Type", options=["SMA", "EMA", "WMA"])

ma = maType == "SMA" ? ta.sma(close, 20) : 
     maType == "EMA" ? ta.ema(close, 20) : 
     ta.wma(close, 20)

plot(ma)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.color()', () => {
      const code = `
//@version=6
indicator("Color Input")

lineColor = input.color(color.blue, title="Line Color")
plot(close, color=lineColor)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 2: Advanced Input Functions
  // ============================================================================

  describe('PSV6-INPUT-ADVANCED: Advanced Input Functions', () => {
    
    it('should validate input.symbol()', () => {
      const code = `
//@version=6
indicator("Symbol Input")

otherSymbol = input.symbol("NASDAQ:AAPL", title="Compare Symbol")
otherClose = request.security(otherSymbol, timeframe.period, close)
plot(otherClose)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.timeframe()', () => {
      const code = `
//@version=6
indicator("Timeframe Input")

tf = input.timeframe("D", title="Timeframe")
htfClose = request.security(syminfo.tickerid, tf, close)
plot(htfClose)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.session()', () => {
      const code = `
//@version=6
indicator("Session Input")

sessionTime = input.session("0930-1600", title="Session")
inSession = not na(time(timeframe.period, sessionTime))
bgcolor(inSession ? color.new(color.blue, 90) : na)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.source()', () => {
      const code = `
//@version=6
indicator("Source Input")

src = input.source(close, title="Source")
plot(ta.sma(src, 20))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.time()', () => {
      const code = `
//@version=6
indicator("Time Input")

startTime = input.time(timestamp("01 Jan 2024 00:00 +0000"), title="Start Time")
afterStart = time >= startTime
bgcolor(afterStart ? color.new(color.green, 95) : na)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 3: Input Options & Parameters
  // ============================================================================

  describe('PSV6-INPUT-OPTIONS: Input Options & Parameters', () => {
    
    it('should validate input with inline parameter', () => {
      const code = `
//@version=6
indicator("Inline Input")

length = input.int(14, inline="params")
multiplier = input.float(2.0, inline="params")

plot(ta.sma(close, length) * multiplier)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input with group parameter', () => {
      const code = `
//@version=6
indicator("Grouped Inputs")

length = input.int(20, title="Length", group="Moving Average")
src = input.source(close, title="Source", group="Moving Average")
color1 = input.color(color.blue, title="Color", group="Moving Average")

plot(ta.sma(src, length), color=color1)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input with tooltip', () => {
      const code = `
//@version=6
indicator("Input with Tooltip")

length = input.int(14, title="Period", tooltip="Number of bars for calculation")
plot(ta.sma(close, length))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.string with options', () => {
      const code = `
//@version=6
indicator("String Options")

maType = input.string("SMA", "MA Type", options=["SMA", "EMA", "RMA", "WMA"])

ma = switch maType
    "SMA" => ta.sma(close, 20)
    "EMA" => ta.ema(close, 20)
    "RMA" => ta.rma(close, 20)
    "WMA" => ta.wma(close, 20)

plot(ma)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input with confirm parameter', () => {
      const code = `
//@version=6
indicator("Confirm Input")

resetData = input.bool(false, title="Reset Data", confirm=true)

var int counter = 0
if resetData
    counter := 0
else
    counter += 1

plot(counter)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 4: Input Text Functions
  // ============================================================================

  describe('PSV6-INPUT-TEXT: Input Text Functions', () => {
    
    it('should validate input.text_area()', () => {
      const code = `
//@version=6
indicator("Text Area Input")

notes = input.text_area("Default notes", title="Trading Notes")
label.new(bar_index, high, notes)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.price()', () => {
      const code = `
//@version=6
indicator("Price Input")

targetPrice = input.price(100.0, title="Target Price")
hline(targetPrice, "Target", color=color.green)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 5: Input Table Functions (v6)
  // ============================================================================

  describe('PSV6-INPUT-TABLE: Input Table Functions', () => {
    
    it('should validate input with table display', () => {
      const code = `
//@version=6
indicator("Table Input", overlay=true)

showTable = input.bool(true, "Show Table")
tablePos = input.string("top_right", "Position", options=["top_left", "top_right", "bottom_left", "bottom_right"])

if showTable
    var table myTable = table.new(position.top_right, 2, 2)
    table.cell(myTable, 0, 0, "High", bgcolor=color.green)
    table.cell(myTable, 1, 0, str.tostring(high))
    table.cell(myTable, 0, 1, "Low", bgcolor=color.red)
    table.cell(myTable, 1, 1, str.tostring(low))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('PSV6-INPUT-INTEGRATION: Input Integration Tests', () => {
    
    it('should validate comprehensive input configuration', () => {
      const code = `
//@version=6
indicator("Comprehensive Inputs", overlay=true)

// Basic inputs
length = input.int(20, "Length", minval=1, maxval=500, step=1, group="Parameters")
src = input.source(close, "Source", group="Parameters")
multiplier = input.float(2.0, "Multiplier", minval=0.1, maxval=5.0, step=0.1, group="Parameters")

// Advanced inputs
useHtf = input.bool(false, "Use Higher Timeframe", group="Advanced")
htfTimeframe = input.timeframe("D", "HTF", group="Advanced")
compareSymbol = input.symbol("NASDAQ:AAPL", "Compare", group="Advanced")

// Visual inputs
lineColor = input.color(color.blue, "Line Color", group="Visual")
fillColor = input.color(color.new(color.blue, 80), "Fill Color", group="Visual")

// Calculate
basis = useHtf ? request.security(syminfo.tickerid, htfTimeframe, ta.sma(src, length)) : ta.sma(src, length)
upper = basis + ta.stdev(src, length) * multiplier
lower = basis - ta.stdev(src, length) * multiplier

// Plot
plot(basis, "Basis", lineColor)
plot(upper, "Upper", color=color.green)
plot(lower, "Lower", color=color.red)
fill(plot(upper), plot(lower), fillColor)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input-driven strategy', () => {
      const code = `
//@version=6
strategy("Input Strategy", overlay=true)

// Strategy inputs
useStrategy = input.bool(true, "Enable Strategy", group="Strategy")
entryLength = input.int(10, "Entry Length", group="Strategy")
exitLength = input.int(5, "Exit Length", group="Strategy")

// Risk management inputs
stopLoss = input.float(2.0, "Stop Loss %", step=0.1, group="Risk")
takeProfit = input.float(5.0, "Take Profit %", step=0.1, group="Risk")

// Calculate
fastMa = ta.sma(close, entryLength)
slowMa = ta.sma(close, exitLength)

// Entry/Exit
if useStrategy and ta.crossover(fastMa, slowMa)
    strategy.entry("Long", strategy.long)
    
if useStrategy and ta.crossunder(fastMa, slowMa)
    strategy.close("Long")

// Plot
plot(fastMa, "Fast MA", color=color.blue)
plot(slowMa, "Slow MA", color=color.red)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Error Cases
  // ============================================================================

  describe('PSV6-INPUT-ERRORS: Input Error Cases', () => {
    
    it('should error on invalid minval/maxval', () => {
      const code = `
//@version=6
indicator("Invalid Range")

// minval > maxval
length = input.int(20, minval=100, maxval=10)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should error on invalid options for input.string', () => {
      const code = `
//@version=6
indicator("Invalid String Options")

// Default value not in options
maType = input.string("INVALID", options=["SMA", "EMA", "WMA"])
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn on missing title parameter', () => {
      const code = `
//@version=6
indicator("Missing Title")

// No title - not recommended
length = input.int(20)
plot(ta.sma(close, length))
      `;

      const result = createValidator().validate(code);
      // Should suggest adding title for better UX
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should error on invalid timeframe format', () => {
      const code = `
//@version=6
indicator("Invalid Timeframe")

// Invalid timeframe format
tf = input.timeframe("INVALID", "Timeframe")
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn on excessive inputs', () => {
      const code = `
//@version=6
indicator("Too Many Inputs")

// More than 50 inputs (TradingView limit)
${'i'.repeat(60).split('').map((_, idx) => `inp${idx} = input.int(${idx})`).join('\n')}
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.message.toLowerCase().includes('limit') || w.message.toLowerCase().includes('input'))).toBe(true);
    });
  });

  // ============================================================================
  // Best Practices
  // ============================================================================

  describe('PSV6-INPUT-BEST-PRACTICES: Input Best Practices', () => {
    
    it('should validate well-organized inputs', () => {
      const code = `
//@version=6
indicator("Well-Organized Inputs")

// Group 1: Moving Average
maLength = input.int(20, "Length", group="Moving Average", tooltip="Period for calculation")
maSource = input.source(close, "Source", group="Moving Average")
maColor = input.color(color.blue, "Color", group="Moving Average")

// Group 2: Visual
showFill = input.bool(true, "Show Fill", group="Visual")
fillTransparency = input.int(80, "Transparency", minval=0, maxval=100, group="Visual")

ma = ta.sma(maSource, maLength)
plot(ma, color=maColor)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate inputs with proper validation', () => {
      const code = `
//@version=6
indicator("Validated Inputs")

// Constrained inputs
length = input.int(14, "Length", minval=1, maxval=500)
percentage = input.float(2.0, "Percentage", minval=0.1, maxval=10.0, step=0.1)
option = input.string("Option1", "Choice", options=["Option1", "Option2", "Option3"])

// Validated usage
ma = ta.sma(close, length)
multiplier = percentage / 100
plot(ma * (1 + multiplier))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

