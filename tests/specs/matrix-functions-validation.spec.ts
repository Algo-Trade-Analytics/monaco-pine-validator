/**
 * Matrix Functions Validation Tests (TDD)
 * 
 * PHASE 1 - HIGH PRIORITY
 * Coverage Gap: 84% (41/49 functions untested)
 * 
 * Following TDD: These tests are written FIRST and will initially FAIL
 * until the Matrix Validator is implemented.
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../..';
import { ChevrotainAstService } from '../../core/ast/service';

describe('Matrix Functions Validation (TDD)', () => {
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
  // Category 1: Matrix Creation & Basic Operations (10 functions)
  // ============================================================================
  
  describe('PSV6-MATRIX-CREATION: Matrix Creation & Basic Operations', () => {
    
    it('should validate matrix.add_row()', () => {
      const code = `
//@version=6
indicator("Matrix Add Row")

m = matrix.new<float>(2, 2, 0.0)
matrix.add_row(m, 1, array.from(5.0, 6.0))
plot(matrix.get(m, 1, 0))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.add_col()', () => {
      const code = `
//@version=6
indicator("Matrix Add Col")

m = matrix.new<float>(2, 2, 0.0)
matrix.add_col(m, 1, array.from(5.0, 6.0))
plot(matrix.get(m, 0, 1))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.remove_row()', () => {
      const code = `
//@version=6
indicator("Matrix Remove Row")

m = matrix.new<float>(3, 2, 1.0)
matrix.remove_row(m, 1)
rowCount = matrix.rows(m)
plot(rowCount)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.remove_col()', () => {
      const code = `
//@version=6
indicator("Matrix Remove Col")

m = matrix.new<float>(2, 3, 1.0)
matrix.remove_col(m, 1)
colCount = matrix.columns(m)
plot(colCount)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.elements_count()', () => {
      const code = `
//@version=6
indicator("Matrix Elements Count")

m = matrix.new<float>(3, 4, 1.0)
count = matrix.elements_count(m)
plot(count)  // Should be 12
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on matrix.add_row() with wrong parameter count', () => {
      const code = `
//@version=6
indicator("Matrix Add Row Error")

m = matrix.new<float>(2, 2, 0.0)
matrix.add_row(m)  // Missing required parameters
plot(close)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-COUNT')).toBe(true);
    });

    it('should error on matrix operation with wrong type', () => {
      const code = `
//@version=6
indicator("Matrix Type Error")

m = matrix.new<float>(2, 2, 0.0)
matrix.add_row(m, "invalid", array.from(1.0, 2.0))  // row_num should be int
plot(close)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-MATRIX-PARAM-TYPE' || e.code === 'PSV6-FUNCTION-PARAM-TYPE')).toBe(true);
    });
  });

  // ============================================================================
  // Category 2: Matrix Math Operations (12 functions)
  // ============================================================================

  describe('PSV6-MATRIX-MATH: Matrix Math Operations', () => {
    
    it('should validate matrix.sum()', () => {
      const code = `
//@version=6
indicator("Matrix Sum")

m = matrix.new<float>(2, 3, 1.0)
total = matrix.sum(m)
plot(total)  // Should be 6.0
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.avg()', () => {
      const code = `
//@version=6
indicator("Matrix Average")

m = matrix.new<float>(2, 2, 2.0)
average = matrix.avg(m)
plot(average)  // Should be 2.0
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.min() and matrix.max()', () => {
      const code = `
//@version=6
indicator("Matrix Min Max")

m = matrix.new<float>(2, 2)
matrix.set(m, 0, 0, 1.0)
matrix.set(m, 0, 1, 5.0)
matrix.set(m, 1, 0, 3.0)
matrix.set(m, 1, 1, 2.0)

minVal = matrix.min(m)
maxVal = matrix.max(m)
plot(minVal)  // 1.0
plot(maxVal)  // 5.0
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.mult() - matrix multiplication', () => {
      const code = `
//@version=6
indicator("Matrix Multiplication")

m1 = matrix.new<float>(2, 3, 1.0)
m2 = matrix.new<float>(3, 2, 2.0)
result = matrix.mult(m1, m2)  // Result is 2x2
plot(matrix.get(result, 0, 0))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.pow()', () => {
      const code = `
//@version=6
indicator("Matrix Power")

m = matrix.new<float>(2, 2, 2.0)
squared = matrix.pow(m, 2)
plot(matrix.get(squared, 0, 0))  // 4.0
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.abs()', () => {
      const code = `
//@version=6
indicator("Matrix Absolute")

m = matrix.new<float>(2, 2)
matrix.set(m, 0, 0, -5.0)
matrix.set(m, 1, 1, -10.0)
absMatrix = matrix.abs(m)
plot(matrix.get(absMatrix, 0, 0))  // 5.0
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.sqrt()', () => {
      const code = `
//@version=6
indicator("Matrix Square Root")

m = matrix.new<float>(2, 2, 4.0)
sqrtMatrix = matrix.sqrt(m)
plot(matrix.get(sqrtMatrix, 0, 0))  // 2.0
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.median()', () => {
      const code = `
//@version=6
indicator("Matrix Median")

m = matrix.new<float>(3, 3)
matrix.fill(m, array.from(1, 2, 3, 4, 5, 6, 7, 8, 9))
medianVal = matrix.median(m)
plot(medianVal)  // 5.0
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 3: Matrix Statistics (8 functions)
  // ============================================================================

  describe('PSV6-MATRIX-STATS: Matrix Statistical Operations', () => {
    
    it('should validate matrix.variance()', () => {
      const code = `
//@version=6
indicator("Matrix Variance")

m = matrix.new<float>(2, 2)
matrix.set(m, 0, 0, 1.0)
matrix.set(m, 0, 1, 2.0)
matrix.set(m, 1, 0, 3.0)
matrix.set(m, 1, 1, 4.0)
variance = matrix.variance(m)
plot(variance)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.stdev()', () => {
      const code = `
//@version=6
indicator("Matrix Standard Deviation")

m = matrix.new<float>(2, 2, 2.0)
stdDev = matrix.stdev(m)
plot(stdDev)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.covariance()', () => {
      const code = `
//@version=6
indicator("Matrix Covariance")

m1 = matrix.new<float>(3, 1)
m2 = matrix.new<float>(3, 1)
matrix.set(m1, 0, 0, 1.0)
matrix.set(m1, 1, 0, 2.0)
matrix.set(m1, 2, 0, 3.0)
matrix.set(m2, 0, 0, 2.0)
matrix.set(m2, 1, 0, 4.0)
matrix.set(m2, 2, 0, 6.0)
cov = matrix.covariance(m1, m2)
plot(cov)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.mode()', () => {
      const code = `
//@version=6
indicator("Matrix Mode")

m = matrix.new<float>(3, 3)
matrix.fill(m, array.from(1, 2, 2, 3, 2, 4, 5, 2, 6))
modeVal = matrix.mode(m)
plot(modeVal)  // 2.0 (most frequent)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.percentile_linear_interpolation()', () => {
      const code = `
//@version=6
indicator("Matrix Percentile Linear")

m = matrix.new<float>(2, 5)
matrix.fill(m, array.from(1, 2, 3, 4, 5, 6, 7, 8, 9, 10))
p75 = matrix.percentile_linear_interpolation(m, 75)
plot(p75)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.percentile_nearest_rank()', () => {
      const code = `
//@version=6
indicator("Matrix Percentile Nearest")

m = matrix.new<float>(2, 5)
matrix.fill(m, array.from(1, 2, 3, 4, 5, 6, 7, 8, 9, 10))
p50 = matrix.percentile_nearest_rank(m, 50)
plot(p50)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 4: Matrix Linear Algebra (8 functions)
  // ============================================================================

  describe('PSV6-MATRIX-LINALG: Matrix Linear Algebra Operations', () => {
    
    it('should validate matrix.det() - determinant', () => {
      const code = `
//@version=6
indicator("Matrix Determinant")

m = matrix.new<float>(2, 2)
matrix.set(m, 0, 0, 4.0)
matrix.set(m, 0, 1, 2.0)
matrix.set(m, 1, 0, 3.0)
matrix.set(m, 1, 1, 1.0)
determinant = matrix.det(m)
plot(determinant)  // -2.0
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.inv() - inverse', () => {
      const code = `
//@version=6
indicator("Matrix Inverse")

m = matrix.new<float>(2, 2)
matrix.set(m, 0, 0, 4.0)
matrix.set(m, 0, 1, 7.0)
matrix.set(m, 1, 0, 2.0)
matrix.set(m, 1, 1, 6.0)
inverse = matrix.inv(m)
plot(matrix.get(inverse, 0, 0))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.pinv() - pseudo-inverse', () => {
      const code = `
//@version=6
indicator("Matrix Pseudo-Inverse")

m = matrix.new<float>(3, 2)  // Non-square matrix
matrix.fill(m, array.from(1, 2, 3, 4, 5, 6))
pseudoInverse = matrix.pinv(m)
plot(matrix.rows(pseudoInverse))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.rank()', () => {
      const code = `
//@version=6
indicator("Matrix Rank")

m = matrix.new<float>(3, 3)
matrix.fill(m, array.from(1, 2, 3, 2, 4, 6, 3, 6, 9))
rank = matrix.rank(m)
plot(rank)  // Should be 1 (linearly dependent rows)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.transpose()', () => {
      const code = `
//@version=6
indicator("Matrix Transpose")

m = matrix.new<float>(2, 3)
matrix.fill(m, array.from(1, 2, 3, 4, 5, 6))
transposed = matrix.transpose(m)
rows = matrix.rows(transposed)  // Should be 3
cols = matrix.columns(transposed)  // Should be 2
plot(rows)
plot(cols)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.eigenvalues()', () => {
      const code = `
//@version=6
indicator("Matrix Eigenvalues")

m = matrix.new<float>(2, 2)
matrix.set(m, 0, 0, 2.0)
matrix.set(m, 0, 1, 1.0)
matrix.set(m, 1, 0, 1.0)
matrix.set(m, 1, 1, 2.0)
eigenvals = matrix.eigenvalues(m)
plot(array.get(eigenvals, 0))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.eigenvectors()', () => {
      const code = `
//@version=6
indicator("Matrix Eigenvectors")

m = matrix.new<float>(2, 2)
matrix.set(m, 0, 0, 2.0)
matrix.set(m, 0, 1, 1.0)
matrix.set(m, 1, 0, 1.0)
matrix.set(m, 1, 1, 2.0)
eigenvecs = matrix.eigenvectors(m)
plot(matrix.get(eigenvecs, 0, 0))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on matrix.inv() with singular matrix', () => {
      const code = `
//@version=6
indicator("Singular Matrix Error")

m = matrix.new<float>(2, 2, 0.0)  // All zeros - singular
inverse = matrix.inv(m)  // Should warn/error
plot(close)
      `;

      const result = createValidator().validate(code);
      // Should have warning about potential singular matrix
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Category 5: Matrix Transformations (3 functions)
  // ============================================================================

  describe('PSV6-MATRIX-TRANSFORM: Matrix Transformations', () => {
    
    it('should validate matrix.reshape()', () => {
      const code = `
//@version=6
indicator("Matrix Reshape")

m = matrix.new<float>(2, 3)
matrix.fill(m, array.from(1, 2, 3, 4, 5, 6))
reshaped = matrix.reshape(m, 3, 2)  // 2x3 -> 3x2
plot(matrix.rows(reshaped))  // 3
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.reverse()', () => {
      const code = `
//@version=6
indicator("Matrix Reverse")

m = matrix.new<float>(2, 2)
matrix.fill(m, array.from(1, 2, 3, 4))
reversed = matrix.reverse(m)
plot(matrix.get(reversed, 0, 0))  // Should be 4
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.concat()', () => {
      const code = `
//@version=6
indicator("Matrix Concatenate")

m1 = matrix.new<float>(2, 2, 1.0)
m2 = matrix.new<float>(2, 2, 2.0)
concatenated = matrix.concat(m1, m2, true)  // Concat vertically
plot(matrix.rows(concatenated))  // Should be 4
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on matrix.reshape() with incompatible dimensions', () => {
      const code = `
//@version=6
indicator("Reshape Dimension Error")

m = matrix.new<float>(2, 3)  // 6 elements
matrix.fill(m, array.from(1, 2, 3, 4, 5, 6))
reshaped = matrix.reshape(m, 2, 2)  // 4 elements - incompatible!
plot(close)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code?.includes('MATRIX') || e.code?.includes('DIMENSION'))).toBe(true);
    });
  });

  // ============================================================================
  // Matrix Helper Functions
  // ============================================================================

  describe('PSV6-MATRIX-HELPERS: Matrix Helper Functions', () => {
    
    it('should validate matrix.is_square()', () => {
      const code = `
//@version=6
indicator("Matrix Is Square")

m1 = matrix.new<float>(3, 3, 1.0)
m2 = matrix.new<float>(2, 3, 1.0)
isSquare1 = matrix.is_square(m1)  // true
isSquare2 = matrix.is_square(m2)  // false
plot(isSquare1 ? 1 : 0)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.is_identity()', () => {
      const code = `
//@version=6
indicator("Matrix Is Identity")

m = matrix.new<float>(2, 2, 0.0)
matrix.set(m, 0, 0, 1.0)
matrix.set(m, 1, 1, 1.0)
isIdentity = matrix.is_identity(m)
plot(isIdentity ? 1 : 0)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.is_symmetric()', () => {
      const code = `
//@version=6
indicator("Matrix Is Symmetric")

m = matrix.new<float>(2, 2)
matrix.set(m, 0, 0, 1.0)
matrix.set(m, 0, 1, 2.0)
matrix.set(m, 1, 0, 2.0)
matrix.set(m, 1, 1, 3.0)
isSymmetric = matrix.is_symmetric(m)
plot(isSymmetric ? 1 : 0)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix.diff()', () => {
      const code = `
//@version=6
indicator("Matrix Diff")

m1 = matrix.new<float>(2, 2, 5.0)
m2 = matrix.new<float>(2, 2, 3.0)
difference = matrix.diff(m1, m2)  // Element-wise subtraction
plot(matrix.get(difference, 0, 0))  // 2.0
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('PSV6-MATRIX-INTEGRATION: Matrix Integration Tests', () => {
    
    it('should validate complex matrix workflow', () => {
      const code = `
//@version=6
indicator("Matrix Complex Workflow")

// Create matrices
m1 = matrix.new<float>(3, 3)
matrix.fill(m1, array.from(1, 2, 3, 4, 5, 6, 7, 8, 9))

// Transpose
m2 = matrix.transpose(m1)

// Multiply
result = matrix.mult(m1, m2)

// Statistics
avgVal = matrix.avg(result)
stdDev = matrix.stdev(result)
minVal = matrix.min(result)
maxVal = matrix.max(result)

// Linear algebra
det = matrix.det(result)
rank = matrix.rank(result)

plot(avgVal)
plot(stdDev)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate matrix with type inference', () => {
      const code = `
//@version=6
indicator("Matrix Type Inference")

// Type should be inferred from context
myMatrix = matrix.new<float>(2, 2, close)
avgPrice = matrix.avg(myMatrix)
plot(avgPrice)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

