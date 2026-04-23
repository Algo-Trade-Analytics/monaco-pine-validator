# CODEX CLOUD SMOKE TEST — D1

## Why D1 first

D1 is the safest first cloud handoff:

- no TradingView browser dependency
- no broker patch required in the first run
- useful output even if run is analysis-only

## Objective

Scan remaining failing fixtures for additional **margin-artifact** candidates and produce a ranked report.

## Operating Mode

- mode: **research-only**
- no broker patch in first run
- no TradingView/browser work

## Expected Output

Write findings to:

- `docs/CODEX-D1-SMOKE-RESULT.md`

Report should include:

1. candidate fixture IDs
2. evidence from log/probe output
3. confidence ranking (high/medium/low)
4. recommended next patch target(s)

## Exact Task To Hand To Codex Cloud

Use this prompt verbatim:

```text
objective: D1 margin-artifact scan
mode: research only
repo setup:
  - git clone <repo>
  - npm ci
  - node 22
constraints:
  - no broker patch
  - no TradingView/browser work
steps:
  1) identify latest failing fixtures relevant to margin-call / margin-artifact behavior
  2) run existing probe tooling (including probe-key-diff if present) against those fixtures
  3) collect signals that indicate margin-artifact candidacy
  4) rank candidates by confidence and expected payoff
output:
  - create docs/CODEX-D1-SMOKE-RESULT.md
  - include fixture IDs, evidence snippets, ranking, and recommended next patch candidate
completion:
  - open a PR with the result doc only
```

## Post-smoke Follow-up

If smoke output is clean and high confidence, next change should be a narrow fixture-list update (for example the margin artifact split fixture ID list) in a separate patch PR.
