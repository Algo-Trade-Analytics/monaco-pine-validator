# Next Clusters for Codex Cloud Handoff

This document defines the parity clusters that are ready for Codex Cloud execution.

## Scope

- Focus Codex Cloud on bounded, single-cluster engineering tasks.
- Keep heavy sweep/canary/probe parallelism in GitHub Actions.
- Keep TradingView browser re-export work local-only.

## Cloud-ready Cluster Queue

The cloud-ready tasks are the following cluster items to move first:

- **D1** scan remaining fails for more margin-artifact candidates
- **D2** isolate convergence-protocol-joat
- **D3** fix the Δ=-2 engine-miss margin-call cluster
- **D4** diagnose the swap/shift cluster
- **D5** root-cause the buy-sell-signal +74 regression
- **D6** do the reclassification audit

## Environment Contract

These tasks require only:

- `git clone`
- `npm ci`
- Node.js 22

No TradingView browser access is required for D1–D6 because parity fixtures already exist in-repo.

## Execution Model

Best use of Codex Cloud:

1. One Codex Cloud task per cluster (not one giant "improve parity" prompt).
2. Codex Cloud does bounded engineering:
   - inspect logs
   - patch code
   - run relevant subset
   - open PR
3. GitHub Actions remains the heavy parallel execution layer for sweeps/canary/probes.

## Recommended Order

1. **D1** lowest risk; can flip fixtures cheaply.
2. **D6** improves denominator without broker guesswork.
3. **D2** narrow single-fixture hypothesis.
4. **D5** analysis-heavy and low-risk.
5. **D3** strong upside with higher regression risk.
6. **D4** diagnostic-first and likely broader blast radius.

## Current Wave: Smoke Test

Start with **D1** as the first smoke test.

See: `docs/CODEX-CLOUD-SMOKE-D1.md` for an exact ready-to-paste cloud task.

## How to Move Forward (Engine Improvements)

Use the following loop for each cluster:

1. Pick exactly one cluster task (start with D1).
2. Run a Codex Cloud task in research-only or narrow-patch mode.
3. Produce a result artifact (`docs/CODEX-<cluster>-SMOKE-RESULT.md` or patch PR).
4. Validate with focused tests first, then broad GitHub Actions sweeps.
5. Merge only after sweep/canary results are attached.
6. Advance to the next cluster in priority order.

## Local-only Work (Not for Cloud)

The following work stays local:

- TradingView browser re-export workflows.
- Browser-only fixture refresh flows.

When browser interaction is required, execute locally and then commit updated artifacts for Cloud to consume in later analysis/patch runs.
