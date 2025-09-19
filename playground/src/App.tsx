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

  const validationStatus = useMemo(() => {
    if (!result) return { label: 'Idle', tone: 'warning' as const };
    if (result.errors.length > 0) return { label: `${result.errors.length} error(s)`, tone: 'invalid' as const };
    if (result.warnings.length > 0) return { label: `${result.warnings.length} warning(s)`, tone: 'warning' as const };
    return { label: 'No issues detected', tone: 'valid' as const };
  }, [result]);

  return (
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
  );
}
