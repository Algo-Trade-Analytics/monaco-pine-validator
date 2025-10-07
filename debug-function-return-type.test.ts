import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Function Return Type Tests', () => {
  it('should validate function return type consistency', () => {
    const validator = new EnhancedModularValidator({
      targetVersion: 6,
      strictMode: true,
      enablePerformanceAnalysis: true
    });

    const code = `//@version=6
indicator("Function Return Consistency")

// Function with consistent return type
consistent_function(x) =>
    if x > 0
        x * 2
    else
        x * -2

result = consistent_function(10)
plot(result)`;
      
    const result = validator.validate(code);
    
    console.log('\n=== FUNCTION RETURN TYPE CONSISTENCY DEBUG ===');
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
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should error on inconsistent function return types', () => {
    const validator = new EnhancedModularValidator({
      targetVersion: 6,
      strictMode: true,
      enablePerformanceAnalysis: true
    });

    const code = `//@version=6
indicator("Function Return Inconsistency")

// Function with inconsistent return types
inconsistent_function(x) =>
    if x > 0
        return "positive"  // String
    else
        return 0  // Number

result = inconsistent_function(10)
plot(close)`;
      
    const result = validator.validate(code);
    
    console.log('\n=== FUNCTION RETURN TYPE INCONSISTENCY DEBUG ===');
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
    
    // This should have errors
    expect(result.errors.some(e => e.code === 'PSV6-FUNCTION-RETURN-TYPE')).toBe(true);
  });
});
