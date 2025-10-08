import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Version Context', () => {
  it('should debug version context in namespace validator', () => {
    const code = `//@version=5
strategy("Test", overlay = true)

json = "'{'
     \\n    \\"strategy\\": '{
     \\n        \\"order_action\\": '\\"{{strategy.order.action}}\\"'
     \\n    '}'
     \\n'}'"

plot(close)`;

    const validator = new EnhancedModularValidator({ targetVersion: 6 });
    
    // Access the validator's internal state to debug
    const result = validator.validate(code);
    
    console.log('\n=== VERSION CONTEXT DEBUG ===');
    console.log('Total errors:', result.errors.length);
    
    const versionErrors = result.errors.filter(e => e.code === 'PS001');
    const namespaceErrors = result.errors.filter(e => e.code.includes('UNDEFINED-NAMESPACE'));
    
    console.log('Version errors (PS001):', versionErrors.length);
    console.log('Namespace errors:', namespaceErrors.length);
    
    // Check if we can access the context
    console.log('\nContext info:');
    console.log('Has version:', validator['context']?.hasVersion);
    console.log('Version:', validator['context']?.version);
    console.log('Target version:', validator['config']?.targetVersion);
    
    // Check if version validation is happening
    console.log('\nAll errors:');
    result.errors.forEach((error, i) => {
      console.log(`${i + 1}. Line ${error.line}: ${error.code} - ${error.message}`);
    });
    
    // The issue might be that version validation isn't running at all
    expect(versionErrors.length).toBeGreaterThan(0);
  });
});
