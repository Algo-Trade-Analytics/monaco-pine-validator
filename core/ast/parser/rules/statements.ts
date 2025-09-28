import type { PineParser } from '../parser';
import {
  Enum,
  For,
  If,
  Import,
  LParen,
  LBracket,
  Repeat,
  Return,
  Switch,
  Type,
  While,
  Break,
  Continue,
  Newline,
  Indicator,
  Strategy,
  Library,
  Identifier as IdentifierToken,
} from '../tokens';
import { isExportKeywordToken, isTokenKeyword } from '../parser-utils';

export function createStatementRule(parser: PineParser) {
  return parser.RULE('statement', () => {
    return parser.OR([
      {
        GATE: () => {
          const first = parser.LA(1);
          const tokenType = first.tokenType;
          if (tokenType !== Indicator && tokenType !== Strategy && tokenType !== Library) {
            return false;
          }
          const next = parser.nextSignificantToken(2);
          return next.tokenType === LParen;
        },
        ALT: () => parser.SUBRULE(parser.scriptDeclaration),
      },
      {
        GATE: () => {
          if (!isExportKeywordToken(parser.LA(1))) {
            return false;
          }
          const next = parser.nextSignificantToken(2);
          return (
            next.tokenType === Type ||
            next.tokenType === Enum ||
            isTokenKeyword(next, 'type') ||
            isTokenKeyword(next, 'enum') ||
            parser.isFunctionDeclarationStart()
          );
        },
        ALT: () => {
          const exportToken = parser.CONSUME(IdentifierToken);
          parser.MANY(() => parser.CONSUME(Newline));
          if (parser.LA(1).tokenType === Type || isTokenKeyword(parser.LA(1), 'type')) {
            return parser.SUBRULE(parser.typeDeclaration, { ARGS: [exportToken] });
          }
          if (parser.LA(1).tokenType === Enum || isTokenKeyword(parser.LA(1), 'enum')) {
            return parser.SUBRULE(parser.enumDeclaration, { ARGS: [exportToken] });
          }
          return parser.SUBRULE(parser.functionDeclaration, { ARGS: [exportToken] });
        },
      },
      {
        GATE: () => parser.LA(1).tokenType === Import,
        ALT: () => parser.SUBRULE(parser.importDeclaration),
      },
      {
        GATE: () => parser.LA(1).tokenType === Enum,
        ALT: () => parser.SUBRULE(parser.enumDeclaration),
      },
      {
        GATE: () => parser.LA(1).tokenType === Type,
        ALT: () => parser.SUBRULE(parser.typeDeclaration),
      },
      {
        GATE: () => parser.isFunctionDeclarationStart(),
        ALT: () => parser.SUBRULE(parser.functionDeclaration),
      },
      {
        GATE: () => parser.LA(1).tokenType === If,
        ALT: () => parser.SUBRULE(parser.ifStatement),
      },
      {
        GATE: () => {
          if (parser.LA(1).tokenType !== Repeat) {
            return false;
          }
          const next = parser.LA(2);
          return next.tokenType === Newline;
        },
        ALT: () => parser.SUBRULE(parser.repeatStatement),
      },
      {
        GATE: () => parser.LA(1).tokenType === For,
        ALT: () => parser.SUBRULE(parser.forStatement),
      },
      {
        GATE: () => parser.LA(1).tokenType === While,
        ALT: () => parser.SUBRULE(parser.whileStatement),
      },
      {
        GATE: () => parser.LA(1).tokenType === Switch,
        ALT: () => parser.SUBRULE(parser.switchStatement),
      },
      {
        GATE: () => parser.LA(1).tokenType === Return,
        ALT: () => parser.SUBRULE(parser.returnStatement),
      },
      {
        GATE: () => parser.LA(1).tokenType === Break,
        ALT: () => parser.SUBRULE(parser.breakStatement),
      },
      {
        GATE: () => parser.LA(1).tokenType === Continue,
        ALT: () => parser.SUBRULE(parser.continueStatement),
      },
      {
        GATE: () => parser.isVariableDeclarationStart(),
        ALT: () => parser.SUBRULE(parser.variableDeclaration),
      },
      {
        GATE: () => parser.LA(1).tokenType === LBracket && parser.isTupleAssignmentStart(),
        ALT: () => parser.SUBRULE(parser.tupleAssignmentStatement),
      },
      {
        GATE: () => parser.isAssignmentStart(),
        ALT: () => parser.SUBRULE(parser.assignmentStatement),
      },
      { ALT: () => parser.SUBRULE(parser.expressionStatement) },
    ]);
  });
}
