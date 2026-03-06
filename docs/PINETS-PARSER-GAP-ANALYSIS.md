# PineTS Parser Gap Analysis

Date: 2026-03-07

Reference implementation reviewed:
- Repo: https://github.com/QuantForgeOrg/PineTS
- Commit: `94c2254aae5319e72cf6c8dbcc919c7235994b8a`
- Parser files: `src/transpiler/pineToJS/{tokens.ts,lexer.ts,parser.ts,ast.ts}`

## Goal

Capture parser concepts we can learn from PineTS and port into `monaco-pine-validator` incrementally, with tests per concept.

## Concept Matrix

| Concept | PineTS | monaco-pine-validator | Status |
|---|---|---|---|
| Indentation-aware block model | Explicit `INDENT`/`DEDENT` tokens in lexer | Column model + optional indentation-token pre-pass (`useIndentationTokens`) | Improved (Phase 4, opt-in) |
| Legacy type declaration syntax (`type Name =>`) | Supported | Was unsupported/crashing; now supported | Done (Phase 1) |
| Switch without discriminant (`switch` + guarded cases) | Supported | Supported (`__switch_guard__` synthetic discriminant) | Done |
| For-in iterator destructuring (`for [a, b] in x`) | Supported | Supported | Done |
| Generic type parsing (`array<float>`, `map<K,V>`) | Supported | Supported | Done |
| Method declarations (`method Foo.bar(...) =>`) | Supported | Supported (function modifiers) | Done |
| Named arguments in calls | Supported | Supported (`ArgumentNode.name`) | Done |
| Keyword-token named argument labels (`type = ...`) | Supported (`KEYWORD` labels in call args) | Supported (`canBeNamedArgumentNameToken`) | Done (Phase 5) |
| Postfix member/call chaining across newline after dot (`.\nmethod()`) | Supported (`parsePostfix` skips newlines after `.`) | Supported in call/member/identifier parsing | Done (Phase 6) |
| Dotted type references (`chart.point`, `line.style`) in declarations/params/generics | Supported (`parseTypeExpression`) | Supported end-to-end (`buildTypeReferenceFromTokens` + declaration-start guard updates) | Done (Phase 8) |
| Mixed comma sequences (`a = 1, b = 2, a + b`) | Supported (`parseStatementOrSequence`) | Supported (assignment branch now accepts assignment + expression items) | Done (Phase 8) |
| Comment token retention in parser stream | Supported (COMMENT tokens) | Added opt-in comment stream (`includeComments`) in diagnostics | Done (Phase 3) |
| Newline continuation guard for ambiguous `+`/`-` across indent boundaries | Supported (`peekOperatorEx`) | Added guard in additive lookahead (`hasBinaryOperatorAhead`) | Done (Phase 2) |
| Type inheritance (`type Child extends Parent`) | `extends` keyword supported | `Extends` token + `parentType` on `TypeDeclarationNode` | Done (Phase 9) |
| Postfix increment/decrement (`x++`, `x--`) | `UpdateExpression` with prefix/postfix | Supported via `UnaryExpression(prefix=false)` | Done (Phase 15) |
| Semicolon token (`;`) | Lexed as `SEMICOLON` | Tokenized and accepted as a statement separator | Done (Phase 13) |
| Brace tokens (`{`, `}`) | Lexed, depth tracked for line-continuation | Tokenized in Chevrotain lexer | Done (Phase 14) |
| Brace depth in line-continuation | Suppresses NEWLINE inside `{}` | Prepass now tracks `{}` alongside `()` and `[]` | Done (Phase 14) |
| Multi-qualifier typed declarations (`var series float x = ...`) | Full qualifier chain parsing | Verified working | Done (Phase 10) |
| Array shorthand type (`float[] x = ...`) | Explicit `TYPE[]` parsing | Verified working | Done (Phase 11) |
| Typed `varip` with generics (`varip array<float> x = ...`) | Full type parsing in `parseVarDeclaration` | Verified working | Done (Phase 12) |
| `\|\|` and `&&` operator permissiveness | Lexed as valid multi-char operators | `InvalidLogicalAnd`/`InvalidLogicalOr` (flagged as errors) | **Intentional difference** |
| `na` handling | Plain identifier | Dedicated `NaToken` | **Intentional difference** |

## Port Backlog (Prioritized)

### Completed (Phases 1-8)

1. `DONE` Support legacy `type Name =>` syntax.
2. `DONE` Add continuation-boundary guard for ambiguous binary `+`/`-` when newline crosses indentation boundary.
3. `DONE` Add optional comment-node capture mode (or comment stream) for richer tooling.
4. `DONE (experimental)` Introduce an explicit indentation-token pre-pass (`INDENT`/`DEDENT` model) to simplify block parsing and reduce edge-case ambiguity.
5. `DONE` Support keyword-token labels in named call arguments (e.g., `type = input.string`) to match PineTS behavior and avoid recovery crashes.
6. `DONE` Allow postfix member chaining across newline after dot (PineTS `parsePostfix` style `.\nmethod()`).
7. `DONE` Migrate to true prepass-emitted virtual `INDENT`/`DEDENT` tokens for block-oriented parser rules.
8. `DONE` Support dotted type references consistently in variable declarations, function parameters, and generic type arguments.
9. `DONE` Support mixed assignment/expression comma sequences and avoid parser crash recovery paths.

### Remaining Gaps (Phase 9+)

10. `DONE` **Type inheritance with `extends`**: Added `Extends` token and `parentType: TypeReferenceNode | null` field to `TypeDeclarationNode`. Supports dotted parent types (`chart.point`).

11. `DONE` **Postfix increment/decrement (`x++`, `x--`)**: Added postfix parsing support using the existing `UnaryExpressionNode` shape with `prefix: false`. This preserves validator compatibility while matching PineTS acceptance.

12. `DONE` **Semicolon token**: Added `Semicolon` token support in the Chevrotain lexer and threaded it through top-level and indented-block statement separation.

13. `DONE` **Brace tokens (`{`, `}`)**: Added `LBrace`/`RBrace` tokens to the Chevrotain lexer so the token stream matches PineTS more closely for future grammar work.

14. `DONE` **Brace depth in line-continuation logic**: Updated the indentation prepass so `{}` participates in continuation-depth tracking, preventing false structural indentation inside brace-delimited contexts.

15. `TODO` **`na` as keyword vs identifier**: PineTS does not treat `na` specially in its lexer (it's an identifier). Our parser has a dedicated `NaToken`. Consider whether this causes any edge-case issues.

16. `DONE` **Multi-qualifier type annotations in var/varip**: Verified `var series float x = 1.0` and `series float x = 1.0` parse correctly.

17. `DONE` **Array shorthand type syntax (`float[] x = ...`)**: Verified `float[] arr = array.new<float>(10)` parses correctly.

18. `DONE` **`varip` with type + array/generic**: Verified `varip array<float> x = array.new<float>(10)` parses correctly.

19. `TODO` **Function name collision avoidance**: PineTS tracks `functionNames` and renames variables that collide with function names by appending `_var` (e.g., if function `foo` exists, variable `foo` becomes `foo_var`). This is a transpiler concern but may be relevant for diagnostics/warnings.

20. `TODO` **IIFE detection for complex if-expressions**: PineTS detects when if-expressions need IIFE wrapping (multi-statement branches, nested control flow) via `needsIIFE`. This is a code-generation concern but the AST marking (`needsIIFE` flag) could be useful for validation warnings about expression complexity.

21. `TODO` **`||` and `&&` as valid operators**: PineTS lexes `||` and `&&` as multi-character operators and converts them to standard logical ops during parsing. Our parser has `InvalidLogicalAnd` and `InvalidLogicalOr` tokens that flag these as errors. This matches TradingView behavior (Pine uses `and`/`or` keywords) but PineTS is more permissive.

## Phase 1 Completed in This Change

- Parser now accepts `type Name =>` before indented type fields.
- Added AST regression test for legacy syntax in `tests/ast/chevrotain-parser.test.ts`.

## Phase 2 Completed in This Change

- Added additive-expression lookahead guard so newline + deeper indentation does not force binary `+/-` continuation.
- Added AST regression tests:
  - blocked continuation across deeper indentation (`+` parsed as unary next statement),
  - allowed continuation when indentation remains in same logical level.

## Phase 3 Completed in This Change

- Added parser option `includeComments` to capture line-comment nodes in diagnostics.
- Added comment stream field to AST diagnostics (`diagnostics.comments`).
- Excluded compiler directive comments (version + `@...` annotations) from generic comment stream to avoid duplication with dedicated AST nodes.
- Added parser regression tests for:
  - comment capture when enabled,
  - no comment capture by default.

## Phase 4 Completed in This Change

- Added opt-in indentation-token pre-pass (`useIndentationTokens`) that builds a logical `INDENT`/`DEDENT` model from lexer output.
- Threaded this model into the existing parser (no new parser implementation) so line-indent lookups and block parsing can consume effective structural indentation.
- Migrated control-flow/declaration indentation decisions to resolved indentation (`parser.resolveTokenIndent`) so opt-in mode applies consistently to `if/else`, loops, `switch`, `type`, and `enum` parsing.
- Continuation/wrap lines (non-multiple-of-4 indentation) are treated as non-structural in this mode.
- Added parser regression tests covering:
  - default behavior unchanged when mode is off,
  - non-structural indentation handling when mode is enabled.

## Phase 5 Completed in This Change

- Added named-argument parsing support when the label is lexed as a keyword token (`type`, `if`, etc.).
- Imported PineTS-style behavior that treats call labels as identifier-like words, not only identifier tokens.
- Added parser regression tests for:
  - `type = ...` named arguments in function calls,
  - keyword-token labels parsing without parser crashes.

## Phase 6 Completed in This Change

- Added PineTS-style postfix chaining across newline after dot in parser rules:
  - `callExpression` and `memberExpression` now accept `.\nidentifier`,
  - `identifierExpression` accepts dotted names continued after newline,
  - assignment-start lookahead supports member targets that continue after newline (`foo.\nbar := ...`).
- Added parser regression tests for:
  - call/member chaining across newline after dot,
  - assignment targets with member access continued after newline.

## Phase 7 Completed in This Change

- Added virtual `Indent`/`Dedent` token types and injected them into the parser input stream in `useIndentationTokens` mode.
- Upgraded indentation pre-pass from “indent map only” to “indent map + virtual token emission”.
- Updated block-oriented parser paths to consume virtual indentation tokens directly:
  - generic indented block parser (`parseIndentedBlock`),
  - `switch` case block structure,
  - `type` and `enum` declaration bodies.
- Added parser regressions for virtual-token parsing with:
  - type fields,
  - switch cases.

## Phase 8 Completed in This Change

- Improved type-reference parsing to retain dotted type names (`chart.point`) rather than truncating at the first identifier.
- Updated declaration start detection so typed declarations with dotted types (`chart.point p = na`) are parsed as declarations, while member assignments (`foo.bar = baz`) remain assignments.
- Fixed comma-sequence parsing for mixed items (`a = 1, b = 2, a + b`) to prevent parser crashes and align with PineTS sequence behavior.
- Added/updated parser regressions covering:
  - dotted type names in generics and parameters,
  - dotted type declarations without declaration keywords,
  - mixed assignment/expression comma sequences.

## Phase 9 Completed in This Change

- Added `Extends` token (`categories: [Identifier]`) to lexer and `AllTokens`.
- Added `parentType: TypeReferenceNode | null` to `TypeDeclarationNode` interface.
- Updated `createTypeDeclarationNode` builder to accept and propagate `parentType`.
- Updated `createTypeDeclarationRule` to parse optional `extends ParentType` (including dotted types).
- Added parser regression tests for:
  - `type Child extends Parent` with fields,
  - `export type` with extends,
  - dotted parent type (`chart.point`),
  - extends with no fields,
  - type without extends has `null` parentType.

## Phases 10-12 Verified in This Change

- Verified multi-qualifier typed declarations (`var series float x`, `series float x`) parse without errors.
- Verified array shorthand type (`float[] arr = ...`) parses without errors.
- Verified typed varip with generics (`varip array<float> x = ...`) parses without errors.

## Phases 13-15 Completed in This Change

- Added `Semicolon` token support and treated `;` as a structural statement separator in the program rule and indented-block parsing.
- Added `LBrace`/`RBrace` token support and extended indentation prepass delimiter tracking to include braces.
- Added postfix `++`/`--` parsing by reusing `UnaryExpressionNode` with `prefix: false`.
- Added regression coverage for:
  - semicolon-separated top-level statements,
  - semicolon-separated statements inside virtual-indentation blocks,
  - postfix increment parsing,
  - brace-aware indentation prepass behavior.

---

## Architectural Comparison

### PineTS Parser Architecture
- **Purpose**: Transpiler (Pine Script → JavaScript). Parser is stage 1 of a pipeline.
- **Approach**: Hand-written recursive descent lexer + parser (no parser framework).
- **Lexer**: Single-pass, emits `INDENT`/`DEDENT` tokens inline (Python-style). Tracks paren/bracket/brace depth to suppress newlines during line continuation.
- **Parser**: Recursive descent with operator precedence climbing. Uses `matchEx`/`peekOperatorEx` helpers for cross-newline operator matching.
- **AST**: ESTree-compatible nodes (for downstream JS code generation via `astring`).
- **Error handling**: Throws on first error. No recovery.
- **Code generation**: Direct AST-to-JS string emission (`CodeGenerator` class).

### Our Parser Architecture
- **Purpose**: Validator/diagnostics for Monaco editor. No code generation.
- **Approach**: Chevrotain parser framework with embedded actions.
- **Lexer**: Chevrotain-based tokenization with optional indentation pre-pass for virtual `INDENT`/`DEDENT` tokens.
- **Parser**: Recursive descent via Chevrotain rules. Error recovery built-in.
- **AST**: Custom node types with full source location tracking.
- **Error handling**: Comprehensive error recovery with diagnostic messages and suggestions.

### Key Differences
| Aspect | PineTS | Ours |
|---|---|---|
| Framework | None (hand-written) | Chevrotain |
| Error recovery | None (throws) | Full recovery with diagnostics |
| Source locations | Line/column on tokens only | Full offset ranges on AST nodes |
| INDENT/DEDENT | Always-on in lexer | Opt-in pre-pass |
| Operator tokens | Single `OPERATOR` type with string value | Individual token types per operator |
| Keyword tokens | Single `KEYWORD` type with string value | Individual token types per keyword |
| AST target | ESTree (for JS codegen) | Custom (for diagnostics/validation) |
| `not`/`and`/`or` | Parsed as keywords, emitted as `!`/`&&`/`\|\|` | Parsed as dedicated tokens |

### What We Can Learn (Non-Parser)
PineTS also has features beyond parsing that could inform our validation:
- **Scope analysis**: `ScopeManager` renames variables by scope prefix (`glb1_x`, `if2_y`, `fn3_z`). Could inform scope-aware diagnostics.
- **TA call ID tracking**: Unique IDs (`_ta0`, `_ta1`) for state isolation. Could inform "duplicate call" warnings.
- **Tuple return convention**: `[[value1, value2]]` double-bracket for tuples. Could inform tuple-return validation.
- **NaN-safe comparison**: `a == b` → `math.__eq(a, b)`. Could inform comparison-with-na warnings.

---

## Recommended Phase 9+ Implementation Order

Priority is based on likelihood of real Pine Script code hitting these features:

| Phase | Task | Effort | Impact | Status |
|---|---|---|---|---|
| 9 | Type inheritance (`extends`) | Medium | High | **Done** |
| 10 | Verify multi-qualifier typed declarations | Low | Medium | **Done** |
| 11 | Verify array shorthand type (`float[] x`) | Low | Medium | **Done** |
| 12 | Verify typed `varip` with generics | Low | Low | **Done** |
| 13 | Semicolon token | Low | Low - Future Pine v6 prep | **Done** |
| 14 | Brace tokens + depth tracking | Low | Low - Future Pine v6 prep | **Done** |
| 15 | Postfix increment/decrement | Low | Low - Pine uses prefix only | **Done** |
