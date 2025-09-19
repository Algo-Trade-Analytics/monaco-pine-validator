import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { ValidationContext, ValidatorConfig } from '../../core/types';

describe('Negative Array Indices (v6)', () => {
  let validator: EnhancedModularValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new EnhancedModularValidator({ targetVersion: 6 });
    context = {
      lines: [],
      cleanLines: [],
      rawLines: [],
      typeMap: new Map(),
      usedVars: new Set(),
      declaredVars: new Map(),
      functionNames: new Set(),
      methodNames: new Set(),
      functionParams: new Map(),
      scriptType: 'indicator',
      version: 6,
      hasVersion: true,
      firstVersionLine: 1,
    } as any;
    config = {
      targetVersion: 6,
      strictMode: true,
      allowDeprecated: false,
      enableTypeChecking: true,
      enableControlFlowAnalysis: true,
      enablePerformanceAnalysis: true,
      customRules: [],
      ignoredCodes: []
    };
  });

  it('allows array.get() with negative indices (last/second-last)', () => {
    context.cleanLines = [
      'indicator("Neg Array Index")',
      'arr = array.new<float>(3)',
      'last = array.get(arr, -1)',
      'second = array.get(arr, -2)',
      'plot(close)'
    ];

    const result = validator.validate(context, config);
    // No errors from core/history validators for negative array indices via array.get
    const historyErrors = result.errors.filter(e => (e.code || '').startsWith('PSV6-HISTORY') || e.code === 'PS024');
    expect(historyErrors).toHaveLength(0);
    // Array bounds might warn only if index exceeds size; -1 and -2 are fine for size 3
    const boundsWarnings = result.warnings.filter(w => w.code === 'PSV6-ARRAY-INDEX-BOUNDS');
    expect(boundsWarnings).toHaveLength(0);
  });

  it('warns when negative index exceeds array bounds', () => {
    context.cleanLines = [
      'indicator("Neg Array Index Bounds")',
      'arr = array.new<float>(3)',
      'tooNeg = array.get(arr, -4)',
      'plot(close)'
    ];

    const result = validator.validate(context, config);
    const boundsWarnings = result.warnings.filter(w => w.code === 'PSV6-ARRAY-INDEX-BOUNDS');
    expect(boundsWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it('supports array.set with negative indices within bounds', () => {
    context.cleanLines = [
      'indicator("Neg Array Index Set")',
      'arr = array.new<float>(3)',
      'array.set(arr, -1, close)',
      'array.set(arr, -2, open)',
      'plot(close)'
    ];

    const result = validator.validate(context, config);
    const errors = result.errors.filter(e => (e.code || '').startsWith('PSV6-ARRAY'));
    expect(errors).toHaveLength(0);
    const boundsWarnings = result.warnings.filter(w => w.code === 'PSV6-ARRAY-INDEX-BOUNDS');
    expect(boundsWarnings).toHaveLength(0);
  });

  it('still errors on negative history references like close[-1]', () => {
    context.cleanLines = [
      'indicator("Neg History Index")',
      'arr = array.new<float>(3)',
      'last = array.get(arr, -1)',
      'bad = close[-1]',
      'plot(close)'
    ];

    const result = validator.validate(context, config);
    const histError = result.errors.find(e => e.code === 'PSV6-HISTORY-INVALID-INDEX' || e.code === 'PS024');
    expect(histError).toBeDefined();
  });
});
