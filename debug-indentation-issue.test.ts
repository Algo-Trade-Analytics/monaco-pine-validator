import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Indentation Issue', () => {
  it('should detect invalid indentation for line continuation', () => {
    const validator = new EnhancedModularValidator();

    // Read the test script
    const fs = require('fs');
    const source = fs.readFileSync('test-indentation-issue.pine', 'utf8');

    const result = validator.validate(source);

    console.log('\n=== DEBUG INDENTATION ISSUE ===');
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

    // Check for indentation errors specifically
    const indentationErrors = result.errors.filter(e => 
      e.code.includes('INDENT') || e.code.includes('WRAP')
    );
    console.log(`\nIndentation errors: ${indentationErrors.length}`);
    
    if (indentationErrors.length > 0) {
      console.log('\nIndentation errors details:');
      indentationErrors.forEach((error, i) => {
        console.log(`${i + 1}. Line ${error.line}: ${error.message}`);
        const lines = source.split('\n');
        const lineContent = lines[error.line - 1];
        console.log(`   Line content: "${lineContent}"`);
      });
    }

    // We expect indentation errors for the invalid line continuation
    expect(indentationErrors.length).toBeGreaterThan(0);
  });
});
