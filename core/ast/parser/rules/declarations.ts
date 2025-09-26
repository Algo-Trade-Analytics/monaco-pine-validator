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
  return parser.RULE('parameter', () => {
    const tokens = parser.collectParameterTokens(1);
    const { typeTokens } = splitDeclarationTokens(tokens);
    const typeAnnotation = buildTypeReferenceFromTokens(typeTokens);

    const consumedTypeTokens = typeTokens.map((token) => parser.CONSUME(token.tokenType));

    const identifierToken = parser.CONSUME(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);

    let defaultValue: ExpressionNode | undefined;
    if (parser.LA(1).tokenType === Equal) {
      parser.CONSUME(Equal);
      defaultValue = parser.SUBRULE(parser.expression) ?? createPlaceholderExpression();
    }

    const startToken = consumedTypeTokens[0] ?? identifierToken;
    return createParameterNode(identifier, typeAnnotation, defaultValue, startToken);
  });
}

export function createParameterListRule(parser: PineParser) {
  return parser.RULE('parameterList', () => {
    const params: ParameterNode[] = [];
    params.push(parser.SUBRULE(parser.parameter));
    parser.MANY(() => {
      parser.CONSUME(Comma);
      params.push(parser.SUBRULE2(parser.parameter));
    });
    return params;
  });
}

export function createFunctionDeclarationRule(parser: PineParser) {
  return parser.RULE('functionDeclaration', (providedExport?: IToken) => {
    let startToken: IToken | undefined = providedExport;
    let exportToken: IToken | undefined = providedExport;

    if (!exportToken && isExportKeywordToken(parser.LA(1))) {
      exportToken = parser.CONSUME(IdentifierToken);
      startToken = exportToken;
    }

    while (isFunctionModifierToken(parser.LA(1))) {
      const modifierToken = parser.CONSUME(IdentifierToken);
      startToken = startToken ?? modifierToken;
    }

    const collected = parser.collectFunctionHeadTokens(1);
    const signatureTokens = collected?.tokens ?? [];
    const split = splitFunctionHeadTokens(signatureTokens);

    const typeTokens = split.typeTokens;
    const nameTokens = split.nameTokens;
    const typeAnnotation = buildTypeReferenceFromTokens(typeTokens);

    const consumedTypeTokens = typeTokens.map((token) => parser.CONSUME(token.tokenType));

    const consumedNameTokens: IToken[] = [];
    let identifier: IdentifierNode | null = null;
    if (nameTokens.length > 0) {
      for (const token of nameTokens) {
        consumedNameTokens.push(parser.CONSUME(token.tokenType));
      }
      identifier = createIdentifierFromTokens(consumedNameTokens);
    } else {
      const fallbackToken = parser.CONSUME(IdentifierToken);
      consumedNameTokens.push(fallbackToken);
      identifier = createIdentifierNode(fallbackToken);
    }

    parser.CONSUME(LParen);
    let params: ParameterNode[] = [];
    if (parser.LA(1).tokenType !== RParen) {
      params = parser.SUBRULE(parser.parameterList);
    }
    parser.CONSUME(RParen);
    const arrowToken = parser.CONSUME(FatArrow);

    let body: BlockStatementNode;
    const blockIndentToken = startToken ?? consumedTypeTokens[0] ?? consumedNameTokens[0] ?? arrowToken;

    if (parser.LA(1).tokenType === Newline) {
      body = parser.parseIndentedBlock(tokenIndent(blockIndentToken));
    } else {
      const expression = parser.SUBRULE(parser.expression) ?? createPlaceholderExpression();
      const endToken = parser.LA(0);
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
  return parser.RULE('scriptDeclaration', () => {
    const token = parser.OR([
      {
        ALT: () => parser.CONSUME(Indicator),
      },
      {
        ALT: () => parser.CONSUME(Strategy),
      },
      {
        ALT: () => parser.CONSUME(Library),
      },
    ]);

    parser.CONSUME(LParen);
    let args: ArgumentNode[] = [];
    if (parser.LA(1).tokenType !== RParen) {
      args = parser.SUBRULE(parser.argumentList);
    }
    const endToken = parser.CONSUME(RParen);

    const scriptType = token.tokenType === Indicator ? 'indicator' : token.tokenType === Strategy ? 'strategy' : 'library';
    return createScriptDeclarationNode(scriptType, args, token, endToken);
  });
}

export function createImportDeclarationRule(parser: PineParser) {
  return parser.RULE('importDeclaration', () => {
    const importToken = parser.CONSUME(Import);
    const pathToken = parser.CONSUME(StringToken);
    parser.CONSUME(As);
    const aliasToken = parser.CONSUME(IdentifierToken);
    return createImportDeclarationNode(pathToken, aliasToken, importToken, aliasToken);
  });
}

export function createEnumMemberRule(parser: PineParser) {
  return parser.RULE('enumMember', (_parentIndent: number) => {
    const identifierToken = parser.CONSUME(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);

    let value: ExpressionNode | null = null;
    let endToken: IToken | undefined = identifierToken;

    if (parser.LA(1).tokenType === Equal) {
      parser.CONSUME(Equal);
      value = parser.SUBRULE(parser.expression);
      endToken = parser.LA(0);
    }

    return createEnumMemberNode(identifier, value, identifierToken, endToken);
  });
}

export function createEnumDeclarationRule(parser: PineParser) {
  return parser.RULE('enumDeclaration', (providedExport?: IToken) => {
    let exportToken: IToken | undefined = providedExport;
    if (!exportToken && isExportKeywordToken(parser.LA(1))) {
      exportToken = parser.CONSUME(IdentifierToken);
    }

    const enumToken = parser.CONSUME(Enum);
    const identifierToken = parser.CONSUME(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);

    const members: EnumMemberNode[] = [];
    const indentToken = exportToken ?? enumToken;
    const baseIndent = tokenIndent(indentToken);

    parser.MANY(() => parser.CONSUME(Newline));

    while (true) {
      const next = parser.LA(1);
      if (next.tokenType === EOF_TOKEN) {
        break;
      }

      if (next.tokenType === Newline) {
        parser.CONSUME(Newline);
        continue;
      }

      if (tokenIndent(next) <= baseIndent) {
        break;
      }

      const member = parser.SUBRULE(parser.enumMember, { ARGS: [baseIndent] });
      members.push(member);

      while (parser.LA(1).tokenType === Newline) {
        parser.CONSUME(Newline);
      }
    }

    const endToken = members.length > 0 ? parser.LA(0) : identifierToken;
    return createEnumDeclarationNode(identifier, members, Boolean(exportToken), exportToken ?? enumToken, endToken);
  });
}

export function createTypeFieldRule(parser: PineParser) {
  return parser.RULE('typeField', () => {
    const collected = parser.collectDeclarationTokens(1);
    const tokens = collected?.tokens ?? [];
    const { typeTokens } = splitDeclarationTokens(tokens);
    const typeAnnotation = buildTypeReferenceFromTokens(typeTokens);

    const consumedTypeTokens = typeTokens.map((token) => parser.CONSUME(token.tokenType));

    const identifierToken = parser.CONSUME(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);
    const startToken = consumedTypeTokens[0] ?? identifierToken;
    return createTypeFieldNode(identifier, typeAnnotation, startToken, identifierToken);
  });
}

export function createTypeDeclarationRule(parser: PineParser) {
  return parser.RULE('typeDeclaration', (providedExport?: IToken) => {
    let exportToken: IToken | undefined = providedExport;
    if (!exportToken && isExportKeywordToken(parser.LA(1))) {
      exportToken = parser.CONSUME(IdentifierToken);
    }

    const typeToken = parser.CONSUME(Type);
    const identifierToken = parser.CONSUME(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);

    const fields: TypeFieldNode[] = [];
    const indentToken = exportToken ?? typeToken;
    const baseIndent = tokenIndent(indentToken);

    parser.MANY(() => parser.CONSUME(Newline));

    while (true) {
      const next = parser.LA(1);
      if (next.tokenType === EOF_TOKEN) {
        break;
      }

      if (next.tokenType === Newline) {
        parser.CONSUME(Newline);
        continue;
      }

      if (tokenIndent(next) <= baseIndent) {
        break;
      }

      const field = parser.SUBRULE(parser.typeField);
      fields.push(field);

      while (parser.LA(1).tokenType === Newline) {
        parser.CONSUME(Newline);
      }
    }

    const endToken = fields.length > 0 ? parser.LA(0) : identifierToken;
    return createTypeDeclarationNode(identifier, fields, Boolean(exportToken), exportToken ?? typeToken, endToken);
  });
}

export function createVariableDeclarationRule(parser: PineParser) {
  return parser.RULE('variableDeclaration', () => {
    let declarationKind: VariableDeclarationKind = 'simple';
    let declarationToken: IToken | undefined;

    if (isDeclarationKeywordToken(parser.LA(1))) {
      declarationToken = parser.CONSUME(IdentifierToken);
      declarationKind = toDeclarationKind(declarationToken.image);
    }

    const collected = parser.collectDeclarationTokens(1);
    const tokens = collected?.tokens ?? [];
    const { typeTokens } = splitDeclarationTokens(tokens);
    const typeAnnotation = buildTypeReferenceFromTokens(typeTokens);

    for (const token of typeTokens) {
      parser.CONSUME(token.tokenType);
    }

    const identifierToken = parser.CONSUME(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);

    let initializer: ExpressionNode | undefined;
    let operatorToken: IToken | undefined;
    const nextTokenType = parser.LA(1).tokenType;
    if (nextTokenType === Equal) {
      operatorToken = parser.CONSUME(Equal);
      initializer = parser.SUBRULE(parser.expression);
    } else if (nextTokenType === ColonEqual) {
      operatorToken = parser.CONSUME(ColonEqual);
      initializer = parser.SUBRULE2(parser.expression);
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
