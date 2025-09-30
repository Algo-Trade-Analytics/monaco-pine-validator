# AST Migration Map

## Overview
We are moving the validator stack to rely exclusively on the Chevrotain-generated AST. The remaining work is grouped into four tasks, each focusing on a cluster of legacy text-scanning heuristics.

## Tasks

1. **CoreValidator (In Progress)**  
   Replace the remaining `cleanLines`/regex passes—indentation, tuple destructuring, parameter usage, reassignment checks—with AST traversal logic so every PS0xx/PSV6 warning originates from structured nodes.

2. **TypeInferenceValidator**  
   Move type-compatibility/ambiguity detection off line heuristics and into AST visitors, aligning parameter inference, conditional diagnostics, and safety checks with the new pipeline.

3. **TA / Style / Performance Validators**  
   Port modules such as `ta-functions-validator`, `style-validator`, and `performance-validator` away from text fallbacks (loop detection, nested TA call scans, etc.) and onto AST data.

4. **Residual Helpers**  
   Sweep the rest of the validator catalog (inputs, linefill, etc.) for any lingering text helpers, removing or re-implementing them with AST structures.

## Execution Plan
- Work through the tasks sequentially, validating with `yarn test:ast` (and targeted suites) after each major change.
- Adjust compatibility fixtures where necessary once diagnostics originate solely from AST visitors.
- Update this map as tasks complete.

