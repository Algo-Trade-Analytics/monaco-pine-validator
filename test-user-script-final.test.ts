import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Test User Script Final', () => {
  it('should generate version error instead of namespace errors for v5 script', () => {
    // Extract the problematic section from the user's script
    const code = `//@version=5
strategy("Test", overlay = true)

// Test the problematic strategy properties in template strings
json = "'{'
     \\n    \\"passphrase\\": \\"{0}\\",
     \\n    \\"time\\": '\\"{{timenow}}\\"',
     \\n    \\"ticker\\": '\\"{{ticker}}\\"',
     \\n    \\"plot\\": '{
     \\n        \\"stop_price\\": {1, number, #.########},
     \\n        \\"limit_price\\": {2, number, #.########}
     \\n    '}',
     \\n    \\"strategy\\": '{
     \\n        \\"position_size\\": '{{strategy.position_size}}',
     \\n        \\"order_action\\": '\\"{{strategy.order.action}}\\"',
     \\n        \\"market_position\\": '\\"{{strategy.market_position}}\\"',
     \\n        \\"market_position_size\\": '{{strategy.market_position_size}}',
     \\n        \\"prev_market_position\\": '\\"{{strategy.prev_market_position}}\\"',
     \\n        \\"prev_market_position_size\\": '{{strategy.prev_market_position_size}}'
     \\n    '}'
     \\n'}'"

altStr := str.format(json, "pass", 1.5, 2.0)

plot(close)`;

    const validator = new EnhancedModularValidator({
      targetVersion: 6  // Explicitly set to v6
    });
    
    const result = validator.validate(code);

    console.log('\n=== USER SCRIPT FINAL TEST ===');
    console.log('Total errors:', result.errors.length);
    
    const versionErrors = result.errors.filter(e => e.code === 'PS001');
    const namespaceErrors = result.errors.filter(e => e.code.includes('UNDEFINED-NAMESPACE'));
    
    console.log('Version errors (PS001):', versionErrors.length);
    console.log('Namespace errors:', namespaceErrors.length);
    
    if (versionErrors.length > 0) {
      console.log('\nVersion errors:');
      versionErrors.forEach((error, i) => {
        console.log(`${i + 1}. Line ${error.line}: ${error.code} - ${error.message}`);
      });
    }
    
    if (namespaceErrors.length > 0) {
      console.log('\nNamespace errors:');
      namespaceErrors.forEach((error, i) => {
        console.log(`${i + 1}. Line ${error.line}: ${error.code} - ${error.message}`);
      });
    }
    
    // Should get version error, not namespace errors
    expect(versionErrors.length).toBeGreaterThan(0);
    expect(namespaceErrors.length).toBe(0);
    
    console.log('\n✅ SUCCESS: Version error generated, no namespace errors!');
  });
});
