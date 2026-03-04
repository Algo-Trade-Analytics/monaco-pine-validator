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
  Indent,
  Dedent,
  Indicator,
  LBracket,
  LParen,
  Less,
  Library,
  Minus,
  NaToken,
  Newline,
  NumberLiteral as NumberToken,
  Slash,
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
  createSyntheticToken,
} from '../node-builders';
import { VirtualTokenReason } from '../../virtual-tokens';
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
  FunctionDeclarationRecovery,
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

    let params: ParameterNode[] = [];
    let functionRecovery: FunctionDeclarationRecovery | undefined;
    let hasParentheses = false;

    parser.optional(() => {
      hasParentheses = true;
      parser.consumeToken(LParen);
      if (parser.lookAhead(1).tokenType !== RParen) {
        params = parser.invokeSubrule(parser.parameterList);
      }
      parser.consumeToken(RParen);
    });

    if (!hasParentheses) {
      const nameReference = consumedNameTokens[consumedNameTokens.length - 1] ?? consumedTypeTokens[consumedTypeTokens.length - 1] ?? startToken ?? parser.lookAhead(0);
      const virtualLParen = createSyntheticToken(
        '(',
        LParen,
        nameReference,
        VirtualTokenReason.FUNCTION_PARENTHESIS,
      ) as VirtualToken;
      const arrowLookahead = parser.lookAhead(1);
      const virtualRParen = createSyntheticToken(
        ')',
        RParen,
        arrowLookahead,
        VirtualTokenReason.FUNCTION_PARENTHESIS,
      ) as VirtualToken;

      const functionName = identifier?.name ?? (consumedNameTokens.length > 0 ? consumedNameTokens.map((token) => token.image).join('') : 'function');
      const message = `Missing parentheses in function declaration '${functionName}'`;
      const error: ParserRecoveryError = {
        code: 'MISSING_FUNCTION_PARENS',
        message,
        suggestion: `Add parentheses after '${functionName}' to declare parameters.`,
        severity: 'error',
      };

      parser.reportRecoveryError(virtualLParen, message, {
        code: error.code,
        suggestion: error.suggestion,
      });

      functionRecovery = {
        missingParentheses: {
          virtualLParen,
          virtualRParen,
          errors: [error],
        },
      };
    }
    const arrowToken = parser.consumeToken(FatArrow);

    let body: BlockStatementNode;
    const blockIndentToken = startToken ?? consumedTypeTokens[0] ?? consumedNameTokens[0] ?? arrowToken;

    if (parser.lookAhead(1).tokenType === Newline) {
      body = parser.parseIndentedBlock(parser.resolveTokenIndent(blockIndentToken));
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
      functionRecovery,
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
    const { pathToken } = consumeImportPath(parser);
    parser.consumeToken(As);
    const aliasToken = parser.consumeToken(IdentifierToken);
    return createImportDeclarationNode(pathToken, aliasToken, importToken, aliasToken);
  });
}

function consumeImportPath(parser: PineParser): { pathToken: IToken } {
  const immediate = parser.lookAhead(1);
  if (immediate.tokenType === StringToken) {
    const token = parser.consumeToken(StringToken);
    return { pathToken: token };
  }

  const segments: IToken[] = [];
  let expectSegment = true;

  // Accept sequences like Identifier ("/" Identifier | "/" Number)+
  while (true) {
    const next = parser.lookAhead(1);
    const tokenType = next.tokenType;

    if (expectSegment) {
      if (tokenType === IdentifierToken || tokenType === NumberToken) {
        segments.push(parser.consumeToken(tokenType));
        expectSegment = false;
        continue;
      }
      break;
    }

    if (tokenType === Slash) {
      segments.push(parser.consumeToken(Slash));
      expectSegment = true;
      continue;
    }

    break;
  }

  if (segments.length === 0 || expectSegment) {
    const fallback = parser.consumeToken(StringToken);
    return { pathToken: fallback };
  }

  const concat = segments.map((segment) => segment.image).join('');
  const first = segments[0];
  const last = segments[segments.length - 1];

  const startLine = first.startLine ?? first.endLine ?? 1;
  const startColumn = first.startColumn ?? first.endColumn ?? 1;
  const startOffset = first.startOffset ?? first.endOffset ?? 0;
  const endLine = last.endLine ?? last.startLine ?? startLine;
  const endColumn =
    last.endColumn ?? ((last.startColumn ?? 1) + (last.image?.length ?? 1) - 1);
  const endOffset =
    last.endOffset ?? ((last.startOffset ?? 0) + (last.image?.length ?? 0));

  const syntheticPathToken: IToken = {
    image: `"${concat}"`,
    tokenType: StringToken,
    startLine,
    startColumn,
    startOffset,
    endLine,
    endColumn,
    endOffset,
  } as IToken;

  return { pathToken: syntheticPathToken };
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
    const baseIndent = parser.resolveTokenIndent(indentToken);

    parser.repeatMany(() => parser.consumeToken(Newline));

    if (parser.usesVirtualIndentationTokens() && parser.lookAhead(1).tokenType === Indent) {
      parser.consumeToken(Indent);

      while (true) {
        while (parser.lookAhead(1).tokenType === Newline) {
          parser.consumeToken(Newline);
        }

        const next = parser.lookAhead(1);
        if (next.tokenType === EOF_TOKEN || next.tokenType === Dedent) {
          break;
        }

        const member = parser.invokeSubrule(parser.enumMember, 1, { ARGS: [baseIndent] }) as EnumMemberNode;
        members.push(member);
      }

      if (parser.lookAhead(1).tokenType === Dedent) {
        parser.consumeToken(Dedent);
      }

      const endToken = members.length > 0 ? parser.lookAhead(0) : identifierToken;
      return createEnumDeclarationNode(
        identifier,
        members,
        Boolean(exportToken),
        exportToken ?? enumToken,
        endToken,
      );
    }

    while (true) {
      const next = parser.lookAhead(1);
      if (next.tokenType === EOF_TOKEN) {
        break;
      }

      if (next.tokenType === Newline) {
        parser.consumeToken(Newline);
        continue;
      }

      if (parser.resolveTokenIndent(next) <= baseIndent) {
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
    const baseIndent = parser.resolveTokenIndent(indentToken);

    // Legacy Pine syntax allows: `type Name =>` before the indented fields.
    if (parser.lookAhead(1).tokenType === FatArrow) {
      parser.consumeToken(FatArrow);
    }

    parser.repeatMany(() => parser.consumeToken(Newline));

    if (parser.usesVirtualIndentationTokens() && parser.lookAhead(1).tokenType === Indent) {
      parser.consumeToken(Indent);

      while (true) {
        while (parser.lookAhead(1).tokenType === Newline) {
          parser.consumeToken(Newline);
        }

        const next = parser.lookAhead(1);
        if (next.tokenType === EOF_TOKEN || next.tokenType === Dedent) {
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
      }

      if (parser.lookAhead(1).tokenType === Dedent) {
        parser.consumeToken(Dedent);
      }

      const endToken = fields.length > 0 ? parser.lookAhead(0) : identifierToken;
      return createTypeDeclarationNode(
        identifier,
        fields,
        Boolean(exportToken),
        exportToken ?? typeToken,
        endToken,
      );
    }

    while (true) {
      const next = parser.lookAhead(1);
      if (next.tokenType === EOF_TOKEN) {
        break;
      }

      if (next.tokenType === Newline) {
        parser.consumeToken(Newline);
        continue;
      }

      if (parser.resolveTokenIndent(next) <= baseIndent) {
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
    return createSyntheticToken('=', Equal, reference, VirtualTokenReason.MISSING_EQUALS) as VirtualToken;
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
