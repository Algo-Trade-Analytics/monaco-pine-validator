import { EnhancedModularValidator } from './EnhancedModularValidator';
import { readFileSync } from 'fs';

const code = readFileSync('./tests/popular-pine-scripts/Uptrick-Volatility.pine', 'utf-8');

const validator = new EnhancedModularValidator();
const result = validator.validate(code);

console.log('\n=== VALIDATION RESULTS ===\n');
console.log(`Valid: ${result.isValid}`);
console.log(`\nErrors: ${result.errors.length}`);
result.errors.forEach(e => {
  console.log(`  - [${e.code}] Line ${e.line}: ${e.message}`);
});

console.log(`\nWarnings: ${result.warnings.length}`);
result.warnings.forEach(w => {
  console.log(`  - [${w.code}] Line ${w.line}: ${w.message}`);
});

console.log(`\nInfo: ${result.info.length}`);
result.info.forEach(i => {
  console.log(`  - [${i.code}] Line ${i.line}: ${i.message}`);
});
