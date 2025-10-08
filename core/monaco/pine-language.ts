import type { languages } from 'monaco-editor';
import { KEYWORDS, NAMESPACES } from '../constants';

const LANGUAGE_ID = 'pinescript';

const CONTROL_KEYWORDS = [
  'if',
  'else',
  'for',
  'while',
  'repeat',
  'until',
  'switch',
  'case',
  'default',
  'break',
  'continue',
  'return',
  'to',
  'by',
  'in',
];

const DECLARATION_KEYWORDS = [
  'indicator',
  'strategy',
  'library',
  'import',
  'export',
  'as',
  'var',
  'varip',
  'const',
  'type',
  'method',
  'enum',
  'input',
];

const TYPE_KEYWORDS = [
  'int',
  'float',
  'bool',
  'string',
  'color',
  'line',
  'label',
  'box',
  'table',
  'array',
  'matrix',
  'map',
  'linefill',
  'polyline',
  'simple',
  'series',
];

const LITERAL_KEYWORDS = ['true', 'false', 'na'];

const FLOAT_NUMBER_PATTERN =
  '(?:\\d+(?:_?\\d)*)?\\.\\d+(?:_?\\d)*(?:[eE][+-]?\\d+)?|\\.\\d+(?:_?\\d)*(?:[eE][+-]?\\d+)?';
const GENERAL_NUMBER_PATTERN =
  '(?:\\d+(?:_?\\d)*(?:\\.\\d+(?:_?\\d)*)?|\\.\\d+(?:_?\\d)*)(?:[eE][+-]?\\d+)?';

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const gatherNamespaceRoots = (): string[] => {
  const roots = new Set<string>();

  for (const entry of NAMESPACES) {
    const [root] = entry.split('.');
    if (root) {
      roots.add(root);
    }
  }

  // Ensure script declarations are always highlighted
  ['indicator', 'strategy', 'library', 'input'].forEach((root) =>
    roots.add(root),
  );

  return Array.from(roots).sort((a, b) => {
    if (a === b) return 0;
    if (a.length !== b.length) {
      return b.length - a.length;
    }
    return a.localeCompare(b);
  });
};

const gatherConstantRoots = (): string[] => {
  const dottedRoots = new Set<string>();
  for (const keyword of KEYWORDS) {
    if (keyword.includes('.')) {
      dottedRoots.add(keyword.split('.')[0]);
    }
  }
  // Frequently used namespaces that may not appear as dotted keywords
  ['color', 'alert', 'plot', 'location', 'shape', 'yloc', 'xloc', 'session'].forEach(
    (root) => dottedRoots.add(root),
  );
  return Array.from(dottedRoots).sort((a, b) => {
    if (a === b) return 0;
    if (a.length !== b.length) {
      return b.length - a.length;
    }
    return a.localeCompare(b);
  });
};

export function registerPineLanguage(
  monaco: typeof import('monaco-editor'),
): void {
  if (monaco.languages.getLanguages().some((lang) => lang.id === LANGUAGE_ID)) {
    return;
  }

  const keywordList = Array.from(
    new Set([
      ...CONTROL_KEYWORDS,
      ...DECLARATION_KEYWORDS,
      ...TYPE_KEYWORDS,
      ...LITERAL_KEYWORDS,
    ]),
  ).sort();

  const namespaceRoots = gatherNamespaceRoots();
  const namespacePattern = `\\b(?:${namespaceRoots
    .map(escapeRegExp)
    .join('|')})(?=\\.)`;

  const constantRoots = gatherConstantRoots();
  const constantPattern = `\\b(?:${constantRoots
    .map(escapeRegExp)
    .join('|')})\\.[A-Za-z_][A-Za-z0-9_]*\\b`;

  monaco.languages.register({ id: LANGUAGE_ID });
  monaco.languages.setLanguageConfiguration(LANGUAGE_ID, {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  } satisfies languages.LanguageConfiguration);

  monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, {
    keywords: keywordList,
    typeKeywords: TYPE_KEYWORDS,
    literals: LITERAL_KEYWORDS,
    operators: [
      '=',
      '>',
      '<',
      '!',
      '~',
      '?',
      ':',
      '==',
      '<=',
      '>=',
      '!=',
      '&&',
      '||',
      '++',
      '--',
      '+',
      '-',
      '*',
      '/',
      '%',
      '+=',
      '-=',
      '*=',
      '/=',
      '%=',
      '?:',
      '??',
      '=>',
    ],
    symbols: /[=><!~?:&|+\-*/^%]+/,
    tokenizer: {
      root: [
        { include: '@whitespace' },

        // Version directives and compiler annotations
        [/(\/\/\s*[@]version\s*=\s*\d+)/, 'meta.directive'],
        [/(\/\/\s*[@][A-Za-z_][\w]*.*$)/, 'meta.annotation'],

        // Comments
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment'],

        // Strings
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/'([^'\\]|\\.)*'/, 'string'],

        // Numbers
        [new RegExp(`#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})\\b`), 'number.hex'],
        [new RegExp(FLOAT_NUMBER_PATTERN), 'number.float'],
        [new RegExp(GENERAL_NUMBER_PATTERN), { cases: { '@default': 'number' } }],

        // Namespaces and constants
        [new RegExp(namespacePattern), 'namespace'],
        [new RegExp(constantPattern), 'constant.language'],

        // Identifiers
        [
          /[A-Za-z_][\w]*/,
          {
            cases: {
              '@keywords': 'keyword',
              '@typeKeywords': 'type.identifier',
              '@literals': 'keyword.constant',
              '@default': 'identifier',
            },
          },
        ],

        // Operators and delimiters
        [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
        [/[{}()\[\]]/, '@brackets'],
        [/[;,]/, 'delimiter'],
      ],

      comment: [
        [/[^\/*]+/, 'comment'],
        [/\/\*/, 'comment', '@push'],
        [/\\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment'],
      ],

      whitespace: [[/[ \t\r\n]+/, 'white']],
    },
  });
}
