import { describe, it, expect, beforeEach } from 'vitest';
import { TypeInferenceValidator } from '../../modules/type-inference-validator';
import { ValidationContext, ValidatorConfig } from '../../core/types';
import { expectHas, expectLacks } from './test-utils';

/// <reference types="vitest/globals" />

describe('Type Inference Validation (TDD)', () => {
  let validator: TypeInferenceValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new TypeInferenceValidator();
    context = {
      lines: [],
      cleanLines: [],
      rawLines: [],
      typeMap: new Map(),
      usedVars: new Set(),
      declaredVars: new Map(),
      functionNames: new Set(),
      methodNames: new Set(),
      functionParams: new Map(),
      scriptType: null,
      version: 6,
      hasVersion: true,
      firstVersionLine: 1
    };
    config = {
      targetVersion: 6,
      strictMode: true,
      enablePerformanceChecks: true,
      enableStyleChecks: true
    };
  });

  describe('PSV6-TYPE-ASSIGNMENT: Assignment Type Compatibility', () => {
    it('should validate compatible type assignments', () => {
      const code = `//@version=6
indicator("Type Assignment Test")

// Compatible assignments
price: float = 100.5
count: int = 10
flag: bool = true
message: string = "Hello"

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on incompatible type assignments', () => {
      const code = `//@version=6
indicator("Type Assignment Error Test")

// Incompatible assignments
price: float = "100.5"
count: int = true
flag: bool = 10

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-TYPE-ASSIGNMENT-MISMATCH'] });
    });
  });

  describe('PSV6-TYPE-FUNCTION: Function Parameter Type Validation', () => {
    it('should validate correct function parameter types', () => {
      const code = `//@version=6
indicator("Function Parameter Test")

// Correct parameter types
sma_value = ta.sma(close, 20)
max_value = math.max(10, 20)
crossover_result = ta.crossover(close, ta.sma(close, 20))

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on incorrect function parameter types', () => {
      const code = `//@version=6
indicator("Function Parameter Error Test")

// Incorrect parameter types
sma_value = ta.sma("close", 20)
max_value = math.max("10", 20)
crossover_result = ta.crossover(close, "sma")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-TYPE-FUNCTION-PARAM-MISMATCH'] });
    });
  });

  describe('PSV6-TYPE-CONDITIONAL: Conditional Type Validation', () => {
    it('should validate boolean conditions', () => {
      const code = `//@version=6
indicator("Conditional Test")

// Valid boolean conditions
if close > open
    plot(close)

if ta.crossover(close, ta.sma(close, 20))
    plot(close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should warn on non-boolean conditions', () => {
      const code = `//@version=6
indicator("Conditional Warning Test")

// Non-boolean conditions
if close
    plot(close)

if 10
    plot(close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-TYPE-CONDITIONAL-TYPE'] });
    });
  });

  describe('PSV6-TYPE-INFERENCE: Type Inference Validation', () => {
    it('should infer types correctly', () => {
      const code = `//@version=6
indicator("Type Inference Test")

// Type inference
price = 100.5
count = 10
flag = true
message = "Hello"
sma_value = ta.sma(close, 20)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should warn on ambiguous type inference', () => {
      const code = `//@version=6
indicator("Ambiguous Type Test")

// Ambiguous expressions
result = some_unknown_function()
value = complex_expression_with_unknown_types

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-TYPE-INFERENCE-AMBIGUOUS'] });
    });
  });

  describe('PSV6-TYPE-SAFETY: Type Safety Validation', () => {
    it('should warn on unsafe na operations', () => {
      const code = `//@version=6
indicator("NA Safety Test")

// Unsafe na operations
result = na + 10
comparison = na == 0

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-TYPE-SAFETY-NA-ARITHMETIC', 'PSV6-TYPE-SAFETY-NA-COMPARISON'] });
    });

    it('should warn on na literal usage', () => {
      const code = `//@version=6
indicator("NA Literal Test")

// na literal usage
value = na
if value == na
    plot(close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-TYPE-SAFETY-NA-FUNCTION'] });
    });
  });

  describe('PSV6-TYPE-CONVERSION: Type Conversion Validation', () => {
    it('should warn on implicit float to int conversion', () => {
      const code = `//@version=6
indicator("Float to Int Test")

// Implicit float to int conversion
count: int = 10.5

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-TYPE-CONVERSION-FLOAT-TO-INT'] });
    });

    it('should warn on implicit boolean conversion', () => {
      const code = `//@version=6
indicator("Boolean Conversion Test")

// Implicit boolean conversion
value = 10
if value
    plot(close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-TYPE-CONVERSION-IMPLICIT-BOOL'] });
    });

    it('should info on redundant string conversion', () => {
      const code = `//@version=6
indicator("String Conversion Test")

// Redundant string conversion
message = "Hello"
converted = str.tostring(message)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { info: ['PSV6-TYPE-CONVERSION-REDUNDANT-STRING'] });
    });
  });

  describe('PSV6-TYPE-ANNOTATION: Type Annotation Validation', () => {
    it('should suggest type annotations', () => {
      const code = `//@version=6
indicator("Type Annotation Test")

// Variables that could benefit from type annotations
price_value = 100.5
count_value = 10
is_above = close > open
text_message = "Hello"

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { info: ['PSV6-TYPE-ANNOTATION-SUGGESTION'] });
    });

    it('should warn on redundant type annotations', () => {
      const code = `//@version=6
indicator("Redundant Annotation Test")

// Redundant type annotations
price: float = 100.5
count: int = 10
flag: bool = true

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { info: ['PSV6-TYPE-ANNOTATION-REDUNDANT'] });
    });

    it('should error on incorrect type annotations', () => {
      const code = `//@version=6
indicator("Incorrect Annotation Test")

// Incorrect type annotations
price: int = 100.5
count: bool = 10
flag: string = true

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-TYPE-ANNOTATION-MISMATCH'] });
    });
  });

  describe('PSV6-TYPE-COMPLEX: Complex Type Scenarios', () => {
    it('should handle complex type expressions', () => {
      const code = `//@version=6
indicator("Complex Type Test")

// Complex type expressions
sma_20 = ta.sma(close, 20)
sma_50 = ta.sma(close, 50)
crossover = ta.crossover(sma_20, sma_50)
max_price = math.max(high, low)
price_ratio = close / open

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle nested function calls', () => {
      const code = `//@version=6
indicator("Nested Function Test")

// Nested function calls
result = ta.sma(ta.ema(close, 10), 20)
crossover = ta.crossover(ta.sma(close, 20), ta.ema(close, 10))
max_sma = math.max(ta.sma(close, 10), ta.sma(close, 20))

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
