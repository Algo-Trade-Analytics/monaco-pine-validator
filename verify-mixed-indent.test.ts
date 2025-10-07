import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Verify Mixed Indentation Error', () => {
  it('should show exactly what the error means', () => {
    // This script has spaces on line 7 and tabs on line 11 (simulating your line 132)
    const scriptWithMixedIndent = `//@version=6
strategy("Test", overlay = true)

// Line 7 uses SPACES for indentation (5 spaces)
maType = input.string("SMA", title="MA Type", options=["EMA", "SMA"], group="MA Settings", 
     tooltip="Select the type of Moving Average")

// Line 11 uses TABS for indentation (1 tab = shown as \t)
smma(src, len) =>
\tsmma = 0.0
\tsmma := na(smma[1]) ? ta.sma(src, len) : (smma[1] * (len - 1) + src) / len
\tsmma

plot(close)`;

    const validator = new EnhancedModularValidator();
    const result = validator.validate(scriptWithMixedIndent);

    console.log('\n=== MIXED INDENTATION ERROR EXPLANATION ===');
    console.log('Script has:');
    console.log('  - Line 7: Uses SPACES (     tooltip=...)');
    console.log('  - Line 11: Uses TABS (\\tsmma = 0.0)');
    console.log('');
    console.log('Pine Script requires CONSISTENT indentation:');
    console.log('  ✅ All spaces (recommended)');
    console.log('  ✅ All tabs');
    console.log('  ❌ Mixed spaces and tabs (YOUR ISSUE)');
    console.log('');
    
    if (result.errors.length > 0) {
      console.log('Validator error:');
      result.errors.forEach(error => {
        console.log(`  ${error.code}: ${error.message}`);
        console.log(`  Location: Line ${error.line}, Column ${error.column}`);
      });
    }

    console.log('');
    console.log('🔧 HOW TO FIX:');
    console.log('  1. Open your script in an editor');
    console.log('  2. Show whitespace characters (View → Render Whitespace)');
    console.log('  3. Convert all indentation to spaces:');
    console.log('     - VSCode: Ctrl+Shift+P → "Convert Indentation to Spaces"');
    console.log('     - Or use Find/Replace: Replace all tabs with 4 spaces');
    console.log('');

    // Should detect mixed indentation
    const mixedIndentErrors = result.errors.filter(e => e.code === 'PSI02');
    expect(mixedIndentErrors.length).toBeGreaterThan(0);
  });
});
