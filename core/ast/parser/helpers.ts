import { EOF, type IToken } from 'chevrotain';

import {
  type BlockStatementNode,
  type CompilerAnnotationNode,
  type ExpressionNode,
  type LoopResultBinding,
  type StatementNode,
} from '../nodes';
import {
  createBlockStatementNode,
  createCompilerAnnotationNode,
  createExpressionStatementNode,
  createPlaceholderExpression,
  tokenIndent,
} from './node-builders';
import {
  attachCompilerAnnotations,
  isDeclarationKeywordToken,
  isExportKeywordToken,
  isFunctionModifierToken,
} from './parser-utils';
import {
  ColonEqual,
  Comma,
  CompilerAnnotation,
  Dot,
  Equal,
  FatArrow,
  Greater,
  Identifier as IdentifierToken,
  LBracket,
  Less,
  LParen,
  MinusEqual,
  Newline,
  PercentEqual,
  PlusEqual,
  RBracket,
  RParen,
  SlashEqual,
  StarEqual,
} from './tokens';
import type { PineParser } from './parser';

export function createNextSignificantTokenHelper(parser: PineParser) {
  return (startOffset: number): IToken => {
    let offset = startOffset;
    while (true) {
      const token = parser.LA(offset);
      if (token.tokenType === EOF) {
        return token;
      }
      if (token.tokenType !== Newline && token.tokenType !== CompilerAnnotation) {
        return token;
      }
      offset += 1;
    }
  };
}

export function createGetLineIndentHelper(
  parser: PineParser,
  lineIndentCache: Map<number, number>,
) {
  return (line: number): number => {
    if (lineIndentCache.has(line)) {
      return lineIndentCache.get(line) ?? 0;
    }

    let indent: number | undefined;
    for (const token of parser.input) {
      if ((token.startLine ?? 0) !== line) {
        continue;
      }
      if (token.tokenType === Newline) {
        continue;
      }
      const startColumn = token.startColumn ?? 1;
      const tokenIndentValue = Math.max(0, startColumn - 1);
      if (indent === undefined || tokenIndentValue < indent) {
        indent = tokenIndentValue;
        if (indent === 0) {
          break;
        }
      }
    }

    const result = indent ?? 0;
    lineIndentCache.set(line, result);
    return result;
  };
}

export function createParseIfExpressionBranchHelper(parser: PineParser) {
  return (baseIndent: number): BlockStatementNode => {
    if (parser.LA(1).tokenType === Newline) {
      return parser.parseIndentedBlock(baseIndent);
    }

    const startToken = parser.LA(1);
    const value = parser.SUBRULE(parser.expression) ?? createPlaceholderExpression();
    const endToken = parser.LA(0);
    const statement = createExpressionStatementNode(value);
    return createBlockStatementNode([statement], startToken, endToken);
  };
}

export function createCollectDeclarationTokensHelper(parser: PineParser) {
  return (startOffset: number): { tokens: IToken[]; terminator: IToken } | null => {
    const tokens: IToken[] = [];
    let offset = startOffset;

    while (true) {
      const token = parser.LA(offset);
      const tokenType = token.tokenType;

      if (tokenType === EOF || tokenType === Newline || tokenType === Equal || tokenType === ColonEqual) {
        return { tokens, terminator: token };
      }

      if (
        tokenType === IdentifierToken ||
        tokenType === Less ||
        tokenType === Greater ||
        tokenType === Comma
      ) {
        tokens.push(token);
        offset += 1;
        continue;
      }

      return null;
    }
  };
}

export function createCollectFunctionHeadTokensHelper(parser: PineParser) {
  return (startOffset: number): { tokens: IToken[]; lParenOffset: number } | null => {
    const tokens: IToken[] = [];
    let offset = startOffset;

    while (true) {
      const token = parser.LA(offset);
      const tokenType = token.tokenType;

      if (tokenType === LParen) {
        return { tokens, lParenOffset: offset };
      }

      if (
        tokenType === IdentifierToken ||
        tokenType === Less ||
        tokenType === Greater ||
        tokenType === Comma ||
        tokenType === Dot
      ) {
        tokens.push(token);
        offset += 1;
        continue;
      }

      if (tokenType === EOF || tokenType === Newline) {
        return null;
      }

      return null;
    }
  };
}

export function createCollectParameterTokensHelper(parser: PineParser) {
  return (startOffset: number): IToken[] => {
    const tokens: IToken[] = [];
    let offset = startOffset;
    let genericDepth = 0;

    while (true) {
      const token = parser.LA(offset);
      const tokenType = token.tokenType;

      if (tokenType === EOF) {
        return tokens;
      }

      if (tokenType === Less) {
        genericDepth += 1;
      } else if (tokenType === Greater && genericDepth > 0) {
        genericDepth -= 1;
      }

      if (genericDepth === 0 && (tokenType === Equal || tokenType === Comma || tokenType === RParen)) {
        return tokens;
      }

      if (
        tokenType === IdentifierToken ||
        tokenType === Less ||
        tokenType === Greater ||
        tokenType === Comma ||
        tokenType === Dot
      ) {
        tokens.push(token);
        offset += 1;
        continue;
      }

      return tokens;
    }
  };
}

export function createFunctionDeclarationStartGuard(parser: PineParser) {
  return (): boolean => {
    let offset = 1;

    if (isExportKeywordToken(parser.LA(offset))) {
      offset += 1;
    }

    while (isFunctionModifierToken(parser.LA(offset))) {
      offset += 1;
    }

    const collected = parser.collectFunctionHeadTokens(offset);
    if (!collected || collected.tokens.length === 0) {
      return false;
    }

    let scanOffset = collected.lParenOffset;
    let depth = 0;

    while (true) {
      const token = parser.LA(scanOffset);
      const tokenType = token.tokenType;

      if (tokenType === EOF) {
        return false;
      }

      if (tokenType === LParen) {
        depth += 1;
      } else if (tokenType === RParen) {
        depth -= 1;
        if (depth === 0) {
          scanOffset += 1;
          break;
        }
      }

      if (tokenType === Newline && depth === 0) {
        return false;
      }

      scanOffset += 1;
    }

    while (parser.LA(scanOffset).tokenType === Newline) {
      scanOffset += 1;
    }

    return parser.LA(scanOffset).tokenType === FatArrow;
  };
}

export function createVariableDeclarationStartGuard(parser: PineParser) {
  return (): boolean => {
    const first = parser.LA(1);

    if (isDeclarationKeywordToken(first)) {
      const collected = parser.collectDeclarationTokens(2);
      if (!collected) {
        return false;
      }

      const identifierCount = collected.tokens.filter((token) => token.tokenType === IdentifierToken).length;
      if (identifierCount === 0) {
        return false;
      }

      const terminatorType = collected.terminator.tokenType;
      return (
        terminatorType === Equal ||
        terminatorType === ColonEqual ||
        terminatorType === Newline ||
        terminatorType === EOF
      );
    }

    const collected = parser.collectDeclarationTokens(1);
    if (!collected) {
      return false;
    }

    const terminatorType = collected.terminator.tokenType;
    if (terminatorType !== Equal && terminatorType !== ColonEqual) {
      return false;
    }

    const identifierCount = collected.tokens.filter((token) => token.tokenType === IdentifierToken).length;
    return identifierCount >= 2;
  };
}

export function createTupleAssignmentStartGuard(parser: PineParser) {
  return (): boolean => {
    if (parser.LA(1).tokenType !== LBracket) {
      return false;
    }

    let offset = 2;
    let depth = 1;

    while (depth > 0) {
      const token = parser.LA(offset);
      const tokenType = token.tokenType;

      if (tokenType === LBracket) {
        depth += 1;
      } else if (tokenType === RBracket) {
        depth -= 1;
      } else if (tokenType === EOF) {
        return false;
      }

      offset += 1;
    }

    while (parser.LA(offset).tokenType === Newline) {
      offset += 1;
    }

    const terminator = parser.LA(offset).tokenType;
    return (
      terminator === Equal ||
      terminator === ColonEqual ||
      terminator === PlusEqual ||
      terminator === MinusEqual ||
      terminator === StarEqual ||
      terminator === SlashEqual ||
      terminator === PercentEqual
    );
  };
}

export function createAssignmentStartGuard(parser: PineParser) {
  return (): boolean => {
    const first = parser.LA(1);
    if (first.tokenType === LBracket) {
      let offset = 2;
      let depth = 1;
      while (depth > 0) {
        const token = parser.LA(offset);
        const tokenType = token.tokenType;

        if (tokenType === LBracket) {
          depth += 1;
        } else if (tokenType === RBracket) {
          depth -= 1;
        } else if (tokenType === EOF) {
          return false;
        }

        offset += 1;
      }

      while (parser.LA(offset).tokenType === Newline) {
        offset += 1;
      }

      const terminator = parser.LA(offset).tokenType;
      return (
        terminator === Equal ||
        terminator === ColonEqual ||
        terminator === PlusEqual ||
        terminator === MinusEqual ||
        terminator === StarEqual ||
        terminator === SlashEqual ||
        terminator === PercentEqual
      );
    }

    if (first.tokenType !== IdentifierToken) {
      return false;
    }

    let offset = 2;
    while (true) {
      const token = parser.LA(offset);
      const tokenType = token.tokenType;

      if (
        tokenType === Equal ||
        tokenType === ColonEqual ||
        tokenType === PlusEqual ||
        tokenType === MinusEqual ||
        tokenType === StarEqual ||
        tokenType === SlashEqual ||
        tokenType === PercentEqual
      ) {
        return true;
      }

      if (tokenType === Dot) {
        offset += 1;
        const next = parser.LA(offset);
        if (next.tokenType !== IdentifierToken) {
          return false;
        }
        offset += 1;
        continue;
      }

      if (tokenType === LBracket) {
        offset += 1;
        let bracketDepth = 1;
        while (bracketDepth > 0) {
          const inner = parser.LA(offset);
          const innerType = inner.tokenType;

          if (innerType === LBracket) {
            bracketDepth += 1;
          } else if (innerType === RBracket) {
            bracketDepth -= 1;
          } else if (innerType === EOF || innerType === Newline) {
            return false;
          }

          offset += 1;
        }
        continue;
      }

      if (tokenType === Newline || tokenType === LParen || tokenType === Comma || tokenType === RParen) {
        return false;
      }

      if (tokenType === EOF) {
        return false;
      }

      return false;
    }
  };
}

export function createParseIndentedBlockHelper(parser: PineParser) {
  return (indent: number): BlockStatementNode => {
    const statements: StatementNode[] = [];
    let blockStartToken: IToken | undefined;
    let firstStatementToken: IToken | undefined;
    let lastToken: IToken | undefined;

    if (parser.LA(1).tokenType === Newline) {
      const newlineToken = parser.CONSUME(Newline);
      blockStartToken = blockStartToken ?? newlineToken;
      lastToken = newlineToken;
    }

    let shouldBreak = false;
    while (!shouldBreak) {
      let next = parser.LA(1);
      while (next.tokenType === Newline) {
        let lookaheadOffset = 2;
        let lookahead = parser.LA(lookaheadOffset);
        while (lookahead.tokenType === Newline) {
          lookaheadOffset += 1;
          lookahead = parser.LA(lookaheadOffset);
        }

        if (lookahead.tokenType === EOF) {
          const newlineToken = parser.CONSUME(Newline);
          lastToken = newlineToken;
          next = parser.LA(1);
          continue;
        }

        if (tokenIndent(lookahead) <= indent) {
          shouldBreak = true;
          break;
        }

        const newlineToken = parser.CONSUME(Newline);
        lastToken = newlineToken;
        next = parser.LA(1);
      }

      if (shouldBreak) {
        break;
      }

      const annotations: CompilerAnnotationNode[] = [];
      while (parser.LA(1).tokenType === CompilerAnnotation) {
        const annotationToken = parser.CONSUME(CompilerAnnotation);
        annotations.push(createCompilerAnnotationNode(annotationToken));
        lastToken = annotationToken;

        while (parser.LA(1).tokenType === Newline) {
          const newlineToken = parser.CONSUME(Newline);
          lastToken = newlineToken;
          const lookahead = parser.LA(1);
          if (lookahead.tokenType === EOF || tokenIndent(lookahead) <= indent) {
            shouldBreak = true;
            break;
          }
        }

        if (shouldBreak) {
          break;
        }
      }

      if (shouldBreak) {
        break;
      }

      next = parser.LA(1);
      if (next.tokenType === EOF || tokenIndent(next) <= indent) {
        break;
      }

      const statementStartToken = parser.LA(1);
      const statement = parser.SUBRULE(parser.statement);
      statements.push(statement);
      firstStatementToken = firstStatementToken ?? statementStartToken;
      lastToken = parser.LA(0);
      attachCompilerAnnotations(statement, annotations);
    }

    return createBlockStatementNode(
      statements,
      blockStartToken ?? firstStatementToken,
      lastToken ?? blockStartToken ?? firstStatementToken,
    );
  };
}

export function attachLoopResultBinding(
  expression: ExpressionNode | null | undefined,
  binding: LoopResultBinding,
): void {
  if (!expression) {
    return;
  }

  switch (expression.kind) {
    case 'ForStatement':
    case 'WhileStatement':
    case 'SwitchStatement':
      expression.resultBinding = binding;
      break;
    default:
      break;
  }
}
