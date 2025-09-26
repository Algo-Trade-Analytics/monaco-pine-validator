# Validator Progress Estimate

## Executive Summary

The Chevrotain-based AST infrastructure, traversal helpers, and AST-aware modules are already in place, but the validator remains far from production readiness because only a nine-test smoke suite runs by default and it touches a tiny slice of the 49-module catalog. To reach a productive state, most regression specs must be restored and AST-dependent rule coverage expanded module by module.

## Quantitative Snapshot

| Dimension | Completed | Remaining | % Complete | % Remaining |
| --- | --- | --- | --- | --- |
| Automated assertions | 9 smoke tests currently executed | 1,021 deferred regression assertions | 0.87% | 99.13% |
| Spec files in `tests/specs/` | 1 active (`validator-smoke.spec.ts`) | 52 deferred spec files | 1.89% | 98.11% |
| Modules with regression coverage | 3 modules emitting the smoke-suite diagnostics (Core, Syntax, Function) | 46 modules without automated coverage | 6.12% | 93.88% |

- The official smoke run reports 9 passing / 0 failing assertions while noting the broader 1,021-spec gauntlet is deferred, so 99% of assertions still sit outside the default run.【F:docs/validator-README.md†L15-L40】【F:docs/validator-coverage-summary.md†L5-L20】
- Only `validator-smoke.spec.ts` is imported by `all-validation-tests.spec.ts`, leaving the other 52 spec files idle in the suite and pushing 98% of the regression catalogue out of circulation.【F:tests/specs/all-validation-tests.spec.ts†L1-L21】
- Smoke assertions cover diagnostics emitted by `CoreValidator` (missing declarations, const reassignment, negative history), `SyntaxValidator` (version placement, duplicate directives), and `FunctionValidator` (argument types), leaving the remaining 46 modules—roughly 94% of the catalog—unverified.【F:tests/specs/validator-smoke.spec.ts†L31-L99】【F:modules/core-validator.ts†L460-L467】【F:modules/core-validator.ts†L1830-L1865】【F:modules/syntax-validator.ts†L132-L146】【F:modules/function-validator.ts†L764-L785】【F:docs/validator-README.md†L7-L38】

## What Is Finished

- Chevrotain AST parsing, node factories, traversal, scope, and type inference infrastructure ship in the repository and back the current validator entry points.【F:docs/validator-ast-migration-plan.md†L20-L24】
- `EnhancedModularValidator` enables the AST service by default, so smoke runs exercise the AST-backed pipeline end to end.【F:docs/validator-README.md†L7-L58】【F:EnhancedModularValidator.ts†L1-L118】

These foundations mean future rule work can focus on diagnostics rather than plumbing.

## What Remains Before Production Readiness

1. **Restore the deferred regression suites.** Re-enabling the 1,021 archived assertions is the largest gap; each module family (arrays, alerts, textbox, ticker, etc.) needs targeted fixes before its spec file rejoins the default run.【F:docs/validator-coverage-summary.md†L12-L24】【F:docs/validator-gap-analysis.md†L16-L33】
2. **Finish AST-dependent rule coverage.** Time/date, alert, drawing/textbox, ticker, and other feature modules still lack the diagnostics expected by their fixtures.【F:docs/validator-gap-analysis.md†L16-L33】【F:docs/validator-ast-migration-plan.md†L25-L36】
3. **Improve observability.** Automated reporting is still required to track module ownership, AST dependency, and progress as suites are restored.【F:docs/validator-gap-analysis.md†L23-L33】【F:docs/validator-ast-migration-plan.md†L32-L38】

## Estimated Effort Remaining

The snapshot above translates to **94–99% of the regression effort still outstanding**, depending on whether you measure by assertions, spec files, or module coverage. The infrastructure is ready, but the modules behind the deferred spec files require implementation and verification. Prioritising module families with the highest user impact (time/date requests, alerts, strategy helpers) will provide the fastest path toward a production-ready validator.
