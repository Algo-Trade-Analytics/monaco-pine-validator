import { createLocation, createPosition, createRange, } from '../../nodes';
import { ensureToken, spanFromTokens } from './base';
export function createIdentifierNode(token) {
    const safeToken = ensureToken(token);
    return {
        kind: 'Identifier',
        name: safeToken.image,
        ...spanFromTokens(safeToken, safeToken),
    };
}
export function createIdentifierFromTokens(tokens) {
    if (tokens.length === 0) {
        return createIdentifierNode();
    }
    const start = tokens[0];
    const end = tokens[tokens.length - 1];
    const name = tokens.map((token) => token.image ?? '').join('');
    return {
        kind: 'Identifier',
        name,
        ...spanFromTokens(start, end),
    };
}
export function cloneIdentifierNode(source) {
    if (!source) {
        return null;
    }
    const { name, loc: { start: { line: startLine, column: startColumn, offset: startOffset }, end: { line: endLine, column: endColumn, offset: endOffset }, }, range, } = source;
    return {
        kind: 'Identifier',
        name,
        loc: createLocation(createPosition(startLine, startColumn, startOffset), createPosition(endLine, endColumn, endOffset)),
        range: createRange(range[0], range[1]),
    };
}
