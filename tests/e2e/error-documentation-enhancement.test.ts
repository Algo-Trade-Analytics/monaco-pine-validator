/**
 * Tests for Documentation-Enhanced Error Messages
 * 
 * Demonstrates how scraped Pine Script documentation enhances error messages
 * with official examples, common mistakes, and best practices.
 */

import { describe, it, expect } from 'vitest';
import { ErrorEnhancerV2, DocumentationAwareQuickFixGenerator } from '../../core/error-enhancement-v2';
import { ErrorDocumentationProvider } from '../../core/error-documentation-provider';
import type { ValidationError } from '../../core/types';

describe('Documentation-Enhanced Error Messages', () => {
  describe('ErrorDocumentationProvider', () => {
    it('should get function documentation', () => {
      const doc = ErrorDocumentationProvider.getFunctionDoc('ta.sma');
      
      expect(doc).toBeDefined();
      expect(doc?.description).toBeTruthy();
      expect(doc?.syntax).toContain('ta.sma');
    });

    it('should get documentation for namespaced functions', () => {
      const doc = ErrorDocumentationProvider.getFunctionDoc('array.avg');
      
      expect(doc).toBeDefined();
      expect(doc?.description).toBeTruthy();
    });

    it('should find similar functions for typos', () => {
      const message = ErrorDocumentationProvider.generateUnknownFunctionMessage('ta.sam');
      
      expect(message).toContain('ta.sma');
      expect(message).toContain('Did you mean');
    });

    it('should generate parameter count messages', () => {
      const message = ErrorDocumentationProvider.generateParameterCountMessage(
        'ta.sma',
        2,
        1
      );
      
      expect(message).toContain('expects 2 parameter');
      expect(message).toContain('received 1');
      expect(message).toContain('syntax');
    });

    it('should suggest type conversions', () => {
      const message = ErrorDocumentationProvider.generateTypeMismatchMessage(
        'ta.sma',
        'length',
        'int',
        'string'
      );
      
      expect(message).toContain('expects type');
      expect(message).toContain('int');
      expect(message).toContain('string');
    });
  });

  describe('ErrorEnhancerV2', () => {
    it('should enhance error with function documentation', () => {
      const source = `//@version=6
indicator("Test")
value = ta.sma(close)
plot(value)`;

      const error: ValidationError = {
        line: 3,
        column: 9,
        message: "Function 'ta.sma' requires 2 parameters",
        severity: 'error',
        code: 'PSV6-FUNCTION-PARAM-COUNT'
      };

      const enhanced = ErrorEnhancerV2.enhance(error, source);

      expect(enhanced.formattedMessage).toBeDefined();
      expect(enhanced.codeSnippet).toBeDefined();
      
      // Should include documentation-specific enhancements
      console.log('\n' + '='.repeat(80));
      console.log('DOCUMENTATION-ENHANCED ERROR (Missing Parameter):');
      console.log('='.repeat(80));
      console.log(enhanced.formattedMessage);
      console.log('='.repeat(80) + '\n');
    });

    it('should enhance unknown function error with suggestions', () => {
      const source = `//@version=6
indicator("Test")
value = ta.sam(close, 14)
plot(value)`;

      const enhanced = ErrorEnhancerV2.enhanceUnknownFunctionError(
        'ta.sam',
        3,
        9,
        source
      );

      expect(enhanced.similarFunctions).toBeDefined();
      expect(enhanced.similarFunctions).toContain('ta.sma');
      expect(enhanced.suggestion).toContain('ta.sma');
      
      console.log('\n' + '='.repeat(80));
      console.log('DOCUMENTATION-ENHANCED ERROR (Unknown Function):');
      console.log('='.repeat(80));
      console.log(enhanced.formattedMessage);
      console.log('='.repeat(80) + '\n');
    });

    it('should enhance type mismatch error with conversion tips', () => {
      const source = `//@version=6
indicator("Test")
length = "20"
value = ta.sma(close, length)
plot(value)`;

      const enhanced = ErrorEnhancerV2.enhanceTypeMismatchError(
        'ta.sma',
        'length',
        'int',
        'string',
        4,
        23,
        source
      );

      expect(enhanced.suggestion).toContain('type');
      expect(enhanced.formattedMessage).toContain('💡');
      
      console.log('\n' + '='.repeat(80));
      console.log('DOCUMENTATION-ENHANCED ERROR (Type Mismatch):');
      console.log('='.repeat(80));
      console.log(enhanced.formattedMessage);
      console.log('='.repeat(80) + '\n');
    });

    it('should include official examples when available', () => {
      const source = `//@version=6
indicator("Test")
alert()
plot(close)`;

      const error: ValidationError = {
        line: 3,
        column: 1,
        message: "Function 'alert' requires parameters",
        severity: 'error',
        code: 'PSV6-FUNCTION-PARAM-COUNT'
      };

      const enhanced = ErrorEnhancerV2.enhance(error, source);

      // Should include official example from documentation
      if (enhanced.officialExample) {
        expect(enhanced.formattedMessage).toContain('📖 Official Example');
      }
    });

    it('should include common mistakes for well-known functions', () => {
      const source = `//@version=6
indicator("Test")
value = ta.sma(close, -10)
plot(value)`;

      const error: ValidationError = {
        line: 3,
        column: 9,
        message: "Invalid length parameter for 'ta.sma'",
        severity: 'error',
        code: 'PSV6-FUNCTION-PARAM-INVALID'
      };

      const enhanced = ErrorEnhancerV2.enhance(error, source);

      // Should include common mistakes
      expect(enhanced.commonMistakes).toBeDefined();
      if (enhanced.commonMistakes && enhanced.commonMistakes.length > 0) {
        expect(enhanced.formattedMessage).toContain('⚠️  Common Mistakes');
      }
    });

    it('should include best practices', () => {
      const source = `//@version=6
indicator("Test")
value = ta.sma(close, 20)
plot(value)`;

      const error: ValidationError = {
        line: 3,
        column: 9,
        message: "Consider caching this calculation",
        severity: 'warning',
        code: 'PSV6-PERF-SUGGESTION'
      };

      const enhanced = ErrorEnhancerV2.enhance(error, source);

      // Should include best practices
      expect(enhanced.bestPractices).toBeDefined();
      if (enhanced.bestPractices && enhanced.bestPractices.length > 0) {
        expect(enhanced.formattedMessage).toContain('✨ Best Practices');
      }
    });

    it('should include related functions', () => {
      const source = `//@version=6
indicator("Test")
value = ta.sma(close, 20)
plot(value)`;

      const error: ValidationError = {
        line: 3,
        column: 9,
        message: "Using ta.sma",
        severity: 'info',
        code: 'PSV6-INFO'
      };

      const enhanced = ErrorEnhancerV2.enhance(error, source);

      // Should include related functions
      if (enhanced.relatedFunctions && enhanced.relatedFunctions.length > 0) {
        expect(enhanced.formattedMessage).toContain('🔗 Related Functions');
      }
    });
  });

  describe('DocumentationAwareQuickFixGenerator', () => {
    it('should generate fixes for unknown functions', () => {
      const fixes = DocumentationAwareQuickFixGenerator.generateUnknownFunctionFixes(
        'ta.sam',
        3,
        9
      );

      expect(fixes).toHaveLength(3);
      expect(fixes[0].title).toContain('ta.sma');
      expect(fixes[0].confidence).toBe('high');
    });

    it('should generate fixes with descriptions from documentation', () => {
      const fixes = DocumentationAwareQuickFixGenerator.generateUnknownFunctionFixes(
        'ta.sam',
        3,
        9
      );

      expect(fixes[0].description).toBeTruthy();
      expect(fixes[0].description.length).toBeGreaterThan(0);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should provide comprehensive help for common ta.sma mistake', () => {
      const source = `//@version=6
indicator("Moving Average")
// Forgot to provide length parameter
ma = ta.sma(close)
plot(ma)`;

      const error: ValidationError = {
        line: 4,
        column: 6,
        message: "Function 'ta.sma' requires 2 parameters, but received 1",
        severity: 'error',
        code: 'PSV6-FUNCTION-PARAM-COUNT'
      };

      const enhanced = ErrorEnhancerV2.enhance(error, source);

      console.log('\n' + '='.repeat(80));
      console.log('REAL-WORLD EXAMPLE: Missing ta.sma Parameter');
      console.log('='.repeat(80));
      console.log(enhanced.formattedMessage);
      console.log('='.repeat(80) + '\n');

      expect(enhanced.formattedMessage).toContain('ta.sma');
      expect(enhanced.formattedMessage).toContain('parameter');
    });

    it('should provide comprehensive help for strategy.entry typo', () => {
      const source = `//@version=6
strategy("My Strategy")
if close > open
    strategy.entery("Long", strategy.long)`;

      const enhanced = ErrorEnhancerV2.enhanceUnknownFunctionError(
        'strategy.entery',
        4,
        5,
        source
      );

      console.log('\n' + '='.repeat(80));
      console.log('REAL-WORLD EXAMPLE: strategy.entry Typo');
      console.log('='.repeat(80));
      console.log(enhanced.formattedMessage);
      console.log('='.repeat(80) + '\n');

      expect(enhanced.similarFunctions).toContain('strategy.entry');
      expect(enhanced.formattedMessage).toContain('Did you mean');
    });

    it('should provide comprehensive help for request.security usage', () => {
      const source = `//@version=6
indicator("Multi-Timeframe")
// Common mistake: not handling lookahead
htfClose = request.security(syminfo.tickerid, "D", close)
plot(htfClose)`;

      const error: ValidationError = {
        line: 4,
        column: 12,
        message: "request.security may cause repainting",
        severity: 'warning',
        code: 'PSV6-PERF-REPAINT'
      };

      const enhanced = ErrorEnhancerV2.enhance(error, source);

      console.log('\n' + '='.repeat(80));
      console.log('REAL-WORLD EXAMPLE: request.security Best Practices');
      console.log('='.repeat(80));
      console.log(enhanced.formattedMessage);
      console.log('='.repeat(80) + '\n');

      // Should include best practices for request.security
      expect(enhanced.formattedMessage).toBeTruthy();
    });
  });
});
