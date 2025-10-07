/**
 * Tests for Enhanced Error Messages
 */

import { describe, it, expect } from 'vitest';
import {
  CodeSnippetExtractor,
  ErrorMessageFormatter,
  ErrorEnhancer,
  ErrorCategory,
  type EnhancedValidationError,
  type QuickFix
} from '../../core/error-enhancement';
import type { ValidationError } from '../../core/types';

describe('Error Enhancement System', () => {
  describe('CodeSnippetExtractor', () => {
    it('should extract code snippet with context', () => {
      const source = `//@version=6
indicator("Test")
slowEMA ta.ema(close, 35)
fastEMA = ta.sma(close, 10)
plot(close)`;

      const snippet = CodeSnippetExtractor.extract(source, 3, 9, 2);

      expect(snippet.beforeLines).toHaveLength(2);
      expect(snippet.errorLine).toBe('slowEMA ta.ema(close, 35)');
      expect(snippet.afterLines).toHaveLength(2);
      expect(snippet.lineNumbers).toEqual([1, 2, 3, 4, 5]);
      expect(snippet.highlightStart).toBe(9);
      expect(snippet.fullContext).toContain('3 | slowEMA ta.ema(close, 35)');
      expect(snippet.fullContext).toContain('^');
    });

    it('should handle errors at the start of file', () => {
      const source = `indicator("Test")
slowEMA = ta.ema(close, 35)`;

      const snippet = CodeSnippetExtractor.extract(source, 1, 1, 2);

      expect(snippet.beforeLines).toHaveLength(0);
      expect(snippet.errorLine).toBe('indicator("Test")');
      expect(snippet.lineNumbers[0]).toBe(1);
    });

    it('should handle errors at the end of file', () => {
      const source = `//@version=6
indicator("Test")
plot(close)`;

      const snippet = CodeSnippetExtractor.extract(source, 3, 1, 2);

      expect(snippet.afterLines).toHaveLength(0);
      expect(snippet.errorLine).toBe('plot(close)');
    });

    it('should format snippet with line numbers and indicator', () => {
      const source = `//@version=6
indicator("Test")
slowEMA ta.ema(close, 35)`;

      const snippet = CodeSnippetExtractor.extract(source, 3, 9);

      expect(snippet.fullContext).toMatch(/1 \|/);
      expect(snippet.fullContext).toMatch(/2 \|/);
      expect(snippet.fullContext).toMatch(/3 \|/);
      expect(snippet.fullContext).toContain('        ^'); // Column indicator
    });
  });

  describe('ErrorMessageFormatter', () => {
    it('should format error with code snippet', () => {
      const source = `//@version=6
indicator("Test")
slowEMA ta.ema(close, 35)`;

      const error: EnhancedValidationError = {
        line: 3,
        column: 9,
        message: "Missing '=' operator",
        severity: 'error',
        code: 'PSV6-SYNTAX-MISSING-EQUALS',
        suggestion: "Use 'slowEMA = ta.ema(close, 35)' for variable assignment.",
        category: ErrorCategory.SYNTAX,
        codeSnippet: CodeSnippetExtractor.extract(source, 3, 9, 2)
      };

      const formatted = ErrorMessageFormatter.formatWithSnippet(error, source);

      expect(formatted).toContain('❌ Syntax Error');
      expect(formatted).toContain("Missing '=' operator");
      expect(formatted).toContain('PSV6-SYNTAX-MISSING-EQUALS');
      expect(formatted).toContain('line 3, column 9');
      expect(formatted).toContain('3 | slowEMA ta.ema(close, 35)');
      expect(formatted).toContain('^');
      expect(formatted).toContain('💡 Suggestion:');
    });

    it('should format quick fixes', () => {
      const fixes: QuickFix[] = [
        {
          title: 'Add = operator',
          description: 'Insert = between variable name and value',
          edits: [{
            startLine: 3,
            startColumn: 8,
            endLine: 3,
            endColumn: 8,
            newText: ' ='
          }],
          confidence: 'high'
        },
        {
          title: 'Use const declaration',
          description: 'Declare as constant',
          edits: [{
            startLine: 3,
            startColumn: 1,
            endLine: 3,
            endColumn: 1,
            newText: 'const '
          }],
          confidence: 'medium'
        }
      ];

      const formatted = ErrorMessageFormatter.formatQuickFixes(fixes);

      expect(formatted).toContain('🔧 Quick Fixes:');
      expect(formatted).toContain('[HIGH CONFIDENCE]');
      expect(formatted).toContain('[MEDIUM CONFIDENCE]');
      expect(formatted).toContain('Add = operator');
      expect(formatted).toContain('Use const declaration');
    });

    it('should show severity icons correctly', () => {
      const source = 'test';
      
      const error: EnhancedValidationError = {
        line: 1,
        column: 1,
        message: 'Test error',
        severity: 'error',
        codeSnippet: CodeSnippetExtractor.extract(source, 1, 1)
      };

      const warning: EnhancedValidationError = {
        line: 1,
        column: 1,
        message: 'Test warning',
        severity: 'warning',
        codeSnippet: CodeSnippetExtractor.extract(source, 1, 1)
      };

      const info: EnhancedValidationError = {
        line: 1,
        column: 1,
        message: 'Test info',
        severity: 'info',
        codeSnippet: CodeSnippetExtractor.extract(source, 1, 1)
      };

      expect(ErrorMessageFormatter.formatWithSnippet(error, source)).toContain('❌');
      expect(ErrorMessageFormatter.formatWithSnippet(warning, source)).toContain('⚠️');
      expect(ErrorMessageFormatter.formatWithSnippet(info, source)).toContain('ℹ️');
    });
  });

  describe('ErrorEnhancer', () => {
    it('should enhance basic error with full context', () => {
      const source = `//@version=6
indicator("Test")
slowEMA ta.ema(close, 35)
fastEMA = ta.sma(close, 10)`;

      const basicError: ValidationError = {
        line: 3,
        column: 9,
        message: "Missing '=' operator",
        severity: 'error',
        code: 'PSV6-SYNTAX-MISSING-EQUALS',
        suggestion: "Use 'slowEMA = ta.ema(close, 35)' for variable assignment."
      };

      const enhanced = ErrorEnhancer.enhance(basicError, source);

      expect(enhanced.codeSnippet).toBeDefined();
      expect(enhanced.context).toBeDefined();
      expect(enhanced.category).toBe(ErrorCategory.SYNTAX);
      expect(enhanced.documentation).toBeDefined();
      expect(enhanced.documentation?.title).toBe('Variable Declarations');
      expect(enhanced.explanation).toBeDefined();
      expect(enhanced.formattedMessage).toBeDefined();
    });

    it('should detect function context', () => {
      const source = `//@version=6
indicator("Test")
myFunc() =>
    value ta.ema(close, 35)
    value`;

      const error: ValidationError = {
        line: 4,
        column: 11,
        message: "Missing '=' operator",
        severity: 'error',
        code: 'PSV6-SYNTAX-MISSING-EQUALS'
      };

      const enhanced = ErrorEnhancer.enhance(error, source);

      expect(enhanced.context?.functionName).toBe('myFunc');
      expect(enhanced.context?.blockType).toBe('function');
      expect(enhanced.formattedMessage).toContain("in function 'myFunc'");
    });

    it('should categorize errors correctly', () => {
      const source = 'test';

      const syntaxError = ErrorEnhancer.enhance({
        line: 1,
        column: 1,
        message: 'Syntax error',
        severity: 'error',
        code: 'PSV6-SYNTAX-ERROR'
      }, source);

      const typeError = ErrorEnhancer.enhance({
        line: 1,
        column: 1,
        message: 'Type error',
        severity: 'error',
        code: 'PSV6-TYPE-MISMATCH'
      }, source);

      const perfWarning = ErrorEnhancer.enhance({
        line: 1,
        column: 1,
        message: 'Performance warning',
        severity: 'warning',
        code: 'PSV6-PERF-LOOP'
      }, source);

      expect(syntaxError.category).toBe(ErrorCategory.SYNTAX);
      expect(typeError.category).toBe(ErrorCategory.TYPE);
      expect(perfWarning.category).toBe(ErrorCategory.PERFORMANCE);
    });

    it('should include documentation links for known errors', () => {
      const source = 'test';

      const enhanced = ErrorEnhancer.enhance({
        line: 1,
        column: 1,
        message: 'Missing equals',
        severity: 'error',
        code: 'PSV6-SYNTAX-MISSING-EQUALS'
      }, source);

      expect(enhanced.documentation).toBeDefined();
      expect(enhanced.documentation?.url).toContain('tradingview.com');
      expect(enhanced.formattedMessage).toContain('📚');
    });

    it('should include explanations for common errors', () => {
      const source = 'test';

      const enhanced = ErrorEnhancer.enhance({
        line: 1,
        column: 1,
        message: 'Incorrect conditional operator order',
        severity: 'error',
        code: 'PSV6-SYNTAX-CONDITIONAL-ORDER'
      }, source);

      expect(enhanced.explanation).toBeDefined();
      expect(enhanced.explanation).toContain('condition ? value_if_true : value_if_false');
      expect(enhanced.formattedMessage).toContain('❓ Why is this an error?');
    });

    it('should create complete formatted message', () => {
      const source = `//@version=6
indicator("Test")
slowEMA ta.ema(close, 35)`;

      const error: ValidationError = {
        line: 3,
        column: 9,
        message: "Missing '=' operator",
        severity: 'error',
        code: 'PSV6-SYNTAX-MISSING-EQUALS',
        suggestion: "Use 'slowEMA = ta.ema(close, 35)' for variable assignment."
      };

      const enhanced = ErrorEnhancer.enhance(error, source);

      // Check all components are present
      expect(enhanced.formattedMessage).toContain('❌ Syntax Error');
      expect(enhanced.formattedMessage).toContain('line 3, column 9');
      expect(enhanced.formattedMessage).toContain('3 | slowEMA ta.ema(close, 35)');
      expect(enhanced.formattedMessage).toContain('^');
      expect(enhanced.formattedMessage).toContain('💡 Suggestion:');
      expect(enhanced.formattedMessage).toContain('❓ Why is this an error?');
      expect(enhanced.formattedMessage).toContain('📚 Variable Declarations');
      expect(enhanced.formattedMessage).toContain('tradingview.com');
    });
  });

  describe('Real-World Examples', () => {
    it('should format missing equals error beautifully', () => {
      const source = `//@version=6
indicator("My Indicator")
quickEMA = ta.ema(close, 10)
slowEMA ta.ema(close, 35)
plot(quickEMA)`;

      const error: ValidationError = {
        line: 4,
        column: 9,
        message: "Missing '=' operator",
        severity: 'error',
        code: 'PSV6-SYNTAX-MISSING-EQUALS',
        suggestion: "Use 'slowEMA = ta.ema(close, 35)' for variable assignment."
      };

      const enhanced = ErrorEnhancer.enhance(error, source, 2);
      
      console.log('\n' + '='.repeat(80));
      console.log('ENHANCED ERROR MESSAGE EXAMPLE:');
      console.log('='.repeat(80));
      console.log(enhanced.formattedMessage);
      console.log('='.repeat(80) + '\n');

      expect(enhanced.formattedMessage).toBeTruthy();
    });

    it('should format conditional operator error beautifully', () => {
      const source = `//@version=6
indicator("Test")
color = close > open : color.green ? color.red
plot(close, color=color)`;

      const error: ValidationError = {
        line: 3,
        column: 23,
        message: "Incorrect conditional operator order",
        severity: 'error',
        code: 'PSV6-SYNTAX-CONDITIONAL-ORDER',
        suggestion: "Use 'condition ? value_if_true : value_if_false'."
      };

      const enhanced = ErrorEnhancer.enhance(error, source, 2);
      
      console.log('\n' + '='.repeat(80));
      console.log('ENHANCED ERROR MESSAGE EXAMPLE:');
      console.log('='.repeat(80));
      console.log(enhanced.formattedMessage);
      console.log('='.repeat(80) + '\n');

      expect(enhanced.formattedMessage).toBeTruthy();
    });
  });
});
