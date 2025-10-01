console.log('script starting');
import { EnhancedModularValidator } from '../EnhancedModularValidator.ts';
console.log('validator imported');
const validator = new EnhancedModularValidator({
    targetVersion: 6,
    strictMode: true,
    enablePerformanceAnalysis: true,
});
console.log('validator created');
const code = `//@version=6
strategy("Complex Alert Integration")

if close > open
    alert("Price up", alert.freq_once_per_bar_close)

if close > high[1]
    alert("New high", alert.freq_once_per_bar)

alertcondition(close < low[1], title="New Low", message="Price made new low")

if close > close[1]
    strategy.entry("Long", strategy.long)
    alert("Strategy entry signal", alert.freq_once_per_bar_close)

plot(close)`;
const result = validator.validate(code);
console.log('info codes', result.info.map(i => i.code));
console.log('info entries', result.info);
