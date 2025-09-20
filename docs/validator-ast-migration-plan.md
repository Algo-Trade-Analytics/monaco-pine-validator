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
  - ✅ Completed via [AST Parser RFC](./ast-parser-rfc.md) detailing the Chevrotain selection and prototype status.

### Phase 1 – Infrastructure Setup
- Create `core/ast/` folder with lexer, parser, node definitions, traversal utilities, and error types.
  - ✅ Introduced `core/ast/traversal.ts` providing `NodePath` helpers, ancestor discovery, and a depth-first visitor to power upcoming AST passes.
- ✅ Generalised script declaration nodes so the AST captures `indicator`, `strategy`, and `library` entrypoints with explicit script types.
- Populate validator context with scope and symbol metadata derived from the AST.
  - ⚠️ Added `core/ast/normalizer.ts` to build module scopes and symbol tables from parsed programs and wired it into `BaseValidator` initialisation, but the current implementation only models the root module scope and flat variable declarations. Nested scopes (functions, control blocks) still need explicit handling before module migrations can rely on the structure.
- ✅ Added an `AstValidationContext` that extends `ValidationContext` with AST, scope, symbol, and type tables consumed by validator modules.
- ✅ Introduced feature-flag configuration in `BaseValidator` so AST services can run in `disabled`, `shadow`, or `primary` modes when rebuilding configs.
- ✅ Established snapshot-based tests verifying AST output and normalisation for representative Pine snippets in `tests/ast/snapshots.test.ts`.

**Phase 1 follow-up checklist**

- [ ] Teach the normaliser how to create and link child scopes for blocks and function bodies.
- [ ] Persist scope identifiers on `NodePath` metadata so downstream passes can navigate parent scopes efficiently.
- [ ] Flesh out AST error types (currently ad-hoc objects) into a shared definition that downstream modules can narrow.

### Phase 2 – Semantic Foundation Passes
- Implement initial semantic passes operating on AST:
  - Scope builder (collects declarations, resolves references).
  - ✅ Type inference skeleton (basic literal + identifier typing) capturing literal, identifier, and call expression flows in a shared type table.
  - ✅ Extended the parser and inference rules to cover boolean comparisons and logical expressions so signal-style assignments resolve to `bool` with proper series propagation.
  - Control flow graph builder (for loops, conditionals) – optional if complex, but plan it early.
- ✅ Provide reusable diagnostics helpers mapping AST ranges to Monaco `IMarkerData`.
- ⚠️ Add golden tests ensuring passes populate context as expected; the current Vitest coverage asserts pipeline wiring, but we still lack persisted fixture-based comparisons that guard against accidental regressions when scope/type logic expands.

**Next Phase 2 milestones**

- [ ] Promote the scope builder to resolve identifier references against nested scopes once Phase 1 follow-ups land.
- [ ] Model control-flow blocks (if/else, loops) so later module migrations can reason about execution order.
- [ ] Capture and expose inferred constant/series metadata in a format that existing modules can consume without shims.

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

| Module | Legacy Complexity | AST Migration Status | Notes |
| --- | --- | --- | --- |
| core-validator | High | ☐ Not Started | Establishes statement ordering; migrate early |
| function-declarations | High | ☐ Not Started | Dependent on AST function nodes |
| type-validator | High | ☐ Not Started | Requires semantic pass outputs |
| scope-validator | High | ☐ Not Started | Will leverage scope builder |
| switch-validator | Medium | ☐ Not Started | Control flow constructs |
| while-loop-validator | Medium | ☐ Not Started | Loop node traversal |
| builtin-variables-validator | Medium | ☐ Not Started | Replace line scanning with identifier resolution |
| ta-functions-validator | Medium | ☐ Not Started | Rely on call expressions |
| strategy-functions-validator | Medium | ☐ Not Started | AST call classification |
| history-referencing-validator | High | ☐ Not Started | Needs AST index expressions |
| ... | ... | ... | Extend table as modules migrate |

## 10. Definition of Done

- All validation modules run exclusively on AST-derived data structures.
- Parser + AST layers have ≥90% test coverage with regression fixtures for previously reported bugs.
- Monaco integration consumes AST diagnostics and exposes improved language features.
- Legacy text-based parsing utilities removed; documentation updated to describe AST-first architecture.

## 11. References & Best Practices

- Monaco editor diagnostics best practices: produce stable `owner`, `source`, `code`, and `relatedInformation` entries for AST diagnostics.
- Keep parser pure and side-effect free; semantic passes handle context-specific logic.
- Use visitor pattern or pattern matching on discriminated unions for predictable traversal.
- Provide developer ergonomics via strongly typed builders (`createBinaryExpression`, etc.).

