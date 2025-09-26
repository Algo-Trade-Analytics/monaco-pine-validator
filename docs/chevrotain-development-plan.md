# Chevrotain Parser Development Plan

## Current Progress

- Implemented `repeat ... until` loop parsing, including lexer support, AST node construction, and recovery coverage for missing `until` guards so the grammar now accepts Pine's do-while control flow.
- Control-flow, scope, and type inference pipelines understand the new repeat nodes, keeping downstream validators aligned with the expanded Chevrotain AST.
- Compiler annotations now tokenise as dedicated nodes and attach to subsequent declarations so library metadata, Monaco hovers, and downstream validators can surface structured documentation strings.
- Null-coalescing `??` expressions parse as binary nodes that chain correctly and interleave with logical/conditional operator precedence, rounding out the expression coverage required by the staged fixtures.
- Regression tests assert positive parsing, AST shape, and recovery semantics to guard the new feature set while documenting outstanding fixtures for additional syntactic sugar.
- Collection iteration headers (`for … in`) tokenise the `in` keyword, populate iterator/iterable metadata on `ForStatement` nodes, and support tuple destructuring so validators can reason about loop-scoped bindings.
- Parenthesised `=>` expressions now build dedicated `ArrowFunctionExpression` nodes with shared parameter helpers, and the traversal, scope, and type-inference pipelines treat the inline functions like standard declarations so downstream modules receive full metadata.【F:core/ast/parser/rules/expressions.ts†L90-L188】【F:core/ast/traversal.ts†L60-L140】【F:core/ast/scope.ts†L200-L360】【F:core/ast/type-inference.ts†L360-L520】

## Parser Feature Backlog

1. **Iterable Literal Coverage**
   - Implement array/map literal expression nodes to complement existing tuple/matrix parsing and keep iterable coverage aligned with the reference types list.【F:PineScriptContext/structures/types.json†L1-L15】【F:tests/ast/chevrotain-parser.test.ts†L261-L311】
   - Broaden fixtures for map iteration results (e.g., `[key, value]` destructuring with loop return assignments) to exercise downstream validators once literals are available.【F:PineScriptContext/structures/keywords.ts†L24-L56】
2. **Additional Expression Sugar**
   - Audit remaining Pine syntactic sugar (e.g., range literals, pipeline helpers) and extend the grammar plus fixtures so the Chevrotain pipeline mirrors production coverage.

## Recovery & Resilience Enhancements

- Add negative fixtures for repeat loops (unterminated bodies, dedented `until` clauses, nested repeats) to benchmark error production without collapsing the partial AST.
- Expand deep-nesting tests to include repeat loops inside switch cases and chained conditionals to confirm recovery performs consistently across mixed control flow.
- Introduce failure fixtures for misplaced compiler annotations (e.g., dangling at EOF or preceding non-declaration statements) to verify the parser degrades gracefully while preserving partial ASTs.
- Profile parser performance on large scripts featuring repeat loops to validate the shared parser instance retains acceptable throughput.

## Integration & Rollout

- Update Monaco worker integration tests to exercise repeat loops, ensuring diagnostics, hover data, and control-flow graphs reflect the new node type.
- Audit validator modules that track loop usage (performance, resource, boolean guardrails) to include repeat loops and document any behavioural differences from `while` semantics.
- Once null-coalescing sugar lands, rerun the dual-run harness to confirm Chevrotain parity before promoting the AST pipeline to default.

## Tracking & Communication

- Mirror status updates in `docs/validator-ast-migration-plan.md` after each grammar milestone so stakeholders see progress alongside operational readiness.
- Capture follow-up issues for any validator gaps discovered while enabling repeat loops, ensuring the development plan stays actionable.
