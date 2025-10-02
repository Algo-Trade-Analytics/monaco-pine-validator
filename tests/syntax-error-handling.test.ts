/**
 * Tests for Syntax Error Handling
 * 
 * Validates:
 * - Pre-parser syntax checking
 * - Accurate line/column reporting
 * - User-friendly error messages
 * - Early exit to prevent cascading errors
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../EnhancedModularValidator';

describe('Syntax Error Handling', () => {
  const validator = new EnhancedModularValidator();

  describe('Empty Parameter Detection', () => {
    it('should detect empty first parameter in input.int', () => {
      const code = `//@version=6
indicator("Test")
volSmooth = input.int(, "Vol Smoothing EMA", minval=1)
plot(close)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PSV6-SYNTAX-EMPTY-PARAM');
      expect(result.errors[0].line).toBe(3);
      expect(result.errors[0].column).toBeGreaterThan(1);
      expect(result.errors[0].message).toContain('Missing parameter');
      expect(result.errors[0].suggestion).toBeDefined();
    });

    it('should detect empty parameter between commas', () => {
      const code = `//@version=6
indicator("Test")
result = ta.sma(close, , 0)
plot(result)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PSV6-SYNTAX-EMPTY-PARAM');
      expect(result.errors[0].message).toContain('Empty parameter between commas');
    });

    it('should detect trailing comma', () => {
      const code = `//@version=6
indicator("Test")
result = ta.sma(close, 20, )
plot(result)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PSV6-SYNTAX-TRAILING-COMMA');
      expect(result.errors[0].message).toContain('Trailing comma');
    });
  });

  describe('Early Exit Behavior', () => {
    it('should stop validation after syntax error (no warnings)', () => {
      const code = `//@version=6
indicator("Test")
volSmooth = input.int(, "Vol Smoothing EMA", minval=1)
// This would normally generate warnings
x = close
y = high
z = low
plot(close)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.warnings).toHaveLength(0); // No warnings due to early exit
    });

    it('should allow full validation when no syntax errors', () => {
      const code = `//@version=6
indicator("Test")
volSmooth = input.int(5, "Vol Smoothing EMA", minval=1)
plot(close)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      // Warnings may or may not be present, but validation should complete
    });
  });

  describe('Error Message Quality', () => {
    it('should provide context-specific suggestion for input.int', () => {
      const code = `//@version=6
indicator("Test")
x = input.int(, "Label")
plot(close)`;

      const result = validator.validate(code);

      expect(result.errors[0].suggestion).toBeDefined();
      expect(result.errors[0].suggestion).toContain('input.int');
      expect(result.errors[0].suggestion).toContain('default value');
    });

    it('should provide accurate line and column numbers', () => {
      const code = `//@version=6
indicator("Test")

// Comment line
x = input.int(, "Label")
plot(close)`;

      const result = validator.validate(code);

      expect(result.errors[0].line).toBe(5); // Not line 1
      expect(result.errors[0].column).toBeGreaterThan(1); // Not column 1
    });
  });

  describe('No Cascading Errors', () => {
    it('should not report type errors when syntax error present', () => {
      const code = `//@version=6
indicator("Test")
x = input.int(, "Label")
// This would cause type errors if validation continued
y = x + "string"
z = y * true
plot(z)`;

      const result = validator.validate(code);

      // Should only have the syntax error, no type errors
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PSV6-SYNTAX-EMPTY-PARAM');
      
      // Verify no type-related errors
      const hasTypeErrors = result.errors.some(e => 
        e.code?.includes('TYPE') || e.code?.includes('PARAM')
      );
      expect(hasTypeErrors).toBe(false);
    });
  });
});

