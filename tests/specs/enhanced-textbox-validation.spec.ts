import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedTextboxValidator } from '../../modules/enhanced-textbox-validator';
import { ValidationContext, ValidatorConfig } from '../../core/types';

describe('EnhancedTextboxValidator', () => {
  let validator: EnhancedTextboxValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new EnhancedTextboxValidator();
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
      strictMode: false,
      allowDeprecated: false,
      enableTypeChecking: true,
      enableControlFlowAnalysis: true,
      enablePerformanceAnalysis: true,
      customRules: [],
      ignoredCodes: []
    };
  });

  describe('Box Text Parameter Validation', () => {
    it('should validate box.new with text parameter', () => {
      context.cleanLines = [
        'indicator("Box Text Test", overlay=true)',
        'box.new(left=bar_index, top=high, right=bar_index+1, bottom=low, text="Hello World")'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should validate text parameter type', () => {
      context.cleanLines = [
        'indicator("Box Text Type Test", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text=123)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      const textTypeError = result.errors.find(e => e.code === 'PSV6-TEXTBOX-TEXT-TYPE');
      expect(textTypeError).toBeDefined();
      expect(textTypeError!.message).toContain('text parameter must be a string');
    });

    it('should validate text formatting parameters', () => {
      context.cleanLines = [
        'indicator("Box Text Formatting", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text="Test", text_color=color.blue, text_size=size.normal)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn about invalid text_color parameter', () => {
      context.cleanLines = [
        'indicator("Invalid Text Color", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text="Test", text_color="invalid")'
      ];

      const result = validator.validate(context, config);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      const colorError = result.errors.find(e => e.code === 'PSV6-TEXTBOX-COLOR-TYPE');
      expect(colorError).toBeDefined();
      expect(colorError!.message).toContain('text_color must be a valid color');
    });

    it('should validate text_size parameter', () => {
      context.cleanLines = [
        'indicator("Text Size Test", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text="Test", text_size="invalid_size")'
      ];

      const result = validator.validate(context, config);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      const sizeError = result.errors.find(e => e.code === 'PSV6-TEXTBOX-SIZE-TYPE');
      expect(sizeError).toBeDefined();
      expect(sizeError!.message).toContain('text_size must be a valid size constant');
    });
  });

  describe('Box Text Setter Functions', () => {
    it('should validate box.set_text function', () => {
      context.cleanLines = [
        'indicator("Box Set Text", overlay=true)',
        'my_box = box.new(left=0, top=1, right=1, bottom=0)',
        'box.set_text(my_box, "Updated text")'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate box.set_text parameter count', () => {
      context.cleanLines = [
        'indicator("Box Set Text Params", overlay=true)',
        'my_box = box.new(left=0, top=1, right=1, bottom=0)',
        'box.set_text(my_box)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      const paramError = result.errors.find(e => e.code === 'PSV6-FUNCTION-PARAM-COUNT');
      expect(paramError).toBeDefined();
      expect(paramError!.message).toContain('box.set_text() requires exactly 2 parameters');
    });

    it('should validate box.set_text_color function', () => {
      context.cleanLines = [
        'indicator("Box Set Text Color", overlay=true)',
        'my_box = box.new(left=0, top=1, right=1, bottom=0, text="Test")',
        'box.set_text_color(my_box, color.red)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate box.set_text_size function', () => {
      context.cleanLines = [
        'indicator("Box Set Text Size", overlay=true)',
        'my_box = box.new(left=0, top=1, right=1, bottom=0, text="Test")',
        'box.set_text_size(my_box, size.large)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
    });

  });

  describe('Text Content Validation', () => {
    it('should validate text length limits', () => {
      const longText = 'A'.repeat(1000);
      context.cleanLines = [
        'indicator("Long Text Test", overlay=true)',
        `box.new(left=0, top=1, right=1, bottom=0, text="${longText}")`
      ];

      const result = validator.validate(context, config);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      const lengthWarning = result.warnings.find(w => w.code === 'PSV6-TEXTBOX-TEXT-LENGTH');
      expect(lengthWarning).toBeDefined();
      expect(lengthWarning!.message).toContain('Text content is very long');
    });

    it('should validate text encoding and special characters', () => {
      context.cleanLines = [
        'indicator("Special Characters", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text="Hello\\nWorld\\t!")'
      ];

      const result = validator.validate(context, config);
      expect(result.info.length).toBeGreaterThanOrEqual(1);
      const encodingInfo = result.info.find(i => i.code === 'PSV6-TEXTBOX-SPECIAL-CHARS');
      expect(encodingInfo).toBeDefined();
      expect(encodingInfo!.message).toContain('Text contains special characters');
    });

    it('should validate dynamic text content', () => {
      context.cleanLines = [
        'indicator("Dynamic Text", overlay=true)',
        'dynamic_text = "Price: " + str.tostring(close)',
        'box.new(left=0, top=1, right=1, bottom=0, text=dynamic_text)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
      expect(result.info.length).toBeGreaterThanOrEqual(1);
      const dynamicInfo = result.info.find(i => i.code === 'PSV6-TEXTBOX-DYNAMIC-TEXT');
      expect(dynamicInfo).toBeDefined();
      expect(dynamicInfo!.message).toContain('Dynamic text content detected');
    });

    it('should validate text with string interpolation', () => {
      context.cleanLines = [
        'indicator("String Interpolation", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text=str.format("Price: {0}", close))'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Text Alignment and Positioning', () => {
    it('should validate text_halign parameter', () => {
      context.cleanLines = [
        'indicator("Text Alignment", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text="Test", text_halign=text.align_center)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate invalid text_halign parameter', () => {
      context.cleanLines = [
        'indicator("Invalid Alignment", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text="Test", text_halign="invalid")'
      ];

      const result = validator.validate(context, config);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      const alignError = result.errors.find(e => e.code === 'PSV6-TEXTBOX-ALIGN-TYPE');
      expect(alignError).toBeDefined();
      expect(alignError!.message).toContain('text_halign must be a valid alignment constant');
    });

    it('should validate text_valign parameter', () => {
      context.cleanLines = [
        'indicator("Vertical Alignment", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text="Test", text_valign=text.align_top)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate text wrapping behavior', () => {
      context.cleanLines = [
        'indicator("Text Wrapping", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text="Very long text that might wrap", text_wrap=text.wrap_auto)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Performance and Best Practices', () => {
    it('should warn about excessive text boxes', () => {
      const manyBoxes = Array.from({ length: 20 }, (_, i) => 
        `box.new(left=${i}, top=1, right=${i+1}, bottom=0, text="Box ${i}")`
      );
      
      context.cleanLines = [
        'indicator("Many Text Boxes", overlay=true)',
        ...manyBoxes
      ];

      const result = validator.validate(context, config);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      const performanceWarning = result.warnings.find(w => w.code === 'PSV6-TEXTBOX-PERFORMANCE-MANY');
      expect(performanceWarning).toBeDefined();
      expect(performanceWarning!.message).toContain('Many text boxes detected');
    });

    it('should suggest text caching for repeated content', () => {
      context.cleanLines = [
        'indicator("Repeated Text", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text="Same Text")',
        'box.new(left=1, top=1, right=2, bottom=0, text="Same Text")',
        'box.new(left=2, top=1, right=3, bottom=0, text="Same Text")'
      ];

      const result = validator.validate(context, config);
      expect(result.info.length).toBeGreaterThanOrEqual(1);
      const cachingInfo = result.info.find(i => i.code === 'PSV6-TEXTBOX-CACHE-SUGGESTION');
      expect(cachingInfo).toBeDefined();
      expect(cachingInfo!.message).toContain('Consider caching repeated text content');
    });

    it('should warn about text boxes in loops', () => {
      context.cleanLines = [
        'indicator("Text Boxes in Loop", overlay=true)',
        'for i = 0 to 10',
        '    box.new(left=i, top=1, right=i+1, bottom=0, text="Loop " + str.tostring(i))'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      const loopWarning = result.warnings.find(w => w.code === 'PSV6-TEXTBOX-LOOP-WARNING');
      expect(loopWarning).toBeDefined();
      expect(loopWarning!.message).toContain('Text boxes in loop may impact performance');
    });

    it('should suggest using labels for simple text', () => {
      context.cleanLines = [
        'indicator("Simple Text Box", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text="Simple", bgcolor=na, border_color=na)'
      ];

      const result = validator.validate(context, config);
      expect(result.info.length).toBeGreaterThanOrEqual(1);
      const labelSuggestion = result.info.find(i => i.code === 'PSV6-TEXTBOX-LABEL-SUGGESTION');
      expect(labelSuggestion).toBeDefined();
      expect(labelSuggestion!.message).toContain('Consider using label.new() for simple text');
    });
  });

  describe('Text Formatting and Styling', () => {
    it('should validate text formatting with markup', () => {
      context.cleanLines = [
        'indicator("Text Markup", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text="<b>Bold</b> and <i>Italic</i>")'
      ];

      const result = validator.validate(context, config);
      expect(result.info.length).toBeGreaterThanOrEqual(1);
      const markupInfo = result.info.find(i => i.code === 'PSV6-TEXTBOX-MARKUP-DETECTED');
      expect(markupInfo).toBeDefined();
      expect(markupInfo!.message).toContain('HTML-like markup detected in text');
    });

    it('should validate text with color codes', () => {
      context.cleanLines = [
        'indicator("Text Color Codes", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text="Red: #FF0000, Blue: #0000FF")'
      ];

      const result = validator.validate(context, config);
      expect(result.info.length).toBeGreaterThanOrEqual(1);
      const colorInfo = result.info.find(i => i.code === 'PSV6-TEXTBOX-COLOR-CODES');
      expect(colorInfo).toBeDefined();
      expect(colorInfo!.message).toContain('Color codes detected in text content');
    });

    it('should validate text with unicode characters', () => {
      context.cleanLines = [
        'indicator("Unicode Text", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text="Arrow: → Bullet: • Check: ✓")'
      ];

      const result = validator.validate(context, config);
      expect(result.info.length).toBeGreaterThanOrEqual(1);
      const unicodeInfo = result.info.find(i => i.code === 'PSV6-TEXTBOX-UNICODE-CHARS');
      expect(unicodeInfo).toBeDefined();
      expect(unicodeInfo!.message).toContain('Unicode characters detected');
    });
  });

  describe('Unsupported Text APIs', () => {
    it('should ignore unknown setters for downstream validation', () => {
      context.cleanLines = [
        'indicator("Unsupported Text Setter", overlay=true)',
        'my_box = box.new(left=0, top=1, right=1, bottom=0, text="Test")',
        'box.set_text_font(my_box, font.monospace)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
    });

    it('should ignore unknown getters for downstream validation', () => {
      context.cleanLines = [
        'indicator("Unsupported Text Getter", overlay=true)',
        'current_text = box.get_text(my_box)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Integration with Other Drawing Objects', () => {
    it('should validate text consistency across drawing objects', () => {
      context.cleanLines = [
        'indicator("Text Consistency", overlay=true)',
        'label.new(x=bar_index, y=high, text="Label Text", color=color.blue)',
        'box.new(left=0, top=1, right=1, bottom=0, text="Box Text", text_color=color.red)'
      ];

      const result = validator.validate(context, config);
      expect(result.info.length).toBeGreaterThanOrEqual(1);
      const consistencyInfo = result.info.find(i => i.code === 'PSV6-TEXTBOX-CONSISTENCY-CHECK');
      expect(consistencyInfo).toBeDefined();
      expect(consistencyInfo!.message).toContain('Consider consistent text styling across drawing objects');
    });

    it('should validate text overlap detection', () => {
      context.cleanLines = [
        'indicator("Text Overlap", overlay=true)',
        'box.new(left=0, top=1, right=2, bottom=0, text="Overlapping Text 1")',
        'box.new(left=1, top=1, right=3, bottom=0, text="Overlapping Text 2")'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      const overlapWarning = result.warnings.find(w => w.code === 'PSV6-TEXTBOX-OVERLAP-WARNING');
      expect(overlapWarning).toBeDefined();
      expect(overlapWarning!.message).toContain('Potential text overlap detected');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty text parameter', () => {
      context.cleanLines = [
        'indicator("Empty Text", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text="")'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      const emptyWarning = result.warnings.find(w => w.code === 'PSV6-TEXTBOX-EMPTY-TEXT');
      expect(emptyWarning).toBeDefined();
      expect(emptyWarning!.message).toContain('Empty text parameter');
    });

    it('should handle null text parameter', () => {
      context.cleanLines = [
        'indicator("Null Text", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text=na)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      const nullWarning = result.warnings.find(w => w.code === 'PSV6-TEXTBOX-NULL-TEXT');
      expect(nullWarning).toBeDefined();
      expect(nullWarning!.message).toContain('Text parameter is na');
    });

    it('should handle malformed text parameters', () => {
      context.cleanLines = [
        'indicator("Malformed Text", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text=unclosed_string")'
      ];

      const result = validator.validate(context, config);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      const malformedError = result.errors.find(e => e.code === 'PSV6-TEXTBOX-MALFORMED-TEXT');
      expect(malformedError).toBeDefined();
    });
  });

  describe('Configuration and Compatibility', () => {
    it('should respect performance analysis configuration', () => {
      config.enablePerformanceAnalysis = false;
      
      const manyBoxes = Array.from({ length: 20 }, (_, i) => 
        `box.new(left=${i}, top=1, right=${i+1}, bottom=0, text="Box ${i}")`
      );
      
      context.cleanLines = [
        'indicator("Performance Disabled", overlay=true)',
        ...manyBoxes
      ];

      const result = validator.validate(context, config);
      // Should still validate text parameters but not performance
      const textErrors = result.errors.filter(e => e.code?.startsWith('PSV6-TEXTBOX-TEXT'));
      expect(textErrors).toHaveLength(0);
      
      const performanceWarnings = result.warnings.filter(w => w.code?.includes('PERFORMANCE'));
      expect(performanceWarnings).toHaveLength(0);
    });

    it('should provide comprehensive analysis results', () => {
      context.cleanLines = [
        'indicator("Analysis Test", overlay=true)',
        'box.new(left=0, top=1, right=1, bottom=0, text="Test")'
      ];

      const result = validator.validate(context, config);
      expect(result.typeMap.has('textbox_analysis')).toBe(true);
      const analysis = result.typeMap.get('textbox_analysis');
      expect(analysis?.type).toBe('analysis');
    });
  });
});
