# Pine Script v6 Validator Test Coverage

## Snapshot (October 2023)

| Metric | Value |
| --- | --- |
| Smoke specs (`npm run test:validator`) | 13 |
| Full regression specs (`npm run test:validator:full`) | 1,021 (opt-in) |
| AST module tests (`tests/ast/**/*.test.ts`) | 389 |
| Passing checks (default run) | 402 |
| Failing checks (default run) | 0 |
| Dominant focus | Smoke assertions plus AST module contracts that verify the Chevrotain-powered pipeline |

The Vitest suites under `tests/specs/` include the legacy 1,021-spec regression set.  By default `all-validation-tests.spec.ts` imports the curated smoke assertions plus the new architecture integration spec so CI remains green, but you can opt into the full catalogue with `npm run test:validator:full`.  The CLI also executes the 389 AST module tests to guard parser behaviour and module contracts.  This combined run keeps the pipeline honest while avoiding hundreds of expected failures until module coverage catches up.

## Running the Suites

```bash
# install dependencies
npm install

# default smoke + AST run (mirrors CI)
npm run test:validator

# focus on a single AST spec
npx vitest run --config vitest.config.ts tests/ast/chevrotain-parser.test.ts

# opt into the historical regression catalogue
npm run test:validator:full
```

To exercise the full pipeline, instantiate the validator with the Chevrotain AST
service:

```ts
import { EnhancedModularValidator } from './EnhancedModularValidator';
import { ChevrotainAstService } from './core/ast/service';

const validator = new EnhancedModularValidator({
  ast: { mode: 'primary', service: new ChevrotainAstService() },
  strictMode: true,
});
```

## Category Breakdown

| Category | Representative specs | Current behaviour |
| --- | --- | --- |
| Smoke coverage | `validator-smoke.spec.ts` (default import in `all-validation-tests.spec.ts`) | Pass – validates version handling, missing plots, const reassignment, function argument typing, and negative history lookups. |
| Architecture integration | `validator-architecture.spec.ts` (default import in `all-validation-tests.spec.ts`) | Pass – verifies the enhanced validator exposes AST data, honours disabled parsing, and surfaces the module catalog. |
| AST module suites | `tests/ast/**/*.test.ts` | Pass – validate parsing, context preparation, and diagnostics for high-priority modules under the Chevrotain service. |
| Deferred regression suites | `array-validation.spec.ts`, `strategy-functions-validation.spec.ts`, `time-date-functions-validation.spec.ts`, etc. | Available via `npm run test:validator:full` – currently expected to fail until rules meet the historical expectations encoded in the fixtures. |

## Observations

- **Smoke coverage guards the core pipeline** – the curated assertions ensure the validator still handles version directives, const semantics, and function checks while using the AST service.
- **AST harness runs alongside smoke checks** – the 389 module-focused tests confirm Chevrotain parsing, context preparation, and key module diagnostics stay stable.
- **Deferred suites remain authoritative references** – hundreds of fixtures continue to describe the intended rule coverage even though they are not executed automatically.
- **Documentation must track incremental progress** – as suites return we need to update counts and guidance so contributors understand which modules remain outstanding.

## Next Steps for Raising Coverage

1. Continue expanding rule coverage in AST-heavy modules so dormant fixtures can be re-enabled without failing the default run.
2. Audit deferred specs to determine which expectations still represent desired behaviour and adjust fixtures where necessary.
3. Automate coverage reporting (e.g., JSON summary grouped by module category) to keep this document up to date as suites are reintroduced.
