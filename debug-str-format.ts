import { EnhancedModularValidator } from './EnhancedModularValidator';

const code = `
//@version=6
indicator("Format")

name = "Bitcoin"
price = close
formatted = str.format("{0}: \${1}", name, price)
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
  result.errors.forEach(e => console.log(`  - Line ${e.line}: [${e.code}] ${e.message}`));
}

if (result.warnings.length > 0) {
  console.log('\nWarnings:');
  result.warnings.forEach(w => console.log(`  - Line ${w.line}: [${w.code}] ${w.message}`));
}

// Test placeholder counting manually
const formatString = '"{0}: ${1}"';
const cleanString = formatString.replace(/^"|"$|^'|'$/g, '');
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('Format string:', formatString);
console.log('Clean string:', cleanString);
const matches = cleanString.match(/\{\d+\}/g);
console.log('Placeholder matches:', matches);
console.log('Count:', matches ? matches.length : 0);

// Test invalid placeholder detection
const hasInvalid = /\{[^}]*$|\{[^0-9}]+[^}]*\}/.test(cleanString);
console.log('Has invalid placeholders:', hasInvalid);

