import { EnhancedModularValidator } from './EnhancedModularValidator.js';

const code = `//@version=6
strategy("Varip in Strategy")

varip int count1 = 0
varip int count2 = 0
varip int count3 = 0
varip int count4 = 0
varip int count5 = 0
varip int count6 = 0  // Too many for strategy

plot(close)`;

const validator = new EnhancedModularValidator();
const result = validator.validate(code);

console.log('Errors:', result.errors.map(e => e.code));
console.log('Warnings:', result.warnings.map(w => w.code));
console.log('Looking for PSV6-VARIP-STRATEGY:', result.warnings.some(w => w.code === 'PSV6-VARIP-STRATEGY'));

