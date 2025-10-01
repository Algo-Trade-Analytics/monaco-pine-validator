/**
 * Drawing Utility Functions Validation Tests (TDD)
 * 
 * PHASE 5 - MEDIUM PRIORITY
 * Coverage Gap: 35% (21/60 drawing functions untested)
 * 
 * Focusing on box.*, line.*, and label.* utility functions
 * 
 * Following TDD: These tests are written FIRST and will initially FAIL
 * until the Drawing Functions Validator is extended.
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../..';
import { ChevrotainAstService } from '../../core/ast/service';

describe('Drawing Utility Functions Validation (TDD)', () => {
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
  // Category 1: Box Functions
  // ============================================================================

  describe('PSV6-BOX-FUNCTIONS: Box Drawing Functions', () => {
    
    it('should validate box.new()', () => {
      const code = `
//@version=6
indicator("Box")

var box myBox = na
if bar_index == 50
    myBox := box.new(left=bar_index-10, top=high, right=bar_index, bottom=low, border_color=color.blue, bgcolor=color.new(color.blue, 80))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate box.copy()', () => {
      const code = `
//@version=6
indicator("Box Copy")

original = box.new(bar_index-10, high, bar_index, low)
copied = box.copy(original)
box.set_bgcolor(copied, color.red)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate box.delete()', () => {
      const code = `
//@version=6
indicator("Box Delete")

var box myBox = na
if bar_index % 10 == 0
    if not na(myBox)
        box.delete(myBox)
    myBox := box.new(bar_index-5, high, bar_index, low)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate box.set_* setter functions', () => {
      const code = `
//@version=6
indicator("Box Setters")

myBox = box.new(bar_index-10, high, bar_index, low)
box.set_left(myBox, bar_index-20)
box.set_top(myBox, high[5])
box.set_right(myBox, bar_index-1)
box.set_bottom(myBox, low[5])
box.set_border_color(myBox, color.green)
box.set_border_width(myBox, 2)
box.set_border_style(myBox, line.style_dashed)
box.set_bgcolor(myBox, color.new(color.green, 90))
box.set_text(myBox, "Test Box")
box.set_text_size(myBox, size.small)
box.set_text_color(myBox, color.white)
box.set_text_halign(myBox, text.align_center)
box.set_text_valign(myBox, text.align_center)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate box.get_* getter functions', () => {
      const code = `
//@version=6
indicator("Box Getters")

myBox = box.new(bar_index-10, high, bar_index, low)
left = box.get_left(myBox)
top = box.get_top(myBox)
right = box.get_right(myBox)
bottom = box.get_bottom(myBox)

plot(left)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate box.all array', () => {
      const code = `
//@version=6
indicator("Box All")

// Create some boxes
box.new(bar_index-5, high, bar_index, low)
box.new(bar_index-10, high[5], bar_index-5, low[5])

// Access all boxes
allBoxes = box.all
boxCount = array.size(allBoxes)
label.new(bar_index, high, str.tostring(boxCount))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 2: Line Functions
  // ============================================================================

  describe('PSV6-LINE-FUNCTIONS: Line Drawing Functions', () => {
    
    it('should validate line.new()', () => {
      const code = `
//@version=6
indicator("Line")

var line myLine = na
if bar_index % 10 == 0
    myLine := line.new(x1=bar_index-10, y1=low[10], x2=bar_index, y2=low, color=color.blue, width=2)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate line.copy()', () => {
      const code = `
//@version=6
indicator("Line Copy")

original = line.new(bar_index-10, low[10], bar_index, low)
copied = line.copy(original)
line.set_color(copied, color.red)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate line.delete()', () => {
      const code = `
//@version=6
indicator("Line Delete")

var line myLine = na
if bar_index % 10 == 0
    if not na(myLine)
        line.delete(myLine)
    myLine := line.new(bar_index-10, low[10], bar_index, low)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate line.set_* setter functions', () => {
      const code = `
//@version=6
indicator("Line Setters")

myLine = line.new(bar_index-10, low[10], bar_index, low)
line.set_x1(myLine, bar_index-20)
line.set_y1(myLine, low[20])
line.set_x2(myLine, bar_index-1)
line.set_y2(myLine, low[1])
line.set_color(myLine, color.blue)
line.set_width(myLine, 3)
line.set_style(myLine, line.style_dotted)
line.set_extend(myLine, extend.right)
line.set_xloc(myLine, xloc.bar_index)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate line.get_* getter functions', () => {
      const code = `
//@version=6
indicator("Line Getters")

myLine = line.new(bar_index-10, low[10], bar_index, low)
x1 = line.get_x1(myLine)
y1 = line.get_y1(myLine)
x2 = line.get_x2(myLine)
y2 = line.get_y2(myLine)
price = line.get_price(myLine, bar_index-5)

plot(price)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate line.all array', () => {
      const code = `
//@version=6
indicator("Line All")

line.new(bar_index-5, low[5], bar_index, low)
line.new(bar_index-10, high[10], bar_index-5, high[5])

allLines = line.all
lineCount = array.size(allLines)
label.new(bar_index, high, str.tostring(lineCount))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 3: Label Functions
  // ============================================================================

  describe('PSV6-LABEL-FUNCTIONS: Label Drawing Functions', () => {
    
    it('should validate label.new()', () => {
      const code = `
//@version=6
indicator("Label")

if bar_index % 10 == 0
    label.new(bar_index, high, "Signal", style=label.style_label_down, color=color.green, textcolor=color.white)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate label.copy()', () => {
      const code = `
//@version=6
indicator("Label Copy")

original = label.new(bar_index, high, "Buy")
copied = label.copy(original)
label.set_text(copied, "Sell")
label.set_color(copied, color.red)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate label.delete()', () => {
      const code = `
//@version=6
indicator("Label Delete")

var label myLabel = na
if bar_index % 10 == 0
    if not na(myLabel)
        label.delete(myLabel)
    myLabel := label.new(bar_index, high, "New")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate label.set_* setter functions', () => {
      const code = `
//@version=6
indicator("Label Setters")

myLabel = label.new(bar_index, high, "Test")
label.set_x(myLabel, bar_index-1)
label.set_y(myLabel, high[1])
label.set_text(myLabel, "Updated")
label.set_color(myLabel, color.red)
label.set_textcolor(myLabel, color.white)
label.set_style(myLabel, label.style_label_up)
label.set_size(myLabel, size.large)
label.set_textalign(myLabel, text.align_left)
label.set_tooltip(myLabel, "Tooltip text")
label.set_xloc(myLabel, xloc.bar_index)
label.set_yloc(myLabel, yloc.abovebar)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate label.get_* getter functions', () => {
      const code = `
//@version=6
indicator("Label Getters")

myLabel = label.new(bar_index, high, "Test")
x = label.get_x(myLabel)
y = label.get_y(myLabel)
text = label.get_text(myLabel)

plot(x)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate label.all array', () => {
      const code = `
//@version=6
indicator("Label All")

label.new(bar_index, high, "A")
label.new(bar_index, low, "B")

allLabels = label.all
labelCount = array.size(allLabels)
label.new(bar_index, close, str.tostring(labelCount))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('PSV6-DRAWING-INTEGRATION: Drawing Function Integration', () => {
    
    it('should validate comprehensive drawing with all types', () => {
      const code = `
//@version=6
indicator("All Drawings")

// Box
myBox = box.new(bar_index-20, high, bar_index-10, low, border_color=color.blue, bgcolor=color.new(color.blue, 90))

// Line
myLine = line.new(bar_index-10, high[10], bar_index, high, color=color.red, width=2)

// Label
myLabel = label.new(bar_index, high, "Signal", style=label.style_label_down, color=color.green)

// Modify drawings
box.set_bgcolor(myBox, color.new(color.green, 80))
line.set_color(myLine, color.blue)
label.set_text(myLabel, "Updated Signal")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate drawing limit management', () => {
      const code = `
//@version=6
indicator("Drawing Limits", max_boxes_count=10, max_lines_count=50, max_labels_count=50)

var box[] boxes = array.new<box>()

if bar_index % 5 == 0
    // Clean up old boxes
    if array.size(boxes) >= 10
        oldBox = array.shift(boxes)
        box.delete(oldBox)
    
    // Create new box
    newBox = box.new(bar_index-5, high, bar_index, low)
    array.push(boxes, newBox)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Error Cases
  // ============================================================================

  describe('PSV6-DRAWING-ERRORS: Drawing Error Cases', () => {
    
    it('should warn on exceeding drawing limits', () => {
      const code = `
//@version=6
indicator("Too Many Drawings")

// Creating drawings on every bar (500+ per script run)
box.new(bar_index-1, high, bar_index, low)
line.new(bar_index-1, close[1], bar_index, close)
label.new(bar_index, high, str.tostring(bar_index))
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.message.toLowerCase().includes('limit') || w.message.toLowerCase().includes('drawing'))).toBe(true);
    });

    it('should error on using deleted drawing', () => {
      const code = `
//@version=6
indicator("Use After Delete")

myLine = line.new(bar_index-10, low[10], bar_index, low)
line.delete(myLine)
line.set_color(myLine, color.red)  // Error - using deleted line
      `;

      const result = createValidator().validate(code);
      // Should warn about use-after-delete
      expect(result.warnings.length + result.errors.length).toBeGreaterThan(0);
    });
  });
});

