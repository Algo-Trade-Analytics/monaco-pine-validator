/**
 * Array Validation Test Suite for Pine Script v6
 * Tests comprehensive array validation including declarations, operations, and best practices
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { ValidationContext, ValidatorConfig } from '../../core/types';
import { expectHas } from './test-utils';

describe('Array Validation (TDD)', () => {
  let validator: EnhancedModularValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new EnhancedModularValidator();
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
      hasVersion: false,
      firstVersionLine: null
    };
    config = {
      targetVersion: 6,
      strictMode: true,
      allowDeprecated: false,
      enableTypeChecking: true,
      enableControlFlowAnalysis: true,
      enablePerformanceAnalysis: true,
      enableWarnings: true,
      enableInfo: true,
      customRules: [],
      ignoredCodes: ['PSV6-FUNCTION-PARAM-TYPE']
    };
  });

  describe('PSV6-ARRAY-DECLARATION: Array Declaration Syntax Validation', () => {
    it('should validate correct array declaration syntax', () => {
      const code = `//@version=6
indicator("Array Declaration Test")

// Generic syntax
prices = array.new<float>(10)
names = array.new<string>(5, "default")

values = array.new<float>(20)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.typeMap.has('prices')).toBe(true);
      expect(result.typeMap.get('prices')?.type).toBe('array');
      expect(result.typeMap.get('prices')?.elementType).toBe('float');
      expect(result.typeMap.has('names')).toBe(true);
      expect(result.typeMap.get('names')?.elementType).toBe('string');
      expect(result.typeMap.has('values')).toBe(true);
      expect(result.typeMap.get('values')?.elementType).toBe('float');
    });

    it('should error on invalid array declaration syntax', () => {
      const code = `//@version=6
indicator("Invalid Array Declaration Test")

// Missing type
invalid1 = array.new<>(10)

// Invalid type
invalid2 = array.new<invalidtype>(5)

// Missing size
invalid3 = array.new<float>()

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(false);
      expectHas(result, { errors: ['PSV6-ARRAY-INVALID-SYNTAX'] });
    });

    it('should error on array size exceeding limits', () => {
      const code = `//@version=6
indicator("Array Size Limit Test")

// Exceeds maximum size
huge_array = array.new<float>(200000)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(false);
      expectHas(result, { errors: ['PSV6-ARRAY-SIZE-LIMIT'] });
    });

    it('should validate array type annotations', () => {
      const code = `//@version=6
indicator("Array Type Annotation Test")

// Explicit type annotation
array<float> prices = array.new<float>(10)
array<string> names = array.new<string>(5)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('PSV6-ARRAY-OPERATIONS: Array Operations Validation', () => {
    it('should validate correct array operations', () => {
      const code = `//@version=6
indicator("Array Operations Test")

prices = array.new<float>(10)

// Basic operations
array.push(prices, close)
value = array.get(prices, 0)
array.set(prices, 1, open)
size = array.size(prices)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on array operations on non-array variables', () => {
      const code = `//@version=6
indicator("Array Operations Error Test")

// Not an array
price = close

// Invalid operations
array.push(price, close)
value = array.get(price, 0)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(false);
      expectHas(result, { errors: ['PSV6-ARRAY-NOT-ARRAY'] });
    });

    it('should validate array index bounds', () => {
      const code = `//@version=6
indicator("Array Index Bounds Test")

prices = array.new<float>(5)

// Valid indices
array.set(prices, 0, close)
array.set(prices, 4, close)

// Invalid indices (should warn)
array.set(prices, 5, close)  // Out of bounds
array.set(prices, -6, close) // Too negative

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expectHas(result, { warnings: ['PSV6-ARRAY-INDEX-BOUNDS'] });
    });

    it('should accept advanced array utility functions', () => {
      const code = `//@version=6
indicator("Array Advanced Functions")

arr = array.new_float(5, close)
array.fill(arr, open)
array.concat(arr, array.new_float(2, close))
firstValue = array.first(arr)
lastValue = array.last(arr)
total = array.sum(arr)
volatility = array.stdev(arr)
sortedIndices = array.sort_indices(arr)
percentile = array.percentile_linear_interpolation(arr, 50)
array.standardize(arr)

plot(total)
plot(volatility)
plot(percentile)
      `;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate array type consistency', () => {
      const code = `//@version=6
indicator("Array Type Consistency Test")

prices = array.new<float>(10)
names = array.new<string>(5)

// Type mismatches
array.push(prices, "string")  // Wrong type
array.push(names, 123)        // Wrong type

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(false);
      expectHas(result, { errors: ['PSV6-ARRAY-TYPE-MISMATCH'] });
    });

    it('should allow array pushes when element type is inferred within the same function', () => {
      const code = `//@version=6
indicator("Array Type Inference Loop")

processData(array<float> data, float threshold) =>
    filtered = array.new<float>()
    for i = 0 to array.size(data) - 1
        if array.get(data, i) > threshold
            array.push(filtered, array.get(data, i))
    filtered

data = array.from(close, high, low)
result = processData(data, close * 0.95)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.errors.map(e => e.code)).not.toContain('PSV6-ARRAY-TYPE-MISMATCH');
    });
  });

  describe('PSV6-ARRAY-METHODS: Array Method Validation', () => {
    it('should validate array method parameters', () => {
      const code = `//@version=6
indicator("Array Method Parameters Test")

prices = array.new<float>(10)

// Valid method calls
array.push(prices, close)
array.pop(prices)
array.clear(prices)
array.reverse(prices)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on invalid array method parameters', () => {
      const code = `//@version=6
indicator("Invalid Array Method Parameters Test")

prices = array.new<float>(10)

// Wrong number of parameters
array.push(prices)           // Missing value
array.get(prices)            // Missing index
array.set(prices, 0)         // Missing value

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(false);
      expectHas(result, { errors: ['PSV6-ARRAY-METHOD-PARAMS'] });
    });

    it('should validate array method return types', () => {
      const code = `//@version=6
indicator("Array Method Return Types Test")

prices = array.new<float>(10)
array.push(prices, close)

// Correct return type usage
size = array.size(prices)        // Returns int
value = array.get(prices, 0)     // Returns float
index = array.indexof(prices, close)  // Returns int

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('PSV6-ARRAY-PERFORMANCE: Array Performance Validation', () => {
    it('should warn on expensive array operations in loops', () => {
      const code = `//@version=6
indicator("Array Performance Test")

prices = array.new<float>(1000)

// Expensive operations in loop
for i = 0 to 100
    array.push(prices, close)
    array.reverse(prices)  // Expensive operation

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expectHas(result, { warnings: ['PSV6-ARRAY-PERF-LOOP'] });
    });

    it('should warn on too many array allocations', () => {
      const code = `//@version=6
indicator("Array Allocation Test")

// Too many array allocations
arr1 = array.new<float>(100)
arr2 = array.new<float>(100)
arr3 = array.new<float>(100)
arr4 = array.new<float>(100)
arr5 = array.new<float>(100)
arr6 = array.new<float>(100)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expectHas(result, { warnings: ['PSV6-ARRAY-PERF-ALLOCATION'] });
    });

    it('should warn on large array operations', () => {
      const code = `//@version=6
indicator("Large Array Operations Test")

// Large array
prices = array.new<float>(50000)

// Operations on large array
array.push(prices, close)
array.sort(prices)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expectHas(result, { warnings: ['PSV6-ARRAY-PERF-LARGE'] });
    });
  });

  describe('PSV6-ARRAY-BEST-PRACTICES: Array Best Practices', () => {
    it('should suggest better array naming conventions', () => {
      const code = `//@version=6
indicator("Array Naming Test")

// Poor naming
a = array.new<float>(10)
arr = array.new<string>(5)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-ARRAY-NAMING-SUGGESTION'] });
    });

    it('should suggest array initialization best practices', () => {
      const code = `//@version=6
indicator("Array Initialization Test")

// Uninitialized array
prices = array.new<float>(10)

// Use without initialization
value = array.get(prices, 0)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-ARRAY-INITIALIZATION-SUGGESTION'] });
    });

    it('should suggest array memory management', () => {
      const code = `//@version=6
indicator("Array Memory Management Test")

prices = array.new<float>(1000)

// Fill array but never clear
for i = 0 to 999
    array.push(prices, close)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-ARRAY-MEMORY-SUGGESTION'] });
    });
  });

  describe('PSV6-ARRAY-COMPLEX: Complex Array Scenarios', () => {
    it('should handle nested array operations', () => {
      const code = `//@version=6
indicator("Nested Array Operations Test")

prices = array.new<float>(10)
array.push(prices, close)

// Nested operations
if array.size(prices) > 0
    value = array.get(prices, 0)
    if value > 0
        array.set(prices, 0, value * 2)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle array in function parameters', () => {
      const code = `//@version=6
indicator("Array Function Parameters Test")

processArray(arr) =>
    if array.size(arr) > 0
        array.get(arr, 0)
    else
        na

prices = array.new<float>(10)
result = processArray(prices)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);

      // For this test, we only care about array-specific errors
      // Function parameter type inference is handled by other validators
      const arrayErrors = result.errors.filter(error =>
        error.code?.startsWith('PSV6-ARRAY-')
      );

      expect(arrayErrors).toEqual([]);
    });

    it('should handle array copying and slicing', () => {
      const code = `//@version=6
indicator("Array Copying Test")

prices = array.new<float>(10)
array.push(prices, close)

// Copy operations
copy = array.copy(prices)
slice = array.slice(prices, 0, 5)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
