import { EmbeddedActionsParser, EOF, type IToken } from 'chevrotain';
import { SyntaxError } from '../../../pynescript/ast/error';
import {
  type ArgumentNode,
  type AssignmentStatementNode,
  type BlockStatementNode,
  type BinaryExpressionNode,
  type BreakStatementNode,
  type BooleanLiteralNode,
  type CallExpressionNode,
  type ContinueStatementNode,
  type ExpressionNode,
  type ExpressionStatementNode,
  type IfStatementNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type NullLiteralNode,
  type NumberLiteralNode,
  type ProgramNode,
  type Range,
  type ReturnStatementNode,
  type ScriptDeclarationNode,
  type SourceLocation,
  type StatementNode,
  type StringLiteralNode,
  type TypeReferenceNode,
  type UnaryExpressionNode,
  type VariableDeclarationKind,
  type VariableDeclarationNode,
  type VersionDirectiveNode,
  type WhileStatementNode,
  createLocation,
  createPosition,
  createRange,
} from '../nodes';
import { createAstDiagnostics, type AstParseOptions, type AstParseResult } from '../types';
import {
  AllTokens,
  PineLexer,
  VersionDirective,
  Newline,
  Indicator,
  Strategy,
  Library,
  If,
  Else,
  Identifier as IdentifierToken,
  StringLiteral as StringToken,
  NumberLiteral as NumberToken,
  True,
  False,
  NaToken,
  LParen,
  RParen,
  Comma,
  Dot,
  Equal,
  ColonEqual,
  PlusEqual,
  MinusEqual,
  StarEqual,
  SlashEqual,
  PercentEqual,
  Plus,
  Minus,
  Star,
  Slash,
  Percent,
  Less,
  LessEqual,
  Greater,
  GreaterEqual,
  EqualEqual,
  NotEqual,
  And,
  Or,
  Not,
  While,
  Break,
  Continue,
  Return,
} from './tokens';

const EOF_TOKEN = EOF;

function isDeclarationKeywordToken(token: IToken | undefined): boolean {
  if (!token) {
    return false;
  }
  return DECLARATION_KEYWORDS.has(token.image?.toLowerCase() ?? '');
}

function toDeclarationKind(image: string | undefined): VariableDeclarationKind {
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

function splitDeclarationTokens(tokens: IToken[]): { typeTokens: IToken[]; identifierToken: IToken | undefined } {
  let lastIdentifierIndex = -1;
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    if (tokens[index]?.tokenType === IdentifierToken) {
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

function buildTypeReferenceFromTokens(tokens: IToken[]): TypeReferenceNode | null {
  if (tokens.length === 0) {
    return null;
  }

  let index = 0;

  function parseType(): { node: TypeReferenceNode; endToken: IToken } {
    const nameToken = tokens[index] ?? createFallbackToken();
    index += 1;
    const name = createIdentifierNode(nameToken);
    const generics: TypeReferenceNode[] = [];
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
        } else {
          break;
        }
      }

      if (tokens[index]?.tokenType === Greater) {
        endToken = tokens[index] ?? endToken;
        index += 1;
      }
    }

    while (index < tokens.length && tokens[index]?.tokenType === IdentifierToken) {
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

const DECLARATION_KEYWORDS = new Set(['var', 'varip', 'const', 'let', 'simple']);

function createFallbackToken(): IToken {
  return {
    image: '',
    startLine: 1,
    startColumn: 1,
    startOffset: 0,
    endLine: 1,
    endColumn: 1,
    endOffset: 0,
    tokenType: IdentifierToken,
  } as IToken;
}

function ensureToken(token?: IToken, fallback?: IToken): IToken {
  return token ?? fallback ?? createFallbackToken();
}

function tokenStart(token?: IToken): ReturnType<typeof createPosition> {
  const safeToken = ensureToken(token);
  return createPosition(safeToken.startLine ?? 1, safeToken.startColumn ?? 1, safeToken.startOffset ?? 0);
}

function tokenEnd(token?: IToken): ReturnType<typeof createPosition> {
  const safeToken = ensureToken(token);
  const endLine = safeToken.endLine ?? safeToken.startLine ?? 1;
  const endColumn = (safeToken.endColumn ?? safeToken.startColumn ?? 1) + 1;
  const endOffset = (safeToken.endOffset ?? safeToken.startOffset ?? 0) + 1;
  return createPosition(endLine, endColumn, endOffset);
}

function spanFromTokens(start?: IToken, end?: IToken) {
  const safeStart = ensureToken(start);
  const safeEnd = ensureToken(end, safeStart);
  return {
    loc: createLocation(tokenStart(safeStart), tokenEnd(safeEnd)),
    range: createRange(safeStart.startOffset ?? 0, (safeEnd.endOffset ?? safeEnd.startOffset ?? 0) + 1),
  };
}

function spanFromNodes(startNode: { loc: SourceLocation; range: Range } | undefined, endToken?: IToken) {
  if (!startNode || !startNode.loc) {
    return spanFromTokens(endToken, endToken);
  }

  const safeEnd = ensureToken(endToken);
  return {
    loc: createLocation(startNode.loc.start, tokenEnd(safeEnd)),
    range: createRange(startNode.range[0], (safeEnd.endOffset ?? safeEnd.startOffset ?? 0) + 1),
  };
}

function createIdentifierNode(token?: IToken): IdentifierNode {
  const safeToken = ensureToken(token);
  return {
    kind: 'Identifier',
    name: safeToken.image,
    ...spanFromTokens(safeToken, safeToken),
  };
}

function createPlaceholderExpression(): ExpressionNode {
  return createIdentifierNode();
}

function createStringNode(token?: IToken): StringLiteralNode {
  const safeToken = ensureToken(token);
  const raw = safeToken.image;
  const body = raw.slice(1, -1);
  const value = body.replace(/\\([\\'"nrtbf])/g, (match, ch) => {
    switch (ch) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      case 'b':
        return '\b';
      case 'f':
        return '\f';
      case '\\':
        return '\\';
      case '"':
        return '"';
      case "'":
        return "'";
      default:
        return ch;
    }
  });

  return {
    kind: 'StringLiteral',
    value,
    raw,
    ...spanFromTokens(safeToken, safeToken),
  };
}

function createNumberNode(token?: IToken): NumberLiteralNode {
  const safeToken = ensureToken(token);
  const value = Number(safeToken.image.replace(/_/g, ''));
  return {
    kind: 'NumberLiteral',
    value,
    raw: safeToken.image,
    ...spanFromTokens(safeToken, safeToken),
  };
}

function createBooleanNode(token: IToken | undefined, value: boolean): BooleanLiteralNode {
  const safeToken = ensureToken(token);
  return {
    kind: 'BooleanLiteral',
    value,
    ...spanFromTokens(safeToken, safeToken),
  };
}

function createNullNode(token?: IToken): NullLiteralNode {
  const safeToken = ensureToken(token);
  return {
    kind: 'NullLiteral',
    ...spanFromTokens(safeToken, safeToken),
  };
}

function tokenIndent(token?: IToken): number {
  return Math.max(0, (ensureToken(token).startColumn ?? 1) - 1);
}

function createBlockStatementNode(
  statements: StatementNode[],
  startToken: IToken | undefined,
  endToken: IToken | undefined,
): BlockStatementNode {
  if (statements.length > 0) {
    const first = statements[0];
    const last = statements[statements.length - 1];
    return {
      kind: 'BlockStatement',
      body: statements,
      loc: createLocation(first.loc.start, last.loc.end),
      range: createRange(first.range[0], last.range[1]),
    };
  }

  const span = spanFromTokens(startToken, endToken ?? startToken);
  return {
    kind: 'BlockStatement',
    body: statements,
    ...span,
  };
}

function createIfStatementNode(
  test: ExpressionNode,
  consequent: StatementNode,
  alternate: StatementNode | null,
  startToken: IToken,
  endToken: IToken | undefined,
): IfStatementNode {
  const span = spanFromTokens(startToken, endToken ?? startToken);
  return {
    kind: 'IfStatement',
    test,
    consequent,
    alternate,
    ...span,
  };
}

function createWhileStatementNode(
  test: ExpressionNode,
  body: BlockStatementNode,
  startToken: IToken,
  endToken: IToken | undefined,
): WhileStatementNode {
  const span = spanFromTokens(startToken, endToken ?? startToken);
  return {
    kind: 'WhileStatement',
    test,
    body,
    ...span,
  };
}

function createReturnStatementNode(
  token: IToken,
  argument: ExpressionNode | null,
  endToken: IToken | undefined,
): ReturnStatementNode {
  const span = spanFromTokens(token, endToken ?? token);
  return {
    kind: 'ReturnStatement',
    argument,
    ...span,
  };
}

function createBreakStatementNode(token: IToken): BreakStatementNode {
  const span = spanFromTokens(token, token);
  return {
    kind: 'BreakStatement',
    ...span,
  };
}

function createContinueStatementNode(token: IToken): ContinueStatementNode {
  const span = spanFromTokens(token, token);
  return {
    kind: 'ContinueStatement',
    ...span,
  };
}

function createCallExpressionNode(
  callee: ExpressionNode | undefined,
  args: ArgumentNode[],
  closingToken: IToken | undefined,
): CallExpressionNode {
  const safeCallee = callee ?? createPlaceholderExpression();
  return {
    kind: 'CallExpression',
    callee: safeCallee,
    args,
    ...spanFromNodes(safeCallee, closingToken),
  };
}

function createArgumentNode(
  name: IdentifierNode | null,
  value: ExpressionNode | undefined,
  startToken: IToken | undefined,
  endToken: IToken | undefined,
): ArgumentNode {
  const valueNode = value ?? createPlaceholderExpression();
  const span = name ? spanFromTokens(startToken, endToken) : spanFromNodes(valueNode, endToken);
  return {
    kind: 'Argument',
    name,
    value: valueNode,
    ...span,
  };
}

function createMemberExpressionNode(
  object: ExpressionNode | undefined,
  property: IdentifierNode | undefined,
  endToken: IToken | undefined,
): MemberExpressionNode {
  const safeObject = object ?? createPlaceholderExpression();
  const safeProperty = property ?? createIdentifierNode();
  return {
    kind: 'MemberExpression',
    object: safeObject,
    property: safeProperty,
    computed: false,
    ...spanFromNodes(safeObject, endToken),
  };
}

function createBinaryExpressionNode(
  left: ExpressionNode | undefined,
  operatorToken: IToken | undefined,
  right: ExpressionNode | undefined,
  endToken: IToken | undefined,
): BinaryExpressionNode {
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

function createUnaryExpressionNode(
  operatorToken: IToken | undefined,
  argument: ExpressionNode | undefined,
): UnaryExpressionNode {
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

function createVariableDeclarationNode(
  declarationKind: VariableDeclarationKind,
  identifier: IdentifierNode,
  identifierToken: IToken,
  typeAnnotation: TypeReferenceNode | null,
  initializer: ExpressionNode | undefined,
  startToken: IToken | undefined,
): VariableDeclarationNode {
  const safeStart = ensureToken(startToken, identifierToken);
  const endNode = initializer ?? identifier;
  return {
    kind: 'VariableDeclaration',
    declarationKind,
    identifier,
    typeAnnotation,
    initializer: initializer ?? null,
    loc: createLocation(tokenStart(safeStart), endNode.loc.end),
    range: createRange(safeStart.startOffset ?? 0, endNode.range[1]),
  };
}

function createAssignmentStatementNode(
  left: ExpressionNode | undefined,
  right: ExpressionNode | undefined,
  operatorToken: IToken | undefined,
  endToken: IToken | undefined,
): AssignmentStatementNode {
  const leftNode = left ?? createPlaceholderExpression();
  const safeEnd = ensureToken(endToken, operatorToken);
  return {
    kind: 'AssignmentStatement',
    left: leftNode,
    right: right ?? null,
    ...spanFromNodes(leftNode, safeEnd),
  };
}

function createExpressionStatementNode(expression: ExpressionNode | undefined): ExpressionStatementNode {
  const expr = expression ?? createPlaceholderExpression();
  return {
    kind: 'ExpressionStatement',
    expression: expr,
    loc: expr.loc,
    range: expr.range,
  };
}

function createScriptDeclarationNode(
  type: 'indicator' | 'strategy' | 'library',
  args: ArgumentNode[],
  start: IToken | undefined,
  end: IToken | undefined,
): ScriptDeclarationNode {
  return {
    kind: 'ScriptDeclaration',
    scriptType: type,
    identifier: null,
    arguments: args,
    ...spanFromTokens(start, end),
  };
}

function createVersionDirectiveNode(token?: IToken): VersionDirectiveNode {
  const safeToken = ensureToken(token);
  const match = /\d+/.exec(safeToken.image);
  const version = match ? Number(match[0]) : 0;
  return {
    kind: 'VersionDirective',
    version,
    ...spanFromTokens(safeToken, safeToken),
  };
}

function getLine(source: string, lineNumber: number): string {
  const lines = source.split(/\r?\n/);
  return lines[lineNumber - 1] ?? '';
}

function tokenToSyntaxError(token: IToken, message: string, source: string, filename = '<input>'): SyntaxError {
  const line = token.startLine ?? 1;
  const column = token.startColumn ?? 1;
  const text = getLine(source, line);
  return new SyntaxError(message, {
    filename,
    lineno: line,
    offset: column,
    text,
    end_lineno: token.endLine ?? line,
    end_offset: (token.endColumn ?? column) + 1,
  });
}

class PineParser extends EmbeddedActionsParser {
  constructor() {
    super(AllTokens, {
      recoveryEnabled: true,
      maxLookahead: 1,
      skipValidations: true,
    });
    this.performSelfAnalysis();
  }

  public program = this.RULE('program', () => {
    const directives: VersionDirectiveNode[] = [];
    const body: StatementNode[] = [];

    this.MANY(() => this.CONSUME(Newline));

    this.MANY2(() => {
      directives.push(this.SUBRULE(this.versionDirective));
      this.MANY3(() => this.CONSUME2(Newline));
    });

    this.MANY4(() => this.CONSUME3(Newline));

    this.MANY5(() => {
      body.push(this.SUBRULE(this.statement));
      this.MANY6(() => this.CONSUME4(Newline));
    });

    return { directives, body };
  });

  private versionDirective = this.RULE('versionDirective', () => {
    const token = this.CONSUME(VersionDirective);
    return createVersionDirectiveNode(token);
  });

  private statement = this.RULE('statement', () => {
    return this.OR([
      {
        GATE: () => {
          const next = this.LA(1).tokenType;
          return next === Indicator || next === Strategy || next === Library;
        },
        ALT: () => this.SUBRULE(this.scriptDeclaration),
      },
      {
        GATE: () => this.LA(1).tokenType === If,
        ALT: () => this.SUBRULE(this.ifStatement),
      },
      {
        GATE: () => this.LA(1).tokenType === While,
        ALT: () => this.SUBRULE(this.whileStatement),
      },
      {
        GATE: () => this.LA(1).tokenType === Return,
        ALT: () => this.SUBRULE(this.returnStatement),
      },
      {
        GATE: () => this.LA(1).tokenType === Break,
        ALT: () => this.SUBRULE(this.breakStatement),
      },
      {
        GATE: () => this.LA(1).tokenType === Continue,
        ALT: () => this.SUBRULE(this.continueStatement),
      },
      {
        GATE: () => this.isVariableDeclarationStart(),
        ALT: () => this.SUBRULE(this.variableDeclaration),
      },
      {
        GATE: () => this.isAssignmentStart(),
        ALT: () => this.SUBRULE(this.assignmentStatement),
      },
      { ALT: () => this.SUBRULE(this.expressionStatement) },
    ]);
  });

  private collectDeclarationTokens(startOffset: number): { tokens: IToken[]; terminator: IToken } | null {
    const tokens: IToken[] = [];
    let offset = startOffset;

    while (true) {
      const token = this.LA(offset);
      const tokenType = token.tokenType;

      if (tokenType === EOF_TOKEN || tokenType === Newline || tokenType === Equal || tokenType === ColonEqual) {
        return { tokens, terminator: token };
      }

      if (tokenType === IdentifierToken || tokenType === Less || tokenType === Greater || tokenType === Comma) {
        tokens.push(token);
        offset += 1;
        continue;
      }

      return null;
    }
  }

  private isVariableDeclarationStart(): boolean {
    const first = this.LA(1);

    if (isDeclarationKeywordToken(first)) {
      const collected = this.collectDeclarationTokens(2);
      if (!collected) {
        return false;
      }

      const identifierCount = collected.tokens.filter((token) => token.tokenType === IdentifierToken).length;
      if (identifierCount === 0) {
        return false;
      }

      const terminatorType = collected.terminator.tokenType;
      return (
        terminatorType === Equal ||
        terminatorType === ColonEqual ||
        terminatorType === Newline ||
        terminatorType === EOF_TOKEN
      );
    }

    const collected = this.collectDeclarationTokens(1);
    if (!collected) {
      return false;
    }

    const terminatorType = collected.terminator.tokenType;
    if (terminatorType !== Equal && terminatorType !== ColonEqual) {
      return false;
    }

    const identifierCount = collected.tokens.filter((token) => token.tokenType === IdentifierToken).length;
    return identifierCount >= 2;
  }

  private isAssignmentStart(): boolean {
    const first = this.LA(1);
    if (first.tokenType !== IdentifierToken) {
      return false;
    }

    let offset = 2;
    while (true) {
      const token = this.LA(offset);
      const tokenType = token.tokenType;

      if (
        tokenType === Equal ||
        tokenType === ColonEqual ||
        tokenType === PlusEqual ||
        tokenType === MinusEqual ||
        tokenType === StarEqual ||
        tokenType === SlashEqual ||
        tokenType === PercentEqual
      ) {
        return true;
      }

      if (tokenType === Dot) {
        offset += 1;
        const next = this.LA(offset);
        if (next.tokenType !== IdentifierToken) {
          return false;
        }
        offset += 1;
        continue;
      }

      if (tokenType === Newline || tokenType === LParen || tokenType === Comma || tokenType === RParen) {
        return false;
      }

      if (tokenType === EOF_TOKEN) {
        return false;
      }

      return false;
    }
  }

  private scriptDeclaration = this.RULE('scriptDeclaration', () => {
    const token = this.OR([{
      ALT: () => this.CONSUME(Indicator),
    }, {
      ALT: () => this.CONSUME(Strategy),
    }, {
      ALT: () => this.CONSUME(Library),
    }]);

    this.CONSUME(LParen);
    let args: ArgumentNode[] = [];
    if (this.LA(1).tokenType !== RParen) {
      args = this.SUBRULE(this.argumentList);
    }
    const endToken = this.CONSUME(RParen);

    const scriptType = token.tokenType === Indicator ? 'indicator' : token.tokenType === Strategy ? 'strategy' : 'library';
    return createScriptDeclarationNode(scriptType, args, token, endToken);
  });

  private variableDeclaration = this.RULE('variableDeclaration', () => {
    let declarationKind: VariableDeclarationKind = 'simple';
    let declarationToken: IToken | undefined;

    if (isDeclarationKeywordToken(this.LA(1))) {
      declarationToken = this.CONSUME(IdentifierToken);
      declarationKind = toDeclarationKind(declarationToken.image);
    }

    const collected = this.collectDeclarationTokens(1);
    const tokens = collected?.tokens ?? [];
    const { typeTokens } = splitDeclarationTokens(tokens);
    const typeAnnotation = buildTypeReferenceFromTokens(typeTokens);

    for (const token of typeTokens) {
      this.CONSUME(token.tokenType);
    }

    const identifierToken = this.CONSUME(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);

    let initializer: ExpressionNode | undefined;
    const nextTokenType = this.LA(1).tokenType;
    if (nextTokenType === Equal) {
      this.CONSUME(Equal);
      initializer = this.SUBRULE(this.expression);
    } else if (nextTokenType === ColonEqual) {
      this.CONSUME(ColonEqual);
      initializer = this.SUBRULE2(this.expression);
    }

    const startToken = declarationToken ?? typeTokens[0] ?? identifierToken;
    return createVariableDeclarationNode(
      declarationKind,
      identifier,
      identifierToken,
      typeAnnotation,
      initializer,
      startToken,
    );
  });

  private expressionStatement = this.RULE('expressionStatement', () => {
    const expression = this.SUBRULE(this.expression);
    return createExpressionStatementNode(expression);
  });

  private assignmentStatement = this.RULE('assignmentStatement', () => {
    const left = this.SUBRULE(this.assignmentTarget);
    const operator = this.OR([
      { ALT: () => this.CONSUME(Equal) },
      { ALT: () => this.CONSUME(ColonEqual) },
      { ALT: () => this.CONSUME(PlusEqual) },
      { ALT: () => this.CONSUME(MinusEqual) },
      { ALT: () => this.CONSUME(StarEqual) },
      { ALT: () => this.CONSUME(SlashEqual) },
      { ALT: () => this.CONSUME(PercentEqual) },
    ]);
    const right = this.SUBRULE(this.expression);
    const endToken = this.LA(0);
    return createAssignmentStatementNode(left, right, operator, endToken);
  });

  private ifStatement = this.RULE('ifStatement', (indentOverride?: number) => {
    const ifToken = this.CONSUME(If);
    const test = this.SUBRULE(this.expression);
    const indent = indentOverride ?? tokenIndent(ifToken);
    const consequent = this.parseIndentedBlock(indent);

    let alternate: StatementNode | null = null;

    let offset = 1;
    while (this.LA(offset).tokenType === Newline) {
      offset += 1;
    }
    const potentialElse = this.LA(offset);
    if (potentialElse.tokenType === Else && tokenIndent(potentialElse) <= indent) {
      while (this.LA(1).tokenType === Newline) {
        this.CONSUME(Newline);
      }
      const elseToken = this.CONSUME(Else);
      if (this.LA(1).tokenType === If) {
        alternate = this.SUBRULE2(this.ifStatement, { ARGS: [tokenIndent(elseToken)] });
      } else if (this.LA(1).tokenType === Newline) {
        alternate = this.parseIndentedBlock(tokenIndent(elseToken));
      } else {
        alternate = this.SUBRULE2(this.statement);
      }
    }

    const endToken = this.LA(0);
    return createIfStatementNode(test, consequent, alternate, ifToken, endToken);
  });

  private whileStatement = this.RULE('whileStatement', () => {
    const whileToken = this.CONSUME(While);
    const test = this.SUBRULE(this.expression) ?? createPlaceholderExpression();
    const body = this.parseIndentedBlock(tokenIndent(whileToken));
    const endToken = this.LA(0);
    return createWhileStatementNode(test, body, whileToken, endToken);
  });

  private returnStatement = this.RULE('returnStatement', () => {
    const returnToken = this.CONSUME(Return);
    let argument: ExpressionNode | null = null;
    const nextTokenType = this.LA(1).tokenType;
    if (!this.isStatementTerminator(nextTokenType)) {
      argument = this.SUBRULE(this.expression) ?? null;
    }
    const endToken = argument ? this.LA(0) : returnToken;
    return createReturnStatementNode(returnToken, argument, endToken);
  });

  private breakStatement = this.RULE('breakStatement', () => {
    const token = this.CONSUME(Break);
    return createBreakStatementNode(token);
  });

  private continueStatement = this.RULE('continueStatement', () => {
    const token = this.CONSUME(Continue);
    return createContinueStatementNode(token);
  });

  private parseIndentedBlock(indent: number): BlockStatementNode {
    const statements: StatementNode[] = [];
    let blockStartToken: IToken | undefined;
    let firstStatementToken: IToken | undefined;
    let lastToken: IToken | undefined;

    if (this.LA(1).tokenType === Newline) {
      const newlineToken = this.CONSUME(Newline);
      blockStartToken = blockStartToken ?? newlineToken;
      lastToken = newlineToken;
    }

    let shouldBreak = false;
    while (!shouldBreak) {
      let next = this.LA(1);
      while (next.tokenType === Newline) {
        let lookaheadOffset = 2;
        let lookahead = this.LA(lookaheadOffset);
        while (lookahead.tokenType === Newline) {
          lookaheadOffset += 1;
          lookahead = this.LA(lookaheadOffset);
        }

        if (lookahead.tokenType === EOF_TOKEN) {
          const newlineToken = this.CONSUME(Newline);
          lastToken = newlineToken;
          next = this.LA(1);
          continue;
        }

        if (tokenIndent(lookahead) <= indent) {
          shouldBreak = true;
          break;
        }

        const newlineToken = this.CONSUME(Newline);
        lastToken = newlineToken;
        next = this.LA(1);
      }

      if (shouldBreak) {
        break;
      }

      next = this.LA(1);
      if (next.tokenType === EOF_TOKEN || tokenIndent(next) <= indent) {
        break;
      }

      const statement = this.SUBRULE(this.statement);
      statements.push(statement);
      firstStatementToken = firstStatementToken ?? next;
      lastToken = this.LA(0);
    }

    return createBlockStatementNode(
      statements,
      blockStartToken ?? firstStatementToken,
      lastToken ?? blockStartToken ?? firstStatementToken,
    );
  }

  private isStatementTerminator(tokenType: any): boolean {
    return tokenType === Newline || tokenType === EOF_TOKEN || tokenType === Else;
  }

  private assignmentTarget = this.RULE('assignmentTarget', () => this.SUBRULE(this.memberExpression));

  private expression = this.RULE('expression', () => this.SUBRULE(this.logicalOrExpression));

  private logicalOrExpression = this.RULE('logicalOrExpression', () => {
    let expression = this.SUBRULE(this.logicalAndExpression);
    this.MANY(() => {
      const operator = this.CONSUME(Or);
      const right = this.SUBRULE2(this.logicalAndExpression);
      const endToken = this.LA(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });

  private logicalAndExpression = this.RULE('logicalAndExpression', () => {
    let expression = this.SUBRULE(this.equalityExpression);
    this.MANY(() => {
      const operator = this.CONSUME(And);
      const right = this.SUBRULE2(this.equalityExpression);
      const endToken = this.LA(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });

  private equalityExpression = this.RULE('equalityExpression', () => {
    let expression = this.SUBRULE(this.relationalExpression);
    this.MANY(() => {
      const operator = this.OR([{ ALT: () => this.CONSUME(EqualEqual) }, { ALT: () => this.CONSUME(NotEqual) }]);
      const right = this.SUBRULE2(this.relationalExpression);
      const endToken = this.LA(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });

  private relationalExpression = this.RULE('relationalExpression', () => {
    let expression = this.SUBRULE(this.additiveExpression);
    this.MANY(() => {
      const operator = this.OR([
        { ALT: () => this.CONSUME(LessEqual) },
        { ALT: () => this.CONSUME(GreaterEqual) },
        { ALT: () => this.CONSUME(Less) },
        { ALT: () => this.CONSUME(Greater) },
      ]);
      const right = this.SUBRULE2(this.additiveExpression);
      const endToken = this.LA(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });

  private additiveExpression = this.RULE('additiveExpression', () => {
    let expression = this.SUBRULE(this.multiplicativeExpression);
    this.MANY(() => {
      const operator = this.OR([{ ALT: () => this.CONSUME(Plus) }, { ALT: () => this.CONSUME(Minus) }]);
      const right = this.SUBRULE2(this.multiplicativeExpression);
      const endToken = this.LA(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });

  private multiplicativeExpression = this.RULE('multiplicativeExpression', () => {
    let expression = this.SUBRULE(this.unaryExpression);
    this.MANY(() => {
      const operator = this.OR([
        { ALT: () => this.CONSUME(Star) },
        { ALT: () => this.CONSUME(Slash) },
        { ALT: () => this.CONSUME(Percent) },
      ]);
      const right = this.SUBRULE2(this.unaryExpression);
      const endToken = this.LA(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });

  private unaryExpression = this.RULE('unaryExpression', () => {
    const lookahead = this.LA(1).tokenType;
    if (lookahead === Plus) {
      const operator = this.CONSUME(Plus);
      const argument = this.SUBRULE(this.unaryExpression);
      return createUnaryExpressionNode(operator, argument);
    }
    if (lookahead === Minus) {
      const operator = this.CONSUME(Minus);
      const argument = this.SUBRULE(this.unaryExpression);
      return createUnaryExpressionNode(operator, argument);
    }
    if (lookahead === Not) {
      const operator = this.CONSUME(Not);
      const argument = this.SUBRULE(this.unaryExpression);
      return createUnaryExpressionNode(operator, argument);
    }

    return this.SUBRULE(this.callExpression);
  });

  private callExpression = this.RULE('callExpression', () => {
    let expression = this.SUBRULE(this.primaryExpression);

    this.MANY(() => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(LParen);
            let args: ArgumentNode[] = [];
            if (this.LA(1).tokenType !== RParen) {
              args = this.SUBRULE(this.argumentList);
            }
            const rParen = this.CONSUME(RParen);
            expression = createCallExpressionNode(expression, args, rParen);
          },
        },
        {
          ALT: () => {
            this.CONSUME(Dot);
            const propertyToken = this.CONSUME(IdentifierToken);
            const property = createIdentifierNode(propertyToken);
            expression = createMemberExpressionNode(expression, property, propertyToken);
          },
        },
      ]);
    });

    return expression;
  });

  private memberExpression = this.RULE('memberExpression', () => {
    let expression = this.SUBRULE(this.primaryExpression);
    this.MANY(() => {
      this.CONSUME(Dot);
      const propertyToken = this.CONSUME(IdentifierToken);
      const property = createIdentifierNode(propertyToken);
      expression = createMemberExpressionNode(expression, property, propertyToken);
    });
    return expression;
  });

  private argumentList = this.RULE('argumentList', (): ArgumentNode[] => {
    const args: ArgumentNode[] = [];

    args.push(this.SUBRULE(this.argument));

    this.MANY(() => {
      this.CONSUME(Comma);
      args.push(this.SUBRULE2(this.argument));
    });

    return args;
  });

  private argument = this.RULE('argument', () => {
    const lookahead = this.LA(1);
    if (lookahead.tokenType === IdentifierToken && this.LA(2).tokenType === Equal) {
      const nameToken = this.CONSUME(IdentifierToken);
      const equal = this.CONSUME(Equal);
      const value = this.SUBRULE(this.expression);
      const name = createIdentifierNode(nameToken);
      const endToken = this.LA(0);
      return createArgumentNode(name, value, nameToken, endToken);
    }

    const start = this.LA(1);
    const value = this.SUBRULE2(this.expression);
    const end = this.LA(0);
    return createArgumentNode(null, value, start, end);
  });

  private primaryExpression = this.RULE('primaryExpression', (): ExpressionNode => {
    const token = this.LA(1);
    switch (token.tokenType) {
      case IdentifierToken:
        return createIdentifierNode(this.CONSUME(IdentifierToken));
      case StringToken:
        return this.createLiteralFromToken(this.CONSUME(StringToken));
      case NumberToken:
        return this.createLiteralFromToken(this.CONSUME(NumberToken));
      case True:
        return this.createLiteralFromToken(this.CONSUME(True));
      case False:
        return this.createLiteralFromToken(this.CONSUME(False));
      case NaToken:
        return this.createLiteralFromToken(this.CONSUME(NaToken));
      case LParen: {
        this.CONSUME(LParen);
        const expression = this.SUBRULE(this.expression);
        this.CONSUME(RParen);
        return expression ?? createPlaceholderExpression();
      }
      default:
        return createIdentifierNode(this.CONSUME(IdentifierToken));
    }
  });

  private createLiteralFromToken(token: IToken): ExpressionNode {
    if (token.tokenType === StringToken) {
      return createStringNode(token);
    }
    if (token.tokenType === NumberToken) {
      return createNumberNode(token);
    }
    if (token.tokenType === True) {
      return createBooleanNode(token, true);
    }
    if (token.tokenType === False) {
      return createBooleanNode(token, false);
    }
    return createNullNode(token);
  }
}

function buildProgramNode(
  source: string,
  directives: VersionDirectiveNode[],
  body: StatementNode[],
): ProgramNode {
  const endOffset = source.length;
  const lines = source.split(/\r?\n/);
  const endLine = lines.length || 1;
  const endColumn = (lines[endLine - 1]?.length ?? 0) + 1;
  return {
    kind: 'Program',
    directives,
    body,
    loc: createLocation(createPosition(1, 1, 0), createPosition(endLine, endColumn, endOffset)),
    range: createRange(0, endOffset),
  };
}

const sharedParser = new PineParser();

export function parseWithChevrotain(source: string, options: AstParseOptions = {}): AstParseResult {
  const lexResult = PineLexer.tokenize(source);
  sharedParser.reset();
  sharedParser.input = lexResult.tokens;

  const programResult = sharedParser.program() ?? { directives: [], body: [] };
  const { directives, body } = programResult;

  const syntaxErrors: SyntaxError[] = [];

  const filename = options.filename ?? '<input>';

  for (const error of lexResult.errors) {
    const line = error.line ?? 1;
    const column = error.column ?? 1;
    const text = getLine(source, line);
    syntaxErrors.push(
      new SyntaxError(error.message, {
        filename,
        lineno: line,
        offset: column,
        text,
        end_lineno: line,
        end_offset: column + 1,
      }),
    );
  }

  for (const error of sharedParser.errors) {
    const token = error.token ?? { startLine: 1, startColumn: 1, image: '', tokenType: EOF_TOKEN };
    syntaxErrors.push(tokenToSyntaxError(token as IToken, error.message, source, filename));
  }

  sharedParser.reset();

  const hasErrors = syntaxErrors.length > 0;
  if (hasErrors && options.allowErrors !== true) {
    return {
      ast: null,
      diagnostics: createAstDiagnostics(syntaxErrors),
    };
  }

  return {
    ast: buildProgramNode(source, directives, body),
    diagnostics: createAstDiagnostics(syntaxErrors),
  };
}
