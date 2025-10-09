import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

const createValidator = () => new EnhancedModularValidator({
  targetVersion: 6,
  strictMode: true,
});

describe('PSV6-TA-FUNCTIONS: TA Functions Validation (TDD)', () => {
  describe('PSV6-TA-MOVING-AVERAGES: Moving Average Functions', () => {
    it('should validate ta.sma() function', () => {
      const code = `
//@version=6
indicator("SMA Test")

smaValue = ta.sma(close, 14)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.ema() function', () => {
      const code = `
//@version=6
indicator("EMA Test")

emaValue = ta.ema(close, 21)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.rma() function', () => {
      const code = `
//@version=6
indicator("RMA Test")

rmaValue = ta.rma(close, 14)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.wma() function', () => {
      const code = `
//@version=6
indicator("WMA Test")

wmaValue = ta.wma(close, 20)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.vwma() function', () => {
      const code = `
//@version=6
indicator("VWMA Test")

vwmaValue = ta.vwma(close, 20)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.swma() function', () => {
      const code = `
//@version=6
indicator("SWMA Test")

swmaValue = ta.swma(close, 10)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.alma() function', () => {
      const code = `
//@version=6
indicator("ALMA Test")

almaValue = ta.alma(close, 9, 0.85, 6)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.hma() function', () => {
      const code = `
//@version=6
indicator("HMA Test")

hmaValue = ta.hma(close, 20)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid moving average parameters', () => {
      const code = `
//@version=6
indicator("Invalid MA Test")

invalidSma = ta.sma(close, -5)
invalidEma = ta.ema("string", 14)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-TA-FUNCTION-PARAM')).toBe(true);
    });
  });

  describe('PSV6-TA-OSCILLATORS: Oscillator Functions', () => {
    it('should validate ta.rsi() function', () => {
      const code = `
//@version=6
indicator("RSI Test")

rsiValue = ta.rsi(close, 14)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.stoch() function', () => {
      const code = `
//@version=6
indicator("Stochastic Test")

stochValue = ta.stoch(close, high, low, 14)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.cci() function', () => {
      const code = `
//@version=6
indicator("CCI Test")

cciValue = ta.cci(hlc3, 20)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.mfi() function', () => {
      const code = `
//@version=6
indicator("MFI Test")

mfiValue = ta.mfi(hlc3, volume, 14)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.cmo() function', () => {
      const code = `
//@version=6
indicator("CMO Test")

cmoValue = ta.cmo(close, 14)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.tsi() function', () => {
      const code = `
//@version=6
indicator("TSI Test")

tsiValue = ta.tsi(close, 25, 13)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.wpr() function', () => {
      const code = `
//@version=6
indicator("WPR Test")

wprValue = ta.wpr(14)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.macd() function', () => {
      const code = `
//@version=6
indicator("MACD Test")

[macdLine, signalLine, histogram] = ta.macd(close, 12, 26, 9)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid oscillator parameters', () => {
      const code = `
//@version=6
indicator("Invalid Oscillator Test")

invalidRsi = ta.rsi(close, -5)
invalidStoch = ta.stoch(close, high, "string", 14)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-TA-FUNCTION-PARAM')).toBe(true);
    });

    it('should error when oscillator length argument is a string variable', () => {
      const code = `
//@version=6
indicator("RSI Length Type Test")

rsiLength = 'jl'
rsi = ta.rsi(close, rsiLength)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.some(e => e.code === 'PSV6-TA-FUNCTION-PARAM')).toBe(true);
      expect(result.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-TYPE')).toBe(true);
    });
  });

  describe('PSV6-TA-BANDS: Band Functions', () => {
    it('should validate ta.bb() function', () => {
      const code = `
//@version=6
indicator("Bollinger Bands Test")

[bbUpper, bbMiddle, bbLower] = ta.bb(close, 20, 2.0)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.bbw() function', () => {
      const code = `
//@version=6
indicator("BB Width Test")

bbWidth = ta.bbw(close, 20, 2.0)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.kc() function', () => {
      const code = `
//@version=6
indicator("Keltner Channel Test")

[kcUpper, kcMiddle, kcLower] = ta.kc(hlc3, 20, 1.5)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.kcw() function', () => {
      const code = `
//@version=6
indicator("KC Width Test")

kcWidth = ta.kcw(hlc3, 20, 1.5)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid band parameters', () => {
      const code = `
//@version=6
indicator("Invalid Band Test")

invalidBB = ta.bb(close, -20, 2.0)
invalidKC = ta.kc(hlc3, 20, "string")
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-TA-FUNCTION-PARAM')).toBe(true);
    });
  });

  describe('PSV6-TA-TREND: Trend Functions', () => {
    it('should validate ta.atr() function', () => {
      const code = `
//@version=6
indicator("ATR Test")

atrValue = ta.atr(14)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.tr() function', () => {
      const code = `
//@version=6
indicator("TR Test")

trValue = ta.tr()
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.sar() function', () => {
      const code = `
//@version=6
indicator("SAR Test")

sarValue = ta.sar(0.02, 0.02, 0.2)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.supertrend() function', () => {
      const code = `
//@version=6
indicator("SuperTrend Test")

[supertrend, direction] = ta.supertrend(3.0, 10)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.dmi() function', () => {
      const code = `
//@version=6
indicator("DMI Test")

[plusDI, minusDI, adx] = ta.dmi(14)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid trend parameters', () => {
      const code = `
//@version=6
indicator("Invalid Trend Test")

invalidATR = ta.atr(-14)
invalidSAR = ta.sar("string", 0.02, 0.2)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-TA-FUNCTION-PARAM')).toBe(true);
    });
  });

  describe('PSV6-TA-VOLUME: Volume Functions', () => {
    it('should validate ta.accdist() function', () => {
      const code = `
//@version=6
indicator("Accumulation/Distribution Test")

accdistValue = ta.accdist()
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.obv() function', () => {
      const code = `
//@version=6
indicator("OBV Test")

obvValue = ta.obv()
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.pvi() function', () => {
      const code = `
//@version=6
indicator("PVI Test")

pviValue = ta.pvi()
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.nvi() function', () => {
      const code = `
//@version=6
indicator("NVI Test")

nviValue = ta.nvi()
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.pvt() function', () => {
      const code = `
//@version=6
indicator("PVT Test")

pvtValue = ta.pvt()
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.vwap() function', () => {
      const code = `
//@version=6
indicator("VWAP Test")

vwapValue = ta.vwap()
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.wad() function', () => {
      const code = `
//@version=6
indicator("WAD Test")

wadValue = ta.wad()
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.wvad() function', () => {
      const code = `
//@version=6
indicator("WVAD Test")

wvadValue = ta.wvad(high, low, close, volume, 14)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

  });

  describe('PSV6-TA-PIVOTS: Pivot Functions', () => {
    it('should validate ta.pivothigh() function', () => {
      const code = `
//@version=6
indicator("Pivot High Test")

pivotHigh = ta.pivothigh(high, 5, 5)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.pivotlow() function', () => {
      const code = `
//@version=6
indicator("Pivot Low Test")

pivotLow = ta.pivotlow(low, 5, 5)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.pivot_point_levels() function', () => {
      const code = `
//@version=6
indicator("Pivot Point Levels Test")

[pivot, r1, r2, r3, s1, s2, s3] = ta.pivot_point_levels("Traditional", high, low, close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid pivot parameters', () => {
      const code = `
//@version=6
indicator("Invalid Pivot Test")

invalidPivotHigh = ta.pivothigh(high, -5, 5)
invalidPivotLow = ta.pivotlow("string", 5, 5)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-TA-FUNCTION-PARAM')).toBe(true);
    });
  });

  describe('PSV6-TA-STATISTICS: Statistics Functions', () => {
    it('should validate ta.correlation() function', () => {
      const code = `
//@version=6
indicator("Correlation Test")

correlationValue = ta.correlation(close, volume, 20)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.dev() function', () => {
      const code = `
//@version=6
indicator("Deviation Test")

devValue = ta.dev(close, 20)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.stdev() function', () => {
      const code = `
//@version=6
indicator("Standard Deviation Test")

stdevValue = ta.stdev(close, 20)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.variance() function', () => {
      const code = `
//@version=6
indicator("Variance Test")

varianceValue = ta.variance(close, 20)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.linreg() function', () => {
      const code = `
//@version=6
indicator("Linear Regression Test")

linregValue = ta.linreg(close, 20, 0)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.percentile_linear_interpolation() function', () => {
      const code = `
//@version=6
indicator("Percentile Test")

percentileValue = ta.percentile_linear_interpolation(close, 20, 50)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.percentrank() function', () => {
      const code = `
//@version=6
indicator("Percent Rank Test")

percentrankValue = ta.percentrank(close, 20)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.range() function', () => {
      const code = `
//@version=6
indicator("Range Test")

rangeValue = ta.range(high, low, 20)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.highest() function', () => {
      const code = `
//@version=6
indicator("Highest Test")

highestValue = ta.highest(high, 20)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.lowest() function', () => {
      const code = `
//@version=6
indicator("Lowest Test")

lowestValue = ta.lowest(low, 20)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid statistics parameters', () => {
      const code = `
//@version=6
indicator("Invalid Statistics Test")

invalidCorrelation = ta.correlation(close, volume, -20)
invalidDev = ta.dev("string", 20)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-TA-FUNCTION-PARAM')).toBe(true);
    });
  });

  describe('PSV6-TA-MOMENTUM: Momentum Functions', () => {
    it('should validate ta.roc() function', () => {
      const code = `
//@version=6
indicator("ROC Test")

rocValue = ta.roc(close, 12)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.mom() function', () => {
      const code = `
//@version=6
indicator("Momentum Test")

momValue = ta.mom(close, 12)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.change() function', () => {
      const code = `
//@version=6
indicator("Change Test")

changeValue = ta.change(close, 1)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.crossover() function', () => {
      const code = `
//@version=6
indicator("Crossover Test")

crossoverValue = ta.crossover(close, ta.sma(close, 20))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.crossunder() function', () => {
      const code = `
//@version=6
indicator("Crossunder Test")

crossunderValue = ta.crossunder(close, ta.sma(close, 20))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.rising() function', () => {
      const code = `
//@version=6
indicator("Rising Test")

risingValue = ta.rising(close, 1)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.falling() function', () => {
      const code = `
//@version=6
indicator("Falling Test")

fallingValue = ta.falling(close, 1)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.iii() function', () => {
      const code = `
//@version=6
indicator("III Test")

iiiValue = ta.iii(close, volume, 14)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid momentum parameters', () => {
      const code = `
//@version=6
indicator("Invalid Momentum Test")

invalidROC = ta.roc(close, -12)
invalidMom = ta.mom("string", 12)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-TA-FUNCTION-PARAM')).toBe(true);
    });
  });

  describe('PSV6-TA-PERFORMANCE: TA Performance Validation', () => {
    it('should warn on expensive TA functions in loops', () => {
      const code = `
//@version=6
indicator("Expensive TA in Loop Test")

for i = 0 to 100
    smaValue = ta.sma(close, 200)
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-TA-PERF-LOOP')).toBe(true);
    });

    it('should warn on too many TA function calls', () => {
      const code = `
//@version=6
indicator("Too Many TA Functions Test")

sma1 = ta.sma(close, 10)
sma2 = ta.sma(close, 20)
sma3 = ta.sma(close, 30)
sma4 = ta.sma(close, 40)
sma5 = ta.sma(close, 50)
sma6 = ta.sma(close, 60)
sma7 = ta.sma(close, 70)
sma8 = ta.sma(close, 80)
sma9 = ta.sma(close, 90)
sma10 = ta.sma(close, 100)
sma11 = ta.sma(close, 110)
sma12 = ta.sma(close, 120)
sma13 = ta.sma(close, 130)
sma14 = ta.sma(close, 140)
sma15 = ta.sma(close, 150)
sma16 = ta.sma(close, 160)
sma17 = ta.sma(close, 170)
sma18 = ta.sma(close, 180)
sma19 = ta.sma(close, 190)
sma20 = ta.sma(close, 200)
sma21 = ta.sma(close, 210)
sma22 = ta.sma(close, 220)
sma23 = ta.sma(close, 230)
sma24 = ta.sma(close, 240)
sma25 = ta.sma(close, 250)
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-TA-PERF-MANY')).toBe(true);
    });

    it('should warn on nested expensive TA function calls', () => {
      const code = `
//@version=6
indicator("Nested Expensive TA Test")

complexTA = ta.sma(ta.ema(ta.rsi(close, 14), 20), 50)
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-TA-PERF-NESTED')).toBe(true);
    });
  });

  describe('PSV6-TA-BEST-PRACTICES: TA Best Practices', () => {
    it('should suggest caching repeated TA calculations', () => {
      const code = `
//@version=6
indicator("Repeated TA Calculations Test")

sma20 = ta.sma(close, 20)
condition1 = close > ta.sma(close, 20)
condition2 = ta.sma(close, 20) > ta.sma(close, 50)
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-TA-CACHE-SUGGESTION')).toBe(true);
    });

    it('should suggest reasonable TA parameters', () => {
      const code = `
//@version=6
indicator("Extreme TA Parameters Test")

extremeSMA = ta.sma(close, 1000)
extremeRSI = ta.rsi(close, 500)
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-TA-PARAM-SUGGESTION')).toBe(true);
    });

    it('should suggest proper TA function combinations', () => {
      const code = `
//@version=6
indicator("TA Combinations Test")

// Good combination: trend + momentum
sma20 = ta.sma(close, 20)
rsi14 = ta.rsi(close, 14)
signal = ta.crossover(close, sma20) and rsi14 < 30

// Suggest using ta.cross() instead of manual comparison
manualCross = close > ta.sma(close, 20) and close[1] <= ta.sma(close, 20)[1]
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-TA-COMBINATION-SUGGESTION')).toBe(true);
    });
  });

  describe('PSV6-TA-COMPLEX: Complex TA Scenarios', () => {
    it('should handle multiple TA functions in complex expressions', () => {
      const code = `
//@version=6
indicator("Complex TA Expressions Test")

// Multiple moving averages
sma20 = ta.sma(close, 20)
ema20 = ta.ema(close, 20)
rma20 = ta.rma(close, 20)

// Complex condition
trendUp = ta.crossover(sma20, ema20) and ta.rsi(close, 14) > 50
trendDown = ta.crossunder(sma20, ema20) and ta.rsi(close, 14) < 50

// Multiple oscillators
rsi = ta.rsi(close, 14)
stoch = ta.stoch(close, high, low, 14)
mfi = ta.mfi(hlc3, volume, 14)

// Band analysis
[bbUpper, bbMiddle, bbLower] = ta.bb(close, 20, 2.0)
bbPosition = (close - bbLower) / (bbUpper - bbLower)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle TA functions in conditional expressions', () => {
      const code = `
//@version=6
indicator("TA in Conditionals Test")

sma20 = ta.sma(close, 20)
rsi14 = ta.rsi(close, 14)

buySignal = ta.crossover(close, sma20) and rsi14 < 70

sellSignal = ta.crossunder(close, sma20) and rsi14 > 30
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle TA functions with dynamic parameters', () => {
      const code = `
//@version=6
indicator("Dynamic TA Parameters Test")

length = 20
multiplier = 2.0

sma = ta.sma(close, length)
[bbUpper, bbMiddle, bbLower] = ta.bb(close, length, multiplier)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-TA-EDGE-CASES: TA Edge Cases', () => {
    it('should handle TA functions with na values', () => {
      const code = `
//@version=6
indicator("TA with NA Test")

naValue = na
smaWithNA = ta.sma(naValue, 20)
rsiWithNA = ta.rsi(naValue, 14)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle TA functions with extreme values', () => {
      const code = `
//@version=6
indicator("TA with Extreme Values Test")

extremeHigh = 10000000000
extremeLow = -10000000000

smaHigh = ta.sma(extremeHigh, 20)
smaLow = ta.sma(extremeLow, 20)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle TA functions with zero parameters', () => {
      const code = `
//@version=6
indicator("TA with Zero Parameters Test")

zeroSMA = ta.sma(close, 0)
zeroRSI = ta.rsi(close, 0)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
