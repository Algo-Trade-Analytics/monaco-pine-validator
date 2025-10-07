import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug AST Fallback', () => {
  it('should provide fallback indentation validation when AST parsing fails', () => {
    const source = `//@version=6
strategy("Test AST Fallback", overlay = true)

// === Band Power Settings ===
bandLength = input.int(20, title="Band Length", minval=1, group="Band Power", 
tooltip="The length of the bands. A higher length smooths the bands more but reacts slower to price changes.")

plot(close)`;

    // Test with AST disabled (simulates AST parsing failure)
    const validator = new EnhancedModularValidator({
      ast: { mode: 'disabled' }
    });
    
    const result = validator.validate(source);
    const indentationErrors = result.errors.filter(e => 
      e.code.includes('INDENT') || e.code.includes('WRAP')
    );
    
    console.log('\n=== AST DISABLED (Fallback Test) ===');
    console.log('isValid:', result.isValid);
    console.log('Total errors:', result.errors.length);
    console.log('Indentation errors:', indentationErrors.length);
    
    if (indentationErrors.length > 0) {
      indentationErrors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.code}: ${error.message}`);
      });
    }

    // The fallback indentation validation should detect the error
    expect(indentationErrors.length).toBeGreaterThan(0);
  });

  it('should compare AST-enabled vs AST-disabled validation', () => {
    const source = `//@version=6
strategy("Test Comparison", overlay = true)

bandLength = input.int(20, title="Band Length", minval=1, group="Band Power", 
tooltip="The length of the bands.")

plot(close)`;

    // Test with AST enabled (primary mode)
    const astEnabledValidator = new EnhancedModularValidator({
      ast: { mode: 'primary' }
    });
    
    const astEnabledResult = astEnabledValidator.validate(source);
    const astEnabledIndentationErrors = astEnabledResult.errors.filter(e => 
      e.code.includes('INDENT') || e.code.includes('WRAP')
    );

    // Test with AST disabled (fallback mode)
    const astDisabledValidator = new EnhancedModularValidator({
      ast: { mode: 'disabled' }
    });
    
    const astDisabledResult = astDisabledValidator.validate(source);
    const astDisabledIndentationErrors = astDisabledResult.errors.filter(e => 
      e.code.includes('INDENT') || e.code.includes('WRAP')
    );

    console.log('\n=== COMPARISON TEST ===');
    console.log('AST Enabled - Indentation errors:', astEnabledIndentationErrors.length);
    console.log('AST Disabled - Indentation errors:', astDisabledIndentationErrors.length);
    
    if (astEnabledIndentationErrors.length > 0) {
      console.log('AST Enabled errors:', astEnabledIndentationErrors.map(e => e.code));
    }
    if (astDisabledIndentationErrors.length > 0) {
      console.log('AST Disabled errors:', astDisabledIndentationErrors.map(e => e.code));
    }

    // Both should detect indentation errors (now with fallback)
    expect(astEnabledIndentationErrors.length).toBeGreaterThan(0);
    expect(astDisabledIndentationErrors.length).toBeGreaterThan(0);
  });
});
