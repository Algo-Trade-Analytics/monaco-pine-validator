import { describe, it, expect } from 'vitest';
import { preCheckSyntax } from '../../core/ast/syntax-pre-checker';

describe('Debug Simple Pre-Checker', () => {
  it('should test preCheckSyntax directly', () => {
    const code = `//@version=6
strategy("Test", overlay = true)

maHigh = if bandType == 1
    ta.ema(high, bandLength)
else if bandType == 2
    ta.sma(high, bandLength)
else
    smma(high, bandLength)

plot(close)`;

    console.log('\n=== DIRECT PRE-CHECKER TEST ===');
    const errors = preCheckSyntax(code);
    
    console.log('Total pre-checker errors:', errors.length);
    const indentErrors = errors.filter(e => e.code.includes('INDENT'));
    console.log('Pre-checker indentation errors:', indentErrors.length);
    
    indentErrors.forEach((error, i) => {
      console.log(`${i + 1}. Line ${error.line}: ${error.code} - ${error.message}`);
    });
    
    // Test the specific lines that should be skipped
    const lines = code.split('\n');
    console.log('\n=== LINE ANALYSIS ===');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      console.log(`Line ${i + 1}: "${trimmed}"`);
    });
  });
});
