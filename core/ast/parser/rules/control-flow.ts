import { EOF, type IToken } from 'chevrotain';
import type {
  AssignmentStatementNode,
  BlockStatementNode,
  ExpressionNode,
  IdentifierNode,
  StatementNode,
  SwitchCaseNode,
  SwitchStatementNode,
  VariableDeclarationNode,
} from '../../nodes';
import {
  cloneIdentifierNode,
  createAssignmentStatementNode,
  createBinaryExpressionNode,
  createBreakStatementNode,
  createContinueStatementNode,
  createExpressionStatementNode,
  createForStatementNode,
  createIdentifierNode,
  createIfStatementNode,
  createNumberNode,
  createPlaceholderExpression,
  createRepeatStatementNode,
  createReturnStatementNode,
  createSwitchCaseNode,
  createSwitchStatementNode,
  createSyntheticToken,
  createWhileStatementNode,
  tokenIndent,
} from '../node-builders';
import { attachLoopResultBinding } from '../helpers';
import type { PineParser } from '../parser';
import {
  Break,
  By,
  ColonEqual,
  Continue,
  Else,
  Equal,
  FatArrow,
  For,
  Identifier as IdentifierToken,
  If,
  In,
  LBracket,
  LessEqual,
  MinusEqual,
  Newline,
  NumberLiteral as NumberToken,
  PercentEqual,
  Plus,
  PlusEqual,
  Repeat,
  Return,
  RBracket,
  SlashEqual,
  StarEqual,
  To,
  Until,
  While,
} from '../tokens';

function extractLoopResult(block: BlockStatementNode): ExpressionNode | null {
  if (block.body.length === 0) {
    return null;
  }

  const lastStatement = block.body[block.body.length - 1];
  if (lastStatement.kind === 'ExpressionStatement') {
    return lastStatement.expression;
  }
  if (lastStatement.kind === 'ReturnStatement') {
    return lastStatement.argument;
  }

  return null;
}

function isStatementTerminator(tokenType: any): boolean {
  return tokenType === Newline || tokenType === EOF || tokenType === Else;
}

function isForInLoopHeader(parser: PineParser): boolean {
  let offset = 1;
  let bracketDepth = 0;

  while (true) {
    const token = parser.LA(offset);
    const tokenType = token.tokenType;

    if (tokenType === EOF || tokenType === Newline) {
      return false;
    }

    if (tokenType === In && bracketDepth === 0) {
      return true;
    }

    if (
      tokenType === Equal ||
      tokenType === ColonEqual ||
      tokenType === PlusEqual ||
      tokenType === MinusEqual ||
      tokenType === StarEqual ||
      tokenType === SlashEqual ||
      tokenType === PercentEqual ||
      tokenType === To ||
      tokenType === By ||
      tokenType === FatArrow
    ) {
      return false;
    }

    if (tokenType === LBracket) {
      bracketDepth += 1;
    } else if (tokenType === RBracket && bracketDepth > 0) {
      bracketDepth -= 1;
    }

    offset += 1;
  }
}

function parseSwitchCaseConsequent(
  parser: PineParser,
  caseIndent: number,
): { statements: StatementNode[]; endToken: IToken | undefined } {
  const statements: StatementNode[] = [];

  const nextTokenType = parser.LA(1).tokenType;

  if (nextTokenType === Newline) {
    const block = parser.parseIndentedBlock(caseIndent);
    statements.push(...block.body);
    return { statements, endToken: parser.LA(0) };
  }

  if (isStatementTerminator(nextTokenType)) {
    return { statements, endToken: parser.LA(0) };
  }

  const expression = parser.SUBRULE(parser.expression);
  statements.push(createExpressionStatementNode(expression));
  return { statements, endToken: parser.LA(0) };
}

export function createExpressionStatementRule(parser: PineParser) {
  return parser.RULE('expressionStatement', () => {
    const expression = parser.SUBRULE(parser.expression);
    return createExpressionStatementNode(expression);
  });
}

export function createTupleAssignmentStatementRule(parser: PineParser) {
  return parser.RULE('tupleAssignmentStatement', () => {
    const left = parser.SUBRULE(parser.bracketExpression, { ARGS: ['tuple'] });
    const operator = parser.OR([
      { ALT: () => parser.CONSUME(Equal) },
      { ALT: () => parser.CONSUME(ColonEqual) },
      { ALT: () => parser.CONSUME(PlusEqual) },
      { ALT: () => parser.CONSUME(MinusEqual) },
      { ALT: () => parser.CONSUME(StarEqual) },
      { ALT: () => parser.CONSUME(SlashEqual) },
      { ALT: () => parser.CONSUME(PercentEqual) },
    ]);
    const right = parser.SUBRULE(parser.expression);
    const endToken = parser.LA(0);
    const assignment = createAssignmentStatementNode(left, right, operator, endToken);
    const operatorImage = operator.image;
    if ((operatorImage === '=' || operatorImage === ':=') && right) {
      attachLoopResultBinding(right, {
        kind: 'tupleAssignment',
        target: assignment.left,
        operator: operatorImage,
      });
    }
    return assignment;
  });
}

export function createAssignmentStatementRule(parser: PineParser) {
  return parser.RULE('assignmentStatement', () => {
    const left = parser.SUBRULE(parser.assignmentTarget);
    const operator = parser.OR([
      { ALT: () => parser.CONSUME(Equal) },
      { ALT: () => parser.CONSUME(ColonEqual) },
      { ALT: () => parser.CONSUME(PlusEqual) },
      { ALT: () => parser.CONSUME(MinusEqual) },
      { ALT: () => parser.CONSUME(StarEqual) },
      { ALT: () => parser.CONSUME(SlashEqual) },
      { ALT: () => parser.CONSUME(PercentEqual) },
    ]);
    const right = parser.SUBRULE(parser.expression);
    const endToken = parser.LA(0);
    const assignment = createAssignmentStatementNode(left, right, operator, endToken);
    const operatorImage = operator.image;
    if ((operatorImage === '=' || operatorImage === ':=') && right) {
      attachLoopResultBinding(right, {
        kind: 'assignment',
        target: assignment.left,
        operator: operatorImage,
      });
    }
    return assignment;
  });
}

export function createIfStatementRule(parser: PineParser) {
  return parser.RULE('ifStatement', (indentOverride?: number) => {
    const ifToken = parser.CONSUME(If);
    const test = parser.SUBRULE(parser.expression);
    const indent = indentOverride ?? tokenIndent(ifToken);
    const consequent = parser.parseIndentedBlock(indent);

    let alternate: StatementNode | null = null;

    let offset = 1;
    while (parser.LA(offset).tokenType === Newline) {
      offset += 1;
    }
    const potentialElse = parser.LA(offset);
    if (potentialElse.tokenType === Else && tokenIndent(potentialElse) <= indent) {
      while (parser.LA(1).tokenType === Newline) {
        parser.CONSUME(Newline);
      }
      const elseToken = parser.CONSUME(Else);
      if (parser.LA(1).tokenType === If) {
        alternate = parser.SUBRULE2(parser.ifStatement, { ARGS: [tokenIndent(elseToken)] });
      } else if (parser.LA(1).tokenType === Newline) {
        alternate = parser.parseIndentedBlock(tokenIndent(elseToken));
      } else {
        alternate = parser.SUBRULE2(parser.statement);
      }
    }

    const endToken = parser.LA(0);
    return createIfStatementNode(test, consequent, alternate, ifToken, endToken);
  });
}

export function createForStatementRule(parser: PineParser) {
  return parser.RULE('forStatement', () => {
    const forToken = parser.CONSUME(For);
    return parser.parseForLoop(forToken);
  });
}

export function createParseForLoop(parser: PineParser) {
  return (forToken: IToken) => {
    let initializer: VariableDeclarationNode | AssignmentStatementNode | null = null;
    let iterator: ExpressionNode | null = null;
    let iterable: ExpressionNode | null = null;

    if (isForInLoopHeader(parser)) {
      iterator = parser.SUBRULE(parser.forIteratorTarget);
      parser.CONSUME(In);
      iterable = parser.SUBRULE(parser.expression) ?? createPlaceholderExpression();
    } else {
      if (parser.isVariableDeclarationStart()) {
        initializer = parser.SUBRULE(parser.variableDeclaration);
      } else if (parser.isAssignmentStart()) {
        initializer = parser.SUBRULE(parser.assignmentStatement);
      }
    }

    const loopIdentifier: IdentifierNode | null = initializer
      ? initializer.kind === 'VariableDeclaration'
        ? initializer.identifier
        : initializer.kind === 'AssignmentStatement' && initializer.left.kind === 'Identifier'
          ? (initializer.left as IdentifierNode)
          : null
      : null;

    let test: ExpressionNode | null = null;
    let update: ExpressionNode | null = null;

    if (!iterable && parser.LA(1).tokenType === To) {
      const toToken = parser.CONSUME(To);
      const endExpression = parser.SUBRULE(parser.expression) ?? createPlaceholderExpression();
      const endToken = parser.LA(0);

      const testIdentifier = cloneIdentifierNode(loopIdentifier);
      if (testIdentifier) {
        const operatorToken = createSyntheticToken('<=', LessEqual, toToken);
        test = createBinaryExpressionNode(testIdentifier, operatorToken, endExpression, endToken);
      } else {
        test = endExpression;
      }

      if (parser.LA(1).tokenType === By) {
        const byToken = parser.CONSUME(By);
        const stepExpression = parser.SUBRULE2(parser.expression) ?? createPlaceholderExpression();
        const updateEndToken = parser.LA(0);
        const updateIdentifier = cloneIdentifierNode(loopIdentifier);
        if (updateIdentifier) {
          const operatorToken = createSyntheticToken('+', Plus, byToken);
          update = createBinaryExpressionNode(updateIdentifier, operatorToken, stepExpression, updateEndToken);
        } else {
          update = stepExpression;
        }
      } else {
        const updateIdentifier = cloneIdentifierNode(loopIdentifier);
        if (updateIdentifier) {
          const defaultStepToken = createSyntheticToken('1', NumberToken, toToken);
          const defaultStep = createNumberNode(defaultStepToken);
          const operatorToken = createSyntheticToken('+', Plus, toToken);
          update = createBinaryExpressionNode(updateIdentifier, operatorToken, defaultStep, defaultStepToken);
        }
      }
    }

    const body = parser.parseIndentedBlock(tokenIndent(forToken));
    const result = extractLoopResult(body);
    const endToken = parser.LA(0);
    return createForStatementNode(
      initializer,
      iterator,
      iterable,
      test,
      update,
      body,
      result,
      forToken,
      endToken,
    );
  };
}

export function createForIteratorTargetRule(parser: PineParser) {
  return parser.RULE('forIteratorTarget', (): ExpressionNode => {
    const next = parser.LA(1);
    if (next.tokenType === LBracket) {
      const tuple = parser.SUBRULE(parser.bracketExpression, { ARGS: ['tuple'] });
      return tuple ?? createPlaceholderExpression();
    }

    const identifierToken = parser.CONSUME(IdentifierToken);
    return createIdentifierNode(identifierToken);
  });
}

export function createSwitchStatementRule(parser: PineParser) {
  return parser.RULE('switchStatement', () => parser.SUBRULE(parser.switchExpression));
}

export function createSwitchCaseRule(parser: PineParser) {
  return parser.RULE('switchCase', () => {
    const startToken = parser.LA(1);
    let test: ExpressionNode | null = null;

    if (startToken.tokenType === FatArrow) {
      const arrowToken = parser.CONSUME(FatArrow);
      const { statements, endToken } = parseSwitchCaseConsequent(parser, tokenIndent(startToken));
      return createSwitchCaseNode(test, statements, startToken, arrowToken, endToken);
    }

    test = parser.SUBRULE(parser.expression);
    const arrowToken = parser.CONSUME(FatArrow);
    const { statements, endToken } = parseSwitchCaseConsequent(parser, tokenIndent(startToken));
    return createSwitchCaseNode(test, statements, startToken, arrowToken, endToken);
  });
}

export function createParseSwitchStructure(parser: PineParser) {
  return (switchToken: IToken): SwitchStatementNode => {
    const discriminant = parser.SUBRULE(parser.expression) ?? createPlaceholderExpression();
    let indent = tokenIndent(switchToken);
    const cases: SwitchCaseNode[] = [];

    let lastToken: IToken | undefined;

    if (parser.LA(1).tokenType === Newline) {
      lastToken = parser.CONSUME(Newline);
    }

    let lookaheadOffset = 1;
    let lookahead = parser.LA(lookaheadOffset);
    while (lookahead.tokenType === Newline) {
      lookaheadOffset += 1;
      lookahead = parser.LA(lookaheadOffset);
    }
    if (lookahead.tokenType !== EOF) {
      const lookaheadIndent = tokenIndent(lookahead);
      if (lookaheadIndent <= indent) {
        indent = Math.max(0, lookaheadIndent - 1);
      }
    }

    let shouldBreak = false;
    while (!shouldBreak) {
      let next = parser.LA(1);

      while (next.tokenType === Newline) {
        let innerOffset = 2;
        let innerLookahead = parser.LA(innerOffset);
        while (innerLookahead.tokenType === Newline) {
          innerOffset += 1;
          innerLookahead = parser.LA(innerOffset);
        }

        if (innerLookahead.tokenType === EOF) {
          const newlineToken = parser.CONSUME(Newline);
          lastToken = newlineToken;
          next = parser.LA(1);
          continue;
        }

        if (tokenIndent(innerLookahead) <= indent) {
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

      next = parser.LA(1);
      if (next.tokenType === EOF || tokenIndent(next) <= indent) {
        break;
      }

      const caseNode = parser.SUBRULE(parser.switchCase);
      cases.push(caseNode);
      lastToken = parser.LA(0);
    }

    const endToken = parser.LA(0) ?? lastToken ?? switchToken;
    return createSwitchStatementNode(discriminant, cases, switchToken, endToken);
  };
}

export function createWhileStatementRule(parser: PineParser) {
  return parser.RULE('whileStatement', () => {
    const whileToken = parser.CONSUME(While);
    return parser.parseWhileLoop(whileToken);
  });
}

export function createParseWhileLoop(parser: PineParser) {
  return (whileToken: IToken) => {
    const test = parser.SUBRULE(parser.expression) ?? createPlaceholderExpression();
    const body = parser.parseIndentedBlock(tokenIndent(whileToken));
    const result = extractLoopResult(body);
    const endToken = parser.LA(0);
    return createWhileStatementNode(test, body, result, whileToken, endToken);
  };
}

export function createRepeatStatementRule(parser: PineParser) {
  return parser.RULE('repeatStatement', () => {
    const repeatToken = parser.CONSUME(Repeat);
    const body = parser.parseIndentedBlock(tokenIndent(repeatToken));
    const result = extractLoopResult(body);
    parser.MANY(() => parser.CONSUME(Newline));
    const untilToken = parser.CONSUME(Until);
    const test = parser.SUBRULE(parser.expression) ?? createPlaceholderExpression();
    const endToken = parser.LA(0);
    return createRepeatStatementNode(body, test, result, repeatToken, endToken ?? untilToken);
  });
}

export function createReturnStatementRule(parser: PineParser) {
  return parser.RULE('returnStatement', () => {
    const returnToken = parser.CONSUME(Return);
    let argument: ExpressionNode | null = null;
    const nextTokenType = parser.LA(1).tokenType;
    if (!isStatementTerminator(nextTokenType)) {
      argument = parser.SUBRULE(parser.expression) ?? null;
    }
    const endToken = argument ? parser.LA(0) : returnToken;
    return createReturnStatementNode(returnToken, argument, endToken);
  });
}

export function createBreakStatementRule(parser: PineParser) {
  return parser.RULE('breakStatement', () => {
    const token = parser.CONSUME(Break);
    return createBreakStatementNode(token);
  });
}

export function createContinueStatementRule(parser: PineParser) {
  return parser.RULE('continueStatement', () => {
    const token = parser.CONSUME(Continue);
    return createContinueStatementNode(token);
  });
}
