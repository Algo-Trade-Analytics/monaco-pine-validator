import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Template Strings', () => {
  it('should debug template string parsing issue', () => {
    // Test 1: Simple v5 script (should get version error)
    const simpleCode = `//@version=5
strategy("Test", overlay = true)
plot(close)`;

    // Test 2: v5 script with template strings (might get namespace errors)
    const templateCode = `//@version=5
strategy("Test", overlay = true)

json = "'{'
     \\n    \\"strategy\\": '{
     \\n        \\"order_action\\": '\\"{{strategy.order.action}}\\"'
     \\n    '}'
     \\n'}'"

plot(close)`;

    console.log('\n=== TEMPLATE STRING DEBUG ===');
    
    // Test simple script
    const validator1 = new EnhancedModularValidator({ targetVersion: 6 });
    const result1 = validator1.validate(simpleCode);
    
    console.log('\nSimple v5 script:');
    console.log('Errors:', result1.errors.length);
    console.log('Version errors:', result1.errors.filter(e => e.code === 'PS001').length);
    console.log('Namespace errors:', result1.errors.filter(e => e.code.includes('UNDEFINED-NAMESPACE')).length);
    
    // Test template script
    const validator2 = new EnhancedModularValidator({ targetVersion: 6 });
    const result2 = validator2.validate(templateCode);
    
    console.log('\nTemplate v5 script:');
    console.log('Errors:', result2.errors.length);
    console.log('Version errors:', result2.errors.filter(e => e.code === 'PS001').length);
    console.log('Namespace errors:', result2.errors.filter(e => e.code.includes('UNDEFINED-NAMESPACE')).length);
    
    if (result2.errors.length > 0) {
      console.log('\nTemplate script errors:');
      result2.errors.forEach((error, i) => {
        console.log(`${i + 1}. Line ${error.line}: ${error.code} - ${error.message}`);
      });
    }
    
    // Both should get version errors, not namespace errors
    expect(result1.errors.filter(e => e.code === 'PS001').length).toBeGreaterThan(0);
    expect(result2.errors.filter(e => e.code === 'PS001').length).toBeGreaterThan(0);
  });
});
