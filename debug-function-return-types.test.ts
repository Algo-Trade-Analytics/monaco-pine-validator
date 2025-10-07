import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Function Return Types', () => {
  it('should not flag valid functions as having inconsistent return types', () => {
    const validator = new EnhancedModularValidator();

    const source = `//@version=6
strategy("Test", overlay = true)

// Test smma function
smma(src, len) =>
    smma = 0.0
    smma := na(smma[1]) ? ta.sma(src, len) : (smma[1] * (len - 1) + src) / len
    smma

// Test _addSessionWeekdays function
_addSessionWeekdays(sessionString) =>
    out = sessionString
    hasAnySelected = true
    if hasAnySelected
        out := sessionString + ':'
        out += '2'
    out

// Test affixOldPivots function (void function)
affixOldPivots(endTime) =>
    if true
        // do something
        na

// Test drawNewPivots function (void function)
drawNewPivots(startTime) =>
    if true
        // do something
        na

plot(close)`;

    const result = validator.validate(source);

    console.log('\n=== DEBUG FUNCTION RETURN TYPES ===');
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
      });
    }

    // We expect no function return type errors for these valid functions
    expect(functionReturnTypeErrors).toHaveLength(0);
  });
});
