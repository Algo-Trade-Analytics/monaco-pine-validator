# Pine Script v6 Validator Testing Suite

## Purpose

The Vitest suites verify how the modular validator behaves when it runs with the default, AST-enabled configuration that now
ships in the Monaco worker.  This document explains which commands to run, what the current failure patterns look like, and how
to re-run individual suites while iterating on rule implementations.

- **Smoke specs**: 13 (all passing)
- **Full regression specs**: 1,021 (available via `npm run test:validator:full`, currently failing until modules catch up)
- **AST module tests**: 389 (all passing)
- **Primary focus**: guarding the AST-enabled pipeline and critical diagnostics while broader regression suites remain deferred.

> These numbers come from `npm run test:validator` (October 2023 snapshot) and should be updated alongside future coverage
> reviews.

## Running the full suite

```bash
npm run test:validator
```

This command executes two suites:

1. `tests/specs/all-validation-tests.spec.ts`, which imports the curated smoke tests in `validator-smoke.spec.ts` and the architecture integration checks in `validator-architecture.spec.ts`.
   * Use `npm run test:validator -- --suite "Drawing Functions"` to focus the spec loader on modules whose names include the provided filter (comma-separated for multiple entries). The loader honours the `VALIDATOR_SUITE_FILTER` environment variable directly if you need to integrate with other tooling.
2. `tests/ast/**/*.test.ts`, which exercises the Chevrotain-backed module harness.

The combined run ensures that version handling, plotting requirements, const semantics, argument validation, negative history checks, AST-backed module contracts, and validator configuration wiring all continue to behave correctly under the AST-enabled configuration.

> [!NOTE]
> Treat the smoke + AST run as a hard gating check. If either suite reports a regression, address it before attempting to re-run the optional backlog below.

To exercise the entire historical regression catalogue, opt into the full suite:

```bash
npm run test:validator:full
```

Setting the `VALIDATOR_FULL_SUITE=1` flag (handled automatically by the script above) instructs `all-validation-tests.spec.ts` to import every spec module.  Pair this with `--suite <name>` (or `VALIDATOR_SUITE_FILTER`) to iterate on a single module without loading the entire 1,021-spec catalogue. The run is expected to report numerous failures today; use it to gauge module readiness while iteratively restoring fixtures.

> [!IMPORTANT]
> The enhanced modular validator does **not** yet implement every rule covered by the archived fixtures. Full runs are primarily a progress tracker until the remaining modules are rebuilt.

## Running targeted AST suites

The repository also contains focused AST suites under `tests/ast/`.  They instantiate validators with a Chevrotain AST service so the modules can traverse nodes and emit diagnostics.

```bash
npx vitest run --config vitest.config.ts tests/ast/chevrotain-parser.test.ts
npx vitest run --config vitest.config.ts tests/ast/time-date-functions-validator-ast.test.ts
# … run additional files in tests/ast/ as needed
```

Even though the full AST catalogue now runs as part of `npm run test:validator`, individual specs remain valuable for
confirming parser behaviour and validator logic in isolation before reintroducing archived specs to the main run.

## Enabling AST parsing for debugging

To reproduce the expected diagnostics from a failing spec, instantiate the validator with the Chevrotain service:

```ts
import { EnhancedModularValidator } from '../EnhancedModularValidator';
import { ChevrotainAstService } from '../core/ast/service';

const validator = new EnhancedModularValidator({
  ast: { mode: 'primary', service: new ChevrotainAstService() },
  strictMode: true,
  targetVersion: 6,
});
```

Passing this configuration to the test harness (or a manual script) mirrors the default behaviour and keeps modules such as
`time-date-functions-validator`, `alert-functions-validator`, and `enhanced-textbox-validator` active.

## Suggested workflow for fixing suites

1. **Choose a deferred suite** – use `docs/validator-coverage-summary.md` to identify the next category to restore.
2. **Run the focused AST spec** for that module under `tests/ast/` to confirm parser support and baseline diagnostics.
3. **Debug with AST enabled** – wire the Chevrotain service into the validator instance to reproduce gaps locally.
4. **Adjust the validator module** so it emits the documented diagnostic codes, then re-enable the corresponding spec in `all-validation-tests.spec.ts`. When diagnosing drawing-related regressions, set `VALIDATOR_DEBUG_DRAWING=1` to stream emitted diagnostics to the console while tests execute.
5. **Update documentation** (coverage summary, gap analysis, and this guide) with the refreshed counts.  If a module rejoins the default smoke run, drop the opt-in flag so CI benefits immediately.

## Manual sanity checks

Keep the `docs/validator-gui-sanity-checks.md` checklist handy for quick manual verification inside the Monaco editor.  Those
scenarios confirm that the GUI behaves as expected while sharing the same AST-enabled configuration as the test suite.
