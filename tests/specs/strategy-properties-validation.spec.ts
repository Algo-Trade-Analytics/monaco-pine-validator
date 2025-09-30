/**
 * Strategy Properties Validation Tests (TDD)
 * 
 * PHASE 2 - HIGH PRIORITY
 * Coverage Gap: 79% (37/47 properties untested)
 * 
 * Following TDD: These tests are written FIRST and will initially FAIL
 * until the Strategy Validator is extended.
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../..';

describe('Strategy Properties Validation (TDD)', () => {
  const createValidator = () => new EnhancedModularValidator({
    version: '6',
    scriptType: 'strategy',
    strictMode: true,
    enableWarnings: true
  });

  // ============================================================================
  // Category 1: strategy.closedtrades.* Properties (24 properties)
  // ============================================================================
  
  describe('PSV6-STRATEGY-CLOSEDTRADES: Closed Trades Properties', () => {
    
    describe('Entry Properties', () => {
      it('should validate strategy.closedtrades.entry_price()', () => {
        const code = `
//@version=6
strategy("Closed Trades Entry Price")

if strategy.closedtrades > 0
    lastEntryPrice = strategy.closedtrades.entry_price(strategy.closedtrades - 1)
    plot(lastEntryPrice)
        `;

        const result = createValidator().validate(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate strategy.closedtrades.entry_time()', () => {
        const code = `
//@version=6
strategy("Closed Trades Entry Time")

if strategy.closedtrades > 0
    entryTime = strategy.closedtrades.entry_time(0)
    plot(entryTime)
        `;

        const result = createValidator().validate(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate strategy.closedtrades.entry_bar_index()', () => {
        const code = `
//@version=6
strategy("Closed Trades Entry Bar Index")

if strategy.closedtrades > 0
    entryBar = strategy.closedtrades.entry_bar_index(0)
    plot(entryBar)
        `;

        const result = createValidator().validate(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate strategy.closedtrades.entry_id()', () => {
        const code = `
//@version=6
strategy("Closed Trades Entry ID")

if strategy.closedtrades > 0
    entryId = strategy.closedtrades.entry_id(0)
    label.new(bar_index, high, entryId)
        `;

        const result = createValidator().validate(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate strategy.closedtrades.entry_comment()', () => {
        const code = `
//@version=6
strategy("Closed Trades Entry Comment")

if strategy.closedtrades > 0
    comment = strategy.closedtrades.entry_comment(0)
    label.new(bar_index, high, comment)
        `;

        const result = createValidator().validate(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Exit Properties', () => {
      it('should validate strategy.closedtrades.exit_price()', () => {
        const code = `
//@version=6
strategy("Closed Trades Exit Price")

if strategy.closedtrades > 0
    exitPrice = strategy.closedtrades.exit_price(strategy.closedtrades - 1)
    plot(exitPrice)
        `;

        const result = createValidator().validate(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate strategy.closedtrades.exit_time()', () => {
        const code = `
//@version=6
strategy("Closed Trades Exit Time")

if strategy.closedtrades > 0
    exitTime = strategy.closedtrades.exit_time(0)
    plot(exitTime)
        `;

        const result = createValidator().validate(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate strategy.closedtrades.exit_bar_index()', () => {
        const code = `
//@version=6
strategy("Closed Trades Exit Bar Index")

if strategy.closedtrades > 0
    exitBar = strategy.closedtrades.exit_bar_index(0)
    plot(exitBar)
        `;

        const result = createValidator().validate(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate strategy.closedtrades.exit_id()', () => {
        const code = `
//@version=6
strategy("Closed Trades Exit ID")

if strategy.closedtrades > 0
    exitId = strategy.closedtrades.exit_id(0)
    label.new(bar_index, high, exitId)
        `;

        const result = createValidator().validate(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate strategy.closedtrades.exit_comment()', () => {
        const code = `
//@version=6
strategy("Closed Trades Exit Comment")

if strategy.closedtrades > 0
    comment = strategy.closedtrades.exit_comment(0)
    label.new(bar_index, high, comment)
        `;

        const result = createValidator().validate(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Trade Metrics', () => {
      it('should validate strategy.closedtrades.profit()', () => {
        const code = `
//@version=6
strategy("Closed Trades Profit")

if strategy.closedtrades > 0
    lastProfit = strategy.closedtrades.profit(strategy.closedtrades - 1)
    plot(lastProfit)
        `;

        const result = createValidator().validate(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate strategy.closedtrades.profit_percent()', () => {
        const code = `
//@version=6
strategy("Closed Trades Profit Percent")

if strategy.closedtrades > 0
    profitPct = strategy.closedtrades.profit_percent(0)
    plot(profitPct)
        `;

        const result = createValidator().validate(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate strategy.closedtrades.commission()', () => {
        const code = `
//@version=6
strategy("Closed Trades Commission")

if strategy.closedtrades > 0
    comm = strategy.closedtrades.commission(0)
    plot(comm)
        `;

        const result = createValidator().validate(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate strategy.closedtrades.size()', () => {
        const code = `
//@version=6
strategy("Closed Trades Size")

if strategy.closedtrades > 0
    tradeSize = strategy.closedtrades.size(0)
    plot(tradeSize)
        `;

        const result = createValidator().validate(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate strategy.closedtrades.direction()', () => {
        const code = `
//@version=6
strategy("Closed Trades Direction")

if strategy.closedtrades > 0
    direction = strategy.closedtrades.direction(0)
    plot(direction)
        `;

        const result = createValidator().validate(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Drawdown Properties', () => {
      it('should validate strategy.closedtrades.max_drawdown()', () => {
        const code = `
//@version=6
strategy("Closed Trades Max Drawdown")

if strategy.closedtrades > 0
    maxDD = strategy.closedtrades.max_drawdown(0)
    plot(maxDD)
        `;

        const result = createValidator().validate(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate strategy.closedtrades.max_runup()', () => {
        const code = `
//@version=6
strategy("Closed Trades Max Runup")

if strategy.closedtrades > 0
    maxRunup = strategy.closedtrades.max_runup(0)
    plot(maxRunup)
        `;

        const result = createValidator().validate(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should error on invalid closed trade index', () => {
      const code = `
//@version=6
strategy("Invalid Index")

// Accessing trade that doesn't exist
profit = strategy.closedtrades.profit(999999)
plot(profit)
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code?.includes('STRATEGY') || w.code?.includes('INDEX'))).toBe(true);
    });
  });

  // ============================================================================
  // Category 2: strategy.opentrades.* Properties (11 properties)
  // ============================================================================

  describe('PSV6-STRATEGY-OPENTRADES: Open Trades Properties', () => {
    
    it('should validate strategy.opentrades.entry_price()', () => {
      const code = `
//@version=6
strategy("Open Trades Entry Price")

if strategy.opentrades > 0
    entryPrice = strategy.opentrades.entry_price(0)
    plot(entryPrice)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.opentrades.entry_time()', () => {
      const code = `
//@version=6
strategy("Open Trades Entry Time")

if strategy.opentrades > 0
    entryTime = strategy.opentrades.entry_time(0)
    plot(entryTime)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.opentrades.entry_bar_index()', () => {
      const code = `
//@version=6
strategy("Open Trades Entry Bar")

if strategy.opentrades > 0
    entryBar = strategy.opentrades.entry_bar_index(0)
    plot(entryBar)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.opentrades.entry_id()', () => {
      const code = `
//@version=6
strategy("Open Trades Entry ID")

if strategy.opentrades > 0
    entryId = strategy.opentrades.entry_id(0)
    label.new(bar_index, high, entryId)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.opentrades.entry_comment()', () => {
      const code = `
//@version=6
strategy("Open Trades Entry Comment")

if strategy.opentrades > 0
    comment = strategy.opentrades.entry_comment(0)
    label.new(bar_index, high, comment)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.opentrades.profit()', () => {
      const code = `
//@version=6
strategy("Open Trades Profit")

if strategy.opentrades > 0
    currentProfit = strategy.opentrades.profit(0)
    plot(currentProfit)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.opentrades.profit_percent()', () => {
      const code = `
//@version=6
strategy("Open Trades Profit Percent")

if strategy.opentrades > 0
    profitPct = strategy.opentrades.profit_percent(0)
    plot(profitPct)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.opentrades.size()', () => {
      const code = `
//@version=6
strategy("Open Trades Size")

if strategy.opentrades > 0
    tradeSize = strategy.opentrades.size(0)
    plot(tradeSize)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.opentrades.direction()', () => {
      const code = `
//@version=6
strategy("Open Trades Direction")

if strategy.opentrades > 0
    direction = strategy.opentrades.direction(0)
    plot(direction)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.opentrades.max_drawdown()', () => {
      const code = `
//@version=6
strategy("Open Trades Max Drawdown")

if strategy.opentrades > 0
    maxDD = strategy.opentrades.max_drawdown(0)
    plot(maxDD)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate strategy.opentrades.max_runup()', () => {
      const code = `
//@version=6
strategy("Open Trades Max Runup")

if strategy.opentrades > 0
    maxRunup = strategy.opentrades.max_runup(0)
    plot(maxRunup)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid open trade index', () => {
      const code = `
//@version=6
strategy("Invalid Open Trade Index")

// Accessing trade beyond open trades count
profit = strategy.opentrades.profit(strategy.opentrades + 10)
plot(profit)
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Category 3: Integration Tests
  // ============================================================================

  describe('PSV6-STRATEGY-INTEGRATION: Strategy Properties Integration', () => {
    
    it('should validate comprehensive trade analysis', () => {
      const code = `
//@version=6
strategy("Trade Analysis")

// Analyze closed trades
if strategy.closedtrades > 0
    lastTrade = strategy.closedtrades - 1
    entryPrice = strategy.closedtrades.entry_price(lastTrade)
    exitPrice = strategy.closedtrades.exit_price(lastTrade)
    profit = strategy.closedtrades.profit(lastTrade)
    profitPct = strategy.closedtrades.profit_percent(lastTrade)
    
    // Plot results
    plot(entryPrice)
    plot(exitPrice)
    plot(profit)

// Monitor open trades
if strategy.opentrades > 0
    currentProfit = strategy.opentrades.profit(0)
    currentProfitPct = strategy.opentrades.profit_percent(0)
    plot(currentProfit)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate trade statistics calculation', () => {
      const code = `
//@version=6
strategy("Trade Statistics")

// Calculate win rate
var int wins = 0
var int losses = 0

if strategy.closedtrades > 0
    lastProfit = strategy.closedtrades.profit(strategy.closedtrades - 1)
    if lastProfit > 0
        wins := wins + 1
    else if lastProfit < 0
        losses := losses + 1
    
    winRate = (wins / strategy.closedtrades) * 100
    plot(winRate)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate trade duration calculation', () => {
      const code = `
//@version=6
strategy("Trade Duration")

if strategy.closedtrades > 0
    lastTrade = strategy.closedtrades - 1
    entryTime = strategy.closedtrades.entry_time(lastTrade)
    exitTime = strategy.closedtrades.exit_time(lastTrade)
    duration = exitTime - entryTime
    plot(duration)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate drawdown monitoring', () => {
      const code = `
//@version=6
strategy("Drawdown Monitor")

// Monitor both open and closed trades
var float maxDrawdown = 0.0

if strategy.closedtrades > 0
    closedDD = strategy.closedtrades.max_drawdown(strategy.closedtrades - 1)
    if closedDD > maxDrawdown
        maxDrawdown := closedDD

if strategy.opentrades > 0
    openDD = strategy.opentrades.max_drawdown(0)
    if openDD > maxDrawdown
        maxDrawdown := openDD

plot(maxDrawdown)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Error Cases
  // ============================================================================

  describe('PSV6-STRATEGY-ERRORS: Strategy Property Error Cases', () => {
    
    it('should warn on accessing trades without checking count', () => {
      const code = `
//@version=6
strategy("Unchecked Access")

// Accessing without checking if trades exist
profit = strategy.closedtrades.profit(0)  // Risky!
plot(profit)
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.message.toLowerCase().includes('check') || w.message.toLowerCase().includes('count'))).toBe(true);
    });

    it('should handle negative indices', () => {
      const code = `
//@version=6
strategy("Negative Index")

if strategy.closedtrades > 0
    profit = strategy.closedtrades.profit(-1)  // Invalid
    plot(profit)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should validate type compatibility of property access', () => {
      const code = `
//@version=6
strategy("Type Check")

if strategy.closedtrades > 0
    // entry_id returns string, not numeric
    entryId = strategy.closedtrades.entry_id(0)
    plot(entryId)  // Should warn - can't plot string
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length + result.errors.length).toBeGreaterThan(0);
    });
  });
});

