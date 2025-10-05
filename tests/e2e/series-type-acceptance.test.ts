import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('Series Type Acceptance for Int/Float Parameters', () => {
  const validator = new EnhancedModularValidator();

  it('should accept series value for int parameter', () => {
    const code = `//@version=6
indicator("Series Int Test")

calcValue(int value) =>
    value * 2

result = calcValue(int(close))
plot(result)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept series value for float parameter', () => {
    const code = `//@version=6
indicator("Series Float Test")

calcValue(float value) =>
    value * 1.5

result = calcValue(close)
plot(result)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept math.round result for int parameter', () => {
    const code = `//@version=6
indicator("Math Round Int Test")

useInt(int value) =>
    value + 10

rounded = math.round(close * 100)
result = useInt(rounded)
plot(result)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept math.floor result for int parameter', () => {
    const code = `//@version=6
indicator("Math Floor Int Test")

useInt(int value) =>
    value * 2

floored = math.floor(close)
result = useInt(floored)
plot(result)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept math.ceil result for int parameter', () => {
    const code = `//@version=6
indicator("Math Ceil Int Test")

useInt(int value) =>
    value / 2

ceiled = math.ceil(close)
result = useInt(ceiled)
plot(result)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept series expression for color.new transparency', () => {
    const code = `//@version=6
indicator("Series Transparency Test")

transp = math.round(close / high * 100)
col = color.new(color.blue, transp)
plot(close, color=col)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept calculated series for int parameter', () => {
    const code = `//@version=6
indicator("Calculated Series Test")

useValue(int val) =>
    val > 50 ? color.green : color.red

calculated = int(ta.rsi(close, 14))
col = useValue(calculated)
plot(close, color=col)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept series float in arithmetic operations', () => {
    const code = `//@version=6
indicator("Series Arithmetic Test")

multiply(float a, float b) =>
    a * b

result = multiply(close, high)
plot(result)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept series in conditional expressions', () => {
    const code = `//@version=6
indicator("Series Conditional Test")

getMax(float a, float b) =>
    a > b ? a : b

maxVal = getMax(close, open)
plot(maxVal)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept series in color.rgb parameters', () => {
    const code = `//@version=6
indicator("Series RGB Test")

r = int(ta.rsi(close, 14) * 2.55)
g = int(ta.cci(close, 20) + 128)
b = 128
col = color.rgb(r, g, b)
plot(close, color=col)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept series in complex calculations', () => {
    const code = `//@version=6
indicator("Series Complex Test")

calculateColor(float price, float avg) =>
    diff = price - avg
    factor = diff / avg
    transp = int(math.abs(factor) * 100)
    transp := math.min(transp, 100)
    color.new(factor > 0 ? color.green : color.red, transp)

sma20 = ta.sma(close, 20)
col = calculateColor(close, sma20)
plot(close, color=col)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept series in nested function calls', () => {
    const code = `//@version=6
indicator("Series Nested Test")

inner(int value) =>
    value * 2

outer(float price) =>
    rounded = math.round(price)
    inner(rounded)

result = outer(close)
plot(result)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept series in array operations', () => {
    const code = `//@version=6
indicator("Series Array Test")

arr = array.new<float>()
arr.push(close)
arr.push(high)
arr.push(low)

avgValue = arr.avg()
plot(avgValue)`;

    const result = validator.validate(code);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
