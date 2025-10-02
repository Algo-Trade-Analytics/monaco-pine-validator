/**
 * Tests for Namespace Validation
 * 
 * Validates:
 * - Detection of undefined namespace members
 * - "Did you mean?" suggestions for typos
 * - Early exit to prevent cascading type errors
 * - Coverage of all Pine Script namespaces
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('Namespace Validation', () => {
  const validator = new EnhancedModularValidator();

  describe('Undefined Namespace Members', () => {
    it('should detect undefined color property', () => {
      const code = `//@version=6
indicator("Test")
bullMain = color.nonexistent
plot(close, color=bullMain)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PSV6-UNDEFINED-NAMESPACE-MEMBER');
      expect(result.errors[0].message).toContain('nonexistent');
      expect(result.errors[0].message).toContain('color');
    });

    it('should detect undefined ta function', () => {
      const code = `//@version=6
indicator("Test")
result = ta.nonexistent(close, 20)
plot(result)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('PSV6-UNDEFINED-NAMESPACE-MEMBER');
      expect(result.errors[0].message).toContain('nonexistent');
      expect(result.errors[0].message).toContain('ta');
    });

    it('should detect undefined math function', () => {
      const code = `//@version=6
indicator("Test")
result = math.nonexistent(5)
plot(result)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('PSV6-UNDEFINED-NAMESPACE-MEMBER');
      expect(result.errors[0].message).toContain('math');
    });

    it('should detect undefined str function', () => {
      const code = `//@version=6
indicator("Test")
result = str.nonexistent("hello")
plot(close)`;

      const result = validator.validate(code);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('PSV6-UNDEFINED-NAMESPACE-MEMBER');
      expect(result.errors[0].message).toContain('str');
    });
  });

  describe('"Did You Mean?" Suggestions', () => {
    it('should suggest "green" for "greeen"', () => {
      const code = `//@version=6
indicator("Test")
bullMain = color.greeen
plot(close, color=bullMain)`;

      const result = validator.validate(code);

      expect(result.errors[0].suggestion).toBeDefined();
      expect(result.errors[0].suggestion).toContain('Did you mean');
      expect(result.errors[0].suggestion).toContain('green');
    });

    it('should suggest "sma" for "smaa"', () => {
      const code = `//@version=6
indicator("Test")
result = ta.smaa(close, 20)
plot(result)`;

      const result = validator.validate(code);

      expect(result.errors[0].suggestion).toBeDefined();
      expect(result.errors[0].suggestion).toContain('sma');
    });

    it('should suggest "abs" for "abss"', () => {
      const code = `//@version=6
indicator("Test")
result = math.abss(-5)
plot(result)`;

      const result = validator.validate(code);

      expect(result.errors[0].suggestion).toBeDefined();
      expect(result.errors[0].suggestion).toContain('abs');
    });

    it('should not suggest when name is completely wrong', () => {
      const code = `//@version=6
indicator("Test")
result = color.xyzabc123
plot(close)`;

      const result = validator.validate(code);

      expect(result.errors[0].suggestion).toBeDefined();
      // Should show generic help, not "Did you mean"
      expect(result.errors[0].suggestion).not.toContain('Did you mean');
      expect(result.errors[0].suggestion).toContain('documentation');
    });
  });

  describe('Prevents Cascading Type Errors', () => {
    it('should not report type errors after namespace error', () => {
      const code = `//@version=6
indicator("Test")
bullMain = color.nonexistent
bearMain = color.red

// These would cause type errors if validation continued
currentColor = close > open ? bullMain : bearMain
barcolor(currentColor)
plotcandle(open, high, low, close, color=bullMain)
bullTransparent = color.new(bullMain, 85)`;

      const result = validator.validate(code);

      // Should only have the namespace error, no type errors
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PSV6-UNDEFINED-NAMESPACE-MEMBER');
      
      // Verify no cascading type errors
      const hasTypeErrors = result.errors.some(e => 
        e.code === 'PSV6-FUNCTION-PARAM-TYPE' || e.code === 'PSV6-TERNARY-TYPE'
      );
      expect(hasTypeErrors).toBe(false);
    });
  });

  describe('Valid Namespace Members', () => {
    it('should accept valid color constants', () => {
      const code = `//@version=6
indicator("Test")
c1 = color.red
c2 = color.green
c3 = color.blue
plot(close, color=c1)`;

      const result = validator.validate(code);

      const hasNamespaceErrors = result.errors.some(e => 
        e.code === 'PSV6-UNDEFINED-NAMESPACE-MEMBER'
      );
      expect(hasNamespaceErrors).toBe(false);
    });

    it('should accept valid ta functions', () => {
      const code = `//@version=6
indicator("Test")
sma1 = ta.sma(close, 20)
ema1 = ta.ema(close, 20)
rsi1 = ta.rsi(close, 14)
plot(sma1)`;

      const result = validator.validate(code);

      const hasNamespaceErrors = result.errors.some(e => 
        e.code === 'PSV6-UNDEFINED-NAMESPACE-MEMBER'
      );
      expect(hasNamespaceErrors).toBe(false);
    });

    it('should accept valid math functions', () => {
      const code = `//@version=6
indicator("Test")
abs1 = math.abs(-5)
max1 = math.max(10, 20)
min1 = math.min(10, 20)
plot(abs1)`;

      const result = validator.validate(code);

      const hasNamespaceErrors = result.errors.some(e => 
        e.code === 'PSV6-UNDEFINED-NAMESPACE-MEMBER'
      );
      expect(hasNamespaceErrors).toBe(false);
    });
  });

  describe('Line and Column Accuracy', () => {
    it('should report accurate line and column for namespace error', () => {
      const code = `//@version=6
indicator("Test")

// Some lines
// More lines
bullMain = color.nonexistent
plot(close)`;

      const result = validator.validate(code);

      expect(result.errors[0].line).toBe(6); // Correct line
      expect(result.errors[0].column).toBeGreaterThan(10); // Somewhere near "color"
    });
  });
});

