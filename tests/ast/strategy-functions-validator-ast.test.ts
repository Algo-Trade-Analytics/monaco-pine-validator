import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { StrategyFunctionsValidator } from '../../modules/strategy-functions-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createBlock,
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

class StrategyValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new StrategyFunctionsValidator());
  }

  protected runCoreValidation(): void {}
}

class StrategyValidatorDisabledHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new StrategyFunctionsValidator());
  }

  protected runCoreValidation(): void {}
}

describe('StrategyFunctionsValidator (AST)', () => {
  it('reports unknown strategy members', () => {
    const strategyIdentifier = createIdentifier('strategy', 0, 1);
    const unknownIdentifier = createIdentifier('unknown', 9, 1);
    const callee = createMemberExpression(strategyIdentifier, unknownIdentifier, 0, 17, 1);
    const call = createCallExpression(callee, [], 0, 19, 1);
    const statement = createExpressionStatement(call, 0, 19, 1);
    const program = createProgram([statement], 0, 19, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new StrategyValidatorHarness(service);

    const result = harness.validate('strategy.unknown()');
    const codes = result.warnings.map((warning) => warning.code);

    expect(codes).toContain('PSV6-STRATEGY-FUNCTION-UNKNOWN');
  });

  it('enforces advanced strategy helper guidance', () => {
    const strategyIdentifier = createIdentifier('strategy', 0, 1);
    const percentIdentifier = createIdentifier('percent_of_equity', 9, 1);
    const callee = createMemberExpression(strategyIdentifier, percentIdentifier, 0, 26, 1);
    const call = createCallExpression(callee, [], 0, 28, 1);
    const statement = createExpressionStatement(call, 0, 28, 1);
    const program = createProgram([statement], 0, 28, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new StrategyValidatorHarness(service);

    const result = harness.validate('strategy.percent_of_equity()');
    const codes = result.errors.map((error) => error.code);

    expect(codes).toContain('PSV6-STRATEGY-CONSTANT-AS-FUNCTION');
  });

  it('flags loop usage and nested strategy references', () => {
    const loopInitializerIdentifier = createIdentifier('i', 5, 1);
    const loopInitializer = createVariableDeclaration(loopInitializerIdentifier, 0, 6, 1, {
      initializer: createNumberLiteral(0, '0', 8, 1),
    });

    const strategyIdentifier = createIdentifier('strategy', 4, 2);
    const entryIdentifier = createIdentifier('entry', 13, 2);
    const callee = createMemberExpression(strategyIdentifier, entryIdentifier, 4, 20, 2);

    const idArgumentValue = createStringLiteral('Long', '"Long"', 21, 2);
    const idArgument = createArgument(idArgumentValue, 21, 27, 2);

    const directionObject = createIdentifier('strategy', 29, 2);
    const directionProperty = createIdentifier('long', 38, 2);
    const directionValue = createMemberExpression(directionObject, directionProperty, 29, 43, 2);
    const directionArgument = createArgument(directionValue, 29, 43, 2);

    const qtyObject = createIdentifier('strategy', 45, 2);
    const qtyProperty = createIdentifier('position_size', 54, 2);
    const qtyValue = createMemberExpression(qtyObject, qtyProperty, 45, 69, 2);
    const qtyArgument = createArgument(qtyValue, 45, 69, 2, 'qty');

    const call = createCallExpression(callee, [idArgument, directionArgument, qtyArgument], 4, 70, 2);
    const statement = createExpressionStatement(call, 4, 70, 2);
    const body = createBlock([statement], 4, 70, 2, 2);
    const loop = createForStatement(loopInitializer, null, null, body, 0, 70, 1);
    const program = createProgram([loop], 0, 70, 1, 2);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new StrategyValidatorHarness(service);

    const source = 'for i = 0 to 1\n    strategy.entry("Long", strategy.long, qty=strategy.position_size)';
    const result = harness.validate(source);

    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-STRATEGY-PERF-LOOP');
    expect(warningCodes).toContain('PSV6-STRATEGY-PERF-NESTED');
  });

  it('returns no diagnostics when AST mode is disabled', () => {
    const harness = new StrategyValidatorDisabledHarness();

    const result = harness.validate('strategy.entry("Long", strategy.long)');

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });
});
