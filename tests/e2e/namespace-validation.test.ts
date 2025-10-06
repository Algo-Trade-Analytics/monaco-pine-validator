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
import { getNamespacePattern } from '../../core/constants';

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

  describe('Type Annotation Context Validation', () => {
    it('should allow namespace members in function parameter type annotations', () => {
      const code = `//@version=6
indicator("Test")

f_process(chart.point cp, color c) =>
    label.new(cp.index, cp.price, "Test", color=c)

f_draw(array<chart.point> points, matrix<Point3D> data) =>
    for p in points
        label.new(p.index, p.price, "Point")`;

      const result = validator.validate(code);

      // Should not have namespace validation errors for type annotations
      const namespaceErrors = result.errors.filter(e => e.code === 'PSV6-UNDEFINED-NAMESPACE-MEMBER');
      expect(namespaceErrors).toHaveLength(0);
    });

    it('should allow namespace members in variable declaration type annotations', () => {
      const code = `//@version=6
indicator("Test")

array<chart.point> poly = array.new<chart.point>()
matrix<Point3D> M = matrix.new<Point3D>(10, 10)
map<string, bool> flags = map.new<string, bool>()`;

      const result = validator.validate(code);

      // Should not have namespace validation errors for type annotations
      const namespaceErrors = result.errors.filter(e => e.code === 'PSV6-UNDEFINED-NAMESPACE-MEMBER');
      expect(namespaceErrors).toHaveLength(0);
    });

    it('should allow namespace members in UDT field type annotations', () => {
      const code = `//@version=6
indicator("Test")

type DataPoint
    chart.point position
    color pointColor
    array<chart.point> neighbors

type Camera
    int anchorX
    float anchorY
    float cYaw
    float sYaw`;

      const result = validator.validate(code);

      // Should not have namespace validation errors for type annotations
      const namespaceErrors = result.errors.filter(e => e.code === 'PSV6-UNDEFINED-NAMESPACE-MEMBER');
      expect(namespaceErrors).toHaveLength(0);
    });

    it('should allow namespace members in method this parameter type annotations', () => {
      const code = `//@version=6
indicator("Test")

type Point3D
    float x
    float y
    float z

    method project(this<Point3D>, Camera cam) =>
        array<chart.point> poly = array.new<chart.point>()
        poly.push(cam.project(this))
        poly`;

      const result = validator.validate(code);

      // Should not have namespace validation errors for type annotations
      const namespaceErrors = result.errors.filter(e => e.code === 'PSV6-UNDEFINED-NAMESPACE-MEMBER');
      expect(namespaceErrors).toHaveLength(0);
    });

    it('should allow namespace members in return type annotations', () => {
      const code = `//@version=6
indicator("Test")

f_getPoint(): chart.point =>
    chart.point.from_index(0, 0)

f_getPoints(): array<chart.point> =>
    array.new<chart.point>()`;

      const result = validator.validate(code);

      // Should not have namespace validation errors for type annotations
      const namespaceErrors = result.errors.filter(e => e.code === 'PSV6-UNDEFINED-NAMESPACE-MEMBER');
      expect(namespaceErrors).toHaveLength(0);
    });

    it('should allow namespace members in colon-based type annotations', () => {
      const code = `//@version=6
indicator("Test")

f_process(points: array<chart.point>, data: matrix<Point3D>) =>
    for p in points
        label.new(p.index, p.price, "Point")`;

      const result = validator.validate(code);

      // Should not have namespace validation errors for type annotations
      const namespaceErrors = result.errors.filter(e => e.code === 'PSV6-UNDEFINED-NAMESPACE-MEMBER');
      expect(namespaceErrors).toHaveLength(0);
    });

    it('should still validate namespace members in method calls', () => {
      const code = `//@version=6
indicator("Test")

// These should still be validated as method calls
result = chart.point.nonexistent()
data = array.invalid_method()
matrix = matrix.wrong_function()`;

      const result = validator.validate(code);

      // Should have namespace validation errors for invalid method calls
      const namespaceErrors = result.errors.filter(e => e.code === 'PSV6-UNDEFINED-NAMESPACE-MEMBER');
      expect(namespaceErrors.length).toBeGreaterThan(0);
    });

    it('should validate nested namespace access in method calls', () => {
      const code = `//@version=6
indicator("Test")

// Valid nested namespace access
valid = chart.point.from_index(0, 0)

// Invalid nested namespace access
invalid = chart.point.nonexistent_method(0, 0)
also_invalid = chart.invalid_namespace.from_index(0, 0)`;

      const result = validator.validate(code);

      // Should have namespace validation errors for invalid nested access
      const namespaceErrors = result.errors.filter(e => e.code === 'PSV6-UNDEFINED-NAMESPACE-MEMBER');
      expect(namespaceErrors.length).toBeGreaterThan(0);
      
      // Should not have errors for valid nested access
      const validErrors = namespaceErrors.filter(e => e.message.includes('chart.point.from_index'));
      expect(validErrors).toHaveLength(0);
    });
  });

  describe('Built-in Namespace Members', () => {
    it('should recognize all built-in namespace members', () => {
      const code = `//@version=6
indicator("Test")

// Test various built-in namespace members
a1 = array.new<int>()
a2 = matrix.new<float>(10, 10)
a3 = map.new<string, bool>()
a4 = chart.point.from_index(0, 0)
a5 = color.rgb(255, 0, 0)
a6 = scale.none
a7 = size.tiny
a8 = style.solid`;

      const result = validator.validate(code);

      // Should not have namespace validation errors for built-in members
      const namespaceErrors = result.errors.filter(e => e.code === 'PSV6-UNDEFINED-NAMESPACE-MEMBER');
      expect(namespaceErrors).toHaveLength(0);
    });

    it('should detect invalid built-in namespace members', () => {
      const code = `//@version=6
indicator("Test")

// Test invalid namespace members
invalid1 = array.invalid_method()
invalid2 = matrix.wrong_function()
invalid3 = chart.point.nonexistent()
invalid4 = color.invalid_property
invalid5 = scale.wrong_scale`;

      const result = validator.validate(code);

      // Should have namespace validation errors for invalid members
      const namespaceErrors = result.errors.filter(e => e.code === 'PSV6-UNDEFINED-NAMESPACE-MEMBER');
      expect(namespaceErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Namespace pattern helper', () => {
    it('matches nested chart namespace access', () => {
      const pattern = getNamespacePattern();
      const line = 'chart.point.from_index(0, 0)';

      pattern.lastIndex = 0;
      const match = pattern.exec(line);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe('chart');
      expect(match?.[2]).toBe('point');
      expect(match?.[3]).toBe('from_index');
    });

    it('matches nested strategy namespaces', () => {
      const pattern = getNamespacePattern();
      const line = 'strategy.closedtrades.exit(0)';

      pattern.lastIndex = 0;
      const match = pattern.exec(line);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe('strategy');
      expect(match?.[2]).toBe('closedtrades');
      expect(match?.[3]).toBe('exit');
    });

    it('ignores unsupported namespace roots', () => {
      const pattern = getNamespacePattern();
      const line = 'session.isfirstbar';

      pattern.lastIndex = 0;
      const match = pattern.exec(line);

      expect(match).toBeNull();
    });
  });
});

