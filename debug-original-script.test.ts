import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Original Script', () => {
  it('should validate the original script without false positive comma errors', () => {
    const validator = new EnhancedModularValidator();

    // Read the test script
    const fs = require('fs');
    const source = fs.readFileSync('test-original-script.pine', 'utf8');

    const result = validator.validate(source);

    console.log('\n=== DEBUG ORIGINAL SCRIPT ===');
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
        
        // Check if it's a comment line
        const trimmed = lineContent.trim();
        console.log(`   Is comment: ${trimmed.startsWith('//')}`);
        console.log('');
      });
    }

    // Check for missing comma errors specifically
    const missingCommaErrors = result.errors.filter(e => e.code === 'PSV6-SYNTAX-MISSING-COMMA');
    console.log(`\nMissing comma errors: ${missingCommaErrors.length}`);
    
    if (missingCommaErrors.length > 0) {
      console.log('\nMissing comma errors details:');
      missingCommaErrors.forEach((error, i) => {
        console.log(`${i + 1}. Line ${error.line}: ${error.message}`);
        const lines = source.split('\n');
        const lineContent = lines[error.line - 1];
        console.log(`   Line content: "${lineContent}"`);
        console.log(`   Is comment: ${lineContent.trim().startsWith('//')}`);
      });
    }

    // We expect some errors but not false positive comma errors on comment lines
    const commentLineCommaErrors = missingCommaErrors.filter(error => {
      const lines = source.split('\n');
      const lineContent = lines[error.line - 1];
      return lineContent.trim().startsWith('//');
    });
    
    expect(commentLineCommaErrors).toHaveLength(0);
  });
});
