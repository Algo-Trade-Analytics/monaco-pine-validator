# Chevrotain Parser Development Plan

## Current Progress

- Implemented `repeat ... until` loop parsing, including lexer support, AST node construction, and recovery coverage for missing `until` guards so the grammar now accepts Pine's do-while control flow.
- Control-flow, scope, and type inference pipelines understand the new repeat nodes, keeping downstream validators aligned with the expanded Chevrotain AST.
- Regression tests assert positive parsing, AST shape, and recovery semantics to guard the new feature set while documenting outstanding fixtures for annotations and null-coalescing syntax.

## Parser Feature Backlog

1. **Compiler Annotations**
   - Tokenise `//@function`, `//@param`, `//@returns`, and strategy-specific annotations.
   - Attach parsed annotations to subsequent declarations and expose them through the AST for Monaco metadata.
   - Add fixtures covering stacked annotations, trailing comments, and recovery for unterminated annotation blocks.
2. **Null-Coalescing / Conditional Sugar**
   - Confirm the final Pine Script syntax, then extend the expression grammar with correct precedence relative to ternaries and logical operators.
   - Cover chained usage (`foo ?? bar ?? baz`) and mixed `?:`/`??` nesting in regression tests.
3. **Iterable Literals & Inline Functions**
   - Parse array/map literals and anonymous `=>` functions in expression positions to unlock remaining validator migrations.
   - Ensure tuple destructuring and inline function expressions co-exist with the new repeat loop semantics.

## Recovery & Resilience Enhancements

- Add negative fixtures for repeat loops (unterminated bodies, dedented `until` clauses, nested repeats) to benchmark error production without collapsing the partial AST.
- Expand deep-nesting tests to include repeat loops inside switch cases and chained conditionals to confirm recovery performs consistently across mixed control flow.
- Profile parser performance on large scripts featuring repeat loops to validate the shared parser instance retains acceptable throughput.

## Integration & Rollout

- Update Monaco worker integration tests to exercise repeat loops, ensuring diagnostics, hover data, and control-flow graphs reflect the new node type.
- Audit validator modules that track loop usage (performance, resource, boolean guardrails) to include repeat loops and document any behavioural differences from `while` semantics.
- Once annotations and null-coalescing sugar land, rerun the dual-run harness to confirm Chevrotain parity before promoting the AST pipeline to default.

## Tracking & Communication

- Mirror status updates in `docs/validator-ast-migration-plan.md` after each grammar milestone so stakeholders see progress alongside operational readiness.
- Capture follow-up issues for any validator gaps discovered while enabling repeat loops, ensuring the development plan stays actionable.
