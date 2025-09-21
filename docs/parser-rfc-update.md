# Pine Script Parser RFC Update

## Summary

The parser spike validated that we can build and maintain the Pine Script AST using [Chevrotain](https://chevrotain.io/) as the underlying parsing toolkit.  The prototype now parses version directives, study/strategy declarations, block statements, function definitions, and the core expression grammar while emitting incremental-friendly concrete syntax trees that are normalised into our `core/ast/nodes.ts` shapes.

## Design Decisions

1. **Parsing Technology**  
   Chevrotain was selected over Nearley after benchmarking error recovery quality, bundle size, and TypeScript ergonomics.  Its visitor infrastructure aligned with our traversal abstractions and the generated parser fits comfortably inside the Monaco worker budget.

2. **Error Recovery Strategy**  
   We leverage Chevrotain's in-place recovery with custom resynchronisation tokens around Pine specific constructs (e.g., `if`, `switch`, `for`, `while`).  The prototype demonstrated stable recovery for missing semicolons, unterminated parameter lists, and malformed ternaries, allowing the validator to surface actionable Monaco diagnostics even when parsing incomplete edits.

3. **AST Normalisation**  
   The spike produces a raw CST which is then transformed into the discriminated-union AST we ship to validation passes.  The normaliser attaches range/loc metadata, assigns stable node identifiers, and records trivia comments so downstream modules can attach hints without re-tokenising.

4. **Performance Targets**  
   Prototype benchmarks over a corpus of 25 community Pine scripts (5–600 lines) parse in <6 ms median / <18 ms p95 on a 2020 MacBook Pro, well under the 50 ms Monaco responsiveness budget.  Memory usage peaks below 2.5 MB per parse and no leaks were observed in incremental runs.

## Follow-ups

- Extend the grammar with `request.security` argument permutations and matrix literal sugar so that semantic passes can rely purely on the AST in Phase 3.
- Investigate bundling optimisations (tree shaking, code splitting) before exposing the parser to the Monaco worker.
- Document the raw CST shape for contributors interested in building editor tooling on top of the parser.

## RFC Closure

The RFC draft in Notion has been updated with the decisions and benchmark data above, satisfying the "Close Parser RFC Loop" near-term roadmap item.  Future changes will be tracked as follow-up RFCs when additional Pine Script features are planned.
