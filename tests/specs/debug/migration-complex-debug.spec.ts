import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../../EnhancedModularValidator';

describe('Debug: migration complex integration', () => {
  it('prints unfiltered errors', () => {
    const code = `//@version=6
indicator("Complex Test", overlay=true)

// UDT definition
type PriceData
    float open
    float high
    float low
    float close
    int volume

// Enum definition
enum Trend
    BULLISH
    BEARISH
    SIDEWAYS

// Variables
var float sma_20 = na
var float sma_50 = na
varip int bar_count = 0
var Trend current_trend = Trend.SIDEWAYS

// Arrays
price_history = array.new<PriceData>(100)
signals = array.new<bool>(10)

// Functions
calculateSMA(source, length) =>
    ta.sma(source, length)

determineTrend() =>
    if sma_20 > sma_50
        Trend.BULLISH
    else if sma_20 < sma_50
        Trend.BEARISH
    else
        Trend.SIDEWAYS

// Main logic
sma_20 := calculateSMA(close, 20)
sma_50 := calculateSMA(close, 50)
current_trend := determineTrend()

// Update arrays
if barstate.isconfirmed
    bar_count := 0
    price_data = PriceData.new(open, high, low, close, volume)
    array.push(price_history, price_data)
    
    if array.size(price_history) > 100
        array.shift(price_history)
else
    bar_count += 1

// Switch statement
trend_color = switch current_trend
    Trend.BULLISH => color.green
    Trend.BEARISH => color.red
    Trend.SIDEWAYS => color.yellow
    => color.gray

// Conditional logic
if ta.crossover(sma_20, sma_50)
    array.push(signals, true)
    if array.size(signals) > 10
        array.shift(signals)
else if ta.crossunder(sma_20, sma_50)
    array.push(signals, false)
    if array.size(signals) > 10
        array.shift(signals)

// For loop
signal_count = 0
for i = 0 to array.size(signals) - 1
    if array.get(signals, i)
        signal_count += 1

// While loop
j = 0
sum_prices = 0.0
while j < math.min(array.size(price_history), 10)
    price_data = array.get(price_history, j)
    sum_prices += price_data.close
    j += 1

// Dynamic data request
htf_close = request.security(syminfo.tickerid, "1D", close)

// Plots
plot(close, "Close", color.blue)
plot(sma_20, "SMA 20", trend_color)
plot(sma_50, "SMA 50", color.orange)
plot(htf_close, "HTF Close", color.purple)

// Text formatting
trend_text = str.format("Trend: {0}, Signals: {1}, Bars: {2}", 
    str.tostring(current_trend), 
    str.tostring(signal_count), 
    str.tostring(bar_count))

// Background color
bgcolor(current_trend == Trend.BULLISH ? color.new(color.green, 90) : 
        current_trend == Trend.BEARISH ? color.new(color.red, 90) : 
        color.new(color.yellow, 95))`;

    const v = new EnhancedModularValidator({ targetVersion: 6, strictMode: true });
    const res = v.validate(code);
    const filtered = res.errors.filter(error => 
      !error.message.includes('Unknown function') &&
      !error.message.includes('Invalid array type') &&
      !error.message.includes("Function 'shift' should be in") &&
      !error.message.includes("Function 'new' should be in") &&
      !error.message.includes('While loop missing end') &&
      !error.message.includes('Parameter') &&
      !error.message.includes('Type mismatch') &&
      !error.message.includes('First assignment must use')
    );
    // eslint-disable-next-line no-console
    console.log('UNFILTERED ERRORS:', res.errors);
    // eslint-disable-next-line no-console
    console.log('FILTERED ERRORS:', filtered);
    expect(true).toBe(true);
  });
});

