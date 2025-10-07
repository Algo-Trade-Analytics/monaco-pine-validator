import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Line Continuation Issue', () => {
  it('should debug the specific line continuation errors', () => {
    const code = `//@version=6
strategy("Test", overlay = true)

maHigh = if bandType == 1
    ta.ema(high, bandLength)  // EMA for High (fast, more noise)
else if bandType == 2
    ta.sma(high, bandLength)  // SMA for High (medium, balanced)
else
    smma(high, bandLength)    // SMMA for High (slow, very smooth)

maLow = if bandType == 1
    ta.ema(low, bandLength)   // EMA for Low (fast, more noise)
else if bandType == 2
    ta.sma(low, bandLength)   // SMA for Low (medium, balanced)
else
    smma(low, bandLength)     // SMMA for Low (slow, very smooth)

plot(close)`;

    const validator = new EnhancedModularValidator();
    const result = validator.validate(code);

    console.log('\n=== DEBUG LINE CONTINUATION ===');
    console.log('Total errors:', result.errors.length);
    result.errors.forEach((e, i) => {
      console.log(`${i + 1}. Line ${e.line}: ${e.code} - ${e.message}`);
    });

    const indentErrors = result.errors.filter(e => e.code.includes('INDENT'));
    console.log('\nIndentation errors:', indentErrors.length);
  });
});
