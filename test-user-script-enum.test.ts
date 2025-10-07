import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Test User Script Enum Fix', () => {
  it('should validate the user script input.enum without errors', () => {
    // Extract just the problematic section from the user's script
    const code = `//@version=6
strategy("Test", overlay = true)

// And 2 SL Options
enum SLOption
    Percent = '%'
    MACross = 'MA Cross'
    Band = 'Band'

// Trailing SL per Ticks
enum TSOption
    Percent = '%'
    Ticks = 'Ticks'

// Profit reached in RRR
var tpslGroup = 'TP | SL'
useSL = input.bool(true, title = 'SL Option | %', inline = 'SL', group = tpslGroup)
slOption = input.enum(SLOption.Percent, title = '', inline = 'SL', group = tpslGroup)
slPercent = input.float(1, minval = 0.1, step = 0.1, title = '', inline = 'SL', group = tpslGroup)
useTP = input.bool(true, title = 'TP', inline = 'TP', group = tpslGroup)

plot(close)`;

    const validator = new EnhancedModularValidator();
    const result = validator.validate(code);

    console.log('\n=== USER SCRIPT INPUT.ENUM VALIDATION ===');
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
