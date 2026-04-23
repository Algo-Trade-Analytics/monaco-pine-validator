# Parity Sweep Status

This file tracks where parity sweep execution should run.

## Policy

- Codex Cloud handles bounded, single-cluster engineering tasks.
- GitHub Actions handles high-parallel sweep/canary/probe execution.

## Execution Lanes

| Lane | Runs where | Purpose | Typical scope |
|---|---|---|---|
| Cluster task | Codex Cloud | Bounded engineering iteration for one hypothesis | 1 cluster (D1, D2, etc.) |
| Sweep / canary / probe matrix | GitHub Actions | Heavy parallel verification across many fixtures and scenarios | all relevant suites |
| Browser re-export | Local only | TradingView/browser-dependent fixture refresh | specific local export workflows |

## Current Recommendation

1. Start with D1 smoke test in Codex Cloud (`docs/CODEX-CLOUD-SMOKE-D1.md`).
2. Land documentation/result PR from smoke run.
3. If confidence is high, follow with a narrow patch PR for the identified fixture list.
4. Run broad parity sweeps in GitHub Actions after each patch PR.

## Exit Criteria for Each Cluster

- Hypothesis is documented.
- Focused subset tests pass for the touched area.
- Broad sweep status is attached from GitHub Actions.
- Regression risk and rollback path are called out in PR notes.
