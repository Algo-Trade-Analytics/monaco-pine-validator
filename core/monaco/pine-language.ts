import type { languages } from 'monaco-editor';
import { KEYWORDS, NAMESPACES } from '../constants';
import { NAMESPACE_MEMBERS } from '../namespace-members';
import { ensurePineHoverProvider } from './pine-tooltips';

export const PINE_LANGUAGE_ID = 'pinescript';

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
  'and',
  'not',
  'or',
];

const DECLARATION_KEYWORDS = [
  'import',
  'export',
  'as',
  'var',
  'varip',
  'const',
  'type',
  'method',
  'enum',
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

const BUILTIN_FUNCTIONS = [
  'plot',
  'plotchar',
  'plotshape',
  'plotarrow',
  'plotbar',
  'plotcandle',
  'plotcandle',
  'bgcolor',
  'barcolor',
  'fill',
  'hline',
  'input',
  'var',
  'varip',
  'na',
  'nz',
  'math',
  'str',
  'color',
  'request',
  'alert',
  'alertcondition',
  'log',
  'indicator',
  'strategy',
  'library',
];

const BUILTIN_IDENTIFIERS = [
  'open', 
  'high', 
  'low', 
  'close', 
  'volume', 
  'time', 
  'timenow', 
  'time_close', 
  'bar_index', 
  'year', 
  'month', 
  'weekofyear', 
  'dayofmonth', 
  'dayofweek', 
  'hour', 
  'minute', 
  'second'
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

const buildNamespaceMemberRules = (): languages.IMonarchLanguageRule[] => {
  const rules: languages.IMonarchLanguageRule[] = [];

  for (const [namespace, entries] of Object.entries(NAMESPACE_MEMBERS)) {
    const members = Array.from(entries ?? []);
    if (members.length === 0) {
      continue;
    }

    const sortedMembers = members
      .filter((member) => member.length > 0)
      .sort((a, b) => {
        if (a === b) return 0;
        if (a.length !== b.length) {
          return b.length - a.length;
        }
        return a.localeCompare(b);
      })
      .map(escapeRegExp);

    if (sortedMembers.length === 0) {
      continue;
    }

    const pattern =
      `\\b(${escapeRegExp(namespace)})(\\.)(` +
      `${sortedMembers.join('|')})\\b`;

    // Use a single token type for the entire namespace expression
    rules.push([
      new RegExp(pattern),
      'type.identifier',
    ]);
  }

  return rules;
};

export function registerPineLanguage(
  monaco: typeof import('monaco-editor'),
): void {
  ensurePineHoverProvider(monaco, PINE_LANGUAGE_ID);

  if (monaco.languages.getLanguages().some((lang) => lang.id === PINE_LANGUAGE_ID)) {
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

  const keywordPatternSource = keywordList.map(escapeRegExp).join('|');
  
  const functionExcludeKeywords = Array.from(
    new Set([
      ...CONTROL_KEYWORDS,
      ...TYPE_KEYWORDS,
      ...LITERAL_KEYWORDS,
      'enum',
      'type',
      'method',
      'var',
      'varip',
      'const',
      'as',
      'import',
      'export',
    ]),
  )
    .filter((keyword) => !['indicator', 'strategy', 'library', 'input'].includes(keyword))
    .sort();


const builtinIdentifierPattern =
  BUILTIN_IDENTIFIERS.length > 0
    ? `\\b(?:${BUILTIN_IDENTIFIERS.map(escapeRegExp).join('|')})\\b`
    : null;

  const functionExcludePatternSource = functionExcludeKeywords
    .map(escapeRegExp)
    .join('|');

  const functionCallPattern =
    functionExcludePatternSource.length > 0
      ? `\\b(?!(?:${functionExcludePatternSource})\\b)[A-Za-z_][A-Za-z0-9_]*(?=\\s*\\()`
      : `\\b[A-Za-z_][A-Za-z0-9_]*(?=\\s*\\()`;

  const namespaceRoots = gatherNamespaceRoots();
  const namespacePattern = `\\b(?:${namespaceRoots
    .map(escapeRegExp)
    .join('|')})(?=\\.)`;

  const constantRoots = gatherConstantRoots();
  const constantPattern = `\\b(?:${constantRoots
    .map(escapeRegExp)
    .join('|')})\\.[A-Za-z_][A-Za-z0-9_]*\\b`;

  const namespaceMemberRules = buildNamespaceMemberRules();

  monaco.languages.register({ id: PINE_LANGUAGE_ID });
  monaco.languages.setLanguageConfiguration(PINE_LANGUAGE_ID, {
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

  monaco.languages.setMonarchTokensProvider(PINE_LANGUAGE_ID, {
    keywords: keywordList,
    typeKeywords: TYPE_KEYWORDS,
    builtinFunctions: BUILTIN_FUNCTIONS,
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
      ':=',
      ',',
    ],
    symbols: /[=><!~?:&|+\-*/^%,]+/,
    tokenizer: {
      root: (() => {
        const rules: languages.IMonarchLanguageRule[] = [
          { include: '@whitespace' },

          [/(\/\/\s*[@]version\s*=\s*\d+)/, 'meta.directive'],
          [/(\/\/\s*[@][A-Za-z_][\w]*.*$)/, 'meta.annotation'],

          [/\/\*/, 'comment', '@comment'],
          [/\/\/.*$/, 'comment'],

          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"([^"\\]|\\.)*"/, 'string'],
          [/'([^'\\]|\\.)*$/, 'string.invalid'],
          [/'([^'\\]|\\.)*'/, 'string'],

          [new RegExp(`#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})\\b`), 'number.hex'],
          [new RegExp(FLOAT_NUMBER_PATTERN), 'number.float'],
          [new RegExp(GENERAL_NUMBER_PATTERN), { cases: { '@default': 'number' } }],
        ];

        // Add namespace member rules first to ensure they take precedence
        for (const memberRule of namespaceMemberRules) {
          rules.push(memberRule);
        }

        rules.push([new RegExp(namespacePattern), 'namespace']);
        rules.push([new RegExp(constantPattern), 'constant.language']);

        rules.push([/\b(?:and|or|not)\b/, 'operator']);

        if (builtinIdentifierPattern) {
          rules.push([new RegExp(builtinIdentifierPattern), 'variable.language']);
        }

        rules.push([
          /\b[A-Za-z_][\w]*(?=\.(?:new|delete|get_[A-Za-z_]+|set_[A-Za-z_]+))/,
          'type.identifier',
        ]);
        rules.push([new RegExp(
          `\\b(?!(?:${functionExcludePatternSource})\\b)(?:(?!\\d)[A-Za-z_][\\w]*)(?=\\s+[A-Za-z_][\\w]*\\s*(?:[,)=]))`,
        ), 'type.identifier']);

        rules.push([new RegExp(functionCallPattern), 'support.function']);

        rules.push(
          [
            /\b(type)(\s+)([A-Za-z_][\w]*)/,
            ['keyword', 'white', 'type.identifier'],
          ],
          [
            /\b(enum)(\s+)([A-Za-z_][\w]*)/,
            ['keyword', 'white', 'type.identifier'],
          ],
          [
            // Match namespace.member patterns explicitly (must come before general identifiers)
            /(color|input|ta|math|str|array|matrix|map|request|alert|plot|line|label|box|table|session|strategy|barmerge|dayofweek|hline|log|runtime|alert|xloc|yloc|shape|location|linefill|chart|timeframe|ticker|currency|syminfo|scale|position|display|extend|na|color|type|bool|int|float|string)\.([\w]+)/,
            'type.identifier',
          ],
          [
            // General identifiers (keywords, variables, etc.)
            /[A-Za-z_][\w]*/,
            {
              cases: {
                '@keywords': 'keyword',
                '@typeKeywords': 'type.identifier',
                '@builtinFunctions': 'type.identifier',
                '@literals': 'keyword.constant',
                '@default': 'identifier',
              },
            },
          ],
          [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
          [/[{}()\[\]]/, '@brackets'],
          [/[;]/, 'delimiter'],
        );

        return rules;
      })(),

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
