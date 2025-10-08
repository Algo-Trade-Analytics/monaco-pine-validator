import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Test Version Error', () => {
  it('should generate version error for v5 script when targetVersion is 6', () => {
    const code = `//@version=5
strategy("Test", overlay = true)

// This should trigger version error, not undefined namespace errors
strategy.entry("Long", strategy.long)
plot(close)`;

    const validator = new EnhancedModularValidator({
      targetVersion: 6  // Explicitly set to v6
    });
    
    const result = validator.validate(code);

    console.log('\n=== VERSION VALIDATION TEST ===');
    console.log('Total errors:', result.errors.length);
    
    const versionErrors = result.errors.filter(e => e.code === 'PS001');
    console.log('Version errors (PS001):', versionErrors.length);
    
    if (versionErrors.length > 0) {
      console.log('\nVersion errors:');
      versionErrors.forEach((error, i) => {
        console.log(`${i + 1}. Line ${error.line}: ${error.code} - ${error.message}`);
      });
    }
    
    const namespaceErrors = result.errors.filter(e => e.code.includes('UNDEFINED-NAMESPACE'));
    console.log('Namespace errors:', namespaceErrors.length);
    
    if (namespaceErrors.length > 0) {
      console.log('\nNamespace errors:');
      namespaceErrors.slice(0, 3).forEach((error, i) => {
        console.log(`${i + 1}. Line ${error.line}: ${error.code} - ${error.message}`);
      });
    }
    
    // The validator should generate PS001 version error, not undefined namespace errors
    expect(versionErrors.length).toBeGreaterThan(0);
  });
});
