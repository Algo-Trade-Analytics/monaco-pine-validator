/**
 * Drawing Functions Validation Tests (TDD)
 * 
 * Comprehensive tests for Pine Script v6 Drawing functions validation.
 * Following TDD principles: Write tests first, then implement the validator.
 * 
 * Priority 2.1: HIGH PRIORITY GAPS - Drawing Functions (5% Coverage)
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../..';

describe('Drawing Functions Validation (TDD)', () => {
  const createValidator = () => new EnhancedModularValidator({
    targetVersion: 6,
    strictMode: true,
    enableWarnings: true
  });

  describe('PSV6-LINE-BASIC: Line Drawing Functions Validation', () => {
    it('should validate correct line drawing functions', () => {
      const code = `
//@version=6
indicator("Line Drawing Test")

// Basic line functions
myLine = line.new(0, 0, 100, 100, color=color.red, width=2, style=line.style_solid)
line.set_xy1(myLine, 10, 20)
line.set_xy2(myLine, 30, 40)
line.set_color(myLine, color.blue)
line.set_width(myLine, 3)
line.set_style(myLine, line.style_dashed)
line.delete(myLine)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on incorrect line function parameter types', () => {
      const code = `
//@version=6
indicator("Line Drawing Test")

// Wrong parameter types
myLine = line.new("0", 0, 100, 100)  // Error: x1 should be int
myLine2 = line.new(0, "0", 100, 100)  // Error: y1 should be int
line.set_color(myLine, "red")  // Error: color should be color type
line.set_width(myLine, "2")  // Error: width should be int
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-TYPE')).toBe(true);
    });

    it('should error on incorrect line function parameter count', () => {
      const code = `
//@version=6
indicator("Line Drawing Test")

// Wrong parameter counts
myLine = line.new(0, 0, 100)  // Error: missing y2 parameter
line.set_xy1(myLine)  // Error: missing x1, y1 parameters
line.set_color(myLine)  // Error: missing color parameter
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-COUNT')).toBe(true);
    });

    it('should validate line style constants', () => {
      const code = `
//@version=6
indicator("Line Drawing Test")

// Line style constants
myLine1 = line.new(0, 0, 100, 100, style=line.style_solid)
myLine2 = line.new(0, 0, 100, 100, style=line.style_dashed)
myLine3 = line.new(0, 0, 100, 100, style=line.style_dotted)
myLine4 = line.new(0, 0, 100, 100, style=line.style_arrow_left)
myLine5 = line.new(0, 0, 100, 100, style=line.style_arrow_right)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-LABEL-BASIC: Label Drawing Functions Validation', () => {
    it('should validate correct label drawing functions', () => {
      const code = `
//@version=6
indicator("Label Drawing Test")

// Basic label functions
myLabel = label.new(0, 0, "Hello World", color=color.red, style=label.style_label_up, size=size.normal)
label.set_text(myLabel, "Updated Text")
label.set_color(myLabel, color.blue)
label.set_style(myLabel, label.style_label_down)
label.set_size(myLabel, size.large)
label.set_x(myLabel, 10)
label.set_y(myLabel, 20)
label.delete(myLabel)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on incorrect label function parameter types', () => {
      const code = `
//@version=6
indicator("Label Drawing Test")

// Wrong parameter types
myLabel = label.new("0", 0, "Hello")  // Error: x should be int
myLabel2 = label.new(0, "0", "Hello")  // Error: y should be int
label.set_text(myLabel, 123)  // Error: text should be string
label.set_color(myLabel, "red")  // Error: color should be color type
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-TYPE')).toBe(true);
    });

    it('should validate label style constants', () => {
      const code = `
//@version=6
indicator("Label Drawing Test")

// Label style constants
myLabel1 = label.new(0, 0, "Label", style=label.style_label_up)
myLabel2 = label.new(0, 0, "Label", style=label.style_label_down)
myLabel3 = label.new(0, 0, "Label", style=label.style_label_left)
myLabel4 = label.new(0, 0, "Label", style=label.style_label_right)
myLabel5 = label.new(0, 0, "Label", style=label.style_label_center)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate label size constants', () => {
      const code = `
//@version=6
indicator("Label Drawing Test")

// Label size constants
myLabel1 = label.new(0, 0, "Label", size=size.tiny)
myLabel2 = label.new(0, 0, "Label", size=size.small)
myLabel3 = label.new(0, 0, "Label", size=size.normal)
myLabel4 = label.new(0, 0, "Label", size=size.large)
myLabel5 = label.new(0, 0, "Label", size=size.huge)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-BOX-BASIC: Box Drawing Functions Validation', () => {
    it('should validate correct box drawing functions', () => {
      const code = `
//@version=6
indicator("Box Drawing Test")

// Basic box functions
myBox = box.new(0, 0, 100, 100, color=color.red, border_color=color.blue, border_width=2, border_style=line.style_solid)
box.set_bgcolor(myBox, color.green)
box.set_border_color(myBox, color.yellow)
box.set_border_width(myBox, 3)
box.set_border_style(myBox, line.style_dashed)
box.set_left(myBox, 10)
box.set_right(myBox, 20)
box.set_top(myBox, 30)
box.set_bottom(myBox, 40)
box.delete(myBox)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on incorrect box function parameter types', () => {
      const code = `
//@version=6
indicator("Box Drawing Test")

// Wrong parameter types
myBox = box.new("0", 0, 100, 100)  // Error: left should be int
myBox2 = box.new(0, "0", 100, 100)  // Error: top should be int
box.set_bgcolor(myBox, "red")  // Error: color should be color type
box.set_border_width(myBox, "2")  // Error: width should be int
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-TYPE')).toBe(true);
    });

    it('should validate box border style constants', () => {
      const code = `
//@version=6
indicator("Box Drawing Test")

// Box border style constants
myBox1 = box.new(0, 0, 100, 100, border_style=line.style_solid)
myBox2 = box.new(0, 0, 100, 100, border_style=line.style_dashed)
myBox3 = box.new(0, 0, 100, 100, border_style=line.style_dotted)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-TABLE-BASIC: Table Drawing Functions Validation', () => {
    it('should validate correct table drawing functions', () => {
      const code = `
//@version=6
indicator("Table Drawing Test")

// Basic table functions
myTable = table.new(position.top_right, 2, 3, bgcolor=color.white, border_width=1)
table.cell(myTable, 0, 0, "Header", text_color=color.black, bgcolor=color.gray)
table.cell_set_text(myTable, 0, 1, "Data")
table.cell_set_bgcolor(myTable, 0, 1, color.blue)
table.cell_set_text_color(myTable, 0, 1, color.white)
table.cell_set_text_size(myTable, 0, 1, size.normal)
table.delete(myTable)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on incorrect table function parameter types', () => {
      const code = `
//@version=6
indicator("Table Drawing Test")

// Wrong parameter types
myTable = table.new("top_right", 2, 3)  // Error: position should be position constant
myTable2 = table.new(position.top_right, "2", 3)  // Error: columns should be int
table.cell(myTable, "0", 0, "Text")  // Error: x should be int
table.cell_set_text(myTable, 0, "0", "Text")  // Error: y should be int
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-TYPE')).toBe(true);
    });

    it('should validate table position constants', () => {
      const code = `
//@version=6
indicator("Table Drawing Test")

// Table position constants
myTable1 = table.new(position.top_left, 2, 3)
myTable2 = table.new(position.top_center, 2, 3)
myTable3 = table.new(position.top_right, 2, 3)
myTable4 = table.new(position.middle_left, 2, 3)
myTable5 = table.new(position.middle_center, 2, 3)
myTable6 = table.new(position.middle_right, 2, 3)
myTable7 = table.new(position.bottom_left, 2, 3)
myTable8 = table.new(position.bottom_center, 2, 3)
myTable9 = table.new(position.bottom_right, 2, 3)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-DRAWING-PERFORMANCE: Drawing Performance Validation', () => {
    it('should warn on too many drawing objects', () => {
      const code = `
//@version=6
indicator("Drawing Performance Test")

// Too many drawing objects
line1 = line.new(0, 0, 10, 10)
line2 = line.new(0, 0, 10, 10)
line3 = line.new(0, 0, 10, 10)
line4 = line.new(0, 0, 10, 10)
line5 = line.new(0, 0, 10, 10)
line6 = line.new(0, 0, 10, 10)
line7 = line.new(0, 0, 10, 10)
line8 = line.new(0, 0, 10, 10)
line9 = line.new(0, 0, 10, 10)
line10 = line.new(0, 0, 10, 10)
line11 = line.new(0, 0, 10, 10)
line12 = line.new(0, 0, 10, 10)
line13 = line.new(0, 0, 10, 10)
line14 = line.new(0, 0, 10, 10)
line15 = line.new(0, 0, 10, 10)
line16 = line.new(0, 0, 10, 10)
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-DRAWING-TOO-MANY')).toBe(true);
    });

    it('should warn on drawing objects in loops', () => {
      const code = `
//@version=6
indicator("Drawing Performance Test")

// Drawing objects in loops
for i = 0 to 10
    line.new(i, i, i + 10, i + 10)
    label.new(i, i, str.tostring(i))
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-DRAWING-IN-LOOP')).toBe(true);
    });

    it('should warn on complex drawing expressions', () => {
      const code = `
//@version=6
indicator("Drawing Performance Test")

// Complex drawing expressions
myLine = line.new(ta.sma(close, 20), ta.ema(close, 10), math.max(high, low), math.min(high, low))
myLabel = label.new(bar_index, ta.rsi(close, 14), str.format("RSI: {0}", ta.rsi(close, 14)))
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-DRAWING-COMPLEX-EXPRESSION')).toBe(true);
    });
  });

  describe('PSV6-DRAWING-BEST-PRACTICES: Drawing Best Practices', () => {
    it('should suggest proper drawing object cleanup', () => {
      const code = `
//@version=6
indicator("Drawing Best Practices Test")

// Missing cleanup
myLine = line.new(0, 0, 100, 100)
myLabel = label.new(0, 0, "Label")
// Objects not deleted
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-DRAWING-CLEANUP-SUGGESTION')).toBe(true);
    });

    it('should suggest better drawing object naming', () => {
      const code = `
//@version=6
indicator("Drawing Best Practices Test")

// Poor naming
l = line.new(0, 0, 100, 100)
lb = label.new(0, 0, "Label")
b = box.new(0, 0, 100, 100)
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-DRAWING-NAMING-SUGGESTION')).toBe(true);
    });

    it('should suggest proper drawing object positioning', () => {
      const code = `
//@version=6
indicator("Drawing Best Practices Test")

// Poor positioning
myLine = line.new(0, 0, 0, 0)  // Same start and end points
myLabel = label.new(-1000, -1000, "Label")  // Off-screen position
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-DRAWING-POSITION-SUGGESTION')).toBe(true);
    });

    it('should suggest proper drawing object styling', () => {
      const code = `
//@version=6
indicator("Drawing Best Practices Test")

// Poor styling
myLine = line.new(0, 0, 100, 100, width=10)  // Very thick line
myLabel = label.new(0, 0, "Very long text that might cause display issues", size=size.huge)
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-DRAWING-STYLE-SUGGESTION')).toBe(true);
    });
  });

  describe('PSV6-DRAWING-COMPLEX: Complex Drawing Scenarios', () => {
    it('should handle conditional drawing objects', () => {
      const code = `
//@version=6
indicator("Drawing Complex Test")

// Conditional drawing
if ta.crossover(close, ta.sma(close, 20))
    myLine = line.new(bar_index, close, bar_index + 10, close + 10, color=color.green)
else if ta.crossunder(close, ta.sma(close, 20))
    myLine = line.new(bar_index, close, bar_index + 10, close - 10, color=color.red)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle drawing objects in functions', () => {
      const code = `
//@version=6
indicator("Drawing Complex Test")

// Drawing in functions
drawSignal(x, y, color) =>
    label.new(x, y, "Signal", color=color, size=size.small)

drawSignal(bar_index, close, color.green)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle drawing object arrays', () => {
      const code = `
//@version=6
indicator("Drawing Complex Test")

// Drawing object arrays
var line[] lines = array.new<line>()
array.push(lines, line.new(0, 0, 100, 100))
array.push(lines, line.new(0, 100, 100, 0))

// Update all lines
for i = 0 to array.size(lines) - 1
    currentLine = array.get(lines, i)
    line.set_x1(currentLine, bar_index)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-DRAWING-EDGE-CASES: Drawing Edge Cases', () => {
    it('should handle drawing objects with na values', () => {
      const code = `
//@version=6
indicator("Drawing Edge Cases Test")

// Drawing with na values
myLine = line.new(na, na, 100, 100)
myLabel = label.new(0, 0, str.tostring(na))
myBox = box.new(na, na, na, na)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle drawing objects with extreme values', () => {
      const code = `
//@version=6
indicator("Drawing Edge Cases Test")

// Drawing with extreme values
myLine = line.new(0, 0, 1000000, 1000000)
myLabel = label.new(-1000000, -1000000, "Extreme")
myBox = box.new(0, 0, 1000000, 1000000)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle drawing object method chaining', () => {
      const code = `
//@version=6
indicator("Drawing Edge Cases Test")

// Method chaining
myLine = line.new(0, 0, 100, 100)
line.set_color(myLine, color.red)
line.set_width(myLine, 2)
line.set_style(myLine, line.style_dashed)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

