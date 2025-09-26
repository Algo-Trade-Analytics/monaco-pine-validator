# Chevrotain Parser Coverage Audit

## Data sources
- `PineScriptContext/structures/index.ts` exposes auto-generated Pine Script v6 structures (keywords, operators, annotations, etc.) that mirror the language reference used by the validator tooling.【F:PineScriptContext/structures/index.ts†L1-L68】
- The keyword structures explicitly capture both range-style and collection-style `for` loops, along with other reserved words the grammar must eventually recognise.【F:PineScriptContext/structures/keywords.ts†L6-L166】

## Confirmed alignment
- The Chevrotain grammar currently handles range-based `for` loops, collection-style `for … in` headers (including tuple destructuring), `if`/`else`, `switch`, `repeat`/`until`, and `while` statements in line with the keyword definitions, ensuring control-flow coverage for the constructs already wired into the validator.【F:core/ast/parser/rules/control-flow.ts†L190-L446】【F:PineScriptContext/structures/keywords.ts†L6-L166】
- Script, enum, type, import, and function declarations are parsed with dedicated rules that reuse the same tokens surfaced in the Pine Script structures, keeping declaration syntax in sync with the reference metadata.【F:core/ast/parser/rules/declarations.ts†L60-L198】
- The lexer token set already includes the operator and logical keyword surface (e.g., `and`, `or`, `not`, compound assignments, ternary separators) enumerated in the Pine Script structures, so expression precedence aligns with the documented operator list.【F:core/ast/parser/tokens.ts†L1-L240】【F:PineScriptContext/structures/operators.json†L1-L18】
- Parenthesised `=>` function expressions now materialise as `ArrowFunctionExpression` nodes that reuse the declaration parameter helpers and block parsing utilities, closing the inline-function gap called out by the structures guide.【F:core/ast/parser/rules/expressions.ts†L90-L188】【F:core/ast/parser/node-builders.ts†L9-L39】【F:core/ast/nodes.ts†L40-L120】

## Identified gaps
- Loop result binding syntax (e.g., `sum = for ...` sugar that binds the final value inline) still lacks dedicated grammar support even though the reference manual permits binding targets ahead of the loop keyword; expression-form `for`/`while` loops and repeat results now flow through the AST, but binding aliases remain to be implemented.【F:PineScriptContext/structures/keywords.ts†L24-L92】【F:PineScriptContext/pine-script-refrence.txt†L16779-L17246】【F:core/ast/parser/rules/control-flow.ts†L223-L446】
- Literal collection forms described in the structures (e.g., arrays and maps) have not yet been implemented as expression nodes; tuple and matrix literals exist, but general array/map literals remain outstanding for full iterable support.【F:PineScriptContext/structures/types.json†L1-L15】【F:tests/ast/chevrotain-parser.test.ts†L261-L311】

## Recommended next steps
1. **Add loop result binding support**
   - Extend the statement and expression grammar so loop constructs accept optional assignment targets, mirroring the binding forms described in the reference manual now that result expressions are captured across `for`/`while`/`repeat` nodes.【F:PineScriptContext/pine-script-refrence.txt†L16779-L17246】【F:core/ast/parser/rules/control-flow.ts†L223-L446】
2. **Fill iterable literal coverage**
   - Add array/map literal builders that leverage the Pine structures data so collection literals can be parsed and surfaced to downstream validators, complementing the existing tuple/matrix support.【F:PineScriptContext/structures/types.json†L1-L15】【F:tests/ast/chevrotain-parser.test.ts†L261-L311】
