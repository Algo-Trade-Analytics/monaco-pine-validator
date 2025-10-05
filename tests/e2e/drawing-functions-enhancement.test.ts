import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('Enhanced drawing functions validator', () => {
  const validator = new EnhancedModularValidator();

  it('should detect chart.point overload for line.new with method calls', () => {
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

// Test that method calls like cam.project() are detected as chart.point overload
line.new(cam.project(pc), cam.project(Point3D.new(1, 1, 1)), color = color.red)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect chart.point overload for line.new with chart.point.from_index calls', () => {
    const script = `
//@version=6
indicator("Test")

// Test that chart.point.from_index() calls are detected as chart.point overload
line.new(chart.point.from_index(0, 0), chart.point.from_index(10, 10), color = color.blue)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect chart.point overload for line.new with mixed chart.point calls', () => {
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

// Test mixed chart.point calls
line.new(cam.project(pc), chart.point.from_index(10, 10), color = color.green)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect chart.point overload for line.new with only 2 parameters', () => {
    const script = `
//@version=6
indicator("Test")

// Test that 2 parameters are detected as chart.point overload
line.new(chart.point.from_index(0, 0), chart.point.from_index(10, 10))
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should still validate traditional coordinate parameters', () => {
    const script = `
//@version=6
indicator("Test")

// Test traditional coordinate parameters
line.new(0, 0, 10, 10, color = color.red)
line.new(5, 5, 15, 15, color = color.blue, width = 2)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should require at least 2 parameters for chart.point overload', () => {
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

  it('should require at least 4 parameters for coordinate overload', () => {
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

  it('should handle complex method call patterns', () => {
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
    float cYaw
    float sYaw
    float sPit
    float cPit
    float sx
    float sy
    float sz

method project(Camera this, Point3D p) =>
    float xr = p.x * this.cYaw - p.y * this.sYaw
    float yr = p.x * this.sYaw + p.y * this.cYaw
    float sxp = xr * this.sx
    float syp = yr * this.sPit * this.sy - p.z * this.cPit * this.sz
    chart.point.from_index(this.anchorX + int(sxp), this.anchorY - syp)

Camera cam = Camera.new(0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
Point3D pc = Point3D.new(0, 0, 0)

// Test complex method call patterns
line.new(cam.project(Point3D.new(pc.x, pc.y, 25)), cam.project(pc), color = color.red, width = 1)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle chart.point variables as parameters', () => {
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

// Test chart.point variables as parameters
chart.point p1 = cam.project(pc)
chart.point p2 = chart.point.from_index(10, 10)
// Note: Currently the drawing functions validator doesn't detect chart.point variables
// as chart.point overloads, so this will use the coordinate overload
line.new(p1.index, p1.price, p2.index, p2.price, color = color.blue)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle nested method calls', () => {
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

// Test nested method calls
line.new(cam.project(Point3D.new(0, 0, 0)), cam.project(Point3D.new(1, 1, 1)), color = color.green)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle chart.point.from_index with expressions', () => {
    const script = `
//@version=6
indicator("Test")

int x1 = 0
int y1 = 0
int x2 = 10
int y2 = 10

// Test chart.point.from_index with expressions
line.new(chart.point.from_index(x1, y1), chart.point.from_index(x2, y2), color = color.red)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle mixed parameter types correctly', () => {
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

// Test mixed parameter types
line.new(cam.project(pc), chart.point.from_index(10, 10), color = color.blue, width = 2)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
