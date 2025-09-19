import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedBooleanValidator } from '../../modules/enhanced-boolean-validator';
import { ValidationContext, ValidatorConfig } from '../../core/types';

describe('EnhancedBooleanValidator - Short-Circuit Optimization', () => {
  let validator: EnhancedBooleanValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new EnhancedBooleanValidator();
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
      scriptType: null,
      version: 6,
      hasVersion: true,
      firstVersionLine: null
    };
    config = {
      targetVersion: 6,
      strictMode: false,
      allowDeprecated: false,
      enableTypeChecking: true,
      enableControlFlowAnalysis: true,
      enablePerformanceAnalysis: true,
      customRules: [],
      ignoredCodes: []
    };
  });

  it('warns when expensive calc precedes cheap checks in AND chain', () => {
    context.cleanLines = [
      'if ta.linreg(close, 200) > close and close > open and barstate.isconfirmed'
    ];
    const result = validator.validate(context, config);
    const orderWarn = result.warnings.find(w => w.code === 'PSV6-BOOL-AND-ORDER');
    expect(orderWarn).toBeDefined();
    expect(orderWarn!.message).toContain('Expensive calculation');
  });

  it('warns when constant false precedes expensive calc in OR chain', () => {
    context.cleanLines = [
      'result = false or ta.sma(close, 20) > close'
    ];
    const result = validator.validate(context, config);
    const orWarn = result.warnings.find(w => w.code === 'PSV6-BOOL-OR-CONSTANT');
    expect(orWarn).toBeDefined();
    expect(orWarn!.message).toContain('Constant false');
  });

  it('warns on multiple expensive calculations in one boolean chain', () => {
    context.cleanLines = [
      'if ta.correlation(close, volume, 100) > 0.5 and ta.linreg(close, 200) > close'
    ];
    const result = validator.validate(context, config);
    const expWarn = result.warnings.find(w => w.code === 'PSV6-BOOL-EXPENSIVE-CHAIN');
    expect(expWarn).toBeDefined();
  });

  it('does not warn when cheap checks precede expensive calc in AND chain', () => {
    context.cleanLines = [
      'if barstate.isnew and close > open and ta.linreg(close, 200) > close'
    ];
    const result = validator.validate(context, config);
    const orderWarn = result.warnings.find(w => w.code === 'PSV6-BOOL-AND-ORDER');
    expect(orderWarn).toBeUndefined();
  });
});

