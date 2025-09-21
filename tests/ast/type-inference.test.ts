import { describe, expect, it } from 'vitest';
import { inferTypes } from '../../core/ast/type-inference';
import {
  createAssignmentStatement,
  createBinaryExpression,
  createBooleanLiteral,
  createIdentifier,
  createNumberLiteral,
  createStringLiteral,
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
});
