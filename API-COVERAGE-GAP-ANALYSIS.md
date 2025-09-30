# Pine Script API Coverage Gap Analysis

## Executive Summary

**Analysis Date**: September 30, 2025  
**Scope**: Complete Pine Script v6 API Reference  
**Method**: Cross-reference API against validator tests and logic  

### Overall Coverage: 55.4%

| Category | Coverage | Status |
|----------|----------|--------|
| **Functions** | 258/463 (55.7%) | ⚠️ MODERATE |
| **Variables** | 95/160 (59.4%) | ⚠️ MODERATE |
| **Constants** | 121/233 (51.9%) | ⚠️ LOW |
| **TOTAL** | 474/856 (55.4%) | ⚠️ MODERATE |

## 🎯 Key Findings

### ✅ Well-Covered Areas (>75%)

1. **math.*** - 100% (24/24 functions)
   - All math functions tested and validated
   - Excellent coverage

2. **request.*** - 100% (10/10 functions)
   - All request functions covered
   - Parameter validation comprehensive

3. **timeframe.*** - 100% (3/3 functions)
   - Complete coverage

4. **linefill.*** - 100% (2/2 functions)
   - Full validation

5. **str.*** - 94.4% (17/18 functions)
   - Nearly complete string function coverage
   - Missing: `str.replace_all`

6. **color.*** - 85.7% (6/7 functions)
   - Good color function coverage

7. **ta.*** - 79.7% (47/59 functions)
   - Strong TA function coverage
   - Most commonly used functions tested

8. **global** - 78.6% (33/42 functions)
   - Good core function coverage

9. **ticker.*** - 77.8% (7/9 functions)
   - Solid ticker function coverage

10. **input.*** - 76.9% (10/13 functions)
    - Good input validation coverage

### ⚠️ Gaps Requiring Attention (<50%)

1. **matrix.*** - 16.3% (8/49 functions) ❌
   - **41 untested functions** (84% gap!)
   - Critical linear algebra operations missing
   - Major gap in v6 feature coverage

2. **strategy.*** - 21.3% (10/47 functions) ❌
   - **37 untested functions** (79% gap!)
   - Most `strategy.closedtrades.*` properties untested
   - `strategy.opentrades.*` largely uncovered
   - Performance metrics missing

3. **label.*** - 38.1% (8/21 functions) ⚠️
   - 13 untested drawing functions
   - Visual element validation gaps

4. **line.*** - 36.8% (7/19 functions) ⚠️
   - 12 untested line drawing functions
   - Drawing API incomplete

5. **array.*** - 47.3% (26/55 functions) ⚠️
   - 29 untested array functions
   - Many utility functions missing (avg, join, includes, etc.)

6. **box.*** - 48.1% (13/27 functions) ⚠️
   - 14 untested box drawing functions

7. **chart.*** - 0% (0/4 functions) ❌
   - **Completely untested**
   - All chart functions missing

## 📋 Detailed Gap Analysis

### 1. Matrix Functions (CRITICAL GAP - 84% missing)

Matrix operations are a major Pine Script v6 feature with minimal coverage:

**Untested Critical Functions**:
- Matrix creation: `matrix.add_col`, `matrix.add_row`
- Math operations: `matrix.det`, `matrix.inv`, `matrix.pow`, `matrix.mult`
- Statistics: `matrix.avg`, `matrix.median`, `matrix.sum`, `matrix.variance`
- Linear algebra: `matrix.eigenvalues`, `matrix.eigenvectors`, `matrix.rank`
- Transformations: `matrix.transpose`, `matrix.reshape`, `matrix.reverse`
- Comparisons: `matrix.is_square`, `matrix.is_identity`, `matrix.is_symmetric`

**Impact**: Matrix operations are increasingly used for advanced analytics and machine learning in Pine Script. This is a significant validation gap.

**Recommendation**: HIGH PRIORITY - Add comprehensive matrix validation module

### 2. Strategy Properties (CRITICAL GAP - 79% missing)

Strategy testing and backtesting rely heavily on these properties:

**Untested `strategy.closedtrades.*` (24 properties)**:
- Trade details: `entry_price`, `exit_price`, `entry_time`, `exit_time`
- Trade IDs: `entry_id`, `exit_id`, `entry_comment`, `exit_comment`
- Bar indices: `entry_bar_index`, `exit_bar_index`
- Trade metrics: `profit`, `profit_percent`, `commission`, `max_drawdown`
- And more...

**Untested `strategy.opentrades.*` (11 properties)**:
- Current positions: `entry_price`, `entry_time`, `entry_bar_index`
- P&L: `profit`, `profit_percent`
- Trade details: `entry_id`, `entry_comment`

**Impact**: Users cannot validate strategy scripts that access trade history or current positions. This is essential for advanced strategy development.

**Recommendation**: HIGH PRIORITY - Add strategy properties validation

### 3. Chart Functions (100% missing)

**All 4 functions untested**:
- `chart.point.new()` - Create chart points
- `chart.point.now()` - Current time point
- `chart.point.from_time()` - Time-based points
- `chart.point.from_index()` - Index-based points

**Impact**: Chart point API is used for advanced drawing. Complete gap in this v6 feature.

**Recommendation**: MEDIUM PRIORITY - Add chart point validation

### 4. Array Utilities (29 untested)

**Missing utility functions**:
- Statistics: `array.avg`, `array.variance`, `array.stdev`, `array.covariance`
- Search: `array.binary_search`, `array.includes`, `array.indexof`
- Manipulation: `array.insert`, `array.remove`, `array.reverse`, `array.sort_indices`
- Logic: `array.every`, `array.some`
- String: `array.join`
- Math: `array.abs`, `array.min`, `array.max`, `array.sum`, `array.median`

**Impact**: Many array operations lack validation. Users may use functions incorrectly without feedback.

**Recommendation**: MEDIUM PRIORITY - Extend array validator

### 5. Drawing Functions (39 untested across box/line/label)

**Box functions** (14 untested):
- Properties: `box.get_left`, `box.get_right`, `box.get_top`, `box.get_bottom`
- Setters: `box.set_left`, `box.set_right`, `box.set_top`, `box.set_bottom`
- Style: `box.set_border_color`, `box.set_border_width`, `box.set_border_style`
- Others: `box.copy`, `box.all`

**Line functions** (12 untested):
- Properties: `line.get_x1`, `line.get_x2`, `line.get_y1`, `line.get_y2`
- Setters: `line.set_x1`, `line.set_x2`, `line.set_y1`, `line.set_y2`
- Style: `line.set_color`, `line.set_width`, `line.set_style`
- Others: `line.copy`

**Label functions** (13 untested):
- Properties and setters for position, text, color, size, style
- `label.copy`, `label.all`

**Impact**: Visual scripting validation incomplete. Drawing operations are common in Pine Script.

**Recommendation**: LOW-MEDIUM PRIORITY - Drawing functions are less critical for validation

### 6. Input Functions (3 untested)

**Missing**:
- `input.enum()` - Enum input dropdown
- `input.price()` - Price input
- `input.text_area()` - Multi-line text input

**Impact**: Newer input types not validated. Minor gap as core input types covered.

**Recommendation**: LOW PRIORITY - Add when enhancing input validation

### 7. TA Functions (12 untested)

**Missing TA functions**:
- `ta.barssince()` - Bars since condition
- `ta.cog()` - Center of gravity
- `ta.cum()` - Cumulative sum
- `ta.highestbars()`, `ta.lowestbars()` - Bar distance to highs/lows
- `ta.max()`, `ta.min()`, `ta.median()`, `ta.mode()` - Statistical functions
- `ta.percentile_nearest_rank()`, `ta.percentile_linear_interpolation()`

**Impact**: Less commonly used TA functions. Core TA well covered.

**Recommendation**: LOW PRIORITY - Add as needed

### 8. Constants Coverage Gaps

**currency.*** - 5.8% (3/52 constants)
- **49 untested currency codes**
- Impact: Users cannot validate currency-specific scripts

**shape.*** - 8.3% (1/12 constants)
- **11 untested shape constants**
- Impact: Label/marker shapes not validated

**text.*** - 40% (4/10 constants)
- 6 untested text alignment constants

**Impact**: Constant validation gaps may allow invalid enum-like values to pass.

**Recommendation**: MEDIUM PRIORITY - Add constant validation

## 📊 Priority Matrix

### HIGH PRIORITY (Immediate Action)

1. **Matrix Functions** (84% gap)
   - Add `MatrixValidator` module
   - Test 41 untested functions
   - Estimated effort: 2-3 days

2. **Strategy Properties** (79% gap)
   - Extend `StrategyFunctionsValidator`
   - Add `strategy.closedtrades.*` and `strategy.opentrades.*` validation
   - Estimated effort: 2-3 days

### MEDIUM PRIORITY (Next Sprint)

3. **Chart Functions** (100% gap)
   - Create `ChartValidator` module
   - Test all 4 chart.point functions
   - Estimated effort: 1 day

4. **Array Utilities** (29 functions)
   - Extend `ArrayValidator`
   - Add utility function validation
   - Estimated effort: 2 days

5. **Constants Validation** (49% gap)
   - Create enum-like constant validation
   - Focus on currency, shape, text constants
   - Estimated effort: 1-2 days

### LOW PRIORITY (Backlog)

6. **Drawing Functions** (39 functions)
   - Extend box/line/label validators
   - Estimated effort: 2-3 days

7. **Remaining TA Functions** (12 functions)
   - Add to `TaFunctionsValidator`
   - Estimated effort: 1 day

8. **Input Functions** (3 functions)
   - Add to `InputFunctionsValidator`
   - Estimated effort: 0.5 days

## 🎯 Recommended Action Plan

### Phase 1: Critical Gaps (Week 1-2)
1. ✅ **Matrix Validator** - New module for matrix operations
2. ✅ **Strategy Properties** - Extend strategy validation

### Phase 2: Important Features (Week 3-4)
3. ✅ **Chart Functions** - Chart point validation
4. ✅ **Array Utilities** - Extend array validator
5. ✅ **Constants** - Enum-like constant validation

### Phase 3: Polish (Week 5-6)
6. ✅ **Drawing Functions** - Complete drawing API
7. ✅ **Remaining TA/Input** - Fill small gaps

## 📈 Expected Coverage After Full Implementation

| Category | Current | After Phase 1 | After Phase 2 | After Phase 3 |
|----------|---------|---------------|---------------|---------------|
| Functions | 55.7% | 73% | 85% | 92% |
| Variables | 59.4% | 65% | 75% | 80% |
| Constants | 51.9% | 55% | 75% | 85% |
| **OVERALL** | **55.4%** | **70%** | **82%** | **88%** |

## 💡 Strategic Considerations

### What Should Be Validated?

**Core Features** (Must validate):
- ✅ Function parameter counts and types
- ✅ Type safety and conversions
- ✅ Return value usage
- ✅ Common TA/math/string/array functions
- ⚠️ **Matrix operations** (critical gap)
- ⚠️ **Strategy properties** (critical gap)

**Drawing API** (Nice to have):
- Drawing functions have many getter/setter pairs
- Less critical for validation (visual elements)
- Consider if this is core validator responsibility

**Constants** (Should validate):
- Enum-like constants (currency codes, shapes, etc.)
- Prevent invalid constant usage
- Medium priority

### Intentional Out of Scope?

Consider if these are intentionally not validated:
- Visual styling details (colors, sizes, etc.)
- Some advanced matrix operations (eigenvalues, etc.)
- Less common TA indicators

**Recommendation**: Document what is intentionally out of scope vs. what is a gap.

## 📝 Documentation Needs

1. **Create VALIDATION-SCOPE.md**
   - Document what IS validated
   - Document what is intentionally OUT OF SCOPE
   - Explain rationale for scope decisions

2. **Update TEST-COVERAGE.md**
   - Current coverage metrics
   - Gap analysis summary
   - Roadmap for improvements

3. **Create CONTRIBUTING.md section**
   - How to add new function validation
   - Test patterns and conventions
   - API reference usage

## 🎯 Conclusion

The Pine Script Validator has **good coverage of core features** (55.4% overall) but has significant gaps in:
- **Matrix operations** (84% gap) - CRITICAL
- **Strategy properties** (79% gap) - CRITICAL  
- **Chart functions** (100% gap) - Important
- **Array utilities** (53% gap) - Moderate
- **Drawing functions** (52% gap) - Less critical

**Recommended Focus**: Prioritize matrix and strategy property validation as these are essential v6 features heavily used in production scripts.

With the recommended 3-phase implementation, coverage can improve from **55% to 88%**, providing comprehensive validation for the Pine Script ecosystem.

---

**Next Steps**:
1. Review and approve priority matrix
2. Create validation modules for Phase 1 gaps
3. Enhance test coverage for critical missing functions
4. Document validation scope and intentional exclusions

