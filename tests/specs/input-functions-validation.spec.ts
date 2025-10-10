/**
 * Input Functions Validation Tests (TDD)
 * 
 * Comprehensive tests for Pine Script v6 Input functions validation.
 * Following TDD principles: Write tests first, then implement the validator.
 * 
 * Priority 1.3: CRITICAL GAPS - Input Functions (0% Coverage)
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../..';

describe('Input Functions Validation (TDD)', () => {
  const createValidator = () => new EnhancedModularValidator({
    targetVersion: 6,
    strictMode: true,
    enableWarnings: true
  });

  describe('PSV6-INPUT-BASIC: Basic Input Functions Validation', () => {
    it('should validate correct input function calls', () => {
      const code = `
//@version=6
indicator("Input Test")

// Basic input functions
myInt = input.int(10, "Integer Input")
myFloat = input.float(10.5, "Float Input")
myBool = input.bool(true, "Boolean Input")
myString = input.string("default", "String Input")
myColor = input.color(color.red, "Color Input")
mySource = input.source(close, "Source Input")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on incorrect input function parameter types', () => {
      const code = `
//@version=6
indicator("Input Test")

// Wrong parameter types
myInt = input.int("10", "Integer Input")  // Error: default should be int
myFloat = input.float(true, "Float Input")  // Error: default should be float
myBool = input.bool(10, "Boolean Input")  // Error: default should be bool
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-TYPE')).toBe(true);
    });

    it('should error when default value variable has wrong type', () => {
      const code = `
//@version=6
indicator("Input Test")

var defaultStr = '23'
length = input.int(defaultStr, "Length Input")
      `;

      const result = createValidator().validate(code);
      expect(result.errors.some(e => e.code === 'PSV6-INPUT-DEFVAL-TYPE')).toBe(true);
      expect(result.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-TYPE')).toBe(true);
    });

    it('should error on missing required parameters', () => {
      const code = `
//@version=6
indicator("Input Test")

// Missing required parameters
myInt = input.int()  // Error: missing default value
myFloat = input.float(10.5)  // Error: missing title
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-COUNT')).toBe(true);
    });

    it('should validate input function with all optional parameters', () => {
      const code = `
//@version=6
indicator("Input Test")

// With all optional parameters
myInt = input.int(10, "Integer Input", minval=0, maxval=100, step=1, group="Settings", tooltip="Choose an integer")
myFloat = input.float(10.5, "Float Input", minval=0.0, maxval=100.0, step=0.1, group="Settings", tooltip="Choose a float")
myBool = input.bool(true, "Boolean Input", group="Settings", tooltip="Enable or disable")
myString = input.string("default", "String Input", options=["option1", "option2"], group="Settings", tooltip="Choose option")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-INPUT-TYPES: Input Type Validation', () => {
    it('should validate input.int() function', () => {
      const code = `
//@version=6
indicator("Input Int Test")

// Integer input
myInt = input.int(10, "Integer Input")
myIntMin = input.int(10, "Integer Input", minval=0)
myIntMax = input.int(10, "Integer Input", maxval=100)
myIntRange = input.int(10, "Integer Input", minval=0, maxval=100)
myIntStep = input.int(10, "Integer Input", step=5)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.float() function', () => {
      const code = `
//@version=6
indicator("Input Float Test")

// Float input
myFloat = input.float(10.5, "Float Input")
myFloatMin = input.float(10.5, "Float Input", minval=0.0)
myFloatMax = input.float(10.5, "Float Input", maxval=100.0)
myFloatRange = input.float(10.5, "Float Input", minval=0.0, maxval=100.0)
myFloatStep = input.float(10.5, "Float Input", step=0.1)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.bool() function', () => {
      const code = `
//@version=6
indicator("Input Bool Test")

// Boolean input
myBool = input.bool(true, "Boolean Input")
myBoolFalse = input.bool(false, "Boolean Input")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.string() function', () => {
      const code = `
//@version=6
indicator("Input String Test")

// String input
myString = input.string("default", "String Input")
myStringOptions = input.string("option1", "String Input", options=["option1", "option2", "option3"])
myStringMultiline = input.string("line1\\nline2", "Multiline Input", multiline=true)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.color() function', () => {
      const code = `
//@version=6
indicator("Input Color Test")

// Color input
myColor = input.color(color.red, "Color Input")
myColorRGB = input.color(#ff0000, "Color Input")
myColorTransparent = input.color(color.new(color.red, 50), "Color Input")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.source() function', () => {
      const code = `
//@version=6
indicator("Input Source Test")

// Source input
mySource = input.source(close, "Source Input")
mySourceHigh = input.source(high, "Source Input")
mySourceLow = input.source(low, "Source Input")
mySourceVolume = input.source(volume, "Source Input")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.timeframe() function', () => {
      const code = `
//@version=6
indicator("Input Timeframe Test")

// Timeframe input
myTF = input.timeframe("1D", "Timeframe Input")
myTFMin = input.timeframe("1", "Timeframe Input")
myTFHour = input.timeframe("1H", "Timeframe Input")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.session() function', () => {
      const code = `
//@version=6
indicator("Input Session Test")

// Session input
mySession = input.session("0800-1600", "Session Input")
mySessionExtended = input.session("0800-1600", "Session Input", "Extended Session")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.symbol() function', () => {
      const code = `
//@version=6
indicator("Input Symbol Test")

// Symbol input
mySymbol = input.symbol("AAPL", "Symbol Input")
mySymbolEmpty = input.symbol("", "Symbol Input")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input.resolution() function', () => {
      const code = `
//@version=6
indicator("Input Resolution Test")

// Resolution input
myRes = input.resolution("1", "Resolution Input")
myResMinute = input.resolution("1", "Resolution Input")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-INPUT-PARAMETERS: Input Parameter Validation', () => {
    it('should validate minval parameter', () => {
      const code = `
//@version=6
indicator("Input Minval Test")

// Valid minval
myInt = input.int(10, "Integer Input", minval=0)
myFloat = input.float(10.5, "Float Input", minval=0.0)

// Invalid minval (should warn)
myIntBad = input.int(10, "Integer Input", minval=20)  // minval > default
myFloatBad = input.float(10.5, "Float Input", minval=20.0)  // minval > default
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-INPUT-MINVAL-WARNING')).toBe(true);
    });

    it('should validate maxval parameter', () => {
      const code = `
//@version=6
indicator("Input Maxval Test")

// Valid maxval
myInt = input.int(10, "Integer Input", maxval=100)
myFloat = input.float(10.5, "Float Input", maxval=100.0)

// Invalid maxval (should warn)
myIntBad = input.int(10, "Integer Input", maxval=5)  // maxval < default
myFloatBad = input.float(10.5, "Float Input", maxval=5.0)  // maxval < default
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-INPUT-MAXVAL-WARNING')).toBe(true);
    });

    it('should validate step parameter', () => {
      const code = `
//@version=6
indicator("Input Step Test")

// Valid step
myInt = input.int(10, "Integer Input", step=1)
myFloat = input.float(10.5, "Float Input", step=0.1)

// Invalid step (should warn)
myIntBad = input.int(10, "Integer Input", step=0)  // step = 0
myFloatBad = input.float(10.5, "Float Input", step=-0.1)  // negative step
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-INPUT-STEP-WARNING')).toBe(true);
    });

    it('should validate options parameter', () => {
      const code = `
//@version=6
indicator("Input Options Test")

// Valid options
myString = input.string("option1", "String Input", options=["option1", "option2"])
myStringEmpty = input.string("", "String Input", options=[])

// Invalid options (should warn)
myStringBad = input.string("option3", "String Input", options=["option1", "option2"])  // default not in options
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-INPUT-OPTIONS-WARNING')).toBe(true);
    });

    it('should validate group parameter', () => {
      const code = `
//@version=6
indicator("Input Group Test")

// Valid groups
myInt = input.int(10, "Integer Input", group="Settings")
myFloat = input.float(10.5, "Float Input", group="Advanced Settings")
myBool = input.bool(true, "Boolean Input", group="")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate tooltip parameter', () => {
      const code = `
//@version=6
indicator("Input Tooltip Test")

// Valid tooltips
myInt = input.int(10, "Integer Input", tooltip="Choose an integer value")
myFloat = input.float(10.5, "Float Input", tooltip="")
myBool = input.bool(true, "Boolean Input", tooltip="Enable or disable feature")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate inline parameter', () => {
      const code = `
//@version=6
indicator("Input Inline Test")

// Valid inline
myInt = input.int(10, "Integer Input", inline="Input1")
myFloat = input.float(10.5, "Float Input", inline="Input2")
myBool = input.bool(true, "Boolean Input", inline="Input1")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate confirm parameter', () => {
      const code = `
//@version=6
indicator("Input Confirm Test")

// Valid confirm
myInt = input.int(10, "Integer Input", confirm=true)
myFloat = input.float(10.5, "Float Input", confirm=false)
myBool = input.bool(true, "Boolean Input", confirm=true)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-INPUT-PERFORMANCE: Input Performance Validation', () => {
    it('should warn on too many input functions', () => {
      const code = `
//@version=6
indicator("Input Performance Test")

// Too many inputs (26 inputs to trigger the warning)
input1 = input.int(1, "Input 1")
input2 = input.int(2, "Input 2")
input3 = input.int(3, "Input 3")
input4 = input.int(4, "Input 4")
input5 = input.int(5, "Input 5")
input6 = input.int(6, "Input 6")
input7 = input.int(7, "Input 7")
input8 = input.int(8, "Input 8")
input9 = input.int(9, "Input 9")
input10 = input.int(10, "Input 10")
input11 = input.int(11, "Input 11")
input12 = input.int(12, "Input 12")
input13 = input.int(13, "Input 13")
input14 = input.int(14, "Input 14")
input15 = input.int(15, "Input 15")
input16 = input.int(16, "Input 16")
input17 = input.int(17, "Input 17")
input18 = input.int(18, "Input 18")
input19 = input.int(19, "Input 19")
input20 = input.int(20, "Input 20")
input21 = input.int(21, "Input 21")
input22 = input.int(22, "Input 22")
input23 = input.int(23, "Input 23")
input24 = input.int(24, "Input 24")
input25 = input.int(25, "Input 25")
input26 = input.int(26, "Input 26")
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-INPUT-TOO-MANY')).toBe(true);
    });

    it('should warn on complex input expressions', () => {
      const code = `
//@version=6
indicator("Input Performance Test")

// Complex input expressions
myInput = input.int(ta.sma(close, 20), "Complex Input")
myInput2 = input.float(math.max(high, low), "Complex Input")
myInput3 = input.string(str.format("Price: {0}", close), "Complex Input")
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-INPUT-COMPLEX-EXPRESSION')).toBe(true);
    });
  });

  describe('PSV6-INPUT-BEST-PRACTICES: Input Best Practices', () => {
    it('should suggest better input naming conventions', () => {
      const code = `
//@version=6
indicator("Input Best Practices Test")

// Poor naming
a = input.int(10, "Input")
x = input.float(10.5, "Input")
flag = input.bool(true, "Input")
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-INPUT-NAMING-SUGGESTION')).toBe(true);
    });

    it('should suggest input grouping', () => {
      const code = `
//@version=6
indicator("Input Best Practices Test")

// Unorganized inputs
length1 = input.int(10, "Length 1")
length2 = input.int(20, "Length 2")
color1 = input.color(color.red, "Color 1")
color2 = input.color(color.blue, "Color 2")
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-INPUT-GROUP-SUGGESTION')).toBe(true);
    });

    it('should suggest meaningful tooltips', () => {
      const code = `
//@version=6
indicator("Input Best Practices Test")

// Missing or poor tooltips
myInt = input.int(10, "Integer Input")
myFloat = input.float(10.5, "Float Input", tooltip="")
myBool = input.bool(true, "Boolean Input")
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-INPUT-TOOLTIP-SUGGESTION')).toBe(true);
    });

    it('should suggest reasonable default values', () => {
      const code = `
//@version=6
indicator("Input Best Practices Test")

// Unreasonable defaults
myInt = input.int(999999, "Integer Input")
myFloat = input.float(0.000001, "Float Input")
myString = input.string("", "String Input")
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-INPUT-DEFAULT-SUGGESTION')).toBe(true);
    });
  });

  describe('PSV6-INPUT-COMPLEX: Complex Input Scenarios', () => {
    it('should handle conditional input usage', () => {
      const code = `
//@version=6
indicator("Input Complex Test")

// Conditional input usage
enableFeature = input.bool(true, "Enable Feature")
featureValue = input.int(10, "Feature Value")

if enableFeature
    result = featureValue
else
    result = 0
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle input in function parameters', () => {
      const code = `
//@version=6
indicator("Input Complex Test")

// Input in function parameters
length = input.int(20, "Length")
mySMA = ta.sma(close, length)
myEMA = ta.ema(close, length)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle nested input expressions', () => {
      const code = `
//@version=6
indicator("Input Complex Test")

// Nested input expressions
baseLength = input.int(10, "Base Length")
multiplier = input.int(2, "Multiplier")
finalLength = input.int(baseLength * multiplier, "Final Length")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-INPUT-EDGE-CASES: Input Edge Cases', () => {
    it('should handle input with na values', () => {
      const code = `
//@version=6
indicator("Input Edge Cases Test")

// Input with na
myInt = input.int(na, "Integer Input")
myFloat = input.float(na, "Float Input")
myBool = input.bool(na, "Boolean Input")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle input with special values', () => {
      const code = `
//@version=6
indicator("Input Edge Cases Test")

// Special values
myInt = input.int(0, "Integer Input")
myFloat = input.float(0.0, "Float Input")
myBool = input.bool(false, "Boolean Input")
myString = input.string("", "String Input")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle input parameter edge cases', () => {
      const code = `
//@version=6
indicator("Input Edge Cases Test")

// Edge cases
myInt = input.int(10, "Integer Input", minval=10, maxval=10)  // minval = maxval = default
myFloat = input.float(10.5, "Float Input", step=0.0001)  // very small step
myString = input.string("very long default value that might cause issues", "String Input")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
