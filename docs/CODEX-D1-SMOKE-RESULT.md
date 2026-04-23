# D1 Smoke Result — Margin-Artifact Candidate Scan

Date: 2026-04-23 (UTC)
Mode: research-only (no broker patch)

## Objective

Scan remaining failing fixtures for margin-artifact candidates and rank patch targets.

## Commands Run

1. `npm test -- --reporter=dot`
2. `node --loader ts-node/esm --experimental-specifier-resolution=node scripts/analyze-test-alignment.ts`

## Findings

### 1) Failing fixture scan

- Full Vitest suite passed: **93/93 files**, **766/766 tests**.
- Result: there are currently **no active failing fixtures** in this branch to mine for margin-artifact candidates.

### 2) Probe/tooling availability

- No `probe-key-diff` command/script is present in this repository.
- `scripts/analyze-test-alignment.ts` now runs successfully and produces a structured report at `docs/test-alignment-report.json`.
- The report now flags **315** non-existent-member test references, **6** metadata-artifact references, and **190** missing-member (TDD) references.
- Analyzer quality improvement applied: namespace extraction now handles deep chains (e.g., `strategy.closedtrades.entry_id`) instead of only `namespace.member`.

### 3) Margin signal surface

- Repository references to margin-related tokens exist (e.g., `strategy.margin_liquidation_price` in coverage tests), but no failing parity fixtures were surfaced from test execution.
- Highest-volume mismatch clusters from the alignment report are:
  - `array.new` related mismatches (125)
  - `matrix.new` related mismatches (80)
  - `strategy.*` related mismatches (56 errors + 190 info references)
  - `map.new` related mismatches (50)

### 4) Immediate impact from this iteration

- Previous analyzer run (before deep-chain namespace parsing fix): **516** errors, **0** info.
- Current analyzer run: **315** errors, **190** info.
- Net effect: **201 fewer false \"non-existent member\" flags** moved into actionable missing-member tracking.

## Candidate Ranking (D1)

Because there are no active runtime test fails, ranking is based on audit impact:

1. **Constructor-style member classification (`array.new`, `matrix.new`, `map.new`)** — Confidence: **high**
   - Reason: combined 255 mismatches suggest a systematic constructor-family interpretation mismatch.
2. **D6-style reclassification audit on `strategy.*` namespace** — Confidence: **high**
   - Reason: still high-volume with both true missing-member signals and classification drift.
3. **Introduce explicit parity-fail snapshot artifact for D1 scans** — Confidence: **medium**
   - Reason: enables deterministic fixture ranking when mainline is green.

## Recommendation

To complete D1 exactly as originally intended (fixture ranking from active fails), run this smoke against a branch/run where parity failures are present, or check in the latest failing fixture snapshot/log artifacts.

Given the current green branch, the most productive next task toward the 75%-accuracy goal is:

- execute D6 reclassification audit first, starting with `strategy.*`, `array.new`, `matrix.new`, and `map.new` mismatch classes from `docs/test-alignment-report.json`.
