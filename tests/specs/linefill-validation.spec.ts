import { describe, it, expect, beforeEach } from 'vitest';
import { LinefillValidator } from '../../modules/linefill-validator';
import { ValidationContext, ValidatorConfig } from '../../core/types';

describe('LinefillValidator', () => {
  let validator: LinefillValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new LinefillValidator();
    context = {
      lines: [],
      cleanLines: [],
      typeMap: new Map(),
      functionNames: new Set(),
      variableNames: new Set(),
      imports: new Map(),
      exports: new Set()
    };
    config = {
      targetVersion: 6,
      enablePerformanceAnalysis: true,
      enableBestPractices: true,
      maxComplexity: 100,
      maxNesting: 10
    };
  });

  describe('Basic Linefill Function Validation', () => {
    it('should validate linefill.new() with required parameters', () => {
      context.cleanLines = [
        'line1 = line.new(bar_index, high, bar_index + 1, low)',
        'line2 = line.new(bar_index + 1, high, bar_index + 2, low)',
        'fill = linefill.new(line1, line2)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });

    it('should error on linefill.new() with insufficient parameters', () => {
      context.cleanLines = [
        'fill = linefill.new(line1)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PSV6-FUNCTION-PARAM-COUNT');
      expect(result.errors[0].message).toContain('linefill.new() requires at least 2 parameters');
    });

    it('should validate linefill.new() with optional color parameter', () => {
      context.cleanLines = [
        'line1 = line.new(bar_index, high, bar_index + 1, low)',
        'line2 = line.new(bar_index + 1, high, bar_index + 2, low)',
        'fill = linefill.new(line1, line2, color=color.blue)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });

    it('should validate linefill.new() with transparency', () => {
      context.cleanLines = [
        'line1 = line.new(bar_index, high, bar_index + 1, low)',
        'line2 = line.new(bar_index + 1, high, bar_index + 2, low)',
        'fill = linefill.new(line1, line2, color=color.new(color.blue, 80))'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Linefill Modification Functions', () => {
    it('should validate linefill.set_color()', () => {
      context.cleanLines = [
        'line1 = line.new(bar_index, high, bar_index + 1, low)',
        'line2 = line.new(bar_index + 1, high, bar_index + 2, low)',
        'fill = linefill.new(line1, line2)',
        'linefill.set_color(fill, color.red)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });

    it('should error on linefill.set_color() with wrong parameter count', () => {
      context.cleanLines = [
        'linefill.set_color(fill)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PSV6-FUNCTION-PARAM-COUNT');
      expect(result.errors[0].message).toContain('linefill.set_color() requires exactly 2 parameters');
    });

    it('should validate linefill.delete()', () => {
      context.cleanLines = [
        'line1 = line.new(bar_index, high, bar_index + 1, low)',
        'line2 = line.new(bar_index + 1, high, bar_index + 2, low)',
        'fill = linefill.new(line1, line2)',
        'linefill.delete(fill)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });

    it('should error on linefill.delete() with wrong parameter count', () => {
      context.cleanLines = [
        'linefill.delete()'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PSV6-FUNCTION-PARAM-COUNT');
      expect(result.errors[0].message).toContain('linefill.delete() requires exactly 1 parameter');
    });
  });

  describe('Linefill Getter Functions', () => {
    it('should validate linefill.get_line1()', () => {
      context.cleanLines = [
        'line1 = line.new(bar_index, high, bar_index + 1, low)',
        'line2 = line.new(bar_index + 1, high, bar_index + 2, low)',
        'fill = linefill.new(line1, line2)',
        'first_line = linefill.get_line1(fill)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });

    it('should validate linefill.get_line2()', () => {
      context.cleanLines = [
        'line1 = line.new(bar_index, high, bar_index + 1, low)',
        'line2 = line.new(bar_index + 1, high, bar_index + 2, low)',
        'fill = linefill.new(line1, line2)',
        'second_line = linefill.get_line2(fill)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });

    it('should error on getter functions with wrong parameter count', () => {
      context.cleanLines = [
        'first_line = linefill.get_line1()',
        'second_line = linefill.get_line2(fill, extra_param)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].code).toBe('PSV6-FUNCTION-PARAM-COUNT');
      expect(result.errors[1].code).toBe('PSV6-FUNCTION-PARAM-COUNT');
    });
  });

  describe('Parameter Type Validation', () => {
    it('should error when linefill.new() receives non-line parameters', () => {
      context.cleanLines = [
        'fill = linefill.new("not_a_line", 123)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].code).toBe('PSV6-FUNCTION-PARAM-TYPE');
      expect(result.errors[0].message).toContain('Parameter 1 must be a line object');
      expect(result.errors[1].code).toBe('PSV6-FUNCTION-PARAM-TYPE');
      expect(result.errors[1].message).toContain('Parameter 2 must be a line object');
    });

    it('should error when color parameter is not a valid color', () => {
      context.cleanLines = [
        'line1 = line.new(bar_index, high, bar_index + 1, low)',
        'line2 = line.new(bar_index + 1, high, bar_index + 2, low)',
        'fill = linefill.new(line1, line2, color="not_a_color")'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PSV6-FUNCTION-PARAM-TYPE');
      expect(result.errors[0].message).toContain('color parameter must be a valid color');
    });

    it('should error when linefill.set_color() receives invalid color', () => {
      context.cleanLines = [
        'linefill.set_color(fill, 123)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PSV6-FUNCTION-PARAM-TYPE');
      expect(result.errors[0].message).toContain('color parameter must be a valid color');
    });
  });

  describe('Performance Analysis', () => {
    it('should warn about excessive linefills', () => {
      // Create many linefill declarations to trigger performance warning
      const manyLinefills = Array.from({ length: 15 }, (_, i) => 
        `fill${i} = linefill.new(line1, line2)`
      );
      
      context.cleanLines = [
        'line1 = line.new(bar_index, high, bar_index + 1, low)',
        'line2 = line.new(bar_index + 1, high, bar_index + 2, low)',
        ...manyLinefills
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('PSV6-LINEFILL-PERF-MANY');
      expect(result.warnings[0].message).toContain('Too many linefill objects');
    });

    it('should warn about linefills in loops', () => {
      context.cleanLines = [
        'for i = 0 to 10',
        '    line1 = line.new(bar_index + i, high, bar_index + i + 1, low)',
        '    line2 = line.new(bar_index + i + 1, high, bar_index + i + 2, low)',
        '    fill = linefill.new(line1, line2)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('PSV6-LINEFILL-PERF-LOOP');
      expect(result.warnings[0].message).toContain('Linefill operation in loop');
    });

    it('should warn about complex linefill operations on same line', () => {
      context.cleanLines = [
        'line1 = line.new(bar_index, high, bar_index + 1, low)',
        'line2 = line.new(bar_index + 1, high, bar_index + 2, low)',
        'fill = linefill.new(line1, line2, color=color.blue) and linefill.set_color(fill, color.red)'
      ];

      const result = validator.validate(context, config);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('PSV6-LINEFILL-PERF-COMPLEX');
      expect(result.warnings[0].message).toContain('Multiple linefill operations on one line');
    });
  });

  describe('Best Practices', () => {
    it('should suggest caching repeated linefill operations', () => {
      context.cleanLines = [
        'line1 = line.new(bar_index, high, bar_index + 1, low)',
        'line2 = line.new(bar_index + 1, high, bar_index + 2, low)',
        'fill1 = linefill.new(line1, line2, color=color.blue)',
        'fill2 = linefill.new(line1, line2, color=color.blue)',
        'fill3 = linefill.new(line1, line2, color=color.blue)'
      ];

      const result = validator.validate(context, config);
      expect(result.info.length).toBeGreaterThanOrEqual(1);
      const cacheSuggestion = result.info.find(info => info.code === 'PSV6-LINEFILL-CACHE-SUGGESTION');
      expect(cacheSuggestion).toBeDefined();
      expect(cacheSuggestion!.message).toContain('Multiple similar linefill operations detected');
    });

    it('should suggest using color.new() for transparency', () => {
      context.cleanLines = [
        'line1 = line.new(bar_index, high, bar_index + 1, low)',
        'line2 = line.new(bar_index + 1, high, bar_index + 2, low)',
        'fill = linefill.new(line1, line2, color=color.blue)'
      ];

      const result = validator.validate(context, config);
      expect(result.info).toHaveLength(1);
      expect(result.info[0].code).toBe('PSV6-LINEFILL-TRANSPARENCY-SUGGESTION');
      expect(result.info[0].message).toContain('Consider using color.new() for transparency');
    });

    it('should suggest proper linefill cleanup', () => {
      context.cleanLines = [
        'line1 = line.new(bar_index, high, bar_index + 1, low)',
        'line2 = line.new(bar_index + 1, high, bar_index + 2, low)',
        'fill1 = linefill.new(line1, line2)',
        'fill2 = linefill.new(line1, line2)',
        'fill3 = linefill.new(line1, line2)',
        'fill4 = linefill.new(line1, line2)',
        'fill5 = linefill.new(line1, line2)',
        'fill6 = linefill.new(line1, line2)'
      ];

      const result = validator.validate(context, config);
      expect(result.info.length).toBeGreaterThanOrEqual(1);
      const cleanupSuggestion = result.info.find(info => info.code === 'PSV6-LINEFILL-CLEANUP-SUGGESTION');
      expect(cleanupSuggestion).toBeDefined();
      expect(cleanupSuggestion!.message).toContain('Consider using linefill.delete()');
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle nested linefill operations', () => {
      context.cleanLines = [
        'line1 = line.new(bar_index, high, bar_index + 1, low)',
        'line2 = line.new(bar_index + 1, high, bar_index + 2, low)',
        'fill = linefill.new(linefill.get_line1(existing_fill), line2)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });

    it('should handle conditional linefill creation', () => {
      context.cleanLines = [
        'line1 = line.new(bar_index, high, bar_index + 1, low)',
        'line2 = line.new(bar_index + 1, high, bar_index + 2, low)',
        'fill = close > open ? linefill.new(line1, line2, color=color.green) : linefill.new(line1, line2, color=color.red)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });

    it('should handle linefill arrays', () => {
      context.cleanLines = [
        'var linefill_array = array.new<linefill>()',
        'line1 = line.new(bar_index, high, bar_index + 1, low)',
        'line2 = line.new(bar_index + 1, high, bar_index + 2, low)',
        'fill = linefill.new(line1, line2)',
        'array.push(linefill_array, fill)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown linefill functions', () => {
      context.cleanLines = [
        'linefill.unknown_function(fill)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PSV6-LINEFILL-UNKNOWN-FUNCTION');
      expect(result.errors[0].message).toContain('Unknown linefill function');
    });

    it('should handle empty linefill function calls', () => {
      context.cleanLines = [
        'linefill.new()',
        'linefill.set_color()',
        'linefill.delete()'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(3);
      expect(result.errors.every(error => error.code === 'PSV6-FUNCTION-PARAM-COUNT')).toBe(true);
    });

    it('should handle malformed linefill syntax', () => {
      context.cleanLines = [
        'linefill.new(line1, line2,)',  // Trailing comma
        'linefill.set_color(fill, color=)'  // Missing value
      ];

      const result = validator.validate(context, config);
      // Should handle gracefully without crashing
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with Other Validators', () => {
    it('should work with line validator results', () => {
      // Simulate type information from LineValidator
      context.typeMap.set('line1', { type: 'line', isConst: false, isSeries: false });
      context.typeMap.set('line2', { type: 'line', isConst: false, isSeries: false });
      
      context.cleanLines = [
        'fill = linefill.new(line1, line2)'
      ];

      const result = validator.validate(context, config);
      expect(result.errors).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });

    it('should provide type information for other validators', () => {
      context.cleanLines = [
        'line1 = line.new(bar_index, high, bar_index + 1, low)',
        'line2 = line.new(bar_index + 1, high, bar_index + 2, low)',
        'fill = linefill.new(line1, line2)'
      ];

      const result = validator.validate(context, config);
      expect(result.typeMap.has('linefill.new')).toBe(true);
      expect(result.typeMap.get('linefill.new')?.type).toBe('linefill');
    });
  });
});
