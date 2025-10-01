import { EnhancedModularValidator } from './EnhancedModularValidator';

console.log('═══════════════════════════════════════════════════════════════');
console.log('TESTING: var array<chart.point> Fix');
console.log('═══════════════════════════════════════════════════════════════\n');

const code = `//@version=6
indicator("Chart Point Cleanup")

var array<chart.point> points = array.new<chart.point>()

if barstate.islast
    while array.size(points) > 100
        removed = array.shift(points)
`;

console.log('Code to validate:');
console.log(code);
console.log('\n═══════════════════════════════════════════════════════════════');

const validator = new EnhancedModularValidator();
const result = validator.validate(code);

console.log('Result isValid:', result.isValid);
console.log('Errors:', result.errors.length);
console.log('Warnings:', result.warnings.length);

if (result.errors.length > 0) {
  console.log('\nErrors:');
  result.errors.forEach(e => console.log(`  - Line ${e.line}: [${e.code}] ${e.message}`));
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('Expected: NO errors (isValid = true)');
console.log('Key check: array.shift(points) should recognize points as array<chart.point>');
console.log('═══════════════════════════════════════════════════════════════\n');


