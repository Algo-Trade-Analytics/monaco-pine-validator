import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('String concatenation type inference', () => {
  const validator = new EnhancedModularValidator();

  it('should infer string type from string + string concatenation', () => {
    const script = `
//@version=6
indicator("Test")

// String concatenation should be inferred as string type
string msg = "Price: " + str.tostring(close)
string prefix = "Symbol: " + syminfo.ticker
string suffix = "Time: " + str.tostring(time)

// Use in function calls that expect string
f_display(string message) =>
    message

if barstate.islast
    f_display(msg)
    f_display(prefix)
    f_display(suffix)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should infer string type from string + numeric concatenation', () => {
    const script = `
//@version=6
indicator("Test")

// String + numeric should be inferred as string type
string priceMsg = "Close: " + str.tostring(close)
string volumeMsg = "Volume: " + str.tostring(volume)
string barMsg = "Bar: " + str.tostring(bar_index)

// Use in function calls that expect string
f_display(string text) =>
    text

if barstate.islast
    f_display(priceMsg)
    f_display(volumeMsg)
    f_display(barMsg)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should infer string type from numeric + string concatenation', () => {
    const script = `
//@version=6
indicator("Test")

// Numeric + string should be inferred as string type
string priceMsg = str.tostring(close) + " is the current price"
string volumeMsg = str.tostring(volume) + " is the current volume"
string barMsg = str.tostring(bar_index) + " is the current bar"

// Use in function calls that expect string
f_display(string text) =>
    text

if barstate.islast
    f_display(priceMsg)
    f_display(volumeMsg)
    f_display(barMsg)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should infer string type from string + boolean concatenation', () => {
    const script = `
//@version=6
indicator("Test")

// String + boolean should be inferred as string type
string trendMsg = "Trend is up: " + str.tostring(close > open)
string volumeMsg = "High volume: " + str.tostring(volume > ta.sma(volume, 20))

// Use in function calls that expect string
f_display(string info) =>
    info

if barstate.islast
    f_report(trendMsg)
    f_report(volumeMsg)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should infer string type from complex string concatenation', () => {
    const script = `
//@version=6
indicator("Test")

// Complex string concatenation should be inferred as string type
string complexMsg = "Symbol: " + syminfo.ticker + ", Price: " + str.tostring(close) + ", Time: " + str.tostring(time)
string multiPart = "Part1: " + "Part2: " + str.tostring(bar_index)

// Use in function calls that expect string
f_display(string text) =>
    text

if barstate.islast
    f_complex(complexMsg)
    f_complex(multiPart)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should infer string type from string concatenation in function parameters', () => {
    const script = `
//@version=6
indicator("Test")

// Function that expects string parameter
f_requestSecurity(string symbol) =>
    request.security(symbol, timeframe.period, close)

// String concatenation in function call should be inferred as string
if barstate.islast
    string symbol = syminfo.prefix + syminfo.ticker
    float price = f_requestSecurity(symbol)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should infer string type from string concatenation in conditional expressions', () => {
    const script = `
//@version=6
indicator("Test")

// String concatenation in conditional expressions should be inferred as string type
string msg = close > open ? "Bullish: " + str.tostring(close) : "Bearish: " + str.tostring(close)
string trend = ta.rsi(close, 14) > 50 ? "RSI above 50: " + str.tostring(ta.rsi(close, 14)) : "RSI below 50"

// Use in function calls that expect string
f_display(string text) =>
    text

if barstate.islast
    f_display(msg)
    f_display(trend)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should infer string type from string concatenation in switch expressions', () => {
    const script = `
//@version=6
indicator("Test")

enum Trend
    UP
    DOWN
    SIDEWAYS

// String concatenation in switch expressions should be inferred as string type
Trend currentTrend = close > open ? Trend.UP : Trend.DOWN
string trendMsg = switch currentTrend
    Trend.UP => "Trend is UP: " + str.tostring(close)
    Trend.DOWN => "Trend is DOWN: " + str.tostring(close)
    => "Trend is SIDEWAYS: " + str.tostring(close)

// Use in function calls that expect string
f_display(string text) =>
    text

if barstate.islast
    f_display(trendMsg)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should infer string type from string concatenation with function calls', () => {
    const script = `
//@version=6
indicator("Test")

// String concatenation with function call results should be inferred as string type
string rsiMsg = "RSI: " + str.tostring(ta.rsi(close, 14))
string smaMsg = "SMA: " + str.tostring(ta.sma(close, 20))
string volumeMsg = "Volume SMA: " + str.tostring(ta.sma(volume, 10))

// Use in function calls that expect string
f_log(string info) =>
    log.info(info)

if barstate.islast
    f_log(rsiMsg)
    f_log(smaMsg)
    f_log(volumeMsg)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should infer string type from string concatenation with built-in variables', () => {
    const script = `
//@version=6
indicator("Test")

// String concatenation with built-in variables should be inferred as string type
string timeMsg = "Current time: " + str.tostring(time)
string sessionMsg = "Session: " + str.tostring(session.ismarket)
string tickerMsg = "Ticker: " + syminfo.ticker

// Use in function calls that expect string
f_display(string text) =>
    text

if barstate.islast
    f_info(timeMsg)
    f_info(sessionMsg)
    f_info(tickerMsg)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should infer string type from string concatenation in array operations', () => {
    const script = `
//@version=6
indicator("Test")

// String concatenation in array operations should be inferred as string type
array<string> messages = array.new<string>()

if barstate.islast
    for i = 0 to 5
        string msg = "Index " + str.tostring(i) + ": " + str.tostring(close)
        array.push(messages, msg)
    
    // Use array elements (which are strings) in function calls
f_display(string text) =>
    text
    
    for msg in messages
        f_process(msg)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should infer string type from string concatenation in map operations', () => {
    const script = `
//@version=6
indicator("Test")

// String concatenation in map operations should be inferred as string type
map<string, string> messageMap = map.new<string, string>()

if barstate.islast
    string key = "price_" + str.tostring(bar_index)
    string value = "Close: " + str.tostring(close)
    map.put(messageMap, key, value)
    
    // Use map values (which are strings) in function calls
f_display(string text) =>
    text
    
    string retrieved = map.get(messageMap, key)
    f_handle(retrieved)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should infer string type from string concatenation in nested contexts', () => {
    const script = `
//@version=6
indicator("Test")

// String concatenation in nested contexts should be inferred as string type
if barstate.islast
    for i = 0 to 3
        if i % 2 == 0
            string msg = "Even index " + str.tostring(i) + ": " + str.tostring(close)
        else
            string msg = "Odd index " + str.tostring(i) + ": " + str.tostring(open)
        
        // Use in function calls that expect string
f_display(string text) =>
    text
        
        f_log(msg)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle string concatenation with na values', () => {
    const script = `
//@version=6
indicator("Test")

// String concatenation with na should be inferred as string type
string msg1 = "Value: " + na
string msg2 = na + " is the value"
string msg3 = "Status: " + str.tostring(na)

// Use in function calls that expect string
f_display(string text) =>
    text

if barstate.islast
    f_display(msg1)
    f_display(msg2)
    f_display(msg3)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle string concatenation with color values', () => {
    const script = `
//@version=6
indicator("Test")

// String concatenation with color should be inferred as string type
string colorMsg = "Color: " + str.tostring(color.red)
string bgMsg = "Background: " + str.tostring(color.new(color.white, 50))

// Use in function calls that expect string
f_display(string text) =>
    text

if barstate.islast
    f_display(colorMsg)
    f_display(bgMsg)

plot(close)
`;

    const result = validator.validate(script);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
