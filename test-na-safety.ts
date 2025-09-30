import { EnhancedModularValidator } from './EnhancedModularValidator.js';

const code1 = `//@version=6
indicator("NA Safety Test")

// Unsafe na operations
result = na + 10
comparison = na == 0

plot(close)`;

const code2 = `//@version=6
indicator("NA Literal Test")

// na literal usage  
value = na
if value == na
    plot(close)

plot(close)`;

const validator = new EnhancedModularValidator();

console.log('Test 1: na + 10 and na == 0');
const result1 = validator.validate(code1);
console.log('  Warnings:', result1.warnings.map(w => w.code));
console.log('  Looking for PSV6-TYPE-SAFETY-NA-ARITHMETIC:', result1.warnings.some(w => w.code === 'PSV6-TYPE-SAFETY-NA-ARITHMETIC'));
console.log('  Looking for PSV6-TYPE-SAFETY-NA-COMPARISON:', result1.warnings.some(w => w.code === 'PSV6-TYPE-SAFETY-NA-COMPARISON'));

console.log('\nTest 2: value = na');
const result2 = validator.validate(code2);
console.log('  Warnings:', result2.warnings.map(w => w.code));
console.log('  Looking for PSV6-TYPE-SAFETY-NA-FUNCTION:', result2.warnings.some(w => w.code === 'PSV6-TYPE-SAFETY-NA-FUNCTION'));

