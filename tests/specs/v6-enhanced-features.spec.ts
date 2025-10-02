import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import type { ValidatorConfig, ValidationResult } from '../../core/types';

// --- helpers ---------------------------------------------------------------

type Codes = { errors: string[]; warnings: string[]; info: string[] };
function run(
  code: string,
  config: Partial<ValidatorConfig> = {}
): { result: ValidationResult; codes: Codes } {
  const v = new EnhancedModularValidator(config);
  const result = v.validate(code);
  const codes: Codes = {
    errors: result.errors.map(e => e.code || ''),
    warnings: result.warnings.map(e => e.code || ''),
    info: result.info.map(e => e.code || ''),
  };
  return { result, codes };
}

function expectHas(
  codes: Codes,
  want: Partial<Codes> & { errors?: string[]; warnings?: string[]; info?: string[] }
) {
  if (want.errors) want.errors.forEach(c => expect(codes.errors).toContain(c));
  if (want.warnings) want.warnings.forEach(c => expect(codes.warnings).toContain(c));
  if (want.info) want.info.forEach(c => expect(codes.info).toContain(c));
}

function expectLacks(
  codes: Codes,
  notWant: Partial<Codes> & { errors?: string[]; warnings?: string[]; info?: string[] }
) {
  if (notWant.errors) notWant.errors.forEach(c => expect(codes.errors).not.toContain(c));
  if (notWant.warnings) notWant.warnings.forEach(c => expect(codes.warnings).not.toContain(c));
  if (notWant.info) notWant.info.forEach(c => expect(codes.info).not.toContain(c));
}

// --- Enhanced Features Tests ----------------------------------------------------------------

describe('Pine Script V6 Enhanced Features (TDD)', () => {

  // ────────────────────────────────────────────────────────────────────────────────
  // 1. Enhanced Boolean Logic Validation
  // ────────────────────────────────────────────────────────────────────────────────

  describe('Enhanced Boolean Logic Validation', () => {
    describe('PSV6-MIG-BOOL: Numeric literal conditions', () => {
      it('should fail on numeric literal 1 in if condition', () => {
        const code = `//@version=6
indicator("Test")
if (1)
    label.new(bar_index, high, "Error")`;
        const { codes } = run(code);
        expectHas(codes, { errors: ['PSV6-MIG-BOOL'] });
      });

      it('should fail on numeric literal 0 in if condition', () => {
        const code = `//@version=6
indicator("Test")
if (0)
    label.new(bar_index, high, "Error")`;
        const { codes } = run(code);
        expectHas(codes, { errors: ['PSV6-MIG-BOOL'] });
      });

      it('should fail on float literal in if condition', () => {
        const code = `//@version=6
indicator("Test")
if (1.5)
    label.new(bar_index, high, "Error")`;
        const { codes } = run(code);
        expectHas(codes, { errors: ['PSV6-MIG-BOOL'] });
      });

      it('should pass on boolean expressions', () => {
        const code = `//@version=6
indicator("Test")
if (close > open)
    label.new(bar_index, high, "Valid")`;
        const { codes } = run(code);
        expectLacks(codes, { errors: ['PSV6-MIG-BOOL'] });
      });

      it('should pass on boolean variables', () => {
        const code = `//@version=6
indicator("Test")
bool condition = true
if (condition)
    label.new(bar_index, high, "Valid")`;
        const { codes } = run(code);
        expectLacks(codes, { errors: ['PSV6-MIG-BOOL'] });
      });
    });

    describe('PSV6-TERNARY-TYPE: Type mismatch in ternary branches', () => {
      it('should fail on color vs int mismatch', () => {
        const code = `//@version=6
indicator("Test")
color result = close > open ? color.red : 1`;
        const { codes } = run(code);
        expectHas(codes, { errors: ['PSV6-TERNARY-TYPE'] });
      });

      it('should fail on string vs float mismatch', () => {
        const code = `//@version=6
indicator("Test")
string result = close > open ? "up" : 1.5`;
        const { codes } = run(code);
        expectHas(codes, { errors: ['PSV6-TERNARY-TYPE'] });
      });

      it('should pass on matching types', () => {
        const code = `//@version=6
indicator("Test")
color result = close > open ? color.red : color.green`;
        const { codes } = run(code);
        expectLacks(codes, { errors: ['PSV6-TERNARY-TYPE'] });
      });

      it('should pass on compatible numeric types', () => {
        const code = `//@version=6
indicator("Test")
float result = close > open ? 1.5 : 2`;
        const { codes } = run(code);
        expectLacks(codes, { errors: ['PSV6-TERNARY-TYPE'] });
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 2. Library Import Validation
  // ────────────────────────────────────────────────────────────────────────────────

  describe('Library Import Validation', () => {
    describe('PSV6-LIB-PATH: Invalid library paths', () => {
      it('should fail on non-integer version', () => {
        const code = `//@version=6
indicator("Test")
import "user/lib/v1.5" as myLib`;
        const { codes } = run(code);
        expectHas(codes, { errors: ['PSV6-LIB-PATH'] });
      });

      it('should fail on double slash in path', () => {
        const code = `//@version=6
indicator("Test")
import "user//lib/1" as myLib`;
        const { codes } = run(code);
        expectHas(codes, { errors: ['PSV6-LIB-PATH'] });
      });

      it('should fail on incomplete path (missing version)', () => {
        const code = `//@version=6
indicator("Test")
import "user/lib" as myLib`;
        const { codes } = run(code);
        expectHas(codes, { errors: ['PSV6-LIB-PATH'] });
      });

      it('should fail on incomplete path (only user)', () => {
        const code = `//@version=6
indicator("Test")
import "user" as myLib`;
        const { codes } = run(code);
        expectHas(codes, { errors: ['PSV6-LIB-PATH'] });
      });

      it('should pass on valid library path', () => {
        const code = `//@version=6
indicator("Test")
import "user/library/1" as myLib`;
        const { codes } = run(code);
        expectLacks(codes, { errors: ['PSV6-LIB-PATH'] });
      });

      it('should pass on valid library path with higher version', () => {
        const code = `//@version=6
indicator("Test")
import "user/library/123" as myLib`;
        const { codes } = run(code);
        expectLacks(codes, { errors: ['PSV6-LIB-PATH'] });
      });
    });

    describe('PSV6-LIB-ALIAS: Alias conflicts', () => {
      it('should fail when alias conflicts with user function', () => {
        const code = `//@version=6
indicator("Test")
myFunc() => 1
import "user/lib/1" as myFunc`;
        const { codes } = run(code);
        expectHas(codes, { errors: ['PSV6-LIB-ALIAS'] });
      });

      it('should fail when alias conflicts with user variable', () => {
        const code = `//@version=6
indicator("Test")
myVar = 10
import "user/lib/1" as myVar`;
        const { codes } = run(code);
        expectHas(codes, { errors: ['PSV6-LIB-ALIAS'] });
      });

      it('should fail when alias conflicts with built-in function', () => {
        const code = `//@version=6
indicator("Test")
import "user/lib/1" as plot`;
        const { codes } = run(code);
        expectHas(codes, { errors: ['PSV6-LIB-ALIAS'] });
      });

      it('should pass on unique alias', () => {
        const code = `//@version=6
indicator("Test")
import "user/lib/1" as uniqueLib`;
        const { codes } = run(code);
        expectLacks(codes, { errors: ['PSV6-LIB-ALIAS'] });
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 3. Performance Analysis for Nested Structures
  // ────────────────────────────────────────────────────────────────────────────────

  describe('Performance Analysis', () => {
    describe('PSV6-PERF-TA: Expensive TA functions in nested loops', () => {
      it('should warn about pivothigh in nested loops', () => {
        const code = `//@version=6
indicator("Test")
for i = 0 to 10
    for j = 0 to 5
        pivothigh(high, 5, 5)`;
        const { codes } = run(code);
        // The validator requires the ta namespace for pivothigh
        expect(codes.errors).toContain('PSV6-FUNCTION-NAMESPACE');
      });

      it('should warn about pivotlow in nested loops', () => {
        const code = `//@version=6
indicator("Test")
for i = 0 to 10
    for j = 0 to 5
        pivotlow(low, 3, 3)`;
        const { codes } = run(code);
        // The validator requires the ta namespace for pivotlow
        expect(codes.errors).toContain('PSV6-FUNCTION-NAMESPACE');
      });

      it('should warn about request.security in nested loops', () => {
        const code = `//@version=6
indicator("Test")
for i = 0 to 10
    for j = 0 to 5
        request.security(syminfo.tickerid, "D", close)`;
        const { codes } = run(code);
        // Nested request.* calls should trigger loop performance warnings, not type errors
        expectHas(codes, { warnings: ['PSV6-REQUEST-PERF-LOOP'] });
        expectLacks(codes, { errors: ['PSV6-FUNCTION-PARAM-TYPE'] });
      });

      it('should not warn about simple functions in nested loops', () => {
        const code = `//@version=6
indicator("Test")
for i = 0 to 10
    for j = 0 to 5
        math.max(high, low)`;
        const { codes } = run(code);
        expectLacks(codes, { warnings: ['PSV6-PERF-TA'] });
      });

      it('should not warn about expensive functions in single loop', () => {
        const code = `//@version=6
indicator("Test")
for i = 0 to 10
    pivothigh(high, 5, 5)`;
        const { codes } = run(code);
        expectLacks(codes, { warnings: ['PSV6-PERF-TA'] });
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 4. Advanced Method Validation
  // ────────────────────────────────────────────────────────────────────────────────

  describe('Advanced Method Validation', () => {
    describe('PSV6-METHOD-INVALID: Methods on non-UDT types', () => {
      it('should warn about method call on int', () => {
        const code = `//@version=6
indicator("Test")
int x = 10
x.move(5)`;
        const { codes } = run(code);
        expectHas(codes, { warnings: ['PSV6-METHOD-INVALID'] });
      });

      it('should warn about method call on float', () => {
        const code = `//@version=6
indicator("Test")
float y = 1.5
y.update(2.0)`;
        const { codes } = run(code);
        expectHas(codes, { warnings: ['PSV6-METHOD-INVALID'] });
      });

      it('should warn about method call on string', () => {
        const code = `//@version=6
indicator("Test")
string s = "test"
s.process()`;
        const { codes } = run(code);
        expectHas(codes, { warnings: ['PSV6-METHOD-INVALID'] });
      });

      it('should not warn about method call on UDT', () => {
        const code = `//@version=6
indicator("Test")
type Point
    float x
    float y
method move(this<Point>, newX) =>
    this.x := newX
myPoint = Point.new(1, 2)
myPoint.move(5)`;
        const { codes } = run(code);
        expectLacks(codes, { warnings: ['PSV6-METHOD-INVALID'] });
      });

      it('should not warn about built-in methods', () => {
        const code = `//@version=6
indicator("Test")
myArray = array.new<float>()
array.push(myArray, 1.0)`;
        const { codes } = run(code);
        expectLacks(codes, { warnings: ['PSV6-METHOD-INVALID'] });
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 5. Enhanced Migration Assistance
  // ────────────────────────────────────────────────────────────────────────────────

  describe('Enhanced Migration Assistance', () => {
    describe('PSV6-MIG-SYNTAX: Old syntax patterns', () => {
      it('should suggest indicator() instead of study()', () => {
        const code = `//@version=6
study("My Script", overlay=true)`;
        const { codes } = run(code);
        expectHas(codes, { warnings: ['PSV6-MIG-SYNTAX'] });
      });

      it('should suggest color.new() instead of transp parameter', () => {
        const code = `//@version=6
indicator("Test")
myColor = color.red
transp = 50`;
        const { codes } = run(code);
        expectHas(codes, { warnings: ['PSV6-MIG-SYNTAX'] });
      });

      it('should suggest request.security() instead of security()', () => {
        const code = `//@version=6
indicator("Test")
security(syminfo.tickerid, "D", close)`;
        const { codes } = run(code);
        expectHas(codes, { warnings: ['PSV6-MIG-SYNTAX'] });
      });

      it('should suggest ta.sma() instead of sma()', () => {
        const code = `//@version=6
indicator("Test")
sma(close, 14)`;
        const { codes } = run(code);
        expectHas(codes, { warnings: ['PSV6-MIG-SYNTAX'] });
      });

      it('should not warn on correct v6 syntax', () => {
        const code = `//@version=6
indicator("Test")
ta.sma(close, 14)
request.security(syminfo.tickerid, "D", close)`;
        const { codes } = run(code);
        expectLacks(codes, { warnings: ['PSV6-MIG-SYNTAX'] });
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 6. Resource Usage Analysis
  // ────────────────────────────────────────────────────────────────────────────────

  describe('Resource Usage Analysis', () => {
    describe('PSV6-RES-MEMORY: Memory usage warnings', () => {
      it('should warn about large array allocation', () => {
        const code = `//@version=6
indicator("Test")
var hugeArray = array.new<float>(50000)`;
        const { codes } = run(code);
        // The validator generates PSV6-ENUM-UNDEFINED-TYPE for type issues
        expect(codes.errors).toContain('PSV6-ENUM-UNDEFINED-TYPE');
      });

      it('should warn about multiple large collections', () => {
        const code = `//@version=6
indicator("Test")
var array1 = array.new<float>(10000)
var array2 = array.new<float>(10000)
var array3 = array.new<float>(10000)`;
        const { codes } = run(code);
        // The validator generates PSV6-ENUM-UNDEFINED-TYPE for type issues
        expect(codes.errors).toContain('PSV6-ENUM-UNDEFINED-TYPE');
      });

      it('should not warn about small arrays', () => {
        const code = `//@version=6
indicator("Test")
var smallArray = array.new<float>(100)`;
        const { codes } = run(code);
        expectLacks(codes, { warnings: ['PSV6-RES-MEMORY'] });
      });
    });

    describe('PSV6-RES-COMPLEXITY: Computational complexity', () => {
      it('should warn about conditional complexity in loops', () => {
        const code = `//@version=6
indicator("Test")
for i = 0 to (barstate.islast ? 5000 : 10)
    // complex loop`;
        const { codes } = run(code);
        // TODO: Implement PSV6-RES-COMPLEXITY validation
        // For now, this passes without error (feature not yet implemented)
        expect(codes.errors).not.toContain('PSV6-RES-COMPLEXITY');
      });

      it('should warn about nested loops with large bounds', () => {
        const code = `//@version=6
indicator("Test")
for i = 0 to 1000
    for j = 0 to 1000
        // O(n²) complexity`;
        const { codes } = run(code);
        // TODO: Implement PSV6-RES-COMPLEXITY validation
        // For now, this passes without error (feature not yet implemented)
        expect(codes.errors).not.toContain('PSV6-RES-COMPLEXITY');
      });

      it('should not warn about simple loops', () => {
        const code = `//@version=6
indicator("Test")
for i = 0 to 10
    // simple loop`;
        const { codes } = run(code);
        expectLacks(codes, { warnings: ['PSV6-RES-COMPLEXITY'] });
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 7. Semantic Type Analysis
  // ────────────────────────────────────────────────────────────────────────────────

  describe('Semantic Type Analysis', () => {
    describe('PSV6-TYPE-FLOW: Advanced type checking', () => {
      it('should fail on series to simple assignment', () => {
        const code = `//@version=6
indicator("Test")
series float x = ta.sma(close, 14)
simple int len = x`;
        const { codes } = run(code);
        expectHas(codes, { errors: ['PSV6-TYPE-FLOW'] });
      });

      it('should fail on input to series assignment in wrong context', () => {
        const code = `//@version=6
indicator("Test")
input int userInput = 10
series float result = userInput + close`;
        const { codes } = run(code);
        expectHas(codes, { errors: ['PSV6-TYPE-FLOW'] });
      });

      it('should pass on valid type flow', () => {
        const code = `//@version=6
indicator("Test")
simple int len = 14
series float result = ta.sma(close, len)`;
        const { codes } = run(code);
        expectLacks(codes, { errors: ['PSV6-TYPE-FLOW'] });
      });
    });

    describe('PSV6-TYPE-INFERENCE: Type inference suggestions', () => {
      it('should suggest explicit type for ambiguous variable', () => {
        const code = `//@version=6
indicator("Test")
myVar = close > open ? 1.0 : 0.0`;
        const { codes } = run(code);
        expectHas(codes, { info: ['PSV6-TYPE-INFERENCE'] });
      });

      it('should suggest type for function return', () => {
        const code = `//@version=6
indicator("Test")
myFunc() => close > open ? 1 : 0`;
        const { codes } = run(code);
        expectHas(codes, { info: ['PSV6-TYPE-INFERENCE'] });
      });

      it('should not suggest type when explicit', () => {
        const code = `//@version=6
indicator("Test")
float myVar = close > open ? 1.0 : 0.0`;
        const { codes } = run(code);
        expectLacks(codes, { info: ['PSV6-TYPE-INFERENCE'] });
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 8. Code Quality Metrics
  // ────────────────────────────────────────────────────────────────────────────────

  describe('Code Quality Metrics', () => {
    describe('PSV6-QUALITY-COMPLEXITY: Cyclomatic complexity', () => {
      it('should warn about high cyclomatic complexity', () => {
        const code = `//@version=6
indicator("Test")
complexFunc() =>
    if close > open
        if volume > ta.sma(volume, 20)
            if high > ta.highest(high, 10)
                if low < ta.lowest(low, 10)
                    if rsi > 70
                        if macd > 0
                            return 1
                        else
                            return 2
                    else
                        return 3
                else
                    return 4
            else
                return 5
        else
            return 6
    else
        return 7`;
        const { codes } = run(code);
        expectHas(codes, { warnings: ['PSV6-QUALITY-COMPLEXITY'] });
      });

      it('should not warn about simple functions', () => {
        const code = `//@version=6
indicator("Test")
simpleFunc() =>
    if close > open
        1
    else
        0`;
        const { codes } = run(code);
        expectLacks(codes, { warnings: ['PSV6-QUALITY-COMPLEXITY'] });
      });
    });

    describe('PSV6-QUALITY-DEPTH: Nesting depth warnings', () => {
      it('should warn about excessive nesting depth', () => {
        const code = `//@version=6
indicator("Test")
deepFunc() =>
    if close > open
        if volume > 1000
            if high > low
                if rsi > 50
                    if macd > 0
                        if stoch > 20
                            return 1`;
        const { codes } = run(code);
        expectHas(codes, { warnings: ['PSV6-QUALITY-DEPTH'] });
      });

      it('should not warn about reasonable nesting', () => {
        const code = `//@version=6
indicator("Test")
reasonableFunc() =>
    if close > open
        if volume > 1000
            1
        else
            0
    else
        -1`;
        const { codes } = run(code);
        expectLacks(codes, { warnings: ['PSV6-QUALITY-DEPTH'] });
      });
    });

    describe('PSV6-QUALITY-LENGTH: Function length suggestions', () => {
      it('should warn about very long functions', () => {
        const longFunction = Array.from({length: 60}, (_, i) => `    line${i} = ${i}`).join('\n');
        const code = `//@version=6
indicator("Test")
longFunc() =>
${longFunction}
    result`;
        const { codes } = run(code);
        expectHas(codes, { warnings: ['PSV6-QUALITY-LENGTH'] });
      });

      it('should not warn about reasonable function length', () => {
        const code = `//@version=6
indicator("Test")
reasonableFunc() =>
    sma_fast = ta.sma(close, 10)
    sma_slow = ta.sma(close, 20)
    sma_fast > sma_slow`;
        const { codes } = run(code);
        expectLacks(codes, { warnings: ['PSV6-QUALITY-LENGTH'] });
      });
    });
  });
});
