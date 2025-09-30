/**
 * Constants & Enums Validation Tests (TDD)
 * 
 * PHASE 8 - LOW PRIORITY  
 * Coverage Gap: ~40% (100+ constants/enums untested)
 * 
 * Validates usage of built-in constants, enums, and their correct application.
 * 
 * Following TDD: These tests are written FIRST and will initially FAIL
 * until the Constants Validator is extended.
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../..';

describe('Constants & Enums Validation (TDD)', () => {
  const createValidator = () => new EnhancedModularValidator({
    version: '6',
    scriptType: 'indicator',
    strictMode: true,
    enableWarnings: true
  });

  // ============================================================================
  // Category 1: Position Constants
  // ============================================================================

  describe('PSV6-CONST-POSITION: Position Constants', () => {
    
    it('should validate position.* constants for table', () => {
      const code = `
//@version=6
indicator("Position Constants", overlay=true)

var table t = table.new(position.top_left, 2, 2)
table.cell(t, 0, 0, "Top Left")

var table t2 = table.new(position.top_right, 2, 2)
var table t3 = table.new(position.bottom_left, 2, 2)
var table t4 = table.new(position.bottom_right, 2, 2)
var table t5 = table.new(position.top_center, 2, 2)
var table t6 = table.new(position.bottom_center, 2, 2)
var table t7 = table.new(position.middle_left, 2, 2)
var table t8 = table.new(position.middle_right, 2, 2)
var table t9 = table.new(position.middle_center, 2, 2)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid position constant', () => {
      const code = `
//@version=6
indicator("Invalid Position")

var table t = table.new(position.invalid, 2, 2)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.toLowerCase().includes('position') || e.message.toLowerCase().includes('invalid'))).toBe(true);
    });
  });

  // ============================================================================
  // Category 2: xloc/yloc Constants
  // ============================================================================

  describe('PSV6-CONST-LOC: Location Constants', () => {
    
    it('should validate xloc.* constants', () => {
      const code = `
//@version=6
indicator("xloc Constants")

// Bar index location
line1 = line.new(bar_index-10, low[10], bar_index, low, xloc=xloc.bar_index)

// Time location
line2 = line.new(time[10], low[10], time, low, xloc=xloc.bar_time)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate yloc.* constants', () => {
      const code = `
//@version=6
indicator("yloc Constants", overlay=true)

label.new(bar_index, high, "Above", yloc=yloc.abovebar)
label.new(bar_index, low, "Below", yloc=yloc.belowbar)
label.new(bar_index, close, "Price", yloc=yloc.price)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 3: text.align Constants
  // ============================================================================

  describe('PSV6-CONST-TEXT-ALIGN: Text Alignment Constants', () => {
    
    it('should validate text.align_* constants', () => {
      const code = `
//@version=6
indicator("Text Align", overlay=true)

var table t = table.new(position.top_right, 3, 3)
table.cell(t, 0, 0, "Left", text_halign=text.align_left)
table.cell(t, 1, 0, "Center", text_halign=text.align_center)
table.cell(t, 2, 0, "Right", text_halign=text.align_right)

table.cell(t, 0, 1, "Top", text_valign=text.align_top)
table.cell(t, 1, 1, "Middle", text_valign=text.align_center)
table.cell(t, 2, 1, "Bottom", text_valign=text.align_bottom)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 4: size Constants
  // ============================================================================

  describe('PSV6-CONST-SIZE: Size Constants', () => {
    
    it('should validate size.* constants', () => {
      const code = `
//@version=6
indicator("Size Constants", overlay=true)

label.new(bar_index, high[0], "Auto", size=size.auto)
label.new(bar_index, high[1], "Tiny", size=size.tiny)
label.new(bar_index, high[2], "Small", size=size.small)
label.new(bar_index, high[3], "Normal", size=size.normal)
label.new(bar_index, high[4], "Large", size=size.large)
label.new(bar_index, high[5], "Huge", size=size.huge)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate size constants for table cells', () => {
      const code = `
//@version=6
indicator("Table Cell Size")

var table t = table.new(position.top_right, 1, 6)
table.cell(t, 0, 0, "Auto", text_size=size.auto)
table.cell(t, 0, 1, "Tiny", text_size=size.tiny)
table.cell(t, 0, 2, "Small", text_size=size.small)
table.cell(t, 0, 3, "Normal", text_size=size.normal)
table.cell(t, 0, 4, "Large", text_size=size.large)
table.cell(t, 0, 5, "Huge", text_size=size.huge)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 5: extend Constants
  // ============================================================================

  describe('PSV6-CONST-EXTEND: Line Extend Constants', () => {
    
    it('should validate extend.* constants', () => {
      const code = `
//@version=6
indicator("Extend Constants")

line.new(bar_index-10, high[10], bar_index, high, extend=extend.none)
line.new(bar_index-10, low[10], bar_index, low, extend=extend.right)
line.new(bar_index-10, close[10], bar_index, close, extend=extend.left)
line.new(bar_index-10, open[10], bar_index, open, extend=extend.both)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 6: line.style Constants
  // ============================================================================

  describe('PSV6-CONST-LINE-STYLE: Line Style Constants', () => {
    
    it('should validate line.style_* constants', () => {
      const code = `
//@version=6
indicator("Line Styles")

line.new(bar_index-10, high[10], bar_index, high, style=line.style_solid)
line.new(bar_index-10, low[10], bar_index, low, style=line.style_dotted)
line.new(bar_index-10, close[10], bar_index, close, style=line.style_dashed)
line.new(bar_index-10, open[10], bar_index, open, style=line.style_arrow_left)
line.new(bar_index-10, high[5], bar_index, high, style=line.style_arrow_right)
line.new(bar_index-10, low[5], bar_index, low, style=line.style_arrow_both)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 7: label.style Constants
  // ============================================================================

  describe('PSV6-CONST-LABEL-STYLE: Label Style Constants', () => {
    
    it('should validate label.style_* constants', () => {
      const code = `
//@version=6
indicator("Label Styles", overlay=true)

label.new(bar_index, high[0], "None", style=label.style_none)
label.new(bar_index, high[1], "Up", style=label.style_label_up)
label.new(bar_index, high[2], "Down", style=label.style_label_down)
label.new(bar_index, high[3], "Left", style=label.style_label_left)
label.new(bar_index, high[4], "Right", style=label.style_label_right)
label.new(bar_index, high[5], "Center", style=label.style_label_center)
label.new(bar_index, high[6], "Upper Left", style=label.style_label_upper_left)
label.new(bar_index, high[7], "Upper Right", style=label.style_label_upper_right)
label.new(bar_index, high[8], "Lower Left", style=label.style_label_lower_left)
label.new(bar_index, high[9], "Lower Right", style=label.style_label_lower_right)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate shape style constants', () => {
      const code = `
//@version=6
indicator("Shape Styles", overlay=true)

label.new(bar_index, high[0], style=label.style_circle)
label.new(bar_index, high[1], style=label.style_square)
label.new(bar_index, high[2], style=label.style_diamond)
label.new(bar_index, high[3], style=label.style_triangleup)
label.new(bar_index, high[4], style=label.style_triangledown)
label.new(bar_index, high[5], style=label.style_flag)
label.new(bar_index, high[6], style=label.style_cross)
label.new(bar_index, high[7], style=label.style_xcross)
label.new(bar_index, high[8], style=label.style_arrowup)
label.new(bar_index, high[9], style=label.style_arrowdown)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 8: plot.style Constants
  // ============================================================================

  describe('PSV6-CONST-PLOT-STYLE: Plot Style Constants', () => {
    
    it('should validate plot.style_* constants', () => {
      const code = `
//@version=6
indicator("Plot Styles")

plot(close, "Line", style=plot.style_line)
plot(close, "Stepline", style=plot.style_stepline)
plot(close, "Histogram", style=plot.style_histogram)
plot(close, "Cross", style=plot.style_cross)
plot(close, "Area", style=plot.style_area)
plot(close, "Columns", style=plot.style_columns)
plot(close, "Circles", style=plot.style_circles)
plot(close, "Line Break", style=plot.style_linebreak)
plot(close, "Step Line Diamond", style=plot.style_stepline_diamond)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 9: location Constants
  // ============================================================================

  describe('PSV6-CONST-LOCATION: Shape Location Constants', () => {
    
    it('should validate location.* constants', () => {
      const code = `
//@version=6
indicator("Location Constants", overlay=true)

plotshape(close > open, style=shape.triangleup, location=location.belowbar, color=color.green)
plotshape(close < open, style=shape.triangledown, location=location.abovebar, color=color.red)
plotshape(ta.cross(close, ta.sma(close, 20)), style=shape.circle, location=location.absolute)
plotshape(volume > ta.sma(volume, 20), style=shape.square, location=location.bottom)
plotshape(high == ta.highest(high, 20), style=shape.diamond, location=location.top)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 10: shape Constants
  // ============================================================================

  describe('PSV6-CONST-SHAPE: Shape Constants', () => {
    
    it('should validate shape.* constants', () => {
      const code = `
//@version=6
indicator("Shape Constants", overlay=true)

plotshape(true, style=shape.circle, location=location.belowbar)
plotshape(true, style=shape.square)
plotshape(true, style=shape.diamond)
plotshape(true, style=shape.triangleup)
plotshape(true, style=shape.triangledown)
plotshape(true, style=shape.flag)
plotshape(true, style=shape.cross)
plotshape(true, style=shape.xcross)
plotshape(true, style=shape.arrowup)
plotshape(true, style=shape.arrowdown)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 11: order.* Constants
  // ============================================================================

  describe('PSV6-CONST-ORDER: Order Constants', () => {
    
    it('should validate order.* constants', () => {
      const code = `
//@version=6
indicator("Order Constants")

arr = array.from(3, 1, 4, 2, 5)

// Ascending order
array.sort(arr, order.ascending)
plot(array.get(arr, 0))

// Descending order
array.sort(arr, order.descending)
plot(array.get(arr, 0))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 12: display Constants
  // ============================================================================

  describe('PSV6-CONST-DISPLAY: Display Constants', () => {
    
    it('should validate display.* constants', () => {
      const code = `
//@version=6
indicator("Display Constants")

plot(close, "All", display=display.all)
plot(close, "None", display=display.none)
plot(close, "Data Window", display=display.data_window)
plot(close, "Price Scale", display=display.pane)
plot(close, "Status Line", display=display.status_line)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('PSV6-CONST-INTEGRATION: Constants Integration', () => {
    
    it('should validate comprehensive constant usage', () => {
      const code = `
//@version=6
indicator("All Constants", overlay=true)

// Drawing constants
line.new(bar_index-10, high[10], bar_index, high, 
         xloc=xloc.bar_index,
         extend=extend.right,
         color=color.blue,
         style=line.style_dashed,
         width=2)

// Label constants
label.new(bar_index, high, "Signal",
          xloc=xloc.bar_index,
          yloc=yloc.abovebar,
          style=label.style_label_down,
          size=size.small,
          color=color.green,
          textcolor=color.white,
          textalign=text.align_center)

// Table constants
var table t = table.new(position.top_right, 2, 2)
table.cell(t, 0, 0, "Title",
           text_halign=text.align_center,
           text_valign=text.align_center,
           text_size=size.large)

// Plot constants
plot(close, style=plot.style_line, display=display.all)
plotshape(close > open, style=shape.triangleup, location=location.belowbar)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Error Cases
  // ============================================================================

  describe('PSV6-CONST-ERRORS: Constant Error Cases', () => {
    
    it('should error on undefined constant', () => {
      const code = `
//@version=6
indicator("Undefined Constant")

line.new(bar_index-10, high[10], bar_index, high, extend=extend.invalid)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should error on wrong constant namespace', () => {
      const code = `
//@version=6
indicator("Wrong Namespace")

// Using label.style for line
line.new(bar_index-10, high[10], bar_index, high, style=label.style_label_up)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should error on misspelled constant', () => {
      const code = `
//@version=6
indicator("Misspelled Constant")

var table t = table.new(position.top_centre, 2, 2)  // Should be top_center
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

