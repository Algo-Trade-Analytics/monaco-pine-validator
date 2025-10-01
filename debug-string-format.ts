import { EnhancedModularValidator } from './EnhancedModularValidator';

console.log('═══════════════════════════════════════════════════════════════');
console.log('DEBUGGING: str.format() with $ character');
console.log('═══════════════════════════════════════════════════════════════\n');

const code = `//@version=6
indicator("Format")

name = "Bitcoin"
price = close
formatted = str.format("{0}: ${1}", name, price)
label.new(bar_index, high, formatted)
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
  result.errors.forEach(e => console.log(`  - Line ${e.line}, Col ${e.column}: [${e.code}] ${e.message}`));
}

if (result.warnings.length > 0) {
  console.log('\nWarnings:');
  result.warnings.forEach(w => console.log(`  - Line ${w.line}, Col ${w.column}: [${w.code}] ${w.message}`));
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('Expected: isValid = true, 0 errors');
console.log('Key check: The format string "{0}: ${1}" should be recognized as having 2 placeholders');
console.log('═══════════════════════════════════════════════════════════════\n');


