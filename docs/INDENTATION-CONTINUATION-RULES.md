# Pine Script Validator - Line Continuation Indentation Rules Issue

## Problem Summary

The Pine Script validator **incorrectly rejects valid TradingView code** by being too strict about line continuation indentation. Specifically, it rejects **12-space line continuations** that work perfectly in TradingView.

## Critical Discovery

**Our validator implements this rule**:
> ❌ "Line continuation cannot use a multiple-of-4 relative offset (0, 4, 8, 12, 16...)"

**But TradingView's actual rule is**:
> ✅ "Line continuation indentation is context-aware and more flexible than we thought"

## Real-World Evidence

### Script: Volume Profile 3D (Zeiierman)
- **Status**: Published on TradingView, works perfectly
- **License**: Creative Commons Attribution-NonCommercial-ShareAlike 4.0
- **Issue**: Our validator flags 11 indentation errors, TradingView has 0 errors

### Specific Pattern That Works in TradingView (Lines 117-120)

```pine
var a   = Arrays.new(array.new<float>(),
            array.new<float>(),    // 12 spaces - TradingView ACCEPTS ✅
            array.new<float>(),    // 12 spaces - TradingView ACCEPTS ✅
            array.new<float>())    // 12 spaces - TradingView ACCEPTS ✅
```

**Validator says**: ❌ "Line continuation cannot use 12 spaces of relative indentation"  
**TradingView says**: ✅ Compiles and runs perfectly

### Another Pattern (Lines 121-122)

```pine
bins    = Buckets.new(array.new<float>(buckets,0.0),
            array.new<float>(buckets,0.0))  // 12 spaces - TradingView ACCEPTS ✅
```

**Validator says**: ❌ Error  
**TradingView says**: ✅ Works fine

---

## Test Results

I tested different indentation amounts to understand TradingView's actual rule:

```typescript
Test Results:
- 1 space continuation:   ✅ Validator accepts, TradingView accepts
- 2 space continuation:   ✅ Validator accepts, TradingView accepts
- 3 space continuation:   ✅ Validator accepts, TradingView accepts
- 4 space continuation:   ❌ Validator rejects, TradingView accepts (?)
- 8 space continuation:   ❌ Validator rejects, TradingView accepts (?)
- 12 space continuation:  ❌ Validator rejects, TradingView accepts ✅ PROVEN
- 13 space continuation:  ✅ Validator accepts, TradingView accepts
```

**Key Finding**: TradingView accepts **12-space line continuations** in function call contexts!

---

## Current Implementation Analysis

### File: `core/ast/indentation-validator-ast.ts`

#### Current Logic (Lines ~869-900)

```typescript
private validateWrapIndentation(lineNum: number, indent: number, baseIndent: number): void {
  const relativeIndent = indent - baseIndent;
  const wrapIndent = Math.abs(relativeIndent);

  // Rule 1: Must change indentation
  if (wrapIndent === 0) {
    this.addError(..., 'PSV6-INDENT-WRAP-INSUFFICIENT');
    return;
  }

  // Rule 2: Reject multiples of 4
  if (wrapIndent % 4 === 0) {
    this.addError(
      ...,
      `Line continuation cannot use ${wrapIndent} spaces of relative indentation`,
      'PSV6-INDENT-WRAP-MULTIPLE-OF-4'
    );
  }
}
```

**Problem**: The `wrapIndent % 4 === 0` check is **too strict** and doesn't match TradingView's behavior.

---

## TradingView's Actual Behavior (Hypothesis)

Based on testing, TradingView appears to use a **context-aware rule**:

### Theory 1: Position-Based Rule
TradingView might check if the continuation indent **aligns with a potential block boundary**:

```pine
// At global scope (base = 0):
// - Block boundaries are at: 4, 8, 12, 16... (not allowed for new statements)
// - But continuations CAN be at 12 if they're clearly continuations

var a = func(param1,
            param2)    // 12 spaces - OK because it follows opening paren
```

### Theory 2: Syntax Context Rule  
TradingView might look at the **previous line** to determine if this is definitely a continuation:

```pine
// Previous line ends with:
// - Opening paren "(" → Next line is continuation, allow any indent
// - Comma ","       → Next line is continuation, allow any indent
// - Operator "+/-"  → Next line is continuation, allow any indent

var a = Arrays.new(array.new<float>(),   // Ends with comma
            array.new<float>())           // ✅ Clearly continuation, 12 spaces OK
```

### Theory 3: Relative Depth Rule
TradingView might allow multiples of 4 if they're **beyond a certain depth**:

```pine
// At global scope (base = 0):
// - 4 spaces → Reject (could be block)
// - 8 spaces → Reject (could be nested block)
// - 12 spaces → Accept (too deep to be confused with blocks)
// - 16 spaces → Accept (definitely continuation)
```

---

## Investigation Steps for AI Agent

### Step 1: Analyze TradingView's Actual Rule

Test these patterns in TradingView to determine the exact rule:

```pine
//@version=6
indicator("Indentation Test")

// Test 1: 4-space continuation at global scope
a = func(x,
    y)  // 4 spaces - Does TradingView accept this?

// Test 2: 8-space continuation at global scope  
b = func(x,
        y)  // 8 spaces - Does TradingView accept this?

// Test 3: 12-space continuation at global scope
c = func(x,
            y)  // 12 spaces - We KNOW TradingView accepts this ✅

// Test 4: 16-space continuation at global scope
d = func(x,
                y)  // 16 spaces - Does TradingView accept this?

// Test 5: Inside function, 4-space continuation (base = 4)
myFunc() =>
    x = func(a,
        b)  // 8 spaces absolute (4 relative) - Does TradingView accept?

// Test 6: Inside function, 8-space continuation (base = 4)
myFunc2() =>
    x = func(a,
            b)  // 12 spaces absolute (8 relative) - Does TradingView accept?

plot(close)
```

**Test each pattern** and document:
- Does it compile in TradingView?
- Does it run without errors?
- What error (if any) does TradingView show?

---

### Step 2: Identify the Pattern

Based on testing, determine which theory is correct:

#### If Theory 1 (Position-Based):
```typescript
// Allow continuation at multiples of 4 if they're deep enough
if (wrapIndent % 4 === 0 && wrapIndent <= 8) {
  // Reject: Could be confused with block
} else {
  // Accept: Either non-multiple or deep enough
}
```

#### If Theory 2 (Syntax Context):
```typescript
// Check if previous line suggests continuation
const prevLine = lines[lineNum - 2];
const endsWithContinuationHint = 
  prevLine.trimEnd().endsWith('(') ||
  prevLine.trimEnd().endsWith(',') ||
  prevLine.trimEnd().endsWith('+') ||
  prevLine.trimEnd().endsWith('-');

if (endsWithContinuationHint) {
  // Allow any indentation - it's clearly a continuation
  return;
}

// Otherwise apply strict rules
if (wrapIndent % 4 === 0) {
  this.addError(...);
}
```

#### If Theory 3 (Relative Depth):
```typescript
// Allow multiples of 4 if relative offset > 8
if (wrapIndent % 4 === 0 && wrapIndent <= 8) {
  this.addError(...);
}
// Accept wrapIndent = 12, 16, 20... (deep enough)
```

---

### Step 3: Check for Other Contexts

TradingView might have **different rules for different contexts**:

1. **Global scope** (base = 0)
2. **Inside functions** (base = 4)  
3. **Inside nested blocks** (base = 8, 12, etc.)
4. **Inside expressions** (parentheses, brackets)

Test each context separately!

---

## Sibling Control Flow Issue (Separate but Related)

The validator also has issues with **sibling control flow statements**:

### Pattern from Lines 147-152

```pine
if activeChart
    if time==chart.left_visible_bar_time    // 4 spaces - Should be OK ✅
        v.top := high                        // 8 spaces - OK
    if time>chart.left_visible_bar_time      // 4 spaces - Should be OK ✅
        v.top := math.max(v.top,high)        // 8 spaces - OK
```

**Current Status**: 
- Recent fix was supposed to allow this
- But errors persist: "Statement should be indented with 8 spaces (block level), got 4"

**Issue**: The fix might not be working at **global scope** (only inside functions?)

---

## Proposed Solutions

### Solution A: Relax Multiple-of-4 Rule for Deep Indents

```typescript
// In validateWrapIndentation()
if (wrapIndent % 4 === 0) {
  // Allow if indent is deep enough (> 8 spaces)
  if (wrapIndent > 8) {
    // Accept: 12, 16, 20... spaces
    return;
  }
  
  this.addError(
    ...,
    `Line continuation cannot use ${wrapIndent} spaces`,
    'PSV6-INDENT-WRAP-MULTIPLE-OF-4'
  );
}
```

**Pros**: Simple, fixes the immediate issue  
**Cons**: Might not match TradingView's exact rule

---

### Solution B: Context-Aware Continuation Detection

```typescript
private isDefinitelyContinuation(lineNum: number): boolean {
  if (lineNum === 0) return false;
  
  const prevLine = this.lines[lineNum - 1];
  const trimmed = prevLine.trimEnd();
  
  // Check if previous line ends with continuation indicators
  return (
    trimmed.endsWith('(') ||  // Opening paren
    trimmed.endsWith(',') ||  // Comma
    trimmed.endsWith('+') ||  // Operator
    trimmed.endsWith('-') ||
    trimmed.endsWith('*') ||
    trimmed.endsWith('/') ||
    trimmed.endsWith('and') ||
    trimmed.endsWith('or')
  );
}

private validateWrapIndentation(...): void {
  // ... existing checks ...
  
  if (wrapIndent % 4 === 0) {
    // If definitely a continuation, allow any indent
    if (this.isDefinitelyContinuation(lineNum)) {
      return;  // Accept
    }
    
    this.addError(...);
  }
}
```

**Pros**: Matches syntax context theory, more accurate  
**Cons**: More complex, might miss edge cases

---

### Solution C: Make This a Warning, Not an Error

```typescript
if (wrapIndent % 4 === 0) {
  // Downgrade to warning since TradingView accepts it
  this.addWarning(
    ...,
    `Line continuation uses ${wrapIndent} spaces (multiple of 4). This works in TradingView but may be confusing.`,
    'PSV6-INDENT-WRAP-STYLE'
  );
}
```

**Pros**: Doesn't block valid code, provides guidance  
**Cons**: Doesn't fix the false positive, just changes severity

---

## Test Cases Required

### Test Case 1: Deep Continuation (12 spaces)
```pine
//@version=6
indicator("Test")
var a = Arrays.new(array.new<float>(),
            array.new<float>())

plot(close)
```
**Expected**: ✅ No errors (matches TradingView)

---

### Test Case 2: Shallow Continuation (4 spaces)
```pine
//@version=6
indicator("Test")
var a = func(x,
    y)

plot(close)
```
**Expected**: Test in TradingView first, then match its behavior

---

### Test Case 3: Inside Function (8 relative = 12 absolute)
```pine
//@version=6
indicator("Test")
myFunc() =>
    x = func(a,
            b)
    x

plot(myFunc())
```
**Expected**: Test in TradingView first, then match its behavior

---

### Test Case 4: Sibling Control Flow at Global Scope
```pine
//@version=6
indicator("Test")
if condition1
    if condition2
        value = 1
    if condition3
        value = 2

plot(close)
```
**Expected**: ✅ No errors for sibling if at 4 spaces

---

## Files to Modify

### Primary File
- **`core/ast/indentation-validator-ast.ts`**
  - Method: `validateWrapIndentation()`
  - Possibly: Add `isDefinitelyContinuation()` helper
  - Possibly: Update `isControlFlowBlockContext()` for global scope

### Test Files
- **`tests/ast/indentation-validator-ast.test.ts`**
  - Add: Test for 12-space continuation (should pass)
  - Add: Test for 4-space continuation (test in TV first)
  - Add: Test for 8-space continuation (test in TV first)
  - Update: Existing tests if rule changes

- **`tests/e2e/indentation-validation.test.ts`**
  - Add: Real-world Volume Profile patterns
  - Add: Various continuation depths

---

## Success Criteria

### Must Pass
1. ✅ Volume Profile 3D script validates without indentation errors
2. ✅ 12-space line continuations are accepted (proven to work in TV)
3. ✅ Sibling control flow at global scope is accepted
4. ✅ All existing valid indentation tests still pass

### Should Investigate
1. ❓ Test 4-space continuations in TradingView
2. ❓ Test 8-space continuations in TradingView
3. ❓ Test continuations inside different block depths
4. ❓ Determine TradingView's exact rule through experimentation

### Must Not Break
1. ✅ Should still reject continuations at 0 offset (same line)
2. ✅ Should still reject ambiguous indentation if truly ambiguous
3. ✅ Should still validate block indentation properly

---

## Debug Information

### Current Error Output (Volume Profile 3D)
```
Line 117, col 13: Line continuation cannot use 4 spaces of relative indentation
Line 118, col 13: Line continuation cannot use 4 spaces of relative indentation
Line 119, col 13: Line continuation cannot use 4 spaces of relative indentation
Line 120, col 13: Line continuation cannot use 4 spaces of relative indentation
```

**Analysis**:
- Error says "4 spaces of relative indentation"
- Actual indentation is **12 spaces absolute** (base 0 + 12)
- Error message is misleading - should say "12 spaces"
- But the core issue: TradingView accepts this pattern!

### Code Analysis
```pine
Lines 117-120 (actual spacing):
var a   = Arrays.new(array.new<float>(),
            array.new<float>(),    ← 12 spaces from column 0
            array.new<float>(),    ← 12 spaces from column 0
            array.new<float>())    ← 12 spaces from column 0
```

**Relative offset**: 12 spaces (from base indent 0)  
**Multiple of 4**: Yes (12 = 4 × 3)  
**TradingView accepts**: YES ✅  
**Validator accepts**: NO ❌ ← This is the bug

---

## Priority & Complexity

**Priority**: **HIGH**  
- Blocks validation of production TradingView scripts
- False positives reduce user confidence
- Multiple patterns affected (continuations + sibling control flow)

**Complexity**: **MEDIUM-HIGH**  
- Requires understanding TradingView's actual rule (experimentation needed)
- Multiple contexts to handle (global, function, nested)
- Must avoid breaking existing valid tests
- Need to coordinate with sibling control flow fix

**Estimated Effort**: 6-8 hours
- 2-3 hours: Test patterns in TradingView to determine exact rule
- 2-3 hours: Implement correct logic
- 2 hours: Test and prevent regressions
- 1 hour: Update documentation

---

## References

### TradingView Resources
- Style Guide: https://www.tradingview.com/pine-script-docs/language/style-guide
- Script Structure: https://www.tradingview.com/pine-script-docs/language/script-structure

### Related Fixes
- Leading-dot number fix: Successfully resolved parser crash
- Sibling control flow fix: Partially working (needs global scope fix)

---

**Status**: 🔴 **CRITICAL - FALSE POSITIVES**  
**Date Created**: 2025-01-05  
**Root Cause**: Validator rule doesn't match TradingView's actual behavior  
**Next Steps**: 
1. Test various indentation patterns in TradingView
2. Determine exact rule
3. Implement matching logic
4. Verify with real-world scripts
