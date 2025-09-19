import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { expectHas, expectLacks, expectValid, expectInvalid } from './test-utils';

const createValidator = () => new EnhancedModularValidator({
  targetVersion: 6,
  strictMode: true,
  enablePerformanceAnalysis: true
});

describe('Time/Date Functions Validation', () => {

  describe('PSV6-TIME-CLOSE: time_close() Function Validation', () => {
    it('should validate correct time_close usage', () => {
      const code = `//@version=6
indicator("Time Close Test")

// Valid time_close usage
close_time = time_close("60", session.regular)
close_time_utc = time_close("60", session.regular, "UTC")

plot(close)`;
      
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-TIME-CLOSE-INFO'] });
    });

    it('should error on time_close with no parameters', () => {
      const code = `//@version=6
indicator("Time Close Error Test")

// Missing timeframe parameter
close_time = time_close()

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { errors: ['PSV6-TIME-CLOSE-PARAMS'] });
    });

    it('should warn on time_close with invalid session', () => {
      const code = `//@version=6
indicator("Time Close Session Test")

// Invalid session parameter
close_time = time_close("60", "invalid_session")

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { warnings: ['PSV6-TIME-CLOSE-SESSION'] });
    });

    it('should validate time_close with custom timezone', () => {
      const code = `//@version=6
indicator("Time Close Timezone Test")

// Valid time_close with custom timezone
close_time = time_close("60", session.regular, "America/New_York")

plot(close)`;
      
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-TIMEZONE-CUSTOM'] });
    });
  });

  describe('PSV6-TIME-TRADINGDAY: time_tradingday() Function Validation', () => {
    it('should validate correct time_tradingday usage', () => {
      const code = `//@version=6
indicator("Time Trading Day Test")

// Valid time_tradingday usage
trading_day = time_tradingday(time)
trading_day_utc = time_tradingday(time, "UTC")

plot(close)`;
      
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-TIME-TRADINGDAY-INFO'] });
    });

    it('should error on time_tradingday with no parameters', () => {
      const code = `//@version=6
indicator("Time Trading Day Error Test")

// Missing time parameter
trading_day = time_tradingday()

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { errors: ['PSV6-TIME-TRADINGDAY-PARAMS'] });
    });

    it('should warn on time_tradingday with invalid time parameter', () => {
      const code = `//@version=6
indicator("Time Trading Day Time Test")

// Invalid time parameter
trading_day = time_tradingday("invalid_time")

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { warnings: ['PSV6-TIME-TRADINGDAY-TIME'] });
    });
  });

  describe('PSV6-TIMESTAMP: timestamp() Function Validation', () => {
    it('should validate correct timestamp usage', () => {
      const code = `//@version=6
indicator("Timestamp Test")

// Valid timestamp usage
ts = timestamp(2024, 1, 1, 9, 30, 0)
ts_tz = timestamp(2024, 1, 1, 9, 30, 0, "UTC")

plot(close)`;
      
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-TIMESTAMP-INFO'] });
    });

    it('should error on timestamp with insufficient parameters', () => {
      const code = `//@version=6
indicator("Timestamp Error Test")

// Missing parameters
ts = timestamp(2024, 1, 1)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { errors: ['PSV6-TIMESTAMP-PARAMS'] });
    });

    it('should error on timestamp with invalid month', () => {
      const code = `//@version=6
indicator("Timestamp Month Test")

// Invalid month (13)
ts = timestamp(2024, 13, 1, 9, 30, 0)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { errors: ['PSV6-TIMESTAMP-MONTH-RANGE'] });
    });

    it('should error on timestamp with invalid day', () => {
      const code = `//@version=6
indicator("Timestamp Day Test")

// Invalid day (32)
ts = timestamp(2024, 1, 32, 9, 30, 0)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { errors: ['PSV6-TIMESTAMP-DAY-RANGE'] });
    });

    it('should error on timestamp with invalid hour', () => {
      const code = `//@version=6
indicator("Timestamp Hour Test")

// Invalid hour (25)
ts = timestamp(2024, 1, 1, 25, 30, 0)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { errors: ['PSV6-TIMESTAMP-HOUR-RANGE'] });
    });

    it('should error on timestamp with invalid minute', () => {
      const code = `//@version=6
indicator("Timestamp Minute Test")

// Invalid minute (65)
ts = timestamp(2024, 1, 1, 9, 65, 0)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { errors: ['PSV6-TIMESTAMP-MINUTE-RANGE'] });
    });

    it('should error on timestamp with invalid second', () => {
      const code = `//@version=6
indicator("Timestamp Second Test")

// Invalid second (65)
ts = timestamp(2024, 1, 1, 9, 30, 65)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { errors: ['PSV6-TIMESTAMP-SECOND-RANGE'] });
    });

    it('should warn on timestamp with extreme year', () => {
      const code = `//@version=6
indicator("Timestamp Year Test")

// Extreme year
ts = timestamp(2200, 1, 1, 9, 30, 0)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { warnings: ['PSV6-TIMESTAMP-YEAR-RANGE'] });
    });
  });

  describe('PSV6-TIMENOW: timenow() Function Validation', () => {
    it('should validate correct timenow usage', () => {
      const code = `//@version=6
indicator("Timenow Test")

// Valid timenow usage
current_time = timenow

plot(close)`;
      
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should warn on timenow with parameters', () => {
      const code = `//@version=6
indicator("Timenow Params Test")

// timenow with parameters (invalid)
current_time = timenow("UTC")

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { warnings: ['PSV6-TIMENOW-NO-PARAMS'] });
    });
  });

  describe('PSV6-TIME-TIMEZONE: Timezone Validation', () => {
    it('should validate correct timezone constants', () => {
      const code = `//@version=6
indicator("Timezone Test")

// Valid timezone usage
close_utc = time_close("60", session.regular, "UTC")
close_exchange = time_close("60", session.regular, syminfo.timezone)
close_local = time_close("60", session.regular, "America/New_York")

plot(close)`;
      
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should warn on unknown timezone constants', () => {
      const code = `//@version=6
indicator("Unknown Timezone Test")

// Unknown timezone constant
close_time = time_close("60", session.regular, timezone.unknown)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { warnings: ['PSV6-TIMEZONE-INVALID'] });
    });

    it('should handle custom timezone strings', () => {
      const code = `//@version=6
indicator("Custom Timezone Test")

// Custom timezone string
close_ny = time_close("60", session.regular, "America/New_York")
close_london = time_close("60", session.regular, "Europe/London")

plot(close)`;
      
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expectHas(result, { info: ['PSV6-TIMEZONE-CUSTOM'] });
    });
  });

  describe('PSV6-TIME-SESSION: Session Validation', () => {
    it('should validate correct session constants', () => {
      const code = `//@version=6
indicator("Session Test")

// Valid session usage
close_regular = time_close("60", session.regular)
close_extended = time_close("60", session.extended)

plot(close)`;
      
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should warn on unknown session constants', () => {
      const code = `//@version=6
indicator("Unknown Session Test")

// Unknown session constant
close_time = time_close("60", session.unknown)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { warnings: ['PSV6-SESSION-UNKNOWN'] });
    });
  });

  describe('PSV6-TIME-PERFORMANCE: Performance and Best Practices', () => {
    it('should provide best practice info for good time handling', () => {
      const code = `//@version=6
indicator("Time Best Practice Test")

// Good time handling pattern
close_time = time_close("60", session.regular, "UTC")
trading_day = time_tradingday(time, "UTC")

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-TIME-BEST-PRACTICE'] });
    });

    it('should suggest timezone awareness', () => {
      const code = `//@version=6
indicator("Timezone Suggestion Test")

// Time functions without timezone
close_time = time_close("60", session.regular)
trading_day = time_tradingday(time)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-TIMEZONE-SUGGESTION'] });
    });

    it('should warn on time functions in loops', () => {
      const code = `//@version=6
indicator("Time Loop Test")

for i = 0 to 10
    ts = timestamp(2024, 1, i, 9, 30, 0)
    plot(ts)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { warnings: ['PSV6-TIME-PERF-LOOP'] });
    });

    it('should warn on many time function calls', () => {
      const code = `//@version=6
indicator("Many Time Functions Test")

// Many time function calls
${Array.from({length: 15}, (_, i) => 
  `ts${i} = timestamp(2024, 1, ${i + 1}, 9, 30, 0)`
).join('\n')}

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { warnings: ['PSV6-TIME-PERF-MANY-CALLS'] });
    });
  });

  describe('PSV6-TIME-INTEGRATION: Integration with Other Functions', () => {
    it('should handle comprehensive time/date usage', () => {
      const code = `//@version=6
indicator("Comprehensive Time Test")

// Comprehensive time handling
market_close = time_close("60", session.regular, syminfo.timezone)
trading_day = time_tradingday(time, "UTC")
specific_time = timestamp(2024, 1, 1, 9, 30, 0, "UTC")
current_time = timenow

// Time variables usage
current_hour = hour
current_minute = minute
current_day = dayofmonth

// Simple plot without complex conditions to avoid validation complexity
plot(close)`;
      
    const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('PSV6-TIMEFRAME-NAMESPACE: Timeframe helper validation', () => {
    it('should accept extended timeframe helpers', () => {
      const code = `//@version=6
indicator("Timeframe Helpers")

tfChange = timeframe.change("60")
tfSeconds = timeframe.in_seconds("60")
tfFromSeconds = timeframe.from_seconds(60)
mainPeriod = timeframe.main_period
multiplier = timeframe.multiplier
isDaily = timeframe.isdaily
isWeekly = timeframe.isweekly
isMonthly = timeframe.ismonthly
isMinutes = timeframe.isminutes
isSeconds = timeframe.isseconds
isIntraday = timeframe.isintraday
isDwm = timeframe.isdwm
isTicks = timeframe.isticks

plot(close)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
