import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Version Parsing Simple', () => {
  it('should debug version directive parsing with simple vs complex scripts', () => {
    // Test 1: Simple script (should work)
    const simpleCode = `//@version=5
strategy("Test", overlay = true)
plot(close)`;

    // Test 2: Complex script with template strings (might fail parsing)
    const complexCode = `//@version=5
strategy("Test", overlay = true)

json = "'{'
     \\n    \\"strategy\\": '{
     \\n        \\"order_action\\": '\\"{{strategy.order.action}}\\"'
     \\n    '}'
     \\n'}'"

plot(close)`;

    console.log('\n=== VERSION PARSING DEBUG ===');
    
    // Test simple script
    const validator1 = new EnhancedModularValidator({ targetVersion: 6 });
    const result1 = validator1.validate(simpleCode);
    
    console.log('\nSimple script:');
    console.log('Has version:', validator1['context']?.hasVersion);
    console.log('Version:', validator1['context']?.version);
    console.log('Errors:', result1.errors.length);
    console.log('Version errors:', result1.errors.filter(e => e.code === 'PS001').length);
    
    // Test complex script
    const validator2 = new EnhancedModularValidator({ targetVersion: 6 });
    const result2 = validator2.validate(complexCode);
    
    console.log('\nComplex script:');
    console.log('Has version:', validator2['context']?.hasVersion);
    console.log('Version:', validator2['context']?.version);
    console.log('Errors:', result2.errors.length);
    console.log('Version errors:', result2.errors.filter(e => e.code === 'PS001').length);
    console.log('Namespace errors:', result2.errors.filter(e => e.code.includes('UNDEFINED-NAMESPACE')).length);
    
    // Simple script should detect version correctly
    expect(validator1['context']?.hasVersion).toBe(true);
    expect(validator1['context']?.version).toBe(5);
    
    // Complex script might fail to detect version due to parsing issues
    console.log('\nComplex script version detection:', validator2['context']?.hasVersion ? 'SUCCESS' : 'FAILED');
  });
});
