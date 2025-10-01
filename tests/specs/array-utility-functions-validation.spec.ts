/**
 * Array Utility Functions Validation Tests (TDD)
 * 
 * PHASE 3 - MEDIUM PRIORITY
 * Coverage Gap: 52% (29/56 array functions untested)
 * 
 * Following TDD: These tests are written FIRST and will initially FAIL
 * until the Array Validator is extended.
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../..';
import { ChevrotainAstService } from '../../core/ast/service';

describe('Array Utility Functions Validation (TDD)', () => {
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
  // Category 1: Array Creation & Manipulation (Previously Untested)
  // ============================================================================

  describe('PSV6-ARRAY-CREATION: Array Creation Functions', () => {
    
    it('should validate array.from()', () => {
      const code = `
//@version=6
indicator("Array From")

arr = array.from(1, 2, 3, 4, 5)
plot(array.get(arr, 0))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.copy()', () => {
      const code = `
//@version=6
indicator("Array Copy")

original = array.from(1, 2, 3)
copied = array.copy(original)
plot(array.get(copied, 0))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.concat()', () => {
      const code = `
//@version=6
indicator("Array Concat")

arr1 = array.from(1, 2, 3)
arr2 = array.from(4, 5, 6)
combined = array.concat(arr1, arr2)
plot(array.size(combined))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-ARRAY-SEARCH: Array Search Functions', () => {
    
    it('should validate array.indexof()', () => {
      const code = `
//@version=6
indicator("Array IndexOf")

arr = array.from(10, 20, 30, 40)
index = array.indexof(arr, 30)
plot(index)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.lastindexof()', () => {
      const code = `
//@version=6
indicator("Array LastIndexOf")

arr = array.from(1, 2, 3, 2, 1)
lastIndex = array.lastindexof(arr, 2)
plot(lastIndex)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.includes()', () => {
      const code = `
//@version=6
indicator("Array Includes")

arr = array.from(10, 20, 30)
hasValue = array.includes(arr, 20)
plot(hasValue ? 1 : 0)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.binary_search()', () => {
      const code = `
//@version=6
indicator("Binary Search")

arr = array.from(10, 20, 30, 40, 50)
index = array.binary_search(arr, 30)
plot(index)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.binary_search_leftmost()', () => {
      const code = `
//@version=6
indicator("Binary Search Leftmost")

arr = array.from(10, 20, 20, 30)
index = array.binary_search_leftmost(arr, 20)
plot(index)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.binary_search_rightmost()', () => {
      const code = `
//@version=6
indicator("Binary Search Rightmost")

arr = array.from(10, 20, 20, 30)
index = array.binary_search_rightmost(arr, 20)
plot(index)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-ARRAY-MODIFY: Array Modification Functions', () => {
    
    it('should validate array.insert()', () => {
      const code = `
//@version=6
indicator("Array Insert")

arr = array.from(1, 2, 4, 5)
array.insert(arr, 2, 3)
plot(array.get(arr, 2))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.remove()', () => {
      const code = `
//@version=6
indicator("Array Remove")

arr = array.from(1, 2, 3, 4)
removed = array.remove(arr, 2)
plot(removed)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.reverse()', () => {
      const code = `
//@version=6
indicator("Array Reverse")

arr = array.from(1, 2, 3, 4)
array.reverse(arr)
plot(array.get(arr, 0))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.sort()', () => {
      const code = `
//@version=6
indicator("Array Sort")

arr = array.from(3, 1, 4, 2)
array.sort(arr)
plot(array.get(arr, 0))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.sort with order parameter', () => {
      const code = `
//@version=6
indicator("Array Sort Descending")

arr = array.from(1, 2, 3, 4)
array.sort(arr, order.descending)
plot(array.get(arr, 0))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.sort_indices()', () => {
      const code = `
//@version=6
indicator("Array Sort Indices")

arr = array.from(3, 1, 4, 2)
indices = array.sort_indices(arr)
plot(array.get(indices, 0))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-ARRAY-STATS: Array Statistical Functions', () => {
    
    it('should validate array.min()', () => {
      const code = `
//@version=6
indicator("Array Min")

arr = array.from(5, 2, 8, 1, 9)
minimum = array.min(arr)
plot(minimum)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.max()', () => {
      const code = `
//@version=6
indicator("Array Max")

arr = array.from(5, 2, 8, 1, 9)
maximum = array.max(arr)
plot(maximum)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.sum()', () => {
      const code = `
//@version=6
indicator("Array Sum")

arr = array.from(1, 2, 3, 4, 5)
total = array.sum(arr)
plot(total)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.avg()', () => {
      const code = `
//@version=6
indicator("Array Average")

arr = array.from(10, 20, 30, 40)
average = array.avg(arr)
plot(average)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.median()', () => {
      const code = `
//@version=6
indicator("Array Median")

arr = array.from(1, 3, 5, 7, 9)
med = array.median(arr)
plot(med)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.mode()', () => {
      const code = `
//@version=6
indicator("Array Mode")

arr = array.from(1, 2, 2, 3, 2, 4)
mostCommon = array.mode(arr)
plot(mostCommon)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.variance()', () => {
      const code = `
//@version=6
indicator("Array Variance")

arr = array.from(1, 2, 3, 4, 5)
variance = array.variance(arr)
plot(variance)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.stdev()', () => {
      const code = `
//@version=6
indicator("Array Standard Deviation")

arr = array.from(1, 2, 3, 4, 5)
stdDev = array.stdev(arr)
plot(stdDev)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.range()', () => {
      const code = `
//@version=6
indicator("Array Range")

arr = array.from(10, 50, 30, 20)
range = array.range(arr)
plot(range)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.percentile_linear_interpolation()', () => {
      const code = `
//@version=6
indicator("Array Percentile")

arr = array.from(10, 20, 30, 40, 50)
p50 = array.percentile_linear_interpolation(arr, 50)
plot(p50)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.percentile_nearest_rank()', () => {
      const code = `
//@version=6
indicator("Array Percentile Nearest")

arr = array.from(10, 20, 30, 40, 50)
p75 = array.percentile_nearest_rank(arr, 75)
plot(p75)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.percentrank()', () => {
      const code = `
//@version=6
indicator("Array Percent Rank")

arr = array.from(10, 20, 30, 40, 50)
rank = array.percentrank(arr, 30)
plot(rank)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.covariance()', () => {
      const code = `
//@version=6
indicator("Array Covariance")

arr1 = array.from(1, 2, 3, 4, 5)
arr2 = array.from(5, 4, 3, 2, 1)
cov = array.covariance(arr1, arr2)
plot(cov)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-ARRAY-SLICE: Array Slicing Functions', () => {
    
    it('should validate array.slice()', () => {
      const code = `
//@version=6
indicator("Array Slice")

arr = array.from(1, 2, 3, 4, 5)
sliced = array.slice(arr, 1, 4)
plot(array.size(sliced))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.first()', () => {
      const code = `
//@version=6
indicator("Array First")

arr = array.from(10, 20, 30)
first = array.first(arr)
plot(first)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array.last()', () => {
      const code = `
//@version=6
indicator("Array Last")

arr = array.from(10, 20, 30)
last = array.last(arr)
plot(last)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Error Cases
  // ============================================================================

  describe('PSV6-ARRAY-ERRORS: Array Function Error Cases', () => {
    
    it('should error on array.binary_search with unsorted array', () => {
      const code = `
//@version=6
indicator("Unsorted Binary Search")

// Binary search requires sorted array
unsorted = array.from(3, 1, 4, 2)
index = array.binary_search(unsorted, 3)
      `;

      const result = createValidator().validate(code);
      // Should warn about unsorted array
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should error on invalid percentile range', () => {
      const code = `
//@version=6
indicator("Invalid Percentile")

arr = array.from(1, 2, 3)
p = array.percentile_linear_interpolation(arr, 150)  // Must be 0-100
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should error on covariance with mismatched array sizes', () => {
      const code = `
//@version=6
indicator("Mismatched Covariance")

arr1 = array.from(1, 2, 3)
arr2 = array.from(1, 2)  // Different size
cov = array.covariance(arr1, arr2)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should error on invalid slice indices', () => {
      const code = `
//@version=6
indicator("Invalid Slice")

arr = array.from(1, 2, 3)
sliced = array.slice(arr, 5, 10)  // Out of bounds
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

