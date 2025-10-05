import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('Comprehensive feature integration tests', () => {
  const validator = new EnhancedModularValidator();

  it('should handle complex script with all new features integrated', () => {
    const script = `
//@version=6
indicator("Comprehensive Feature Test", overlay=true)

// Enums
enum ColorScheme
    RAINBOW
    FIRE
    ICE

enum MarkerSize
    TINY
    SMALL
    NORMAL

// UDTs
type Point3D
    float x
    float y
    float z

type Camera
    int anchorX
    float anchorY

// Method with chart.point return
method project(Camera this, Point3D p) =>
    chart.point.from_index(0, 0)

// Multi-variable declarations with mixed types
ColorScheme scheme = ColorScheme.RAINBOW, MarkerSize size = MarkerSize.NORMAL
float scale = 1.0, float offset = 0.5, int iterations = 10

// Generic types in multi-variable declarations
array<Point3D> points3D = array.new<Point3D>(), points2D = array.new<chart.point>()
matrix<float> matrix1 = matrix.new<float>(2, 2, 1.0), matrix2 = matrix.new<float>(3, 3, 2.0)
map<string, color> colorMap = map.new<string, color>(), sizeMap = map.new<string, float>()

// String concatenation type inference
string statusMsg = "Status: " + str.tostring(close > open)
string infoMsg = "Price: " + str.tostring(close) + ", Volume: " + str.tostring(volume)

// Leading-dot decimals
float step = .05, precision = .001, threshold = .5

// Scientific notation
float large = 1e6, small = 2.5e-3, medium = 3.14e2

// Trailing decimals
float angle1 = 45., angle2 = 90., angle3 = 180.

// array.from() with mixed arguments
array<color> palette = array.from(#FF0000, color.new(color.green, 50), color.blue)
array<float> values = array.from(1.0, close, high, low, ta.rsi(close, 14))

// Input with leading-dot decimal
float inputStep = input.float(.01, "Step size", minval = .001, maxval = 1.0, step = .001)

// Complex nested logic with comma operator
if barstate.islast
    for y = 0 to 5
        for x = 0 to 5
            // Multi-variable declarations in nested loops
            float cx = float(x) * scale, float cy = float(y) * scale, float cz = math.sin(x / 4.) * math.cos(y / 6.)
            
            // Comma operator sequences
            Point3D p3d = Point3D.new(cx, cy, cz), chart.point p2d = chart.point.from_index(x, y)
            array.push(points3D, p3d), array.push(points2D, p2d)
            
            // String concatenation in nested context
            string pointMsg = "Point " + str.tostring(x) + "," + str.tostring(y) + ": " + str.tostring(cz)
            
            // Conditional with string concatenation
            string conditionMsg = cx > 0 ? "Positive X: " + str.tostring(cx) : "Negative X: " + str.tostring(cx)
            
            // Switch with enum
            color pointColor = switch scheme
                ColorScheme.RAINBOW => color.from_gradient(cx, 0, 5, color.red, color.blue)
                ColorScheme.FIRE => color.new(color.red, 50)
                => color.new(color.blue, 50)
            
            // Map operations
            string key = str.tostring(x) + "_" + str.tostring(y)
            map.put(colorMap, key, pointColor), map.put(sizeMap, key, float(size))
            
            // Matrix operations with trailing decimals
            if x < matrix.rows(matrix1) and y < matrix.columns(matrix1)
                matrix.set(matrix1, x, y, math.sin(x / 4.) * math.cos(y / 6.))

// Function with all feature types
f_processData(array<Point3D> points, matrix<float> data, map<string, color> colors) =>
    float total = 0.0, int count = 0
    for p in points
        total += p.x + p.y + p.z, count += 1
    
    string result = "Processed " + str.tostring(count) + " points, total: " + str.tostring(total)
    [result, total / float(count)]

// Test function call with complex arguments
if barstate.islast
    [message, avg] = f_processData(points3D, matrix1, colorMap)
    
    // line.new() with chart.point parameters
    if array.size(points2D) >= 2
        chart.point p1 = array.get(points2D, 0), chart.point p2 = array.get(points2D, 1)
        line.new(p1, p2, color = color.red, width = 2)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle edge cases with all features combined', () => {
    const script = `
//@version=6
indicator("Edge Cases Test")

type TestUDT
    float value
    string name

// Edge case: Very long multi-variable declaration
float a = 1., b = 2., c = 3., d = 4., e = 5., f = 6., g = 7., h = 8., i = 9., j = 10.

// Edge case: Scientific notation in arrays
array<float> sciValues = array.from(1e-10, 1e-5, 1e0, 1e5, 1e10)

// Edge case: Leading-dot decimals in complex expressions
float result = math.sin(.5) * math.cos(.25) + math.tan(.125)

// Edge case: String concatenation with all types
string complexString = "Float: " + 1.5 + ", Int: " + 42 + ", Bool: " + true + ", String: " + "test"

// Edge case: array.from() with maximum arguments
array<color> maxColors = array.from(
    #FF0000, #FF8000, #FFFF00, #80FF00, #00FF00, #00FF80, #00FFFF, #0080FF, #0000FF, #8000FF,
    color.red, color.green, color.blue, color.yellow, color.purple, color.orange, color.pink, color.cyan
)

// Edge case: Nested generic types
array<array<float>> nestedArray = array.new<array<float>>()
array<map<string, float>> arrayOfMaps = array.new<map<string, float>>()

// Edge case: Comma operator with function calls
if barstate.islast
    TestUDT udt1 = TestUDT.new(1.0, "first"), TestUDT udt2 = TestUDT.new(2.0, "second")
    array.push(nestedArray, array.from(1.0, 2.0, 3.0)), array.push(arrayOfMaps, map.new<string, float>())

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle performance-critical scenarios with new features', () => {
    const script = `
//@version=6
indicator("Performance Test")

type DataPoint
    float value
    int timestamp

// Performance: Large multi-variable declarations
float v1 = 1.0, v2 = 2.0, v3 = 3.0, v4 = 4.0, v5 = 5.0
float v6 = 6.0, v7 = 7.0, v8 = 8.0, v9 = 9.0, v10 = 10.0

// Performance: Large arrays with array.from()
array<float> performanceArray = array.from(
    1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0,
    11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0, 18.0, 19.0, 20.0
)

// Performance: Nested loops with comma operator
if barstate.islast
    for i = 0 to 10
        for j = 0 to 10
            // Multiple operations in comma sequence
            float x = float(i), float y = float(j), float z = math.sqrt(x * x + y * y)
            array.push(performanceArray, z), array.push(performanceArray, x + y)

// Performance: String concatenation in loops
if barstate.islast
    string logMessage = ""
    for i = 0 to 5
        logMessage += "Iteration " + str.tostring(i) + ": " + str.tostring(array.get(performanceArray, i)) + "\\n"

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle error recovery scenarios', () => {
    const script = `
//@version=6
indicator("Error Recovery Test")

// Valid code with new features
float a = 1.0, b = 2.0
string msg = "Test: " + str.tostring(a)
array<color> colors = array.from(color.red, color.green, color.blue)

// This should cause an error but not break parsing
invalid.function.call()

// More valid code after error
float c = 3.0, d = 4.0
string msg2 = "Recovery: " + str.tostring(c)

plot(close)
`;

    const result = validator.validate(script);
    // Should have errors but still parse successfully
    expect(result.errors.some(e => e.code === 'PSV6-UNDEFINED-NAMESPACE-MEMBER')).toBe(true);
  });

  it('should handle all input types with leading-dot decimals', () => {
    const script = `
//@version=6
indicator("Input Types Test")

// All input types with leading-dot decimals
float floatInput = input.float(.5, "Float", minval = .1, maxval = 10.0, step = .1)
int intInput = input.int(5, "Int", minval = 1, maxval = 100, step = 1)
bool boolInput = input.bool(true, "Bool")
string stringInput = input.string("test", "String")
color colorInput = input.color(color.red, "Color")
time timeInput = input.time(timestamp("2024-01-01"), "Time")
session sessionInput = input.session("0900-1600", "Session")

// Test that inputs work with new features
float result = floatInput + .25
string inputMsg = "Float: " + str.tostring(floatInput) + ", Int: " + str.tostring(intInput)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle all namespace types in type annotation contexts', () => {
    const script = `
//@version=6
indicator("Namespace Types Test")

// All built-in namespace types in type annotations
chart.point chartPoint = chart.point.from_index(0, 0)
color colorValue = color.new(color.red, 50)
size sizeValue = size.normal
style styleValue = style.line

// Generic namespace types
array<chart.point> pointArray = array.new<chart.point>()
matrix<float> floatMatrix = matrix.new<float>(2, 2, 1.0)
map<string, color> colorMap = map.new<string, color>()

// UDT with namespace types
type Container
    chart.point point
    color bgColor
    array<float> values

Container container = Container.new(chartPoint, colorValue, array.new<float>())

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
