import {
  cloneTypeMetadata,
  createEmptyTypeEnvironment,
  createTypeMetadata,
  type InferredTypeKind,
  type TypeCertainty,
  type TypeEnvironment,
  type TypeMetadata,
} from './types';
import { STRATEGY_ORDER_FUNCTIONS } from '../constants';
import {
  type ArgumentNode,
  type AssignmentStatementNode,
  type BinaryExpressionNode,
  type BlockStatementNode,
  type ArrowFunctionExpressionNode,
  type CallExpressionNode,
  type ConditionalExpressionNode,
  type ExpressionNode,
  type ForStatementNode,
  type FunctionDeclarationNode,
  type IdentifierNode,
  type IndexExpressionNode,
  type MatrixLiteralNode,
  type MemberExpressionNode,
  type IfExpressionNode,
  type IfStatementNode,
  type NumberLiteralNode,
  type ProgramNode,
  type ReturnStatementNode,
  type EnumDeclarationNode,
  type EnumMemberNode,
  type TypeDeclarationNode,
  type StatementNode,
  type SwitchStatementNode,
  type UnaryExpressionNode,
  type VariableDeclarationNode,
  type RepeatStatementNode,
  type WhileStatementNode,
  type TupleExpressionNode,
} from './nodes';

const NUMERIC_BINARY_OPERATORS = new Set(['+', '-', '*', '/', '%', '^']);
const STRING_COMPATIBLE_OPERATORS = new Set(['+']);
const COMPARISON_OPERATORS = new Set(['==', '!=', '>=', '<=', '>', '<']);
const LOGICAL_OPERATORS = new Set(['and', 'or', '&&', '||']);
const BOOLEAN_UNARY_OPERATORS = new Set(['not', '!']);
const NUMERIC_UNARY_OPERATORS = new Set(['+', '-']);
const SERIES_IDENTIFIERS = new Set(['open', 'high', 'low', 'close', 'volume']);
const TA_BOOLEAN_RETURN_FUNCTIONS = new Set(['ta.cross', 'ta.crossover', 'ta.crossunder']);
const TA_INTEGER_RETURN_FUNCTIONS = new Set(['ta.barssince']);
const STRATEGY_SERIES_RETURN_FUNCTIONS = new Set([
  'strategy.position_size',
  'strategy.position_avg_price',
  'strategy.openprofit',
  'strategy.netprofit',
  'strategy.equity',
]);

const BUILTIN_CALL_RETURN_TYPES: Record<
  string,
  { kind: InferredTypeKind; certainty?: TypeCertainty }
> = {
  nz: { kind: 'series' },
  sma: { kind: 'series' },
  ema: { kind: 'series' },
  'ta.cross': { kind: 'bool', certainty: 'certain' },
  'ta.crossover': { kind: 'bool', certainty: 'certain' },
  'ta.crossunder': { kind: 'bool', certainty: 'certain' },
  'ta.valuewhen': { kind: 'series' },
  'ta.sma': { kind: 'series' },
  'ta.ema': { kind: 'series' },
  'ta.rsi': { kind: 'series' },
  'ta.macd': { kind: 'series' },
  'ta.atr': { kind: 'series' },
  'ta.highest': { kind: 'series' },
  'ta.lowest': { kind: 'series' },
  'ta.barssince': { kind: 'int' },
  'math.round': { kind: 'float' },
  'math.floor': { kind: 'float' },
  'math.ceil': { kind: 'float' },
  plot: { kind: 'void', certainty: 'certain' },
  'strategy.entry': { kind: 'void', certainty: 'certain' },
  'strategy.order': { kind: 'void', certainty: 'certain' },
  'strategy.exit': { kind: 'void', certainty: 'certain' },
  'strategy.close': { kind: 'void', certainty: 'certain' },
  'strategy.close_all': { kind: 'void', certainty: 'certain' },
  'strategy.cancel': { kind: 'void', certainty: 'certain' },
  'strategy.cancel_all': { kind: 'void', certainty: 'certain' },
  'strategy.percent_of_equity': { kind: 'float', certainty: 'certain' },
  'strategy.position_size': { kind: 'series', certainty: 'certain' },
  'strategy.position_avg_price': { kind: 'series', certainty: 'certain' },
  'strategy.risk.allow_entry_in': { kind: 'void', certainty: 'certain' },
  'strategy.risk.max_position_size': { kind: 'void', certainty: 'certain' },
  'strategy.risk.max_drawdown': { kind: 'void', certainty: 'certain' },
  'strategy.risk.max_intraday_loss': { kind: 'void', certainty: 'certain' },
  'strategy.risk.max_intraday_filled_orders': { kind: 'void', certainty: 'certain' },
  'strategy.risk.max_cons_loss_days': { kind: 'void', certainty: 'certain' },
};

function resolveQualifiedName(expression: ExpressionNode): string | null {
  if (expression.kind === 'Identifier') {
    return expression.name;
  }

  if (expression.kind === 'MemberExpression') {
    const memberExpression = expression as MemberExpressionNode;
    if (memberExpression.computed) {
      return null;
    }

    const objectName = resolveQualifiedName(memberExpression.object);
    if (!objectName) {
      return null;
    }

    return `${objectName}.${memberExpression.property.name}`;
  }

  return null;
}

function createBuiltinCallMetadata(name: string, argumentTypes: TypeMetadata[]): TypeMetadata | null {
  const override = BUILTIN_CALL_RETURN_TYPES[name];
  if (override) {
    return createTypeMetadata(override.kind, `call:builtin:${name}`, override.certainty ?? 'inferred');
  }

  if (name.startsWith('ta.')) {
    if (TA_BOOLEAN_RETURN_FUNCTIONS.has(name)) {
      return createTypeMetadata('bool', `call:builtin:${name}`, 'certain');
    }

    if (TA_INTEGER_RETURN_FUNCTIONS.has(name)) {
      return createTypeMetadata('int', `call:builtin:${name}`);
    }

    return createTypeMetadata('series', `call:builtin:${name}`);
  }

  if (name.startsWith('strategy.')) {
    if (STRATEGY_ORDER_FUNCTIONS.has(name) || name.startsWith('strategy.risk.')) {
      return createTypeMetadata('void', `call:builtin:${name}`, 'certain');
    }

    if (STRATEGY_SERIES_RETURN_FUNCTIONS.has(name)) {
      return createTypeMetadata('series', `call:builtin:${name}`, 'certain');
    }

    return createTypeMetadata('series', `call:builtin:${name}`);
  }

  return null;
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

function inferArgument(environment: TypeEnvironment, argument: ArgumentNode): TypeMetadata {
  if (argument.name) {
    // Named arguments reference parameter labels rather than script symbols.
    environment.nodeTypes.set(argument.name, createTypeMetadata('unknown', 'argument:name', 'certain'));
  }
  return inferExpression(environment, argument.value, `argument:value`);
}

function determineNumericLiteralKind(literal: NumberLiteralNode): InferredTypeKind {
  return /[.eE]/.test(literal.raw) ? 'float' : 'int';
}

function inferCallExpression(environment: TypeEnvironment, expression: CallExpressionNode): TypeMetadata {
  inferExpression(environment, expression.callee, 'call:callee');
  const argumentTypes = expression.args.map((arg) => inferArgument(environment, arg));
  const calleeName = resolveQualifiedName(expression.callee);
  let metadata: TypeMetadata | null = calleeName
    ? createBuiltinCallMetadata(calleeName, argumentTypes)
    : null;

  if (metadata?.kind === 'series') {
    const seriesArguments = argumentTypes.filter((argumentType) => argumentType.kind === 'series');
    if (seriesArguments.length > 0) {
      metadata = cloneTypeMetadata(metadata, { certainty: combineCertainty(...seriesArguments) });
    }
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

function inferMemberExpression(
  environment: TypeEnvironment,
  expression: MemberExpressionNode,
  reason: string,
): TypeMetadata {
  inferExpression(environment, expression.object, `${reason}:object`);
  const propertyMetadata = recordIdentifierUsage(environment, expression.property, `${reason}:property`);
  const annotated = cloneTypeMetadata(propertyMetadata, { addSource: `${reason}:member` });
  return annotateNode(environment, expression, annotated);
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
    case 'ArrowFunctionExpression':
      return inferArrowFunctionExpression(environment, expression as ArrowFunctionExpressionNode);
    case 'BinaryExpression':
      return inferBinaryExpression(environment, expression as BinaryExpressionNode);
    case 'MemberExpression':
      return inferMemberExpression(environment, expression as MemberExpressionNode, reason);
    case 'UnaryExpression':
      return inferUnaryExpression(environment, expression as UnaryExpressionNode);
    case 'ConditionalExpression':
      return inferConditionalExpression(environment, expression as ConditionalExpressionNode);
    case 'IfExpression':
      return inferIfExpression(environment, expression as IfExpressionNode);
    case 'IndexExpression': {
      const indexExpression = expression as IndexExpressionNode;
      const objectType = inferExpression(environment, indexExpression.object, `${reason}:object`);
      inferExpression(environment, indexExpression.index, `${reason}:index`);
      if (objectType.kind === 'series') {
        return annotateNode(
          environment,
          expression,
          createTypeMetadata('series', `${reason}:historical`, objectType.certainty),
        );
      }
      if (objectType.kind === 'matrix') {
        return annotateNode(
          environment,
          expression,
          createTypeMetadata('unknown', `${reason}:matrix-index`),
        );
      }
      return annotateNode(environment, expression, createUnknown(`${reason}:index`));
    }
    case 'MatrixLiteral': {
      const matrixLiteral = expression as MatrixLiteralNode;
      matrixLiteral.rows.forEach((row, rowIndex) => {
        row.forEach((element, columnIndex) => {
          inferExpression(environment, element, `${reason}:matrix[${rowIndex}][${columnIndex}]`);
        });
      });
      return annotateNode(environment, expression, createTypeMetadata('matrix', `${reason}:matrix`, 'certain'));
    }
    case 'TupleExpression': {
      const tuple = expression as TupleExpressionNode;
      tuple.elements.forEach((element, elementIndex) => {
        if (element) {
          inferExpression(environment, element, `${reason}:tuple[${elementIndex}]`);
        }
      });
      return annotateNode(environment, expression, createUnknown(`${reason}:tuple`));
    }
    case 'ForStatement': {
      const forExpression = expression as ForStatementNode;
      const resultType = analyzeForStatement(environment, forExpression) ?? createUnknown('for:result');
      return annotateNode(environment, expression, resultType);
    }
    case 'WhileStatement': {
      const whileExpression = expression as WhileStatementNode;
      const resultType = analyzeWhileStatement(environment, whileExpression) ?? createUnknown('while:result');
      return annotateNode(environment, expression, resultType);
    }
    case 'RepeatStatement': {
      const repeatExpression = expression as RepeatStatementNode;
      const resultType = analyzeRepeatStatement(environment, repeatExpression) ?? createUnknown('repeat:result');
      return annotateNode(environment, expression, resultType);
    }
    default:
      return annotateNode(environment, expression, createUnknown(reason));
  }
}

function visitBlock(environment: TypeEnvironment, block: BlockStatementNode): void {
  block.body.forEach((statement) => visitStatement(environment, statement));
}

function inferIfExpression(environment: TypeEnvironment, expression: IfExpressionNode): TypeMetadata {
  inferExpression(environment, expression.test, 'if-expression:test');
  visitStatement(environment, expression.consequent);
  if (expression.alternate) {
    if (expression.alternate.kind === 'IfExpression') {
      inferIfExpression(environment, expression.alternate as IfExpressionNode);
    } else {
      visitStatement(environment, expression.alternate);
    }
  }

  return annotateNode(environment, expression, createUnknown('if-expression'));
}

function visitIfStatement(environment: TypeEnvironment, statement: IfStatementNode): void {
  inferExpression(environment, statement.test, 'if:test');
  visitStatement(environment, statement.consequent);
  if (statement.alternate) {
    visitStatement(environment, statement.alternate);
  }
}

function analyzeWhileStatement(
  environment: TypeEnvironment,
  statement: WhileStatementNode,
): TypeMetadata | null {
  inferExpression(environment, statement.test, 'while:test');
  visitStatement(environment, statement.body);
  if (statement.result) {
    return inferExpression(environment, statement.result, 'while:result');
  }
  return null;
}

function visitWhileStatement(environment: TypeEnvironment, statement: WhileStatementNode): void {
  analyzeWhileStatement(environment, statement);
}

function analyzeRepeatStatement(
  environment: TypeEnvironment,
  statement: RepeatStatementNode,
): TypeMetadata | null {
  visitStatement(environment, statement.body);
  let resultType: TypeMetadata | null = null;
  if (statement.result) {
    resultType = inferExpression(environment, statement.result, 'repeat:result');
  }
  inferExpression(environment, statement.test, 'repeat:test');
  return resultType;
}

function visitRepeatStatement(environment: TypeEnvironment, statement: RepeatStatementNode): void {
  analyzeRepeatStatement(environment, statement);
}

function analyzeForStatement(
  environment: TypeEnvironment,
  statement: ForStatementNode,
): TypeMetadata | null {
  if (statement.initializer) {
    visitStatement(environment, statement.initializer);
  }
  if (statement.iterator) {
    inferExpression(environment, statement.iterator, 'for:iterator');
  }
  if (statement.iterable) {
    inferExpression(environment, statement.iterable, 'for:iterable');
  }
  if (statement.test) {
    inferExpression(environment, statement.test, 'for:test');
  }
  if (statement.update) {
    inferExpression(environment, statement.update, 'for:update');
  }
  visitStatement(environment, statement.body);
  if (statement.result) {
    return inferExpression(environment, statement.result, 'for:result');
  }
  return null;
}

function visitForStatement(environment: TypeEnvironment, statement: ForStatementNode): void {
  analyzeForStatement(environment, statement);
}

function visitSwitchStatement(environment: TypeEnvironment, statement: SwitchStatementNode): void {
  inferExpression(environment, statement.discriminant, 'switch:discriminant');
  statement.cases.forEach((caseNode, index) => {
    if (caseNode.test) {
      inferExpression(environment, caseNode.test, `switch:case:${index}:test`);
    }
    caseNode.consequent.forEach((caseStatement) => {
      visitStatement(environment, caseStatement);
    });
  });
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

function inferArrowFunctionExpression(
  environment: TypeEnvironment,
  expression: ArrowFunctionExpressionNode,
): TypeMetadata {
  expression.params.forEach((param) => {
    assignIdentifier(
      environment,
      param.identifier,
      createUnknown(`arrow:param:${param.identifier.name}`),
      'arrow:param',
    );
    if (param.defaultValue) {
      inferExpression(environment, param.defaultValue, 'arrow:param:default');
    }
  });

  visitBlock(environment, expression.body);

  return annotateNode(
    environment,
    expression,
    createTypeMetadata('function', 'arrow:function', 'certain'),
  );
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
  } else if (statement.left.kind === 'TupleExpression') {
    const tuple = statement.left as TupleExpressionNode;
    tuple.elements.forEach((element) => {
      if (element && element.kind === 'Identifier') {
        assignIdentifier(environment, element, rightMetadata, 'assignment:target');
      }
    });
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
    case 'RepeatStatement':
      visitRepeatStatement(environment, statement as RepeatStatementNode);
      break;
    case 'WhileStatement':
      visitWhileStatement(environment, statement as WhileStatementNode);
      break;
    case 'ForStatement':
      visitForStatement(environment, statement as ForStatementNode);
      break;
    case 'SwitchStatement':
      visitSwitchStatement(environment, statement as SwitchStatementNode);
      break;
    case 'ScriptDeclaration':
      visitScriptDeclaration(environment, statement);
      break;
    case 'EnumDeclaration': {
      const enumDeclaration = statement as EnumDeclarationNode;
      assignIdentifier(
        environment,
        enumDeclaration.identifier,
        createTypeMetadata('unknown', 'enum:declaration', 'certain'),
        'enum:declaration',
      );
      enumDeclaration.members.forEach((member) => {
        assignIdentifier(
          environment,
          member.identifier,
          createTypeMetadata('unknown', 'enum:member', 'certain'),
          'enum:member',
        );
        inferExpression(environment, member.value, 'enum:member');
      });
      break;
    }
    case 'EnumMember':
      break;
    case 'TypeDeclaration':
      assignIdentifier(
        environment,
        (statement as TypeDeclarationNode).identifier,
        createTypeMetadata('udt', 'type:declaration', 'certain'),
        'type:declaration',
      );
      break;
    case 'ImportDeclaration':
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
