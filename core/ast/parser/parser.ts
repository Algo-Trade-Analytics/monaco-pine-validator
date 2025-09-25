import { EmbeddedActionsParser, type IToken } from 'chevrotain';
import { SyntaxError } from '../../../pynescript/ast/error';
import {
  type ArgumentNode,
  type ExpressionNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type NumberLiteralNode,
  type ProgramNode,
  type ScriptDeclarationNode,
  type StatementNode,
  type StringLiteralNode,
  type VersionDirectiveNode,
  type ExpressionStatementNode,
  type CallExpressionNode,
  type NullLiteralNode,
  type BooleanLiteralNode,
  createLocation,
  createPosition,
  createRange,
  type SourceLocation,
  type Range,
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
} from './tokens';

const EOF_TOKEN = EmbeddedActionsParser.END_OF_FILE;

function tokenStart(token: IToken): ReturnType<typeof createPosition> {
  return createPosition(token.startLine ?? 1, token.startColumn ?? 1, token.startOffset ?? 0);
}

function tokenEnd(token: IToken): ReturnType<typeof createPosition> {
  const endLine = token.endLine ?? token.startLine ?? 1;
  const endColumn = (token.endColumn ?? token.startColumn ?? 1) + 1;
  const endOffset = (token.endOffset ?? token.startOffset ?? 0) + 1;
  return createPosition(endLine, endColumn, endOffset);
}

function spanFromTokens(start: IToken, end: IToken) {
  return {
    loc: createLocation(tokenStart(start), tokenEnd(end)),
    range: createRange(start.startOffset ?? 0, (end.endOffset ?? end.startOffset ?? 0) + 1),
  };
}

function spanFromNodes(startNode: { loc: SourceLocation; range: Range }, endToken: IToken) {
  return {
    loc: createLocation(startNode.loc.start, tokenEnd(endToken)),
    range: createRange(startNode.range[0], (endToken.endOffset ?? endToken.startOffset ?? 0) + 1),
  };
}

function createIdentifierNode(token: IToken): IdentifierNode {
  return {
    kind: 'Identifier',
    name: token.image,
    ...spanFromTokens(token, token),
  };
}

function createStringNode(token: IToken): StringLiteralNode {
  const raw = token.image;
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
    ...spanFromTokens(token, token),
  };
}

function createNumberNode(token: IToken): NumberLiteralNode {
  const value = Number(token.image.replace(/_/g, ''));
  return {
    kind: 'NumberLiteral',
    value,
    raw: token.image,
    ...spanFromTokens(token, token),
  };
}

function createBooleanNode(token: IToken, value: boolean): BooleanLiteralNode {
  return {
    kind: 'BooleanLiteral',
    value,
    ...spanFromTokens(token, token),
  };
}

function createNullNode(token: IToken): NullLiteralNode {
  return {
    kind: 'NullLiteral',
    ...spanFromTokens(token, token),
  };
}

function createCallExpressionNode(
  callee: ExpressionNode,
  args: ArgumentNode[],
  closingToken: IToken,
): CallExpressionNode {
  return {
    kind: 'CallExpression',
    callee,
    args,
    ...spanFromNodes(callee, closingToken),
  };
}

function createArgumentNode(
  name: IdentifierNode | null,
  value: ExpressionNode,
  startToken: IToken,
  endToken: IToken,
): ArgumentNode {
  const span = name ? spanFromTokens(startToken, endToken) : spanFromNodes(value, endToken);
  return {
    kind: 'Argument',
    name,
    value,
    ...span,
  };
}

function createMemberExpressionNode(
  object: ExpressionNode,
  property: IdentifierNode,
  endToken: IToken,
): MemberExpressionNode {
  return {
    kind: 'MemberExpression',
    object,
    property,
    computed: false,
    ...spanFromNodes(object, endToken),
  };
}

function createExpressionStatementNode(expression: ExpressionNode): ExpressionStatementNode {
  return {
    kind: 'ExpressionStatement',
    expression,
    loc: expression.loc,
    range: expression.range,
  };
}

function createScriptDeclarationNode(
  type: 'indicator' | 'strategy' | 'library',
  args: ArgumentNode[],
  start: IToken,
  end: IToken,
): ScriptDeclarationNode {
  return {
    kind: 'ScriptDeclaration',
    scriptType: type,
    identifier: null,
    arguments: args,
    ...spanFromTokens(start, end),
  };
}

function createVersionDirectiveNode(token: IToken): VersionDirectiveNode {
  const match = /\d+/.exec(token.image);
  const version = match ? Number(match[0]) : 0;
  return {
    kind: 'VersionDirective',
    version,
    ...spanFromTokens(token, token),
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
    super(AllTokens, { recoveryEnabled: true });
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
    const next = this.LA(1).tokenType;
    if (next === Indicator || next === Strategy || next === Library) {
      return this.SUBRULE(this.scriptDeclaration);
    }
    return this.SUBRULE(this.expressionStatement);
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
    const args = this.OPTION(() => this.SUBRULE(this.argumentList)) ?? [];
    const endToken = this.CONSUME(RParen);

    const scriptType = token.tokenType === Indicator ? 'indicator' : token.tokenType === Strategy ? 'strategy' : 'library';
    return createScriptDeclarationNode(scriptType, args, token, endToken);
  });

  private expressionStatement = this.RULE('expressionStatement', () => {
    const expression = this.SUBRULE(this.expression);
    return createExpressionStatementNode(expression);
  });

  private expression = this.RULE('expression', () => {
    return this.SUBRULE(this.callExpression);
  });

  private callExpression = this.RULE('callExpression', () => {
    let expression = this.SUBRULE(this.primaryExpression) as ExpressionNode;

    this.MANY(() => {
      this.CONSUME1(LParen);
      const args = this.OPTION1(() => this.SUBRULE(this.argumentList)) ?? [];
      const rParen = this.CONSUME2(RParen);
      expression = createCallExpressionNode(expression, args, rParen);
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
        return this.SUBRULE(this.identifierExpression);
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
      default:
        return createIdentifierNode(this.CONSUME(IdentifierToken));
    }
  });

  private identifierExpression = this.RULE('identifierExpression', () => {
    const first = this.CONSUME(IdentifierToken);
    let expression: ExpressionNode = createIdentifierNode(first);

    this.MANY(() => {
      this.CONSUME(Dot);
      const propertyToken = this.CONSUME2(IdentifierToken);
      const property = createIdentifierNode(propertyToken);
      expression = createMemberExpressionNode(expression, property, propertyToken);
    });

    return expression;
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

export function parseWithChevrotain(source: string, options: AstParseOptions = {}): AstParseResult {
  const lexResult = PineLexer.tokenize(source);
  const parser = new PineParser();
  parser.input = lexResult.tokens;

  const { directives, body } = parser.program();

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

  for (const error of parser.errors) {
    const token = error.token ?? { startLine: 1, startColumn: 1, image: '', tokenType: EOF_TOKEN };
    syntaxErrors.push(tokenToSyntaxError(token as IToken, error.message, source, filename));
  }

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
