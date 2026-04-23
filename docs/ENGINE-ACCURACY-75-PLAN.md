# Engine Accuracy Plan (Target: 75% on 500-baseline)

## Goal

Reach **75% engine accuracy** measured against the **500 baseline**.

## Current Status Snapshot (2026-04-23)

- D1 smoke scan executed.
- Runtime tests are green in this branch.
- Alignment audit now runs and produced `docs/test-alignment-report.json`.
- Current mismatch inventory from audit:
  - 315 non-existent-member references
  - 6 metadata-artifact references
  - 190 missing-member references (TDD/actionable)
- Improvement this iteration:
  - reduced non-existent-member flags from 516 → 315 by fixing deep-chain namespace parsing in the audit script.

## Execution Strategy

1. **D6 Reclassification Audit (first)**
   - Reclassify/clean the largest mismatch classes and test expectations.
   - Start clusters:
     - `strategy.*`
     - `array.new`
     - `matrix.new`
     - `map.new`
2. **D1 Follow-up with deterministic fail snapshot**
   - Add latest parity-fail snapshot/log artifact so cloud scans can rank candidates even on green mainline.
3. **D2/D5 narrow hypothesis tasks**
   - Isolate convergence-protocol-joat.
   - Root-cause buy-sell-signal +74 regression.
4. **D3/D4 higher-risk clusters**
   - Only after D6/D2/D5 produce stable trend and lower regression risk.

## Tracking

For each task PR, record:

- before/after mismatch counts by cluster
- tests touched and pass/fail status
- estimated contribution to 500-baseline accuracy

## Immediate Next Task

- Begin D6 reclassification on `strategy.*` mismatch cluster using `docs/test-alignment-report.json` as input.
