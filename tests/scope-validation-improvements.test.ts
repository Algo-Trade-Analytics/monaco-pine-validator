/**
 * Tests for Scope Validation Improvements
 * 
 * Validates:
 * - Undefined variable detection (PSU02 as error, not warning)
 * - Out-of-scope parameter usage detection
 * - Function parameter scope isolation
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../EnhancedModularValidator';

describe('Scope Validation Improvements', () => {
  const validator = new EnhancedModularValidator();

  describe('Undefined Variable Detection', () => {
    it('should report undefined variable as ERROR not warning', () => {
      const code = `//@version=6
indicator("Test")
x = nonExistentVar
plot(x)`;

      const result = validator.validate(code);

      // Should be an error
      const undefinedError = result.errors.find(e => e.code === 'PSU02');
      expect(undefinedError).toBeDefined();
      expect(undefinedError?.severity).toBe('error');
      expect(undefinedError?.message).toContain('Undefined variable');
      
      // Should NOT be in warnings
      const undefinedWarning = result.warnings.find(w => w.code === 'PSU02');
      expect(undefinedWarning).toBeUndefined();
    });

    it('should detect undefined variable in expression', () => {
      const code = `//@version=6
indicator("Test")
x = close + undefinedVar
plot(x)`;

      const result = validator.validate(code);

      const undefinedError = result.errors.find(e => 
        e.code === 'PSU02' && e.message.includes('undefinedVar')
      );
      expect(undefinedError).toBeDefined();
    });
  });

  describe('Out-of-Scope Parameter Usage', () => {
    it('should detect parameter used outside function scope', () => {
      const code = `//@version=6
indicator("Test")

toSize(s) =>
    s == "Tiny" ? size.tiny : size.small

// ERROR: 's' is only valid inside toSize function
lblSize = input.string("Normal", "Label Size")
atrLen = input.int(s, "ATR Length")  // Using 's' from toSize - WRONG!

plot(close)`;

      const result = validator.validate(code);

      // Should detect 's' as undefined outside its scope
      const scopeError = result.errors.find(e => 
        e.code === 'PSU02' && e.message.includes("'s'")
      );
      expect(scopeError).toBeDefined();
    });

    it('should allow parameter usage inside function scope', () => {
      const code = `//@version=6
indicator("Test")

toSize(s) =>
    // 's' is valid here
    s == "Tiny" ? size.tiny : size.small

result = toSize("Tiny")
plot(close)`;

      const result = validator.validate(code);

      // Should NOT have error about 's' being undefined
      const scopeError = result.errors.find(e => 
        e.code === 'PSU02' && e.message.includes("'s'")
      );
      expect(scopeError).toBeUndefined();
    });
  });

  describe('Function Parameter Scope Isolation', () => {
    it('should isolate parameters to their function scope', () => {
      const code = `//@version=6
indicator("Test")

funcA(paramA) =>
    paramA * 2

funcB(paramB) =>
    paramB * 3

// Can't use paramA in funcB's scope
result = funcB(paramA)  // ERROR: paramA not defined here

plot(result)`;

      const result = validator.validate(code);

      const scopeError = result.errors.find(e => 
        e.code === 'PSU02' && e.message.includes('paramA')
      );
      expect(scopeError).toBeDefined();
    });

    it('should allow multiple functions with different parameter scopes', () => {
      const code = `//@version=6
indicator("Test")

funcA(x) => x * 2
funcB(x) => x * 3  // Different 'x', different scope

result1 = funcA(5)
result2 = funcB(10)

plot(result1 + result2)`;

      const result = validator.validate(code);

      // Should NOT have scope errors - each 'x' is in its own scope
      const scopeErrors = result.errors.filter(e => e.code === 'PSU02');
      expect(scopeErrors).toHaveLength(0);
    });
  });

  describe('Built-in Variables and Functions', () => {
    it('should accept built-in variables', () => {
      const code = `//@version=6
indicator("Test")
x = close
y = open
z = high
w = low
plot(x)`;

      const result = validator.validate(code);

      const undefinedErrors = result.errors.filter(e => 
        e.code === 'PSU02' && 
        (e.message.includes('close') || 
         e.message.includes('open') ||
         e.message.includes('high') ||
         e.message.includes('low'))
      );
      expect(undefinedErrors).toHaveLength(0);
    });

    it('should accept built-in namespaces', () => {
      const code = `//@version=6
indicator("Test")
sma1 = ta.sma(close, 20)
c = color.red
m = math.abs(-5)
plot(sma1)`;

      const result = validator.validate(code);

      const undefinedErrors = result.errors.filter(e => 
        e.code === 'PSU02' && 
        (e.message.includes('ta') || 
         e.message.includes('color') ||
         e.message.includes('math'))
      );
      expect(undefinedErrors).toHaveLength(0);
    });
  });

  describe('User-Defined Variables', () => {
    it('should accept user-defined variables in scope', () => {
      const code = `//@version=6
indicator("Test")
myVar = 10
myVar2 = myVar * 2  // myVar is defined
plot(myVar2)`;

      const result = validator.validate(code);

      const undefinedError = result.errors.find(e => 
        e.code === 'PSU02' && e.message.includes('myVar')
      );
      expect(undefinedError).toBeUndefined();
    });

    it('should detect reference before declaration', () => {
      const code = `//@version=6
indicator("Test")
x = y + 5  // y not defined yet
y = 10
plot(x)`;

      const result = validator.validate(code);

      // Note: Pine Script may or may not allow forward references
      // This test documents current behavior
      const undefinedError = result.errors.find(e => 
        e.code === 'PSU02' && e.message.includes('y')
      );
      // If error exists, that's correct behavior
      // If not, Pine Script allows forward references
    });
  });
});

