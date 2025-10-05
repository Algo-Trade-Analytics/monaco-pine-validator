import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('Enum validation fix for chart.point variables in if blocks', () => {
  const validator = new EnhancedModularValidator();

  it('should not flag chart.point variables as undefined enum types in if blocks', () => {
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

// Test the specific issue from the original script
if barstate.islast
    Camera cam = Camera.new(0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
    Point3D top = Point3D.new(0, 0, 0)
    float flagPoleH = 350
    int nSyms = 5

    // These lines were causing PSV6-ENUM-UNDEFINED-TYPE errors
    if nSyms > 0
        chart.point summitScreenPoint = cam.project(Point3D.new(top.x, top.y, top.z + flagPoleH))
        chart.point baseScreenPoint   = cam.project(Point3D.new(top.x, top.y, 0))
        float yScreenMax = summitScreenPoint.price, float yScreenMin = baseScreenPoint.price
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle chart.point property access in if blocks', () => {
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

if barstate.islast
    Camera cam = Camera.new(0, 0)
    Point3D top = Point3D.new(0, 0, 0)
    
    chart.point summitScreenPoint = cam.project(top)
    chart.point baseScreenPoint = cam.project(Point3D.new(0, 0, 0))
    
    // Test property access
    float yMax = summitScreenPoint.price
    float yMin = baseScreenPoint.price
    int xMax = summitScreenPoint.index
    int xMin = baseScreenPoint.index
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle nested if blocks with chart.point variables', () => {
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

if barstate.islast
    Camera cam = Camera.new(0, 0)
    Point3D top = Point3D.new(0, 0, 0)
    
    if true
        chart.point summitScreenPoint = cam.project(top)
        chart.point baseScreenPoint = cam.project(Point3D.new(0, 0, 0))
        
        if true
            float yMax = summitScreenPoint.price
            float yMin = baseScreenPoint.price
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle chart.point variables in for loops', () => {
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

if barstate.islast
    Camera cam = Camera.new(0, 0)
    array<Point3D> points = array.new<Point3D>()
    
    for i = 0 to 5
        Point3D p = Point3D.new(i, i, i)
        chart.point cp = cam.project(p)
        float price = cp.price
        int index = cp.index
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle chart.point variables in while loops', () => {
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

if barstate.islast
    Camera cam = Camera.new(0, 0)
    int i = 0
    
    while i < 5
        Point3D p = Point3D.new(i, i, i)
        chart.point cp = cam.project(p)
        float price = cp.price
        i += 1
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle chart.point variables in switch statements', () => {
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

if barstate.islast
    Camera cam = Camera.new(0, 0)
    Point3D top = Point3D.new(0, 0, 0)
    
    switch "1"
        "1" =>
            chart.point summitScreenPoint = cam.project(top)
            float price = summitScreenPoint.price
        "2" =>
            chart.point baseScreenPoint = cam.project(Point3D.new(0, 0, 0))
            int index = baseScreenPoint.index
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should still validate actual enum references correctly', () => {
    const script = `
//@version=6
indicator("Test")

enum TestEnum
    VALUE1
    VALUE2

// Valid enum usage
TestEnum val = TestEnum.VALUE1

// Invalid enum usage should still be caught
TestEnum invalid = TestEnum.INVALID_VALUE
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('PSV6-ENUM-UNDEFINED-VALUE');
  });

  it('should handle chart.point variables with UDT properties', () => {
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

if barstate.islast
    Camera cam = Camera.new(0, 0)
    Point3D top = Point3D.new(0, 0, 0)
    
    chart.point summitScreenPoint = cam.project(top)
    
    // Test that UDT properties are still accessible
    float x = top.x
    float y = top.y
    float z = top.z
    
    // Test that chart.point properties are accessible
    float price = summitScreenPoint.price
    int index = summitScreenPoint.index
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
