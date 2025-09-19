import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { ValidationContext, ValidatorConfig } from '../../core/types';

describe('Text Typography & Style Validation', () => {
  let validator: EnhancedModularValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new EnhancedModularValidator();
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
      firstVersionLine: null
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
    };
  });

  it('accepts label.new textstyle and size constants', () => {
    context.cleanLines = [
      'indicator("Typography Test")',
      'label.new(1, 2, "Bold Text", textsize=size.large, textstyle=text.style_bold)'
    ];

    const result = validator.validate(context, config);
    const labelStyleError = result.errors.find(e => e.code === 'PSV6-LABEL-TEXT-STYLE');
    const labelSizeError = result.errors.find(e => e.code === 'PSV6-LABEL-TEXT-SIZE');
    expect(labelStyleError).toBeUndefined();
    expect(labelSizeError).toBeUndefined();
  });

  it('accepts box text_size in points and enhanced font family', () => {
    context.cleanLines = [
      'indicator("Typography Test")',
      'box.new(left=0, top=1, right=2, bottom=0, text="T", text_size=12, text_font=font.monospace_bold)'
    ];

    const result = validator.validate(context, config);
    const sizeTypeError = result.errors.find(e => e.code === 'PSV6-TEXTBOX-SIZE-TYPE');
    expect(sizeTypeError).toBeUndefined();
  });

  it('errors on unknown textstyle constant', () => {
    context.cleanLines = [
      'indicator("Typography Test")',
      'label.new(1, 2, "Txt", textstyle=text.style_foo)'
    ];

    const result = validator.validate(context, config);
    const styleError = result.errors.find(e => e.code === 'PSV6-LABEL-TEXT-STYLE');
    expect(styleError).toBeDefined();
  });

  it('errors on out-of-range point size for box text', () => {
    context.cleanLines = [
      'indicator("Typography Test")',
      'box.new(left=0, top=1, right=2, bottom=0, text="T", text_size=100)'
    ];

    const result = validator.validate(context, config);
    const sizeTypeError = result.errors.find(e => e.code === 'PSV6-TEXTBOX-SIZE-TYPE');
    expect(sizeTypeError).toBeDefined();
  });
});

