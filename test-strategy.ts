import { EnhancedModularValidator } from './EnhancedModularValidator.js';

const code1 = `//@version=6
strategy("Test Strategy", overlay=true)
if close > open
    strategy.entry("Long", strategy.long)
`;

const code2 = `//@version=6
strategy("Test Strategy", overlay=true, commission_type=strategy.commission.percent, commission_value=0.1)
if close > open
    strategy.entry("Long", strategy.long)
`;

const validator = new EnhancedModularValidator();

console.log('Test 1: Strategy without commission:');
const result1 = validator.validate(code1);
console.log('  Warnings:', result1.warnings.map(w => w.code));
console.log('  Info:', result1.info.map(i => i.code));
console.log('  Looking for PSV6-STRATEGY-REALISM:', result1.warnings.some(w => w.code === 'PSV6-STRATEGY-REALISM'));
console.log('  Looking for PSV6-STRATEGY-RISK:', result1.info.some(i => i.code === 'PSV6-STRATEGY-RISK'));
console.log('  Looking for PSV6-STRATEGY-NO-EXIT:', result1.warnings.some(w => w.code === 'PSV6-STRATEGY-NO-EXIT'));

console.log('\nTest 2: Strategy with commission:');
const result2 = validator.validate(code2);
console.log('  Warnings:', result2.warnings.map(w => w.code));
console.log('  Looking for PSV6-STRATEGY-REALISM:', result2.warnings.some(w => w.code === 'PSV6-STRATEGY-REALISM'));

