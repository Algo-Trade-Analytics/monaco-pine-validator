import { EOF, type IToken } from 'chevrotain';
import type { PineParser } from '../parser';
import {
  As,
  Bang,
  Colon,
  ColonEqual,
  Comma,
  Enum,
  Equal,
  False,
  FatArrow,
  Greater,
  Identifier as IdentifierToken,
  If,
  Import,
  Indicator,
  LBracket,
  LParen,
  Less,
  Library,
  Minus,
  NaToken,
  Newline,
  NumberLiteral as NumberToken,
  Plus,
  RParen,
  Strategy,
  StringLiteral as StringToken,
  TrailingNumberLiteral,
  True,
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
  TypeReferenceNode,
  VariableDeclarationKind,
  VariableDeclarationNode,
  ParserRecoveryError,
  VirtualToken,
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
  return parser.createRule('parameter', () => {
    const tokens = parser.collectParameterTokens(1);
    const { typeTokens } = splitDeclarationTokens(tokens);
    let typeAnnotation = buildTypeReferenceFromTokens(typeTokens);

    const consumedTypeTokens = typeTokens.map((token) => parser.consumeToken(token.tokenType));

    const identifierToken = parser.consumeToken(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);

    if (
      identifier.name === 'this' &&
      !typeAnnotation &&
      parser.lookAhead(1).tokenType === Less
    ) {
      parser.consumeToken(Less);
      const genericTokens: IToken[] = [];
      let depth = 1;
      while (depth > 0) {
        const next = parser.lookAhead(1);
        const nextType = next?.tokenType;
        if (!nextType || nextType === EOF_TOKEN) {
          break;
        }
        if (nextType === Less) {
          genericTokens.push(parser.consumeToken(Less));
          depth += 1;
          continue;
        }
        if (nextType === Greater) {
          depth -= 1;
          if (depth === 0) {
            parser.consumeToken(Greater);
            break;
          }
          genericTokens.push(parser.consumeToken(Greater));
          continue;
        }
        genericTokens.push(parser.consumeToken(nextType));
      }

      const genericType = buildTypeReferenceFromTokens(genericTokens);
      if (genericType) {
        typeAnnotation = genericType;
      }
    }

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
  return parser.createRule('parameterList', () => {
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
  return parser.createRule('functionDeclaration', (...args: unknown[]) => {
    const providedExport = args[0] as IToken | undefined;
    let startToken: IToken | undefined = providedExport;
    let exportToken: IToken | undefined = providedExport;

    if (!exportToken && isExportKeywordToken(parser.lookAhead(1))) {
      exportToken = parser.consumeToken(IdentifierToken);
      startToken = exportToken;
    }

    const modifiers: string[] = [];
    while (isFunctionModifierToken(parser.lookAhead(1))) {
      const modifierToken = parser.consumeToken(IdentifierToken);
      startToken = startToken ?? modifierToken;
      modifiers.push(modifierToken.image.toLowerCase());
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
      modifiers,
      functionStartToken,
    );
  });
}

export function createScriptDeclarationRule(parser: PineParser) {
  return parser.createRule('scriptDeclaration', () => {
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
      parser.consumeArgumentListRecovery();
    } else {
      parser.setArgumentListRecovery(null);
    }
    const endToken = parser.consumeToken(RParen);

    const scriptType = token.tokenType === Indicator ? 'indicator' : token.tokenType === Strategy ? 'strategy' : 'library';
    return createScriptDeclarationNode(scriptType, args, token, endToken);
  });
}

export function createImportDeclarationRule(parser: PineParser) {
  return parser.createRule('importDeclaration', () => {
    const importToken = parser.consumeToken(Import);
    const pathToken = parser.consumeToken(StringToken);
    parser.consumeToken(As);
    const aliasToken = parser.consumeToken(IdentifierToken);
    return createImportDeclarationNode(pathToken, aliasToken, importToken, aliasToken);
  });
}

export function createEnumMemberRule(parser: PineParser) {
  return parser.createRule('enumMember', (...args: unknown[]) => {
    const _parentIndent = args[0] as number;
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
  return parser.createRule('enumDeclaration', (...args: unknown[]) => {
    const providedExport = args[0] as IToken | undefined;
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

      const member = parser.invokeSubrule(parser.enumMember, 1, { ARGS: [baseIndent] }) as EnumMemberNode;
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
  return parser.createRule('typeField', () => {
    const collected = parser.collectDeclarationTokens(1);
    const tokens = collected?.tokens ?? [];
    const { typeTokens } = splitDeclarationTokens(tokens);
    const typeAnnotation = buildTypeReferenceFromTokens(typeTokens);

    const consumedTypeTokens = typeTokens.map((token) => parser.consumeToken(token.tokenType));

    const identifierToken = parser.consumeToken(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);
    
    // Consume default value if present (e.g., "= na")
    if (parser.lookAhead(1).tokenType === Equal) {
      parser.consumeToken(Equal);
      // Consume the default value expression (everything until newline or EOF)
      while (true) {
        const next = parser.lookAhead(1);
        if (next.tokenType === Newline || next.tokenType === EOF_TOKEN) {
          break;
        }
        parser.consumeToken(next.tokenType);
      }
    }
    
    const startToken = consumedTypeTokens[0] ?? identifierToken;
    return createTypeFieldNode(identifier, typeAnnotation, startToken, identifierToken);
  });
}

export function createTypeDeclarationRule(parser: PineParser) {
  return parser.createRule('typeDeclaration', (...args: unknown[]) => {
    const providedExport = args[0] as IToken | undefined;
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

      if (
        next.tokenType === IdentifierToken &&
        (next.image ?? '').toLowerCase() === 'method'
      ) {
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
  const expressionStartTokenTypes = new Set([
    IdentifierToken,
    NumberToken,
    TrailingNumberLiteral,
    StringToken,
    LParen,
    LBracket,
    Minus,
    Plus,
    Bang,
    True,
    False,
    NaToken,
    If,
  ]);

  const isExpressionStartToken = (token: IToken): boolean => {
    const tokenType = token.tokenType;
    if (!tokenType || tokenType === EOF_TOKEN || tokenType === Newline) {
      return false;
    }
    if (expressionStartTokenTypes.has(tokenType)) {
      return true;
    }
    const categories = (tokenType as { CATEGORIES?: unknown[] }).CATEGORIES;
    if (Array.isArray(categories)) {
      return categories.some((category) => expressionStartTokenTypes.has(category as any));
    }
    return false;
  };

  const createVirtualEqualsToken = (reference: IToken): VirtualToken => {
    const baseOffset = (reference.endOffset ?? reference.startOffset ?? 0) + 1;
    const baseColumn = (reference.endColumn ?? reference.startColumn ?? 0) + 1;
    const line = reference.endLine ?? reference.startLine ?? 1;
    const token: VirtualToken = {
      image: '=',
      startOffset: baseOffset,
      endOffset: baseOffset,
      startColumn: baseColumn,
      endColumn: baseColumn,
      startLine: line,
      endLine: line,
      tokenType: Equal,
      isVirtual: true,
      recoveryContext: 'missing-equals',
    } as VirtualToken;
    return token;
  };

  const buildMissingEqualsRecovery = (
    identifierToken: IToken,
    identifierName: string,
  ): { token: VirtualToken; errors: ParserRecoveryError[]; message: string } => {
    const virtualToken = createVirtualEqualsToken(identifierToken);
    const message = `Missing '=' after variable '${identifierName}'`;
    const errors: ParserRecoveryError[] = [
      {
        code: 'MISSING_EQUALS',
        message,
        suggestion: `Use '${identifierName} = ...' to assign a value.`,
        severity: 'error',
      },
    ];
    return { token: virtualToken, errors, message };
  };

  const pushMissingEqualsError = (token: IToken, recoveryError: ParserRecoveryError): void => {
    parser.reportRecoveryError(token, recoveryError.message, {
      code: recoveryError.code,
      suggestion: recoveryError.suggestion,
    });
    if (process.env.DEBUG_PARSER === '1') {
      console.log('[Parser] recorded missing "=" error', {
        message: recoveryError.message,
        code: recoveryError.code,
      });
    }
  };

  return parser.createRule('variableDeclaration', () => {
    let declarationKind: VariableDeclarationKind = 'simple';
    let declarationToken: IToken | undefined;

    if (isDeclarationKeywordToken(parser.lookAhead(1))) {
      declarationToken = parser.consumeToken(IdentifierToken);
      declarationKind = toDeclarationKind(declarationToken.image);
    }

    const collected = parser.collectDeclarationTokens(1);
    const tokens = collected?.tokens ?? [];
    const colonIndex = tokens.findIndex((token) => token.tokenType === Colon);
    const prefixTokens = colonIndex >= 0 ? tokens.slice(0, colonIndex) : tokens;
    const colonTypeTokens = colonIndex >= 0 ? tokens.slice(colonIndex + 1) : [];
    const { typeTokens } = splitDeclarationTokens(prefixTokens);
    let typeAnnotation = buildTypeReferenceFromTokens(typeTokens);

    for (const token of typeTokens) {
      parser.consumeToken(token.tokenType);
    }

    const identifierToken = parser.consumeToken(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);

    const debugMode = process.env.DEBUG_PARSER === '1' && !(parser as { RECORDING_PHASE?: boolean }).RECORDING_PHASE;

    if (colonIndex >= 0) {
      parser.consumeToken(Colon);
      for (const token of colonTypeTokens) {
        parser.consumeToken(token.tokenType);
      }
      const colonTypeAnnotation = buildTypeReferenceFromTokens(colonTypeTokens);
      if (colonTypeAnnotation) {
        typeAnnotation = colonTypeAnnotation;
      }
    }

    let initializer: ExpressionNode | undefined;
    let operatorToken: IToken | undefined;
    let missingInitializerOperator = false;
    let virtualInitializerOperator: VirtualToken | null = null;
    let recoveryErrors: ParserRecoveryError[] | undefined;
    const nextToken = parser.lookAhead(1);
    const nextTokenType = nextToken.tokenType;
    if (nextTokenType === Equal) {
      operatorToken = parser.consumeToken(Equal);
      initializer = parser.invokeSubrule(parser.expression);
    } else if (nextTokenType === ColonEqual) {
      operatorToken = parser.consumeToken(ColonEqual);
      initializer = parser.invokeSubrule(parser.expression, 2);
    } else if (isExpressionStartToken(nextToken)) {
      const recovery = buildMissingEqualsRecovery(identifierToken, identifier.name);
      missingInitializerOperator = true;
      virtualInitializerOperator = recovery.token;
      recoveryErrors = recovery.errors;
      operatorToken = virtualInitializerOperator;
      const recoveryError = recovery.errors[0];
      if (recoveryError) {
        pushMissingEqualsError(virtualInitializerOperator, recoveryError);
      }
      initializer = parser.invokeSubrule(parser.expression);
    }

    const startToken = declarationToken ?? typeTokens[0] ?? identifierToken;
    const declarations: VariableDeclarationNode[] = [];
    const operatorImage = operatorToken?.image ?? null;

    const firstDeclaration = createVariableDeclarationNode(
      declarationKind,
      identifier,
      identifierToken,
      typeAnnotation,
      initializer,
      operatorImage === ':=' || operatorImage === '=' ? (operatorImage as '=' | ':=') : null,
      startToken,
    );
    if (missingInitializerOperator) {
      firstDeclaration.missingInitializerOperator = true;
      firstDeclaration.virtualInitializerOperator = virtualInitializerOperator;
      firstDeclaration.recoveryErrors = recoveryErrors ?? [];
    }
    declarations.push(firstDeclaration);

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

    const sharedTypeTokens = colonIndex >= 0 ? colonTypeTokens : typeTokens;

    while (parser.lookAhead(1).tokenType === Comma) {
      parser.consumeToken(Comma);

      while (parser.lookAhead(1).tokenType === Newline) {
        parser.consumeToken(Newline);
      }

      // Check if the next variable has its own type annotation (e.g., "int bestIdx = -1, float bestD = 1e9")
      let nextTypeAnnotation: TypeReferenceNode | null = null;
      
      // Try to collect type tokens before the identifier
      const nextCollected = parser.collectDeclarationTokens(1);
      const nextTokens = nextCollected?.tokens ?? [];
      
      if (nextTokens.length > 0) {
        const { typeTokens: nextTypeTokens, identifierToken: nextIdToken } = splitDeclarationTokens(nextTokens);
        
        if (nextTypeTokens.length > 0) {
          // This variable has its own type annotation
          nextTypeAnnotation = buildTypeReferenceFromTokens(nextTypeTokens);
          // Consume the type tokens
          for (const token of nextTypeTokens) {
            parser.consumeToken(token.tokenType);
          }
        }
      }

      // If no explicit type for this variable, use the shared type from the first declaration
      if (!nextTypeAnnotation) {
        nextTypeAnnotation = sharedTypeTokens.length > 0 ? buildTypeReferenceFromTokens(sharedTypeTokens) : null;
      }

      const nextIdentifierToken = parser.consumeToken(IdentifierToken);
      const nextIdentifier = createIdentifierNode(nextIdentifierToken);

      let nextInitializer: ExpressionNode | undefined;
      let nextOperatorToken: IToken | undefined;
      let nextMissingInitializerOperator = false;
      let nextVirtualInitializerOperator: VirtualToken | null = null;
      let nextRecoveryErrors: ParserRecoveryError[] | undefined;
      const lookaheadType = parser.lookAhead(1).tokenType;
      if (lookaheadType === Equal) {
        nextOperatorToken = parser.consumeToken(Equal);
        nextInitializer = parser.invokeSubrule(parser.expression);
      } else if (lookaheadType === ColonEqual) {
        nextOperatorToken = parser.consumeToken(ColonEqual);
        nextInitializer = parser.invokeSubrule(parser.expression, 2);
      } else if (isExpressionStartToken(parser.lookAhead(1))) {
        const recovery = buildMissingEqualsRecovery(nextIdentifierToken, nextIdentifier.name);
        nextMissingInitializerOperator = true;
        nextVirtualInitializerOperator = recovery.token;
        nextRecoveryErrors = recovery.errors;
        nextOperatorToken = nextVirtualInitializerOperator;
        const recoveryError = recovery.errors[0];
        if (recoveryError) {
          pushMissingEqualsError(nextVirtualInitializerOperator, recoveryError);
        }
        nextInitializer = parser.invokeSubrule(parser.expression);
      }

      const declaration = createVariableDeclarationNode(
        declarationKind,
        nextIdentifier,
        nextIdentifierToken,
        nextTypeAnnotation,
        nextInitializer,
        nextOperatorToken &&
        (nextOperatorToken.image === ':=' || nextOperatorToken.image === '=')
          ? ((nextOperatorToken.image === ':=' ? ':=' : '=') as '=' | ':=')
          : null,
        nextIdentifierToken,
      );
      if (nextMissingInitializerOperator) {
        declaration.missingInitializerOperator = true;
        declaration.virtualInitializerOperator = nextVirtualInitializerOperator;
        declaration.recoveryErrors = nextRecoveryErrors ?? [];
      }

      if (
        nextInitializer &&
        nextOperatorToken &&
        (nextOperatorToken.image === '=' || nextOperatorToken.image === ':=')
      ) {
        attachLoopResultBinding(nextInitializer, {
          kind: 'variableDeclaration',
          target: nextIdentifier,
          operator: nextOperatorToken.image,
          declarationKind,
        });
      }

      declarations.push(declaration);
    }

    if (debugMode) {
      console.log('[Parser] variableDeclaration', {
        identifier: identifier.name,
        hasPrefixType: Boolean(typeTokens.length > 0),
        hasColonType: Boolean(colonIndex >= 0),
        initializerPresent: Boolean(initializer),
        operator: operatorToken?.image ?? null,
        recoveredMissingEquals: missingInitializerOperator,
        additionalDeclarations: declarations.length - 1,
      });
    }

    // If we have multiple declarations, return a BlockStatement containing all of them
    if (declarations.length > 1) {
      const endToken = parser.lookAhead(0);
      return createBlockStatementNode(declarations, startToken, endToken);
    }

    return declarations[0];
  });
}
