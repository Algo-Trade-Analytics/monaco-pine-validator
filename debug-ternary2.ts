import { EnhancedModularValidator } from './EnhancedModularValidator';

const code = `//@version=6
indicator("Test")
int len = barstate.islast ? 20 : 10
plot(ta.sma(close, len))`;

const validator = new EnhancedModularValidator();
const result = validator.validate(code);

console.log('Test expects: At least one error with PSV6-FUNCTION-PARAM-TYPE or PSV6-ENUM-UNDEFINED-TYPE');
console.log('\nActual result:');
console.log('Valid:', result.isValid);
console.log('Errors:', result.errors.length);
result.errors.forEach(e => console.log(`  - Line ${e.line}: [${e.code}] ${e.message}`));

console.log('\nTypeMap:');
console.log('  len:', result.typeMap.get('len'));

console.log('\nAnalysis:');
console.log('The test expects an error because:');
console.log('- `int len` declares len as a simple int');
console.log('- `barstate.islast ? 20 : 10` is a series expression (because barstate.islast is series)');
console.log('- Assigning a series to a simple int should cause a type/qualifier error');
console.log('\nIf no error is generated, the validator needs to check type qualifiers');

