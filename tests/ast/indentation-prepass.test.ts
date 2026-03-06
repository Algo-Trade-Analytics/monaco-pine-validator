import { describe, expect, it } from 'vitest';
import { buildIndentationTokenModel } from '../../core/ast/parser/indentation-prepass';
import { LBrace, PineLexer, RBrace, Semicolon } from '../../core/ast/parser/tokens';

describe('Indentation prepass', () => {
  it('tokenizes semicolons in the Chevrotain lexer', () => {
    const lexResult = PineLexer.tokenize('a = 1; b = 2');

    expect(lexResult.errors).toHaveLength(0);
    expect(lexResult.tokens.some((token) => token.tokenType === Semicolon)).toBe(true);
  });

  it('treats lines inside braces as continuation depth, not indentation blocks', () => {
    const source = ['foo({', '    bar', '})', ''].join('\n');
    const lexResult = PineLexer.tokenize(source);

    expect(lexResult.errors).toHaveLength(0);
    expect(lexResult.tokens.some((token) => token.tokenType === LBrace)).toBe(true);
    expect(lexResult.tokens.some((token) => token.tokenType === RBrace)).toBe(true);

    const model = buildIndentationTokenModel(lexResult.tokens);
    expect(model.transitions).toHaveLength(0);
    expect(model.effectiveIndentByLine.get(2)).toBe(0);
  });
});
