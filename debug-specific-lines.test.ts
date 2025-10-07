import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Specific Lines', () => {
  it('should show exactly which lines are still being flagged', () => {
    const code = `//@version=6
strategy("Test", overlay = true)

maHigh = if bandType == 1
    ta.ema(high, bandLength)
else if bandType == 2
    ta.sma(high, bandLength)
else
    smma(high, bandLength)

plot(close)`;

    const validator = new EnhancedModularValidator();
    const result = validator.validate(code, { ast: { mode: 'primary' } });

    console.log('\n=== SPECIFIC LINE DEBUG ===');
    const lines = code.split('\n');
    
    const indentErrors = result.errors.filter(e => e.code.includes('INDENT'));
    console.log(`Indentation errors: ${indentErrors.length}`);
    
    indentErrors.forEach((error, i) => {
      console.log(`\n${i + 1}. Line ${error.line}: ${error.code}`);
      console.log(`   Message: ${error.message}`);
      console.log(`   Line content: "${lines[error.line - 1]}"`);
    });
  });
});
