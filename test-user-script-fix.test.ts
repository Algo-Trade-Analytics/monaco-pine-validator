import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Test User Script Fix', () => {
  it('should validate the user script without indentation errors', () => {
    const code = `//@version=6
strategy("TrendMaster Pro 2.3 with Alerts", max_lines_count = 500, overlay = true)

// === TrendMaster Pro 2.3 Settings ===
// Dropdown menu for MA type (with names, defaulting to SMA)
maType = input.string("SMA", title="MA Type", options=["EMA", "SMA", "SMMA"], group="MA Settings", 
     tooltip="Select the type of Moving Average: EMA, SMA, or SMMA.")

// Trend filter settings (disabled by default)
enableTrendFilter = input.bool(false, title="Enable Higher Timeframe Trend", group="Higher Timeframe Trend", 
     tooltip="If enabled, only trades in the trend direction will be executed.")
trendMaType = input.string("EMA", title="Trend MA Type", options=["EMA", "SMA", "SMMA"], group="Higher Timeframe Trend", 
     tooltip="Select the type of Moving Average for the higher timeframe trend.")
trendMaLength = input.int(50, title="Trend MA Length", group="Higher Timeframe Trend", 
     tooltip="The length of the Moving Average for the higher timeframe trend.")

// Cross settings (only EMA settings visible)
shortMALength = input.int(9, title="Short-Term MA Length", group="MA Settings", 
     tooltip="The length of the short Moving Average used for signal generation.")
longMALength = input.int(21, title="Long-Term MA Length", group="MA Settings", 
     tooltip="The length of the long Moving Average used for signal generation.")

// === Fixed Values for Hidden Settings ===
// ATR Settings (fixed)
atrLength = 14
useAtrMultiplier = true
atrMultiplierSL = 2.0

// Bollinger Bands Settings (fixed)
useVolatilityFilter = true
useTrendFilter = true
bbLength = 20
bbMultiplier = 2.0

// RSI Settings (fixed)
useRSI = true
rsiLength = 14
rsiLongThreshold = 55
rsiShortThreshold = 45

// MACD Settings (fixed)
useMACD = true
macdFastLength = 12
macdSlowLength = 26
macdSignalSmoothing = 9

// Stochastic Settings (
useStochastic = true
stochLength = 14
stochSmoothing = 3
stochOverbought = 80
stochOversold = 20

// ADX Settings (fixed)
useADX = true
adxLength = 14
adxThreshold = 25

// Fixed Values for TP/SL
riskRewardRatio = 2.0  // Fixed value for the risk-reward ratio
slTicksOffset = 5      // Fixed value for the SL ticks offset

// === Band Power Settings ===
bandLength = input.int(20, title="Band Length", minval=1, group="Band Power", tooltip="The length of the bands. A higher length smooths the bands more but reacts slower to price changes.")
bandType = input.int(2, title="Band Type", options=[1, 2, 3], group="Band Power", 
     tooltip="1 = Fast, more noise, good for volatile markets.\\n2 = Medium, balanced, good for general use.\\n3 = Slow, very smooth, good for calm markets.")

// === Support & Resistance Settings ===
showSupportResistance = input.bool(false, title="Show Support & Resistance", group="Support & Resistance")
pivotTypeInput = input.string(title="Calculation Method", defval="Traditional", options=["Traditional", "Fibonacci", "Woodie", "Classic", "DM", "Camarilla"], group="Support & Resistance")
pivotAnchorInput = input.string(title="Timeframe", defval="Auto", options=["Auto", "Daily", "Weekly", "Monthly", "Quarterly", "Yearly", "Biyearly", "Triyearly", "Quinquennially", "Decennially"], group="Support & Resistance")
isDailyBasedInput = input.bool(title="Use Daily-Based Values", defval=true, group="Support & Resistance", tooltip="If disabled, the support/resistance levels use intraday data for calculations on intraday charts.")
maxHistoricalPivotsInput = input.int(title="Number of Historical Levels", defval=1, minval=1, maxval=200, group="Support & Resistance")

// Display Options
showLabelsInput = input.bool(title="Show Labels", defval=true, group="Display Options")
showPricesInput = input.bool(title="Show Prices", defval=true, group="Display Options")
positionLabelsInput = input.string("Left", "Label Position", options=["Left", "Right"], group="Display Options")
linewidthInput = input.int(title="Line Width", defval=1, minval=1, maxval=100, group="Display Options")

// Colors
var DEFAULT_COLOR = #FB8C00
pColorInput = input.color(DEFAULT_COLOR, "Midline", inline="Midline", group="Colors")
pShowInput = input.bool(true, "", inline="Midline", group="Colors")
s1ColorInput = input.color(DEFAULT_COLOR, "S1", inline="S1/R1", group="Colors")
s1ShowInput = input.bool(true, "", inline="S1/R1", group="Colors")
r1ColorInput = input.color(DEFAULT_COLOR, "R1", inline="S1/R1", group="Colors")
r1ShowInput = input.bool(true, "", inline="S1/R1", group="Colors")
s2ColorInput = input.color(DEFAULT_COLOR, "S2", inline="S2/R2", group="Colors")
s2ShowInput = input.bool(true, "", inline="S2/R2", group="Colors")
r2ColorInput = input.color(DEFAULT_COLOR, "R2", inline="S2/R2", group="Colors")
r2ShowInput = input.bool(true, "", inline="S2/R2", group="Colors")
s3ColorInput = input.color(DEFAULT_COLOR, "S3", inline="S3/R3", group="Colors")
s3ShowInput = input.bool(true, "", inline="S3/R3", group="Colors")
r3ColorInput = input.color(DEFAULT_COLOR, "R3", inline="S3/R3", group="Colors")
r3ShowInput = input.bool(true, "", inline="S3/R3", group="Colors")
s4ColorInput = input.color(DEFAULT_COLOR, "S4", inline="S4/R4", group="Colors")
s4ShowInput = input.bool(true, "", inline="S4/R4", group="Colors")
r4ColorInput = input.color(DEFAULT_COLOR, "R4", inline="S4/R4", group="Colors")
r4ShowInput = input.bool(true, "", inline="S4/R4", group="Colors")
s5ColorInput = input.color(DEFAULT_COLOR, "S5", inline="S5/R5", group="Colors")
s5ShowInput = input.bool(true, "", inline="S5/R5", group="Colors")
r5ColorInput = input.color(DEFAULT_COLOR, "R5", inline="S5/R5", group="Colors")
r5ShowInput = input.bool(true, "", inline="S5/R5", group="Colors")

// === Indicator Calculations ===
// Calculate ATR
atr = ta.atr(atrLength)

// Calculate Stop-Loss
stopLossOffset = useAtrMultiplier ? atr * atrMultiplierSL : atr

// Calculate SMMA
smma(src, len) =>
    smma = 0.0
    smma := na(smma[1]) ? ta.sma(src, len) : (smma[1] * (len - 1) + src) / len
    smma

// Moving Averages for Signals
shortMA = maType == "EMA" ? ta.ema(close, shortMALength) : maType == "SMA" ? ta.sma(close, shortMALength) : smma(close, shortMALength)
longMA = maType == "EMA" ? ta.ema(close, longMALength) : maType == "SMA" ? ta.sma(close, longMALength) : smma(close, longMALength)
buyCondition = ta.crossover(shortMA, longMA)  // Buy-Signal
sellCondition = ta.crossunder(shortMA, longMA) // Sell-Signal

// Debug
// plot(shortMA, title = 'Short MA', linewidth = 2, color = color.purple)
// plot(longMA, title = 'Long MA', linewidth = 2, color = color.orange)

// (c) @alexgrover
// https://www.tradingview.com/script/gD1gDOyI-Intersection-Value-Functions/
_getSlopes(float source1, float source2) =>
	m1  =  ta.change(source1) 
	m2  =  ta.change(source2)
	[m1 , m2]

_commonScalingFactor(float source1, float source2, float m1, float m2) => 
	(source1 - source2) / (m1 - m2) 

_crossingValue(float source1, float source2) =>
	float out = na
	[m1, m2] = _getSlopes(source1, source2)
	if ta.cross(source1, source2)
		// Find intersection value
		out := source1 - m1 * _commonScalingFactor(source1, source2, m1, m2)
	out

var float maCrossValue = na
if ta.cross(shortMA, longMA)
    maCrossValue := _crossingValue(shortMA, longMA)

// Debug
// plot(maCrossValue, color = color.yellow)

//---

// Calculate Trend-MA
trendMA = trendMaType == "EMA" ? ta.ema(close, trendMaLength) : trendMaType == "SMA" ? ta.sma(close, trendMaLength) : smma(close, trendMaLength)

// Trend Filter Conditions
trendFilterLong = not enableTrendFilter or close > trendMA
trendFilterShort = not enableTrendFilter or close < trendMA

// Calculate Bollinger Bands (only if one of the filters is enabled)
var float basis = na
var float upperBand = na
var float lowerBand = na
if (useVolatilityFilter or useTrendFilter)
    basis := ta.sma(close, bbLength)
    dev = ta.stdev(close, bbLength)
    upperBand := basis + bbMultiplier * dev
    lowerBand := basis - bbMultiplier * dev

// Volatility Filter: Only trade if the bands are wide enough (no ranging phase)
atrValue = ta.atr(bbLength)  // ATR value for volatility calculation
volatilityFilter = not useVolatilityFilter or (upperBand - lowerBand) > (atrValue * bbMultiplier)

// Trend Filter: Only trade if the price closes above/below the middle band (if enabled)
bbTrendFilterLong = not useTrendFilter or close > basis  // Confirmation for an uptrend
bbTrendFilterShort = not useTrendFilter or close < basis // Confirmation for a downtrend

// Calculate RSI
rsi = ta.rsi(close, rsiLength)

// RSI Filter for Signals
rsiFilterLong = not useRSI or rsi > rsiLongThreshold  // Bullish momentum for Long
rsiFilterShort = not useRSI or rsi < rsiShortThreshold  // Bearish momentum for Short

// Calculate MACD
[macdLine, signalLine, _] = ta.macd(close, macdFastLength, macdSlowLength, macdSignalSmoothing)

// MACD Filter for Signals
macdFilterLong = not useMACD or macdLine > signalLine  // MACD line above signal line for Long
macdFilterShort = not useMACD or macdLine < signalLine  // MACD line below signal line for Short

// Calculate Stochastic
k = ta.sma(ta.stoch(close, high, low, stochLength), stochSmoothing)
d = ta.sma(k, stochSmoothing)

// Stochastic Filter for Signals
stochFilterLong = not useStochastic or k > stochOversold and k > d  // Oversold and rising momentum for Long
stochFilterShort = not useStochastic or k < stochOverbought and k < d  // Overbought and falling momentum for Short

// Calculate ADX (with ta.dmi)
[plusDI, minusDI, adx] = ta.dmi(adxLength, adxLength)

// ADX Filter for Signals
adxFilter = not useADX or adx > adxThreshold  // Only trade if the trend is strong

// Buy and Sell Conditions with All Filters
buyConditionFiltered = buyCondition and volatilityFilter and bbTrendFilterLong and rsiFilterLong and macdFilterLong and stochFilterLong and adxFilter and trendFilterLong
sellConditionFiltered = sellCondition and volatilityFilter and bbTrendFilterShort and rsiFilterShort and macdFilterShort and stochFilterShort and adxFilter and trendFilterShort

// === Band Power Calculations ===
maHigh = if bandType == 1
    ta.ema(high, bandLength)  // EMA for High (fast, more noise)
else if bandType == 2
    ta.sma(high, bandLength)  // SMA for High (medium, balanced)
else
    smma(high, bandLength)    // SMMA for High (slow, very smooth)

maLow = if bandType == 1
    ta.ema(low, bandLength)   // EMA for Low (fast, more noise)
else if bandType == 2
    ta.sma(low, bandLength)   // SMA for Low (medium, balanced)
else
    smma(low, bandLength)     // SMMA for Low (slow, very smooth)

// === Plot Bands (thinnest version) ===
plot(maHigh, color=color.green, title="High Band", linewidth=1)
plot(maLow, color=color.red, title="Low Band", linewidth=1)`;

    const validator = new EnhancedModularValidator();
    const result = validator.validate(code);

    console.log('\n=== USER SCRIPT VALIDATION ===');
    console.log('Total errors:', result.errors.length);
    
    const indentErrors = result.errors.filter(e => e.code.includes('INDENT'));
    console.log('Indentation errors:', indentErrors.length);
    
    if (indentErrors.length > 0) {
      console.log('\nRemaining indentation errors:');
      indentErrors.forEach((error, i) => {
        console.log(`${i + 1}. Line ${error.line}: ${error.code} - ${error.message}`);
      });
    } else {
      console.log('✅ No indentation errors found!');
    }
    
    // Check for other types of errors
    const otherErrors = result.errors.filter(e => !e.code.includes('INDENT'));
    console.log('Other errors:', otherErrors.length);
    
    if (otherErrors.length > 0) {
      console.log('\nOther errors:');
      otherErrors.slice(0, 10).forEach((error, i) => {
        console.log(`${i + 1}. Line ${error.line}: ${error.code} - ${error.message}`);
      });
      if (otherErrors.length > 10) {
        console.log(`... and ${otherErrors.length - 10} more errors`);
      }
    }
  });
});
