import { EnhancedModularValidator } from './EnhancedModularValidator';

console.log('═══════════════════════════════════════════════════════════════');
console.log('TEST 1: request.security inside loop');
console.log('═══════════════════════════════════════════════════════════════\n');

const code1 = `//@version=6
indicator("Test")
for i = 0 to 5
    request.security(syminfo.tickerid, "D", high[i])`;

const validator = new EnhancedModularValidator();
const result1 = validator.validate(code1);

console.log('Code:');
console.log(code1);
console.log('\n--- Results ---');
console.log('isValid:', result1.isValid);
console.log('Errors:', result1.errors.length);
console.log('Warnings:', result1.warnings.length);

if (result1.errors.length > 0) {
  console.log('\nErrors:');
  result1.errors.forEach(e => console.log(`  - Line ${e.line}: [${e.code}] ${e.message}`));
}

if (result1.warnings.length > 0) {
  console.log('\nWarnings:');
  result1.warnings.forEach(w => console.log(`  - Line ${w.line}: [${w.code}] ${w.message}`));
}

console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('TEST 2: request.security in nested loops');
console.log('═══════════════════════════════════════════════════════════════\n');

const code2 = `//@version=6
indicator("Test")
for i = 0 to 10
    for j = 0 to 5
        request.security(syminfo.tickerid, "D", close)`;

const result2 = validator.validate(code2);

console.log('Code:');
console.log(code2);
console.log('\n--- Results ---');
console.log('isValid:', result2.isValid);
console.log('Errors:', result2.errors.length);
console.log('Warnings:', result2.warnings.length);

if (result2.errors.length > 0) {
  console.log('\nErrors:');
  result2.errors.forEach(e => console.log(`  - Line ${e.line}: [${e.code}] ${e.message}`));
}

if (result2.warnings.length > 0) {
  console.log('\nWarnings:');
  result2.warnings.forEach(w => console.log(`  - Line ${w.line}: [${w.code}] ${w.message}`));
}

console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('Expected:');
console.log('  - Warnings: PSV6-REQUEST-PERF-LOOP');
console.log('  - NO Errors: PSV6-FUNCTION-PARAM-TYPE');
console.log('═══════════════════════════════════════════════════════════════');


