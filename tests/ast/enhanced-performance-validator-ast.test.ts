import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { EnhancedPerformanceValidator } from '../../modules/enhanced-performance-validator';
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
  createIndexExpression,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
  createWhileStatement,
} from './fixtures';

class EnhancedPerformanceHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new EnhancedPerformanceValidator());
  }

  protected runCoreValidation(): void {}
}

class EnhancedPerformanceDisabledHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new EnhancedPerformanceValidator());
  }

  protected runCoreValidation(): void {}
}

describe('EnhancedPerformanceValidator (AST)', () => {
  it('flags expensive TA helpers executed inside nested loops', () => {
    const expensiveMember = createMemberExpression(
      createIdentifier('ta', 8, 3),
      createIdentifier('pivothigh', 11, 3),
      8,
      20,
      3,
    );
    const expensiveCall = createCallExpression(expensiveMember, [], 8, 22, 3);
    const innerStatement = createExpressionStatement(expensiveCall, 8, 22, 3);
    const innerBody = createBlock([innerStatement], 8, 22, 3, 3);
    const innerLoop = createForStatement(null, null, null, innerBody, 4, 22, 3);
    const outerBody = createBlock([innerLoop], 4, 22, 2, 3);
    const outerLoop = createForStatement(null, null, null, outerBody, 0, 22, 2);

    const program = createProgram([outerLoop], 0, 22, 1, 3);
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedPerformanceHarness(service);

    const result = harness.validate('for i = 0 to 1\n    for j = 0 to 1\n        ta.pivothigh()');
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-PERF-NESTED-TA');
  });

  it('warns about request.security lookahead usage discovered via AST traversal', () => {
    const requestMember = createMemberExpression(
      createIdentifier('request', 0, 1),
      createIdentifier('security', 8, 1),
      0,
      16,
      1,
    );
    const symbolArgument = createArgument(createStringLiteral('AAPL', '"AAPL"', 17, 1), 17, 23, 1);
    const lookaheadValue = createMemberExpression(
      createIdentifier('barmerge', 26, 1),
      createIdentifier('lookahead_on', 35, 1),
      26,
      48,
      1,
    );
    const lookaheadArgument = createArgument(lookaheadValue, 26, 48, 1, 'lookahead');
    const requestCall = createCallExpression(requestMember, [symbolArgument, lookaheadArgument], 0, 49, 1);
    const requestStatement = createExpressionStatement(requestCall, 0, 49, 1);

    const program = createProgram([requestStatement], 0, 49, 1, 1);
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedPerformanceHarness(service);

    const result = harness.validate('request.security("AAPL", lookahead=barmerge.lookahead_on)');
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-REPAINT-LOOKAHEAD');
    expect(warningCodes).toContain('PSV6-REPAINT-SECURITY');
  });

  it('suppresses repaint security warning when barstate.isconfirmed is present', () => {
    const requestMember = createMemberExpression(
      createIdentifier('request', 0, 1),
      createIdentifier('security', 8, 1),
      0,
      16,
      1,
    );
    const symbolArgument = createArgument(createStringLiteral('AAPL', '"AAPL"', 17, 1), 17, 23, 1);
    const requestCall = createCallExpression(requestMember, [symbolArgument], 0, 24, 1);
    const requestStatement = createExpressionStatement(requestCall, 0, 24, 1);

    const barstateMember = createMemberExpression(
      createIdentifier('barstate', 0, 2),
      createIdentifier('isconfirmed', 9, 2),
      0,
      21,
      2,
    );
    const barstateStatement = createExpressionStatement(barstateMember, 0, 21, 2);

    const program = createProgram([requestStatement, barstateStatement], 0, 24, 1, 2);
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedPerformanceHarness(service);

    const result = harness.validate('request.security("AAPL")\nbarstate.isconfirmed');
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).not.toContain('PSV6-REPAINT-SECURITY');
  });

  it('raises PSV6-FUTURE-DATA when negative history indexes are encountered', () => {
    const historyIndex = createIndexExpression(
      createIdentifier('close', 0, 1),
      createNumberLiteral(-1, '-1', 6, 1),
      0,
      9,
      1,
    );
    const statement = createExpressionStatement(historyIndex, 0, 9, 1);

    const program = createProgram([statement], 0, 9, 1, 1);
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedPerformanceHarness(service);

    const result = harness.validate('close[-1]');
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-FUTURE-DATA');
  });

  it('warns when multiple alert conditions are registered', () => {
    const firstAlert = createCallExpression(
      createIdentifier('alertcondition', 0, 1),
      [
        createArgument(createBooleanLiteral(true, 15, 1), 15, 19, 1),
        createArgument(createStringLiteral('first', '"first"', 21, 1), 21, 28, 1),
      ],
      0,
      28,
      1,
    );
    const secondAlert = createCallExpression(
      createIdentifier('alertcondition', 0, 2),
      [
        createArgument(createBooleanLiteral(true, 15, 2), 15, 19, 2),
        createArgument(createStringLiteral('second', '"second"', 21, 2), 21, 29, 2),
      ],
      0,
      29,
      2,
    );
    const firstStatement = createExpressionStatement(firstAlert, 0, 28, 1);
    const secondStatement = createExpressionStatement(secondAlert, 0, 29, 2);

    const program = createProgram([firstStatement, secondStatement], 0, 29, 1, 2);
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedPerformanceHarness(service);

    const result = harness.validate('alertcondition(true, "first")\nalertcondition(true, "second")');
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-PERF-ALERT-CONSOLIDATE');
  });

  it('flags higher timeframe usage inside request.security when unconfirmed', () => {
    const requestMember = createMemberExpression(
      createIdentifier('request', 0, 1),
      createIdentifier('security', 8, 1),
      0,
      16,
      1,
    );
    const symbolArgument = createArgument(createStringLiteral('AAPL', '"AAPL"', 17, 1), 17, 23, 1);
    const timeframeMember = createMemberExpression(
      createIdentifier('timeframe', 26, 1),
      createIdentifier('period', 35, 1),
      26,
      41,
      1,
    );
    const timeframeArgument = createArgument(timeframeMember, 26, 41, 1, 'timeframe');
    const requestCall = createCallExpression(requestMember, [symbolArgument, timeframeArgument], 0, 42, 1);
    const statement = createExpressionStatement(requestCall, 0, 42, 1);

    const program = createProgram([statement], 0, 42, 1, 1);
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedPerformanceHarness(service);

    const result = harness.validate('request.security("AAPL", timeframe=timeframe.period)');
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-REPAINT-HTF');
  });

  it('handles expensive functions encountered inside nested while loops', () => {
    const expensiveMember = createIdentifier('pivothigh', 8, 3);
    const expensiveCall = createCallExpression(expensiveMember, [], 8, 18, 3);
    const expensiveStatement = createExpressionStatement(expensiveCall, 8, 18, 3);
    const innerBody = createBlock([expensiveStatement], 8, 18, 3, 3);
    const innerLoop = createWhileStatement(createBooleanLiteral(true, 6, 3), innerBody, 4, 18, 3);
    const outerBody = createBlock([innerLoop], 4, 18, 2, 3);
    const outerLoop = createWhileStatement(createBooleanLiteral(true, 6, 2), outerBody, 0, 18, 2);

    const program = createProgram([outerLoop], 0, 18, 1, 3);
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedPerformanceHarness(service);

    const result = harness.validate('while true\n    while true\n        pivothigh()');
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-PERF-NESTED-TA');
  });

  it('returns no diagnostics when AST mode is disabled', () => {
    const harness = new EnhancedPerformanceDisabledHarness();

    const result = harness.validate('request.security("AAPL")');

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });
});
