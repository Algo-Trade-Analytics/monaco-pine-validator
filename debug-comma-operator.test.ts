import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Comma Operator Test', () => {
  it('should handle comma operator with variable assignments', () => {
    const validator = new EnhancedModularValidator();
    
    const script = `
//@version=6
indicator("Test")

if barstate.islast
    int bestIdx = -1
    float bestD = 1e9
    
    // Test comma operator with assignments (from original issue)
    bestIdx := -1, bestD := 1e9
    bestIdx := 0, bestD := 0.5
`;

    const result = validator.validate(script);
    
    console.log('\n=== COMMA OPERATOR DEBUG ===');
    console.log('isValid:', result.isValid);
    console.log('Number of errors:', result.errors.length);
    console.log('Number of warnings:', result.warnings.length);
    console.log('Number of info:', result.info.length);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.code}: ${error.message}`);
        console.log(`   Line ${error.line}, Column ${error.column}`);
      });
    }
    
    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach((warning, i) => {
        console.log(`${i + 1}. ${warning.code}: ${warning.message}`);
        console.log(`   Line ${warning.line}, Column ${warning.column}`);
      });
    }
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
