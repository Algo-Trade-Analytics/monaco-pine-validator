import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('array.from() special case handling', () => {
  const validator = new EnhancedModularValidator();

  it('should handle array.from() with color arguments', () => {
    const script = `
//@version=6
indicator("Test")

// array.from() with color arguments should not trigger array validation errors
array<color> colors = array.from(#FF0000, #00FF00, #0000FF)
array<color> palette = array.from(color.red, color.green, color.blue)

// Use the arrays
f_getColor(array<color> colorArray, int index) =>
    array.get(colorArray, index)

if barstate.islast
    color firstColor = f_getColor(colors, 0)
    color secondColor = f_getColor(palette, 1)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle array.from() with numeric arguments', () => {
    const script = `
//@version=6
indicator("Test")

// array.from() with numeric arguments should not trigger array validation errors
array<float> values = array.from(1.0, 2.0, 3.0, 4.0)
array<int> indices = array.from(0, 1, 2, 3)

// Use the arrays
f_getValue(array<float> valueArray, int index) =>
    array.get(valueArray, index)

f_getIndex(array<int> indexArray, int pos) =>
    array.get(indexArray, pos)

if barstate.islast
    float val1 = f_getValue(values, 0)
    float val2 = f_getValue(values, 1)
    int idx1 = f_getIndex(indices, 0)
    int idx2 = f_getIndex(indices, 1)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle array.from() with string arguments', () => {
    const script = `
//@version=6
indicator("Test")

// array.from() with string arguments should not trigger array validation errors
array<string> messages = array.from("Hello", "World", "Test")
array<string> labels = array.from("Price", "Volume", "RSI")

// Use the arrays
f_getMessage(array<string> messageArray, int index) =>
    array.get(messageArray, index)

if barstate.islast
    string msg1 = f_getMessage(messages, 0)
    string msg2 = f_getMessage(labels, 1)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle array.from() with boolean arguments', () => {
    const script = `
//@version=6
indicator("Test")

// array.from() with boolean arguments should not trigger array validation errors
array<bool> flags = array.from(true, false, true)
array<bool> conditions = array.from(close > open, volume > ta.sma(volume, 20), ta.rsi(close, 14) > 50)

// Use the arrays
f_getFlag(array<bool> flagArray, int index) =>
    array.get(flagArray, index)

if barstate.islast
    bool flag1 = f_getFlag(flags, 0)
    bool condition1 = f_getFlag(conditions, 0)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle array.from() with mixed type arguments', () => {
    const script = `
//@version=6
indicator("Test")

// array.from() with mixed type arguments should not trigger array validation errors
array<float> mixedValues = array.from(1.0, close, high, low)
array<string> mixedStrings = array.from("Price", str.tostring(close), "Volume", str.tostring(volume))

// Use the arrays
f_processFloat(array<float> floatArray, int index) =>
    array.get(floatArray, index)

f_processString(array<string> stringArray, int index) =>
    array.get(stringArray, index)

if barstate.islast
    float val1 = f_processFloat(mixedValues, 0)
    float val2 = f_processFloat(mixedValues, 1)
    string str1 = f_processString(mixedStrings, 0)
    string str2 = f_processString(mixedStrings, 1)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle array.from() with function call results', () => {
    const script = `
//@version=6
indicator("Test")

// array.from() with function call results should not trigger array validation errors
array<float> taValues = array.from(ta.rsi(close, 14), ta.sma(close, 20), ta.ema(close, 10))
array<color> dynamicColors = array.from(color.new(color.red, 50), color.new(color.green, 30), color.new(color.blue, 70))

// Use the arrays
f_getTAValue(array<float> taArray, int index) =>
    array.get(taArray, index)

f_getDynamicColor(array<color> colorArray, int index) =>
    array.get(colorArray, index)

if barstate.islast
    float rsi = f_getTAValue(taValues, 0)
    float sma = f_getTAValue(taValues, 1)
    color redColor = f_getDynamicColor(dynamicColors, 0)
    color greenColor = f_getDynamicColor(dynamicColors, 1)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle array.from() with built-in variables', () => {
    const script = `
//@version=6
indicator("Test")

// array.from() with built-in variables should not trigger array validation errors
array<float> prices = array.from(open, high, low, close)
array<int> indices = array.from(bar_index, time)
array<bool> conditions = array.from(session.ismarket, syminfo.currency == "USD")

// Use the arrays
f_getPrice(array<float> priceArray, int index) =>
    array.get(priceArray, index)

f_getIndex(array<int> indexArray, int pos) =>
    array.get(indexArray, pos)

f_getCondition(array<bool> conditionArray, int pos) =>
    array.get(conditionArray, pos)

if barstate.islast
    float openPrice = f_getPrice(prices, 0)
    float highPrice = f_getPrice(prices, 1)
    int currentBar = f_getIndex(indices, 0)
    bool isMarket = f_getCondition(conditions, 0)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle array.from() with UDT instances', () => {
    const script = `
//@version=6
indicator("Test")

type Point3D
    float x
    float y
    float z

// array.from() with UDT instances should not trigger array validation errors
array<Point3D> points = array.from(Point3D.new(1, 2, 3), Point3D.new(4, 5, 6), Point3D.new(7, 8, 9))

// Use the arrays
f_getPoint(array<Point3D> pointArray, int index) =>
    array.get(pointArray, index)

if barstate.islast
    Point3D p1 = f_getPoint(points, 0)
    Point3D p2 = f_getPoint(points, 1)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle array.from() with chart.point instances', () => {
    const script = `
//@version=6
indicator("Test")

// array.from() with chart.point instances should not trigger array validation errors
array<chart.point> points = array.from(chart.point.from_index(0, 0), chart.point.new(time, high), chart.point.from_index(bar_index, close))

// Use the arrays
f_getChartPoint(array<chart.point> pointArray, int index) =>
    array.get(pointArray, index)

if barstate.islast
    chart.point p1 = f_getChartPoint(points, 0)
    chart.point p2 = f_getChartPoint(points, 1)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle array.from() with enum values', () => {
    const script = `
//@version=6
indicator("Test")

enum ColorScheme
    RAINBOW
    FIRE
    ICE

// array.from() with enum values should not trigger array validation errors
array<ColorScheme> schemes = array.from(ColorScheme.RAINBOW, ColorScheme.FIRE, ColorScheme.ICE)

// Use the arrays
f_getScheme(array<ColorScheme> schemeArray, int index) =>
    array.get(schemeArray, index)

if barstate.islast
    ColorScheme scheme1 = f_getScheme(schemes, 0)
    ColorScheme scheme2 = f_getScheme(schemes, 1)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle array.from() in nested contexts', () => {
    const script = `
//@version=6
indicator("Test")

// array.from() in nested contexts should not trigger array validation errors
if barstate.islast
    for i = 0 to 3
        array<float> values = array.from(float(i), close, high)
        
        f_process(array<float> valueArray, int index) =>
            array.get(valueArray, index)
        
        float val1 = f_process(values, 0)
        float val2 = f_process(values, 1)
        
        if true
            array<string> messages = array.from("Index: " + str.tostring(i), "Close: " + str.tostring(close))
            
            f_display(array<string> messageArray, int index) =>
                array.get(messageArray, index)
            
            string msg1 = f_display(messages, 0)
            string msg2 = f_display(messages, 1)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle array.from() with conditional expressions', () => {
    const script = `
//@version=6
indicator("Test")

// array.from() with conditional expressions should not trigger array validation errors
array<float> conditionalValues = array.from(
  close > open ? close : open,
  volume > ta.sma(volume, 20) ? volume : ta.sma(volume, 20),
  ta.rsi(close, 14) > 50 ? ta.rsi(close, 14) : 50.0
)

// Use the arrays
f_getConditional(array<float> valueArray, int index) =>
    array.get(valueArray, index)

if barstate.islast
    float val1 = f_getConditional(conditionalValues, 0)
    float val2 = f_getConditional(conditionalValues, 1)
    float val3 = f_getConditional(conditionalValues, 2)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle array.from() with switch expressions', () => {
    const script = `
//@version=6
indicator("Test")

enum Trend
    UP
    DOWN
    SIDEWAYS

// array.from() with switch expressions should not trigger array validation errors
Trend currentTrend = close > open ? Trend.UP : Trend.DOWN
array<float> switchValues = array.from(
  switch currentTrend
    Trend.UP => close
    Trend.DOWN => open
    => (close + open) / 2,
  switch currentTrend
    Trend.UP => high
    Trend.DOWN => low
    => close
)

// Use the arrays
f_getSwitchValue(array<float> valueArray, int index) =>
    array.get(valueArray, index)

if barstate.islast
    float val1 = f_getSwitchValue(switchValues, 0)
    float val2 = f_getSwitchValue(switchValues, 1)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle array.from() with na values', () => {
    const script = `
//@version=6
indicator("Test")

// array.from() with na values should not trigger array validation errors
array<float> naValues = array.from(na, 1.0, na, 2.0)
array<string> naStrings = array.from(na, "test", na, "value")
array<color> naColors = array.from(na, color.red, na, color.blue)

// Use the arrays
f_getNAFloat(array<float> floatArray, int index) =>
    array.get(floatArray, index)

f_getNAString(array<string> stringArray, int index) =>
    array.get(stringArray, index)

f_getNAColor(array<color> colorArray, int index) =>
    array.get(colorArray, index)

if barstate.islast
    float val1 = f_getNAFloat(naValues, 0)
    float val2 = f_getNAFloat(naValues, 1)
    string str1 = f_getNAString(naStrings, 0)
    string str2 = f_getNAString(naStrings, 1)
    color col1 = f_getNAColor(naColors, 0)
    color col2 = f_getNAColor(naColors, 1)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle array.from() with large number of arguments', () => {
    const script = `
//@version=6
indicator("Test")

// array.from() with large number of arguments should not trigger array validation errors
array<float> largeArray = array.from(1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0)
array<color> colorPalette = array.from(
  #FF0000, #FF8000, #FFFF00, #80FF00, #00FF00, #00FF80, #00FFFF, #0080FF, #0000FF, #8000FF
)

// Use the arrays
f_getLargeValue(array<float> largeArray, int index) =>
    array.get(largeArray, index)

f_getLargeColor(array<color> colorArray, int index) =>
    array.get(colorArray, index)

if barstate.islast
    float val1 = f_getLargeValue(largeArray, 0)
    float val2 = f_getLargeValue(largeArray, 5)
    color col1 = f_getLargeColor(colorPalette, 0)
    color col2 = f_getLargeColor(colorPalette, 5)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
