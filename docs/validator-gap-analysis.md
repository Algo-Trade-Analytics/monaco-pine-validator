# Pine Script v6 Validator – Gap Analysis

## Executive Summary

The current validator delivers strong baseline coverage for syntax and structural rules but still falls short on the AST-driven feature set.  With Chevrotain parsing enabled by default, the remaining gaps stem from incomplete rule implementations rather than configuration mismatches.

## Methodology

1. Ran `npm run test:validator` to collect an end-to-end status snapshot (13 passing / 0 failing smoke assertions while the 1,021-spec regression set remains deferred).
2. Reviewed the archived suites to identify which modules and diagnostics still need implementation work before they can return to the default run.
3. Inspected `BaseValidator` to confirm the AST service remains enabled by default and that modules execute in AST-aware mode.
4. Mapped the findings into the gap themes below.

## Gap Themes

### 1. Incomplete AST Rule Coverage
- **Impact**: Modules that depend on AST nodes (time/date, alerts, drawing/textbox, risk analysis, typography, etc.) still lack rule coverage, preventing their suites from being re-enabled.
- **Root Cause**: Rule logic has not yet been implemented (or updated) to cover the scenarios encoded in the Vitest fixtures.
- **Remediation**: Expand rule coverage module-by-module, verifying emitted diagnostics against the focused specs before restoring each suite to the main run.

### 2. Missing Feedback Loop Between Docs and Tests
- **Impact**: Documentation previously promised 100% coverage and zero gaps, contradicting the test suite reality.
- **Root Cause**: Documentation snapshots were not updated after introducing AST-only modules and specs.
- **Remediation**: Tie documentation updates to automated test runs and publish the pass/fail breakdown alongside each release.

### 3. Lack of Dependency Classification for Modules
- **Impact**: It is difficult to determine which modules require AST data, which work line-by-line, and which can operate in both modes.
- **Root Cause**: Module metadata does not capture dependency requirements, making it easy to instantiate the validator in an unsupported configuration.
- **Remediation**: Add metadata or documentation that flags each module as `AST`, `line-based`, or `hybrid`, and update the module registration order accordingly.

## Immediate Actions

1. Keep CI and local workflows running with AST enabled so the smoke suite exercises real rule logic.
2. Gradually re-enable archived specs after confirming whether gaps stem from missing diagnostics, incorrect severities, or edge cases not yet implemented.
3. Add status badges or generated reports (e.g., JSON summaries) to track which suites remain deferred and prevent future drift between documentation and reality.
