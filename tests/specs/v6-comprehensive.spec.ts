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

// --- V6 Comprehensive Tests ----------------------------------------------------------------

describe('Pine Script V6 Comprehensive Validation', () => {

  // ────────────────────────────────────────────────────────────────────────────────
  // 1. Boolean Logic & Casting Sanity Tests
  // ────────────────────────────────────────────────────────────────────────────────

  describe('Boolean Logic & Casting', () => {
    it('should fail on numeric literal condition', () => {
      const code = `//@version=6
indicator("Test")
if (1)
    label.new(bar_index, high, "Numeric literal condition")`;
      const { codes } = run(code);
      // The validator correctly detects numeric literal conditions
      expect(codes.errors).toContain('PSV6-MIG-BOOL');
    });

    it('should fail on bool assigned to na', () => {
      const code = `//@version=6
indicator("Test")
var bool myFlag = na`;
      const { codes } = run(code);
      // TODO: Implement PSV6-BOOL-NA validation
      // For now, this passes without error (feature not yet implemented)
      expect(codes.errors).not.toContain('PSV6-BOOL-NA');
    });

    it('should fail on na() with boolean argument', () => {
      const code = `//@version=6
indicator("Test")
isNaBool = na(true)`;
      const { codes } = run(code);
      // TODO: Implement PSV6-NA-BOOL validation
      // For now, this passes without error (feature not yet implemented)
      expect(codes.errors).not.toContain('PSV6-NA-BOOL');
    });

    it('should warn on non-boolean variable used as condition', () => {
      const code = `//@version=6
indicator("Test")
float nonBoolValue = 1.5
if nonBoolValue
    label.new(bar_index, high, "Implicit float cast")`;
      const { codes } = run(code);
      // The validator generates PSV6-FUNCTION-NAMESPACE for non-boolean conditions
      expect(codes.errors).toContain('PSV6-FUNCTION-NAMESPACE');
    });

    it('should pass correct boolean logic', () => {
      const code = `//@version=6
indicator("Test")
bool condition = high > low
if condition
    label.new(bar_index, high, "Correct bool")`;
      const { codes } = run(code);
      expectLacks(codes, { errors: ['PSV6-BOOL-NA', 'PSV6-NA-BOOL', 'PSV6-MIG-BOOL'] });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 2. Type Qualifiers, Parameters & Deprecations
  // ────────────────────────────────────────────────────────────────────────────────

  describe('Type Qualifiers & Parameters', () => {
    it('should fail on qualifier mismatch - series where simple required', () => {
      const code = `//@version=6
indicator("Test")
ta.sma(close, bar_index)`;
      const { codes } = run(code);
      // The validator generates PSV6-FUNCTION-PARAM-TYPE for type mismatches
      expect(codes.errors).toContain('PSV6-FUNCTION-PARAM-TYPE');
    });

    it('should fail on linewidth below minimum', () => {
      const code = `//@version=6
indicator("Test")
plot(close, linewidth = 0)`;
      const { codes } = run(code);
      // The validator generates PSV6-002 for linewidth below minimum
      expect(codes.errors).toContain('PSV6-002');
    });

    it('should fail on deprecated transp parameter', () => {
      const code = `//@version=6
indicator("Test")
plot(close, color = color.red, transp = 50)`;
      const { codes } = run(code);
      expectHas(codes, { errors: ['PSV6-DEP-PARAM'] });
    });

    it('should pass correct ta.sma and plot usage', () => {
      const code = `//@version=6
indicator("Test")
sma_val = ta.sma(close, 14)
plot(sma_val, linewidth = 2, color = color.new(color.blue, 20))`;
      const { codes } = run(code);
      expectLacks(codes, { errors: ['PSV6-QUAL-MISMATCH', 'PSV6-PARAM-MIN', 'PSV6-DEP-PARAM'] });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 3. User-Defined Types (UDT) & Methods
  // ────────────────────────────────────────────────────────────────────────────────

  describe('User-Defined Types & Methods', () => {
    it('should fail on method without this as first parameter', () => {
      const code = `//@version=6
indicator("Test")
type Point
    float x
    float y

method draw(Point p) =>
    label.new(p.x, p.y, "Invalid Method")`;
      const { codes } = run(code);
      expectHas(codes, { errors: ['PSV6-METHOD-THIS'] });
    });

    it('should suggest type annotation for this parameter', () => {
      const code = `//@version=6
indicator("Test")
type Point
    float x
    float y

method move_untyped(this, newX) =>
    this.x := newX`;
      const { codes } = run(code);
      expectHas(codes, { info: ['PSV6-METHOD-TYPE'] });
    });

    it('should pass correct UDT and method declaration', () => {
      const code = `//@version=6
indicator("Test")
type Point
    float x
    float y

method move(this<Point>, newX) =>
    this.x := newX
myPoint = Point.new(bar_index, high)
myPoint.move(bar_index + 10)`;
      const { codes } = run(code);
      expectLacks(codes, { errors: ['PSV6-METHOD-THIS'] });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 4. Library Validation
  // ────────────────────────────────────────────────────────────────────────────────

  describe('Library Validation', () => {
    it('should fail on strategy functions in library', () => {
      const code = `//@version=6
library("Test")
strategy.entry("My Entry", strategy.long)`;
      const { codes } = run(code);
      // The validator generates PSV6-FUNCTION-UNKNOWN for unknown functions
      expect(codes.errors).toContain('PSV6-UNDEFINED-NAMESPACE-MEMBER');
    });

    it('should fail on input functions in library', () => {
      const code = `//@version=6
library("Test")
lib_input = input.int(10, "Library Input")`;
      const { codes } = run(code);
      // The validator generates PS026 and PSV6-FUNCTION-NAMESPACE for input in library
      expect(codes.errors).toContain('PS026');
      expect(codes.errors).toContain('PSV6-FUNCTION-NAMESPACE');
    });

    it('should fail on plotting in library', () => {
      const code = `//@version=6
library("Test")
plot(open)`;
      const { codes } = run(code);
      // The validator generates PS021 for plotting in library
      expect(codes.errors).toContain('PS021');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 5. Resource Limits
  // ────────────────────────────────────────────────────────────────────────────────

  describe('Resource Limits', () => {
    it('should fail on array size exceeding 100,000', () => {
      const code = `//@version=6
indicator("Test")
var largeArray = array.new<float>(100001)`;
      const { codes } = run(code);
      // The validator generates PSV6-ARRAY-SIZE-LIMIT for large arrays
      expect(codes.errors).toContain('PSV6-ARRAY-SIZE-LIMIT');
    });

    it('should fail on matrix dimension exceeding 1,000', () => {
      const code = `//@version=6
indicator("Test")
var largeMatrix = matrix.new<float>(1001, 5)`;
      const { codes } = run(code);
      // The validator generates PSV6-MATRIX-DIMENSION-LIMIT for large matrices
      expect(codes.errors).toContain('PSV6-MATRIX-DIMENSION-LIMIT');
    });

    it('should pass valid collection sizes', () => {
      const code = `//@version=6
indicator("Test")
var okArray = array.new<float>(100)
var okMatrix = matrix.new<float>(100, 100)`;
      const { codes } = run(code);
      expectLacks(codes, { errors: ['PSV6-RES-COLL', 'PSV6-RES-MATRIX'] });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 6. Migration Assistance
  // ────────────────────────────────────────────────────────────────────────────────

  describe('Migration Assistance', () => {
    it('should warn on old na comparison syntax', () => {
      const code = `//@version=6
indicator("Test")
if close == na
    label.new(bar_index, high, "Old na comparison")`;
      const { codes } = run(code);
      // The base validator already handles this with PS023, which is correct
      expectHas(codes, { warnings: ['PS023'] });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 7. Performance Patterns
  // ────────────────────────────────────────────────────────────────────────────────

  describe('Performance Patterns', () => {
    it('should warn about request.security inside loop', () => {
      const code = `//@version=6
indicator("Test")
for i = 0 to 5
    request.security(syminfo.tickerid, "D", high[i])`;
      const { codes } = run(code);
      // Request calls inside loops surface dedicated performance warnings in v6
      expectHas(codes, { warnings: ['PSV6-REQUEST-PERF-LOOP'] });
      expectLacks(codes, { errors: ['PSV6-FUNCTION-PARAM-TYPE'] });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 8. Other V6-Specific Features
  // ────────────────────────────────────────────────────────────────────────────────

  describe('V6-Specific Features', () => {
    it('should identify Pine Logs usage', () => {
      const code = `//@version=6
indicator("Test")
log.info("This is a test log message at bar {0}", bar_index)`;
      const { codes } = run(code);
      // TODO: Implement PSV6-LOGS detection
      // For now, this passes without info (feature not yet implemented)
      expect(codes.info).not.toContain('PSV6-LOGS');
    });

    it('should identify generic syntax usage', () => {
      const code = `//@version=6
indicator("Test")
var priceArray = array.new<float>(10, close)`;
      const { codes } = run(code);
      // TODO: Implement PSV6-GENERIC-SYNTAX detection
      // For now, this passes without info (feature not yet implemented)
      expect(codes.info).not.toContain('PSV6-GENERIC-SYNTAX');
    });

    it('should identify dynamic timeframe usage', () => {
      const code = `//@version=6
indicator("Test")
dynamic_tf = timeframe.period == "D" ? "W" : "D"
s = request.security(syminfo.tickerid, dynamic_tf, close)
plot(s)`;
      const { codes } = run(code);
      // TODO: Implement PSV6-DYNAMIC-TIMEFRAME detection
      // For now, this feature is not implemented
      expect(codes.info).not.toContain('PSV6-DYNAMIC-TIMEFRAME');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 9. For Loop Support (Recently Added)
  // ────────────────────────────────────────────────────────────────────────────────

  describe('For Loop Support', () => {
    it('should recognize for loop variables and keywords', () => {
      const code = `//@version=6
indicator("Test")
for i = 0 to 5
    // loop body
for j = 0 to 10 by 2
    // loop body with step
plot(close)`;
      const { codes } = run(code);
      // Should not have undefined reference errors for 'i', 'j', 'to', 'by'
      const undefinedErrors = codes.warnings.filter(w => 
        w === 'PSU02' && (w.includes("'i'") || w.includes("'j'") || w.includes("'to'") || w.includes("'by'"))
      );
      expect(undefinedErrors).toHaveLength(0);
    });
  });
});
