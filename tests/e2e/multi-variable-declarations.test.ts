import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('Multi-variable declarations', () => {
  const validator = new EnhancedModularValidator();

  it('should handle simple multi-variable declarations with shared type', () => {
    const script = `
//@version=6
indicator("Test")

// Simple shared type
float a = 1.0, b = 2.0, c = 3.0
int x = 10, y = 20, z = 30

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multi-variable declarations with mixed types', () => {
    const script = `
//@version=6
indicator("Test")

// Mixed types - each variable gets its own type
int bestIdx = -1, float bestD = 1e9
string name = "test", bool active = true

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multi-variable declarations with var keyword', () => {
    const script = `
//@version=6
indicator("Test")

var float a = 1.0, b = 2.0
var int counter = 0, step = 1

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multi-variable declarations with assignment operator', () => {
    const script = `
//@version=6
indicator("Test")

float a = 1.0, b = 2.0
int x = 10, y = 20

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multi-variable declarations with generic types', () => {
    const script = `
//@version=6
indicator("Test")

type Point3D
    float x
    float y
    float z

// Generic types in multi-variable declarations
array<Point3D> points1 = array.new<Point3D>(), points2 = array.new<Point3D>()
array<float> values = array.new<float>(), weights = array.new<float>()

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multi-variable declarations inside if blocks', () => {
    const script = `
//@version=6
indicator("Test")

if barstate.islast
    float a = 1.0, b = 2.0
    int x = 10, y = 20
    
    if true
        string name = "test", bool active = true

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multi-variable declarations inside for loops', () => {
    const script = `
//@version=6
indicator("Test")

for i = 0 to 5
    float a = float(i), b = float(i * 2)
    int x = i, y = i + 1

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multi-variable declarations with complex expressions', () => {
    const script = `
//@version=6
indicator("Test")

// Complex expressions in initializers
float a = math.sin(1.0), b = math.cos(2.0)
int x = ta.rsi(close, 14), y = ta.sma(close, 20)
string msg = "Price: " + str.tostring(close), prefix = "Indicator"

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multi-variable declarations with method calls', () => {
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
    Point3D p1 = Point3D.new(1, 2, 3), p2 = Point3D.new(4, 5, 6)
    Camera cam1 = Camera.new(0, 0), cam2 = Camera.new(10, 10)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multi-variable declarations with trailing decimals', () => {
    const script = `
//@version=6
indicator("Test")

// Trailing decimals in multi-variable declarations
float a = 1., b = 2., c = 3.
int x = 10, y = 20, z = 30

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multi-variable declarations with scientific notation', () => {
    const script = `
//@version=6
indicator("Test")

// Scientific notation in multi-variable declarations
float a = 1e3, b = 2.5e-2, c = 3.14e6
int x = 1e2, y = 2e1, z = 3e0

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multi-variable declarations with na values', () => {
    const script = `
//@version=6
indicator("Test")

// na values in multi-variable declarations
float a = na, b = 1.0
int x = na, y = 10
string msg = na, prefix = "test"
bool active = na, enabled = true

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multi-variable declarations with color values', () => {
    const script = `
//@version=6
indicator("Test")

// Color values in multi-variable declarations
color c1 = color.red, c2 = color.blue
color bg = color.new(color.white, 50), fg = color.new(color.black, 0)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multi-variable declarations with matrix operations', () => {
    const script = `
//@version=6
indicator("Test")

// Matrix operations in multi-variable declarations
matrix<float> m1 = matrix.new<float>(2, 2, 1.0), m2 = matrix.new<float>(2, 2, 2.0)
int rows = matrix.rows(m1), cols = matrix.columns(m2)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multi-variable declarations with map operations', () => {
    const script = `
//@version=6
indicator("Test")

// Map operations in multi-variable declarations
map<string, float> m1 = map.new<string, float>(), m2 = map.new<string, float>()
int size1 = map.size(m1), size2 = map.size(m2)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multi-variable declarations with array operations', () => {
    const script = `
//@version=6
indicator("Test")

// Array operations in multi-variable declarations
array<float> arr1 = array.new<float>(), arr2 = array.new<float>()
int size1 = array.size(arr1), size2 = array.size(arr2)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multi-variable declarations with line breaks', () => {
    const script = `
//@version=6
indicator("Test")

// Multi-variable declarations with line breaks
float a = 1.0,
  b = 2.0,
  c = 3.0

int x = 10,
  y = 20,
  z = 30

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multi-variable declarations with compiler annotations', () => {
    const script = `
//@version=6
indicator("Test")

//@variable
float a = 1.0, b = 2.0

//@function
f_test() =>
    int x = 10, y = 20
    x + y

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
