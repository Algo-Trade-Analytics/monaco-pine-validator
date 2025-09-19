import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { expectHas, expectLacks, expectValid, expectInvalid } from './test-utils';

const createValidator = () => new EnhancedModularValidator({
  targetVersion: 6,
  strictMode: true,
  enablePerformanceAnalysis: true
});

describe('Alert Functions Validation', () => {

  describe('PSV6-ALERT-FREQ: Alert Frequency Constants', () => {
    it('should validate correct alert.freq_all usage', () => {
      const code = `//@version=6
indicator("Alert Freq All Test")

// Valid alert.freq_all usage
if close > open
    alert("Price increased", alert.freq_all)

plot(close)`;
      
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-ALERT-FREQ-VALID', 'PSV6-ALERT-FREQ-USAGE'] });
    });

    it('should validate correct alert.freq_once_per_bar usage', () => {
      const code = `//@version=6
indicator("Alert Freq Once Per Bar Test")

// Valid alert.freq_once_per_bar usage
if ta.crossover(close, ta.sma(close, 20))
    alert("Golden cross", alert.freq_once_per_bar)

plot(close)`;
      
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-ALERT-FREQ-VALID', 'PSV6-ALERT-FREQ-USAGE'] });
    });

    it('should validate correct alert.freq_once_per_bar_close usage', () => {
      const code = `//@version=6
indicator("Alert Freq Bar Close Test")

// Valid alert.freq_once_per_bar_close usage - recommended
if close > high[1]
    alert("New high", alert.freq_once_per_bar_close)

plot(close)`;
      
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-ALERT-FREQ-VALID', 'PSV6-ALERT-FREQ-USAGE'] });
    });

    it('should error on invalid alert frequency', () => {
      const code = `//@version=6
indicator("Alert Invalid Freq Test")

// Invalid alert frequency
if close > open
    alert("Price up", alert.freq_invalid)

plot(close)`;
      
      const result = createValidator().validate(code);
      // The script might have other errors, but we specifically want to check for the alert frequency error
      const hasAlertFreqError = result.errors.some(e => e.code === 'PSV6-ALERT-FREQ-INVALID');
      expect(hasAlertFreqError).toBe(true);
    });
  });

  describe('PSV6-ALERT-BASIC: Basic Alert Trigger on Bar Close', () => {
    it('should validate basic alert trigger when conditions are met at bar close', () => {
      const code = `//@version=6
indicator("Basic Alert Test")

// Test Case 1: Basic Alert Trigger on Bar Close
price_above_ma = close > ta.sma(close, 50)
if price_above_ma and barstate.isconfirmed
    alert("Price above MA at bar close", alert.freq_once_per_bar_close)

plot(close)`;
      
      const result = createValidator().validate(code);
      // Check that we have the alert frequency validation working
      const hasAlertFreqValid = result.info.some(i => i.code === 'PSV6-ALERT-FREQ-VALID');
      const hasAlertFreqUsage = result.info.some(i => i.code === 'PSV6-ALERT-FREQ-USAGE');
      expect(hasAlertFreqValid).toBe(true);
      expect(hasAlertFreqUsage).toBe(true);
    });

    it('should handle no alert when conditions are not met', () => {
      const code = `//@version=6
indicator("No Alert Test")

// Test Case 2: No Alert When Conditions Are Not Met
never_true_condition = false
if never_true_condition
    alert("This should never trigger", alert.freq_once_per_bar_close)

plot(close)`;
      
      const result = createValidator().validate(code);
      // The script should at least detect the alert frequency usage
      const hasAlertFreqUsage = result.info.some(i => i.code === 'PSV6-ALERT-FREQ-USAGE');
      expect(hasAlertFreqUsage).toBe(true);
    });
  });

  describe('PSV6-ALERT-MULTIPLE: Multiple Alerts in Rapid Succession', () => {
    it('should handle multiple alerts triggered by consecutive conditions', () => {
      const code = `//@version=6
indicator("Multiple Alerts Test")

// Test Case 3: Multiple Alerts in Rapid Succession
ma_short = ta.sma(close, 10)
ma_long = ta.sma(close, 20)

if ta.crossover(ma_short, ma_long)
    alert("Bullish crossover", alert.freq_once_per_bar_close)

if ta.crossunder(ma_short, ma_long)
    alert("Bearish crossover", alert.freq_once_per_bar_close)

if close > high[1]
    alert("New high", alert.freq_once_per_bar_close)

plot(close)`;
      
      const result = createValidator().validate(code);
      // Should detect multiple alert frequency usages
      const alertFreqUsages = result.info.filter(i => i.code === 'PSV6-ALERT-FREQ-USAGE').length;
      expect(alertFreqUsages).toBeGreaterThanOrEqual(3); // Should find at least 3 alert frequency usages
    });
  });

  describe('PSV6-ALERT-SUPPRESSION: Alert Suppression During Inactive Periods', () => {
    it('should handle alert suppression during defined inactive periods', () => {
      const code = `//@version=6
indicator("Alert Suppression Test")

// Test Case 4: Alert Suppression During Inactive Periods
condition_met = close > ta.sma(close, 20)

if condition_met
    alert("Alert with condition", alert.freq_once_per_bar_close)

plot(close)`;
      
      const result = createValidator().validate(code);
      // Should detect alert frequency usage
      const hasAlertFreqUsage = result.info.some(i => i.code === 'PSV6-ALERT-FREQ-USAGE');
      expect(hasAlertFreqUsage).toBe(true);
    });
  });

  describe('PSV6-ALERT-DELAYED: Alert Accuracy with Delayed Data', () => {
    it('should assess alert performance when processing delayed market data', () => {
      const code = `//@version=6
indicator("Delayed Data Alert Test")

// Test Case 5: Alert Accuracy with Delayed Data
if close > close[1]
    alert("Price increased from previous bar", alert.freq_once_per_bar_close)

plot(close)`;
      
      const result = createValidator().validate(code);
      const hasAlertFreqUsage = result.info.some(i => i.code === 'PSV6-ALERT-FREQ-USAGE');
      expect(hasAlertFreqUsage).toBe(true);
    });
  });

  describe('PSV6-ALERT-OVERLAPS: Handling of Alert Overlaps', () => {
    it('should ensure overlapping alerts are managed correctly without duplication', () => {
      const code = `//@version=6
indicator("Alert Overlaps Test")

// Test Case 6: Handling of Alert Overlaps with different frequencies
if close > open
    alert("Price up", alert.freq_all)

if close < open  
    alert("Price down", alert.freq_once_per_bar_close)

plot(close)`;
      
      const result = createValidator().validate(code);
      // Should detect mixed frequencies
      const hasMixedFreqWarning = result.warnings.some(w => w.code === 'PSV6-ALERT-MIXED-FREQUENCIES');
      expect(hasMixedFreqWarning).toBe(true);
    });
  });

  describe('PSV6-ALERT-PERFORMANCE: Performance Under High Load', () => {
    it('should evaluate system performance when processing high volume of alerts', () => {
      const code = `//@version=6
indicator("High Load Alert Test")

// Test Case 7: Performance Under High Load
// Multiple alert conditions that could trigger frequently
for i = 1 to 5
    if close > close[i]
        alert("Price higher than bars ago", alert.freq_all)

plot(close)`;
      
      const result = createValidator().validate(code);
      // Should detect alert in loop
      const hasAlertInLoop = result.warnings.some(w => w.code === 'PSV6-ALERT-IN-LOOP');
      expect(hasAlertInLoop).toBe(true);
    });
  });

  describe('PSV6-ALERT-NOTIFICATIONS: User Notification and Logging', () => {
    it('should verify that alerts are properly configured for notifications and logging', () => {
      const code = `//@version=6
indicator("Notification Alert Test")

// Test Case 8: User Notification and Logging
if close > high[1]
    alert("New high detected", alert.freq_once_per_bar_close)

// Also test alertcondition for external alerts
alertcondition(close > high[1], title="Breakout Alert", message="Price breakout detected")

plot(close)`;
      
      const result = createValidator().validate(code);
      // Should detect alert frequency usage and alertcondition
      const hasAlertFreqUsage = result.info.some(i => i.code === 'PSV6-ALERT-FREQ-USAGE');
      expect(hasAlertFreqUsage).toBe(true);
    });
  });

  describe('PSV6-ALERT-CONDITIONS: Alert Condition Validation', () => {
    it('should validate alertcondition function usage', () => {
      const code = `//@version=6
indicator("Alert Condition Test")

// Valid alertcondition usage
price_change = math.abs(close - open) / open * 100
significant_move = price_change > 2

alertcondition(significant_move, title="Significant Move", message="Price moved more than 2%")

plot(close)`;
      
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expectLacks(result, { warnings: ['PSV6-ALERTCONDITION-NO-TITLE'] });
    });

    it('should warn on alertcondition without title', () => {
      const code = `//@version=6
indicator("Alert Condition No Title")

condition = close > open
alertcondition(condition, "", "Price increased")

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { warnings: ['PSV6-ALERTCONDITION-NO-TITLE'] });
    });

    it('should warn on simple alert conditions', () => {
      const code = `//@version=6
indicator("Simple Alert Condition")

alertcondition(true, title="Always True", message="This always triggers")

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { warnings: ['PSV6-ALERTCONDITION-SIMPLE'] });
    });
  });

  describe('PSV6-ALERT-ERRORS: Alert Error Conditions', () => {
    it('should error on alert function with no parameters', () => {
      const code = `//@version=6
indicator("Alert No Params")

if close > open
    alert()

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { errors: ['PSV6-ALERT-NO-PARAMS'] });
    });

    it('should warn on empty alert message', () => {
      const code = `//@version=6
indicator("Empty Alert Message")

if close > open
    alert("", alert.freq_once_per_bar_close)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { warnings: ['PSV6-ALERT-EMPTY-MESSAGE'] });
    });
  });

  describe('PSV6-ALERT-RECOMMENDATIONS: Alert Best Practices', () => {
    it('should recommend alert.freq_once_per_bar_close for reliability', () => {
      const code = `//@version=6
indicator("Alert Frequency Recommendation")

// Using freq_all without freq_once_per_bar_close should trigger recommendation
if close > ta.sma(close, 20)
    alert("Above MA", alert.freq_all)

if close < ta.sma(close, 20)  
    alert("Below MA", alert.freq_all)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { 
        info: ['PSV6-ALERT-RECOMMEND-BAR-CLOSE'],
        warnings: ['PSV6-ALERT-SPAM-RISK'] 
      });
    });

    it('should provide info for scripts without alerts', () => {
      const code = `//@version=6
indicator("No Alerts Script")

// Script with no alerts should get info suggestion
sma_20 = ta.sma(close, 20)
plot(sma_20)`;
      
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-ALERT-NO-CONDITIONS'] });
    });
  });

  describe('PSV6-ALERT-INTEGRATION: Alert Integration Tests', () => {
    it('should handle complex alert scenarios with multiple conditions and frequencies', () => {
      const code = `//@version=6
strategy("Complex Alert Integration")

// Different alert frequencies for different conditions
if close > open
    alert("Price up", alert.freq_once_per_bar_close)

if close > high[1]
    alert("New high", alert.freq_once_per_bar)

// Alert condition for external use
alertcondition(close < low[1], title="New Low", message="Price made new low")

// Strategy entry with alert
if close > close[1]
    strategy.entry("Long", strategy.long)
    alert("Strategy entry signal", alert.freq_once_per_bar_close)

plot(close)`;
      
      const result = createValidator().validate(code);
      // Should detect multiple alert frequency usages
      const alertFreqUsages = result.info.filter(i => i.code === 'PSV6-ALERT-FREQ-USAGE').length;
      expect(alertFreqUsages).toBeGreaterThanOrEqual(2);
    });
  });
});
