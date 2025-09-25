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

export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[A-Za-z_][A-Za-z0-9_]*/,
});

export const PlusEqual = createToken({ name: 'PlusEqual', pattern: /\+=/ });
export const MinusEqual = createToken({ name: 'MinusEqual', pattern: /-=/ });
export const StarEqual = createToken({ name: 'StarEqual', pattern: /\*=/ });
export const SlashEqual = createToken({ name: 'SlashEqual', pattern: /\/=/ });
export const PercentEqual = createToken({ name: 'PercentEqual', pattern: /%=/ });
export const ColonEqual = createToken({ name: 'ColonEqual', pattern: /:=/ });
export const Plus = createToken({ name: 'Plus', pattern: /\+/ });
export const Minus = createToken({ name: 'Minus', pattern: /-/ });
export const Star = createToken({ name: 'Star', pattern: /\*/ });
export const Slash = createToken({ name: 'Slash', pattern: /\// });
export const Percent = createToken({ name: 'Percent', pattern: /%/ });
export const LessEqual = createToken({ name: 'LessEqual', pattern: /<=/ });
export const GreaterEqual = createToken({ name: 'GreaterEqual', pattern: />=/ });
export const Less = createToken({ name: 'Less', pattern: /</ });
export const Greater = createToken({ name: 'Greater', pattern: />/ });
export const EqualEqual = createToken({ name: 'EqualEqual', pattern: /==/ });
export const NotEqual = createToken({ name: 'NotEqual', pattern: /!=/ });
export const Equal = createToken({ name: 'Equal', pattern: /=/ });
export const And = createToken({ name: 'And', pattern: /and/, longer_alt: Identifier });
export const Or = createToken({ name: 'Or', pattern: /or/, longer_alt: Identifier });
export const Not = createToken({ name: 'Not', pattern: /not/, longer_alt: Identifier });

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

export const If = createToken({
  name: 'If',
  pattern: /if/,
  longer_alt: Identifier,
});

export const Else = createToken({
  name: 'Else',
  pattern: /else/,
  longer_alt: Identifier,
});

export const While = createToken({
  name: 'While',
  pattern: /while/,
  longer_alt: Identifier,
});

export const Break = createToken({
  name: 'Break',
  pattern: /break/,
  longer_alt: Identifier,
});

export const Continue = createToken({
  name: 'Continue',
  pattern: /continue/,
  longer_alt: Identifier,
});

export const Return = createToken({
  name: 'Return',
  pattern: /return/,
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
  If,
  Else,
  While,
  Break,
  Continue,
  Return,
  True,
  False,
  NaToken,
  LParen,
  RParen,
  Comma,
  Dot,
  LessEqual,
  GreaterEqual,
  EqualEqual,
  NotEqual,
  Less,
  Greater,
  PlusEqual,
  MinusEqual,
  StarEqual,
  SlashEqual,
  PercentEqual,
  ColonEqual,
  Plus,
  Minus,
  Star,
  Slash,
  Percent,
  Equal,
  And,
  Or,
  Not,
  Identifier,
];

export const PineLexer = new Lexer(AllTokens, {
  ensureOptimizations: false,
});
