import { createTokenInstance, type IToken, type TokenType } from 'chevrotain';
import {
  And,
  BitwiseAnd,
  BitwiseOr,
  BitwiseXor,
  Dedent,
  Indent,
  Colon,
  Comma,
  Dot,
  Equal,
  EqualEqual,
  Greater,
  GreaterEqual,
  LBracket,
  LParen,
  Less,
  LessEqual,
  Minus,
  Newline,
  NotEqual,
  NullishCoalescing,
  Or,
  Plus,
  Percent,
  Question,
  RBracket,
  RParen,
  Slash,
  Star,
  StrictEqual,
  StrictNotEqual,
} from './tokens';

export type IndentationTransitionKind = 'INDENT' | 'DEDENT';

export interface IndentationTransition {
  kind: IndentationTransitionKind;
  line: number;
  indent: number;
}

export interface IndentationTokenModel {
  transitions: IndentationTransition[];
  effectiveIndentByLine: Map<number, number>;
}

export interface IndentationPrepassResult {
  tokens: IToken[];
  model: IndentationTokenModel;
}

function tokenLine(token: IToken): number {
  return token.startLine ?? token.endLine ?? 1;
}

function tokenIndent(token: IToken): number {
  const startColumn = token.startColumn ?? 1;
  return Math.max(0, startColumn - 1);
}

const continuationSuffixTokenTypes = new Set<TokenType>([
  Plus,
  Minus,
  Star,
  Slash,
  Percent,
  BitwiseOr,
  BitwiseAnd,
  BitwiseXor,
  And,
  Or,
  NullishCoalescing,
  Question,
  Colon,
  Comma,
  Dot,
  Equal,
  EqualEqual,
  NotEqual,
  StrictEqual,
  StrictNotEqual,
  Less,
  LessEqual,
  Greater,
  GreaterEqual,
]);

function isContinuationSuffixToken(tokenType: TokenType | undefined): boolean {
  return Boolean(tokenType && continuationSuffixTokenTypes.has(tokenType));
}

function isOpeningDelimiter(tokenType: TokenType): boolean {
  return tokenType === LParen || tokenType === LBracket;
}

function isClosingDelimiter(tokenType: TokenType): boolean {
  return tokenType === RParen || tokenType === RBracket;
}

export function buildIndentationTokenModel(tokens: IToken[]): IndentationTokenModel {
  const firstTokenByLine = new Map<number, IToken>();
  const lastTokenTypeByLine = new Map<number, TokenType>();
  const delimiterDepthAtLineStart = new Map<number, number>();

  let delimiterDepth = 0;
  for (const token of tokens) {
    const line = tokenLine(token);
    if (!delimiterDepthAtLineStart.has(line)) {
      delimiterDepthAtLineStart.set(line, delimiterDepth);
    }

    if (token.tokenType === Newline) {
      continue;
    }

    if (!firstTokenByLine.has(line)) {
      firstTokenByLine.set(line, token);
    }
    lastTokenTypeByLine.set(line, token.tokenType);

    if (isOpeningDelimiter(token.tokenType)) {
      delimiterDepth += 1;
    } else if (isClosingDelimiter(token.tokenType) && delimiterDepth > 0) {
      delimiterDepth -= 1;
    }
  }

  const transitions: IndentationTransition[] = [];
  const effectiveIndentByLine = new Map<number, number>();
  const indentationStack: number[] = [0];
  const lines = Array.from(firstTokenByLine.keys()).sort((a, b) => a - b);

  for (const line of lines) {
    const firstToken = firstTokenByLine.get(line);
    if (!firstToken) {
      continue;
    }

    const physicalIndent = tokenIndent(firstToken);
    const stackTop = indentationStack[indentationStack.length - 1] ?? 0;
    const startsInsideDelimiter =
      (delimiterDepthAtLineStart.get(line) ?? 0) > 0;
    const hasWrapIndent = physicalIndent % 4 !== 0;
    const previousLineLastToken = lastTokenTypeByLine.get(line - 1);
    const continuesFromPreviousLine =
      hasWrapIndent && isContinuationSuffixToken(previousLineLastToken);
    const isContinuationLine =
      hasWrapIndent || startsInsideDelimiter || continuesFromPreviousLine;

    if (isContinuationLine) {
      effectiveIndentByLine.set(line, stackTop);
      continue;
    }

    if (physicalIndent > stackTop) {
      indentationStack.push(physicalIndent);
      transitions.push({ kind: 'INDENT', line, indent: physicalIndent });
    } else if (physicalIndent < stackTop) {
      while (
        indentationStack.length > 1 &&
        physicalIndent < (indentationStack[indentationStack.length - 1] ?? 0)
      ) {
        indentationStack.pop();
        transitions.push({
          kind: 'DEDENT',
          line,
          indent: indentationStack[indentationStack.length - 1] ?? 0,
        });
      }

      if (physicalIndent > (indentationStack[indentationStack.length - 1] ?? 0)) {
        indentationStack.push(physicalIndent);
        transitions.push({ kind: 'INDENT', line, indent: physicalIndent });
      }
    }

    effectiveIndentByLine.set(
      line,
      indentationStack[indentationStack.length - 1] ?? 0,
    );
  }

  const eofToken = tokens[tokens.length - 1];
  const eofLine =
    eofToken?.endLine ??
    eofToken?.startLine ??
    (lines.length > 0 ? lines[lines.length - 1] : 1);

  while (indentationStack.length > 1) {
    indentationStack.pop();
    transitions.push({
      kind: 'DEDENT',
      // End-of-input dedents should be emitted after the final line tokens.
      line: eofLine + 1,
      indent: indentationStack[indentationStack.length - 1] ?? 0,
    });
  }

  return {
    transitions,
    effectiveIndentByLine,
  };
}

function createIndentationVirtualToken(
  transition: IndentationTransition,
  reference: IToken | undefined,
): IToken {
  const tokenType = transition.kind === 'INDENT' ? Indent : Dedent;
  const line = reference?.startLine ?? transition.line;
  const column = reference?.startColumn ?? (transition.indent + 1);
  const offset = reference?.startOffset ?? reference?.endOffset ?? 0;

  return createTokenInstance(
    tokenType,
    '',
    offset,
    offset,
    line,
    line,
    column,
    column,
  );
}

export function injectIndentationVirtualTokens(
  tokens: IToken[],
  model: IndentationTokenModel,
): IToken[] {
  if (model.transitions.length === 0) {
    return tokens;
  }

  const transitionsByLine = new Map<number, IndentationTransition[]>();
  for (const transition of model.transitions) {
    const list = transitionsByLine.get(transition.line) ?? [];
    list.push(transition);
    transitionsByLine.set(transition.line, list);
  }

  const injected: IToken[] = [];
  const insertedLines = new Set<number>();
  let lastToken: IToken | undefined;

  for (const token of tokens) {
    const line = tokenLine(token);
    if (token.tokenType !== Newline && !insertedLines.has(line)) {
      const lineTransitions = transitionsByLine.get(line) ?? [];
      for (const transition of lineTransitions) {
        injected.push(createIndentationVirtualToken(transition, token));
      }
      insertedLines.add(line);
    }

    injected.push(token);
    lastToken = token;
  }

  // Flush transitions that target virtual end-of-input lines.
  for (const [line, lineTransitions] of transitionsByLine.entries()) {
    if (insertedLines.has(line)) {
      continue;
    }
    for (const transition of lineTransitions) {
      injected.push(createIndentationVirtualToken(transition, lastToken));
    }
    insertedLines.add(line);
  }

  return injected;
}

export function preprocessIndentationTokens(tokens: IToken[]): IndentationPrepassResult {
  const model = buildIndentationTokenModel(tokens);
  const withVirtualIndentation = injectIndentationVirtualTokens(tokens, model);
  return {
    tokens: withVirtualIndentation,
    model,
  };
}
