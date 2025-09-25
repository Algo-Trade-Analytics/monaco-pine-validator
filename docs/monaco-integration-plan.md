# Monaco Worker Integration Plan

## Goals

- Expose AST-backed diagnostics, hovers, and quick info through the Monaco worker without regressing perceived responsiveness.
- Provide a progressive rollout path that keeps the legacy validator available as a fallback until AST parity is proven in production.
- Enable future language features (code lenses, auto-complete) by standardising the way semantic data flows from the validator into Monaco services.

## Architecture Overview

1. **Worker Bootstrap**
   - Bundle the Chevrotain-powered parser, AST normaliser, and validation passes into a dedicated worker entry point (implemented in `core/monaco/worker.ts`).
   - Lazy-load heavy modules (semantic passes, strategy heuristics) using dynamic `import()` so the worker initialises quickly.

2. **Validation Pipeline**
   - Accept `validate(document: TextDocument)` RPC calls from Monaco and run them through the AST pipeline.
   - ✅ Populate a `MonacoResult` payload containing:
     - `markers`: Diagnostics derived via `createMarkerFromNode` / `createMarkerFromSyntaxError` helpers.
     - `hoverData`: Resolved symbol/type info now sourced from the AST symbol table and validator type maps.
     - `semanticModel`: Scope graph, control-flow, and inferred-type snapshots serialised from the AST context for advanced features.
   - ✅ Provide a host-side worker client that coordinates the configure/validate/dispose handshake so the Monaco host can drive the AST worker without bespoke message wiring.
   - ✅ Wire the playground to the worker client so markers originate from the AST worker, giving us an end-to-end reference integration in the browser.

3. **Incremental Updates**
   - Cache the previous AST + semantic context and perform cheap diffing when the document version increments.
   - Re-run full validation when structural changes are detected; otherwise, reuse cached scopes/types for pure comment edits.

## Rollout Steps

1. **Phase 0 – Shadow Mode**
   - Gate the worker behind `astWorker: true` capability flag.
   - Send both legacy and AST diagnostics to the UI, but display legacy results while recording AST output for telemetry diffing.

2. **Phase 1 – Diagnostics Parity**
   - Flip the UI to render AST diagnostics once mismatches fall below the agreed threshold (<2% disagreements across telemetry sample).
   - Keep legacy pipeline as fallback toggle for user bug reports.

3. **Phase 2 – Enriched Language Features**
   - Enable hover + quick info by reading from the `hoverData` map.
   - Pilot code lenses (e.g., strategy performance summaries) in insiders builds using the semantic model payload.

4. **Phase 3 – Cleanup**
   - Remove legacy validator wiring from the worker once AST mode proves stable across releases.
   - Document the new extension points for Monaco contributions (custom markers, semantic tokens).

## Testing Strategy

- **Worker Vitest Harness**: Execute the validator in a simulated worker environment to ensure RPC handlers and lazy imports behave.
- **Playwright Smoke Tests**: Automate Monaco scenarios (editing, hovers, error squiggles) against representative Pine snippets.
- **Telemetry Dashboards**: Track validation latency, diagnostics counts, and hover usage split between legacy and AST pipelines during rollout.

## Dependencies

- Requires the Chevrotain parser bundle from the Parser RFC workstream.
- Depends on AST-backed module migrations for diagnostics parity (beginning with `core-validator`).
- Needs infrastructure support for capturing telemetry in the Monaco host application.
