import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Binary Operator Detection', () => {
  it('should not flag valid unary operators', () => {
    const validator = new EnhancedModularValidator({
      targetVersion: 6,
      strictMode: true,
      enablePerformanceAnalysis: true
    });

    const testCases = [
      // Valid unary minus
      'x = -5',
      'result = x * -2',
      'value = y + -10',
      'calc = z / -3',
      
      // Valid expressions with comments
      'return "positive"  // String',
      'return 0  // Number',
      
      // Valid string literals
      'template = "<div>\\n  <h1>{0}</h1>\\n</div>"',
      
      // Valid function calls
      'result = func(a, b)',
      
      // Valid variable assignments
      'price = close * 1.1',
      'count = items.length'
    ];

    for (const code of testCases) {
      const fullCode = `//@version=6
indicator("Test")
${code}
plot(close)`;
      
      const result = validator.validate(fullCode);
      
      console.log(`\n=== Testing: ${code} ===`);
      console.log('isValid:', result.isValid);
      console.log('Errors:', result.errors.length);
      
      if (result.errors.length > 0) {
        result.errors.forEach((error, i) => {
          console.log(`${i + 1}. ${error.code}: ${error.message}`);
          console.log(`   Line ${error.line}, Column ${error.column}`);
        });
      }
      
      // These should all be valid
      expect(result.errors.filter(e => e.code === 'PSV6-SYNTAX-MISSING-OPERAND')).toHaveLength(0);
    }
  });

  it('should still catch actual missing operands', () => {
    const validator = new EnhancedModularValidator({
      targetVersion: 6,
      strictMode: true,
      enablePerformanceAnalysis: true
    });

    const testCases = [
      // Invalid: missing operands
      'result = 10 * / close',
      'value = + - 5',
      'calc = * 2'
    ];

    for (const code of testCases) {
      const fullCode = `//@version=6
indicator("Test")
${code}
plot(close)`;
      
      const result = validator.validate(fullCode);
      
      console.log(`\n=== Testing Invalid: ${code} ===`);
      console.log('isValid:', result.isValid);
      console.log('Errors:', result.errors.length);
      
      if (result.errors.length > 0) {
        result.errors.forEach((error, i) => {
          console.log(`${i + 1}. ${error.code}: ${error.message}`);
        });
      }
      
      // These should have errors
      expect(result.errors.filter(e => e.code === 'PSV6-SYNTAX-MISSING-OPERAND')).toHaveLength(1);
    }
  });
});
