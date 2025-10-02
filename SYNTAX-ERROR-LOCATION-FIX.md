# Syntax Error Location Fix

**Date:** October 2, 2025  
**Status:** ✅ Complete

## Problem

The initial syntax error handling implementation had two issues:

1. **Incorrect Location**: Errors were reported as line 1, column 1 instead of the actual error location
2. **Generic Message**: Error message was too vague ("Unexpected structure in code") instead of being specific

### Example

```pine
volSmooth = input.int(, "Vol Smoothing EMA", minval=1)  // Line 33
```

**Old Output:**
```
❌ PSV6-SYNTAX-PARSE-FAILED — line 1, column 1
   Syntax error: Unexpected structure in code
```

## Root Cause

The parser was crashing with a JavaScript error before it could report proper syntax error location:
- Error: `Cannot read properties of undefined (reading 'tokenTypeIdx')`
- Result: No line/column metadata, only error name
- Parser crash ⟹ no recovery ⟹ no accurate diagnostics

## Solution: Pre-Parser Syntax Checker

Added a **pattern-based pre-checker** that runs before the parser to catch common syntax errors with accurate location reporting.

### New Component: `syntax-pre-checker.ts`

**Location:** `core/ast/syntax-pre-checker.ts`

Scans source code for common syntax patterns:
- Empty first parameter: `func(, ...)`
- Empty middle parameter: `func(a, , b)`
- Trailing comma: `func(a, )`

### Integration

Modified `SyntaxErrorValidator` to run pre-checker first:

```typescript
// STEP 1: Run pre-parser syntax checks
const preCheckErrors = preCheckSyntax(this.sourceCode);
if (preCheckErrors.length > 0) {
  return errors; // Return immediately with accurate errors
}

// STEP 2: If no pre-check errors, proceed with parser
```

## Results

### After Fix

```
✅ PSV6-SYNTAX-EMPTY-PARAM — line 33, column 16
   Missing parameter in input.int() call
   💡 input.int() requires a default value as the first parameter.
      Example: input.int(10, "Label", ...)
```

### Improvements

| Aspect | Before | After |
|--------|--------|-------|
| **Line Number** | ❌ 1 (wrong) | ✅ 33 (correct) |
| **Column Number** | ❌ 1 (wrong) | ✅ 16 (correct) |
| **Message** | ❌ Generic | ✅ Specific to issue |
| **Suggestion** | ❌ Generic | ✅ Context-aware |
| **Error Count** | ❌ Could cascade | ✅ Only 1 error |

## Test Coverage

All test scenarios passing:

1. ✅ Empty first parameter in `input.int(,`
2. ✅ Empty middle parameter in `func(a, , b)`
3. ✅ Trailing comma in `func(a, )`
4. ✅ Valid code passes without issues

## Technical Details

### Pattern Detection

The pre-checker uses regex patterns to detect common syntax errors:

```typescript
{
  pattern: /(\w+(?:\.\w+)?)\s*\(\s*,/,  // Matches: func(, ...
  code: 'PSV6-SYNTAX-EMPTY-PARAM',
  message: (match) => `Missing parameter in ${match[1]}() call`,
  suggestion: (match) => {
    if (match[1].startsWith('input.')) {
      return `${match[1]}() requires a default value...`;
    }
    return `Function calls cannot have empty parameters...`;
  }
}
```

### Context-Aware Suggestions

The pre-checker provides specialized suggestions based on the function being called:
- `input.*()` functions get specific guidance about default values
- Generic functions get general parameter guidance

## Benefits

1. **Accurate Location** - Points to the exact line and column of the error
2. **Clear Message** - Specifically describes what's wrong
3. **Helpful Suggestions** - Provides context-specific guidance
4. **Early Detection** - Catches errors before parser crashes
5. **No Cascading** - Returns immediately, preventing downstream false errors

## Future Enhancements

Potential additions to the pre-checker:
- Missing closing braces/brackets
- Invalid operators
- Malformed string literals
- Type annotation errors
- Common typos in keywords

## Files Changed

1. **Created:** `core/ast/syntax-pre-checker.ts` - Pattern-based syntax checker
2. **Modified:** `modules/syntax-error-validator.ts` - Added pre-checker integration
3. **Updated:** `SYNTAX-ERROR-IMPROVEMENT-PLAN.md` - Marked as complete
4. **Created:** `IMPLEMENTATION-SUMMARY.md` - Overall implementation docs

## Conclusion

The pre-parser syntax checker successfully addresses the location and clarity issues in syntax error reporting, providing a significantly better developer experience.

