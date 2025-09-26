import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import type { ValidationResult } from '../../core/types';

type CodeCollections = {
  errors: string[];
  warnings: string[];
  info: string[];
};

function collectCodes(result: ValidationResult): CodeCollections {
  return {
    errors: result.errors.map(issue => issue.code ?? ''),
    warnings: result.warnings.map(issue => issue.code ?? ''),
    info: result.info.map(issue => issue.code ?? ''),
  };
}

describe('Validator smoke tests', () => {
  it('accepts a minimal indicator script', () => {
    const validator = new EnhancedModularValidator();
    const source = `//@version=6\nindicator("OK", overlay=true)\nplot(close, linewidth=2)`;

    const result = validator.validate(source);
    const codes = collectCodes(result);

    expect(result.isValid).toBe(true);
    expect(codes.errors).toEqual([]);
  });

  it('reports missing version and script declarations', () => {
    const validator = new EnhancedModularValidator();
    const source = `plot(close)`;

    const result = validator.validate(source);
    const codes = collectCodes(result);

    expect(codes.errors).toContain('PS012');
    expect(codes.errors).toContain('PS013');
  });

  it('warns when the version directive is not on the first line', () => {
    const validator = new EnhancedModularValidator();
    const source = `// comment\n//@version=6\nindicator("Late")\nplot(close)`;

    const result = validator.validate(source);
    const codes = collectCodes(result);

    expect(codes.warnings).toContain('PSW01');
  });

  it('rejects duplicate version directives', () => {
    const validator = new EnhancedModularValidator();
    const source = `//@version=6\n//@version=6\nindicator("Dup")\nplot(close)`;

    const result = validator.validate(source);
    const codes = collectCodes(result);

    expect(codes.errors).toContain('PS002');
  });

  it('warns when an indicator omits plotting', () => {
    const validator = new EnhancedModularValidator();
    const source = `//@version=6\nindicator("No Plot")\nvar int counter = 0`;

    const result = validator.validate(source);
    const codes = collectCodes(result);

    expect(codes.warnings).toContain('PS014');
  });

  it('rejects const reassignment', () => {
    const validator = new EnhancedModularValidator();
    const source = `//@version=6\nindicator("Const")\nconst a = 1\na := 2`;

    const result = validator.validate(source);
    const codes = collectCodes(result);

    expect(codes.errors).toContain('PS019');
  });

  it('performs basic function argument checking', () => {
    const validator = new EnhancedModularValidator();
    const source = `//@version=6\nindicator("Types")\nplot("string")`;

    const result = validator.validate(source);
    const codes = collectCodes(result);

    expect(codes.errors).toContain('PSV6-FUNCTION-PARAM-TYPE');
  });

  it('tracks negative history references outside array helpers', () => {
    const validator = new EnhancedModularValidator();
    const source = `//@version=6\nindicator("History")\nplot(close[-1])`;

    const result = validator.validate(source);
    const codes = collectCodes(result);

    expect(codes.errors).toContain('PS024');
  });
});
