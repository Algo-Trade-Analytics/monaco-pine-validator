import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import type { ValidationResult } from '../../core/types';
import type { MarkerData } from '../../core/ast/diagnostics';
import {
  createMonacoWorkerClient,
  type MonacoWorkerClient,
  type WorkerReadyState,
} from '../../core/monaco/client';
import type { WorkerValidationResponse } from '../../core/monaco/worker-harness';
import { registerPineLanguage } from '../../core/monaco/pine-language';

const DEFAULT_SOURCE = `//@version=6
indicator("Validator Playground", overlay = true)

length = input.int(20, minval = 1, tooltip = "Period length")
ma = ta.sma(close, length)
plot(ma, color = color.new(color.blue, 0))

if ta.crossover(close, ma)
    strategy.entry("Long", strategy.long)
`; // Template script used on load

function createEmptyResult(): ValidationResult {
  return {
    isValid: true,
    errors: [],
    warnings: [],
    info: [],
    typeMap: new Map(),
    scriptType: null,
  };
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
  const workerClientRef = useRef<MonacoWorkerClient | null>(null);
  const markerSourceRef = useRef('pine-validator');
  const lastMarkersRef = useRef<readonly MarkerData[]>([]);
  const requestVersionRef = useRef(0);

  const [workerState, setWorkerState] = useState<WorkerReadyState | null>(null);
  const [workerReady, setWorkerReady] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const [code, setCode] = useState(DEFAULT_SOURCE);
  const [result, setResult] = useState<ValidationResult>(() => createEmptyResult());
  const [theme, setTheme] = useState<'vs-dark' | 'vs-light'>('vs-light');

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);

  const applyMarkers = useCallback((markerData: readonly MarkerData[]) => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) {
      return;
    }

    const model = editor.getModel();
    if (!model) {
      return;
    }

    const markers = markerData.map((marker) => ({
      ...marker,
    }));

    monaco.editor.setModelMarkers(model, markerSourceRef.current, markers);
  }, []);

  useEffect(() => {
    setWorkerError(null);
    const worker = new Worker(new URL('./pine-worker.ts', import.meta.url), { type: 'module' });
    const client = createMonacoWorkerClient({
      worker,
      onError: (error) => {
        setWorkerError(error.message);
      },
    });
    workerClientRef.current = client;

    let disposed = false;

    client
      .waitUntilReady()
      .then((state) => {
        if (disposed) {
          return;
        }
        markerSourceRef.current = state.markerSource;
        setWorkerState(state);
        setWorkerReady(true);
        setWorkerError(null);
      })
      .catch((error) => {
        if (disposed) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        setWorkerError(message);
      });

    return () => {
      disposed = true;
      setWorkerReady(false);
      workerClientRef.current = null;
      client.terminate();
    };
  }, []);

  useEffect(() => {
    if (!workerReady) {
      return;
    }

    const client = workerClientRef.current;
    if (!client) {
      return;
    }

    const version = requestVersionRef.current + 1;
    requestVersionRef.current = version;
    setIsValidating(true);
    setWorkerError(null);

    const run = async (): Promise<void> => {
      try {
        console.log('[Validation] Starting validation v' + version + ', code length:', code.length, 'first line:', code.split('\n')[0]);
        const message = await client.validate({ code, version });
        if (requestVersionRef.current !== version) {
          console.log('[Validation] Stale response (v' + version + ' vs current v' + requestVersionRef.current + '), ignoring');
          return;
        }
        const payload: WorkerValidationResponse = message.payload;
        console.log('[Validation] Completed v' + version + ', errors:', payload.result.errors.length, 'warnings:', payload.result.warnings.length);
        lastMarkersRef.current = payload.markers;
        setResult(payload.result);
        applyMarkers(payload.markers);
        setIsValidating(false);
        setWorkerError(null);
      } catch (error) {
        if (requestVersionRef.current !== version) {
          return;
        }
        setIsValidating(false);
        const message = error instanceof Error ? error.message : String(error);
        setWorkerError(message);
      }
    };

    void run();
  }, [code, workerReady, applyMarkers]);

  const handleEditorWillMount = useCallback((monaco: typeof import('monaco-editor')) => {
    registerPineLanguage(monaco);
  }, []);

  const handleEditorMount = useCallback((editor: MonacoEditor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    applyMarkers(lastMarkersRef.current);
  }, [applyMarkers]);

  const onEditorChange = useCallback((value?: string) => {
    const newCode = value ?? '';
    console.log('[Editor] Content changed, length:', newCode.length);
    // Clear results immediately on any change
    setResult(createEmptyResult());
    setCode(newCode);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'vs-dark' ? 'vs-light' : 'vs-dark'));
  }, []);

  const handleSnippetPick = useCallback((snippet: string) => {
    console.log('[Snippet] Picking snippet, length:', snippet.length, 'first line:', snippet.split('\n')[0]);
    
    // Clear validation results immediately FIRST
    setResult(createEmptyResult());
    
    // Clear existing markers and update editor
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (monaco && editor) {
      const model = editor.getModel();
      if (model) {
        console.log('[Snippet] Clearing markers and setting new content');
        monaco.editor.setModelMarkers(model, markerSourceRef.current, []);
        // Explicitly set the model value to ensure editor updates
        model.setValue(snippet);
      }
    }
    
    // Force state update to trigger validation
    // We need to do this even if model.setValue was called because
    // the onChange event might not fire for programmatic changes
    console.log('[Snippet] Triggering validation with new code');
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
    if (workerError) {
      return { label: 'Worker error', tone: 'invalid' as const };
    }
    if (!workerReady) {
      return { label: 'Starting validator…', tone: 'warning' as const };
    }
    if (isValidating) {
      return { label: 'Validating…', tone: 'warning' as const };
    }
    if (result.errors.length > 0) return { label: `${result.errors.length} error(s)`, tone: 'invalid' as const };
    if (result.warnings.length > 0) return { label: `${result.warnings.length} warning(s)`, tone: 'warning' as const };
    return { label: 'No issues detected', tone: 'valid' as const };
  }, [workerError, workerReady, isValidating, result]);

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
              key="validator-editor"
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
                {workerReady ? (
                  <div>
                    Errors: {result.errors.length} · Warnings: {result.warnings.length} · Info: {result.info.length}
                  </div>
                ) : (
                  <div>Worker initialising…</div>
                )}
                {workerState && (
                  <div className="status-text">
                    Source: {workerState.markerSource} · Worker v{workerState.version}
                  </div>
                )}
                {isValidating && !workerError && (
                  <div className="status-text">Validating…</div>
                )}
              </section>

              {workerError && (
                <section>
                  <h4>Worker Error</h4>
                  <div className="validation-item error">
                    <pre>{workerError}</pre>
                  </div>
                </section>
              )}

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
              key="ast-editor"
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
