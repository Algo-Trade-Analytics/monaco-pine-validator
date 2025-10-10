# Parser Crash Isolation Tool

Use `scripts/isolate-parser-collapse.ts` to automatically reduce long Pine scripts that crash or destabilize the Chevrotain parser. The script repeatedly runs the validator to locate the smallest slice of the script that still reproduces the crash.

## Running the tool

```bash
node --loader ts-node/esm --experimental-specifier-resolution=node scripts/isolate-parser-collapse.ts path/to/script.pine
```

Key flags:

- `--strategy <prefix|ddmin|both>` controls whether to run the fast prefix bisection, delta debugging, or both (default).
- `--require-ast` treats a missing AST as the crash signal.
- `--syntax-diags <n>` marks a crash when the AST service reports at least `n` syntax diagnostics (handy for parser collapses that do not raise exceptions).
- `--no-syntax-warning`, `--no-module-error`, `--no-exception` let you narrow which signals count as a crash.
- `--context <n>` adjusts the number of context lines printed around the suspected failure boundary (default 5).
- `--max-ddmin <n>` caps delta-debug iterations to keep runtimes predictable.
- `--report <path>` writes a structured JSON report with the baseline, prefix, and ddmin findings.
- `--verbose` prints every validator invocation with its crash signature.

## Crash signals

By default the tool treats the following as a crash:

- The validator throws.
- The validator emits a `PSV6-SYNTAX-ERROR` warning (Chevrotain exception).
- The validator reports a `MODULE-ERROR`.

Combine `--require-ast` or `--syntax-diags` when the parser quietly returns no AST but does not throw.

## Typical workflow

1. Run a baseline to confirm a crash is detected. If the summary ends with “No crash detected” tweak the predicate with the flags above.
2. Inspect the “Failing prefix” section to see the first line that flips the predicate from pass to fail.
3. Use delta debugging’s minimized snippet to craft a regression test or reproduction harness.

## Example

```bash
node --loader ts-node/esm --experimental-specifier-resolution=node \
  scripts/isolate-parser-collapse.ts --syntax-diags 1 --strategy both tmp/bad-syntax.pine
```

Produces:

```
Analysing ".../tmp/bad-syntax.pine" (4 lines)
Crash signature: thrown=no | hasAst=yes | syntaxWarnings=0 | moduleErrors=0 | syntaxDiagnostics=1 | errors=3 | warnings=0 | duration=15.2ms

Failing prefix discovered after 2 probes.
  • First failing line: 3
  • Last passing line: 2
  • Prefix evaluation: thrown=no | hasAst=yes | syntaxWarnings=0 | moduleErrors=0 | syntaxDiagnostics=1 | errors=2 | warnings=0 | duration=10.0ms

Delta debugging reduced the script to 1 line(s) after 2 probe(s).
Reduced evaluation: thrown=no | hasAst=yes | syntaxWarnings=0 | moduleErrors=0 | syntaxDiagnostics=1 | errors=1 | warnings=0 | duration=1.8ms

Minimal crash-inducing snippet:
  4 | p)
```

If the predicate also triggers on the empty script the CLI will abort early—loosen the flags and rerun.

## JSON report

Pass `--report tmp/ensemble-report.json` to capture run metadata for downstream tooling. The file includes:

- The CLI predicate configuration and baseline evaluation.
- Optional prefix analysis with context lines.
- Optional delta-debug output containing the minimized snippet lines and evaluation summary.

Example snippet:

```json
{
  "scriptPath": ".../ensemble-alerts.pine",
  "totalLines": 383,
  "crashDetected": true,
  "baseline": {
    "hasAst": true,
    "syntaxDiagnostics": 4,
    "snippetLength": 11342
  },
  "prefix": {
    "suspectLine": 16,
    "contextWindow": [
      { "line": 12, "text": "", "isTarget": false },
      { "line": 16, "text": "import TradingView/ta/9    as TVta", "isTarget": true }
    ]
  },
  "ddmin": {
    "lineCount": 1,
    "lines": [
      { "line": 16, "text": "import TradingView/ta/9    as TVta" }
    ]
  }
}
```
