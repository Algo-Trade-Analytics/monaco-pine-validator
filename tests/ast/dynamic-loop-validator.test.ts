import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { DynamicLoopValidator } from '../../modules/dynamic-loop-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import { createDynamicLoopProgram, createLoopMutationProgram } from './fixtures';

class DynamicLoopHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new DynamicLoopValidator());
  }

  protected runCoreValidation(): void {}
}

describe('DynamicLoopValidator (AST)', () => {
  it('emits dynamic bound warnings from AST metadata', () => {
    const program = createDynamicLoopProgram();
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));
    const validator = new DynamicLoopHarness(service);

    const source = [
      'for i = bar_index - 100 to bar_index',
      '    plot(i)',
      'end',
      'for j = 0 to array.size(signals) - 1',
      '    plot(j)',
      'end',
      'step = input.int(1)',
      'for k = 0 to 10 by step',
      '    plot(k)',
      'end',
    ].join('\n');

    const result = validator.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toEqual(
      expect.arrayContaining([
        'PSV6-FOR-DYNAMIC-START',
        'PSV6-FOR-DYNAMIC-END',
        'PSV6-FOR-DYNAMIC-STEP',
      ]),
    );
    expect(warningCodes.filter((code) => code === 'PSV6-FOR-DYNAMIC-START')).toHaveLength(1);
    expect(warningCodes.filter((code) => code === 'PSV6-FOR-DYNAMIC-END')).toHaveLength(1);
    expect(warningCodes.filter((code) => code === 'PSV6-FOR-DYNAMIC-STEP')).toHaveLength(1);
  });

  it('detects index and bound modifications inside loops', () => {
    const program = createLoopMutationProgram();
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));
    const validator = new DynamicLoopHarness(service);

    const source = [
      'limit = 10',
      'for idx = 0 to limit',
      '    limit := limit + 1',
      '    idx := idx + 1',
      'end',
    ].join('\n');

    const result = validator.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toEqual(
      expect.arrayContaining(['PSV6-FOR-BOUND-MODIFIED', 'PSV6-FOR-INDEX-MODIFIED']),
    );
    expect(warningCodes.filter((code) => code === 'PSV6-FOR-BOUND-MODIFIED')).toHaveLength(1);
    expect(warningCodes.filter((code) => code === 'PSV6-FOR-INDEX-MODIFIED')).toHaveLength(1);
  });
});
