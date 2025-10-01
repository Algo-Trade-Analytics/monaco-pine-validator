import { EOF } from 'chevrotain';
import { createBlockStatementNode, createCompilerAnnotationNode, createExpressionStatementNode, createPlaceholderExpression, tokenIndent, } from './node-builders';
import { attachCompilerAnnotations, isDeclarationKeywordToken, isExportKeywordToken, isFunctionModifierToken, isIdentifierLikeToken, } from './parser-utils';
import { ColonEqual, Comma, CompilerAnnotation, Dot, Equal, FatArrow, Colon, Greater, LBracket, Less, LParen, MinusEqual, Newline, PercentEqual, PlusEqual, RBracket, RParen, SlashEqual, StarEqual, } from './tokens';
export function createNextSignificantTokenHelper(parser) {
    return (startOffset) => {
        let offset = startOffset;
        while (true) {
            const token = parser.lookAhead(offset);
            if (token.tokenType === EOF) {
                return token;
            }
            if (token.tokenType !== Newline && token.tokenType !== CompilerAnnotation) {
                return token;
            }
            offset += 1;
        }
    };
}
export function createGetLineIndentHelper(parser, lineIndentCache) {
    return (line) => {
        if (lineIndentCache.has(line)) {
            return lineIndentCache.get(line) ?? 0;
        }
        let indent;
        for (const token of parser.getInputTokens()) {
            if ((token.startLine ?? 0) !== line) {
                continue;
            }
            if (token.tokenType === Newline) {
                continue;
            }
            const startColumn = token.startColumn ?? 1;
            const tokenIndentValue = Math.max(0, startColumn - 1);
            if (indent === undefined || tokenIndentValue < indent) {
                indent = tokenIndentValue;
                if (indent === 0) {
                    break;
                }
            }
        }
        const result = indent ?? 0;
        lineIndentCache.set(line, result);
        return result;
    };
}
export function createParseIfExpressionBranchHelper(parser) {
    return (baseIndent) => {
        if (parser.lookAhead(1).tokenType === Newline) {
            return parser.parseIndentedBlock(baseIndent);
        }
        const startToken = parser.lookAhead(1);
        const value = parser.invokeSubrule(parser.expression) ?? createPlaceholderExpression();
        const endToken = parser.lookAhead(0);
        const statement = createExpressionStatementNode(value);
        return createBlockStatementNode([statement], startToken, endToken);
    };
}
export function createCollectDeclarationTokensHelper(parser) {
    return (startOffset) => {
        const tokens = [];
        let offset = startOffset;
        while (true) {
            const token = parser.lookAhead(offset);
            const tokenType = token.tokenType;
            if (tokenType === EOF || tokenType === Newline || tokenType === Equal || tokenType === ColonEqual) {
                return { tokens, terminator: token };
            }
            if (isIdentifierLikeToken(token) ||
                tokenType === Less ||
                tokenType === Greater ||
                tokenType === Comma) {
                tokens.push(token);
                offset += 1;
                continue;
            }
            if (tokenType === Colon) {
                tokens.push(token);
                offset += 1;
                continue;
            }
            return null;
        }
    };
}
export function createCollectFunctionHeadTokensHelper(parser) {
    return (startOffset) => {
        const tokens = [];
        let offset = startOffset;
        while (true) {
            const token = parser.lookAhead(offset);
            const tokenType = token.tokenType;
            if (tokenType === LParen) {
                return { tokens, lParenOffset: offset };
            }
            if (isIdentifierLikeToken(token) ||
                tokenType === Less ||
                tokenType === Greater ||
                tokenType === Comma ||
                tokenType === Dot) {
                tokens.push(token);
                offset += 1;
                continue;
            }
            if (tokenType === EOF || tokenType === Newline) {
                return null;
            }
            return null;
        }
    };
}
export function createCollectParameterTokensHelper(parser) {
    return (startOffset) => {
        const tokens = [];
        let offset = startOffset;
        let genericDepth = 0;
        while (true) {
            const token = parser.lookAhead(offset);
            const tokenType = token.tokenType;
            if (tokenType === EOF) {
                return tokens;
            }
            if (tokenType === Less) {
                genericDepth += 1;
            }
            else if (tokenType === Greater && genericDepth > 0) {
                genericDepth -= 1;
            }
            if (genericDepth === 0 && (tokenType === Equal || tokenType === Comma || tokenType === RParen)) {
                return tokens;
            }
            if (isIdentifierLikeToken(token) ||
                tokenType === Less ||
                tokenType === Greater ||
                tokenType === Comma ||
                tokenType === Dot) {
                tokens.push(token);
                offset += 1;
                continue;
            }
            return tokens;
        }
    };
}
export function createFunctionDeclarationStartGuard(parser) {
    return () => {
        let offset = 1;
        if (isExportKeywordToken(parser.lookAhead(offset))) {
            offset += 1;
        }
        while (isFunctionModifierToken(parser.lookAhead(offset))) {
            offset += 1;
        }
        const collected = parser.collectFunctionHeadTokens(offset);
        if (!collected || collected.tokens.length === 0) {
            return false;
        }
        let scanOffset = collected.lParenOffset;
        let depth = 0;
        while (true) {
            const token = parser.lookAhead(scanOffset);
            const tokenType = token.tokenType;
            if (tokenType === EOF) {
                return false;
            }
            if (tokenType === LParen) {
                depth += 1;
            }
            else if (tokenType === RParen) {
                depth -= 1;
                if (depth === 0) {
                    scanOffset += 1;
                    break;
                }
            }
            if (tokenType === Newline && depth === 0) {
                return false;
            }
            scanOffset += 1;
        }
        while (parser.lookAhead(scanOffset).tokenType === Newline) {
            scanOffset += 1;
        }
        return parser.lookAhead(scanOffset).tokenType === FatArrow;
    };
}
export function createVariableDeclarationStartGuard(parser) {
    return () => {
        const first = parser.lookAhead(1);
        if (isDeclarationKeywordToken(first)) {
            const collected = parser.collectDeclarationTokens(2);
            if (!collected) {
                return false;
            }
            const identifierCount = collected.tokens.filter((token) => isIdentifierLikeToken(token)).length;
            if (identifierCount === 0) {
                return false;
            }
            const terminatorType = collected.terminator.tokenType;
            return (terminatorType === Equal ||
                terminatorType === ColonEqual ||
                terminatorType === Newline ||
                terminatorType === EOF);
        }
        const collected = parser.collectDeclarationTokens(1);
        if (!collected) {
            return false;
        }
        const terminatorType = collected.terminator.tokenType;
        if (terminatorType !== Equal && terminatorType !== ColonEqual) {
            return false;
        }
        const identifierCount = collected.tokens.filter((token) => isIdentifierLikeToken(token)).length;
        return identifierCount >= 2;
    };
}
export function createTupleAssignmentStartGuard(parser) {
    return () => {
        if (parser.lookAhead(1).tokenType !== LBracket) {
            return false;
        }
        let offset = 2;
        let depth = 1;
        while (depth > 0) {
            const token = parser.lookAhead(offset);
            const tokenType = token.tokenType;
            if (tokenType === LBracket) {
                depth += 1;
            }
            else if (tokenType === RBracket) {
                depth -= 1;
            }
            else if (tokenType === EOF) {
                return false;
            }
            offset += 1;
        }
        while (parser.lookAhead(offset).tokenType === Newline) {
            offset += 1;
        }
        const terminator = parser.lookAhead(offset).tokenType;
        return (terminator === Equal ||
            terminator === ColonEqual ||
            terminator === PlusEqual ||
            terminator === MinusEqual ||
            terminator === StarEqual ||
            terminator === SlashEqual ||
            terminator === PercentEqual);
    };
}
export function createAssignmentStartGuard(parser) {
    return () => {
        const first = parser.lookAhead(1);
        if (first.tokenType === LBracket) {
            let offset = 2;
            let depth = 1;
            while (depth > 0) {
                const token = parser.lookAhead(offset);
                const tokenType = token.tokenType;
                if (tokenType === LBracket) {
                    depth += 1;
                }
                else if (tokenType === RBracket) {
                    depth -= 1;
                }
                else if (tokenType === EOF) {
                    return false;
                }
                offset += 1;
            }
            while (parser.lookAhead(offset).tokenType === Newline) {
                offset += 1;
            }
            const terminator = parser.lookAhead(offset).tokenType;
            return (terminator === Equal ||
                terminator === ColonEqual ||
                terminator === PlusEqual ||
                terminator === MinusEqual ||
                terminator === StarEqual ||
                terminator === SlashEqual ||
                terminator === PercentEqual);
        }
        if (!isIdentifierLikeToken(first)) {
            return false;
        }
        let offset = 2;
        while (true) {
            const token = parser.lookAhead(offset);
            const tokenType = token.tokenType;
            if (tokenType === Equal ||
                tokenType === ColonEqual ||
                tokenType === PlusEqual ||
                tokenType === MinusEqual ||
                tokenType === StarEqual ||
                tokenType === SlashEqual ||
                tokenType === PercentEqual) {
                return true;
            }
            if (tokenType === Dot) {
                offset += 1;
                const next = parser.lookAhead(offset);
                if (!isIdentifierLikeToken(next)) {
                    return false;
                }
                offset += 1;
                continue;
            }
            if (tokenType === LBracket) {
                offset += 1;
                let bracketDepth = 1;
                while (bracketDepth > 0) {
                    const inner = parser.lookAhead(offset);
                    const innerType = inner.tokenType;
                    if (innerType === LBracket) {
                        bracketDepth += 1;
                    }
                    else if (innerType === RBracket) {
                        bracketDepth -= 1;
                    }
                    else if (innerType === EOF || innerType === Newline) {
                        return false;
                    }
                    offset += 1;
                }
                continue;
            }
            if (tokenType === Newline || tokenType === LParen || tokenType === Comma || tokenType === RParen) {
                return false;
            }
            if (tokenType === EOF) {
                return false;
            }
            return false;
        }
    };
}
export function createParseIndentedBlockHelper(parser) {
    return (indent) => {
        const statements = [];
        let blockStartToken;
        let firstStatementToken;
        let lastToken;
        if (parser.lookAhead(1).tokenType === Newline) {
            const newlineToken = parser.consumeToken(Newline);
            blockStartToken = blockStartToken ?? newlineToken;
            lastToken = newlineToken;
        }
        let shouldBreak = false;
        while (!shouldBreak) {
            let next = parser.lookAhead(1);
            while (next.tokenType === Newline) {
                let lookaheadOffset = 2;
                let lookahead = parser.lookAhead(lookaheadOffset);
                while (lookahead.tokenType === Newline) {
                    lookaheadOffset += 1;
                    lookahead = parser.lookAhead(lookaheadOffset);
                }
                if (lookahead.tokenType === EOF) {
                    const newlineToken = parser.consumeToken(Newline);
                    lastToken = newlineToken;
                    next = parser.lookAhead(1);
                    continue;
                }
                if (tokenIndent(lookahead) <= indent) {
                    shouldBreak = true;
                    break;
                }
                const newlineToken = parser.consumeToken(Newline);
                lastToken = newlineToken;
                next = parser.lookAhead(1);
            }
            if (shouldBreak) {
                break;
            }
            const annotations = [];
            while (parser.lookAhead(1).tokenType === CompilerAnnotation) {
                const annotationToken = parser.consumeToken(CompilerAnnotation);
                annotations.push(createCompilerAnnotationNode(annotationToken));
                lastToken = annotationToken;
                while (parser.lookAhead(1).tokenType === Newline) {
                    const newlineToken = parser.consumeToken(Newline);
                    lastToken = newlineToken;
                    const lookahead = parser.lookAhead(1);
                    if (lookahead.tokenType === EOF || tokenIndent(lookahead) <= indent) {
                        shouldBreak = true;
                        break;
                    }
                }
                if (shouldBreak) {
                    break;
                }
            }
            if (shouldBreak) {
                break;
            }
            next = parser.lookAhead(1);
            if (next.tokenType === EOF || tokenIndent(next) <= indent) {
                break;
            }
            const statementStartToken = parser.lookAhead(1);
            const statement = parser.invokeSubrule(parser.statement);
            statements.push(statement);
            firstStatementToken = firstStatementToken ?? statementStartToken;
            lastToken = parser.lookAhead(0);
            attachCompilerAnnotations(statement, annotations);
        }
        return createBlockStatementNode(statements, blockStartToken ?? firstStatementToken, lastToken ?? blockStartToken ?? firstStatementToken);
    };
}
export function attachLoopResultBinding(expression, binding) {
    if (!expression) {
        return;
    }
    switch (expression.kind) {
        case 'ForStatement':
        case 'WhileStatement':
        case 'SwitchStatement':
            expression.resultBinding = binding;
            break;
        default:
            break;
    }
}
