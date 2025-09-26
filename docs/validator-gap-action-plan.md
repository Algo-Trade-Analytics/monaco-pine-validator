# Pine Script v6 Validator – Action Plan

## Goal

Bring the Pine Script v6 validator to a reliable state where Monaco consumers and automated tooling receive the diagnostics promised by the test suite.  The highest priority is enabling AST-aware modules and reconciling the documentation with reality.

## Phase 1 – Restore Baseline Functionality

| Task | Description | Owner | Status |
| --- | --- | --- | --- |
| Enable AST in core entry points | Update validator constructors (or expose helpers) so Monaco and tests use `ChevrotainAstService` by default. | Core platform | ✅ Complete |
| Fix failing AST suites | After enabling AST, iterate on modules whose assertions still fail. Focus on time/date, alerts, textbox, ticker, and typography validators. | Validator team | 🚧 In progress |
| Update CI scripts | Ensure `npm run test:validator` (with AST enabled) runs in CI and surfaces pass/fail counts. | DevOps | ⏳ Pending |

## Phase 2 – Improve Observability

1. **Module metadata** – annotate each module with its dependencies (`requiresAst`, `requiresTypes`, etc.) so the orchestrator can warn when instantiated in an unsupported mode.
2. **Coverage reporting** – generate a JSON or markdown summary after every test run that lists pass/fail counts per suite and links to the relevant modules.
3. **Documentation pipeline** – integrate doc updates into release tooling so the README, coverage summary, and gap analysis remain accurate.

## Phase 3 – Feature Enhancements

- **Advanced diagnostics**: once AST execution is stable, re-run specs to identify remaining feature gaps (e.g., request functions, performance hints) and prioritise them.
- **Playground parity**: ensure the Monaco playground uses the same configuration as the test suite to prevent divergent behaviour.
- **Regression fixtures**: expand fixtures for modules that currently have minimal coverage (e.g., typography, ticker modifiers) to catch future regressions.

## Status Tracking

- Current snapshot: 9 passing / 0 failing smoke specs on `npm run test:validator` (1,021-spec regression set deferred).
- Next milestone: reintroduce archived suites incrementally while keeping the default run green.
- Reporting cadence: update this document after each major test suite improvement or configuration change.
