import type { IToken } from 'chevrotain';
import {
  type BooleanLiteralNode,
  type NullLiteralNode,
  type NumberLiteralNode,
  type StringLiteralNode,
} from '../../nodes';
import { ensureToken, spanFromTokens } from './base';

export function createStringNode(token?: IToken): StringLiteralNode {
  const safeToken = ensureToken(token);
  const raw = safeToken.image;
  const value = raw.slice(1, -1);
  return {
    kind: 'StringLiteral',
    value,
    raw,
    ...spanFromTokens(safeToken, safeToken),
  };
}

export function createNumberNode(token?: IToken): NumberLiteralNode {
  const safeToken = ensureToken(token);
  const value = Number(safeToken.image.replace(/_/g, ''));
  return {
    kind: 'NumberLiteral',
    value,
    ...spanFromTokens(safeToken, safeToken),
  };
}

export function createBooleanNode(token: IToken | undefined, value: boolean): BooleanLiteralNode {
  const safeToken = ensureToken(token);
  return {
    kind: 'BooleanLiteral',
    value,
    ...spanFromTokens(safeToken, safeToken),
  };
}

export function createNullNode(token?: IToken): NullLiteralNode {
  const safeToken = ensureToken(token);
  return {
    kind: 'NullLiteral',
    ...spanFromTokens(safeToken, safeToken),
  };
}
