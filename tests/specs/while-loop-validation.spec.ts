import { describe, it, expect, beforeEach } from 'vitest';
import { WhileLoopValidator } from '../../modules/while-loop-validator';
import { ValidationContext, ValidatorConfig } from '../../core/types';
import { expectHas, expectLacks } from './test-utils';

/// <reference types="vitest/globals" />

describe('While Loop Validation (TDD)', () => {
  let validator: WhileLoopValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new WhileLoopValidator();
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
      allowDeprecated: false,
      enableTypeChecking: true,
      enableControlFlowAnalysis: true,
      enablePerformanceAnalysis: true,
      enablePerformanceChecks: true,
      enableStyleChecks: true,
      customRules: [],
      ignoredCodes: []
    };
  });

  describe('PSV6-WHILE-SYNTAX: While Loop Syntax Validation', () => {
    it('should validate correct while loop syntax', () => {
      const code = `//@version=6
indicator("While Loop Test")

i = 0
while i < 10
    i := i + 1
    plot(close)
end

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on empty while condition', () => {
      const code = `//@version=6
indicator("Empty While Test")

while
    plot(close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-WHILE-EMPTY-CONDITION'] });
    });

    it('should error on missing end statement', () => {
      const code = `//@version=6
indicator("Missing End Test")

i = 0
while i < 10
    i := i + 1

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-WHILE-MISSING-END'] });
    });
  });

  describe('PSV6-WHILE-CONDITION: While Loop Condition Validation', () => {
    it('should error on infinite while loop', () => {
      const code = `//@version=6
indicator("Infinite While Test")

while true
    plot(close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-WHILE-INFINITE-LOOP'] });
    });

    it('should warn on while loop that never executes', () => {
      const code = `//@version=6
indicator("Never Executes Test")

while false
    plot(close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-WHILE-NEVER-EXECUTES'] });
    });

    it('should warn on numeric while condition', () => {
      const code = `//@version=6
indicator("Numeric While Test")

while 10
    plot(close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-WHILE-NUMERIC-CONDITION'] });
    });

    it('should warn on string while condition', () => {
      const code = `//@version=6
indicator("String While Test")

while "hello"
    plot(close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-WHILE-STRING-CONDITION'] });
    });

    it('should warn on complex while condition', () => {
      const code = `//@version=6
indicator("Complex While Test")

while i < 10 and j > 5 and k == 0 and m != 1
    plot(close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-WHILE-COMPLEX-CONDITION'] });
    });
  });

  describe('PSV6-WHILE-PERF: While Loop Performance Validation', () => {
    it('should warn on expensive operations in while loop', () => {
      const code = `//@version=6
indicator("Expensive While Test")

i = 0
while i < 10
    data = request.security("AAPL", "1D", close)
    sma_value = ta.sma(close, 20)
    i := i + 1

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-WHILE-EXPENSIVE-OPERATION'] });
    });

    it('should warn on complex operations in while loop', () => {
      const code = `//@version=6
indicator("Complex While Test")

i = 0
while i < 10
    if close > open
        for j = 0 to 5
            switch j
                0 => plot(close)
                1 => plot(high)
                => plot(low)
    i := i + 1
end

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-WHILE-COMPLEX-OPERATION'] });
    });
  });

  describe('PSV6-WHILE-NESTING: While Loop Nesting Validation', () => {
    it('should warn on deep while loop nesting', () => {
      const code = `//@version=6
indicator("Deep Nesting Test")

i = 0
while i < 10
    j = 0
    while j < 10
        k = 0
        while k < 10
            l = 0
            while l < 10
                plot(close)
                l := l + 1
            k := k + 1
        j := j + 1
    i := i + 1

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-WHILE-DEEP-NESTING'] });
    });
  });

  describe('PSV6-WHILE-BEST-PRACTICES: While Loop Best Practices', () => {
    it('should suggest using != instead of == in while condition', () => {
      const code = `//@version=6
indicator("Best Practice Test")

i = 0
while i == 0
    i := i + 1

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { info: ['PSV6-WHILE-CONDITION-BEST-PRACTICE'] });
    });

    it('should suggest better variable naming in while condition', () => {
      const code = `//@version=6
indicator("Variable Naming Test")

i = 0
while i < 10
    i := i + 1

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { info: ['PSV6-WHILE-VARIABLE-NAMING'] });
    });

    it('should recognize good loop variable updates', () => {
      const code = `//@version=6
indicator("Good Variable Update Test")

i = 0
while i < 10
    i := i + 1
    counter := counter + 1

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { info: ['PSV6-WHILE-VARIABLE-UPDATE-GOOD'] });
    });

    it('should recognize break conditions in while loop', () => {
      const code = `//@version=6
indicator("Break Condition Test")

i = 0
while i < 10
    if i > 5
        break
    i := i + 1

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { info: ['PSV6-WHILE-BREAK-CONDITION'] });
    });

    it('should recognize conditional breaks in while loop', () => {
      const code = `//@version=6
indicator("Conditional Break Test")

i = 0
while i < 10
    if close > open
        break
    i := i + 1

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { info: ['PSV6-WHILE-CONDITIONAL-BREAK'] });
    });
  });

  describe('PSV6-WHILE-COMPLEX: Complex While Loop Scenarios', () => {
    it('should handle nested while loops with different conditions', () => {
      const code = `//@version=6
indicator("Nested While Test")

i = 0
while i < 10
    j = 0
    while j < 5
        k = 0
        while k < 3
            plot(close)
            k := k + 1
        end
        j := j + 1
    end
    i := i + 1
end

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle while loops with complex conditions', () => {
      const code = `//@version=6
indicator("Complex Condition Test")

i = 0
j = 0
while i < 10 and j < 5
    if close > open
        i := i + 1
    else
        j := j + 1
end

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle while loops with multiple break conditions', () => {
      const code = `//@version=6
indicator("Multiple Break Test")

i = 0
while i < 100
    if i > 50
        break
    if close < open
        break
    if ta.crossover(close, ta.sma(close, 20))
        break
    i := i + 1
end

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
