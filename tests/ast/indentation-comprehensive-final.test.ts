import { describe, it, expect } from 'vitest';
import { ChevrotainAstService } from '../../core/ast/service';
import { validateIndentationWithAST } from '../../core/ast/indentation-validator-ast';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

const astService = new ChevrotainAstService();

function parseCode(code: string) {
  const result = astService.parse(code, { filename: 'test.pine', allowErrors: true });
  if (!result.ast) {
    throw new Error('Failed to parse code');
  }
  return result.ast;
}

function validateWithFullValidator(code: string) {
  const validator = new EnhancedModularValidator();
  return validator.validate(code);
}

describe('Comprehensive Indentation Tests - All Cases', () => {
  
  describe('Function Body Indentation', () => {
    
    it('should validate correct function body indentation', () => {
      const code = `//@version=6
indicator("Test")
myFunction() =>
    result = close > open
    return result`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should error on function body at column 0', () => {
      const code = `//@version=6
indicator("Test")
myFunction() =>
result = close > open
return result`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      // Check for any indentation-related error
      expect(errors.some(e => e.message.includes('indent') || e.message.includes('block'))).toBe(true);
    });

    it('should error on inconsistent function body indentation', () => {
      const code = `//@version=6
indicator("Test")
myFunction() =>
    result = close > open
  return result`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate function with wrap format body', () => {
      const code = `//@version=6
indicator("Test")
myFunction() =>
  close > open and
   high > low and
  volume > 1000`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should error on wrap format with multiple of 4 indentation', () => {
      const code = `//@version=6
indicator("Test")
myFunction() =>
  close > open and
    high > low and
        volume > 1000`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Function Arguments Indentation', () => {
    
    it('should validate correct argument indentation', () => {
      const code = `//@version=6
indicator("Test")
plot(close,
     title="Close Price",
     color=color.blue)`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should validate argument continuation with non-multiple-of-4', () => {
      const code = `//@version=6
indicator("Test")
plot(close,
     title="Close Price",
      color=color.blue)`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should error on argument at multiple of 4 continuation', () => {
      const code = `//@version=6
indicator("Test")
plot(close,
     title="Close Price",
    color=color.blue)`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Closing Delimiter Alignment', () => {
    
    it('should flag closing parenthesis aligned at a multiple-of-4 column', () => {
      const code = `//@version=6
indicator("Test")
plot(
    close,
    title="Wrapped"
    )`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const closingIssues = diagnostics.filter(d => d.code === 'PSV6-SYNTAX-CLOSING-PAREN');
      expect(closingIssues.length).toBeGreaterThan(0);
    });

    it('should flag closing bracket aligned at a multiple-of-4 column', () => {
      const code = `//@version=6
indicator("Test")
values = [
    high,
    low
    ]`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const closingIssues = diagnostics.filter(d => d.code === 'PSV6-SYNTAX-CLOSING-PAREN');
      expect(closingIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Ternary Operator Indentation', () => {
    
    it('should validate correct ternary indentation', () => {
      const code = `//@version=6
indicator("Test")
color = close > open ? 
 color.green : 
  color.red`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should validate ternary with 1-space continuation', () => {
      const code = `//@version=6
indicator("Test")
color = close > open ? 
 color.green : 
 color.red`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should error on ternary at multiple of 4', () => {
      const code = `//@version=6
indicator("Test")
color = close > open ? 
    color.green : 
    color.red`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate complex ternary chain', () => {
      const code = `//@version=6
indicator("Test")
result = condition1 ? 
 value1 : condition2 ? 
  value2 : condition3 ? 
   value3 : 
  defaultValue`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Nested Block Indentation', () => {
    
    it('should validate nested if statements', () => {
      const code = `//@version=6
indicator("Test")
if close > open
    if high > low
        if volume > 1000
            result = true`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should validate nested for loops', () => {
      const code = `//@version=6
indicator("Test")
for i = 0 to 10
    for j = 0 to 5
        result = i + j`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should validate nested while loops', () => {
      const code = `//@version=6
indicator("Test")
while condition1
    while condition2
        result = process()`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should validate mixed nested structures', () => {
      const code = `//@version=6
indicator("Test")
if close > open
    for i = 0 to 10
        if i > 5
            result = i * 2
        else
            result = i`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Line Continuation in Complex Expressions', () => {
    
    it('should validate complex function call with line continuation', () => {
      const code = `//@version=6
indicator("Test")
volFrom(srcSeries) =>
    _stdev = ta.stdev(srcSeries, volLen)
    _mad = ta.sma(math.abs(srcSeries - 
 ta.sma(srcSeries, volLen)), volLen) * 1.4826
    _vRaw = volMethod == "StDev" ? _stdev : _mad`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should validate 5-space continuation', () => {
      const code = `//@version=6
indicator("Test")
volFrom(srcSeries) =>
    _stdev = ta.stdev(srcSeries, volLen)
    _mad = ta.sma(math.abs(srcSeries - 
     ta.sma(srcSeries, volLen)), volLen) * 1.4826
    _vRaw = volMethod == "StDev" ? _stdev : _mad`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should warn on 4-space continuation (block boundary)', () => {
      const code = `//@version=6
indicator("Test")
volFrom(srcSeries) =>
    _stdev = ta.stdev(srcSeries, 20)
    _mad = ta.sma(math.abs(srcSeries - 
    ta.sma(srcSeries, 20)), 20) * 1.4826
    _vRaw = volMethod == "StDev" ? _stdev : _mad`;

      const result = validateWithFullValidator(code);
      const wrapWarnings = result.warnings.filter(w => w.code === 'PSV6-INDENT-WRAP-BLOCK');
      expect(wrapWarnings.length).toBeGreaterThan(0);
    });

    it('should warn on 0-space continuation (block boundary)', () => {
      const code = `//@version=6
indicator("Test")
volFrom(srcSeries) =>
    _stdev = ta.stdev(srcSeries, 20)
    _mad = ta.sma(math.abs(srcSeries - 
ta.sma(srcSeries, 20)), 20) * 1.4826
    _vRaw = volMethod == "StDev" ? _stdev : _mad`;

      const result = validateWithFullValidator(code);
      
      const wrapWarnings = result.warnings.filter(w => w.code === 'PSV6-INDENT-WRAP-BLOCK' || w.code === 'PSV6-INDENT-WRAP-MULTIPLE-OF-4');
      expect(wrapWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('Switch Statement Indentation', () => {
    
    it('should validate switch statement indentation', () => {
      const code = `//@version=6
indicator("Test")
result = switch timeframe.period
    "1D" => 1
    "1W" => 7
    "1M" => 30
    => 1`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should validate switch with complex expressions', () => {
      const code = `//@version=6
indicator("Test")
result = switch condition
    true => 
     value1 + value2
    false => 
      value3 * value4
    => 
       defaultValue`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Mixed Tabs and Spaces', () => {
    
    it('should error on mixed tabs and spaces', () => {
      const code = `//@version=6
indicator("Test")
if close > open
    result = true
\telse
        result = false`;

      const result = validateWithFullValidator(code);
      
      // Mixed tabs/spaces causes parser failure, which is expected
      const parserErrors = result.errors.filter(e => e.code === 'PSV6-SYNTAX-PARSE-FAILED');
      expect(parserErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Real-World Examples', () => {
    
    it('should validate Uptrick Volatility function', () => {
      const code = `//@version=6
indicator("Test")
volFrom(srcSeries) =>
    _stdev = ta.stdev(srcSeries, volLen)
    _mad = ta.sma(math.abs(srcSeries - 
     ta.sma(srcSeries, volLen)), volLen) * 1.4826
    _vRaw = volMethod == "StDev" ? _stdev : _mad
    volSmooth > 1 ? ta.ema(_vRaw, volSmooth) : _vRaw`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should validate complex toSize function', () => {
      const code = `//@version=6
indicator("Test")
toSize(s) =>
    s == "tiny" ? size.tiny :
     s == "small" ? size.small :
      s == "normal" ? size.normal :
       s == "large" ? size.large : size.huge`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should validate multi-line function with arguments', () => {
      const code = `//@version=6
indicator("Test")
plot(close,
     title="Close Price",
     color=close > open ? 
      color.green : 
       color.red,
     linewidth=2)`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    
    it('should handle empty function body', () => {
      const code = `//@version=6
indicator("Test")
emptyFunction() =>
    // Empty function`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should handle single-line function', () => {
      const code = `//@version=6
indicator("Test")
singleLine() => close > open`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should handle deeply nested structures', () => {
      const code = `//@version=6
indicator("Test")
if condition1
    if condition2
        if condition3
            if condition4
                result = true`;

      const ast = parseCode(code);
      const diagnostics = validateIndentationWithAST(code, ast);
      
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });
});
