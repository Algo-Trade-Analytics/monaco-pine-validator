import { validatePineScriptV6 } from './index.js';
import fs from 'fs';

const code = fs.readFileSync('test_issue.pine', 'utf8');

console.log('=== Testing Enum Validation ===');
console.log('Code:');
console.log(code);
console.log('\n' + '='.repeat(60));

const result = validatePineScriptV6(code, {});

console.log('\nValidation result:');
console.log('Errors:', result.errors.length);

result.errors.forEach(err => {
  console.log(`\n  Line ${err.line}: ${err.message}`);
  console.log(`  Code: ${err.code}`);
  console.log(`  Severity: ${err.severity}`);
});
