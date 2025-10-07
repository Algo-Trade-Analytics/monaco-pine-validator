import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Timeframe Constants Test', () => {
  it('should validate timeframe.isweekly and timeframe.ismonthly usage', () => {
    const createValidator = () => new EnhancedModularValidator({
      targetVersion: 6,
      strictMode: true,
      enableWarnings: true
    });

    const code = `//@version=6
indicator("Timeframe Weekly Monthly Test")

// Test timeframe constants
weekly_chart = timeframe.isweekly
monthly_chart = timeframe.ismonthly
intraday_chart = timeframe.isintraday

plot(close)`;
      
    const result = createValidator().validate(code);
    
    console.log('\n=== TIMEFRAME CONSTANTS DEBUG ===');
    console.log('isValid:', result.isValid);
    console.log('Number of errors:', result.errors.length);
    console.log('Number of warnings:', result.warnings.length);
    console.log('Number of info:', result.info.length);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.code}: ${error.message}`);
      });
    }
    
    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach((warning, i) => {
        console.log(`${i + 1}. ${warning.code}: ${warning.message}`);
      });
    }
    
    if (result.info.length > 0) {
      console.log('\nInfo:');
      result.info.forEach((info, i) => {
        console.log(`${i + 1}. ${info.code}: ${info.message}`);
      });
    }
    
    const timeframeInfo = result.info.filter(i => i.code === 'PSV6-TIMEFRAME-CONSTANT');
    console.log('\nTimeframe info count:', timeframeInfo.length);
    
    expect(timeframeInfo.length).toBeGreaterThanOrEqual(3);
  });
});
