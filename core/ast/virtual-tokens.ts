import type { IToken, TokenType } from 'chevrotain';

export enum VirtualTokenReason {
  UNKNOWN = 'UNKNOWN',
  MISSING_EQUALS = 'MISSING_EQUALS',
  MISSING_COMMA = 'MISSING_COMMA',
  MISSING_SEMICOLON = 'MISSING_SEMICOLON',
  MISSING_PAREN = 'MISSING_PAREN',
  MISSING_BRACKET = 'MISSING_BRACKET',
  MISSING_BRACE = 'MISSING_BRACE',
  MISSING_OPERAND = 'MISSING_OPERAND',
  MISSING_ARGUMENT = 'MISSING_ARGUMENT',
  TRAILING_COMMA = 'TRAILING_COMMA',
  CONDITIONAL_QUESTION = 'CONDITIONAL_QUESTION',
  CONDITIONAL_COLON = 'CONDITIONAL_COLON',
  FUNCTION_PARENTHESIS = 'FUNCTION_PARENTHESIS',
}

export interface VirtualToken extends IToken {
  isVirtual: true;
  expectedType: TokenType;
  reason: VirtualTokenReason;
  insertedAt: {
    line: number;
    column: number;
  };
  recoveryContext?: string;
}

export function createVirtualToken(
  tokenType: TokenType,
  insertAfter: IToken,
  reason: VirtualTokenReason = VirtualTokenReason.UNKNOWN,
  imageOverride?: string,
): VirtualToken {
  const startOffset = insertAfter.endOffset ?? insertAfter.startOffset ?? 0;
  const startLine = insertAfter.endLine ?? insertAfter.startLine ?? 1;
  const startColumn = (insertAfter.endColumn ?? insertAfter.startColumn ?? 0) + 1;
  const image = imageOverride ?? tokenType.LABEL ?? tokenType.name ?? '';
  const length = image.length;

  return {
    image,
    startOffset,
    endOffset: startOffset + length,
    startLine,
    endLine: startLine,
    startColumn,
    endColumn: startColumn + length,
    tokenType,
    isVirtual: true,
    expectedType: tokenType,
    reason,
    insertedAt: {
      line: startLine,
      column: startColumn,
    },
  } as VirtualToken;
}
