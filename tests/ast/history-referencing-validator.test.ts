import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { HistoryReferencingValidator } from '../../modules/history-referencing-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import { createHistoryReferencingProgram } from './fixtures';

class HistoryValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new HistoryReferencingValidator());
  }

  protected runCoreValidation(): void {}
}

class DisabledHistoryValidatorHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new HistoryReferencingValidator());
  }

  protected runCoreValidation(): void {}
}

describe('HistoryReferencingValidator (AST)', () => {
  it('returns no diagnostics when AST mode is disabled', () => {
    const harness = new DisabledHistoryValidatorHarness();
    const result = harness.validate('close[1]');

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });

  it('derives history diagnostics from the AST structure', () => {
    const program = createHistoryReferencingProgram();
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));
    const validator = new HistoryValidatorHarness(service);

    const source = [
      'negative = close[-1]',
      'large = close[5001]',
      'while condition',
      '    close[i]',
      'nested = close[high[1]]',
      'varip counter = 0',
      'counter := counter + close[1]',
      'process(close[1])',
      'int prevClose = close[1]',
    ].join('\n');

    const result = validator.validate(source);

    const errorCodes = result.errors.map((error) => error.code);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(errorCodes).toEqual(
      expect.arrayContaining(['PSV6-HISTORY-INVALID-INDEX', 'PSV6-HISTORY-VARIP-CONTEXT']),
    );
    expect(errorCodes.filter((code) => code === 'PSV6-HISTORY-INVALID-INDEX')).toHaveLength(1);
    expect(errorCodes.filter((code) => code === 'PSV6-HISTORY-VARIP-CONTEXT')).toHaveLength(1);

    expect(warningCodes).toEqual(
      expect.arrayContaining([
        'PSV6-HISTORY-LARGE-INDEX',
        'PSV6-HISTORY-PERF-LOOP',
        'PSV6-HISTORY-PERF-NESTED',
        'PSV6-HISTORY-FUNCTION-PARAM',
        'PSV6-HISTORY-TYPE-MISMATCH',
      ]),
    );

    const count = (code: string) => warningCodes.filter((value) => value === code).length;
    expect(count('PSV6-HISTORY-LARGE-INDEX')).toBe(1);
    expect(count('PSV6-HISTORY-PERF-LOOP')).toBe(1);
    expect(count('PSV6-HISTORY-PERF-NESTED')).toBe(1);
    expect(count('PSV6-HISTORY-FUNCTION-PARAM')).toBe(1);
    expect(count('PSV6-HISTORY-TYPE-MISMATCH')).toBe(1);
  });
});
