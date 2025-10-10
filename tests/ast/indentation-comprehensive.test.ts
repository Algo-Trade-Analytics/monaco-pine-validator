/**
 * Comprehensive Indentation Validation Tests
 * 
 * Tests all the indentation rules we've implemented and fixed:
 * 1. Function body formats (block vs wrap)
 * 2. Multi-statement function bodies
 * 3. Wrap format flexibility (first line can be at any non-multiple-of-4)
 * 4. Mixed formats detection
 * 5. Block format consistency
 */

import { describe, it, expect } from 'vitest';
import { validateIndentationWithAST } from '../../core/ast/indentation-validator-ast';
import { ChevrotainAstService } from '../../core/ast/service';

const service = new ChevrotainAstService();

function validate(code: string) {
  const result = service.parse(code, { filename: 'test.pine' });
  if (!result.ast) {
    throw new Error('Failed to parse code');
  }
  return validateIndentationWithAST(code, result.ast);
}

describe('Indentation Validation - Function Body Formats', () => {
  describe('Block Format (Multiple of 4)', () => {
    it('should accept function with 4-space block format', () => {
      const code = `//@version=6
indicator("Test")
toSize(s) =>
    s == "tiny"   ? size.tiny  :
    s == "small"  ? size.small :
    s == "normal" ? size.normal:
    s == "large"  ? size.large : size.huge`;
      
      const errors = validate(code);
      expect(errors).toHaveLength(0);
    });

    it('should accept function with consistent 4-space statements', () => {
      const code = `//@version=6
indicator("Test")
basisFrom(s) =>
    _raw = ta.ema(s, 10)
    ta.ema(_raw, 5)`;
      
      const errors = validate(code);
      expect(errors).toHaveLength(0);
    });

    it('should accept nested blocks with proper indentation', () => {
      const code = `//@version=6
indicator("Test")
consistent_function(x) =>
    if x > 0
        x * 2
    else
        x * -2`;
      
      const errors = validate(code);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Wrap Format (Non-Multiple of 4)', () => {
    it('should accept function with consistent wrap format (1 space)', () => {
      const code = `//@version=6
indicator("Test")
toSize(s) =>
 s == "tiny"   ? size.tiny  :
 s == "small"  ? size.small : size.huge`;
      
      const errors = validate(code);
      expect(errors).toHaveLength(0);
    });

    it('should accept function with consistent wrap format (5 spaces)', () => {
      const code = `//@version=6
indicator("Test")
toSize(s) =>
     s == "tiny"   ? size.tiny  :
     s == "small"  ? size.small :
     s == "normal" ? size.normal:
     s == "large"  ? size.large : size.huge`;
      
      const errors = validate(code);
      expect(errors).toHaveLength(0);
    });

    it('should accept wrap format with decreasing indents', () => {
      const code = `//@version=6
indicator("Test")
toSize(s) =>
      s == "tiny"   ? size.tiny  :
     s == "small"  ? size.small :
     s == "normal" ? size.normal:
     s == "large"  ? size.large : size.huge`;
      
      const errors = validate(code);
      expect(errors).toHaveLength(0);
    });

    it('should accept wrap format with first line at high indent', () => {
      const code = `//@version=6
indicator("Test")
toSize(s) =>
                                     s == "tiny"   ? size.tiny  :
     s == "small"  ? size.small :
     s == "normal" ? size.normal:
     s == "large"  ? size.large : size.huge`;
      
      const errors = validate(code);
      expect(errors).toHaveLength(0);
    });

    it('should accept wrap format with varying non-multiple-of-4 indents', () => {
      const code = `//@version=6
indicator("Test")
toSize(s) =>
           s == "tiny"   ? size.tiny  :
  s == "small"  ? size.small :
       s == "normal" ? size.normal: size.huge`;
      
      const errors = validate(code);
      expect(errors).toHaveLength(0);
    });
  });
});

describe('Indentation Validation - Invalid Patterns', () => {
  describe('Column 0 (Global Scope) Errors', () => {
    it('should reject function body starting at column 0', () => {
      const code = `//@version=6
indicator("Test")
toSize(s) =>
s == "tiny"   ? size.tiny  :
     s == "small"  ? size.small : size.huge`;
      
      const errors = validate(code);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe('PSV6-INDENT-WRAP-INVALID');
      expect(errors[0].message).toContain('column 0');
    });

    it('should reject multi-statement function with first line at column 0', () => {
      const code = `//@version=6
indicator("Test")
basisFrom(s) =>
_raw = ta.ema(s, 10)
    ta.ema(_raw, 5)`;
      
      const errors = validate(code);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe('PSV6-INDENT-WRAP-INVALID');
    });
  });

  describe('Mixed Format Errors', () => {
    it('should reject mixing wrap format (line 1) with block format (line 2)', () => {
      const code = `//@version=6
indicator("Test")
basisFrom(s) =>
 _raw = ta.ema(s, 10)
    ta.ema(_raw, 5)`;
      
      const errors = validate(code);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe('PSV6-INDENT-WRAP-INVALID');
      expect(errors[0].message).toContain('single-line format');
    });

    it('should reject mixing wrap format with multiple-of-4 in subsequent lines', () => {
      const code = `//@version=6
indicator("Test")
toSize(s) =>
     s == "tiny"   ? size.tiny  :
    s == "small"  ? size.small : size.huge`;
      
      const errors = validate(code);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe('PSV6-INDENT-WRAP-INVALID');
      expect(errors[0].message).toContain('single-line format');
    });

    it('should reject wrap format with multiple-of-4 in middle', () => {
      const code = `//@version=6
indicator("Test")
toSize(s) =>
                                     s == "tiny"   ? size.tiny  :
    s == "small"  ? size.small :
     s == "normal" ? size.normal: size.huge`;
      
      const errors = validate(code);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe('PSV6-INDENT-WRAP-INVALID');
    });

    it('should reject mixing wrap (5 spaces) then block (4 spaces)', () => {
      const code = `//@version=6
indicator("Test")
basisFrom(s) =>
     _raw = ta.ema(s, 10)
    ta.ema(_raw, 5)`;
      
      const errors = validate(code);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe('PSV6-INDENT-WRAP-INVALID');
    });
  });

  describe('Invalid Block Level Skipping', () => {
    it('should reject skipping block levels (8 spaces instead of 4)', () => {
      const code = `//@version=6
indicator("Test")
basisFrom(s) =>
        _raw = ta.ema(s, 10)
        ta.ema(_raw, 5)`;
      
      const errors = validate(code);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe('PSV6-INDENT-WRAP-INVALID');
      expect(errors[0].message).toContain('4 spaces for block format');
    });
  });

  describe('Inconsistent Block Format', () => {
    it('should reject block format with incorrect continuation indent (9 spaces)', () => {
      const code = `//@version=6
indicator("Test")
basisFrom(s) =>
    _raw = ta.ema(s, 10)
         ta.ema(_raw, 5)`;
      
      const errors = validate(code);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe('PSV6-INDENT-BLOCK-MISMATCH');
    });
  });
});

describe('Indentation Validation - Edge Cases', () => {
  describe('UDT Methods', () => {
    it('should allow methods inside UDT at 4-space indent', () => {
      const code = `//@version=6
indicator("Test")
type Point
    float x
    float y
    
    method setX(float value) =>
        this.x := value`;
      
      const errors = validate(code);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Mixed Tabs and Spaces', () => {
    it('should accept mixed tabs and spaces on the same line (TradingView behaviour)', () => {
      const code = `//@version=6
indicator("Test")
\t    if close > open
    plot(close)`;
      
      const errors = validate(code);
      const mixedIndentErrors = errors.filter(e => e.code === 'PSI02');
      expect(mixedIndentErrors).toHaveLength(0);
    });

    it('should ALLOW mixing tabs/spaces across different scopes (TradingView behavior)', () => {
      // This matches TradingView's behavior - tabs in one scope, spaces in another
      // But each line uses ONLY tabs OR ONLY spaces, not both
      const code = `//@version=6
indicator("Test")
\tif close > open
\t\tplot(close)
    
value = input.int(10, title="Test",
     tooltip="Description")`;
      
      const errors = validate(code);
      const mixedIndentErrors = errors.filter(e => e.code === 'PSI02');
      expect(mixedIndentErrors).toHaveLength(0);
    });
  });

  describe('Single-Line Arrow Functions', () => {
    it('should accept single-line arrow function', () => {
      const code = `//@version=6
indicator("Test")
double(x) => x * 2
result = double(5)`;
      
      const errors = validate(code);
      expect(errors).toHaveLength(0);
    });
  });

  // NOTE: Else-If Chains tests are commented out because if expressions are not supported by our parser yet
  // This is a known parser limitation that needs to be addressed
  // describe('Else-If Chains', () => {
  //   it('should accept else-if at same level as if', () => {
  //     const code = `//@version=6
  // indicator("Test")
  // getValue(x) =>
  //     result = if x > 10
  //         "high"
  //     else if x > 5
  //         "medium"
  //     else
  //         "low"
  //     result`;
  //   
  //     const errors = validate(code);
  //     expect(errors).toHaveLength(0);
  //   });
  // });
});

describe('Indentation Validation - Real-World Examples', () => {
  it('should accept Uptrick-style helper function', () => {
    const code = `//@version=6
indicator("Test")
basisFrom(srcSeries) =>
    _raw = ta.ema(srcSeries, 10)
    _raw > 1 ? ta.ema(_raw, 5) : _raw`;
    
    const errors = validate(code);
    expect(errors).toHaveLength(0);
  });

  it('should accept size conversion function with ternary chain', () => {
    const code = `//@version=6
indicator("Test")
toSize(s) =>
    s == "tiny"   ? size.tiny  :
    s == "small"  ? size.small :
    s == "normal" ? size.normal:
    s == "large"  ? size.large : size.huge`;
    
    const errors = validate(code);
    expect(errors).toHaveLength(0);
  });

  it('should accept wrap format helper with decreasing indents', () => {
    const code = `//@version=6
indicator("Test")
getColor(trend) =>
      trend == "up"   ? color.green :
     trend == "down" ? color.red : color.gray`;
    
    const errors = validate(code);
    expect(errors).toHaveLength(0);
  });

  it('should accept complex multi-line function in block format', () => {
    const code = `//@version=6
indicator("Test")
calculateBasis(src, len, basisType) =>
    _raw = basisType == "ALMA" ? ta.alma(src, len, 0.85, 6) : ta.ema(src, len)
    _smooth = ta.ema(_raw, 3)
    _smooth`;
    
    const errors = validate(code);
    expect(errors).toHaveLength(0);
  });
});

describe('Indentation Validation - Regression Tests', () => {
  it('should not flag function return type consistency test', () => {
    const code = `//@version=6
indicator("Function Return Consistency")

consistent_function(x) =>
    if x > 0
        x * 2
    else
        x * -2

result = consistent_function(10)
plot(result)`;
    
    const errors = validate(code);
    expect(errors).toHaveLength(0);
  });

  it('should not flag nested for loops', () => {
    const code = `//@version=6
indicator("Test")
if close > open
    for i = 0 to 10
        for j = 0 to 10
            calc = i + j`;
    
    const errors = validate(code);
    expect(errors).toHaveLength(0);
  });

  it('should not flag switch expressions', () => {
    const code = `//@version=6
indicator("Test")
result = switch close > open
    true => high
    false => low`;
    
    const errors = validate(code);
    expect(errors).toHaveLength(0);
  });
});

describe('Indentation Validation - Documentation Examples', () => {
  it('should accept official style guide example', () => {
    const code = `//@version=6
indicator("Style Guide Example")
myFunction(x) =>
    result = x * 2
    result`;
    
    const errors = validate(code);
    expect(errors).toHaveLength(0);
  });

  it('should accept line wrapping example from docs', () => {
    const code = `//@version=6
indicator("Line Wrapping Example")
longCondition = close > open and
  close > close[1] and
  volume > volume[1]
plot(longCondition ? 1 : 0)`;
    
    const errors = validate(code);
    expect(errors).toHaveLength(0);
  });

  // NOTE: Multi-line ternary expressions are not supported by our parser yet
  // This is a known parser limitation that needs to be addressed
  // it('should accept ternary line wrapping example', () => {
  //   const code = `//@version=6
  // indicator("Ternary Wrapping")
  // condition = close > open
  // result = condition
  //   ? high
  //   : low
  // plot(result)`;
  //   
  //   const errors = validate(code);
  //   expect(errors).toHaveLength(0);
  // });
});
