import type {
  IMarkdownString,
  IRange,
  Position,
  editor,
  languages,
} from 'monaco-editor';
import { ErrorDocumentationProvider } from '../error-documentation-provider';
import type { EnhancedDocumentation } from '../error-documentation-provider';

const IDENTIFIER_PATTERN = /[A-Za-z0-9_.]/;

type DocumentationKind =
  | 'Function'
  | 'Variable'
  | 'Constant'
  | 'Keyword'
  | 'Operator'
  | 'Type';

interface HoverDocumentation {
  readonly identifier: string;
  readonly kind: DocumentationKind;
  readonly documentation: EnhancedDocumentation;
}

interface IdentifierMatch {
  readonly text: string;
  readonly range: IRange;
}

const hoverContentCache = new Map<string, IMarkdownString[] | null>();
const registeredMonacoInstances = new WeakSet<object>();

function isIdentifierChar(char: string): boolean {
  return IDENTIFIER_PATTERN.test(char);
}

function normaliseParagraph(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }
  const replaced = value.replace(/\u00A0/g, ' ');
  const condensed = replaced.replace(/\s+/g, ' ').trim();
  return condensed.length > 0 ? condensed : null;
}

function normaliseBullet(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }
  const replaced = value.replace(/\u00A0/g, ' ');
  const condensed = replaced.replace(/\s+/g, ' ').trim();
  return condensed.length > 0 ? condensed : null;
}

function normaliseCode(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }
  const replaced = value.replace(/\u00A0/g, ' ');
  const trimmed = replaced.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractIdentifier(
  model: Pick<editor.ITextModel, 'getLineContent'>,
  position: Position,
): IdentifierMatch | null {
  const lineNumber = position.lineNumber;
  const line = model.getLineContent(lineNumber);
  if (!line) {
    return null;
  }

  const lineLength = line.length;
  if (lineLength === 0) {
    return null;
  }

  let index = Math.max(0, Math.min(lineLength - 1, position.column - 1));

  if (!isIdentifierChar(line[index])) {
    if (index > 0 && isIdentifierChar(line[index - 1])) {
      index -= 1;
    } else if (index + 1 < lineLength && isIdentifierChar(line[index + 1])) {
      index += 1;
    } else {
      return null;
    }
  }

  let start = index;
  let end = index;

  while (start > 0 && isIdentifierChar(line[start - 1])) {
    start -= 1;
  }
  while (end + 1 < lineLength && isIdentifierChar(line[end + 1])) {
    end += 1;
  }

  const text = line.slice(start, end + 1);
  if (!text || text === '.' || !/[A-Za-z_]/.test(text)) {
    return null;
  }

  return {
    text,
    range: {
      startLineNumber: lineNumber,
      startColumn: start + 1,
      endLineNumber: lineNumber,
      endColumn: end + 2,
    },
  };
}

function resolveDocumentation(identifier: string): HoverDocumentation | null {
  const cleaned = identifier.trim();
  if (!cleaned) {
    return null;
  }

  const functionDoc = ErrorDocumentationProvider.getFunctionDoc(cleaned);
  if (functionDoc) {
    return { identifier: cleaned, kind: 'Function', documentation: functionDoc };
  }

  const variableDoc = ErrorDocumentationProvider.getVariableDoc(cleaned);
  if (variableDoc) {
    return { identifier: cleaned, kind: 'Variable', documentation: variableDoc };
  }

  const constantDoc = ErrorDocumentationProvider.getConstantDoc(cleaned);
  if (constantDoc) {
    return { identifier: cleaned, kind: 'Constant', documentation: constantDoc };
  }

  const typeDoc = ErrorDocumentationProvider.getTypeDoc(cleaned);
  if (typeDoc) {
    return { identifier: cleaned, kind: 'Type', documentation: typeDoc };
  }

  const keywordDoc = ErrorDocumentationProvider.getKeywordDoc(cleaned);
  if (keywordDoc) {
    return { identifier: cleaned, kind: 'Keyword', documentation: keywordDoc };
  }

  const operatorDoc = ErrorDocumentationProvider.getOperatorDoc(cleaned);
  if (operatorDoc) {
    return { identifier: cleaned, kind: 'Operator', documentation: operatorDoc };
  }

  return null;
}

const KIND_DESCRIPTIONS: Record<DocumentationKind, string> = {
  Function: 'built-in function',
  Variable: 'built-in variable',
  Constant: 'built-in constant',
  Keyword: 'keyword',
  Operator: 'operator',
  Type: 'type',
};

function describeKind(kind: DocumentationKind): string {
  return KIND_DESCRIPTIONS[kind];
}

const TV_REFERENCE_BASE = 'https://www.tradingview.com/pine-script-reference/v6/';

function createReferenceAnchor(kind: DocumentationKind, identifier: string): string | null {
  if (!identifier) {
    return null;
  }

  const prefix = (() => {
    switch (kind) {
      case 'Function':
        return 'fun_';
      case 'Variable':
        return 'var_';
      case 'Constant':
        return 'const_';
      case 'Keyword':
        return 'kw_';
      case 'Operator':
        return 'op_';
      case 'Type':
        return 'type_';
      default:
        return null;
    }
  })();

  if (!prefix) {
    return null;
  }

  const anchor = `${prefix}${identifier}`;
  return `${TV_REFERENCE_BASE}#${encodeURIComponent(anchor)}`;
}

function renderDocumentation(entry: HoverDocumentation): IMarkdownString[] | null {
  const cached = hoverContentCache.get(entry.identifier);
  if (cached !== undefined) {
    return cached;
  }

  const parts: string[] = [];
  parts.push(`${entry.identifier} (${describeKind(entry.kind)})`);

  const description = normaliseParagraph(entry.documentation.description);
  if (description) {
    parts.push(description);
  }

  const syntax = normaliseCode(entry.documentation.syntax);
  if (syntax) {
    parts.push('**Syntax**');
    parts.push(['```pinescript', syntax, '```'].join('\n'));
  }

  const parameters = (entry.documentation.parameters ?? [])
    .map(normaliseBullet)
    .filter((param): param is string => Boolean(param));
  if (parameters.length > 0) {
    parts.push('**Parameters**');
    parts.push(parameters.map((param) => `- ${param}`).join('\n'));
  }

  const returns = normaliseParagraph(entry.documentation.returns);
  if (returns) {
    parts.push('**Returns**');
    parts.push(returns);
  }

  const remarks = normaliseParagraph(entry.documentation.remarks);
  if (remarks) {
    parts.push('**Remarks**');
    parts.push(remarks);
  }

  const referenceUrl = createReferenceAnchor(entry.kind, entry.identifier);
  if (referenceUrl) {
    parts.push(`[TradingView reference](${referenceUrl})`);
  }

  const markdownValue = parts.join('\n\n');
  if (!markdownValue) {
    hoverContentCache.set(entry.identifier, null);
    return null;
  }

  const contents: IMarkdownString[] = [{ value: markdownValue }];
  hoverContentCache.set(entry.identifier, contents);
  return contents;
}

export function ensurePineHoverProvider(
  monaco: typeof import('monaco-editor'),
  languageId: string,
): void {
  if (registeredMonacoInstances.has(monaco)) {
    return;
  }

  monaco.languages.registerHoverProvider(languageId, {
    provideHover(model, position): languages.ProviderResult<languages.Hover> {
      const match = extractIdentifier(model, position);
      if (!match) {
        return null;
      }

      const documentation = resolveDocumentation(match.text);
      if (!documentation) {
        return null;
      }

      const contents = renderDocumentation(documentation);
      if (!contents) {
        return null;
      }

      return {
        contents,
        range: match.range,
      };
    },
  });

  registeredMonacoInstances.add(monaco);
}
