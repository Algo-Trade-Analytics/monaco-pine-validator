import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Comment and Logical Operator Fix', () => {
  it('should not flag comments or logical operators as missing commas', () => {
    const validator = new EnhancedModularValidator();

    const source = `//@version=6
strategy("Test", overlay = true)

// Test comments that should NOT be flagged
// more noise
// very smooth

// Test logical operators that should NOT be flagged
test1 = true and false
test2 = true or false
test3 = not true

// Test array constructor with logical operators
testArray = array.from(
    true and false,
    true or false,
    not true
)

plot(close)`;

    const result = validator.validate(source);

    console.log('\n=== COMMENT AND LOGICAL OP TEST ===');
    console.log('isValid:', result.isValid);
    console.log('Number of errors:', result.errors.length);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.code}: ${error.message}`);
        console.log(`   Line ${error.line}, Column ${error.column}`);
      });
    }

    // Should have no missing comma errors
    const missingCommaErrors = result.errors.filter(e => e.code === 'PSV6-SYNTAX-MISSING-COMMA');
    expect(missingCommaErrors).toHaveLength(0);
  });
});
