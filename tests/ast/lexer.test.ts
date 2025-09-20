import { describe, expect, it } from 'vitest';
import { lex } from '../../core/ast/lexer';

describe('PineScript lexer utility', () => {
  it('tokenises a simple assignment with positional metadata', () => {
    const tokens = lex('var x = 1', { includeWhitespace: true });
    const types = tokens.map((token) => token.type);

    expect(types).toEqual(['identifier', 'whitespace', 'identifier', 'whitespace', 'operator', 'whitespace', 'number']);
    expect(tokens[0].value).toBe('var');
    expect(tokens[0].start.column).toBe(1);
    expect(tokens[6].end.column).toBe(10);
  });

  it('emits newline tokens with correct line tracking', () => {
    const tokens = lex('plot\nclose');

    expect(tokens.map((token) => token.type)).toEqual(['identifier', 'newline', 'identifier']);
    expect(tokens[1].start.line).toBe(1);
    expect(tokens[2].start.line).toBe(2);
    expect(tokens[2].start.column).toBe(1);
  });

  it('captures string literals and trailing comments', () => {
    const tokens = lex('plot("hi") // greeting');

    const stringToken = tokens.find((token) => token.type === 'string');
    const commentToken = tokens.find((token) => token.type === 'comment');

    expect(stringToken?.value).toBe('"hi"');
    expect(commentToken?.value.trim()).toBe('// greeting');
  });
});
