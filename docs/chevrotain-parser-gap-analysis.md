# Chevrotain Parser Gap Analysis

## Data sources
- Pine Script® v6 language reference manual (local snapshot) documents control-flow constructs, including expression-returning `if` statements and loops with optional result bindings.【F:PineScriptContext/pine-script-refrence.txt†L16779-L16841】【F:PineScriptContext/pine-script-refrence.txt†L16925-L16959】【F:PineScriptContext/pine-script-refrence.txt†L17232-L17246】
- The generated Pine Script structures mirror the reference syntax and highlight optional `for … in` iterator forms that return values and support tuple destructuring targets.【F:PineScriptContext/structures/keywords.ts†L20-L68】
- The current Chevrotain grammar and AST node definitions reveal which constructs are emitted today and which metadata is absent from the resulting tree.【F:core/ast/parser/rules/control-flow.ts†L190-L446】【F:core/ast/parser/rules/expressions.ts†L440-L531】【F:core/ast/nodes.ts†L148-L314】

## Confirmed coverage
- The parser recognises statement-oriented `if`, `for`, `while`, `repeat`, and `switch` constructs, emitting the corresponding AST nodes with indentation-aware bodies and optional loop initialisers.【F:core/ast/parser/rules/control-flow.ts†L190-L446】【F:core/ast/nodes.ts†L271-L314】
- `for … in` headers now accept iterator targets that include tuple destructuring, matching the array iteration forms captured in the Pine structures.【F:core/ast/parser/rules/control-flow.ts†L223-L322】【F:PineScriptContext/structures/keywords.ts†L20-L68】
- Inline `if … else` chains now parse as `IfExpression` nodes, allowing assignments, declarations, and arguments to consume expression-form conditionals while preserving branch blocks for downstream analysis.【F:core/ast/parser/rules/expressions.ts†L480-L509】【F:core/ast/nodes.ts†L281-L286】【F:core/ast/traversal.ts†L240-L279】【F:core/ast/scope.ts†L200-L278】【F:core/ast/type-inference.ts†L424-L485】
- Parenthesised arrow functions emit `ArrowFunctionExpression` nodes that share the declaration helpers for parameters and block parsing, with traversal, scope, and inference plumbing matching the behaviour of named functions.【F:core/ast/parser/rules/expressions.ts†L90-L188】【F:core/ast/nodes.ts†L40-L120】【F:core/ast/traversal.ts†L60-L140】【F:core/ast/scope.ts†L200-L360】【F:core/ast/type-inference.ts†L360-L520】
- `for`/`for … in` and `while` constructs now parse in expression positions and expose their trailing result expression so downstream passes can analyse loop-returned values alongside the block body.【F:core/ast/parser/rules/control-flow.ts†L223-L434】【F:core/ast/parser/rules/expressions.ts†L512-L524】【F:core/ast/nodes.ts†L300-L316】【F:core/ast/traversal.ts†L260-L278】【F:core/ast/scope.ts†L369-L403】【F:core/ast/type-inference.ts†L488-L540】
- `repeat ... until` loops promote their trailing expression or return argument to a `result` field, aligning semantics with `for`/`while` expressions and removing the last loop-return blind spot.【F:core/ast/parser/rules/control-flow.ts†L223-L446】【F:core/ast/nodes.ts†L290-L316】【F:core/ast/traversal.ts†L248-L269】【F:core/ast/scope.ts†L360-L403】【F:core/ast/type-inference.ts†L440-L536】

## Identified gaps

No outstanding structural parser gaps have been identified after capturing repeat loop results. Focus now shifts to hardening the new metadata across the toolchain.

## Recommended next steps
1. **Audit downstream passes** (diagnostics, optimisation, etc.) that consume loop nodes to ensure they respect the new `result` metadata and can reason about loop expressions when used in nested positions.
2. **Add fixtures covering nested loop expressions** (e.g., `array.map(for value in source …)`) and repeat-loop blends to exercise the new expression support under richer syntactic compositions.
3. **Track module-level regressions** once AST-backed validation is enabled by default, confirming repeat loop results flow into linting, performance, and control-flow diagnostics without manual block inspection.
