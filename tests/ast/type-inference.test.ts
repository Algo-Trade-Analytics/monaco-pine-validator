import { describe, expect, it } from 'vitest';
import { inferTypes } from '../../core/ast/type-inference';
import {
  createArgument,
  createAssignmentStatement,
  createBinaryExpression,
  createBooleanLiteral,
  createCallExpression,
  createIdentifier,
  createIndexExpression,
  createMatrixLiteral,
  createNumberLiteral,
  createStringLiteral,
  createSwitchCase,
  createSwitchStatement,
  createUnaryExpression,
  createVariableDeclaration,
  createMemberExpression,
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

  it('propagates metadata for member expressions', () => {
    const timeframeNamespace = createIdentifier('timeframe', 0, 1);
    const periodProperty = createIdentifier('period', 10, 1);
    const memberExpression = createMemberExpression(timeframeNamespace, periodProperty, 0, 16, 1);

    const declaration = createVariableDeclaration(createIdentifier('tf', 20, 1), 20, 36, 1, {
      declarationKind: 'var',
      initializer: memberExpression,
    });

    const program = createProgram([declaration]);
    const environment = inferTypes(program);

    const timeframeMetadata = environment.identifiers.get('timeframe');
    expect(timeframeMetadata?.kind).toBe('unknown');

    const propertyMetadata = environment.nodeTypes.get(periodProperty);
    const memberMetadata = environment.nodeTypes.get(memberExpression);
    expect(propertyMetadata).toBeDefined();
    expect(memberMetadata).toBeDefined();
    expect(memberMetadata?.kind).toBe(propertyMetadata?.kind);
    expect(memberMetadata?.sources).toContain('variable:initializer:member');
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
    const crossoverCallee = createMemberExpression(
      createIdentifier('ta', 0, 1),
      createIdentifier('crossover', 3, 1),
      0,
      14,
      1,
    );
    const call = createCallExpression(crossoverCallee, args, 0, 24, 1);
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

  it('recognizes namespaced helpers and strategy functions', () => {
    const taSmaCallee = createMemberExpression(
      createIdentifier('ta', 0, 1),
      createIdentifier('sma', 3, 1),
      0,
      6,
      1,
    );
    const taSmaArgs = [
      createArgument(createIdentifier('close', 7, 1), 7, 12, 1),
      createArgument(createNumberLiteral(14, '14', 14, 1), 13, 16, 1),
    ];
    const taSmaCall = createCallExpression(taSmaCallee, taSmaArgs, 0, 16, 1);
    const taSmaStatement: ExpressionStatementNode = {
      kind: 'ExpressionStatement',
      expression: taSmaCall,
      loc: createLocation(createPosition(1, 1, 0), createPosition(1, 17, 16)),
      range: createRange(0, 16),
    };

    const taCrossCallee = createMemberExpression(
      createIdentifier('ta', 20, 2),
      createIdentifier('cross', 23, 2),
      20,
      32,
      2,
    );
    const taCrossArgs = [
      createArgument(createIdentifier('close', 33, 2), 33, 38, 2),
      createArgument(createIdentifier('open', 39, 2), 39, 43, 2),
    ];
    const taCrossCall = createCallExpression(taCrossCallee, taCrossArgs, 20, 44, 2);
    const taCrossStatement: ExpressionStatementNode = {
      kind: 'ExpressionStatement',
      expression: taCrossCall,
      loc: createLocation(createPosition(2, 1, 20), createPosition(2, 25, 44)),
      range: createRange(20, 44),
    };

    const strategyEntryCallee = createMemberExpression(
      createIdentifier('strategy', 0, 3),
      createIdentifier('entry', 9, 3),
      0,
      14,
      3,
    );
    const strategyEntryArgs = [
      createArgument(createStringLiteral('Long', '"Long"', 15, 3), 15, 22, 3),
      createArgument(
        createMemberExpression(
          createIdentifier('strategy', 24, 3),
          createIdentifier('long', 33, 3),
          24,
          34,
          3,
        ),
        24,
        34,
        3,
      ),
    ];
    const strategyEntryCall = createCallExpression(strategyEntryCallee, strategyEntryArgs, 0, 35, 3);
    const strategyEntryStatement: ExpressionStatementNode = {
      kind: 'ExpressionStatement',
      expression: strategyEntryCall,
      loc: createLocation(createPosition(3, 1, 0), createPosition(3, 36, 35)),
      range: createRange(0, 35),
    };

    const strategyPositionCallee = createMemberExpression(
      createIdentifier('strategy', 0, 4),
      createIdentifier('position_size', 9, 4),
      0,
      24,
      4,
    );
    const strategyPositionCall = createCallExpression(strategyPositionCallee, [], 0, 24, 4);
    const strategyPositionStatement: ExpressionStatementNode = {
      kind: 'ExpressionStatement',
      expression: strategyPositionCall,
      loc: createLocation(createPosition(4, 1, 0), createPosition(4, 25, 24)),
      range: createRange(0, 24),
    };

    const program = createProgram([
      taSmaStatement,
      taCrossStatement,
      strategyEntryStatement,
      strategyPositionStatement,
    ]);
    const environment = inferTypes(program);

    const taSmaType = environment.nodeTypes.get(taSmaCall);
    expect(taSmaType?.kind).toBe('series');
    expect(taSmaType?.certainty).toBe('certain');

    const taCrossType = environment.nodeTypes.get(taCrossCall);
    expect(taCrossType?.kind).toBe('bool');
    expect(taCrossType?.certainty).toBe('certain');

    const entryType = environment.nodeTypes.get(strategyEntryCall);
    expect(entryType?.kind).toBe('void');
    expect(entryType?.certainty).toBe('certain');

    const positionType = environment.nodeTypes.get(strategyPositionCall);
    expect(positionType?.kind).toBe('series');
  });

  it('annotates matrix literals and historical index expressions', () => {
    const matrixLiteral = createMatrixLiteral(
      [
        [createNumberLiteral(1, '1', 6, 1), createNumberLiteral(2, '2', 9, 1)],
        [createNumberLiteral(3, '3', 14, 1), createNumberLiteral(4, '4', 17, 1)],
      ],
      5,
      18,
      1,
    );
    const matrixDeclaration = createVariableDeclaration(createIdentifier('weights', 0, 1), 0, 20, 1, {
      declarationKind: 'var',
      initializer: matrixLiteral,
    });

    const indexExpression = createIndexExpression(
      createIdentifier('close', 25, 2),
      createNumberLiteral(1, '1', 31, 2),
      25,
      32,
      2,
    );

    const firstCase = createSwitchCase(
      createIdentifier('long', 40, 3),
      [
        createAssignmentStatement(
          createIdentifier('signal', 45, 3),
          createIdentifier('close', 53, 3),
          45,
          58,
          3,
        ),
      ],
      38,
      60,
      3,
    );

    const secondCase = createSwitchCase(
      null,
      [
        createAssignmentStatement(
          createIdentifier('signal', 62, 4),
          indexExpression,
          62,
          78,
          4,
        ),
      ],
      60,
      78,
      4,
    );

    const switchStatement = createSwitchStatement(
      createIdentifier('direction', 22, 2),
      [firstCase, secondCase],
      22,
      78,
      2,
      4,
    );

    const program = createProgram([matrixDeclaration, switchStatement]);
    const environment = inferTypes(program);

    const matrixMetadata = environment.nodeTypes.get(matrixLiteral);
    expect(matrixMetadata?.kind).toBe('matrix');
    expect(matrixMetadata?.certainty).toBe('certain');

    const weightsMetadata = environment.identifiers.get('weights');
    expect(weightsMetadata?.kind).toBe('matrix');

    const indexMetadata = environment.nodeTypes.get(indexExpression);
    expect(indexMetadata?.kind).toBe('series');

    const directionMetadata = environment.identifiers.get('direction');
    expect(directionMetadata?.kind).toBe('unknown');
  });
});
