# Pine Script Structure Comparison Summary

*Generated: October 3, 2025*

## Overview

Comparison between the scraped Pine Script v6 documentation and the current validator structures.

## Statistics

### Total Entries
- **Scraped Documentation**: 919 entries
- **Current Structures**: 696 entries (158 variables, 305 functions, 233 constants)

### Breakdown by Type

| Type | Scraped | Current | Missing | Extra | Status |
|------|---------|---------|---------|-------|--------|
| **Variables** | 160 | 158 | 2 | 0 | ✅ 98.8% |
| **Functions** | 457 | 305 | 167 | 15 | ⚠️ 66.7% |
| **Constants** | 238 | 233 | 9 | 4 | ✅ 97.9% |
| **Types** | 18 | ? | ? | ? | ❓ Unknown |
| **Keywords** | 15 | ? | ? | ? | ❓ Unknown |
| **Operators** | 21 | ? | ? | ? | ❓ Unknown |
| **Annotations** | 10 | ? | ? | ? | ❓ Unknown |

## Missing from Current Structures

### Variables (2 missing)
1. `strategy.closedtrades.first_index` - series int
2. `strategy.opentrades.capital_held` - series float

### Functions (167 missing)

The missing functions are primarily from these namespaces:

#### Box namespace (29 functions)
- `box.new`, `box.copy`, `box.delete`
- `box.get_*` methods (bottom, left, right, top)
- `box.set_*` methods (bgcolor, border_color, border_style, etc.)
- `box.set_text_*` methods (text, text_color, text_font_family, etc.)

#### Label namespace (21 functions)
- `label.new`, `label.copy`, `label.delete`
- `label.get_*` methods (text, x, y)
- `label.set_*` methods (color, point, size, style, text, etc.)

#### Line namespace (21 functions)
- `line.new`, `line.copy`, `line.delete`
- `line.get_*` methods (price, x1, x2, y1, y2)
- `line.set_*` methods (color, extend, style, width, etc.)

#### Input namespace (13 functions)
- `input.bool`, `input.color`, `input.enum`
- `input.float`, `input.int`, `input.price`
- `input.session`, `input.source`, `input.string`
- `input.symbol`, `input.text_area`, `input.time`, `input.timeframe`

#### Other namespaces with missing functions:
- **color**: 7 functions (new, rgb, r, g, b, t, from_gradient)
- **linefill**: 5 functions (delete, get_line1, get_line2, new, set_color)
- **polyline**: 2 functions (delete, new)
- **table**: 22 functions (cell, cell_set_*, clear, delete, new, etc.)
- **chart.point**: 1 function (from_index)

### Constants (9 missing)

1. `currency.BTC` - Bitcoin
2. `currency.ETH` - Ethereum
3. `currency.EUR` - Euro
4. `currency.USDT` - Tether
5. `false` - boolean literal
6. `true` - boolean literal
7. `plot.linestyle_dashed`
8. `plot.linestyle_dotted`
9. `plot.linestyle_solid`

## Extra in Current Structures

### Functions (15 extra)
These appear to be from test files or examples and should be removed:
- `a.put`, `b.put`
- `activationLine.stopExtend`
- `if` (keyword, not function)
- `l.set_extend`, `l.set_x2`
- `labelArray.push`
- `longLimit.stopExtend`, `lossStop.stopExtend`
- `map.new<keyType, valueType>` (generic syntax issue)
- `oddMap.put`
- `points.push`
- `profitLimit.stopExtend`
- `reopenPositionAfter`
- `shortLimit.stopExtend`

### Constants (4 extra)
These appear to be aliases that should match the scraped names:
- `Bitcoin` → should be `currency.BTC`
- `Ethereum` → should be `currency.ETH`
- `Euro` → should be `currency.EUR`
- `Tether` → should be `currency.USDT`

## Namespace Coverage Analysis

### Most Complete Namespaces (>90%)
- ✅ **Variables**: 98.8% coverage
- ✅ **Constants**: 97.9% coverage
- ✅ **ta** (technical analysis): Most functions present
- ✅ **strategy**: Most variables and constants present
- ✅ **array**: Good coverage
- ✅ **matrix**: Good coverage

### Namespaces Needing Attention (<80%)
- ⚠️ **box**: Missing 29 functions (96% missing)
- ⚠️ **label**: Missing 21 functions (~50% missing)
- ⚠️ **line**: Missing 21 functions (~75% missing)
- ⚠️ **input**: Missing 13 functions (100% missing)
- ⚠️ **table**: Missing 22 functions (~95% missing)
- ⚠️ **color**: Missing 7 functions (~100% missing)
- ⚠️ **linefill**: Missing 5 functions (~83% missing)

## Additional Findings

### Types, Keywords, Operators, Annotations
The scraped documentation includes additional categories that may not be fully represented in the current structures:

- **Types** (18): `array`, `bool`, `box`, `chart.point`, `color`, `const`, `float`, `int`, `label`, `line`, `linefill`, `map`, `matrix`, `polyline`, `series`, `simple`, `string`, `table`
- **Keywords** (15): Control flow and declaration keywords
- **Operators** (21): Arithmetic, comparison, logical operators
- **Annotations** (10): Script annotations like `@version`, `@description`, etc.

## Recommendations

### Priority 1: Critical Namespaces
1. **Add missing input functions** - Essential for user inputs
2. **Add missing drawing functions** (box, label, line) - Commonly used features
3. **Add missing color functions** - Required for styling

### Priority 2: Missing Variables
1. Add `strategy.closedtrades.first_index`
2. Add `strategy.opentrades.capital_held`

### Priority 3: Cleanup
1. Remove test/example functions from structures (the 15 "extra" functions)
2. Fix currency constant names to match official names

### Priority 4: New Categories
1. Consider adding structure files for:
   - Types (`types.ts`)
   - Keywords (`keywords.ts`)
   - Operators (`operators.ts`)
   - Annotations (`annotations.ts`)

## Next Steps

1. **Generate updated structures** from the scraped JSONL file
2. **Validate** the new structures against test cases
3. **Update validators** to use the new structures
4. **Test** the validator with real Pine Script code

## Files Generated

- `scraped-docs-comparison.json` - Detailed comparison data
- `scraped-docs-analysis.json` - Analysis of scraped documentation
- `structure-comparison-summary.md` - This file

