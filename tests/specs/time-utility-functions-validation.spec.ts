/**
 * Time/Date Utility Functions Validation Tests (TDD)
 * 
 * PHASE 10 - MEDIUM PRIORITY
 * Coverage Gap: 30% (12/40 time/date functions untested)
 * 
 * Following TDD: These tests are written FIRST and will initially FAIL
 * until the Time/Date Functions Validator is extended.
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../..';

describe('Time/Date Utility Functions Validation (TDD)', () => {
  const createValidator = () => new EnhancedModularValidator({
    version: '6',
    scriptType: 'indicator',
    strictMode: true,
    enableWarnings: true
  });

  // ============================================================================
  // Category 1: Timestamp Creation
  // ============================================================================

  describe('PSV6-TIME-CREATE: Timestamp Creation', () => {
    
    it('should validate timestamp() with full parameters', () => {
      const code = `
//@version=6
indicator("Timestamp Full")

startTime = timestamp("GMT", 2024, 1, 1, 0, 0, 0)
plot(time >= startTime ? 1 : 0)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate timestamp() with partial parameters', () => {
      const code = `
//@version=6
indicator("Timestamp Partial")

startTime = timestamp(2024, 1, 1)
plot(time >= startTime ? 1 : 0)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate timestamp() with timezone', () => {
      const code = `
//@version=6
indicator("Timestamp Timezone")

nyTime = timestamp("America/New_York", 2024, 1, 1, 9, 30, 0)
londonTime = timestamp("Europe/London", 2024, 1, 1, 9, 30, 0)
tokyoTime = timestamp("Asia/Tokyo", 2024, 1, 1, 9, 30, 0)

plot(time >= nyTime ? 1 : 0)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 2: Time Extraction
  // ============================================================================

  describe('PSV6-TIME-EXTRACT: Time Component Extraction', () => {
    
    it('should validate year()', () => {
      const code = `
//@version=6
indicator("Extract Year")

currentYear = year(time)
plot(currentYear)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate month()', () => {
      const code = `
//@version=6
indicator("Extract Month")

currentMonth = month(time)
plot(currentMonth)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate weekofyear()', () => {
      const code = `
//@version=6
indicator("Week of Year")

week = weekofyear(time)
plot(week)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate dayofmonth()', () => {
      const code = `
//@version=6
indicator("Day of Month")

day = dayofmonth(time)
plot(day)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate dayofweek()', () => {
      const code = `
//@version=6
indicator("Day of Week")

dow = dayofweek(time)
isWeekend = dow == dayofweek.saturday or dow == dayofweek.sunday
bgcolor(isWeekend ? color.new(color.gray, 90) : na)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate hour()', () => {
      const code = `
//@version=6
indicator("Extract Hour")

currentHour = hour(time)
plot(currentHour)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate minute()', () => {
      const code = `
//@version=6
indicator("Extract Minute")

currentMinute = minute(time)
plot(currentMinute)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate second()', () => {
      const code = `
//@version=6
indicator("Extract Second")

currentSecond = second(time)
plot(currentSecond)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 3: Timeframe Functions
  // ============================================================================

  describe('PSV6-TIME-TIMEFRAME: Timeframe Functions', () => {
    
    it('should validate timeframe.* constants', () => {
      const code = `
//@version=6
indicator("Timeframe Constants")

is1Min = timeframe.period == "1"
is5Min = timeframe.period == "5"
is1Hour = timeframe.period == "60"
is1Day = timeframe.isdaily
is1Week = timeframe.isweekly
is1Month = timeframe.ismonthly

plot(is1Day ? 1 : 0)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate timeframe.in_seconds()', () => {
      const code = `
//@version=6
indicator("Timeframe Seconds")

tfSeconds = timeframe.in_seconds()
plot(tfSeconds)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate timeframe.from_seconds()', () => {
      const code = `
//@version=6
indicator("Timeframe From Seconds")

// 1 hour = 3600 seconds
hourTf = timeframe.from_seconds(3600)
label.new(bar_index, high, hourTf)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 4: Time Calculations
  // ============================================================================

  describe('PSV6-TIME-CALC: Time Calculations', () => {
    
    it('should validate time arithmetic', () => {
      const code = `
//@version=6
indicator("Time Arithmetic")

// Add 1 hour (3600000 milliseconds)
oneHourLater = time + 3600000

// Add 1 day
oneDayLater = time + 86400000

plot(time)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate time difference calculation', () => {
      const code = `
//@version=6
indicator("Time Difference")

var int barsSinceStart = 0
var int startTime = time

if bar_index > 0
    barsSinceStart := bar_index
    timeDiff = time - startTime
    plot(timeDiff)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category 5: Session/Trading Hours
  // ============================================================================

  describe('PSV6-TIME-SESSION: Session Functions', () => {
    
    it('should validate time() with session spec', () => {
      const code = `
//@version=6
indicator("Session Time")

// Regular trading hours
regularHours = time(timeframe.period, "0930-1600")
isRegularHours = not na(regularHours)
bgcolor(isRegularHours ? color.new(color.green, 95) : na)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate time() with timezone and session', () => {
      const code = `
//@version=6
indicator("Session with Timezone")

// New York trading hours
nySession = time(timeframe.period, "0930-1600", "America/New_York")
inNySession = not na(nySession)
bgcolor(inNySession ? color.new(color.blue, 95) : na)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate time_close() function', () => {
      const code = `
//@version=6
indicator("Time Close")

closeTime = time_close(timeframe.period)
plot(closeTime - time)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('PSV6-TIME-INTEGRATION: Time Integration Tests', () => {
    
    it('should validate comprehensive date filtering', () => {
      const code = `
//@version=6
indicator("Date Filter")

// Filter by year and month
inTargetPeriod = year(time) == 2024 and month(time) == 1

// Filter by day of week (Monday-Friday only)
isWeekday = dayofweek(time) != dayofweek.saturday and dayofweek(time) != dayofweek.sunday

// Filter by trading hours
inTradingHours = hour(time) >= 9 and hour(time) < 16

// Combined filter
shouldTrade = inTargetPeriod and isWeekday and inTradingHours
bgcolor(shouldTrade ? color.new(color.green, 95) : na)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate multi-timezone analysis', () => {
      const code = `
//@version=6
indicator("Multi-Timezone")

// Define key market open times
nyOpen = timestamp("America/New_York", year(time), month(time), dayofmonth(time), 9, 30, 0)
londonOpen = timestamp("Europe/London", year(time), month(time), dayofmonth(time), 8, 0, 0)
tokyoOpen = timestamp("Asia/Tokyo", year(time), month(time), dayofmonth(time), 9, 0, 0)

// Check if within 1 hour of any market open
nearNyOpen = math.abs(time - nyOpen) < 3600000
nearLondonOpen = math.abs(time - londonOpen) < 3600000
nearTokyoOpen = math.abs(time - tokyoOpen) < 3600000

isMarketOpen = nearNyOpen or nearLondonOpen or nearTokyoOpen
bgcolor(isMarketOpen ? color.new(color.yellow, 90) : na)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate time-based alerts', () => {
      const code = `
//@version=6
indicator("Time Alerts")

// Alert at specific time each day
targetHour = 10
targetMinute = 0

isTargetTime = hour(time) == targetHour and minute(time) == targetMinute

if isTargetTime
    alert("Daily alert at 10:00 AM", alert.freq_once_per_bar)

plot(isTargetTime ? 1 : 0)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate end-of-period detection', () => {
      const code = `
//@version=6
indicator("End of Period")

// Detect last bar of day
isLastBarOfDay = timeframe.isdaily ? true : 
     hour(time) == 15 and minute(time) >= 55

// Detect last bar of week
isLastBarOfWeek = dayofweek(time) == dayofweek.friday and isLastBarOfDay

// Detect last bar of month
isLastBarOfMonth = dayofmonth(time) >= 28 and isLastBarOfDay

bgcolor(isLastBarOfMonth ? color.new(color.red, 90) :
        isLastBarOfWeek ? color.new(color.orange, 90) :
        isLastBarOfDay ? color.new(color.yellow, 90) : na)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Error Cases
  // ============================================================================

  describe('PSV6-TIME-ERRORS: Time Error Cases', () => {
    
    it('should error on invalid month', () => {
      const code = `
//@version=6
indicator("Invalid Month")

invalidTime = timestamp(2024, 13, 1)  // Month > 12
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should error on invalid day', () => {
      const code = `
//@version=6
indicator("Invalid Day")

invalidTime = timestamp(2024, 2, 30)  // Feb doesn't have 30 days
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should error on invalid hour', () => {
      const code = `
//@version=6
indicator("Invalid Hour")

invalidTime = timestamp(2024, 1, 1, 25, 0, 0)  // Hour > 23
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should error on invalid timezone', () => {
      const code = `
//@version=6
indicator("Invalid Timezone")

invalidTime = timestamp("Invalid/Timezone", 2024, 1, 1, 0, 0, 0)
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn on comparing time values incorrectly', () => {
      const code = `
//@version=6
indicator("Time Comparison")

// Warning: Comparing milliseconds might not work as expected across different data
isAfterDate = time > 1704067200000  // Hard-coded timestamp
      `;

      const result = createValidator().validate(code);
      // Should suggest using timestamp() function instead
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Best Practices
  // ============================================================================

  describe('PSV6-TIME-BEST-PRACTICES: Time Best Practices', () => {
    
    it('should validate using timestamp() for date comparisons', () => {
      const code = `
//@version=6
indicator("Timestamp Best Practice")

// Good: Use timestamp() for clarity
startDate = timestamp(2024, 1, 1)
endDate = timestamp(2024, 12, 31)

inRange = time >= startDate and time <= endDate
bgcolor(inRange ? color.new(color.green, 95) : na)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate caching time calculations', () => {
      const code = `
//@version=6
indicator("Cache Time Calculations")

// Good: Calculate once per bar
var int currentYear = na
var int currentMonth = na
var int currentDay = na

if barstate.isnew
    currentYear := year(time)
    currentMonth := month(time)
    currentDay := dayofmonth(time)

// Use cached values
isNewYear = currentYear != year(time[1])
plot(isNewYear ? 1 : 0)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

