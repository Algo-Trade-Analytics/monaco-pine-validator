# TDD Test Cleanup Plan

*Generated: October 3, 2025*
*Based on test alignment analysis against official Pine Script v6 documentation*

## 📊 Overview

**Test Files Scanned**: 165  
**Files with Issues**: 46  
**Total Issues**: 620

### Issue Breakdown
- 🔴 **599 Errors**: Tests validating non-existent Pine Script members
- 🟡 **6 Warnings**: Tests for metadata artifacts
- 🔵 **15 Info**: Tests for missing members (good TDD tests!)

---

## 🎯 TDD Approach

Following Test-Driven Development principles:

1. **Keep good tests** that validate official Pine Script features
2. **Fix/remove bad tests** that validate non-existent features
3. **Preserve TDD tests** for missing features (they should fail until implemented)
4. **Ensure no regression** - don't break valid functionality

---

## 🔴 Priority 1: Fix Errors (599 issues)

### Most Problematic Test Files

| File | Errors | Actions |
|------|--------|---------|
| `strategy-properties-validation.spec.ts` | 119 | Remove tests for fake sub-namespaces |
| `matrix-functions-validation.spec.ts` | 59 | Remove tests for non-existent matrix functions |
| `map-validation.spec.ts` | 41 | Fix generic constructor tests |
| `chart-functions-validation.spec.ts` | 39 | Fix chart.point tests |
| `array-validation.spec.ts` | 32 | Fix generic constructor tests |

### Issues by Namespace

#### 1. Strategy Namespace (256 errors) 🔴🔴🔴

**Problem**: Tests validate fake sub-namespaces that don't exist in official docs.

**Non-existent members**:
```typescript
strategy.direction     // Should test: strategy.direction.all, .long, .short individually
strategy.risk          // Sub-namespace doesn't exist
strategy.commission    // Should test: strategy.commission.* constants directly
strategy.oca           // Sub-namespace doesn't exist  
strategy.closedtrades  // Should test specific functions like .entry_price(trade_num)
strategy.opentrades    // Should test specific functions like .profit(trade_num)
```

**Fix Strategy**:
- ❌ Remove: Tests for `strategy.direction` as a member
- ✅ Keep: Tests for `strategy.direction.all`, `strategy.direction.long`, etc. as constants
- ❌ Remove: Tests for `strategy.closedtrades` and `strategy.opentrades` as standalone members  
- ⏳ Add: Tests for `strategy.closedtrades.entry_price()`, `strategy.opentrades.profit()` functions (TDD - should fail)

**Files to fix**:
- `tests/ast/final-constants-validator-ast.test.ts` (lines 57-58)
- `tests/complete-function-signatures.test.ts` (lines 82, 92)
- `tests/constants-coverage.test.ts` (lines 125-127)
- `tests/specs/strategy-properties-validation.spec.ts` (entire file review needed)

#### 2. Matrix Namespace (100 errors) 🔴🔴

**Problem**: Tests validate functions that don't exist in official Pine Script v6 docs.

**Non-existent members**:
```typescript
matrix.new                  // Use matrix.new_float, matrix.new_int, etc.
matrix.abs                  // Doesn't exist in v6
matrix.sqrt                 // Doesn't exist in v6
matrix.variance             // Doesn't exist in v6
matrix.stdev                // Doesn't exist in v6
matrix.covariance           // Doesn't exist in v6
matrix.percentile_linear_interpolation  // Doesn't exist in v6
matrix.percentile_nearest_rank         // Doesn't exist in v6
```

**Fix Strategy**:
- ❌ Remove: Tests for generic `matrix.new` constructor
- ✅ Keep: Tests for `matrix.new_float`, `matrix.new_int`, etc.
- ❌ Remove: Tests for `matrix.abs`, `matrix.sqrt`, `matrix.variance`, `matrix.stdev`, `matrix.covariance`
- ❌ Remove: Tests for `matrix.percentile_*` functions

**Files to fix**:
- `tests/specs/matrix-functions-validation.spec.ts` (lines 229, 246, 284, 303, 318, 356, 372)
- `tests/ast/matrix-validator-ast.test.ts` (line 42)
- `tests/specs/matrix-validation.spec.ts` (review entire file)

#### 3. Array Namespace (94 errors) 🔴

**Problem**: Tests use generic `array.new` instead of type-specific constructors.

**Non-existent member**:
```typescript
array.new  // Use array.new_float, array.new_int, etc.
```

**Fix Strategy**:
- ❌ Remove: Tests for generic `array.new`
- ✅ Keep/Update: Change to `array.new_float`, `array.new_int`, etc.

**Files to fix**:
- `tests/ast/chevrotain-parser.test.ts` (line 548)
- All files using `array.new` - update to specific constructor

#### 4. Chart Namespace (61 errors) 🔴

**Problem**: Tests validate `chart.point` as a member instead of constructor functions.

**Non-existent member**:
```typescript
chart.point  // Use chart.point.new, chart.point.from_index, etc.
```

**Fix Strategy**:
- ❌ Remove: Tests for `chart.point` as a standalone member
- ✅ Keep/Add: Tests for `chart.point.new()`, `chart.point.from_index()`, `chart.point.from_time()`
- ⏳ Note: `chart.point.from_time()` is MISSING from validator - TDD test should expect error

**Files to fix**:
- `tests/specs/chart-functions-validation.spec.ts` (review entire file)
- `tests/specs/alert-table-polyline-validation.spec.ts` (line 251)

#### 5. Map Namespace (45 errors) 🔴

**Problem**: Tests use generic `map.new` instead of type-specific constructor.

**Non-existent member**:
```typescript
map.new  // Use map.new<keyType, valueType>
```

**Fix Strategy**:
- ❌ Remove: Tests for generic `map.new`
- ✅ Update: Use `map.new<string, float>` or other type combinations

**Files to fix**:
- `tests/ast/map-validator-ast.test.ts` (line 70)
- `tests/specs/map-validation.spec.ts` (review entire file)

#### 6. String Namespace (9 errors) 🟡

**Problem**: Tests validate functions that don't exist in official docs.

**Non-existent members**:
```typescript
str.capitalize   // Doesn't exist in v6
str.trim_left    // Doesn't exist in v6 (use str.trim)
str.trim_right   // Doesn't exist in v6 (use str.trim)
str.join         // Doesn't exist in v6
```

**Fix Strategy**:
- ❌ Remove: Tests for `str.capitalize`, `str.trim_left`, `str.trim_right`, `str.join`

**Files to fix**:
- `tests/specs/string-utility-functions-validation.spec.ts` (lines 62, 92, 107, 284)

#### 7. Math Namespace (8 errors) 🟡

**Problem**: Tests validate functions that don't exist in official docs.

**Non-existent members**:
```typescript
math.atan2   // Doesn't exist in v6
math.median  // Doesn't exist in v6
math.mode    // Doesn't exist in v6
```

**Fix Strategy**:
- ❌ Remove: Tests for `math.atan2`, `math.median`, `math.mode`

**Files to fix**:
- `tests/specs/math-functions-validation.spec.ts` (lines 294, 417, 430)

#### 8. Syminfo Namespace (8 errors) 🟡

**Problem**: Tests validate financial metrics that don't exist in official docs.

**Non-existent members**:
```typescript
syminfo.market_cap
syminfo.pe_ratio
syminfo.dividend_yield
syminfo.beta
syminfo.avg_volume_30d
syminfo.contract_size
syminfo.tick_value
syminfo.margin_requirement
```

**Fix Strategy**:
- ❌ Remove: Tests for all these financial metrics

**Files to fix**:
- `tests/specs/syminfo-session-timezone-advanced.spec.ts` (lines 11-18)

#### 9. Table/Text Namespace (6 errors) 🟢

**Problem**: Tests validate formatting constants that don't exist.

**Non-existent members**:
```typescript
table.cell_merge_horizontal
table.cell_merge_vertical
text.format_bold_italic
text.format_underline
text.format_strikethrough
```

**Fix Strategy**:
- ❌ Remove: Tests for these formatting constants

**Files to fix**:
- `tests/ast/final-constants-validator-ast.test.ts` (line 59)
- `tests/specs/drawing-styling-enums-advanced.spec.ts` (lines 16-18, 31)

---

## 🟡 Priority 2: Clean Warnings (6 issues)

**Problem**: Tests validate metadata artifacts that aren't real Pine Script features.

**Non-existent artifacts**:
```typescript
declaration.arguments  // Metadata from old structures
param.qualifier        // Metadata from old structures
```

**Fix Strategy**:
- ❌ Remove: All tests checking for `.arguments`, `.qualifier`, `.signatures` properties

**Files to fix**:
- Review test files that check for metadata properties
- These are likely in function signature validation tests

---

## 🔵 Priority 3: Verify Info (15 issues) - KEEP THESE!

**These are GOOD TDD tests!** They test features that exist in official docs but are missing from validator.

### Missing from Validator (tests should expect errors)

#### Plot Constants (8 tests) ✅
```typescript
plot.linestyle_dashed   // MISSING - test should expect error
plot.linestyle_dotted   // MISSING - test should expect error
plot.linestyle_solid    // MISSING - test should expect error
```

**Files**:
- Various plot function tests

**Action**: ✅ Keep tests, ensure they expect validation errors until implemented

#### Currency Constants (5 tests) ✅
```typescript
currency.BTC   // MISSING - currently have "Bitcoin" instead
currency.ETH   // MISSING - currently have "Ethereum" instead
currency.USDT  // MISSING - currently have "Tether" instead
```

**Files**:
- `tests/constants-coverage.test.ts`

**Action**: ✅ Keep tests, ensure they expect validation errors until implemented

#### Line Function (2 tests) ✅
```typescript
line.set_second_point()  // MISSING from validator
```

**Files**:
- Line function validation tests

**Action**: ✅ Keep tests, ensure they expect validation errors until implemented

---

## 📋 Step-by-Step Cleanup Process

### Phase 1: Quick Wins (Metadata Artifacts)
1. Search for tests checking `.arguments`, `.signatures`, `.qualifier`
2. Remove these checks
3. Run tests to ensure no regressions

### Phase 2: Generic Constructors
1. Find all uses of `array.new`, `matrix.new`, `map.new`, `chart.point`
2. Update to specific constructors:
   - `array.new` → `array.new_float`, `array.new_int`, etc.
   - `matrix.new` → `matrix.new_float`, `matrix.new_int`, etc.
   - `map.new` → `map.new<keyType, valueType>`
   - `chart.point` → `chart.point.new()`
3. Run tests after each file

### Phase 3: Non-Existent Functions
1. Remove tests for functions that don't exist:
   - Matrix: `abs`, `sqrt`, `variance`, `stdev`, `covariance`, `percentile_*`
   - String: `capitalize`, `trim_left`, `trim_right`, `join`
   - Math: `atan2`, `median`, `mode`
   - Syminfo: financial metrics
2. Run tests after each namespace

### Phase 4: Strategy Namespace
1. Review `strategy-properties-validation.spec.ts` carefully
2. Remove tests for fake sub-namespaces
3. Update to test individual constants/functions
4. Run tests

### Phase 5: Table/Text Constants
1. Remove formatting constant tests
2. Run tests

### Phase 6: Verify TDD Tests
1. Ensure 15 "info" tests properly expect validation errors
2. Document that these will pass once features are implemented
3. Run full test suite

---

## 🚀 Expected Outcomes

After cleanup:
- ✅ All tests validate only official Pine Script v6 features
- ✅ No tests for non-existent members
- ✅ No tests for metadata artifacts
- ✅ TDD tests for missing features properly expect errors
- ✅ No regressions in valid functionality
- ✅ Clean, maintainable test suite aligned with official docs

---

## 📊 Progress Tracking

Create a checklist:
- [ ] Phase 1: Remove metadata artifact tests (6 issues)
- [ ] Phase 2: Fix generic constructor tests (~200 issues)
- [ ] Phase 3: Remove non-existent function tests (~150 issues)
- [ ] Phase 4: Fix strategy namespace tests (256 issues)
- [ ] Phase 5: Remove table/text constant tests (6 issues)
- [ ] Phase 6: Verify and document TDD tests (15 tests)
- [ ] Run full test suite and verify no regressions
- [ ] Update test documentation

---

## 🔧 Automation Script

A script has been created to help: `scripts/analyze-test-alignment.ts`

Run it anytime:
```bash
npx tsx scripts/analyze-test-alignment.ts
```

This will show current status and what still needs fixing.

---

## 📚 References

- **Detailed Report**: `docs/test-alignment-report.json`
- **Official API Coverage**: `docs/validator-vs-docs-comparison.json`  
- **Enhanced Structures**: `PineScriptContext/enhanced-structures/`
- **Gap Analysis**: `docs/validator-gaps-summary.md`

---

*Following TDD principles: Test what exists, fail for what's missing, succeed for what's implemented!*

