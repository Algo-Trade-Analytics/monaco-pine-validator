/**
 * Chart Functions Validation Tests (TDD)
 * 
 * PHASE 3 - MEDIUM PRIORITY
 * Coverage Gap: 0% (4/4 functions untested)
 * 
 * Following TDD: These tests are written FIRST and will initially FAIL
 * until the Chart Validator is created.
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../..';

describe('Chart Functions Validation (TDD)', () => {
  const createValidator = () => new EnhancedModularValidator({
    version: '6',
    scriptType: 'indicator',
    strictMode: true,
    enableWarnings: true
  });

  // ============================================================================
  // Category 1: chart.point.* Functions
  // ============================================================================

  describe('PSV6-CHART-POINT: Chart Point Functions', () => {
    
    it('should validate chart.point.new()', () => {
      const code = `
//@version=6
indicator("Chart Point")

var chartPoint = chart.point.new(time, high)
plot(chartPoint.index)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate chart.point.now()', () => {
      const code = `
//@version=6
indicator("Chart Point Now")

currentPoint = chart.point.now(high)
plot(currentPoint.price)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate chart.point.from_index()', () => {
      const code = `
//@version=6
indicator("Chart Point From Index")

point = chart.point.from_index(100, high)
plot(point.price)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate chart.point.from_time()', () => {
      const code = `
//@version=6
indicator("Chart Point From Time")

point = chart.point.from_time(timestamp(2024, 1, 1, 0, 0), close)
plot(point.price)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate chart.point with drawing functions', () => {
      const code = `
//@version=6
indicator("Chart Point with Drawing")

point1 = chart.point.now(high)
point2 = chart.point.now(low)

line.new(point1, point2)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid chart.point parameters', () => {
      const code = `
//@version=6
indicator("Invalid Chart Point")

// Missing required price parameter
point = chart.point.new(time)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code?.includes('CHART') || e.code?.includes('PARAM'))).toBe(true);
    });
  });

  // ============================================================================
  // Category 2: Integration Tests
  // ============================================================================

  describe('PSV6-CHART-INTEGRATION: Chart Point Integration', () => {
    
    it('should validate chart.point with polyline', () => {
      const code = `
//@version=6
indicator("Chart Point Polyline")

var polyline pl = na

if bar_index % 10 == 0
    points = array.new<chart.point>()
    array.push(points, chart.point.now(high))
    array.push(points, chart.point.now(low))
    pl := polyline.new(points)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate chart.point with line.new()', () => {
      const code = `
//@version=6
indicator("Chart Point Line")

if bar_index == 50
    p1 = chart.point.from_index(bar_index - 10, high[10])
    p2 = chart.point.now(low)
    line.new(p1, p2, color=color.blue, width=2)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate chart.point properties access', () => {
      const code = `
//@version=6
indicator("Chart Point Properties")

point = chart.point.now(close)

// Access properties
timeVal = point.time
indexVal = point.index
priceVal = point.price

plot(priceVal)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate chart.point type in array', () => {
      const code = `
//@version=6
indicator("Chart Point Array")

points = array.new<chart.point>()
array.push(points, chart.point.now(high))
array.push(points, chart.point.now(low))

firstPoint = array.get(points, 0)
plot(firstPoint.price)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on type mismatch in chart.point array', () => {
      const code = `
//@version=6
indicator("Chart Point Type Error")

points = array.new<chart.point>()
array.push(points, 123)  // Should error - wrong type
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.toLowerCase().includes('type'))).toBe(true);
    });
  });

  // ============================================================================
  // Category 3: Best Practices
  // ============================================================================

  describe('PSV6-CHART-BEST-PRACTICES: Chart Point Best Practices', () => {
    
    it('should warn on excessive chart.point creation', () => {
      const code = `
//@version=6
indicator("Excessive Chart Points")

// Creating chart points on every bar (500+ per run)
point = chart.point.now(close)
line.new(chart.point.from_index(bar_index-1, close[1]), point)
      `;

      const result = createValidator().validate(code);
      // Should warn about performance/drawing limits
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should validate proper chart.point cleanup pattern', () => {
      const code = `
//@version=6
indicator("Chart Point Cleanup")

var array<chart.point> points = array.new<chart.point>()

// Add point with size limit
if array.size(points) > 100
    array.shift(points)
    
array.push(points, chart.point.now(close))
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

