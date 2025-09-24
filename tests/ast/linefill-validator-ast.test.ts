import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { LinefillValidator } from '../../modules/linefill-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createBlock,
  createCallExpression,
  createExpressionStatement,
  createIdentifier,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createVariableDeclaration,
  createWhileStatement,
} from './fixtures';

class LinefillValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new LinefillValidator());
  }

  protected runCoreValidation(): void {}
}

class DisabledLinefillValidatorHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new LinefillValidator());
  }

  protected runCoreValidation(): void {}
}

describe('LinefillValidator (AST)', () => {
  it('returns no diagnostics when AST mode is disabled', () => {
    const harness = new DisabledLinefillValidatorHarness();
    const result = harness.validate('linefill.new(line1, line2)');

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
    expect(result.isValid).toBe(true);
  });

  it('emits parameter count diagnostics for linefill.new', () => {
    const source = 'linefill.new(line1)';
    const namespace = createIdentifier('linefill', source.indexOf('linefill'), 1);
    const method = createIdentifier('new', source.indexOf('new'), 1);
    const callee = createMemberExpression(
      namespace,
      method,
      source.indexOf('linefill'),
      source.indexOf('new') + 'new'.length,
      1,
    );

    const lineArg = createIdentifier('line1', source.indexOf('line1'), 1);
    const argument = createArgument(
      lineArg,
      source.indexOf('line1'),
      source.indexOf('line1') + 'line1'.length,
      1,
    );

    const call = createCallExpression(callee, [argument], 0, source.length, 1);
    const statement = createExpressionStatement(call, 0, source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new LinefillValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-FUNCTION-PARAM-COUNT');
  });

  it('validates line arguments for linefill.new', () => {
    const source = 'linefill.new(1, 2)';
    const namespace = createIdentifier('linefill', source.indexOf('linefill'), 1);
    const method = createIdentifier('new', source.indexOf('new'), 1);
    const callee = createMemberExpression(
      namespace,
      method,
      source.indexOf('linefill'),
      source.indexOf('new') + 'new'.length,
      1,
    );

    const firstValue = createNumberLiteral(1, '1', source.indexOf('1'), 1);
    const firstArg = createArgument(firstValue, source.indexOf('1'), source.indexOf('1') + 1, 1);
    const secondValue = createNumberLiteral(2, '2', source.lastIndexOf('2'), 1);
    const secondArg = createArgument(secondValue, source.lastIndexOf('2'), source.lastIndexOf('2') + 1, 1);

    const call = createCallExpression(callee, [firstArg, secondArg], 0, source.length, 1);
    const statement = createExpressionStatement(call, 0, source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new LinefillValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-FUNCTION-PARAM-TYPE');
  });

  it('warns when linefill operations occur inside loops', () => {
    const source = 'while condition\n    linefill.new(line1, line2)';
    const condition = createIdentifier('condition', source.indexOf('condition'), 1);

    const namespace = createIdentifier('linefill', source.indexOf('linefill'), 2);
    const method = createIdentifier('new', source.indexOf('new'), 2);
    const callee = createMemberExpression(
      namespace,
      method,
      source.indexOf('linefill'),
      source.indexOf('new') + 'new'.length,
      2,
    );

    const firstLineArg = createIdentifier('line1', source.indexOf('line1'), 2);
    const firstArgument = createArgument(
      firstLineArg,
      source.indexOf('line1'),
      source.indexOf('line1') + 'line1'.length,
      2,
    );
    const secondLineArg = createIdentifier('line2', source.lastIndexOf('line2'), 2);
    const secondArgument = createArgument(
      secondLineArg,
      source.lastIndexOf('line2'),
      source.lastIndexOf('line2') + 'line2'.length,
      2,
    );

    const call = createCallExpression(
      callee,
      [firstArgument, secondArgument],
      source.indexOf('linefill'),
      source.length,
      2,
    );
    const statement = createExpressionStatement(call, source.indexOf('linefill'), source.length, 2);
    const block = createBlock([statement], source.indexOf('    '), source.length, 2, 2);
    const loop = createWhileStatement(condition, block, 0, source.length, 1);
    const program = createProgram([loop], 0, source.length, 1, 2);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new LinefillValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-LINEFILL-PERF-LOOP');
  });

  it('registers linefill identifiers assigned in the AST path', () => {
    const source = 'var fill = linefill.new(line1, line2)';

    const namespace = createIdentifier('linefill', source.indexOf('linefill'), 1);
    const method = createIdentifier('new', source.indexOf('new'), 1);
    const callee = createMemberExpression(
      namespace,
      method,
      source.indexOf('linefill'),
      source.indexOf('new') + 'new'.length,
      1,
    );

    const line1Identifier = createIdentifier('line1', source.indexOf('line1'), 1);
    const line1Argument = createArgument(
      line1Identifier,
      source.indexOf('line1'),
      source.indexOf('line1') + 'line1'.length,
      1,
    );
    const line2Identifier = createIdentifier('line2', source.lastIndexOf('line2'), 1);
    const line2Argument = createArgument(
      line2Identifier,
      source.lastIndexOf('line2'),
      source.lastIndexOf('line2') + 'line2'.length,
      1,
    );

    const call = createCallExpression(
      callee,
      [line1Argument, line2Argument],
      source.indexOf('linefill'),
      source.length,
      1,
    );

    const fillIdentifier = createIdentifier('fill', source.indexOf('fill'), 1);
    const declaration = createVariableDeclaration(fillIdentifier, 0, source.length, 1, {
      declarationKind: 'var',
      initializer: call,
    });
    const program = createProgram([declaration], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new LinefillValidatorHarness(service);

    const result = harness.validate(source);

    expect(result.typeMap.get('fill')?.type).toBe('linefill');
  });
});
