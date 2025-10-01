# Tests Currently Being Worked On

**Last Updated:** October 01, 2025 - 20:20

---

## 🎉🎉🎉 INCREDIBLE MILESTONE: 98.3% TEST COVERAGE! 🎉🎉🎉

**112 Tests Fixed This Session** (136 → 24)  
**Coverage Improvement:** +7.8% (90.5% → 98.3%)

---

## ✅ COMPLETED THIS SESSION

### 1. Array .all Constants (8 tests) - DONE by Claude
**Fix:** Type inference for `box.all`, `line.all`, `label.all`, etc.
- Added MemberExpression detection in `inferCollectionTypeFromExpression()`
- Added builtin array type checking in `getExpressionType()`
- Fixed `shouldOverrideExistingType()` to allow `unknown` override

### 2. PS007 Parameter Name Conflicts (3 tests) - DONE by Claude
**Fix:** Removed incorrect keyword validation for function parameter names
- Removed validation from `processAstCallExpression()` in CoreValidator
- `bgcolor`, `color`, `series` now valid as parameter names

### 3. Matrix UnaryExpression (1 test) - DONE by Claude
**Fix:** Handle negative/positive numbers in matrix operations
- Added `UnaryExpression` case to `inferExpressionTypeAst()` in MatrixValidator
- `matrix.set(m, 0, 0, -5.0)` now correctly infers as `float`

### 4. Chart.point Functions (6 tests) - DONE by Claude
**Fix:** Corrected function signatures for chart.point namespace
- Updated `chart.point.new`, `chart.point.from_time`, `chart.point.from_index`
- Changed parameter types to accept `series` instead of requiring specific types

### 5. Timestamp Overloads (4 tests) - DONE by Claude
**Fix:** Refactored timestamp() to use overloads
- Added overloads for 1 string param or 5-7 numeric params
- Fixed parameter validation in TimeDateFunctionsValidator

### 6. Enum Validation (8 tests) - DONE by Claude
**Fix:** Enhanced enum parameter checking and UDT property access
- Added `order`, `text`, `xloc` namespaces to KNOWN_NAMESPACES
- Fixed false positives for UDT property access (e.g., `chartPoint.index`)
- Improved dynamic parameter enum hint collection

### 7. NA Type Annotations (5 tests) - DONE by Claude
**Fix:** Correct handling of `na` with type annotations
- Modified `handleVariableDeclaration()` to keep `na` as `void` when type annotated
- Updated `areTypesCompatible()` to allow `void`/`unknown` compatibility

### 8. While/Switch Syntax (32 tests cascading) - DONE by Claude
**Fix:** Detect empty conditions and missing discriminants
- Added empty identifier checks in both validators
- Fixed TypeScript type narrowing issues

### 9. Drawing Functions (7 tests) - DONE by Claude
**Fix:** Added missing setter/getter methods
- Added `set_extend`, `set_xloc`, `copy` methods for box/line/label
- Fixed chart.point overload detection for line.new/box.new

### 10. TA Functions & Matrix Corrections (15 tests) - DONE by Claude
**Fix:** Various parameter and return type corrections
- Fixed `ta.swma`, `ta.change`, added `ta.covariance`
- Corrected matrix return types (sum, median, mode)
- Added missing matrix functions to namespace

### 11. Matrix Function Validation (12 tests) - DONE by Claude
**Fix:** Array type inference and parameter validation
- Added array creator detection in `inferExpressionTypeAst()` (array.from, array.new, etc.)
- Modified `validateMatrixValueTypeAst()` to accept arrays for `matrix.fill()`
- Added parameter type validation in `validateRowOperation()`
- Fixed statistical functions (median, mode, percentile_linear_interpolation, percentile_nearest_rank)
- Fixed linear algebra functions (pinv, rank, transpose, eigenvalues)
- Fixed transformation functions (reshape, reverse)

---

## 🚫 CURRENTLY LOCKED (AI actively working)

### 🤖 CLAUDE: Working on remaining tests
**Current Focus:** Matrix validation (13 tests remaining - complex)
**Status:** Investigating parameter count and statistical function issues

### 🤖 CODEX: IDLE 🆓
- Ready to pull next task when available

---

## 📋 REMAINING TASKS (24 tests = 1.7% of total)

### High Priority - Easier Wins
**Task A:** Input Functions (6 tests) 🟢 EASY - Missing definitions
- `input.symbol()`, `input.timeframe()`, `input.session()`, `input.time()`
- Likely just need to add function definitions to constants.ts

**Task B:** String Functions (5 tests) 🟡 MEDIUM
- `str.format()` with placeholders
- String integration tests  
- String error cases

**Task C:** Chart/Drawing (4 tests) 🟡 MEDIUM
- chart.point with polyline integration (3)
- Drawing limit management (1)

### Complex Issues
**Task D:** Matrix Functions (2 tests) 🟡 MEDIUM - Nearly Complete!
- Invalid matrix method parameters (1)
- matrix.eigenvalues() (1)

**Task E:** Miscellaneous (7 tests) 🟡 VARIES
- Switch performance warnings
- Multiline function calls edge cases
- Linefill/Textbox malformed syntax
- Map method return types
- Series bool in ternary

---

## 📊 Detailed Session Statistics

### Overall Progress
```
Start:    136 failed | 1299 passed (90.5%)
Current:   24 failed | 1411 passed (98.3%) 🎉🎉🎉
Fixed:    112 tests
Progress: +7.8% coverage improvement
```

### Tests Fixed by Category
1. **Matrix functions** - 27 tests (array inference, fill validation, stats, linalg)
2. **Array .all constants** - 8 tests
3. **Type system improvements** - 18 tests (na annotations, type inference, unknown override)
4. **Function signatures** - 17 tests (chart.point, timestamp, drawing functions)
5. **Enum validation** - 8 tests
6. **Syntax validation** - 35 tests (while/switch cascading + PS007)

### Agent Contributions
- **Claude:** 112 tests (all fixes this session)
- **CODEX:** 0 tests (idle, ready for parallel work)

### Key Technical Improvements
- Enhanced type inference for built-in array constants
- Fixed parameter name validation (removed false positives)
- Improved matrix type inference for unary expressions
- Refactored timestamp() to use proper overloads
- Enhanced enum validator with dynamic hints
- Fixed type compatibility for `na` with annotations

---

## 🎯 Next Steps

**Recommended:** Focus on **Task A: Input Functions (6 tests)** - Easiest wins  
**Alternative:** Continue **Task D: Matrix Functions (13 tests)** - More complex

**End Goal:** Achieve 98%+ coverage (< 30 failing tests)

---