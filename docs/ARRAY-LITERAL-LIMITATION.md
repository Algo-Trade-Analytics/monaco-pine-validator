# Array Literal Parser Limitation

## Issue Summary

**Status:** Known Limitation  
**Severity:** Medium  
**Affects:** Pine Script v6 array literals as function return values  
**Date Identified:** October 4, 2025

## Problem Description

The Pine Script validator currently **cannot parse array literals when they appear as the implicit return value of a function with an indented body**.

### Working Examples

✅ **Inline array literal return:**
```pine
f_test() => [1.0, 2.0, 3.0]
```

✅ **Array literal in variable declaration:**
```pine
array<float> arr = [1.0, 2.0, 3.0]
```

✅ **Array literal in assignment:**
```pine
arr = [1.0, 2.0, 3.0]
```

### Failing Examples

❌ **Indented array literal return:**
```pine
f_test() =>
    [1.0, 2.0, 3.0]
```

❌ **Complex function with array literal return:**
```pine
f_basis(float yawOff, float pitchOff) =>
    float phi = (yawDeg + yawOff) * math.pi / 180
    float pit = pitchOff * math.pi / 180
    float ux = math.cos(phi), float uy = math.sin(phi), float uz = 0.0
    float nx = -uy, float ny = ux
    float vx = nx * math.sin(pit), float vy = ny * math.sin(pit), float vz = math.cos(pit)
    [ux, uy, uz, vx, vy, vz]  // ❌ Parser fails here
```

## Error Messages

- `PSV6-SYNTAX-PARSE-FAILED — line 1, column 1: Syntax error: Unexpected structure in code`
- Parser reports: `Expecting ... but found: '['`

## Root Cause Analysis

### Parser Flow for Indented Function Bodies

1. **Function declaration parsed:** `f_basis(...) =>`
2. **Newline detected:** Parser calls `parseIndentedBlock()` to parse function body
3. **Indented block parser expects statements:** The `parseIndentedBlock()` method calls `statement` rule
4. **Statement parser encounters `[`:** The `statement` rule tries to match various statement types
5. **Tuple assignment check:** Before falling through to `expressionStatement`, it checks if this is a tuple assignment like `[a, b] = [1, 2]`
6. **Parser confusion:** The parser attempts multiple alternatives and all fail

### Why Inline Works

When the array literal is inline (`f() => [1.0, 2.0, 3.0]`), the parser:
1. Detects NO newline after `=>`
2. Directly calls `parser.expression` (not `parseIndentedBlock`)
3. `expression` → `primaryExpression` → `bracketExpression` (LBracket case)
4. ✅ Successfully parses the array literal

### Why Indented Fails

When the array literal is indented, the parser:
1. Detects newline after `=>`
2. Calls `parseIndentedBlock()` which expects statements
3. `statement` rule encounters `[` and tries:
   - Script declaration? No
   - Function? No
   - If/while/for/switch? No
   - Variable declaration? No (guard fails)
   - Tuple assignment? Checks ahead, no `=` found
   - Assignment? No identifier before `[`
   - Expression statement? **Should work but doesn't**
4. ❌ Parser fails before reaching expression statement alternative

## Technical Details

### Affected Code

- **File:** `core/ast/parser/rules/declarations.ts`
- **Function:** `createFunctionDeclarationRule`
- **Lines:** ~188-195

```typescript
if (parser.lookAhead(1).tokenType === Newline) {
  body = parser.parseIndentedBlock(tokenIndent(blockIndentToken));  // ← Uses statement parser
} else {
  const expression = parser.invokeSubrule(parser.expression) ?? createPlaceholderExpression();  // ← Works!
  const endToken = parser.lookAhead(0);
  const returnStatement = createImplicitReturnStatementNode(expression, arrowToken);
  body = createBlockStatementNode([returnStatement], arrowToken, endToken);
}
```

- **File:** `core/ast/parser/rules/statements.ts`
- **Function:** `createStatementRule`
- **Issue:** The `expressionStatement` alternative (line 132) is the **fallback**, but the parser fails before reaching it

### Chevrotain Parser Behavior

The issue involves Chevrotain's `OR` alternatives with guards (`GATE` functions):
- Multiple gates are checked in order
- If all gates fail and the fallback is reached, Chevrotain's error recovery may have already triggered
- With `recoveryEnabled: true` and `maxLookahead: 1`, the parser may not correctly backtrack

## Test Coverage

### Passing Tests (530/530)

All current validator tests pass because they don't include this specific pattern:
- ✅ Tuple destructuring with holes: `[fast,, slow] = ta.macd(...)`
- ✅ Array literals in declarations: `array<float> arr = [1.0, 2.0]`
- ✅ Inline function returns: `f() => [1, 2, 3]`
- ✅ Matrix literals: `[[1, 2], [3, 4]]`

### Missing Test Case

❌ **Not covered:** Indented function body returning array literal

## Workarounds

### For Users

**Option 1: Use inline syntax**
```pine
f_basis(float yawOff, float pitchOff) => [ux, uy, uz, vx, vy, vz]
```

**Option 2: Explicit return statement**
```pine
f_basis(float yawOff, float pitchOff) =>
    float phi = (yawDeg + yawOff) * math.pi / 180
    float pit = pitchOff * math.pi / 180
    float ux = math.cos(phi), float uy = math.sin(phi), float uz = 0.0
    float nx = -uy, float ny = ux
    float vx = nx * math.sin(pit), float vy = ny * math.sin(pit), float vz = math.cos(pit)
    var result = [ux, uy, uz, vx, vy, vz]
    result  // Implicit return of variable instead of literal
```

**Option 3: Use `array.from()`**
```pine
f_basis(float yawOff, float pitchOff) =>
    float phi = (yawDeg + yawOff) * math.pi / 180
    // ... calculations ...
    array.from(ux, uy, uz, vx, vy, vz)
```

### For TradingView

This syntax **IS VALID** in TradingView Pine Script and works correctly. The limitation is only in this validator.

## Attempted Fixes

### Attempt 1: Refactor `bracketExpression` Rule

**Approach:** Simplified the `bracketExpression` parsing logic to use occurrence indices like other list-parsing rules.

**Changes:**
- Changed from complex `while(true)` loop with state tracking to simpler pattern
- Added explicit occurrence `2` for repeated `expression` subrules
- Improved empty element handling

**Result:** 
- ❌ Still failed for indented array literals
- ❌ Broke tuple parsing with holes (`[fast,, slow]`)
- ✅ Inline array literals continued to work

**Reason for failure:** The issue is not in `bracketExpression` itself, but in how `parseIndentedBlock` calls the `statement` rule, which doesn't properly fall through to `expressionStatement` for array literals.

### Why Simple Fixes Don't Work

1. **Can't just disable tuple assignment guard:** Breaks valid tuple assignment parsing
2. **Can't change expression occurrence without breaking:** Chevrotain requires unique occurrences in loops
3. **Can't disable error recovery:** Breaks parser's ability to recover from real syntax errors

## Potential Solutions

### Solution 1: Fix Statement Rule Priority

**Approach:** Modify the `statement` rule to check for expression statements earlier in the OR alternatives.

**Risk:** Medium - could break existing statement parsing

**Implementation:**
```typescript
// In createStatementRule, add before tuple assignment check:
{
  GATE: () => parser.lookAhead(1).tokenType === LBracket && !parser.isTupleAssignmentStart(),
  ALT: () => parser.invokeSubrule(parser.expressionStatement),
},
```

### Solution 2: Make `parseIndentedBlock` Accept Expressions

**Approach:** Allow `parseIndentedBlock` to recognize single-line expressions as implicit returns.

**Risk:** High - fundamental change to block parsing logic

**Implementation:**
- Check if indented block contains only single line
- If so, parse as expression instead of statement
- Wrap in implicit return

### Solution 3: Improve Expression Statement Recognition

**Approach:** Make the expression statement guard more explicit about accepting `[`.

**Risk:** Low - focused change

**Implementation:**
```typescript
{
  GATE: () => {
    const tokenType = parser.lookAhead(1).tokenType;
    return tokenType === LBracket || /* other expression starts */;
  },
  ALT: () => parser.invokeSubrule(parser.expressionStatement),
},
```

## Recommendation

**Recommended Solution:** Solution 3 (Improve Expression Statement Recognition)

**Rationale:**
- Lowest risk
- Most focused fix
- Doesn't break existing functionality
- Clear intent

**Next Steps:**
1. Add failing test case for indented array literal returns
2. Implement Solution 3
3. Verify all 530 existing tests still pass
4. Verify new test passes
5. Document in changelog

## Related Issues

- **Tuple Assignment Parsing:** Works correctly
- **Matrix Literal Parsing:** Works correctly
- **Inline Function Returns:** Works correctly
- **Indented Expression-Form Functions:** Only array literals fail; other expressions work

## Impact Assessment

**Users Affected:** Low-Medium
- Users who write functions returning array literals with indented bodies
- Users following TradingView examples that use this pattern
- Users migrating scripts from TradingView to validator

**Severity Justification (Medium):**
- Valid TradingView syntax is rejected
- Simple workaround exists (inline syntax)
- Doesn't affect most common use cases
- Not a data-loss or security issue

## References

- Pine Script v6 Spec: Array literals are valid expressions
- TradingView Documentation: Shows array literals as function returns
- Chevrotain Documentation: OR alternatives and GATE functions
- Related Parser Files:
  - `core/ast/parser/rules/expressions.ts` (bracketExpression)
  - `core/ast/parser/rules/declarations.ts` (functionDeclaration)
  - `core/ast/parser/rules/statements.ts` (statement rule)
  - `core/ast/parser/helpers.ts` (parseIndentedBlock, guards)

---

**Last Updated:** October 4, 2025  
**Documented By:** AI Assistant  
**Status:** Open - Awaiting Fix

