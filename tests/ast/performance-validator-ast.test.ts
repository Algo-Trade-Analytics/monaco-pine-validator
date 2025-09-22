import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { PerformanceValidator } from '../../modules/performance-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createBlock,
  createBooleanLiteral,
  createCallExpression,
  createExpressionStatement,
  createForStatement,
  createIdentifier,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
  createVariableDeclaration,
} from './fixtures';

class PerformanceValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service }, enablePerformanceAnalysis: true });
    this.registerModule(new PerformanceValidator());
  }

  protected runCoreValidation(): void {}
}

describe('PerformanceValidator (AST)', () => {
  it('warns about large array allocations from AST traversal', () => {
    const arrayNamespace = createIdentifier('array', 12, 1);
    const newFloatProperty = createIdentifier('new_float', 18, 1);
    const arrayNewFloat = createMemberExpression(arrayNamespace, newFloatProperty, 12, 27, 1);
    const sizeArgument = createArgument(createNumberLiteral(20000, '20000', 28, 1), 28, 33, 1);
    const arrayCall = createCallExpression(arrayNewFloat, [sizeArgument], 12, 34, 1);
    const declaration = createVariableDeclaration(createIdentifier('arr', 4, 1), 0, 34, 1, {
      declarationKind: 'var',
      initializer: arrayCall,
    });

    const program = createProgram([declaration], 0, 34, 1, 1);
    const source = 'var arr = array.new_float(20000)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new PerformanceValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-MEMORY-LARGE-ARRAY');
  });

  it('reports nested loops using AST-derived structure', () => {
    const innerBody = createBlock(
      [createExpressionStatement(createIdentifier('noop', 12, 3), 12, 16, 3)],
      8,
      16,
      3,
      3,
    );
    const innerLoop = createForStatement(null, null, null, innerBody, 8, 16, 3);
    const outerBody = createBlock([innerLoop], 4, 16, 2, 3);
    const outerLoop = createForStatement(null, null, null, outerBody, 0, 16, 2);

    const program = createProgram([outerLoop], 0, 16, 1, 3);
    const source = 'for i = 0 to 1\n    for j = 0 to 1\n        noop';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new PerformanceValidatorHarness(service);

    const result = harness.validate(source);
    const nestedWarnings = result.warnings.filter((warning) => warning.code === 'PSV6-PERF-NESTED-LOOPS');

    expect(nestedWarnings.length).toBeGreaterThan(0);
  });

  it('flags expensive ta functions executed inside loops', () => {
    const taNamespace = createIdentifier('ta', 8, 3);
    const linregProperty = createIdentifier('linreg', 11, 3);
    const linregCallee = createMemberExpression(taNamespace, linregProperty, 8, 17, 3);
    const linregCall = createCallExpression(linregCallee, [], 8, 19, 3);
    const linregStatement = createExpressionStatement(linregCall, 8, 19, 3);
    const loopBody = createBlock([linregStatement], 8, 19, 3, 3);
    const loop = createForStatement(null, null, null, loopBody, 0, 19, 2);

    const program = createProgram([loop], 0, 19, 1, 3);
    const source = 'for i = 0 to 1\n    ta.linreg()';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new PerformanceValidatorHarness(service);

    const result = harness.validate(source);
    const expensiveInLoop = result.errors.find((error) => error.code === 'PSV6-PERF-EXPENSIVE-IN-LOOP');

    expect(expensiveInLoop).toBeTruthy();
    expect(expensiveInLoop?.severity).toBe('error');
  });

  it('enforces alert consolidation guidance based on AST counts', () => {
    const alertIdentifier = createIdentifier('alertcondition', 0, 1);
    const firstCondition = createCallExpression(
      alertIdentifier,
      [
        createArgument(createBooleanLiteral(true, 15, 1), 15, 19, 1),
        createArgument(createStringLiteral('first', '"first"', 21, 1), 21, 28, 1),
      ],
      0,
      28,
      1,
    );
    const secondCondition = createCallExpression(
      createIdentifier('alertcondition', 0, 2),
      [
        createArgument(createBooleanLiteral(true, 15, 2), 15, 19, 2),
        createArgument(createStringLiteral('second', '"second"', 21, 2), 21, 29, 2),
      ],
      0,
      29,
      2,
    );

    const firstStatement = createExpressionStatement(firstCondition, 0, 28, 1);
    const secondStatement = createExpressionStatement(secondCondition, 0, 29, 2);
    const program = createProgram([firstStatement, secondStatement], 0, 29, 1, 2);
    const source = 'alertcondition(true, "first")\nalertcondition(true, "second")';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new PerformanceValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-PERF-ALERT-CONSOLIDATE');
  });
});
