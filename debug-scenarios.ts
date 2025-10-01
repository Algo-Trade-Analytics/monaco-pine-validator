import { EnhancedModularValidator } from './EnhancedModularValidator';

console.log('═══════════════════════════════════════════════════════════════');
console.log('TEST 1: timestamp_invalid_month');
console.log('═══════════════════════════════════════════════════════════════\n');

const code1 = `//@version=6
indicator("TS")
ts = timestamp(2024, 13, 1, 0, 0, 0)
plot(close)
`;

const validator1 = new EnhancedModularValidator();
const result1 = validator1.validate(code1);

console.log('Expected errors: PSV6-FUNCTION-PARAM-TYPE, PSV6-002, PSV6-TIMESTAMP-MONTH-RANGE');
console.log('Actual errors:', result1.errors.map(e => e.code));
console.log('\nDetailed errors:');
result1.errors.forEach(e => console.log(`  - Line ${e.line}: [${e.code}] ${e.message}`));

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('TEST 2: enum_undefined_value');
console.log('═══════════════════════════════════════════════════════════════\n');

const code2 = `//@version=6
indicator("Enum Undefined")

enum Direction
    Long
    Short

var Direction dir = Direction.Long
if dir == Direction.Sideways
    plot(1)
plot(0)
`;

const validator2 = new EnhancedModularValidator();
const result2 = validator2.validate(code2);

console.log('Expected errors: PSV6-ENUM-UNDEFINED-VALUE');
console.log('Actual errors:', result2.errors.filter(e => e.code?.includes('ENUM')).map(e => e.code));
console.log('\nDetailed errors:');
result2.errors.forEach(e => console.log(`  - Line ${e.line}: [${e.code}] ${e.message}`));

