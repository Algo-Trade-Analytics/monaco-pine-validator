import { Position } from './types';

export type TokenType =
  | 'identifier'
  | 'number'
  | 'string'
  | 'operator'
  | 'whitespace'
  | 'newline'
  | 'comment'
  | 'unknown';

export interface Token {
  type: TokenType;
  value: string;
  start: Position;
  end: Position;
}

export interface LexerOptions {
  includeWhitespace?: boolean;
  includeComments?: boolean;
}

const WHITESPACE = new Set([' ', '\t', '\r']);
const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;
const OPERATORS = new Set(['=', '+', '-', '*', '/', '%', '>', '<', '!', '&', '|', '^', '?', ':', ',', ';', '(', ')', '[', ']', '{', '}', '.']);
const COMPOUND_OPERATORS = new Set(['==', '!=', '>=', '<=', '+=', '-=', '*=', '/=', '&&', '||', '??']);

export function lex(source: string, options: LexerOptions = {}): Token[] {
  const { includeWhitespace = false, includeComments = true } = options;
  const tokens: Token[] = [];
  const length = source.length;

  let offset = 0;
  let line = 1;
  let column = 1;

  const advance = (count = 1): string => {
    let consumed = '';
    for (let i = 0; i < count && offset < length; i++) {
      const char = source[offset];
      consumed += char;
      offset += 1;
      if (char === '\n') {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
    }
    return consumed;
  };

  while (offset < length) {
    const start: Position = { line, column, offset };
    const char = source[offset];

    if (char === '\n') {
      advance();
      tokens.push({
        type: 'newline',
        value: '\n',
        start,
        end: { line, column, offset },
      });
      continue;
    }

    if (WHITESPACE.has(char)) {
      let value = '';
      while (offset < length && WHITESPACE.has(source[offset])) {
        value += advance();
      }
      if (includeWhitespace && value.length > 0) {
        tokens.push({
          type: 'whitespace',
          value,
          start,
          end: { line, column, offset },
        });
      }
      continue;
    }

    if (char === '/' && source[offset + 1] === '/') {
      let value = advance(2);
      while (offset < length && source[offset] !== '\n') {
        value += advance();
      }
      if (includeComments) {
        tokens.push({
          type: 'comment',
          value,
          start,
          end: { line, column, offset },
        });
      }
      continue;
    }

    if (IDENT_START.test(char)) {
      let value = advance();
      while (offset < length && IDENT_PART.test(source[offset])) {
        value += advance();
      }
      tokens.push({
        type: 'identifier',
        value,
        start,
        end: { line, column, offset },
      });
      continue;
    }

    if (DIGIT.test(char)) {
      let value = advance();
      let hasDot = false;
      while (offset < length) {
        const next = source[offset];
        if (DIGIT.test(next)) {
          value += advance();
          continue;
        }
        if (next === '.' && !hasDot) {
          hasDot = true;
          value += advance();
          continue;
        }
        if (next === '_') {
          value += advance();
          continue;
        }
        break;
      }
      tokens.push({
        type: 'number',
        value,
        start,
        end: { line, column, offset },
      });
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      let value = advance();
      let terminated = false;
      while (offset < length) {
        const next = source[offset];
        value += advance();
        if (next === '\\') {
          if (offset < length) {
            value += advance();
          }
          continue;
        }
        if (next === quote) {
          terminated = true;
          break;
        }
      }
      tokens.push({
        type: 'string',
        value,
        start,
        end: { line, column, offset },
      });
      if (!terminated) {
        break;
      }
      continue;
    }

    if (OPERATORS.has(char)) {
      let value = advance();
      const nextChar = source[offset];
      const compound = `${value}${nextChar ?? ''}`;
      if (COMPOUND_OPERATORS.has(compound)) {
        value += advance();
      }
      tokens.push({
        type: 'operator',
        value,
        start,
        end: { line, column, offset },
      });
      continue;
    }

    const value = advance();
    tokens.push({
      type: 'unknown',
      value,
      start,
      end: { line, column, offset },
    });
  }

  return tokens;
}

export function tokenToString(token: Token): string {
  const { start, end } = token;
  return `${token.type}(${JSON.stringify(token.value)})@${start.line}:${start.column}-${end.line}:${end.column}`;
}
