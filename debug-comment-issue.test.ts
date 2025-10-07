import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Comment Issue', () => {
  it('should not flag comment lines as missing commas', () => {
    const validator = new EnhancedModularValidator();

    const source = `//@version=6
strategy("Test", overlay = true)

// EMA for High (fast, more noise)
// EMA for Low (fast, more noise)
// SMA for High (medium, very smooth)
// SMA for Low (medium, very smooth)

plot(close)`;

    const result = validator.validate(source);

    console.log('\n=== DEBUG COMMENT ISSUE ===');
    console.log('isValid:', result.isValid);
    console.log('Number of errors:', result.errors.length);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.code}: ${error.message}`);
        console.log(`   Line ${error.line}, Column ${error.column}`);
        console.log(`   Line content: "${source.split('\\n')[error.line - 1]}"`);
      });
    }

    // Should have no missing comma errors for comment lines
    const missingCommaErrors = result.errors.filter(e => e.code === 'PSV6-SYNTAX-MISSING-COMMA');
    expect(missingCommaErrors).toHaveLength(0);
  });
});
