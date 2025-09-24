import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { BuiltinVariablesValidator } from '../../modules/builtin-variables-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import { createBuiltinConstantsProgram } from './fixtures';
import { Codes } from '../../core/codes';

class BuiltinValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new BuiltinVariablesValidator());
  }

  protected runCoreValidation(): void {}
}

class DisabledBuiltinValidatorHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new BuiltinVariablesValidator());
  }

  protected runCoreValidation(): void {}
}

describe('BuiltinVariablesValidator (AST)', () => {
  it('returns no diagnostics when AST mode is disabled', () => {
    const validator = new DisabledBuiltinValidatorHarness();
    const result = validator.validate(`//@version=6\nindicator("Disabled")\nvar tf = timeframe.isdaily`);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });

  it('records built-in constant usage from AST member expressions', () => {
    const astProgram = createBuiltinConstantsProgram();
    const service = new FunctionAstService(() => ({
      ast: astProgram,
      diagnostics: createAstDiagnostics(),
    }));
    const validator = new BuiltinValidatorHarness(service);
    const source = `//@version=6\nindicator("Builtin AST")\n` +
      `var tfDaily = timeframe.isdaily\n` +
      `var displaySetting = display.all\n` +
      `var extendSetting = extend.right\n` +
      `var formatSetting = format.price\n` +
      `var currencySetting = currency.USD\n` +
      `var scaleSetting = scale.left\n` +
      `var adjustmentSetting = adjustment.none\n` +
      `var backadjustmentSetting = backadjustment.off\n`;

    const result = validator.validate(source);

    expect(result.isValid).toBe(true);

    const occurrencesByCode = new Map<string, number>();
    for (const info of result.info) {
      occurrencesByCode.set(info.code ?? '', (occurrencesByCode.get(info.code ?? '') ?? 0) + 1);
    }

    expect(occurrencesByCode.get(Codes.TIMEFRAME_CONSTANT)).toBe(1);
    expect(occurrencesByCode.get(Codes.DISPLAY_CONSTANT)).toBe(1);
    expect(occurrencesByCode.get(Codes.EXTEND_CONSTANT)).toBe(1);
    expect(occurrencesByCode.get(Codes.FORMAT_CONSTANT)).toBe(1);
    expect(occurrencesByCode.get(Codes.CURRENCY_CONSTANT)).toBe(1);
    expect(occurrencesByCode.get(Codes.SCALE_CONSTANT)).toBe(1);
    expect(occurrencesByCode.get(Codes.ADJUSTMENT_CONSTANT)).toBe(1);
    expect(occurrencesByCode.get(Codes.BACKADJUSTMENT_CONSTANT)).toBe(1);

    expect(result.info.some((info) => info.code === Codes.BUILTIN_VARS_INFO)).toBe(true);
    expect(result.info.some((info) => info.code === Codes.CURRENCY_USAGE)).toBe(true);
    expect(result.info.some((info) => info.code === Codes.DISPLAY_USAGE)).toBe(true);
    expect(result.info.some((info) => info.code === Codes.SCALE_USAGE)).toBe(true);
    expect(result.info.some((info) => info.code === Codes.ADJUSTMENT_USAGE)).toBe(true);
  });
});

