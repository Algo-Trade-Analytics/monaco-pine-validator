import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Indentation Validation - Final Test', () => {
  it('should ALWAYS detect invalid indentation at column 0', () => {
    const source = `//@version=6
strategy("Test", overlay = true)

// === Band Power Settings ===
bandLength = input.int(20, title="Band Length", minval=1, group="Band Power", 
tooltip="The length of the bands. A higher length smooths the bands more but reacts slower to price changes.")

plot(close)`;

    // Run validation 10 times to check for consistency
    for (let i = 0; i < 10; i++) {
      const validator = new EnhancedModularValidator();
      const result = validator.validate(source);
      
      const indentationErrors = result.errors.filter(e => 
        e.code.includes('INDENT') || e.code.includes('WRAP')
      );

      console.log(`Run ${i + 1}: ${indentationErrors.length} indentation errors`);
      
      // MUST detect the indentation error EVERY time
      expect(indentationErrors.length).toBeGreaterThan(0);
      expect(indentationErrors[0].code).toBe('PSV6-INDENT-WRAP-INSUFFICIENT');
      expect(indentationErrors[0].line).toBe(6);
    }
  });

  it('should detect invalid indentation with different configurations', () => {
    const source = `//@version=6
strategy("Test", overlay = true)

bandLength = input.int(20, title="Band Length", minval=1, group="Band Power", 
tooltip="The length of the bands.")

plot(close)`;

    const configs = [
      { name: 'Default', config: {} },
      { name: 'Strict Mode', config: { strictMode: true } },
      { name: 'All Enabled', config: { 
        strictMode: true,
        enableTypeChecking: true,
        enableControlFlowAnalysis: true,
        enablePerformanceAnalysis: true,
        enableWarnings: true,
        enableInfo: true
      }},
      { name: 'AST Primary', config: { ast: { mode: 'primary' as const } }},
      { name: 'AST Shadow', config: { ast: { mode: 'shadow' as const } }},
    ];

    configs.forEach(({ name, config }) => {
      const validator = new EnhancedModularValidator(config);
      const result = validator.validate(source);
      
      const indentationErrors = result.errors.filter(e => 
        e.code.includes('INDENT') || e.code.includes('WRAP')
      );

      console.log(`${name}: ${indentationErrors.length} indentation errors`);
      
      // All configs should detect the error (except disabled AST)
      if (config.ast?.mode !== 'disabled') {
        expect(indentationErrors.length).toBeGreaterThan(0);
      }
    });
  });
});
