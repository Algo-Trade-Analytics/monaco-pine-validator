# Chevrotain Parser Coverage Audit

## Data sources
- `PineScriptContext/structures/index.ts` exposes auto-generated Pine Script v6 structures (keywords, operators, annotations, etc.) that mirror the language reference used by the validator tooling.【F:PineScriptContext/structures/index.ts†L1-L68】
- The keyword structures explicitly capture both range-style and collection-style `for` loops, along with other reserved words the grammar must eventually recognise.【F:PineScriptContext/structures/keywords.ts†L6-L166】

## Confirmed alignment
- The Chevrotain grammar currently handles range-based `for` loops, `if`/`else`, `switch`, `repeat`/`until`, and `while` statements in line with the keyword definitions, ensuring control-flow coverage for the constructs already wired into the validator.【F:core/ast/parser/parser.ts†L1967-L2098】
- Script, enum, type, import, and function declarations are parsed with dedicated rules that reuse the same tokens surfaced in the Pine Script structures, keeping declaration syntax in sync with the reference metadata.【F:core/ast/parser/parser.ts†L1680-L1879】【F:core/ast/parser/parser.ts†L1740-L1879】
- The lexer token set already includes the operator and logical keyword surface (e.g., `and`, `or`, `not`, compound assignments, ternary separators) enumerated in the Pine Script structures, so expression precedence aligns with the documented operator list.【F:core/ast/parser/tokens.ts†L1-L240】【F:PineScriptContext/structures/operators.json†L1-L18】

## Identified gaps
- The Pine Script structures document a collection iteration form (`for … in`) that is not yet tokenised (`In` keyword) or parsed in the Chevrotain grammar, leaving array/map loop coverage incomplete.【F:PineScriptContext/structures/keywords.ts†L24-L56】【F:core/ast/parser/parser.ts†L1998-L2056】
- Inline `=>` function expressions still lack a dedicated expression rule even though the structures highlight `method`/arrow syntax; today the grammar only consumes `=>` inside function declarations or switch cases.【F:PineScriptContext/structures/keywords.ts†L87-L92】【F:core/ast/parser/parser.ts†L1420-L1470】【F:core/ast/parser/parser.ts†L1696-L1737】
- Literal collection forms described in the structures (e.g., arrays and maps) have not yet been implemented as expression nodes; tuple and matrix literals exist, but general array/map literals remain outstanding for full iterable support.【F:PineScriptContext/structures/types.json†L1-L15】【F:tests/ast/chevrotain-parser.test.ts†L261-L311】

## Recommended next steps
1. **Add collection iteration support**
   - Introduce an `In` token and extend `forStatement` with a `for … in` branch that builds the appropriate AST nodes before covering destructuring targets, mirroring the reference syntax for arrays and tuples.【F:PineScriptContext/structures/keywords.ts†L24-L56】
2. **Implement arrow function expressions**
   - Extend the expression grammar with an inline `=>` production that reuses the existing parameter parsing helpers, unlocking the `method`/lambda scenarios called out in the reference manual.【F:PineScriptContext/structures/keywords.ts†L87-L92】【F:core/ast/parser/parser.ts†L1420-L1470】
3. **Fill iterable literal coverage**
   - Add array/map literal builders that leverage the Pine structures data so collection literals can be parsed and surfaced to downstream validators, complementing the existing tuple/matrix support.【F:PineScriptContext/structures/types.json†L1-L15】【F:tests/ast/chevrotain-parser.test.ts†L261-L311】
