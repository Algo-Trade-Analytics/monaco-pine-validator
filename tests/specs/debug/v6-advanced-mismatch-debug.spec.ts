import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../../EnhancedModularValidator';

const create = () => new EnhancedModularValidator({ targetVersion: 6, strictMode: true });

describe('Debug: qualifier/type mismatch from function return', () => {
  it('prints errors for rsiLength from ta.highest used in ta.rsi length', () => {
    const code = `//@version=6
indicator("Test")
rsiLength = ta.highest(high, 10)
ta.rsi(close, rsiLength)`;
    const res = create().validate(code);
    // eslint-disable-next-line no-console
    console.log('DEBUG ERRORS:', res.errors);
    expect(true).toBe(true);
  });
});

