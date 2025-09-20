import { EmbeddedActionsParser, Lexer, createToken, tokenMatcher, type IToken } from 'chevrotain';
import {
  ArgumentNode,
  AssignmentNode,
  BinaryExpressionNode,
  BinaryOperator,
  BooleanLiteralNode,
  CallExpressionNode,
  createLocation,
  createRange,
  IdentifierNode,
  IndicatorDeclarationNode,
  NumberLiteralNode,
  ProgramNode,
  SourceLocation,
  SourceRange,
  StringLiteralNode,
  VariableDeclarationNode,
  VersionDirectiveNode,
  spanRange,
  type ExpressionNode,
  type StatementNode,
} from './nodes';
import {
  AstParseOptions,
  AstParseResult,
  AstService,
  AstSyntaxError,
  createAstDiagnostics,
  type Position,
} from './types';

const WhiteSpace = createToken({ name: 'WhiteSpace', pattern: /[ \t\r]+/, group: Lexer.SKIPPED });
const NewLine = createToken({ name: 'NewLine', pattern: /\n+/, group: Lexer.SKIPPED, line_breaks: true });
const Comment = createToken({ name: 'Comment', pattern: /\/\/(?!@version)[^\n]*/, group: Lexer.SKIPPED });
const VersionDirective = createToken({
  name: 'VersionDirective',
  pattern: /\/\/\@version\s*=\s*\d+/,
});
const Varip = createToken({ name: 'Varip', pattern: /varip\b/ });
const Var = createToken({ name: 'Var', pattern: /var\b/ });
const BooleanLiteral = createToken({ name: 'BooleanLiteral', pattern: /(?:true|false)\b/ });
const NumberLiteral = createToken({ name: 'NumberLiteral', pattern: /\d+(?:\.\d+)?/ });
const StringLiteral = createToken({ name: 'StringLiteral', pattern: /"(?:\\.|[^"\\])*"/, line_breaks: true });
const And = createToken({ name: 'And', pattern: /and\b/ });
const Or = createToken({ name: 'Or', pattern: /or\b/ });
const Equal = createToken({ name: 'Equal', pattern: /==/ });
const NotEqual = createToken({ name: 'NotEqual', pattern: /!=/ });
const LessThanEqual = createToken({ name: 'LessThanEqual', pattern: /<=/ });
const GreaterThanEqual = createToken({ name: 'GreaterThanEqual', pattern: />=/ });
const LessThan = createToken({ name: 'LessThan', pattern: /</ });
const GreaterThan = createToken({ name: 'GreaterThan', pattern: />/ });
const Identifier = createToken({ name: 'Identifier', pattern: /[A-Za-z_][A-Za-z0-9_]*/ });
const Comma = createToken({ name: 'Comma', pattern: /,/ });
const Assign = createToken({ name: 'Assign', pattern: /=/ });
const LParen = createToken({ name: 'LParen', pattern: /\(/ });
const RParen = createToken({ name: 'RParen', pattern: /\)/ });

const ALL_TOKENS = [
  WhiteSpace,
  NewLine,
  Comment,
  VersionDirective,
  Varip,
  Var,
  BooleanLiteral,
  NumberLiteral,
  StringLiteral,
  And,
  Or,
  Equal,
  NotEqual,
  LessThanEqual,
  GreaterThanEqual,
  LessThan,
  GreaterThan,
  Identifier,
  Comma,
  Assign,
  LParen,
  RParen,
];

const PineLexer = new Lexer(ALL_TOKENS, { ensureOptimizations: true });

class PineCstParser extends EmbeddedActionsParser {
  private lastToken: IToken | null = null;

  constructor() {
    super(ALL_TOKENS, { recoveryEnabled: true });
    this.performSelfAnalysis();
  }

  private startToken(): IToken {
    return this.LA(1);
  }

  private toStartPosition(token: IToken): Position {
    const line = token.startLine ?? token.endLine ?? 1;
    const column = token.startColumn ?? 1;
    const offset = token.startOffset ?? 0;
    return { line, column, offset };
  }

  private toEndPosition(token: IToken): Position {
    const line = token.endLine ?? token.startLine ?? 1;
    const columnBase =
      token.endColumn ??
      (token.startColumn != null ? token.startColumn + (token.image?.length ?? 0) - 1 : token.startColumn ?? 0);
    const offsetBase =
      token.endOffset ??
      (token.startOffset != null ? token.startOffset + (token.image?.length ?? 0) - 1 : token.startOffset ?? -1);
    return { line, column: columnBase + 1, offset: offsetBase + 1 };
  }

  private startOffsetOf(token: IToken): number {
    return token.startOffset ?? 0;
  }

  private endOffsetOf(token: IToken): number {
    if (token.endOffset != null) {
      return token.endOffset + 1;
    }
    if (token.startOffset != null) {
      return token.startOffset + (token.image?.length ?? 0);
    }
    return this.startOffsetOf(token);
  }

  private buildLocation(start: IToken, end: IToken | null): { loc: SourceLocation; range: SourceRange } {
    const effectiveEnd = end ?? start;
    return {
      loc: createLocation(this.toStartPosition(start), this.toEndPosition(effectiveEnd)),
      range: createRange(this.startOffsetOf(start), this.endOffsetOf(effectiveEnd)),
    };
  }

  private track(token: IToken): IToken {
    this.lastToken = token;
    return token;
  }

  private identifierFrom(token: IToken): IdentifierNode {
    const { loc, range } = this.buildLocation(token, token);
    return {
      kind: 'Identifier',
      name: token.image,
      loc,
      range,
    };
  }

  private numberFrom(token: IToken): NumberLiteralNode {
    const { loc, range } = this.buildLocation(token, token);
    return {
      kind: 'NumberLiteral',
      value: Number(token.image),
      raw: token.image,
      loc,
      range,
    };
  }

  private stringFrom(token: IToken): StringLiteralNode {
    const { loc, range } = this.buildLocation(token, token);
    return {
      kind: 'StringLiteral',
      value: token.image.slice(1, -1),
      raw: token.image,
      loc,
      range,
    };
  }

  private booleanFrom(token: IToken): BooleanLiteralNode {
    const { loc, range } = this.buildLocation(token, token);
    return {
      kind: 'BooleanLiteral',
      value: token.image === 'true',
      raw: token.image,
      loc,
      range,
    };
  }

  program = this.RULE<ProgramNode>('program', () => {
    const start = this.startToken();
    let version: VersionDirectiveNode | undefined;
    const la1 = this.LA(1);
    const isVersion = tokenMatcher(la1, VersionDirective);
    if (isVersion) {
      version = this.SUBRULE(this.versionDirective);
    }
    const body: StatementNode[] = [];

    this.MANY(() => {
      const statement = this.SUBRULE(this.statement);
      if (statement) {
        body.push(statement);
      }
    });

    const endToken = this.lastToken ?? start;
    const { loc, range } = this.buildLocation(start, endToken);

    return {
      kind: 'Program',
      version: version ?? null,
      body,
      loc,
      range,
    };
  });

  private statement = this.RULE<StatementNode>('statement', () => {
    return this.OR<StatementNode>([
      {
        GATE: () =>
          tokenMatcher(this.LA(1), Identifier) &&
          this.LA(1).image === 'indicator' &&
          tokenMatcher(this.LA(2), LParen),
        ALT: () => this.SUBRULE(this.indicatorDeclaration),
      },
      {
        GATE: () => tokenMatcher(this.LA(1), Var) || tokenMatcher(this.LA(1), Varip),
        ALT: () => this.SUBRULE(this.variableDeclaration),
      },
      {
        GATE: () => tokenMatcher(this.LA(1), Identifier) && tokenMatcher(this.LA(2), Assign),
        ALT: () => this.SUBRULE(this.assignmentStatement),
      },
      {
        ALT: () => this.SUBRULE(this.expressionStatement),
      },
    ]);
  });

  private versionDirective = this.RULE<VersionDirectiveNode>('versionDirective', () => {
    const start = this.startToken();
    const token = this.track(this.CONSUME(VersionDirective));
    const { loc, range } = this.buildLocation(start, token);
    const match = /\d+/.exec(token.image);
    return {
      kind: 'VersionDirective',
      value: match ? Number(match[0]) : NaN,
      raw: token.image,
      loc,
      range,
    };
  });

  private indicatorDeclaration = this.RULE<IndicatorDeclarationNode>('indicatorDeclaration', () => {
    const start = this.startToken();
    const call = this.SUBRULE(this.callExpression);
    const endToken = this.lastToken ?? start;
    const { loc, range } = this.buildLocation(start, endToken);
    return {
      kind: 'IndicatorDeclaration',
      call,
      loc,
      range,
    };
  });

  private variableDeclaration = this.RULE<VariableDeclarationNode>('variableDeclaration', () => {
    const start = this.startToken();
    const keywordToken = this.OR<IToken>([
      { ALT: () => this.track(this.CONSUME(Varip)) },
      { ALT: () => this.track(this.CONSUME(Var)) },
    ]);
    const identifier = this.SUBRULE(this.identifier);
    const value = this.OPTION<ExpressionNode>(() => {
      this.track(this.CONSUME(Assign));
      return this.SUBRULE(this.expression);
    });
    const endToken = this.lastToken ?? start;
    const { loc, range } = this.buildLocation(start, endToken);
    return {
      kind: 'VariableDeclaration',
      keyword: keywordToken.image as 'var' | 'varip',
      identifier,
      value: value ?? null,
      loc,
      range,
    };
  });

  private assignmentStatement = this.RULE<AssignmentNode>('assignmentStatement', () => {
    const start = this.startToken();
    const identifier = this.SUBRULE(this.identifier);
    this.track(this.CONSUME(Assign));
    const value = this.SUBRULE(this.expression);
    const { loc, range } = this.buildLocation(start, this.lastToken);
    return {
      kind: 'AssignmentStatement',
      identifier,
      value,
      loc,
      range,
    };
  });

  private expressionStatement = this.RULE('expressionStatement', () => {
    const start = this.startToken();
    const expression = this.SUBRULE(this.expression);
    const { loc, range } = this.buildLocation(start, this.lastToken);
    return {
      kind: 'ExpressionStatement',
      expression,
      loc,
      range,
    };
  });

  private expression = this.RULE<ExpressionNode>('expression', () => {
    return this.SUBRULE(this.logicalOrExpression);
  });

  private logicalOrExpression = this.RULE<ExpressionNode>('logicalOrExpression', () => {
    let left = this.SUBRULE(this.logicalAndExpression);
    this.MANY(() => {
      const operator = this.track(this.CONSUME(Or));
      const right = this.SUBRULE2(this.logicalAndExpression);
      left = this.buildBinaryExpression(left, operator.image as BinaryOperator, right);
    });
    return left;
  });

  private logicalAndExpression = this.RULE<ExpressionNode>('logicalAndExpression', () => {
    let left = this.SUBRULE(this.comparisonExpression);
    this.MANY(() => {
      const operator = this.track(this.CONSUME(And));
      const right = this.SUBRULE2(this.comparisonExpression);
      left = this.buildBinaryExpression(left, operator.image as BinaryOperator, right);
    });
    return left;
  });

  private comparisonExpression = this.RULE<ExpressionNode>('comparisonExpression', () => {
    let left = this.SUBRULE(this.primaryExpression);
    this.MANY(() => {
      const operator = this.track(
        this.OR<IToken>([
          { ALT: () => this.CONSUME(Equal) },
          { ALT: () => this.CONSUME(NotEqual) },
          { ALT: () => this.CONSUME(LessThanEqual) },
          { ALT: () => this.CONSUME(GreaterThanEqual) },
          { ALT: () => this.CONSUME(LessThan) },
          { ALT: () => this.CONSUME(GreaterThan) },
        ]),
      );
      const right = this.SUBRULE2(this.primaryExpression);
      left = this.buildBinaryExpression(left, operator.image as BinaryOperator, right);
    });
    return left;
  });

  private primaryExpression = this.RULE<ExpressionNode>('primaryExpression', () => {
    return this.OR<ExpressionNode>([
      {
        GATE: () => tokenMatcher(this.LA(1), Identifier) && tokenMatcher(this.LA(2), LParen),
        ALT: () => this.SUBRULE(this.callExpression),
      },
      { ALT: () => this.SUBRULE(this.literal) },
      { ALT: () => this.SUBRULE(this.identifier) },
    ]);
  });

  private buildBinaryExpression(
    left: ExpressionNode,
    operator: BinaryOperator,
    right: ExpressionNode,
  ): BinaryExpressionNode {
    const { loc, range } = spanRange(left, right);
    return {
      kind: 'BinaryExpression',
      operator,
      left,
      right,
      loc,
      range,
    };
  }

  private callExpression = this.RULE<CallExpressionNode>('callExpression', () => {
    const start = this.startToken();
    const callee = this.SUBRULE(this.identifier);
    this.track(this.CONSUME(LParen));
    const args: ArgumentNode[] = [];
    this.OPTION(() => {
      args.push(this.SUBRULE(this.argument));
      this.MANY(() => {
        this.track(this.CONSUME(Comma));
        args.push(this.SUBRULE2(this.argument));
      });
    });
    this.track(this.CONSUME(RParen));
    const { loc, range } = this.buildLocation(start, this.lastToken);
    return {
      kind: 'CallExpression',
      callee,
      args,
      loc,
      range,
    };
  });

  private argument = this.RULE<ArgumentNode>('argument', () => {
    return this.OR<ArgumentNode>([
      {
        GATE: () => tokenMatcher(this.LA(1), Identifier) && tokenMatcher(this.LA(2), Assign),
        ALT: () => this.SUBRULE(this.namedArgument),
      },
      { ALT: () => this.SUBRULE(this.expressionArgument) },
    ]);
  });

  private namedArgument = this.RULE<ArgumentNode>('namedArgument', () => {
    const start = this.startToken();
    const name = this.SUBRULE(this.identifier);
    this.track(this.CONSUME(Assign));
    const value = this.SUBRULE(this.expression);
    const { loc, range } = this.buildLocation(start, this.lastToken);
    return {
      kind: 'Argument',
      name,
      value,
      loc,
      range,
    };
  });

  private expressionArgument = this.RULE<ArgumentNode>('expressionArgument', () => {
    const start = this.startToken();
    const value = this.SUBRULE(this.expression);
    const { loc, range } = this.buildLocation(start, this.lastToken);
    return {
      kind: 'Argument',
      name: null,
      value,
      loc,
      range,
    };
  });

  private identifier = this.RULE<IdentifierNode>('identifier', () => {
    const token = this.track(this.CONSUME(Identifier));
    return this.identifierFrom(token);
  });

  private literal = this.RULE<ExpressionNode>('literal', () => {
    return this.OR<ExpressionNode>([
      { ALT: () => this.numberFrom(this.track(this.CONSUME(NumberLiteral))) },
      { ALT: () => this.stringFrom(this.track(this.CONSUME(StringLiteral))) },
      { ALT: () => this.booleanFrom(this.track(this.CONSUME(BooleanLiteral))) },
    ]);
  });
}

function buildSyntaxError(message: string, token: IToken | undefined): AstSyntaxError {
  if (token) {
    const start: Position = {
      line: token.startLine ?? token.endLine ?? 1,
      column: token.startColumn ?? 1,
      offset: token.startOffset ?? 0,
    };
    const end: Position = {
      line: token.endLine ?? token.startLine ?? start.line,
      column:
        (token.endColumn ??
          (token.startColumn != null ? token.startColumn + (token.image?.length ?? 0) - 1 : token.startColumn ?? start.column)) +
        1,
      offset:
        (token.endOffset ??
          (token.startOffset != null
            ? token.startOffset + (token.image?.length ?? 0) - 1
            : start.offset - 1)) + 1,
    };
    return {
      message,
      range: createRange(start.offset, end.offset),
      loc: createLocation(start, end),
    };
  }

  const fallback: Position = { line: 1, column: 1, offset: 0 };
  return {
    message,
    range: createRange(0, 0),
    loc: createLocation(fallback, fallback),
  };
}

class ChevrotainAstService implements AstService {
  parse(source: string, options?: AstParseOptions): AstParseResult {
      const lexResult = PineLexer.tokenize(source);
    const parser = new PineCstParser();
    parser.input = lexResult.tokens;

    const diagnostics: AstSyntaxError[] = [];

    for (const error of lexResult.errors) {
      diagnostics.push(
        buildSyntaxError(error.message, error.token),
      );
    }

    const ast = parser.program();

    for (const error of parser.errors) {
      diagnostics.push(buildSyntaxError(error.message, error.token));
    }

    const allowErrors = options?.allowErrors ?? false;

    return {
      ast: allowErrors || diagnostics.length === 0 ? ast ?? null : null,
      diagnostics: createAstDiagnostics(diagnostics),
    };
  }
}

export function createChevrotainAstService(): AstService {
  return new ChevrotainAstService();
}
