import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Disable Pre-Checker', () => {
  it('should test with syntax pre-checker disabled', () => {
    const code = `//@version=6
strategy("Test", overlay = true)

maHigh = if bandType == 1
    ta.ema(high, bandLength)
else if bandType == 2
    ta.sma(high, bandLength)
else
    smma(high, bandLength)

plot(close)`;

    // Create a validator and manually disable pre-checking
    const validator = new EnhancedModularValidator();
    
    // Override the preCheckSyntax method to return empty array
    const originalPreCheck = require('../core/ast/syntax-pre-checker').preCheckSyntax;
    require('../core/ast/syntax-pre-checker').preCheckSyntax = () => [];
    
    try {
      const result = validator.validate(code, { ast: { mode: 'primary' } });
      
      console.log('\n=== WITH PRE-CHECKER DISABLED ===');
      console.log('Total errors:', result.errors.length);
      const indentErrors = result.errors.filter(e => e.code.includes('INDENT'));
      console.log('Indentation errors:', indentErrors.length);
      
      if (indentErrors.length === 0) {
        console.log('✅ All indentation errors are coming from syntax pre-checker');
      } else {
        console.log('❌ Some indentation errors are coming from AST validator');
        indentErrors.forEach((e, i) => {
          console.log(`${i + 1}. Line ${e.line}: ${e.code} - ${e.message}`);
        });
      }
    } finally {
      // Restore original function
      require('../core/ast/syntax-pre-checker').preCheckSyntax = originalPreCheck;
    }
  });
});
