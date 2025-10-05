# Complex If-Else Parsing Issue

## Problem Description

The Pine Script validator has an issue with complex `if-else` structures where multiple `if` statements are nested within the initial `if` block, followed by an `else` clause.

### Example Problematic Pattern

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
    if bar_index>prd
        v.start += 1
    a.CandlestickData()
    if a.v.size()>prd
        a.CandlestickDataClean()
```

### Current Behavior

The validator incorrectly flags the statements inside the `else` block as indentation errors:

```
PSV6-INDENT-BLOCK-MISMATCH — line 149, column 5
If statement should be at indent 8, got 4

PSV6-INDENT-BLOCK-MISMATCH — line 152, column 5  
If statement should be at indent 8, got 4
```

### Root Cause

The issue is in the AST parsing and indentation validation logic:

1. **Parser Issue**: The `else` clause is being incorrectly associated with the last `if` statement in the block rather than the initial `if` statement.

2. **Context Setup Issue**: The indentation context for the `else` block is not being set up correctly when there are multiple `if` statements in the parent block.

3. **Parent Block Indent Calculation**: The `parentBlockIndent` calculation is not working correctly for complex nested structures.

### Technical Details

**File**: `core/ast/indentation-validator-ast.ts`

**Method**: `validateIfStatement()` and related context setup

**Issue**: The `else` block context setup assumes a simple `if-else` structure, but doesn't handle the case where the `if` block contains multiple sibling `if` statements.

### Current Status

- ✅ **Fixed**: Simple `if-else` structures work correctly
- ✅ **Fixed**: 4-space continuation errors with context-aware detection  
- ✅ **Fixed**: Switch case expressions with `=>` operator
- ✅ **Fixed**: Simple sibling control flow patterns
- ⚠️ **Remaining**: Complex `if-else` structures with multiple nested `if` statements

### Workaround

For scripts with this pattern, the indentation errors can be ignored as they are false positives. The script will work correctly in TradingView despite the validator errors.

### Future Fix Required

The fix requires:

1. **Parser Enhancement**: Update the AST parser to correctly associate `else` clauses with the appropriate `if` statement in complex structures.

2. **Context Management**: Improve the indentation context setup to handle nested `if` statements correctly.

3. **Parent Block Indent Logic**: Fix the `parentBlockIndent` calculation for complex nested structures.

### Test Cases

**Working (Simple)**:
```pine
if true
    a := 1
else
    v.top := hi
    if bar_index > 10
        v.start := 1
```

**Not Working (Complex)**:
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

### CLI Validator

Use the CLI validator to test scripts:

```bash
npx tsx validate-script.js your-script.pine
```

This will show indentation errors separately from other validation errors for easier debugging.
