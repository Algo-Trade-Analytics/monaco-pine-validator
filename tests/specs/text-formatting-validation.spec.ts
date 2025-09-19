import { EnhancedModularValidator } from '../..';
import { ValidationContext, ValidatorConfig } from '../../core/types';
import { expectHas, expectLacks } from './test-utils';

/// <reference types="vitest/globals" />

describe('Text Formatting Validation (TDD)', () => {
  let validator: EnhancedModularValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new EnhancedModularValidator({
      targetVersion: 6,
      strictMode: true,
      enablePerformanceAnalysis: true
    });

    context = {
      cleanLines: [],
      lines: [],
      lineFeeds: [],
      comments: [],
      regions: [],
      userFunctions: new Map(),
      functionCalls: [],
      functionNames: new Set(),
      functionParams: new Map(),
      methodNames: new Set(),
      typeMap: new Map(),
      udtTypes: new Map(),
      varipVariables: new Set(),
      switchStatements: [],
      whileLoops: [],
      requestCalls: []
    };

    config = {
      targetVersion: 6,
      strictMode: true,
      enablePerformanceAnalysis: true,
      enableStyleChecks: true
    };
  });

  describe('PSV6-TEXT-BASIC: Basic Text Formatting Functions', () => {
    it('should validate correct text formatting functions', () => {
      const code = `//@version=6
indicator("Text Formatting Test")

// Valid text formatting functions
priceText = str.format("Price: {0}", close)
volumeText = str.format("Volume: {0}", volume)
timeText = str.format("Time: {0}", time)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      // Only check text formatting-specific errors
      const textErrors = result.errors.filter(e => e.code.startsWith('PSV6-TEXT'));
      expect(textErrors).toEqual([]);
    });

    it('should error on invalid format string', () => {
      const code = `//@version=6
indicator("Text Formatting Test")

// Invalid format string
invalidText = str.format("Price: {", close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-TEXT-INVALID-FORMAT'] });
    });

    it('should error on format parameter mismatch', () => {
      const code = `//@version=6
indicator("Text Formatting Test")

// Format parameter mismatch
mismatchText = str.format("Price: {0} {1}", close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-TEXT-PARAM-MISMATCH'] });
    });
  });

  describe('PSV6-TEXT-NUMERIC: Numeric Text Formatting', () => {
    it('should validate numeric formatting functions', () => {
      const code = `//@version=6
indicator("Numeric Text Test")

// Valid numeric formatting
priceText = str.format("Price: {0,number,#.##}", close)
volumeText = str.format("Volume: {0,number,#,###}", volume)
percentText = str.format("Change: {0,number,#.##%}", 0.15)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      // Only check text formatting-specific errors
      const textErrors = result.errors.filter(e => e.code.startsWith('PSV6-TEXT'));
      expect(textErrors).toEqual([]);
    });

    it('should warn on invalid numeric format', () => {
      const code = `//@version=6
indicator("Numeric Text Test")

// Invalid numeric format
invalidText = str.format("Price: {0,number,invalid}", close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-TEXT-INVALID-NUMERIC-FORMAT'] });
    });

    it('should warn on non-numeric value with numeric format', () => {
      const code = `//@version=6
indicator("Numeric Text Test")

// Non-numeric value with numeric format
invalidText = str.format("Text: {0,number,#.##}", "hello")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-TEXT-NON-NUMERIC-FORMAT'] });
    });
  });

  describe('PSV6-TEXT-DATE: Date Text Formatting', () => {
    it('should validate date formatting functions', () => {
      const code = `//@version=6
indicator("Date Text Test")

// Valid date formatting
dateText = str.format("Date: {0,date,dd/MM/yyyy}", time)
timeText = str.format("Time: {0,time,HH:mm:ss}", time)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      // Only check text formatting-specific errors
      const textErrors = result.errors.filter(e => e.code.startsWith('PSV6-TEXT'));
      expect(textErrors).toEqual([]);
    });

    it('should warn on invalid date format', () => {
      const code = `//@version=6
indicator("Date Text Test")

// Invalid date format
invalidText = str.format("Date: {0,date,invalid}", time)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-TEXT-INVALID-DATE-FORMAT'] });
    });

    it('should warn on non-date value with date format', () => {
      const code = `//@version=6
indicator("Date Text Test")

// Non-date value with date format
invalidText = str.format("Date: {0,date,dd/MM/yyyy}", "hello")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-TEXT-NON-DATE-FORMAT'] });
    });
  });

  describe('PSV6-TEXT-PERF: Text Formatting Performance', () => {
    it('should warn on text formatting in loop', () => {
      const code = `//@version=6
indicator("Text Performance Test")

// Text formatting in loop
for i = 0 to 10
    text = str.format("Value: {0}", i)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-TEXT-PERF-LOOP'] });
    });

    it('should warn on complex text formatting', () => {
      const code = `//@version=6
indicator("Text Performance Test")

// Complex text formatting
complexText = str.format("Price: {0,number,#.##} Volume: {1,number,#,###} Time: {2,date,dd/MM/yyyy}", close, volume, time)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-TEXT-PERF-COMPLEX'] });
    });
  });

  describe('PSV6-TEXT-COMPLEX: Complex Text Scenarios', () => {
    it('should handle nested text formatting', () => {
      const code = `//@version=6
indicator("Complex Text Test")

// Nested text formatting
innerText = str.format("Price: {0}", close)
outerText = str.format("Summary: {0}", innerText)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      // Only check text formatting-specific errors
      const textErrors = result.errors.filter(e => e.code.startsWith('PSV6-TEXT'));
      expect(textErrors).toEqual([]);
    });

    it('should handle text formatting with variables', () => {
      const code = `//@version=6
indicator("Complex Text Test")

// Text formatting with variables
price = close
volume = volume
text = str.format("Price: {0} Volume: {1}", price, volume)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      // Only check text formatting-specific errors
      const textErrors = result.errors.filter(e => e.code.startsWith('PSV6-TEXT'));
      expect(textErrors).toEqual([]);
    });
  });
});
