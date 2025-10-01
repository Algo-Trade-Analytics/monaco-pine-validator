import { ensureToken, spanFromTokens } from './base';
export function createStringNode(token) {
    const safeToken = ensureToken(token);
    const raw = safeToken.image;
    const value = raw.slice(1, -1);
    return {
        kind: 'StringLiteral',
        value,
        raw,
        ...spanFromTokens(safeToken, safeToken),
    };
}
export function createNumberNode(token) {
    const safeToken = ensureToken(token);
    const raw = safeToken.image;
    const value = Number(raw.replace(/_/g, ''));
    return {
        kind: 'NumberLiteral',
        value,
        raw,
        ...spanFromTokens(safeToken, safeToken),
    };
}
export function createBooleanNode(token, value) {
    const safeToken = ensureToken(token);
    return {
        kind: 'BooleanLiteral',
        value,
        ...spanFromTokens(safeToken, safeToken),
    };
}
export function createNullNode(token) {
    const safeToken = ensureToken(token);
    return {
        kind: 'NullLiteral',
        ...spanFromTokens(safeToken, safeToken),
    };
}
export function createColorLiteralNode(token) {
    const safeToken = ensureToken(token);
    const raw = safeToken.image;
    return {
        kind: 'ColorLiteral',
        value: raw,
        raw,
        ...spanFromTokens(safeToken, safeToken),
    };
}
