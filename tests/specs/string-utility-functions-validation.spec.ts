/**
 * String Utility Functions Validation Tests (TDD)
 * 
 * PHASE 7 - LOW PRIORITY
 * Coverage Gap: 32% (18/56 string functions untested)
 * 
 * Following TDD: These tests are written FIRST and will initially FAIL
 * until the String Functions Validator is extended.
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../..';
import { ChevrotainAstService } from '../../core/ast/service';

describe('String Utility Functions Validation (TDD)', () => {
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
  // Category 1: String Transformation
  // ============================================================================

  describe('PSV6-STRING-TRANSFORM: String Transformation Functions', () => {
    
    it('should validate str.upper()', () => {
      const code = `
//@version=6
indicator("Upper Case")

text = "hello"
upper = str.upper(text)
label.new(bar_index, high, upper)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.lower()', () => {
      const code = `
//@version=6
indicator("Lower Case")

text = "HELLO"
lower = str.lower(text)
label.new(bar_index, high, lower)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.trim()', () => {
      const code = `
//@version=6
indicator("Trim")

text = "  hello  "
trimmed = str.trim(text)
label.new(bar_index, high, trimmed)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

  });

  // ============================================================================
  // Category 2: String Search & Replace
  // ============================================================================

  describe('PSV6-STRING-SEARCH: String Search & Replace Functions', () => {
    
    it('should validate str.contains()', () => {
      const code = `
//@version=6
indicator("Contains")

text = "Hello World"
hasWorld = str.contains(text, "World")
label.new(bar_index, high, str.tostring(hasWorld))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.pos()', () => {
      const code = `
//@version=6
indicator("Position")

text = "Hello World"
position = str.pos(text, "World")
label.new(bar_index, high, str.tostring(position))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.replace()', () => {
      const code = `
//@version=6
indicator("Replace")

text = "Hello World"
replaced = str.replace(text, "World", "Pine")
label.new(bar_index, high, replaced)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.replace_all()', () => {
      const code = `
//@version=6
indicator("Replace All")

text = "foo bar foo"
replaced = str.replace_all(text, "foo", "baz")
label.new(bar_index, high, replaced)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.match()', () => {
      const code = `
//@version=6
indicator("Match")

text = "Price: $100.50"
matched = str.match(text, "\\\\$[0-9]+\\\\.[0-9]+")
label.new(bar_index, high, matched)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 3: String Slicing & Extraction
  // ============================================================================

  describe('PSV6-STRING-SLICE: String Slicing Functions', () => {
    
    it('should validate str.substring()', () => {
      const code = `
//@version=6
indicator("Substring")

text = "Hello World"
sub = str.substring(text, 0, 5)
label.new(bar_index, high, sub)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.startswith()', () => {
      const code = `
//@version=6
indicator("Starts With")

text = "Hello World"
starts = str.startswith(text, "Hello")
label.new(bar_index, high, str.tostring(starts))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.endswith()', () => {
      const code = `
//@version=6
indicator("Ends With")

text = "Hello World"
ends = str.endswith(text, "World")
label.new(bar_index, high, str.tostring(ends))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 4: String Splitting & Joining
  // ============================================================================

  describe('PSV6-STRING-SPLIT: String Splitting & Joining', () => {
    
    it('should validate str.split()', () => {
      const code = `
//@version=6
indicator("Split")

text = "one,two,three"
parts = str.split(text, ",")
label.new(bar_index, high, array.get(parts, 0))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

  });

  // ============================================================================
  // Category 5: String Formatting & Conversion
  // ============================================================================

  describe('PSV6-STRING-FORMAT: String Formatting Functions', () => {
    
    it('should validate str.repeat()', () => {
      const code = `
//@version=6
indicator("Repeat")

text = "Ha"
repeated = str.repeat(text, 3)
label.new(bar_index, high, repeated)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.tonumber()', () => {
      const code = `
//@version=6
indicator("To Number")

text = "123.45"
number = str.tonumber(text)
plot(number)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.tostring() with format', () => {
      const code = `
//@version=6
indicator("To String Format")

value = 123.456
formatted = str.tostring(value, "#.##")
label.new(bar_index, high, formatted)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate str.format() with placeholders', () => {
      const code = `
//@version=6
indicator("Format")

name = "Bitcoin"
price = close
formatted = str.format("{0}: \${1}", name, price)
label.new(bar_index, high, formatted)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('PSV6-STRING-INTEGRATION: String Integration Tests', () => {
    
    it('should validate comprehensive string manipulation', () => {
      const code = `
//@version=6
indicator("String Manipulation")

// Original text
original = "  HELLO WORLD  "

// Transform
trimmed = str.trim(original)
lower = str.lower(trimmed)

// Search & Replace
hasWorld = str.contains(lower, "world")
replaced = str.replace(lower, "world", "Pine")

// Extract
first5 = str.substring(replaced, 0, 5)
starts = str.startswith(replaced, "Hello")

// Format output
output = str.format("Original: '{0}' -> Result: '{1}'", original, replaced)
label.new(bar_index, high, output)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate string-based data parsing', () => {
      const code = `
//@version=6
indicator("Parse Data")

// CSV-like data
data = "Symbol:BTCUSD,Price:45000,Volume:1234567"

// Split by comma
fields = str.split(data, ",")

// Parse each field
var string symbolName = na
var float priceValue = na
var float volumeValue = na

for [i, field] in fields
    if str.startswith(field, "Symbol:")
        symbolName := str.substring(field, 7)
    else if str.startswith(field, "Price:")
        priceValue := str.tonumber(str.substring(field, 6))
    else if str.startswith(field, "Volume:")
        volumeValue := str.tonumber(str.substring(field, 7))

// Display
label.new(bar_index, high, str.format("{0}: \${1}", symbolName, priceValue))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate template string building', () => {
      const code = `
//@version=6
indicator("Template Builder")

// Build HTML-like template
title = "Market Analysis"
symbol = syminfo.ticker
price = str.tostring(close, "#.##")
change = str.tostring(ta.change(close), "#.##")
volume = str.tostring(volume, "#,###")

template = str.format(
     "<div>\\n  <h1>{0}</h1>\\n  <p>Symbol: {1}</p>\\n  <p>Price: \${2}</p>\\n  <p>Change: \${3}</p>\\n  <p>Volume: {4}</p>\\n</div>",
     title, symbol, price, change, volume)

var table t = table.new(position.top_right, 1, 1)
table.cell(t, 0, 0, template, text_halign=text.align_left)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Error Cases
  // ============================================================================

  describe('PSV6-STRING-ERRORS: String Error Cases', () => {
    
    it('should error on invalid substring range', () => {
      const code = `
//@version=6
indicator("Invalid Substring")

text = "Hello"
sub = str.substring(text, 10, 20)  // Out of bounds
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should error on invalid regex pattern', () => {
      const code = `
//@version=6
indicator("Invalid Regex")

text = "test"
matched = str.match(text, "[invalid")  // Unclosed bracket
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn on tonumber() with non-numeric string', () => {
      const code = `
//@version=6
indicator("Invalid Number")

text = "not a number"
number = str.tonumber(text)  // Will return na
plot(number)
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.message.toLowerCase().includes('na'))).toBe(true);
    });

    it('should error on excessive string concatenation', () => {
      const code = `
//@version=6
indicator("String Memory")

// Building very long strings repeatedly (performance issue)
var string longString = ""
for i = 0 to 10000
    longString := longString + "x"
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Best Practices
  // ============================================================================

  describe('PSV6-STRING-BEST-PRACTICES: String Best Practices', () => {
    
    it('should validate efficient string building', () => {
      const code = `
//@version=6
indicator("Efficient Strings")

// Use array.join() instead of repeated concatenation  
parts = array.new<string>()
for i = 0 to 10
    array.push(parts, str.tostring(i))

result = array.join(parts, ",")
label.new(bar_index, high, result)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate safe string parsing', () => {
      const code = `
//@version=6
indicator("Safe Parsing")

text = "123.45"

// Check if conversion is valid
number = str.tonumber(text)
if not na(number)
    plot(number)
else
    runtime.error("Invalid number format")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

