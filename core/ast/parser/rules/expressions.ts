import { EOF, type IToken } from 'chevrotain';
import type { PineParser } from '../parser';
import {
  type ArgumentNode,
  type BlockStatementNode,
  type ExpressionNode,
  type IfExpressionNode,
  type ParameterNode,
  type TupleExpressionNode,
  type ArrayLiteralNode,
} from '../../nodes';
import {
  And,
  Colon,
  Comma,
  Dot,
  Else,
  Equal,
  EqualEqual,
  False,
  For,
  Greater,
  GreaterEqual,
  Identifier as IdentifierToken,
  If,
  LBracket,
  Less,
  LessEqual,
  Minus,
  NaToken,
  Newline,
  Not,
  NotEqual,
  NullishCoalescing,
  NumberLiteral as NumberToken,
  Or,
  Percent,
  Plus,
  Question,
  RBracket,
  Slash,
  Star,
  StringLiteral as StringToken,
  Switch,
  True,
  While,
  LParen,
  FatArrow,
  RParen,
} from '../tokens';
import {
  createArgumentNode,
  createArrowFunctionExpressionNode,
  createBinaryExpressionNode,
  createBlockStatementNode,
  createBooleanNode,
  createCallExpressionNode,
  createConditionalExpressionNode,
  createIdentifierNode,
  createIfExpressionNode,
  createImplicitReturnStatementNode,
  createIndexExpressionNode,
  createArrayLiteralNode,
  createMatrixLiteralNode,
  createMemberExpressionNode,
  createNullNode,
  createNumberNode,
  createPlaceholderExpression,
  createStringNode,
  createTupleExpressionNode,
  createUnaryExpressionNode,
  tokenIndent,
} from '../node-builders';

function createLiteralFromToken(token: IToken) {
  if (token.tokenType === StringToken) {
    return createStringNode(token);
  }
  if (token.tokenType === NumberToken) {
    return createNumberNode(token);
  }
  if (token.tokenType === True) {
    return createBooleanNode(token, true);
  }
  if (token.tokenType === False) {
    return createBooleanNode(token, false);
  }
  return createNullNode(token);
}

function isArrowFunctionStart(parser: PineParser): boolean {
  if (parser.LA(1).tokenType !== LParen) {
    return false;
  }

  let offset = 1;
  let depth = 0;

  while (true) {
    const lookahead = parser.LA(offset);
    const tokenType = lookahead.tokenType;

    if (tokenType === EOF) {
      return false;
    }

    if (tokenType === LParen) {
      depth += 1;
    } else if (tokenType === RParen) {
      depth -= 1;
      if (depth === 0) {
        offset += 1;
        break;
      }
    }

    offset += 1;
  }

  while (parser.LA(offset).tokenType === Newline) {
    offset += 1;
  }

  return parser.LA(offset).tokenType === FatArrow;
}

export function createArrowFunctionExpressionRule(parser: PineParser) {
  return parser.RULE('arrowFunctionExpression', () => {
    const lParen = parser.CONSUME(LParen);
    let params: ParameterNode[] = [];
    if (parser.LA(1).tokenType !== RParen) {
      params = parser.SUBRULE(parser.parameterList);
    }
    parser.CONSUME(RParen);
    const arrowToken = parser.CONSUME(FatArrow);

    let body: BlockStatementNode;
    let endToken: IToken | undefined = arrowToken;

    if (parser.LA(1).tokenType === Newline) {
      const baseIndent = parser.getLineIndent(arrowToken.startLine ?? lParen.startLine ?? 1);
      body = parser.parseIndentedBlock(baseIndent);
      endToken = parser.LA(0) ?? arrowToken;
    } else {
      const expression = parser.SUBRULE(parser.expression) ?? createPlaceholderExpression();
      endToken = parser.LA(0) ?? arrowToken;
      const returnStatement = createImplicitReturnStatementNode(expression, arrowToken);
      body = createBlockStatementNode([returnStatement], arrowToken, endToken);
    }

    return createArrowFunctionExpressionNode(params, body, lParen, endToken ?? arrowToken);
  });
}

export function createExpressionRule(parser: PineParser) {
  return parser.RULE('expression', () => parser.SUBRULE(parser.conditionalExpression));
}

export function createConditionalExpressionRule(parser: PineParser) {
  return parser.RULE('conditionalExpression', () => {
    const test = parser.SUBRULE(parser.nullishCoalescingExpression);
    if (parser.LA(1).tokenType === Question) {
      const questionToken = parser.CONSUME(Question);
      const consequent = parser.SUBRULE2(parser.expression);
      const colonToken = parser.CONSUME(Colon);
      const alternate = parser.SUBRULE3(parser.expression);
      const endToken = parser.LA(0);
      return createConditionalExpressionNode(
        test,
        consequent,
        alternate,
        questionToken,
        colonToken,
        endToken,
      );
    }
    return test;
  });
}

export function createNullishCoalescingExpressionRule(parser: PineParser) {
  return parser.RULE('nullishCoalescingExpression', () => {
    let expression = parser.SUBRULE(parser.logicalOrExpression);
    parser.MANY(() => {
      const operator = parser.CONSUME(NullishCoalescing);
      const right = parser.SUBRULE2(parser.logicalOrExpression);
      const endToken = parser.LA(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });
}

export function createLogicalOrExpressionRule(parser: PineParser) {
  return parser.RULE('logicalOrExpression', () => {
    let expression = parser.SUBRULE(parser.logicalAndExpression);
    parser.MANY(() => {
      const operator = parser.CONSUME(Or);
      const right = parser.SUBRULE2(parser.logicalAndExpression);
      const endToken = parser.LA(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });
}

export function createLogicalAndExpressionRule(parser: PineParser) {
  return parser.RULE('logicalAndExpression', () => {
    let expression = parser.SUBRULE(parser.equalityExpression);
    parser.MANY(() => {
      const operator = parser.CONSUME(And);
      const right = parser.SUBRULE2(parser.equalityExpression);
      const endToken = parser.LA(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });
}

export function createEqualityExpressionRule(parser: PineParser) {
  return parser.RULE('equalityExpression', () => {
    let expression = parser.SUBRULE(parser.relationalExpression);
    parser.MANY(() => {
      const operator = parser.OR([
        { ALT: () => parser.CONSUME(EqualEqual) },
        { ALT: () => parser.CONSUME(NotEqual) },
      ]);
      const right = parser.SUBRULE2(parser.relationalExpression);
      const endToken = parser.LA(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });
}

export function createRelationalExpressionRule(parser: PineParser) {
  return parser.RULE('relationalExpression', () => {
    let expression = parser.SUBRULE(parser.additiveExpression);
    parser.MANY(() => {
      const operator = parser.OR([
        { ALT: () => parser.CONSUME(LessEqual) },
        { ALT: () => parser.CONSUME(GreaterEqual) },
        { ALT: () => parser.CONSUME(Less) },
        { ALT: () => parser.CONSUME(Greater) },
      ]);
      const right = parser.SUBRULE2(parser.additiveExpression);
      const endToken = parser.LA(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });
}

export function createAdditiveExpressionRule(parser: PineParser) {
  return parser.RULE('additiveExpression', () => {
    let expression = parser.SUBRULE(parser.multiplicativeExpression);
    parser.MANY(() => {
      const operator = parser.OR([
        { ALT: () => parser.CONSUME(Plus) },
        { ALT: () => parser.CONSUME(Minus) },
      ]);
      const right = parser.SUBRULE2(parser.multiplicativeExpression);
      const endToken = parser.LA(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });
}

export function createMultiplicativeExpressionRule(parser: PineParser) {
  return parser.RULE('multiplicativeExpression', () => {
    let expression = parser.SUBRULE(parser.unaryExpression);
    parser.MANY(() => {
      const operator = parser.OR([
        { ALT: () => parser.CONSUME(Star) },
        { ALT: () => parser.CONSUME(Slash) },
        { ALT: () => parser.CONSUME(Percent) },
      ]);
      const right = parser.SUBRULE2(parser.unaryExpression);
      const endToken = parser.LA(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });
}

export function createUnaryExpressionRule(parser: PineParser) {
  return parser.RULE('unaryExpression', () => {
    const lookahead = parser.LA(1).tokenType;
    if (lookahead === Plus) {
      const operator = parser.CONSUME(Plus);
      const argument = parser.SUBRULE(parser.unaryExpression);
      return createUnaryExpressionNode(operator, argument);
    }
    if (lookahead === Minus) {
      const operator = parser.CONSUME(Minus);
      const argument = parser.SUBRULE(parser.unaryExpression);
      return createUnaryExpressionNode(operator, argument);
    }
    if (lookahead === Not) {
      const operator = parser.CONSUME(Not);
      const argument = parser.SUBRULE(parser.unaryExpression);
      return createUnaryExpressionNode(operator, argument);
    }

    return parser.SUBRULE(parser.callExpression);
  });
}

export function createCallExpressionRule(parser: PineParser) {
  return parser.RULE('callExpression', () => {
    let expression = parser.SUBRULE(parser.primaryExpression) ?? createPlaceholderExpression();

    parser.MANY(() => {
      parser.OR([
        {
          ALT: () => {
            parser.CONSUME(LParen);
            let args: ArgumentNode[] = [];
            if (parser.LA(1).tokenType !== RParen) {
              args = parser.SUBRULE(parser.argumentList);
            }
            const rParen = parser.CONSUME(RParen);
            expression = createCallExpressionNode(expression, args, rParen);
          },
        },
        {
          ALT: () => {
            parser.CONSUME(Dot);
            const propertyToken = parser.CONSUME(IdentifierToken);
            const property = createIdentifierNode(propertyToken);
            expression = createMemberExpressionNode(expression, property, propertyToken);
          },
        },
        {
          ALT: () => {
            const lBracket = parser.CONSUME(LBracket);
            let indexExpression: ExpressionNode | undefined;
            if (parser.LA(1).tokenType !== RBracket) {
              indexExpression = parser.SUBRULE2(parser.expression);
            }
            const rBracket = parser.CONSUME(RBracket);
            expression = createIndexExpressionNode(expression, indexExpression, rBracket ?? lBracket);
          },
        },
      ]);
    });

    return expression;
  });
}

export function createMemberExpressionRule(parser: PineParser) {
  return parser.RULE('memberExpression', () => {
    let expression = parser.SUBRULE(parser.primaryExpression) ?? createPlaceholderExpression();
    parser.MANY(() => {
      parser.OR([
        {
          ALT: () => {
            parser.CONSUME(Dot);
            const propertyToken = parser.CONSUME(IdentifierToken);
            const property = createIdentifierNode(propertyToken);
            expression = createMemberExpressionNode(expression, property, propertyToken);
          },
        },
        {
          ALT: () => {
            const lBracket = parser.CONSUME(LBracket);
            let indexExpression: ExpressionNode | undefined;
            if (parser.LA(1).tokenType !== RBracket) {
              indexExpression = parser.SUBRULE2(parser.expression);
            }
            const rBracket = parser.CONSUME(RBracket);
            expression = createIndexExpressionNode(expression, indexExpression, rBracket ?? lBracket);
          },
        },
      ]);
    });
    return expression;
  });
}

export function createArgumentListRule(parser: PineParser) {
  return parser.RULE('argumentList', (): ArgumentNode[] => {
    const args: ArgumentNode[] = [];

    args.push(parser.SUBRULE(parser.argument));

    parser.MANY(() => {
      parser.CONSUME(Comma);
      args.push(parser.SUBRULE2(parser.argument));
    });

    return args;
  });
}

export function createArgumentRule(parser: PineParser) {
  return parser.RULE('argument', () => {
    const lookahead = parser.LA(1);
    if (lookahead.tokenType === IdentifierToken && parser.LA(2).tokenType === Equal) {
      const nameToken = parser.CONSUME(IdentifierToken);
      parser.CONSUME(Equal);
      const value = parser.SUBRULE(parser.expression);
      const name = createIdentifierNode(nameToken);
      const endToken = parser.LA(0);
      return createArgumentNode(name, value, nameToken, endToken);
    }

    const start = parser.LA(1);
    const value = parser.SUBRULE2(parser.expression);
    const end = parser.LA(0);
    return createArgumentNode(null, value, start, end);
  });
}

export function createBracketExpressionRule(parser: PineParser) {
  return parser.RULE('bracketExpression', (mode: 'expression' | 'tuple' = 'expression'): ExpressionNode => {
    const lBracket = parser.CONSUME(LBracket);
    const elements: (ExpressionNode | null)[] = [];
    let expectElement = true;
    let hasParsedElement = false;

    while (true) {
      const next = parser.LA(1);
      const tokenType = next.tokenType;

      if (tokenType === RBracket || tokenType === EOF) {
        break;
      }

      if (tokenType === Newline) {
        parser.CONSUME(Newline);
        continue;
      }

      if (tokenType === Comma) {
        parser.CONSUME(Comma);
        if (expectElement) {
          elements.push(null);
        }
        expectElement = true;
        continue;
      }

      let element: ExpressionNode | undefined;
      if (!hasParsedElement) {
        element = parser.SUBRULE(parser.expression);
        hasParsedElement = true;
      } else {
        element = parser.SUBRULE2(parser.expression);
      }
      elements.push(element);
      expectElement = false;

      if (parser.LA(1).tokenType === Comma) {
        parser.CONSUME(Comma);
        expectElement = true;
      } else {
        expectElement = false;
        break;
      }
    }

    if (expectElement && elements.length > 0 && parser.LA(1).tokenType === RBracket) {
      elements.push(null);
    }

    const rBracket = parser.CONSUME(RBracket);

    const tuple = createTupleExpressionNode(elements, lBracket, rBracket);
    if (mode === 'tuple') {
      return tuple;
    }

    const hasNull = elements.some((element) => element === null);

    if (!hasNull) {
      const rowCandidates = elements.filter(
        (element): element is TupleExpressionNode | ArrayLiteralNode =>
          element?.kind === 'TupleExpression' || element?.kind === 'ArrayLiteral',
      );
      if (
        rowCandidates.length === elements.length &&
        rowCandidates.every((row) =>
          row.elements.every((child) => child !== null),
        )
      ) {
        const rows = rowCandidates.map((row) =>
          row.elements.map((child) => child ?? createPlaceholderExpression()),
        );
        return createMatrixLiteralNode(rows, lBracket, rBracket);
      }
    }

    return createArrayLiteralNode(elements, lBracket, rBracket);
  });
}

export function createPrimaryExpressionRule(parser: PineParser) {
  return parser.RULE('primaryExpression', (): ExpressionNode => {
    const token = parser.LA(1);
    switch (token.tokenType) {
      case IdentifierToken:
        return parser.SUBRULE(parser.identifierExpression);
      case StringToken:
        return createLiteralFromToken(parser.CONSUME(StringToken));
      case NumberToken:
        return createLiteralFromToken(parser.CONSUME(NumberToken));
      case True:
        return createLiteralFromToken(parser.CONSUME(True));
      case False:
        return createLiteralFromToken(parser.CONSUME(False));
      case NaToken:
        return createLiteralFromToken(parser.CONSUME(NaToken));
      case Switch:
        return parser.SUBRULE(parser.switchExpression);
      case If:
        return parser.SUBRULE(parser.ifExpression);
      case For:
        return parser.SUBRULE(parser.forExpression);
      case While:
        return parser.SUBRULE(parser.whileExpression);
      case LBracket:
        return parser.SUBRULE(parser.bracketExpression);
      case LParen: {
        if (isArrowFunctionStart(parser)) {
          return parser.SUBRULE(parser.arrowFunctionExpression);
        }
        parser.CONSUME(LParen);
        const expression = parser.SUBRULE(parser.expression);
        parser.CONSUME(RParen);
        return expression ?? createPlaceholderExpression();
      }
      default:
        return createIdentifierNode(parser.CONSUME(IdentifierToken));
    }
  });
}

export function createIdentifierExpressionRule(parser: PineParser) {
  return parser.RULE('identifierExpression', () => {
    const first = parser.CONSUME(IdentifierToken);
    let expression: ExpressionNode = createIdentifierNode(first);

    parser.MANY(() => {
      parser.CONSUME(Dot);
      const propertyToken = parser.CONSUME2(IdentifierToken);
      const property = createIdentifierNode(propertyToken);
      expression = createMemberExpressionNode(expression, property, propertyToken);
    });

    return expression;
  });
}

export function createIfExpressionRule(parser: PineParser) {
  return parser.RULE('ifExpression', (baseIndentOverride?: number) => {
    const ifToken = parser.CONSUME(If);
    const test = parser.SUBRULE(parser.expression) ?? createPlaceholderExpression();
    const baseIndent = baseIndentOverride ?? parser.getLineIndent(ifToken.startLine ?? 1);
    const consequent = parser.parseIfExpressionBranch(baseIndent);

    let alternate: IfExpressionNode | BlockStatementNode | null = null;

    let offset = 1;
    while (parser.LA(offset).tokenType === Newline) {
      offset += 1;
    }
    const potentialElse = parser.LA(offset);
    if (potentialElse.tokenType === Else && tokenIndent(potentialElse) <= baseIndent) {
      while (parser.LA(1).tokenType === Newline) {
        parser.CONSUME(Newline);
      }
      parser.CONSUME(Else);

      if (parser.LA(1).tokenType === If) {
        alternate = parser.SUBRULE2(parser.ifExpression, { ARGS: [baseIndent] });
      } else {
        alternate = parser.parseIfExpressionBranch(baseIndent);
      }
    }

    const endToken = parser.LA(0);
    return createIfExpressionNode(test, consequent, alternate, ifToken, endToken);
  });
}

export function createForExpressionRule(parser: PineParser) {
  return parser.RULE('forExpression', () => {
    const forToken = parser.CONSUME(For);
    return parser.parseForLoop(forToken);
  });
}

export function createWhileExpressionRule(parser: PineParser) {
  return parser.RULE('whileExpression', () => {
    const whileToken = parser.CONSUME(While);
    return parser.parseWhileLoop(whileToken);
  });
}

export function createSwitchExpressionRule(parser: PineParser) {
  return parser.RULE('switchExpression', () => {
    const switchToken = parser.CONSUME(Switch);
    return parser.parseSwitchStructure(switchToken);
  });
}
