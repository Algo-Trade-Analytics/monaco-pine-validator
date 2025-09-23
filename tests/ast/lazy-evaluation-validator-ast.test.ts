import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { LazyEvaluationValidator } from '../../modules/lazy-evaluation-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import type { ValidatorConfig } from '../../core/types';
import {
  createArgument,
  createAssignmentStatement,
  createBlock,
  createCallExpression,
  createConditionalExpression,
  createExpressionStatement,
  createForStatement,
  createFunctionDeclaration,
  createIdentifier,
  createIfStatement,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createReturn,
} from './fixtures';

class LazyEvaluationHarness extends BaseValidator {
  constructor(service: FunctionAstService, config: Partial<ValidatorConfig> = {}) {
    super({ ast: { mode: 'primary', service }, ...config });
    this.registerModule(new LazyEvaluationValidator());
  }

  protected runCoreValidation(): void {}
}

describe('LazyEvaluationValidator (AST)', () => {
  it('flags historical function calls inside ternary expressions', () => {
    const resultIdentifier = createIdentifier('result', 0, 1);
    const conditionIdentifier = createIdentifier('condition', 10, 1);

    const taIdentifier = createIdentifier('ta', 20, 1);
    const smaIdentifier = createIdentifier('sma', 23, 1);
    const smaCallee = createMemberExpression(taIdentifier, smaIdentifier, 20, 27, 1);
    const closeIdentifier = createIdentifier('close', 28, 1);
    const lengthLiteral = createNumberLiteral(14, '14', 34, 1);
    const smaCall = createCallExpression(
      smaCallee,
      [createArgument(closeIdentifier, 28, 33, 1), createArgument(lengthLiteral, 34, 36, 1)],
      20,
      37,
      1,
    );

    const emaIdentifier = createIdentifier('ema', 40, 1);
    const emaCallee = createMemberExpression(createIdentifier('ta', 37, 1), emaIdentifier, 37, 44, 1);
    const emaCall = createCallExpression(
      emaCallee,
      [createArgument(createIdentifier('close', 45, 1), 45, 50, 1), createArgument(createNumberLiteral(14, '14', 51, 1), 51, 53, 1)],
      37,
      54,
      1,
    );

    const conditional = createConditionalExpression(conditionIdentifier, smaCall, emaCall, 10, 54, 1);
    const assignment = createAssignmentStatement(resultIdentifier, conditional, 0, 54, 1);
    const program = createProgram([assignment], 0, 54, 1, 1);

    const source = 'result := condition ? ta.sma(close, 14) : ta.ema(close, 14)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new LazyEvaluationHarness(service);

    const result = harness.validate(source);
    const historicalWarnings = result.warnings.filter((warning) => warning.code === 'PSV6-LAZY-EVAL-HISTORICAL');

    expect(historicalWarnings.length).toBe(2);
  });

  it('warns when user functions with historical dependencies are used in ternary expressions', () => {
    const closeIdentifier = createIdentifier('close', 32, 2);
    const lengthLiteral = createNumberLiteral(20, '20', 38, 2);
    const taIdentifier = createIdentifier('ta', 24, 2);
    const smaIdentifier = createIdentifier('sma', 27, 2);
    const smaCallee = createMemberExpression(taIdentifier, smaIdentifier, 24, 31, 2);
    const smaCall = createCallExpression(
      smaCallee,
      [createArgument(closeIdentifier, 32, 37, 2), createArgument(lengthLiteral, 38, 40, 2)],
      24,
      41,
      2,
    );

    const returnStatement = createReturn(smaCall, 24, 41, 2);
    const functionBody = createBlock([returnStatement], 24, 41, 2, 2);
    const calcFunction = createFunctionDeclaration(createIdentifier('calc', 16, 2), [], functionBody, 16, 42, 2, 2);

    const conditionIdentifier = createIdentifier('useCalc', 0, 5);
    const calcCall = createCallExpression(createIdentifier('calc', 12, 5), [], 12, 16, 5);
    const fallbackLiteral = createNumberLiteral(0, '0', 20, 5);
    const conditional = createConditionalExpression(conditionIdentifier, calcCall, fallbackLiteral, 0, 21, 5);
    const assignment = createAssignmentStatement(createIdentifier('output', 0, 5), conditional, 0, 21, 5);

    const program = createProgram([calcFunction, assignment], 0, 42, 2, 5);
    const source = 'calc() => ta.sma(close, 20)\noutput := useCalc ? calc() : 0';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new LazyEvaluationHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-LAZY-EVAL-USER-FUNCTION');
    expect(warningCodes).not.toContain('PSV6-LAZY-EVAL-HISTORICAL');
  });

  it('detects inconsistent series assignments across if/else branches', () => {
    const resultIdentifier = createIdentifier('result', 4, 2);
    const taIdentifier = createIdentifier('ta', 18, 3);
    const corrIdentifier = createIdentifier('correlation', 21, 3);
    const corrCallee = createMemberExpression(taIdentifier, corrIdentifier, 18, 32, 3);
    const firstArg = createArgument(createIdentifier('close', 33, 3), 33, 38, 3);
    const secondArg = createArgument(createIdentifier('open', 40, 3), 40, 44, 3);
    const thirdArg = createArgument(createNumberLiteral(10, '10', 46, 3), 46, 48, 3);
    const corrCall = createCallExpression(corrCallee, [firstArg, secondArg, thirdArg], 18, 49, 3);
    const historicalAssignment = createAssignmentStatement(resultIdentifier, corrCall, 4, 49, 3);
    const consequent = createBlock([historicalAssignment], 2, 49, 2, 3);

    const naAssignment = createAssignmentStatement(resultIdentifier, createIdentifier('na', 10, 5), 4, 12, 5);
    const alternate = createBlock([naAssignment], 4, 12, 5, 5);

    const ifStatement = createIfStatement(createIdentifier('cond', 4, 2), consequent, alternate, 0, 12, 2);
    const program = createProgram([ifStatement], 0, 12, 1, 5);
    const source = 'if cond\n    result := ta.correlation(close, open, 10)\nelse\n    result := na';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new LazyEvaluationHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-LAZY-EVAL-SERIES-INCONSISTENCY');
    expect(warningCodes).not.toContain('PSV6-LAZY-EVAL-CONDITIONAL');
  });

  it('reports method calls to user functions with historical dependencies', () => {
    const taIdentifier = createIdentifier('ta', 24, 2);
    const emaIdentifier = createIdentifier('ema', 27, 2);
    const emaCallee = createMemberExpression(taIdentifier, emaIdentifier, 24, 31, 2);
    const emaCall = createCallExpression(emaCallee, [createArgument(createIdentifier('close', 32, 2), 32, 37, 2)], 24, 38, 2);
    const returnStatement = createReturn(emaCall, 24, 38, 2);
    const body = createBlock([returnStatement], 20, 38, 2, 2);
    const calcFunction = createFunctionDeclaration(createIdentifier('calc', 12, 2), [], body, 12, 39, 2, 2);

    const methodCall = createCallExpression(
      createMemberExpression(createIdentifier('series', 0, 5), createIdentifier('calc', 7, 5), 0, 11, 5),
      [],
      0,
      12,
      5,
    );
    const expressionStatement = createExpressionStatement(methodCall, 0, 12, 5);

    const program = createProgram([calcFunction, expressionStatement], 0, 39, 2, 5);
    const source = 'calc() => ta.ema(close)\nseries.calc()';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new LazyEvaluationHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-LAZY-EVAL-METHOD');
  });

  it('warns about expensive historical calculations inside loops when performance analysis is enabled', () => {
    const taIdentifier = createIdentifier('ta', 12, 3);
    const corrIdentifier = createIdentifier('correlation', 15, 3);
    const corrCallee = createMemberExpression(taIdentifier, corrIdentifier, 12, 28, 3);
    const firstArg = createArgument(createIdentifier('close', 29, 3), 29, 34, 3);
    const secondArg = createArgument(createIdentifier('open', 36, 3), 36, 40, 3);
    const thirdArg = createArgument(createNumberLiteral(15, '15', 42, 3), 42, 44, 3);
    const corrCall = createCallExpression(corrCallee, [firstArg, secondArg, thirdArg], 12, 45, 3);
    const loopBody = createBlock([createExpressionStatement(corrCall, 12, 45, 3)], 8, 45, 3, 3);
    const loop = createForStatement(null, null, null, loopBody, 0, 45, 2);
    const program = createProgram([loop], 0, 45, 2, 3);

    const source = 'for i = 0 to 10\n    ta.correlation(close, open, 15)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new LazyEvaluationHarness(service, { enablePerformanceAnalysis: true });

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-LAZY-EVAL-LOOP');
    expect(warningCodes).toContain('PSV6-LAZY-EVAL-PERFORMANCE');
  });
});
