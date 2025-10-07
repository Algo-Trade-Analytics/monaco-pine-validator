import { describe, it, expect } from 'vitest';

describe('Debug Line by Line', () => {
  it('should debug each line pair to understand the issue', () => {
    const lines = [
      'maHigh = if bandType == 1',
      '    ta.ema(high, bandLength)  // EMA for High (fast, more noise)',
      'else if bandType == 2',
      '    ta.sma(high, bandLength)  // SMA for High (medium, balanced)',
      'else',
      '    smma(high, bandLength)    // SMMA for High (slow, very smooth)',
    ];

    // Simulate the logic from syntax-pre-checker.ts
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1];
      
      const lineIndent = line.match(/^(\s*)/)?.[0].replace(/\t/g, '    ').length || 0;
      const trimmed = line.trim();
      const nextTrimmed = nextLine.trim();
      
      console.log(`\n--- Line pair ${i + 1} -> ${i + 2} ---`);
      console.log(`Line ${i + 1}: "${line}"`);
      console.log(`Line ${i + 2}: "${nextLine}"`);
      console.log(`Line indent: ${lineIndent}`);
      console.log(`Trimmed: "${trimmed}"`);
      console.log(`Next trimmed: "${nextTrimmed}"`);
      
      // Skip comments and empty lines
      if (trimmed.startsWith('//') || trimmed === '' || nextTrimmed.startsWith('//') || nextTrimmed === '') {
        console.log('SKIPPED: Comment or empty line');
        continue;
      }
      
      // Check if next line is block statement or if expression part
      const isBlockStatement = /^\s*(if|else\s+if|else|for|while|switch|case|default)\s/.test(nextTrimmed);
      const isIfExpressionPart = /^\s*(else\s+if|else)(\s|$)/.test(nextTrimmed);
      console.log(`Is block statement: ${isBlockStatement}`);
      console.log(`Is if expression part: ${isIfExpressionPart}`);
      
      if (isBlockStatement || isIfExpressionPart) {
        console.log('SKIPPED: Block statement or if expression part');
        continue;
      }
      
      // Check for continuation hints
      const hasContinuationHint = (text: string): boolean => {
        const withoutComment = text.split('//')[0];
        const trimmed = withoutComment.trimEnd();
        if (trimmed.trim() === '') return false;
        
        const lowerTrimmed = trimmed.toLowerCase();
        const CONTINUATION_SYMBOL_HINTS = ['(', '[', '{', '+', '-', '*', '/', '%', '?', ':', '<', '>', '&', '|', '^', '.', '='];
        const lastChar = trimmed.charAt(trimmed.length - 1);
        
        return CONTINUATION_SYMBOL_HINTS.includes(lastChar);
      };
      
      const continuationHint = hasContinuationHint(trimmed);
      console.log(`Has continuation hint: ${continuationHint}`);
      
      if (continuationHint) {
        const nextIndent = nextLine.match(/^(\s*)/)?.[0].replace(/\t/g, '    ').length || 0;
        console.log(`Next indent: ${nextIndent}`);
        console.log(`Next indent % 4: ${nextIndent % 4}`);
        
        if (lineIndent === 0 && nextIndent % 4 === 0) {
          console.log('WOULD FLAG: Line continuation at multiple of 4');
        }
      }
    }
  });
});
