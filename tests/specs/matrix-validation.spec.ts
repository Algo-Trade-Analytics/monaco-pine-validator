/**
 * Matrix Validation Test Suite for Pine Script v6
 * Tests comprehensive matrix validation including declarations, operations, and best practices
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { ValidationContext, ValidatorConfig } from '../../core/types';
import { expectHas } from './test-utils';

describe('Matrix Validation (TDD)', () => {
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
      allowDeprecated: false,
      enableTypeChecking: true,
      enableControlFlowAnalysis: true,
      enablePerformanceAnalysis: true,
      enablePerformanceChecks: true,
      enableStyleChecks: true,
      strictMode: true,
      enableWarnings: true,
      enableInfo: true,
      customRules: [],
      ignoredCodes: []
    };
  });

  describe('PSV6-MATRIX-DECLARATION: Matrix Declaration Syntax Validation', () => {
    it('should validate correct matrix declaration syntax', () => {
      const code = `//@version=6
indicator("Matrix Declaration Test")

// Generic syntax
matrix1 = matrix.new<float>(5, 10)
matrix2 = matrix.new<string>(3, 4)

matrix3 = matrix.new<float>(2, 3)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.typeMap.has('matrix1')).toBe(true);
      expect(result.typeMap.get('matrix1')?.type).toBe('matrix');
      expect(result.typeMap.get('matrix1')?.elementType).toBe('float');
      expect(result.typeMap.get('matrix2')?.elementType).toBe('string');
      expect(result.typeMap.get('matrix3')?.elementType).toBe('float');
    });

    it('should error on invalid matrix declaration syntax', () => {
      const code = `//@version=6
indicator("Invalid Matrix Declaration Test")

// Missing type
invalid1 = matrix.new<>(5, 10)

// Invalid type
invalid2 = matrix.new<invalidtype>(3, 4)

// Missing dimensions
invalid3 = matrix.new<float>()

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(false);
      expectHas(result, { errors: ['PSV6-MATRIX-INVALID-SYNTAX'] });
    });

    it('should error on matrix dimensions exceeding limits', () => {
      const code = `//@version=6
indicator("Matrix Dimension Limit Test")

// Exceeds maximum dimensions
huge_matrix = matrix.new<float>(2000, 1500)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(false);
      expectHas(result, { errors: ['PSV6-MATRIX-DIMENSION-LIMIT'] });
    });

    it('should validate matrix type annotations', () => {
      const code = `//@version=6
indicator("Matrix Type Annotation Test")

// Explicit type annotation
matrix<float> data = matrix.new<float>(5, 5)
matrix<string> labels = matrix.new<string>(3, 3)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('PSV6-MATRIX-OPERATIONS: Matrix Operations Validation', () => {
    it('should validate correct matrix operations', () => {
      const code = `//@version=6
indicator("Matrix Operations Test")

data = matrix.new<float>(5, 5)

// Basic operations
matrix.set(data, 0, 0, close)
value = matrix.get(data, 0, 0)
rows = matrix.rows(data)
cols = matrix.columns(data)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on matrix operations on non-matrix variables', () => {
      const code = `//@version=6
indicator("Matrix Operations Error Test")

// Not a matrix
price = close

// Invalid operations
matrix.set(price, 0, 0, close)
value = matrix.get(price, 0, 0)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(false);
      expectHas(result, { errors: ['PSV6-MATRIX-NOT-MATRIX'] });
    });

    it('should validate matrix index bounds', () => {
      const code = `//@version=6
indicator("Matrix Index Bounds Test")

data = matrix.new<float>(3, 3)

// Valid indices
matrix.set(data, 0, 0, close)
matrix.set(data, 2, 2, close)

// Invalid indices (should warn)
matrix.set(data, 3, 0, close)  // Row out of bounds
matrix.set(data, 0, 3, close)  // Column out of bounds

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expectHas(result, { warnings: ['PSV6-MATRIX-INDEX-BOUNDS'] });
    });

    it('should validate matrix type consistency', () => {
      const code = `//@version=6
indicator("Matrix Type Consistency Test")

data = matrix.new<float>(3, 3)
labels = matrix.new<string>(2, 2)

// Type mismatches
matrix.set(data, 0, 0, "string")  // Wrong type
matrix.set(labels, 0, 0, 123)     // Wrong type

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(false);
      expectHas(result, { errors: ['PSV6-MATRIX-TYPE-MISMATCH'] });
    });
  });

  describe('PSV6-MATRIX-METHODS: Matrix Method Validation', () => {
    it('should validate matrix method parameters', () => {
      const code = `//@version=6
indicator("Matrix Method Parameters Test")

data = matrix.new<float>(3, 3)

// Valid method calls
matrix.set(data, 0, 0, close)
value = matrix.get(data, 0, 0)
rows = matrix.rows(data)
cols = matrix.columns(data)
matrix.fill(data, 0)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on invalid matrix method parameters', () => {
      const code = `//@version=6
indicator("Invalid Matrix Method Parameters Test")

data = matrix.new<float>(3, 3)

// Wrong number of parameters
matrix.set(data, 0)           // Missing column and value
matrix.get(data)              // Missing row and column
matrix.rows()                 // Missing matrix

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(false);
      expectHas(result, { errors: ['PSV6-FUNCTION-PARAM-COUNT'] });
    });

    it('should validate matrix method return types', () => {
      const code = `//@version=6
indicator("Matrix Method Return Types Test")

data = matrix.new<float>(3, 3)
matrix.set(data, 0, 0, close)

// Correct return type usage
rows = matrix.rows(data)        // Returns int
cols = matrix.columns(data)     // Returns int
value = matrix.get(data, 0, 0)  // Returns float

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('PSV6-MATRIX-PERFORMANCE: Matrix Performance Validation', () => {
    it('should warn on expensive matrix operations in loops', () => {
      const code = `//@version=6
indicator("Matrix Performance Test")

data = matrix.new<float>(100, 100)

// Expensive operations in loop
for i = 0 to 50
    matrix.set(data, i, i, close)
    matrix.copy(data)  // Expensive operation

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      
      // For this test, we only care about matrix-specific warnings
      // Function parameter type inference is handled by other validators
      const matrixWarnings = result.warnings.filter(warning => 
        warning.code?.startsWith('PSV6-MATRIX-')
      );
      
      expect(matrixWarnings.some(w => w.code === 'PSV6-MATRIX-PERF-LOOP')).toBe(true);
    });

    it('should warn on too many matrix allocations', () => {
      const code = `//@version=6
indicator("Matrix Allocation Test")

// Too many matrix allocations
matrix1 = matrix.new<float>(10, 10)
matrix2 = matrix.new<float>(10, 10)
matrix3 = matrix.new<float>(10, 10)
matrix4 = matrix.new<float>(10, 10)
matrix5 = matrix.new<float>(10, 10)
matrix6 = matrix.new<float>(10, 10)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expectHas(result, { warnings: ['PSV6-MATRIX-PERF-ALLOCATION'] });
    });

    it('should warn on large matrix operations', () => {
      const code = `//@version=6
indicator("Large Matrix Operations Test")

// Large matrix
data = matrix.new<float>(1000, 1000)

// Operations on large matrix
matrix.set(data, 0, 0, close)
matrix.fill(data, 0)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expectHas(result, { warnings: ['PSV6-MATRIX-PERF-LARGE'] });
    });
  });

  describe('PSV6-MATRIX-BEST-PRACTICES: Matrix Best Practices', () => {
    it('should suggest better matrix naming conventions', () => {
      const code = `//@version=6
indicator("Matrix Naming Test")

// Poor naming
m = matrix.new<float>(5, 5)
mat = matrix.new<string>(3, 3)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-MATRIX-NAMING-SUGGESTION'] });
    });

    it('should suggest matrix initialization best practices', () => {
      const code = `//@version=6
indicator("Matrix Initialization Test")

// Uninitialized matrix
data = matrix.new<float>(5, 5)

// Use without initialization
value = matrix.get(data, 0, 0)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-MATRIX-INITIALIZATION-SUGGESTION'] });
    });

    it('should suggest matrix memory management', () => {
      const code = `//@version=6
indicator("Matrix Memory Management Test")

data = matrix.new<float>(100, 100)

// Fill matrix but never clear
for i = 0 to 99
    for j = 0 to 99
        matrix.set(data, i, j, close)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      
      // For this test, we only care about matrix-specific info messages
      // Function parameter type inference is handled by other validators
      const matrixInfo = result.info.filter(info => 
        info.code?.startsWith('PSV6-MATRIX-')
      );
      
      expect(matrixInfo.some(i => i.code === 'PSV6-MATRIX-MEMORY-SUGGESTION')).toBe(true);
    });
  });

  describe('PSV6-MATRIX-COMPLEX: Complex Matrix Scenarios', () => {
    it('should handle nested matrix operations', () => {
      const code = `//@version=6
indicator("Nested Matrix Operations Test")

data = matrix.new<float>(5, 5)
matrix.set(data, 0, 0, close)

// Nested operations
if matrix.rows(data) > 0
    value = matrix.get(data, 0, 0)
    if value > 0
        matrix.set(data, 0, 0, value * 2)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle matrix in function parameters', () => {
      const code = `//@version=6
indicator("Matrix Function Parameters Test")

processMatrix(mat) =>
    if matrix.rows(mat) > 0 and matrix.columns(mat) > 0
        matrix.get(mat, 0, 0)
    else
        na

data = matrix.new<float>(3, 3)
result = processMatrix(data)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      
      // For this test, we only care about matrix-specific errors
      // Function parameter type inference is handled by other validators
      const matrixErrors = result.errors.filter(error => 
        error.code?.startsWith('PSV6-MATRIX-')
      );
      
      expect(matrixErrors).toEqual([]);
    });

    it('should handle matrix copying and slicing', () => {
      const code = `//@version=6
indicator("Matrix Copying Test")

data = matrix.new<float>(5, 5)
matrix.set(data, 0, 0, close)

// Copy operations
copy = matrix.copy(data)

plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
