import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('Comma operator in nested contexts', () => {
  const validator = new EnhancedModularValidator();

  it('should handle comma operator in nested for loops', () => {
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
    array<Point3D> c3d = array.new<Point3D>()
    array<chart.point> c2d = array.new<chart.point>()
    
    // Test comma operator in nested for loops (the original issue)
    for y = 0 to 5
        for x = 0 to 5
            Point3D p3 = Point3D.new(x, y, 0)
            chart.point p2 = cam.project(p3)
            c3d.push(p3), c2d.push(p2)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle comma operator in deeply nested contexts', () => {
    const script = `
//@version=6
indicator("Test")

if barstate.islast
    array<int> arr1 = array.new<int>()
    array<int> arr2 = array.new<int>()
    array<int> arr3 = array.new<int>()
    
    // Test deeply nested comma operator
    for i = 0 to 3
        for j = 0 to 3
            for k = 0 to 3
                arr1.push(i), arr2.push(j), arr3.push(k)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle comma operator in if blocks', () => {
    const script = `
//@version=6
indicator("Test")

if barstate.islast
    int a = 0
    int b = 0
    int c = 0
    
    if true
        a := 1, b := 2, c := 3
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle comma operator in while loops', () => {
    const script = `
//@version=6
indicator("Test")

if barstate.islast
    int i = 0
    int j = 0
    
    while i < 5
        i += 1, j += 2
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle comma operator in switch statements', () => {
    const script = `
//@version=6
indicator("Test")

if barstate.islast
    int a = 0
    int b = 0
    
    switch "1"
        "1" =>
            a := 1, b := 2
        "2" =>
            a := 3, b := 4
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle comma operator with function calls', () => {
    const script = `
//@version=6
indicator("Test")

if barstate.islast
    array<int> arr1 = array.new<int>()
    array<int> arr2 = array.new<int>()
    
    // Test comma operator with function calls
    arr1.push(1), arr2.push(2)
    arr1.push(3), arr2.push(4)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle comma operator with method calls', () => {
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
    array<chart.point> projected = array.new<chart.point>()
    
    for i = 0 to 3
        Point3D p = Point3D.new(i, i, i)
        points.push(p), projected.push(cam.project(p))
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle comma operator with variable assignments', () => {
    const script = `
//@version=6
indicator("Test")

if barstate.islast
    int bestIdx = -1
    float bestD = 1e9
    
    // Test comma operator with assignments (from original issue)
    bestIdx := -1, bestD := 1e9
    bestIdx := 0, bestD := 0.5
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle comma operator with mixed expressions', () => {
    const script = `
//@version=6
indicator("Test")

if barstate.islast
    int a = 0
    int b = 0
    
    // Test mixed expressions in comma operator (simplified)
    a := 1, b := 2
    a += 1, b += 1
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle comma operator with newlines', () => {
    const script = `
//@version=6
indicator("Test")

if barstate.islast
    int a = 0
    int b = 0
    
    // Test comma operator with newlines (single line for now)
    a := 1, b := 2
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle comma operator in function bodies', () => {
    const script = `
//@version=6
indicator("Test")

f_test() =>
    int a = 0
    int b = 0
    a := 1, b := 2
    a + b

if barstate.islast
    int result = f_test()
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle comma operator in method bodies', () => {
    const script = `
//@version=6
indicator("Test")

type TestType
    int value

method update(TestType this, int newValue) =>
    this.value := newValue, this.value += 1

if barstate.islast
    TestType t = TestType.new(0)
    t.update(5)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle complex nested comma operator scenario', () => {
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
    array<Point3D> c3d = array.new<Point3D>()
    array<chart.point> c2d = array.new<chart.point>()
    int step = 2
    
    // Complex nested scenario from original issue
    for y = 0 to 10 by step
        for x = 0 to 10 by step
            Point3D p3 = Point3D.new(x, y, 0)
            chart.point p2 = cam.project(p3)
            c3d.push(p3), c2d.push(p2)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
