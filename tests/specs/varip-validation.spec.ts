import { describe, it, expect, beforeEach } from 'vitest';
import { VaripValidator } from '../../modules/varip-validator';
import { ValidationContext, ValidatorConfig } from '../../core/types';
import { expectHas, createModuleHarness } from './test-utils';

describe('Varip Validation (TDD)', () => {
  let validator: VaripValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new VaripValidator();
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
      hasVersion: false,
      firstVersionLine: null
    };
    config = {
      strictMode: true,
      enableWarnings: true,
      enableInfo: true
    } as ValidatorConfig;
  });

  describe('PSV6-VARIP: Varip Declaration Validation', () => {
    it('should validate correct varip declarations', () => {
      const code = `//@version=6
indicator("Varip Test")

// Valid varip declarations
varip int intrabar_count = 0
varip float bar_state = 0.0
varip bool flag = false
varip string message = "initial"

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      if (!result.isValid) {
        console.log('Errors:', result.errors.map(e => ({ code: e.code, message: e.message, line: e.line })));
        console.log('Warnings:', result.warnings.map(w => ({ code: w.code, message: w.message, line: w.line })));
      }
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on invalid varip syntax', () => {
      const code = `//@version=6
indicator("Invalid Varip")

// Invalid syntax
varip = 10
varip int
varip int count

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-VARIP-SYNTAX', 'PSV6-VARIP-INITIAL-VALUE'] });
    });

    it('should warn on non-literal initial values', () => {
      const code = `//@version=6
indicator("Non-literal Varip")

// Non-literal initial values
varip int count = ta.sma(close, 20)
varip float value = close[1]

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      if (result.warnings.length === 0) {
        console.log('No warnings found. Errors:', result.errors.map(e => ({ code: e.code, message: e.message, line: e.line })));
      }
      expectHas(result, { warnings: ['PSV6-VARIP-LITERAL-INIT'] });
    });

    it('should warn on poor naming conventions', () => {
      const code = `//@version=6
indicator("Poor Naming")

// Poor naming
varip int x = 0
varip float a = 1.0

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-VARIP-NAMING'] });
    });
  });

  describe('PSV6-VARIP-USAGE: Varip Usage Validation', () => {
    it('should validate correct varip usage patterns', () => {
      const code = `//@version=6
indicator("Correct Varip Usage")

varip int intrabar_count = 0

if barstate.isconfirmed
    intrabar_count := 0
else
    intrabar_count := intrabar_count + 1

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on incorrect assignment operator', () => {
      const code = `//@version=6
indicator("Wrong Assignment")

varip int count = 0

count = 10  // Should use :=

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      if (result.errors.length === 0) {
        console.log('No errors found. Warnings:', result.warnings.map(w => ({ code: w.code, message: w.message, line: w.line })));
      }
      expectHas(result, { errors: ['PSV6-VARIP-ASSIGNMENT'] });
    });

    it('should warn on missing barstate conditions', () => {
      const code = `//@version=6
indicator("Missing Barstate")

varip int count = 0

count := count + 1  // Should consider barstate

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-VARIP-BARSTATE'] });
    });
  });

  describe('PSV6-VARIP-SCOPE: Varip Scope Validation', () => {
    it('should error on varip in functions', () => {
      const code = `//@version=6
indicator("Varip in Function")

myFunction() =>
    varip int count = 0  // Not allowed
    count

plot(myFunction())`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-VARIP-SCOPE-FUNCTION'] });
    });

    it('should error on varip in loops', () => {
      const code = `//@version=6
indicator("Varip in Loop")

for i = 0 to 10
    varip int count = 0  // Not allowed
    count

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-VARIP-SCOPE-LOOP'] });
    });
  });

  describe('PSV6-VARIP-PERFORMANCE: Varip Performance Validation', () => {
    it('should warn on too many varip variables', () => {
      const code = `//@version=6
indicator("Too Many Varip")

varip int count1 = 0
varip int count2 = 0
varip int count3 = 0
varip int count4 = 0
varip int count5 = 0
varip int count6 = 0
varip int count7 = 0
varip int count8 = 0
varip int count9 = 0
varip int count10 = 0
varip int count11 = 0  // Too many

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-VARIP-PERFORMANCE'] });
    });

    it('should warn on varip in strategy scripts', () => {
      const code = `//@version=6
strategy("Varip in Strategy")

varip int count1 = 0
varip int count2 = 0
varip int count3 = 0
varip int count4 = 0
varip int count5 = 0
varip int count6 = 0  // Too many for strategy

plot(close)`;
      
      // Use test harness to properly parse AST and extract script type
      const harness = createModuleHarness(new VaripValidator(), config);
      const result = harness.run(code, config);
      expectHas(result, { warnings: ['PSV6-VARIP-STRATEGY'] });
    });
  });

  describe('PSV6-VARIP-TYPE: Varip Type Validation', () => {
    it('should infer types from initial values', () => {
      const code = `//@version=6
indicator("Type Inference")

varip int count = 10
varip float value = 10.5
varip bool flag = true
varip string msg = "hello"

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should warn on unknown type inference', () => {
      const code = `//@version=6
indicator("Unknown Type")

varip unknown_var = some_function()

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-VARIP-TYPE-INFERENCE'] });
    });
  });
});
