import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { expectHas } from './test-utils';

const createValidator = () => new EnhancedModularValidator({
  version: '6',
  scriptType: 'indicator',
  strictMode: true,
});

describe('PSV6-MATH-FUNCTIONS: Math Functions Validation (TDD)', () => {
  describe('PSV6-MATH-BASIC: Basic Math Functions', () => {
    it('should validate math.max() function', () => {
      const code = `
//@version=6
indicator("Math Max Test")

maxValue = math.max(close, open)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.min() function', () => {
      const code = `
//@version=6
indicator("Math Min Test")

minValue = math.min(close, open)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.abs() function', () => {
      const code = `
//@version=6
indicator("Math Abs Test")

absValue = math.abs(close - open)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on incorrect math function parameter types', () => {
      const code = `
//@version=6
indicator("Invalid Math Test")

invalidMax = math.max("string", 10)
invalidAbs = math.abs("string")
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-MATH-FUNCTION-PARAM')).toBe(true);
    });
  });

  describe('PSV6-MATH-ROUNDING: Rounding Functions', () => {
    it('should validate math.round() function', () => {
      const code = `
//@version=6
indicator("Math Round Test")

roundValue = math.round(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.floor() function', () => {
      const code = `
//@version=6
indicator("Math Floor Test")

floorValue = math.floor(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.ceil() function', () => {
      const code = `
//@version=6
indicator("Math Ceil Test")

ceilValue = math.ceil(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.round_to_mintick() function', () => {
      const code = `
//@version=6
indicator("Math Round to Mintick Test")

mintickValue = math.round_to_mintick(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid rounding parameters', () => {
      const code = `
//@version=6
indicator("Invalid Rounding Test")

invalidRound = math.round("string")
invalidFloor = math.floor(true)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-MATH-FUNCTION-PARAM')).toBe(true);
    });
  });

  describe('PSV6-MATH-EXPONENTIAL: Exponential Functions', () => {
    it('should validate math.pow() function', () => {
      const code = `
//@version=6
indicator("Math Pow Test")

powValue = math.pow(close, 2)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.sqrt() function', () => {
      const code = `
//@version=6
indicator("Math Sqrt Test")

sqrtValue = math.sqrt(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.exp() function', () => {
      const code = `
//@version=6
indicator("Math Exp Test")

expValue = math.exp(close / 100)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.log() function', () => {
      const code = `
//@version=6
indicator("Math Log Test")

logValue = math.log(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.log10() function', () => {
      const code = `
//@version=6
indicator("Math Log10 Test")

log10Value = math.log10(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid exponential parameters', () => {
      const code = `
//@version=6
indicator("Invalid Exponential Test")

invalidPow = math.pow("string", 2)
invalidSqrt = math.sqrt(-1)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-MATH-FUNCTION-PARAM')).toBe(true);
    });
  });

  describe('PSV6-MATH-TRIGONOMETRY: Trigonometry Functions', () => {
    it('should validate math.sin() function', () => {
      const code = `
//@version=6
indicator("Math Sin Test")

sinValue = math.sin(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.cos() function', () => {
      const code = `
//@version=6
indicator("Math Cos Test")

cosValue = math.cos(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.tan() function', () => {
      const code = `
//@version=6
indicator("Math Tan Test")

tanValue = math.tan(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.asin() function', () => {
      const code = `
//@version=6
indicator("Math Asin Test")

asinValue = math.asin(close / 100)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.acos() function', () => {
      const code = `
//@version=6
indicator("Math Acos Test")

acosValue = math.acos(close / 100)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.atan() function', () => {
      const code = `
//@version=6
indicator("Math Atan Test")

atanValue = math.atan(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.atan2() function', () => {
      const code = `
//@version=6
indicator("Math Atan2 Test")

atan2Value = math.atan2(close, open)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid trigonometry parameters', () => {
      const code = `
//@version=6
indicator("Invalid Trigonometry Test")

invalidSin = math.sin("string")
invalidAtan2 = math.atan2("string", 10)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-MATH-FUNCTION-PARAM')).toBe(true);
    });
  });

  describe('PSV6-MATH-UTILITIES: Utility Functions', () => {
    it('should validate math.sign() function', () => {
      const code = `
//@version=6
indicator("Math Sign Test")

signValue = math.sign(close - open)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.random() function', () => {
      const code = `
//@version=6
indicator("Math Random Test")

randomValue = math.random()
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.todegrees() function', () => {
      const code = `
//@version=6
indicator("Math To Degrees Test")

degreesValue = math.todegrees(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.toradians() function', () => {
      const code = `
//@version=6
indicator("Math To Radians Test")

radiansValue = math.toradians(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid utility parameters', () => {
      const code = `
//@version=6
indicator("Invalid Utility Test")

invalidSign = math.sign("string")
invalidTodegrees = math.todegrees(true)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-MATH-FUNCTION-PARAM')).toBe(true);
    });
  });

  describe('PSV6-MATH-STATISTICS: Statistics Functions', () => {
    it('should validate math.sum() function', () => {
      const code = `
//@version=6
indicator("Math Sum Test")

sumValue = math.sum(close, 10)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate math.avg() function', () => {
      const code = `
//@version=6
indicator("Math Avg Test")

avgValue = math.avg(close, 10)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should flag math.median() as unsupported', () => {
      const code = `
//@version=6
indicator("Math Median Test")

medianValue = math.median(close, 10)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(false);
      expectHas(result, { errors: ['PSV6-FUNCTION-NAMESPACE'] });
    });

    it('should flag math.mode() as unsupported', () => {
      const code = `
//@version=6
indicator("Math Mode Test")

modeValue = math.mode(close, 10)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(false);
      expectHas(result, { errors: ['PSV6-FUNCTION-NAMESPACE'] });
    });

    it('should error on invalid statistics parameters', () => {
      const code = `
//@version=6
indicator("Invalid Statistics Test")

invalidSum = math.sum("string", 10)
invalidAvg = math.avg(close, -5)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-MATH-FUNCTION-PARAM')).toBe(true);
    });
  });

  describe('PSV6-MATH-PERFORMANCE: Math Performance Validation', () => {
    it('should warn on expensive math functions in loops', () => {
      const code = `
//@version=6
indicator("Expensive Math in Loop Test")

for i = 0 to 100
    powValue = math.pow(close, 3)
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-MATH-PERF-LOOP')).toBe(true);
    });

    it('should warn on too many math function calls', () => {
      const code = `
//@version=6
indicator("Too Many Math Functions Test")

sin1 = math.sin(close)
cos1 = math.cos(close)
tan1 = math.tan(close)
asin1 = math.asin(close / 100)
acos1 = math.acos(close / 100)
atan1 = math.atan(close)
pow1 = math.pow(close, 2)
sqrt1 = math.sqrt(close)
exp1 = math.exp(close / 100)
log1 = math.log(close)
log10_1 = math.log10(close)
round1 = math.round(close)
floor1 = math.floor(close)
ceil1 = math.ceil(close)
abs1 = math.abs(close)
max1 = math.max(close, open)
min1 = math.min(close, open)
sign1 = math.sign(close)
random1 = math.random()
todegrees1 = math.todegrees(close)
toradians1 = math.toradians(close)
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-MATH-PERF-MANY')).toBe(true);
    });

    it('should warn on nested expensive math function calls', () => {
      const code = `
//@version=6
indicator("Nested Expensive Math Test")

complexMath = math.pow(math.sin(math.cos(close)), math.sqrt(open))
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-MATH-PERF-NESTED')).toBe(true);
    });
  });

  describe('PSV6-MATH-BEST-PRACTICES: Math Best Practices', () => {
    it('should suggest caching repeated math calculations', () => {
      const code = `
//@version=6
indicator("Repeated Math Calculations Test")

sinValue = math.sin(close)
condition1 = math.sin(close) > 0.5
condition2 = math.sin(close) < -0.5
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-MATH-CACHE-SUGGESTION')).toBe(true);
    });

    it('should suggest reasonable math parameters', () => {
      const code = `
//@version=6
indicator("Extreme Math Parameters Test")

extremePow = math.pow(close, 100)
extremeSqrt = math.sqrt(close)
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-MATH-PARAM-SUGGESTION')).toBe(true);
    });

    it('should suggest proper math function combinations', () => {
      const code = `
//@version=6
indicator("Math Combinations Test")

// Good combination: trigonometric functions
sinValue = math.sin(close)
cosValue = math.cos(close)
magnitude = math.sqrt(math.pow(sinValue, 2) + math.pow(cosValue, 2))

// Suggest using math.pow instead of manual multiplication
manualPow = close * close * close
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-MATH-COMBINATION-SUGGESTION')).toBe(true);
    });
  });

  describe('PSV6-MATH-COMPLEX: Complex Math Scenarios', () => {
    it('should handle multiple math functions in complex expressions', () => {
      const code = `
//@version=6
indicator("Complex Math Expressions Test")

// Complex mathematical expression
distance = math.sqrt(math.pow(close - open, 2) + math.pow(high - low, 2))
angle = math.atan2(close - open, high - low)
normalizedAngle = math.todegrees(angle)

// Statistical calculations
mean = math.avg(close, 20)
variance = math.avg(math.pow(close - mean, 2), 20)
stdDev = math.sqrt(variance)

// Trigonometric wave
wave = math.sin(bar_index * math.pi / 10) * math.cos(close / 100)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle math functions in conditional expressions', () => {
      const code = `
//@version=6
indicator("Math in Conditionals Test")

sinValue = math.sin(close)
cosValue = math.cos(close)

buySignal = if math.abs(sinValue) > 0.8
    cosValue > 0
else
    false

sellSignal = math.sign(sinValue) != math.sign(cosValue)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle math functions with dynamic parameters', () => {
      const code = `
//@version=6
indicator("Dynamic Math Parameters Test")

period = 20
power = 2

avgValue = math.avg(close, period)
powValue = math.pow(avgValue, power)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-MATH-EDGE-CASES: Math Edge Cases', () => {
    it('should handle math functions with na values', () => {
      const code = `
//@version=6
indicator("Math with NA Test")

naValue = na
sinWithNA = math.sin(naValue)
powWithNA = math.pow(naValue, 2)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle math functions with extreme values', () => {
      const code = `
//@version=6
indicator("Math with Extreme Values Test")

extremeHigh = 1e10
extremeLow = -1e10

sinHigh = math.sin(extremeHigh)
sinLow = math.sin(extremeLow)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle math functions with zero parameters', () => {
      const code = `
//@version=6
indicator("Math with Zero Parameters Test")

zeroPow = math.pow(close, 0)
zeroSqrt = math.sqrt(0)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
