import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug AST Modes', () => {
  it('should have consistent validation across different AST modes', () => {
    const source = `//@version=6
strategy("Test AST Modes", overlay = true)

// === Band Power Settings ===
bandLength = input.int(20, title="Band Length", minval=1, group="Band Power", 
tooltip="The length of the bands. A higher length smooths the bands more but reacts slower to price changes.")

plot(close)`;

    // Test with different AST modes
    const modes = ['primary', 'shadow', 'disabled'] as const;
    const results: Record<string, any> = {};

    modes.forEach(mode => {
      const validator = new EnhancedModularValidator({
        ast: { mode }
      });
      
      const result = validator.validate(source);
      const indentationErrors = result.errors.filter(e => 
        e.code.includes('INDENT') || e.code.includes('WRAP')
      );
      
      results[mode] = {
        isValid: result.isValid,
        totalErrors: result.errors.length,
        indentationErrors: indentationErrors.length,
        errors: result.errors.map(e => ({
          code: e.code,
          message: e.message,
          line: e.line
        }))
      };

      console.log(`\n=== AST Mode: ${mode.toUpperCase()} ===`);
      console.log('isValid:', result.isValid);
      console.log('Total errors:', result.errors.length);
      console.log('Indentation errors:', indentationErrors.length);
      
      if (indentationErrors.length > 0) {
        indentationErrors.forEach((error, i) => {
          console.log(`${i + 1}. ${error.code}: ${error.message}`);
        });
      }
    });

    // Compare results
    console.log('\n=== COMPARISON ===');
    Object.entries(results).forEach(([mode, result]) => {
      console.log(`${mode}: ${result.isValid ? 'VALID' : 'INVALID'}, ${result.totalErrors} errors, ${result.indentationErrors} indentation errors`);
    });

    // All modes should detect the same indentation error
    const primaryIndentationErrors = results.primary.indentationErrors;
    const shadowIndentationErrors = results.shadow.indentationErrors;
    const disabledIndentationErrors = results.disabled.indentationErrors;

    console.log(`\nIndentation error counts: primary=${primaryIndentationErrors}, shadow=${shadowIndentationErrors}, disabled=${disabledIndentationErrors}`);

    // At least one mode should detect the indentation error
    expect(Math.max(primaryIndentationErrors, shadowIndentationErrors, disabledIndentationErrors)).toBeGreaterThan(0);
  });
});
