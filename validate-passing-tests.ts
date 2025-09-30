/**
 * Validation Script: Check Passing Tests Against Pine Script API Reference
 * 
 * This script validates that our passing tests are actually checking correct
 * Pine Script behavior according to the official API reference.
 */

import functionsRef from './PineScriptContext/structures/functions.json' assert { type: 'json' };
import { EnhancedModularValidator } from './EnhancedModularValidator.js';

interface ValidationIssue {
  category: string;
  testCode: string;
  issue: string;
  severity: 'error' | 'warning' | 'info';
  apiReference?: string;
}

const issues: ValidationIssue[] = [];
const validator = new EnhancedModularValidator();

console.log('🔍 Validating Passing Tests Against Pine Script API Reference\n');
console.log('=' .repeat(80));

// ============================================================================
// Category 1: TA Functions - Validate parameter requirements
// ============================================================================
console.log('\n📊 Category 1: TA Function Parameter Validation\n');

// Test: ta.sma with correct parameters
const test_ta_sma_valid = `//@version=6
indicator("Test")
sma_value = ta.sma(close, 20)
plot(sma_value)`;

const result1 = validator.validate(test_ta_sma_valid);
console.log('✓ ta.sma(close, 20):', result1.isValid ? '✅ PASS' : '❌ FAIL');

// Check against API: ta.sma requires 2 parameters (source: series int/float, length: series int)
const ta_sma_api = functionsRef['ta.sma'];
if (ta_sma_api) {
  console.log('  API Reference:', ta_sma_api.signatures[0].text);
  console.log('  Required params:', ta_sma_api.arguments.filter(a => a.required).map(a => a.name).join(', '));
}

// Test: ta.sma with missing parameter (should fail)
const test_ta_sma_missing = `//@version=6
indicator("Test")
sma_value = ta.sma(close)
plot(sma_value)`;

const result2 = validator.validate(test_ta_sma_missing);
console.log('\n✓ ta.sma(close) - missing length:', result2.errors.length > 0 ? '✅ CORRECTLY ERRORS' : '❌ SHOULD ERROR');
if (result2.errors.length === 0) {
  issues.push({
    category: 'TA Functions',
    testCode: 'ta.sma(close)',
    issue: 'Missing required parameter "length" should error but passes',
    severity: 'error',
    apiReference: ta_sma_api?.signatures[0].text
  });
}

// Test: ta.sma with wrong type (should fail)
const test_ta_sma_wrong_type = `//@version=6
indicator("Test")
sma_value = ta.sma("close", 20)
plot(sma_value)`;

const result3 = validator.validate(test_ta_sma_wrong_type);
console.log('✓ ta.sma("close", 20) - wrong type:', result3.errors.length > 0 ? '✅ CORRECTLY ERRORS' : '❌ SHOULD ERROR');
if (result3.errors.length === 0) {
  issues.push({
    category: 'TA Functions',
    testCode: 'ta.sma("close", 20)',
    issue: 'String parameter should error (expects series int/float)',
    severity: 'error',
    apiReference: ta_sma_api?.signatures[0].text
  });
}

// Test: ta.ema (compare with ta.sma - note different qualifier for length)
const ta_ema_api = functionsRef['ta.ema'];
console.log('\n✓ ta.ema API check:');
console.log('  API Reference:', ta_ema_api.signatures[0].text);
console.log('  Length qualifier:', ta_ema_api.arguments[1].qualifier); // Should be "simple" not "series"

// Test: ta.rsi
const ta_rsi_api = functionsRef['ta.rsi'];
console.log('\n✓ ta.rsi API check:');
console.log('  API Reference:', ta_rsi_api.signatures[0].text);
console.log('  Length qualifier:', ta_rsi_api.arguments[1].qualifier); // Should be "simple" not "series"

// ============================================================================
// Category 2: Request Functions - Validate parameter requirements
// ============================================================================
console.log('\n\n📊 Category 2: Request Function Validation\n');

const request_security_api = functionsRef['request.security'];
if (request_security_api) {
  console.log('✓ request.security API:');
  console.log('  Signature:', request_security_api.signatures[0].text);
  console.log('  Required params:', request_security_api.arguments.filter(a => a.required).map(a => a.name).join(', '));
  
  // Test with missing expression parameter
  const test_req_sec_missing = `//@version=6
indicator("Test")
res = request.security(syminfo.tickerid, "D")
plot(res)`;
  
  const result4 = validator.validate(test_req_sec_missing);
  console.log('\n✓ request.security(symbol, timeframe) - missing expression:', 
    result4.errors.length > 0 ? '✅ CORRECTLY ERRORS' : '❌ SHOULD ERROR');
  
  if (result4.errors.length === 0) {
    issues.push({
      category: 'Request Functions',
      testCode: 'request.security(syminfo.tickerid, "D")',
      issue: 'Missing required parameter "expression" should error',
      severity: 'error',
      apiReference: request_security_api.signatures[0].text
    });
  }
}

// ============================================================================
// Category 3: Input Functions - Validate parameter requirements
// ============================================================================
console.log('\n\n📊 Category 3: Input Function Validation\n');

const input_int_api = functionsRef['input.int'];
if (input_int_api) {
  console.log('✓ input.int API:');
  console.log('  Signature:', input_int_api.signatures[0].text);
  console.log('  Default param type:', input_int_api.arguments[0].type);
  
  // Test with wrong default type
  const test_input_wrong = `//@version=6
indicator("Test")
myInt = input.int("10", "Integer Input")
plot(close)`;
  
  const result5 = validator.validate(test_input_wrong);
  console.log('\n✓ input.int("10") - string instead of int:',
    result5.errors.length > 0 ? '✅ CORRECTLY ERRORS' : '❌ SHOULD ERROR');
  
  if (result5.errors.length === 0) {
    issues.push({
      category: 'Input Functions',
      testCode: 'input.int("10", "Integer Input")',
      issue: 'String default value should error (expects int)',
      severity: 'error',
      apiReference: input_int_api.signatures[0].text
    });
  }
}

// ============================================================================
// Category 4: plot() function - Critical built-in
// ============================================================================
console.log('\n\n📊 Category 4: Plot Function Validation\n');

const plot_api = functionsRef['plot'];
if (plot_api) {
  console.log('✓ plot API:');
  console.log('  Signature:', plot_api.signatures[0].text);
  console.log('  Series param required:', plot_api.arguments[0].required);
  
  // Test: plot with no parameters (should error)
  const test_plot_missing = `//@version=6
indicator("Test")
plot()`;
  
  const result6 = validator.validate(test_plot_missing);
  console.log('\n✓ plot() - no parameters:',
    result6.errors.length > 0 ? '✅ CORRECTLY ERRORS' : '❌ SHOULD ERROR');
  
  if (result6.errors.length === 0) {
    issues.push({
      category: 'Plot Function',
      testCode: 'plot()',
      issue: 'Missing required "series" parameter should error',
      severity: 'error',
      apiReference: plot_api.signatures[0].text
    });
  }
}

// ============================================================================
// Summary Report
// ============================================================================
console.log('\n\n' + '='.repeat(80));
console.log('📋 VALIDATION SUMMARY');
console.log('='.repeat(80));

if (issues.length === 0) {
  console.log('\n✅ All validated tests are checking correct Pine Script behavior!');
  console.log('   No issues found with passing tests.');
} else {
  console.log(`\n⚠️  Found ${issues.length} potential issue(s) with passing tests:\n`);
  
  issues.forEach((issue, idx) => {
    console.log(`${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.category}`);
    console.log(`   Code: ${issue.testCode}`);
    console.log(`   Issue: ${issue.issue}`);
    if (issue.apiReference) {
      console.log(`   API: ${issue.apiReference}`);
    }
    console.log();
  });
}

console.log('\n💡 Recommendation:');
console.log('   Run comprehensive validation on all 1,147 passing tests');
console.log('   Cross-reference each function call with API documentation');
console.log('   Focus on parameter count, types, and required vs optional\n');

