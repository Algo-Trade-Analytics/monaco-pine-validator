# Pine Script v6 Validator – Coverage Summary

## Executive Snapshot

| Metric | Value |
| --- | --- |
| Smoke specs executed by default (`npm run test:validator`) | 13 |
| Full regression specs available via `npm run test:validator:full` | 1,021 (opt-in) |
| AST module tests executed (`tests/ast/**/*.test.ts`) | 389 |
| Passing checks (default run) | 402 |
| Failing checks (default run) | 0 |
| Primary focus | Smoke coverage plus AST-backed module contracts that verify the Chevrotain pipeline |
| Share of historical regression coverage exercised automatically | 1.3% (13 of the 1,021 archived regression assertions) |

The validator now runs with Chevrotain AST data enabled by default.  To maintain a reliable baseline the default spec run stays trimmed to thirteen smoke assertions that ensure the pipeline, syntax checks, architecture wiring, and a few semantic guards still behave correctly.  In addition, the AST harness runs 389 module-focused checks to guard parsing contracts and high-priority validations.  The broader regression catalogue—1,021 archived assertions across 52 spec files—remains in the repository and can be exercised on demand with `npm run test:validator:full`, but it is expected to fail until rule coverage reaches parity with the fixtures.

## Remaining Workload Snapshot

| Dimension | Active today | Deferred backlog | % Complete |
| --- | --- | --- | --- |
| Automated assertions | 13 smoke checks | 1,021 archived checks | 1.3% |
| Spec files imported into the default run | `validator-smoke.spec.ts`, `validator-architecture.spec.ts` | 51 additional spec files under `tests/specs/` (run with `npm run test:validator:full`) | 3.8% |
| Modules emitting covered diagnostics | Core, Syntax, Function | 46 other validator modules awaiting rule parity | 6.1% |

Restoring coverage therefore requires activating roughly 94–99% of the historical suite, depending on whether you measure by assertion count, spec files, or module diagnostics.  The smoke suite should be treated as a health check while the deferred fixtures continue to define the long tail of required behaviour.

## Category Breakdown

| Category | Example spec files | Current behaviour |
| --- | --- | --- |
| Smoke validations | `tests/specs/validator-smoke.spec.ts` (imported by `all-validation-tests.spec.ts`) | Pass – confirms version handling, const reassignment, missing plots, function parameter validation, and negative history checks. |
| Architecture integration | `tests/specs/validator-architecture.spec.ts` (imported by `all-validation-tests.spec.ts`) | Pass – confirms AST parsing is active by default, exposes the module catalog, and can be disabled or swapped for alternate services. |
| AST module suites | `tests/ast/**/*.test.ts` | Pass – confirm Chevrotain parsing, context preparation, and module-level diagnostics for high-priority validators. |
| Deferred regression suites | `array-validation.spec.ts`, `map-validation.spec.ts`, `time-date-functions-validation.spec.ts`, etc. | Deferred – the files remain in the repo as references but are no longer executed until their expectations align with the current implementation. |

## Why Only Smoke Coverage?

`EnhancedModularValidator` inherits from `BaseValidator`, which enables Chevrotain AST parsing automatically.  While that makes the full regression suite runnable, hundreds of expectations still mismatch the current diagnostics.  Rather than report a sea of red, the default run now exercises a curated smoke suite alongside the passing AST harness and treats the broader fixtures as a roadmap for future module work.

## How to Exercise the Full Pipeline

Instantiate the validator with the Chevrotain AST service:

```ts
import { EnhancedModularValidator } from './EnhancedModularValidator';
import { ChevrotainAstService } from './core/ast/service';

const validator = new EnhancedModularValidator({
  ast: { mode: 'primary', service: new ChevrotainAstService() },
  strictMode: true,
});
```

Running the deferred suites with this configuration remains the best way to confirm module completeness; re-enable them selectively as rules reach parity.

## Next Steps for Coverage

1. Expand smoke coverage as modules stabilise, gradually reincorporating archived specs into the default run.
2. Capture module ownership and remaining edge cases uncovered by the dormant fixtures so work can be prioritised effectively.
3. Create automated reports that classify modules by dependency (`AST`, `line-based`, `hybrid`) and track which suites are active versus deferred.
4. Update this document alongside future test runs to maintain an accurate and actionable status report.
