import type { StatementNode } from '../../nodes';
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
  return parser.createRule('statement', (): StatementNode => {
    return parser.choose<StatementNode>([
      {
        GATE: () => {
          const first = parser.lookAhead(1);
          const tokenType = first.tokenType;
          if (tokenType !== Indicator && tokenType !== Strategy && tokenType !== Library) {
            return false;
          }
          const next = parser.nextSignificantToken(2);
          return next.tokenType === LParen;
        },
        ALT: () => parser.invokeSubrule(parser.scriptDeclaration),
      },
      {
        GATE: () => {
          if (!isExportKeywordToken(parser.lookAhead(1))) {
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
          const exportToken = parser.consumeToken(IdentifierToken);
          parser.repeatMany(() => parser.consumeToken(Newline));
          if (parser.lookAhead(1).tokenType === Type || isTokenKeyword(parser.lookAhead(1), 'type')) {
            return parser.invokeSubrule(parser.typeDeclaration, 1, { ARGS: [exportToken] });
          }
          if (parser.lookAhead(1).tokenType === Enum || isTokenKeyword(parser.lookAhead(1), 'enum')) {
            return parser.invokeSubrule(parser.enumDeclaration, 1, { ARGS: [exportToken] });
          }
          return parser.invokeSubrule(parser.functionDeclaration, 1, { ARGS: [exportToken] });
        },
      },
      {
        GATE: () => parser.lookAhead(1).tokenType === Import,
        ALT: () => parser.invokeSubrule(parser.importDeclaration),
      },
      {
        GATE: () => parser.lookAhead(1).tokenType === Enum,
        ALT: () => parser.invokeSubrule(parser.enumDeclaration),
      },
      {
        GATE: () => parser.lookAhead(1).tokenType === Type,
        ALT: () => parser.invokeSubrule(parser.typeDeclaration),
      },
      {
        GATE: () => parser.isFunctionDeclarationStart(),
        ALT: () => parser.invokeSubrule(parser.functionDeclaration),
      },
      {
        GATE: () => parser.lookAhead(1).tokenType === If,
        ALT: () => parser.invokeSubrule(parser.ifStatement),
      },
      {
        GATE: () => {
          if (parser.lookAhead(1).tokenType !== Repeat) {
            return false;
          }
          const next = parser.lookAhead(2);
          return next.tokenType === Newline;
        },
        ALT: () => parser.invokeSubrule(parser.repeatStatement),
      },
      {
        GATE: () => parser.lookAhead(1).tokenType === For,
        ALT: () => parser.invokeSubrule(parser.forStatement),
      },
      {
        GATE: () => parser.lookAhead(1).tokenType === While,
        ALT: () => parser.invokeSubrule(parser.whileStatement),
      },
      {
        GATE: () => parser.lookAhead(1).tokenType === Switch,
        ALT: () => parser.invokeSubrule(parser.switchStatement),
      },
      {
        GATE: () => parser.lookAhead(1).tokenType === Return,
        ALT: () => parser.invokeSubrule(parser.returnStatement),
      },
      {
        GATE: () => parser.lookAhead(1).tokenType === Break,
        ALT: () => parser.invokeSubrule(parser.breakStatement),
      },
      {
        GATE: () => parser.lookAhead(1).tokenType === Continue,
        ALT: () => parser.invokeSubrule(parser.continueStatement),
      },
      {
        GATE: () => parser.isVariableDeclarationStart(),
        ALT: () => parser.invokeSubrule(parser.variableDeclaration),
      },
      {
        GATE: () => parser.lookAhead(1).tokenType === LBracket && parser.isTupleAssignmentStart(),
        ALT: () => parser.invokeSubrule(parser.tupleAssignmentStatement),
      },
      {
        GATE: () => parser.isAssignmentStart(),
        ALT: () => parser.invokeSubrule(parser.assignmentStatement),
      },
      { ALT: () => parser.invokeSubrule(parser.expressionStatement) },
    ]);
  });
}
