import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('Line Utility Functions Validation', () => {
  const validator = new EnhancedModularValidator();

  describe('line.get_* Getter Functions', () => {
    it('should validate line.get_x1()', () => {
      const code = `//@version=6
indicator("Line Get X1")
var line myLine = line.new(bar_index - 10, low, bar_index, high)
x1 = line.get_x1(myLine)
plot(x1, "X1 Bar")`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate line.get_x2()', () => {
      const code = `//@version=6
indicator("Line Get X2")
var line myLine = line.new(bar_index - 10, low, bar_index, high)
x2 = line.get_x2(myLine)
plot(x2, "X2 Bar")`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate line.get_y1()', () => {
      const code = `//@version=6
indicator("Line Get Y1")
var line myLine = line.new(bar_index - 10, low, bar_index, high)
y1 = line.get_y1(myLine)
plot(y1, "Y1 Price")`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate line.get_y2()', () => {
      const code = `//@version=6
indicator("Line Get Y2")
var line myLine = line.new(bar_index - 10, low, bar_index, high)
y2 = line.get_y2(myLine)
plot(y2, "Y2 Price")`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate line.get_price() for y-coordinate at x', () => {
      const code = `//@version=6
indicator("Line Get Price")
var line trendLine = line.new(bar_index - 20, low[20], bar_index, low)
currentPrice = line.get_price(trendLine, bar_index)
plot(currentPrice, "Current Price on Line")`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate calculating line slope from get functions', () => {
      const code = `//@version=6
indicator("Line Slope")
var line myLine = line.new(bar_index - 20, low[20], bar_index, low)
x1 = line.get_x1(myLine)
x2 = line.get_x2(myLine)
y1 = line.get_y1(myLine)
y2 = line.get_y2(myLine)
slope = (y2 - y1) / (x2 - x1)
plot(slope, "Slope")`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('line.set_* Setter Functions', () => {
    it('should validate line.set_x1()', () => {
      const code = `//@version=6
indicator("Line Set X1")
var line myLine = line.new(bar_index, low, bar_index + 10, high)
if bar_index % 20 == 0
    line.set_x1(myLine, bar_index - 5)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate line.set_x2()', () => {
      const code = `//@version=6
indicator("Line Set X2")
var line myLine = line.new(bar_index - 10, low, bar_index, high)
line.set_x2(myLine, bar_index)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate line.set_y1()', () => {
      const code = `//@version=6
indicator("Line Set Y1")
var line myLine = line.new(bar_index - 10, low, bar_index, high)
newLow = ta.lowest(low, 20)
line.set_y1(myLine, newLow)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate line.set_y2()', () => {
      const code = `//@version=6
indicator("Line Set Y2")
var line myLine = line.new(bar_index - 10, low, bar_index, high)
newHigh = ta.highest(high, 20)
line.set_y2(myLine, newHigh)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate line.set_xy1()', () => {
      const code = `//@version=6
indicator("Line Set XY1")
var line myLine = line.new(bar_index, low, bar_index + 10, high)
if bar_index % 20 == 0
    line.set_xy1(myLine, bar_index - 5, ta.lowest(low, 10))`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate line.set_xy2()', () => {
      const code = `//@version=6
indicator("Line Set XY2")
var line myLine = line.new(bar_index - 10, low, bar_index, high)
line.set_xy2(myLine, bar_index, ta.highest(high, 10))`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate line.set_xloc()', () => {
      const code = `//@version=6
indicator("Line Set Xloc")
var line myLine = line.new(bar_index, low, bar_index + 10, high, xloc=xloc.bar_index)
if bar_index % 20 == 0
    line.set_xloc(myLine, xloc.bar_time)
    line.set_xy1(myLine, time[10], low[10])
    line.set_xy2(myLine, time, high)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate updating line dynamically', () => {
      const code = `//@version=6
indicator("Dynamic Line Update")
var line trendLine = line.new(bar_index, low, bar_index, low)
line.set_x2(trendLine, bar_index)
line.set_y1(trendLine, ta.lowest(low, 50))
line.set_y2(trendLine, ta.lowest(low, 10))`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('line.set_color() Function', () => {
    it('should validate line.set_color()', () => {
      const code = `//@version=6
indicator("Set Line Color")
var line myLine = line.new(bar_index - 10, low, bar_index, high)
bullish = close > open
newColor = bullish ? color.green : color.red
line.set_color(myLine, newColor)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate line.set_color() with transparency', () => {
      const code = `//@version=6
indicator("Line Color with Transparency")
var line myLine = line.new(bar_index - 20, low, bar_index, high)
strength = math.abs(high - low) / ta.atr(14)
transparency = int(100 - (strength * 50))
line.set_color(myLine, color.new(color.blue, transparency))`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate conditional line coloring', () => {
      const code = `//@version=6
indicator("Conditional Line Color")
var line trendLine = line.new(bar_index - 50, close[50], bar_index, close)
slope = (line.get_y2(trendLine) - line.get_y1(trendLine)) / (line.get_x2(trendLine) - line.get_x1(trendLine))
lineColor = slope > 0 ? color.green : slope < 0 ? color.red : color.gray
line.set_color(trendLine, lineColor)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('line.set_width() Function', () => {
    it('should validate line.set_width()', () => {
      const code = `//@version=6
indicator("Set Line Width")
var line myLine = line.new(bar_index - 10, low, bar_index, high)
line.set_width(myLine, 3)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate dynamic line width based on volatility', () => {
      const code = `//@version=6
indicator("Dynamic Line Width")
var line myLine = line.new(bar_index - 20, low, bar_index, high)
atr = ta.atr(14)
width = atr > ta.sma(atr, 20) ? 3 : 1
line.set_width(myLine, width)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate various line widths', () => {
      const code = `//@version=6
indicator("Various Line Widths")
var line thin = line.new(bar_index - 30, low * 0.99, bar_index, high * 0.99)
var line medium = line.new(bar_index - 30, low * 0.98, bar_index, high * 0.98)
var line thick = line.new(bar_index - 30, low * 0.97, bar_index, high * 0.97)
line.set_width(thin, 1)
line.set_width(medium, 2)
line.set_width(thick, 4)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('line.set_style() Function', () => {
    it('should validate line.set_style() with solid', () => {
      const code = `//@version=6
indicator("Line Style Solid")
var line myLine = line.new(bar_index - 10, low, bar_index, high)
line.set_style(myLine, line.style_solid)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate line.set_style() with dashed', () => {
      const code = `//@version=6
indicator("Line Style Dashed")
var line myLine = line.new(bar_index - 10, low, bar_index, high)
line.set_style(myLine, line.style_dashed)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate line.set_style() with dotted', () => {
      const code = `//@version=6
indicator("Line Style Dotted")
var line myLine = line.new(bar_index - 10, low, bar_index, high)
line.set_style(myLine, line.style_dotted)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate all line styles', () => {
      const code = `//@version=6
indicator("All Line Styles")
var line solid = line.new(bar_index - 40, high * 1.01, bar_index, high * 1.01)
var line dashed = line.new(bar_index - 40, high * 1.02, bar_index, high * 1.02)
var line dotted = line.new(bar_index - 40, high * 1.03, bar_index, high * 1.03)
var line arrowLeft = line.new(bar_index - 40, high * 1.04, bar_index, high * 1.04)
var line arrowRight = line.new(bar_index - 40, high * 1.05, bar_index, high * 1.05)
var line arrowBoth = line.new(bar_index - 40, high * 1.06, bar_index, high * 1.06)
line.set_style(solid, line.style_solid)
line.set_style(dashed, line.style_dashed)
line.set_style(dotted, line.style_dotted)
line.set_style(arrowLeft, line.style_arrow_left)
line.set_style(arrowRight, line.style_arrow_right)
line.set_style(arrowBoth, line.style_arrow_both)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('line.set_extend() Function', () => {
    it('should validate line.set_extend() with no extension', () => {
      const code = `//@version=6
indicator("Line Extend None")
var line myLine = line.new(bar_index - 10, low, bar_index, high)
line.set_extend(myLine, extend.none)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate line.set_extend() with left extension', () => {
      const code = `//@version=6
indicator("Line Extend Left")
var line myLine = line.new(bar_index - 10, low, bar_index, high)
line.set_extend(myLine, extend.left)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate line.set_extend() with right extension', () => {
      const code = `//@version=6
indicator("Line Extend Right")
var line myLine = line.new(bar_index - 10, low, bar_index, high)
line.set_extend(myLine, extend.right)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate line.set_extend() with both extensions', () => {
      const code = `//@version=6
indicator("Line Extend Both")
var line myLine = line.new(bar_index - 10, low, bar_index, high)
line.set_extend(myLine, extend.both)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate extending trendlines', () => {
      const code = `//@version=6
indicator("Extended Trendlines")
pivotHigh = ta.pivothigh(high, 5, 5)
pivotLow = ta.pivotlow(low, 5, 5)
var line resistanceLine = na
var line supportLine = na
if not na(pivotHigh)
    if not na(resistanceLine)
        line.delete(resistanceLine)
    resistanceLine := line.new(bar_index - 5, pivotHigh, bar_index, pivotHigh, extend=extend.right)
if not na(pivotLow)
    if not na(supportLine)
        line.delete(supportLine)
    supportLine := line.new(bar_index - 5, pivotLow, bar_index, pivotLow, extend=extend.right)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('line.copy() Function', () => {
    it('should validate line.copy()', () => {
      const code = `//@version=6
indicator("Line Copy")
originalLine = line.new(bar_index - 20, low, bar_index - 10, high, color=color.blue, width=2)
copiedLine = line.copy(originalLine)
line.set_x1(copiedLine, bar_index - 5)
line.set_x2(copiedLine, bar_index + 5)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate copying and modifying lines', () => {
      const code = `//@version=6
indicator("Copy and Modify Lines")
template = line.new(bar_index - 10, low, bar_index, high, color=color.blue, width=2, style=line.style_solid)
if close > open
    bullishLine = line.copy(template)
    line.set_color(bullishLine, color.green)
    line.set_style(bullishLine, line.style_arrow_right)
else
    bearishLine = line.copy(template)
    line.set_color(bearishLine, color.red)
    line.set_style(bearishLine, line.style_arrow_left)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('line.delete() Function', () => {
    it('should validate line.delete()', () => {
      const code = `//@version=6
indicator("Line Delete")
var line myLine = na
if bar_index % 20 == 0
    if not na(myLine)
        line.delete(myLine)
    myLine := line.new(bar_index, low, bar_index + 10, high)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate managing line limit with delete', () => {
      const code = `//@version=6
indicator("Line Management", max_lines_count=10)
var array<line> lines = array.new<line>()
if bar_index % 5 == 0
    newLine = line.new(bar_index, low, bar_index + 5, high)
    array.push(lines, newLine)
    if array.size(lines) > 10
        oldLine = array.shift(lines)
        line.delete(oldLine)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('line.all Variable', () => {
    it('should validate line.all for counting lines', () => {
      const code = `//@version=6
indicator("Count Lines")
if bar_index % 10 == 0
    line.new(bar_index, low, bar_index + 5, high)
lineCount = array.size(line.all)
plot(lineCount, "Total Lines")`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate iterating through line.all', () => {
      const code = `//@version=6
indicator("Iterate Lines")
if bar_index % 10 == 0
    line.new(bar_index, low, bar_index + 5, high)
if bar_index % 50 == 0
    for l in line.all
        line.set_color(l, color.red)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate cleaning old lines from line.all', () => {
      const code = `//@version=6
indicator("Clean Old Lines")
if bar_index % 5 == 0
    line.new(bar_index, low, bar_index + 3, high)
if bar_index % 100 == 0
    for l in line.all
        if line.get_x2(l) < bar_index - 50
            line.delete(l)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Line Complex Scenarios', () => {
    it('should validate pivot-based trendlines', () => {
      const code = `//@version=6
indicator("Pivot Trendlines")
leftBars = 5
rightBars = 5
ph = ta.pivothigh(high, leftBars, rightBars)
pl = ta.pivotlow(low, leftBars, rightBars)
var array<float> highPivots = array.new<float>()
var array<int> highPivotBars = array.new<int>()
var array<float> lowPivots = array.new<float>()
var array<int> lowPivotBars = array.new<int>()
if not na(ph)
    array.push(highPivots, ph)
    array.push(highPivotBars, bar_index - rightBars)
    if array.size(highPivots) >= 2
        line.new(array.get(highPivotBars, array.size(highPivotBars) - 2), array.get(highPivots, array.size(highPivots) - 2), array.get(highPivotBars, array.size(highPivotBars) - 1), array.get(highPivots, array.size(highPivots) - 1), color=color.red, extend=extend.right)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate channel lines', () => {
      const code = `//@version=6
indicator("Channel Lines")
basis = ta.ema(close, 20)
dev = ta.stdev(close, 20)
upperBand = basis + dev * 2
lowerBand = basis - dev * 2
var line upperLine = line.new(bar_index, upperBand, bar_index, upperBand)
var line middleLine = line.new(bar_index, basis, bar_index, basis)
var line lowerLine = line.new(bar_index, lowerBand, bar_index, lowerBand)
line.set_x1(upperLine, bar_index - 100)
line.set_y1(upperLine, upperBand)
line.set_x2(upperLine, bar_index)
line.set_y2(upperLine, upperBand)
line.set_x1(middleLine, bar_index - 100)
line.set_y1(middleLine, basis)
line.set_x2(middleLine, bar_index)
line.set_y2(middleLine, basis)
line.set_x1(lowerLine, bar_index - 100)
line.set_y1(lowerLine, lowerBand)
line.set_x2(lowerLine, bar_index)
line.set_y2(lowerLine, lowerBand)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate time-based lines with xloc.bar_time', () => {
      const code = `//@version=6
indicator("Time-Based Lines")
sessionStart = ta.change(time("D"))
var line sessionLine = na
var int sessionStartTime = na
if sessionStart
    sessionStartTime := time
    if not na(sessionLine)
        line.delete(sessionLine)
    sessionLine := line.new(sessionStartTime, low, sessionStartTime, low, xloc=xloc.bar_time)
if not na(sessionLine)
    line.set_xy2(sessionLine, time, high)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate gradient line visualization', () => {
      const code = `//@version=6
indicator("Gradient Lines", max_lines_count=50)
if bar_index % 2 == 0
    intensity = (close - ta.lowest(low, 50)) / (ta.highest(high, 50) - ta.lowest(low, 50))
    transparency = int((1 - intensity) * 80)
    line.new(bar_index, low, bar_index, high, color=color.new(color.blue, transparency), width=2)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate breakout lines', () => {
      const code = `//@version=6
indicator("Breakout Lines")
length = 20
highestHigh = ta.highest(high, length)
lowestLow = ta.lowest(low, length)
var line resistanceLine = line.new(bar_index - length, highestHigh, bar_index, highestHigh, extend=extend.right, color=color.red, style=line.style_dashed)
var line supportLine = line.new(bar_index - length, lowestLow, bar_index, lowestLow, extend=extend.right, color=color.green, style=line.style_dashed)
line.set_xy1(resistanceLine, bar_index - length, highestHigh)
line.set_xy2(resistanceLine, bar_index, highestHigh)
line.set_xy1(supportLine, bar_index - length, lowestLow)
line.set_xy2(supportLine, bar_index, lowestLow)
if close > highestHigh
    line.set_color(resistanceLine, color.green)
if close < lowestLow
    line.set_color(supportLine, color.red)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });
});

