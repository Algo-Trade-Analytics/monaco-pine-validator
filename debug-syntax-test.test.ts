import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';
import { Codes } from './core/codes';

describe('Debug Syntax Validator New Features Test', () => {
  it('should detect binary operators without left operand', () => {
    const validator = new EnhancedModularValidator();

    const source = `
//@version=6
indicator("Test")
value = 10 * / close
plot(value)
`;

    const result = validator.validate(source);

    console.log('\n=== SYNTAX VALIDATOR DEBUG ===');
    console.log('isValid:', result.isValid);
    console.log('Number of errors:', result.errors.length);
    console.log('Number of warnings:', result.warnings.length);
    console.log('Number of info:', result.info.length);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.code}: ${error.message}`);
        console.log(`   Line ${error.line}, Column ${error.column}`);
      });
    }

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe(Codes.SYNTAX_MISSING_OPERAND);
    expect(result.errors[0].message).toContain("Binary operator");
    expect(result.errors[0].message).toContain("missing a left operand");
  });
});
