import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Full Script', () => {
  it('should validate the full script without false positive function return type errors', () => {
    const validator = new EnhancedModularValidator();

    // Read the test script
    const fs = require('fs');
    const source = fs.readFileSync('test-full-script.pine', 'utf8');

    const result = validator.validate(source);

    console.log('\n=== DEBUG FULL SCRIPT ===');
    console.log('isValid:', result.isValid);
    console.log('Number of errors:', result.errors.length);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.code}: ${error.message}`);
        console.log(`   Line ${error.line}, Column ${error.column}`);
        
        // Get the actual line content
        const lines = source.split('\n');
        const lineContent = lines[error.line - 1];
        console.log(`   Line content: "${lineContent}"`);
        console.log('');
      });
    }

    // Check for function return type errors specifically
    const functionReturnTypeErrors = result.errors.filter(e => e.code === 'PSV6-FUNCTION-RETURN-TYPE');
    console.log(`\nFunction return type errors: ${functionReturnTypeErrors.length}`);
    
    if (functionReturnTypeErrors.length > 0) {
      console.log('\nFunction return type errors details:');
      functionReturnTypeErrors.forEach((error, i) => {
        console.log(`${i + 1}. Line ${error.line}: ${error.message}`);
        const lines = source.split('\n');
        const lineContent = lines[error.line - 1];
        console.log(`   Line content: "${lineContent}"`);
        
        // Show the function definition
        const functionLine = error.line - 1;
        const functionContent = lines.slice(functionLine, functionLine + 10).join('\n');
        console.log(`   Function definition:\n${functionContent}`);
        console.log('');
      });
    }

    // We expect no function return type errors for these valid functions
    expect(functionReturnTypeErrors).toHaveLength(0);
  });
});
