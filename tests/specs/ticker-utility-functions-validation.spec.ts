/**
 * Ticker Utility Functions Validation Tests (TDD)
 * 
 * PHASE 11 - MEDIUM PRIORITY
 * Coverage Gap: 40% (10/25 ticker functions untested)
 * 
 * Following TDD: These tests are written FIRST and will initially FAIL
 * until the Ticker Functions Validator is extended.
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../..';
import { ChevrotainAstService } from '../../core/ast/service';

describe('Ticker Utility Functions Validation (TDD)', () => {
  const createValidator = () => new EnhancedModularValidator({
    targetVersion: 6,
    strictMode: true,
    enablePerformanceAnalysis: true,
    ast: {
      mode: 'primary',
      service: new ChevrotainAstService(),
    },
  });

  // ============================================================================
  // Category 1: Ticker Construction
  // ============================================================================

  describe('PSV6-TICKER-CREATE: Ticker Construction Functions', () => {
    
    it('should validate ticker.new()', () => {
      const code = `
//@version=6
indicator("Ticker New")

customTicker = ticker.new("NASDAQ", "AAPL", session.regular)
data = request.security(customTicker, timeframe.period, close)
plot(data)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ticker.standard()', () => {
      const code = `
//@version=6
indicator("Ticker Standard")

standardTicker = ticker.standard("NASDAQ:AAPL")
data = request.security(standardTicker, timeframe.period, close)
plot(data)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ticker.modify()', () => {
      const code = `
//@version=6
indicator("Ticker Modify")

baseTicker = "NASDAQ:AAPL"
modifiedTicker = ticker.modify(baseTicker, session=session.extended)
data = request.security(modifiedTicker, timeframe.period, close)
plot(data)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 2: Alternative Chart Types
  // ============================================================================

  describe('PSV6-TICKER-CHARTS: Alternative Chart Type Tickers', () => {
    
    it('should validate ticker.heikinashi()', () => {
      const code = `
//@version=6
indicator("Heikin Ashi")

haTicker = ticker.heikinashi(syminfo.tickerid)
haClose = request.security(haTicker, timeframe.period, close)
plot(haClose, "HA Close", color=color.blue)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ticker.renko()', () => {
      const code = `
//@version=6
indicator("Renko")

renkoTicker = ticker.renko(syminfo.tickerid, "ATR", 14)
renkoClose = request.security(renkoTicker, timeframe.period, close)
plot(renkoClose, "Renko Close", color=color.green)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ticker.linebreak()', () => {
      const code = `
//@version=6
indicator("Line Break")

lbTicker = ticker.linebreak(syminfo.tickerid, 3)
lbClose = request.security(lbTicker, timeframe.period, close)
plot(lbClose, "Line Break Close", color=color.orange)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ticker.kagi()', () => {
      const code = `
//@version=6
indicator("Kagi")

kagiTicker = ticker.kagi(syminfo.tickerid, 1)
kagiClose = request.security(kagiTicker, timeframe.period, close)
plot(kagiClose, "Kagi Close", color=color.purple)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ticker.pointfigure()', () => {
      const code = `
//@version=6
indicator("Point & Figure")

pfTicker = ticker.pointfigure(syminfo.tickerid, "ATR", 14)
pfClose = request.security(pfTicker, timeframe.period, close)
plot(pfClose, "P&F Close", color=color.red)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 3: Ticker with Sessions
  // ============================================================================

  describe('PSV6-TICKER-SESSION: Ticker Session Handling', () => {
    
    it('should validate ticker with regular session', () => {
      const code = `
//@version=6
indicator("Regular Session")

regularTicker = ticker.new("NASDAQ", "AAPL", session.regular)
regularData = request.security(regularTicker, timeframe.period, close)
plot(regularData, "Regular", color=color.blue)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ticker with extended session', () => {
      const code = `
//@version=6
indicator("Extended Session")

extendedTicker = ticker.new("NASDAQ", "AAPL", session.extended)
extendedData = request.security(extendedTicker, timeframe.period, close)
plot(extendedData, "Extended", color=color.orange)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate comparing regular vs extended sessions', () => {
      const code = `
//@version=6
indicator("Session Comparison")

regularTicker = ticker.new(syminfo.prefix, syminfo.ticker, session.regular)
extendedTicker = ticker.new(syminfo.prefix, syminfo.ticker, session.extended)

regularClose = request.security(regularTicker, timeframe.period, close)
extendedClose = request.security(extendedTicker, timeframe.period, close)

plot(regularClose, "Regular", color=color.blue)
plot(extendedClose, "Extended", color=color.orange)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 4: Multi-Symbol Analysis
  // ============================================================================

  describe('PSV6-TICKER-MULTI: Multi-Symbol Analysis', () => {
    
    it('should validate comparing multiple symbols', () => {
      const code = `
//@version=6
indicator("Multi-Symbol Compare")

symbol1 = ticker.standard("NASDAQ:AAPL")
symbol2 = ticker.standard("NASDAQ:MSFT")
symbol3 = ticker.standard("NASDAQ:GOOGL")

data1 = request.security(symbol1, timeframe.period, close)
data2 = request.security(symbol2, timeframe.period, close)
data3 = request.security(symbol3, timeframe.period, close)

plot(data1, "AAPL", color=color.blue)
plot(data2, "MSFT", color=color.green)
plot(data3, "GOOGL", color=color.red)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate sector comparison', () => {
      const code = `
//@version=6
indicator("Sector Comparison")

// Tech sector
techTicker = ticker.standard("XLK")
// Finance sector
financeTicker = ticker.standard("XLF")
// Energy sector
energyTicker = ticker.standard("XLE")

techData = request.security(techTicker, "D", close)
financeData = request.security(financeTicker, "D", close)
energyData = request.security(energyTicker, "D", close)

// Normalize to percentage
techPct = (techData / techData[0] - 1) * 100
financePct = (financeData / financeData[0] - 1) * 100
energyPct = (energyData / energyData[0] - 1) * 100

plot(techPct, "Tech", color=color.blue)
plot(financePct, "Finance", color=color.green)
plot(energyPct, "Energy", color=color.orange)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('PSV6-TICKER-INTEGRATION: Ticker Integration Tests', () => {
    
    it('should validate comprehensive ticker comparison', () => {
      const code = `
//@version=6
indicator("Comprehensive Ticker Analysis")

// Standard chart
standardClose = close

// Heikin Ashi
haTicker = ticker.heikinashi(syminfo.tickerid)
haClose = request.security(haTicker, timeframe.period, close)

// Renko
renkoTicker = ticker.renko(syminfo.tickerid, "ATR", 14)
renkoClose = request.security(renkoTicker, timeframe.period, close)

// Plot all
plot(standardClose, "Standard", color=color.blue, linewidth=2)
plot(haClose, "Heikin Ashi", color=color.green)
plot(renkoClose, "Renko", color=color.orange)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate spread analysis with tickers', () => {
      const code = `
//@version=6
indicator("Spread Analysis")

// Create tickers for two correlated assets
ticker1 = ticker.standard("NASDAQ:AAPL")
ticker2 = ticker.standard("NASDAQ:MSFT")

// Get data
price1 = request.security(ticker1, timeframe.period, close)
price2 = request.security(ticker2, timeframe.period, close)

// Calculate spread
spread = price1 - price2
spreadMa = ta.sma(spread, 20)
spreadStd = ta.stdev(spread, 20)

// Plot
plot(spread, "Spread", color=color.blue)
plot(spreadMa, "MA", color=color.orange)
plot(spreadMa + spreadStd * 2, "Upper", color=color.red)
plot(spreadMa - spreadStd * 2, "Lower", color=color.red)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate relative strength with tickers', () => {
      const code = `
//@version=6
indicator("Relative Strength")

// Stock vs benchmark
stockTicker = ticker.standard(syminfo.tickerid)
benchmarkTicker = ticker.standard("SPY")

stockPrice = request.security(stockTicker, "D", close)
benchmarkPrice = request.security(benchmarkTicker, "D", close)

// Calculate relative strength
relativeStrength = (stockPrice / benchmarkPrice) * 100

plot(relativeStrength, "Relative Strength", color=color.blue)
hline(100, "Baseline", color=color.gray)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Error Cases
  // ============================================================================

  describe('PSV6-TICKER-ERRORS: Ticker Error Cases', () => {
    
    it('should error on invalid exchange', () => {
      const code = `
//@version=6
indicator("Invalid Exchange")

invalidTicker = ticker.new("INVALID_EXCHANGE", "AAPL", session.regular)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should error on invalid symbol format', () => {
      const code = `
//@version=6
indicator("Invalid Symbol")

invalidTicker = ticker.standard("INVALID:SYMBOL:FORMAT")
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should error on invalid Renko parameters', () => {
      const code = `
//@version=6
indicator("Invalid Renko")

// Invalid box size (must be positive)
invalidTicker = ticker.renko(syminfo.tickerid, "ATR", -14)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn on using ticker without request.security', () => {
      const code = `
//@version=6
indicator("Unused Ticker")

// Creating ticker but not using it
unusedTicker = ticker.standard("NASDAQ:AAPL")
// Should use: data = request.security(unusedTicker, ...)
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Best Practices
  // ============================================================================

  describe('PSV6-TICKER-BEST-PRACTICES: Ticker Best Practices', () => {
    
    it('should validate caching ticker construction', () => {
      const code = `
//@version=6
indicator("Cache Ticker")

// Good: Construct ticker once
var string myTicker = ticker.standard("NASDAQ:AAPL")

// Use throughout script
data = request.security(myTicker, timeframe.period, close)
plot(data)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate using syminfo for dynamic tickers', () => {
      const code = `
//@version=6
indicator("Dynamic Ticker")

// Good: Use syminfo components for flexibility
dynamicTicker = ticker.new(syminfo.prefix, syminfo.ticker, session.extended)
data = request.security(dynamicTicker, timeframe.period, close)
plot(data)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate validating symbol existence', () => {
      const code = `
//@version=6
indicator("Validate Symbol")

ticker1 = ticker.standard("NASDAQ:AAPL")
data = request.security(ticker1, timeframe.period, close)

// Check if data is valid
if na(data)
    runtime.error("Symbol data not available")
else
    plot(data)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

