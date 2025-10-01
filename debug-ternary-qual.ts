import { EnhancedModularValidator } from './EnhancedModularValidator';

const code = `//@version=6
indicator("Test")
int len = barstate.islast ? 20 : 10
plot(ta.sma(close, len))`;

const validator = new EnhancedModularValidator();
const result = validator.validate(code);

console.log('Test expects: PSV6-FUNCTION-PARAM-TYPE or PSV6-ENUM-UNDEFINED-TYPE');
console.log('\nActual result:');
console.log('Valid:', result.isValid);
console.log('Errors:', result.errors.length);
console.log('Error codes:', result.errors.map(e => e.code));
console.log('\nDetailed errors:');
result.errors.forEach(e => console.log(`  - Line ${e.line}: [${e.code}] ${e.message}`));

console.log('\nTypeMap:');
console.log('  len:', result.typeMap.get('len'));
console.log('  barstate:', result.typeMap.get('barstate'));

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('Analysis:');
console.log('═══════════════════════════════════════════════════════════════');
console.log('Issue: `int len` is declared as simple int (non-series)');
console.log('But: `barstate.islast ? 20 : 10` is a series expression');
console.log('Because: barstate.islast is a series bool');
console.log('\nExpected: Qualifier mismatch error (series cannot be assigned to simple)');
console.log('Actual: Need to check if TypeInferenceValidator detects this');

