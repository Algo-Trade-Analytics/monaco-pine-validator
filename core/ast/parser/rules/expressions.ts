import { EOF, type IToken } from 'chevrotain';
import type { PineParser } from '../parser';
import { isIdentifierLikeToken } from '../parser-utils';
import {
  type ArgumentNode,
  type BlockStatementNode,
  type ExpressionNode,
  type IfExpressionNode,
  type ParameterNode,
  type TupleExpressionNode,
  type ArrayLiteralNode,
  type TypeReferenceNode,
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
  buildTypeReferenceFromTokens,
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
  if (parser.lookAhead(1).tokenType !== LParen) {
    return false;
  }

  let offset = 1;
  let depth = 0;

  while (true) {
    const lookahead = parser.lookAhead(offset);
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

  while (parser.lookAhead(offset).tokenType === Newline) {
    offset += 1;
  }

  return parser.lookAhead(offset).tokenType === FatArrow;
}

export function createArrowFunctionExpressionRule(parser: PineParser) {
  return parser.createRule('arrowFunctionExpression', () => {
    const lParen = parser.consumeToken(LParen);
    let params: ParameterNode[] = [];
    if (parser.lookAhead(1).tokenType !== RParen) {
      params = parser.invokeSubrule(parser.parameterList);
    }
    parser.consumeToken(RParen);
    const arrowToken = parser.consumeToken(FatArrow);

    let body: BlockStatementNode;
    let endToken: IToken | undefined = arrowToken;

    if (parser.lookAhead(1).tokenType === Newline) {
      const baseIndent = parser.getLineIndent(arrowToken.startLine ?? lParen.startLine ?? 1);
      body = parser.parseIndentedBlock(baseIndent);
      endToken = parser.lookAhead(0) ?? arrowToken;
    } else {
      const expression = parser.invokeSubrule(parser.expression) ?? createPlaceholderExpression();
      endToken = parser.lookAhead(0) ?? arrowToken;
      const returnStatement = createImplicitReturnStatementNode(expression, arrowToken);
      body = createBlockStatementNode([returnStatement], arrowToken, endToken);
    }

    return createArrowFunctionExpressionNode(params, body, lParen, endToken ?? arrowToken);
  });
}

export function createExpressionRule(parser: PineParser) {
  return parser.createRule('expression', () => parser.invokeSubrule(parser.conditionalExpression));
}

export function createConditionalExpressionRule(parser: PineParser) {
  return parser.createRule('conditionalExpression', () => {
    const test = parser.invokeSubrule(parser.nullishCoalescingExpression);
    if (parser.lookAhead(1).tokenType === Question) {
      const questionToken = parser.consumeToken(Question);
      const consequent = parser.invokeSubrule(parser.expression, 2);
      const colonToken = parser.consumeToken(Colon);
      const alternate = parser.invokeSubrule(parser.expression, 3);
      const endToken = parser.lookAhead(0);
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
  return parser.createRule('nullishCoalescingExpression', () => {
    let expression = parser.invokeSubrule(parser.logicalOrExpression);
    parser.repeatMany(() => {
      const operator = parser.consumeToken(NullishCoalescing);
      const right = parser.invokeSubrule(parser.logicalOrExpression, 2);
      const endToken = parser.lookAhead(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });
}

export function createLogicalOrExpressionRule(parser: PineParser) {
  return parser.createRule('logicalOrExpression', () => {
    let expression = parser.invokeSubrule(parser.logicalAndExpression);
    parser.repeatMany(() => {
      const operator = parser.consumeToken(Or);
      const right = parser.invokeSubrule(parser.logicalAndExpression, 2);
      const endToken = parser.lookAhead(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });
}

export function createLogicalAndExpressionRule(parser: PineParser) {
  return parser.createRule('logicalAndExpression', () => {
    let expression = parser.invokeSubrule(parser.equalityExpression);
    parser.repeatMany(() => {
      const operator = parser.consumeToken(And);
      const right = parser.invokeSubrule(parser.equalityExpression, 2);
      const endToken = parser.lookAhead(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });
}

export function createEqualityExpressionRule(parser: PineParser) {
  return parser.createRule('equalityExpression', () => {
    let expression = parser.invokeSubrule(parser.relationalExpression);
    parser.repeatMany(() => {
      const operator = parser.choose<IToken>([
        { ALT: () => parser.consumeToken(EqualEqual) },
        { ALT: () => parser.consumeToken(NotEqual) },
      ]);
      const right = parser.invokeSubrule(parser.relationalExpression, 2);
      const endToken = parser.lookAhead(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });
}

export function createRelationalExpressionRule(parser: PineParser) {
  return parser.createRule('relationalExpression', () => {
    let expression = parser.invokeSubrule(parser.additiveExpression);
    parser.repeatMany(() => {
      const operator = parser.choose<IToken>([
        { ALT: () => parser.consumeToken(LessEqual) },
        { ALT: () => parser.consumeToken(GreaterEqual) },
        { ALT: () => parser.consumeToken(Less) },
        { ALT: () => parser.consumeToken(Greater) },
      ]);
      const right = parser.invokeSubrule(parser.additiveExpression, 2);
      const endToken = parser.lookAhead(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });
}

export function createAdditiveExpressionRule(parser: PineParser) {
  return parser.createRule('additiveExpression', () => {
    let expression = parser.invokeSubrule(parser.multiplicativeExpression);
    parser.repeatMany(() => {
      const operator = parser.choose<IToken>([
        { ALT: () => parser.consumeToken(Plus) },
        { ALT: () => parser.consumeToken(Minus) },
      ]);
      const right = parser.invokeSubrule(parser.multiplicativeExpression, 2);
      const endToken = parser.lookAhead(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });
}

export function createMultiplicativeExpressionRule(parser: PineParser) {
  return parser.createRule('multiplicativeExpression', () => {
    let expression = parser.invokeSubrule(parser.unaryExpression);
    parser.repeatMany(() => {
      const operator = parser.choose<IToken>([
        { ALT: () => parser.consumeToken(Star) },
        { ALT: () => parser.consumeToken(Slash) },
        { ALT: () => parser.consumeToken(Percent) },
      ]);
      const right = parser.invokeSubrule(parser.unaryExpression, 2);
      const endToken = parser.lookAhead(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });
}

export function createUnaryExpressionRule(parser: PineParser) {
  return parser.createRule('unaryExpression', () => {
    const lookahead = parser.lookAhead(1).tokenType;
    if (lookahead === Plus) {
      const operator = parser.consumeToken(Plus);
      const argument = parser.invokeSubrule(parser.unaryExpression);
      return createUnaryExpressionNode(operator, argument);
    }
    if (lookahead === Minus) {
      const operator = parser.consumeToken(Minus);
      const argument = parser.invokeSubrule(parser.unaryExpression);
      return createUnaryExpressionNode(operator, argument);
    }
    if (lookahead === Not) {
      const operator = parser.consumeToken(Not);
      const argument = parser.invokeSubrule(parser.unaryExpression);
      return createUnaryExpressionNode(operator, argument);
    }

    return parser.invokeSubrule(parser.callExpression);
  });
}

export function createCallTypeReferenceRule(parser: PineParser) {
  return parser.createRule('callTypeReference', (): IToken[] => {
    const tokens: IToken[] = [];

    const identifier = parser.consumeToken(IdentifierToken);
    parser.runAction(() => {
      tokens.push(identifier);
    });

    parser.repeatMany(() => {
      const dotToken = parser.consumeToken(Dot);
      const segmentToken = parser.consumeToken(IdentifierToken, 2);
      parser.runAction(() => {
        tokens.push(dotToken);
        tokens.push(segmentToken);
      });
    });

    parser.optional(() => {
      const lessToken = parser.consumeToken(Less);
      parser.runAction(() => {
        tokens.push(lessToken);
      });

      const firstTokens = parser.invokeSubrule(parser.callTypeReference);
      parser.runAction(() => {
        tokens.push(...firstTokens);
      });

      parser.repeatMany(() => {
        const commaToken = parser.consumeToken(Comma);
        const additionalTokens = parser.invokeSubrule(parser.callTypeReference, 2);
        parser.runAction(() => {
          tokens.push(commaToken);
          tokens.push(...additionalTokens);
        });
      }, 2);

      const greaterToken = parser.consumeToken(Greater);
      parser.runAction(() => {
        tokens.push(greaterToken);
      });
    });

    return tokens;
  });
}

export function createCallExpressionRule(parser: PineParser) {
  return parser.createRule('callExpression', () => {
    let expression = parser.invokeSubrule(parser.primaryExpression) ?? createPlaceholderExpression();

    while (true) {
      const lookahead = parser.lookAhead(1);
      const tokenType = lookahead.tokenType;

      if (tokenType === Less) {
        const canParseGenericCall = parser.backtrack(() => {
          parser.consumeToken(Less);
          parser.invokeSubrule(parser.callTypeReference);
          while (parser.lookAhead(1).tokenType === Comma) {
            parser.consumeToken(Comma);
            parser.invokeSubrule(parser.callTypeReference, 2);
          }
          parser.consumeToken(Greater);
          while (parser.lookAhead(1).tokenType === Newline) {
            parser.consumeToken(Newline);
          }
          parser.consumeToken(LParen);
          return true;
        });

        if (!canParseGenericCall.call(parser)) {
          break;
        }

        const typeArgumentTokenGroups: IToken[][] = [];

        parser.consumeToken(Less);
        typeArgumentTokenGroups.push(parser.invokeSubrule(parser.callTypeReference));
        while (parser.lookAhead(1).tokenType === Comma) {
          parser.consumeToken(Comma);
          typeArgumentTokenGroups.push(parser.invokeSubrule(parser.callTypeReference, 2));
        }
        parser.consumeToken(Greater);

        while (parser.lookAhead(1).tokenType === Newline) {
          parser.consumeToken(Newline);
        }

        parser.consumeToken(LParen);
        let args: ArgumentNode[] = [];
        if (parser.lookAhead(1).tokenType !== RParen) {
          args = parser.invokeSubrule(parser.argumentList);
        }
        const rParen = parser.consumeToken(RParen);
        const typeArguments = typeArgumentTokenGroups
          .map((group) => buildTypeReferenceFromTokens(group))
          .filter((node): node is TypeReferenceNode => node !== null);
        expression = createCallExpressionNode(expression, args, rParen, typeArguments);
        continue;
      }

      if (tokenType === LParen) {
        parser.consumeToken(LParen);
        let args: ArgumentNode[] = [];
        if (parser.lookAhead(1).tokenType !== RParen) {
          args = parser.invokeSubrule(parser.argumentList);
        }
        const rParen = parser.consumeToken(RParen);
        expression = createCallExpressionNode(expression, args, rParen, []);
        continue;
      }

      if (tokenType === Dot) {
        parser.consumeToken(Dot);
        const propertyToken = parser.consumeToken(IdentifierToken);
        const property = createIdentifierNode(propertyToken);
        expression = createMemberExpressionNode(expression, property, propertyToken);
        continue;
      }

      if (tokenType === LBracket) {
        const lBracket = parser.consumeToken(LBracket);
        let indexExpression: ExpressionNode | undefined;
        if (parser.lookAhead(1).tokenType !== RBracket) {
          indexExpression = parser.invokeSubrule(parser.expression, 2);
        }
        const rBracket = parser.consumeToken(RBracket);
        expression = createIndexExpressionNode(expression, indexExpression, rBracket ?? lBracket);
        continue;
      }

      break;
    }

    return expression;
  });
}

export function createMemberExpressionRule(parser: PineParser) {
  return parser.createRule('memberExpression', () => {
    let expression = parser.invokeSubrule(parser.primaryExpression) ?? createPlaceholderExpression();
    parser.repeatMany(() => {
      parser.choose([
        {
          ALT: () => {
            parser.consumeToken(Dot);
            const propertyToken = parser.consumeToken(IdentifierToken);
            const property = createIdentifierNode(propertyToken);
            expression = createMemberExpressionNode(expression, property, propertyToken);
          },
        },
        {
          ALT: () => {
            const lBracket = parser.consumeToken(LBracket);
            let indexExpression: ExpressionNode | undefined;
            if (parser.lookAhead(1).tokenType !== RBracket) {
              indexExpression = parser.invokeSubrule(parser.expression, 2);
            }
            const rBracket = parser.consumeToken(RBracket);
            expression = createIndexExpressionNode(expression, indexExpression, rBracket ?? lBracket);
          },
        },
      ]);
    });
    return expression;
  });
}

export function createArgumentListRule(parser: PineParser) {
  return parser.createRule('argumentList', (): ArgumentNode[] => {
    const args: ArgumentNode[] = [];

    args.push(parser.invokeSubrule(parser.argument));

    parser.repeatMany(() => {
      parser.consumeToken(Comma);
      args.push(parser.invokeSubrule(parser.argument, 2));
    });

    return args;
  });
}

export function createArgumentRule(parser: PineParser) {
  return parser.createRule('argument', () => {
    const lookahead = parser.lookAhead(1);
    if (isIdentifierLikeToken(lookahead) && parser.lookAhead(2).tokenType === Equal) {
      const nameToken = parser.consumeToken(IdentifierToken);
      parser.consumeToken(Equal);
      const value = parser.invokeSubrule(parser.expression);
      const name = createIdentifierNode(nameToken);
      const endToken = parser.lookAhead(0);
      return createArgumentNode(name, value, nameToken, endToken);
    }

    const start = parser.lookAhead(1);
    const value = parser.invokeSubrule(parser.expression, 2);
    const end = parser.lookAhead(0);
    return createArgumentNode(null, value, start, end);
  });
}

export function createBracketExpressionRule(parser: PineParser) {
  return parser.createRule('bracketExpression', (mode: 'expression' | 'tuple' = 'expression'): ExpressionNode => {
    const lBracket = parser.consumeToken(LBracket);
    const elements: (ExpressionNode | null)[] = [];
    let expectElement = true;
    let hasParsedElement = false;

    while (true) {
      const next = parser.lookAhead(1);
      const tokenType = next.tokenType;

      if (tokenType === RBracket || tokenType === EOF) {
        break;
      }

      if (tokenType === Newline) {
        parser.consumeToken(Newline);
        continue;
      }

      if (tokenType === Comma) {
        parser.consumeToken(Comma);
        if (expectElement) {
          elements.push(null);
        }
        expectElement = true;
        continue;
      }

      let element: ExpressionNode | undefined;
      if (!hasParsedElement) {
        element = parser.invokeSubrule(parser.expression);
        hasParsedElement = true;
      } else {
        element = parser.invokeSubrule(parser.expression, 2);
      }
      elements.push(element);
      expectElement = false;

      if (parser.lookAhead(1).tokenType === Comma) {
        parser.consumeToken(Comma);
        expectElement = true;
      } else {
        expectElement = false;
        break;
      }
    }

    if (expectElement && elements.length > 0 && parser.lookAhead(1).tokenType === RBracket) {
      elements.push(null);
    }

    const rBracket = parser.consumeToken(RBracket);

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
  return parser.createRule('primaryExpression', (): ExpressionNode => {
    const token = parser.lookAhead(1);
    switch (token.tokenType) {
      case IdentifierToken:
        return parser.invokeSubrule(parser.identifierExpression);
      case StringToken:
        return createLiteralFromToken(parser.consumeToken(StringToken));
      case NumberToken:
        return createLiteralFromToken(parser.consumeToken(NumberToken));
      case True:
        return createLiteralFromToken(parser.consumeToken(True));
      case False:
        return createLiteralFromToken(parser.consumeToken(False));
      case NaToken:
        return createLiteralFromToken(parser.consumeToken(NaToken));
      case Switch:
        return parser.invokeSubrule(parser.switchExpression);
      case If:
        return parser.invokeSubrule(parser.ifExpression);
      case For:
        return parser.invokeSubrule(parser.forExpression);
      case While:
        return parser.invokeSubrule(parser.whileExpression);
      case LBracket:
        return parser.invokeSubrule(parser.bracketExpression);
      case LParen: {
        if (isArrowFunctionStart(parser)) {
          return parser.invokeSubrule(parser.arrowFunctionExpression);
        }
        parser.consumeToken(LParen);
        const expression = parser.invokeSubrule(parser.expression);
        parser.consumeToken(RParen);
        return expression ?? createPlaceholderExpression();
      }
      default:
        return createIdentifierNode(parser.consumeToken(IdentifierToken));
    }
  });
}

export function createIdentifierExpressionRule(parser: PineParser) {
  return parser.createRule('identifierExpression', () => {
    const first = parser.consumeToken(IdentifierToken);
    let expression: ExpressionNode = createIdentifierNode(first);

    parser.repeatMany(() => {
      parser.consumeToken(Dot);
      const propertyToken = parser.consumeToken(IdentifierToken, 2);
      const property = createIdentifierNode(propertyToken);
      expression = createMemberExpressionNode(expression, property, propertyToken);
    });

    return expression;
  });
}

export function createIfExpressionRule(parser: PineParser) {
  return parser.createRule('ifExpression', (baseIndentOverride?: number) => {
    const ifToken = parser.consumeToken(If);
    const test = parser.invokeSubrule(parser.expression) ?? createPlaceholderExpression();
    const baseIndent = baseIndentOverride ?? parser.getLineIndent(ifToken.startLine ?? 1);
    const consequent = parser.parseIfExpressionBranch(baseIndent);

    let alternate: IfExpressionNode | BlockStatementNode | null = null;

    let offset = 1;
    while (parser.lookAhead(offset).tokenType === Newline) {
      offset += 1;
    }
    const potentialElse = parser.lookAhead(offset);
    if (potentialElse.tokenType === Else && tokenIndent(potentialElse) <= baseIndent) {
      while (parser.lookAhead(1).tokenType === Newline) {
        parser.consumeToken(Newline);
      }
      parser.consumeToken(Else);

      if (parser.lookAhead(1).tokenType === If) {
        alternate = parser.invokeSubrule(parser.ifExpression, 2, { ARGS: [baseIndent] });
      } else {
        alternate = parser.parseIfExpressionBranch(baseIndent);
      }
    }

    const endToken = parser.lookAhead(0);
    return createIfExpressionNode(test, consequent, alternate, ifToken, endToken);
  });
}

export function createForExpressionRule(parser: PineParser) {
  return parser.createRule('forExpression', () => {
    const forToken = parser.consumeToken(For);
    return parser.parseForLoop(forToken);
  });
}

export function createWhileExpressionRule(parser: PineParser) {
  return parser.createRule('whileExpression', () => {
    const whileToken = parser.consumeToken(While);
    return parser.parseWhileLoop(whileToken);
  });
}

export function createSwitchExpressionRule(parser: PineParser) {
  return parser.createRule('switchExpression', () => {
    const switchToken = parser.consumeToken(Switch);
    return parser.parseSwitchStructure(switchToken);
  });
}
