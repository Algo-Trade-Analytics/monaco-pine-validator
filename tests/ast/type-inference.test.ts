import { describe, expect, it } from 'vitest';
import { inferTypes } from '../../core/ast/type-inference';
import {
  createArgument,
  createAssignmentStatement,
  createBinaryExpression,
  createBooleanLiteral,
  createCallExpression,
  createIdentifier,
  createNumberLiteral,
  createStringLiteral,
  createUnaryExpression,
  createVariableDeclaration,
} from './fixtures';
import {
  type ConditionalExpressionNode,
  type ExpressionStatementNode,
  type ProgramNode,
} from '../../core/ast/nodes';
import { createLocation, createPosition, createRange } from '../../core/ast/nodes';

function createProgram(body: ProgramNode['body']): ProgramNode {
  return {
    kind: 'Program',
    directives: [],
    body,
    loc: createLocation(createPosition(1, 1, 0), createPosition(body.length + 1, 1, 0)),
    range: createRange(0, body.length),
  };
}

describe('inferTypes', () => {
  it('tracks literal-backed declarations and assignments', () => {
    const countIdentifier = createIdentifier('count', 0);
    const countDeclaration = createVariableDeclaration(countIdentifier, 0, 10, 1, {
      declarationKind: 'var',
      initializer: createNumberLiteral(10, '10', 6, 1),
    });

    const sumIdentifier = createIdentifier('sum', 20, 2);
    const addition = createBinaryExpression(
      '+',
      createIdentifier('count', 24, 2),
      createNumberLiteral(1.5, '1.5', 30, 2),
      24,
      34,
      2,
    );
    const sumAssignment = createAssignmentStatement(sumIdentifier, addition, 20, 36, 2);

    const messageIdentifier = createIdentifier('message', 40, 3);
    const concatenation = createBinaryExpression(
      '+',
      createStringLiteral('avg', '"avg"', 50, 3),
      createIdentifier('sum', 55, 3),
      50,
      62,
      3,
    );
    const messageAssignment = createAssignmentStatement(messageIdentifier, concatenation, 40, 64, 3);

    const readyIdentifier = createIdentifier('isReady', 70, 4);
    const readyDeclaration = createVariableDeclaration(readyIdentifier, 70, 82, 4, {
      declarationKind: 'var',
      initializer: createBooleanLiteral(true, 80, 4),
    });

    const program = createProgram([countDeclaration, sumAssignment, messageAssignment, readyDeclaration]);
    const environment = inferTypes(program);

    const countType = environment.identifiers.get('count');
    expect(countType?.kind).toBe('int');
    expect(countType?.certainty).toBe('certain');

    const sumType = environment.identifiers.get('sum');
    expect(sumType?.kind).toBe('float');

    const messageType = environment.identifiers.get('message');
    expect(messageType?.kind).toBe('string');

    const readyType = environment.identifiers.get('isReady');
    expect(readyType?.kind).toBe('bool');

    expect(environment.nodeTypes.get(addition)?.kind).toBe('float');
    expect(environment.nodeTypes.get(concatenation)?.kind).toBe('string');
  });

  it('marks conditional expressions with conflicting branch types as conflicts', () => {
    const numberDeclaration = createVariableDeclaration(createIdentifier('value', 0, 1), 0, 10, 1, {
      declarationKind: 'var',
      initializer: createNumberLiteral(2, '2', 6, 1),
    });
    const stringDeclaration = createVariableDeclaration(createIdentifier('label', 20, 2), 20, 32, 2, {
      declarationKind: 'var',
      initializer: createStringLiteral('hi', '"hi"', 26, 2),
    });

    const conditional: ConditionalExpressionNode = {
      kind: 'ConditionalExpression',
      test: createIdentifier('toggle', 40, 3),
      consequent: createIdentifier('value', 47, 3),
      alternate: createIdentifier('label', 55, 3),
      loc: createLocation(createPosition(3, 1, 40), createPosition(3, 20, 60)),
      range: createRange(40, 60),
    };
    const conditionalStatement = {
      kind: 'ExpressionStatement',
      expression: conditional,
      loc: createLocation(createPosition(3, 1, 40), createPosition(3, 20, 60)),
      range: createRange(40, 60),
    } satisfies ExpressionStatementNode;

    const program = createProgram([numberDeclaration, stringDeclaration, conditionalStatement]);
    const environment = inferTypes(program);

    const conditionalType = environment.nodeTypes.get(conditional);
    expect(conditionalType?.kind).toBe('unknown');
    expect(conditionalType?.certainty).toBe('conflict');
  });

  it('infers builtin series identifiers and propagates series arithmetic', () => {
    const closeIdentifier = createIdentifier('close', 0, 1);
    const addition = createBinaryExpression(
      '+',
      closeIdentifier,
      createNumberLiteral(1, '1', 6, 1),
      0,
      7,
      1,
    );
    const additionStatement: ExpressionStatementNode = {
      kind: 'ExpressionStatement',
      expression: addition,
      loc: createLocation(createPosition(1, 1, 0), createPosition(1, 8, 7)),
      range: createRange(0, 7),
    };

    const negate = createUnaryExpression('-', createIdentifier('close', 9, 1), 9, 11, 1);
    const negateStatement: ExpressionStatementNode = {
      kind: 'ExpressionStatement',
      expression: negate,
      loc: createLocation(createPosition(1, 10, 9), createPosition(1, 12, 11)),
      range: createRange(9, 11),
    };

    const program = createProgram([additionStatement, negateStatement]);
    const environment = inferTypes(program);

    const seriesMetadata = environment.identifiers.get('close');
    expect(seriesMetadata?.kind).toBe('series');
    expect(seriesMetadata?.certainty).toBe('certain');

    const additionType = environment.nodeTypes.get(addition);
    expect(additionType?.kind).toBe('series');

    const negateType = environment.nodeTypes.get(negate);
    expect(negateType?.kind).toBe('series');
  });

  it('applies builtin call return heuristics', () => {
    const fastSeries = createIdentifier('close', 14, 1);
    const slowSeries = createIdentifier('open', 22, 1);
    const args = [
      createArgument(fastSeries, 14, 19, 1),
      createArgument(slowSeries, 20, 24, 1),
    ];
    const call = createCallExpression(createIdentifier('ta.crossover', 0, 1), args, 0, 24, 1);
    const statement: ExpressionStatementNode = {
      kind: 'ExpressionStatement',
      expression: call,
      loc: createLocation(createPosition(1, 1, 0), createPosition(1, 25, 24)),
      range: createRange(0, 24),
    };

    const program = createProgram([statement]);
    const environment = inferTypes(program);

    const callType = environment.nodeTypes.get(call);
    expect(callType?.kind).toBe('bool');
    expect(callType?.certainty).toBe('certain');
  });
});
