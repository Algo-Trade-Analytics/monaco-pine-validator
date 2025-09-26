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
  type ConditionalExpressionNode,
  type FunctionDeclarationNode,
  type ContinueStatementNode,
  type ForStatementNode,
  type ExpressionNode,
  type ExpressionStatementNode,
  type IfStatementNode,
  type IdentifierNode,
  type IndexExpressionNode,
  type MatrixLiteralNode,
  type MemberExpressionNode,
  type NullLiteralNode,
  type NumberLiteralNode,
  type ParameterNode,
  type CompilerAnnotationNode,
  type ProgramNode,
  type Range,
  type RepeatStatementNode,
  type ReturnStatementNode,
  type ScriptDeclarationNode,
  type SourceLocation,
  type StatementNode,
  type SwitchCaseNode,
  type SwitchStatementNode,
  type StringLiteralNode,
  type TupleExpressionNode,
  type ImportDeclarationNode,
  type EnumDeclarationNode,
  type EnumMemberNode,
  type TypeDeclarationNode,
  type TypeFieldNode,
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
  CompilerAnnotation,
  Newline,
  Indicator,
  Strategy,
  Library,
  Import,
  As,
  If,
  Else,
  Repeat,
  Switch,
  Enum,
  Type,
  Until,
  Identifier as IdentifierToken,
  StringLiteral as StringToken,
  NumberLiteral as NumberToken,
  True,
  False,
  NaToken,
  LParen,
  RParen,
  LBracket,
  RBracket,
  Comma,
  Dot,
  Equal,
  ColonEqual,
  Colon,
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
  NullishCoalescing,
  Question,
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
  For,
  Break,
  Continue,
  Return,
  FatArrow,
  To,
  By,
} from './tokens';

const EOF_TOKEN = EOF;

type AnnotatableStatementNode =
  | ScriptDeclarationNode
  | FunctionDeclarationNode
  | TypeDeclarationNode
  | EnumDeclarationNode
  | VariableDeclarationNode;

function isAnnotatableStatement(node: StatementNode): node is AnnotatableStatementNode {
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

function attachCompilerAnnotations(
  node: StatementNode,
  annotations: CompilerAnnotationNode[],
): void {
  if (annotations.length === 0) {
    return;
  }

  if (isAnnotatableStatement(node)) {
    node.annotations.push(...annotations);
  }
}

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

const FUNCTION_MODIFIER_KEYWORDS = new Set(['method', 'static']);

function isFunctionModifierToken(token: IToken | undefined): boolean {
  if (!token) {
    return false;
  }
  return FUNCTION_MODIFIER_KEYWORDS.has(token.image?.toLowerCase() ?? '');
}

function isExportKeywordToken(token: IToken | undefined): boolean {
  if (!token) {
    return false;
  }
  return (token.image ?? '').toLowerCase() === 'export';
}

function isTokenKeyword(token: IToken | undefined, keyword: string): boolean {
  return (token?.image ?? '').toLowerCase() === keyword;
}

function splitFunctionHeadTokens(tokens: IToken[]): { typeTokens: IToken[]; nameTokens: IToken[] } {
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

function createIdentifierFromTokens(tokens: IToken[]): IdentifierNode {
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

function createParameterNode(
  identifier: IdentifierNode,
  typeAnnotation: TypeReferenceNode | null,
  defaultValue: ExpressionNode | undefined,
  startToken: IToken | undefined,
): ParameterNode {
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

function createFunctionDeclarationNode(
  identifier: IdentifierNode | null,
  params: ParameterNode[],
  body: BlockStatementNode,
  isExported: boolean,
  returnType: TypeReferenceNode | null,
  startToken: IToken | undefined,
): FunctionDeclarationNode {
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
    loc: createLocation(startPosition, body.loc.end),
    range: createRange(startOffset, body.range[1]),
  };
}

function createImplicitReturnStatementNode(
  expression: ExpressionNode | undefined,
  arrowToken: IToken,
): ReturnStatementNode {
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

function cloneIdentifierNode(source: IdentifierNode | null): IdentifierNode | null {
  if (!source) {
    return null;
  }

  const {
    name,
    loc: {
      start: { line: startLine, column: startColumn, offset: startOffset },
      end: { line: endLine, column: endColumn, offset: endOffset },
    },
    range,
  } = source;

  return {
    kind: 'Identifier',
    name,
    loc: createLocation(
      createPosition(startLine, startColumn, startOffset),
      createPosition(endLine, endColumn, endOffset),
    ),
    range: createRange(range[0], range[1]),
  };
}

function createSyntheticToken(
  image: string,
  tokenType: typeof IdentifierToken,
  reference?: IToken,
): IToken {
  const base = ensureToken(reference);
  const length = image.length;
  const startLine = base.startLine ?? 1;
  const startColumn = base.startColumn ?? 1;
  const startOffset = base.startOffset ?? 0;
  const endLine = base.endLine ?? startLine;
  const endColumn = startColumn + length;
  const endOffset = startOffset + length;

  return {
    image,
    startLine,
    startColumn,
    startOffset,
    endLine,
    endColumn,
    endOffset,
    tokenType,
  } as IToken;
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

function createRepeatStatementNode(
  body: BlockStatementNode,
  test: ExpressionNode,
  startToken: IToken,
  endToken: IToken | undefined,
): RepeatStatementNode {
  const span = spanFromTokens(startToken, endToken ?? startToken);
  return {
    kind: 'RepeatStatement',
    body,
    test,
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

function createForStatementNode(
  initializer: VariableDeclarationNode | AssignmentStatementNode | null,
  test: ExpressionNode | null,
  update: ExpressionNode | null,
  body: BlockStatementNode,
  startToken: IToken,
  endToken: IToken | undefined,
): ForStatementNode {
  const span = spanFromTokens(startToken, endToken ?? startToken);
  return {
    kind: 'ForStatement',
    initializer,
    test,
    update,
    body,
    ...span,
  };
}

function createSwitchStatementNode(
  discriminant: ExpressionNode | undefined,
  cases: SwitchCaseNode[],
  startToken: IToken,
  endToken: IToken | undefined,
): SwitchStatementNode {
  const safeDiscriminant = discriminant ?? createPlaceholderExpression();
  const span = spanFromTokens(startToken, endToken ?? startToken);
  return {
    kind: 'SwitchStatement',
    discriminant: safeDiscriminant,
    cases,
    ...span,
  };
}

function createSwitchCaseNode(
  test: ExpressionNode | null,
  consequent: StatementNode[],
  startToken: IToken | undefined,
  arrowToken: IToken,
  endToken: IToken | undefined,
): SwitchCaseNode {
  const safeStartToken = ensureToken(startToken, arrowToken);
  const startPosition = test && test.loc ? test.loc.start : tokenStart(safeStartToken);
  const startOffset = test && test.range ? test.range[0] : safeStartToken.startOffset ?? 0;
  if (consequent.length > 0) {
    const last = consequent[consequent.length - 1];
    return {
      kind: 'SwitchCase',
      test,
      consequent,
      loc: createLocation(startPosition, last.loc.end),
      range: createRange(startOffset, last.range[1]),
    };
  }

  const safeEnd = ensureToken(endToken, arrowToken);
  return {
    kind: 'SwitchCase',
    test,
    consequent,
    loc: createLocation(startPosition, tokenEnd(safeEnd)),
    range: createRange(startOffset, (safeEnd.endOffset ?? safeEnd.startOffset ?? 0) + 1),
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

function createIndexExpressionNode(
  object: ExpressionNode | undefined,
  index: ExpressionNode | undefined,
  closingToken: IToken | undefined,
): IndexExpressionNode {
  const safeObject = object ?? createPlaceholderExpression();
  const safeIndex = index ?? createPlaceholderExpression();
  return {
    kind: 'IndexExpression',
    object: safeObject,
    index: safeIndex,
    ...spanFromNodes(safeObject, closingToken),
  };
}

function createTupleExpressionNode(
  elements: (ExpressionNode | null)[],
  startToken: IToken | undefined,
  endToken: IToken | undefined,
): TupleExpressionNode {
  const safeStart = ensureToken(startToken);
  const safeEnd = ensureToken(endToken, safeStart);
  return {
    kind: 'TupleExpression',
    elements,
    ...spanFromTokens(safeStart, safeEnd),
  };
}

function createMatrixLiteralNode(
  rows: ExpressionNode[][],
  startToken: IToken | undefined,
  endToken: IToken | undefined,
): MatrixLiteralNode {
  const safeStart = ensureToken(startToken);
  const safeEnd = ensureToken(endToken, safeStart);
  return {
    kind: 'MatrixLiteral',
    rows,
    ...spanFromTokens(safeStart, safeEnd),
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

function createConditionalExpressionNode(
  test: ExpressionNode | undefined,
  consequent: ExpressionNode | undefined,
  alternate: ExpressionNode | undefined,
  questionToken: IToken | undefined,
  colonToken: IToken | undefined,
  endToken: IToken | undefined,
): ConditionalExpressionNode {
  const testNode = test ?? createPlaceholderExpression();
  const consequentNode = consequent ?? createPlaceholderExpression();
  const alternateNode = alternate ?? createPlaceholderExpression();
  const hasRealAlternate = Boolean(alternate);
  const fallbackEndToken = ensureToken(endToken ?? colonToken ?? questionToken);
  const endPosition = hasRealAlternate ? alternateNode.loc.end : tokenEnd(fallbackEndToken);
  const rangeEnd = hasRealAlternate
    ? alternateNode.range[1]
    : (fallbackEndToken.endOffset ?? fallbackEndToken.startOffset ?? 0) + 1;

  return {
    kind: 'ConditionalExpression',
    test: testNode,
    consequent: consequentNode,
    alternate: alternateNode,
    loc: createLocation(testNode.loc.start, endPosition),
    range: createRange(testNode.range[0], rangeEnd),
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
    annotations: [],
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
    annotations: [],
    ...spanFromTokens(start, end),
  };
}

function createImportDeclarationNode(
  pathToken: IToken | undefined,
  aliasToken: IToken | undefined,
  startToken: IToken | undefined,
  endToken: IToken | undefined,
): ImportDeclarationNode {
  const path = createStringNode(pathToken);
  const alias = createIdentifierNode(aliasToken);
  return {
    kind: 'ImportDeclaration',
    path,
    alias,
    ...spanFromTokens(startToken ?? pathToken, endToken ?? aliasToken ?? pathToken),
  };
}

function createEnumMemberNode(
  identifier: IdentifierNode,
  value: ExpressionNode | null,
  _startToken: IToken | undefined,
  endToken: IToken | undefined,
): EnumMemberNode {
  return {
    kind: 'EnumMember',
    identifier,
    value,
    ...spanFromNodes(identifier, endToken),
  };
}

function createEnumDeclarationNode(
  identifier: IdentifierNode,
  members: EnumMemberNode[],
  isExported: boolean,
  startToken: IToken | undefined,
  endToken: IToken | undefined,
): EnumDeclarationNode {
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

function createTypeFieldNode(
  identifier: IdentifierNode,
  typeAnnotation: TypeReferenceNode | null,
  startToken: IToken | undefined,
  endToken: IToken | undefined,
): TypeFieldNode {
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

function createTypeDeclarationNode(
  identifier: IdentifierNode,
  fields: TypeFieldNode[],
  isExported: boolean,
  startToken: IToken | undefined,
  endToken: IToken | undefined,
): TypeDeclarationNode {
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

function createCompilerAnnotationNode(token?: IToken): CompilerAnnotationNode {
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
      const annotations: CompilerAnnotationNode[] = [];

      this.MANY7(() => {
        const annotationToken = this.CONSUME(CompilerAnnotation);
        annotations.push(createCompilerAnnotationNode(annotationToken));
        this.MANY8(() => this.CONSUME5(Newline));
      });

      const statementNode = this.SUBRULE(this.statement);
      attachCompilerAnnotations(statementNode, annotations);
      body.push(statementNode);
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
        GATE: () => {
          if (!isExportKeywordToken(this.LA(1))) {
            return false;
          }
          const next = this.nextSignificantToken(2);
          return (
            next.tokenType === Type ||
            next.tokenType === Enum ||
            isTokenKeyword(next, 'type') ||
            isTokenKeyword(next, 'enum') ||
            this.isFunctionDeclarationStart()
          );
        },
        ALT: () => {
          const exportToken = this.CONSUME(IdentifierToken);
          this.MANY(() => this.CONSUME(Newline));
          if (this.LA(1).tokenType === Type || isTokenKeyword(this.LA(1), 'type')) {
            return this.SUBRULE(this.typeDeclaration, { ARGS: [exportToken] });
          }
          if (this.LA(1).tokenType === Enum || isTokenKeyword(this.LA(1), 'enum')) {
            return this.SUBRULE(this.enumDeclaration, { ARGS: [exportToken] });
          }
          return this.SUBRULE(this.functionDeclaration, { ARGS: [exportToken] });
        },
      },
      {
        GATE: () => this.LA(1).tokenType === Import,
        ALT: () => this.SUBRULE(this.importDeclaration),
      },
      {
        GATE: () => this.LA(1).tokenType === Enum,
        ALT: () => this.SUBRULE(this.enumDeclaration),
      },
      {
        GATE: () => this.LA(1).tokenType === Type,
        ALT: () => this.SUBRULE(this.typeDeclaration),
      },
      {
        GATE: () => this.isFunctionDeclarationStart(),
        ALT: () => this.SUBRULE(this.functionDeclaration),
      },
      {
        GATE: () => this.LA(1).tokenType === If,
        ALT: () => this.SUBRULE(this.ifStatement),
      },
      {
        GATE: () => this.LA(1).tokenType === Repeat,
        ALT: () => this.SUBRULE(this.repeatStatement),
      },
      {
        GATE: () => this.LA(1).tokenType === For,
        ALT: () => this.SUBRULE(this.forStatement),
      },
      {
        GATE: () => this.LA(1).tokenType === While,
        ALT: () => this.SUBRULE(this.whileStatement),
      },
      {
        GATE: () => this.LA(1).tokenType === Switch,
        ALT: () => this.SUBRULE(this.switchStatement),
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
        GATE: () => this.LA(1).tokenType === LBracket && this.isTupleAssignmentStart(),
        ALT: () => this.SUBRULE(this.tupleAssignmentStatement),
      },
      {
        GATE: () => this.isAssignmentStart(),
        ALT: () => this.SUBRULE(this.assignmentStatement),
      },
      { ALT: () => this.SUBRULE(this.expressionStatement) },
    ]);
  });

  private nextSignificantToken(startOffset: number): IToken {
    let offset = startOffset;
    while (true) {
      const token = this.LA(offset);
      if (token.tokenType === EOF_TOKEN) {
        return token;
      }
      if (token.tokenType !== Newline && token.tokenType !== CompilerAnnotation) {
        return token;
      }
      offset += 1;
    }
  }

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

  private collectFunctionHeadTokens(
    startOffset: number,
  ): { tokens: IToken[]; lParenOffset: number } | null {
    const tokens: IToken[] = [];
    let offset = startOffset;

    while (true) {
      const token = this.LA(offset);
      const tokenType = token.tokenType;

      if (tokenType === LParen) {
        return { tokens, lParenOffset: offset };
      }

      if (
        tokenType === IdentifierToken ||
        tokenType === Less ||
        tokenType === Greater ||
        tokenType === Comma ||
        tokenType === Dot
      ) {
        tokens.push(token);
        offset += 1;
        continue;
      }

      if (tokenType === EOF_TOKEN || tokenType === Newline) {
        return null;
      }

      return null;
    }
  }

  private collectParameterTokens(startOffset: number): IToken[] {
    const tokens: IToken[] = [];
    let offset = startOffset;
    let genericDepth = 0;

    while (true) {
      const token = this.LA(offset);
      const tokenType = token.tokenType;

      if (tokenType === EOF_TOKEN) {
        return tokens;
      }

      if (tokenType === Less) {
        genericDepth += 1;
      } else if (tokenType === Greater && genericDepth > 0) {
        genericDepth -= 1;
      }

      if (genericDepth === 0 && (tokenType === Equal || tokenType === Comma || tokenType === RParen)) {
        return tokens;
      }

      if (
        tokenType === IdentifierToken ||
        tokenType === Less ||
        tokenType === Greater ||
        tokenType === Comma ||
        tokenType === Dot
      ) {
        tokens.push(token);
        offset += 1;
        continue;
      }

      return tokens;
    }
  }

  private isFunctionDeclarationStart(): boolean {
    let offset = 1;

    if (isExportKeywordToken(this.LA(offset))) {
      offset += 1;
    }

    while (isFunctionModifierToken(this.LA(offset))) {
      offset += 1;
    }

    const collected = this.collectFunctionHeadTokens(offset);
    if (!collected || collected.tokens.length === 0) {
      return false;
    }

    let scanOffset = collected.lParenOffset;
    let depth = 0;

    while (true) {
      const token = this.LA(scanOffset);
      const tokenType = token.tokenType;

      if (tokenType === EOF_TOKEN) {
        return false;
      }

      if (tokenType === LParen) {
        depth += 1;
      } else if (tokenType === RParen) {
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

    while (this.LA(scanOffset).tokenType === Newline) {
      scanOffset += 1;
    }

    return this.LA(scanOffset).tokenType === FatArrow;
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

  private isTupleAssignmentStart(): boolean {
    if (this.LA(1).tokenType !== LBracket) {
      return false;
    }

    let offset = 2;
    let depth = 1;

    while (depth > 0) {
      const token = this.LA(offset);
      const tokenType = token.tokenType;

      if (tokenType === LBracket) {
        depth += 1;
      } else if (tokenType === RBracket) {
        depth -= 1;
      } else if (tokenType === EOF_TOKEN) {
        return false;
      }

      offset += 1;
    }

    while (this.LA(offset).tokenType === Newline) {
      offset += 1;
    }

    const terminator = this.LA(offset).tokenType;
    return (
      terminator === Equal ||
      terminator === ColonEqual ||
      terminator === PlusEqual ||
      terminator === MinusEqual ||
      terminator === StarEqual ||
      terminator === SlashEqual ||
      terminator === PercentEqual
    );
  }

  private isAssignmentStart(): boolean {
    const first = this.LA(1);
    if (first.tokenType === LBracket) {
      let offset = 2;
      let depth = 1;
      while (depth > 0) {
        const token = this.LA(offset);
        const tokenType = token.tokenType;

        if (tokenType === LBracket) {
          depth += 1;
        } else if (tokenType === RBracket) {
          depth -= 1;
        } else if (tokenType === EOF_TOKEN) {
          return false;
        }

        offset += 1;
      }

    while (this.LA(offset).tokenType === Newline) {
      offset += 1;
    }

    const terminator = this.LA(offset).tokenType;
    return (
      terminator === Equal ||
      terminator === ColonEqual ||
      terminator === PlusEqual ||
        terminator === MinusEqual ||
        terminator === StarEqual ||
        terminator === SlashEqual ||
        terminator === PercentEqual
      );
    }

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

      if (tokenType === LBracket) {
        offset += 1;
        let bracketDepth = 1;
        while (bracketDepth > 0) {
          const inner = this.LA(offset);
          const innerType = inner.tokenType;

          if (innerType === LBracket) {
            bracketDepth += 1;
          } else if (innerType === RBracket) {
            bracketDepth -= 1;
          } else if (innerType === EOF_TOKEN || innerType === Newline) {
            return false;
          }

          offset += 1;
        }
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

  private parameterList = this.RULE('parameterList', () => {
    const params: ParameterNode[] = [];
    params.push(this.SUBRULE(this.parameter));
    this.MANY(() => {
      this.CONSUME(Comma);
      params.push(this.SUBRULE2(this.parameter));
    });
    return params;
  });

  private parameter = this.RULE('parameter', () => {
    const tokens = this.collectParameterTokens(1);
    const { typeTokens, identifierToken } = splitDeclarationTokens(tokens);
    const typeAnnotation = buildTypeReferenceFromTokens(typeTokens);

    const consumedTypeTokens: IToken[] = [];
    for (const token of typeTokens) {
      consumedTypeTokens.push(this.CONSUME(token.tokenType));
    }

    let identifierSource: IToken;
    if (identifierToken) {
      identifierSource = this.CONSUME(IdentifierToken);
    } else {
      identifierSource = this.CONSUME(IdentifierToken);
    }

    const identifier = createIdentifierNode(identifierSource);

    let defaultValue: ExpressionNode | undefined;
    if (this.LA(1).tokenType === Equal) {
      this.CONSUME(Equal);
      defaultValue = this.SUBRULE(this.expression) ?? createPlaceholderExpression();
    }

    const startToken = consumedTypeTokens[0] ?? identifierSource;
    return createParameterNode(identifier, typeAnnotation, defaultValue, startToken);
  });

  private functionDeclaration = this.RULE('functionDeclaration', (providedExport?: IToken) => {
    let startToken: IToken | undefined = providedExport;
    let exportToken: IToken | undefined = providedExport;

    if (!exportToken && isExportKeywordToken(this.LA(1))) {
      exportToken = this.CONSUME(IdentifierToken);
      startToken = exportToken;
    }

    while (isFunctionModifierToken(this.LA(1))) {
      const modifierToken = this.CONSUME(IdentifierToken);
      startToken = startToken ?? modifierToken;
    }

    const collected = this.collectFunctionHeadTokens(1);
    const signatureTokens = collected?.tokens ?? [];
    const split = splitFunctionHeadTokens(signatureTokens);

    const typeTokens = split.typeTokens;
    const nameTokens = split.nameTokens;
    const typeAnnotation = buildTypeReferenceFromTokens(typeTokens);

    const consumedTypeTokens: IToken[] = [];
    for (const token of typeTokens) {
      consumedTypeTokens.push(this.CONSUME(token.tokenType));
    }

    const consumedNameTokens: IToken[] = [];
    let identifier: IdentifierNode | null = null;
    if (nameTokens.length > 0) {
      for (const token of nameTokens) {
        consumedNameTokens.push(this.CONSUME(token.tokenType));
      }
      identifier = createIdentifierFromTokens(consumedNameTokens);
    } else {
      const fallbackToken = this.CONSUME(IdentifierToken);
      consumedNameTokens.push(fallbackToken);
      identifier = createIdentifierNode(fallbackToken);
    }

    this.CONSUME(LParen);
    let params: ParameterNode[] = [];
    if (this.LA(1).tokenType !== RParen) {
      params = this.SUBRULE(this.parameterList);
    }
    this.CONSUME(RParen);
    const arrowToken = this.CONSUME(FatArrow);

    let body: BlockStatementNode;
    const blockIndentToken = startToken ?? consumedTypeTokens[0] ?? consumedNameTokens[0] ?? arrowToken;

    if (this.LA(1).tokenType === Newline) {
      body = this.parseIndentedBlock(tokenIndent(blockIndentToken));
    } else {
      const expression = this.SUBRULE(this.expression) ?? createPlaceholderExpression();
      const endToken = this.LA(0);
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


  private importDeclaration = this.RULE('importDeclaration', () => {
    const importToken = this.CONSUME(Import);
    const pathToken = this.CONSUME(StringToken);
    this.CONSUME(As);
    const aliasToken = this.CONSUME(IdentifierToken);
    return createImportDeclarationNode(pathToken, aliasToken, importToken, aliasToken);
  });

  private enumDeclaration = this.RULE('enumDeclaration', (providedExport?: IToken) => {
    let exportToken: IToken | undefined = providedExport;
    if (!exportToken && isExportKeywordToken(this.LA(1))) {
      exportToken = this.CONSUME(IdentifierToken);
    }

    const enumToken = this.CONSUME(Enum);
    const identifierToken = this.CONSUME(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);

    const members: EnumMemberNode[] = [];
    const indentToken = exportToken ?? enumToken;
    const baseIndent = tokenIndent(indentToken);

    this.MANY(() => this.CONSUME(Newline));

    while (true) {
      const next = this.LA(1);
      if (next.tokenType === EOF_TOKEN) {
        break;
      }

      if (next.tokenType === Newline) {
        this.CONSUME(Newline);
        continue;
      }

      if (tokenIndent(next) <= baseIndent) {
        break;
      }

      const member = this.SUBRULE(this.enumMember, { ARGS: [baseIndent] });
      members.push(member);

      while (this.LA(1).tokenType === Newline) {
        this.CONSUME(Newline);
      }
    }

    const endToken = members.length > 0 ? this.LA(0) : identifierToken;
    return createEnumDeclarationNode(identifier, members, Boolean(exportToken), exportToken ?? enumToken, endToken);
  });

  private enumMember = this.RULE('enumMember', (_parentIndent: number) => {
    const identifierToken = this.CONSUME(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);

    let value: ExpressionNode | null = null;
    let endToken: IToken | undefined = identifierToken;

    if (this.LA(1).tokenType === Equal) {
      this.CONSUME(Equal);
      value = this.SUBRULE(this.expression);
      endToken = this.LA(0);
    }

    return createEnumMemberNode(identifier, value, identifierToken, endToken);
  });

  private typeDeclaration = this.RULE('typeDeclaration', (providedExport?: IToken) => {
    let exportToken: IToken | undefined = providedExport;
    if (!exportToken && isExportKeywordToken(this.LA(1))) {
      exportToken = this.CONSUME(IdentifierToken);
    }

    const typeToken = this.CONSUME(Type);
    const identifierToken = this.CONSUME(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);

    const fields: TypeFieldNode[] = [];
    const indentToken = exportToken ?? typeToken;
    const baseIndent = tokenIndent(indentToken);

    this.MANY(() => this.CONSUME(Newline));

    while (true) {
      const next = this.LA(1);
      if (next.tokenType === EOF_TOKEN) {
        break;
      }

      if (next.tokenType === Newline) {
        this.CONSUME(Newline);
        continue;
      }

      if (tokenIndent(next) <= baseIndent) {
        break;
      }

      const field = this.SUBRULE(this.typeField);
      fields.push(field);

      while (this.LA(1).tokenType === Newline) {
        this.CONSUME(Newline);
      }
    }

    const endToken = fields.length > 0 ? this.LA(0) : identifierToken;
    return createTypeDeclarationNode(identifier, fields, Boolean(exportToken), exportToken ?? typeToken, endToken);
  });

  private typeField = this.RULE('typeField', () => {
    const collected = this.collectDeclarationTokens(1);
    const tokens = collected?.tokens ?? [];
    const { typeTokens } = splitDeclarationTokens(tokens);
    const typeAnnotation = buildTypeReferenceFromTokens(typeTokens);

    const consumedTypeTokens: IToken[] = [];
    for (const token of typeTokens) {
      consumedTypeTokens.push(this.CONSUME(token.tokenType));
    }

    const identifierToken = this.CONSUME(IdentifierToken);
    const identifier = createIdentifierNode(identifierToken);
    const startToken = consumedTypeTokens[0] ?? identifierToken;
    return createTypeFieldNode(identifier, typeAnnotation, startToken, identifierToken);
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

  private tupleAssignmentStatement = this.RULE('tupleAssignmentStatement', () => {
    const left = this.SUBRULE(this.bracketExpression);
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

  private forStatement = this.RULE('forStatement', () => {
    const forToken = this.CONSUME(For);

    let initializer: VariableDeclarationNode | AssignmentStatementNode | null = null;
    if (this.isVariableDeclarationStart()) {
      initializer = this.SUBRULE(this.variableDeclaration);
    } else if (this.isAssignmentStart()) {
      initializer = this.SUBRULE(this.assignmentStatement);
    }

    const loopIdentifier: IdentifierNode | null = initializer
      ? initializer.kind === 'VariableDeclaration'
        ? initializer.identifier
        : initializer.kind === 'AssignmentStatement' && initializer.left.kind === 'Identifier'
          ? (initializer.left as IdentifierNode)
          : null
      : null;

    let test: ExpressionNode | null = null;
    let update: ExpressionNode | null = null;

    if (this.LA(1).tokenType === To) {
      const toToken = this.CONSUME(To);
      const endExpression = this.SUBRULE(this.expression) ?? createPlaceholderExpression();
      const endToken = this.LA(0);

      const testIdentifier = cloneIdentifierNode(loopIdentifier);
      if (testIdentifier) {
        const operatorToken = createSyntheticToken('<=', LessEqual, toToken);
        test = createBinaryExpressionNode(testIdentifier, operatorToken, endExpression, endToken);
      } else {
        test = endExpression;
      }

      if (this.LA(1).tokenType === By) {
        const byToken = this.CONSUME(By);
        const stepExpression = this.SUBRULE2(this.expression) ?? createPlaceholderExpression();
        const updateEndToken = this.LA(0);
        const updateIdentifier = cloneIdentifierNode(loopIdentifier);
        if (updateIdentifier) {
          const operatorToken = createSyntheticToken('+', Plus, byToken);
          update = createBinaryExpressionNode(updateIdentifier, operatorToken, stepExpression, updateEndToken);
        } else {
          update = stepExpression;
        }
      } else {
        const updateIdentifier = cloneIdentifierNode(loopIdentifier);
        if (updateIdentifier) {
          const defaultStepToken = createSyntheticToken('1', NumberToken, toToken);
          const defaultStep = createNumberNode(defaultStepToken);
          const operatorToken = createSyntheticToken('+', Plus, toToken);
          update = createBinaryExpressionNode(updateIdentifier, operatorToken, defaultStep, defaultStepToken);
        }
      }
    }

    const body = this.parseIndentedBlock(tokenIndent(forToken));
    const endToken = this.LA(0);
    return createForStatementNode(initializer, test, update, body, forToken, endToken);
  });

  private switchStatement = this.RULE('switchStatement', () => this.SUBRULE(this.switchExpression));

  private switchExpression = this.RULE('switchExpression', () => {
    const switchToken = this.CONSUME(Switch);
    return this.parseSwitchStructure(switchToken);
  });

  private switchCase = this.RULE('switchCase', () => {
    const startToken = this.LA(1);
    let test: ExpressionNode | null = null;

    if (startToken.tokenType === FatArrow) {
      const arrowToken = this.CONSUME(FatArrow);
      const { statements, endToken } = this.parseSwitchCaseConsequent(tokenIndent(startToken));
      return createSwitchCaseNode(test, statements, startToken, arrowToken, endToken);
    }

    test = this.SUBRULE(this.expression);
    const arrowToken = this.CONSUME(FatArrow);
    const { statements, endToken } = this.parseSwitchCaseConsequent(tokenIndent(startToken));
    return createSwitchCaseNode(test, statements, startToken, arrowToken, endToken);
  });

  private whileStatement = this.RULE('whileStatement', () => {
    const whileToken = this.CONSUME(While);
    const test = this.SUBRULE(this.expression) ?? createPlaceholderExpression();
    const body = this.parseIndentedBlock(tokenIndent(whileToken));
    const endToken = this.LA(0);
    return createWhileStatementNode(test, body, whileToken, endToken);
  });

  private repeatStatement = this.RULE('repeatStatement', () => {
    const repeatToken = this.CONSUME(Repeat);
    const body = this.parseIndentedBlock(tokenIndent(repeatToken));
    this.MANY(() => this.CONSUME(Newline));
    const untilToken = this.CONSUME(Until);
    const test = this.SUBRULE(this.expression) ?? createPlaceholderExpression();
    const endToken = this.LA(0);
    return createRepeatStatementNode(body, test, repeatToken, endToken ?? untilToken);
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

  private parseSwitchCaseConsequent(caseIndent: number): { statements: StatementNode[]; endToken: IToken | undefined } {
    const statements: StatementNode[] = [];

    const nextTokenType = this.LA(1).tokenType;

    if (nextTokenType === Newline) {
      const block = this.parseIndentedBlock(caseIndent);
      statements.push(...block.body);
      return { statements, endToken: this.LA(0) };
    }

    if (this.isStatementTerminator(nextTokenType)) {
      return { statements, endToken: this.LA(0) };
    }

    const expression = this.SUBRULE(this.expression);
    statements.push(createExpressionStatementNode(expression));
    return { statements, endToken: this.LA(0) };
  }

  private parseSwitchStructure(switchToken: IToken): SwitchStatementNode {
    const discriminant = this.SUBRULE(this.expression) ?? createPlaceholderExpression();
    let indent = tokenIndent(switchToken);
    const cases: SwitchCaseNode[] = [];

    let lastToken: IToken | undefined;

    if (this.LA(1).tokenType === Newline) {
      lastToken = this.CONSUME(Newline);
    }

    let lookaheadOffset = 1;
    let lookahead = this.LA(lookaheadOffset);
    while (lookahead.tokenType === Newline) {
      lookaheadOffset += 1;
      lookahead = this.LA(lookaheadOffset);
    }
    if (lookahead.tokenType !== EOF_TOKEN) {
      const lookaheadIndent = tokenIndent(lookahead);
      if (lookaheadIndent <= indent) {
        indent = Math.max(0, lookaheadIndent - 1);
      }
    }

    let shouldBreak = false;
    while (!shouldBreak) {
      let next = this.LA(1);

      while (next.tokenType === Newline) {
        let innerOffset = 2;
        let innerLookahead = this.LA(innerOffset);
        while (innerLookahead.tokenType === Newline) {
          innerOffset += 1;
          innerLookahead = this.LA(innerOffset);
        }

        if (innerLookahead.tokenType === EOF_TOKEN) {
          const newlineToken = this.CONSUME(Newline);
          lastToken = newlineToken;
          next = this.LA(1);
          continue;
        }

        if (tokenIndent(innerLookahead) <= indent) {
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

      const caseNode = this.SUBRULE(this.switchCase);
      cases.push(caseNode);
      lastToken = this.LA(0);
    }

    const endToken = this.LA(0) ?? lastToken ?? switchToken;
    return createSwitchStatementNode(discriminant, cases, switchToken, endToken);
  }

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

      const annotations: CompilerAnnotationNode[] = [];
      while (this.LA(1).tokenType === CompilerAnnotation) {
        const annotationToken = this.CONSUME(CompilerAnnotation);
        annotations.push(createCompilerAnnotationNode(annotationToken));
        lastToken = annotationToken;

        while (this.LA(1).tokenType === Newline) {
          const newlineToken = this.CONSUME(Newline);
          lastToken = newlineToken;
          const lookahead = this.LA(1);
          if (lookahead.tokenType === EOF_TOKEN || tokenIndent(lookahead) <= indent) {
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

      next = this.LA(1);
      if (next.tokenType === EOF_TOKEN || tokenIndent(next) <= indent) {
        break;
      }

      const statementStartToken = this.LA(1);
      const statement = this.SUBRULE(this.statement);
      statements.push(statement);
      firstStatementToken = firstStatementToken ?? statementStartToken;
      lastToken = this.LA(0);
      attachCompilerAnnotations(statement, annotations);
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

  private assignmentTarget = this.RULE('assignmentTarget', () => {
    if (this.LA(1).tokenType === LBracket) {
      return this.SUBRULE(this.bracketExpression);
    }
    return this.SUBRULE(this.memberExpression);
  });

  private expression = this.RULE('expression', () => this.SUBRULE(this.conditionalExpression));

  private conditionalExpression = this.RULE('conditionalExpression', () => {
    const test = this.SUBRULE(this.nullishCoalescingExpression);
    if (this.LA(1).tokenType === Question) {
      const questionToken = this.CONSUME(Question);
      const consequent = this.SUBRULE2(this.expression);
      const colonToken = this.CONSUME(Colon);
      const alternate = this.SUBRULE3(this.expression);
      const endToken = this.LA(0);
      return createConditionalExpressionNode(
        test,
        consequent,
        alternate,
        questionToken,
        colonToken,
        endToken,
      );
    }
    return test;
  });

  private nullishCoalescingExpression = this.RULE('nullishCoalescingExpression', () => {
    let expression = this.SUBRULE(this.logicalOrExpression);
    this.MANY(() => {
      const operator = this.CONSUME(NullishCoalescing);
      const right = this.SUBRULE2(this.logicalOrExpression);
      const endToken = this.LA(0);
      expression = createBinaryExpressionNode(expression, operator, right, endToken);
    });
    return expression;
  });

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
        {
          ALT: () => {
            const lBracket = this.CONSUME(LBracket);
            let indexExpression: ExpressionNode | undefined;
            if (this.LA(1).tokenType !== RBracket) {
              indexExpression = this.SUBRULE2(this.expression);
            }
            const rBracket = this.CONSUME(RBracket);
            expression = createIndexExpressionNode(expression, indexExpression, rBracket ?? lBracket);
          },
        },
      ]);
    });

    return expression;
  });

  private memberExpression = this.RULE('memberExpression', () => {
    let expression = this.SUBRULE(this.primaryExpression);
    this.MANY(() => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(Dot);
            const propertyToken = this.CONSUME(IdentifierToken);
            const property = createIdentifierNode(propertyToken);
            expression = createMemberExpressionNode(expression, property, propertyToken);
          },
        },
        {
          ALT: () => {
            const lBracket = this.CONSUME(LBracket);
            let indexExpression: ExpressionNode | undefined;
            if (this.LA(1).tokenType !== RBracket) {
              indexExpression = this.SUBRULE2(this.expression);
            }
            const rBracket = this.CONSUME(RBracket);
            expression = createIndexExpressionNode(expression, indexExpression, rBracket ?? lBracket);
          },
        },
      ]);
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

  private bracketExpression = this.RULE('bracketExpression', (): ExpressionNode => {
    const lBracket = this.CONSUME(LBracket);
    const elements: (ExpressionNode | null)[] = [];
    let expectElement = true;
    let hasParsedElement = false;

    while (true) {
      const next = this.LA(1);
      const tokenType = next.tokenType;

      if (tokenType === RBracket || tokenType === EOF_TOKEN) {
        break;
      }

      if (tokenType === Newline) {
        this.CONSUME(Newline);
        continue;
      }

      if (tokenType === Comma) {
        this.CONSUME(Comma);
        if (expectElement) {
          elements.push(null);
        }
        expectElement = true;
        continue;
      }

      let element: ExpressionNode | undefined;
      if (!hasParsedElement) {
        element = this.SUBRULE(this.expression);
        hasParsedElement = true;
      } else {
        element = this.SUBRULE2(this.expression);
      }
      elements.push(element);
      expectElement = false;

      if (this.LA(1).tokenType === Comma) {
        this.CONSUME(Comma);
        expectElement = true;
      } else {
        expectElement = false;
        break;
      }
    }

    if (expectElement && elements.length > 0 && this.LA(1).tokenType === RBracket) {
      elements.push(null);
    }

    const rBracket = this.CONSUME(RBracket);

    if (elements.length === 0) {
      return createTupleExpressionNode(elements, lBracket, rBracket);
    }

    const tuple = createTupleExpressionNode(elements, lBracket, rBracket);
    const hasNull = elements.some((element) => element === null);

    if (!hasNull) {
      const tupleRows = elements.filter((element): element is TupleExpressionNode => element?.kind === 'TupleExpression');
      if (
        tupleRows.length === elements.length &&
        tupleRows.every((row) => row.elements.every((child) => child !== null))
      ) {
        const rows = tupleRows.map((row) =>
          row.elements.map((child) => child ?? createPlaceholderExpression()),
        );
        return createMatrixLiteralNode(rows, lBracket, rBracket);
      }
    }

    return tuple;
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
      case Switch:
        return this.SUBRULE(this.switchExpression);
      case LBracket:
        return this.SUBRULE(this.bracketExpression);
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
