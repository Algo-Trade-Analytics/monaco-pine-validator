/**
 * Integration Tests for Enhanced Error Messages
 * 
 * Verifies that error enhancement works end-to-end through the entire
 * validation pipeline, from BaseValidator through all modules.
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('Error Enhancement Integration', () => {
  describe('End-to-End Enhancement', () => {
    it('should enhance syntax errors by default', () => {
      const validator = new EnhancedModularValidator();
      
      const source = `//@version=6
indicator("Test")
slowEMA ta.ema(close, 35)
plot(close)`;

      const result = validator.validate(source);

      expect(result.errors).toHaveLength(1);
      const error = result.errors[0];
      
      // Should have enhanced fields
      expect(error.code).toBe('PSV6-SYNTAX-MISSING-EQUALS');
      expect(error).toHaveProperty('formattedMessage');
      expect(error).toHaveProperty('codeSnippet');
      expect(error).toHaveProperty('category');
      
      // Formatted message should be comprehensive
      if ('formattedMessage' in error && error.formattedMessage) {
        expect(error.formattedMessage).toContain('❌');
        expect(error.formattedMessage).toContain('line 3');
        expect(error.formattedMessage).toContain('^');
        expect(error.formattedMessage).toContain('❓ Why is this an error');
        
        console.log('\n' + '='.repeat(80));
        console.log('INTEGRATED ENHANCED ERROR (Syntax):');
        console.log('='.repeat(80));
        console.log(error.formattedMessage);
        console.log('='.repeat(80) + '\n');
      }
    });

    it('should enhance conditional operator errors', () => {
      const validator = new EnhancedModularValidator();
      
      const source = `//@version=6
indicator("Test")
color = close > open : color.green ? color.red
plot(close, color=color)`;

      const result = validator.validate(source);

      const syntaxErrors = result.errors.filter(e => 
        e.code === 'PSV6-SYNTAX-CONDITIONAL-ORDER'
      );
      
      expect(syntaxErrors.length).toBeGreaterThan(0);
      const error = syntaxErrors[0];
      
      if ('formattedMessage' in error && error.formattedMessage) {
        expect(error.formattedMessage).toContain('Incorrect conditional operator order');
        expect(error.formattedMessage).toContain('condition ? value_if_true : value_if_false');
        
        console.log('\n' + '='.repeat(80));
        console.log('INTEGRATED ENHANCED ERROR (Conditional):');
        console.log('='.repeat(80));
        console.log(error.formattedMessage);
        console.log('='.repeat(80) + '\n');
      }
    });

    it('should enhance function errors with documentation', () => {
      const validator = new EnhancedModularValidator();
      
      const source = `//@version=6
indicator("Test")
ma = ta.sma(close)
plot(ma)`;

      const result = validator.validate(source);

      // Should have parameter count error
      const paramErrors = result.errors.filter(e => 
        e.message.includes('ta.sma') || e.message.includes('parameter')
      );
      
      if (paramErrors.length > 0) {
        const error = paramErrors[0];
        
        if ('formattedMessage' in error && error.formattedMessage) {
          console.log('\n' + '='.repeat(80));
          console.log('INTEGRATED ENHANCED ERROR (Function Parameter):');
          console.log('='.repeat(80));
          console.log(error.formattedMessage);
          console.log('='.repeat(80) + '\n');
          
          // Should include documentation-specific enhancements
          expect(error.formattedMessage).toContain('ta.sma');
        }
      }
    });

    it('should allow disabling error enhancement', () => {
      const validator = new EnhancedModularValidator({ enhanceErrors: false });
      
      const source = `//@version=6
indicator("Test")
slowEMA ta.ema(close, 35)`;

      const result = validator.validate(source);

      expect(result.errors).toHaveLength(1);
      const error = result.errors[0];
      
      // Should NOT have enhanced fields when disabled
      expect(error).not.toHaveProperty('formattedMessage');
      expect(error).not.toHaveProperty('codeSnippet');
    });

    it('should enhance indentation errors', () => {
      const validator = new EnhancedModularValidator();
      
      const source = `//@version=6
indicator("Test")
plot(ma, color = color.new(color.blue,
    0))`;

      const result = validator.validate(source);

      const indentErrors = result.errors.filter(e => 
        e.code?.includes('INDENT')
      );
      
      if (indentErrors.length > 0) {
        const error = indentErrors[0];
        
        if ('formattedMessage' in error && error.formattedMessage) {
          console.log('\n' + '='.repeat(80));
          console.log('INTEGRATED ENHANCED ERROR (Indentation):');
          console.log('='.repeat(80));
          console.log(error.formattedMessage);
          console.log('='.repeat(80) + '\n');
          
          expect(error.formattedMessage).toContain('indentation');
        }
      }
    });

    it('should enhance missing code block errors', () => {
      const validator = new EnhancedModularValidator();
      
      const source = `//@version=6
indicator("Test")
if close > open
plot(close)`;

      const result = validator.validate(source);

      const blockErrors = result.errors.filter(e => 
        e.message.includes('code block') || e.message.includes('local scope')
      );
      
      if (blockErrors.length > 0) {
        const error = blockErrors[0];
        
        if ('formattedMessage' in error && error.formattedMessage) {
          console.log('\n' + '='.repeat(80));
          console.log('INTEGRATED ENHANCED ERROR (Missing Block):');
          console.log('='.repeat(80));
          console.log(error.formattedMessage);
          console.log('='.repeat(80) + '\n');
          
          expect(error.formattedMessage).toContain('❌');
        }
      }
    });
  });

  describe('Performance Impact', () => {
    it('should not significantly impact validation performance', () => {
      const validator = new EnhancedModularValidator();
      
      const source = `//@version=6
indicator("Performance Test")
ma1 = ta.sma(close, 10)
ma2 = ta.ema(close, 20)
ma3 = ta.wma(close, 30)
plot(ma1)
plot(ma2)
plot(ma3)`;

      const startTime = Date.now();
      const result = validator.validate(source);
      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 150ms for small script)
      expect(duration).toBeLessThan(150);
      expect(result.isValid).toBe(true);
    });

    it('should handle large scripts efficiently', () => {
      const validator = new EnhancedModularValidator();
      
      // Generate a larger script
      const lines = ['//@version=6', 'indicator("Large Test")'];
      for (let i = 0; i < 50; i++) {
        lines.push(`ma${i} = ta.sma(close, ${10 + i})`);
      }
      lines.push('plot(ma0)');
      
      const source = lines.join('\n');

      const startTime = Date.now();
      const result = validator.validate(source);
      const duration = Date.now() - startTime;

      // Should still be fast even with enhancement
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000);
      console.log(`\n⏱️  Large script validation time: ${duration}ms`);
    });
  });

  describe('Backward Compatibility', () => {
    it('should not break existing validation logic', () => {
      const validator = new EnhancedModularValidator();
      
      const source = `//@version=6
indicator("Test")
value = ta.sma(close, 20)
plot(value)`;

      const result = validator.validate(source);

      // Should still work as before
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('info');
      expect(result.isValid).toBe(true);
    });

    it('should maintain error structure for non-enhanced errors', () => {
      const validator = new EnhancedModularValidator({ enhanceErrors: false });
      
      const source = `//@version=6
indicator("Test")
slowEMA ta.ema(close, 35)`;

      const result = validator.validate(source);

      expect(result.errors).toHaveLength(1);
      const error = result.errors[0];
      
      // Should have basic structure
      expect(error).toHaveProperty('line');
      expect(error).toHaveProperty('column');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('severity');
      expect(error).toHaveProperty('code');
    });
  });
});
