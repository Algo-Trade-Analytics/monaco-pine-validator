# Validator vs Official Documentation - Gap Analysis

*Generated: October 3, 2025*

## Executive Summary

**Overall Coverage: 91.7%** ✅

The Pine Script validator has excellent coverage of the official Pine Script v6 API. Out of 720 total members in the official documentation, the validator correctly implements **660 members** (91.7%).

### Key Findings

- ✅ **660 correctly implemented** members
- ❌ **60 missing** members (in docs but not in validator)
- ⚠️ **265 extra** members (in validator but not in docs)

## Missing Members (Priority Issues)

### 1. Strategy Namespace (48 missing) 🔴 HIGH PRIORITY

The strategy namespace has the most gaps, particularly in the `closedtrades` and `opentrades` sub-namespaces:

#### Missing `strategy.closedtrades.*` functions/variables (17):
- `closedtrades.first_index` [variable] - Index of first trade
- `closedtrades.commission()` - Get commission for a closed trade
- `closedtrades.entry_bar_index()` - Entry bar index
- `closedtrades.entry_comment()` - Entry comment
- `closedtrades.entry_id()` - Entry ID
- `closedtrades.entry_price()` - Entry price
- `closedtrades.entry_time()` - Entry time
- `closedtrades.exit_bar_index()` - Exit bar index
- `closedtrades.exit_comment()` - Exit comment
- `closedtrades.exit_id()` - Exit ID
- `closedtrades.exit_price()` - Exit price
- `closedtrades.exit_time()` - Exit time
- `closedtrades.max_drawdown()` - Max drawdown during trade
- `closedtrades.max_drawdown_percent()` - Max drawdown percentage
- `closedtrades.max_runup()` - Max runup during trade
- `closedtrades.max_runup_percent()` - Max runup percentage
- `closedtrades.profit()` - Trade profit

#### Missing `strategy.commission.*` constants (4):
- `commission.cash_per_contract`
- `commission.cash_per_order`
- `commission.percent`

#### Missing `strategy.opentrades.*` functions/variables (15):
- `opentrades.capital_held` [variable]
- `opentrades.commission()`
- `opentrades.entry_bar_index()`
- `opentrades.entry_comment()`
- `opentrades.entry_id()`
- `opentrades.entry_price()`
- `opentrades.entry_time()`
- `opentrades.max_drawdown()`
- `opentrades.max_drawdown_percent()`
- `opentrades.max_runup()`
- `opentrades.max_runup_percent()`
- `opentrades.profit()`
- `opentrades.profit_percent()`
- `opentrades.size()`

#### Other missing strategy members (12):
- Various `margin.*` constants
- Various `account.*` constants
- `convert_currency()`
- `exit_on_opposite()`
- `use_orders_on_chart()`

**Impact**: Users cannot fully analyze trade history or access detailed trade information.

**Recommendation**: Implement these functions and variables in the validator.

### 2. Plot Namespace (3 missing) 🟡 MEDIUM PRIORITY

Missing line style constants:
- `plot.linestyle_dashed`
- `plot.linestyle_dotted`
- `plot.linestyle_solid`

**Impact**: Users may not get proper validation for plot line styles.

**Recommendation**: Add these constants to the plot namespace.

### 3. Currency Namespace (3 missing) 🟡 MEDIUM PRIORITY

Missing cryptocurrency constants:
- `currency.BTC`
- `currency.ETH`
- `currency.USDT`

**Current issue**: The validator has these as individual constants (`Bitcoin`, `Ethereum`, `Tether`) instead of in the `currency` namespace.

**Impact**: Incorrect namespace validation.

**Recommendation**: Move these to the `currency` namespace.

### 4. Global Namespace (2 missing) 🟢 LOW PRIORITY

Missing boolean literals:
- `true` [constant]
- `false` [constant]

**Impact**: Minimal - these are language keywords that work anyway.

**Recommendation**: Add for completeness.

### 5. Other Minor Gaps (5 missing) 🟢 LOW PRIORITY

- `chart.point.copy()` - Copy a chart point
- `chart.point.from_time()` - Create point from time
- `line.set_second_point()` - Set line's second point
- `box.set_xloc()` - Set box X location mode

**Impact**: Minor - these are newer or less common functions.

## Extra Members (Cleanup Needed)

The validator has **265 members** that don't exist in the official documentation. These fall into several categories:

### 1. Metadata Artifacts (Most Common) ⚠️

These appear in many namespaces and are likely structural artifacts:
- `arguments` (appears 28 times)
- `signatures` (appears 28 times)
- `qualifier` (appears 25 times)

**Examples**:
- `color.arguments`, `color.signatures`
- `input.arguments`, `input.signatures`
- `na.qualifier`, `time.qualifier`

**Cause**: These are likely from the old structures where functions/variables had metadata properties.

**Recommendation**: Clean up the namespace-members.ts to remove these.

### 2. Fake Namespaces (Variables Treated as Namespaces) ⚠️

Many built-in variables are incorrectly being treated as namespaces:
- `ask.qualifier`
- `bid.qualifier`
- `close.qualifier`
- `high.qualifier`, `low.qualifier`, `open.qualifier`
- `bar_index.qualifier`
- `last_bar_index.qualifier`
- etc.

**Cause**: Structural issue in how namespace-members.ts is organized.

**Recommendation**: These variables should be in the 'global' namespace, not as separate namespaces.

### 3. Deprecated or Non-Standard Members ⚠️

Some members that aren't in the official v6 docs:
- `syminfo.avg_volume_30d` and 45+ other financial metrics
- `font.default`, `font.monospace`, `font.sans_serif`, etc. (7 members)
- `display.data_window_only`, `display.price_scale_only`
- `polyline.clear`, `polyline.copy`, etc. (5 members)
- `text.format_bold_italic`, `text.format_normal`, etc. (4 members)

**Cause**: Either:
1. From older Pine Script versions
2. Undocumented features
3. Test/example code

**Recommendation**: Verify if these are actually valid, otherwise remove.

### 4. Sub-namespace Constants ⚠️

Several strategy sub-namespaces that aren't in the docs:
- `strategy.commission.*` (2 members)
- `strategy.oca.*` (2 members)
- `strategy.direction.*` (3 members)
- `strategy.risk.*` (6 members)

**Cause**: These might be older v5 syntax or test data.

**Recommendation**: Verify against official docs and remove if invalid.

### 5. Wrong Names/Locations ⚠️

Currency constants in wrong format:
- `Bitcoin`, `Ethereum`, `Euro`, `Tether` (should be `currency.BTC`, `currency.ETH`, `currency.EUR`, `currency.USDT`)

## Perfectly Matched Namespaces ✨

These 21 namespaces have 100% coverage:

1. ✓ **request** (10 members) - Data request functions
2. ✓ **timeframe** (14 members) - Timeframe utilities
3. ✓ **barstate** (7 members) - Bar state variables
4. ✓ **ticker** (9 members) - Ticker functions
5. ✓ **size** (6 members) - Label/text size constants
6. ✓ **dividends** (5 members) - Dividend data
7. ✓ **extend** (4 members) - Line extend constants
8. ✓ **yloc** (3 members) - Y-location constants
9. ✓ **location** (5 members) - Location constants
10. ✓ **position** (9 members) - Position constants
11. ✓ **session** (9 members) - Session variables/constants
12. ✓ **earnings** (7 members) - Earnings data
13. ✓ **adjustment** (3 members) - Adjustment constants
14. ✓ **backadjustment** (3 members) - Back-adjustment constants
15. ✓ **settlement_as_close** (3 members)
16. ✓ **splits** (2 members) - Stock splits
17. ✓ **order** (2 members) - Order constants
18. ✓ **scale** (3 members) - Scale constants
19. ✓ **xloc** (2 members) - X-location constants
20. ✓ **log** (3 members) - Logging functions
21. ✓ **runtime** (1 member) - Runtime info

## High-Level Statistics

### By Member Type (Estimated)

From the 60 missing members:
- **Functions**: ~45 (mostly strategy.closedtrades.* and strategy.opentrades.*)
- **Variables**: ~3 (strategy.closedtrades.first_index, strategy.opentrades.capital_held, etc.)
- **Constants**: ~12 (currency.*, plot.linestyle_*, true, false)

### By Priority

- 🔴 **HIGH**: 48 members (strategy namespace)
- 🟡 **MEDIUM**: 9 members (plot, currency, chart)
- 🟢 **LOW**: 3 members (global, misc)

## Recommendations

### Immediate Actions (High Priority)

1. **Add missing strategy members** (48 items)
   - Implement `strategy.closedtrades.*` functions
   - Implement `strategy.opentrades.*` functions
   - Add missing strategy constants

2. **Clean up metadata artifacts** (~80 items)
   - Remove all `arguments` entries from namespaces
   - Remove all `signatures` entries from namespaces
   - Remove `qualifier` from wrong places

3. **Fix fake namespaces** (~25 items)
   - Remove variable namespaces (ask, bid, close, high, low, etc.)
   - Keep these only in the 'global' namespace

### Short-term Actions (Medium Priority)

4. **Add missing constants**
   - `plot.linestyle_*` (3 items)
   - `currency.BTC/ETH/USDT` (3 items)
   - `true`/`false` (2 items)

5. **Fix misnamed constants**
   - Rename `Bitcoin` → `currency.BTC`
   - Rename `Ethereum` → `currency.ETH`
   - Rename `Euro` → `currency.EUR`
   - Rename `Tether` → `currency.USDT`

### Long-term Actions (Low Priority)

6. **Verify extra members** (~160 items)
   - Check if `syminfo.*` financial metrics are valid
   - Check if `font.*`, `text.*`, `polyline.*` extras are valid
   - Remove if they're not in official v6 docs

7. **Automate validation**
   - Use the enhanced structures as the source of truth
   - Generate `namespace-members.ts` automatically from enhanced structures
   - Set up CI to detect drift

## Files Generated

- `/docs/validator-vs-docs-comparison.json` - Detailed JSON report
- `/docs/validator-gaps-summary.md` - This file
- `/scripts/compare-validator-vs-docs.ts` - Comparison script

## Next Steps

1. Review this gap analysis
2. Prioritize which gaps to fix first
3. Create a cleanup script to remove invalid entries
4. Consider generating namespace-members.ts from enhanced-structures
5. Add tests to ensure validator stays in sync with docs

