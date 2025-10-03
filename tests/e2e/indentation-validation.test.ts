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
      
      const indentError = result.errors.find(e => 
        e.code === 'PSV6-INDENT-BLOCK-MISMATCH' || e.code === 'PSV6-INDENT-INCONSISTENT'
      );
      expect(indentError).toBeDefined();
      expect(indentError?.line).toBe(5);
      expect(indentError?.message).toContain('4 spaces');
      expect(indentError?.message).toContain('5');
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
      
      const indentError = result.errors.find(e => 
        e.code === 'PSV6-INDENT-BLOCK-MISMATCH' || e.code === 'PSV6-INDENT-INCONSISTENT'
      );
      expect(indentError).toBeDefined();
      expect(indentError?.line).toBe(5);
      expect(indentError?.message).toContain('4');
      expect(indentError?.message).toContain('3');
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
      const indentError = result.errors.find(e => 
        e.code === 'PSV6-INDENT-BLOCK-MISMATCH' || e.code === 'PSV6-INDENT-INCONSISTENT'
      );
      expect(indentError).toBeDefined();
      expect(indentError?.line).toBe(5); // Line with extra space
    });
  });

  describe('Mixed Tabs and Spaces Detection', () => {
    it('should detect tabs mixed with spaces across lines', () => {
      const code = `//@version=6
indicator("Test")
myFunc() =>
\tx = 10
    y = 20
plot(close)`;

      const result = validator.validate(code);

      // PSI02 is now an error (like PS018 in TradingView)
      expect(result.isValid).toBe(false);
      const mixedError = result.errors.find(e => e.code === 'PSI02');
      expect(mixedError).toBeDefined();
      expect(mixedError?.message).toContain('Mixed tabs and spaces');
    });

    it.skip('duplicate test - removed', () => {
      // This is a duplicate of the previous test
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
    it('should report indentation error', () => {
      const code = `//@version=6
indicator("Test")
myFunc() =>
    x = 10
     y = 20
    undefinedVar + x
plot(close)`;

      const result = validator.validate(code);

      // Should have indentation error
      const indentError = result.errors.find(e => 
        e.code === 'PSV6-INDENT-BLOCK-MISMATCH' || e.code === 'PSV6-INDENT-INCONSISTENT'
      );
      expect(indentError).toBeDefined();
      expect(indentError?.code).toBe('PSV6-INDENT-BLOCK-MISMATCH');
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
      expect(indentError.message).toContain('4 spaces');
      expect(indentError.message).toContain('6');
      expect(indentError.code).toBe('PSV6-INDENT-BLOCK-MISMATCH');
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
      expect(indentError.message).toContain('4');
      expect(indentError.message).toContain('2');
      expect(indentError.code).toBe('PSV6-INDENT-BLOCK-MISMATCH');
    });
  });
});

