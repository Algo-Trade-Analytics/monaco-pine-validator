import { EOF, type IToken } from 'chevrotain';
import { SyntaxError } from '../../../pynescript/ast/error';
import {
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

const sharedParser = new PineParser();

export function parseWithChevrotain(source: string, options: AstParseOptions = {}): AstParseResult {
  const lexResult = PineLexer.tokenize(source);
  sharedParser.reset();
  sharedParser.input = lexResult.tokens;

  const programResult = sharedParser.program() ?? { directives: [], body: [] };
  const { directives, body } = programResult;

  const syntaxErrors: SyntaxError[] = [];

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
      diagnostics: createAstDiagnostics(syntaxErrors),
    };
  }

  return {
    ast: buildProgramNode(source, directives, body),
    diagnostics: createAstDiagnostics(syntaxErrors),
  };
}
