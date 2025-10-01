import { createLocation, createRange, } from '../../nodes';
import { createFallbackToken, ensureToken, spanFromNodes, spanFromTokens, tokenEnd, tokenStart, createSyntheticToken, } from './base';
import { createPlaceholderExpression } from './expressions';
import { createIdentifierNode } from './identifiers';
import { createStringNode } from './literals';
import { Comma, Greater, Less, Return } from '../tokens';
import { isIdentifierLikeToken } from '../parser-utils';
export function createParameterNode(identifier, typeAnnotation, defaultValue, startToken) {
    const startPosition = startToken ? tokenStart(startToken) : identifier.loc.start;
    const startOffset = startToken?.startOffset ?? identifier.range[0];
    const valueNode = defaultValue ?? null;
    const endNode = defaultValue ?? identifier;
    return {
        kind: 'Parameter',
        identifier,
        typeAnnotation,
        defaultValue: valueNode,
        loc: createLocation(startPosition, endNode.loc.end),
        range: createRange(startOffset, endNode.range[1]),
    };
}
export function createFunctionDeclarationNode(identifier, params, body, isExported, returnType, modifiers, startToken) {
    const startPosition = startToken ? tokenStart(startToken) : identifier?.loc.start ?? body.loc.start;
    const startOffset = startToken?.startOffset ?? identifier?.range[0] ?? body.range[0];
    return {
        kind: 'FunctionDeclaration',
        identifier,
        params,
        body,
        export: isExported,
        returnType,
        annotations: [],
        modifiers,
        loc: createLocation(startPosition, body.loc.end),
        range: createRange(startOffset, body.range[1]),
    };
}
export function createImplicitReturnStatementNode(expression, arrowToken) {
    const returnToken = createSyntheticToken('return', Return, arrowToken);
    const value = expression ?? createPlaceholderExpression();
    const endPosition = value.loc?.end ?? tokenEnd(returnToken);
    const rangeEnd = value.range?.[1] ?? (returnToken.endOffset ?? returnToken.startOffset ?? 0);
    return {
        kind: 'ReturnStatement',
        argument: value,
        loc: createLocation(tokenStart(returnToken), endPosition),
        range: createRange(returnToken.startOffset ?? 0, rangeEnd),
    };
}
export function createVariableDeclarationNode(declarationKind, identifier, identifierToken, typeAnnotation, initializer, initializerOperator, startToken) {
    const safeStart = ensureToken(startToken, identifierToken);
    const endNode = initializer ?? identifier;
    return {
        kind: 'VariableDeclaration',
        declarationKind,
        identifier,
        typeAnnotation,
        initializer: initializer ?? null,
        annotations: [],
        initializerOperator,
        loc: createLocation(tokenStart(safeStart), endNode.loc.end),
        range: createRange(safeStart.startOffset ?? 0, endNode.range[1]),
    };
}
export function createScriptDeclarationNode(type, args, start, end) {
    return {
        kind: 'ScriptDeclaration',
        scriptType: type,
        identifier: null,
        arguments: args,
        annotations: [],
        ...spanFromTokens(start, end),
    };
}
export function createImportDeclarationNode(pathToken, aliasToken, startToken, endToken) {
    const path = createStringNode(pathToken);
    const alias = createIdentifierNode(aliasToken);
    return {
        kind: 'ImportDeclaration',
        path,
        alias,
        ...spanFromTokens(startToken ?? pathToken, endToken ?? aliasToken ?? pathToken),
    };
}
export function createEnumMemberNode(identifier, value, _startToken, endToken) {
    return {
        kind: 'EnumMember',
        identifier,
        value,
        ...spanFromNodes(identifier, endToken),
    };
}
export function createEnumDeclarationNode(identifier, members, isExported, startToken, endToken) {
    if (members.length > 0) {
        const first = members[0];
        const last = members[members.length - 1];
        const startPosition = startToken ? tokenStart(startToken) : first.loc.start;
        const startOffset = startToken?.startOffset ?? first.range[0];
        return {
            kind: 'EnumDeclaration',
            identifier,
            members,
            export: isExported,
            annotations: [],
            loc: createLocation(startPosition, last.loc.end),
            range: createRange(startOffset, last.range[1]),
        };
    }
    const startPosition = startToken ? tokenStart(startToken) : identifier.loc.start;
    const endPosition = endToken ? tokenEnd(endToken) : identifier.loc.end;
    const startOffset = startToken?.startOffset ?? identifier.range[0];
    const endOffset = endToken
        ? (endToken.endOffset ?? endToken.startOffset ?? identifier.range[1]) + 1
        : identifier.range[1];
    return {
        kind: 'EnumDeclaration',
        identifier,
        members,
        export: isExported,
        annotations: [],
        loc: createLocation(startPosition, endPosition),
        range: createRange(startOffset, endOffset),
    };
}
export function createTypeFieldNode(identifier, typeAnnotation, startToken, endToken) {
    if (typeAnnotation) {
        return {
            kind: 'TypeField',
            identifier,
            typeAnnotation,
            loc: createLocation(typeAnnotation.loc.start, identifier.loc.end),
            range: createRange(typeAnnotation.range[0], identifier.range[1]),
        };
    }
    if (startToken) {
        return {
            kind: 'TypeField',
            identifier,
            typeAnnotation,
            ...spanFromTokens(startToken, endToken ?? startToken),
        };
    }
    return {
        kind: 'TypeField',
        identifier,
        typeAnnotation,
        loc: identifier.loc,
        range: identifier.range,
    };
}
export function createTypeDeclarationNode(identifier, fields, isExported, startToken, endToken) {
    if (fields.length > 0) {
        const first = fields[0];
        const last = fields[fields.length - 1];
        const startPosition = startToken ? tokenStart(startToken) : first.loc.start;
        const startOffset = startToken?.startOffset ?? first.range[0];
        return {
            kind: 'TypeDeclaration',
            identifier,
            fields,
            export: isExported,
            annotations: [],
            loc: createLocation(startPosition, last.loc.end),
            range: createRange(startOffset, last.range[1]),
        };
    }
    const startPosition = startToken ? tokenStart(startToken) : identifier.loc.start;
    const endPosition = endToken ? tokenEnd(endToken) : identifier.loc.end;
    const startOffset = startToken?.startOffset ?? identifier.range[0];
    const endOffset = endToken
        ? (endToken.endOffset ?? endToken.startOffset ?? identifier.range[1]) + 1
        : identifier.range[1];
    return {
        kind: 'TypeDeclaration',
        identifier,
        fields,
        export: isExported,
        annotations: [],
        loc: createLocation(startPosition, endPosition),
        range: createRange(startOffset, endOffset),
    };
}
export function createVersionDirectiveNode(token) {
    const safeToken = ensureToken(token);
    const match = /\d+/.exec(safeToken.image);
    const version = match ? Number(match[0]) : 0;
    return {
        kind: 'VersionDirective',
        version,
        ...spanFromTokens(safeToken, safeToken),
    };
}
export function createCompilerAnnotationNode(token) {
    const safeToken = ensureToken(token);
    const image = safeToken.image ?? '';
    const match = image.match(/^\/\/\s*@([A-Za-z_][A-Za-z0-9_]*)(.*)$/);
    const name = match?.[1] ?? '';
    const value = match?.[2]?.trim() ?? '';
    return {
        kind: 'CompilerAnnotation',
        name,
        value,
        ...spanFromTokens(safeToken, safeToken),
    };
}
export function buildTypeReferenceFromTokens(tokens) {
    if (tokens.length === 0) {
        return null;
    }
    let index = 0;
    function parseType() {
        const nameToken = tokens[index] ?? createFallbackToken();
        index += 1;
        const name = createIdentifierNode(nameToken);
        const generics = [];
        let endToken = nameToken;
        if (tokens[index]?.tokenType === Less) {
            const lessToken = tokens[index] ?? nameToken;
            index += 1;
            endToken = lessToken;
            while (index < tokens.length && tokens[index]?.tokenType !== Greater) {
                const child = parseType();
                generics.push(child.node);
                endToken = child.endToken;
                if (tokens[index]?.tokenType === Comma) {
                    endToken = tokens[index] ?? endToken;
                    index += 1;
                }
                else {
                    break;
                }
            }
            if (tokens[index]?.tokenType === Greater) {
                endToken = tokens[index] ?? endToken;
                index += 1;
            }
        }
        while (index < tokens.length && isIdentifierLikeToken(tokens[index])) {
            const child = parseType();
            generics.push(child.node);
            endToken = child.endToken;
        }
        return {
            node: {
                kind: 'TypeReference',
                name,
                generics,
                ...spanFromTokens(nameToken, endToken),
            },
            endToken,
        };
    }
    return parseType().node;
}
