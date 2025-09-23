import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { EnhancedResourceValidator } from '../../modules/enhanced-resource-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createAssignmentStatement,
  createBinaryExpression,
  createBlock,
  createCallExpression,
  createExpressionStatement,
  createForStatement,
  createIdentifier,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createVariableDeclaration,
} from './fixtures';

class EnhancedResourceValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new EnhancedResourceValidator());
  }

  protected runCoreValidation(): void {}
}

describe('EnhancedResourceValidator (AST)', () => {
  it('reports large array allocations and var thresholds from AST traversal', () => {
    const arrayNamespace = createIdentifier('array', 9, 1);
    const newFloatProperty = createIdentifier('new_float', 15, 1);
    const arrayConstructor = createMemberExpression(arrayNamespace, newFloatProperty, 9, 23, 1);
    const sizeArgument = createArgument(createNumberLiteral(60000, '60000', 24, 1), 24, 30, 1);
    const arrayCall = createCallExpression(arrayConstructor, [sizeArgument], 9, 31, 1);
    const declaration = createVariableDeclaration(createIdentifier('huge', 4, 1), 0, 31, 1, {
      declarationKind: 'var',
      initializer: arrayCall,
    });

    const program = createProgram([declaration], 0, 31, 1, 1);
    const source = 'var huge = array.new_float(60000)';
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));
    const harness = new EnhancedResourceValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(errorCodes).toContain('PSV6-ENUM-UNDEFINED-TYPE');
    expect(warningCodes).toEqual(
      expect.arrayContaining(['PSV6-MEMORY-ARRAYS', 'PSV6-MEMORY-LARGE-COLLECTION']),
    );
  });

  it('warns about nested loops with large bounds when using AST traversal', () => {
    const outerInit = createAssignmentStatement(
      createIdentifier('i', 4, 1),
      createNumberLiteral(0, '0', 8, 1),
      4,
      8,
      1,
    );
    const outerTest = createBinaryExpression(
      '<=',
      createIdentifier('i', 4, 1),
      createNumberLiteral(10, '10', 16, 1),
      4,
      16,
      1,
    );
    const outerUpdate = createBinaryExpression(
      '+',
      createIdentifier('i', 4, 1),
      createNumberLiteral(1, '1', 16, 1),
      4,
      18,
      1,
    );

    const innerInit = createAssignmentStatement(
      createIdentifier('j', 8, 2),
      createNumberLiteral(0, '0', 12, 2),
      8,
      12,
      2,
    );
    const innerTest = createBinaryExpression(
      '<=',
      createIdentifier('j', 8, 2),
      createNumberLiteral(1500, '1500', 20, 2),
      8,
      23,
      2,
    );
    const innerUpdate = createBinaryExpression(
      '+',
      createIdentifier('j', 8, 2),
      createNumberLiteral(1, '1', 18, 2),
      8,
      20,
      2,
    );
    const innerBody = createBlock(
      [createExpressionStatement(createIdentifier('noop', 12, 3), 12, 16, 3)],
      12,
      16,
      3,
      3,
    );
    const innerLoop = createForStatement(innerInit, innerTest, innerUpdate, innerBody, 8, 23, 2);

    const outerBody = createBlock([innerLoop], 8, 23, 2, 3);
    const outerLoop = createForStatement(outerInit, outerTest, outerUpdate, outerBody, 0, 23, 1);

    const program = createProgram([outerLoop], 0, 23, 1, 3);
    const source = ['for i = 0 to 10', '    for j = 0 to 1500', '        noop'].join('\n');
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));
    const harness = new EnhancedResourceValidatorHarness(service);

    const result = harness.validate(source);
    const nestedWarnings = result.warnings.filter((warning) => warning.code === 'PSV6-PERF-NESTED-LOOPS');

    expect(nestedWarnings.length).toBeGreaterThan(0);
  });

  it('flags conditional complexity in loop bounds', () => {
    const initializer = createAssignmentStatement(
      createIdentifier('idx', 4, 1),
      createNumberLiteral(0, '0', 12, 1),
      4,
      12,
      1,
    );
    const simpleComparison = createBinaryExpression(
      '<',
      createIdentifier('idx', 4, 1),
      createNumberLiteral(5, '5', 18, 1),
      4,
      18,
      1,
    );
    const complexTest = createBinaryExpression(
      '&&',
      simpleComparison,
      createIdentifier('ready', 22, 1),
      4,
      27,
      1,
    );
    const update = createBinaryExpression(
      '+',
      createIdentifier('idx', 4, 1),
      createNumberLiteral(1, '1', 22, 1),
      4,
      24,
      1,
    );
    const body = createBlock(
      [createExpressionStatement(createIdentifier('noop', 8, 2), 8, 12, 2)],
      8,
      12,
      2,
      2,
    );
    const loop = createForStatement(initializer, complexTest, update, body, 0, 27, 1);

    const program = createProgram([loop], 0, 27, 1, 2);
    const source = ['for idx = 0 to 5', '    ready := ready'].join('\n');
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));
    const harness = new EnhancedResourceValidatorHarness(service);

    const result = harness.validate(source);
    const complexityWarnings = result.warnings.filter((warning) => warning.code === 'PSV6-PERF-NESTED-LOOPS');

    expect(complexityWarnings.length).toBeGreaterThan(0);
  });

  it('warns when array usage exceeds the AST threshold', () => {
    const statements = Array.from({ length: 11 }, (_, index) => {
      const line = index + 1;
      const arrayConstructor = createMemberExpression(
        createIdentifier('array', 0, line),
        createIdentifier('new_float', 6, line),
        0,
        14,
        line,
      );
      const argument = createArgument(createNumberLiteral(1, '1', 15, line), 15, 16, line);
      const arrayCall = createCallExpression(arrayConstructor, [argument], 0, 17, line);
      return createExpressionStatement(arrayCall, 0, 17, line);
    });

    const program = createProgram(statements, 0, 17, 1, 11);
    const source = Array(11).fill('array.new_float(1)').join('\n');
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));
    const harness = new EnhancedResourceValidatorHarness(service);

    const result = harness.validate(source);
    const excessiveUsage = result.warnings.find((warning) =>
      warning.code === 'PSV6-MEMORY-ARRAYS' && warning.message.includes('Excessive array usage'),
    );

    expect(excessiveUsage).toBeTruthy();
  });
});
