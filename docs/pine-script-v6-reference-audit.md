# Pine Script v6 Validator Reference Audit

## Scope and Method
- Pulled the live Pine Script® v6 reference via `https://r.jina.ai/https://www.tradingview.com/pine-script-reference/v6/` to get a renderable Markdown copy of the official manual.
- Parsed the validator sources (`core/constants.ts` plus namespace/function registries) to collect every keyword and fully-qualified identifier the validator treats as built-in.
- Normalised both sets (case-insensitive, whole-token matches) and compared for over-inclusive symbols (validator mentions but docs do not) and under-inclusive symbols (documented but missing from the validator).

## Current Coverage Snapshot — 2025-09-19

- ✅ `node src/client/functional-app/pine-script-ai-editor/utils/validator/run-coverage-analysis.js` reports **160 / 160 documented identifiers covered** (0 missing, 0 partial).
- ✅ All previously flagged gaps (arrays, map.includes, strategy percent metrics, TA additions, timeframe helpers, syminfo fundamentals, `input.hline`) are now present in `core/constants.ts` and have regression tests.
- ✅ Invalid allowlist entries (`static`, `func`, `syminfo.exchange`, etc.) were removed; the coverage script now emits an empty “missing” section.

## Historical Findings — Invalid Symbols Hard-coded (resolved)
The validator previously recognised the following symbols even though they are absent from the official v6 reference and could trigger false positives/negatives. These entries were removed during the 2025-09-19 alignment pass:

| Category | Symbols flagged |
| --- | --- |
| Language keywords | `static`, `func` |
| `syminfo.*` | `syminfo.exchange`, `syminfo.precision` |
| `timezone.*` | `timezone.exchange`, `timezone.local`, `timezone.utc` |
| Strategy namespace | `strategy.fixed_percent`, `strategy.reduce`, `strategy.reduce_all`, `strategy.slippage` |
| Drawing namespaces | `box.get_text`, `box.set_text_font`; `polyline.copy`, `polyline.get_points`, `polyline.set_color`, `polyline.set_line_style`, `polyline.set_line_width`, `polyline.set_points` |
| Math / Matrix | `math.atan2`, `math.median`, `math.mode`; `matrix.acos`, `matrix.add`, `matrix.asin`, `matrix.atan`, `matrix.atan2`, `matrix.clear`, `matrix.cos`, `matrix.div`, `matrix.exp`, `matrix.log`, `matrix.mul`, `matrix.sin`, `matrix.sqrt`, `matrix.sub`, `matrix.tan` |
| Colour helpers | `color.scale`, `color.transparency` |
| TA namespace | `ta.ad`, `ta.cmf`, `ta.dema`, `ta.efi`, `ta.fi`, `ta.kama`, `ta.mcginley`, `ta.percentile`, `ta.smma`, `ta.tema`, `ta.trima` |

**Status:** All items above have been scrubbed from the allowlists; follow-up tests (`array-validation`, `map-validation`, `strategy-functions-validation`, `ta-functions-validation`, etc.) keep the surface locked down.

## Historical Findings — Documented Symbols Missing From Validator (resolved)
The alignment gap identified in the initial audit has been closed. For posterity, the areas we filled are listed below:

- **Arrays (36 constructors/utilities)** – `array.abs`, `array.avg`, `array.fill`, `array.first`, `array.from[_example]`, `array.max/min`, `array.percentile_*`, `array.some`, `array.sort_indices`, `array.standardize`, `array.stdev`, `array.sum`, `array.variance`, `array.new_*` (bool/box/color/float/int/label/line/linefill/string/table), etc. (✅ now captured under `NS_MEMBERS.array`).
- **`box` namespace (6 items)** – `box.set_bottom_right_point`, `box.set_extend`, `box.set_text_font_family`, `box.set_text_formatting`, `box.set_top_left_point`, `box.set_xloc` (✅ added; undocumented setters removed).
- **`map` namespace** – `map.includes` (✅ added alongside regression coverage).
- **`strategy` metrics (14 items)** – Percent-oriented accessors (`strategy.avg_*_percent`, `strategy.grossloss_percent`, `strategy.netprofit_percent`, `strategy.openprofit_percent`, `strategy.max_*_percent`, `strategy.position_entry_name`, `strategy.direction`, `strategy.risk_allow_entry_in`) (✅ now part of `KEYWORDS`).
- **`ta` namespace** – Core indicators `ta.iii` and `ta.wvad` (✅ added; undocumented entries purged).
- **`input.hline`** – (✅ added to `NS_MEMBERS.input`).
- **`syminfo` metadata (27 items)** – Financial fundamentals (`syminfo.country`, `syminfo.shareholders`, `syminfo.target_price_*`, `syminfo.volumetype`, etc.) (✅ added to `KEYWORDS`/registry).
- **`timeframe` helpers (11 items)** – `timeframe.isdaily`, `timeframe.main_period`, `timeframe.period`, `timeframe.multiplier`, etc. (✅ added to `NS_MEMBERS.timeframe`).

All of the above entries now appear in `core/constants.ts` (and supporting modules), and the dedicated Vitest suites exercise them so regressions are immediately visible.

## Documentation Drift
`validator-coverage-summary.md` (updated 2025-09-19) now links to the automated coverage script rather than claiming static totals. Re-run the script whenever the allowlists change to keep the summary honest.

## Recommendations
1. ✅ Completed: invalid identifiers purged, missing documented items imported, regression tests added alongside the allowlist updates.
2. 🔁 Ongoing hygiene: run `node src/client/functional-app/pine-script-ai-editor/utils/validator/run-coverage-analysis.js` (or wire it into CI) whenever allowlists shift.
3. 🔁 Keep `validator-coverage-summary.md` and this audit in sync with the automated output to highlight any future drift.

## Next Steps
- Integrate the coverage script into the CI suite to fail fast if new undocumented identifiers slip in.
- Continue expanding the automated comparison to cover function signatures when TradingView publishes machine-readable extracts.
