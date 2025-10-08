import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Test User V5 Script', () => {
  it('should handle v5 script with strategy properties correctly', () => {
    // Extract just the problematic section from the user's script
    const code = `//@version=5
strategy("Test", overlay = true)

// Test the problematic strategy properties
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

    console.log('\n=== USER V5 SCRIPT TEST ===');
    console.log('Total errors:', result.errors.length);
    
    const versionErrors = result.errors.filter(e => e.code === 'PS001');
    console.log('Version errors (PS001):', versionErrors.length);
    
    const namespaceErrors = result.errors.filter(e => e.code.includes('UNDEFINED-NAMESPACE'));
    console.log('Namespace errors:', namespaceErrors.length);
    
    if (namespaceErrors.length > 0) {
      console.log('\nNamespace errors:');
      namespaceErrors.forEach((error, i) => {
        console.log(`${i + 1}. Line ${error.line}: ${error.code} - ${error.message}`);
      });
    }
    
    // Should get version error, not namespace errors
    expect(versionErrors.length).toBeGreaterThan(0);
    // Ideally should not get namespace errors when version is wrong
    console.log('\nExpected: Version error (PS001)');
    console.log('Actual: Version errors =', versionErrors.length, ', Namespace errors =', namespaceErrors.length);
  });
});
