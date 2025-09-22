import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { FinalConstantsValidator } from '../../modules/final-constants-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import { Codes } from '../../core/codes';
import type { ExpressionNode } from '../../core/ast/nodes';
import {
  createExpressionStatement,
  createIdentifier,
  createMemberExpression,
  createProgram,
} from './fixtures';

class FinalConstantsValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new FinalConstantsValidator());
  }

  protected runCoreValidation(): void {}
}

function createConstantExpression(constant: string, line: number): ExpressionNode {
  const parts = constant.split('.');
  let expression: ExpressionNode = createIdentifier(parts[0]!, 0, line);
  let currentLength = parts[0]!.length;

  for (let index = 1; index < parts.length; index++) {
    const part = parts[index]!;
    const partStart = currentLength + 1; // account for '.' separator
    const partEnd = partStart + part.length;
    const property = createIdentifier(part, partStart, line);
    expression = createMemberExpression(expression, property, 0, partEnd, line);
    currentLength = partEnd;
  }

  return expression;
}

describe('FinalConstantsValidator (AST)', () => {
  it('collects specialized constants from AST traversal', () => {
    const constants = [
      'math.pi',
      'plot.style_columns',
      'order.ascending',
      'position.bottom_right',
      'strategy.direction.long',
      'strategy.risk.max_daily_loss',
      'table.cell_merge_horizontal',
    ];
    const source = constants.join('\n');

    const statements = constants.map((constant, index) => {
      const line = index + 1;
      const expression = createConstantExpression(constant, line);
      return createExpressionStatement(expression, 0, constant.length, line);
    });

    const program = createProgram(statements, 0, source.length, 1, constants.length);
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new FinalConstantsValidatorHarness(service);

    const result = harness.validate(source);

    const infoCodes = result.info.map((diagnostic) => diagnostic.code);
    expect(infoCodes).toContain('PSV6-MATH-CONSTANT');
    expect(infoCodes).toContain(Codes.STYLE_CONSTANT);
    expect(infoCodes).toContain(Codes.ORDER_CONSTANT);
    expect(infoCodes).toContain(Codes.POSITION_CONSTANT);
    expect(infoCodes.filter((code) => code === Codes.SPECIALIZED_CONSTANT).length).toBeGreaterThanOrEqual(3);
    expect(infoCodes).toContain(Codes.FINAL_CONSTANTS_INFO);
    expect(infoCodes).toContain(Codes.MATH_CONSTANTS_USAGE);
    expect(infoCodes).toContain('PSV6-STYLE-CONSTANTS-USAGE');
    expect(infoCodes).toContain('PSV6-ORDER-CONSTANTS-USAGE');
    expect(infoCodes).toContain('PSV6-POSITION-CONSTANTS-USAGE');
    expect(infoCodes).toContain('PSV6-SPECIALIZED-CONSTANTS-USAGE');

    const summary = result.info.find((diagnostic) => diagnostic.code === Codes.FINAL_CONSTANTS_INFO);
    expect(summary?.message).toContain('7 different constants used');

    const specializedUsage = result.info.find((diagnostic) => diagnostic.code === 'PSV6-SPECIALIZED-CONSTANTS-USAGE');
    expect(specializedUsage?.message).toContain('(3)');
  });
});
