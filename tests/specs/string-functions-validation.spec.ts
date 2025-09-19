/**
 * String Functions Validation Tests (TDD)
 * 
 * Comprehensive tests for Pine Script v6 String functions validation.
 * Following TDD principles: Write tests first, then implement the validator.
 * 
 * Priority 1.2: CRITICAL GAPS - String Functions (20% Coverage)
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../..';

describe('String Functions Validation (TDD)', () => {
  const createValidator = () => new EnhancedModularValidator({
    version: '6',
    scriptType: 'indicator',
    strictMode: true,
    enableWarnings: true
  });

  describe('PSV6-STR-BASIC: Basic String Functions Validation', () => {
    it('should validate correct string function calls', () => {
      const code = `
//@version=6
indicator("String Test")

// Basic string functions
length = str.length("hello")
contains = str.contains("hello world", "world")
startswith = str.startswith("hello world", "hello")
endswith = str.endswith("hello world", "world")
pos = str.pos("hello world", "world")
substring = str.substring("hello world", 0, 5)
replace = str.replace("hello world", "world", "universe")
split = str.split("a,b,c", ",")
upper = str.upper("hello")
lower = str.lower("HELLO")
trim = str.trim("  hello  ")
repeat = str.repeat("hello", 3)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on incorrect string function parameter types', () => {
      const code = `
//@version=6
indicator("String Test")

// Wrong parameter types
length = str.length(123)  // Error: should be string
contains = str.contains(123, "world")  // Error: first param should be string
pos = str.pos("hello", 123)  // Error: second param should be string
repeat = str.repeat("hello", "3")  // Error: second param should be int
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-TYPE')).toBe(true);
    });

    it('should error on incorrect string function parameter count', () => {
      const code = `
//@version=6
indicator("String Test")

// Wrong parameter counts
length = str.length()  // Error: missing parameter
contains = str.contains("hello")  // Error: missing second parameter
substring = str.substring("hello", 0)  // Error: missing third parameter
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-COUNT')).toBe(true);
    });
  });

  describe('PSV6-STR-FORMAT: String Formatting Functions', () => {
    it('should validate str.format() function', () => {
      const code = `
//@version=6
indicator("String Format Test")

// Basic format
formatted = str.format("Price: {0}", close)
formatted2 = str.format("Price: {0}, Volume: {1}", close, volume)
formatted3 = str.format("Hello {0}", "World")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.format_time() function', () => {
      const code = `
//@version=6
indicator("String Format Time Test")

// Time formatting
timeStr = str.format_time(time, "yyyy-MM-dd")
timeStr2 = str.format_time(time, "HH:mm")
timeStr3 = str.format_time(time, "yyyy-MM-dd HH:mm:ss")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid format string', () => {
      const code = `
//@version=6
indicator("String Format Test")

// Invalid format strings
formatted = str.format(123, close)  // Error: format string should be string
formatted2 = str.format("Price: {", close)  // Error: incomplete format placeholder
formatted3 = str.format("Price: {0} {1}", close)  // Error: missing format parameter
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-STR-FORMAT-INVALID')).toBe(true);
    });

    it('should validate format parameter count', () => {
      const code = `
//@version=6
indicator("String Format Test")

// Correct parameter counts
formatted = str.format("Price: {0}", close)
formatted2 = str.format("Price: {0}, Volume: {1}", close, volume)
formatted3 = str.format("No placeholders")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-STR-SEARCH: String Search Functions', () => {
    it('should validate str.contains() function', () => {
      const code = `
//@version=6
indicator("String Search Test")

// Contains function
hasWorld = str.contains("hello world", "world")
hasNumber = str.contains("price123", "123")
hasEmpty = str.contains("hello", "")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.startswith() and str.endswith() functions', () => {
      const code = `
//@version=6
indicator("String Search Test")

// Startswith and endswith
startsHello = str.startswith("hello world", "hello")
startsEmpty = str.startswith("hello", "")
endsWorld = str.endswith("hello world", "world")
endsEmpty = str.endswith("hello", "")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.pos() function', () => {
      const code = `
//@version=6
indicator("String Search Test")

// Position function
pos = str.pos("hello world", "world")
posNotFound = str.pos("hello", "world")
posEmpty = str.pos("hello", "")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.match() function', () => {
      const code = `
//@version=6
indicator("String Search Test")

// Match function
match = str.match("hello123world", "\\d+")
match2 = str.match("price_123", "[a-z]+")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-STR-MANIPULATION: String Manipulation Functions', () => {
    it('should validate str.substring() function', () => {
      const code = `
//@version=6
indicator("String Manipulation Test")

// Substring function
sub = str.substring("hello world", 0, 5)
sub2 = str.substring("hello world", 6, 11)
sub3 = str.substring("hello", 0, 5)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.replace() function', () => {
      const code = `
//@version=6
indicator("String Manipulation Test")

// Replace function
replaced = str.replace("hello world", "world", "universe")
replaced2 = str.replace("hello hello", "hello", "hi")
replaced3 = str.replace("hello", "world", "universe")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.split() function', () => {
      const code = `
//@version=6
indicator("String Manipulation Test")

// Split function
parts = str.split("a,b,c", ",")
parts2 = str.split("hello world", " ")
parts3 = str.split("hello", ",")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.upper() and str.lower() functions', () => {
      const code = `
//@version=6
indicator("String Manipulation Test")

// Case functions
upper = str.upper("hello")
lower = str.lower("HELLO")
upper2 = str.upper("Hello World")
lower2 = str.lower("HELLO WORLD")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.trim() function', () => {
      const code = `
//@version=6
indicator("String Manipulation Test")

// Trim function
trimmed = str.trim("  hello  ")
trimmed2 = str.trim("hello")
trimmed3 = str.trim("   ")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.repeat() function', () => {
      const code = `
//@version=6
indicator("String Manipulation Test")

// Repeat function
repeated = str.repeat("hello", 3)
repeated2 = str.repeat("a", 5)
repeated3 = str.repeat("", 10)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-STR-CONVERSION: String Conversion Functions', () => {
    it('should validate str.tostring() function', () => {
      const code = `
//@version=6
indicator("String Conversion Test")

// ToString function
str1 = str.tostring(123)
str2 = str.tostring(123.45)
str3 = str.tostring(true)
str4 = str.tostring(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.tonumber() function', () => {
      const code = `
//@version=6
indicator("String Conversion Test")

// ToNumber function
num1 = str.tonumber("123")
num2 = str.tonumber("123.45")
num3 = str.tonumber("invalid")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid conversion parameters', () => {
      const code = `
//@version=6
indicator("String Conversion Test")

// Invalid parameters
str1 = str.tostring()  // Error: missing parameter
num1 = str.tonumber(123)  // Error: parameter should be string
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-STR-CONVERSION-INVALID')).toBe(true);
    });
  });

  describe('PSV6-STR-PERFORMANCE: String Performance Validation', () => {
    it('should warn on expensive string operations in loops', () => {
      const code = `
//@version=6
indicator("String Performance Test")

for i = 0 to 100
    result = str.format("Price: {0}", close[i])
    result2 = str.split(str.tostring(close[i]), ".")
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-STR-PERF-LOOP')).toBe(true);
    });

    it('should warn on complex string operations', () => {
      const code = `
//@version=6
indicator("String Performance Test")

// Complex string operations
result = str.replace(str.replace(str.replace("hello world", "world", "universe"), "hello", "hi"), "universe", "galaxy")
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-STR-PERF-COMPLEX')).toBe(true);
    });

    it('should warn on excessive string concatenation', () => {
      const code = `
//@version=6
indicator("String Performance Test")

// Excessive concatenation
result = str.tostring(close) + str.tostring(open) + str.tostring(high) + str.tostring(low) + str.tostring(volume)
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-STR-PERF-CONCAT')).toBe(true);
    });
  });

  describe('PSV6-STR-BEST-PRACTICES: String Best Practices', () => {
    it('should suggest using str.format() instead of concatenation', () => {
      const code = `
//@version=6
indicator("String Best Practices Test")

// Poor concatenation
result = "Price: " + str.tostring(close)
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-STR-FORMAT-SUGGESTION')).toBe(true);
    });

    it('should suggest caching repeated string operations', () => {
      const code = `
//@version=6
indicator("String Best Practices Test")

// Repeated operations
result1 = str.upper("hello")
result2 = str.upper("hello")
result3 = str.upper("hello")
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-STR-CACHE-SUGGESTION')).toBe(true);
    });

    it('should suggest proper string literal usage', () => {
      const code = `
//@version=6
indicator("String Best Practices Test")

// String literal best practices
result = str.tostring("123")  // Should use literal instead
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-STR-LITERAL-SUGGESTION')).toBe(true);
    });
  });

  describe('PSV6-STR-COMPLEX: Complex String Scenarios', () => {
    it('should handle nested string operations', () => {
      const code = `
//@version=6
indicator("String Complex Test")

// Nested operations
result = str.upper(str.substring(str.replace("hello world", "world", "universe"), 0, 5))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle string operations with variables', () => {
      const code = `
//@version=6
indicator("String Complex Test")

// With variables
priceStr = str.tostring(close)
formatted = str.format("Price: {0}", priceStr)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle string operations in conditional expressions', () => {
      const code = `
//@version=6
indicator("String Complex Test")

// In conditionals
if str.contains(str.tostring(close), "123")
    result = str.upper("found")
else
    result = str.lower("not found")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-STR-EDGE-CASES: String Edge Cases', () => {
    it('should handle empty strings', () => {
      const code = `
//@version=6
indicator("String Edge Cases Test")

// Empty strings
length = str.length("")
contains = str.contains("hello", "")
substring = str.substring("", 0, 0)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle string operations with na values', () => {
      const code = `
//@version=6
indicator("String Edge Cases Test")

// With na values
str1 = str.tostring(na)
formatted = str.format("Value: {0}", na)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle out-of-bounds string operations', () => {
      const code = `
//@version=6
indicator("String Edge Cases Test")

// Out of bounds
substring = str.substring("hello", 0, 10)  // Should handle gracefully
pos = str.pos("hello", "world")  // Should return -1
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

