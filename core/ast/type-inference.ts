import {
  cloneTypeMetadata,
  createEmptyTypeEnvironment,
  createTypeMetadata,
  type InferredTypeKind,
  type TypeCertainty,
  type TypeEnvironment,
  type TypeMetadata,
} from './types';
import {
  type ArgumentNode,
  type AssignmentStatementNode,
  type BinaryExpressionNode,
  type BlockStatementNode,
  type CallExpressionNode,
  type ConditionalExpressionNode,
  type ExpressionNode,
  type ForStatementNode,
  type FunctionDeclarationNode,
  type IdentifierNode,
  type IfStatementNode,
  type NumberLiteralNode,
  type ProgramNode,
  type ReturnStatementNode,
  type StatementNode,
  type UnaryExpressionNode,
  type VariableDeclarationNode,
  type WhileStatementNode,
} from './nodes';

const NUMERIC_BINARY_OPERATORS = new Set(['+', '-', '*', '/', '%', '^']);
const STRING_COMPATIBLE_OPERATORS = new Set(['+']);
const COMPARISON_OPERATORS = new Set(['==', '!=', '>=', '<=', '>', '<']);
const LOGICAL_OPERATORS = new Set(['and', 'or', '&&', '||']);
const BOOLEAN_UNARY_OPERATORS = new Set(['not', '!']);
const NUMERIC_UNARY_OPERATORS = new Set(['+', '-']);
const SERIES_IDENTIFIERS = new Set(['open', 'high', 'low', 'close', 'volume']);

const BUILTIN_CALL_RETURN_TYPES: Record<
  string,
  { kind: InferredTypeKind; certainty?: TypeCertainty }
> = {
  nz: { kind: 'series' },
  sma: { kind: 'series' },
  ema: { kind: 'series' },
  'ta.crossover': { kind: 'bool', certainty: 'certain' },
  'ta.crossunder': { kind: 'bool', certainty: 'certain' },
  'ta.valuewhen': { kind: 'series' },
  'math.round': { kind: 'float' },
  'math.floor': { kind: 'float' },
  'math.ceil': { kind: 'float' },
  plot: { kind: 'void', certainty: 'certain' },
};

function createBuiltinCallMetadata(name: string): TypeMetadata | null {
  const override = BUILTIN_CALL_RETURN_TYPES[name];
  if (!override) {
    return null;
  }

  return createTypeMetadata(override.kind, `call:builtin:${name}`, override.certainty ?? 'inferred');
}

function combineCertainty(...metadatas: TypeMetadata[]): TypeCertainty {
  if (metadatas.some((metadata) => metadata.certainty === 'conflict')) {
    return 'conflict';
  }
  if (metadatas.every((metadata) => metadata.certainty === 'certain')) {
    return 'certain';
  }
  return 'inferred';
}

function isNumericKind(kind: InferredTypeKind): boolean {
  return kind === 'int' || kind === 'float';
}

function createUnknown(reason: string, certainty: TypeCertainty = 'inferred'): TypeMetadata {
  return createTypeMetadata('unknown', reason, certainty);
}

function annotateNode(
  environment: TypeEnvironment,
  node: ExpressionNode,
  metadata: TypeMetadata,
  reason?: string,
  overrides?: Partial<Omit<TypeMetadata, 'sources'>>,
): TypeMetadata {
  const annotated = cloneTypeMetadata(metadata, {
    ...(overrides ?? {}),
    addSource: reason,
  });
  environment.nodeTypes.set(node, annotated);
  return annotated;
}

function assignIdentifier(
  environment: TypeEnvironment,
  identifier: IdentifierNode,
  metadata: TypeMetadata,
  reason: string,
  overrides?: Partial<Omit<TypeMetadata, 'sources'>>,
): TypeMetadata {
  const annotated = cloneTypeMetadata(metadata, {
    ...(overrides ?? {}),
    addSource: reason,
  });
  environment.identifiers.set(identifier.name, annotated);
  environment.nodeTypes.set(identifier, annotated);
  return annotated;
}

function recordIdentifierUsage(
  environment: TypeEnvironment,
  identifier: IdentifierNode,
  reason: string,
): TypeMetadata {
  const existing = environment.identifiers.get(identifier.name);
  if (!existing) {
    const builtinSeries = SERIES_IDENTIFIERS.has(identifier.name)
      ? createTypeMetadata('series', 'identifier:builtin:series', 'certain')
      : null;
    const metadata = builtinSeries ?? createUnknown(reason);
    environment.identifiers.set(identifier.name, metadata);
    environment.nodeTypes.set(identifier, metadata);
    return metadata;
  }

  const annotated = cloneTypeMetadata(existing, { addSource: reason });
  environment.identifiers.set(identifier.name, annotated);
  environment.nodeTypes.set(identifier, annotated);
  return annotated;
}

function inferArgument(environment: TypeEnvironment, argument: ArgumentNode): void {
  if (argument.name) {
    // Named arguments reference parameter labels rather than script symbols.
    environment.nodeTypes.set(argument.name, createTypeMetadata('unknown', 'argument:name', 'certain'));
  }
  inferExpression(environment, argument.value, `argument:value`);
}

function determineNumericLiteralKind(literal: NumberLiteralNode): InferredTypeKind {
  return /[.eE]/.test(literal.raw) ? 'float' : 'int';
}

function inferCallExpression(environment: TypeEnvironment, expression: CallExpressionNode): TypeMetadata {
  inferExpression(environment, expression.callee, 'call:callee');
  expression.args.forEach((arg) => inferArgument(environment, arg));
  let metadata: TypeMetadata | null = null;
  if (expression.callee.kind === 'Identifier') {
    metadata = createBuiltinCallMetadata(expression.callee.name);
  }
  if (!metadata) {
    metadata = createUnknown('call:return');
  }
  return annotateNode(environment, expression, metadata);
}

function inferBinaryExpression(environment: TypeEnvironment, expression: BinaryExpressionNode): TypeMetadata {
  const leftType = inferExpression(environment, expression.left, 'binary:left');
  const rightType = inferExpression(environment, expression.right, 'binary:right');

  if (NUMERIC_BINARY_OPERATORS.has(expression.operator)) {
    if (leftType.kind === 'series' || rightType.kind === 'series') {
      const certainty = combineCertainty(leftType, rightType);
      return annotateNode(
        environment,
        expression,
        createTypeMetadata('series', `binary:${expression.operator}`, certainty),
      );
    }

    if (
      expression.operator === '+' &&
      (leftType.kind === 'string' || rightType.kind === 'string') &&
      (STRING_COMPATIBLE_OPERATORS.has(expression.operator))
    ) {
      const certainty = combineCertainty(leftType, rightType);
      return annotateNode(
        environment,
        expression,
        createTypeMetadata('string', `binary:${expression.operator}`, certainty),
      );
    }

    if (isNumericKind(leftType.kind) && isNumericKind(rightType.kind)) {
      const numericKind: InferredTypeKind =
        leftType.kind === 'float' || rightType.kind === 'float' ? 'float' : 'int';
      const certainty = combineCertainty(leftType, rightType);
      return annotateNode(
        environment,
        expression,
        createTypeMetadata(numericKind, `binary:${expression.operator}`, certainty),
      );
    }

    return annotateNode(environment, expression, createUnknown(`binary:${expression.operator}`));
  }

  if (COMPARISON_OPERATORS.has(expression.operator)) {
    return annotateNode(
      environment,
      expression,
      createTypeMetadata('bool', `comparison:${expression.operator}`, combineCertainty(leftType, rightType)),
    );
  }

  if (LOGICAL_OPERATORS.has(expression.operator)) {
    return annotateNode(environment, expression, createTypeMetadata('bool', `logical:${expression.operator}`));
  }

  return annotateNode(environment, expression, createUnknown(`binary:${expression.operator}`));
}

function inferUnaryExpression(environment: TypeEnvironment, expression: UnaryExpressionNode): TypeMetadata {
  const argumentType = inferExpression(environment, expression.argument, 'unary:argument');

  if (BOOLEAN_UNARY_OPERATORS.has(expression.operator)) {
    return annotateNode(environment, expression, createTypeMetadata('bool', `unary:${expression.operator}`));
  }

  if (argumentType.kind === 'series' && NUMERIC_UNARY_OPERATORS.has(expression.operator)) {
    return annotateNode(
      environment,
      expression,
      createTypeMetadata('series', `unary:${expression.operator}`, argumentType.certainty),
    );
  }

  if (NUMERIC_UNARY_OPERATORS.has(expression.operator) && isNumericKind(argumentType.kind)) {
    return annotateNode(
      environment,
      expression,
      createTypeMetadata(argumentType.kind, `unary:${expression.operator}`, argumentType.certainty),
    );
  }

  return annotateNode(environment, expression, createUnknown(`unary:${expression.operator}`));
}

function inferConditionalExpression(
  environment: TypeEnvironment,
  expression: ConditionalExpressionNode,
): TypeMetadata {
  inferExpression(environment, expression.test, 'conditional:test');
  const consequentType = inferExpression(environment, expression.consequent, 'conditional:consequent');
  const alternateType = inferExpression(environment, expression.alternate, 'conditional:alternate');

  if (consequentType.kind === alternateType.kind) {
    return annotateNode(
      environment,
      expression,
      createTypeMetadata(
        consequentType.kind,
        'conditional:branches',
        combineCertainty(consequentType, alternateType),
      ),
    );
  }

  return annotateNode(environment, expression, createUnknown('conditional:branches', 'conflict'));
}

function inferExpression(
  environment: TypeEnvironment,
  expression: ExpressionNode | null | undefined,
  reason: string,
): TypeMetadata {
  if (!expression) {
    return createUnknown(`${reason}:missing`);
  }

  switch (expression.kind) {
    case 'Identifier':
      return recordIdentifierUsage(environment, expression, reason);
    case 'NumberLiteral': {
      const literalKind = determineNumericLiteralKind(expression as NumberLiteralNode);
      return annotateNode(
        environment,
        expression,
        createTypeMetadata(literalKind, `${reason}:literal`, 'certain'),
      );
    }
    case 'StringLiteral':
      return annotateNode(
        environment,
        expression,
        createTypeMetadata('string', `${reason}:literal`, 'certain'),
      );
    case 'BooleanLiteral':
      return annotateNode(
        environment,
        expression,
        createTypeMetadata('bool', `${reason}:literal`, 'certain'),
      );
    case 'NullLiteral':
      return annotateNode(
        environment,
        expression,
        createTypeMetadata('void', `${reason}:literal`, 'certain'),
      );
    case 'CallExpression':
      return inferCallExpression(environment, expression as CallExpressionNode);
    case 'BinaryExpression':
      return inferBinaryExpression(environment, expression as BinaryExpressionNode);
    case 'UnaryExpression':
      return inferUnaryExpression(environment, expression as UnaryExpressionNode);
    case 'ConditionalExpression':
      return inferConditionalExpression(environment, expression as ConditionalExpressionNode);
    default:
      return annotateNode(environment, expression, createUnknown(reason));
  }
}

function visitBlock(environment: TypeEnvironment, block: BlockStatementNode): void {
  block.body.forEach((statement) => visitStatement(environment, statement));
}

function visitIfStatement(environment: TypeEnvironment, statement: IfStatementNode): void {
  inferExpression(environment, statement.test, 'if:test');
  visitStatement(environment, statement.consequent);
  if (statement.alternate) {
    visitStatement(environment, statement.alternate);
  }
}

function visitWhileStatement(environment: TypeEnvironment, statement: WhileStatementNode): void {
  inferExpression(environment, statement.test, 'while:test');
  visitStatement(environment, statement.body);
}

function visitForStatement(environment: TypeEnvironment, statement: ForStatementNode): void {
  if (statement.initializer) {
    visitStatement(environment, statement.initializer);
  }
  if (statement.test) {
    inferExpression(environment, statement.test, 'for:test');
  }
  if (statement.update) {
    inferExpression(environment, statement.update, 'for:update');
  }
  visitStatement(environment, statement.body);
}

function visitFunctionDeclaration(
  environment: TypeEnvironment,
  statement: FunctionDeclarationNode,
): void {
  if (statement.identifier) {
    assignIdentifier(environment, statement.identifier, createTypeMetadata('function', 'function:declaration', 'certain'), 'function:declaration');
  }

  statement.params.forEach((param) => {
    assignIdentifier(
      environment,
      param.identifier,
      createUnknown(`parameter:${param.identifier.name}`),
      'parameter:declaration',
    );
    if (param.defaultValue) {
      inferExpression(environment, param.defaultValue, 'parameter:default');
    }
  });

  visitBlock(environment, statement.body);
}

function visitVariableDeclaration(
  environment: TypeEnvironment,
  statement: VariableDeclarationNode,
): void {
  const initializerMetadata = statement.initializer
    ? inferExpression(environment, statement.initializer, 'variable:initializer')
    : createUnknown('variable:initializer');

  assignIdentifier(environment, statement.identifier, initializerMetadata, 'variable:declaration');
}

function visitAssignmentStatement(
  environment: TypeEnvironment,
  statement: AssignmentStatementNode,
): void {
  const rightMetadata = statement.right
    ? inferExpression(environment, statement.right, 'assignment:right')
    : createUnknown('assignment:right');

  inferExpression(environment, statement.left, 'assignment:left');

  if (statement.left.kind === 'Identifier') {
    assignIdentifier(environment, statement.left, rightMetadata, 'assignment:target');
  }
}

function visitReturnStatement(environment: TypeEnvironment, statement: ReturnStatementNode): void {
  inferExpression(environment, statement.argument, 'return:argument');
}

function visitScriptDeclaration(environment: TypeEnvironment, statement: StatementNode): void {
  if (statement.kind !== 'ScriptDeclaration') {
    return;
  }

  if (statement.identifier) {
    assignIdentifier(
      environment,
      statement.identifier,
      createTypeMetadata('unknown', 'script:identifier', 'certain'),
      'script:identifier',
    );
  }

  statement.arguments.forEach((arg) => inferArgument(environment, arg));
}

function visitStatement(environment: TypeEnvironment, statement: StatementNode): void {
  switch (statement.kind) {
    case 'VariableDeclaration':
      visitVariableDeclaration(environment, statement as VariableDeclarationNode);
      break;
    case 'AssignmentStatement':
      visitAssignmentStatement(environment, statement as AssignmentStatementNode);
      break;
    case 'ExpressionStatement':
      inferExpression(environment, statement.expression, 'expression:statement');
      break;
    case 'ReturnStatement':
      visitReturnStatement(environment, statement as ReturnStatementNode);
      break;
    case 'BlockStatement':
      visitBlock(environment, statement as BlockStatementNode);
      break;
    case 'FunctionDeclaration':
      visitFunctionDeclaration(environment, statement as FunctionDeclarationNode);
      break;
    case 'IfStatement':
      visitIfStatement(environment, statement as IfStatementNode);
      break;
    case 'WhileStatement':
      visitWhileStatement(environment, statement as WhileStatementNode);
      break;
    case 'ForStatement':
      visitForStatement(environment, statement as ForStatementNode);
      break;
    case 'ScriptDeclaration':
      visitScriptDeclaration(environment, statement);
      break;
    case 'BreakStatement':
    case 'ContinueStatement':
      break;
    default:
      break;
  }
}

export function inferTypes(program: ProgramNode | null): TypeEnvironment {
  const environment = createEmptyTypeEnvironment();

  if (!program) {
    return environment;
  }

  program.body.forEach((statement) => visitStatement(environment, statement));
  return environment;
}
