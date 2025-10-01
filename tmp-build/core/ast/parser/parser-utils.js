import { Dot, Identifier as IdentifierToken, Less } from './tokens';
function hasIdentifierCategory(token) {
    const categories = token.tokenType?.CATEGORIES;
    if (!Array.isArray(categories)) {
        return false;
    }
    return categories.includes(IdentifierToken);
}
function isAnnotatableStatement(node) {
    switch (node.kind) {
        case 'ScriptDeclaration':
        case 'FunctionDeclaration':
        case 'TypeDeclaration':
        case 'EnumDeclaration':
        case 'VariableDeclaration':
            return true;
        default:
            return false;
    }
}
export function attachCompilerAnnotations(node, annotations) {
    if (annotations.length === 0) {
        return;
    }
    if (isAnnotatableStatement(node)) {
        node.annotations.push(...annotations);
    }
}
const DECLARATION_KEYWORDS = new Set(['var', 'varip', 'const', 'let', 'simple']);
export function isDeclarationKeywordToken(token) {
    if (!token) {
        return false;
    }
    return DECLARATION_KEYWORDS.has(token.image?.toLowerCase() ?? '');
}
export function toDeclarationKind(image) {
    switch ((image ?? '').toLowerCase()) {
        case 'var':
            return 'var';
        case 'varip':
            return 'varip';
        case 'const':
            return 'const';
        case 'let':
            return 'let';
        case 'simple':
            return 'simple';
        default:
            return 'simple';
    }
}
export function splitDeclarationTokens(tokens) {
    if (tokens.length >= 2 &&
        tokens[0]?.tokenType === IdentifierToken &&
        (tokens[0]?.image ?? '').toLowerCase() === 'this' &&
        tokens[1]?.tokenType === Less) {
        return { typeTokens: [], identifierToken: tokens[0] };
    }
    let lastIdentifierIndex = -1;
    for (let index = tokens.length - 1; index >= 0; index -= 1) {
        const token = tokens[index];
        if (token && (token.tokenType === IdentifierToken || hasIdentifierCategory(token))) {
            lastIdentifierIndex = index;
            break;
        }
    }
    if (lastIdentifierIndex === -1) {
        return { typeTokens: [], identifierToken: undefined };
    }
    return {
        typeTokens: tokens.slice(0, lastIdentifierIndex),
        identifierToken: tokens[lastIdentifierIndex],
    };
}
const FUNCTION_MODIFIER_KEYWORDS = new Set(['method', 'static']);
export function isFunctionModifierToken(token) {
    if (!token) {
        return false;
    }
    return FUNCTION_MODIFIER_KEYWORDS.has(token.image?.toLowerCase() ?? '');
}
export function isExportKeywordToken(token) {
    if (!token) {
        return false;
    }
    return (token.image ?? '').toLowerCase() === 'export';
}
export function isTokenKeyword(token, keyword) {
    return (token?.image ?? '').toLowerCase() === keyword;
}
export function isIdentifierLikeToken(token) {
    if (!token) {
        return false;
    }
    return token.tokenType === IdentifierToken || hasIdentifierCategory(token);
}
export function splitFunctionHeadTokens(tokens) {
    if (tokens.length === 0) {
        return { typeTokens: [], nameTokens: [] };
    }
    let nameStartIndex = tokens.length;
    for (let index = tokens.length - 1; index >= 0; index -= 1) {
        const token = tokens[index];
        if (token?.tokenType !== IdentifierToken) {
            continue;
        }
        nameStartIndex = index;
        let lookbehind = index - 1;
        while (lookbehind >= 0) {
            const separator = tokens[lookbehind];
            if (separator?.tokenType !== Dot) {
                break;
            }
            const potentialIdentifier = tokens[lookbehind - 1];
            if (potentialIdentifier?.tokenType !== IdentifierToken) {
                break;
            }
            lookbehind -= 2;
            nameStartIndex = lookbehind + 1;
        }
        break;
    }
    if (nameStartIndex >= tokens.length) {
        return { typeTokens: tokens, nameTokens: [] };
    }
    return {
        typeTokens: tokens.slice(0, nameStartIndex),
        nameTokens: tokens.slice(nameStartIndex),
    };
}
