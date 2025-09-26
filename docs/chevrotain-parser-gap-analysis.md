# Chevrotain Parser Gap Analysis

## Data sources
- Pine Script® v6 language reference manual (local snapshot) documents control-flow constructs, including expression-returning `if` statements and loops with optional result bindings.【F:PineScriptContext/pine-script-refrence.txt†L16779-L16841】【F:PineScriptContext/pine-script-refrence.txt†L16925-L16959】【F:PineScriptContext/pine-script-refrence.txt†L17232-L17246】
- The generated Pine Script structures mirror the reference syntax and highlight optional `for … in` iterator forms that return values and support tuple destructuring targets.【F:PineScriptContext/structures/keywords.ts†L20-L68】
- The current Chevrotain grammar and AST node definitions reveal which constructs are emitted today and which metadata is absent from the resulting tree.【F:core/ast/parser/parser.ts†L2013-L2104】【F:core/ast/parser/parser.ts†L2682-L2709】【F:core/ast/nodes.ts†L271-L298】

## Confirmed coverage
- The parser recognises statement-oriented `if`, `for`, `while`, `repeat`, and `switch` constructs, emitting the corresponding AST nodes with indentation-aware bodies and optional loop initialisers.【F:core/ast/parser/parser.ts†L2013-L2104】【F:core/ast/nodes.ts†L271-L298】
- `for … in` headers now accept iterator targets that include tuple destructuring, matching the array iteration forms captured in the Pine structures.【F:core/ast/parser/parser.ts†L2044-L2054】【F:PineScriptContext/structures/keywords.ts†L20-L68】

## Identified gaps

### 1. Expression-form `if` statements are not parsed
The reference manual allows `if` chains to return a value directly (e.g., `x = if condition … else …`), but the Chevrotain expression grammar does not accept `if` as a primary expression. `If` nodes are only constructed inside the statement dispatcher, so any assignment or variable declaration whose right-hand side begins with `if` fails to parse today.【F:PineScriptContext/pine-script-refrence.txt†L16925-L16959】【F:core/ast/parser/parser.ts†L2013-L2041】【F:core/ast/parser/parser.ts†L2682-L2709】

*Action*: Introduce an expression rule for `if`/`else` chains (or allow the statement rule to surface an `IfExpression` node) so assignments, declarations, and call arguments can consume inline `if` expressions with consistent range data.

### 2. Loop result bindings cannot be expressed
Both counter-based and collection-based loops support optional result bindings—`[variables =|:=] for …` and `[var_declaration =] for … in …`—yet the grammar insists on `for` being the leading token. As a result, `sum = for i = 0 to length` or tuple bindings in front of `for … in` are rejected, even though they are legal per the reference manual.【F:PineScriptContext/pine-script-refrence.txt†L16779-L16841】【F:core/ast/parser/parser.ts†L2044-L2104】

*Action*: Add a loop-expression production that can appear wherever an expression is expected, returning a `ForStatement`-compatible node while capturing the optional assignment target before the `for` keyword.

### 3. While loops lack optional declaration/return expression support
`while` statements in Pine Script may begin with a binding (`variable_declaration = while condition`) and can yield a final `return_expression`. The parser only matches bare `while` statements and does not expose any field for the trailing expression, so downstream passes cannot recover the loop’s result value or bound variable metadata.【F:PineScriptContext/pine-script-refrence.txt†L17232-L17246】【F:core/ast/parser/parser.ts†L2145-L2156】【F:core/ast/nodes.ts†L284-L287】

*Action*: Mirror the range-loop treatment by supporting expression-form `while` constructs and extending the AST node to carry the bound declaration and optional return expression.

### 4. Loop return expressions are dropped from the AST
The specification emphasises that `for`, `for … in`, and `while` bodies return the value of their final expression when used with a binding, yet the AST node shapes only retain the block body without a dedicated `returnExpression` slot. Consumers must currently re-scan the block to guess the last expression, which is brittle for diagnostics and type inference.【F:PineScriptContext/pine-script-refrence.txt†L16779-L16841】【F:PineScriptContext/pine-script-refrence.txt†L17232-L17246】【F:core/ast/nodes.ts†L278-L298】

*Action*: Extend `ForStatementNode`, `WhileStatementNode`, and `RepeatStatementNode` with an explicit `result` (or similar) field populated during parsing so loop return semantics match the reference manual.

## Recommended next steps
1. **Design expression-form AST nodes** covering `if`, `for`, and `while` so result-binding syntax can be parsed without duplicating statement logic.
2. **Update fixtures and regression tests** with assignments such as `sum = for ...` and `x = if ...` to lock in the newly supported grammar.
3. **Propagate new loop metadata** through control-flow, scope, and type-inference builders to ensure loop results are analysed consistently once the parser emits them.
