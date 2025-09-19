import { describe, it, expect, beforeEach } from 'vitest';
import { LazyEvaluationValidator } from '../../modules/lazy-evaluation-validator';
import { ValidationContext, ValidatorConfig } from '../../core/types';

describe('LazyEvaluationValidator', () => {
  let validator: LazyEvaluationValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new LazyEvaluationValidator();
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
      scriptType: null,
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

  describe('Conditional Historical Function Execution', () => {
    it('should warn about TA functions in conditional expressions', () => {
      context.cleanLines = [
        'condition = close > open',
        'sma_value = condition ? ta.sma(close, 20) : na'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('PSV6-LAZY-EVAL-HISTORICAL');
      expect(result.warnings[0].message).toContain('Historical function ta.sma in conditional expression');
    });

    it('should warn about multiple historical functions in ternary', () => {
      context.cleanLines = [
        'trend = close > close[1] ? ta.ema(close, 10) : ta.sma(close, 20)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0].code).toBe('PSV6-LAZY-EVAL-HISTORICAL');
      expect(result.warnings[1].code).toBe('PSV6-LAZY-EVAL-HISTORICAL');
    });

    it('should warn about historical functions in if statements', () => {
      context.cleanLines = [
        'if close > open',
        '    rsi_value = ta.rsi(close, 14)',
        '    macd_line = ta.macd(close, 12, 26, 9)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0].code).toBe('PSV6-LAZY-EVAL-CONDITIONAL');
      expect(result.warnings[1].code).toBe('PSV6-LAZY-EVAL-CONDITIONAL');
    });

    it('should warn about request.security in conditionals', () => {
      context.cleanLines = [
        'higher_tf_data = timeframe.period == "1D" ? request.security(syminfo.tickerid, "1W", close) : close'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('PSV6-LAZY-EVAL-HISTORICAL');
      expect(result.warnings[0].message).toContain('Historical function request.security in conditional expression');
    });

    it('should not warn about non-historical functions in conditionals', () => {
      context.cleanLines = [
        'result = condition ? math.max(a, b) : math.min(a, b)',
        'color_value = bullish ? color.green : color.red'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Variable Assignment with Historical Dependencies', () => {
    it('should warn about conditional assignment of historical calculations', () => {
      context.cleanLines = [
        'var float sma_value = na',
        'if barstate.isconfirmed',
        '    sma_value := ta.sma(close, 20)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('PSV6-LAZY-EVAL-CONDITIONAL');
      expect(result.warnings[0].message).toContain('Historical function ta.sma in conditional block');
    });

    it('should warn about loop-based historical calculations', () => {
      context.cleanLines = [
        'for i = 0 to 10',
        '    if i % 2 == 0',
        '        avg_value = ta.sma(close, i + 5)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('PSV6-LAZY-EVAL-LOOP');
      expect(result.warnings[0].message).toContain('Historical function ta.sma in loop');
    });

    it('should detect series inconsistency patterns', () => {
      context.cleanLines = [
        'var series<float> dynamic_sma = na',
        'if close > high[1]',
        '    dynamic_sma := ta.sma(close, 20)',
        'else',
        '    dynamic_sma := na'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('PSV6-LAZY-EVAL-SERIES-INCONSISTENCY');
      expect(result.warnings[0].message).toContain('Series may have inconsistent historical data');
    });
  });

  describe('Function Call Analysis', () => {
    it('should warn about historical functions passed as parameters conditionally', () => {
      context.cleanLines = [
        'plot_value = condition ? plot(ta.sma(close, 20)) : plot(close)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('PSV6-LAZY-EVAL-HISTORICAL');
      expect(result.warnings[0].message).toContain('Historical function ta.sma in conditional expression');
    });

    it('should detect nested historical function calls in conditionals', () => {
      context.cleanLines = [
        'complex_calc = trend_up ? ta.ema(ta.sma(close, 10), 5) : ta.rsi(close, 14)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(3); // ta.ema, ta.sma, ta.rsi
      expect(result.warnings.every(w => w.code === 'PSV6-LAZY-EVAL-HISTORICAL')).toBe(true);
    });

    it('should warn about user-defined functions with historical dependencies', () => {
      context.cleanLines = [
        'my_indicator(length) => ta.sma(close, length) + ta.rsi(close, length)',
        'result = bullish ? my_indicator(20) : 0'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('PSV6-LAZY-EVAL-USER-FUNCTION');
      expect(result.warnings[0].message).toContain('User function my_indicator may have historical dependencies');
    });
  });

  describe('Switch Statement Analysis', () => {
    it('should warn about historical functions in switch cases', () => {
      context.cleanLines = [
        'switch trend_type',
        '    "sma" => ta.sma(close, 20)',
        '    "ema" => ta.ema(close, 20)',
        '    => close'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0].code).toBe('PSV6-LAZY-EVAL-SWITCH');
      expect(result.warnings[1].code).toBe('PSV6-LAZY-EVAL-SWITCH');
    });

    it('should handle complex switch expressions with historical functions', () => {
      context.cleanLines = [
        'indicator_value = switch ma_type',
        '    1 => ta.sma(close, period)',
        '    2 => ta.ema(close, period)',
        '    3 => ta.wma(close, period)',
        '    => ta.rma(close, period)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(4); // All four TA functions
      expect(result.warnings.every(w => w.code === 'PSV6-LAZY-EVAL-SWITCH')).toBe(true);
    });
  });

  describe('Performance Impact Analysis', () => {
    it('should warn about expensive historical calculations in conditionals', () => {
      context.cleanLines = [
        'expensive_calc = condition ? ta.correlation(close, volume, 100) : 0'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0].code).toBe('PSV6-LAZY-EVAL-HISTORICAL');
      expect(result.warnings[1].code).toBe('PSV6-LAZY-EVAL-PERFORMANCE');
      expect(result.warnings[1].message).toContain('Expensive historical calculation in conditional');
    });

    it('should detect multiple conditional historical calculations', () => {
      context.cleanLines = [
        'val1 = cond1 ? ta.sma(close, 50) : na',
        'val2 = cond2 ? ta.ema(close, 50) : na',
        'val3 = cond3 ? ta.rsi(close, 14) : na',
        'val4 = cond4 ? ta.macd(close, 12, 26, 9) : na'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings.length).toBeGreaterThanOrEqual(4);
      const perfWarning = result.warnings.find(w => w.code === 'PSV6-LAZY-EVAL-MANY-CONDITIONALS');
      expect(perfWarning).toBeDefined();
      expect(perfWarning!.message).toContain('Multiple conditional historical calculations detected');
    });
  });

  describe('Best Practices and Suggestions', () => {
    it('should suggest pre-calculating historical values', () => {
      context.cleanLines = [
        'trend_value = uptrend ? ta.sma(close, 20) : ta.ema(close, 20)'
      ];

      const result = validator.validate(context, config);
      expect(result.info).toHaveLength(1);
      expect(result.info[0].code).toBe('PSV6-LAZY-EVAL-PRECALC-SUGGESTION');
      expect(result.info[0].message).toContain('Consider pre-calculating historical values');
    });

    it('should suggest using var for consistent series', () => {
      context.cleanLines = [
        'if condition',
        '    sma_value = ta.sma(close, 20)',
        'plot(sma_value)'
      ];

      const result = validator.validate(context, config);
      expect(result.info).toHaveLength(1);
      expect(result.info[0].code).toBe('PSV6-LAZY-EVAL-VAR-SUGGESTION');
      expect(result.info[0].message).toContain('Consider using var declaration for consistent series');
    });

    it('should suggest alternative patterns for conditional indicators', () => {
      context.cleanLines = [
        'indicator = trend == 1 ? ta.sma(close, 20) : trend == 2 ? ta.ema(close, 20) : close'
      ];

      const result = validator.validate(context, config);
      expect(result.info).toHaveLength(1);
      expect(result.info[0].code).toBe('PSV6-LAZY-EVAL-PATTERN-SUGGESTION');
      expect(result.info[0].message).toContain('Consider using consistent calculation pattern');
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle deeply nested conditional expressions', () => {
      context.cleanLines = [
        'complex = a ? (b ? ta.sma(close, 10) : ta.ema(close, 10)) : (c ? ta.rsi(close, 14) : close)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(3); // ta.sma, ta.ema, ta.rsi
      expect(result.warnings.every(w => w.code === 'PSV6-LAZY-EVAL-HISTORICAL')).toBe(true);
    });

    it('should detect historical functions in array/matrix operations', () => {
      context.cleanLines = [
        'values = array.new<float>()',
        'if condition',
        '    array.push(values, ta.sma(close, 20))'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('PSV6-LAZY-EVAL-CONDITIONAL');
    });

    it('should handle method calls on historical results', () => {
      context.cleanLines = [
        'sma_array = condition ? array.from(ta.sma(close, 20)) : array.new<float>()'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('PSV6-LAZY-EVAL-HISTORICAL');
    });

    it('should detect historical functions in custom type methods', () => {
      context.cleanLines = [
        'type MyType',
        '    float value',
        '    calculate() => ta.sma(this.value, 10)',
        'obj = MyType.new(close)',
        'result = condition ? obj.calculate() : 0'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('PSV6-LAZY-EVAL-METHOD');
      expect(result.warnings[0].message).toContain('Method call may contain historical dependencies');
    });
  });

  describe('Integration with Other Validators', () => {
    it('should work with type information from other validators', () => {
      // Simulate type information from other validators
      context.typeMap.set('my_sma', { type: 'series', declaredAt: { line: 1, column: 1 }, usages: [] } as any);
      
      context.cleanLines = [
        'my_sma = ta.sma(close, 20)',
        'result = condition ? my_sma : close'
      ];

      const result = validator.validate(context, config);
      // Should not warn about using pre-calculated series
      expect(result.warnings).toHaveLength(0);
    });

    it('should provide analysis results for other validators', () => {
      context.cleanLines = [
        'conditional_sma = uptrend ? ta.sma(close, 20) : na'
      ];

      const result = validator.validate(context, config);
      expect(result.typeMap.has('conditional_historical_functions')).toBe(true);
      expect(result.typeMap.get('conditional_historical_functions')?.type).toBe('analysis');
    });
  });

  describe('Configuration-Based Behavior', () => {
    it('should respect performance analysis configuration', () => {
      config.enablePerformanceAnalysis = false;
      
      context.cleanLines = [
        'expensive = condition ? ta.correlation(close, volume, 100) : 0'
      ];

      const result = validator.validate(context, config);
      // Should still warn about lazy evaluation but not performance
      expect(result.warnings.some(w => w.code === 'PSV6-LAZY-EVAL-HISTORICAL')).toBe(true);
      expect(result.warnings.some(w => w.code === 'PSV6-LAZY-EVAL-PERFORMANCE')).toBe(false);
    });

    it('should respect best practices configuration', () => {
      config.enablePerformanceAnalysis = false;
      
      context.cleanLines = [
        'trend_value = uptrend ? ta.sma(close, 20) : ta.ema(close, 20)'
      ];

      const result = validator.validate(context, config);
      // Should warn about lazy evaluation but not provide suggestions
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.info).toHaveLength(0);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle common trading strategy patterns', () => {
      context.cleanLines = [
        'strategy("Lazy Eval Test", overlay=true)',
        'length = input.int(20, "Length")',
        'use_ema = input.bool(false, "Use EMA")',
        'ma = use_ema ? ta.ema(close, length) : ta.sma(close, length)',
        'signal = ta.crossover(close, ma)',
        'if signal',
        '    strategy.entry("Long", strategy.long)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(2); // ta.ema and ta.sma in ternary
      expect(result.info).toHaveLength(1); // Pre-calculation suggestion
    });

    it('should handle indicator scripts with conditional calculations', () => {
      context.cleanLines = [
        'indicator("Multi-MA", overlay=true)',
        'ma_type = input.string("SMA", "MA Type", options=["SMA", "EMA", "WMA"])',
        'length = input.int(20, "Length")',
        'ma_value = switch ma_type',
        '    "SMA" => ta.sma(close, length)',
        '    "EMA" => ta.ema(close, length)',
        '    "WMA" => ta.wma(close, length)',
        '    => close',
        'plot(ma_value)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(3); // Three TA functions in switch
      expect(result.info).toHaveLength(1); // Pattern suggestion
    });
  });
});
