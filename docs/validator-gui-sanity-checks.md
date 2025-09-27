# Pine Script v6 Validator — GUI Sanity Checklist

Use this lightweight checklist to verify that the inspector embedded in the Pine Script AI editor still behaves end-to-end after local changes. Each scenario is designed to take less than a minute and exercises a different validator surface.

## Prerequisites
- Run the app locally (`npm run dev` or equivalent) so the Pine Script AI editor is available.
- Open the “Validator” pane alongside the editor, and make sure autosave is enabled so the validator refreshes on edits.

## Sanity Scenarios

1. ### Clean Indicator (happy path)
   - Paste the snippet below into the editor:
     ```pine
     //@version=6
     indicator(title="Sanity Clean", overlay=true)
     maFast = ta.sma(close, 10)
     maSlow = ta.sma(close, 30)
     plot(maFast)
     plot(maSlow)
     ```
   - Expect **no validator messages** (errors, warnings, or info).

2. ### Basic Syntax Error
   - Delete the `//@version` line entirely so the file begins like this:
     ```pine
     indicator(title="Missing Version")
     ```
   - Expect a **PS012** error (“Missing version directive…”) — you may still see non-blocking warnings like `PS014` about missing plots.

3. ### Namespace Regression Check
   - Replace the body with an array helper that recently entered the allowlist:
     ```pine
     //@version=6
     indicator("Array Percentile")
     values = array.new_float(5, close)
     p50 = array.percentile_linear_interpolation(values, 50)
     plot(p50)
     ```
   - Expect **no errors**; this verifies the GUI is using the updated array registry.

4. ### Strategy Metrics
   - Switch the declaration to a strategy that uses the new percent metrics:
     ```pine
     //@version=6
     strategy("Percent Metrics", overlay=false)
     if ta.crossover(close, ta.sma(close, 10))
         strategy.entry("Long", strategy.long)
     plot(strategy.netprofit_percent)
     ```
   - Expect **no errors** and ensure the metric appears in autocomplete while editing.

5. ### Syminfo Fundamentals
   - Test one of the expanded syminfo fields:
     ```pine
     //@version=6
     indicator("Syminfo Fundamentals")
     plot(float(syminfo.target_price_average))
     ```
   - Expect **no errors**; this confirms the GUI bundles the refreshed keyword list.

6. ### Invalid Identifier Guardrail
   - Intentionally use an identifier we removed (`strategy.fixed_percent`):
     ```pine
     //@version=6
     strategy("Invalid Identifier")
     strategy.fixed_percent := 5
     ```
   - Expect **PSV6-FUNCTION-UNKNOWN** so you know the stale keyword did not sneak back in.

## Optional Extras
- Trigger an alert warning by creating two `alertcondition` calls and verifying the readable message.
- Drop a malformed array constructor (e.g., `array.new<>(10)`) to ensure the GUI surfaces the same error codes as the CLI tests.

## Reporting
If any scenario fails, capture the validator panel output and the snippet that triggered it, then:
1. Re-run `npm run test:all` to see if the CLI reproduces the failure.
2. Open a task or PR comment referencing the failing scenario and attach the output.

Keeping this checklist handy makes it quick to sanity-check the UI after core validator changes or dependency bumps.
