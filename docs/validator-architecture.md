# Pine Script v6 Validator Architecture Analysis

## Overview

The validator is built around a modular pipeline that orchestrates nearly fifty
feature-specific modules through a shared `BaseValidator`.  Two public entry
points (`EnhancedModularValidator` and `ModularUltimateValidator`) extend the
base class and register different module sets depending on whether the caller
needs the full experience or a reduced smoke configuration.  The current system
still mirrors the legacy production validator, but the October 2023 snapshot
shows that many modules rely on Chevrotain AST data.  With parsing enabled by
default the current smoke suite reports 9 passing / 0 failing specs while the
archived fixtures remain a backlog for future module work.

## High-Level Components

| Layer | Responsibilities | Key files |
| --- | --- | --- |
| Core runtime | Normalises validation context, executes modules, aggregates diagnostics. | `core/base-validator.ts`, `core/types.ts` |
| Module catalog | Implements feature-specific checks (arrays, TA functions, strategy helpers, etc.). | `modules/*.ts` |
| AST integration | Chevrotain-based parser and traversal helpers consumed by AST-aware modules. | `core/ast/parser`, `core/ast/service`, `core/ast/traversal` |
| Public validators | Configure priorities and register modules for consumers. | `EnhancedModularValidator.ts`, `ModularUltimateValidator.ts` |

### Execution pipeline

1. `BaseValidator` normalises source text into a `ValidationContext` (line table,
   metadata, type maps, etc.).
2. By default the AST service produces a parse tree that becomes part of the context.
3. Modules execute in descending priority order.  Each module may mutate the
   context, contribute diagnostics, or both.
4. After all modules complete, the validator consolidates diagnostics, filters
   ignored codes, and returns a `ValidationResult`.

The default configuration enables AST parsing.  Modules execute in AST-aware mode unless consumers explicitly opt out via `{ ast: { mode: 'disabled' } }`.

## Module Catalog at a Glance

The table below highlights representative modules by responsibility and whether
they expect AST data.

| Category | Representative modules | AST dependency |
| --- | --- | --- |
| Core structure | `CoreValidator`, `SyntaxValidator`, `ScopeValidator` | No – operate on token/line data |
| Type system | `TypeValidator`, `TypeInferenceValidator`, `UDTValidator` | Partial – benefit from AST but retain fallbacks |
| Data structures | `ArrayValidator`, `MatrixValidator`, `MapValidator` | Mixed – advanced cases expect AST nodes |
| Built-ins & requests | `InputFunctionsValidator`, `TimeDateFunctionsValidator`, `AlertFunctionsValidator` | Yes – rely on AST call expressions |
| Performance & guidance | `EnhancedPerformanceValidator`, `EnhancedQualityValidator`, `EnhancedTextboxValidator` | Yes – traverse AST to surface warnings |
| Strategy helpers | `StrategyFunctionsValidator`, `StrategyOrderLimitsValidator`, `EnhancedStrategyValidator` | Mixed |
| Runtime metadata | `BuiltinVariablesValidator`, `SyminfoVariablesValidator`, `FinalConstantsValidator` | No – operate on symbol tables |

Refer to `modules/index.ts` for the authoritative registration order and module
priorities.

## Configuration and Extensibility

- **ValidatorConfig** – defines runtime flags such as `strictMode`, `targetVersion`,
  ignored diagnostic codes, and the optional `ast` configuration.
- **Custom modules** – consumers can extend `BaseValidator` or reuse the module
  registry to add bespoke checks.  Each module implements the `ValidationModule`
  interface (`validate(context, config)` returning diagnostics and optional
  context mutations).
- **AST service** – `ChevrotainAstService` wraps the parser defined in
  `core/ast/parser/parser.ts`.  The service is injected so alternate parsers can
  be swapped in if needed.

## Current Limitations

1. **Incomplete AST coverage** – AST-reliant modules still need additional rule work before the deferred fixtures can be re-enabled.
2. **Observability gaps** – no automated report exists to distinguish AST-only
   modules from line-based modules, making configuration mistakes easy to miss.
3. **Legacy documentation drift** – older docs and comments still promise 100%
   coverage; ongoing cleanup is aligning the messaging with the actual test run.

## Suggested Next Steps

- Track module parity as the AST-enabled configuration becomes the norm and ensure opt-out paths keep working for legacy consumers.
- Emit module-level telemetry (e.g., per-module pass/fail counters) to highlight
  which validators depend on AST data.
- Continue pruning outdated documentation and keep this file updated alongside
  significant architectural or configuration changes.
