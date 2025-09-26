import type { IToken } from 'chevrotain';
import {
  createLocation,
  createPosition,
  createRange,
  type Range,
  type SourceLocation,
} from '../../nodes';
import { Identifier as IdentifierToken } from '../tokens';

export function createFallbackToken(): IToken {
  return {
    image: '',
    startLine: 1,
    startColumn: 1,
    startOffset: 0,
    endLine: 1,
    endColumn: 1,
    endOffset: 0,
    tokenType: IdentifierToken,
  } as IToken;
}

export function ensureToken(token?: IToken, fallback?: IToken): IToken {
  return token ?? fallback ?? createFallbackToken();
}

export function tokenStart(token?: IToken) {
  const safeToken = ensureToken(token);
  return createPosition(safeToken.startLine ?? 1, safeToken.startColumn ?? 1, safeToken.startOffset ?? 0);
}

export function tokenEnd(token?: IToken) {
  const safeToken = ensureToken(token);
  const endLine = safeToken.endLine ?? safeToken.startLine ?? 1;
  const endColumn = (safeToken.endColumn ?? safeToken.startColumn ?? 1) + 1;
  const endOffset = (safeToken.endOffset ?? safeToken.startOffset ?? 0) + 1;
  return createPosition(endLine, endColumn, endOffset);
}

export function spanFromTokens(start?: IToken, end?: IToken) {
  const safeStart = ensureToken(start);
  const safeEnd = ensureToken(end, safeStart);
  return {
    loc: createLocation(tokenStart(safeStart), tokenEnd(safeEnd)),
    range: createRange(safeStart.startOffset ?? 0, (safeEnd.endOffset ?? safeEnd.startOffset ?? 0) + 1),
  };
}

export function spanFromNodes(startNode: { loc: SourceLocation; range: Range } | undefined, endToken?: IToken) {
  if (!startNode || !startNode.loc) {
    return spanFromTokens(endToken, endToken);
  }

  const safeEnd = ensureToken(endToken);
  return {
    loc: createLocation(startNode.loc.start, tokenEnd(safeEnd)),
    range: createRange(startNode.range[0], (safeEnd.endOffset ?? safeEnd.startOffset ?? 0) + 1),
  };
}

export function tokenIndent(token?: IToken): number {
  return Math.max(0, (ensureToken(token).startColumn ?? 1) - 1);
}

export function createSyntheticToken(
  image: string,
  tokenType: typeof IdentifierToken,
  reference?: IToken,
): IToken {
  const base = ensureToken(reference);
  const length = image.length;
  const startLine = base.startLine ?? 1;
  const startColumn = base.startColumn ?? 1;
  const startOffset = base.startOffset ?? 0;
  const endLine = base.endLine ?? startLine;
  const endColumn = startColumn + length;
  const endOffset = startOffset + length;

  return {
    image,
    startLine,
    startColumn,
    startOffset,
    endLine,
    endColumn,
    endOffset,
    tokenType,
  } as IToken;
}
