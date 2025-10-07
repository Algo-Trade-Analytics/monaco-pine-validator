import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Test Input Enum Fix', () => {
  it('should validate input.enum with named parameters correctly', () => {
    const code = `//@version=6
strategy("Test", overlay = true)

// Test the problematic input.enum syntax
enum SLOption
    Percent = '%'
    MACross = 'MA Cross'
    Band = 'Band'

slOption = input.enum(SLOption.Percent, title = '', inline = 'SL', group = 'tpslGroup')

plot(close)`;

    const validator = new EnhancedModularValidator();
    const result = validator.validate(code);

    console.log('\n=== INPUT.ENUM VALIDATION ===');
    console.log('Total errors:', result.errors.length);
    
    const enumErrors = result.errors.filter(e => e.code.includes('INPUT-ENUM'));
    console.log('Input enum errors:', enumErrors.length);
    
    if (enumErrors.length > 0) {
      console.log('\nInput enum errors:');
      enumErrors.forEach((error, i) => {
        console.log(`${i + 1}. Line ${error.line}: ${error.code} - ${error.message}`);
      });
    } else {
      console.log('✅ No input.enum errors found!');
    }
    
    // Check for other types of errors
    const otherErrors = result.errors.filter(e => !e.code.includes('INPUT-ENUM'));
    console.log('Other errors:', otherErrors.length);
    
    if (otherErrors.length > 0) {
      console.log('\nOther errors:');
      otherErrors.slice(0, 5).forEach((error, i) => {
        console.log(`${i + 1}. Line ${error.line}: ${error.code} - ${error.message}`);
      });
    }
  });
});
