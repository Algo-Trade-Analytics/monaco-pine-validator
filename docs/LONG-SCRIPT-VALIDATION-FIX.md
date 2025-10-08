# Long Script Validation Fix

## Issue
Validation was not working properly for long Pine Script files. Errors that were detected in short scripts were not being caught in longer scripts.

### Example
```pine
// This produced errors in short scripts but not in long scripts:
localPivots = ta.pivot_point_levels(pivotTypeInput, localPivotTimeframeChange)
securityPivotPointsArray = ta.pivot_point_levels(pivotTypeInput, 
securityPivotTimeframeChange)
```

## Root Cause
When parsing long scripts with syntax errors, the AST parser would produce an AST with some `undefined` or `null` statement nodes. The AST post-processing functions (`buildScopeGraph`, `inferTypes`, `buildControlFlowGraph`) did not have proper guards against these malformed nodes.

When these functions encountered `undefined` nodes, they would throw exceptions like:
```
TypeError: Cannot read properties of undefined (reading 'kind')
```

These exceptions were caught in `BaseValidator.parseAst()`, which would then set `context.ast = null`, effectively disabling all AST-based validation including:
- Indentation validation
- Function parameter validation  
- Type checking
- And many other checks

## Solution
Added defensive null/undefined checks in three AST processing modules:

### 1. `core/ast/scope.ts` - Scope Graph Builder
- Added guard in `visitStatement()` to skip undefined/null statements
- Added filtering in `visitProgram()` to skip undefined array elements

### 2. `core/ast/type-inference.ts` - Type Inference
- Added guard in `visitStatement()` to skip undefined/null statements
- Added filtering in `visitBlock()` and main program loop

### 3. `core/ast/control-flow.ts` - Control Flow Graph Builder
- Added guard in `buildStatement()` to return placeholder for undefined/null statements
- Added skip logic in `buildStatements()` loop

## Impact
- ✅ Validation now works consistently on scripts of any size
- ✅ AST-based validators can now handle scripts with syntax errors gracefully
- ✅ Errors are properly reported even when the parser encounters issues
- ✅ No breaking changes to the API or existing functionality

## Testing
Tested with a 665-line strategy script that previously showed 0 errors. After the fix:
- Correctly reports 10 errors including indentation issues
- Properly validates function calls and parameters
- AST processing completes successfully despite 33 syntax errors from the parser

## Files Changed
1. `/Users/egr/Desktop/TradeSync/pine-validator/core/ast/scope.ts`
2. `/Users/egr/Desktop/TradeSync/pine-validator/core/ast/type-inference.ts`
3. `/Users/egr/Desktop/TradeSync/pine-validator/core/ast/control-flow.ts`

