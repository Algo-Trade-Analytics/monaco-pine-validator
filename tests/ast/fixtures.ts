import {
  type ArgumentNode,
  type AssignmentStatementNode,
  type BinaryExpressionNode,
  type BlockStatementNode,
  type BooleanLiteralNode,
  type CallExpressionNode,
  type ConditionalExpressionNode,
  type BreakStatementNode,
  type ExpressionNode,
  type ExpressionStatementNode,
  type ImportDeclarationNode,
  type ForStatementNode,
  type FunctionDeclarationNode,
  type IdentifierNode,
  type IndexExpressionNode,
  type IfStatementNode,
  type MatrixLiteralNode,
  type NullLiteralNode,
  type NumberLiteralNode,
  type ParameterNode,
  type ProgramNode,
  type ReturnStatementNode,
  type ScriptDeclarationNode,
  type StatementNode,
  type StringLiteralNode,
  type EnumDeclarationNode,
  type EnumMemberNode,
  type TypeDeclarationNode,
  type TypeFieldNode,
  type TypeReferenceNode,
  type SwitchCaseNode,
  type SwitchStatementNode,
  type UnaryExpressionNode,
  type VariableDeclarationNode,
  type WhileStatementNode,
  type MemberExpressionNode,
  type VersionDirectiveNode,
  type TupleExpressionNode,
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

export function createTypeReference(name: string, start: number, line = 1): TypeReferenceNode {
  const identifier = createIdentifier(name, start, line);
  return {
    kind: 'TypeReference',
    name: identifier,
    generics: [],
    ...createSpan({ start, end: identifier.range[1], lineStart: line }),
  };
}

export function createArgument(
  value: ExpressionNode,
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

export function createReturn(argument: ExpressionNode | null, start: number, end: number, line = 1): ReturnStatementNode {
  return {
    kind: 'ReturnStatement',
    argument,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createBreakStatement(start: number, end: number, line = 1): BreakStatementNode {
  return {
    kind: 'BreakStatement',
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createCallExpression(
  callee: ExpressionNode,
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
  options: { export?: boolean; returnType?: TypeReferenceNode | null } = {},
): FunctionDeclarationNode {
  const { export: isExport = false, returnType = null } = options;
  return {
    kind: 'FunctionDeclaration',
    identifier,
    params,
    body,
    export: isExport,
    returnType,
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

export function createImportDeclaration(
  path: StringLiteralNode,
  alias: IdentifierNode,
  start: number,
  end: number,
  line = 1,
): ImportDeclarationNode {
  return {
    kind: 'ImportDeclaration',
    path,
    alias,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createVersionDirective(version: number, start: number, end: number, line = 1): VersionDirectiveNode {
  return {
    kind: 'VersionDirective',
    version,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createExpressionStatement(
  expression: ExpressionNode,
  start: number,
  end: number,
  line = 1,
): ExpressionStatementNode {
  return {
    kind: 'ExpressionStatement',
    expression,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createIfStatement(
  test: ExpressionNode,
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
  test: ExpressionNode,
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
  test: ExpressionNode | null,
  update: ExpressionNode | null,
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
    typeAnnotation?: TypeReferenceNode | null;
  } = {},
): VariableDeclarationNode {
  const { declarationKind = 'simple', initializer = null, typeAnnotation = null } = options;
  return {
    kind: 'VariableDeclaration',
    declarationKind,
    identifier,
    typeAnnotation,
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

export function createTupleExpression(
  elements: (ExpressionNode | null)[],
  start: number,
  end: number,
  line = 1,
): TupleExpressionNode {
  return {
    kind: 'TupleExpression',
    elements,
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
  test: ExpressionNode,
  consequent: ExpressionNode,
  alternate: ExpressionNode,
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

export function createMemberExpression(
  object: ExpressionNode,
  property: IdentifierNode,
  start: number,
  end: number,
  line = 1,
  computed = false,
): MemberExpressionNode {
  return {
    kind: 'MemberExpression',
    object,
    property,
    computed,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createIndexExpression(
  object: ExpressionNode,
  index: ExpressionNode,
  start: number,
  end: number,
  line = 1,
): IndexExpressionNode {
  return {
    kind: 'IndexExpression',
    object,
    index,
    ...createSpan({ start, end, lineStart: line }),
  };
}

export function createMatrixLiteral(
  rows: ExpressionNode[][],
  start: number,
  end: number,
  lineStart = 1,
  lineEnd = lineStart,
): MatrixLiteralNode {
  return {
    kind: 'MatrixLiteral',
    rows,
    ...createSpan({ start, end, lineStart, lineEnd }),
  };
}

export function createTypeField(
  identifier: IdentifierNode,
  typeAnnotation: TypeReferenceNode | null,
  start: number,
  end: number,
  lineStart = 1,
  lineEnd = lineStart,
): TypeFieldNode {
  return {
    kind: 'TypeField',
    identifier,
    typeAnnotation,
    ...createSpan({ start, end, lineStart, lineEnd }),
  };
}

export function createEnumMember(
  identifier: IdentifierNode,
  value: ExpressionNode | null,
  start: number,
  end: number,
  lineStart = 1,
  lineEnd = lineStart,
): EnumMemberNode {
  return {
    kind: 'EnumMember',
    identifier,
    value,
    ...createSpan({ start, end, lineStart, lineEnd }),
  };
}

export function createEnumDeclaration(
  identifier: IdentifierNode,
  members: EnumMemberNode[],
  start: number,
  end: number,
  lineStart = 1,
  lineEnd = lineStart,
  exported = false,
): EnumDeclarationNode {
  return {
    kind: 'EnumDeclaration',
    identifier,
    members,
    export: exported,
    ...createSpan({ start, end, lineStart, lineEnd }),
  };
}

export function createTypeDeclaration(
  identifier: IdentifierNode,
  fields: TypeFieldNode[],
  start: number,
  end: number,
  lineStart = 1,
  lineEnd = lineStart,
  isExported = false,
): TypeDeclarationNode {
  return {
    kind: 'TypeDeclaration',
    identifier,
    fields,
    export: isExported,
    ...createSpan({ start, end, lineStart, lineEnd }),
  };
}

export function createSwitchCase(
  test: ExpressionNode | null,
  consequent: StatementNode[],
  start: number,
  end: number,
  lineStart = 1,
  lineEnd = lineStart,
): SwitchCaseNode {
  return {
    kind: 'SwitchCase',
    test,
    consequent,
    ...createSpan({ start, end, lineStart, lineEnd }),
  };
}

export function createSwitchStatement(
  discriminant: ExpressionNode,
  cases: SwitchCaseNode[],
  start: number,
  end: number,
  lineStart = 1,
  lineEnd = lineStart,
): SwitchStatementNode {
  return {
    kind: 'SwitchStatement',
    discriminant,
    cases,
    ...createSpan({ start, end, lineStart, lineEnd }),
  };
}

export function createProgram(
  body: StatementNode[],
  start: number,
  end: number,
  lineStart = 1,
  lineEnd = lineStart,
  directives: VersionDirectiveNode[] = [],
): ProgramNode {
  return {
    kind: 'Program',
    directives,
    body,
    ...createSpan({ start, end, lineStart, lineEnd }),
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

export function createNamespaceAccessFixture(): ProgramNode {
  const timeframeNamespace = createIdentifier('timeframe', 0, 1);
  const periodProperty = createIdentifier('period', 10, 1);
  const timeframePeriod = createMemberExpression(timeframeNamespace, periodProperty, 0, 16, 1);

  const timeframeVar = createVariableDeclaration(createIdentifier('tf', 20, 1), 20, 36, 1, {
    declarationKind: 'var',
    initializer: timeframePeriod,
  });

  const timeframeNamespace2 = createIdentifier('timeframe', 40, 2);
  const isDailyProperty = createIdentifier('isdaily', 50, 2);
  const isDailyMember = createMemberExpression(timeframeNamespace2, isDailyProperty, 40, 58, 2);
  const boolVar = createVariableDeclaration(createIdentifier('isDaily', 60, 2), 60, 82, 2, {
    declarationKind: 'var',
    initializer: isDailyMember,
  });

  return {
    kind: 'Program',
    directives: [],
    body: [timeframeVar, boolVar],
    ...createSpan({ start: 0, end: 82, lineStart: 1, lineEnd: 2 }),
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

export function createSwitchMatrixFixture(): ProgramNode {
  const matrixLiteral = createMatrixLiteral(
    [
      [createNumberLiteral(1, '1', 10, 1), createNumberLiteral(2, '2', 13, 1)],
      [createNumberLiteral(3, '3', 18, 1), createNumberLiteral(4, '4', 21, 1)],
    ],
    9,
    22,
    1,
  );

  const matrixDeclaration = createVariableDeclaration(createIdentifier('weights', 0, 1), 0, 25, 1, {
    declarationKind: 'var',
    initializer: matrixLiteral,
  });

  const indexedAccess = createIndexExpression(
    createIdentifier('close', 30, 2),
    createNumberLiteral(1, '1', 36, 2),
    30,
    37,
    2,
  );

  const switchCases: SwitchCaseNode[] = [
    createSwitchCase(
      createIdentifier('long', 50, 3),
      [
        createAssignmentStatement(
          createIdentifier('signal', 55, 3),
          createIdentifier('close', 63, 3),
          55,
          68,
          3,
        ),
      ],
      48,
      70,
      3,
    ),
    createSwitchCase(
      createIdentifier('short', 72, 4),
      [
        createAssignmentStatement(
          createIdentifier('signal', 77, 4),
          indexedAccess,
          77,
          92,
          4,
        ),
      ],
      70,
      94,
      4,
    ),
    createSwitchCase(
      null,
      [
        {
          kind: 'ExpressionStatement',
          expression: createIdentifier('signal', 100, 5),
          ...createSpan({ start: 100, end: 106, lineStart: 5 }),
        } satisfies ExpressionStatementNode,
      ],
      96,
      108,
      5,
    ),
  ];

  const switchStatement = createSwitchStatement(
    createIdentifier('direction', 40, 2),
    switchCases,
    40,
    108,
    2,
    5,
  );

  return {
    kind: 'Program',
    directives: [],
    body: [matrixDeclaration, switchStatement],
    ...createSpan({ start: 0, end: 108, lineStart: 1, lineEnd: 5 }),
  };
}
export function createBuiltinConstantsProgram(): ProgramNode {
  const timeframeDecl = createVariableDeclaration(
    createIdentifier('tfDaily', 4, 3),
    4,
    31,
    3,
    {
      declarationKind: 'var',
      initializer: createMemberExpression(
        createIdentifier('timeframe', 14, 3),
        createIdentifier('isdaily', 24, 3),
        14,
        31,
        3,
      ),
    },
  );

  const displayDecl = createVariableDeclaration(
    createIdentifier('displaySetting', 4, 4),
    4,
    32,
    4,
    {
      declarationKind: 'var',
      initializer: createMemberExpression(
        createIdentifier('display', 21, 4),
        createIdentifier('all', 29, 4),
        21,
        32,
        4,
      ),
    },
  );

  const extendDecl = createVariableDeclaration(
    createIdentifier('extendSetting', 4, 5),
    4,
    32,
    5,
    {
      declarationKind: 'var',
      initializer: createMemberExpression(
        createIdentifier('extend', 20, 5),
        createIdentifier('right', 27, 5),
        20,
        32,
        5,
      ),
    },
  );

  const formatDecl = createVariableDeclaration(
    createIdentifier('formatSetting', 4, 6),
    4,
    32,
    6,
    {
      declarationKind: 'var',
      initializer: createMemberExpression(
        createIdentifier('format', 20, 6),
        createIdentifier('price', 27, 6),
        20,
        32,
        6,
      ),
    },
  );

  const currencyDecl = createVariableDeclaration(
    createIdentifier('currencySetting', 4, 7),
    4,
    34,
    7,
    {
      declarationKind: 'var',
      initializer: createMemberExpression(
        createIdentifier('currency', 22, 7),
        createIdentifier('USD', 31, 7),
        22,
        34,
        7,
      ),
    },
  );

  const scaleDecl = createVariableDeclaration(
    createIdentifier('scaleSetting', 4, 8),
    4,
    29,
    8,
    {
      declarationKind: 'var',
      initializer: createMemberExpression(
        createIdentifier('scale', 19, 8),
        createIdentifier('left', 25, 8),
        19,
        29,
        8,
      ),
    },
  );

  const adjustmentDecl = createVariableDeclaration(
    createIdentifier('adjustmentSetting', 4, 9),
    4,
    39,
    9,
    {
      declarationKind: 'var',
      initializer: createMemberExpression(
        createIdentifier('adjustment', 24, 9),
        createIdentifier('none', 35, 9),
        24,
        39,
        9,
      ),
    },
  );

  const backadjustmentDecl = createVariableDeclaration(
    createIdentifier('backadjustmentSetting', 4, 10),
    4,
    46,
    10,
    {
      declarationKind: 'var',
      initializer: createMemberExpression(
        createIdentifier('backadjustment', 28, 10),
        createIdentifier('off', 43, 10),
        28,
        46,
        10,
      ),
    },
  );

  return {
    kind: 'Program',
    directives: [],
    body: [
      timeframeDecl,
      displayDecl,
      extendDecl,
      formatDecl,
      currencyDecl,
      scaleDecl,
      adjustmentDecl,
      backadjustmentDecl,
    ],
    ...createSpan({ start: 0, end: 50, lineStart: 3, lineEnd: 10 }),
  };
}

export function createHistoryReferencingProgram(): ProgramNode {
  const negativeIndex = createIndexExpression(
    createIdentifier('close', 12, 1),
    createUnaryExpression('-', createNumberLiteral(1, '1', 18, 1), 17, 20, 1),
    12,
    20,
    1,
  );
  const negativeDecl = createVariableDeclaration(createIdentifier('negative', 4, 1), 0, 21, 1, {
    declarationKind: 'var',
    initializer: negativeIndex,
  });

  const largeIndex = createIndexExpression(
    createIdentifier('close', 11, 2),
    createNumberLiteral(5001, '5001', 17, 2),
    11,
    22,
    2,
  );
  const largeDecl = createVariableDeclaration(createIdentifier('large', 4, 2), 0, 23, 2, {
    declarationKind: 'var',
    initializer: largeIndex,
  });

  const loopAccess = createIndexExpression(
    createIdentifier('close', 8, 4),
    createIdentifier('i', 14, 4),
    8,
    15,
    4,
  );
  const loopExpression: ExpressionStatementNode = {
    kind: 'ExpressionStatement',
    expression: loopAccess,
    ...createSpan({ start: 6, end: 17, lineStart: 4 }),
  };
  const loopBody = createBlock([loopExpression], 6, 18, 4, 4);
  const loopTest = createIdentifier('condition', 6, 3);
  const whileStatement = createWhileStatement(loopTest, loopBody, 0, 18, 3);

  const innerHistory = createIndexExpression(
    createIdentifier('high', 18, 5),
    createNumberLiteral(1, '1', 23, 5),
    18,
    24,
    5,
  );
  const nestedIndex = createIndexExpression(createIdentifier('close', 11, 5), innerHistory, 11, 25, 5);
  const nestedDecl = createVariableDeclaration(createIdentifier('nested', 4, 5), 0, 26, 5, {
    declarationKind: 'var',
    initializer: nestedIndex,
  });

  const varipDecl = createVariableDeclaration(createIdentifier('counter', 6, 6), 0, 16, 6, {
    declarationKind: 'varip',
    initializer: createNumberLiteral(0, '0', 17, 6),
  });

  const counterIdentifier = createIdentifier('counter', 0, 7);
  const counterRight = createBinaryExpression(
    '+',
    createIdentifier('counter', 10, 7),
    createIndexExpression(createIdentifier('close', 20, 7), createNumberLiteral(1, '1', 26, 7), 20, 27, 7),
    10,
    28,
    7,
  );
  const varipAssignment = createAssignmentStatement(counterIdentifier, counterRight, 0, 28, 7);

  const functionArg = createIndexExpression(createIdentifier('close', 18, 8), createNumberLiteral(1, '1', 24, 8), 18, 25, 8);
  const callArgument = createArgument(functionArg, 17, 26, 8);
  const callExpression = createCallExpression(createIdentifier('process', 8, 8), [callArgument], 8, 27, 8);
  const callStatement: ExpressionStatementNode = {
    kind: 'ExpressionStatement',
    expression: callExpression,
    ...createSpan({ start: 8, end: 27, lineStart: 8 }),
  };

  const typedInitializer = createIndexExpression(createIdentifier('close', 21, 9), createNumberLiteral(1, '1', 27, 9), 21, 28, 9);
  const typeAnnotation = createTypeReference('int', 4, 9);
  const typedDeclaration: VariableDeclarationNode = {
    kind: 'VariableDeclaration',
    declarationKind: 'simple',
    identifier: createIdentifier('prevClose', 8, 9),
    typeAnnotation,
    initializer: typedInitializer,
    ...createSpan({ start: 4, end: 28, lineStart: 9 }),
  };

  return {
    kind: 'Program',
    directives: [],
    body: [negativeDecl, largeDecl, whileStatement, nestedDecl, varipDecl, varipAssignment, callStatement, typedDeclaration],
    ...createSpan({ start: 0, end: 28, lineStart: 1, lineEnd: 9 }),
  };
}

export function createDynamicLoopProgram(): ProgramNode {
  const dynamicStartInitializer = createAssignmentStatement(
    createIdentifier('i', 4, 1),
    createBinaryExpression(
      '-',
      createIdentifier('bar_index', 12, 1),
      createNumberLiteral(100, '100', 24, 1),
      12,
      27,
      1,
    ),
    4,
    27,
    1,
  );
  const dynamicStartTest = createBinaryExpression(
    '<=',
    createIdentifier('i', 4, 1),
    createNumberLiteral(10, '10', 22, 1),
    4,
    28,
    1,
  );
  const dynamicStartUpdate = createBinaryExpression(
    '+',
    createIdentifier('i', 4, 1),
    createNumberLiteral(1, '1', 16, 1),
    4,
    18,
    1,
  );
  const dynamicStartBody = createBlock(
    [createExpressionStatement(createIdentifier('plotStart', 8, 2), 8, 18, 2)],
    8,
    18,
    2,
    3,
  );
  const dynamicStartLoop = createForStatement(
    dynamicStartInitializer,
    dynamicStartTest,
    dynamicStartUpdate,
    dynamicStartBody,
    0,
    40,
    1,
  );

  const dynamicEndInitializer = createAssignmentStatement(
    createIdentifier('j', 4, 4),
    createNumberLiteral(0, '0', 8, 4),
    4,
    12,
    4,
  );
  const dynamicEndBound = createBinaryExpression(
    '-',
    createCallExpression(
      createMemberExpression(
        createIdentifier('array', 20, 4),
        createIdentifier('size', 26, 4),
        20,
        30,
        4,
      ),
      [createArgument(createIdentifier('signals', 32, 4), 31, 39, 4)],
      20,
      39,
      4,
    ),
    createNumberLiteral(1, '1', 40, 4),
    20,
    42,
    4,
  );
  const dynamicEndTest = createBinaryExpression(
    '<',
    createIdentifier('j', 4, 4),
    dynamicEndBound,
    4,
    42,
    4,
  );
  const dynamicEndUpdate = createBinaryExpression(
    '+',
    createIdentifier('j', 4, 4),
    createNumberLiteral(1, '1', 8, 4),
    4,
    14,
    4,
  );
  const dynamicEndBody = createBlock(
    [createExpressionStatement(createIdentifier('plotEnd', 8, 5), 8, 18, 5)],
    8,
    18,
    5,
    6,
  );
  const dynamicEndLoop = createForStatement(
    dynamicEndInitializer,
    dynamicEndTest,
    dynamicEndUpdate,
    dynamicEndBody,
    40,
    80,
    4,
  );

  const stepDeclaration = createVariableDeclaration(
    createIdentifier('step', 0, 7),
    0,
    24,
    7,
    {
      initializer: createCallExpression(
        createMemberExpression(
          createIdentifier('input', 10, 7),
          createIdentifier('int', 16, 7),
          10,
          19,
          7,
        ),
        [createArgument(createNumberLiteral(1, '1', 21, 7), 19, 22, 7)],
        10,
        22,
        7,
      ),
    },
  );

  const dynamicStepInitializer = createAssignmentStatement(
    createIdentifier('k', 4, 8),
    createNumberLiteral(0, '0', 8, 8),
    4,
    12,
    8,
  );
  const dynamicStepTest = createBinaryExpression(
    '<=',
    createIdentifier('k', 4, 8),
    createNumberLiteral(10, '10', 16, 8),
    4,
    20,
    8,
  );
  const dynamicStepUpdate = createBinaryExpression(
    '+',
    createIdentifier('k', 4, 8),
    createIdentifier('step', 24, 8),
    4,
    24,
    8,
  );
  const dynamicStepBody = createBlock(
    [createExpressionStatement(createIdentifier('plotStep', 8, 9), 8, 18, 9)],
    8,
    18,
    9,
    10,
  );
  const dynamicStepLoop = createForStatement(
    dynamicStepInitializer,
    dynamicStepTest,
    dynamicStepUpdate,
    dynamicStepBody,
    80,
    120,
    8,
  );

  return {
    kind: 'Program',
    directives: [],
    body: [dynamicStartLoop, dynamicEndLoop, stepDeclaration, dynamicStepLoop],
    ...createSpan({ start: 0, end: 160, lineStart: 1, lineEnd: 10 }),
  };
}

export function createLoopMutationProgram(): ProgramNode {
  const limitDeclaration = createVariableDeclaration(
    createIdentifier('limit', 0, 1),
    0,
    16,
    1,
    {
      initializer: createNumberLiteral(10, '10', 12, 1),
    },
  );

  const loopInitializer = createAssignmentStatement(
    createIdentifier('idx', 4, 2),
    createNumberLiteral(0, '0', 8, 2),
    4,
    12,
    2,
  );
  const loopTest = createBinaryExpression(
    '<=',
    createIdentifier('idx', 4, 2),
    createIdentifier('limit', 16, 2),
    4,
    20,
    2,
  );
  const loopUpdate = createBinaryExpression(
    '+',
    createIdentifier('idx', 4, 2),
    createNumberLiteral(1, '1', 12, 2),
    4,
    16,
    2,
  );

  const boundMutation = createAssignmentStatement(
    createIdentifier('limit', 8, 3),
    createBinaryExpression(
      '+',
      createIdentifier('limit', 8, 3),
      createNumberLiteral(1, '1', 20, 3),
      8,
      20,
      3,
    ),
    8,
    24,
    3,
  );

  const indexMutation = createAssignmentStatement(
    createIdentifier('idx', 4, 4),
    createBinaryExpression(
      '+',
      createIdentifier('idx', 4, 4),
      createNumberLiteral(1, '1', 14, 4),
      4,
      14,
      4,
    ),
    4,
    18,
    4,
  );

  const loopBody = createBlock([boundMutation, indexMutation], 8, 24, 3, 5);
  const mutationLoop = createForStatement(loopInitializer, loopTest, loopUpdate, loopBody, 20, 80, 2);

  return {
    kind: 'Program',
    directives: [],
    body: [limitDeclaration, mutationLoop],
    ...createSpan({ start: 0, end: 120, lineStart: 1, lineEnd: 5 }),
  };
}
