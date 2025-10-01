import { describe, it } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

describe('quality debug', () => {
  it('logs warnings', () => {
    const validator = new EnhancedModularValidator();
    const code = `//@version=6
indicator("Test")
complexFunc() =>
    if close > open
        if volume > ta.sma(volume, 20)
            if high > ta.highest(high, 10)
                if low < ta.lowest(low, 10)
                    if rsi > 70
                        if macd > 0
                            1
                        else
                            2
                    else
                        3
                else
                    4
            else
                5
        else
            6
    else
        7`;
    const result = validator.validate(code);
    // eslint-disable-next-line no-console
    console.log('errors', result.errors.map((e) => e.code));
    // eslint-disable-next-line no-console
    console.log('warnings', result.warnings.map((w) => [w.code, w.message]));
  });
});
