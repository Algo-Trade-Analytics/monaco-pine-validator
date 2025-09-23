import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { EnhancedStrategyValidator } from '../../modules/enhanced-strategy-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createCallExpression,
  createExpressionStatement,
  createIdentifier,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
  createUnaryExpression,
} from './fixtures';

class EnhancedStrategyHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service }, enableWarnings: true, enableInfo: true });
    this.registerModule(new EnhancedStrategyValidator());
  }

  protected runCoreValidation(): void {}
}

const createStrategyCall = (args: ReturnType<typeof createArgument>[], line = 1) => {
  const callee = createIdentifier('strategy', 0, line);
  return createCallExpression(callee, args, 0, 40, line);
};

const createStrategyMemberCall = (
  member: string,
  args: ReturnType<typeof createArgument>[],
  line: number,
) => {
  const namespace = createIdentifier('strategy', 0, line);
  const property = createIdentifier(member, 9, line);
  const callee = createMemberExpression(namespace, property, 0, 9 + member.length, line);
  return createCallExpression(callee, args, 0, 60, line);
};

const createProgramWithStatements = (statements: ReturnType<typeof createExpressionStatement>[]) => {
  const lastLine = statements.reduce((max, statement) => Math.max(max, statement.loc.end.line), 1);
  return createProgram(statements, 0, 120, 1, lastLine);
};

describe('EnhancedStrategyValidator (AST)', () => {
  it('warns when strategy call omits commission settings', () => {
    const nameArg = createArgument(
      createStringLiteral('My Strategy', '"My Strategy"', 9, 1),
      8,
      22,
      1,
    );
    const strategyCall = createStrategyCall([nameArg]);
    const program = createProgramWithStatements([createExpressionStatement(strategyCall, 0, 40, 1)]);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedStrategyHarness(service);

    const source = 'strategy("My Strategy")';
    const result = harness.validate(source);

    expect(result.warnings.map((warning) => warning.code)).toContain('PSV6-STRATEGY-REALISM');
  });

  it('does not warn when commission parameters are provided', () => {
    const nameArg = createArgument(
      createStringLiteral('My Strategy', '"My Strategy"', 9, 1),
      8,
      22,
      1,
    );
    const commissionArg = createArgument(
      createStringLiteral('cash_per_trade', '"cash_per_trade"', 26, 1),
      24,
      44,
      1,
      'commission_type',
    );
    const strategyCall = createStrategyCall([nameArg, commissionArg]);
    const program = createProgramWithStatements([createExpressionStatement(strategyCall, 0, 60, 1)]);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedStrategyHarness(service);

    const source = 'strategy("My Strategy", commission_type="cash_per_trade")';
    const result = harness.validate(source);

    expect(result.warnings.map((warning) => warning.code)).not.toContain('PSV6-STRATEGY-REALISM');
  });

  it('suggests adding risk management when no exit helpers are present', () => {
    const strategyCall = createStrategyCall([]);
    const program = createProgramWithStatements([createExpressionStatement(strategyCall, 0, 20, 1)]);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedStrategyHarness(service);

    const source = 'strategy("Example")';
    const result = harness.validate(source);

    expect(result.info.map((message) => message.code)).toContain('PSV6-STRATEGY-RISK');
  });

  it('suppresses the risk suggestion when exits are defined', () => {
    const strategyCall = createStrategyCall([]);
    const exitArgs = [
      createArgument(createStringLiteral('E', '"E"', 12, 2), 11, 14, 2),
      createArgument(createStringLiteral('Entry', '"Entry"', 16, 2), 16, 23, 2),
    ];
    const exitCall = createStrategyMemberCall('exit', exitArgs, 2);
    const program = createProgramWithStatements([
      createExpressionStatement(strategyCall, 0, 20, 1),
      createExpressionStatement(exitCall, 0, 20, 2),
    ]);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedStrategyHarness(service);

    const source = ['strategy("Example")', 'strategy.exit("E", "Entry")'].join('\n');
    const result = harness.validate(source);

    expect(result.info.map((message) => message.code)).not.toContain('PSV6-STRATEGY-RISK');
  });

  it('warns on excessive position size for strategy.entry qty parameter', () => {
    const entryIdArg = createArgument(
      createStringLiteral('Long', '"Long"', 12, 2),
      11,
      18,
      2,
    );
    const qtyArg = createArgument(
      createNumberLiteral(200_000, '200000', 20, 2),
      20,
      26,
      2,
      'qty',
    );
    const entryCall = createStrategyMemberCall('entry', [entryIdArg, qtyArg], 2);
    const program = createProgramWithStatements([createExpressionStatement(entryCall, 0, 40, 2)]);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedStrategyHarness(service);

    const source = 'strategy.entry("Long", qty=200000)';
    const result = harness.validate(source);

    expect(result.warnings.map((warning) => warning.code)).toContain('PSV6-STRATEGY-POSITION-SIZE');
  });

  it('supports signed numeric literals when evaluating position size', () => {
    const entryIdArg = createArgument(
      createStringLiteral('Short', '"Short"', 12, 2),
      11,
      19,
      2,
    );
    const qtyArg = createArgument(
      createUnaryExpression('-', createNumberLiteral(150_000, '150000', 21, 2), 20, 27, 2),
      20,
      27,
      2,
      'qty',
    );
    const entryCall = createStrategyMemberCall('entry', [entryIdArg, qtyArg], 2);
    const program = createProgramWithStatements([createExpressionStatement(entryCall, 0, 45, 2)]);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedStrategyHarness(service);

    const source = 'strategy.entry("Short", qty=-150000)';
    const result = harness.validate(source);

    expect(result.warnings.map((warning) => warning.code)).not.toContain('PSV6-STRATEGY-POSITION-SIZE');
  });

  it('warns when entries exist without exits', () => {
    const strategyCall = createStrategyCall([]);
    const entryArg = createArgument(createStringLiteral('Long', '"Long"', 12, 2), 11, 18, 2);
    const entryCall = createStrategyMemberCall('entry', [entryArg], 2);
    const program = createProgramWithStatements([
      createExpressionStatement(strategyCall, 0, 20, 1),
      createExpressionStatement(entryCall, 0, 20, 2),
    ]);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedStrategyHarness(service);

    const source = ['strategy("Example")', 'strategy.entry("Long")'].join('\n');
    const result = harness.validate(source);

    expect(result.warnings.map((warning) => warning.code)).toContain('PSV6-STRATEGY-NO-EXIT');
  });

  it('suppresses exit warning when exit helpers are present', () => {
    const strategyCall = createStrategyCall([]);
    const entryArg = createArgument(createStringLiteral('Long', '"Long"', 12, 2), 11, 18, 2);
    const entryCall = createStrategyMemberCall('entry', [entryArg], 2);
    const exitArgs = [
      createArgument(createStringLiteral('Exit', '"Exit"', 12, 3), 11, 18, 3),
      createArgument(createStringLiteral('Long', '"Long"', 20, 3), 20, 26, 3),
    ];
    const exitCall = createStrategyMemberCall('exit', exitArgs, 3);
    const program = createProgramWithStatements([
      createExpressionStatement(strategyCall, 0, 20, 1),
      createExpressionStatement(entryCall, 0, 20, 2),
      createExpressionStatement(exitCall, 0, 20, 3),
    ]);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedStrategyHarness(service);

    const source = [
      'strategy("Example")',
      'strategy.entry("Long")',
      'strategy.exit("Exit", "Long")',
    ].join('\n');
    const result = harness.validate(source);

    expect(result.warnings.map((warning) => warning.code)).not.toContain('PSV6-STRATEGY-NO-EXIT');
  });
});
