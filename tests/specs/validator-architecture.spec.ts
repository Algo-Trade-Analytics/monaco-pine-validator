import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { ChevrotainAstService } from '../../core/ast/service';
import type { ValidatorConfig } from '../../core/types';

describe('Validator architecture integration', () => {
  const minimalScript = `//@version=6\nindicator("Arch Smoke")\nplot(close)`;

  it('emits a non-null AST when parsing scripts by default', () => {
    const validator = new EnhancedModularValidator();
    const result = validator.validate(minimalScript);

    expect(result.isValid).toBe(true);

    const context = validator.getContext();
    expect(context.ast).not.toBeNull();
    expect(context.ast?.directives.length ?? 0).toBeGreaterThan(0);
    expect(context.ast?.body.length ?? 0).toBeGreaterThan(0);
  });

  it('exposes the full module catalog for the enhanced pipeline', () => {
    const validator = new EnhancedModularValidator();
    const modules = validator.getAvailableModules();

    expect(modules.length).toBeGreaterThan(30);
    expect(modules).toEqual(
      expect.arrayContaining([
        'CoreValidator',
        'SyntaxValidator',
        'FunctionValidator',
        'EnhancedStrategyValidator',
        'EnhancedTextboxValidator',
      ]),
    );
  });

  it('allows consumers to disable AST parsing explicitly', () => {
    const config: Partial<ValidatorConfig> = { ast: { mode: 'disabled' } };
    const validator = new EnhancedModularValidator(config);

    const result = validator.validate(minimalScript);

    expect(result.isValid).toBe(true);
    const context = validator.getContext();
    expect(context.ast).toBeNull();
  });

  it('respects custom AST services supplied at construction time', () => {
    const customService = new ChevrotainAstService();
    const validator = new EnhancedModularValidator({
      ast: { mode: 'primary', service: customService },
    });

    validator.validate(minimalScript);

    const context = validator.getContext();
    expect(context.ast).not.toBeNull();
    expect(validator.getConfig().ast?.service).toBe(customService);
  });
});
