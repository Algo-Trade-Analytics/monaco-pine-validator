import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { expectHas, expectLacks } from './test-utils';

/// <reference types="vitest/globals" />

describe('Dynamic For-Loop Validation (TDD)', () => {
  let validator: EnhancedModularValidator;

  beforeEach(() => {
    validator = new EnhancedModularValidator();
  });

  describe('PSV6-FOR-DYNAMIC: Dynamic loop boundaries', () => {
    it('warns on dynamic end bound expression', () => {
      const code = `//@version=6
indicator("Dynamic End Bound Test")
var signals = array.new<int>()
for i = 0 to array.size(signals) - 1
    plot(close)
end`;

      const result = validator.validate(code);
      expectHas(result, { warnings: ['PSV6-FOR-DYNAMIC-END'] });
    });

    it('warns on dynamic start bound expression', () => {
      const code = `//@version=6
indicator("Dynamic Start Bound Test")
for i = bar_index - 100 to bar_index
    plot(close)
end`;

      const result = validator.validate(code);
      expectHas(result, { warnings: ['PSV6-FOR-DYNAMIC-START'] });
    });

    it('warns on dynamic step expression', () => {
      const code = `//@version=6
indicator("Dynamic Step Test")
step = input.int(1)
for i = 0 to 100 by step
    plot(close)
end`;

      const result = validator.validate(code);
      expectHas(result, { warnings: ['PSV6-FOR-DYNAMIC-STEP'] });
    });

    it('does not warn for static simple bounds', () => {
      const code = `//@version=6
indicator("Static For Test")
for i = 0 to 10 by 1
    plot(close)
end`;

      const result = validator.validate(code);
      expectLacks(result, { warnings: ['PSV6-FOR-DYNAMIC-START', 'PSV6-FOR-DYNAMIC-END', 'PSV6-FOR-DYNAMIC-STEP'] });
    });
  });

  describe('PSV6-FOR-MODIFY: Boundary and index modifications', () => {
    it('warns when loop bound variable is modified inside the loop', () => {
      const code = `//@version=6
indicator("Bound Modified Test")
limit = 10
for i = 0 to limit
    limit := limit + 1
    plot(close)
end`;

      const result = validator.validate(code);
      expectHas(result, { warnings: ['PSV6-FOR-BOUND-MODIFIED'] });
    });

    it('warns when loop index is reassigned inside the loop', () => {
      const code = `//@version=6
indicator("Index Modified Test")
for i = 0 to 10
    i := i + 1
    plot(close)
end`;

      const result = validator.validate(code);
      expectHas(result, { warnings: ['PSV6-FOR-INDEX-MODIFIED'] });
    });
  });
});

