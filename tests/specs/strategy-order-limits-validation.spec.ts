import { describe, it, expect, beforeEach } from 'vitest';
import { StrategyOrderLimitsValidator } from '../../modules/strategy-order-limits-validator';
import { ValidationContext, ValidatorConfig } from '../../core/types';

describe('StrategyOrderLimitsValidator', () => {
  let validator: StrategyOrderLimitsValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new StrategyOrderLimitsValidator();
    context = {
      lines: [],
      cleanLines: [],
      rawLines: [],
      typeMap: new Map(),
      usedVars: new Set(),
      declaredVars: new Map(),
      functionNames: new Set(),
      methodNames: new Set(),
      functionParams: new Map(),
      scriptType: 'strategy',
      version: 6,
      hasVersion: true,
      firstVersionLine: null
    };
    config = {
      targetVersion: 6,
      strictMode: false,
      allowDeprecated: false,
      enableTypeChecking: true,
      enableControlFlowAnalysis: true,
      enablePerformanceAnalysis: true,
      customRules: [],
      ignoredCodes: []
    };
  });

  describe('Order Count Tracking', () => {
    it('should track strategy.entry calls and warn when approaching limit', () => {
      // Create a script with many strategy.entry calls
      const entries = Array.from({ length: 50 }, (_, i) => 
        `if condition${i}\n    strategy.entry("Long${i}", strategy.long)`
      ).join('\n');
      
      context.cleanLines = [
        'strategy("High Order Count", overlay=true)',
        ...entries.split('\n')
      ];

      const result = validator.validate(context, config);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      const orderCountWarning = result.warnings.find(w => w.code === 'PSV6-STRATEGY-ORDER-COUNT-HIGH');
      expect(orderCountWarning).toBeDefined();
      expect(orderCountWarning!.message).toContain('Many strategy orders detected');
    });

    it('should not warn about v5 9000 order limit (v6 has no hard cap)', () => {
      context.cleanLines = [
        'strategy("Near Limit Strategy", overlay=true)',
        'var order_count = 8900',
        'if condition',
        '    strategy.entry("Long", strategy.long)',
        '    order_count := order_count + 1'
      ];

      const result = validator.validate(context, config);
      // Should not produce legacy v5 9000-limit warnings in v6
      const limitWarning = result.warnings.find(w => w.code === 'PSV6-STRATEGY-ORDER-LIMIT-APPROACHING');
      expect(limitWarning).toBeUndefined();
      // May still produce a generic high-order-count warning for performance
      const highCount = result.warnings.find(w => w.code === 'PSV6-STRATEGY-ORDER-COUNT-HIGH');
      expect(highCount).toBeDefined();
    });

    it('should not warn for non-strategy scripts', () => {
      context.scriptType = 'indicator';
      context.cleanLines = [
        'indicator("Test Indicator", overlay=true)',
        'plot(close)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(0);
    });

    it('should provide info about dynamic trimming for high-order strategies', () => {
      // Create a script with many orders to trigger trimming info
      const entries = Array.from({ length: 100 }, (_, i) => 
        `strategy.entry("Long${i}", strategy.long)`
      ).join('\n');
      
      context.cleanLines = [
        'strategy("High Order Strategy", overlay=true)',
        ...entries.split('\n')
      ];

      const result = validator.validate(context, config);
      const trimmingInfo = result.info.find(i => i.code === 'PSV6-STRATEGY-DYNAMIC-TRIMMING-INFO');
      expect(trimmingInfo).toBeDefined();
      expect(trimmingInfo!.message).toContain('dynamic order trimming');
      expect(trimmingInfo!.message).toContain('strategy.closedtrades.first_index');
    });

    it('should suggest using strategy.closedtrades.first_index for high-order strategies', () => {
      // Create a strategy with many orders but no first_index usage
      const entries = Array.from({ length: 60 }, (_, i) => 
        `strategy.entry("Long${i}", strategy.long)`
      ).join('\n');
      
      context.cleanLines = [
        'strategy("High Order Strategy", overlay=true)',
        ...entries.split('\n')
      ];

      const result = validator.validate(context, config);
      const firstIndexSuggestion = result.info.find(i => i.code === 'PSV6-STRATEGY-FIRST-INDEX-SUGGESTION');
      expect(firstIndexSuggestion).toBeDefined();
      expect(firstIndexSuggestion!.message).toContain('strategy.closedtrades.first_index');
    });

    it('should validate proper first_index usage', () => {
      context.cleanLines = [
        'strategy("First Index Strategy", overlay=true)',
        'first_order = strategy.closedtrades.first_index',
        'if strategy.closedtrades.first_index > 0',
        '    log.info("Orders have been trimmed")'
      ];

      const result = validator.validate(context, config);
      // Should not produce warnings for proper usage
      const firstIndexWarnings = result.warnings.filter(w => w.message.includes('first_index'));
      expect(firstIndexWarnings).toHaveLength(0);
    });
  });

  describe('Order Trimming Detection', () => {
    it('should detect potential order trimming scenarios', () => {
      context.cleanLines = [
        'strategy("Trimming Strategy", overlay=true)',
        'for i = 0 to 100',
        '    if condition',
        '        strategy.entry("Long" + str.tostring(i), strategy.long)',
        '        strategy.exit("Exit" + str.tostring(i), "Long" + str.tostring(i))'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      const trimmingWarning = result.warnings.find(w => w.code === 'PSV6-STRATEGY-ORDER-TRIMMING-RISK');
      expect(trimmingWarning).toBeDefined();
      expect(trimmingWarning!.message).toContain('Order trimming may occur');
    });

    it('should warn about orders in loops', () => {
      context.cleanLines = [
        'strategy("Loop Orders", overlay=true)',
        'for i = 1 to 50',
        '    strategy.entry("Long" + str.tostring(i), strategy.long, qty=1)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      const loopWarning = result.warnings.find(w => w.code === 'PSV6-STRATEGY-ORDER-LOOP');
      expect(loopWarning).toBeDefined();
      expect(loopWarning!.message).toContain('Strategy orders in loop');
    });

    it('should detect excessive pyramiding', () => {
      context.cleanLines = [
        'strategy("Pyramiding Strategy", overlay=true, pyramiding=10)',
        'if condition1',
        '    strategy.entry("L1", strategy.long)',
        'if condition2',
        '    strategy.entry("L2", strategy.long)',
        'if condition3',
        '    strategy.entry("L3", strategy.long)',
        'if condition4',
        '    strategy.entry("L4", strategy.long)',
        'if condition5',
        '    strategy.entry("L5", strategy.long)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      const pyramidingWarning = result.warnings.find(w => w.code === 'PSV6-STRATEGY-PYRAMIDING-EXCESSIVE');
      expect(pyramidingWarning).toBeDefined();
      expect(pyramidingWarning!.message).toContain('Excessive pyramiding entries');
    });
  });

  describe('Inefficient Order Patterns', () => {
    it('should detect multiple entries per bar', () => {
      context.cleanLines = [
        'strategy("Multiple Entries", overlay=true)',
        'if entry_condition_phase1',
        '    strategy.entry("Long Phase 1", strategy.long, qty=0.3)',
        'if entry_condition_phase2',
        '    strategy.entry("Long Phase 2", strategy.long, qty=0.3)',
        'if entry_condition_phase3',
        '    strategy.entry("Long Phase 3", strategy.long, qty=0.4)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      const multipleEntriesWarning = result.warnings.find(w => w.code === 'PSV6-STRATEGY-MULTIPLE-ENTRIES');
      expect(multipleEntriesWarning).toBeDefined();
      expect(multipleEntriesWarning!.message).toContain('Multiple strategy entries detected');
    });

    it('should detect redundant exit calls', () => {
      context.cleanLines = [
        'strategy("Redundant Exits", overlay=true)',
        'strategy.exit("Exit Long", from_entry="Long", stop=stop_price, limit=target_price)',
        'strategy.exit("Exit Long", from_entry="Long", stop=stop_price, limit=target_price)',
        'strategy.exit("Exit Long", from_entry="Long", stop=stop_price, limit=target_price)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      const redundantExitWarning = result.warnings.find(w => w.code === 'PSV6-STRATEGY-REDUNDANT-EXIT');
      expect(redundantExitWarning).toBeDefined();
      expect(redundantExitWarning!.message).toContain('Redundant strategy.exit calls');
    });

    it('should detect unconditional order placement', () => {
      context.cleanLines = [
        'strategy("Unconditional Orders", overlay=true)',
        'strategy.entry("Long", strategy.long)',
        'strategy.exit("Exit", "Long", stop=low, limit=high)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      const unconditionalWarning = result.warnings.find(w => w.code === 'PSV6-STRATEGY-UNCONDITIONAL-ORDER');
      expect(unconditionalWarning).toBeDefined();
      expect(unconditionalWarning!.message).toContain('Unconditional strategy orders');
    });
  });

  describe('Order Consolidation Suggestions', () => {
    it('should suggest consolidating multiple small entries', () => {
      context.cleanLines = [
        'strategy("Small Entries", overlay=true)',
        'if condition1',
        '    strategy.entry("Long1", strategy.long, qty=0.1)',
        'if condition2',
        '    strategy.entry("Long2", strategy.long, qty=0.1)',
        'if condition3',
        '    strategy.entry("Long3", strategy.long, qty=0.1)'
      ];

      const result = validator.validate(context, config);
      expect(result.info.length).toBeGreaterThanOrEqual(1);
      const consolidationSuggestion = result.info.find(i => i.code === 'PSV6-STRATEGY-CONSOLIDATE-ENTRIES');
      expect(consolidationSuggestion).toBeDefined();
      expect(consolidationSuggestion!.message).toContain('Consider consolidating multiple entries');
    });

    it('should suggest using position size checks', () => {
      context.cleanLines = [
        'strategy("Position Size Check", overlay=true)',
        'strategy.entry("Long1", strategy.long)',
        'strategy.entry("Long2", strategy.long)',
        'strategy.entry("Long3", strategy.long)'
      ];

      const result = validator.validate(context, config);
      expect(result.info.length).toBeGreaterThanOrEqual(1);
      const positionSizeSuggestion = result.info.find(i => i.code === 'PSV6-STRATEGY-POSITION-SIZE-CHECK');
      expect(positionSizeSuggestion).toBeDefined();
      expect(positionSizeSuggestion!.message).toContain('Consider checking strategy.position_size');
    });

    it('should suggest using var for entry tracking', () => {
      context.cleanLines = [
        'strategy("Entry Tracking", overlay=true)',
        'if primary_entry_condition',
        '    strategy.entry("Long", strategy.long)',
        'if secondary_entry_condition',
        '    strategy.entry("Long2", strategy.long)'
      ];

      const result = validator.validate(context, config);
      expect(result.info.length).toBeGreaterThanOrEqual(1);
      const varSuggestion = result.info.find(i => i.code === 'PSV6-STRATEGY-VAR-TRACKING');
      expect(varSuggestion).toBeDefined();
      expect(varSuggestion!.message).toContain('Consider using var for entry tracking');
    });
  });

  describe('Time-Based Order Filtering', () => {
    it('should detect missing time-based filtering for high-frequency strategies', () => {
      context.cleanLines = [
        'strategy("High Frequency", overlay=true)',
        'if ta.crossover(close, ta.sma(close, 5))',
        '    strategy.entry("Long", strategy.long)',
        'if ta.crossunder(close, ta.sma(close, 5))',
        '    strategy.entry("Short", strategy.short)'
      ];

      const result = validator.validate(context, config);
      expect(result.info.length).toBeGreaterThanOrEqual(1);
      const timeFilterSuggestion = result.info.find(i => i.code === 'PSV6-STRATEGY-TIME-FILTER-SUGGESTION');
      expect(timeFilterSuggestion).toBeDefined();
      expect(timeFilterSuggestion!.message).toContain('Consider adding time-based filtering');
    });

    it('should recognize existing time-based filtering', () => {
      context.cleanLines = [
        'strategy("Time Filtered", overlay=true)',
        'fromDate = input.time(timestamp("01 Jan 2023 00:00 +0000"))',
        'toDate = input.time(timestamp("31 Dec 2023 00:00 +0000"))',
        'tradeDateIsAllowed = time >= fromDate and time <= toDate',
        'if longCondition and tradeDateIsAllowed',
        '    strategy.entry("Long", strategy.long)'
      ];

      const result = validator.validate(context, config);
      // Should not suggest time filtering if already implemented
      const timeFilterSuggestion = result.info.find(i => i.code === 'PSV6-STRATEGY-TIME-FILTER-SUGGESTION');
      expect(timeFilterSuggestion).toBeUndefined();
    });
  });

  describe('Pyramiding Validation', () => {
    it('should validate pyramiding parameter consistency', () => {
      context.cleanLines = [
        'strategy("Pyramiding Test", overlay=true, pyramiding=3)',
        'if condition1',
        '    strategy.entry("L1", strategy.long)',
        'if condition2 and strategy.opentrades < 3',
        '    strategy.entry("L2", strategy.long)',
        'if condition3 and strategy.opentrades < 3',
        '    strategy.entry("L3", strategy.long)'
      ];

      const result = validator.validate(context, config);
      // Should not warn if pyramiding is properly managed
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about pyramiding without proper checks', () => {
      context.cleanLines = [
        'strategy("Uncontrolled Pyramiding", overlay=true, pyramiding=5)',
        'if condition1',
        '    strategy.entry("L1", strategy.long)',
        'if condition2',
        '    strategy.entry("L2", strategy.long)',
        'if condition3',
        '    strategy.entry("L3", strategy.long)',
        'if condition4',
        '    strategy.entry("L4", strategy.long)',
        'if condition5',
        '    strategy.entry("L5", strategy.long)',
        'if condition6',
        '    strategy.entry("L6", strategy.long)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      const pyramidingWarning = result.warnings.find(w => w.code === 'PSV6-STRATEGY-PYRAMIDING-UNCONTROLLED');
      expect(pyramidingWarning).toBeDefined();
      expect(pyramidingWarning!.message).toContain('Uncontrolled pyramiding detected');
    });
  });

  describe('Performance Optimization', () => {
    it('should detect expensive operations in order logic', () => {
      context.cleanLines = [
        'strategy("Expensive Orders", overlay=true)',
        'if ta.correlation(close, volume, 100) > 0.8',
        '    strategy.entry("Long", strategy.long)',
        'if ta.linreg(close, 200) > close',
        '    strategy.exit("Exit", "Long")'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      const expensiveWarning = result.warnings.find(w => w.code === 'PSV6-STRATEGY-EXPENSIVE-CONDITIONS');
      expect(expensiveWarning).toBeDefined();
      expect(expensiveWarning!.message).toContain('Expensive calculations in order conditions');
    });

    it('should suggest caching complex calculations', () => {
      context.cleanLines = [
        'strategy("Complex Calculations", overlay=true)',
        'complex_indicator = ta.sma(ta.rsi(close, 14), 21)',
        'if complex_indicator > 70',
        '    strategy.entry("Long", strategy.long)',
        'if complex_indicator < 30',
        '    strategy.entry("Short", strategy.short)'
      ];

      const result = validator.validate(context, config);
      expect(result.info.length).toBeGreaterThanOrEqual(1);
      const cachingSuggestion = result.info.find(i => i.code === 'PSV6-STRATEGY-CACHE-CALCULATIONS');
      expect(cachingSuggestion).toBeDefined();
      expect(cachingSuggestion!.message).toContain('Consider caching complex calculations');
    });
  });

  describe('Best Practices Validation', () => {
    it('should validate proper order management pattern', () => {
      context.cleanLines = [
        'strategy("Proper Management", overlay=true)',
        'var bool entered_position = false',
        'if primary_entry_condition and not entered_position',
        '    strategy.entry("Long", strategy.long)',
        '    entered_position := true',
        'if strategy.position_size == 0',
        '    entered_position := false'
      ];

      const result = validator.validate(context, config);
      // Should not generate warnings for proper pattern
      expect(result.warnings).toHaveLength(0);
      expect(result.info.length).toBeGreaterThanOrEqual(1);
      const goodPractice = result.info.find(i => i.code === 'PSV6-STRATEGY-GOOD-PRACTICE');
      expect(goodPractice).toBeDefined();
    });

    it('should detect missing order cancellation', () => {
      context.cleanLines = [
        'strategy("Missing Cancellation", overlay=true)',
        'if condition',
        '    strategy.order("Long", strategy.long, limit=limit_price)',
        'if exit_condition',
        '    strategy.close("Long")'
      ];

      const result = validator.validate(context, config);
      expect(result.info.length).toBeGreaterThanOrEqual(1);
      const cancellationSuggestion = result.info.find(i => i.code === 'PSV6-STRATEGY-CANCEL-SUGGESTION');
      expect(cancellationSuggestion).toBeDefined();
      expect(cancellationSuggestion!.message).toContain('Consider using strategy.cancel');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle strategies with no orders', () => {
      context.cleanLines = [
        'strategy("No Orders", overlay=true)',
        'plot(close)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle malformed strategy calls', () => {
      context.cleanLines = [
        'strategy("Malformed", overlay=true)',
        'strategy.entry()',
        'strategy.exit("Exit")'
      ];

      const result = validator.validate(context, config);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      const malformedError = result.errors.find(e => e.code === 'PSV6-STRATEGY-MALFORMED-CALL');
      expect(malformedError).toBeDefined();
    });

    it('should validate strategy function parameters', () => {
      context.cleanLines = [
        'strategy("Parameter Validation", overlay=true)',
        'strategy.entry("Long", strategy.long, qty=-1)',
        'strategy.exit("Exit", stop=-100)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      const paramError = result.errors.find(e => e.code === 'PSV6-STRATEGY-INVALID-PARAM');
      expect(paramError).toBeDefined();
    });
  });

  describe('Integration and Configuration', () => {
    it('should respect performance analysis configuration', () => {
      config.enablePerformanceAnalysis = false;
      
      context.cleanLines = [
        'strategy("No Performance Analysis", overlay=true)',
        'for i = 0 to 100',
        '    strategy.entry("Long" + str.tostring(i), strategy.long)'
      ];

      const result = validator.validate(context, config);
      // Should still warn about order limits but not performance
      const orderWarning = result.warnings.find(w => w.code === 'PSV6-STRATEGY-ORDER-LOOP');
      expect(orderWarning).toBeDefined();
      
      const perfWarning = result.warnings.find(w => w.code === 'PSV6-STRATEGY-EXPENSIVE-CONDITIONS');
      expect(perfWarning).toBeUndefined();
    });

    it('should provide comprehensive analysis results', () => {
      context.cleanLines = [
        'strategy("Comprehensive Test", overlay=true)',
        'if condition',
        '    strategy.entry("Long", strategy.long)'
      ];

      const result = validator.validate(context, config);
      expect(result.typeMap.has('strategy_order_analysis')).toBe(true);
      const analysis = result.typeMap.get('strategy_order_analysis');
      expect(analysis?.type).toBe('analysis');
    });
  });
});
