import { EnhancedModularValidator } from './EnhancedModularValidator.js';

const code = `//@version=6
indicator("UDT Duplicate")

type Rectangle
    float width
    float width

plot(close)
`;

const validator = new EnhancedModularValidator();
const result = validator.validate(code);

console.log('Errors:', result.errors.map(e => `${e.code} (line ${e.line}): ${e.message}`));
console.log('Looking for PSV6-UDT-DUPLICATE-FIELD:', result.errors.some(e => e.code === 'PSV6-UDT-DUPLICATE-FIELD'));

