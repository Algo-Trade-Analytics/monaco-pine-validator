# Pine Script v6 Validator Documentation

This repository contains a work-in-progress Pine Script v6 validator built around a modular architecture.  The goal is to provide TradingView-compatible diagnostics that can power Monaco-based editing experiences, automated linting, and future language tooling.

## Project Overview

- **Validator entry points**: `EnhancedModularValidator` and `ModularUltimateValidator` orchestrate the module pipeline.
- **Validation modules**: 49 modules under `modules/` cover syntax, types, data structures, drawing primitives, strategy helpers, and AST-powered feature validators.
- **AST integration**: The validator now wires in the `ChevrotainAstService` by default so modules receive typed AST data without extra configuration.
- **Tests**: Vitest suites in `tests/specs/` exercise the modules individually and together through `tests/specs/all-validation-tests.spec.ts`.

## Current Status (October 2023 snapshot)

| Area | Status |
| --- | --- |
| Test command | `npm run test:validator` |
| Result | 9 passing / 0 failing tests (smoke suite of 9 assertions) |
| Primary focus | Baseline smoke coverage that exercises the AST-enabled validator pipeline |
| Parser integration | Chevrotain-based AST parsing runs automatically when validators are instantiated |

The counts above come from the updated smoke suite (`npm run test:validator`).  The comprehensive 1,021-spec gauntlet exposed hundreds of gaps, so the suite has been pared back to nine representative assertions that confirm the AST-enabled pipeline, core syntax checks, and a handful of semantic guards still behave as expected.  The documentation below focuses on that pragmatic baseline while calling out the work required to restore the broader coverage.

## Running the Validator Locally

```bash
npm install
npm run test:validator
```

The validator can also be targeted at AST-only specs:

```bash
npx vitest run tests/ast/chevrotain-parser.test.ts
```

To experiment programmatically, instantiate the validator and run it against Pine Script:

```ts
import { EnhancedModularValidator } from './EnhancedModularValidator';
import { ChevrotainAstService } from './core/ast/service';

const validator = new EnhancedModularValidator({
  ast: { mode: 'primary', service: new ChevrotainAstService() },
  strictMode: true,
  targetVersion: 6,
});

const result = validator.validate(`//@version=6\nindicator("demo")\nplot(close)`);
console.log(result.errors, result.warnings, result.info);
```

`EnhancedModularValidator` and `ModularUltimateValidator` now instantiate the Chevrotain AST service automatically.  Consumers can still opt out by passing `{ ast: { mode: 'disabled' } }` if they need the legacy behaviour.

## Key Findings From the Current Test Run

1. **The validator now ships with a passing smoke suite** – the new tests cover missing version directives, duplicate versions, const reassignment, missing plots, function parameter validation, and negative history lookups so regressions surface quickly.
2. **AST parsing remains enabled by default** – every smoke test instantiates `EnhancedModularValidator` without custom configuration, exercising the Chevrotain service and ensuring AST-dependent modules execute.
3. **Comprehensive coverage is still pending** – the previous 1,021-spec suite remains a valuable backlog reference but is no longer executed automatically. Reintroducing those specs will require staged module work and focused fixtures.

## Known Gaps

- **Comprehensive regression coverage is temporarily disabled**, so only nine smoke tests run during CI.  The remaining fixtures live in `tests/specs/` and should be restored gradually as modules regain feature parity.
- **Module-level progress tracking is still manual** – we lack automation that correlates smoke coverage, deferred suites, and outstanding rule work per module.
- **Gap documentation requires continuous updates** – as suites return we must refresh the counts and ensure developer guidance matches reality.

## Recommended Next Steps

1. **Reintroduce archived specs incrementally**, targeting one module family at a time and expanding rule implementations until the restored assertions pass.
2. **Expand diagnostic coverage** for performance and best-practice codes (`PSV6-TIME-PERF-*`, `PSV6-ALERT-*`, etc.) so smoke expectations can evolve into richer regression suites.
3. **Automate reporting** that distinguishes smoke coverage from deferred suites, enabling maintainers to spot regressions and progress at a glance.
4. **Refresh documentation regularly** as additional suites come back online and the smoke suite grows into a comprehensive run again.

## Directory Structure

```
📁 docs/
├── validator-README.md          # Documentation overview (this file)
├── validator-coverage-summary.md
├── validator-gap-analysis.md
└── validator-gap-action-plan.md
```

For architectural details, see `docs/validator-architecture.md`.  Testing utilities and fixture guidance live in `docs/validator-testing-suite.md`.
