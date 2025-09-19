import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { expectHas } from './test-utils';

const createValidator = () => new EnhancedModularValidator({
  targetVersion: 6,
  strictMode: true,
  enablePerformanceAnalysis: true
});

describe('Polyline Functions Validation', () => {
  describe('polyline.new()', () => {
    it('accepts a points array', () => {
      const code = `//@version=6
indicator("Polyline New Test")

points = array.new<line>()
polyline_id = polyline.new(points)

plot(close)`;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('flags missing parameters', () => {
      const code = `//@version=6
indicator("Polyline New Error Test")

polyline_id = polyline.new()

plot(close)`;
      const result = createValidator().validate(code);
      expectHas(result, { errors: ['PSV6-POLYLINE-NEW-PARAMS'] });
    });
  });

  describe('polyline.delete()', () => {
    it('accepts a valid id', () => {
      const code = `//@version=6
indicator("Polyline Delete Test")

points = array.new<line>()
polyline_id = polyline.new(points)
polyline.delete(polyline_id)

plot(close)`;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-POLYLINE-DELETE-INFO'] });
    });

    it('flags missing id parameter', () => {
      const code = `//@version=6
indicator("Polyline Delete Error Test")

polyline.delete()

plot(close)`;
      const result = createValidator().validate(code);
      expectHas(result, { errors: ['PSV6-POLYLINE-DELETE-PARAMS'] });
    });
  });
});
