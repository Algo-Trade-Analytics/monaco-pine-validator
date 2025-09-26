# Pine Script v6 Validator Testing Suite

## Purpose

The Vitest suites under `tests/specs/` verify how the modular validator behaves when it runs with the default, AST-enabled
configuration that now ships in the Monaco worker.  This document explains which commands to run, what the current failure
patterns look like, and how to re-run individual suites while iterating on rule implementations.

- **Total specs**: 9 (smoke suite)
- **Passing specs**: 9
- **Failing specs**: 0
- **Primary focus**: guarding the AST-enabled pipeline and critical diagnostics while broader suites remain deferred.

> These numbers come from `npm run test:validator` (October 2023 snapshot) and should be updated alongside future coverage
> reviews.

## Running the full suite

```bash
npm run test:validator
```

This command executes `tests/specs/all-validation-tests.spec.ts`, which now imports the curated smoke tests in `validator-smoke.spec.ts`.  The reduced run ensures that version handling, plotting requirements, const semantics, argument validation, and negative history checks continue to behave correctly under the AST-enabled configuration.

## Running targeted AST suites

The repository also contains focused AST suites under `tests/ast/`.  They instantiate validators with a Chevrotain AST
service so the modules can traverse nodes and emit diagnostics.

```bash
npx vitest run tests/ast/chevrotain-parser.test.ts
npx vitest run tests/ast/time-date-functions-validator-ast.test.ts
# … run additional files in tests/ast/ as needed
```

AST-focused suites remain valuable for confirming parser behaviour and validator logic in isolation before reintroducing archived specs to the main run.

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
4. **Adjust the validator module** so it emits the documented diagnostic codes, then re-enable the corresponding spec in `all-validation-tests.spec.ts`.
5. **Update documentation** (coverage summary, gap analysis, and this guide) with the refreshed counts.

## Manual sanity checks

Keep the `docs/validator-gui-sanity-checks.md` checklist handy for quick manual verification inside the Monaco editor.  Those
scenarios confirm that the GUI behaves as expected while sharing the same AST-enabled configuration as the test suite.
