/**
 * Comprehensive Pine Script v6 Validator Test Suite
 * 
 * This file groups all validation tests together to run them as a single test suite.
 * It imports and runs all individual test modules to provide complete coverage.
 */

import { describe } from 'vitest';

// Import all test modules
import './array-validation.spec';
import './map-validation.spec';
import './string-functions-validation.spec';
import './input-functions-validation.spec';
import './advanced-input-parameters-validation.spec';
import './color-functions-validation.spec';
import './drawing-functions-validation.spec';
import './table-advanced-validation.spec';
import './polyline-functions-validation.spec';
import './ta-functions-validation.spec';
import './math-functions-validation.spec';
import './strategy-functions-validation.spec';
import './advanced-strategy-functions-validation.spec';
import './dynamic-data-validation.spec';
import './dynamic-request-advanced.spec';
import './request-functions-advanced-validation.spec';
import './enum-validation.spec';
import './function-validation.spec';
import './history-referencing-validation.spec';
import './matrix-validation.spec';
import './migration-verification.spec';
import './switch-statement-validation.spec';
import './text-formatting-validation.spec';
import './time-date-functions-validation.spec';
import './alert-functions-validation.spec';
import './builtin-variables-validation.spec';
import './syminfo-variables-validation.spec';
import './final-constants-validation.spec';
import './type-inference-validation.spec';
import './udt-validation.spec';
import './ultimate-validator-enhanced.spec';
import './ultimate-validator.spec';
import './v6-advanced.spec';
import './v6-comprehensive.spec';
import './v6-enhanced-features.spec';
import './varip-validation.spec';
import './while-loop-validation.spec';
import './dynamic-loop-validation.spec';
import './lazy-evaluation-validation.spec';
import './linefill-validation.spec';
import './strategy-order-limits-validation.spec';
import './enhanced-textbox-validation.spec';
import './negative-array-indices-fix.spec';
import './boolean-optimization-validation.spec';
import './text-typography-validation.spec';
// Newly added advanced edge cases
import './ticker-validation.spec';
import './syminfo-session-timezone-advanced.spec';
import './drawing-styling-enums-advanced.spec';
import './strategy-risk-commission-advanced.spec';

describe('🧪 Complete Pine Script v6 Validator Test Suite', () => {
  // This describe block serves as a container for all tests
  // All individual test modules are imported above and will run automatically
  
  it('should run all validation tests', () => {
    // This is a placeholder test to ensure the suite runs
    // All actual tests are in the imported modules above
    expect(true).toBe(true);
  });
});

// Test suite summary information
  const testSuiteInfo = {
  name: 'Complete Pine Script v6 Validator Test Suite',
  description: 'Comprehensive test coverage for all Pine Script v6 validation features',
  modules: [
    'Array Validation',
    'Map Validation',
    'String Functions Validation',
    'Input Functions Validation',
    'Advanced Input Parameters Validation',
    'Color Functions Validation',
    'Drawing Functions Validation',
    'Polyline Functions Validation',
    'TA Functions Validation',
    'Math Functions Validation',
    'Strategy Functions Validation',
    'Advanced Strategy Functions Validation',
    'Dynamic Data Validation', 
    'Dynamic Request Advanced',
    'Enum Validation',
    'Function Validation',
    'History Referencing Validation',
    'Matrix Validation',
    'Migration Verification',
    'Switch Statement Validation',
    'Text Formatting Validation',
    'Time/Date Functions Validation',
    'Alert Functions Validation',
    'Built-in Variables Validation',
    'Syminfo Variables Validation',
    'Final Constants Validation',
    'Type Inference Validation',
    'UDT Validation',
    'Ultimate Validator Enhanced',
    'Ultimate Validator',
    'V6 Advanced Features',
    'V6 Comprehensive Features',
    'V6 Enhanced Features',
    'Varip Validation',
    'While Loop Validation',
    'Dynamic Loop Validation',
    'Lazy Evaluation Validation',
    'Linefill Validation',
    'Strategy Order Limits Validation',
    'Enhanced Textbox Validation',
    'Negative Array Indices Fix',
    'Boolean Optimization Validation',
    'Text Typography Validation',
    'Ticker Functions Advanced',
    'Syminfo/Session/Timezone Advanced',
    'Drawing/Styling Enums Advanced',
    'Strategy Risk & Commission Advanced'
  ],
  totalModules: 47
};

console.log('🧪 Pine Script v6 Validator Test Suite Loaded');
console.log(`📊 Total Test Modules: ${testSuiteInfo.totalModules}`);
console.log('📋 Test Modules:', testSuiteInfo.modules.join(', '));
