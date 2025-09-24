import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { WhileLoopValidator } from '../../modules/while-loop-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createAssignmentStatement,
  createBinaryExpression,
  createBlock,
  createBooleanLiteral,
  createBreakStatement,
  createCallExpression,
  createExpressionStatement,
  createIdentifier,
  createIfStatement,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createReturn,
  createStringLiteral,
  createWhileStatement,
} from './fixtures';

class WhileLoopHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new WhileLoopValidator());
  }

  protected runCoreValidation(): void {}
}

class WhileLoopDisabledHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new WhileLoopValidator());
  }

  protected runCoreValidation(): void {}
}

const createEmptyBlock = (line: number) => createBlock([], 0, 0, line, line);

describe('WhileLoopValidator (AST)', () => {
  it('emits literal condition diagnostics', () => {
    const trueLoop = createWhileStatement(
      createBooleanLiteral(true, 6, 2),
      createEmptyBlock(3),
      0,
      10,
      2,
    );
    const falseLoop = createWhileStatement(
      createBooleanLiteral(false, 6, 5),
      createEmptyBlock(6),
      10,
      20,
      5,
    );
    const numericLoop = createWhileStatement(
      createNumberLiteral(10, '10', 6, 8),
      createEmptyBlock(9),
      20,
      30,
      8,
    );
    const stringLoop = createWhileStatement(
      createStringLiteral('foo', '"foo"', 6, 11),
      createEmptyBlock(12),
      30,
      40,
      11,
    );

    const program = createProgram([trueLoop, falseLoop, numericLoop, stringLoop], 0, 40, 1, 12);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));
    const validator = new WhileLoopHarness(service);

    const source = [
      '//@version=6',
      'while true',
      '    plot(close)',
      'end',
      'while false',
      '    plot(close)',
      'end',
      'while 10',
      '    plot(close)',
      'end',
      'while "foo"',
      '    plot(close)',
      'end',
    ].join('\n');

    const result = validator.validate(source);

    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['PSV6-WHILE-INFINITE-LOOP']),
    );
    const warningCodes = result.warnings.map((warning) => warning.code);
    expect(warningCodes).toEqual(
      expect.arrayContaining([
        'PSV6-WHILE-NEVER-EXECUTES',
        'PSV6-WHILE-NUMERIC-CONDITION',
        'PSV6-WHILE-STRING-CONDITION',
      ]),
    );
  });

  it('analyses complex conditions for best-practice guidance', () => {
    const comparisonA = createBinaryExpression(
      '==',
      createIdentifier('i', 2, 2),
      createNumberLiteral(1, '1', 6, 2),
      2,
      8,
      2,
    );
    const comparisonB = createBinaryExpression(
      '==',
      createIdentifier('j', 12, 2),
      createNumberLiteral(2, '2', 16, 2),
      12,
      18,
      2,
    );
    const comparisonC = createBinaryExpression(
      '==',
      createIdentifier('k', 22, 2),
      createNumberLiteral(3, '3', 26, 2),
      22,
      28,
      2,
    );
    const comparisonD = createBinaryExpression(
      '==',
      createIdentifier('m', 32, 2),
      createNumberLiteral(4, '4', 36, 2),
      32,
      38,
      2,
    );

    const trailing = createBinaryExpression('and', comparisonC, comparisonD, 22, 38, 2);
    const chained = createBinaryExpression('and', comparisonB, trailing, 12, 38, 2);
    const condition = createBinaryExpression('and', comparisonA, chained, 2, 38, 2);

    const complexLoop = createWhileStatement(condition, createEmptyBlock(3), 0, 40, 2);
    const program = createProgram([complexLoop], 0, 40, 1, 4);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));
    const validator = new WhileLoopHarness(service);

    const source = [
      '//@version=6',
      'while i == 1 and j == 2 and k == 3 and m == 4',
      '    plot(close)',
      'end',
    ].join('\n');

    const result = validator.validate(source);

    const warningCodes = result.warnings.map((warning) => warning.code);
    expect(warningCodes).toEqual(expect.arrayContaining(['PSV6-WHILE-COMPLEX-CONDITION']));

    const infoCodes = result.info.map((info) => info.code);
    expect(infoCodes).toEqual(
      expect.arrayContaining([
        'PSV6-WHILE-CONDITION-SIMPLIFICATION',
        'PSV6-WHILE-VARIABLE-UPDATE-REMINDER',
        'PSV6-WHILE-VARIABLE-NAMING',
        'PSV6-WHILE-CONDITION-BEST-PRACTICE',
      ]),
    );
  });

  it('detects expensive operations and complex bodies', () => {
    const securityCall = createCallExpression(
      createMemberExpression(
        createIdentifier('request', 2, 2),
        createIdentifier('security', 10, 2),
        2,
        18,
        2,
      ),
      [createArgument(createIdentifier('close', 20, 2), 19, 24, 2)],
      2,
      24,
      2,
    );
    const securityStatement = createExpressionStatement(securityCall, 2, 24, 2);

    const smaCall = createCallExpression(
      createMemberExpression(
        createIdentifier('ta', 2, 3),
        createIdentifier('sma', 5, 3),
        2,
        8,
        3,
      ),
      [createArgument(createIdentifier('close', 10, 3), 9, 14, 3)],
      2,
      14,
      3,
    );
    const smaStatement = createExpressionStatement(smaCall, 2, 14, 3);

    const emaCall = createCallExpression(
      createMemberExpression(
        createIdentifier('ta', 6, 4),
        createIdentifier('ema', 9, 4),
        6,
        12,
        4,
      ),
      [createArgument(createIdentifier('close', 14, 4), 13, 19, 4)],
      6,
      19,
      4,
    );
    const emaStatement = createExpressionStatement(emaCall, 6, 19, 4);
    const ifBlock = createBlock([emaStatement], 5, 21, 4, 5);
    const ifStatement = createIfStatement(
      createBooleanLiteral(true, 2, 4),
      ifBlock,
      null,
      2,
      21,
      4,
    );

    const mathCall = createCallExpression(
      createMemberExpression(
        createIdentifier('math', 2, 6),
        createIdentifier('max', 7, 6),
        2,
        10,
        6,
      ),
      [createArgument(createIdentifier('volume', 12, 6), 11, 18, 6)],
      2,
      18,
      6,
    );
    const mathStatement = createExpressionStatement(mathCall, 2, 18, 6);

    const loopBody = createBlock([securityStatement, smaStatement, ifStatement, mathStatement], 2, 18, 2, 6);
    const whileStatement = createWhileStatement(createIdentifier('condition', 2, 2), loopBody, 0, 20, 2);

    const program = createProgram([whileStatement], 0, 20, 1, 6);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));
    const validator = new WhileLoopHarness(service);

    const source = [
      '//@version=6',
      'while condition',
      '    request.security()',
      '    ta.sma(close)',
      '    if true',
      '        ta.ema(close)',
      '    end',
      '    math.max(volume)',
      'end',
    ].join('\n');

    const result = validator.validate(source);

    const warningCodes = result.warnings.map((warning) => warning.code);
    expect(warningCodes).toEqual(
      expect.arrayContaining(['PSV6-WHILE-EXPENSIVE-OPERATION', 'PSV6-WHILE-COMPLEX-OPERATION']),
    );
  });

  it('reports loop body control flow diagnostics', () => {
    const increment = createBinaryExpression(
      '+',
      createIdentifier('i', 2, 2),
      createNumberLiteral(1, '1', 6, 2),
      2,
      8,
      2,
    );
    const incrementAssignment = createAssignmentStatement(createIdentifier('i', 2, 2), increment, 2, 8, 2);

    const breakStatement = createBreakStatement(2, 7, 3);
    const returnStatement = createReturn(null, 2, 8, 5);
    const returnBlock = createBlock([returnStatement], 2, 8, 5, 5);
    const conditionalBreak = createIfStatement(
      createIdentifier('shouldBreak', 2, 4),
      returnBlock,
      null,
      2,
      8,
      4,
    );

    const loopBody = createBlock([incrementAssignment, breakStatement, conditionalBreak], 2, 8, 2, 5);
    const whileStatement = createWhileStatement(createIdentifier('i', 2, 2), loopBody, 0, 12, 2);

    const program = createProgram([whileStatement], 0, 12, 1, 5);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));
    const validator = new WhileLoopHarness(service);

    const source = [
      '//@version=6',
      'while i',
      '    i := i + 1',
      '    break',
      '    if shouldBreak',
      '        return',
      '    end',
      'end',
    ].join('\n');

    const result = validator.validate(source);

    const infoCodes = result.info.map((info) => info.code);
    expect(infoCodes).toEqual(
      expect.arrayContaining([
        'PSV6-WHILE-VARIABLE-UPDATE-GOOD',
        'PSV6-WHILE-BREAK-CONDITION',
        'PSV6-WHILE-CONDITIONAL-BREAK',
      ]),
    );
  });

  it('warns on deeply nested while loops', () => {
    const innerMost = createWhileStatement(
      createBooleanLiteral(false, 2, 5),
      createEmptyBlock(6),
      40,
      50,
      5,
    );
    const levelThreeBody = createBlock([innerMost], 30, 50, 4, 6);
    const levelThree = createWhileStatement(
      createBooleanLiteral(false, 2, 4),
      levelThreeBody,
      30,
      60,
      4,
    );
    const levelTwoBody = createBlock([levelThree], 20, 60, 3, 6);
    const levelTwo = createWhileStatement(
      createBooleanLiteral(false, 2, 3),
      levelTwoBody,
      20,
      70,
      3,
    );
    const levelOneBody = createBlock([levelTwo], 10, 70, 2, 6);
    const levelOne = createWhileStatement(
      createBooleanLiteral(false, 2, 2),
      levelOneBody,
      10,
      80,
      2,
    );

    const program = createProgram([levelOne], 0, 80, 1, 6);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));
    const validator = new WhileLoopHarness(service);

    const source = [
      '//@version=6',
      'while false',
      '    while false',
      '        while false',
      '            while false',
      '                plot(close)',
      '            end',
      '        end',
      '    end',
      'end',
    ].join('\n');

    const result = validator.validate(source);

    const warningCodes = result.warnings.map((warning) => warning.code);
    expect(warningCodes).toEqual(expect.arrayContaining(['PSV6-WHILE-DEEP-NESTING']));
  });

  it('returns no diagnostics when AST mode is disabled', () => {
    const harness = new WhileLoopDisabledHarness();

    const source = [
      '//@version=6',
      'while true',
      '    break',
      'end',
    ].join('\n');

    const result = harness.validate(source);

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });
});
