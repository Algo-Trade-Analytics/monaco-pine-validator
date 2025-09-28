import { describe, it } from 'vitest';
import { EnhancedModularValidator } from '../EnhancedModularValidator';

const createValidator = () => new EnhancedModularValidator({
  targetVersion: 6,
  strictMode: true,
  enablePerformanceAnalysis: true,
});

describe('temp alert debug', () => {
  it('logs info codes', () => {
    const validator = createValidator();
    const code = `//@version=6\nstrategy("Complex Alert Integration")\n\nif close > open\n    alert("Price up", alert.freq_once_per_bar_close)\n\nif close > high[1]\n    alert("New high", alert.freq_once_per_bar)\n\nalertcondition(close < low[1], title="New Low", message="Price made new low")\n\nif close > close[1]\n    strategy.entry("Long", strategy.long)\n    alert("Strategy entry signal", alert.freq_once_per_bar_close)\n\nplot(close)`;
    const result = validator.validate(code);
    console.log('info codes', result.info.map(i => i.code));
    console.log('info', result.info);
  });
});
