/**
 * Tests for Indentation Validation
 * 
 * Pine Script uses significant whitespace (like Python)
 * Validates:
 * - Consistent indentation within function bodies
 * - Detection of mixed tabs/spaces
 * - Clear error messages with suggestions
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('Indentation Validation', () => {
  const validator = new EnhancedModularValidator();

  describe('Inconsistent Indentation Detection', () => {
    it('should detect extra space in function body', () => {
      const code = `//@version=6
indicator("Test")
myFunc() =>
    x = 10
     y = 20
    x + y
plot(close)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      const indentError = result.errors.find(e => e.code === 'PSV6-INDENT-INCONSISTENT');
      expect(indentError).toBeDefined();
      expect(indentError?.line).toBe(5);
      expect(indentError?.message).toContain('expected 4 spaces, got 5 spaces');
      expect(indentError?.suggestion).toContain('Remove 1 space');
    });

    it('should detect missing space in function body', () => {
      const code = `//@version=6
indicator("Test")
myFunc() =>
    x = 10
   y = 20
    x + y
plot(close)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      
      const indentError = result.errors.find(e => e.code === 'PSV6-INDENT-INCONSISTENT');
      expect(indentError).toBeDefined();
      expect(indentError?.line).toBe(5);
      expect(indentError?.message).toContain('expected 4 spaces, got 3 spaces');
      expect(indentError?.suggestion).toContain('Add 1 space');
    });

    it('should detect user scenario: extra space causes syntax error', () => {
      // User's exact scenario from the issue report
      const code = `//@version=6
indicator("Test")
basisFrom(srcSeries) =>
    _raw = srcSeries * 2
     basisSmooth = _raw + 1
    _raw
plot(close)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      const indentError = result.errors.find(e => e.code === 'PSV6-INDENT-INCONSISTENT');
      expect(indentError).toBeDefined();
      expect(indentError?.line).toBe(5); // Line with extra space
    });
  });

  describe('Mixed Tabs and Spaces Detection', () => {
    it('should detect tabs mixed with spaces on same line', () => {
      const code = `//@version=6
indicator("Test")
myFunc() =>
\t  x = 10
    y = 20
plot(close)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      const mixedError = result.errors.find(e => e.code === 'PSV6-INDENT-MIXED');
      expect(mixedError).toBeDefined();
      expect(mixedError?.message).toContain('Mixed tabs and spaces');
    });

    it('should detect tabs mixed with spaces across lines in function body', () => {
      const code = `//@version=6
indicator("Test")
myFunc() =>
\tx = 10
    y = 20
    x + y
plot(close)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      const mixedError = result.errors.find(e => e.code === 'PSV6-INDENT-MIXED');
      expect(mixedError).toBeDefined();
      expect(mixedError?.suggestion).toContain('spaces consistently');
    });
  });

  describe('Correct Indentation Acceptance', () => {
    it('should accept consistent 4-space indentation', () => {
      const code = `//@version=6
indicator("Test")
myFunc() =>
    x = 10
    y = 20
    z = 30
    x + y + z
plot(close)`;

      const result = validator.validate(code);

      const indentErrors = result.errors.filter(e => e.code?.includes('INDENT'));
      expect(indentErrors).toHaveLength(0);
    });

    it('should accept nested function indentation', () => {
      const code = `//@version=6
indicator("Test")
outer() =>
    inner() =>
        x = 10
        x * 2
    result = inner()
    result
plot(close)`;

      const result = validator.validate(code);

      const indentErrors = result.errors.filter(e => e.code?.includes('INDENT'));
      expect(indentErrors).toHaveLength(0);
    });
  });

  describe('Ternary Operator Exception', () => {
    it('should allow different indentation for ternary operators', () => {
      const code = `//@version=6
indicator("Test")
myFunc(val) =>
    result = val > 10
      ? "high"
      : "low"
    result
plot(close)`;

      const result = validator.validate(code);

      // Ternary operators can have different indentation
      const indentErrors = result.errors.filter(e => e.code === 'PSV6-INDENT-INCONSISTENT');
      expect(indentErrors).toHaveLength(0);
    });
  });

  describe('Early Exit Behavior', () => {
    it('should stop validation after indentation error', () => {
      const code = `//@version=6
indicator("Test")
myFunc() =>
    x = 10
     y = 20
    undefinedVar + x
plot(close)`;

      const result = validator.validate(code);

      // Should have indentation error and stop
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].code).toBe('PSV6-INDENT-INCONSISTENT');
      
      // Should not have undefined variable errors due to early exit
      const hasUndefinedError = result.errors.some(e => e.code === 'PSU02');
      expect(hasUndefinedError).toBe(false);
    });
  });

  describe('Error Message Quality', () => {
    it('should provide clear message for extra spaces', () => {
      const code = `//@version=6
indicator("Test")
myFunc() =>
    x = 10
      y = 20
plot(close)`;

      const result = validator.validate(code);

      const indentError = result.errors[0];
      expect(indentError.message).toMatch(/expected \d+ spaces, got \d+ spaces/);
      expect(indentError.suggestion).toMatch(/Remove \d+ space/);
    });

    it('should provide clear message for missing spaces', () => {
      const code = `//@version=6
indicator("Test")
myFunc() =>
    x = 10
  y = 20
plot(close)`;

      const result = validator.validate(code);

      const indentError = result.errors[0];
      expect(indentError.message).toMatch(/expected \d+ spaces, got \d+ spaces/);
      expect(indentError.suggestion).toMatch(/Add \d+ space/);
    });
  });
});

