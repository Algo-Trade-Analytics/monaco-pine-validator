import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../../EnhancedModularValidator';

const V = () => new EnhancedModularValidator({ targetVersion: 6, strictMode: true });

describe('Debug: deeply nested expressions', () => {
  it('prints errors for nested TA chain', () => {
    const code = `//@version=6
indicator("Test")
result = ta.sma(ta.ema(ta.rsi(ta.stoch(close, high, low, 14), 14), 21), 50)
plot(result)`;
    const res = V().validate(code);
    // eslint-disable-next-line no-console
    console.log('NESTED ERRORS:', res.errors);
    // eslint-disable-next-line no-console
    console.log('NESTED WARNINGS:', res.warnings);
    expect(true).toBe(true);
  });
});

