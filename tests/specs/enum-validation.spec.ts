import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationContext, ValidatorConfig } from '../../core/types';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { expectHas } from './test-utils';

describe('Enum Validation (TDD)', () => {
  let validator: EnhancedModularValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new EnhancedModularValidator();
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
      enableInfo: true,
      targetVersion: 6,
      allowDeprecated: false,
      enableTypeChecking: true,
      enableControlFlowAnalysis: true,
      enablePerformanceAnalysis: true,
      enableStyleChecks: true,
      customRules: [],
      ignoredCodes: []
    };
  });

  describe('PSV6-ENUM-SYNTAX: Enum Declaration Syntax Validation', () => {
    it('should validate correct enum declaration syntax', () => {
      const code = `//@version=6
indicator("Enum Test")

enum MyEnum
    VALUE1
    VALUE2
    VALUE3

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on enum without values', () => {
      const code = `//@version=6
indicator("Empty Enum Test")

enum EmptyEnum

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-ENUM-EMPTY'] });
    });

    it('should error on duplicate enum values', () => {
      const code = `//@version=6
indicator("Duplicate Enum Test")

enum MyEnum
    VALUE1
    VALUE2
    VALUE1

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-ENUM-DUPLICATE-VALUE'] });
    });

    it('should error on invalid enum value names', () => {
      const code = `//@version=6
indicator("Invalid Enum Test")

enum MyEnum
    VALUE1
    123INVALID
    VALUE3

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-ENUM-INVALID-VALUE-NAME'] });
    });
  });

  describe('PSV6-ENUM-USAGE: Enum Usage Validation', () => {
    it('should validate correct enum usage', () => {
      const code = `//@version=6
indicator("Enum Usage Test")

enum Status
    ACTIVE
    INACTIVE
    PENDING

Status current_status = Status.ACTIVE
plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on undefined enum value', () => {
      const code = `//@version=6
indicator("Undefined Enum Test")

enum Status
    ACTIVE
    INACTIVE

Status current_status = Status.UNDEFINED
plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-ENUM-UNDEFINED-VALUE'] });
    });

    it('should error on enum value without enum type', () => {
      const code = `//@version=6
indicator("Invalid Enum Access Test")

Status current_status = Status.ACTIVE
plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-ENUM-UNDEFINED-TYPE'] });
    });

    it('should error on enum assignment type mismatch', () => {
      const code = `//@version=6
indicator("Enum Type Mismatch Test")

enum Status
    ACTIVE
    INACTIVE

int current_status = Status.ACTIVE
plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-ENUM-TYPE-MISMATCH'] });
    });
  });

  describe('PSV6-ENUM-FUNCTION: Enum in Function Parameters', () => {
    it('should validate enum in function parameters', () => {
      const code = `//@version=6
indicator("Enum Function Test")

enum Status
    ACTIVE
    INACTIVE

f(status) =>
    if status == Status.ACTIVE
        "Active"
    else
        "Inactive"

result = f(Status.ACTIVE)
plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on wrong enum type in function call', () => {
      const code = `//@version=6
indicator("Enum Function Type Test")

enum Status
    ACTIVE
    INACTIVE

enum Color
    RED
    BLUE

f(status) =>
    if status == Status.ACTIVE
        "Active"
    else
        "Inactive"

result = f(Color.RED)
plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-ENUM-FUNCTION-TYPE-MISMATCH'] });
    });
  });

  describe('PSV6-ENUM-COMPARISON: Enum Comparison Validation', () => {
    it('should validate enum comparisons', () => {
      const code = `//@version=6
indicator("Enum Comparison Test")

enum Status
    ACTIVE
    INACTIVE

Status current_status = Status.ACTIVE
if current_status == Status.ACTIVE
    plot(close)
else
    plot(high)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should warn on enum comparison with different types', () => {
      const code = `//@version=6
indicator("Enum Comparison Type Test")

enum Status
    ACTIVE
    INACTIVE

enum Color
    RED
    BLUE

Status current_status = Status.ACTIVE
if current_status == Color.RED
    plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-ENUM-COMPARISON-TYPE-MISMATCH'] });
    });
  });

  describe('PSV6-ENUM-SWITCH: Enum in Switch Statements', () => {
    it('should validate enum in switch statements', () => {
      const code = `//@version=6
indicator("Enum Switch Test")

enum Status
    ACTIVE
    INACTIVE
    PENDING

Status current_status = Status.ACTIVE
switch current_status
    Status.ACTIVE => "Active"
    Status.INACTIVE => "Inactive"
    Status.PENDING => "Pending"
    => "Unknown"

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on switch case with wrong enum type', () => {
      const code = `//@version=6
indicator("Enum Switch Type Test")

enum Status
    ACTIVE
    INACTIVE

enum Color
    RED
    BLUE

Status current_status = Status.ACTIVE
switch current_status
    Status.ACTIVE => "Active"
    Color.RED => "Red"
    => "Unknown"

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-ENUM-SWITCH-CASE-TYPE-MISMATCH'] });
    });
  });

  describe('PSV6-ENUM-BEST-PRACTICES: Enum Best Practices', () => {
    it('should suggest better enum naming', () => {
      const code = `//@version=6
indicator("Enum Naming Test")

enum e
    v1
    v2

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { info: ['PSV6-ENUM-NAMING-SUGGESTION'] });
    });

    it('should suggest enum value naming conventions', () => {
      const code = `//@version=6
indicator("Enum Value Naming Test")

enum Status
    active
    inactive

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { info: ['PSV6-ENUM-VALUE-NAMING-SUGGESTION'] });
    });
  });

  describe('PSV6-ENUM-COMPLEX: Complex Enum Scenarios', () => {
    it('should handle multiple enum declarations', () => {
      const code = `//@version=6
indicator("Multiple Enum Test")

enum Status
    ACTIVE
    INACTIVE

enum Color
    RED
    BLUE
    GREEN

Status current_status = Status.ACTIVE
Color current_color = Color.RED
plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle enum in complex expressions', () => {
      const code = `//@version=6
indicator("Complex Enum Test")

enum Status
    ACTIVE
    INACTIVE

Status current_status = Status.ACTIVE
bool is_active = current_status == Status.ACTIVE
string status_text = is_active ? "Active" : "Inactive"
plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle enum in function return types', () => {
      const code = `//@version=6
indicator("Enum Return Type Test")

enum Status
    ACTIVE
    INACTIVE

f() =>
    Status.ACTIVE

Status result = f()
plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
