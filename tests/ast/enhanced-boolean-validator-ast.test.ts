import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { EnhancedBooleanValidator } from '../../modules/enhanced-boolean-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createBinaryExpression,
  createBooleanLiteral,
  createCallExpression,
  createExpressionStatement,
  createIdentifier,
  createIfStatement,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createTypeReference,
  createVariableDeclaration,
} from './fixtures';

class EnhancedBooleanHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service }, enablePerformanceAnalysis: true });
    this.registerModule(new EnhancedBooleanValidator());
  }

  protected runCoreValidation(): void {}
}

const createNoopStatement = (line: number) =>
  createExpressionStatement(createIdentifier('noop', 0, line), 0, 4, line);

describe('EnhancedBooleanValidator (AST)', () => {
  it('emits PSV6-MIG-BOOL for literal conditions', () => {
    const literalTest = createNumberLiteral(1, '1', 4, 2);
    const statement = createIfStatement(literalTest, createNoopStatement(2), null, 0, 6, 2);
    const program = createProgram([statement], 0, 6, 1, 2);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedBooleanHarness(service);

    const source = ['if (1)', '    noop'].join('\n');
    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-MIG-BOOL');
  });

  it('accepts boolean identifiers in if conditions', () => {
    const boolIdentifier = createIdentifier('condition', 4, 1);
    const boolDeclaration = createVariableDeclaration(createIdentifier('condition', 0, 1), 0, 20, 1, {
      typeAnnotation: createTypeReference('bool', 0, 1),
      initializer: createBooleanLiteral(true, 14, 1),
    });
    const statement = createIfStatement(boolIdentifier, createNoopStatement(2), null, 0, 8, 2);
    const program = createProgram([boolDeclaration, statement], 0, 20, 1, 2);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedBooleanHarness(service);

    const source = ['bool condition = true', 'if condition', '    noop'].join('\n');
    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).not.toContain('PSV6-FUNCTION-NAMESPACE');
  });

  it('emits PSV6-FUNCTION-NAMESPACE for non-boolean identifiers', () => {
    const intDeclaration = createVariableDeclaration(createIdentifier('value', 0, 1), 0, 16, 1, {
      typeAnnotation: createTypeReference('int', 0, 1),
      initializer: createNumberLiteral(10, '10', 12, 1),
    });
    const statement = createIfStatement(createIdentifier('value', 4, 2), createNoopStatement(2), null, 0, 8, 2);
    const program = createProgram([intDeclaration, statement], 0, 16, 1, 2);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedBooleanHarness(service);

    const source = ['int value = 10', 'if value', '    noop'].join('\n');
    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-FUNCTION-NAMESPACE');
  });

  it('warns when expensive clauses precede cheap ones in AND chains', () => {
    const taIdentifier = createIdentifier('ta', 0, 1);
    const rsiIdentifier = createIdentifier('rsi', 3, 1);
    const rsiMember = createMemberExpression(taIdentifier, rsiIdentifier, 0, 7, 1);
    const closeIdentifier = createIdentifier('close', 8, 1);
    const lengthLiteral = createNumberLiteral(14, '14', 14, 1);
    const rsiCall = createCallExpression(
      rsiMember,
      [createArgument(closeIdentifier, 8, 13, 1), createArgument(lengthLiteral, 14, 16, 1)],
      0,
      16,
      1,
    );

    const comparison = createBinaryExpression('>', createIdentifier('close', 18, 1), createIdentifier('open', 26, 1), 18, 30, 1);
    const test = createBinaryExpression('and', rsiCall, comparison, 0, 30, 1);
    const statement = createIfStatement(test, createNoopStatement(2), null, 0, 32, 2);
    const program = createProgram([statement], 0, 32, 1, 2);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedBooleanHarness(service);

    const source = ['if ta.rsi(close, 14) and close > open', '    noop'].join('\n');
    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-BOOL-AND-ORDER');
  });

  it('warns for repeated expensive clauses and constant false OR prefixes', () => {
    const taIdentifier = createIdentifier('ta', 0, 1);
    const rsiIdentifier = createIdentifier('rsi', 3, 1);
    const stdevIdentifier = createIdentifier('stdev', 3, 2);
    const rsiMember = createMemberExpression(taIdentifier, rsiIdentifier, 0, 7, 1);
    const stdevMember = createMemberExpression(createIdentifier('ta', 0, 2), stdevIdentifier, 0, 8, 2);

    const closeArg = createArgument(createIdentifier('close', 8, 1), 8, 13, 1);
    const lengthArg = createArgument(createNumberLiteral(14, '14', 14, 1), 14, 16, 1);
    const rsiCallAnd = createCallExpression(rsiMember, [closeArg, lengthArg], 0, 16, 1);

    const stdevFirstArg = createArgument(createIdentifier('close', 8, 2), 8, 13, 2);
    const stdevSecondArg = createArgument(createNumberLiteral(10, '10', 14, 2), 14, 16, 2);
    const stdevCall = createCallExpression(stdevMember, [stdevFirstArg, stdevSecondArg], 0, 16, 2);

    const andTest = createBinaryExpression('and', rsiCallAnd, stdevCall, 0, 16, 2);
    const andStatement = createIfStatement(andTest, createNoopStatement(3), null, 0, 18, 3);

    const rsiMemberOr = createMemberExpression(createIdentifier('ta', 0, 4), createIdentifier('rsi', 3, 4), 0, 7, 4);
    const rsiCallOr = createCallExpression(
      rsiMemberOr,
      [
        createArgument(createIdentifier('close', 8, 4), 8, 13, 4),
        createArgument(createNumberLiteral(14, '14', 14, 4), 14, 16, 4),
      ],
      0,
      16,
      4,
    );

    const orTest = createBinaryExpression('or', createBooleanLiteral(false, 0, 4), rsiCallOr, 0, 16, 4);
    const orStatement = createIfStatement(orTest, createNoopStatement(5), null, 0, 18, 5);

    const program = createProgram([andStatement, orStatement], 0, 18, 1, 5);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedBooleanHarness(service);

    const source = [
      'if ta.rsi(close, 14) and ta.stdev(close, 10)',
      '    noop',
      'if false or ta.rsi(close, 14)',
      '    noop',
    ].join('\n');
    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-BOOL-EXPENSIVE-CHAIN');
    expect(warningCodes).toContain('PSV6-BOOL-OR-CONSTANT');
  });
});
