/**
 * Tests for new syntax validation features in SyntaxValidator
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { Codes } from '../../core/codes';

describe('SyntaxValidator - New Syntax Features', () => {
  const validator = new EnhancedModularValidator();

  describe('Missing Equals Operator', () => {
    it('should detect missing = in variable assignment', () => {
      const source = `
//@version=6
indicator("Test")
slowEMA ta.ema(close, 35)
plot(close)
`;

      const result = validator.validate(source);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(Codes.SYNTAX_MISSING_EQUALS);
      expect(result.errors[0].message).toContain("Missing '=' operator");
    });

    it('should not flag valid assignments', () => {
      const source = `
//@version=6
indicator("Test")
slowEMA = ta.ema(close, 35)
fastEMA = ta.sma(close, 10)
plot(slowEMA)
`;

      const result = validator.validate(source);

      // Should not have syntax errors (may have other validation errors)
      const syntaxErrors = result.errors.filter(e => 
        e.code === Codes.SYNTAX_MISSING_EQUALS
      );
      expect(syntaxErrors).toHaveLength(0);
    });
  });

  describe('Conditional Operator Order', () => {
    it('should detect incorrect conditional operator order', () => {
      const source = `
//@version=6
indicator("Test")
plotColour = close > open : color.green ? color.red
plot(close, color=plotColour)
`;

      const result = validator.validate(source);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(Codes.SYNTAX_CONDITIONAL_ORDER);
      expect(result.errors[0].message).toContain("Incorrect conditional operator order");
    });

    it('should not flag valid conditional operators', () => {
      const source = `
//@version=6
indicator("Test")
plotColour = close > open ? color.green : color.red
plot(close, color=plotColour)
`;

      const result = validator.validate(source);

      const syntaxErrors = result.errors.filter(e => 
        e.code === Codes.SYNTAX_CONDITIONAL_ORDER
      );
      expect(syntaxErrors).toHaveLength(0);
    });
  });

  describe('Missing Function Parentheses', () => {
    it('should detect missing parentheses in function declaration', () => {
      const source = `
//@version=6
indicator("Test")
closeHigh => close - high
plot(close)
`;

      const result = validator.validate(source);

      // Should have at least our syntax error, but may have others
      const syntaxErrors = result.errors.filter(e => e.code === Codes.SYNTAX_MISSING_PARENS);
      expect(syntaxErrors).toHaveLength(1);
      expect(syntaxErrors[0].message).toContain("Missing parentheses in function declaration");
    });

    it('should not flag valid function declarations', () => {
      const source = `
//@version=6
indicator("Test")
closeHigh() => close - high
closeLow() => close - low
plot(close)
`;

      const result = validator.validate(source);

      const syntaxErrors = result.errors.filter(e => 
        e.code === Codes.SYNTAX_MISSING_PARENS
      );
      expect(syntaxErrors).toHaveLength(0);
    });
  });

  describe('Missing Commas in Function Calls', () => {
    it('should detect missing comma in function arguments', () => {
      const source = `
//@version=6
indicator("Test")
plotValue = plot(close color=color.red)
`;

      const result = validator.validate(source);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(Codes.SYNTAX_MISSING_COMMA);
      expect(result.errors[0].message).toContain("Missing comma between function arguments");
    });

    it('should detect empty arguments between commas', () => {
      const source = `
//@version=6
indicator("Test")
value = input.int(, "Label")
`;

      const result = validator.validate(source);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(Codes.SYNTAX_EMPTY_PARAM);
      expect(result.errors[0].message.toLowerCase()).toMatch(/missing (argument|parameter)/);
    });

    it('should detect trailing comma without argument', () => {
      const source = `
//@version=6
indicator("Test")
plot(close, )
`;

      const result = validator.validate(source);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(Codes.SYNTAX_TRAILING_COMMA);
      expect(result.errors[0].message).toContain('Trailing comma');
    });

    it('should not flag valid function calls', () => {
      const source = `
//@version=6
indicator("Test")
plot(close, color=color.red)
plot(close, color=color.blue, linewidth=2)
`;

      const result = validator.validate(source);

      const syntaxErrors = result.errors.filter(e => 
        e.code === Codes.SYNTAX_MISSING_COMMA
      );
      expect(syntaxErrors).toHaveLength(0);
    });
  });

  describe('Missing Operands for Binary Operators', () => {
    it('should detect binary operators without left operand', () => {
      const source = `
//@version=6
indicator("Test")
value = 10 * / close
plot(value)
`;

      const result = validator.validate(source);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(Codes.SYNTAX_MISSING_BINARY_OPERAND);
      expect(result.errors[0].message).toContain("Missing expression after operator '*'");
    });

    it('should not flag valid binary expressions', () => {
      const source = `
//@version=6
indicator("Test")
value = 10 * open / close
result = value + 5
plot(result)
`;

      const result = validator.validate(source);

      const syntaxErrors = result.errors.filter(e => 
        e.code === Codes.SYNTAX_MISSING_BINARY_OPERAND
      );
      expect(syntaxErrors).toHaveLength(0);
    });
  });
});
