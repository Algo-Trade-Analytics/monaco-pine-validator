import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { expectHas } from './test-utils';

const createValidator = () => new EnhancedModularValidator({
  targetVersion: 6,
  strictMode: true,
});

describe('PSV6-INPUT-ADVANCED: Advanced Input Parameters (TDD)', () => {
  it('accepts named defval for input.int', () => {
    const code = `//@version=6
indicator("Inputs")
len = input.int(title="Length", defval=14, minval=1, step=1)`;
    const result = createValidator().validate(code);
    expect(result.errors).toHaveLength(0);
  });

  it('errors on wrong defval type for input.int', () => {
    const code = `//@version=6
indicator("Inputs")
bad = input.int(title="Bad", defval="x")`;
    const result = createValidator().validate(code);
    expectHas(result, { errors: ['PSV6-INPUT-DEFVAL-TYPE'] });
  });

  it('accepts named defval for input.float', () => {
    const code = `//@version=6
indicator("Inputs")
th = input.float(title="Thresh", defval=1.5, minval=0.0)`;
    const result = createValidator().validate(code);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts named defval for input.bool', () => {
    const code = `//@version=6
indicator("Inputs")
flag = input.bool(title="Use", defval=true, confirm=false)`;
    const result = createValidator().validate(code);
    expect(result.errors).toHaveLength(0);
  });

  it('errors on wrong defval for input.bool', () => {
    const code = `//@version=6
indicator("Inputs")
flag = input.bool(title="Use", defval="yes")`;
    const result = createValidator().validate(code);
    expectHas(result, { errors: ['PSV6-INPUT-DEFVAL-TYPE'] });
  });

  it('accepts named defval for input.string', () => {
    const code = `//@version=6
indicator("Inputs")
mode = input.string(title="Mode", defval="fast", options=["fast","slow"])`;
    const result = createValidator().validate(code);
    expect(result.errors).toHaveLength(0);
  });

  it('warns on non-string title', () => {
    const code = `//@version=6
indicator("Inputs")
len = input.int(14, title=14)`;
    const result = createValidator().validate(code);
    expectHas(result, { warnings: ['PSV6-INPUT-TITLE-WARNING'] });
  });

  it('warns on non-string tooltip and flags length/format', () => {
    const code = `//@version=6
indicator("Inputs")
len = input.int(14, "Length", tooltip=14)
txt = input.string("x", "T", tooltip="This is a very long tooltip that likely exceeds one hundred and twenty characters in length, which should trigger a gentle suggestion to shorten it for UI.")`;
    const result = createValidator().validate(code);
    expectHas(result, { warnings: ['PSV6-INPUT-TOOLTIP-WARNING'] });
    expect(result.info.some(i => i.code === 'PSV6-INPUT-TOOLTIP-LENGTH')).toBe(true);
  });

  it('warns on non-string group and inline', () => {
    const code = `//@version=6
indicator("Inputs")
a = input.int(1, "A", group=1)
b = input.int(2, "B", inline=true)`;
    const result = createValidator().validate(code);
    expectHas(result, { warnings: ['PSV6-INPUT-GROUP-WARNING', 'PSV6-INPUT-INLINE-WARNING'] });
  });

  it('warns on confirm non-bool', () => {
    const code = `//@version=6
indicator("Inputs")
a = input.int(1, "A", confirm=1)`;
    const result = createValidator().validate(code);
    expectHas(result, { warnings: ['PSV6-INPUT-CONFIRM-WARNING'] });
  });

  it('uses defval override when comparing minval/maxval', () => {
    const code = `//@version=6
indicator("Inputs")
v = input.float(title="V", defval=5.0, minval=10.0, maxval=4.0)`;
    const result = createValidator().validate(code);
    expectHas(result, { warnings: ['PSV6-INPUT-MINVAL-WARNING', 'PSV6-INPUT-MAXVAL-WARNING'] });
  });
});

