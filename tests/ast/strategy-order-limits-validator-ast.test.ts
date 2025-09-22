import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { StrategyOrderLimitsValidator } from '../../modules/strategy-order-limits-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createBlock,
  createCallExpression,
  createExpressionStatement,
  createForStatement,
  createIdentifier,
  createIfStatement,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createScriptDeclaration,
  createStringLiteral,
  createUnaryExpression,
  createVersionDirective,
  createBinaryExpression,
  createVariableDeclaration,
} from './fixtures';

class StrategyOrderLimitsHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service }, enablePerformanceAnalysis: true });
    this.registerModule(new StrategyOrderLimitsValidator());
  }

  protected runCoreValidation(): void {
    this.context.scriptType = 'strategy';
    this.scriptType = 'strategy';
  }
}

describe('StrategyOrderLimitsValidator (AST)', () => {
  it('flags invalid order quantities from AST traversal', () => {
    const version = createVersionDirective(6, 0, 12, 1);
    const titleValue = createStringLiteral('Demo', '"Demo"', 10, 2);
    const titleArgument = createArgument(titleValue, 9, 16, 2);
    const scriptDeclaration = createScriptDeclaration('strategy', null, [titleArgument], 0, 24, 2);

    const strategyIdentifier = createIdentifier('strategy', 0, 3);
    const entryIdentifier = createIdentifier('entry', 9, 3);
    const callee = createMemberExpression(strategyIdentifier, entryIdentifier, 0, 14, 3);

    const idValue = createStringLiteral('Long', '"Long"', 15, 3);
    const idArgument = createArgument(idValue, 15, 21, 3);

    const directionObject = createIdentifier('strategy', 22, 3);
    const directionProperty = createIdentifier('long', 31, 3);
    const directionValue = createMemberExpression(directionObject, directionProperty, 22, 35, 3);
    const directionArgument = createArgument(directionValue, 22, 35, 3);

    const qtyValue = createUnaryExpression('-', createNumberLiteral(1, '1', 41, 3), 40, 42, 3);
    const qtyArgument = createArgument(qtyValue, 36, 42, 3, 'qty');

    const orderCall = createCallExpression(callee, [idArgument, directionArgument, qtyArgument], 0, 43, 3);
    const orderStatement = createExpressionStatement(orderCall, 0, 43, 3);

    const program = createProgram([scriptDeclaration, orderStatement], 0, 43, 1, 3, [version]);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new StrategyOrderLimitsHarness(service);

    const source = ['//@version=6', 'strategy("Demo")', 'strategy.entry("Long",strategy.long,qty=-1)'].join('\n');
    const result = harness.validate(source);
    const errorCodes = result.errors.map(error => error.code);

    expect(errorCodes).toContain('PSV6-STRATEGY-INVALID-PARAM');
  });

  it('emits loop warnings when orders execute inside loops', () => {
    const version = createVersionDirective(6, 0, 12, 1);
    const scriptDeclaration = createScriptDeclaration('strategy', null, [], 0, 15, 2);

    const strategyIdentifier = createIdentifier('strategy', 4, 3);
    const entryIdentifier = createIdentifier('entry', 13, 3);
    const callee = createMemberExpression(strategyIdentifier, entryIdentifier, 4, 18, 3);

    const idValue = createStringLiteral('L', '"L"', 19, 3);
    const idArgument = createArgument(idValue, 19, 22, 3);
    const directionArgument = createArgument(createIdentifier('cond', 23, 3), 23, 27, 3);

    const call = createCallExpression(callee, [idArgument, directionArgument], 4, 28, 3);
    const callStatement = createExpressionStatement(call, 4, 28, 3);
    const loopBody = createBlock([callStatement], 4, 28, 3, 3);

    const loopInitializer = createVariableDeclaration(createIdentifier('i', 8, 3), 4, 9, 3, {
      initializer: createNumberLiteral(0, '0', 12, 3),
    });
    const loop = createForStatement(loopInitializer, null, null, loopBody, 0, 28, 3);

    const program = createProgram([scriptDeclaration, loop], 0, 28, 1, 3, [version]);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new StrategyOrderLimitsHarness(service);

    const source = ['//@version=6', 'strategy("Demo")', 'for i = 0 to 1', '    strategy.entry("L",cond)'].join('\n');
    const result = harness.validate(source);
    const warningCodes = result.warnings.map(warning => warning.code);

    expect(warningCodes).toContain('PSV6-STRATEGY-ORDER-LOOP');
  });

  it('detects expensive conditions in conditional orders', () => {
    const version = createVersionDirective(6, 0, 12, 1);
    const scriptDeclaration = createScriptDeclaration('strategy', null, [], 0, 15, 2);

    const taIdentifier = createIdentifier('ta', 3, 3);
    const smaIdentifier = createIdentifier('sma', 6, 3);
    const smaCallee = createMemberExpression(taIdentifier, smaIdentifier, 3, 9, 3);
    const smaArgument = createArgument(createIdentifier('close', 10, 3), 10, 15, 3);
    const smaLength = createArgument(createNumberLiteral(14, '14', 16, 3), 16, 18, 3);
    const smaCall = createCallExpression(smaCallee, [smaArgument, smaLength], 3, 19, 3);
    const condition = createBinaryExpression('>', smaCall, createNumberLiteral(0, '0', 22, 3), 3, 23, 3);

    const strategyIdentifier = createIdentifier('strategy', 8, 4);
    const entryIdentifier = createIdentifier('entry', 17, 4);
    const callee = createMemberExpression(strategyIdentifier, entryIdentifier, 8, 23, 4);
    const idArgument = createArgument(createStringLiteral('L', '"L"', 24, 4), 24, 27, 4);
    const dirArgument = createArgument(createIdentifier('cond', 28, 4), 28, 32, 4);
    const orderCall = createCallExpression(callee, [idArgument, dirArgument], 8, 33, 4);
    const orderStatement = createExpressionStatement(orderCall, 8, 33, 4);

    const ifBody = createBlock([orderStatement], 8, 33, 4, 4);
    const ifStatement = createIfStatement(condition, ifBody, null, 0, 33, 3);

    const program = createProgram([scriptDeclaration, ifStatement], 0, 33, 1, 4, [version]);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new StrategyOrderLimitsHarness(service);

    const source = [
      '//@version=6',
      'strategy("Demo")',
      'if ta.sma(close,14) > 0',
      '    strategy.entry("L",cond)',
    ].join('\n');
    const result = harness.validate(source);
    const warningCodes = result.warnings.map(warning => warning.code);

    expect(warningCodes).toContain('PSV6-STRATEGY-EXPENSIVE-CONDITIONS');
  });

  it('warns on unconditional orders when multiple entries execute without guards', () => {
    const version = createVersionDirective(6, 0, 12, 1);
    const scriptDeclaration = createScriptDeclaration('strategy', null, [], 0, 15, 2);

    const strategyIdentifier = createIdentifier('strategy', 0, 3);
    const entryIdentifier = createIdentifier('entry', 9, 3);
    const callee = createMemberExpression(strategyIdentifier, entryIdentifier, 0, 14, 3);
    const idArgument = createArgument(createStringLiteral('A', '"A"', 15, 3), 15, 18, 3);
    const dirArgument = createArgument(createIdentifier('cond', 19, 3), 19, 23, 3);
    const firstCall = createCallExpression(callee, [idArgument, dirArgument], 0, 24, 3);
    const firstStatement = createExpressionStatement(firstCall, 0, 24, 3);

    const secondCallee = createMemberExpression(createIdentifier('strategy', 0, 4), createIdentifier('entry', 9, 4), 0, 14, 4);
    const secondId = createArgument(createStringLiteral('B', '"B"', 15, 4), 15, 18, 4);
    const secondDir = createArgument(createIdentifier('cond2', 19, 4), 19, 24, 4);
    const secondCall = createCallExpression(secondCallee, [secondId, secondDir], 0, 25, 4);
    const secondStatement = createExpressionStatement(secondCall, 0, 25, 4);

    const program = createProgram([scriptDeclaration, firstStatement, secondStatement], 0, 25, 1, 4, [version]);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new StrategyOrderLimitsHarness(service);

    const source = [
      '//@version=6',
      'strategy("Demo")',
      'strategy.entry("A",cond)',
      'strategy.entry("B",cond2)',
    ].join('\n');
    const result = harness.validate(source);
    const warningCodes = result.warnings.map(warning => warning.code);

    expect(warningCodes).toContain('PSV6-STRATEGY-UNCONDITIONAL-ORDER');
  });
});
