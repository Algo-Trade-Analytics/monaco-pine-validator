import { EnhancedModularValidator } from '../..';
import { ValidationContext, ValidatorConfig } from '../../core/types';
import { expectHas, expectLacks } from './test-utils';

/// <reference types="vitest/globals" />

describe('UDT Validation (TDD)', () => {
  let validator: EnhancedModularValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new EnhancedModularValidator({
      targetVersion: 6,
      strictMode: true,
      enablePerformanceAnalysis: true
    });

    context = {
      cleanLines: [],
      lines: [],
      lineFeeds: [],
      comments: [],
      regions: [],
      userFunctions: new Map(),
      functionCalls: [],
      functionNames: new Set(),
      functionParams: new Map(),
      methodNames: new Set(),
      typeMap: new Map(),
      hasVersion: false,
      firstVersionLine: 0,
      scriptType: 'indicator',
      isLibrary: false
    };

    config = {
      targetVersion: 6,
      strictMode: true,
      enablePerformanceAnalysis: true,
      enableStyleChecks: true
    };
  });

  describe('PSV6-UDT: UDT Declaration Validation', () => {
    it('should validate correct UDT declarations', () => {
      const code = `//@version=6
indicator("UDT Test")

type Point
    float x
    float y

type PriceBar
    float open
    float high
    float low
    float close

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      // Only check UDT-specific errors, not type inference errors
      const udtErrors = result.errors.filter(e => e.code.startsWith('PSV6-UDT') || e.code.startsWith('PSV6-METHOD'));
      expect(udtErrors).toEqual([]);
    });

    it('should error on duplicate UDT names', () => {
      const code = `//@version=6
indicator("Duplicate UDT")

type Point
    float x
    float y

type Point
    float x
    float y

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-UDT-DUPLICATE'] });
    });

    it('should warn on empty UDTs', () => {
      const code = `//@version=6
indicator("Empty UDT")

type EmptyType

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-UDT-EMPTY'] });
    });
  });

  describe('PSV6-METHOD: Method Declaration Validation', () => {
    it('should error on method without this parameter', () => {
      const code = `//@version=6
indicator("Method Test")

type Point
    float x
    float y

method draw(Point p) =>
    label.new(p.x, p.y, "Invalid Method")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-METHOD-THIS'] });
    });

    it('should suggest type annotation for this parameter', () => {
      const code = `//@version=6
indicator("Method Test")

type Point
    float x
    float y

method move_untyped(this, newX) =>
    this.x := newX

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { info: ['PSV6-METHOD-TYPE'] });
    });

    it('should pass correct method declaration', () => {
      const code = `//@version=6
indicator("Method Test")

type Point
    float x
    float y

method move(this<Point>, newX) =>
    this.x := newX

myPoint = Point.new(bar_index, high)
myPoint.move(bar_index + 10)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectLacks(result, { errors: ['PSV6-METHOD-THIS'] });
    });
  });

  describe('PSV6-METHOD-INVALID: Method Call Validation', () => {
    it('should warn on method call on int', () => {
      const code = `//@version=6
indicator("Method Call Test")

int x = 10
x.move(5)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-METHOD-INVALID'] });
    });

    it('should warn on method call on float', () => {
      const code = `//@version=6
indicator("Method Call Test")

float y = 1.5
y.update(2.0)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-METHOD-INVALID'] });
    });

    it('should warn on method call on string', () => {
      const code = `//@version=6
indicator("Method Call Test")

string s = "test"
s.process()

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-METHOD-INVALID'] });
    });

    it('should not warn on method call on UDT', () => {
      const code = `//@version=6
indicator("Method Call Test")

type Point
    float x
    float y

method move(this<Point>, newX) =>
    this.x := newX

myPoint = Point.new(1, 2)
myPoint.move(5)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectLacks(result, { warnings: ['PSV6-METHOD-INVALID'] });
    });

    it('should allow chained method calls on UDT fields', () => {
      const code = `//@version=6
indicator("UDT Chaining")

type Point
    float x
    float y

    method move(this<Point>, float dx, float dy) =>
        this.x := this.x + dx
        this.y := this.y + dy
        this

type Line
    Point start
    Point end

    method translate(this<Line>, float dx, float dy) =>
        this.start.move(dx, dy)
        this.end.move(dx, dy)
        this

line = Line.new(Point.new(0.0, 0.0), Point.new(10.0, 10.0))
line.translate(5.0, 5.0)
plot(close)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expectLacks(result, { errors: ['PSV6-FUNCTION-NAMESPACE', 'PSV6-FUNCTION-UNKNOWN'] });
    });
  });

  describe('PSV6-UDT-COMPLEX: Complex UDT Usage', () => {
    it('should handle UDT as function parameter', () => {
      const code = `//@version=6
indicator("Complex UDT Test")

type PriceBar
    float o
    float h
    float l
    float c

isBullish(PriceBar bar) =>
    bar.c > bar.o

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      // Only check UDT-specific errors, not type inference errors
      const udtErrors = result.errors.filter(e => e.code.startsWith('PSV6-UDT') || e.code.startsWith('PSV6-METHOD'));
      expect(udtErrors).toEqual([]);
    });

    it('should handle multiple UDTs with methods', () => {
      const code = `//@version=6
indicator("Multiple UDTs Test")

type Point
    float x
    float y

method move(this<Point>, newX, newY) =>
    this.x := newX
    this.y := newY

type Rectangle
    Point topLeft
    Point bottomRight

method area(this<Rectangle>) =>
    (this.bottomRight.x - this.topLeft.x) * (this.bottomRight.y - this.topLeft.y)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      // Only check UDT-specific errors, not type inference errors
      const udtErrors = result.errors.filter(e => e.code.startsWith('PSV6-UDT') || e.code.startsWith('PSV6-METHOD'));
      expect(udtErrors).toEqual([]);
    });
  });
});
