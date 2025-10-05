import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('Function Parameter Type Inference', () => {
  const validator = new EnhancedModularValidator();

  it('should accept untyped color parameter in function', () => {
    const code = `//@version=6
indicator("Untyped Color Test")

createColor(c, transp) =>
    color.new(c, transp)

myColor = createColor(color.blue, 50)
plot(close, color=myColor)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept untyped parameters with color.new', () => {
    const code = `//@version=6
indicator("Untyped Params Test")

GradientColor(c, size, max) =>
    factor = max > 0 ? size / max : 0.0
    transp = math.round(90 * (1 - factor) + 10 * factor)
    color.new(c, transp)

col = GradientColor(color.red, 50.0, 100.0)
plot(close, color=col)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept typed color parameter in function', () => {
    const code = `//@version=6
indicator("Typed Color Test")

createColor(color c, int transp) =>
    color.new(c, transp)

myColor = createColor(color.green, 30)
plot(close, color=myColor)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept series transparency in color.new', () => {
    const code = `//@version=6
indicator("Series Transparency Test")

dynamicColor(color baseColor, float factor) =>
    transp = math.round(50 * factor)
    color.new(baseColor, transp)

col = dynamicColor(color.blue, 0.5)
plot(close, color=col)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept math.round result as transparency', () => {
    const code = `//@version=6
indicator("Math Round Transparency Test")

getColor() =>
    baseTransp = 90
    maxTransp = 10
    factor = 0.5
    transp = math.round(baseTransp * (1 - factor) + maxTransp * factor)
    color.new(color.red, transp)

plot(close, color=getColor())`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept int cast for transparency', () => {
    const code = `//@version=6
indicator("Int Cast Transparency Test")

getColor(color c, float size, float max) =>
    factor = max > 0 ? size / max : 0.0
    transp = int(math.round(90 * (1 - factor) + 10 * factor))
    color.new(c, transp)

col = getColor(color.orange, 75.0, 100.0)
plot(close, color=col)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept complex gradient color function', () => {
    const code = `//@version=6
indicator("Complex Gradient Test")

GradientColorSingle(c, size, max) =>
    factor = max > 0 ? size / max : 0.0
    factor := math.min(1.0, math.max(0.0, factor))
    baseTransp = 90
    maxTransp = 10
    transp = math.round(baseTransp * (1 - factor) + maxTransp * factor)
    color.new(c, transp)

col1 = GradientColorSingle(color.blue, 25.0, 100.0)
col2 = GradientColorSingle(color.red, 75.0, 100.0)
plot(close, color=col1)
plot(open, color=col2)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept unknown type for array parameters', () => {
    const code = `//@version=6
indicator("Unknown Array Test")

processArray(arr) =>
    arr.push(close)
    arr.size()

myArray = array.new<float>()
size = processArray(myArray)
plot(size)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept unknown type for polyline parameters', () => {
    const code = `//@version=6
indicator("Unknown Polyline Test")

drawPoly(points) =>
    polyline.new(points, xloc=xloc.bar_time, line_color=color.blue)

pts = array.new<chart.point>()
pts.push(chart.point.from_index(0, close))
drawPoly(pts)
plot(close)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept mixed typed and untyped parameters', () => {
    const code = `//@version=6
indicator("Mixed Params Test")

createColorWithAlpha(baseColor, float alpha) =>
    transp = int(alpha * 100)
    color.new(baseColor, transp)

col = createColorWithAlpha(color.purple, 0.3)
plot(close, color=col)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
