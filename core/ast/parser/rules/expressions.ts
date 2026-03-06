import { EOF, type IToken, type TokenType } from 'chevrotain';
import type { PineParser } from '../parser';
import { isIdentifierLikeToken, isNumberLiteralToken } from '../parser-utils';
import {
  type ArgumentNode,
  type BlockStatementNode,
  type ExpressionNode,
  type IfExpressionNode,
  type ParameterNode,
  type TupleExpressionNode,
  type ArrayLiteralNode,
  type TypeReferenceNode,
  type ParserRecoveryError,
  type VirtualToken,
  type CallArgumentRecovery,
  type ConditionalExpressionRecovery,
  type BinaryExpressionRecovery,
  type IndexExpressionRecovery,
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
  Increment,
  Decrement,
  Identifier as IdentifierToken,
  If,
  LBracket,
  Less,
  LessEqual,
  Minus,
  NaToken,
  Newline,
  InvalidLogicalAnd,
  InvalidLogicalOr,
  StrictEqual,
  StrictNotEqual,
  BitwiseOr,
  BitwiseAnd,
  BitwiseXor,
  Bang,
  Not,
  NotEqual,
  NullishCoalescing,
  NumberLiteral as NumberToken,
  ColorLiteral as ColorToken,
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
  TrailingNumberLiteral,
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
  createColorLiteralNode,
  createTupleExpressionNode,
  createUnaryExpressionNode,
  buildTypeReferenceFromTokens,
  createSyntheticToken,
} from '../node-builders';
import { VirtualTokenReason } from '../../virtual-tokens';

type ConditionalExpressionOptions = {
  allowMisorderedRecovery?: boolean;
};

function createLiteralFromToken(token: IToken) {
  if (token.tokenType === StringToken) {
    return createStringNode(token);
  }
  if (isNumberLiteralToken(token)) {
    return createNumberNode(token);
  }
  if (token.tokenType === ColorToken) {
    return createColorLiteralNode(token);
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

const CONDITIONAL_OPERATOR_ORDER_MESSAGE =
  "Incorrect conditional operator order. Use 'condition ? value_if_true : value_if_false'.";

function createConditionalRecoveryTokens(
  colonToken: IToken,
  questionToken: IToken | null,
): ConditionalExpressionRecovery {
  const virtualQuestion = createSyntheticToken('?', Question, colonToken, VirtualTokenReason.CONDITIONAL_QUESTION) as VirtualToken;
  virtualQuestion.isVirtual = true;

  const colonReference = questionToken ?? colonToken;
  const virtualColon = createSyntheticToken(':', Colon, colonReference, VirtualTokenReason.CONDITIONAL_COLON) as VirtualToken;
  virtualColon.isVirtual = true;

  const error: ParserRecoveryError = {
    code: 'CONDITIONAL_OPERATOR_ORDER',
    message: CONDITIONAL_OPERATOR_ORDER_MESSAGE,
    suggestion: "Swap the '?' and ':' operators so the question mark comes first.",
    severity: 'error',
  };

  return {
    virtualQuestion,
    virtualColon,
    errors: [error],
  };
}

const binaryExpressionStartTokenTypes = new Set([
  IdentifierToken,
  NumberToken,
  TrailingNumberLiteral,
  StringToken,
  ColorToken,
  LParen,
  LBracket,
  Minus,
  Plus,
  Bang,
  Not,
  Increment,
  Decrement,
  True,
  False,
  NaToken,
  If,
  Switch,
  For,
  While,
]);

function isBinaryOperandStart(token: IToken): boolean {
  const tokenType = token.tokenType;
  if (!tokenType || tokenType === EOF || tokenType === Newline) {
    return false;
  }
  if (binaryExpressionStartTokenTypes.has(tokenType)) {
    return true;
  }
  const categories = (tokenType as { CATEGORIES?: unknown[] }).CATEGORIES;
  if (Array.isArray(categories)) {
    return categories.some((category) => binaryExpressionStartTokenTypes.has(category as any));
  }
  return false;
}

function createMissingBinaryOperandRecovery(
  parser: PineParser,
  operatorToken: IToken,
): { placeholder: ExpressionNode; recovery: BinaryExpressionRecovery } {
  const operatorImage = operatorToken.image || operatorToken.tokenType?.name || '?';
  const message = `Missing expression after binary operator '${operatorImage}'`;
  const error: ParserRecoveryError = {
    code: 'MISSING_BINARY_OPERAND',
    message,
    suggestion: `Provide an expression after '${operatorImage}'.`,
    severity: 'error',
  };
  parser.reportRecoveryError(operatorToken, message, {
    code: error.code,
    suggestion: error.suggestion,
  });
  const virtualOperandToken = createSyntheticToken(
    '__missing_operand__',
    IdentifierToken,
    operatorToken,
    VirtualTokenReason.MISSING_OPERAND,
  ) as VirtualToken;
  virtualOperandToken.isVirtual = true;
  const placeholder = createPlaceholderExpression(virtualOperandToken);
  return {
    placeholder,
    recovery: {
      missingSide: 'right',
      operator: operatorImage,
      virtualOperand: virtualOperandToken,
      errors: [error],
    },
  };
}

function parseBinaryRightOperand(
  parser: PineParser,
  operatorToken: IToken,
  parseOperand: () => ExpressionNode | undefined,
): { operand: ExpressionNode; recovery: BinaryExpressionRecovery | null } {
  const nextToken = parser.lookAhead(1);
  if (isBinaryOperandStart(nextToken)) {
    const parsed = parseOperand();
    return {
      operand: parsed ?? createPlaceholderExpression(),
      recovery: null,
    };
  }
  const { placeholder, recovery } = createMissingBinaryOperandRecovery(parser, operatorToken);
  return { operand: placeholder, recovery };
}

type BinaryOperatorLookaheadOptions = {
  disallowAmbiguousUnaryAcrossIndentedNewline?: boolean;
};

function hasBinaryOperatorAhead(
  parser: PineParser,
  operatorTokens: TokenType[],
  options: BinaryOperatorLookaheadOptions = {},
): boolean {
  let offset = 1;
  let next = parser.lookAhead(offset);
  let crossedNewline = false;
  while (next.tokenType === Newline) {
    crossedNewline = true;
    offset += 1;
    next = parser.lookAhead(offset);
  }

  if (!operatorTokens.includes(next.tokenType)) {
    return false;
  }

  if (
    options.disallowAmbiguousUnaryAcrossIndentedNewline &&
    crossedNewline &&
    (next.tokenType === Plus || next.tokenType === Minus)
  ) {
    const previousToken = parser.lookAhead(0);
    const previousLine = previousToken?.endLine ?? previousToken?.startLine ?? 1;
    const operatorLine = next.startLine ?? previousLine;
    const previousIndentLevel = Math.floor(parser.getLineIndent(previousLine) / 4);
    const operatorIndentLevel = Math.floor(parser.getLineIndent(operatorLine) / 4);

    // If newline crosses into a deeper indentation block, treat +/- as unary for
    // the next statement instead of binary continuation.
    if (operatorIndentLevel > previousIndentLevel) {
      return false;
    }
  }

  return true;
}

function consumeOptionalNewlinesRule(parser: PineParser, occurrence = 1): void {
  parser.invokeSubrule(parser.consumeOptionalNewlines, occurrence);
}

function looksLikeIdentifierWord(image: string | undefined): boolean {
  if (!image) {
    return false;
  }
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(image);
}

function canBeNamedArgumentNameToken(token: IToken | undefined): boolean {
  if (!token) {
    return false;
  }

  if (isIdentifierLikeToken(token)) {
    return true;
  }

  const tokenType = token.tokenType;
  if (
    tokenType === NumberToken ||
    tokenType === TrailingNumberLiteral ||
    tokenType === StringToken ||
    tokenType === ColorToken ||
    tokenType === True ||
    tokenType === False ||
    tokenType === NaToken ||
    tokenType === Newline ||
    tokenType === Comma ||
    tokenType === RParen ||
    tokenType === LParen ||
    tokenType === LBracket ||
    tokenType === RBracket
  ) {
    return false;
  }

  return looksLikeIdentifierWord(token.image);
}

function isRecordingPhase(parser: PineParser): boolean {
  return Boolean((parser as unknown as { RECORDING_PHASE?: boolean }).RECORDING_PHASE);
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
  return parser.createRule('expression', (...args: unknown[]) => {
    const options = (args[0] ?? {}) as ConditionalExpressionOptions | undefined;
    if (options && options.allowMisorderedRecovery !== undefined) {
      return parser.invokeSubrule(parser.conditionalExpression, 1, { ARGS: [options] });
    }
    return parser.invokeSubrule(parser.conditionalExpression);
  });
}

export function createConditionalExpressionRule(parser: PineParser) {
  return parser.createRule('conditionalExpression', (...args: unknown[]) => {
    const options = (args[0] ?? {}) as ConditionalExpressionOptions | undefined;
    const allowMisorderedRecovery = options?.allowMisorderedRecovery !== false;
    const test = parser.invokeSubrule(parser.nullishCoalescingExpression);
    const nextTokenType = parser.lookAhead(1).tokenType;

    if (nextTokenType === Question) {
      const questionToken = parser.consumeToken(Question);
      while (parser.lookAhead(1).tokenType === Newline) {
        parser.consumeToken(Newline);
      }
      const consequent = parser.invokeSubrule(parser.expression, 2, {
        ARGS: [{ allowMisorderedRecovery: false }],
      });
      const colonToken = parser.consumeToken(Colon);
      while (parser.lookAhead(1).tokenType === Newline) {
        parser.consumeToken(Newline);
      }
      const alternate = parser.invokeSubrule(parser.expression, 3, {
        ARGS: [{ allowMisorderedRecovery: false }],
      });
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
    if (allowMisorderedRecovery && nextTokenType === Colon) {
      const findNextQuestion = (): IToken | null => {
        for (let offset = 2; offset < 20; offset += 1) {
          const lookahead = parser.lookAhead(offset);
          if (!lookahead || lookahead.tokenType === EOF) {
            return null;
          }
          if (lookahead.tokenType === Question) {
            return lookahead;
          }
        }
        return null;
      };

      const colonToken = parser.lookAhead(1);
      const upcomingQuestion = findNextQuestion();
      if (!upcomingQuestion) {
        return test;
      }

      parser.consumeToken(Colon);
      while (parser.lookAhead(1).tokenType === Newline) {
        parser.consumeToken(Newline);
      }

      const recovery = createConditionalRecoveryTokens(colonToken, upcomingQuestion);
      const recoveryError = recovery.errors[0];
      if (recoveryError) {
        parser.reportRecoveryError(recovery.virtualQuestion, recoveryError.message, {
          code: recoveryError.code,
          suggestion: recoveryError.suggestion,
        });
      }

      const consequent = parser.invokeSubrule(parser.nullishCoalescingExpression, 2);
      const questionToken = parser.consumeToken(Question);
      while (parser.lookAhead(1).tokenType === Newline) {
        parser.consumeToken(Newline);
      }
      const alternate = parser.invokeSubrule(parser.expression, 3);
      const endToken = parser.lookAhead(0);
      return createConditionalExpressionNode(
        test,
        consequent,
        alternate,
        recovery.virtualQuestion,
        recovery.virtualColon ?? questionToken,
        endToken,
        recovery,
      );
    }
    return test;
  });
}

export function createNullishCoalescingExpressionRule(parser: PineParser) {
  return parser.createRule('nullishCoalescingExpression', () => {
    let expression = parser.invokeSubrule(parser.logicalOrExpression);
    parser.repeatMany({
      GATE: () =>
        isRecordingPhase(parser) || hasBinaryOperatorAhead(parser, [NullishCoalescing]),
      DEF: () => {
        consumeOptionalNewlinesRule(parser);
        const operator = parser.consumeToken(NullishCoalescing);
        consumeOptionalNewlinesRule(parser, 2);
        const { operand: right, recovery } = parseBinaryRightOperand(parser, operator, () =>
          parser.invokeSubrule(parser.logicalOrExpression, 2),
        );
        const endToken = parser.lookAhead(0);
        expression = createBinaryExpressionNode(expression, operator, right, endToken, recovery);
      },
    });
    return expression;
  });
}

export function createLogicalOrExpressionRule(parser: PineParser) {
  return parser.createRule('logicalOrExpression', () => {
    let expression = parser.invokeSubrule(parser.logicalAndExpression);
    parser.repeatMany({
      GATE: () =>
        isRecordingPhase(parser) || hasBinaryOperatorAhead(parser, [Or, InvalidLogicalOr]),
      DEF: () => {
        consumeOptionalNewlinesRule(parser);
        const operator = parser.choose<IToken>([
          { ALT: () => parser.consumeToken(Or) },
          { ALT: () => parser.consumeToken(InvalidLogicalOr) },
        ]);

        consumeOptionalNewlinesRule(parser, 2);

        const { operand: right, recovery } = parseBinaryRightOperand(parser, operator, () =>
          parser.invokeSubrule(parser.logicalAndExpression, 2),
        );
        const endToken = parser.lookAhead(0);
        expression = createBinaryExpressionNode(expression, operator, right, endToken, recovery);
      },
    });
    return expression;
  });
}

export function createLogicalAndExpressionRule(parser: PineParser) {
  return parser.createRule('logicalAndExpression', () => {
    let expression = parser.invokeSubrule(parser.equalityExpression);
    parser.repeatMany({
      GATE: () =>
        isRecordingPhase(parser) || hasBinaryOperatorAhead(parser, [And, InvalidLogicalAnd]),
      DEF: () => {
        consumeOptionalNewlinesRule(parser);
        const operator = parser.choose<IToken>([
          { ALT: () => parser.consumeToken(And) },
          { ALT: () => parser.consumeToken(InvalidLogicalAnd) },
        ]);

        consumeOptionalNewlinesRule(parser, 2);

        const { operand: right, recovery } = parseBinaryRightOperand(parser, operator, () =>
          parser.invokeSubrule(parser.equalityExpression, 2),
        );
        const endToken = parser.lookAhead(0);
        expression = createBinaryExpressionNode(expression, operator, right, endToken, recovery);
      },
    });
    return expression;
  });
}

export function createEqualityExpressionRule(parser: PineParser) {
  return parser.createRule('equalityExpression', () => {
    let expression = parser.invokeSubrule(parser.relationalExpression);
    parser.repeatMany({
      GATE: () =>
        isRecordingPhase(parser) ||
        hasBinaryOperatorAhead(parser, [EqualEqual, NotEqual, StrictEqual, StrictNotEqual, Equal]),
      DEF: () => {
        consumeOptionalNewlinesRule(parser);
        const operator = parser.choose<IToken>([
          { ALT: () => parser.consumeToken(EqualEqual) },
          { ALT: () => parser.consumeToken(NotEqual) },
          { ALT: () => parser.consumeToken(StrictEqual) },
          { ALT: () => parser.consumeToken(StrictNotEqual) },
          { ALT: () => parser.consumeToken(Equal) },
        ]);

        consumeOptionalNewlinesRule(parser, 2);

        const { operand: right, recovery } = parseBinaryRightOperand(parser, operator, () =>
          parser.invokeSubrule(parser.relationalExpression, 2),
        );
        const endToken = parser.lookAhead(0);
        expression = createBinaryExpressionNode(expression, operator, right, endToken, recovery);
      },
    });
    return expression;
  });
}

export function createRelationalExpressionRule(parser: PineParser) {
  return parser.createRule('relationalExpression', () => {
    let expression = parser.invokeSubrule(parser.additiveExpression);
    parser.repeatMany({
      GATE: () =>
        isRecordingPhase(parser) ||
        hasBinaryOperatorAhead(parser, [LessEqual, GreaterEqual, Less, Greater]),
      DEF: () => {
        consumeOptionalNewlinesRule(parser);
        const operator = parser.choose<IToken>([
          { ALT: () => parser.consumeToken(LessEqual) },
          { ALT: () => parser.consumeToken(GreaterEqual) },
          { ALT: () => parser.consumeToken(Less) },
          { ALT: () => parser.consumeToken(Greater) },
        ]);

        consumeOptionalNewlinesRule(parser, 2);

        const { operand: right, recovery } = parseBinaryRightOperand(parser, operator, () =>
          parser.invokeSubrule(parser.additiveExpression, 2),
        );
        const endToken = parser.lookAhead(0);
        expression = createBinaryExpressionNode(expression, operator, right, endToken, recovery);
      },
    });
    return expression;
  });
}

export function createAdditiveExpressionRule(parser: PineParser) {
  return parser.createRule('additiveExpression', () => {
    let expression = parser.invokeSubrule(parser.multiplicativeExpression);
    parser.repeatMany({
      GATE: () =>
        isRecordingPhase(parser) ||
        hasBinaryOperatorAhead(
          parser,
          [Plus, Minus, BitwiseOr, BitwiseXor],
          { disallowAmbiguousUnaryAcrossIndentedNewline: true },
        ),
      DEF: () => {
        consumeOptionalNewlinesRule(parser);
        const operator = parser.choose<IToken>([
          { ALT: () => parser.consumeToken(Plus) },
          { ALT: () => parser.consumeToken(Minus) },
          { ALT: () => parser.consumeToken(BitwiseOr) },
          { ALT: () => parser.consumeToken(BitwiseXor) },
        ]);

        consumeOptionalNewlinesRule(parser, 2);

        const { operand: right, recovery } = parseBinaryRightOperand(parser, operator, () =>
          parser.invokeSubrule(parser.multiplicativeExpression, 2),
        );
        const endToken = parser.lookAhead(0);
        expression = createBinaryExpressionNode(expression, operator, right, endToken, recovery);
      },
    });
    return expression;
  });
}

export function createMultiplicativeExpressionRule(parser: PineParser) {
  return parser.createRule('multiplicativeExpression', () => {
    let expression = parser.invokeSubrule(parser.unaryExpression);
    parser.repeatMany({
      GATE: () =>
        isRecordingPhase(parser) ||
        hasBinaryOperatorAhead(parser, [Star, Slash, Percent, BitwiseAnd]),
      DEF: () => {
        consumeOptionalNewlinesRule(parser);
        const operator = parser.choose<IToken>([
          { ALT: () => parser.consumeToken(Star) },
          { ALT: () => parser.consumeToken(Slash) },
          { ALT: () => parser.consumeToken(Percent) },
          { ALT: () => parser.consumeToken(BitwiseAnd) },
        ]);

        consumeOptionalNewlinesRule(parser, 2);

        const { operand: right, recovery } = parseBinaryRightOperand(parser, operator, () =>
          parser.invokeSubrule(parser.unaryExpression, 2),
        );
        const endToken = parser.lookAhead(0);
        expression = createBinaryExpressionNode(expression, operator, right, endToken, recovery);
      },
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
    if (lookahead === Increment) {
      const operator = parser.consumeToken(Increment);
      const argument = parser.invokeSubrule(parser.unaryExpression);
      return createUnaryExpressionNode(operator, argument);
    }
    if (lookahead === Decrement) {
      const operator = parser.consumeToken(Decrement);
      const argument = parser.invokeSubrule(parser.unaryExpression);
      return createUnaryExpressionNode(operator, argument);
    }
    if (lookahead === Bang) {
      const operator = parser.consumeToken(Bang);
      const argument = parser.invokeSubrule(parser.unaryExpression);
      return createUnaryExpressionNode(operator, argument);
    }
    if (lookahead === Not) {
      const operator = parser.consumeToken(Not);
      const argument = parser.invokeSubrule(parser.unaryExpression);
      return createUnaryExpressionNode(operator, argument);
    }

    const expression = parser.invokeSubrule(parser.callExpression);

    if (parser.lookAhead(1).tokenType === Increment) {
      const operator = parser.consumeToken(Increment);
      return createUnaryExpressionNode(operator, expression, false);
    }

    if (parser.lookAhead(1).tokenType === Decrement) {
      const operator = parser.consumeToken(Decrement);
      return createUnaryExpressionNode(operator, expression, false);
    }

    return expression;
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
          if (parser.lookAhead(1).tokenType !== Greater) {
            parser.invokeSubrule(parser.callTypeReference);
            while (parser.lookAhead(1).tokenType === Comma) {
              parser.consumeToken(Comma);
              parser.invokeSubrule(parser.callTypeReference, 2);
            }
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
        if (parser.lookAhead(1).tokenType !== Greater) {
          typeArgumentTokenGroups.push(parser.invokeSubrule(parser.callTypeReference));
          while (parser.lookAhead(1).tokenType === Comma) {
            parser.consumeToken(Comma);
            typeArgumentTokenGroups.push(parser.invokeSubrule(parser.callTypeReference, 2));
          }
        }
        parser.consumeToken(Greater);

        while (parser.lookAhead(1).tokenType === Newline) {
          parser.consumeToken(Newline);
        }

        const lParen = parser.consumeToken(LParen);
        parser.setArgumentListRecovery(null);
        let args: ArgumentNode[] = [];
        let argumentRecovery: CallArgumentRecovery | null = null;
        if (parser.lookAhead(1).tokenType !== RParen) {
          args = parser.invokeSubrule(parser.argumentList);
          argumentRecovery = parser.consumeArgumentListRecovery();
        }
        while (parser.lookAhead(1).tokenType === Newline) {
          parser.consumeToken(Newline);
        }

        let closingToken: IToken | VirtualToken;
        if (parser.lookAhead(1).tokenType === RParen) {
          closingToken = parser.consumeToken(RParen);
        } else {
          const referenceToken = parser.lookAhead(0) ?? lParen;
          const virtualClosing = createSyntheticToken(')', RParen, referenceToken, VirtualTokenReason.MISSING_PAREN) as VirtualToken;
          const error: ParserRecoveryError = {
            code: 'MISSING_CLOSING_PAREN',
            message: 'Missing closing parenthesis for function call',
            suggestion: 'Add \')\' to close the argument list.',
            severity: 'error',
          };
          parser.reportRecoveryError(virtualClosing, error.message, {
            code: error.code,
            suggestion: error.suggestion,
          });
          if (argumentRecovery) {
            argumentRecovery.virtualClosing = virtualClosing;
            argumentRecovery.errors.push(error);
          } else {
            argumentRecovery = {
              virtualSeparators: [],
              virtualArguments: [],
              virtualClosing: virtualClosing,
              errors: [error],
            };
          }
          closingToken = virtualClosing;
        }
        const typeArguments = typeArgumentTokenGroups
          .map((group) => buildTypeReferenceFromTokens(group))
          .filter((node): node is TypeReferenceNode => node !== null);
        expression = createCallExpressionNode(expression, args, closingToken, typeArguments, argumentRecovery);
        continue;
      }

      if (tokenType === LParen) {
        const lParen = parser.consumeToken(LParen);
        parser.setArgumentListRecovery(null);
        let args: ArgumentNode[] = [];
        let argumentRecovery: CallArgumentRecovery | null = null;
        if (parser.lookAhead(1).tokenType !== RParen) {
          args = parser.invokeSubrule(parser.argumentList);
          argumentRecovery = parser.consumeArgumentListRecovery();
        }
        while (parser.lookAhead(1).tokenType === Newline) {
          parser.consumeToken(Newline);
        }

        let closingToken: IToken | VirtualToken;
        if (parser.lookAhead(1).tokenType === RParen) {
          closingToken = parser.consumeToken(RParen);
        } else {
          const referenceToken = parser.lookAhead(0) ?? lParen;
          const virtualClosing = createSyntheticToken(')', RParen, referenceToken, VirtualTokenReason.MISSING_PAREN) as VirtualToken;
          const error: ParserRecoveryError = {
            code: 'MISSING_CLOSING_PAREN',
            message: 'Missing closing parenthesis for function call',
            suggestion: 'Add \')\' to close the argument list.',
            severity: 'error',
          };
          parser.reportRecoveryError(virtualClosing, error.message, {
            code: error.code,
            suggestion: error.suggestion,
          });
          if (argumentRecovery) {
            argumentRecovery.virtualClosing = virtualClosing;
            argumentRecovery.errors.push(error);
          } else {
            argumentRecovery = {
              virtualSeparators: [],
              virtualArguments: [],
              virtualClosing: virtualClosing,
              errors: [error],
            };
          }
          closingToken = virtualClosing;
        }
        expression = createCallExpressionNode(expression, args, closingToken, [], argumentRecovery);
        continue;
      }

      if (tokenType === Dot) {
        parser.consumeToken(Dot);
        while (parser.lookAhead(1).tokenType === Newline) {
          parser.consumeToken(Newline);
        }
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
        while (parser.lookAhead(1).tokenType === Newline) {
          parser.consumeToken(Newline);
        }

        let closingToken: IToken | VirtualToken;
        let indexRecovery: IndexExpressionRecovery | null = null;
        if (parser.lookAhead(1).tokenType === RBracket) {
          closingToken = parser.consumeToken(RBracket);
        } else {
          const referenceToken = parser.lookAhead(0) ?? lBracket;
          const virtualClosing = createSyntheticToken(']', RBracket, referenceToken, VirtualTokenReason.MISSING_BRACKET) as VirtualToken;
          const error: ParserRecoveryError = {
            code: 'MISSING_BRACKET',
            message: 'Missing closing bracket',
            suggestion: 'Add \']\' to close the expression.',
            severity: 'error',
          };
          parser.reportRecoveryError(virtualClosing, error.message, {
            code: error.code,
            suggestion: error.suggestion,
          });
          indexRecovery = {
            virtualClosing: virtualClosing,
            errors: [error],
          };
          closingToken = virtualClosing;
        }
        expression = createIndexExpressionNode(expression, indexExpression, closingToken, indexRecovery);
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
            while (parser.lookAhead(1).tokenType === Newline) {
              parser.consumeToken(Newline);
            }
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
            while (parser.lookAhead(1).tokenType === Newline) {
              parser.consumeToken(Newline);
            }

            let closingToken: IToken | VirtualToken;
            let indexRecovery: IndexExpressionRecovery | null = null;
            if (parser.lookAhead(1).tokenType === RBracket) {
              closingToken = parser.consumeToken(RBracket);
            } else {
              const referenceToken = parser.lookAhead(0) ?? lBracket;
              const virtualClosing = createSyntheticToken(']', RBracket, referenceToken, VirtualTokenReason.MISSING_BRACKET) as VirtualToken;
              const error: ParserRecoveryError = {
                code: 'MISSING_BRACKET',
                message: 'Missing closing bracket',
                suggestion: 'Add \']\' to close the expression.',
                severity: 'error',
              };
              parser.reportRecoveryError(virtualClosing, error.message, {
                code: error.code,
                suggestion: error.suggestion,
              });
              indexRecovery = {
                virtualClosing: virtualClosing,
                errors: [error],
              };
              closingToken = virtualClosing;
            }
            expression = createIndexExpressionNode(expression, indexExpression, closingToken, indexRecovery);
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
    const virtualSeparators: VirtualToken[] = [];
    const virtualArguments: VirtualToken[] = [];
    const virtualArgumentDetails: {
      token: VirtualToken;
      position: 'first' | 'middle' | 'trailing';
    }[] = [];
    const recoveryErrors: ParserRecoveryError[] = [];

    const skipNewlines = () => {
      while (parser.lookAhead(1).tokenType === Newline) {
        parser.consumeToken(Newline);
      }
    };

    const argumentStartTokenTypes = new Set([
      IdentifierToken,
      NumberToken,
      StringToken,
      ColorToken,
      LParen,
      LBracket,
      Minus,
      Plus,
      Bang,
      True,
      False,
      NaToken,
      If,
    ]);

    const isArgumentStartToken = (token: IToken): boolean => {
      const tokenType = token.tokenType;
      if (!tokenType || tokenType === EOF || tokenType === RParen || tokenType === Comma) {
        return false;
      }
      if (tokenType === Newline) {
        return false;
      }

      // Support named arguments whose names lex as keyword tokens
      // (e.g., `type = input.string`).
      if (
        canBeNamedArgumentNameToken(token) &&
        parser.lookAhead(2).tokenType === Equal
      ) {
        return true;
      }

      if (argumentStartTokenTypes.has(tokenType)) {
        return true;
      }
      const categories = (tokenType as { CATEGORIES?: unknown[] }).CATEGORIES;
      if (Array.isArray(categories)) {
        return categories.some((category) => argumentStartTokenTypes.has(category as any));
      }
      return false;
    };

    const recordMissingComma = (referenceToken: IToken | undefined) => {
      const virtualComma = createSyntheticToken(',', Comma, referenceToken, VirtualTokenReason.MISSING_COMMA) as VirtualToken;
      virtualComma.isVirtual = true;
      virtualSeparators.push(virtualComma);
      const error: ParserRecoveryError = {
        code: 'MISSING_COMMA',
        message: `Missing ',' between arguments`,
        suggestion: 'Separate arguments with a comma.',
        severity: 'error',
      };
      recoveryErrors.push(error);
      parser.reportRecoveryError(virtualComma, error.message, {
        code: error.code,
        suggestion: error.suggestion,
      });
    };

    const createMissingArgument = (
      referenceToken: IToken | undefined,
      context: 'empty' | 'trailing',
      position: 'first' | 'middle' | 'trailing',
    ) => {
      const reason = context === 'trailing'
        ? VirtualTokenReason.TRAILING_COMMA
        : VirtualTokenReason.MISSING_ARGUMENT;
      const virtualArgument = createSyntheticToken(
        '__missing_argument__',
        IdentifierToken,
        referenceToken,
        reason,
      ) as VirtualToken;
      virtualArgument.isVirtual = true;
      virtualArguments.push(virtualArgument);
      virtualArgumentDetails.push({ token: virtualArgument, position });

      const isTrailing = context === 'trailing';
      const error: ParserRecoveryError = {
        code: isTrailing ? 'TRAILING_COMMA' : 'EMPTY_ARGUMENT',
        message: isTrailing
          ? 'Trailing comma without argument'
          : 'Missing argument between commas',
        suggestion: isTrailing
          ? 'Remove the trailing comma or provide an argument after it.'
          : 'Provide an argument between these commas.',
        severity: 'error',
      };
      recoveryErrors.push(error);
      parser.reportRecoveryError(virtualArgument, error.message, {
        code: error.code,
        suggestion: error.suggestion,
      });

      const placeholderExpression = createPlaceholderExpression(virtualArgument);
      const placeholderArgument = createArgumentNode(null, placeholderExpression, virtualArgument, virtualArgument);
      args.push(placeholderArgument);
      return virtualArgument;
    };

    skipNewlines();

    let expectArgument = true;
    let commaJustConsumed = false;
    let seenArgument = false;
    let lastMissingCommaOffset: number | null = null;

    while (true) {
      skipNewlines();
      const nextToken = parser.lookAhead(1);

      if (expectArgument) {
        if (commaJustConsumed && nextToken.tokenType === RParen) {
          createMissingArgument(parser.lookAhead(0), 'trailing', 'trailing');
          commaJustConsumed = false;
          break;
        }

        if (nextToken.tokenType === RParen) {
          break;
        }

        if (!isArgumentStartToken(nextToken)) {
          const position: 'first' | 'middle' = seenArgument ? 'middle' : 'first';
          createMissingArgument(parser.lookAhead(0), 'empty', position);
          seenArgument = true;
          expectArgument = false;
          commaJustConsumed = false;
          lastMissingCommaOffset = null;
          continue;
        }

        const occurrence = seenArgument ? 2 : 1;
        args.push(parser.invokeSubrule(parser.argument, occurrence));
        seenArgument = true;
        expectArgument = false;
        commaJustConsumed = false;
        lastMissingCommaOffset = null;
        continue;
      }

      if (nextToken.tokenType === Comma) {
        parser.consumeToken(Comma);
        commaJustConsumed = true;
        expectArgument = true;
        lastMissingCommaOffset = null;
        continue;
      }

      if (nextToken.tokenType === RParen) {
        break;
      }

      if (isArgumentStartToken(nextToken)) {
        const tokenOffset =
          nextToken.startOffset ?? nextToken.endOffset ?? lastMissingCommaOffset ?? -1;
        if (lastMissingCommaOffset !== null && tokenOffset === lastMissingCommaOffset) {
          break;
        }
        lastMissingCommaOffset = tokenOffset;
        recordMissingComma(parser.lookAhead(0));
        const occurrence = seenArgument ? 2 : 1;
        args.push(parser.invokeSubrule(parser.argument, occurrence));
        seenArgument = true;
        expectArgument = false;
        commaJustConsumed = false;
        lastMissingCommaOffset = null;
        continue;
      }

      if (nextToken.tokenType === Newline) {
        parser.consumeToken(Newline);
        continue;
      }

      break;
    }

    skipNewlines();

    const hasRecovery =
      virtualSeparators.length > 0 || virtualArguments.length > 0 || recoveryErrors.length > 0;
    parser.setArgumentListRecovery(
      hasRecovery
        ? { virtualSeparators, virtualArguments, virtualArgumentDetails, errors: recoveryErrors }
        : null,
    );

    return args;
  });
}

export function createArgumentRule(parser: PineParser) {
  return parser.createRule('argument', () => {
    const lookahead = parser.lookAhead(1);
    if (canBeNamedArgumentNameToken(lookahead) && parser.lookAhead(2).tokenType === Equal) {
      const nameToken = parser.consumeToken(lookahead.tokenType);
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
  return parser.createRule('bracketExpression', (...args: unknown[]): ExpressionNode => {
    const mode = (args[0] as 'expression' | 'tuple') ?? 'expression';
    const lBracket = parser.consumeToken(LBracket);
    const elements: (ExpressionNode | null)[] = [];
    let expectElement = true;
    let hasParsedElement = false;
    const virtualSeparators: VirtualToken[] = [];
    const virtualElements: VirtualToken[] = [];
    const recoveryErrors: ParserRecoveryError[] = [];
    let virtualClosingToken: VirtualToken | null = null;

    const recordMissingComma = (referenceToken: IToken | undefined) => {
      if (mode !== 'expression') {
        return;
      }
      const virtualComma = createSyntheticToken(',', Comma, referenceToken, VirtualTokenReason.MISSING_COMMA) as VirtualToken;
      virtualSeparators.push(virtualComma);
      const error: ParserRecoveryError = {
        code: 'MISSING_COMMA',
        message: `Missing ',' between elements`,
        suggestion: 'Separate elements with a comma.',
        severity: 'error',
      };
      recoveryErrors.push(error);
      parser.reportRecoveryError(virtualComma, error.message, {
        code: error.code,
        suggestion: error.suggestion,
      });
    };

    const recordMissingElement = (referenceToken: IToken | undefined, context: 'empty' | 'trailing') => {
      if (mode !== 'expression') {
        return;
      }
      const reason = context === 'trailing'
        ? VirtualTokenReason.TRAILING_COMMA
        : VirtualTokenReason.MISSING_ARGUMENT;
      const virtualElement = createSyntheticToken(
        '__missing_element__',
        IdentifierToken,
        referenceToken,
        reason,
      ) as VirtualToken;
      virtualElements.push(virtualElement);
      const error: ParserRecoveryError = {
        code: context === 'trailing' ? 'TRAILING_COMMA' : 'EMPTY_ARGUMENT',
        message: context === 'trailing'
          ? 'Trailing comma without argument'
          : 'Missing argument between commas',
        suggestion: context === 'trailing'
          ? 'Remove the trailing comma or provide an element after it.'
          : 'Provide an argument between these commas.',
        severity: 'error',
      };
      recoveryErrors.push(error);
      parser.reportRecoveryError(virtualElement, error.message, {
        code: error.code,
        suggestion: error.suggestion,
      });
    };

    while (true) {
      const next = parser.lookAhead(1);
      const tokenType = next.tokenType;

      if (tokenType === RBracket || tokenType === EOF) {
        if (expectElement && tokenType === RBracket && elements.length > 0) {
          recordMissingElement(parser.lookAhead(0), 'trailing');
          elements.push(null);
          expectElement = false;
        }
        break;
      }

      if (tokenType === Newline) {
        parser.consumeToken(Newline);
        continue;
      }

      if (tokenType === Comma) {
        parser.consumeToken(Comma);
        if (expectElement) {
          recordMissingElement(parser.lookAhead(0), 'empty');
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

    while (parser.lookAhead(1).tokenType === Newline) {
      parser.consumeToken(Newline);
    }

    let closingToken = parser.lookAhead(1);
    if (closingToken.tokenType === RBracket) {
      closingToken = parser.consumeToken(RBracket);
    } else {
      const virtualClosing = createSyntheticToken(']', RBracket, parser.lookAhead(0), VirtualTokenReason.MISSING_BRACKET) as VirtualToken;
      virtualClosingToken = virtualClosing;
      const error: ParserRecoveryError = {
        code: 'MISSING_BRACKET',
        message: 'Missing closing bracket',
        suggestion: 'Add "]" to close the collection.',
        severity: 'error',
      };
      recoveryErrors.push(error);
      parser.reportRecoveryError(virtualClosing, error.message, {
        code: error.code,
        suggestion: error.suggestion,
      });
      closingToken = virtualClosing;
    }

    const hasRecovery =
      virtualSeparators.length > 0 ||
      virtualElements.length > 0 ||
      recoveryErrors.length > 0 ||
      virtualClosingToken !== null;

    const collectionRecovery = hasRecovery && mode === 'expression'
      ? {
          virtualSeparators,
          virtualElements,
          virtualClosing: virtualClosingToken,
          errors: recoveryErrors,
        }
      : undefined;

    const tuple = createTupleExpressionNode(
      elements,
      lBracket,
      closingToken,
      mode === 'expression' ? collectionRecovery ?? null : null,
    );
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
        return createMatrixLiteralNode(rows, lBracket, closingToken);
      }
    }

    return createArrayLiteralNode(elements, lBracket, closingToken, collectionRecovery ?? null);
  });
}

export function createPrimaryExpressionRule(parser: PineParser) {
  return parser.createRule('primaryExpression', (): ExpressionNode => {
    const token = parser.lookAhead(1);

    if (isNumberLiteralToken(token)) {
      return createLiteralFromToken(parser.consumeToken(NumberToken));
    }

    switch (token.tokenType) {
      case IdentifierToken:
        return parser.invokeSubrule(parser.identifierExpression);
      case StringToken:
        return createLiteralFromToken(parser.consumeToken(StringToken));
      case ColorToken:
        return createLiteralFromToken(parser.consumeToken(ColorToken));
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
        return parser.invokeSubrule(parser.bracketExpression) as ExpressionNode;
      case LParen: {
        if (isArrowFunctionStart(parser)) {
          return parser.invokeSubrule(parser.arrowFunctionExpression);
        }
        const lParen = parser.consumeToken(LParen);
        while (parser.lookAhead(1).tokenType === Newline) {
          parser.consumeToken(Newline);
        }
        const expression = parser.invokeSubrule(parser.expression);
        while (parser.lookAhead(1).tokenType === Newline) {
          parser.consumeToken(Newline);
        }

        if (parser.lookAhead(1).tokenType === RParen) {
          parser.consumeToken(RParen);
        } else {
          const referenceToken = parser.lookAhead(0) ?? lParen;
          const virtualClosing = createSyntheticToken(')', RParen, referenceToken, VirtualTokenReason.MISSING_PAREN) as VirtualToken;
          const error: ParserRecoveryError = {
            code: 'MISSING_CLOSING_PAREN',
            message: 'Missing closing parenthesis',
            suggestion: 'Add \')\' to close the expression.',
            severity: 'error',
          };
          parser.reportRecoveryError(virtualClosing, error.message, {
            code: error.code,
            suggestion: error.suggestion,
          });
        }
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
      while (parser.lookAhead(1).tokenType === Newline) {
        parser.consumeToken(Newline);
      }
      const propertyToken = parser.consumeToken(IdentifierToken, 2);
      const property = createIdentifierNode(propertyToken);
      expression = createMemberExpressionNode(expression, property, propertyToken);
    });

    return expression;
  });
}

export function createIfExpressionRule(parser: PineParser): () => IfExpressionNode {
  return parser.createRule('ifExpression', (...args: unknown[]) => {
    const baseIndentOverride = args[0] as number | undefined;
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
    if (potentialElse.tokenType === Else && parser.resolveTokenIndent(potentialElse) <= baseIndent) {
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
