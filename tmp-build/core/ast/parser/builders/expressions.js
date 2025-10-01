import { createLocation, createRange, } from '../../nodes';
import { ensureToken, spanFromNodes, spanFromTokens, tokenEnd, tokenStart } from './base';
import { createIdentifierNode } from './identifiers';
export function createPlaceholderExpression() {
    return createIdentifierNode();
}
export function createCallExpressionNode(callee, args, closingToken, typeArguments = []) {
    const safeCallee = callee ?? createPlaceholderExpression();
    return {
        kind: 'CallExpression',
        callee: safeCallee,
        args,
        typeArguments,
        ...spanFromNodes(safeCallee, closingToken),
    };
}
export function createArgumentNode(name, value, startToken, endToken) {
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
export function createMemberExpressionNode(object, property, endToken) {
    const safeObject = object ?? createPlaceholderExpression();
    return {
        kind: 'MemberExpression',
        object: safeObject,
        property,
        computed: false,
        ...spanFromNodes(safeObject, endToken),
    };
}
export function createIndexExpressionNode(object, index, closingToken) {
    const safeObject = object ?? createPlaceholderExpression();
    const safeIndex = index ?? createPlaceholderExpression();
    return {
        kind: 'IndexExpression',
        object: safeObject,
        index: safeIndex,
        ...spanFromNodes(safeObject, closingToken),
    };
}
export function createTupleExpressionNode(elements, startToken, endToken) {
    const safeStart = ensureToken(startToken);
    const safeEnd = ensureToken(endToken, safeStart);
    return {
        kind: 'TupleExpression',
        elements,
        ...spanFromTokens(safeStart, safeEnd),
    };
}
export function createArrayLiteralNode(elements, startToken, endToken) {
    const safeStart = ensureToken(startToken);
    const safeEnd = ensureToken(endToken, safeStart);
    return {
        kind: 'ArrayLiteral',
        elements,
        ...spanFromTokens(safeStart, safeEnd),
    };
}
export function createMatrixLiteralNode(rows, startToken, endToken) {
    const safeStart = ensureToken(startToken);
    const safeEnd = ensureToken(endToken, safeStart);
    return {
        kind: 'MatrixLiteral',
        rows,
        ...spanFromTokens(safeStart, safeEnd),
    };
}
export function createBinaryExpressionNode(left, operatorToken, right, endToken) {
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
export function createConditionalExpressionNode(test, consequent, alternate, questionToken, colonToken, endToken) {
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
export function createArrowFunctionExpressionNode(params, body, startToken, endToken) {
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
export function createUnaryExpressionNode(operatorToken, argument) {
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
export function createIfExpressionNode(test, consequent, alternate, startToken, endToken) {
    const span = spanFromTokens(startToken, endToken ?? startToken);
    return {
        kind: 'IfExpression',
        test,
        consequent,
        alternate,
        ...span,
    };
}
