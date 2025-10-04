import { parseWithChevrotain } from './core/ast/parser/parse.js';
import { validatePineScriptV6 } from './index.js';
import fs from 'fs';

const code = fs.readFileSync('test_full_complex.pine', 'utf8');

console.log('=== Testing Full Complex Script ===');
const parseResult = parseWithChevrotain(code);

console.log('Parse result:', parseResult.ast ? '✅ SUCCESS' : '❌ FAILED');

if (!parseResult.ast) {
  console.log('\n❌ Parse failed!');
  console.log('Error:', parseResult.diagnostics);
} else {
  console.log('\n✅ Parse succeeded!');
  
  const validationResult = validatePineScriptV6(code, {});
  console.log('Validation errors:', validationResult.errors.length);
  
  if (validationResult.errors.length > 0) {
    console.log('\nErrors:');
    validationResult.errors.slice(0, 10).forEach(err => {
      console.log(`  Line ${err.line}: ${err.message} (${err.code})`);
    });
    if (validationResult.errors.length > 10) {
      console.log(`  ... and ${validationResult.errors.length - 10} more`);
    }
  }
}
