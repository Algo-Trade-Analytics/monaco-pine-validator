import { EOF, type IToken } from 'chevrotain';
import { SyntaxError } from '../../../pynescript/ast/error';
import {
  type CommentNode,
  type ProgramNode,
  type StatementNode,
  type VersionDirectiveNode,
  createLocation,
  createPosition,
  createRange,
} from '../nodes';
import { createAstDiagnostics, type AstParseOptions, type AstParseResult } from '../types';
import { PineLexer } from './tokens';
import { PineParser } from './parser';
import { preprocessIndentationTokens } from './indentation-prepass';

const EOF_TOKEN = EOF;

function getLine(source: string, lineNumber: number): string {
  const lines = source.split(/\r?\n/);
  return lines[lineNumber - 1] ?? '';
}

function tokenToSyntaxError(token: IToken, message: string, source: string, filename = '<input>'): SyntaxError {
  const line = token.startLine ?? 1;
  const column = token.startColumn ?? 1;
  const text = getLine(source, line);
  return new SyntaxError(message, {
    filename,
    lineno: line,
    offset: column,
    text,
    end_lineno: token.endLine ?? line,
    end_offset: (token.endColumn ?? column) + 1,
  });
}

function buildProgramNode(
  source: string,
  directives: VersionDirectiveNode[],
  body: StatementNode[],
): ProgramNode {
  const endOffset = source.length;
  const lines = source.split(/\r?\n/);
  const endLine = lines.length || 1;
  const endColumn = (lines[endLine - 1]?.length ?? 0) + 1;
  return {
    kind: 'Program',
    directives,
    body,
    loc: createLocation(createPosition(1, 1, 0), createPosition(endLine, endColumn, endOffset)),
    range: createRange(0, endOffset),
  };
}

function isCompilerDirectiveComment(commentText: string): boolean {
  const trimmed = commentText.trimStart();
  if (!trimmed.startsWith('@')) {
    return false;
  }
  // Exclude version directives and compiler annotation comments from the
  // generic comment stream since they are represented separately in the AST.
  return /^@version\b/i.test(trimmed) || /^@[A-Za-z_][A-Za-z0-9_]*/.test(trimmed);
}

function extractLineComments(source: string): CommentNode[] {
  const comments: CommentNode[] = [];
  let index = 0;
  let line = 1;
  let column = 1;
  let inSingleQuotedString = false;
  let inDoubleQuotedString = false;
  let escaped = false;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '\r') {
      if (next === '\n') {
        index += 2;
      } else {
        index += 1;
      }
      line += 1;
      column = 1;
      escaped = false;
      continue;
    }

    if (char === '\n') {
      index += 1;
      line += 1;
      column = 1;
      escaped = false;
      continue;
    }

    if (inSingleQuotedString || inDoubleQuotedString) {
      if (escaped) {
        escaped = false;
        index += 1;
        column += 1;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        index += 1;
        column += 1;
        continue;
      }
      if (inSingleQuotedString && char === '\'') {
        inSingleQuotedString = false;
        index += 1;
        column += 1;
        continue;
      }
      if (inDoubleQuotedString && char === '"') {
        inDoubleQuotedString = false;
        index += 1;
        column += 1;
        continue;
      }
      index += 1;
      column += 1;
      continue;
    }

    if (char === '\'') {
      inSingleQuotedString = true;
      index += 1;
      column += 1;
      continue;
    }

    if (char === '"') {
      inDoubleQuotedString = true;
      index += 1;
      column += 1;
      continue;
    }

    if (char === '/' && next === '/') {
      const startOffset = index;
      const startLine = line;
      const startColumn = column;

      index += 2;
      column += 2;
      let commentText = '';

      while (index < source.length && source[index] !== '\n' && source[index] !== '\r') {
        commentText += source[index];
        index += 1;
        column += 1;
      }

      if (!isCompilerDirectiveComment(commentText)) {
        const endOffset = index;
        const endColumn = startColumn + (endOffset - startOffset);
        comments.push({
          kind: 'Comment',
          value: commentText.trim(),
          style: 'line',
          loc: createLocation(
            createPosition(startLine, startColumn, startOffset),
            createPosition(startLine, endColumn, endOffset),
          ),
          range: createRange(startOffset, endOffset),
        });
      }

      continue;
    }

    index += 1;
    column += 1;
  }

  return comments;
}

const sharedParser = new PineParser();

export function parseWithChevrotain(source: string, options: AstParseOptions = {}): AstParseResult {
  const comments = options.includeComments ? extractLineComments(source) : [];
  const lexResult = PineLexer.tokenize(source);
  const indentationPrepassResult = options.useIndentationTokens
    ? preprocessIndentationTokens(lexResult.tokens)
    : null;
  const parserTokens = indentationPrepassResult?.tokens ?? lexResult.tokens;
  sharedParser.reset();
  sharedParser.input = parserTokens;
  sharedParser.setIndentationTokenModel(indentationPrepassResult?.model ?? null);
  sharedParser.setUseVirtualIndentationTokens(Boolean(indentationPrepassResult));

  const programResult = sharedParser.program() ?? { directives: [], body: [] };
  const { directives, body } = programResult;

  const syntaxErrors: SyntaxError[] = [];
  const seenRecoveryKeys = new Set<string>();

  const filename = options.filename ?? '<input>';

  for (const error of lexResult.errors) {
    const line = error.line ?? 1;
    const column = error.column ?? 1;
    const text = getLine(source, line);
    syntaxErrors.push(
      new SyntaxError(error.message, {
        filename,
        lineno: line,
        offset: column,
        text,
        end_lineno: line,
        end_offset: column + 1,
      }),
    );
  }

  for (const error of sharedParser.errors) {
    const token = error.token ?? { startLine: 1, startColumn: 1, image: '', tokenType: EOF_TOKEN };
    syntaxErrors.push(tokenToSyntaxError(token as IToken, error.message, source, filename));
  }

  sharedParser.reset();
  const hasErrors = syntaxErrors.length > 0;
  if (hasErrors && options.allowErrors !== true) {
    return {
      ast: null,
      diagnostics: createAstDiagnostics(syntaxErrors, comments),
    };
  }

  return {
    ast: buildProgramNode(source, directives, body),
    diagnostics: createAstDiagnostics(syntaxErrors, comments),
  };
}
