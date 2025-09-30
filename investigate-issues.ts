/**
 * Investigate the 2 issues found in comprehensive validation
 */

import { EnhancedModularValidator } from './EnhancedModularValidator.js';
import functionsRef from './PineScriptContext/structures/functions.json' assert { type: 'json' };

const validator = new EnhancedModularValidator();

console.log('🔍 Investigating Found Issues\n');
console.log('='.repeat(80));

// Issue 1: str.length
console.log('\n📌 ISSUE 1: str.length with string literal\n');

const strLengthAPI = functionsRef['str.length'];
console.log('API Reference:');
console.log('  Signature:', strLengthAPI.signatures[0].text);
console.log('  Parameters:');
strLengthAPI.arguments.forEach(arg => {
  console.log(`    - ${arg.name}: ${arg.qualifier} ${arg.type} (required: ${arg.required})`);
});

const testStrLength1 = `//@version=6
indicator("Test")
len = str.length("hello")
plot(len)`;

const result1 = validator.validate(testStrLength1);
console.log('\nTest Code: str.length("hello")');
console.log('Result:', result1.isValid ? 'VALID' : 'INVALID');
console.log('Errors:', result1.errors.map(e => ({ code: e.code, message: e.message })));
console.log('Warnings:', result1.warnings.map(w => ({ code: w.code, message: w.message })));

// Try with a variable
const testStrLength2 = `//@version=6
indicator("Test")
myStr = "hello"
len = str.length(myStr)
plot(len)`;

const result2 = validator.validate(testStrLength2);
console.log('\nTest Code: str.length(myStr) where myStr = "hello"');
console.log('Result:', result2.isValid ? 'VALID' : 'INVALID');
console.log('Errors:', result2.errors.map(e => ({ code: e.code, message: e.message })));

// Issue 2: array.push
console.log('\n\n' + '='.repeat(80));
console.log('\n📌 ISSUE 2: array.push syntax\n');

const arrayPushAPI = functionsRef['array.push'];
console.log('API Reference:');
console.log('  Signature:', arrayPushAPI.signatures[0].text);
console.log('  Parameters:');
arrayPushAPI.arguments.forEach(arg => {
  console.log(`    - ${arg.name}: ${arg.qualifier} ${arg.type} (required: ${arg.required})`);
});

const testArrayPush1 = `//@version=6
indicator("Test")
arr = array.new_int()
array.push(arr, 1)
plot(close)`;

const result3 = validator.validate(testArrayPush1);
console.log('\nTest Code: array.push(arr, 1)');
console.log('Result:', result3.isValid ? 'VALID' : 'INVALID');
console.log('Errors:', result3.errors.map(e => ({ code: e.code, message: e.message, line: e.line })));
console.log('Warnings:', result3.warnings.map(w => ({ code: w.code, message: w.message, line: w.line })));

// Try with explicit type
const testArrayPush2 = `//@version=6
indicator("Test")
var arr = array.new_int()
array.push(arr, 1)
plot(close)`;

const result4 = validator.validate(testArrayPush2);
console.log('\nTest Code: array.push(arr, 1) with var');
console.log('Result:', result4.isValid ? 'VALID' : 'INVALID');
console.log('Errors:', result4.errors.map(e => ({ code: e.code, message: e.message })));

// Try method syntax
const testArrayPush3 = `//@version=6
indicator("Test")
arr = array.new_int()
arr.push(1)
plot(close)`;

const result5 = validator.validate(testArrayPush3);
console.log('\nTest Code: arr.push(1) - method syntax');
console.log('Result:', result5.isValid ? 'VALID' : 'INVALID');
console.log('Errors:', result5.errors.map(e => ({ code: e.code, message: e.message })));

// Summary
console.log('\n\n' + '='.repeat(80));
console.log('📊 ANALYSIS\n');

console.log('Issue 1: str.length');
if (!result1.isValid && result1.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-TYPE')) {
  console.log('  ⚠️  Validator is rejecting str.length("hello")');
  console.log('  Expected: Should ACCEPT string literals');
  console.log('  Actual: REJECTS with param type error');
  console.log('  Verdict: Possible VALIDATOR BUG - str.length should accept string literals');
} else {
  console.log('  ✅ str.length working correctly');
}

console.log('\nIssue 2: array.push');
if (!result3.isValid) {
  console.log('  ⚠️  Validator is rejecting array.push(arr, 1)');
  console.log('  Expected: Should ACCEPT array.push syntax');
  console.log('  Actual: REJECTS with syntax/type errors');
  if (result5.isValid) {
    console.log('  Note: Method syntax arr.push(1) works ✅');
    console.log('  Verdict: Validator may only support METHOD syntax, not FUNCTION syntax');
  } else {
    console.log('  Verdict: Possible VALIDATOR BUG - array.push should work');
  }
}

console.log('\n💡 Recommendation:');
console.log('   Check if these are legitimate validator bugs or intentional strictness');
console.log('   Review test suites to see if they use the validated syntax');
console.log('   Cross-reference with actual Pine Script behavior in TradingView\n');

