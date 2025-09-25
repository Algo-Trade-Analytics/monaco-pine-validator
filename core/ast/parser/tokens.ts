import { createToken, Lexer } from 'chevrotain';

export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /[\t\f\r ]+/, // skip horizontal whitespace
  group: Lexer.SKIPPED,
});

export const Newline = createToken({
  name: 'Newline',
  pattern: /\n+/, // preserve newlines to help with statement separation
  line_breaks: true,
});

export const VersionDirective = createToken({
  name: 'VersionDirective',
  // Matches //@version=5 style directives. We intentionally keep this token
  // distinct from general comments so the parser can promote it to a dedicated
  // AST node without re-tokenising.
  pattern: /\/\/\s*@version\s*=\s*\d+/, 
});

export const LineComment = createToken({
  name: 'LineComment',
  pattern: /\/\/(?!\s*@version\b)[^\n]*/,
  group: Lexer.SKIPPED,
});

export const LParen = createToken({ name: 'LParen', pattern: /\(/ });
export const RParen = createToken({ name: 'RParen', pattern: /\)/ });
export const Comma = createToken({ name: 'Comma', pattern: /,/ });
export const Dot = createToken({ name: 'Dot', pattern: /\./ });
export const Equal = createToken({ name: 'Equal', pattern: /=/ });

export const StringLiteral = createToken({
  name: 'StringLiteral',
  // Handles both single and double quoted strings with standard escape support.
  pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/,
  line_breaks: true,
});

export const NumberLiteral = createToken({
  name: 'NumberLiteral',
  // Pine numeric literals follow standard decimal syntax with optional fraction.
  pattern: /\d+(?:_?\d)*(?:\.\d+(?:_?\d)*)?/,
});

export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[A-Za-z_][A-Za-z0-9_]*/,
});

export const True = createToken({ name: 'True', pattern: /true/, longer_alt: Identifier });
export const False = createToken({ name: 'False', pattern: /false/, longer_alt: Identifier });
export const NaToken = createToken({ name: 'NaToken', pattern: /na/, longer_alt: Identifier });

export const Indicator = createToken({
  name: 'Indicator',
  pattern: /indicator/,
  longer_alt: Identifier,
});

export const Strategy = createToken({
  name: 'Strategy',
  pattern: /strategy/,
  longer_alt: Identifier,
});

export const Library = createToken({
  name: 'Library',
  pattern: /library/,
  longer_alt: Identifier,
});

export const AllTokens = [
  WhiteSpace,
  Newline,
  VersionDirective,
  LineComment,
  StringLiteral,
  NumberLiteral,
  Indicator,
  Strategy,
  Library,
  True,
  False,
  NaToken,
  LParen,
  RParen,
  Comma,
  Dot,
  Equal,
  Identifier,
];

export const PineLexer = new Lexer(AllTokens, {
  ensureOptimizations: false,
});
