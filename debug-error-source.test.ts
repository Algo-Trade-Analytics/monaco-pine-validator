import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Error Source', () => {
  it('should determine if errors are coming from syntax pre-checker or AST validator', () => {
    const code = `//@version=6
strategy("Test", overlay = true)

maHigh = if bandType == 1
    ta.ema(high, bandLength)
else if bandType == 2
    ta.sma(high, bandLength)
else
    smma(high, bandLength)

plot(close)`;

    console.log('\n=== TESTING SYNTAX PRE-CHECKER ONLY ===');
    // Test with AST disabled to see syntax pre-checker errors only
    const validator1 = new EnhancedModularValidator();
    const result1 = validator1.validate(code, { ast: { mode: 'disabled' } });
    
    console.log('AST disabled - Total errors:', result1.errors.length);
    const indentErrors1 = result1.errors.filter(e => e.code.includes('INDENT'));
    console.log('AST disabled - Indentation errors:', indentErrors1.length);
    
    console.log('\n=== TESTING AST VALIDATOR ===');
    // Test with AST enabled to see AST validator errors
    const validator2 = new EnhancedModularValidator();
    const result2 = validator2.validate(code, { ast: { mode: 'primary' } });
    
    console.log('AST enabled - Total errors:', result2.errors.length);
    const indentErrors2 = result2.errors.filter(e => e.code.includes('INDENT'));
    console.log('AST enabled - Indentation errors:', indentErrors2.length);
    
    console.log('\n=== ERROR COMPARISON ===');
    console.log('Syntax pre-checker indentation errors:', indentErrors1.length);
    console.log('AST validator indentation errors:', indentErrors2.length);
    console.log('Difference:', indentErrors2.length - indentErrors1.length);
    
    if (indentErrors2.length > indentErrors1.length) {
      console.log('✅ AST validator is adding indentation errors');
    } else if (indentErrors1.length > 0) {
      console.log('✅ Syntax pre-checker is still adding indentation errors');
    } else {
      console.log('✅ No indentation errors from either source');
    }
  });
});
