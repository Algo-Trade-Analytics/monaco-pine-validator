# Engine Improvements Task Flow

This playbook answers: "How do we move forward on engine improvement tasks?"

## Golden Rules

- One cloud task per cluster.
- Keep first pass low-risk (analysis or narrow patch only).
- Let GitHub Actions do broad verification sweeps.
- Keep browser-dependent TradingView re-export local-only.

## Standard Lifecycle Per Cluster

1. **Frame the hypothesis**
   - Define expected fix behavior in one sentence.
   - Define what evidence will prove/disprove it.
2. **Run bounded cloud task**
   - Inspect logs/probes.
   - Patch only the relevant area (or research-only for first pass).
3. **Produce artifacts**
   - Result doc with fixture IDs + evidence + confidence ranking.
   - Patch PR (if code change is made).
4. **Validate**
   - Run targeted subset locally/in-cloud.
   - Run broad sweep/canary/probe in GitHub Actions.
5. **Decide**
   - Merge if signal is positive and regressions are controlled.
   - Otherwise rollback or narrow the hypothesis and rerun.

## Suggested Order

1. D1
2. D6
3. D2
4. D5
5. D3
6. D4

## Immediate Next Step (Smoke Test)

- Execute D1 using `docs/CODEX-CLOUD-SMOKE-D1.md`.
- Require output at `docs/CODEX-D1-SMOKE-RESULT.md`.
- If high confidence, follow with a minimal fixture-list patch PR.
