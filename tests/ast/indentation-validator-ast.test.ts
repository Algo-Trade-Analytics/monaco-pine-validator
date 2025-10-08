/**
 * Tests for AST-based indentation validator
 */

import { describe, it, expect } from 'vitest';
import { validateIndentationWithAST } from '../../core/ast/indentation-validator-ast';
import { ChevrotainAstService } from '../../core/ast/service';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

const astService = new ChevrotainAstService();

function parseCode(code: string) {
  const result = astService.parse(code, { filename: 'test.pine', allowErrors: true });
  return result.ast;
}

function validateWithFullValidator(code: string) {
  const validator = new EnhancedModularValidator();
  return validator.validate(code);
}

describe('ASTIndentationValidator', () => {
  describe('Function Declaration Indentation', () => {
    it('should accept correct function indentation', () => {
      const code = `//@version=6
indicator("Test")
myFunc() =>
    a = 1
    b = 2
    a + b`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors).toHaveLength(0);
    });

    it('should accept function body with wrap format (2 spaces)', () => {
      const code = `//@version=6
indicator("Test")
myFunc() =>
  a = 1`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      // 2 spaces is valid wrap format
      expect(errors).toHaveLength(0);
    });

    it('should accept valid line wrapping in function body', () => {
      const code = `//@version=6
indicator("Test")
myFunc(x) =>
    longCalc =
      ta.ema(x, 21) +
      ta.wma(x, 55)
    longCalc`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors).toHaveLength(0);
    });

    it('should reject 4-space continuation with context', () => {
      const code = `//@version=6
indicator("Test")
myFunc(x) =>
    longCalc =
        ta.ema(x, 21)`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      // 4-space continuation should be rejected (multiples of 4 are reserved for blocks)
      expect(errors.filter(e => e.code === 'PSV6-INDENT-WRAP-BLOCK')).toHaveLength(1);
    });
  });

  describe('If Statement Indentation', () => {
    it('should accept correct if statement indentation', () => {
      const code = `//@version=6
indicator("Test")
if close > open
    val = 1
    plot(val)`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors).toHaveLength(0);
    });

    it('should accept correct if-else indentation', () => {
      const code = `//@version=6
indicator("Test")
if close > open
    val = 1
else
    val = 0
plot(val)`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors).toHaveLength(0);
    });

    it('should error on incorrect if body indentation', () => {
      const code = `//@version=6
indicator("Test")
if close > open
  val = 1`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.code === 'PSV6-INDENT-BLOCK-MISMATCH')).toBe(true);
    });
  });

  describe('Loop Statement Indentation', () => {
    it('should accept correct for loop indentation', () => {
      const code = `//@version=6
indicator("Test")
sum = 0
for i = 0 to 10
    sum := sum + i
plot(sum)`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors).toHaveLength(0);
    });

    it('should accept correct while loop indentation', () => {
      const code = `//@version=6
indicator("Test")
i = 0
while i < 10
    i := i + 1
plot(i)`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors).toHaveLength(0);
    });

    it('should error on incorrect loop body indentation', () => {
      const code = `//@version=6
indicator("Test")
for i = 0 to 10
  sum = i`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.code === 'PSV6-INDENT-BLOCK-MISMATCH')).toBe(true);
    });
  });

  describe('Switch Statement Indentation', () => {
    it('should accept correct switch indentation', () => {
      const code = `//@version=6
indicator("Test")
col = switch
    close > open => color.green
    close < open => color.red
    => color.gray
plot(close, color=col)`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors).toHaveLength(0);
    });

    it('should error on incorrect switch case indentation', () => {
      const code = `//@version=6
indicator("Test")
col = switch
  close > open => color.green`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.code === 'PSV6-INDENT-BLOCK-MISMATCH')).toBe(true);
    });
  });

  describe('Line Wrapping - Global Scope', () => {
    it('should accept valid line wrapping at global scope', () => {
      const code = `//@version=6
indicator("Test")
longValue =
  ta.sma(close, 20) +
  ta.ema(high, 30)
plot(longValue)`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors).toHaveLength(0);
    });

    it('should accept single-space continuation indentation', () => {
      const code = `//@version=6
indicator("Test")
result = long_function_name(param1,
 param2,
 param3)

plot(result)`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors.filter(e => e.code === 'PSV6-INDENT-WRAP-MULTIPLE-OF-4')).toHaveLength(0);
    });

    it('should accept 4-space continuation with context', () => {
      // 4-space continuation with context (previous line ends with =) should be allowed
      const code = `//@version=6
indicator("Test")
longValue =
    ta.sma(close, 20)`;

      const result = validateWithFullValidator(code);
      const wrapErrors = result.errors.filter(e => e.code === 'PSV6-INDENT-WRAP-MULTIPLE-OF-4');

      expect(wrapErrors).toHaveLength(0);
    });

    it('should accept multi-line ternary with valid wrapping', () => {
      const code = `//@version=6
indicator("Test")
col =
  close > open
  ? color.green
  : color.red
plot(close, color=col)`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors).toHaveLength(0);
    });

    it('should accept 4-space continuation in ternary with context', () => {
      // 4-space continuation with context (previous line ends with =) should be allowed
      const code = `//@version=6
indicator("Test")
col =
    close > open
    ? color.green`;

      const result = validateWithFullValidator(code);
      const wrapErrors = result.errors.filter(e => e.code === 'PSV6-INDENT-WRAP-MULTIPLE-OF-4');

      expect(wrapErrors).toHaveLength(0);
    });
  });

  describe('Multi-line Function Calls', () => {
    it('should accept valid multi-line function call', () => {
      const code = `//@version=6
indicator("Test")
plot(
  series = close,
  color = color.red)`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors).toHaveLength(0);
    });

    it('should reject 4-space continuation in function call with context', () => {
      // 4-space continuation should be rejected (multiples of 4 are reserved for blocks)
      const code = `//@version=6
indicator("Test")
plot(
    series = close,
     color = color.red)`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      // 4-space continuation should be rejected
      expect(errors.filter(e => e.code === 'PSV6-INDENT-WRAP-MULTIPLE-OF-4')).toHaveLength(1);
    });
  });

  describe('Nested Blocks', () => {
    it('should accept correct nested function and if indentation', () => {
      const code = `//@version=6
indicator("Test")
myFunc(x) =>
    if x > 0
        val = x * 2
        val
    else
        val = 0
        val
plot(myFunc(close))`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors).toHaveLength(0);
    });

    it('should accept line wrapping inside nested blocks', () => {
      const code = `//@version=6
indicator("Test")
myFunc(x) =>
    if x > 0
        longCalc =
          ta.ema(x, 21) +
          ta.wma(x, 55)
        longCalc
    else
        0
plot(myFunc(close))`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors).toHaveLength(0);
    });

    it('should accept sibling control flow statements aligned with parent indentation', () => {
      const code = `//@version=6
indicator("Test")
myFunc(cond1, cond2) =>
    value = 0
    if cond1
        if cond2
            value := 1
        if not cond2
            value := 2
    value

plot(myFunc(true, false))`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors.filter(e => e.code === 'PSV6-INDENT-BLOCK-MISMATCH')).toHaveLength(0);
    });

    it('should allow else blocks aligned with parent when nested control flow is present', () => {
      const code = `//@version=6
indicator("Test")
if activeChart
    if time == chart.left_visible_bar_time
        vTop := high
        vBot := low
    if time > chart.left_visible_bar_time
        vTop := math.max(vTop, high)
        vBot := math.min(vBot, low)
else
    vTop := hi
    vBot := lo
    if bar_index > prd
        vStart += 1
    a.CandlestickData()
    if a.v.size() > prd
        a.CandlestickDataClean()`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors.filter(e => e.code === 'PSV6-INDENT-BLOCK-MISMATCH')).toHaveLength(0);
    });
  });

  describe('Real-World Example - Uptrick Functions', () => {
    it('should validate basisFrom function correctly', () => {
      const code = `//@version=6
indicator("Test")
basisFrom(srcSeries) =>
    _raw = ta.alma(srcSeries, 34, 0.85, 6.0)
    3 > 1 ? ta.ema(_raw, 3) : _raw
plot(basisFrom(close))`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors).toHaveLength(0);
    });

    it('should validate toSize function with multi-line ternary correctly', () => {
      const code = `//@version=6
indicator("Test")
toSize(s) =>
     s == "tiny"   ? size.tiny  :
     s == "small"  ? size.small :
     s == "normal" ? size.normal:
     s == "large"  ? size.large : size.huge
plot(close)`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty lines gracefully', () => {
      const code = `//@version=6
indicator("Test")

myFunc() =>
    a = 1

    b = 2
    a + b

plot(myFunc())`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors).toHaveLength(0);
    });

    it('should handle comments gracefully', () => {
      const code = `//@version=6
indicator("Test")
myFunc() =>
    // This is a comment
    a = 1
    // Another comment
    a + 1
plot(myFunc())`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors).toHaveLength(0);
    });

    it('should handle tabs (converted to 4 spaces)', () => {
      const code = `//@version=6
indicator("Test")
myFunc() =>\n\ta = 1\n\ta + 1
plot(myFunc())`;

      const ast = parseCode(code);
      const errors = validateIndentationWithAST(code, ast);

      expect(errors).toHaveLength(0);
    });
  });
});
