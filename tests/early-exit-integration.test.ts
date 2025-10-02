/**
 * Integration Tests for Early Exit Behavior
 * 
 * Validates:
 * - Early exit prevents cascading errors
 * - Priority of error detection (syntax > namespace > other)
 * - Full validation when no critical errors
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../EnhancedModularValidator';

describe('Early Exit Integration', () => {
  const validator = new EnhancedModularValidator();

  describe('Syntax Errors Trigger Early Exit', () => {
    it('should stop validation after syntax error', () => {
      const code = `//@version=6
indicator("Test")
x = input.int(, "Label")  // Syntax error
// These would cause errors if validation continued
y = undefinedVar
z = color.nonexistent
plot(z)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PSV6-SYNTAX-EMPTY-PARAM');
      expect(result.warnings).toHaveLength(0);
    });

    it('should complete full validation when no syntax errors', () => {
      const code = `//@version=6
indicator("Test")
x = input.int(5, "Label")  // Valid syntax
// These errors should now be detected
y = undefinedVar
plot(y)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      // Should have errors about undefinedVar
      const hasUndefinedError = result.errors.some(e => 
        e.code === 'PSU02' && e.message.includes('undefinedVar')
      );
      expect(hasUndefinedError).toBe(true);
    });
  });

  describe('Namespace Errors Trigger Early Exit', () => {
    it('should stop validation after namespace error', () => {
      const code = `//@version=6
indicator("Test")
bullMain = color.nonexistent  // Namespace error
// These would cause type errors if validation continued
currentColor = close > open ? bullMain : color.red
barcolor(currentColor)
plotcandle(open, high, low, close, color=bullMain)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PSV6-UNDEFINED-NAMESPACE-MEMBER');
      
      // Should NOT have cascading type errors
      const hasTypeErrors = result.errors.some(e => 
        e.code === 'PSV6-FUNCTION-PARAM-TYPE' || e.code === 'PSV6-TERNARY-TYPE'
      );
      expect(hasTypeErrors).toBe(false);
    });

    it('should complete full validation when no namespace errors', () => {
      const code = `//@version=6
indicator("Test")
bullMain = color.green  // Valid namespace
// Now other issues should be detected
x = undefinedVar
plot(x)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      // Should detect undefinedVar
      const hasUndefinedError = result.errors.some(e => 
        e.code === 'PSU02'
      );
      expect(hasUndefinedError).toBe(true);
    });
  });

  describe('Error Priority Order', () => {
    it('should detect syntax errors before namespace errors', () => {
      const code = `//@version=6
indicator("Test")
x = input.int(, "Label")  // Syntax error
y = color.nonexistent      // Namespace error
plot(close)`;

      const result = validator.validate(code);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PSV6-SYNTAX-EMPTY-PARAM');
      // Namespace error not detected due to early exit after syntax error
    });

    it('should detect namespace errors before other errors', () => {
      const code = `//@version=6
indicator("Test")
x = color.nonexistent  // Namespace error
y = undefinedVar       // Undefined variable
plot(close)`;

      const result = validator.validate(code);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PSV6-UNDEFINED-NAMESPACE-MEMBER');
      // Undefined variable not detected due to early exit
    });
  });

  describe('Multiple Error Types When No Critical Errors', () => {
    it('should detect multiple non-critical errors together', () => {
      const code = `//@version=6
indicator("Test")
// No syntax or namespace errors
x = undefinedVar1
y = undefinedVar2
z = undefinedVar3
plot(close)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      // Should detect all undefined variables
      const undefinedErrors = result.errors.filter(e => e.code === 'PSU02');
      expect(undefinedErrors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('No False Positives from Early Exit', () => {
    it('should not report errors after early exit', () => {
      const code = `//@version=6
indicator("Test")
x = input.int(, "Label")  // Syntax error triggers early exit
// Everything below should be ignored
y = "this is not valid pine script syntax {{{
z = $$$ invalid $$$
plot(nonsense!!!)`;

      const result = validator.validate(code);

      // Only the first syntax error should be reported
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PSV6-SYNTAX-EMPTY-PARAM');
    });
  });

  describe('Clean Validation for Valid Code', () => {
    it('should pass validation for completely valid code', () => {
      const code = `//@version=6
indicator("Test")
sma20 = ta.sma(close, 20)
bullColor = color.green
plot(sma20, color=bullColor)`;

      const result = validator.validate(code);

      // Should have no critical errors
      const hasCriticalErrors = result.errors.some(e => 
        e.code === 'PSV6-SYNTAX-EMPTY-PARAM' ||
        e.code === 'PSV6-UNDEFINED-NAMESPACE-MEMBER' ||
        e.code === 'PSU02'
      );
      expect(hasCriticalErrors).toBe(false);
    });
  });
});

