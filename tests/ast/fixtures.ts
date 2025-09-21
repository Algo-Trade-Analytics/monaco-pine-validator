import {
  type ArgumentNode,
  type AssignmentStatementNode,
  type BinaryExpressionNode,
  type BlockStatementNode,
  type BooleanLiteralNode,
  type CallExpressionNode,
  type ConditionalExpressionNode,
  type ExpressionNode,
  type ExpressionStatementNode,
  type ForStatementNode,
  type FunctionDeclarationNode,
  type IdentifierNode,
  type IfStatementNode,
  type NullLiteralNode,
  type NumberLiteralNode,
  type ParameterNode,
  type ProgramNode,
  type ReturnStatementNode,
  type ScriptDeclarationNode,
  type StatementNode,
  type StringLiteralNode,
  type UnaryExpressionNode,
  type VariableDeclarationNode,
  type WhileStatementNode,
  createLocation,
  createPosition,
  createRange,
} from '../../core/ast/nodes';

interface SpanOptions {
  readonly start: number;
  readonly end: number;
  readonly lineStart?: number;
  readonly lineEnd?: number;
}

function createSpan({ start, end, lineStart = 1, lineEnd = lineStart }: SpanOptions) {
  return {
    loc: createLocation(
      createPosition(lineStart, start + 1, start),
      createPosition(lineEnd, end + 1, end),
    ),
    range: createRange(start, end),
  };
}

export function createIdentifier(name: string, start: number, line = 1): IdentifierNode {
  const end = start + name.length;
  return {
    kind: 'Identifier',
    name,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createStringLiteral(value: string, raw: string, start: number, line = 1): StringLiteralNode {
  const end = start + raw.length;
  return {
    kind: 'StringLiteral',
    value,
    raw,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createNumberLiteral(value: number, raw: string, start: number, line = 1): NumberLiteralNode {
  const end = start + raw.length;
  return {
    kind: 'NumberLiteral',
    value,
    raw,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createBooleanLiteral(value: boolean, start: number, line = 1): BooleanLiteralNode {
  const literal = value ? 'true' : 'false';
  return {
    kind: 'BooleanLiteral',
    value,
    ...createSpan({ start, end: start + literal.length, lineStart: line }),
  };
}

export function createNullLiteral(start: number, line = 1): NullLiteralNode {
  return {
    kind: 'NullLiteral',
    ...createSpan({ start, end: start + 2, lineStart: line }),
  };
}

export function createArgument(
  value: StringLiteralNode | NumberLiteralNode | IdentifierNode,
  start: number,
  end: number,
  line = 1,
  name: string | null = null,
): ArgumentNode {
  return {
    kind: 'Argument',
    name: name ? createIdentifier(name, start, line) : null,
    value,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createParameter(name: string, start: number, line = 1): ParameterNode {
  const identifier = createIdentifier(name, start, line);
  return {
    kind: 'Parameter',
    identifier,
    typeAnnotation: null,
    defaultValue: null,
    ...createSpan({ start: identifier.range[0], end: identifier.range[1], lineStart: line }),
  };
}

export function createBlock(body: StatementNode[], start: number, end: number, lineStart = 1, lineEnd = lineStart): BlockStatementNode {
  return {
    kind: 'BlockStatement',
    body,
    ...createSpan({ start, end, lineStart, lineEnd }),
  };
}

export function createReturn(argument: IdentifierNode | null, start: number, end: number, line = 1): ReturnStatementNode {
  return {
    kind: 'ReturnStatement',
    argument,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createCallExpression(
  callee: IdentifierNode,
  args: ArgumentNode[],
  start: number,
  end: number,
  line = 1,
): CallExpressionNode {
  return {
    kind: 'CallExpression',
    callee,
    args,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createFunctionDeclaration(
  identifier: IdentifierNode | null,
  params: ParameterNode[],
  body: BlockStatementNode,
  start: number,
  end: number,
  lineStart = 1,
  lineEnd = lineStart,
): FunctionDeclarationNode {
  return {
    kind: 'FunctionDeclaration',
    identifier,
    params,
    body,
    export: false,
    ...createSpan({ start, end, lineStart, lineEnd }),
  };
}

export function createScriptDeclaration(
  scriptType: ScriptDeclarationNode['scriptType'],
  identifier: IdentifierNode | null,
  args: ArgumentNode[],
  start: number,
  end: number,
  line = 1,
): ScriptDeclarationNode {
  return {
    kind: 'ScriptDeclaration',
    scriptType,
    identifier,
    arguments: args,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createIfStatement(
  test: IdentifierNode,
  consequent: StatementNode,
  alternate: StatementNode | null,
  start: number,
  end: number,
  line = 1,
): IfStatementNode {
  return {
    kind: 'IfStatement',
    test,
    consequent,
    alternate,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createWhileStatement(
  test: IdentifierNode,
  body: BlockStatementNode,
  start: number,
  end: number,
  line = 1,
): WhileStatementNode {
  return {
    kind: 'WhileStatement',
    test,
    body,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createForStatement(
  initializer: VariableDeclarationNode | StatementNode | null,
  test: IdentifierNode | null,
  update: IdentifierNode | null,
  body: BlockStatementNode,
  start: number,
  end: number,
  line = 1,
): ForStatementNode {
  return {
    kind: 'ForStatement',
    initializer,
    test,
    update,
    body,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createVariableDeclaration(
  identifier: IdentifierNode,
  start: number,
  end: number,
  line = 1,
  options: {
    declarationKind?: VariableDeclarationNode['declarationKind'];
    initializer?: ExpressionNode | null;
  } = {},
): VariableDeclarationNode {
  const { declarationKind = 'simple', initializer = null } = options;
  return {
    kind: 'VariableDeclaration',
    declarationKind,
    identifier,
    typeAnnotation: null,
    initializer,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createAssignmentStatement(
  left: ExpressionNode,
  right: ExpressionNode | null,
  start: number,
  end: number,
  line = 1,
): AssignmentStatementNode {
  return {
    kind: 'AssignmentStatement',
    left,
    right,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createBinaryExpression(
  operator: string,
  left: ExpressionNode,
  right: ExpressionNode,
  start: number,
  end: number,
  line = 1,
): BinaryExpressionNode {
  return {
    kind: 'BinaryExpression',
    operator,
    left,
    right,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createUnaryExpression(
  operator: string,
  argument: ExpressionNode,
  start: number,
  end: number,
  line = 1,
  prefix = true,
): UnaryExpressionNode {
  return {
    kind: 'UnaryExpression',
    operator,
    argument,
    prefix,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createConditionalExpression(
  test: IdentifierNode,
  consequent: IdentifierNode,
  alternate: IdentifierNode,
  start: number,
  end: number,
  line = 1,
): ConditionalExpressionNode {
  return {
    kind: 'ConditionalExpression',
    test,
    consequent,
    alternate,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createIndicatorScriptFixture(): ProgramNode {
  const directive = {
    kind: 'VersionDirective' as const,
    version: 6,
    ...createSpan({ start: 0, end: 12, lineStart: 1 }),
  };

  const scriptIdentifier = createIdentifier('example', 22, 2);
  const scriptArgumentValue = createStringLiteral('Example', '"Example"', 32, 2);
  const scriptArgument = createArgument(scriptArgumentValue, 26, 41, 2, 'title');
  const scriptDeclaration = createScriptDeclaration('indicator', scriptIdentifier, [scriptArgument], 13, 45, 2);

  const param = createParameter('x', 55, 3);
  const fnIdentifier = createIdentifier('foo', 50, 3);
  const returnArgument = createIdentifier('x', 66, 4);
  const returnStatement = createReturn(returnArgument, 62, 72, 4);
  const block = createBlock([returnStatement], 60, 75, 4, 5);
  const functionDeclaration = createFunctionDeclaration(fnIdentifier, [param], block, 46, 90, 3, 5);

  const callCallee = createIdentifier('foo', 91, 6);
  const callArgumentValue = createNumberLiteral(1, '1', 100, 6);
  const callArgument = createArgument(callArgumentValue, 99, 101, 6);
  const callExpression = createCallExpression(callCallee, [callArgument], 91, 102, 6);
  const expressionStatement: ExpressionStatementNode = {
    kind: 'ExpressionStatement',
    expression: callExpression,
    ...createSpan({ start: 91, end: 102, lineStart: 6 }),
  };

  return {
    kind: 'Program',
    directives: [directive],
    body: [scriptDeclaration, functionDeclaration, expressionStatement],
    ...createSpan({ start: 0, end: 102, lineStart: 1, lineEnd: 6 }),
  };
}

export function createControlFlowFixture(): ProgramNode {
  const conditional = createConditionalExpression(
    createIdentifier('flag', 70, 3),
    createIdentifier('foo', 76, 3),
    createIdentifier('bar', 80, 3),
    70,
    83,
    3,
  );

  const conditionalStatement: ExpressionStatementNode = {
    kind: 'ExpressionStatement',
    expression: conditional,
    ...createSpan({ start: 68, end: 84, lineStart: 3 }),
  };

  const ifBlock = createBlock([conditionalStatement], 65, 90, 3, 4);
  const ifStatement = createIfStatement(createIdentifier('ifCond', 60, 3), ifBlock, null, 60, 90, 3);

  const loopVar = createIdentifier('loopResult', 102, 5);
  const loopInitializer = createIdentifier('loopGuard', 110, 5);
  const whileBody = createBlock(
    [
      createVariableDeclaration(loopVar, 100, 112, 5, { declarationKind: 'var', initializer: loopInitializer }),
    ],
    98,
    120,
    5,
    6,
  );
  const whileStatement = createWhileStatement(createIdentifier('loopGuard', 96, 5), whileBody, 95, 120, 5);

  const forInitializerIdentifier = createIdentifier('idx', 132, 7);
  const forInitializer = createVariableDeclaration(
    forInitializerIdentifier,
    132,
    138,
    7,
    { declarationKind: 'var', initializer: createNumberLiteral(0, '0', 136, 7) },
  );
  const forBody = createBlock(
    [
      {
        kind: 'ExpressionStatement',
        expression: createIdentifier('idx', 150, 8),
        ...createSpan({ start: 148, end: 152, lineStart: 8 }),
      } satisfies ExpressionStatementNode,
    ],
    145,
    160,
    8,
    9,
  );
  const forStatement = createForStatement(
    forInitializer,
    createIdentifier('hasNext', 140, 7),
    createIdentifier('idx', 142, 7),
    forBody,
    130,
    160,
    7,
  );

  return {
    kind: 'Program',
    directives: [],
    body: [ifStatement, whileStatement, forStatement],
    ...createSpan({ start: 50, end: 160, lineStart: 3, lineEnd: 9 }),
  };
}
