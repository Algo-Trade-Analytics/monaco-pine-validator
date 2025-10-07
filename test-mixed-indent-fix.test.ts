import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Mixed Indentation Fix', () => {
  it('should ALLOW mixing tabs/spaces across different scopes (like TradingView)', () => {
    // Spaces in global scope, tabs in function (like your script)
    const scriptWithMixedScopes = `//@version=6
strategy("Test", overlay = true)

// Global scope uses SPACES
maType = input.string("SMA", title="MA Type", options=["EMA", "SMA"], group="MA Settings", 
     tooltip="Select the type of Moving Average")

// Function scope uses TABS
smma(src, len) =>
\tsmma = 0.0
\tsmma := na(smma[1]) ? ta.sma(src, len) : (smma[1] * (len - 1) + src) / len
\tsmma

plot(close)`;

    const validator = new EnhancedModularValidator();
    const result = validator.validate(scriptWithMixedScopes);

    console.log('\n=== Test 1: Mixed tabs/spaces across scopes ===');
    console.log('isValid:', result.isValid);
    console.log('Total errors:', result.errors.length);
    
    const mixedIndentErrors = result.errors.filter(e => e.code === 'PSI02');
    console.log('PSI02 errors:', mixedIndentErrors.length);
    
    if (mixedIndentErrors.length > 0) {
      mixedIndentErrors.forEach(e => console.log(`  - ${e.message}`));
    }

    // Should NOT detect PSI02 error (TradingView allows this)
    expect(mixedIndentErrors.length).toBe(0);
  });

  it('should REJECT mixing tabs/spaces on the SAME line', () => {
    // Tabs AND spaces on the same line (definitely invalid)
    const scriptWithMixedLine = `//@version=6
indicator("Test")

func() =>
\t    value = 10
    value

plot(close)`;

    const validator = new EnhancedModularValidator();
    const result = validator.validate(scriptWithMixedLine);

    console.log('\n=== Test 2: Mixed tabs/spaces on same line ===');
    console.log('isValid:', result.isValid);
    console.log('Total errors:', result.errors.length);
    
    const mixedIndentErrors = result.errors.filter(e => e.code === 'PSI02');
    console.log('PSI02 errors:', mixedIndentErrors.length);
    
    if (mixedIndentErrors.length > 0) {
      mixedIndentErrors.forEach(e => console.log(`  - ${e.message}`));
    }

    // SHOULD detect PSI02 error (mixing on same line is invalid)
    expect(mixedIndentErrors.length).toBeGreaterThan(0);
  });
});
