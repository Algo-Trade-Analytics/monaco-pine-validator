/**
 * Color Utility Functions Validation Tests (TDD)
 * 
 * PHASE 9 - MEDIUM PRIORITY
 * Coverage Gap: 35% (15/43 color functions untested)
 * 
 * Following TDD: These tests are written FIRST and will initially FAIL
 * until the Color Functions Validator is extended.
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../..';
import { ChevrotainAstService } from '../../core/ast/service';

describe('Color Utility Functions Validation (TDD)', () => {
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
  // Category 1: Color Creation
  // ============================================================================

  describe('PSV6-COLOR-CREATE: Color Creation Functions', () => {
    
    it('should validate color.new()', () => {
      const code = `
//@version=6
indicator("Color New")

baseColor = color.blue
transparentBlue = color.new(baseColor, 80)
plot(close, color=transparentBlue)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate color.rgb()', () => {
      const code = `
//@version=6
indicator("Color RGB")

customColor = color.rgb(255, 100, 50)
plot(close, color=customColor)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate color.rgb() with transparency', () => {
      const code = `
//@version=6
indicator("Color RGBA")

customColor = color.rgb(255, 100, 50, 75)
plot(close, color=customColor)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate color.from_gradient()', () => {
      const code = `
//@version=6
indicator("Color Gradient")

value = close - ta.sma(close, 20)
minVal = ta.lowest(value, 100)
maxVal = ta.highest(value, 100)

gradientColor = color.from_gradient(value, minVal, maxVal, color.red, color.green)
plot(value, color=gradientColor)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 2: Color Extraction
  // ============================================================================

  describe('PSV6-COLOR-EXTRACT: Color Component Extraction', () => {
    
    it('should validate color.r()', () => {
      const code = `
//@version=6
indicator("Extract Red")

customColor = color.rgb(200, 100, 50)
redValue = color.r(customColor)
plot(redValue)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate color.g()', () => {
      const code = `
//@version=6
indicator("Extract Green")

customColor = color.rgb(200, 100, 50)
greenValue = color.g(customColor)
plot(greenValue)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate color.b()', () => {
      const code = `
//@version=6
indicator("Extract Blue")

customColor = color.rgb(200, 100, 50)
blueValue = color.b(customColor)
plot(blueValue)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate color.t()', () => {
      const code = `
//@version=6
indicator("Extract Transparency")

customColor = color.new(color.blue, 80)
transparency = color.t(customColor)
plot(transparency)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate extracting all color components', () => {
      const code = `
//@version=6
indicator("Extract All Components")

customColor = color.rgb(200, 100, 50, 75)
r = color.r(customColor)
g = color.g(customColor)
b = color.b(customColor)
t = color.t(customColor)

// Reconstruct color
reconstructed = color.rgb(r, g, b, t)
plot(close, color=reconstructed)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 3: Built-in Colors
  // ============================================================================

  describe('PSV6-COLOR-BUILTIN: Built-in Color Constants', () => {
    
    it('should validate basic color constants', () => {
      const code = `
//@version=6
indicator("Basic Colors")

plot(close, "Red", color=color.red)
plot(close, "Green", color=color.green)
plot(close, "Blue", color=color.blue)
plot(close, "Yellow", color=color.yellow)
plot(close, "Orange", color=color.orange)
plot(close, "Purple", color=color.purple)
plot(close, "Aqua", color=color.aqua)
plot(close, "White", color=color.white)
plot(close, "Black", color=color.black)
plot(close, "Gray", color=color.gray)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate extended color constants', () => {
      const code = `
//@version=6
indicator("Extended Colors")

plot(close, "Lime", color=color.lime)
plot(close, "Fuchsia", color=color.fuchsia)
plot(close, "Maroon", color=color.maroon)
plot(close, "Navy", color=color.navy)
plot(close, "Olive", color=color.olive)
plot(close, "Teal", color=color.teal)
plot(close, "Silver", color=color.silver)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 4: Dynamic Color Generation
  // ============================================================================

  describe('PSV6-COLOR-DYNAMIC: Dynamic Color Generation', () => {
    
    it('should validate conditional color selection', () => {
      const code = `
//@version=6
indicator("Conditional Color")

bullish = close > open
barColor = bullish ? color.green : color.red
plot(close, color=barColor)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ternary color with transparency', () => {
      const code = `
//@version=6
indicator("Ternary Color Transparency")

strong = math.abs(close - open) > ta.atr(14)
barColor = strong ? color.new(color.green, 0) : color.new(color.green, 70)
plot(close, color=barColor)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate gradient based on RSI', () => {
      const code = `
//@version=6
indicator("RSI Gradient")

rsi = ta.rsi(close, 14)
rsiColor = color.from_gradient(rsi, 0, 100, color.red, color.green)
plot(rsi, color=rsiColor)
hline(50, "Midline", color=color.gray)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate volume-based color intensity', () => {
      const code = `
//@version=6
indicator("Volume Color Intensity")

volRatio = volume / ta.sma(volume, 20)
transparency = math.max(0, math.min(90, 100 - (volRatio * 50)))
volumeColor = color.new(color.blue, transparency)
plot(close, color=volumeColor)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 5: Color Manipulation
  // ============================================================================

  describe('PSV6-COLOR-MANIPULATE: Color Manipulation', () => {
    
    it('should validate adjusting transparency dynamically', () => {
      const code = `
//@version=6
indicator("Dynamic Transparency")

baseColor = color.blue
distance = math.abs(close - ta.sma(close, 20))
maxDistance = ta.stdev(close, 20) * 2
transparency = int(math.min(95, (distance / maxDistance) * 100))

dynamicColor = color.new(baseColor, transparency)
plot(close, color=dynamicColor)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate color mixing with RGB', () => {
      const code = `
//@version=6
indicator("Color Mixing")

// Extract components from two colors
r1 = color.r(color.red)
g1 = color.g(color.red)
b1 = color.b(color.red)

r2 = color.r(color.blue)
g2 = color.g(color.blue)
b2 = color.b(color.blue)

// Mix 50/50
mixedColor = color.rgb((r1 + r2) / 2, (g1 + g2) / 2, (b1 + b2) / 2)
plot(close, color=mixedColor)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('PSV6-COLOR-INTEGRATION: Color Integration Tests', () => {
    
    it('should validate comprehensive color scheme', () => {
      const code = `
//@version=6
indicator("Comprehensive Color Scheme", overlay=true)

// Trend colors
sma20 = ta.sma(close, 20)
sma50 = ta.sma(close, 50)
bullishTrend = sma20 > sma50
trendColor = bullishTrend ? color.new(color.green, 70) : color.new(color.red, 70)

// Volume colors
volColor = volume > ta.sma(volume, 20) ? color.new(color.blue, 60) : color.new(color.blue, 90)

// RSI gradient
rsi = ta.rsi(close, 14)
rsiColor = color.from_gradient(rsi, 0, 100, color.red, color.green)

// Candle colors
candleColor = close > open ? color.green : color.red

// Background
bgcolor(trendColor)
plot(sma20, "SMA20", color=color.orange)
plot(sma50, "SMA50", color=color.purple)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate heatmap color generation', () => {
      const code = `
//@version=6
indicator("Heatmap Colors")

// Calculate momentum strength (0-100)
momentum = ta.rsi(close, 14)

// Create 5-color heatmap: dark red -> red -> yellow -> light green -> dark green
var color[] heatmapColors = array.from(
     color.rgb(139, 0, 0),    // Dark red
     color.rgb(255, 0, 0),    // Red
     color.rgb(255, 255, 0),  // Yellow
     color.rgb(144, 238, 144), // Light green
     color.rgb(0, 100, 0))    // Dark green

// Map momentum to color index
index = math.floor((momentum / 100) * 4)
heatColor = array.get(heatmapColors, math.min(4, math.max(0, index)))

plot(momentum, color=heatColor, linewidth=3)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate color-coded signals', () => {
      const code = `
//@version=6
indicator("Color Signals", overlay=true)

// Define signal strength (0-5)
var int signalStrength = 0

if ta.crossover(close, ta.sma(close, 20))
    signalStrength := 5  // Very strong
else if close > ta.sma(close, 20)
    signalStrength := 3  // Moderate
else
    signalStrength := 1  // Weak

// Color based on strength
signalColor = 
     signalStrength == 5 ? color.new(color.green, 0) :
     signalStrength == 4 ? color.new(color.green, 20) :
     signalStrength == 3 ? color.new(color.green, 50) :
     signalStrength == 2 ? color.new(color.orange, 50) :
     color.new(color.red, 50)

bgcolor(signalColor)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Error Cases
  // ============================================================================

  describe('PSV6-COLOR-ERRORS: Color Error Cases', () => {
    
    it('should error on invalid RGB values (out of range)', () => {
      const code = `
//@version=6
indicator("Invalid RGB")

invalidColor = color.rgb(300, 100, 50)  // Red > 255
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should error on negative RGB values', () => {
      const code = `
//@version=6
indicator("Negative RGB")

invalidColor = color.rgb(-10, 100, 50)  // Negative red
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should error on invalid transparency range', () => {
      const code = `
//@version=6
indicator("Invalid Transparency")

invalidColor = color.new(color.blue, 150)  // Transparency > 100
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should error on undefined color constant', () => {
      const code = `
//@version=6
indicator("Undefined Color")

invalidColor = color.invalid  // Not a real color constant
plot(close, color=invalidColor)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn on using string for color parameter', () => {
      const code = `
//@version=6
indicator("String Color")

plot(close, color="blue")  // Should use color.blue, not string
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.toLowerCase().includes('type') || e.message.toLowerCase().includes('color'))).toBe(true);
    });
  });

  // ============================================================================
  // Best Practices
  // ============================================================================

  describe('PSV6-COLOR-BEST-PRACTICES: Color Best Practices', () => {
    
    it('should validate using color constants for consistency', () => {
      const code = `
//@version=6
indicator("Color Constants")

// Good: Use built-in constants
bullColor = color.green
bearColor = color.red

plot(close, color=close > open ? bullColor : bearColor)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate defining color variables for reusability', () => {
      const code = `
//@version=6
indicator("Color Variables")

// Define theme colors
var color themeUpColor = color.new(color.green, 20)
var color themeDownColor = color.new(color.red, 20)
var color themeNeutralColor = color.new(color.gray, 50)

// Use throughout script
plot(ta.sma(close, 20), color=themeUpColor)
plot(ta.sma(close, 50), color=themeNeutralColor)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate accessibility-friendly color choices', () => {
      const code = `
//@version=6
indicator("Accessible Colors")

// Use sufficient contrast
bgColor = color.new(color.white, 95)
textColor = color.black
highlightColor = color.rgb(0, 120, 215)  // Accessible blue

bgcolor(bgColor)
plot(close, color=highlightColor, linewidth=2)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

