# TDD Test Cleanup - Progress Report

*Started: October 3, 2025*

## ✅ Progress Summary

### Completed
- ✅ **Phase 1**: Metadata artifacts - No real issues found (6 false positives)
- ✅ **Phase 2 (Partial)**: Fixed 3 `matrix.new` → `matrix.new_float` usages

### Current Status
**596 issues remaining** (down from 620 originally, down from 599 after phase 1 analysis refinement)

---

## 📊 Remaining Issues Breakdown

### By Namespace

| Namespace | Count | Type of Issue |
|-----------|-------|---------------|
| Strategy | 256 | Fake sub-namespaces, parent objects |
| Matrix | 97 | Non-existent functions |
| Array | 94 | Generic constructor in test strings |
| Chart | 61 | `chart.point` usage |
| Map | 45 | Generic constructor |
| String | 9 | Non-existent functions |
| Math | 8 | Non-existent functions |
| Syminfo | 8 | Financial metrics |
| Table/Text | 6 | Formatting constants |
| Other | 12 | Misc |

---

## 🔍 Key Insight

**Most "issues" are Pine Script code in test strings, not test code itself!**

Example:
```typescript
// This is a test STRING containing Pine Script code
const source = 'var mat = matrix.new("float", 2, 2)';
//                        ^^^^^^^^^^^ This is in a string, not actual test code
```

These test strings contain Pine Script syntax that doesn't exist in v6. They need to be updated to match official v6 syntax.

---

## 🎯 Simplified Next Steps

### Priority 1: Strategy Namespace (256 issues)
**File**: `tests/specs/strategy-properties-validation.spec.ts` (119 errors)

**Problem**: Tests validate non-existent sub-namespaces:
```typescript
// ❌ DON'T TEST: strategy.direction (doesn't exist)
// ✅ DO TEST: strategy.direction.all, strategy.direction.long, strategy.direction.short

// ❌ DON'T TEST: strategy.closedtrades (doesn't exist as standalone)
// ✅ DO TEST: strategy.closedtrades.entry_price(trade_num), etc.
```

**Action**: Review and update this file carefully

### Priority 2: Matrix Functions (97 issues)  
**File**: `tests/specs/matrix-functions-validation.spec.ts` (59 errors)

**Problem**: Tests for non-existent functions:
```typescript
// ❌ REMOVE: matrix.abs, matrix.sqrt, matrix.variance, matrix.stdev, matrix.covariance
// ❌ REMOVE: matrix.percentile_linear_interpolation, matrix.percentile_nearest_rank
```

**Action**: Remove tests for these 7 functions that don't exist in v6

### Priority 3: String/Math Functions (17 issues)

**String functions to remove**:
- ❌ `str.capitalize` (line 62)
- ❌ `str.trim_left` (line 92)
- ❌ `str.trim_right` (line 107)
- ❌ `str.join` (line 284)

**Math functions to remove**:
- ❌ `math.atan2` (line 294)
- ❌ `math.median` (line 417)
- ❌ `math.mode` (line 430)

### Priority 4: Syminfo Financial Metrics (8 issues)
**File**: `tests/specs/syminfo-session-timezone-advanced.spec.ts` (lines 11-18)

Remove tests for non-existent financial metrics:
- ❌ `syminfo.market_cap`, `syminfo.pe_ratio`, `syminfo.dividend_yield`
- ❌ `syminfo.beta`, `syminfo.avg_volume_30d`, etc.

### Priority 5: Table/Text Constants (6 issues)

Remove tests for non-existent formatting constants:
- ❌ `table.cell_merge_horizontal`, `table.cell_merge_vertical`
- ❌ `text.format_bold_italic`, `text.format_underline`, `text.format_strikethrough`

---

## 📝 Quick Reference Commands

```bash
# Check current status
npx tsx scripts/analyze-test-alignment.ts

# Find generic constructors
npx tsx scripts/fix-generic-constructors.ts

# Run tests
npm test
```

---

## 🎯 Realistic Completion Time

| Phase | Estimated Time | Complexity |
|-------|----------------|------------|
| Strategy namespace review | 45 min | High - needs careful analysis |
| Matrix functions removal | 15 min | Low - straightforward deletion |
| String/Math removal | 10 min | Low - straightforward deletion |
| Syminfo metrics removal | 5 min | Low - straightforward deletion |
| Table/Text constants | 5 min | Low - straightforward deletion |
| Test and verify | 20 min | Medium - ensure no regressions |
| **Total** | **~1.5-2 hours** | |

---

## ✅ Keep These (Good TDD Tests!)

These 15 tests properly expect validation errors for missing features:
- `plot.linestyle_dashed/dotted/solid` (8 tests) ✅
- `currency.BTC/ETH/USDT` (5 tests) ✅
- `line.set_second_point` (2 tests) ✅

**DO NOT REMOVE** - These tests should fail until features are implemented!

---

## 🚀 Recommended Approach

1. **Start Small**: Begin with string/math/syminfo removals (30 min total)
2. **Test After Each**: Run tests to ensure no regressions
3. **Strategy Last**: Save the complex strategy namespace for when you have focus
4. **Track Progress**: Re-run `analyze-test-alignment.ts` after each phase

---

## 📁 Key Files to Update

1. `tests/specs/strategy-properties-validation.spec.ts` (119 errors) - **Most Complex**
2. `tests/specs/matrix-functions-validation.spec.ts` (59 errors)
3. `tests/specs/string-utility-functions-validation.spec.ts` (4 removals)
4. `tests/specs/math-functions-validation.spec.ts` (3 removals)
5. `tests/specs/syminfo-session-timezone-advanced.spec.ts` (8 removals)
6. `tests/specs/drawing-styling-enums-advanced.spec.ts` (5 removals)
7. `tests/ast/final-constants-validator-ast.test.ts` (3 removals)

---

*Next: Focus on quick wins (string/math/syminfo) to build momentum!*

