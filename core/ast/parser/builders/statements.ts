import type { IToken } from 'chevrotain';
import {
  createLocation,
  createRange,
  type AssignmentStatementNode,
  type BlockStatementNode,
  type BreakStatementNode,
  type ContinueStatementNode,
  type ExpressionNode,
  type ExpressionStatementNode,
  type ForStatementNode,
  type IfStatementNode,
  type RepeatStatementNode,
  type ReturnStatementNode,
  type StatementNode,
  type SwitchCaseNode,
  type SwitchStatementNode,
  type VariableDeclarationNode,
  type WhileStatementNode,
} from '../../nodes';
import { ensureToken, spanFromNodes, spanFromTokens, tokenEnd, tokenStart } from './base';
import { createPlaceholderExpression } from './expressions';

export function createBlockStatementNode(
  statements: StatementNode[],
  startToken: IToken | undefined,
  endToken: IToken | undefined,
): BlockStatementNode {
  if (statements.length > 0) {
    const first = statements[0];
    const last = statements[statements.length - 1];
    if (first?.loc && last?.loc) {
      return {
        kind: 'BlockStatement',
        body: statements,
        loc: createLocation(first.loc.start, last.loc.end),
        range: createRange(first.range[0], last.range[1]),
      };
    }
  }

  const span = spanFromTokens(startToken, endToken ?? startToken);
  return {
    kind: 'BlockStatement',
    body: statements,
    ...span,
  };
}

export function createIfStatementNode(
  test: ExpressionNode,
  consequent: StatementNode,
  alternate: StatementNode | null,
  startToken: IToken,
  endToken: IToken | undefined,
): IfStatementNode {
  const span = spanFromTokens(startToken, endToken ?? startToken);
  return {
    kind: 'IfStatement',
    test,
    consequent,
    alternate,
    ...span,
  };
}

export function createRepeatStatementNode(
  body: BlockStatementNode,
  test: ExpressionNode,
  result: ExpressionNode | null,
  startToken: IToken,
  endToken: IToken | undefined,
): RepeatStatementNode {
  const span = spanFromTokens(startToken, endToken ?? startToken);
  return {
    kind: 'RepeatStatement',
    body,
    test,
    result,
    resultBinding: null,
    ...span,
  };
}

export function createWhileStatementNode(
  test: ExpressionNode,
  body: BlockStatementNode,
  result: ExpressionNode | null,
  startToken: IToken,
  endToken: IToken | undefined,
): WhileStatementNode {
  const span = spanFromTokens(startToken, endToken ?? startToken);
  return {
    kind: 'WhileStatement',
    test,
    body,
    result,
    resultBinding: null,
    ...span,
  };
}

export function createForStatementNode(
  initializer: VariableDeclarationNode | AssignmentStatementNode | null,
  iterator: ExpressionNode | null,
  iterable: ExpressionNode | null,
  test: ExpressionNode | null,
  update: ExpressionNode | null,
  body: BlockStatementNode,
  result: ExpressionNode | null,
  startToken: IToken,
  endToken: IToken | undefined,
): ForStatementNode {
  const span = spanFromTokens(startToken, endToken ?? startToken);
  return {
    kind: 'ForStatement',
    initializer,
    iterator,
    iterable,
    test,
    update,
    body,
    result,
    resultBinding: null,
    ...span,
  };
}

export function createSwitchStatementNode(
  discriminant: ExpressionNode | undefined,
  cases: SwitchCaseNode[],
  startToken: IToken,
  endToken: IToken | undefined,
): SwitchStatementNode {
  const safeDiscriminant = discriminant ?? createPlaceholderExpression();
  const span = spanFromTokens(startToken, endToken ?? startToken);
  return {
    kind: 'SwitchStatement',
    discriminant: safeDiscriminant,
    cases,
    resultBinding: null,
    ...span,
  };
}

export function createSwitchCaseNode(
  test: ExpressionNode | null,
  consequent: StatementNode[],
  startToken: IToken | undefined,
  arrowToken: IToken,
  endToken: IToken | undefined,
): SwitchCaseNode {
  const safeStartToken = ensureToken(startToken, arrowToken);
  const startPosition = test && test.loc ? test.loc.start : tokenStart(safeStartToken);
  const startOffset = test && test.range ? test.range[0] : safeStartToken.startOffset ?? 0;
  if (consequent.length > 0) {
    const last = consequent[consequent.length - 1];
    return {
      kind: 'SwitchCase',
      test,
      consequent,
      loc: createLocation(startPosition, last.loc.end),
      range: createRange(startOffset, last.range[1]),
    };
  }

  const safeEnd = ensureToken(endToken, arrowToken);
  return {
    kind: 'SwitchCase',
    test,
    consequent,
    loc: createLocation(startPosition, tokenEnd(safeEnd)),
    range: createRange(startOffset, (safeEnd.endOffset ?? safeEnd.startOffset ?? 0) + 1),
  };
}

export function createReturnStatementNode(
  token: IToken,
  argument: ExpressionNode | null,
  endToken: IToken | undefined,
): ReturnStatementNode {
  const span = spanFromTokens(token, endToken ?? token);
  return {
    kind: 'ReturnStatement',
    argument,
    ...span,
  };
}

export function createBreakStatementNode(token: IToken): BreakStatementNode {
  const span = spanFromTokens(token, token);
  return {
    kind: 'BreakStatement',
    ...span,
  };
}

export function createContinueStatementNode(token: IToken): ContinueStatementNode {
  const span = spanFromTokens(token, token);
  return {
    kind: 'ContinueStatement',
    ...span,
  };
}

export function createAssignmentStatementNode(
  left: ExpressionNode | undefined,
  right: ExpressionNode | undefined,
  operatorToken: IToken | undefined,
  endToken: IToken | undefined,
): AssignmentStatementNode {
  const leftNode = left ?? createPlaceholderExpression();
  const safeEnd = ensureToken(endToken, operatorToken);
  const operator = operatorToken?.image ?? '=';
  return {
    kind: 'AssignmentStatement',
    left: leftNode,
    right: right ?? null,
    operator,
    ...spanFromNodes(leftNode, safeEnd),
  };
}

export function createExpressionStatementNode(
  expression: ExpressionNode | undefined,
): ExpressionStatementNode {
  const expr = expression ?? createPlaceholderExpression();
  return {
    kind: 'ExpressionStatement',
    expression: expr,
    loc: expr.loc,
    range: expr.range,
  };
}
