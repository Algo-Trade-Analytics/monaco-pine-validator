# PineTS Parser Gap Analysis

Date: 2026-03-04

Reference implementation reviewed:
- Repo: https://github.com/QuantForgeOrg/PineTS
- Commit: `a073796fd6d53b87a57ced0a893c84ef85ddfdec`
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

## Port Backlog (Prioritized)

1. `DONE` Support legacy `type Name =>` syntax.
2. `DONE` Add continuation-boundary guard for ambiguous binary `+`/`-` when newline crosses indentation boundary.
3. `DONE` Add optional comment-node capture mode (or comment stream) for richer tooling.
4. `DONE (experimental)` Introduce an explicit indentation-token pre-pass (`INDENT`/`DEDENT` model) to simplify block parsing and reduce edge-case ambiguity.
5. `DONE` Support keyword-token labels in named call arguments (e.g., `type = input.string`) to match PineTS behavior and avoid recovery crashes.
6. `DONE` Allow postfix member chaining across newline after dot (PineTS `parsePostfix` style `.\nmethod()`).
7. `DONE` Migrate to true prepass-emitted virtual `INDENT`/`DEDENT` tokens for block-oriented parser rules.
8. `DONE` Support dotted type references consistently in variable declarations, function parameters, and generic type arguments.
9. `DONE` Support mixed assignment/expression comma sequences and avoid parser crash recovery paths.

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
