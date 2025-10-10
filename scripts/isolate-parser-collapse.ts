import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { EnhancedModularValidator } from '../EnhancedModularValidator';

type Strategy = 'prefix' | 'ddmin' | 'both';

interface CliOptions {
  scriptPath: string;
  strategy: Strategy;
  requireAst: boolean;
  treatSyntaxWarningAsCrash: boolean;
  treatModuleErrorAsCrash: boolean;
  treatExceptionAsCrash: boolean;
  syntaxDiagnosticsThreshold: number | null;
  contextLines: number;
  verbose: boolean;
  maxDdminIterations: number;
  reportPath: string | null;
}

interface LineInfo {
  text: string;
  number: number;
}

interface LiteValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
  suggestion?: string;
  relatedLines?: number[];
}

interface CrashEvaluation {
  snippet: string;
  thrown: boolean;
  throwMessage?: string;
  throwStack?: string;
  hasAst: boolean;
  syntaxDiagnostics: number;
  syntaxWarningCount: number;
  moduleErrorCount: number;
  errors: LiteValidationError[];
  warnings: LiteValidationError[];
  durationMs: number;
}

interface PrefixResult {
  failingIndex: number;
  passingLength: number;
  iterations: number;
  evaluation: CrashEvaluation;
}

interface DdminResult {
  lines: LineInfo[];
  iterations: number;
  evaluation: CrashEvaluation;
  exhausted: boolean;
}

interface ContextLine {
  line: number;
  text: string;
  isTarget: boolean;
}

interface ReportEvaluation extends Omit<CrashEvaluation, 'snippet'> {
  snippetLength: number;
  snippet?: string;
}

interface ReportPrefixResult {
  suspectLine: number | null;
  lastPassingLine: number | null;
  iterations: number;
  evaluation: ReportEvaluation;
  contextWindow: ContextLine[];
}

interface ReportDdminResult {
  lineCount: number;
  iterations: number;
  exhausted: boolean;
  evaluation: ReportEvaluation;
  lines: Array<{ line: number; text: string }>;
}

interface IsolationReport {
  scriptPath: string;
  totalLines: number;
  options: Omit<CliOptions, 'scriptPath' | 'reportPath'>;
  crashDetected: boolean;
  abortedReason?: string;
  baseline: ReportEvaluation;
  emptyEvaluation?: ReportEvaluation;
  prefix?: ReportPrefixResult;
  ddmin?: ReportDdminResult;
}

interface CrashPredicateOptions {
  requireAst: boolean;
  treatSyntaxWarningAsCrash: boolean;
  treatModuleErrorAsCrash: boolean;
  treatExceptionAsCrash: boolean;
  syntaxDiagnosticsThreshold: number | null;
}

type CrashPredicate = (evaluation: CrashEvaluation) => boolean;

const HELP_TEXT = `
Usage: node --loader ts-node/esm --experimental-specifier-resolution=node scripts/isolate-parser-collapse.ts <script> [options]

Options:
  -s, --strategy <prefix|ddmin|both>   Reduction strategy to run (default: both)
      --require-ast                   Treat missing AST as a crash condition
      --no-syntax-warning             Do not treat PSV6-SYNTAX-ERROR warnings as crash
      --no-module-error               Do not treat MODULE-ERROR codes as crash
      --no-exception                  Do not treat thrown exceptions as crash
      --syntax-diags <n>              Treat >= n AST syntax diagnostics as crash
      --context <n>                   Lines of context to show around findings (default: 5)
      --max-ddmin <n>                 Maximum ddmin iterations before stopping (default: 250)
      --report <path>                 Write a JSON report to the given file
      --verbose                       Log every validator evaluation
  -h, --help                          Show this help message
`;

const SYNTAX_ERROR_CODE = 'PSV6-SYNTAX-ERROR';
const MODULE_ERROR_CODE = 'MODULE-ERROR';

function parseArgs(argv: string[]): CliOptions | null {
  const options: CliOptions = {
    scriptPath: '',
    strategy: 'both',
    requireAst: false,
    treatSyntaxWarningAsCrash: true,
    treatModuleErrorAsCrash: true,
    treatExceptionAsCrash: true,
    syntaxDiagnosticsThreshold: null,
    contextLines: 5,
    verbose: false,
    maxDdminIterations: 250,
    reportPath: null,
  };

  const args = [...argv];
  let helpRequested = false;
  while (args.length > 0) {
    const arg = args.shift()!;
    if (arg === '--') {
      if (args.length === 0) {
        break;
      }
      if (!options.scriptPath) {
        options.scriptPath = args.shift()!;
      }
      break;
    }
    if (arg === '-h' || arg === '--help') {
      helpRequested = true;
      break;
    } else if (arg === '-s' || arg === '--strategy') {
      const next = args.shift();
      if (!next) {
        throw new Error('Missing value for --strategy');
      }
      if (next !== 'prefix' && next !== 'ddmin' && next !== 'both') {
        throw new Error(`Unsupported strategy "${next}"`);
      }
      options.strategy = next;
    } else if (arg === '--require-ast') {
      options.requireAst = true;
    } else if (arg === '--no-syntax-warning') {
      options.treatSyntaxWarningAsCrash = false;
    } else if (arg === '--no-module-error') {
      options.treatModuleErrorAsCrash = false;
    } else if (arg === '--no-exception') {
      options.treatExceptionAsCrash = false;
    } else if (arg === '--syntax-diags') {
      const next = args.shift();
      if (!next) {
        throw new Error('Missing value for --syntax-diags');
      }
      const value = Number.parseInt(next, 10);
      if (Number.isNaN(value) || value < 0) {
        throw new Error(`Invalid value for --syntax-diags: "${next}"`);
      }
      options.syntaxDiagnosticsThreshold = value;
    } else if (arg === '--context') {
      const next = args.shift();
      if (!next) {
        throw new Error('Missing value for --context');
      }
      const value = Number.parseInt(next, 10);
      if (Number.isNaN(value) || value < 0) {
        throw new Error(`Invalid value for --context: "${next}"`);
      }
      options.contextLines = value;
    } else if (arg === '--max-ddmin') {
      const next = args.shift();
      if (!next) {
        throw new Error('Missing value for --max-ddmin');
      }
      const value = Number.parseInt(next, 10);
      if (Number.isNaN(value) || value <= 0) {
        throw new Error(`Invalid value for --max-ddmin: "${next}"`);
      }
      options.maxDdminIterations = value;
    } else if (arg === '--report') {
      const next = args.shift();
      if (!next) {
        throw new Error('Missing value for --report');
      }
      options.reportPath = next;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option "${arg}"`);
    } else if (!options.scriptPath) {
      options.scriptPath = arg;
    } else {
      throw new Error(`Unexpected argument "${arg}"`);
    }
  }

  if (helpRequested) {
    console.log(HELP_TEXT.trim());
    return null;
  }

  if (!options.scriptPath) {
    throw new Error('Missing <script> argument');
  }

  return options;
}

function toLineInfo(source: string): LineInfo[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  return lines.map((text, index) => ({ text, number: index + 1 }));
}

function joinLines(lines: LineInfo[]): string {
  return lines.map((line) => line.text).join('\n');
}

function createCrashPredicate(opts: CrashPredicateOptions): CrashPredicate {
  return (evaluation: CrashEvaluation) => {
    if (opts.treatExceptionAsCrash && evaluation.thrown) {
      return true;
    }
    if (opts.treatSyntaxWarningAsCrash && evaluation.syntaxWarningCount > 0) {
      return true;
    }
    if (opts.treatModuleErrorAsCrash && evaluation.moduleErrorCount > 0) {
      return true;
    }
    if (opts.requireAst && !evaluation.hasAst) {
      return true;
    }
    if (
      typeof opts.syntaxDiagnosticsThreshold === 'number' &&
      evaluation.syntaxDiagnostics >= opts.syntaxDiagnosticsThreshold
    ) {
      return true;
    }
    return false;
  };
}

function summarizeEvaluation(evaluation: CrashEvaluation): string {
  const parts = [
    `thrown=${evaluation.thrown ? 'yes' : 'no'}`,
    `hasAst=${evaluation.hasAst ? 'yes' : 'no'}`,
    `syntaxWarnings=${evaluation.syntaxWarningCount}`,
    `moduleErrors=${evaluation.moduleErrorCount}`,
    `syntaxDiagnostics=${evaluation.syntaxDiagnostics}`,
    `errors=${evaluation.errors.length}`,
    `warnings=${evaluation.warnings.length}`,
    `duration=${evaluation.durationMs.toFixed(1)}ms`,
  ];
  if (evaluation.thrown && evaluation.throwMessage) {
    parts.push(`message="${evaluation.throwMessage}"`);
  }
  return parts.join(' | ');
}

function evaluateFactory(verbose: boolean): (lines: LineInfo[]) => CrashEvaluation {
  let counter = 0;
  const cache = new Map<string, CrashEvaluation>();

  return (lines: LineInfo[]) => {
    const snippet = joinLines(lines);
    const cached = cache.get(snippet);
    if (cached) {
      return cached;
    }
    const validator = new EnhancedModularValidator();
    const id = ++counter;
    const start = performance.now();
    let evaluation: CrashEvaluation;
    try {
      const result = validator.validate(snippet);
      const context = (validator as unknown as { context?: { ast?: unknown; astDiagnostics?: { syntaxErrors?: unknown[] } } })
        .context ?? { ast: null, astDiagnostics: { syntaxErrors: [] } };
      const syntaxDiagnostics = Array.isArray(context.astDiagnostics?.syntaxErrors)
        ? context.astDiagnostics.syntaxErrors.length
        : 0;
      const syntaxWarningCount = result.warnings.filter((warning) => warning.code === SYNTAX_ERROR_CODE).length;
      const moduleErrorCount = result.errors.filter((error) => error.code === MODULE_ERROR_CODE).length;
      evaluation = {
        snippet,
        thrown: false,
        hasAst: Boolean(context.ast),
        syntaxDiagnostics,
        syntaxWarningCount,
        moduleErrorCount,
        errors: result.errors,
        warnings: result.warnings,
        durationMs: performance.now() - start,
      };
    } catch (error) {
      const durationMs = performance.now() - start;
      evaluation = {
        snippet,
        thrown: true,
        throwMessage: error instanceof Error ? error.message : String(error),
        throwStack: error instanceof Error ? error.stack : undefined,
        hasAst: false,
        syntaxDiagnostics: 0,
        syntaxWarningCount: 0,
        moduleErrorCount: 0,
        errors: [],
        warnings: [],
        durationMs,
      };
    }
    cache.set(snippet, evaluation);
    if (verbose) {
      console.log(`[eval ${id}] lines=${lines.length} ${summarizeEvaluation(evaluation)}`);
      if (evaluation.thrown && evaluation.throwStack) {
        console.log(evaluation.throwStack);
      }
    }
    return evaluation;
  };
}

function findFailingPrefix(
  allLines: LineInfo[],
  predicate: CrashPredicate,
  evaluate: (lines: LineInfo[]) => CrashEvaluation,
): PrefixResult {
  let low = 0;
  let high = allLines.length;
  let iterations = 0;
  let lastFailEval = evaluate(allLines);

  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    const subset = allLines.slice(0, mid);
    const evaluation = evaluate(subset);
    iterations += 1;
    if (predicate(evaluation)) {
      high = mid;
      lastFailEval = evaluation;
    } else {
      low = mid;
    }
  }

  const finalSubset = allLines.slice(0, high);
  const finalEvaluation = evaluate(finalSubset);
  if (predicate(finalEvaluation)) {
    lastFailEval = finalEvaluation;
  }

  return {
    failingIndex: high - 1,
    passingLength: low,
    iterations,
    evaluation: lastFailEval,
  };
}

function deltaDebug(
  crashLines: LineInfo[],
  predicate: CrashPredicate,
  evaluate: (lines: LineInfo[]) => CrashEvaluation,
  maxIterations: number,
): DdminResult {
  let current = [...crashLines];
  let n = 2;
  let iterations = 0;
  let exhausted = false;
  let latestEval = evaluate(current);

  while (current.length >= 2) {
    const chunkSize = Math.ceil(current.length / n);
    let reduced = false;

    for (let i = 0; i < n; i += 1) {
      if (iterations >= maxIterations) {
        exhausted = true;
        break;
      }
      const start = i * chunkSize;
      if (start >= current.length) {
        break;
      }
      const end = Math.min((i + 1) * chunkSize, current.length);
      const complement = current.slice(0, start).concat(current.slice(end));
      iterations += 1;
      if (complement.length === 0) {
        continue;
      }
      const evaluation = evaluate(complement);
      if (predicate(evaluation)) {
        current = complement;
        latestEval = evaluation;
        n = Math.max(n - 1, 2);
        reduced = true;
        break;
      }
    }

    if (exhausted) {
      break;
    }

    if (!reduced) {
      if (n >= current.length) {
        break;
      }
      n = Math.min(current.length, n * 2);
    }
  }

  return {
    lines: current,
    iterations,
    evaluation: latestEval,
    exhausted,
  };
}

function pad(num: number, width: number): string {
  return num.toString().padStart(width, ' ');
}

function createContextWindow(lines: LineInfo[], centerIndex: number, contextRadius: number): ContextLine[] {
  if (centerIndex < 0 || centerIndex >= lines.length) {
    return [];
  }
  const start = Math.max(0, centerIndex - contextRadius);
  const end = Math.min(lines.length, centerIndex + contextRadius + 1);
  const window: ContextLine[] = [];
  for (let i = start; i < end; i += 1) {
    window.push({
      line: lines[i].number,
      text: lines[i].text,
      isTarget: i === centerIndex,
    });
  }
  return window;
}

function printContext(lines: LineInfo[], centerIndex: number, contextRadius: number): void {
  const context = createContextWindow(lines, centerIndex, contextRadius);
  if (context.length === 0) {
    console.log('No suspect line identified.');
    return;
  }
  const width = Math.max(3, String(lines.length).length);
  context.forEach((entry) => {
    const prefix = entry.isTarget ? '▶' : ' ';
    console.log(`${prefix} ${pad(entry.line, width)} | ${entry.text}`);
  });
}

function toReportEvaluation(evaluation: CrashEvaluation, includeSnippet: boolean): ReportEvaluation {
  const { snippet, ...rest } = evaluation;
  return {
    ...rest,
    snippetLength: snippet.length,
    snippet: includeSnippet ? snippet : undefined,
  };
}

function writeReportSafely(reportPath: string, report: IsolationReport): void {
  try {
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`Report written to ${reportPath}`);
  } catch (error) {
    console.error(`Failed to write report to ${reportPath}:`, error instanceof Error ? error.message : String(error));
  }
}

function printSnippet(snippetLines: LineInfo[]): void {
  const width = Math.max(3, snippetLines.length ? String(snippetLines[snippetLines.length - 1].number).length : 3);
  snippetLines.forEach((line) => {
    console.log(`${pad(line.number, width)} | ${line.text}`);
  });
}

async function main(): Promise<void> {
  let options: CliOptions;
  try {
    const parsed = parseArgs(process.argv.slice(2));
    if (!parsed) {
      process.exit(0);
      return;
    }
    options = parsed;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('Use --help for usage details.');
    process.exit(1);
    return;
  }

  const targetPath = resolve(process.cwd(), options.scriptPath);
  let source: string;
  try {
    source = readFileSync(targetPath, 'utf8');
  } catch (error) {
    console.error(`Failed to read "${targetPath}":`, error instanceof Error ? error.message : String(error));
    process.exit(1);
    return;
  }

  const lines = toLineInfo(source);
  const evaluate = evaluateFactory(options.verbose);
  const predicate = createCrashPredicate({
    requireAst: options.requireAst,
    treatExceptionAsCrash: options.treatExceptionAsCrash,
    treatModuleErrorAsCrash: options.treatModuleErrorAsCrash,
    treatSyntaxWarningAsCrash: options.treatSyntaxWarningAsCrash,
    syntaxDiagnosticsThreshold: options.syntaxDiagnosticsThreshold,
  });

  const baseline = evaluate(lines);
  const report: IsolationReport = {
    scriptPath: targetPath,
    totalLines: lines.length,
    options: {
      strategy: options.strategy,
      requireAst: options.requireAst,
      treatSyntaxWarningAsCrash: options.treatSyntaxWarningAsCrash,
      treatModuleErrorAsCrash: options.treatModuleErrorAsCrash,
      treatExceptionAsCrash: options.treatExceptionAsCrash,
      syntaxDiagnosticsThreshold: options.syntaxDiagnosticsThreshold,
      contextLines: options.contextLines,
      verbose: options.verbose,
      maxDdminIterations: options.maxDdminIterations,
    },
    crashDetected: false,
    baseline: toReportEvaluation(baseline, false),
  };

  if (!predicate(baseline)) {
    console.log('No crash detected with current predicate.');
    console.log(`Baseline evaluation: ${summarizeEvaluation(baseline)}`);
    if (options.reportPath) {
      writeReportSafely(options.reportPath, report);
    }
    process.exit(0);
    return;
  }

  const emptyEval = evaluate([]);
  report.crashDetected = true;
  report.emptyEvaluation = toReportEvaluation(emptyEval, false);
  if (predicate(emptyEval)) {
    console.error('Crash predicate is satisfied even for an empty script. Adjust options (e.g., remove --require-ast or lower --syntax-diags).');
    report.abortedReason = 'Crash predicate satisfied for empty script';
    if (options.reportPath) {
      writeReportSafely(options.reportPath, report);
    }
    process.exit(2);
    return;
  }

  console.log(`Analysing "${targetPath}" (${lines.length} lines)`);
  console.log(`Crash signature: ${summarizeEvaluation(baseline)}`);
  console.log('');

  if (options.strategy === 'prefix' || options.strategy === 'both') {
    const prefix = findFailingPrefix(lines, predicate, evaluate);
    const suspectLineInfo = prefix.failingIndex >= 0 ? lines[prefix.failingIndex] : null;
    const lastSafeLineInfo = prefix.passingLength > 0 ? lines[prefix.passingLength - 1] : null;
    const contextWindow = suspectLineInfo ? createContextWindow(lines, prefix.failingIndex, options.contextLines) : [];
    report.prefix = {
      suspectLine: suspectLineInfo ? suspectLineInfo.number : null,
      lastPassingLine: lastSafeLineInfo ? lastSafeLineInfo.number : null,
      iterations: prefix.iterations,
      evaluation: toReportEvaluation(prefix.evaluation, false),
      contextWindow,
    };
    console.log(`Failing prefix discovered after ${prefix.iterations} probes.`);
    if (suspectLineInfo) {
      const suspectLabel = `${suspectLineInfo.number}`;
      const lastSafeLabel = lastSafeLineInfo ? `${lastSafeLineInfo.number}` : 'none';
      console.log(`  • First failing line: ${suspectLabel}`);
      console.log(`  • Last passing line: ${lastSafeLabel}`);
      console.log(`  • Prefix evaluation: ${summarizeEvaluation(prefix.evaluation)}`);
      console.log('');
      console.log('Context around the suspected boundary:');
      printContext(lines, prefix.failingIndex, options.contextLines);
      console.log('');
    } else {
      console.log('Unable to isolate a failing prefix.');
    }
  }

  if (options.strategy === 'ddmin' || options.strategy === 'both') {
    const ddmin = deltaDebug(lines, predicate, evaluate, options.maxDdminIterations);
    const exhaustedLabel = ddmin.exhausted ? ' (stopped early: iteration limit)' : '';
    report.ddmin = {
      lineCount: ddmin.lines.length,
      iterations: ddmin.iterations,
      exhausted: ddmin.exhausted,
      evaluation: toReportEvaluation(ddmin.evaluation, true),
      lines: ddmin.lines.map((line) => ({ line: line.number, text: line.text })),
    };
    console.log(`Delta debugging reduced the script to ${ddmin.lines.length} line(s) after ${ddmin.iterations} probe(s)${exhaustedLabel}.`);
    console.log(`Reduced evaluation: ${summarizeEvaluation(ddmin.evaluation)}`);
    console.log('');
    if (ddmin.lines.length > 0 && ddmin.lines.length < lines.length) {
      console.log('Minimal crash-inducing snippet:');
      printSnippet(ddmin.lines);
      console.log('');
    } else {
      console.log('Delta debugging did not reduce the script further.');
      console.log('');
    }
  }

  if (options.reportPath) {
    writeReportSafely(options.reportPath, report);
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error('Unexpected failure:', error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
