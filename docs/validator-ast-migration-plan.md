# Pine Script Validator AST Migration Roadmap

## 1. Objectives

- Replace the current line/token driven validators with an Abstract Syntax Tree (AST) centric pipeline that becomes the authoritative source of truth for all semantic decisions.
- Preserve the existing behavioural coverage by driving the migration with TDD at the module level and at the end-to-end validator level.
- Provide a Monaco Editor friendly validation experience (rich diagnostics, hover/intellisense hooks) by structuring the AST pipeline around established editor-linter best practices.

## 2. Current State Assessment

| Area | Current Approach | Pain Points |
| --- | --- | --- |
| Parsing | Hand-written scanners (`core/scanner.ts`, regex in modules) operating on raw line arrays | Complex branching logic, hard to reason about, duplicated parsing code across modules |
| Context | `BaseValidator` keeps many mutable maps/sets updated by individual modules | Coupled state makes module ordering critical and brittle |
| Errors | Modules push `ValidationError` objects manually | Inconsistent ranges, difficult to relate to actual syntactic constructs |
| Monaco integration | Diagnostics generated post-parse | Lacks structured nodes for hover, quick fixes, semantic highlighting |

The lack of a shared parse tree means every module re-derives syntactic structure; as more language features are supported, the imperative parsing logic becomes unstable and costly to extend.

### Progress Update (Infrastructure Delivered)

- A typed AST surface (`core/ast/nodes.ts`) with traversal helpers and scope graph construction is merged, giving the validator a canonical syntax tree and symbol table.
- `BaseValidator` now hydrates `AstValidationContext` with parser outputs, scope graphs, and symbol tables whenever AST mode is enabled.
- Focused Vitest suites cover traversal and scope graph behaviour; pipeline tests assert that AST diagnostics and context wiring behave under success, failure, and disabled modes.
- Literal-aware type inference now populates a `TypeEnvironment` on the validation context, tracking identifier and expression types for downstream semantic passes.
- Golden semantic coverage snapshots assert the combined scope, symbol, and type metadata for representative scripts to guard end-to-end analysis.
- Control-flow graph construction models branch merges, loop back-edges, and return terminators while exposing the graph on the validation context for future analyses.
- Member expression nodes model namespaced property access (e.g., timeframe.period) with traversal, scope, and type inference coverage so builtin-variable validators can rely on structured AST data.
- The built-in variables validator now consumes AST member expressions to detect namespace constants, keeping Monaco diagnostics aligned with Pine nodes without relying on legacy line-based scanning.
- Switch statements, matrix literals, and historical index expressions now have dedicated AST nodes with traversal, scope, type inference, and control-flow coverage, unblocking downstream modules that depend on these constructs.

### Near-Term TODOs

1. ✅ **Stand Up Dual-Run Harnesses** – the semantic golden suite now runs `EnhancedModularValidator` in AST shadow mode and diffs its diagnostics against the legacy pipeline for builtin namespace coverage, establishing a regression guardrail for upcoming module ports.
2. ⏱️ **Close Parser RFC Loop** – distil the outstanding parser spike notes into a publishable RFC update that records the chosen technology, recovery strategy, and open follow-ups for incremental parsing.
3. ✅ **Broaden AST Node Coverage** – added structural nodes for `switch`, matrix literals, and historical index expressions so currently blocked validators can migrate without bespoke fallbacks.
4. ⏱️ **Deepen Type Inference Rules** – capture strategy/TA helper return types and multi-series propagation so the `strategy-functions` and `ta-functions` validators can rely on AST semantics.
5. ⏱️ **Document Monaco Integration Plan** – outline how AST diagnostics, hovers, and code lenses will be surfaced through the Monaco worker now that diagnostic helpers exist.

## 3. Target Architecture Overview

```
            ┌───────────────┐
            │ Source String │
            └──────┬────────┘
                   ▼
          ┌────────────────────┐
          │ Lexer/Tokenizer    │
          └──────┬─────────────┘
                 ▼
          ┌────────────────────┐
          │ Parser (AST)       │  ◀── reusable for Monaco language service
          └──────┬─────────────┘
                 ▼
          ┌────────────────────┐
          │ AST Normalisation  │  ── resolves identifiers, builds scopes/types
          └──────┬─────────────┘
                 ▼
     ┌─────────────────────────────┐
     │ Validation Passes (Modules) │  ── consume AST + semantic context
     └─────────────────────────────┘
```

Key principles:

- **Single AST Backbone** – every validator operates on `NodePath` abstractions rather than raw text.
- **Immutable Pass Inputs** – validators receive readonly AST snapshots + analysed metadata to minimise shared mutable state.
- **Feature Flags via Capabilities** – modules declare required AST features (control flow, type inference) to orchestrate pass ordering.
- **Editor Integration** – AST nodes carry offsets/ranges compatible with Monaco diagnostics, code lenses, and hover providers.

## 4. AST Design Strategy

1. **Choose Parsing Technology**
   - Favour a battle-tested TypeScript parser toolkit with good error recovery (e.g. [Chevrotain](https://chevrotain.io) or [Nearley](https://nearley.js.org/)).
   - Evaluate existing Pine Script grammars (TradingView open docs, community grammars) and decide whether to adapt one or author a custom grammar.
   - Outcome: RFC documenting chosen parser, justification, and spike prototype parsing core constructs (`indicator`, variable declarations, function definitions, expressions).

2. **Define Node Types**
   - Start with canonical language constructs: `Program`, `VersionDirective`, `Assignment`, `IfStatement`, `ForStatement`, `FunctionDeclaration`, `CallExpression`, `Identifier`, literals, namespaces.
   - Provide discriminated unions in `core/ast/nodes.ts` with `kind`, `range`, `loc`, and optional metadata for Pine specifics (series vs. literal typing, security calls, etc.).
   - Introduce helper utilities such as `NodePath`, `visit`, `findAncestor` for traversal (stored in `core/ast/traversal.ts`).

3. **Error Recovery & Diagnostics**
   - Parser must produce partial AST with recoverable errors for Monaco-friendly diagnostics.
   - Capture lexical/parse errors separately from validation passes to render as syntax diagnostics immediately.

4. **AST Persistence**
   - Cache AST in validation context for reuse by incremental validation (Monaco typing scenario).
   - Provide `diffAst(oldAst, newAst)` utility for future incremental optimisations (optional but note in backlog).

## 5. Migration Phases

### Phase 0 – Research & Spikes (1-2 sprints)
- Catalogue Pine Script v6 grammar constructs and corner cases (loops, `request.security`, `switch`, matrices).
- Build minimal parser prototype covering top-level declarations and expressions.
- Define success criteria + metrics (parse speed, memory, ability to recover from errors).
- Produce documentation for parser choice and AST type definitions.

### Phase 1 – Infrastructure Setup
- ✅ Create `core/ast/` folder with lexer, parser, node definitions, traversal utilities, and error types (landed via the AST schema + traversal commits).
- ✅ Add new `AstValidationContext` extending existing `ValidationContext` with `ast`, `scopeGraph`, `symbolTable`.
- ✅ Add feature-flag configuration in `BaseValidator` to toggle AST mode (dual-run to compare results).
- ✅ Establish snapshot-based tests verifying AST output for sample Pine snippets (`tests/ast/*.test.ts`).

### Phase 2 – Semantic Foundation Passes
- ✅ Implement initial semantic passes operating on AST:
  - ✅ Scope builder (collects declarations, resolves references).
  - ✅ Type inference skeleton (basic literal + identifier typing feeding the shared `TypeEnvironment`).
  - ✅ Control flow graph builder (captures loops, conditionals, and terminators for downstream analyses).
- ✅ Provide reusable diagnostics helpers mapping AST ranges to Monaco `IMarkerData`.
- ✅ Add golden tests ensuring passes populate context as expected.

### Phase 3 – Module Migration (Incremental)
- Prioritise modules with high instability and heavy parsing logic (CoreValidator, FunctionDeclarations, Scope, Type).
- For each module:
  1. Freeze behaviour with regression tests (existing suites + new targeted tests if gaps exist).
  2. Introduce AST-backed implementation under feature flag.
  3. Run module-specific tests in AST mode; iterate until parity achieved.
  4. Remove legacy text-based logic once parity + confidence obtained.
- Maintain migration checklist tracking progress across all modules (shared Markdown table in this plan).

Suggested migration order:
1. **Core Syntax Modules** – `core-validator`, `function-declarations`, `scope`, `type`.
2. **Control Flow & Structure** – `switch`, loops, `var/varip`, `history`.
3. **Built-in Namespaces** – functions/variables modules (leverage AST call nodes for accuracy).
4. **Advanced Feature Modules** – performance, strategy, map, matrix, etc.

### Phase 4 – Editor Integration Enhancements
- Expose AST + diagnostics through Monaco worker API (e.g., `languageFeatures.validate` -> AST pipeline).
- Implement hover/definition providers using AST symbol tables.
- Evaluate incremental parsing for real-time feedback (optional milestone).

### Phase 5 – Cleanup & Deprecation
- Remove legacy scanner utilities once all modules rely on AST.
- Simplify `BaseValidator` state to rely on AST-derived symbol/type tables.
- Archive or delete text-based validators after ensuring tests cover AST path exclusively.

## 6. Testing & Quality Strategy

- **Unit Tests**: New parser + AST utilities covered with Vitest suites. Use fixture-based tests to capture tricky Pine constructs.
- **Property Tests**: (Stretch) Generate random-but-valid Pine snippets to ensure parser round-trips without throwing.
- **Golden Files**: Store canonical AST JSON snapshots for critical scripts to detect breaking changes.
- **Migration Guard**: Temporary mode to run both legacy and AST validators in parallel and diff diagnostics; surface mismatches in CI.
- **Editor Smoke Tests**: Update `validator-gui-sanity-checks.md` with AST-mode scenarios; eventually automate via Playwright if possible.

## 7. Tooling & DX Improvements

- Create CLI entry (`scripts/validate-ast.ts`) that prints AST + diagnostics for debugging.
- Add ESLint/TS rule to disallow new regex-based parsing in modules once AST is available.
- Document contributor workflow for AST modules (how to add nodes, update traversal, write tests).

## 8. Open Questions / Follow-ups

- Incremental parsing support for Monaco worker (does chosen parser support incremental updates?).
- Performance impact of AST construction vs current approach; need profiling metrics.
- Handling of Pine Script preprocessing/macros (if any) before AST stage.
- Potential use of Tree-sitter Pine grammar as basis? evaluate feasibility.

## 9. Migration Tracking Table

| Module | Legacy Complexity | AST Migration Status | Owner | Notes |
| --- | --- | --- | --- | --- |
| core-validator | High | 🔄 Ready for AST port | Validator Infra | AST context + diagnostics helpers landed; waiting on dual-run guardrail before switchover |
| function-declarations | High | 🔄 Ready for AST port | Validator Infra | Function + call nodes modelled; scope builder resolves function symbols |
| type-validator | High | 🚧 Planning | Semantic Working Group | Literal/type environment skeleton merged; expand inference before parity run |
| scope-validator | High | 🚧 Planning | Semantic Working Group | Scope graph + symbol tables available; need module-level dual-run harness |
| switch-validator | Medium | 🛠️ Blocked on node coverage | Language Infra | Extend AST to cover `switch` branches prior to migration |
| while-loop-validator | Medium | 🛠️ Blocked on node coverage | Language Infra | Loop constructs present; finalise control-flow metadata before port |
| builtin-variables-validator | Medium | ✅ Migrated | Module Owners Guild | Validator now reads AST member expressions for constants, having removed the legacy line-scanner path |
| ta-functions-validator | Medium | 🚧 Planning | Module Owners Guild | Awaiting expanded call-site inference for strategy/TA helpers |
| strategy-functions-validator | Medium | 🚧 Planning | Module Owners Guild | Needs richer series/type propagation to avoid regressions |
| history-referencing-validator | High | 🛠️ Blocked on index nodes | Module Owners Guild | Model historical reference expressions + guard via snapshots |
| ... | ... | ... | ... | Extend table as modules migrate |

## 10. Immediate Next Steps (Post-Review)

The initial AST plumbing is already landing (feature-flagged parsing in `BaseValidator`,
`AstValidationContext` extensions, lexer scaffolding, and validation smoke tests). To
capitalise on this progress, align the next iteration around the following workstream
plan:

1. **Kick Off Phase 3 Module Ports**
   - Leverage the new dual-run harness to compare `core-validator` diagnostics in shadow mode and capture mismatches as fixtures before swapping implementations.
   - Define parity exit criteria and owners for the initial tranche of modules listed in the migration table, now that scope, types, and control flow graphs are available.
2. **Close the Parser RFC Loop**
   - Finalise the parser technology RFC by capturing findings from the lexer/prototype experiments, documenting the selected approach, and listing follow-ups like incremental parsing and recovery tuning.
   - Extend the prototype to cover directives, variable declarations, and function bodies so upcoming semantic passes have representative node shapes.

3. **Expand Semantic Coverage**
   - Add AST nodes for `switch`, matrix literals, and historical index access while deepening type inference rules for strategy/TA helpers.
   - Ensure the migration table’s blocked modules move to “Ready” once their required syntax and inference features land.

4. **Plan Monaco Worker Integration**
   - Document how AST diagnostics, hovers, and code lenses will flow through the Monaco worker using the new marker helpers.
   - Identify any additional API shims or batching logic needed before exposing the AST pipeline to the editor.

## 11. Definition of Done

- All validation modules run exclusively on AST-derived data structures.
- Parser + AST layers have ≥90% test coverage with regression fixtures for previously reported bugs.
- Monaco integration consumes AST diagnostics and exposes improved language features.
- Legacy text-based parsing utilities removed; documentation updated to describe AST-first architecture.

## 12. References & Best Practices

- Monaco editor diagnostics best practices: produce stable `owner`, `source`, `code`, and `relatedInformation` entries for AST diagnostics.
- Keep parser pure and side-effect free; semantic passes handle context-specific logic.
- Use visitor pattern or pattern matching on discriminated unions for predictable traversal.
- Provide developer ergonomics via strongly typed builders (`createBinaryExpression`, etc.).

