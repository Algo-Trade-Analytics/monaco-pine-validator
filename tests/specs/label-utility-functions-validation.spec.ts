import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('Label Utility Functions Validation', () => {
  const validator = new EnhancedModularValidator();

  describe('label.get_* Getter Functions', () => {
    it('should validate label.get_x()', () => {
      const code = `//@version=6
indicator("Label Get X")
var label myLabel = label.new(bar_index, high, "Test")
x = label.get_x(myLabel)
plot(x, "Label X Position")`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate label.get_y()', () => {
      const code = `//@version=6
indicator("Label Get Y")
var label myLabel = label.new(bar_index, high, "Test")
y = label.get_y(myLabel)
plot(y, "Label Y Position")`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate label.get_text()', () => {
      const code = `//@version=6
indicator("Label Get Text")
var label myLabel = label.new(bar_index, high, "Hello")
text = label.get_text(myLabel)
if bar_index % 10 == 0
    label.set_text(myLabel, text + "!")`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate retrieving all label properties', () => {
      const code = `//@version=6
indicator("Get All Label Props")
var label myLabel = label.new(bar_index, high, "Signal", color=color.blue)
x = label.get_x(myLabel)
y = label.get_y(myLabel)
text = label.get_text(myLabel)
plot(x, "X")
plot(y, "Y")`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('label.set_* Position Setters', () => {
    it('should validate label.set_x()', () => {
      const code = `//@version=6
indicator("Label Set X")
var label myLabel = label.new(bar_index, high, "Move")
if bar_index % 20 == 0
    label.set_x(myLabel, bar_index - 5)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate label.set_y()', () => {
      const code = `//@version=6
indicator("Label Set Y")
var label myLabel = label.new(bar_index, high, "Adjust")
newY = ta.highest(high, 10)
label.set_y(myLabel, newY)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate label.set_xy()', () => {
      const code = `//@version=6
indicator("Label Set XY")
var label myLabel = label.new(bar_index, high, "Position")
if bar_index % 20 == 0
    label.set_xy(myLabel, bar_index - 10, ta.highest(high, 20))`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate label.set_xloc()', () => {
      const code = `//@version=6
indicator("Label Set Xloc")
var label myLabel = label.new(bar_index, high, "Time", xloc=xloc.bar_index)
if bar_index % 20 == 0
    label.set_xloc(myLabel, xloc.bar_time)
    label.set_x(myLabel, time)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate dynamic label repositioning', () => {
      const code = `//@version=6
indicator("Dynamic Label Position")
var label floatingLabel = label.new(bar_index, close, "Tracking")
label.set_xy(floatingLabel, bar_index, close)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('label.set_text() and Text Styling', () => {
    it('should validate label.set_text()', () => {
      const code = `//@version=6
indicator("Label Set Text")
var label myLabel = label.new(bar_index, high, "Initial")
priceChange = (close - open) / open * 100
newText = str.format("Change: {0,number,#.##}%", priceChange)
label.set_text(myLabel, newText)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate label.set_text_color()', () => {
      const code = `//@version=6
indicator("Label Text Color")
var label myLabel = label.new(bar_index, high, "Signal")
bullish = close > open
textColor = bullish ? color.green : color.red
label.set_text_color(myLabel, textColor)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate label.set_textcolor() (deprecated alias)', () => {
      const code = `//@version=6
indicator("Label Textcolor")
var label myLabel = label.new(bar_index, high, "Old Style")
label.set_textcolor(myLabel, color.white)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate label.set_text_size()', () => {
      const code = `//@version=6
indicator("Label Text Size")
var label myLabel = label.new(bar_index, high, "Sized", text_size=size.normal)
label.set_text_size(myLabel, size.large)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate all text sizes', () => {
      const code = `//@version=6
indicator("All Label Text Sizes")
var label tiny = label.new(bar_index - 50, high * 1.05, "Tiny")
var label small = label.new(bar_index - 40, high * 1.05, "Small")
var label normal = label.new(bar_index - 30, high * 1.05, "Normal")
var label large = label.new(bar_index - 20, high * 1.05, "Large")
var label huge = label.new(bar_index - 10, high * 1.05, "Huge")
label.set_text_size(tiny, size.tiny)
label.set_text_size(small, size.small)
label.set_text_size(normal, size.normal)
label.set_text_size(large, size.large)
label.set_text_size(huge, size.huge)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate label.set_text_font_family()', () => {
      const code = `//@version=6
indicator("Label Font Family")
var label myLabel = label.new(bar_index, high, "Monospace Text")
label.set_text_font_family(myLabel, font.family_monospace)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate all font families', () => {
      const code = `//@version=6
indicator("All Font Families")
var label defaultFont = label.new(bar_index - 20, high * 1.1, "Default")
var label monoFont = label.new(bar_index - 10, high * 1.1, "Mono")
label.set_text_font_family(defaultFont, font.family_default)
label.set_text_font_family(monoFont, font.family_monospace)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('label.set_color() Background Color', () => {
    it('should validate label.set_color()', () => {
      const code = `//@version=6
indicator("Label Background Color")
var label myLabel = label.new(bar_index, high, "Colored", color=color.blue)
bullish = close > open
bgColor = bullish ? color.green : color.red
label.set_color(myLabel, bgColor)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate label.set_color() with transparency', () => {
      const code = `//@version=6
indicator("Label Color Transparency")
var label myLabel = label.new(bar_index, high, "Transparent")
strength = math.abs(close - open) / ta.atr(14)
transparency = int(100 - (strength * 50))
label.set_color(myLabel, color.new(color.blue, transparency))`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate label.set_color() with na for no background', () => {
      const code = `//@version=6
indicator("Label No Background")
var label myLabel = label.new(bar_index, high, "No BG")
label.set_color(myLabel, color.new(color.blue, 100))`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('label.set_style() and Styles', () => {
    it('should validate label.set_style() with label_up', () => {
      const code = `//@version=6
indicator("Label Style Up")
var label myLabel = label.new(bar_index, low, "▲", yloc=yloc.belowbar)
label.set_style(myLabel, label.style_label_up)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate label.set_style() with label_down', () => {
      const code = `//@version=6
indicator("Label Style Down")
var label myLabel = label.new(bar_index, high, "▼", yloc=yloc.abovebar)
label.set_style(myLabel, label.style_label_down)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate all label styles', () => {
      const code = `//@version=6
indicator("All Label Styles")
var label up = label.new(bar_index - 70, low * 0.98, "Up", yloc=yloc.price)
var label down = label.new(bar_index - 60, high * 1.02, "Down", yloc=yloc.price)
var label left = label.new(bar_index - 50, close, "Left", yloc=yloc.price)
var label right = label.new(bar_index - 40, close, "Right", yloc=yloc.price)
var label center = label.new(bar_index - 30, close, "Center", yloc=yloc.price)
var label upperLeft = label.new(bar_index - 20, high * 1.05, "UL", yloc=yloc.price)
var label upperRight = label.new(bar_index - 10, high * 1.05, "UR", yloc=yloc.price)
var label lowerLeft = label.new(bar_index - 5, low * 0.95, "LL", yloc=yloc.price)
var label lowerRight = label.new(bar_index, low * 0.95, "LR", yloc=yloc.price)
label.set_style(up, label.style_label_up)
label.set_style(down, label.style_label_down)
label.set_style(left, label.style_label_left)
label.set_style(right, label.style_label_right)
label.set_style(center, label.style_label_center)
label.set_style(upperLeft, label.style_label_upper_left)
label.set_style(upperRight, label.style_label_upper_right)
label.set_style(lowerLeft, label.style_label_lower_left)
label.set_style(lowerRight, label.style_label_lower_right)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate all arrow styles', () => {
      const code = `//@version=6
indicator("All Arrow Styles")
var label arrowUp = label.new(bar_index - 30, low * 0.99, "↑", yloc=yloc.price)
var label arrowDown = label.new(bar_index - 20, high * 1.01, "↓", yloc=yloc.price)
var label arrowLeft = label.new(bar_index - 10, close, "←", yloc=yloc.price)
var label arrowRight = label.new(bar_index, close, "→", yloc=yloc.price)
label.set_style(arrowUp, label.style_arrow_up)
label.set_style(arrowDown, label.style_arrow_down)
label.set_style(arrowLeft, label.style_arrow_left)
label.set_style(arrowRight, label.style_arrow_right)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate geometric shape styles', () => {
      const code = `//@version=6
indicator("Geometric Shapes")
var label circle = label.new(bar_index - 40, high * 1.05, "●")
var label square = label.new(bar_index - 30, high * 1.05, "■")
var label diamond = label.new(bar_index - 20, high * 1.05, "◆")
var label triangleUp = label.new(bar_index - 10, low * 0.95, "▲")
var label triangleDown = label.new(bar_index, high * 1.05, "▼")
label.set_style(circle, label.style_circle)
label.set_style(square, label.style_square)
label.set_style(diamond, label.style_diamond)
label.set_style(triangleUp, label.style_triangleup)
label.set_style(triangleDown, label.style_triangledown)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate flag and xcross styles', () => {
      const code = `//@version=6
indicator("Flag and Cross")
var label flag = label.new(bar_index - 20, high, "F")
var label xcross = label.new(bar_index - 10, high, "X")
var label none = label.new(bar_index, high, "Plain")
label.set_style(flag, label.style_flag)
label.set_style(xcross, label.style_xcross)
label.set_style(none, label.style_none)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('label.set_size() Function', () => {
    it('should validate label.set_size()', () => {
      const code = `//@version=6
indicator("Label Set Size")
var label myLabel = label.new(bar_index, high, "●", style=label.style_circle)
label.set_size(myLabel, size.large)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate all label sizes', () => {
      const code = `//@version=6
indicator("All Label Sizes")
var label tiny = label.new(bar_index - 50, high * 1.05, "●", style=label.style_circle)
var label small = label.new(bar_index - 40, high * 1.05, "●", style=label.style_circle)
var label normal = label.new(bar_index - 30, high * 1.05, "●", style=label.style_circle)
var label large = label.new(bar_index - 20, high * 1.05, "●", style=label.style_circle)
var label huge = label.new(bar_index - 10, high * 1.05, "●", style=label.style_circle)
label.set_size(tiny, size.tiny)
label.set_size(small, size.small)
label.set_size(normal, size.normal)
label.set_size(large, size.large)
label.set_size(huge, size.huge)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('label.set_text_align() Function', () => {
    it('should validate label.set_text_align() left', () => {
      const code = `//@version=6
indicator("Text Align Left")
var label myLabel = label.new(bar_index, high, "Left Aligned")
label.set_text_align(myLabel, text.align_left)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate label.set_text_align() center', () => {
      const code = `//@version=6
indicator("Text Align Center")
var label myLabel = label.new(bar_index, high, "Centered")
label.set_text_align(myLabel, text.align_center)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate label.set_text_align() right', () => {
      const code = `//@version=6
indicator("Text Align Right")
var label myLabel = label.new(bar_index, high, "Right Aligned")
label.set_text_align(myLabel, text.align_right)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('label.set_yloc() Function', () => {
    it('should validate label.set_yloc() with yloc.price', () => {
      const code = `//@version=6
indicator("YLoc Price")
var label myLabel = label.new(bar_index, high, "Price", yloc=yloc.abovebar)
label.set_yloc(myLabel, yloc.price)
label.set_y(myLabel, close)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate label.set_yloc() with yloc.abovebar', () => {
      const code = `//@version=6
indicator("YLoc Above Bar")
var label myLabel = label.new(bar_index, close, "Above", yloc=yloc.price)
label.set_yloc(myLabel, yloc.abovebar)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate label.set_yloc() with yloc.belowbar', () => {
      const code = `//@version=6
indicator("YLoc Below Bar")
var label myLabel = label.new(bar_index, close, "Below", yloc=yloc.price)
label.set_yloc(myLabel, yloc.belowbar)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('label.set_tooltip() Function', () => {
    it('should validate label.set_tooltip()', () => {
      const code = `//@version=6
indicator("Label Tooltip")
var label myLabel = label.new(bar_index, high, "●", style=label.style_circle)
tooltip = str.format("Price: {0,number,#.##}\\nVolume: {1}", close, volume)
label.set_tooltip(myLabel, tooltip)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate dynamic tooltip updates', () => {
      const code = `//@version=6
indicator("Dynamic Tooltip")
var label infoLabel = label.new(bar_index, high, "ℹ")
rsi = ta.rsi(close, 14)
macd = ta.macd(close, 12, 26, 9)
[macdLine, signalLine, hist] = macd
tooltip = str.format("RSI: {0,number,#.##}\\nMACD: {1,number,#.##}", rsi, macdLine)
label.set_tooltip(infoLabel, tooltip)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('label.copy() Function', () => {
    it('should validate label.copy()', () => {
      const code = `//@version=6
indicator("Label Copy")
original = label.new(bar_index - 20, high, "Original", color=color.blue, textcolor=color.white)
copied = label.copy(original)
label.set_x(copied, bar_index - 10)
label.set_text(copied, "Copy")`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate copying and modifying labels', () => {
      const code = `//@version=6
indicator("Copy and Modify")
template = label.new(bar_index, high, "Template", color=color.gray, style=label.style_label_down)
if close > open
    bullLabel = label.copy(template)
    label.set_color(bullLabel, color.green)
    label.set_text(bullLabel, "BUY")
    label.set_text_color(bullLabel, color.white)
else
    bearLabel = label.copy(template)
    label.set_color(bearLabel, color.red)
    label.set_text(bearLabel, "SELL")
    label.set_text_color(bearLabel, color.white)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('label.delete() Function', () => {
    it('should validate label.delete()', () => {
      const code = `//@version=6
indicator("Label Delete")
var label myLabel = na
if bar_index % 20 == 0
    if not na(myLabel)
        label.delete(myLabel)
    myLabel := label.new(bar_index, high, "New")`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate managing label limit with delete', () => {
      const code = `//@version=6
indicator("Label Management", max_labels_count=10)
var array<label> labels = array.new<label>()
if bar_index % 5 == 0
    newLabel = label.new(bar_index, high, str.tostring(bar_index))
    array.push(labels, newLabel)
    if array.size(labels) > 10
        oldLabel = array.shift(labels)
        label.delete(oldLabel)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('label.all Variable', () => {
    it('should validate label.all for counting labels', () => {
      const code = `//@version=6
indicator("Count Labels")
if bar_index % 10 == 0
    label.new(bar_index, high, str.tostring(bar_index))
labelCount = array.size(label.all)
plot(labelCount, "Total Labels")`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate iterating through label.all', () => {
      const code = `//@version=6
indicator("Iterate Labels")
if bar_index % 10 == 0
    label.new(bar_index, high, "Label")
if bar_index % 50 == 0
    for l in label.all
        label.set_color(l, color.red)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate cleaning old labels from label.all', () => {
      const code = `//@version=6
indicator("Clean Old Labels")
if bar_index % 5 == 0
    label.new(bar_index, high, "Temp")
if bar_index % 100 == 0
    for l in label.all
        if label.get_x(l) < bar_index - 50
            label.delete(l)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Label Complex Scenarios', () => {
    it('should validate pivot labels', () => {
      const code = `//@version=6
indicator("Pivot Labels")
leftBars = 5
rightBars = 5
ph = ta.pivothigh(high, leftBars, rightBars)
pl = ta.pivotlow(low, leftBars, rightBars)
if not na(ph)
    label.new(bar_index - rightBars, ph, "H", yloc=yloc.abovebar, color=color.red, textcolor=color.white, style=label.style_label_down)
if not na(pl)
    label.new(bar_index - rightBars, pl, "L", yloc=yloc.belowbar, color=color.green, textcolor=color.white, style=label.style_label_up)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate price level labels', () => {
      const code = `//@version=6
indicator("Price Levels")
var label highLabel = label.new(bar_index, 0, "", yloc=yloc.price, style=label.style_label_left)
var label lowLabel = label.new(bar_index, 0, "", yloc=yloc.price, style=label.style_label_left)
currentHigh = ta.highest(high, 20)
currentLow = ta.lowest(low, 20)
label.set_xy(highLabel, bar_index, currentHigh)
label.set_text(highLabel, str.format("High: {0,number,#.##}", currentHigh))
label.set_color(highLabel, color.new(color.red, 80))
label.set_xy(lowLabel, bar_index, currentLow)
label.set_text(lowLabel, str.format("Low: {0,number,#.##}", currentLow))
label.set_color(lowLabel, color.new(color.green, 80))`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate signal labels with tooltips', () => {
      const code = `//@version=6
indicator("Signal Labels")
bullishCross = ta.crossover(ta.ema(close, 10), ta.ema(close, 20))
bearishCross = ta.crossunder(ta.ema(close, 10), ta.ema(close, 20))
if bullishCross
    lbl = label.new(bar_index, low, "▲", yloc=yloc.belowbar, color=color.green, textcolor=color.white, style=label.style_triangleup)
    tooltip = str.format("Bullish Cross\\nPrice: {0}\\nVolume: {1}", close, volume)
    label.set_tooltip(lbl, tooltip)
if bearishCross
    lbl = label.new(bar_index, high, "▼", yloc=yloc.abovebar, color=color.red, textcolor=color.white, style=label.style_triangledown)
    tooltip = str.format("Bearish Cross\\nPrice: {0}\\nVolume: {1}", close, volume)
    label.set_tooltip(lbl, tooltip)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate percentage change labels', () => {
      const code = `//@version=6
indicator("Percentage Labels")
sessionStart = ta.change(time("D"))
var float sessionOpenPrice = na
var label changeLabel = na
if sessionStart
    sessionOpenPrice := open
    if not na(changeLabel)
        label.delete(changeLabel)
    changeLabel := label.new(bar_index, high, "", yloc=yloc.abovebar)
if not na(sessionOpenPrice) and not na(changeLabel)
    percentChange = (close - sessionOpenPrice) / sessionOpenPrice * 100
    label.set_x(changeLabel, bar_index)
    label.set_text(changeLabel, str.format("{0,number,+#.##;-#.##}%", percentChange))
    label.set_color(changeLabel, percentChange > 0 ? color.green : color.red)
    label.set_text_color(changeLabel, color.white)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate multi-timeframe labels', () => {
      const code = `//@version=6
indicator("MTF Labels", overlay=true)
htfClose = request.security(syminfo.tickerid, "D", close)
htfChange = (htfClose - htfClose[1]) / htfClose[1] * 100
if barstate.islast
    lbl = label.new(bar_index, high * 1.05, "", yloc=yloc.price)
    label.set_text(lbl, str.format("Daily Change: {0,number,+#.##;-#.##}%", htfChange))
    label.set_color(lbl, htfChange > 0 ? color.new(color.green, 80) : color.new(color.red, 80))
    label.set_text_color(lbl, color.white)
    label.set_style(lbl, label.style_label_down)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate informational label panel', () => {
      const code = `//@version=6
indicator("Info Panel")
var label infoPanel = na
if barstate.islast
    if not na(infoPanel)
        label.delete(infoPanel)
    rsi = ta.rsi(close, 14)
    [macd, signal, hist] = ta.macd(close, 12, 26, 9)
    atr = ta.atr(14)
    info = str.format("RSI: {0,number,#.##}\\nMACD: {1,number,#.##}\\nATR: {2,number,#.##}", rsi, macd, atr)
    infoPanel := label.new(bar_index + 5, high, info, yloc=yloc.price, style=label.style_label_left, color=color.new(color.gray, 20), textcolor=color.white, text_size=size.small)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });
});

