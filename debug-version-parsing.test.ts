import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Version Parsing', () => {
  it('should debug version directive parsing', () => {
    const code = `//@version=5
strategy("Test", overlay = true)
plot(close)`;

    const validator = new EnhancedModularValidator({
      targetVersion: 6
    });
    
    const result = validator.validate(code);

    console.log('\n=== VERSION PARSING DEBUG ===');
    console.log('Total errors:', result.errors.length);
    
    const versionErrors = result.errors.filter(e => e.code === 'PS001');
    console.log('Version errors (PS001):', versionErrors.length);
    
    const allErrors = result.errors.map(e => `${e.code}: ${e.message}`);
    console.log('\nAll errors:');
    allErrors.forEach((error, i) => {
      console.log(`${i + 1}. ${error}`);
    });
    
    // Check if version directive is being detected
    console.log('\nContext info:');
    console.log('Has version:', validator['context']?.hasVersion);
    console.log('Version:', validator['context']?.version);
    console.log('Target version:', validator['config']?.targetVersion);
  });
});
