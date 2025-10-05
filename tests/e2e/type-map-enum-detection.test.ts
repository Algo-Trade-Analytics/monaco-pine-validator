import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('TypeMap-based enum detection', () => {
  const validator = new EnhancedModularValidator();

  it('should not flag chart.point variables as enum types', () => {
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
    
    // These should not be flagged as enum types
    chart.point summitScreenPoint = cam.project(top)
    chart.point baseScreenPoint = cam.project(Point3D.new(0, 0, 0))
    
    // Property access should work
    float yMax = summitScreenPoint.price
    float yMin = baseScreenPoint.price
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should not flag UDT variables as enum types', () => {
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

if barstate.islast
    // These should not be flagged as enum types
    Point3D point = Point3D.new(0, 0, 0)
    Camera cam = Camera.new(0, 0)
    
    // Property access should work
    float x = point.x
    float y = point.y
    float z = point.z
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should not flag built-in type variables as enum types', () => {
    const script = `
//@version=6
indicator("Test")

if barstate.islast
    // These should not be flagged as enum types
    int myInt = 5
    float myFloat = 3.14
    bool myBool = true
    string myString = "hello"
    color myColor = color.red
    
    // Property access should work for color
    color newColor = color.new(myColor, 50)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should not flag array variables as enum types', () => {
    const script = `
//@version=6
indicator("Test")

type Point3D
    float x
    float y
    float z

if barstate.islast
    // These should not be flagged as enum types
    array<int> intArray = array.new<int>()
    array<Point3D> pointArray = array.new<Point3D>()
    array<chart.point> chartPointArray = array.new<chart.point>()
    
    // Method calls should work
    intArray.push(1)
    pointArray.push(Point3D.new(0, 0, 0))
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should not flag matrix variables as enum types', () => {
    const script = `
//@version=6
indicator("Test")

type Point3D
    float x
    float y
    float z

if barstate.islast
    // These should not be flagged as enum types
    matrix<int> intMatrix = matrix.new<int>(2, 2)
    matrix<Point3D> pointMatrix = matrix.new<Point3D>(2, 2)
    
    // Method calls should work
    intMatrix.set(0, 0, 1)
    pointMatrix.set(0, 0, Point3D.new(0, 0, 0))
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should not flag map variables as enum types', () => {
    const script = `
//@version=6
indicator("Test")

if barstate.islast
    // These should not be flagged as enum types
    map<string, int> stringIntMap = map.new<string, int>()
    map<int, bool> intBoolMap = map.new<int, bool>()
    
    // Method calls should work
    stringIntMap.put("key", 1)
    intBoolMap.put(1, true)
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
    VALUE3

if barstate.islast
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

  it('should handle enum variables correctly', () => {
    const script = `
//@version=6
indicator("Test")

enum TestEnum
    VALUE1
    VALUE2

if barstate.islast
    // Enum variables should work
    TestEnum myEnum = TestEnum.VALUE1
    
    // Enum comparison should work
    if myEnum == TestEnum.VALUE1
        int result = 1
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle mixed variable types in complex scenarios', () => {
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

enum TestEnum
    VALUE1
    VALUE2

if barstate.islast
    // Mix of different variable types
    Point3D point = Point3D.new(0, 0, 0)
    Camera cam = Camera.new(0, 0)
    chart.point cp = cam.project(point)
    array<Point3D> points = array.new<Point3D>()
    TestEnum enumVal = TestEnum.VALUE1
    
    // All should work without enum type errors
    float x = point.x
    float price = cp.price
    points.push(point)
    bool isValue1 = enumVal == TestEnum.VALUE1
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle variables in nested scopes', () => {
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
    
    if true
        Point3D point = Point3D.new(0, 0, 0)
        chart.point cp = cam.project(point)
        
        if true
            // Nested access should work
            float x = point.x
            float price = cp.price
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle variables in loops', () => {
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
        Point3D point = Point3D.new(i, i, i)
        chart.point cp = cam.project(point)
        
        // Loop variable access should work
        float x = point.x
        float price = cp.price
        points.push(point)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle variables in switch statements', () => {
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
    
    switch "1"
        "1" =>
            Point3D point = Point3D.new(0, 0, 0)
            chart.point cp = cam.project(point)
            float x = point.x
            float price = cp.price
        "2" =>
            Point3D point2 = Point3D.new(1, 1, 1)
            chart.point cp2 = cam.project(point2)
            float x2 = point2.x
            float price2 = cp2.price
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle variables in function parameters', () => {
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

f_processPoint(Point3D point, Camera cam) =>
    chart.point cp = cam.project(point)
    float x = point.x
    float price = cp.price
    x + price

if barstate.islast
    Camera cam = Camera.new(0, 0)
    Point3D point = Point3D.new(0, 0, 0)
    float result = f_processPoint(point, cam)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
