import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Debug Monaco Worker E2E Test', () => {
  it('should validate Uptrick-Volatility.pine without errors', () => {
    const validator = new EnhancedModularValidator({
      targetVersion: 6,
      strictMode: true,
      enableWarnings: true
    });

    const samplePath = resolve(__dirname, './tests/popular-pine-scripts/Uptrick-Volatility.pine');
    const source = readFileSync(samplePath, 'utf8');

    const result = validator.validate(source);

    console.log('\n=== MONACO WORKER DEBUG ===');
    console.log('isValid:', result.isValid);
    console.log('Number of errors:', result.errors.length);
    console.log('Number of warnings:', result.warnings.length);
    console.log('Number of info:', result.info.length);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.code}: ${error.message}`);
        console.log(`   Line ${error.line}, Column ${error.column}`);
      });
    }

    // Check if there's an error on line 72, column 12
    const line72Error = result.errors.find(e => e.line === 72);
    if (line72Error) {
      console.log('\n=== LINE 72 ERROR DETAILS ===');
      console.log('Error:', line72Error);
      console.log('Line 72 content:', source.split('\n')[71]); // 0-indexed
    }

    expect(result.errors).toHaveLength(0);
  });
});
