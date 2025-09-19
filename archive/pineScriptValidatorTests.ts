/**
 * Pine Script Validator Test Cases
 * Comprehensive test suite for the Pine Script syntax validator
 */

import { validatePineScript } from './pineScriptValidator';

// Test cases for Pine Script validation
export const testCases = {
  // Valid Pine Script examples
  valid: {
    basicIndicator: `
//@version=6
indicator("My Indicator", shorttitle="MI", overlay=true)

length = input.int(20, title="Length", minval=1)
src = input.source(close, title="Source")

ma = ta.sma(src, length)
plot(ma, color=color.blue, linewidth=2, title="Moving Average")
    `.trim(),

    basicStrategy: `
//@version=6
strategy("My Strategy", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

length = input.int(14, title="Length")
rsi = ta.rsi(close, length)

if rsi < 30
    strategy.entry("Long", strategy.long)
if rsi > 70
    strategy.close("Long")
    `.trim(),

    withVariables: `
//@version=6
indicator("Variables Example", overlay=false)

var float myVar = 0.0
const int CONSTANT_VALUE = 100
varip int counter = 0

if bar_index == 0
    myVar := close
    counter := counter + 1

plot(myVar, title="My Variable")
    `.trim()
  },

  // Invalid Pine Script examples (should show errors)
  invalid: {
    missingVersion: `
indicator("No Version", overlay=true)
plot(close)
    `.trim(),

    missingScriptDeclaration: `
//@version=6
plot(close)
    `.trim(),

    syntaxErrors: `
//@version=6
indicator("Syntax Errors", overlay=true)

// Missing closing parenthesis
length = input.int(20, title="Length"
src = input.source(close, title="Source")

// Invalid operator
if close === open
    plot(close)

// Unmatched quotes
title = "My Title
plot(close, title=title)
    `.trim(),

    invalidVariableNames: `
//@version=6
indicator("Invalid Variables", overlay=true)

// Reserved keyword as variable name
var if = 10
var plot = close

// Invalid variable name
var 123invalid = 0
var my-var = 1

plot(close)
    `.trim(),

    unmatchedBrackets: `
//@version=6
indicator("Unmatched Brackets", overlay=true)

array1 = array.new<float>(10
array2 = array.new<float>[10)

if close > open {
    plot(close)
// Missing closing brace

plot(high)
    `.trim()
  },

  // Examples with warnings (valid but not recommended)
  warnings: {
    oldVersion: `
//@version=4
study("Old Version", overlay=true)
plot(close)
    `.trim(),

    unusedVariables: `
//@version=6
indicator("Unused Variables", overlay=true)

length = input.int(20, title="Length")
src = input.source(close, title="Source")
unusedVar = 42

ma = ta.sma(close, 14)
plot(ma)
    `.trim(),

    deprecatedOperators: `
//@version=6
indicator("Deprecated Operators", overlay=true)

value = 10
value += 5  // Warning: += not valid in Pine Script
value++     // Warning: ++ not valid in Pine Script

plot(close)
    `.trim()
  }
};

// Function to run all test cases and log results
export function runValidatorTests() {
  console.log('🧪 Running Pine Script Validator Tests...\n');

  // Test valid scripts
  console.log('✅ Testing Valid Scripts:');
  Object.entries(testCases.valid).forEach(([name, code]) => {
    const result = validatePineScript(code);
    console.log(`  ${name}: ${result.isValid ? '✅ PASS' : '❌ FAIL'}`);
    if (!result.isValid) {
      console.log(`    Errors: ${result.errors.map(e => e.message).join(', ')}`);
    }
  });

  // Test invalid scripts
  console.log('\n❌ Testing Invalid Scripts (should have errors):');
  Object.entries(testCases.invalid).forEach(([name, code]) => {
    const result = validatePineScript(code);
    console.log(`  ${name}: ${result.errors.length > 0 ? '✅ PASS (found errors)' : '❌ FAIL (no errors found)'}`);
    if (result.errors.length > 0) {
      console.log(`    Errors found: ${result.errors.length}`);
      result.errors.forEach(error => {
        console.log(`      Line ${error.line}: ${error.message}`);
      });
    }
  });

  // Test warning scripts
  console.log('\n⚠️ Testing Warning Scripts (should have warnings):');
  Object.entries(testCases.warnings).forEach(([name, code]) => {
    const result = validatePineScript(code);
    console.log(`  ${name}: ${result.warnings.length > 0 ? '✅ PASS (found warnings)' : '❌ FAIL (no warnings found)'}`);
    if (result.warnings.length > 0) {
      console.log(`    Warnings found: ${result.warnings.length}`);
      result.warnings.forEach(warning => {
        console.log(`      Line ${warning.line}: ${warning.message}`);
      });
    }
  });

  console.log('\n🎉 Validator tests completed!');
}

// Export individual test functions for specific testing
export const validatorTestUtils = {
  testValidScript: (code: string) => {
    const result = validatePineScript(code);
    return {
      passed: result.isValid,
      errors: result.errors,
      warnings: result.warnings
    };
  },

  testInvalidScript: (code: string, expectedErrorCount?: number) => {
    const result = validatePineScript(code);
    const hasExpectedErrors = expectedErrorCount ? 
      result.errors.length === expectedErrorCount : 
      result.errors.length > 0;
    
    return {
      passed: hasExpectedErrors,
      errors: result.errors,
      warnings: result.warnings,
      actualErrorCount: result.errors.length,
      expectedErrorCount
    };
  },

  testWarningScript: (code: string, expectedWarningCount?: number) => {
    const result = validatePineScript(code);
    const hasExpectedWarnings = expectedWarningCount ? 
      result.warnings.length === expectedWarningCount : 
      result.warnings.length > 0;
    
    return {
      passed: hasExpectedWarnings,
      errors: result.errors,
      warnings: result.warnings,
      actualWarningCount: result.warnings.length,
      expectedWarningCount
    };
  }
};

// Example usage in browser console:
// import { runValidatorTests } from './pineScriptValidatorTests';
// runValidatorTests();
