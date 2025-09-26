# Pine Script Validator AST Migration Roadmap

## 1. Objectives

- Bring the modular validator to parity with the legacy text-scanning pipeline by driving every semantic decision from a shared Abstract Syntax Tree (AST).
- Provide an editor-friendly runtime that can surface accurate ranges, semantic metadata, and rich diagnostics without bespoke fallbacks.
- Make the AST-backed configuration the default so Monaco and local tooling exercise the same behaviour as the automated test suites.

## 2. Current State Assessment

| Area | Current Approach | Pain Points |
| --- | --- | --- |
| Parsing | Chevrotain grammar that recognises top-level declarations, control-flow statements, literals, and common expressions. | Parser coverage is still incomplete (e.g., expression edge cases, recovery paths) and the service is optional. |
| Validation runtime | `BaseValidator` normalises source text and runs modules; AST data is injected automatically unless callers opt out. | AST-enabled smoke runs report 9 passing / 0 failing specs while the 1,021-spec regression set remains deferred pending rule coverage. |
| Module catalogue | Many modules (time/date, alerts, textbox, strategy helpers, etc.) expect AST traversal when data is available. | Without AST these modules return empty diagnostics, masking real coverage gaps and confusing consumers who follow the default setup. |
| Documentation & reporting | Recent docs acknowledge the failing suites but older roadmaps still imply the AST migration is complete. | The lack of authoritative status tracking makes it hard to separate finished work from aspirational plans. |

## 3. Delivered Building Blocks

- A typed AST surface (`core/ast/nodes.ts`) with location metadata and helper constructors that back the Chevrotain parser.
- Traversal helpers (`core/ast/traversal.ts`) and supporting modules (scope, control-flow, type inference) that consume the AST when provided.
- Regression tests under `tests/ast/chevrotain-parser.test.ts` covering core declarations, control-flow statements, and recently added expression forms (e.g., `if` expressions, unary chains).
- AST-aware validation modules (time/date, alert functions, textbox guidance, etc.) that can produce diagnostics once an AST service is configured.

## 4. Outstanding Gaps

1. **Rule coverage gaps** – AST-enabled runs still highlight missing diagnostics across modules such as time/date, alerts, textbox guidance, and ticker helpers.
2. **Test coverage visibility** – the deferred 1,021-spec suite blends partially implemented rules with missing assertions; we need a way to highlight ownership per module before re-enabling each block.
3. **Parser completeness** – expression coverage has improved, but several Pine Script constructs (e.g., request namespaces, ternaries inside pipelines, error recovery for missing delimiters) still require work before the parser can become authoritative.
4. **Documentation drift** – plans and action items should reflect the in-progress migration rather than the "Phase 3 complete" narrative left over from early prototypes.

## 5. Near-Term Action Plan

1. **Maintain the AST-enabled validators** – ensure opt-out paths remain available while keeping the default constructors wired to `ChevrotainAstService`.
2. **Triage deferred suites under AST mode** – run `npm run test:validator` regularly, expand the smoke coverage, and re-enable archived specs once rule gaps versus assertion issues are understood. Update docs with the latest counts.
3. **Expand parser coverage incrementally** – continue tightening expression handling (binary precedence, chained calls, recovery) with targeted fixtures to unblock AST-dependent modules.
4. **Automate reporting** – capture per-module diagnostics in a JSON or Markdown summary so future roadmap updates are grounded in the latest runs.
5. **Refresh documentation regularly** – align the roadmap, gap analysis, and coverage summary with each major parser/runtime milestone to prevent stale claims.

This roadmap should be revisited after the validator runs in AST mode by default; at that point we can prioritise remaining parser work and any modules that still fail despite having structured input.
