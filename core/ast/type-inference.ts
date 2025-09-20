import type {
  AssignmentNode,
  BinaryExpressionNode,
  CallExpressionNode,
  ExpressionNode,
  IdentifierNode,
  LiteralNode,
  ProgramNode,
  VariableDeclarationNode,
} from './nodes';
import {
  type AstTypeAnnotation,
  type AstTypeKind,
  type AstTypeSource,
  type AstTypeSourceReason,
  type AstTypeTable,
  createEmptyTypeTable,
} from './types';

type TypeEnv = Map<string, AstTypeAnnotation>;

type StatementNode = ProgramNode['body'][number];

type ExpressionKind = ExpressionNode['kind'];

type LiteralKind = LiteralNode['kind'];

type InferredSourceReason = Exclude<AstTypeSourceReason, 'declaration' | 'assignment'>;

type TypeSource = AstTypeSource;

interface InferredType {
  kind: AstTypeKind;
  isSeries: boolean;
  source: TypeSource;
}

const LITERAL_TYPE_MAP: Record<LiteralKind, AstTypeKind> = {
  NumberLiteral: 'float',
  StringLiteral: 'string',
  BooleanLiteral: 'bool',
};

const LOGICAL_OPERATORS = new Set<BinaryExpressionNode['operator']>(['and', 'or']);
const COMPARISON_OPERATORS = new Set<BinaryExpressionNode['operator']>([
  '==',
  '!=',
  '<',
  '<=',
  '>',
  '>=',
]);

const SERIES_KEYWORDS = new Set<VariableDeclarationNode['keyword']>(['var', 'varip']);

function createSource(node: ExpressionNode | null, reason: AstTypeSourceReason): TypeSource {
  return { node, reason };
}

function cloneAnnotation(annotation: AstTypeAnnotation, reason: InferredSourceReason, node: ExpressionNode | null): InferredType {
  return {
    kind: annotation.kind,
    isSeries: annotation.isSeries,
    source: createSource(node, reason),
  };
}

function createAnnotation(kind: AstTypeKind, node: ExpressionNode | null, reason: AstTypeSourceReason): InferredType {
  return {
    kind,
    isSeries: false,
    source: createSource(node, reason),
  };
}

function mergeKinds(existing: AstTypeKind, incoming: AstTypeKind): AstTypeKind {
  if (existing === incoming) {
    return existing;
  }
  if (existing === 'unknown') {
    return incoming;
  }
  if (incoming === 'unknown') {
    return existing;
  }
  if (existing === 'series' || incoming === 'series') {
    return 'series';
  }
  return 'unknown';
}

function recordType(
  env: TypeEnv,
  table: AstTypeTable,
  name: string,
  inferred: InferredType,
  declarationNode: ExpressionNode | null,
  reason: AstTypeSourceReason,
): AstTypeAnnotation {
  const existing = env.get(name);
  const source: AstTypeSource = { node: declarationNode, reason };

  if (!existing) {
    const annotation: AstTypeAnnotation = {
      kind: inferred.kind,
      isSeries: inferred.isSeries,
      sources: [inferred.source, source],
    };
    env.set(name, annotation);
    table.set(name, annotation);
    return annotation;
  }

  existing.kind = mergeKinds(existing.kind, inferred.kind);
  existing.isSeries = existing.isSeries || inferred.isSeries;
  existing.sources.push(inferred.source, source);
  return existing;
}

function analyseIdentifier(identifier: IdentifierNode, env: TypeEnv): InferredType {
  const binding = env.get(identifier.name);
  if (!binding) {
    return createAnnotation('unknown', identifier, 'identifier');
  }
  return cloneAnnotation(binding, 'identifier', identifier);
}

function analyseCallExpression(expression: CallExpressionNode): InferredType {
  // Until built-in metadata is connected, treat call expressions as producing series data.
  return {
    kind: 'unknown',
    isSeries: true,
    source: createSource(expression, 'call'),
  };
}

function analyseExpression(expression: ExpressionNode, env: TypeEnv): InferredType {
  switch (expression.kind as ExpressionKind) {
    case 'Identifier':
      return analyseIdentifier(expression as IdentifierNode, env);
    case 'CallExpression':
      return analyseCallExpression(expression as CallExpressionNode);
    case 'BinaryExpression':
      return analyseBinaryExpression(expression as BinaryExpressionNode, env);
    case 'NumberLiteral':
    case 'StringLiteral':
    case 'BooleanLiteral': {
      const literalKind = LITERAL_TYPE_MAP[expression.kind as LiteralKind] ?? 'unknown';
      return createAnnotation(literalKind, expression, 'literal');
    }
    default:
      return createAnnotation('unknown', expression, 'unknown');
  }
}

function handleVariableDeclaration(
  declaration: VariableDeclarationNode,
  env: TypeEnv,
  table: AstTypeTable,
): void {
  const inferred = declaration.value
    ? analyseExpression(declaration.value, env)
    : createAnnotation('unknown', null, 'declaration');

  if (SERIES_KEYWORDS.has(declaration.keyword)) {
    inferred.isSeries = true;
  }

  recordType(env, table, declaration.identifier.name, inferred, declaration.value, 'declaration');
}

function handleAssignment(
  assignment: AssignmentNode,
  env: TypeEnv,
  table: AstTypeTable,
): void {
  const inferred = analyseExpression(assignment.value, env);
  recordType(env, table, assignment.identifier.name, inferred, assignment.value, 'assignment');
}

function analyseBinaryExpression(expression: BinaryExpressionNode, env: TypeEnv): InferredType {
  const left = analyseExpression(expression.left, env);
  const right = analyseExpression(expression.right, env);
  const isSeries =
    left.isSeries ||
    right.isSeries ||
    left.kind === 'unknown' ||
    right.kind === 'unknown';

  if (LOGICAL_OPERATORS.has(expression.operator) || COMPARISON_OPERATORS.has(expression.operator)) {
    const annotation = createAnnotation('bool', expression, 'binary');
    annotation.isSeries = isSeries;
    return annotation;
  }

  const annotation = createAnnotation('unknown', expression, 'binary');
  annotation.isSeries = isSeries;
  return annotation;
}

function analyseStatement(
  statement: StatementNode,
  env: TypeEnv,
  table: AstTypeTable,
): void {
  switch (statement.kind) {
    case 'VariableDeclaration':
      handleVariableDeclaration(statement as VariableDeclarationNode, env, table);
      break;
    case 'AssignmentStatement':
      handleAssignment(statement as AssignmentNode, env, table);
      break;
    case 'ExpressionStatement':
      analyseExpression(statement.expression, env);
      break;
    case 'ScriptDeclaration':
      analyseExpression(statement.call, env);
      break;
    default:
      break;
  }
}

export interface AstTypeInferenceResult {
  types: AstTypeTable;
}

export function inferProgramTypes(program: ProgramNode | null): AstTypeInferenceResult {
  const table = createEmptyTypeTable();
  const env: TypeEnv = new Map();

  if (!program) {
    return { types: table };
  }

  for (const statement of program.body) {
    analyseStatement(statement, env, table);
  }

  return { types: table };
}

export function createEmptyTypeInferenceResult(): AstTypeInferenceResult {
  return { types: createEmptyTypeTable() };
}

export type { AstTypeAnnotation };
