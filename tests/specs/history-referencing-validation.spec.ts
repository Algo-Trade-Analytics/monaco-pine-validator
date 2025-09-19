import { EnhancedModularValidator } from '../..';
import { ValidationContext, ValidatorConfig } from '../../core/types';
import { expectHas, expectLacks } from './test-utils';

/// <reference types="vitest/globals" />

describe('History Referencing Validation (TDD)', () => {
  let validator: EnhancedModularValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new EnhancedModularValidator({
      targetVersion: 6,
      strictMode: true,
      enablePerformanceAnalysis: true
    });

    context = {
      cleanLines: [],
      lines: [],
      lineFeeds: [],
      comments: [],
      regions: [],
      userFunctions: new Map(),
      functionCalls: [],
      functionNames: new Set(),
      functionParams: new Map(),
      methodNames: new Set(),
      typeMap: new Map(),
      udtTypes: new Map(),
      varipVariables: new Set(),
      switchStatements: [],
      whileLoops: [],
      requestCalls: []
    };

    config = {
      targetVersion: 6,
      strictMode: true,
      enablePerformanceAnalysis: true,
      enableStyleChecks: true
    };
  });

  describe('PSV6-HISTORY-BASIC: Basic History Referencing', () => {
    it('should validate correct history references', () => {
      const code = `//@version=6
indicator("History Test")

// Valid history references
prevClose = close[1]
prevHigh = high[2]
prevLow = low[3]

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      // Only check history-specific errors
      const historyErrors = result.errors.filter(e => e.code.startsWith('PSV6-HISTORY'));
      expect(historyErrors).toEqual([]);
    });

    it('should error on invalid history index', () => {
      const code = `//@version=6
indicator("History Test")

// Invalid history index
prevClose = close[-1]

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-HISTORY-INVALID-INDEX'] });
    });

    it('should warn on large history index', () => {
      const code = `//@version=6
indicator("History Test")

// Large history index
oldClose = close[5000]

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-HISTORY-LARGE-INDEX'] });
    });
  });

  describe('PSV6-HISTORY-PERF: History Performance Validation', () => {
    it('should warn on multiple history references in loop', () => {
      const code = `//@version=6
indicator("History Performance Test")

// Multiple history references in loop
for i = 0 to 10
    sum += close[i]

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-HISTORY-PERF-LOOP'] });
    });

    it('should warn on nested history references', () => {
      const code = `//@version=6
indicator("History Performance Test")

// Nested history references
nestedRef = close[high[1]]

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-HISTORY-PERF-NESTED'] });
    });
  });

  describe('PSV6-HISTORY-SCOPE: History Scope Validation', () => {
    it('should error on history reference in varip context', () => {
      const code = `//@version=6
indicator("History Scope Test")

varip int counter = 0
counter := counter + close[1]  // Error: history reference in varip context

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-HISTORY-VARIP-CONTEXT'] });
    });

    it('should warn on history reference in function parameter', () => {
      const code = `//@version=6
indicator("History Scope Test")

f_processValue(val) =>
    val * 2

result = f_processValue(close[1])  // Warning: history reference in function parameter

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-HISTORY-FUNCTION-PARAM'] });
    });
  });

  describe('PSV6-HISTORY-TYPE: History Type Validation', () => {
    it('should validate history reference type consistency', () => {
      const code = `//@version=6
indicator("History Type Test")

// Valid type consistency
float prevClose = close[1]
int prevBarIndex = bar_index[1]

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      // Only check history-specific errors
      const historyErrors = result.errors.filter(e => e.code.startsWith('PSV6-HISTORY'));
      expect(historyErrors).toEqual([]);
    });

    it('should warn on type mismatch in history reference', () => {
      const code = `//@version=6
indicator("History Type Test")

// Type mismatch
int prevClose = close[1]  // Warning: float to int conversion

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-HISTORY-TYPE-MISMATCH'] });
    });
  });

  describe('PSV6-HISTORY-COMPLEX: Complex History Scenarios', () => {
    it('should handle complex history expressions', () => {
      const code = `//@version=6
indicator("Complex History Test")

// Complex history expressions
avgClose = (close[1] + close[2] + close[3]) / 3
priceChange = close - close[1]
percentChange = (close - close[1]) / close[1] * 100

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      // Only check history-specific errors
      const historyErrors = result.errors.filter(e => e.code.startsWith('PSV6-HISTORY'));
      expect(historyErrors).toEqual([]);
    });

    it('should handle history references in conditional expressions', () => {
      const code = `//@version=6
indicator("History Conditional Test")

// History references in conditionals
isUp = close > close[1]
isDown = close < close[1]
isSideways = close == close[1]

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      // Only check history-specific errors
      const historyErrors = result.errors.filter(e => e.code.startsWith('PSV6-HISTORY'));
      expect(historyErrors).toEqual([]);
    });
  });
});
