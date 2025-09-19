import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import type { ValidationResult, ValidationError } from '../../core/types';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

const DEFAULT_SOURCE = `//@version=6
indicator("Validator Playground", overlay = true)

length = input.int(20, minval = 1, tooltip = "Period length")
ma = ta.sma(close, length)
plot(ma, color = color.new(color.blue, 0))

if ta.crossover(close, ma)
    strategy.entry("Long", strategy.long)
`; // Template script used on load

type MarkerFactory = (result: ValidationResult) => MonacoEditor.IMarkerData[];

function createMarkers(monaco: typeof import('monaco-editor'), model: MonacoEditor.ITextModel): MarkerFactory {
  const clampPosition = (value: number, fallback: number) => {
    if (!Number.isFinite(value) || value < 1) return fallback;
    return Math.floor(value);
  };

  const toMarker = (issue: ValidationError, severity: MonacoEditor.MarkerSeverity): MonacoEditor.IMarkerData => {
    const line = clampPosition(issue.line ?? 1, 1);
    const column = clampPosition(issue.column ?? 1, 1);

    return {
      severity,
      message: issue.message,
      startLineNumber: line,
      startColumn: column,
      endLineNumber: line,
      endColumn: column + 1,
      source: issue.code ?? 'pine-validator'
    };
  };

  return (result) => {
    const markers: MonacoEditor.IMarkerData[] = [];
    result.errors.forEach((error) => markers.push(toMarker(error, monaco.MarkerSeverity.Error)));
    result.warnings.forEach((warning) => markers.push(toMarker(warning, monaco.MarkerSeverity.Warning)));
    (result.info ?? []).forEach((info) => markers.push(toMarker(info, monaco.MarkerSeverity.Info)));

    return markers;
  };
}

function registerPineLanguage(monaco: typeof import('monaco-editor')) {
  const id = 'pinescript';
  if (monaco.languages.getLanguages().some((lang) => lang.id === id)) {
    return;
  }

  monaco.languages.register({ id });
  monaco.languages.setLanguageConfiguration(id, {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/']
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')']
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  });

  monaco.languages.setMonarchTokensProvider(id, {
    keywords: [
      'indicator', 'strategy', 'library', 'var', 'varip', 'if', 'else', 'for', 'while', 'switch',
      'case', 'default', 'break', 'continue', 'return', 'true', 'false', 'na', 'input'
    ],
    typeKeywords: ['int', 'float', 'bool', 'string', 'color', 'series'],
    operators: ['=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=', '&&', '||', '++', '--', '+', '-', '*', '/', '%'],
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    tokenizer: {
      root: [
        [/[a-zA-Z_][\w\.]*\b/, {
          cases: {
            '@keywords': 'keyword',
            '@typeKeywords': 'type.identifier',
            '@default': 'identifier'
          }
        }],
        { include: '@whitespace' },
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/\d+/, 'number'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/\'([^'\\]|\\.)*\'/, 'string'],
        [/@symbols/, 'delimiter']
      ],
      whitespace: [[/[ \t\r\n]+/, 'white'], [/\/\*/, 'comment', '@comment'], [/\/\//, 'comment', '@lineComment']],
      comment: [[/[^/*]+/, 'comment'], [/\*\//, 'comment', '@pop'], [/./, 'comment']],
      lineComment: [[/[^\n]+/, 'comment']]
    }
  });
}

const SAMPLE_SNIPPETS: Record<string, string> = {
  'Moving Average': DEFAULT_SOURCE,
  'Broken Script': `//@version=6
indicator("Broken Script", overlay = true)

len = input.int(-5)
plot(ta.sma(close, len))
`,
  'Request Example': `//@version=6
indicator("Request Example")

series = request.security(syminfo.tickerid, "60", close)
plot(series)
`
};

const snippetEntries = Object.entries(SAMPLE_SNIPPETS);
const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.mjs';
const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/';

type ViewMode = 'validator' | 'ast';

export default function App() {
  const validatorRef = useRef<EnhancedModularValidator>();
  if (!validatorRef.current) {
    validatorRef.current = new EnhancedModularValidator({
      strictMode: true,
      allowDeprecated: true,
      targetVersion: 6,
      enableTypeChecking: true,
      enableControlFlowAnalysis: true,
      enablePerformanceAnalysis: true
    });
  }

  const [code, setCode] = useState(DEFAULT_SOURCE);
  const [result, setResult] = useState<ValidationResult>(() => validatorRef.current!.validate(DEFAULT_SOURCE));
  const [theme, setTheme] = useState<'vs-dark' | 'vs-light'>('vs-light');

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const markerFactoryRef = useRef<MarkerFactory | null>(null);

  const applyMarkers = useCallback((validation: ValidationResult) => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;

    const model = editor.getModel();
    if (!model) return;

    if (!markerFactoryRef.current) {
      markerFactoryRef.current = createMarkers(monaco, model);
    }

    const markers = markerFactoryRef.current(validation);
    monaco.editor.setModelMarkers(model, 'pine-validator', markers);
  }, []);

  const runValidation = useCallback((source: string) => {
    const output = validatorRef.current!.validate(source);
    setResult(output);
    applyMarkers(output);
  }, [applyMarkers]);

  useEffect(() => {
    runValidation(code);
  }, [code, runValidation]);

  const handleEditorWillMount = useCallback((monaco: typeof import('monaco-editor')) => {
    registerPineLanguage(monaco);
  }, []);

  const handleEditorMount = useCallback((editor: MonacoEditor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    markerFactoryRef.current = createMarkers(monaco, editor.getModel()!);
    applyMarkers(result);
  }, [applyMarkers, result]);

  const onEditorChange = useCallback((value?: string) => {
    setCode(value ?? '');
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'vs-dark' ? 'vs-light' : 'vs-dark'));
  }, []);

  const handleSnippetPick = useCallback((snippet: string) => {
    setCode(snippet);
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>('validator');
  const runtimePromiseRef = useRef<Promise<any> | null>(null);
  const pyodideInstanceRef = useRef<any>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [runtimeMessage, setRuntimeMessage] = useState('');
  const [astOutput, setAstOutput] = useState('');
  const [astError, setAstError] = useState<string | null>(null);
  const [astRunning, setAstRunning] = useState(false);

  const validationStatus = useMemo(() => {
    if (!result) return { label: 'Idle', tone: 'warning' as const };
    if (result.errors.length > 0) return { label: `${result.errors.length} error(s)`, tone: 'invalid' as const };
    if (result.warnings.length > 0) return { label: `${result.warnings.length} warning(s)`, tone: 'warning' as const };
    return { label: 'No issues detected', tone: 'valid' as const };
  }, [result]);

  const runtimeBadge = useMemo(() => {
    if (runtimeStatus === 'ready') return { label: 'Runtime ready', tone: 'valid' as const };
    if (runtimeStatus === 'loading') return { label: 'Preparing runtime…', tone: 'warning' as const };
    if (runtimeStatus === 'error') return { label: 'Runtime error', tone: 'invalid' as const };
    return { label: 'Runtime idle', tone: 'warning' as const };
  }, [runtimeStatus]);

  const ensurePyodide = useCallback(async () => {
    if (pyodideInstanceRef.current) {
      return pyodideInstanceRef.current;
    }

    if (!runtimePromiseRef.current) {
      setRuntimeStatus('loading');
      setRuntimeMessage('Downloading Python runtime…');
      runtimePromiseRef.current = (async () => {
        try {
          const module = await import(/* @vite-ignore */ PYODIDE_URL);
          const pyodide = await module.loadPyodide({ indexURL: PYODIDE_INDEX_URL });
          setRuntimeMessage('Installing pynescript…');
          await pyodide.loadPackage('micropip');
          await pyodide.runPythonAsync(`
import micropip
await micropip.install('pynescript==0.2.0')
`);
          pyodideInstanceRef.current = pyodide;
          setRuntimeStatus('ready');
          setRuntimeMessage('');
          return pyodide;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setRuntimeStatus('error');
          setRuntimeMessage(message);
          runtimePromiseRef.current = null;
          throw error;
        }
      })();
    }

    const instance = await runtimePromiseRef.current;
    pyodideInstanceRef.current = instance;
    return instance;
  }, []);

  const handleRunAst = useCallback(async () => {
    setAstRunning(true);
    setAstError(null);
    try {
      const pyodide = await ensurePyodide();
      pyodide.globals.set('pine_source', code);
      const output = await pyodide.runPythonAsync(`
from pynescript.ast import parse
from pynescript.ast.helper import dump
tree = parse(pine_source)
dump(tree, indent=2, include_attributes=True)
`);
      setAstOutput(String(output));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAstError(message);
    } finally {
      try {
        const pyodide = pyodideInstanceRef.current;
        pyodide?.globals?.delete('pine_source');
      } catch {
        // Ignore cleanup errors
      }
      setAstRunning(false);
    }
  }, [code, ensurePyodide]);

  useEffect(() => {
    if (viewMode === 'ast' && runtimeStatus === 'idle') {
      ensurePyodide().catch(() => undefined);
    }
  }, [ensurePyodide, runtimeStatus, viewMode]);

  return (
    <div className="playground-shell">
      <header className="top-bar">
        <h1 className="app-title">Pine Validator Playground</h1>
        <div className="view-tabs">
          <button
            type="button"
            className={`tab-button ${viewMode === 'validator' ? 'active' : ''}`}
            onClick={() => setViewMode('validator')}
          >
            Validator
          </button>
          <button
            type="button"
            className={`tab-button ${viewMode === 'ast' ? 'active' : ''}`}
            onClick={() => setViewMode('ast')}
          >
            AST Explorer
          </button>
        </div>
      </header>

      {viewMode === 'validator' ? (
        <div className="app-shell">
          <div className="editor-wrapper">
            <div className="controls">
              <span className={`status-badge ${validationStatus.tone}`}>{validationStatus.label}</span>
              <button onClick={toggleTheme} className="secondary">Switch Theme</button>
              {snippetEntries.map(([label, snippet]) => (
                <button key={label} className="secondary" onClick={() => handleSnippetPick(snippet)}>
                  {label}
                </button>
              ))}
            </div>
            <Editor
              height="calc(100% - 48px)"
              defaultLanguage="pinescript"
              value={code}
              onChange={onEditorChange}
              onMount={handleEditorMount}
              beforeMount={handleEditorWillMount}
              theme={theme}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                automaticLayout: true,
                scrollBeyondLastLine: false
              }}
            />
          </div>
          <aside className="panel">
            <header>Validation Output</header>
            <div className="panel-content">
              <section>
                <strong>Summary</strong>
                <div>
                  Errors: {result.errors.length} · Warnings: {result.warnings.length} · Info: {result.info?.length ?? 0}
                </div>
              </section>

              {result.errors.length > 0 && (
                <section>
                  <h4>Errors</h4>
                  <ul className="validation-list">
                    {result.errors.map((error, idx) => (
                      <li className="validation-item error" key={`error-${idx}`}>
                        <div>
                          <strong>{error.code ?? 'error'}</strong> — line {error.line}, column {error.column}
                        </div>
                        <pre>{error.message}</pre>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {result.warnings.length > 0 && (
                <section>
                  <h4>Warnings</h4>
                  <ul className="validation-list">
                    {result.warnings.map((warning, idx) => (
                      <li className="validation-item warning" key={`warning-${idx}`}>
                        <div>
                          <strong>{warning.code ?? 'warning'}</strong> — line {warning.line}, column {warning.column}
                        </div>
                        <pre>{warning.message}</pre>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {result.errors.length === 0 && result.warnings.length === 0 && (
                <p>No validation issues detected. Modify the script to explore validator feedback in real time.</p>
              )}
            </div>
          </aside>
        </div>
      ) : (
        <div className="app-shell">
          <div className="editor-wrapper">
            <div className="controls">
              <span className={`status-badge ${runtimeBadge.tone}`}>{runtimeBadge.label}</span>
              <button onClick={toggleTheme} className="secondary">Switch Theme</button>
              {snippetEntries.map(([label, snippet]) => (
                <button key={label} className="secondary" onClick={() => handleSnippetPick(snippet)}>
                  {label}
                </button>
              ))}
            </div>
            <Editor
              height="calc(100% - 48px)"
              defaultLanguage="pinescript"
              value={code}
              onChange={onEditorChange}
              onMount={handleEditorMount}
              beforeMount={handleEditorWillMount}
              theme={theme}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                automaticLayout: true,
                scrollBeyondLastLine: false
              }}
            />
          </div>
          <aside className="panel">
            <header>AST Output</header>
            <div className="panel-content">
              <section>
                <p>Run the official <code>pynescript</code> parser directly in the browser to inspect the generated AST.</p>
                <div className="ast-actions">
                  <button onClick={handleRunAst} disabled={astRunning || runtimeStatus === 'loading'}>
                    {astRunning ? 'Parsing…' : 'Generate AST'}
                  </button>
                  {runtimeMessage && <span className="status-text">{runtimeMessage}</span>}
                </div>
                {astError && (
                  <div className="validation-item error">
                    <strong>Parser Error</strong>
                    <pre>{astError}</pre>
                  </div>
                )}
                {astOutput && !astError && (
                  <pre className="ast-output monospace">{astOutput}</pre>
                )}
                {!astOutput && !astError && runtimeStatus === 'ready' && !astRunning && (
                  <p className="status-text">Click "Generate AST" to parse the current script.</p>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
