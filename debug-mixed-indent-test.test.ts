import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Mixed Indent Test', () => {
  it('should debug the failing test case', () => {
    const code = `//@version=6
indicator("Test")
\tif close > open
\t    plot(close)
    
value = input.int(10, title="Test",
     tooltip="Description")`;

    const validator = new EnhancedModularValidator();
    const result = validator.validate(code);

    console.log('\n=== DEBUG ===');
    console.log('Total errors:', result.errors.length);
    result.errors.forEach((e, i) => {
      console.log(`${i + 1}. Line ${e.line}: ${e.code} - ${e.message}`);
    });

    const mixedIndentErrors = result.errors.filter(e => e.code === 'PSI02');
    console.log('\nPSI02 errors:', mixedIndentErrors.length);
  });
});
