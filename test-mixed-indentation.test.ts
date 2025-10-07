import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';
import * as fs from 'fs';

describe('Mixed Indentation Detection', () => {
  it('should detect mixed tabs and spaces', () => {
    const validator = new EnhancedModularValidator();
    const source = fs.readFileSync('test-mixed-indentation.pine', 'utf8');

    const result = validator.validate(source);

    console.log('\n=== Mixed Indentation Test ===');
    console.log('isValid:', result.isValid);
    console.log('Total errors:', result.errors.length);
    
    if (result.errors.length > 0) {
      result.errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.code}: ${error.message}`);
        console.log(`   Line ${error.line}, Column ${error.column}`);
      });
    }

    // Should detect mixed indentation error
    const mixedIndentErrors = result.errors.filter(e => 
      e.code === 'PSI02' || e.message.includes('Mixed tabs and spaces')
    );

    console.log(`\nMixed indentation errors: ${mixedIndentErrors.length}`);
    
    expect(mixedIndentErrors.length).toBeGreaterThan(0);
    expect(mixedIndentErrors[0].code).toBe('PSI02');
  });
});
