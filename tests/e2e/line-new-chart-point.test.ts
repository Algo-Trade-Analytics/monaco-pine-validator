import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('line.new() with chart.point parameters', () => {
  const validator = new EnhancedModularValidator();

  it('should accept chart.point objects as parameters', () => {
    const script = `
//@version=6
indicator("Test")

type Point3D
    float x
    float y
    float z

type Camera
    int anchorX
    float anchorY

method project(Camera this, Point3D p) =>
    chart.point.from_index(0, 0)

Camera cam = Camera.new(0, 0)
Point3D pc = Point3D.new(0, 0, 0)
color peakFillColor = color.red

// Test line.new with chart.point parameters
line.new(cam.project(Point3D.new(pc.x, pc.y, 25)), cam.project(pc), color = peakFillColor, width = 1)
line.new(cam.project(pc), cam.project(Point3D.new(1, 1, 1)), color = color.blue)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept chart.point.from_index() calls', () => {
    const script = `
//@version=6
indicator("Test")

// Test line.new with chart.point.from_index() calls
line.new(chart.point.from_index(0, 0), chart.point.from_index(10, 10), color = color.red)
line.new(chart.point.from_index(5, 5), chart.point.from_index(15, 15), color = color.blue, width = 2)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept mixed chart.point and coordinate parameters', () => {
    const script = `
//@version=6
indicator("Test")

type Point3D
    float x
    float y
    float z

type Camera
    int anchorX
    float anchorY

method project(Camera this, Point3D p) =>
    chart.point.from_index(0, 0)

Camera cam = Camera.new(0, 0)
Point3D pc = Point3D.new(0, 0, 0)

// Test line.new with mixed parameters
line.new(cam.project(pc), chart.point.from_index(10, 10), color = color.green)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should still validate traditional coordinate parameters', () => {
    const script = `
//@version=6
indicator("Test")

// Test line.new with traditional coordinates
line.new(0, 0, 10, 10, color = color.red)
line.new(5, 5, 15, 15, color = color.blue, width = 2)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect chart.point overload correctly', () => {
    const script = `
//@version=6
indicator("Test")

type Point3D
    float x
    float y
    float z

type Camera
    int anchorX
    float anchorY

method project(Camera this, Point3D p) =>
    chart.point.from_index(0, 0)

Camera cam = Camera.new(0, 0)
Point3D pc = Point3D.new(0, 0, 0)

// Test that chart.point overload is detected even with method calls
line.new(cam.project(pc), cam.project(Point3D.new(1, 1, 1)))
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle line.new with only 2 chart.point parameters', () => {
    const script = `
//@version=6
indicator("Test")

// Test line.new with minimal chart.point parameters
line.new(chart.point.from_index(0, 0), chart.point.from_index(10, 10))
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should still require at least 2 parameters for chart.point overload', () => {
    const script = `
//@version=6
indicator("Test")

// Test insufficient parameters for chart.point overload
line.new(chart.point.from_index(0, 0))
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('PSV6-FUNCTION-PARAM-COUNT');
    expect(result.errors[0].message).toContain('line.new() with chart.point requires at least 2 parameters');
  });

  it('should still require at least 4 parameters for coordinate overload', () => {
    const script = `
//@version=6
indicator("Test")

// Test insufficient parameters for coordinate overload
line.new(0, 0, 10)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('PSV6-FUNCTION-PARAM-COUNT');
    expect(result.errors[0].message).toContain('line.new() requires at least 4 parameters (x1, y1, x2, y2)');
  });
});
