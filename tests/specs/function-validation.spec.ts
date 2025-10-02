import { EnhancedModularValidator } from '../..';
import { expectHas, expectLacks } from './test-utils';

/// <reference types="vitest/globals" />

describe('Function Validation (TDD)', () => {
  let validator: EnhancedModularValidator;

  beforeEach(() => {
    validator = new EnhancedModularValidator({
      targetVersion: 6,
      strictMode: true,
      enablePerformanceAnalysis: true
    });
  });

  describe('PSV6-FUNCTION: Built-in Function Validation', () => {
    it('should validate correct built-in function calls', () => {
      const code = `//@version=6
indicator("Function Test")

// Valid function calls
sma_value = ta.sma(close, 20)
ema_value = ta.ema(close, 14)
rsi_value = ta.rsi(close, 14)
plot_value = plot(sma_value, title="SMA", color=color.blue)

plot(plot_value)`;
      
      const result = validator.validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on incorrect function parameter count', () => {
      const code = `//@version=6
indicator("Function Param Count Error")

// Too few parameters
sma_value = ta.sma(close)  // Missing length parameter
// Too many parameters  
ema_value = ta.ema(close, 14, 5)  // Extra parameter

plot(close)`;
      
      const result = validator.validate(code);
      expectHas(result, { errors: ['PSV6-TA-FUNCTION-PARAM'] });
    });

    it('should error on incorrect parameter types', () => {
      const code = `//@version=6
indicator("Function Param Type Error")

// Wrong parameter types
sma_value = ta.sma("close", 20)  // String instead of series
rsi_value = ta.rsi(close, "14")  // String instead of int

plot(close)`;
      
      const result = validator.validate(code);
      expectHas(result, { errors: ['PSV6-FUNCTION-PARAM-TYPE'] });
    });

    it('should validate function return types', () => {
      const code = `//@version=6
indicator("Function Return Type")

// Functions with different return types
sma_float = ta.sma(close, 20)  // Returns series float
rsi_float = ta.rsi(close, 14)  // Returns series float
crossover_bool = ta.crossover(close, sma_float)  // Returns series bool

plot(sma_float)`;
      
      const result = validator.validate(code);
      if (!result.isValid) {
        console.log('Errors:', result.errors.map(e => ({ code: e.code, message: e.message, line: e.line })));
        console.log('Warnings:', result.warnings.map(w => ({ code: w.code, message: w.message, line: w.line })));
      }
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should flag unsupported box text helpers as unknown functions', () => {
      const code = `//@version=6
indicator("Unsupported Box Helpers")

box_id = box.new(left=0, top=1, right=1, bottom=0)
box.set_text_font(box_id, font.monospace)
current_text = box.get_text(box_id)

plot(close)`;

      const result = validator.validate(code);
      expectHas(result, { errors: ['PSV6-UNDEFINED-NAMESPACE-MEMBER'] });
    });

    it('should error on incorrect return type usage', () => {
      const code = `//@version=6
indicator("Function Return Type Error")

// Using boolean function result as number
crossover_result = ta.crossover(close, ta.sma(close, 20))
plot(crossover_result + 1)  // Can't add to boolean

plot(close)`;
      
      const result = validator.validate(code);
      expectHas(result, { errors: ['PSV6-FUNCTION-RETURN-TYPE'] });
    });
  });

  describe('PSV6-FUNCTION-USER: User Function Validation', () => {
    it('should validate user-defined function declarations', () => {
      const code = `//@version=6
indicator("User Function Test")

// Valid user function
my_function(x, y) =>
    x + y

result = my_function(10, 20)
plot(result)`;
      
      const result = validator.validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on duplicate function names', () => {
      const code = `//@version=6
indicator("Duplicate Function")

// Duplicate function names
my_function(x) => x * 2
my_function(x, y) => x + y  // Duplicate name

plot(close)`;
      
      const result = validator.validate(code);
      expectHas(result, { errors: ['PSV6-FUNCTION-DUPLICATE'] });
    });

    it('should validate function parameter types', () => {
      const code = `//@version=6
indicator("Function Param Types")

// Function with typed parameters
typed_function(x, y) =>
    x + y

result = typed_function(10, 20.5)
plot(result)`;
      
      const result = validator.validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on function call with wrong parameter count', () => {
      const code = `//@version=6
indicator("Function Call Param Count")

my_function(x, y) => x + y

// Wrong parameter count
result = my_function(10)  // Missing second parameter

plot(close)`;
      
      const result = validator.validate(code);
      expectHas(result, { errors: ['PSV6-FUNCTION-CALL-PARAM-COUNT'] });
    });

    it('should validate function return type consistency', () => {
      const code = `//@version=6
indicator("Function Return Consistency")

// Function with consistent return type
consistent_function(x) =>
    if x > 0
        x * 2
    else
        x * -2

result = consistent_function(10)
plot(result)`;
      
      const result = validator.validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on inconsistent function return types', () => {
      const code = `//@version=6
indicator("Function Return Inconsistency")

// Function with inconsistent return types
inconsistent_function(x) =>
    if x > 0
        "positive"  // String
    else
        0  // Number

result = inconsistent_function(10)
plot(close)`;
      
      const result = validator.validate(code);
      expectHas(result, { errors: ['PSV6-FUNCTION-RETURN-TYPE'] });
    });

    it('should recognize inline typed functions with default arguments and array processing', () => {
      const code = `//@version=6
indicator("Inline Typed Functions")

calculateMA(int length, bool useClose = true) =>
    source = useClose ? close : high
    ta.sma(source, length)

processData(array<float> data, float threshold, string label = "default") =>
    filtered = array.new<float>()
    for i = 0 to array.size(data) - 1
        if array.get(data, i) > threshold
            array.push(filtered, array.get(data, i))
    filtered

getMetrics(float price) =>
    [price * 1.1, price * 0.9, price > close[1]]

ma5 = calculateMA(5)
ma10 = calculateMA(10, false)
data = array.from(close, high, low)
filtered = processData(data, close * 0.95, "filtered")
metrics = getMetrics(close)

plot(ma5)`;

      const result = validator.validate(code);
      expect(result.errors.map(e => e.code)).not.toContain('PSV6-FUNCTION-UNKNOWN');
      expect(result.errors.map(e => e.code)).not.toContain('PSV6-ARRAY-TYPE-MISMATCH');
    });
  });

  describe('PSV6-FUNCTION-NAMESPACE: Namespace Function Validation', () => {
    it('should validate namespace function calls', () => {
      const code = `//@version=6
indicator("Namespace Functions")

// Valid namespace function calls
sma_value = ta.sma(close, 20)
ema_value = ta.ema(close, 14)
rsi_value = ta.rsi(close, 14)
crossover_bool = ta.crossover(close, sma_value)

plot(sma_value)`;
      
      const result = validator.validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on incorrect namespace usage', () => {
      const code = `//@version=6
indicator("Namespace Error")

// Wrong namespace
sma_value = math.sma(close, 20)  // sma is in ta namespace, not math

plot(close)`;
      
      const result = validator.validate(code);
      expectHas(result, { errors: ['PSV6-UNDEFINED-NAMESPACE-MEMBER'] });
    });

    it('should validate math namespace functions', () => {
      const code = `//@version=6
indicator("Math Functions")

// Valid math functions
abs_value = math.abs(-10)
max_value = math.max(10, 20)
min_value = math.min(10, 20)
round_value = math.round(10.7)

plot(abs_value)`;
      
      const result = validator.validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate string namespace functions', () => {
      const code = `//@version=6
indicator("String Functions")

// Valid string functions
str_value = str.tostring(close)
len_value = str.length(str_value)
upper_value = str.upper(str_value)

plot(close)`;
      
      const result = validator.validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('handles static UDT constructors and methods without namespace errors', () => {
      const code = `//@version=6
indicator("Static UDT Functions")

type Rectangle
    float x
    float y
    float width
    float height

    static Rectangle new(float x, float y, float width, float height) =>
        Rectangle.new(x, y, width, height)

    method move(this<Rectangle>, float dx, float dy) =>
        this.x := this.x + dx
        this.y := this.y + dy

rect = Rectangle.new(1.0, 2.0, 3.0, 4.0)
rect.move(1.0, 1.0)

plot(rect.width)`;

      const result = validator.validate(code);
      expectLacks(result, { errors: ['PSV6-FUNCTION-NAMESPACE', 'PSV6-FUNCTION-UNKNOWN'] });
    });
  });

  describe('PSV6-FUNCTION-PERF: Function Performance Validation', () => {
    it('should warn on expensive functions in loops', () => {
      const code = `//@version=6
indicator("Expensive Functions in Loop")

// Expensive function in loop
for i = 0 to 10
    sma_value = ta.sma(close, i)  // Expensive in loop

plot(close)`;
      
      const result = validator.validate(code);
      expectHas(result, { warnings: ['PSV6-FUNCTION-PERF-LOOP'] });
    });

    it('should warn on nested expensive function calls', () => {
      const code = `//@version=6
indicator("Nested Expensive Functions")

// Nested expensive functions
nested_value = ta.sma(ta.ema(ta.rsi(close, 14), 20), 30)

plot(close)`;
      
      const result = validator.validate(code);
      expectHas(result, { warnings: ['PSV6-FUNCTION-PERF-NESTED'] });
    });

    it('should suggest function optimization', () => {
      const code = `//@version=6
indicator("Function Optimization")

// Multiple calls to same function with same parameters
sma1 = ta.sma(close, 20)
sma2 = ta.sma(close, 20)  // Duplicate call
sma3 = ta.sma(close, 20)  // Duplicate call

plot(sma1)`;
      
      const result = validator.validate(code);
      expectHas(result, { warnings: ['PSV6-FUNCTION-PERF-DUPLICATE'] });
    });
  });

  describe('PSV6-FUNCTION-STYLE: Function Style Validation', () => {
    it('should suggest function naming conventions', () => {
      const code = `//@version=6
indicator("Function Naming")

// Function with poor naming
f(x) => x * 2  // Poor name
myFunc(x) => x + 1  // Poor naming convention

plot(close)`;
      
      const result = validator.validate(code);
      expectHas(result, { warnings: ['PSV6-FUNCTION-STYLE-NAMING'] });
    });

    it('should warn on overly complex functions', () => {
      const code = `//@version=6
indicator("Complex Function")

// Overly complex function
complex_function(x, y, z) =>
    if x > 0
        if y > 0
            if z > 0
                x + y + z
            else
                x + y
        else
            if z > 0
                x + z
            else
                x
    else
        if y > 0
            if z > 0
                y + z
            else
                y
        else
            if z > 0
                z
            else
                0

result = complex_function(1, 2, 3)
plot(close)`;
      
      const result = validator.validate(code);
      expectHas(result, { warnings: ['PSV6-STYLE-COMPLEXITY'] });
    });

    it('should suggest function documentation', () => {
      const code = `//@version=6
indicator("Function Documentation")

// Function without documentation
my_function(x, y) =>
    x + y

plot(close)`;
      
      const result = validator.validate(code);
      expectHas(result, { warnings: ['PSV6-FUNCTION-STYLE-DOCS'] });
    });
  });
});
