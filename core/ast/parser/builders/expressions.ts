import type { IToken } from 'chevrotain';
import {
  createLocation,
  createRange,
  type ArgumentNode,
  type ArrowFunctionExpressionNode,
  type BinaryExpressionNode,
  type BinaryExpressionRecovery,
  type BlockStatementNode,
  type CallExpressionNode,
  type ConditionalExpressionNode,
  type ExpressionNode,
  type IdentifierNode,
  type IfExpressionNode,
  type IndexExpressionNode,
  type ArrayLiteralNode,
  type MatrixLiteralNode,
  type MemberExpressionNode,
  type ParameterNode,
  type TypeReferenceNode,
  type TupleExpressionNode,
  type UnaryExpressionNode,
  type CallArgumentRecovery,
  type ConditionalExpressionRecovery,
  type CollectionRecovery,
  type IndexExpressionRecovery,
} from '../../nodes';
import { ensureToken, spanFromNodes, spanFromTokens, tokenEnd, tokenStart } from './base';
import { createIdentifierNode } from './identifiers';

export function createPlaceholderExpression(token?: IToken): ExpressionNode {
  return createIdentifierNode(token);
}

export function createCallExpressionNode(
  callee: ExpressionNode | undefined,
  args: ArgumentNode[],
  closingToken: IToken | undefined,
  typeArguments: TypeReferenceNode[] = [],
  recovery?: CallArgumentRecovery | null,
): CallExpressionNode {
  const safeCallee = callee ?? createPlaceholderExpression();
  const virtualSeparators = recovery?.virtualSeparators ?? [];
  const virtualArguments = recovery?.virtualArguments ?? [];
  const virtualArgumentDetails = recovery?.virtualArgumentDetails ?? [];
  const errors = recovery?.errors ?? [];
  const virtualClosing = recovery?.virtualClosing ?? null;
  const hasRecovery =
    virtualSeparators.length > 0 ||
    errors.length > 0 ||
    virtualArguments.length > 0 ||
    virtualClosing !== null;
  const argumentRecovery =
    hasRecovery
      ? {
          virtualSeparators,
          virtualArguments,
          virtualArgumentDetails,
          virtualClosing,
          errors,
        }
      : undefined;
  return {
    kind: 'CallExpression',
    callee: safeCallee,
    args,
    typeArguments,
    argumentRecovery,
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
  recovery?: IndexExpressionRecovery | null,
): IndexExpressionNode {
  const safeObject = object ?? createPlaceholderExpression();
  const safeIndex = index ?? createPlaceholderExpression();
  return {
    kind: 'IndexExpression',
    object: safeObject,
    index: safeIndex,
    indexRecovery: recovery ?? undefined,
    ...spanFromNodes(safeObject, closingToken),
  };
}

export function createTupleExpressionNode(
  elements: (ExpressionNode | null)[],
  startToken: IToken | undefined,
  endToken: IToken | undefined,
  recovery?: CollectionRecovery | null,
): TupleExpressionNode {
  const safeStart = ensureToken(startToken);
  const safeEnd = ensureToken(endToken, safeStart);
  return {
    kind: 'TupleExpression',
    elements,
    collectionRecovery: recovery ?? undefined,
    ...spanFromTokens(safeStart, safeEnd),
  };
}

export function createArrayLiteralNode(
  elements: (ExpressionNode | null)[],
  startToken: IToken | undefined,
  endToken: IToken | undefined,
  recovery?: CollectionRecovery | null,
): ArrayLiteralNode {
  const safeStart = ensureToken(startToken);
  const safeEnd = ensureToken(endToken, safeStart);
  return {
    kind: 'ArrayLiteral',
    elements,
    collectionRecovery: recovery ?? undefined,
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
  recovery?: BinaryExpressionRecovery | BinaryExpressionRecovery[] | null,
): BinaryExpressionNode {
  const leftNode = left ?? createPlaceholderExpression();
  const rightNode = right ?? createPlaceholderExpression();
  const safeOperator = ensureToken(operatorToken);
  const recoveries =
    recovery == null
      ? undefined
      : Array.isArray(recovery)
        ? recovery
        : [recovery];
  return {
    kind: 'BinaryExpression',
    operator: safeOperator.image,
    left: leftNode,
    right: rightNode,
    binaryRecovery: recoveries,
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
  recovery?: ConditionalExpressionRecovery | null,
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
  const conditionalRecovery = recovery ?? undefined;

  return {
    kind: 'ConditionalExpression',
    test: testNode,
    consequent: consequentNode,
    alternate: alternateNode,
    conditionalRecovery,
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
