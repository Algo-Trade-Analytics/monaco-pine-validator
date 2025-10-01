# Return Types Fix Plan

## 🎯 Root Cause Found!

The validator's `BUILTIN_FUNCTIONS_V6_RULES` registry in `core/constants.ts` is missing `returnType` properties for **100+ functions**. This causes type inference to fail, resulting in 151 test failures.

## 📊 Missing Return Types by Category

### Array Functions (Missing ~25 return types)
- `array.indexof` → should return `'int'`
- `array.lastindexof` → should return `'int'`
- `array.remove` → should return `'void'`
- `array.insert` → should return `'void'`
- `array.reverse` → should return `'void'`
- `array.sort` → should return `'void'`
- `array.copy` → should return `'array'`
- `array.slice` → should return `'array'`
- `array.min` → should return `'series'`
- `array.max` → should return `'series'`
- `array.sum` → should return `'series'`
- `array.avg` → should return `'series'`
- `array.median` → should return `'series'`
- `array.mode` → should return `'series'`
- `array.variance` → should return `'series'`
- `array.stdev` → should return `'series'`
- `array.range` → should return `'series'`
- `array.covariance` → should return `'series'`
- `array.percentile_linear_interpolation` → should return `'series'`
- `array.percentile_nearest_rank` → should return `'series'`
- `array.percentrank` → should return `'series'`
- `array.first` → should return `'element'`
- `array.last` → should return `'element'`
- `array.binary_search` → should return `'int'`
- `array.binary_search_leftmost` → should return `'int'`
- `array.binary_search_rightmost` → should return `'int'`
- `array.includes` → should return `'bool'`
- `array.join` → should return `'string'`

### String Functions (Missing ~15 return types)
- `str.length` → should return `'int'`
- `str.contains` → should return `'bool'`
- `str.startswith` → should return `'bool'`
- `str.endswith` → should return `'bool'`
- `str.pos` → should return `'int'`
- `str.substring` → should return `'string'`
- `str.replace` → should return `'string'`
- `str.replace_all` → should return `'string'`
- `str.split` → should return `'array'`  (array of strings)
- `str.upper` → should return `'string'`
- `str.lower` → should return `'string'`
- `str.trim` → should return `'string'`
- `str.repeat` → should return `'string'`
- `str.format` → should return `'string'`
- `str.format_time` → should return `'string'`
- `str.match` → should return `'bool'`
- `str.tostring` → should return `'string'`
- `str.tonumber` → should return `'float'`

### Input Functions (Missing ~15 return types)
- `input.int` → should return `'input'`
- `input.float` → should return `'input'`
- `input.bool` → should return `'input'`
- `input.string` → should return `'input'`
- `input.color` → should return `'input'`
- `input.source` → should return `'input'`
- `input.timeframe` → should return `'input'`
- `input.session` → should return `'input'`
- `input.symbol` → should return `'input'`
- `input.enum` → should return `'input'`
- `input.price` → should return `'input'`
- `input.time` → should return `'input'`
- `input.text_area` → should return `'input'`
- `input.resolution` → should return `'input'` (deprecated, use input.timeframe)

## 🛠️ Implementation Strategy

### Step 1: Add Missing Return Types
Modify `core/constants.ts` to add `returnType` property to all missing functions.

### Step 2: Verify Type Propagation
Ensure `TypeInferenceValidator.getBuiltinReturnType()` correctly retrieves these return types.

### Step 3: Fix Variable Declaration Registration
Ensure `handleVariableDeclaration()` registers the inferred type even when there's no explicit type annotation.

## 🎯 Expected Impact

This single fix should resolve:
- **~22 array utility function tests**
- **~7 string utility function tests**  
- **~17 input utility function tests**
- **Total: ~46 tests fixed** (31% of remaining failures)

Plus cascading fixes in integration tests that depend on correct type inference.

## ✅ Success Criteria

After the fix:
- `array.indexof()` should return `'int'`, not `null`
- Variables assigned from function calls should have correct types
- `plot(idx)` where `idx = array.indexof(arr, 5)` should validate successfully

---

**Status**: Ready to implement  
**Next Action**: Modify `core/constants.ts` to add all missing return types

