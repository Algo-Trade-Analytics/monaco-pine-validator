import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

const createValidator = () => new EnhancedModularValidator({
  targetVersion: 6,
  strictMode: true,
});

describe('PSV6-COLOR-FUNCTIONS: Color Namespace Validation (TDD)', () => {
  describe('color.new()', () => {
    it('accepts valid base color and transparency', () => {
      const code = `
//@version=6
indicator("Color New OK")

c1 = color.new(color.green, 50)
plot(close, color=c1)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects invalid base color type', () => {
      const code = `
//@version=6
indicator("Color New Type Error")

c1 = color.new("green", 50)
plot(close, color=c1)
      `;
      const result = createValidator().validate(code);
      expect(result.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-TYPE')).toBe(true);
    });

    it('rejects transparency outside 0..100', () => {
      const code = `
//@version=6
indicator("Color New Range Error")

c1 = color.new(color.red, 150)
plot(close, color=c1)
      `;
      const result = createValidator().validate(code);
      // Expect a max-bound violation code
      expect(result.errors.some(e => e.code === 'PSV6-PARAM-MAX')).toBe(true);
    });
  });

  describe('color.rgb()', () => {
    it('accepts in-range rgb and transparency', () => {
      const code = `
//@version=6
indicator("Color RGB OK")

c1 = color.rgb(255, 0, 0, 0)
plot(close, color=c1)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects out-of-range rgb values', () => {
      const code = `
//@version=6
indicator("Color RGB Range Error")

c1 = color.rgb(300, -1, 0, 0)
plot(close, color=c1)
      `;
      const result = createValidator().validate(code);
      // Should flag min/max violations
      const codes = result.errors.map(e => e.code);
      expect(codes).toEqual(expect.arrayContaining(['PSV6-PARAM-MAX', 'PSV6-002']));
    });

    it('rejects wrong types for rgb params', () => {
      const code = `
//@version=6
indicator("Color RGB Type Error")

c1 = color.rgb("255", 0, 0, 0)
plot(close, color=c1)
      `;
      const result = createValidator().validate(code);
      expect(result.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-TYPE')).toBe(true);
    });
  });

  describe('color.from_gradient()', () => {
    it('accepts valid series and colors', () => {
      const code = `
//@version=6
indicator("Color From Gradient OK")

c1 = color.from_gradient(close, 0, 100, color.green, color.red)
plot(close, color=c1)
      `;
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects invalid color arguments', () => {
      const code = `
//@version=6
indicator("Color From Gradient Type Error")

c1 = color.from_gradient(close, 0, 100, "green", color.red)
plot(close, color=c1)
      `;
      const result = createValidator().validate(code);
      expect(result.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-TYPE')).toBe(true);
    });
  });

});
