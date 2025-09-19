/**
 * Test file for the Modular Ultimate Validator
 * Demonstrates the new modular architecture and its capabilities
 */

import { validatePineScriptV6, ModularUltimateValidator } from './index';

// Test cases for the modular validator
const testCases = [
  {
    name: 'Basic Valid Script',
    code: `
      //@version=6
      indicator("Test Indicator")
      plot(close)
    `,
    shouldBeValid: true
  },
  {
    name: 'Switch Statement (V6 Feature)',
    code: `
      //@version=6
      indicator("Switch Test")
      timeframe_str = switch timeframe.period
        "1" => "1 minute"
        "5" => "5 minutes"
        => "Unknown"
      plot(close)
    `,
    shouldBeValid: true
  },
  {
    name: 'varip Declaration (V6 Feature)',
    code: `
      //@version=6
      indicator("varip Test")
      varip int tickCount = 0
      tickCount += 1
      plot(tickCount)
    `,
    shouldBeValid: true
  },
  {
    name: 'UDT Declaration (V6 Feature)',
    code: `
      //@version=6
      indicator("UDT Test")
      type Point
        float x
        float y
      plot(close)
    `,
    shouldBeValid: true
  },
  {
    name: 'Syntax Error - Invalid Operator',
    code: `
      //@version=6
      indicator("Invalid Operator")
      result = 5 === 5
      plot(result)
    `,
    shouldBeValid: false,
    expectedErrors: ['PSO01']
  },
  {
    name: 'Performance Issue - Expensive Function in Loop',
    code: `
      //@version=6
      indicator("Performance Test")
      for i = 0 to 10
        highest_val = ta.highest(high, 20)
      plot(highest_val)
    `,
    shouldBeValid: true,
    expectedWarnings: ['PSV6-PERF-EXPENSIVE-IN-LOOP']
  },
  {
    name: 'Style Issue - Magic Numbers',
    code: `
      //@version=6
      indicator("Magic Numbers")
      sma_20 = ta.sma(close, 20)
      sma_50 = ta.sma(close, 50)
      plot(sma_20)
    `,
    shouldBeValid: true,
    expectedInfo: ['PSV6-STYLE-MAGIC']
  }
];

// Run tests
function runTests() {
  console.log('🧪 Testing Modular Ultimate Validator\n');
  
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    
    try {
      const result = validatePineScriptV6(testCase.code, {
        targetVersion: 6,
        enablePerformanceAnalysis: true
      });

      // Check validity
      if (result.isValid === testCase.shouldBeValid) {
        console.log(`  ✅ Validity check passed`);
        passed++;
      } else {
        console.log(`  ❌ Validity check failed. Expected: ${testCase.shouldBeValid}, Got: ${result.isValid}`);
        failed++;
      }

      // Check for expected errors
      if (testCase.expectedErrors) {
        const errorCodes = result.errors.map(e => e.code);
        const hasExpectedErrors = testCase.expectedErrors.every(code => errorCodes.includes(code));
        if (hasExpectedErrors) {
          console.log(`  ✅ Expected errors found: ${testCase.expectedErrors.join(', ')}`);
        } else {
          console.log(`  ❌ Expected errors not found. Expected: ${testCase.expectedErrors.join(', ')}, Got: ${errorCodes.join(', ')}`);
          failed++;
        }
      }

      // Check for expected warnings
      if (testCase.expectedWarnings) {
        const warningCodes = result.warnings.map(w => w.code);
        const hasExpectedWarnings = testCase.expectedWarnings.every(code => warningCodes.includes(code));
        if (hasExpectedWarnings) {
          console.log(`  ✅ Expected warnings found: ${testCase.expectedWarnings.join(', ')}`);
        } else {
          console.log(`  ❌ Expected warnings not found. Expected: ${testCase.expectedWarnings.join(', ')}, Got: ${warningCodes.join(', ')}`);
          failed++;
        }
      }

      // Check for expected info
      if (testCase.expectedInfo) {
        const infoCodes = result.info.map(i => i.code);
        const hasExpectedInfo = testCase.expectedInfo.every(code => infoCodes.includes(code));
        if (hasExpectedInfo) {
          console.log(`  ✅ Expected info found: ${testCase.expectedInfo.join(', ')}`);
        } else {
          console.log(`  ❌ Expected info not found. Expected: ${testCase.expectedInfo.join(', ')}, Got: ${infoCodes.join(', ')}`);
          failed++;
        }
      }

      // Show summary
      console.log(`  📊 Errors: ${result.errors.length}, Warnings: ${result.warnings.length}, Info: ${result.info.length}`);
      
    } catch (error) {
      console.log(`  ❌ Test failed with error: ${error}`);
      failed++;
    }
    
    console.log('');
  }

  console.log(`\n📈 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Check the output above.');
  }
}

// Demonstrate modular usage
function demonstrateModularUsage() {
  console.log('🔧 Demonstrating Modular Usage\n');
  
  // Create validator with specific configuration
  const validator = new ModularUltimateValidator({
    targetVersion: 6,
    strictMode: true,
    enablePerformanceAnalysis: true
  });

  const code = `
    //@version=6
    indicator("Modular Test")
    
    // V6 features
    type Point
      float x
      float y
    
    varip int counter = 0
    counter += 1
    
    // Performance issue
    for i = 0 to 100
      highest_val = ta.highest(high, 20)
    
    // Style issue
    sma_20 = ta.sma(close, 20)
    
    plot(sma_20)
  `;

  const result = validator.validate(code);
  
  console.log('Validation Result:');
  console.log(`  Valid: ${result.isValid}`);
  console.log(`  Errors: ${result.errors.length}`);
  console.log(`  Warnings: ${result.warnings.length}`);
  console.log(`  Info: ${result.info.length}`);
  
  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(error => {
      console.log(`  ${error.code}: ${error.message} (line ${error.line})`);
    });
  }
  
  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    result.warnings.forEach(warning => {
      console.log(`  ${warning.code}: ${warning.message} (line ${warning.line})`);
    });
  }
  
  if (result.info.length > 0) {
    console.log('\nInfo:');
    result.info.forEach(info => {
      console.log(`  ${info.code}: ${info.message} (line ${info.line})`);
    });
  }
}

// Run the tests
if (typeof window === 'undefined') {
  // Node.js environment
  runTests();
  demonstrateModularUsage();
} else {
  // Browser environment
  console.log('Modular Ultimate Validator loaded successfully!');
  console.log('Run runTests() and demonstrateModularUsage() to see it in action.');
}

export { runTests, demonstrateModularUsage };
