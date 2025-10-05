import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('Namespace validation in type annotation contexts', () => {
  const validator = new EnhancedModularValidator();

  it('should accept chart.point in type annotation contexts', () => {
    const script = `
//@version=6
indicator("Test")

// chart.point in type annotations should be valid
chart.point p1 = chart.point.from_index(bar_index, close)
chart.point p2 = chart.point.new(time, high)

// Array of chart.point
array<chart.point> points = array.new<chart.point>()

// Variable declaration with chart.point type
chart.point summitPoint = chart.point.from_index(0, 0)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept matrix types in type annotation contexts', () => {
    const script = `
//@version=6
indicator("Test")

type Point3D
    float x
    float y
    float z

// matrix types in type annotations should be valid
matrix<float> m1 = matrix.new<float>(2, 2, 1.0)
matrix<Point3D> m2 = matrix.new<Point3D>(3, 3, Point3D.new(0, 0, 0))

// Variable declaration with matrix type
matrix<float> data = matrix.new<float>(10, 10, 0.0)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept map types in type annotation contexts', () => {
    const script = `
//@version=6
indicator("Test")

// map types in type annotations should be valid
map<string, float> m1 = map.new<string, float>()
map<int, bool> m2 = map.new<int, bool>()

// Variable declaration with map type
map<string, color> colorMap = map.new<string, color>()

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept array types in type annotation contexts', () => {
    const script = `
//@version=6
indicator("Test")

type Point3D
    float x
    float y
    float z

// array types in type annotations should be valid
array<float> arr1 = array.new<float>()
array<Point3D> arr2 = array.new<Point3D>()
array<chart.point> arr3 = array.new<chart.point>()

// Variable declaration with array type
array<string> messages = array.new<string>()

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept built-in types in type annotation contexts', () => {
    const script = `
//@version=6
indicator("Test")

// Built-in types in type annotations should be valid
color bg = color.new(color.white, 50)
size labelSize = size.normal

// Variable declarations with built-in types
color primaryColor = color.red
size fontSize = size.small

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept UDT types in type annotation contexts', () => {
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

// UDT types in type annotations should be valid
Point3D p = Point3D.new(1, 2, 3)
Camera cam = Camera.new(0, 0)

// Variable declarations with UDT types
Point3D origin = Point3D.new(0, 0, 0)
Camera mainCamera = Camera.new(100, 50)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept enum types in type annotation contexts', () => {
    const script = `
//@version=6
indicator("Test")

enum ColorScheme
    RAINBOW
    FIRE
    ICE

enum MarkerSize
    TINY
    SMALL
    NORMAL

// enum types in type annotations should be valid
ColorScheme scheme = ColorScheme.RAINBOW
MarkerSize size = MarkerSize.NORMAL

// Variable declarations with enum types
ColorScheme currentScheme = ColorScheme.FIRE
MarkerSize currentSize = MarkerSize.SMALL

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept nested namespace types in type annotation contexts', () => {
    const script = `
//@version=6
indicator("Test")

// Nested namespace types should be valid
chart.point summitPoint = chart.point.from_index(0, 0)
chart.point basePoint = chart.point.new(time, low)

// Variable declarations with nested namespace types
chart.point currentPoint = chart.point.from_index(bar_index, close)
chart.point targetPoint = chart.point.new(time + 86400000, high)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept complex generic types in type annotation contexts', () => {
    const script = `
//@version=6
indicator("Test")

type Point3D
    float x
    float y
    float z

// Complex generic types should be valid
array<chart.point> points = array.new<chart.point>()
matrix<Point3D> matrix3D = matrix.new<Point3D>(2, 2, Point3D.new(0, 0, 0))
map<string, chart.point> pointMap = map.new<string, chart.point>()

// Variable declarations with complex generic types
array<matrix<float>> matrixArray = array.new<matrix<float>>()
map<chart.point, color> colorMap = map.new<chart.point, color>()

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept namespace types in function parameters', () => {
    const script = `
//@version=6
indicator("Test")

// Function parameters with namespace types should be valid
f_processPoint(chart.point p) =>
    p

f_processMatrix(matrix<float> m) =>
    matrix.rows(m)

f_processMap(map<string, float> m) =>
    map.size(m)

// Test function calls
if barstate.islast
    chart.point p = chart.point.from_index(0, 0)
    matrix<float> m = matrix.new<float>(2, 2, 1.0)
    map<string, float> mapData = map.new<string, float>()
    
    chart.point result1 = f_processPoint(p)
    int result2 = f_processMatrix(m)
    int result3 = f_processMap(mapData)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept namespace types in method parameters', () => {
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

// Method parameters with namespace types should be valid
method project(Camera this, Point3D p) =>
    chart.point.from_index(0, 0)

method transform(Camera this, matrix<float> m) =>
    m

// Test method calls
if barstate.islast
    Camera cam = Camera.new(0, 0)
    Point3D p = Point3D.new(1, 2, 3)
    matrix<float> m = matrix.new<float>(2, 2, 1.0)
    
    chart.point result1 = cam.project(p)
    matrix<float> result2 = cam.transform(m)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept namespace types in return types', () => {
    const script = `
//@version=6
indicator("Test")

type Point3D
    float x
    float y
    float z

// Return types with namespace types should be valid
f_getPoint() => chart.point.from_index(0, 0)
f_getMatrix() => matrix.new<float>(2, 2, 1.0)
f_getMap() => map.new<string, float>()
f_getArray() => array.new<Point3D>()

// Test function calls
if barstate.islast
    chart.point p = f_getPoint()
    matrix<float> m = f_getMatrix()
    map<string, float> mapData = f_getMap()
    array<Point3D> arr = f_getArray()

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept namespace types in conditional expressions', () => {
    const script = `
//@version=6
indicator("Test")

// Conditional expressions with namespace types should be valid
chart.point p = true ? chart.point.from_index(0, 0) : chart.point.new(time, close)
color c = close > open ? color.green : color.red
array<float> arr = true ? array.new<float>() : array.new<float>()

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept namespace types in switch expressions', () => {
    const script = `
//@version=6
indicator("Test")

enum ColorScheme
    RAINBOW
    FIRE
    ICE

// Switch expressions with namespace types should be valid
ColorScheme scheme = ColorScheme.RAINBOW
color c = switch scheme
    ColorScheme.RAINBOW => color.yellow
    ColorScheme.FIRE => color.red
    => color.blue

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should still validate namespace members in non-type contexts', () => {
    const script = `
//@version=6
indicator("Test")

// This should still generate an error for invalid namespace member
invalid.nonexistent.member = 42

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.code === 'PSV6-UNDEFINED-NAMESPACE-MEMBER')).toBe(true);
  });

  it('should handle namespace types in complex nested contexts', () => {
    const script = `
//@version=6
indicator("Test")

type Point3D
    float x
    float y
    float z

// Complex nested contexts with namespace types
if barstate.islast
    for i = 0 to 5
        chart.point p = chart.point.from_index(i, close)
        array<chart.point> points = array.new<chart.point>()
        matrix<float> m = matrix.new<float>(2, 2, 1.0)
        map<string, chart.point> pointMap = map.new<string, chart.point>()
        
        if true
            chart.point nested = chart.point.new(time, high)
            array<matrix<float>> matrixArray = array.new<matrix<float>>()

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
