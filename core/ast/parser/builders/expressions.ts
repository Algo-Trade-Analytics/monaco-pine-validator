import type { IToken } from 'chevrotain';
import {
  createLocation,
  createRange,
  type ArgumentNode,
  type ArrowFunctionExpressionNode,
  type BinaryExpressionNode,
  type BlockStatementNode,
  type CallExpressionNode,
  type ConditionalExpressionNode,
  type ExpressionNode,
  type IdentifierNode,
  type IfExpressionNode,
  type IndexExpressionNode,
  type MatrixLiteralNode,
  type MemberExpressionNode,
  type ParameterNode,
  type TupleExpressionNode,
  type UnaryExpressionNode,
} from '../../nodes';
import { ensureToken, spanFromNodes, spanFromTokens, tokenEnd, tokenStart } from './base';
import { createIdentifierNode } from './identifiers';

export function createPlaceholderExpression(): ExpressionNode {
  return createIdentifierNode();
}

export function createCallExpressionNode(
  callee: ExpressionNode | undefined,
  args: ArgumentNode[],
  closingToken: IToken | undefined,
): CallExpressionNode {
  const safeCallee = callee ?? createPlaceholderExpression();
  return {
    kind: 'CallExpression',
    callee: safeCallee,
    args,
    ...spanFromNodes(safeCallee, closingToken),
  };
}

export function createArgumentNode(
  name: IdentifierNode | null,
  value: ExpressionNode | undefined,
  startToken: IToken | undefined,
  endToken: IToken | undefined,
): ArgumentNode {
  const valueNode = value ?? createPlaceholderExpression();
  const safeStart = ensureToken(startToken, endToken);
  const safeEnd = ensureToken(endToken, safeStart);
  const span = name ? spanFromTokens(startToken, endToken) : spanFromNodes(valueNode, safeEnd);
  return {
    kind: 'Argument',
    name,
    value: valueNode,
    ...span,
  };
}

export function createMemberExpressionNode(
  object: ExpressionNode | undefined,
  property: IdentifierNode,
  endToken: IToken | undefined,
): MemberExpressionNode {
  const safeObject = object ?? createPlaceholderExpression();
  return {
    kind: 'MemberExpression',
    object: safeObject,
    property,
    computed: false,
    ...spanFromNodes(safeObject, endToken),
  };
}

export function createIndexExpressionNode(
  object: ExpressionNode | undefined,
  index: ExpressionNode | undefined,
  closingToken: IToken | undefined,
): IndexExpressionNode {
  const safeObject = object ?? createPlaceholderExpression();
  const safeIndex = index ?? createPlaceholderExpression();
  return {
    kind: 'IndexExpression',
    object: safeObject,
    index: safeIndex,
    ...spanFromNodes(safeObject, closingToken),
  };
}

export function createTupleExpressionNode(
  elements: (ExpressionNode | null)[],
  startToken: IToken | undefined,
  endToken: IToken | undefined,
): TupleExpressionNode {
  const safeStart = ensureToken(startToken);
  const safeEnd = ensureToken(endToken, safeStart);
  return {
    kind: 'TupleExpression',
    elements,
    ...spanFromTokens(safeStart, safeEnd),
  };
}

export function createMatrixLiteralNode(
  rows: ExpressionNode[][],
  startToken: IToken | undefined,
  endToken: IToken | undefined,
): MatrixLiteralNode {
  const safeStart = ensureToken(startToken);
  const safeEnd = ensureToken(endToken, safeStart);
  return {
    kind: 'MatrixLiteral',
    rows,
    ...spanFromTokens(safeStart, safeEnd),
  };
}

export function createBinaryExpressionNode(
  left: ExpressionNode | undefined,
  operatorToken: IToken | undefined,
  right: ExpressionNode | undefined,
  endToken: IToken | undefined,
): BinaryExpressionNode {
  const leftNode = left ?? createPlaceholderExpression();
  const rightNode = right ?? createPlaceholderExpression();
  const safeOperator = ensureToken(operatorToken);
  return {
    kind: 'BinaryExpression',
    operator: safeOperator.image,
    left: leftNode,
    right: rightNode,
    ...spanFromNodes(leftNode, endToken ?? safeOperator),
  };
}

export function createConditionalExpressionNode(
  test: ExpressionNode | undefined,
  consequent: ExpressionNode | undefined,
  alternate: ExpressionNode | undefined,
  questionToken: IToken | undefined,
  colonToken: IToken | undefined,
  endToken: IToken | undefined,
): ConditionalExpressionNode {
  const testNode = test ?? createPlaceholderExpression();
  const consequentNode = consequent ?? createPlaceholderExpression();
  const alternateNode = alternate ?? createPlaceholderExpression();
  const hasRealAlternate = Boolean(alternate);
  const fallbackEndToken = ensureToken(endToken ?? colonToken ?? questionToken);
  const endPosition = hasRealAlternate ? alternateNode.loc.end : tokenEnd(fallbackEndToken);
  const rangeEnd = hasRealAlternate
    ? alternateNode.range[1]
    : (fallbackEndToken.endOffset ?? fallbackEndToken.startOffset ?? 0) + 1;

  return {
    kind: 'ConditionalExpression',
    test: testNode,
    consequent: consequentNode,
    alternate: alternateNode,
    loc: createLocation(testNode.loc.start, endPosition),
    range: createRange(testNode.range[0], rangeEnd),
  };
}

export function createArrowFunctionExpressionNode(
  params: ParameterNode[],
  body: BlockStatementNode,
  startToken: IToken | undefined,
  endToken: IToken | undefined,
): ArrowFunctionExpressionNode {
  const safeStart = ensureToken(startToken, endToken);
  const startPosition = tokenStart(safeStart);
  const startOffset = safeStart.startOffset ?? 0;
  const spanEnd = endToken ? tokenEnd(endToken) : body.loc.end;
  const rangeEnd = endToken?.endOffset ?? endToken?.startOffset ?? body.range[1];
  return {
    kind: 'ArrowFunctionExpression',
    params,
    body,
    loc: createLocation(startPosition, spanEnd),
    range: createRange(startOffset, rangeEnd),
  };
}

export function createUnaryExpressionNode(
  operatorToken: IToken | undefined,
  argument: ExpressionNode | undefined,
): UnaryExpressionNode {
  const safeOperator = ensureToken(operatorToken);
  const argumentNode = argument ?? createPlaceholderExpression();
  const end = argumentNode.loc.end;
  const rangeEnd = argumentNode.range[1];
  return {
    kind: 'UnaryExpression',
    operator: safeOperator.image,
    argument: argumentNode,
    prefix: true,
    loc: createLocation(tokenStart(safeOperator), end),
    range: createRange(safeOperator.startOffset ?? 0, rangeEnd),
  };
}

export function createIfExpressionNode(
  test: ExpressionNode,
  consequent: BlockStatementNode,
  alternate: IfExpressionNode | BlockStatementNode | null,
  startToken: IToken,
  endToken: IToken | undefined,
): IfExpressionNode {
  const span = spanFromTokens(startToken, endToken ?? startToken);
  return {
    kind: 'IfExpression',
    test,
    consequent,
    alternate,
    ...span,
  };
}
