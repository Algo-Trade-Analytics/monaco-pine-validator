# AST Migration Map

## Overview
We are moving the validator stack to rely exclusively on the Chevrotain-generated AST. The remaining work is grouped into four tasks, each focusing on a cluster of legacy text-scanning heuristics.

## Tasks

1. **CoreValidator (Complete)**  
   All diagnostics now originate from AST traversals; the legacy line scanner has been removed and indentation/assignment checks run on structured scopes.

2. **TypeInferenceValidator (Complete)**  
   Type compatibility, ambiguity, and parameter inference use AST visitors exclusively; text heuristics were deleted.

3. **TA / Style / Performance Validators (Complete)**  
   `ta-functions-validator`, `style-validator`, `performance`-oriented modules, and math validator now rely on AST data for loop/performance hints and naming checks.

4. **Residual Helpers (Complete)**  
   Inputs, UDT/enum/function validators, strategy order limits, enhanced textbox handling, and related helpers no longer touch `cleanLines` except for syntax pre-checks.

## Remaining Reliance on Raw Lines

- **SyntaxValidator** – now tokenises the source for its fallback brace matching, but it still pulls the original text from `context` arrays to feed the lexer when no AST exists.
- **ModularUltimateValidator** – the lightweight CLI wrapper performs minimal structure/syntax checks on raw lines before delegating to the module pipeline; this predates the full AST-driven flow.
- **BaseValidator custom rules** – raw-line scans are still available for legacy rules, though they can now be disabled (`enableCustomRuleRawScan`) or replaced with AST visitors.
- **Context glue** – helpers such as `EnhancedModularValidator` and `ensureAstContext` simply normalise any supplied `cleanLines`. They no longer drive diagnostics but remain for compatibility.

## Execution Plan
- All tasks validated with `yarn test:ast`; follow-up suites (e.g. `yarn test:validator`) remain a useful final sanity check.
- The remaining raw-line consumers above are intentional; we will now evaluate whether each can be replaced or gated behind AST-aware logic.
- Introduced shared AST source helpers so validators now slice diagnostics from AST ranges rather than `context.lines`, covering `CoreValidator`, `FunctionValidator`, `MathFunctionsValidator`, `ArrayValidator`, and the remaining drawing/string/time/input/ticker/dynamic modules; the last raw-line fallback (lazy evaluation) has been removed.
