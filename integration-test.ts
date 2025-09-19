/**
 * Integration test to verify the modular validator works correctly
 * in the Pine Script AI Editor context
 */

import { EnhancedModularValidator, ValidationResult } from './index';

// Test the modular validator with the same configuration as the Pine Script AI Editor
export function testModularValidatorIntegration(): ValidationResult {
  const validator = new EnhancedModularValidator({
    strictMode: false,
    allowDeprecated: true,
    targetVersion: 6,
    customRules: [],
    ignoredCodes: [],
    enableTypeChecking: true,
    enableControlFlowAnalysis: true,
    enablePerformanceAnalysis: true
  });

  // Test with a simple Pine Script
  const testCode = `
    //@version=6
    indicator("Test Integration", overlay=true)
    
    // Test various validation features
    sma_20 = ta.sma(close, 20)
    rsi_14 = ta.rsi(close, 14)
    
    // Test repaint detection
    htf_data = request.security(syminfo.tickerid, "1D", close)
    
    // Test type safety
    condition = close > open
    result = condition ? "bullish" : 123  // This should trigger a type error
    
    // Test performance warnings
    for i = 0 to 1000
      for j = 0 to 1000
        calc = ta.highest(high, 20)  // This should trigger a performance warning
    
    plot(sma_20, "SMA 20", color=color.blue)
    hline(50, "Middle", color=color.gray)
  `;

  const result = validator.validate(testCode);
  
  console.log('Modular Validator Integration Test Results:');
  console.log('- Errors:', result.errors.length);
  console.log('- Warnings:', result.warnings.length);
  console.log('- Info:', result.info.length);
  console.log('- Is Valid:', result.isValid);
  
  // Log some specific errors/warnings for verification
  if (result.errors.length > 0) {
    console.log('Sample Errors:');
    result.errors.slice(0, 3).forEach(error => {
      console.log(`  - ${error.code}: ${error.message}`);
    });
  }
  
  if (result.warnings.length > 0) {
    console.log('Sample Warnings:');
    result.warnings.slice(0, 3).forEach(warning => {
      console.log(`  - ${warning.code}: ${warning.message}`);
    });
  }
  
  return result;
}

// Test the validator's completion and hover features
export function testValidatorFeatures(): void {
  const validator = new EnhancedModularValidator();
  
  // Test completions
  const completions = validator.getCompletions();
  console.log('Completions available:', completions.length);
  
  // Test hover info
  const hoverInfo = validator.getHoverInfo({ line: 1, column: 1 });
  console.log('Hover info available:', hoverInfo !== null);
  
  // Test validation stats
  const stats = validator.getValidationStats();
  console.log('Validation stats:', stats);
}

// Run the integration test
if (typeof window === 'undefined') {
  // Only run in Node.js environment
  testModularValidatorIntegration();
  testValidatorFeatures();
}
