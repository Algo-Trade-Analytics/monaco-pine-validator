/**
 * TA Utility Functions Validation Tests (TDD)
 * 
 * PHASE 4 - HIGH PRIORITY
 * Coverage Gap: 48% (22/46 TA functions untested)
 * 
 * Following TDD: These tests are written FIRST and will initially FAIL
 * until the TA Functions Validator is extended.
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../..';

describe('TA Utility Functions Validation (TDD)', () => {
  const createValidator = () => new EnhancedModularValidator({
    version: '6',
    scriptType: 'indicator',
    strictMode: true,
    enableWarnings: true
  });

  // ============================================================================
  // Category 1: Correlation & Covariance
  // ============================================================================

  describe('PSV6-TA-CORRELATION: Correlation Functions', () => {
    
    it('should validate ta.correlation()', () => {
      const code = `
//@version=6
indicator("Correlation")

corr = ta.correlation(close, volume, 20)
plot(corr)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.covariance()', () => {
      const code = `
//@version=6
indicator("Covariance")

cov = ta.covariance(close, volume, 20)
plot(cov)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid period for correlation', () => {
      const code = `
//@version=6
indicator("Invalid Correlation")

corr = ta.correlation(close, volume, 0)  // Period must be > 0
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Category 2: Percent Functions
  // ============================================================================

  describe('PSV6-TA-PERCENT: Percent Change Functions', () => {
    
    it('should validate ta.percentile_linear_interpolation()', () => {
      const code = `
//@version=6
indicator("Percentile Linear")

p75 = ta.percentile_linear_interpolation(close, 20, 75)
plot(p75)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.percentile_nearest_rank()', () => {
      const code = `
//@version=6
indicator("Percentile Nearest Rank")

p50 = ta.percentile_nearest_rank(close, 20, 50)
plot(p50)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.percentrank()', () => {
      const code = `
//@version=6
indicator("Percent Rank")

rank = ta.percentrank(close, 20, close)
plot(rank)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid percentile range', () => {
      const code = `
//@version=6
indicator("Invalid Percentile")

p = ta.percentile_linear_interpolation(close, 20, 150)  // Must be 0-100
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Category 3: Moving Average Variants
  // ============================================================================

  describe('PSV6-TA-MA-ADVANCED: Advanced Moving Averages', () => {
    
    it('should validate ta.alma()', () => {
      const code = `
//@version=6
indicator("ALMA")

alma = ta.alma(close, 9, 0.85, 6)
plot(alma)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.swma()', () => {
      const code = `
//@version=6
indicator("SWMA")

swma = ta.swma(close)
plot(swma)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.vwma()', () => {
      const code = `
//@version=6
indicator("VWMA")

vwma = ta.vwma(close, 20)
plot(vwma)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.hma()', () => {
      const code = `
//@version=6
indicator("HMA")

hma = ta.hma(close, 9)
plot(hma)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.linreg()', () => {
      const code = `
//@version=6
indicator("Linear Regression")

linreg = ta.linreg(close, 14, 0)
plot(linreg)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 4: Price Range Functions
  // ============================================================================

  describe('PSV6-TA-RANGE: Price Range Functions', () => {
    
    it('should validate ta.tr()', () => {
      const code = `
//@version=6
indicator("True Range")

trueRange = ta.tr
plot(trueRange)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.tr() with handles parameter', () => {
      const code = `
//@version=6
indicator("True Range with Handles")

trueRange = ta.tr(true)
plot(trueRange)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.atr()', () => {
      const code = `
//@version=6
indicator("ATR")

atr = ta.atr(14)
plot(atr)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 5: Momentum Indicators
  // ============================================================================

  describe('PSV6-TA-MOMENTUM: Momentum Indicators', () => {
    
    it('should validate ta.mom()', () => {
      const code = `
//@version=6
indicator("Momentum")

momentum = ta.mom(close, 10)
plot(momentum)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.roc()', () => {
      const code = `
//@version=6
indicator("Rate of Change")

roc = ta.roc(close, 12)
plot(roc)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.tsi()', () => {
      const code = `
//@version=6
indicator("TSI")

tsi = ta.tsi(close, 25, 13)
plot(tsi)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 6: Pivot Points
  // ============================================================================

  describe('PSV6-TA-PIVOT: Pivot Point Functions', () => {
    
    it('should validate ta.pivot_point_levels()', () => {
      const code = `
//@version=6
indicator("Pivot Points")

[pp, r1, s1, r2, s2, r3, s3] = ta.pivot_point_levels("Traditional", high, low, close)
plot(pp)
plot(r1)
plot(s1)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.pivothigh()', () => {
      const code = `
//@version=6
indicator("Pivot High")

ph = ta.pivothigh(high, 5, 5)
plotshape(ph, style=shape.triangledown, location=location.abovebar)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.pivotlow()', () => {
      const code = `
//@version=6
indicator("Pivot Low")

pl = ta.pivotlow(low, 5, 5)
plotshape(pl, style=shape.triangleup, location=location.belowbar)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid pivot type', () => {
      const code = `
//@version=6
indicator("Invalid Pivot Type")

[pp, r1, s1, r2, s2, r3, s3] = ta.pivot_point_levels("InvalidType", high, low, close)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Category 7: Change Functions
  // ============================================================================

  describe('PSV6-TA-CHANGE: Change & Difference Functions', () => {
    
    it('should validate ta.change()', () => {
      const code = `
//@version=6
indicator("Change")

change = ta.change(close)
plot(change)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.change() with length parameter', () => {
      const code = `
//@version=6
indicator("Change with Length")

change5 = ta.change(close, 5)
plot(change5)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 8: Cross Functions
  // ============================================================================

  describe('PSV6-TA-CROSS: Crossover/Crossunder Functions', () => {
    
    it('should validate ta.cross()', () => {
      const code = `
//@version=6
indicator("Cross")

fast = ta.sma(close, 10)
slow = ta.sma(close, 20)
crossed = ta.cross(fast, slow)
plotshape(crossed, style=shape.circle)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.crossover()', () => {
      const code = `
//@version=6
indicator("Crossover")

fast = ta.ema(close, 12)
slow = ta.ema(close, 26)
crossover = ta.crossover(fast, slow)
plotshape(crossover, style=shape.triangleup, location=location.belowbar, color=color.green)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ta.crossunder()', () => {
      const code = `
//@version=6
indicator("Crossunder")

fast = ta.ema(close, 12)
slow = ta.ema(close, 26)
crossunder = ta.crossunder(fast, slow)
plotshape(crossunder, style=shape.triangledown, location=location.abovebar, color=color.red)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('PSV6-TA-INTEGRATION: TA Function Integration', () => {
    
    it('should validate complex indicator combining multiple TA functions', () => {
      const code = `
//@version=6
indicator("Complex TA")

// Moving averages
sma20 = ta.sma(close, 20)
ema12 = ta.ema(close, 12)
hma9 = ta.hma(close, 9)

// Momentum
rsi = ta.rsi(close, 14)
mom = ta.mom(close, 10)

// Volatility
atr = ta.atr(14)
stdev = ta.stdev(close, 20)

// Correlation
corr = ta.correlation(close, volume, 20)

// Plot
plot(sma20)
plot(rsi)
plot(atr)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate pivot-based trading strategy', () => {
      const code = `
//@version=6
indicator("Pivot Strategy")

[pp, r1, s1, r2, s2, r3, s3] = ta.pivot_point_levels("Traditional", high, low, close)

ph = ta.pivothigh(high, 5, 5)
pl = ta.pivotlow(low, 5, 5)

plot(pp, color=color.yellow)
plot(r1, color=color.green)
plot(s1, color=color.red)
plotshape(ph, style=shape.triangledown, location=location.abovebar)
plotshape(pl, style=shape.triangleup, location=location.belowbar)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

