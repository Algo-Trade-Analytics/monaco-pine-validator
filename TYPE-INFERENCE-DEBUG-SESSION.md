# Type Inference Debug Session Summary

**Date**: October 1, 2025  
**Status**: Root cause identified, but fix not working yet

---

## 🔍 Problem Summary

**Issue**: Tests are failing because `array.indexof()` returns `int`, but variables assigned from it are typed as `array`.

**Example**:
```pine
idx = array.indexof(arr, 5)
plot(idx)  // ERROR: expected series, got array
```

---

## 🎯 Root Causes Identified

### 1. Missing Return Types in Constants ✅ FIXED
- **Issue**: `array.indexof`, `array.lastindexof`, etc. were missing `returnType` in `BUILTIN_FUNCTIONS_V6_RULES`
- **Fix**: Added `returnType: 'int'` to array functions in `core/constants.ts`
- **Status**: ✅ Confirmed working - `BUILTIN_FUNCTIONS_V6_RULES['array.indexof'].returnType === 'int'`

### 2. Variable Type Registration ✅ FIXED  
- **Issue**: `handleVariableDeclaration` only registered collection types, not simple function return types
- **Fix**: Modified `modules/type-inference-validator.ts` lines 188-211 to register `initializerType`
- **Status**: ✅ Code updated

### 3. Type Inference Priority ✅ FIXED
- **Issue**: `getExpressionType` checked AST type environment BEFORE builtin return types
- **AST Environment** was inferring `array.indexof()` as type `'array'` based on namespace
- **Then early return** prevented checking the correct builtin return type
- **Fix**: Moved `CallExpression` builtin check to lines 561-570, BEFORE AST inference
- **Status**: ✅ Code updated

---

## ❌ Still Not Working!

Despite all fixes, `idx` is still typed as `'array'` instead of `'int'`.

### Theories

1. **Type Environment Override**: The AST type environment might be setting types during initial parsing, before validators run
2. **Module Order**: Another validator might be running after TypeInferenceValidator and overwriting types
3. **Context Sharing**: Multiple validators might be writing to `context.typeMap` without coordination
4. **Caching**: TypeScript/TSX might be caching old compiled code despite clearing node_modules/.cache

---

## 🔬 Debug Evidence

```typescript
// BUILTIN_FUNCTIONS_V6_RULES['array.indexof']
{
  parameters: [...],
  returnType: 'int'  // ✅ CORRECT
}

// result.typeMap.get('idx')
{
  type: 'array',  // ❌ WRONG - Should be 'int'
  isConst: false,
  isSeries: false,
  ...
}
```

---

## 🛠️ Attempted Fixes

1. ✅ Added `returnType` to constants
2. ✅ Fixed `handleVariableDeclaration` to register inferred types
3. ✅ Moved builtin return type check before AST inference
4. ✅ Cleared all caches
5. ❌ **Still failing**

---

## 🎯 Next Steps

### Option A: Add Comprehensive Debugging
Add `console.log` statements to trace:
1. What `getExpressionType` returns for `array.indexof()`
2. What `initializerType` is in `handleVariableDeclaration`
3. What gets registered in `context.typeMap`
4. If any other validator overwrites it

### Option B: Review Validator Execution Order
Check if:
1. ArrayValidator runs after TypeInferenceValidator
2. FunctionTypesValidator interferes
3. Type environment is built incorrectly during parsing

### Option C: Alternative Approach
Instead of fixing type inference, modify the function parameter validation to accept `int` where `series` is expected, since `int` is compatible with `series`.

---

## 💡 Key Insight

The fact that string and input functions already have return types and STILL have the same test failures suggests this is a SYSTEMATIC issue with how the type inference system works, not just missing return types.

**The type system might need a more fundamental refactoring to properly handle function return types.**

---

**Status**: Investigation paused - Need user decision on approach  
**Recommendation**: Add debug logging to trace exact execution flow

