import { describe, it, expect } from 'vitest';

describe('Debug Regex Pattern', () => {
  it('should test the regex pattern for block statements', () => {
    const lines = [
      'maHigh = if bandType == 1',
      '    ta.ema(high, bandLength)  // EMA for High (fast, more noise)',
      'else if bandType == 2',
      '    ta.sma(high, bandLength)  // SMA for High (medium, balanced)',
      'else',
      '    smma(high, bandLength)    // SMMA for High (slow, very smooth)',
    ];

    const blockStatementPattern = /^\s*(if|else\s+if|else|for|while|switch|case|default)\s/;
    
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      const isBlockStatement = blockStatementPattern.test(trimmed);
      console.log(`Line ${i + 1}: "${line}"`);
      console.log(`  Trimmed: "${trimmed}"`);
      console.log(`  Is block statement: ${isBlockStatement}`);
      console.log('');
    });
  });
});
