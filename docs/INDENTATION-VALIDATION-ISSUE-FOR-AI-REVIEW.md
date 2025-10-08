# Pine Script Indentation Validation Issue - AI Review Request

## Executive Summary

The Pine Script validator has a **complex if-else parsing issue** where indentation validation fails for specific nested control flow structures. While most indentation patterns work correctly, there's a remaining edge case that requires deeper AST parsing fixes.

## Current Status

### ✅ **Fixed Issues**
- **4-space continuations with context**: Lines like `array.new<float>(),` followed by 4-space indented continuations now work
- **Switch case expressions**: Switch cases with `=>` operator are correctly allowed at 4+ spaces
- **Simple sibling control flow**: Regular statements in control flow contexts work correctly
- **Context-aware continuation detection**: Continuation hints (operators, commas, etc.) are properly detected

### ⚠️ **Remaining Issue**
- **Complex if-else structures**: Specific nested `if` statement patterns cause false positive indentation errors

## Problem Description

### The Failing Pattern

```pine
if activeChart
    if time==chart.left_visible_bar_time  // First nested if
        v.top := high
        v.bot := low
        v.start := bar_index
        a.CandlestickData()
    if time>chart.left_visible_bar_time   // Second nested if (sibling to first)
        v.top := math.max(v.top,high)
        v.bot := math.min(v.bot,low)
        a.CandlestickData()
else  // This else should be associated with the first if, not the second if
    v.top := hi
    v.bot := lo
    if bar_index>prd          // ← ERROR: Line 149, column 5
        v.start += 1
    a.CandlestickData()
    if a.v.size()>prd         // ← ERROR: Line 152, column 5
        a.CandlestickDataClean()
```

### Error Messages
```
PSV6-INDENT-BLOCK-MISMATCH — line 149, column 5
If statement should be at indent 8, got 4

PSV6-INDENT-BLOCK-MISMATCH — line 152, column 5
If statement should be at indent 8, got 4
```

### What Should Happen
The statements inside the `else` block should be **allowed at 4 spaces** because they are sibling statements within the `else` block context.

## Technical Analysis

### Root Cause
The issue is in the **AST parsing and indentation context setup** for complex `if-else` structures:

1. **Parser Association Issue**: The `else` clause is being incorrectly associated with the last `if` statement in the block rather than the initial `if` statement.

2. **Context Setup Problem**: The indentation context for the `else` block is not being set up correctly when there are multiple `if` statements in the parent block.

3. **Parent Block Indent Calculation**: The `parentBlockIndent` calculation fails for complex nested structures.

### Key Files
- **Primary**: `core/ast/indentation-validator-ast.ts`
- **Secondary**: `core/ast/parser/rules/statements.ts` (if-else parsing)

### Current Logic (Problematic)
```typescript
// In validateIfStatement()
if (node.alternate.kind === 'IfStatement') {
    // else-if: validate at the same block level as the original if
    this.validateNode(node.alternate);
} else {
    // else: validate the body with indentation
    const prevContext = this.context;
    this.context = {
        blockIndent: headerIndent + 4,
        expectedBlockIndent: headerIndent + 4,
        inBlock: true,
        blockType: 'else',
        parentContext: prevContext
    };
    this.validateBlock(node.alternate, headerIndent + 4);
    this.context = prevContext;
}
```

### Sibling Statement Logic (Current)
```typescript
// Allow both block statements and regular statements at parent block indent + 4 in control flow contexts
const allowSiblingAtParentIndent =
    this.isControlFlowBlockContext() &&
    parentBlockIndent !== null &&
    parentBlockIndent >= 0 &&
    stmtIndent === parentBlockIndent + 4;
```

## Test Cases

### ✅ **Working (Simple)**
```pine
if true
    a := 1
else
    v.top := hi
    if bar_index > 10
        v.start := 1
```
**Result**: No indentation errors

### ❌ **Not Working (Complex)**
```pine
if activeChart
    if time==chart.left_visible_bar_time
        v.top := high
    if time>chart.left_visible_bar_time
        v.top := math.max(v.top,high)
else
    v.top := hi
    if bar_index>prd
        v.start += 1
```
**Result**: 2 indentation errors on the `if` statements inside the `else` block

## Debugging Information

### CLI Validator
Use the provided CLI validator to test:
```bash
npx tsx validate-script.js your-script.pine
```

### Context Debugging
The issue can be reproduced by:
1. Creating a script with the complex if-else pattern above
2. Running the CLI validator
3. Observing the false positive indentation errors

### Expected vs Actual Behavior
- **Expected**: Statements inside `else` block at 4 spaces should be valid
- **Actual**: Validator flags them as needing 8 spaces
- **TradingView**: Accepts the 4-space indentation as valid

## Potential Solutions

### Option 1: Fix Parser Association
Update the AST parser to correctly associate `else` clauses with the appropriate `if` statement in complex structures.

### Option 2: Improve Context Management
Enhance the indentation context setup to handle nested `if` statements correctly by:
- Better tracking of `if` statement nesting levels
- Correct parent context inheritance for `else` blocks
- Improved `parentBlockIndent` calculation

### Option 3: Special Case Handling
Add special case logic for complex `if-else` structures in the indentation validator.

## Impact Assessment

### Severity: **Medium**
- **Scope**: Affects specific complex `if-else` patterns only
- **Frequency**: Rare in typical Pine Script code
- **Workaround**: Scripts work correctly in TradingView despite validator errors

### User Impact
- **False positives**: Users see indentation errors for valid code
- **Confusion**: Users may incorrectly "fix" valid indentation
- **Trust**: Reduces confidence in validator accuracy

## Files to Review

### Primary Investigation
1. `core/ast/indentation-validator-ast.ts` - Lines 560-580 (if-else context setup)
2. `core/ast/indentation-validator-ast.ts` - Lines 452-460 (sibling statement logic)
3. `core/ast/parser/rules/statements.ts` - If-else parsing rules

### Secondary Investigation
1. `core/ast/parser/rules/control-flow.ts` - Control flow parsing
2. `core/ast/indentation-validator-ast.ts` - AST-based indentation checks

## Success Criteria

### Fix Validation
- Complex if-else structures should not generate indentation errors
- Simple if-else structures should continue to work
- Other indentation patterns should remain unaffected

### Maintain Compatibility
- No regressions in existing working patterns
- All current tests should continue to pass
- CLI validator should show improved results

## Testing Strategy

### Test Cases to Verify
1. **Complex if-else pattern** (should pass)
2. **Simple if-else pattern** (should continue to pass)
3. **4-space continuations** (should continue to pass)
4. **Switch case expressions** (should continue to pass)
5. **Other indentation patterns** (should continue to pass)

### CLI Validator Usage
```bash
# Test the problematic pattern
npx tsx validate-script.js complex-if-else-test.pine

# Should show: 0 indentation errors
```

## Conclusion

This is a **parser-level issue** that requires understanding of:
1. How Pine Script AST represents complex if-else structures
2. How indentation contexts are managed for nested control flow
3. How parent-child relationships are established in the AST

The fix likely requires changes to both the **AST parsing logic** and the **indentation validation logic** to correctly handle the complex if-else association and context setup.

**Priority**: Medium (edge case, but affects validator accuracy)
**Complexity**: High (requires deep AST understanding)
**Risk**: Medium (could introduce regressions if not handled carefully)
