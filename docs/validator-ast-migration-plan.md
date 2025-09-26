# Pine Script Validator AST Migration Roadmap

## 1. Objectives

- Replace the current line/token driven validators with an Abstract Syntax Tree (AST) centric pipeline that becomes the authoritative source of truth for all semantic decisions.
- Preserve the existing behavioural coverage by driving the migration with TDD at the module level and at the end-to-end validator level.
- Provide a Monaco Editor friendly validation experience (rich diagnostics, hover/intellisense hooks) by structuring the AST pipeline around established editor-linter best practices.

## 2. Current State Assessment

| Area | Current Approach | Pain Points |
| --- | --- | --- |
| Parsing | Legacy hand-written scanners (regex across modules) operating on raw line arrays | Complex branching logic, hard to reason about, duplicated parsing code across modules |
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
- The built-in variables validator now consumes AST member expressions to detect namespace constants and short-circuits when structured analysis is disabled, keeping Monaco diagnostics aligned with Pine nodes without relying on legacy line-based scanning.
- Switch statements, matrix literals, and historical index expressions now have dedicated AST nodes with traversal, scope, type inference, and control-flow coverage, unblocking downstream modules that depend on these constructs.
- Type inference heuristics recognise namespaced TA and strategy helpers, applying return-type overrides and boosting series certainty when fed series arguments so downstream validators can rely on richer call metadata.
- The core validator consumes AST version directives and script declarations to pre-populate script metadata, emitting Monaco-aligned diagnostics for misplaced directives, missing titles, and duplicate script declarations without re-scanning raw lines.
- The TypeScript parser now produces the validator's structured AST format directly inside the pipeline, removing the temporary Python bridge while still returning rich syntax diagnostics when parsing fails.
- The Chevrotain parser now recognises assignment statements, compound operators, and variable declarations (including keyword modifiers, type annotations, and generic array types) while emitting range-accurate AST nodes backed by targeted regression tests.
- The Chevrotain parser now recognises indentation-based `if`/`else` statements and emits block statement nodes for nested branches, keeping ranges accurate while extending the regression coverage with control-flow fixtures.
- The Chevrotain parser now recognises indentation-based `while` loops alongside `return`, `break`, and `continue` statements, producing structured AST nodes and regression coverage for block-scoped flow control.
- The Chevrotain parser now recognises range-based `for` loops, synthesising comparison and step expressions (including default steps) while extending the regression suite to cover explicit `by` clauses.
- The Chevrotain parser now recognises indentation-based `switch` statements, supporting inline and block case bodies while emitting structured `SwitchStatement` nodes with dedicated regression coverage.
- The Chevrotain parser now recognises function declarations with typed parameters, dotted identifiers, and both implicit-expression and indented block bodies, emitting synthetic return statements where needed alongside dedicated regression coverage.
- The Chevrotain parser now recognises ternary conditional expressions, producing nested `ConditionalExpression` nodes so complex inline tests preserve operator precedence in the AST regression suite.
- The Chevrotain parser now recognises import declarations, enum blocks (including optional values and exports), and user-defined type declarations with typed fields, backed by regression tests to lock in alias spans and field metadata.
- The Chevrotain parser now recognises tuple destructuring assignments and matrix literals, emitting `TupleExpression`/`MatrixLiteral` nodes with regression coverage for bracketed targets and row-based literals.
- Core validator AST analysis now inspects call expressions to flag `strategy.*` usage in indicators, recognise plotting/drawing activity for PS014 guardrails, and enforce library restrictions without relying on regex fallbacks.
- The Chevrotain parser now recognises `repeat ... until` loops, emitting do-while style control-flow nodes with regression coverage for both successful parses and recovery from missing `until` guards.
- Compiler annotations now tokenise as dedicated nodes, attach to subsequent script/type/enum/function/variable declarations, and feed regression coverage so Monaco metadata and validator modules can consume structured documentation strings.
- Core validator AST analysis now inspects member expressions so strategy namespace usage in indicators is flagged even when no call expression is present, ensuring parity with the legacy scanner.
- Core validator AST analysis now inspects index expressions so negative history references on series data trigger PS024 errors without the legacy line scanner.
- A Monaco worker harness now exercises the AST-backed validator in a simulated worker environment, translating semantic output and syntax errors into Monaco-compatible markers for upcoming editor integration work.
- A dedicated Monaco worker entry point (`core/monaco/worker.ts`) now streams AST diagnostics, handles configuration updates, and exposes lifecycle messages for the editor integration path.
- Monaco worker responses now serialise AST scope/type metadata into semantic-model and hover datasets so Monaco features can consume structured symbol information without rehydrating validator state.
- Core validator AST analysis now inspects conditional tests, call arguments, and binary expressions to enforce v6 boolean guardrails, linewidth minimums, and `na` comparison warnings without relying on regex fallbacks.
- Core validator AST analysis now inspects `for` loop tests and ternary conditional expressions so v6 boolean guardrails trigger consistently across structured control flow and expressions.
- Core validator AST analysis now detects assignments inside conditional tests and surfaces expensive loop calls, replacing the PSO02 and PSP001 regex heuristics with structured traversal.
- Core validator AST analysis now consumes variable declarations and assignments to surface PSD01/PSD02/PS019 diagnostics without the legacy regex fallbacks.
- Core validator AST analysis now detects `:=` and compound assignments to undeclared identifiers so PS016/PS017 diagnostics originate from structured traversal rather than text scanning.
- Core validator AST analysis now tracks identifier usage and input placement so PSU01, PSU-PARAM, and PS027 diagnostics no longer rely on line-based token scanning.
- Core validator AST analysis now counts per-line history references so PSP002 performance warnings no longer rely on regex heuristics.
- Core validator AST analysis now registers type declarations and their fields so user-defined type metadata no longer depends on regex-driven scans.
- ✅ Function declarations validator now short-circuits when no AST is available, relying solely on structured traversal for metadata, duplicate parameter diagnostics, and static declaration errors after retiring the legacy text scanner.
- Core validator AST analysis now inspects tuple destructuring patterns to raise PST01/PST02/PST03 diagnostics without regex fallbacks.
- Core validator AST analysis now warns when local declarations shadow function parameters, removing the textual scope heuristic for PSW05.
- ✅ Core validator now requires AST data before executing, short-circuiting when structured analysis is disabled while keeping textual hygiene checks for indentation and braces in place.
- ✅ All validation modules now run exclusively on AST-derived metadata and the shared traversal helpers, fully retiring the remaining regex fallbacks and marking the Phase 3 module migration as complete.
- Scope validator now leverages AST symbol metadata to surface PSW03/PSW04 duplicate and shadowed declaration diagnostics without relying on indentation heuristics.
- Scope validator now analyses AST identifier references to emit PSU02 warnings without legacy text scanning heuristics.
- Scope validator now inspects AST declaration names to emit PS006/PS007 identifier errors without the legacy line scanner.
- ✅ Scope validator now short-circuits when no AST is available, relying solely on structured traversal for duplicate, shadowing, undefined reference, and identifier diagnostics after retiring the legacy text scanner.
- ✅ Type validator now short-circuits when no AST is available, relying solely on structured traversal for PSV6 type diagnostics after retiring the legacy text scanner.
- ✅ Dynamic loop validator now uses AST for-loop metadata to surface PSV6-FOR-DYNAMIC and PSV6-FOR-MODIFY warnings after retiring the legacy regex fallback path.
- ✅ While loop validator now consumes AST while statements to analyse conditions, performance, and control-flow best practices after retiring the legacy line-scanner fallback.
- ✅ Alert functions validator now inspects AST call expressions to validate alert frequencies, empty messages, and control-flow placement exclusively from structured traversal after retiring the legacy regex fallback.
- ✅ Strategy functions validator now analyses AST call expressions to validate known members, parameter usage, loop placement, and nested strategy references after retiring the legacy regex fallback path.
- ✅ TA functions validator now inspects AST call expressions to validate parameter shapes, loop placement, and boolean-result usage after retiring the legacy regex fallback path.
- ✅ Ticker functions validator now analyses AST call expressions to validate specialized constructors, modifier parameters, and value semantics after retiring the legacy regex fallback path.
- ✅ Dynamic data validator now analyses AST request.* invocations to validate parameters, detect dynamic contexts, and surface performance heuristics after retiring the legacy regex fallback path.
- ✅ Math functions validator now inspects AST call expressions to validate parameters, detect loop usage, and surface performance guidance exclusively from structured traversal after retiring the legacy regex fallback path.
- ✅ String functions validator now analyses AST call expressions to validate parameters, formatting helpers, and performance heuristics exclusively from structured traversal after retiring the legacy regex fallback.
- Drawing functions validator now analyses AST call expressions to validate line/label/box/table helpers, optional parameters, and performance heuristics after retiring the legacy regex fallback path.
- ✅ Polyline functions validator now analyses AST call expressions to validate creation/deletion patterns after retiring the legacy regex scanner fallback.
- ✅ Enhanced method validator now analyses AST member invocations to surface PSV6-METHOD-INVALID diagnostics after retiring the regex implementation fallback.
- ✅ Enhanced boolean validator now analyses AST if conditions to raise literal-condition, namespace, and short-circuit diagnostics after retiring the legacy regex fallback.
- ✅ Enhanced strategy validator now analyses AST strategy declarations and helper calls to drive commission, risk management, position size, and exit diagnostics after retiring the legacy regex fallback.
- ✅ Enhanced textbox validator now analyses AST box text creation and setters to validate parameters, surface dynamic text guidance, and reuse performance heuristics after retiring the legacy regex fallback path.
- ✅ Function types validator now analyses AST function bodies to surface return-type consistency, complexity, and length diagnostics after retiring the legacy regex fallback path.
- ✅ Enhanced semantic validator now analyses AST declarations, assignments, and functions to surface PSV6-TYPE-FLOW and PSV6-TYPE-INFERENCE guidance after retiring the legacy regex fallback path.
- ✅ Enhanced quality validator now analyses AST control flow and function bodies to compute complexity, nesting depth, and length diagnostics after retiring the legacy regex fallback path.
- ✅ Enhanced performance validator now analyses AST loops, request.security calls, history indexes, and alert usage after retiring the legacy regex fallback path.
- ✅ Enhanced migration validator now analyses AST call expressions and assignments to surface deprecated study, security, transp, and TA namespace guidance after retiring the legacy regex fallback path.
- ✅ Enhanced resource validator now inspects AST call expressions and loop constructs to surface memory allocation and complexity diagnostics after retiring the legacy regex fallback path.
- ✅ Enhanced library validator now analyses AST import declarations to validate paths, alias conflicts, version gaps, circular dependencies, and unused imports after retiring the legacy regex fallback path.
- ✅ Type inference validator now analyses AST declarations, assignments, function calls, and conditional expressions to surface assignment, annotation, conversion, and ambiguity diagnostics after retiring the legacy scanner fallback.
- ✅ Input functions validator now traverses AST call expressions to validate parameter counts, defaults, and best-practice guidance after retiring the legacy regex fallback path.
- ✅ Text formatting validator now inspects AST str.format calls to validate placeholders, parameter usage, and performance guidance after retiring the legacy regex scanner fallback.
- Time/date functions validator now inspects AST call expressions and member references to validate time_close, time_tradingday, timestamp, and timezone/session usage after retiring the legacy regex fallback path.
- ✅ Array validator now records AST-traversed declarations and operations so PSV6 array diagnostics, performance checks, and best-practice suggestions rely exclusively on structured traversal after retiring the legacy fallback.
- ✅ Varip validator now analyses AST varip declarations, assignments, and scope to surface performance and usage diagnostics after retiring the legacy regex fallback path.
- Enum validator now analyses AST enum declarations, value usage, comparisons, function parameters, and switch cases exclusively through structured traversal after retiring the regex-based fallback path.

### Near-Term TODOs

1. ✅ **Stand Up Dual-Run Harnesses** – the semantic golden suite now runs `EnhancedModularValidator` in AST shadow mode and diffs its diagnostics against the legacy pipeline for builtin namespace coverage, establishing a regression guardrail for upcoming module ports.
2. ✅ **Close Parser RFC Loop** – published the Chevrotain-based parser decision record in `docs/parser-rfc-update.md`, capturing recovery strategies, benchmarks, and follow-up work.
3. ✅ **Broaden AST Node Coverage** – added structural nodes for `switch`, matrix literals, and historical index expressions so currently blocked validators can migrate without bespoke fallbacks.
4. ✅ **Deepen Type Inference Rules** – namespaced TA and strategy helpers now surface richer return metadata and series certainty so the `strategy-functions` and `ta-functions` validators can rely on AST semantics.
5. ✅ **Document Monaco Integration Plan** – recorded the staged worker rollout strategy, testing plan, and dependencies in `docs/monaco-integration-plan.md`.
6. ✅ **Kick Off Core Validator AST Port** – Core validator now executes solely on structured traversal, retiring the legacy fallback while AST directives seed version/script metadata and drive strategy, plotting, library, and history diagnostics.
7. ✅ **Prototype Monaco Worker Harness** – landed a Vitest-driven worker harness that loads the AST pipeline and validates RPC wiring ahead of editor rollout.

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
| core-validator | High | ✅ Migrated | Validator Infra | Module now requires AST data, short-circuits when structured analysis is disabled, and drives core diagnostics solely from traversal with textual hygiene retained |
| syntax-validator | High | ✅ Migrated | Validator Infra | AST traversal now surfaces version, script, identifier, tuple, and assignment diagnostics after retiring the legacy regex fallback path |
| function-declarations | High | ✅ Migrated | Validator Infra | Function metadata, duplicate params, and static method errors sourced from AST traversal; legacy scanner retired |
| function-validator | High | ✅ Migrated | Module Owners Guild | AST traversal now gathers function declarations, call metadata, and parameter usage after retiring the legacy regex fallback |
| function-types-validator | High | ✅ Migrated | Module Owners Guild | AST traversal now enforces return consistency, complexity, and length diagnostics after retiring the legacy regex fallback |
| type-validator | High | ✅ Migrated | Semantic Working Group | AST traversal now surfaces PSV6 type diagnostics exclusively and the legacy text scanner has been retired |
| type-inference-validator | High | ✅ Migrated | Semantic Working Group | AST traversal now surfaces assignment, annotation, conversion, and ambiguity diagnostics after retiring the regex fallback |
| scope-validator | High | ✅ Migrated | Semantic Working Group | Scope diagnostics now rely exclusively on AST traversal for duplicate, shadowing, undefined-reference, and identifier checks after retiring the legacy text scanner |
| udt-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal records type declarations, methods, and diagnostics after retiring the legacy regex fallback path |
| enum-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates enum declarations, usage, and comparisons with the legacy regex scanner retired |
| switch-validator | Medium | ✅ Migrated | Language Infra | Switch diagnostics now sourced from AST cases and discriminants after retiring the legacy regex fallback path |
| alert-functions-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal validates alert calls, frequency usage, and control-flow guidance after retiring the legacy regex fallback |
| while-loop-validator | Medium | ✅ Migrated | Language Infra | AST traversal now surfaces while-loop diagnostics after retiring the legacy line-scanner fallback |
| dynamic-loop-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now surfaces dynamic loop bounds and mutation diagnostics after retiring the legacy regex fallback path |
| builtin-variables-validator | Medium | ✅ Migrated | Module Owners Guild | Validator now reads AST member expressions for constants, short-circuits when AST is disabled, and has removed the legacy line-scanner path |
| final-constants-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now records specialized constants after retiring the legacy regex fallback |
| v6-features-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now surfaces switch, request, enum, varip, and history guidance after retiring the legacy fallback path |
| ta-functions-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates TA calls, parameters, and loop placement after retiring the legacy regex fallback |
| math-functions-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates math calls, parameters, and performance heuristics after retiring the legacy regex fallback path |
| dynamic-data-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates request.* usage, performance heuristics, and dynamic-context guidance after retiring the legacy regex fallback |
| string-functions-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates string helpers, formatting, and performance guidance after retiring the legacy regex fallback |
| syminfo-variables-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now records syminfo namespace usage and advanced constants after retiring the legacy regex fallback |
| drawing-functions-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates drawing helpers, optional parameters, loop placement, and performance heuristics after retiring the legacy regex fallback |
| polyline-functions-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates polyline creation, deletion, and lifecycle heuristics after retiring the regex fallback |
| enhanced-method-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now emits PSV6-METHOD-INVALID diagnostics with the regex scanner retired |
| enhanced-boolean-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates literal conditions, namespace usage, and boolean-chain heuristics with the legacy regex scanner retired |
| enhanced-strategy-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates commission settings, risk guidance, position sizing, and exit coverage after retiring the legacy regex scanner |
| enhanced-textbox-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates textbox creation, setters, and performance heuristics after retiring the legacy regex scanner |
| enhanced-semantic-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now surfaces PSV6 type-flow and inference guidance after retiring the legacy regex fallback |
| enhanced-migration-validator | Low | ✅ Migrated | Module Owners Guild | AST traversal now surfaces study, security, transp, and TA namespace migration guidance after retiring the legacy regex fallback |
| enhanced-library-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates library imports, alias conflicts, version gaps, and usage guidance after retiring the legacy regex scanner |
| linefill-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates linefill constructors, updates, loop placement, and performance heuristics after retiring the regex fallback |
| style-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now surfaces naming, magic number, complexity, and organization diagnostics and the module short-circuits when no AST is available, retaining only textual hygiene checks |
| input-functions-validator | High | ✅ Migrated | Module Owners Guild | AST traversal now validates input calls, defaults, and best-practice guidance after retiring the legacy regex fallback |
| text-formatting-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates str.format usage and performance guidance after retiring the legacy regex scanner fallback |
| time-date-functions-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates time/date helpers, timezone arguments, and session constants after retiring the legacy regex fallback |
| strategy-functions-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal records strategy calls, loop contexts, and nested usage after retiring the legacy regex fallback |
| strategy-order-limits-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates order metadata, trimming heuristics, and time-filter guidance after retiring the legacy regex fallback path |
| ticker-functions-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates ticker constructors, modifiers, and named arguments after retiring the legacy regex fallback |
| performance-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now inspects memory allocations, loop structure, and expensive calls after retiring the legacy regex fallback path |
| lazy-evaluation-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now analyses conditional historical usage, user functions, and series consistency after retiring the legacy regex fallback path |
| history-referencing-validator | High | ✅ Migrated | Module Owners Guild | Index expression traversal now powers negative index, loop, and varip diagnostics without regex scanning |
| array-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now records array declarations, operations, and performance heuristics after retiring the legacy regex fallback | 
| matrix-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now records matrix declarations, operations, and performance heuristics after retiring the legacy regex fallback |
| map-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates map declarations, operations, and performance heuristics after retiring the legacy regex fallback |
| varip-validator | Medium | ✅ Migrated | Module Owners Guild | AST traversal now validates varip declarations, assignments, and scope after retiring the legacy regex fallback path |
| ... | ... | ... | ... | Extend table as modules migrate |

- ✅ Switch validator now emits PSV6 switch diagnostics from AST traversal after retiring the legacy regex fallback path.
- ✅ Strategy order limits validator analyses AST order metadata to drive loop, trimming, and parameter diagnostics after retiring the legacy regex fallback path.
- ✅ Strategy order limits validator now derives time-filter recognition, position-size guidance, and caching suggestions from AST metadata without relying on the legacy line scanner.
- ✅ Syntax validator analyses AST directives, script declarations, naming, tuple destructuring, and assignment semantics after retiring the regex fallback path.
- ✅ Drawing functions validator records drawing call metadata through AST traversal to validate parameters, loop guidance, and performance heuristics after retiring the legacy regex fallback path.
- ✅ Linefill validator records linefill call metadata through AST traversal to validate parameters, loop guidance, and performance heuristics after retiring the regex fallback path.
- ✅ While loop validator analyses AST conditions, loop bodies, and nesting depth after retiring the legacy line-scanner fallback.
- ✅ Input functions validator analyses AST call expressions to validate defaults, parameters, and guidance after retiring the legacy regex fallback path.
- ✅ V6 features validator analyses AST switch statements, feature calls, and declarations to surface compatibility guidance after retiring the legacy fallback path.
- ✅ Array validator gathers declarations and operations via AST traversal to emit PSV6 array diagnostics and performance guidance after retiring the legacy regex fallback path.
- ✅ Final constants validator inspects AST member expressions to surface math, style, order, position, and specialized constants after retiring the legacy line scan fallback.
- ✅ Dynamic data validator inspects AST request.* calls to surface parameter, performance, and dynamic-context guidance after retiring the legacy regex fallback path.
- ✅ Ticker functions validator analyses AST ticker calls, modifiers, and specialized constructors after retiring the legacy regex fallback path.
- ✅ Matrix validator gathers declarations and operations via AST traversal to emit PSV6 matrix diagnostics and performance guidance after retiring the legacy regex fallback path.
- ✅ Map validator gathers declarations and operations via AST traversal to emit PSV6 map diagnostics and performance guidance after retiring the legacy regex fallback path.
- ✅ Performance validator now analyses AST loop depth, memory allocations, and request usage after retiring the legacy regex fallback path.
- ✅ Varip validator analyses AST declarations, assignments, and scope to surface PSV6 guidance after retiring the legacy regex fallback path.
- ✅ Lazy evaluation validator analyses conditional historical usage, user functions, and series consistency through AST traversal after retiring the legacy regex fallback path.
- ✅ Function validator now records declarations, validates calls, and enforces complexity guidance exclusively through AST traversal after retiring the legacy regex fallback path.
- ✅ Style validator now requires AST data before running structural diagnostics, short-circuits when no tree is available, and continues to run textual hygiene checks for comments and indentation.
- ✅ Syminfo variables validator inspects AST member expressions to surface advanced syminfo usage and additional constants after retiring the legacy regex fallback path.
- ✅ Enhanced migration validator analyses AST call expressions and declarations to surface deprecated study/security usage, transp parameters, and TA namespace guidance after retiring the legacy regex fallback path.
- ✅ Enhanced semantic validator analyses AST declarations, assignments, and functions to surface PSV6 type-flow errors and inference guidance after retiring the legacy regex implementation.
- ✅ UDT validator gathers type declarations, methods, and usage diagnostics from AST traversal after retiring the legacy regex fallback path.
- ✅ History referencing validator now short-circuits when AST execution is disabled and surfaces negative-index, loop, and varip diagnostics exclusively from structured traversal after retiring the legacy regex fallback path.
- ✅ Retired the legacy `core/scanner.ts` helpers now that all validators rely on AST traversal for diagnostics.
- Added Chevrotain recovery regression coverage for unterminated `else` clauses, truncated deeply nested expressions, and mixed indentation inside blocks so partial ASTs remain consumable for Monaco diagnostics.

### Outstanding Chevrotain Grammar Coverage

| Construct | Current Status | Action Items |
| --- | --- | --- |
| Compiler annotations (`//@function`, `//@param`, `//@returns`, `//@strategy_alert_message`, etc.) | ✅ Implemented | Dedicated lexer tokens and AST nodes attach annotations to declarations with regression coverage validating stacked metadata. |
| Null-coalescing / ternary sugar | ✅ Implemented | Dedicated lexer token, precedence-aware binary rules, and regression coverage exercise chained/co-mingled `??` usage alongside logical and conditional expressions. |

## 10. Immediate Next Steps (Post-Review)

The initial AST plumbing is already landing (feature-flagged parsing in `BaseValidator`,
`AstValidationContext` extensions, lexer scaffolding, and validation smoke tests). To
capitalise on this progress, align the next iteration around the following workstream
plan:

1. **Chevrotain Parser Hardening**
   - ✅ Assignment statements, unary/binary expressions, compound operators, control-flow statements, and function declarations now normalise into Pine AST nodes with location metadata and regression coverage.
   - Backfill remaining expression coverage (array/map constructors, anonymous functions, namespace literals) and ensure tuple patterns work in nested assignment/return positions.
   - ✅ Recovery fixtures now cover indentation edge cases, dangling `else` branches, newline-separated expressions, and unterminated constructs so Monaco parsing remains resilient.
   - ✅ Implemented the staged `repeat ... until` loops, compiler annotations, and null-coalescing helpers; continue with iterable literals and inline function expressions so the Chevrotain grammar matches the outstanding fixtures and Monaco feature backlog.
   - Profile large scripts under the shared parser instance to confirm the recovery configuration does not introduce unacceptable overhead or memory growth.

2. **Flip the AST Pipeline on by Default**
   - Audit module-level feature flags and ensure any lingering legacy fallbacks short-circuit cleanly once Chevrotain is the primary parser.
   - Capture before/after timings for the validator suites and the Monaco worker harness to ensure Chevrotain parity does not regress latency budgets.
   - Stage the rollout behind a configuration toggle, document rollback steps, and add release checklist items for monitoring diagnostics deltas in production.

3. **Monaco Integration Enablement**
   - Exercise the worker harness against representative IDE workflows (hover, diagnostics refresh, semantic tokens) to confirm Chevrotain ASTs flow through without additional shims.
   - Document the editor-facing API contracts that rely on AST metadata so downstream feature work (quick fixes, go-to definition) can build atop the validated structures.
   - Plan incremental editor release gates (internal dogfood, beta channel, general availability) with success metrics tied to AST-backed diagnostics quality.

4. **Validator Operational Hardening**
   - Re-run the out-of-memory Vitest validator suite with focused sharding or memory flags and capture the configuration needed for CI stability.
   - Expand the semantic golden tests with scripts that stress tuple destructuring, matrix literals, and flow control to guard against regressions while the parser hardening work proceeds.
   - Establish alerting for critical diagnostics regressions when the AST pipeline is enabled by default (e.g., compare against previous release baselines).
   - Update packaging and integration samples so validators execute in AST `primary` mode without additional configuration.

3. **Phase 4 – Monaco Worker Integration**
   - Follow `docs/monaco-integration-plan.md` to expose AST diagnostics through the worker, including syntax error streaming and incremental validation hooks.
   - Port hover, completion, and quick-fix experiments to consume the AST scope/type metadata now available in the worker context.

4. **Phase 5 – Configuration & Cleanup**
   - Remove the dual-run/shadow toggles that are now redundant, simplify validator configuration, and collapse AST-disabled test harnesses.
   - Audit any remaining textual hygiene helpers to confirm they behave correctly alongside the AST-first modules and document any exceptions.

5. **Operational Hardening**
   - Profile validation throughput with large scripts to capture AST construction and traversal costs and feed the results into Monaco performance budgets.
   - Document rollout steps for enabling the AST pipeline in staged environments, including feature flags and regression monitoring.

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

