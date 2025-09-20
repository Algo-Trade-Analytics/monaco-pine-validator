# Pine Script AST Parser RFC

## Summary

This RFC documents the parser evaluation performed for Phase 0 of the AST migration roadmap. After
comparing Chevrotain, Nearley, and Tree-sitter against our Monaco integration goals, we selected
**Chevrotain** as the foundation for the validator parser and produced a working prototype that
parses version directives, indicator declarations, variable declarations, assignments, and basic
expressions. The prototype ships as `createChevrotainAstService` and is now exercised by the
`tests/ast/parser.test.ts` suite.

## Evaluation Criteria

The selection focused on the following requirements derived from the migration plan:

- Incremental or recoverable parsing to keep Monaco diagnostics responsive.
- Strong TypeScript typings to avoid `any` leakage when building AST nodes.
- Ability to embed custom recovery/diagnostics to map syntax issues onto Monaco ranges.
- Small runtime footprint suitable for running in a web worker.
- Active maintenance and documentation.

## Options Considered

### Chevrotain

*Pros*
- Mature LL(k) parser toolkit written in TypeScript with excellent typing support.
- Built-in error recovery and customizable lexer, enabling Monaco-friendly diagnostics.
- No code-generation step; grammars are expressed directly in TypeScript.
- Proven integration stories with VS Code/Monaco in the wider community.

*Cons*
- LL grammar requires left-recursion refactors and explicit lookahead for some Pine constructs.
- Verbose rule definitions compared to PEG grammars.

### Nearley (+ Moo)

*Pros*
- PEG-based; grammars are declarative and often shorter.
- Moo lexer integrates cleanly for Pine tokenization.

*Cons*
- Grammar must be compiled (extra build step or runtime cost).
- Error recovery is limited; reporting precise Monaco ranges would require additional tooling.
- Generated parser is JavaScript-first, reducing TypeScript ergonomics.

### Tree-sitter

*Pros*
- Powerful incremental parsing with excellent editor integrations.
- Many existing grammars, including community Pine variants.

*Cons*
- Requires native compilation or WASM bindings (heavy for our current toolchain).
- Grammar DSL is C-based, raising the barrier for contributors.
- Browser/WASM story would need significant tooling work before adoption.

## Decision

Chevrotain strikes the best balance between TypeScript ergonomics, controllable error recovery, and
runtime footprint. Its LL grammar style keeps the parser definitions co-located with the AST builder,
which matches the "AST as backbone" principle in the roadmap. The new `core/ast/parser.ts` file
implements a Chevrotain-driven lexer and parser with AST node construction hooks.

## Prototype Coverage

The initial implementation supports:

- `//@version` directives and top-level indicator calls.
- `var`/`varip` declarations with optional initialisers.
- Simple assignments (`foo = bar`).
- Call expressions, string/number/boolean literals, and named arguments.

Diagnostics are returned even when the parse fails, and the service can optionally retain a partial
AST via the `allowErrors` flag. Location metadata (line/column/offset and ranges) is computed from
Chevrotain token positions so Monaco diagnostics can map directly to source spans.

## Follow-up Work

- Expand the grammar to cover strategies, functions, compound assignments, control flow, and
  namespace calls.
- Introduce traversal utilities (`NodePath`, visitors) once the node set stabilises.
- Benchmark the parser inside the Monaco worker to validate performance and memory expectations.
- Wire the AST service into the validator shadow mode to compare diagnostics with the legacy parser.
- Document contributor guidelines for extending the grammar (naming conventions, helper utilities).

This RFC completes the "Choose Parsing Technology" milestone outlined in Phase 0 and unblocks Phase 1
infrastructure work.
