import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Enhanced Disabled', () => {
  it('should error on incorrect string function parameter types without enhancement', () => {
    const createValidator = () => new EnhancedModularValidator({
      targetVersion: 6,
      strictMode: true,
      enableWarnings: true,
      enhanceErrors: false  // Disable enhancement
    });

    const code = `
//@version=6
indicator("String Test")

// Wrong parameter types
length = str.length(123)  // Error: should be string
contains = str.contains(123, "world")  // Error: first param should be string
pos = str.pos("hello", 123)  // Error: second param should be string
repeat = str.repeat("hello", "3")  // Error: second param should be int
      `;

    const result = createValidator().validate(code);
    
    console.log('\n=== ENHANCED DISABLED TEST ===');
    console.log('Number of errors:', result.errors.length);
    console.log('Errors:');
    result.errors.forEach((error, i) => {
      console.log(`${i + 1}. ${error.code}: ${error.message}`);
      console.log(`   Keys: ${Object.keys(error).join(', ')}`);
    });
    console.log('Has PSV6-FUNCTION-PARAM-TYPE:', result.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-TYPE'));
    
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-TYPE')).toBe(true);
  });
});
