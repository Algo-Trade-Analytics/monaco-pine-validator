import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Indentation Detailed', () => {
  it('should detect invalid indentation for various line continuation patterns', () => {
    const validator = new EnhancedModularValidator();

    const testCases = [
      {
        name: 'Zero indentation (should be invalid)',
        code: `//@version=6
strategy("Test", overlay = true)

bandLength = input.int(20, title="Band Length", minval=1, group="Band Power", 
tooltip="The length of the bands.")

plot(close)`,
        expectedErrors: 1
      },
      {
        name: '4-space indentation (should be invalid)',
        code: `//@version=6
strategy("Test", overlay = true)

bandLength = input.int(20, title="Band Length", minval=1, group="Band Power", 
    tooltip="The length of the bands.")

plot(close)`,
        expectedErrors: 1
      },
      {
        name: '1-space indentation (should be valid)',
        code: `//@version=6
strategy("Test", overlay = true)

bandLength = input.int(20, title="Band Length", minval=1, group="Band Power", 
 tooltip="The length of the bands.")

plot(close)`,
        expectedErrors: 0
      },
      {
        name: '2-space indentation (should be valid)',
        code: `//@version=6
strategy("Test", overlay = true)

bandLength = input.int(20, title="Band Length", minval=1, group="Band Power", 
  tooltip="The length of the bands.")

plot(close)`,
        expectedErrors: 0
      }
    ];

    testCases.forEach(({ name, code, expectedErrors }) => {
      const result = validator.validate(code);
      const indentationErrors = result.errors.filter(e => 
        e.code.includes('INDENT') || e.code.includes('WRAP')
      );

      console.log(`\n=== ${name} ===`);
      console.log(`Expected errors: ${expectedErrors}, Got: ${indentationErrors.length}`);
      console.log(`isValid: ${result.isValid}`);
      
      if (indentationErrors.length > 0) {
        indentationErrors.forEach((error, i) => {
          console.log(`${i + 1}. ${error.code}: ${error.message}`);
        });
      }

      expect(indentationErrors.length).toBe(expectedErrors);
    });
  });
});
