import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('Plot Functions Validation', () => {
  const validator = new EnhancedModularValidator();

  describe('plot() Function', () => {
    it('should validate basic plot usage', () => {
      const code = `//@version=6
indicator("Basic Plot")
plot(close)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate plot with all parameters', () => {
      const code = `//@version=6
indicator("Full Plot")
plot(close, title="Close", color=color.blue, linewidth=2, style=plot.style_line, trackprice=true, histbase=0.0, offset=0, join=true, editable=true, show_last=20, display=display.all)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plot with conditional color', () => {
      const code = `//@version=6
indicator("Conditional Color")
myColor = close > open ? color.green : color.red
plot(close, color=myColor)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plot with style variations', () => {
      const code = `//@version=6
indicator("Plot Styles")
plot(close, style=plot.style_line)
plot(volume, style=plot.style_columns)
plot(high, style=plot.style_circles)
plot(low, style=plot.style_cross)
plot(hl2, style=plot.style_area)
plot(hlc3, style=plot.style_histogram)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plot with histbase', () => {
      const code = `//@version=6
indicator("Plot Histogram")
oscillator = ta.rsi(close, 14) - 50
plot(oscillator, style=plot.style_histogram, histbase=0)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plot with offset', () => {
      const code = `//@version=6
indicator("Plot Offset")
plot(close, offset=5)
plot(close, offset=-5)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plot with display options', () => {
      const code = `//@version=6
indicator("Plot Display")
plot(close, display=display.all)
plot(high, display=display.none)
plot(low, display=display.data_window)
plot(open, display=display.pane)
plot(volume, display=display.status_line)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('plotshape() Function', () => {
    it('should validate basic plotshape usage', () => {
      const code = `//@version=6
indicator("Basic Plotshape")
bullish = ta.crossover(ta.sma(close, 10), ta.sma(close, 20))
plotshape(bullish, style=shape.triangleup, location=location.belowbar, color=color.green)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plotshape with all parameters', () => {
      const code = `//@version=6
indicator("Full Plotshape")
signal = close > open
plotshape(signal, title="Signal", style=shape.circle, location=location.abovebar, color=color.blue, text="BUY", textcolor=color.white, offset=0, size=size.small, editable=true, show_last=20, display=display.all)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plotshape with different shapes', () => {
      const code = `//@version=6
indicator("Plotshape Shapes")
condition = close > open
plotshape(condition, style=shape.xcross)
plotshape(condition, style=shape.circle)
plotshape(condition, style=shape.triangleup)
plotshape(condition, style=shape.triangledown)
plotshape(condition, style=shape.flag)
plotshape(condition, style=shape.diamond)
plotshape(condition, style=shape.square)
plotshape(condition, style=shape.labelup)
plotshape(condition, style=shape.labeldown)
plotshape(condition, style=shape.arrowup)
plotshape(condition, style=shape.arrowdown)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plotshape with different locations', () => {
      const code = `//@version=6
indicator("Plotshape Locations")
signal = ta.crossover(close, ta.sma(close, 20))
plotshape(signal, location=location.abovebar)
plotshape(signal, location=location.belowbar)
plotshape(signal, location=location.top)
plotshape(signal, location=location.bottom)
plotshape(signal, location=location.absolute)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plotshape with different sizes', () => {
      const code = `//@version=6
indicator("Plotshape Sizes")
signal = close > open
plotshape(signal, size=size.tiny)
plotshape(signal, size=size.small)
plotshape(signal, size=size.normal)
plotshape(signal, size=size.large)
plotshape(signal, size=size.huge)
plotshape(signal, size=size.auto)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('plotchar() Function', () => {
    it('should validate basic plotchar usage', () => {
      const code = `//@version=6
indicator("Basic Plotchar")
buySignal = ta.crossover(ta.sma(close, 10), ta.sma(close, 20))
plotchar(buySignal, char="▲", location=location.belowbar, color=color.green)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plotchar with all parameters', () => {
      const code = `//@version=6
indicator("Full Plotchar")
signal = close > open
plotchar(signal, title="Buy", char="B", location=location.abovebar, color=color.blue, offset=0, text="Signal", textcolor=color.white, size=size.small, editable=true, show_last=20, display=display.all)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plotchar with different characters', () => {
      const code = `//@version=6
indicator("Plotchar Characters")
up = close > open
plotchar(up, char="↑")
plotchar(up, char="▲")
plotchar(up, char="●")
plotchar(up, char="★")
plotchar(up, char="✓")`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('plotarrow() Function', () => {
    it('should validate basic plotarrow usage', () => {
      const code = `//@version=6
indicator("Basic Plotarrow")
diff = close - close[1]
plotarrow(diff, colorup=color.green, colordown=color.red)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plotarrow with all parameters', () => {
      const code = `//@version=6
indicator("Full Plotarrow")
momentum = close - close[5]
plotarrow(momentum, title="Momentum", colorup=color.green, colordown=color.red, offset=0, minheight=5, maxheight=100, editable=true, show_last=20, display=display.all)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plotarrow with minheight and maxheight', () => {
      const code = `//@version=6
indicator("Plotarrow Height")
change = close - open
plotarrow(change, minheight=10, maxheight=50)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('plotcandle() Function', () => {
    it('should validate basic plotcandle usage', () => {
      const code = `//@version=6
indicator("Basic Plotcandle")
plotcandle(open, high, low, close)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plotcandle with all parameters', () => {
      const code = `//@version=6
indicator("Full Plotcandle")
haOpen = (open + close[1]) / 2
haClose = (open + high + low + close) / 4
haHigh = math.max(high, math.max(haOpen, haClose))
haLow = math.min(low, math.min(haOpen, haClose))
plotcandle(haOpen, haHigh, haLow, haClose, title="Heikin Ashi", color=color.green, wickcolor=color.red, bordercolor=color.blue, editable=true, show_last=20, display=display.all)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plotcandle with conditional colors', () => {
      const code = `//@version=6
indicator("Conditional Candle Colors")
bullish = close > open
candleColor = bullish ? color.green : color.red
wickColor = bullish ? color.new(color.green, 50) : color.new(color.red, 50)
plotcandle(open, high, low, close, color=candleColor, wickcolor=wickColor)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('plotbar() Function', () => {
    it('should validate basic plotbar usage', () => {
      const code = `//@version=6
indicator("Basic Plotbar")
plotbar(open, high, low, close)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plotbar with all parameters', () => {
      const code = `//@version=6
indicator("Full Plotbar")
smoothOpen = ta.ema(open, 5)
smoothHigh = ta.ema(high, 5)
smoothLow = ta.ema(low, 5)
smoothClose = ta.ema(close, 5)
plotbar(smoothOpen, smoothHigh, smoothLow, smoothClose, title="Smooth Bars", color=color.blue, editable=true, show_last=20, display=display.all)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plotbar with conditional colors', () => {
      const code = `//@version=6
indicator("Conditional Bar Colors")
barColor = close > close[1] ? color.green : color.red
plotbar(open, high, low, close, color=barColor)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('hline() Function', () => {
    it('should validate basic hline usage', () => {
      const code = `//@version=6
indicator("Basic Hline")
hline(0, "Zero Line")`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate hline with all parameters', () => {
      const code = `//@version=6
indicator("Full Hline")
hline(50, title="Midline", color=color.gray, linestyle=hline.style_solid, linewidth=2, editable=true, display=display.all)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate hline with different styles', () => {
      const code = `//@version=6
indicator("Hline Styles")
hline(80, linestyle=hline.style_solid)
hline(50, linestyle=hline.style_dashed)
hline(20, linestyle=hline.style_dotted)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate multiple hlines for overbought/oversold', () => {
      const code = `//@version=6
indicator("RSI Levels", overlay=false)
rsiValue = ta.rsi(close, 14)
plot(rsiValue)
hline(70, "Overbought", color.red)
hline(50, "Midline", color.gray)
hline(30, "Oversold", color.green)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('fill() Function', () => {
    it('should validate basic fill between plots', () => {
      const code = `//@version=6
indicator("Basic Fill")
sma1 = ta.sma(close, 10)
sma2 = ta.sma(close, 20)
p1 = plot(sma1, color=color.blue)
p2 = plot(sma2, color=color.red)
fill(p1, p2, color=color.new(color.gray, 90))`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate fill with all parameters', () => {
      const code = `//@version=6
indicator("Full Fill")
upper = ta.ema(close, 10) + ta.stdev(close, 10)
lower = ta.ema(close, 10) - ta.stdev(close, 10)
p1 = plot(upper)
p2 = plot(lower)
fill(p1, p2, color=color.new(color.blue, 90), title="Band Fill", editable=true, show_last=20, fillgaps=true)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate fill between hlines', () => {
      const code = `//@version=6
indicator("Fill Between Hlines", overlay=false)
rsi = ta.rsi(close, 14)
plot(rsi)
h1 = hline(70, "Overbought")
h2 = hline(30, "Oversold")
fill(h1, h2, color=color.new(color.gray, 90))`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate conditional fill color', () => {
      const code = `//@version=6
indicator("Conditional Fill")
ema10 = ta.ema(close, 10)
ema20 = ta.ema(close, 20)
p1 = plot(ema10)
p2 = plot(ema20)
fillColor = ema10 > ema20 ? color.new(color.green, 90) : color.new(color.red, 90)
fill(p1, p2, color=fillColor)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('bgcolor() Function', () => {
    it('should validate basic bgcolor usage', () => {
      const code = `//@version=6
indicator("Basic Bgcolor")
bullish = close > open
bgcolor(bullish ? color.new(color.green, 90) : na)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate bgcolor with all parameters', () => {
      const code = `//@version=6
indicator("Full Bgcolor")
condition = ta.crossover(ta.sma(close, 10), ta.sma(close, 20))
bgcolor(condition ? color.new(color.blue, 80) : na, offset=0, editable=true, show_last=20, title="Signal Background", display=display.all)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate bgcolor with multiple conditions', () => {
      const code = `//@version=6
indicator("Multi-condition Bgcolor")
strongBullish = close > open and volume > ta.sma(volume, 20)
strongBearish = close < open and volume > ta.sma(volume, 20)
bgcolor(strongBullish ? color.new(color.green, 80) : na)
bgcolor(strongBearish ? color.new(color.red, 80) : na)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate bgcolor with gradient effect', () => {
      const code = `//@version=6
indicator("Gradient Bgcolor")
rsi = ta.rsi(close, 14)
transparency = int(math.abs(50 - rsi) * 1.8)
bgColor = rsi > 50 ? color.new(color.green, transparency) : color.new(color.red, transparency)
bgcolor(bgColor)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate bgcolor highlighting specific sessions', () => {
      const code = `//@version=6
indicator("Session Bgcolor")
isNewYorkOpen = hour >= 9 and hour < 16
bgcolor(isNewYorkOpen ? color.new(color.blue, 95) : na)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Plot Return Values and References', () => {
    it('should validate storing plot references for fill', () => {
      const code = `//@version=6
indicator("Plot References")
sma10 = ta.sma(close, 10)
sma20 = ta.sma(close, 20)
sma30 = ta.sma(close, 30)
p1 = plot(sma10, color=color.blue)
p2 = plot(sma20, color=color.red)
p3 = plot(sma30, color=color.green)
fill(p1, p2, color.new(color.blue, 90))
fill(p2, p3, color.new(color.red, 90))`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate storing hline references for fill', () => {
      const code = `//@version=6
indicator("Hline References", overlay=false)
rsi = ta.rsi(close, 14)
plot(rsi)
overbought = hline(70, color=color.red)
midline = hline(50, color=color.gray)
oversold = hline(30, color=color.green)
fill(overbought, midline, color.new(color.red, 90))
fill(midline, oversold, color.new(color.green, 90))`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Plot Performance and Best Practices', () => {
    it('should validate plot with na handling', () => {
      const code = `//@version=6
indicator("Plot NA Handling")
condition = ta.crossover(ta.sma(close, 10), ta.sma(close, 20))
signalPrice = condition ? close : na
plot(signalPrice, style=plot.style_circles, linewidth=3, color=color.green)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate conditional plotting with ternary', () => {
      const code = `//@version=6
indicator("Conditional Plotting")
showMA = input.bool(true, "Show MA")
ma = ta.sma(close, 20)
plot(showMA ? ma : na, "MA", color.blue)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plot with series color', () => {
      const code = `//@version=6
indicator("Series Color")
rsi = ta.rsi(close, 14)
rsiColor = rsi > 70 ? color.red : rsi < 30 ? color.green : color.gray
plot(rsi, "RSI", color=rsiColor)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate multiple plot styles in one indicator', () => {
      const code = `//@version=6
indicator("Mixed Plots", overlay=false)
rsi = ta.rsi(close, 14)
plot(rsi, "RSI Line", color.blue, style=plot.style_line)
hline(70, "OB", color.red, linestyle=hline.style_dashed)
hline(30, "OS", color.green, linestyle=hline.style_dashed)
bgcolor(rsi > 70 ? color.new(color.red, 90) : rsi < 30 ? color.new(color.green, 90) : na)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Plot Edge Cases', () => {
    it('should validate plot with offset beyond lookback', () => {
      const code = `//@version=6
indicator("Large Offset")
plot(close, offset=50)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plot with negative offset', () => {
      const code = `//@version=6
indicator("Negative Offset")
futureMA = ta.sma(close, 10)
plot(futureMA, offset=-10)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plot with show_last parameter', () => {
      const code = `//@version=6
indicator("Show Last")
sma = ta.sma(close, 50)
plot(sma, show_last=100)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });

    it('should validate plot with trackprice', () => {
      const code = `//@version=6
indicator("Track Price")
vwap = ta.vwap
plot(vwap, "VWAP", color.yellow, trackprice=true)`;
      
      const result = validator.validateSource(code);
      expect(result.success).toBe(true);
    });
  });
});

