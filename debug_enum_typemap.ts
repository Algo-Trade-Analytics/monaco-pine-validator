import { ModularUltimateValidator } from './ModularUltimateValidator.js';
import fs from 'fs';

const code = fs.readFileSync('test_issue.pine', 'utf8');

console.log('=== Debugging Enum TypeMap ===');

const validator = new ModularUltimateValidator({});
const result = validator.validate(code);

// Access the validation context to check typeMap
const modules = (validator as any).modules;
console.log('\nValidator modules:', modules.length);
modules.forEach((m: any) => {
  console.log(`  - ${m.name} (priority: ${m.priority || 'default'})`);
});

// Check if UDTValidator is loaded
const udtValidator = modules.find((m: any) => m.name === 'UDTValidator');
console.log('\nUDTValidator found:', !!udtValidator);

console.log('\nErrors:', result.errors.length);
result.errors.forEach(err => {
  console.log(`  Line ${err.line}: ${err.message} (${err.code})`);
});
