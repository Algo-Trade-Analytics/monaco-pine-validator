import { EOF, type IToken } from 'chevrotain';
import type { PineParser } from '../parser';
import {
  As,
  ColonEqual,
  Comma,
  Enum,
  Equal,
  FatArrow,
  LParen,
  Identifier as IdentifierToken,
  Import,
  Indicator,
  Library,
  Newline,
  StringLiteral as StringToken,
  RParen,
  Strategy,
  Type,
} from '../tokens';
import {
  buildTypeReferenceFromTokens,
  createBlockStatementNode,
  createFunctionDeclarationNode,
  createIdentifierFromTokens,
  createIdentifierNode,
  createImplicitReturnStatementNode,
  createImportDeclarationNode,
  createParameterNode,
  createPlaceholderExpression,
  createScriptDeclarationNode,
  createTypeDeclarationNode,
  createTypeFieldNode,
  createVariableDeclarationNode,
  createEnumDeclarationNode,
  createEnumMemberNode,
  tokenIndent,
} from '../node-builders';
import { attachLoopResultBinding } from '../helpers';
import type {
  ArgumentNode,
  BlockStatementNode,
  EnumMemberNode,
  ExpressionNode,
  IdentifierNode,
  ParameterNode,
  TypeFieldNode,
  VariableDeclarationKind,
} from '../../nodes';
import {
  isDeclarationKeywordToken,
  isExportKeywordToken,
  isFunctionModifierToken,
  splitDeclarationTokens,
  splitFunctionHeadTokens,
  toDeclarationKind,
} from '../parser-utils';

const EOF_TOKEN = EOF;

export function createParameterRule(parser: PineParser) {
  return parser.defineRule('parameter', () => {
    const tokens = parser.collectParameterTokens(1);
    const { typeTokens } = splitDeclarationTokens(tokens);
    const typeAnnotation = buildTypeReferenceFromTokens(typeTokens);

    const consumedTypeTokens = typeTokens.map((token) => parser.consumeToken(token.tokenType));

    const identifierToken = parser.consumeToken(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);

    let defaultValue: ExpressionNode | undefined;
    if (parser.lookAhead(1).tokenType === Equal) {
      parser.consumeToken(Equal);
      defaultValue = parser.invokeSubrule(parser.expression) ?? createPlaceholderExpression();
    }

    const startToken = consumedTypeTokens[0] ?? identifierToken;
    return createParameterNode(identifier, typeAnnotation, defaultValue, startToken);
  });
}

export function createParameterListRule(parser: PineParser) {
  return parser.defineRule('parameterList', () => {
    const params: ParameterNode[] = [];
    params.push(parser.invokeSubrule(parser.parameter));
    parser.repeatMany(() => {
      parser.consumeToken(Comma);
      params.push(parser.invokeSubrule(parser.parameter, 2));
    });
    return params;
  });
}

export function createFunctionDeclarationRule(parser: PineParser) {
  return parser.defineRule('functionDeclaration', (providedExport?: IToken) => {
    let startToken: IToken | undefined = providedExport;
    let exportToken: IToken | undefined = providedExport;

    if (!exportToken && isExportKeywordToken(parser.lookAhead(1))) {
      exportToken = parser.consumeToken(IdentifierToken);
      startToken = exportToken;
    }

    while (isFunctionModifierToken(parser.lookAhead(1))) {
      const modifierToken = parser.consumeToken(IdentifierToken);
      startToken = startToken ?? modifierToken;
    }

    const collected = parser.collectFunctionHeadTokens(1);
    const signatureTokens = collected?.tokens ?? [];
    const split = splitFunctionHeadTokens(signatureTokens);

    const typeTokens = split.typeTokens;
    const nameTokens = split.nameTokens;
    const typeAnnotation = buildTypeReferenceFromTokens(typeTokens);

    const consumedTypeTokens = typeTokens.map((token) => parser.consumeToken(token.tokenType));

    const consumedNameTokens: IToken[] = [];
    let identifier: IdentifierNode | null = null;
    if (nameTokens.length > 0) {
      for (const token of nameTokens) {
        consumedNameTokens.push(parser.consumeToken(token.tokenType));
      }
      identifier = createIdentifierFromTokens(consumedNameTokens);
    } else {
      const fallbackToken = parser.consumeToken(IdentifierToken);
      consumedNameTokens.push(fallbackToken);
      identifier = createIdentifierNode(fallbackToken);
    }

    parser.consumeToken(LParen);
    let params: ParameterNode[] = [];
    if (parser.lookAhead(1).tokenType !== RParen) {
      params = parser.invokeSubrule(parser.parameterList);
    }
    parser.consumeToken(RParen);
    const arrowToken = parser.consumeToken(FatArrow);

    let body: BlockStatementNode;
    const blockIndentToken = startToken ?? consumedTypeTokens[0] ?? consumedNameTokens[0] ?? arrowToken;

    if (parser.lookAhead(1).tokenType === Newline) {
      body = parser.parseIndentedBlock(tokenIndent(blockIndentToken));
    } else {
      const expression = parser.invokeSubrule(parser.expression) ?? createPlaceholderExpression();
      const endToken = parser.lookAhead(0);
      const returnStatement = createImplicitReturnStatementNode(expression, arrowToken);
      body = createBlockStatementNode([returnStatement], arrowToken, endToken);
    }

    const functionStartToken = blockIndentToken;
    return createFunctionDeclarationNode(
      identifier,
      params,
      body,
      Boolean(exportToken),
      typeAnnotation,
      functionStartToken,
    );
  });
}

export function createScriptDeclarationRule(parser: PineParser) {
  return parser.defineRule('scriptDeclaration', () => {
    const token = parser.choose([
      {
        ALT: () => parser.consumeToken(Indicator),
      },
      {
        ALT: () => parser.consumeToken(Strategy),
      },
      {
        ALT: () => parser.consumeToken(Library),
      },
    ]);

    parser.consumeToken(LParen);
    let args: ArgumentNode[] = [];
    if (parser.lookAhead(1).tokenType !== RParen) {
      args = parser.invokeSubrule(parser.argumentList);
    }
    const endToken = parser.consumeToken(RParen);

    const scriptType = token.tokenType === Indicator ? 'indicator' : token.tokenType === Strategy ? 'strategy' : 'library';
    return createScriptDeclarationNode(scriptType, args, token, endToken);
  });
}

export function createImportDeclarationRule(parser: PineParser) {
  return parser.defineRule('importDeclaration', () => {
    const importToken = parser.consumeToken(Import);
    const pathToken = parser.consumeToken(StringToken);
    parser.consumeToken(As);
    const aliasToken = parser.consumeToken(IdentifierToken);
    return createImportDeclarationNode(pathToken, aliasToken, importToken, aliasToken);
  });
}

export function createEnumMemberRule(parser: PineParser) {
  return parser.defineRule('enumMember', (_parentIndent: number) => {
    const identifierToken = parser.consumeToken(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);

    let value: ExpressionNode | null = null;
    let endToken: IToken | undefined = identifierToken;

    if (parser.lookAhead(1).tokenType === Equal) {
      parser.consumeToken(Equal);
      value = parser.invokeSubrule(parser.expression);
      endToken = parser.lookAhead(0);
    }

    return createEnumMemberNode(identifier, value, identifierToken, endToken);
  });
}

export function createEnumDeclarationRule(parser: PineParser) {
  return parser.defineRule('enumDeclaration', (providedExport?: IToken) => {
    let exportToken: IToken | undefined = providedExport;
    if (!exportToken && isExportKeywordToken(parser.lookAhead(1))) {
      exportToken = parser.consumeToken(IdentifierToken);
    }

    const enumToken = parser.consumeToken(Enum);
    const identifierToken = parser.consumeToken(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);

    const members: EnumMemberNode[] = [];
    const indentToken = exportToken ?? enumToken;
    const baseIndent = tokenIndent(indentToken);

    parser.repeatMany(() => parser.consumeToken(Newline));

    while (true) {
      const next = parser.lookAhead(1);
      if (next.tokenType === EOF_TOKEN) {
        break;
      }

      if (next.tokenType === Newline) {
        parser.consumeToken(Newline);
        continue;
      }

      if (tokenIndent(next) <= baseIndent) {
        break;
      }

      const member = parser.invokeSubrule(parser.enumMember, 1, { ARGS: [baseIndent] });
      members.push(member);

      while (parser.lookAhead(1).tokenType === Newline) {
        parser.consumeToken(Newline);
      }
    }

    const endToken = members.length > 0 ? parser.lookAhead(0) : identifierToken;
    return createEnumDeclarationNode(identifier, members, Boolean(exportToken), exportToken ?? enumToken, endToken);
  });
}

export function createTypeFieldRule(parser: PineParser) {
  return parser.defineRule('typeField', () => {
    const collected = parser.collectDeclarationTokens(1);
    const tokens = collected?.tokens ?? [];
    const { typeTokens } = splitDeclarationTokens(tokens);
    const typeAnnotation = buildTypeReferenceFromTokens(typeTokens);

    const consumedTypeTokens = typeTokens.map((token) => parser.consumeToken(token.tokenType));

    const identifierToken = parser.consumeToken(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);
    const startToken = consumedTypeTokens[0] ?? identifierToken;
    return createTypeFieldNode(identifier, typeAnnotation, startToken, identifierToken);
  });
}

export function createTypeDeclarationRule(parser: PineParser) {
  return parser.defineRule('typeDeclaration', (providedExport?: IToken) => {
    let exportToken: IToken | undefined = providedExport;
    if (!exportToken && isExportKeywordToken(parser.lookAhead(1))) {
      exportToken = parser.consumeToken(IdentifierToken);
    }

    const typeToken = parser.consumeToken(Type);
    const identifierToken = parser.consumeToken(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);

    const fields: TypeFieldNode[] = [];
    const indentToken = exportToken ?? typeToken;
    const baseIndent = tokenIndent(indentToken);

    parser.repeatMany(() => parser.consumeToken(Newline));

    while (true) {
      const next = parser.lookAhead(1);
      if (next.tokenType === EOF_TOKEN) {
        break;
      }

      if (next.tokenType === Newline) {
        parser.consumeToken(Newline);
        continue;
      }

      if (tokenIndent(next) <= baseIndent) {
        break;
      }

      const field = parser.invokeSubrule(parser.typeField);
      fields.push(field);

      while (parser.lookAhead(1).tokenType === Newline) {
        parser.consumeToken(Newline);
      }
    }

    const endToken = fields.length > 0 ? parser.lookAhead(0) : identifierToken;
    return createTypeDeclarationNode(identifier, fields, Boolean(exportToken), exportToken ?? typeToken, endToken);
  });
}

export function createVariableDeclarationRule(parser: PineParser) {
  return parser.defineRule('variableDeclaration', () => {
    let declarationKind: VariableDeclarationKind = 'simple';
    let declarationToken: IToken | undefined;

    if (isDeclarationKeywordToken(parser.lookAhead(1))) {
      declarationToken = parser.consumeToken(IdentifierToken);
      declarationKind = toDeclarationKind(declarationToken.image);
    }

    const collected = parser.collectDeclarationTokens(1);
    const tokens = collected?.tokens ?? [];
    const { typeTokens } = splitDeclarationTokens(tokens);
    const typeAnnotation = buildTypeReferenceFromTokens(typeTokens);

    for (const token of typeTokens) {
      parser.consumeToken(token.tokenType);
    }

    const identifierToken = parser.consumeToken(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);

    let initializer: ExpressionNode | undefined;
    let operatorToken: IToken | undefined;
    const nextTokenType = parser.lookAhead(1).tokenType;
    if (nextTokenType === Equal) {
      operatorToken = parser.consumeToken(Equal);
      initializer = parser.invokeSubrule(parser.expression);
    } else if (nextTokenType === ColonEqual) {
      operatorToken = parser.consumeToken(ColonEqual);
      initializer = parser.invokeSubrule(parser.expression, 2);
    }

    const startToken = declarationToken ?? typeTokens[0] ?? identifierToken;
    const variableDeclaration = createVariableDeclarationNode(
      declarationKind,
      identifier,
      identifierToken,
      typeAnnotation,
      initializer,
      startToken,
    );
    if (
      initializer &&
      operatorToken &&
      (operatorToken.image === '=' || operatorToken.image === ':=')
    ) {
      attachLoopResultBinding(initializer, {
        kind: 'variableDeclaration',
        target: identifier,
        operator: operatorToken.image,
        declarationKind,
      });
    }
    return variableDeclaration;
  });
}
