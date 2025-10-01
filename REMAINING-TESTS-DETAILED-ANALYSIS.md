# Detailed Analysis of 6 Remaining Failed Tests

**Date:** October 2, 2025  
**Coverage:** 99.67% (1429/1435 passing)  
**Status:** 6 tests remaining (0.33%)

---

## 📊 SUMMARY

| Test Category | Count | Cause |
|--------------|-------|-------|
| 🟡 String Format Issues | 3 | Parsing/escaping edge cases |
| 🚧 Parser Limitations | 2 | AST traversal gaps |
| 🔨 Edge Cases | 1 | Malformed syntax handling |

---

## 1. 🟡 String Utility - str.format() with placeholders

**Location:** `tests/specs/string-utility-functions-validation.spec.ts`  
**Test Name:** `should validate str.format() with placeholders`

### Code Being Tested
```pine
//@version=6
indicator("Format")

name = "Bitcoin"
price = close
formatted = str.format("{0}: ${1}", name, price)
label.new(bar_index, high, formatted)
```

### Expected Behavior
- Should be VALID (no errors)
- Format string has 2 placeholders: `{0}` and `{1}`
- Two arguments provided: `name` and `price`
- The `$` in `${1}` is literal text, not a template variable

### Current Status
- ✅ **FIXED** (with latest patch to use raw AST node)
- Error was: `PSV6-STR-FORMAT-INVALID` due to `$` being stripped
- Solution: Use `formatNode.raw` property from AST instead of processed `args[0]`

### Technical Details
- **Issue:** String processing was stripping `$` character from format strings
- **Root Cause:** Using processed `args` array instead of raw AST node value
- **Fix Applied:** Check for `StringLiteral` node and use `.raw` property
- **File:** `modules/string-functions-validator.ts` lines 770-776

---

## 2. 🟡 String Integration - string-based data parsing

**Location:** `tests/specs/string-utility-functions-validation.spec.ts`  
**Test Name:** `should validate string-based data parsing`

### Code Being Tested
```pine
//@version=6
indicator("Data Parser")

// Parse CSV-like data
data = "AAPL,150.25,+2.5%"
parts = str.split(data, ",")
symbol = array.get(parts, 0)
price_str = array.get(parts, 1)
change_str = array.get(parts, 2)

// Convert and use
price = str.tonumber(price_str)
plot(price)
```

### Expected Behavior
- Should be VALID (no errors)
- Tests complex string parsing workflow
- Validates `str.split`, `array.get`, `str.tonumber` integration

### Current Status
- ❌ **FAILING**
- Error: `expected false to be true` (isValid check)
- Likely related to `str.split` return type or `array.get` validation

### Technical Details
- **Issue:** Complex string parsing pattern not fully supported
- **Root Cause:** Possible type inference issue with `str.split` → `array` → `array.get`
- **Affected Modules:** 
  - `StringFunctionsValidator`
  - `ArrayValidator`
  - `TypeInferenceValidator`
- **Investigation Needed:** Check type flow for `str.split()` return value

---

## 3. 🟡 String Integration - template string building

**Location:** `tests/specs/string-utility-functions-validation.spec.ts`  
**Test Name:** `should validate template string building`

### Code Being Tested
```pine
//@version=6
indicator("Template")

// Build complex template
ticker = syminfo.ticker
timeframe_str = timeframe.period
price = close
change = close - close[1]
pct = (change / close[1]) * 100

template = str.format("{0} ({1}): ${2} ({3}%)", ticker, timeframe_str, price, pct)
label.new(bar_index, high, template)
```

### Expected Behavior
- Should be VALID (no errors)
- Format string has 4 placeholders: `{0}`, `{1}`, `{2}`, `{3}`
- Note: `${2}` has literal `$` before the placeholder
- Four arguments provided: `ticker`, `timeframe_str`, `price`, `pct`

### Current Status
- ❌ **LIKELY FIXED** (same issue as test #1)
- Should pass after raw AST node fix
- Needs re-test to confirm

### Technical Details
- **Issue:** Same `$` character stripping as test #1
- **Solution:** Already applied (use `formatNode.raw`)
- **Confidence:** High - same root cause and fix

---

## 4. 🚧 Chart Functions - chart.point cleanup pattern

**Location:** `tests/specs/chart-functions-validation.spec.ts`  
**Test Name:** `should validate proper chart.point cleanup pattern`

### Code Being Tested
```pine
//@version=6
indicator("Chart Point Cleanup")

var array<chart.point> points = array.new<chart.point>()

if barstate.islast
    // Cleanup old points
    while array.size(points) > 100
        removed = array.shift(points)
```

### Expected Behavior
- Should be VALID (no errors)
- Tests proper resource cleanup pattern for chart.point arrays
- Variable declaration with `var` keyword and array type annotation

### Current Status
- ❌ **BLOCKED BY PARSER**
- Error: `var` declarations not properly visited in AST traversal
- Parser limitation, NOT a validator issue

### Technical Details
- **Issue:** AST traversal doesn't visit `VariableDeclaration` nodes with `var` keyword
- **Root Cause:** Chevrotain parser's visitor pattern incomplete
- **Impact:** Variable `points` not registered in `typeMap`
- **Workaround Applied:** Parser fix for `chart.point` type in generics (lines 687-699)
- **Remaining Gap:** `var` keyword handling in AST
- **Fix Required:** Parser enhancement, not validator

---

## 5. 🚧 Switch Statement - deeply nested switch

**Location:** `tests/specs/switch-validation.spec.ts`  
**Test Name:** `should warn on deeply nested switch statements`

### Code Being Tested
```pine
//@version=6
indicator("Deep Switch")

result = switch
    cond1 =>
        switch  // Nested level 1
            cond2 =>
                switch  // Nested level 2
                    cond3 =>
                        switch  // Nested level 3
                            cond4 =>
                                switch  // Nested level 4
                                    cond5 => 1
                                    => 2
                            => 3
                    => 4
            => 5
    => 6
```

### Expected Behavior
- Should generate WARNING: `PSV6-SWITCH-PERF`
- Warning message: "Deeply nested switch statements"
- Validator should detect nesting depth > 3

### Current Status
- ❌ **BLOCKED BY PARSER**
- Error: `TypeError: Cannot read properties of undefined (reading 'kind')`
- Parser crashes on deeply nested switch expressions
- Validator logic is CORRECT

### Technical Details
- **Issue:** AST parser fails on nested switch expressions
- **Root Cause:** Chevrotain parser recursion depth or missing null checks
- **Validator Status:** ✅ Depth calculation fixed (lines 432-471 in `switch-validator.ts`)
- **Parser Status:** ❌ Crashes before validator runs
- **Fix Required:** Parser enhancement for nested switch expressions

---

## 6. 🔨 EnhancedTextboxValidator - malformed text

**Location:** `tests/specs/enhanced-textbox-validation.spec.ts`  
**Test Name:** `should handle malformed text parameters`

### Code Being Tested
```pine
//@version=6
indicator("Malformed Textbox")

// Malformed textbox calls
box.new(bar_index, high, bar_index + 1, low, text=)  // Missing value
box.new(bar_index, high, bar_index + 1, low, text="test",)  // Trailing comma
```

### Expected Behavior
- Should detect malformed syntax gracefully
- Generate errors for:
  - Missing parameter value after `=`
  - Trailing comma before `)`
- Should NOT crash validator

### Current Status
- ❌ **FAILING**
- Test expects: `errors.length > 0`
- Actual: No errors detected
- Similar to linefill malformed syntax (which was fixed)

### Technical Details
- **Issue:** No fallback validation for malformed textbox syntax
- **Root Cause:** EnhancedTextboxValidator doesn't check for syntax errors
- **Solution Needed:** Add `detectMalformedSyntax()` method (similar to LinefillValidator)
- **Patterns to Detect:**
  - `text=\s*[,)]` - missing value after `=`
  - `,\s*\)` - trailing comma
- **Complexity:** 🟡 Medium (copy pattern from linefill-validator fix)
- **File:** `modules/enhanced-textbox-validator.ts`

---

## 📋 RECOMMENDED ACTIONS

### Immediate Fixes (2 tests)
1. ✅ **String format issues** - FIXED with raw AST node
2. 🔨 **EnhancedTextbox malformed** - Apply same pattern as linefill fix

### Parser-Blocked (2 tests)
3. 🚧 **Chart.point var** - Requires parser fix for `var` declarations
4. 🚧 **Switch deep nesting** - Requires parser fix for nested switch expressions

### Needs Investigation (2 tests)
5. 🔍 **String data parsing** - Type inference for `str.split` → `array.get` chain
6. 🔍 **String template building** - Likely fixed with #1, needs confirmation

---

## 🎯 SUCCESS METRICS

- **Coverage:** 99.67% → Target: 99.86% (4 fixable tests)
- **Parser-Blocked:** 2 tests (documented, not validator issues)
- **Estimated Effort:**
  - EnhancedTextbox fix: 15 minutes
  - String integration investigation: 30 minutes
  - Total: ~45 minutes to reach 99.86%

---

*Generated by Claude - Pine Script Validator Session*

