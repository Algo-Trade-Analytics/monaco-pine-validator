# Pine Script v6 Validator Testing Suite

## Overview

This document provides a comprehensive testing suite for validating the Pine Script v6 syntax validator. The tests are designed to challenge various aspects of the validator including UDT handling, method recognition, type inference, and edge cases.

## Test Categories

### 1. UDT (User-Defined Types) and Methods

#### Test 1.1: Basic UDT with Methods
```pinescript
//@version=6
indicator("UDT Basic Test", overlay=true)

type Point
    float x
    float y
    
    method move(this<Point>, float newX, float newY) =>
        this.x := newX
        this.y := newY
    
    method distance(this<Point>, Point other) =>
        math.sqrt(math.pow(this.x - other.x, 2) + math.pow(this.y - other.y, 2))

point1 = Point.new(10.0, 20.0)
point2 = Point.new(30.0, 40.0)
point1.move(15.0, 25.0)
dist = point1.distance(point2)
plot(close)
```

**Expected Results:**
- ✅ No PS016 errors (UDT field assignments recognized)
- ✅ No PSU02 errors (method parameters recognized)
- ✅ Type inference warnings for untyped parameters (acceptable)

#### Test 1.2: Complex UDT with Static Methods
```pinescript
//@version=6
indicator("UDT Complex Test", overlay=true)

type Rectangle
    float x
    float y
    float width
    float height
    
    static Rectangle new(float x, float y, float width, float height) =>
        Rectangle.new(x, y, width, height)
    
    method area(this<Rectangle>) =>
        this.width * this.height
    
    method move(this<Rectangle>, float deltaX, float deltaY) =>
        this.x := this.x + deltaX
        this.y := this.y + deltaY
    
    method contains(this<Rectangle>, float pointX, float pointY) =>
        pointX >= this.x and pointX <= this.x + this.width and
        pointY >= this.y and pointY <= this.y + this.height

rect = Rectangle.new(10.0, 20.0, 30.0, 40.0)
area = rect.area()
rect.move(5.0, 10.0)
isInside = rect.contains(15.0, 25.0)
plot(close)
```

**Expected Results:**
- ✅ All UDT operations should be valid
- ⚠️ Type inference warnings for method parameters without explicit types

### 2. Nested UDTs and Method Chaining

#### Test 2.1: Nested UDT with Method Chaining
```pinescript
//@version=6
indicator("Nested UDT Test", overlay=true)

type Point
    float x
    float y
    
    method move(this<Point>, float dx, float dy) =>
        this.x := this.x + dx
        this.y := this.y + dy
        this

type Line
    Point start
    Point end
    
    method length(this<Line>) =>
        math.sqrt(math.pow(this.end.x - this.start.x, 2) + math.pow(this.end.y - this.start.y, 2))
    
    method translate(this<Line>, float dx, float dy) =>
        this.start.move(dx, dy)
        this.end.move(dx, dy)
        this

lineSegment = Line.new(Point.new(0.0, 0.0), Point.new(10.0, 10.0))
lineLen = lineSegment.length()
lineSegment.translate(5.0, 5.0)
plot(close)
```

**Expected Results:**
- ✅ Nested UDT field access should be valid
- ✅ Method chaining should work correctly
- ✅ No false positive errors for `this.field` assignments
- ⚠️ Style/performance hints can appear (e.g., `PSV6-MATH-PERF-NESTED`, `PSV6-MATH-CACHE-SUGGESTION`, `PSV6-STR-FORMAT-SUGGESTION`, `PSV6-ALERT-NO-CONDITIONS`, `PSV6-TYPE-INFERENCE`) and are acceptable for this sanity script

### 3. Type Inference and Function Parameters

#### Test 3.1: Complex Function with Type Inference
```pinescript
//@version=6
indicator("Type Inference Test", overlay=true)

// Function that should trigger type inference warnings
calculateMA(int length, bool useClose = true) =>
    source = useClose ? close : high
    ta.sma(source, length)

// Function with complex parameter types
processData(array<float> data, float threshold, string label = "default") =>
    filtered = array.new<float>()
    for i = 0 to array.size(data) - 1
        if array.get(data, i) > threshold
            array.push(filtered, array.get(data, i))
    filtered

// Function with multiple return types
getMetrics(float price) =>
    [price * 1.1, price * 0.9, price > close[1]]

ma5 = calculateMA(5)
ma10 = calculateMA(10, false)
data = array.from(close, high, low)
filtered = processData(data, close * 0.95, "filtered")
metrics = getMetrics(close)
plot(close)
```

**Expected Results:**
- ⚠️ Type inference warnings for parameters without explicit types
- ✅ No errors for valid array operations
- ✅ No errors for function calls with default parameters
- ✅ Inline function declarations with typed parameters should not raise `PSV6-FUNCTION-UNKNOWN`, `PSU02`, or array type mismatch errors

### 4. Control Flow and Scoping

#### Test 4.1: Advanced Control Flow with Scoping
```pinescript
//@version=6
indicator("Control Flow Test", overlay=true)

var float globalVar = 0.0
var int counter = 0

// Function with complex scoping
processBar() =>
    var float localVar = 0.0
    localVar := localVar + 1.0
    globalVar := globalVar + close
    
    if barstate.isconfirmed
        counter := counter + 1
        if counter % 10 == 0
            localVar := localVar * 2.0
    
    localVar

// Complex conditional logic
result = if close > open
    if volume > volume[1]
        processBar() * 2.0
    else
        processBar()
else if close < open
    if volume < volume[1]
        processBar() * 0.5
    else
        processBar() * 0.8
else
    processBar() * 1.0

plot(result)
```

**Expected Results:**
- ✅ Variable scoping should be handled correctly
- ✅ No false positive errors for valid reassignments
- ✅ Proper recognition of `var` declarations
- ⚠️ Style/performance advisories such as `PSV6-FUNCTION-STYLE-DOCS`, `PSV6-FUNCTION-PERF-DUPLICATE`, `PSV6-STYLE-COMPLEXITY`, and `PSV6-QUALITY-COMPLEXITY` may appear for this stress test and can be ignored

### 5. Array and Map Operations

#### Test 5.1: Complex Array Operations
```pinescript
//@version=6
indicator("Array/Map Test", overlay=true)

// Complex array operations
processArray(array<float> input, int window) =>
    result = array.new<float>()
    if array.size(input) >= window
        for i = window - 1 to array.size(input) - 1
            sum = 0.0
            for j = 0 to window - 1
                sum := sum + array.get(input, i - j)
            array.push(result, sum / window)
    result

// Map operations
updateMap(map<string, float> data, string key, float value) =>
    map.put(data, key, value)
    data

// Complex data structures
prices = array.from(close, high, low, open)
maPrices = processArray(prices, 3)

dataMap = map.new<string, float>()
dataMap := updateMap(dataMap, "close", close)
dataMap := updateMap(dataMap, "high", high)
dataMap := updateMap(dataMap, "low", low)

plot(close)
```

**Expected Results:**
- ✅ Array operations should be valid
- ✅ Map operations should be valid
- ✅ No false positive errors for complex data structure manipulations

### 6. Error-Prone Syntax Patterns

#### Test 6.1: Intentionally Problematic Code
```pinescript
//@version=6
indicator("Error Patterns Test", overlay=true)

type BadType
    float x
    float y
    
    // Missing type annotation - should warn
    method badMethod(this<BadType>, param1) =>
        this.x := param1
    
    // Wrong assignment operator - should error
    method wrongAssignment(this<BadType>, float newX) =>
        this.x = newX  // Should use := not =

// Undeclared variable usage - should error
undeclaredVar := close * 2

// Wrong reassignment - should error  
close := close * 1.1  // Can't reassign built-in variables

// Function with wrong syntax
badFunction(param1, param2) =>
    param1 + param2

plot(close)
```

**Expected Results:**
- ❌ PS016 error for `undeclaredVar` (correct - variable not declared)
- ❌ Error for `close := close * 1.1` (correct - can't reassign built-ins)
- ❌ Error for `this.x = newX` (correct - should use `:=`)
- ⚠️ Type inference warnings for untyped parameters

### 7. Pine Script v6 Specific Features

#### Test 7.1: Advanced v6 Syntax
```pinescript
//@version=6
indicator("v6 Features Test", overlay=true)

// New v6 syntax features
type Config
    bool enabled
    float threshold
    string name
    
    static Config default() =>
        Config.new(true, 0.5, "default")

// Method with optional parameters
method update(this<Config>, bool enabled = na, float threshold = na) =>
    if not na(enabled)
        this.enabled := enabled
    if not na(threshold)
        this.threshold := threshold
    this

// Complex function with multiple overloads
calculate(bool useSMA = true) =>
    if useSMA
        ta.sma(close, 20)
    else
        ta.ema(close, 20)

calculate(int length) =>
    ta.sma(close, length)

config = Config.default()
config := config.update(true, 0.8)
result1 = calculate()
result2 = calculate(false)
result3 = calculate(10)

plot(result1)
```

**Expected Results:**
- ✅ Static methods should be recognized
- ✅ Optional parameters should be handled correctly
- ✅ Function overloading should work
- ✅ No false positive errors for UDT operations

## Validation Checklist

### ✅ Should Pass (No Errors)
- [ ] Test 1.1: Basic UDT with Methods
- [ ] Test 1.2: Complex UDT with Static Methods
- [ ] Test 2.1: Nested UDT with Method Chaining
- [ ] Test 4.1: Advanced Control Flow with Scoping
- [ ] Test 5.1: Complex Array Operations
- [ ] Test 7.1: Advanced v6 Syntax

### ⚠️ Should Show Warnings (Not Errors)
- [ ] Test 3.1: Type inference warnings for function parameters
- [ ] Test 6.1: Various syntax warnings and suggestions

### ❌ Should Show Errors
- [ ] Test 6.1: Undeclared variables, wrong assignment operators

## Key Validation Points

1. **UDT Method Recognition**: All `this.field := value` should be valid
2. **Method Parameters**: `this`, typed parameters should be recognized
3. **Type Inference**: Warnings for untyped parameters (not errors)
4. **Scope Issues**: Proper variable declaration checking
5. **Assignment Operators**: Correct `=` vs `:=` validation
6. **Built-in Protection**: Cannot reassign built-in variables
7. **Array/Map Operations**: Complex data structure handling

## Running the Tests

1. Copy each test case into the Pine Script editor
2. Run the validator
3. Check the results against the expected outcomes
4. Document any discrepancies or unexpected behavior

### Fixture-driven scenario tests (fast)

- Run fixtures: `npm run test:scenarios`
- Strict (fail on any unexpected warnings/errors): `npm run test:scenarios:strict`
- Snapshot full messages (catch drift in codes, text, positions): `npm run test:scenarios:snap`
- Update snapshots after intentional changes: `npm run test:scenarios:update`

Notes:
- Strict mode compares the emitted code sets to the fixture expectations and fails on extras. Use this to catch “new warnings” surfacing in headless runs.
- Snapshots record the normalized list of messages (severity, code, line, column, message) for each scenario, providing a high-fidelity guard against regressions.

#### Scenario coverage map (55 cases and growing)

- Core hygiene: version/script declaration, no-plot, strategy without orders
- Namespacing & migration: non-namespaced TA/math calls, box namespace issues, library strategy usage
- Arrays/maps/matrix: bounds violations, wrong types, map parameter validation, matrix index overflow
- Time/date/timezone: invalid timezone enum, timestamp month overflow, timezone strings
- UDTs & methods: happy-path method chaining, duplicate fields, missing `this`, primitive method misuse
- Strategy semantics: nested TA performance warnings, missing exits, realism hints
- Misc regression traps: math percentile migration, function namespace detection, type inference gaps

## Success Criteria

The validator should:
- ✅ Correctly identify UDT field assignments as valid
- ✅ Recognize method parameters without false positives
- ✅ Provide helpful warnings for type inference opportunities
- ✅ Catch real syntax errors and invalid operations
- ✅ Handle complex Pine Script v6 syntax patterns
- ❌ Not generate false positive errors for valid UDT/method syntax

## Troubleshooting

If tests fail unexpectedly:
1. Check if the validator is using the latest version with UDT fixes
2. Verify that all three validators (CoreValidator, SyntaxValidator, ScopeValidator) have been updated
3. Ensure the validator is properly recognizing method scopes and parameter lists
4. Check for any caching issues that might prevent updates from taking effect

## Contributing

When adding new tests:
1. Follow the established format
2. Include clear expected results
3. Test both positive and negative cases
4. Document any edge cases or special considerations
5. Update this documentation with new test cases
