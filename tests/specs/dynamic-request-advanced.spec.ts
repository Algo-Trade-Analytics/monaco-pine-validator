import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicDataValidator } from '../../modules/dynamic-data-validator';
import { ValidationContext, ValidatorConfig } from '../../core/types';

describe('Dynamic Request Functions - Advanced', () => {
  let validator: DynamicDataValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new DynamicDataValidator();
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
      firstVersionLine: 1
    };
    config = {
      targetVersion: 6,
      strictMode: true,
      allowDeprecated: false,
      enableTypeChecking: true,
      enableControlFlowAnalysis: true,
      enablePerformanceAnalysis: true,
      customRules: [],
      ignoredCodes: []
    } as any;
  });

  it('detects dynamic request in loop (expression dynamic)', () => {
    context.cleanLines = [
      'indicator("Dyn Requests")',
      'for i = 0 to 10',
      '    data = request.security("AAPL", "1D", close[i])'
    ];
    const result = validator.validate(context, config);
    expect(result.warnings.find(w => w.code === 'PSV6-REQUEST-DYNAMIC-LOOP')).toBeDefined();
  });

  it('detects dynamic request in conditional', () => {
    context.cleanLines = [
      'indicator("Dyn Requests")',
      'if close > open',
      '    data = request.security("AAPL", "1D", ta.sma(close, 20))'
    ];
    const result = validator.validate(context, config);
    expect(result.warnings.find(w => w.code === 'PSV6-REQUEST-DYNAMIC-CONDITIONAL')).toBeDefined();
  });

  it('warns on dynamic symbol and timeframe parameters', () => {
    context.cleanLines = [
      'indicator("Dyn Requests")',
      'sym = syminfo.tickerid',
      'tf = timeframe.period',
      'data = request.security(sym, tf, close)'
    ];
    const result = validator.validate(context, config);
    expect(result.warnings.find(w => w.code === 'PSV6-REQUEST-DYNAMIC-SYMBOL')).toBeDefined();
    expect(result.warnings.find(w => w.code === 'PSV6-REQUEST-DYNAMIC-TIMEFRAME')).toBeDefined();
  });
});

