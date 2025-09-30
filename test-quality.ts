import { EnhancedModularValidator } from './EnhancedModularValidator.js';

const code1 = `//@version=6
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
        7

plot(close)`;

const code2 = `//@version=6
indicator("Test")
deepFunc() =>
    if close > open
        if volume > 1000
            if high > low
                if rsi > 50
                    if macd > 0
                        if stoch > 20
                            1

plot(close)`;

const validator = new EnhancedModularValidator();

console.log('Test 1: High complexity');
const result1 = validator.validate(code1);
console.log('  All warnings:', result1.warnings.map(w => ({ code: w.code, message: w.message })));
console.log('  Looking for PSV6-QUALITY-COMPLEXITY:', result1.warnings.some(w => w.code === 'PSV6-QUALITY-COMPLEXITY'));

console.log('\nTest 2: Excessive depth');
const result2 = validator.validate(code2);
console.log('  All warnings:', result2.warnings.map(w => ({ code: w.code, message: w.message })));
console.log('  Looking for PSV6-QUALITY-DEPTH:', result2.warnings.some(w => w.code === 'PSV6-QUALITY-DEPTH'));

