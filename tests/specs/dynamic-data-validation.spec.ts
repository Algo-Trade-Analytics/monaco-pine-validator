import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicDataValidator } from '../../modules/dynamic-data-validator';
import { ValidationContext, ValidatorConfig } from '../../core/types';
import { expectHas, expectLacks } from './test-utils';

/// <reference types="vitest/globals" />

describe('Dynamic Data Validation (TDD)', () => {
  let validator: DynamicDataValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new DynamicDataValidator();
    context = {
      lines: [],
      cleanLines: [],
      rawLines: [],
      typeMap: new Map(),
      usedVars: new Set(),
      declaredVars: new Map(),
      functionNames: new Set(),
      methodNames: new Set(),
      functionParams: new Map(),
      scriptType: null,
      version: 6,
      hasVersion: true,
      firstVersionLine: 1
    };
    config = {
      targetVersion: 6,
      allowDeprecated: false,
      enableTypeChecking: true,
      enableControlFlowAnalysis: true,
      enablePerformanceAnalysis: true,
      enablePerformanceChecks: true,
      enableStyleChecks: true,
      strictMode: true,
      customRules: [],
      ignoredCodes: []
    };
  });

  describe('PSV6-REQUEST: Request Function Validation', () => {
    it('should validate correct request.security calls', () => {
      const code = `//@version=6
indicator("Request Security Test")

// Valid request.security call
data = request.security("AAPL", "1D", close)

plot(data)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on unknown request functions', () => {
      const code = `//@version=6
indicator("Unknown Request Test")

// Invalid request function
data = request.unknown("AAPL", close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-REQUEST-UNKNOWN'] });
    });

    it('should error on request.security with insufficient parameters', () => {
      const code = `//@version=6
indicator("Request Security Params Test")

// Missing parameters
data = request.security("AAPL")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-REQUEST-SECURITY-PARAMS'] });
    });

    it('should error on request.security_lower_tf with insufficient parameters', () => {
      const code = `//@version=6
indicator("Request Security Lower TF Test")

// Missing parameters
data = request.security_lower_tf("AAPL", "1D")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-REQUEST-SECURITY-LOWER-TF-PARAMS'] });
    });

    it('should error on request.currency_rate with insufficient parameters', () => {
      const code = `//@version=6
indicator("Request Currency Rate Test")

// Missing destination currency
rate = request.currency_rate("USD")

plot(rate)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-REQUEST-CURRENCY-RATE-PARAMS'] });
    });

    it('should error on request.quandl with insufficient parameters', () => {
      const code = `//@version=6
indicator("Request Quandl Test")

// Missing parameters
data = request.quandl("FRED")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-REQUEST-QUANDL-PARAMS'] });
    });
  });

  describe('PSV6-REQUEST-PERF: Performance Validation', () => {
    it('should warn on request functions in loops', () => {
      const code = `//@version=6
indicator("Request Loop Test")

for i = 0 to 10
    data = request.security("AAPL", "1D", close)
    plot(data)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-REQUEST-PERF-LOOP'] });
    });

    it('should warn on too many request functions', () => {
      const code = `//@version=6
indicator("Many Requests Test")

// Generate 15 request functions
data1 = request.security("AAPL", "1D", close)
data2 = request.security("MSFT", "1D", close)
data3 = request.security("GOOGL", "1D", close)
data4 = request.security("AMZN", "1D", close)
data5 = request.security("TSLA", "1D", close)
data6 = request.security("META", "1D", close)
data7 = request.security("NVDA", "1D", close)
data8 = request.security("NFLX", "1D", close)
data9 = request.security("AMD", "1D", close)
data10 = request.security("INTC", "1D", close)
data11 = request.security("CRM", "1D", close)
data12 = request.security("ADBE", "1D", close)
data13 = request.security("PYPL", "1D", close)
data14 = request.security("UBER", "1D", close)
data15 = request.security("SPOT", "1D", close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-REQUEST-PERF-COUNT'] });
    });
  });

  describe('PSV6-REQUEST-FORMAT: Format Validation', () => {
    it('should warn on symbol with spaces', () => {
      const code = `//@version=6
indicator("Symbol Format Test")

// Symbol with spaces
data = request.security("AAPL INC", "1D", close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-REQUEST-SYMBOL-FORMAT'] });
    });

    it('should flag malformed request.seed usage', () => {
      const code = `//@version=6
indicator("Seed Validation Test")

repo = syminfo.ticker
data = request.seed(repo, "DATA.csv", na)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-REQUEST-SEED-SOURCE', 'PSV6-REQUEST-SEED-EXT'] });
      expectHas(result, { errors: ['PSV6-REQUEST-SEED-EXPRESSION'] });
    });

    it('should warn on non-ISO currency codes', () => {
      const code = `//@version=6
indicator("Currency Rate Validation")

rate = request.currency_rate("US", "EURO", true)

plot(rate)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-REQUEST-CURRENCY-CODE'] });
    });

    it('should warn on string ignore_invalid_currency flag', () => {
      const code = `//@version=6
indicator("Currency Rate Ignore Flag")

rate = request.currency_rate("USD", "EUR", "yes")

plot(rate)`;

      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');

      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-REQUEST-CURRENCY-IGNORE'] });
    });

    it('should warn on invalid Quandl format', () => {
      const code = `//@version=6
indicator("Quandl Format Test")

// Invalid Quandl format
data = request.quandl("FRED", "GDP")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-REQUEST-QUANDL-FORMAT'] });
    });
  });

  describe('PSV6-REQUEST-ADVANCED: Advanced Request Functions', () => {
    it('should validate request.dividends with correct parameters', () => {
      const code = `//@version=6
indicator("Dividends Test")

// Valid dividends request
dividend_amount = request.dividends("AAPL", "dividends.amount")
dividend_ex_date = request.dividends("MSFT", "dividends.ex_date", barmerge.gaps_off)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on request.dividends with insufficient parameters', () => {
      const code = `//@version=6
indicator("Dividends Error Test")

// Missing field parameter
dividend_data = request.dividends("AAPL")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-REQUEST-DIVIDENDS-PARAMS'] });
    });

    it('should warn on request.dividends with invalid field', () => {
      const code = `//@version=6
indicator("Dividends Field Test")

// Invalid dividend field
dividend_data = request.dividends("AAPL", "dividends.invalid_field")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-REQUEST-DIVIDENDS-FIELD'] });
    });

    it('should validate request.splits with correct parameters', () => {
      const code = `//@version=6
indicator("Splits Test")

// Valid splits request
split_ratio = request.splits("AAPL", "splits.ratio")
split_date = request.splits("TSLA", "splits.date", barmerge.gaps_on)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on request.splits with insufficient parameters', () => {
      const code = `//@version=6
indicator("Splits Error Test")

// Missing field parameter
split_data = request.splits("AAPL")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-REQUEST-SPLITS-PARAMS'] });
    });

    it('should validate request.earnings with correct parameters', () => {
      const code = `//@version=6
indicator("Earnings Test")

// Valid earnings request
earnings_revenue = request.earnings("AAPL", "earnings.revenue")
earnings_eps = request.earnings("GOOGL", "earnings.eps", true)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on request.earnings with insufficient parameters', () => {
      const code = `//@version=6
indicator("Earnings Error Test")

// Missing field parameter
earnings_data = request.earnings("AAPL")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-REQUEST-EARNINGS-PARAMS'] });
    });

    it('should validate request.economic with correct parameters', () => {
      const code = `//@version=6
indicator("Economic Test")

// Valid economic request
us_gdp = request.economic("US", "gdp")
eu_inflation = request.economic("EU", "inflation", false)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on request.economic with insufficient parameters', () => {
      const code = `//@version=6
indicator("Economic Error Test")

// Missing field parameter
economic_data = request.economic("US")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-REQUEST-ECONOMIC-PARAMS'] });
    });

    it('should validate request.financial with correct parameters', () => {
      const code = `//@version=6
indicator("Financial Test")

// Valid financial request
total_revenue = request.financial("AAPL", "TOTAL_REVENUE", "FY")
net_income = request.financial("MSFT", "NET_INCOME", "FQ", barmerge.gaps_off)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on request.financial with insufficient parameters', () => {
      const code = `//@version=6
indicator("Financial Error Test")

// Missing period parameter
financial_data = request.financial("AAPL", "TOTAL_REVENUE")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-REQUEST-FINANCIAL-PARAMS'] });
    });
  });

  describe('PSV6-REQUEST-GAPS: Gaps Parameter Validation', () => {
    it('should validate correct gaps parameters', () => {
      const code = `//@version=6
indicator("Gaps Test")

// Valid gaps parameters
data1 = request.dividends("AAPL", "dividends.amount", barmerge.gaps_off)
data2 = request.earnings("MSFT", "earnings.revenue", barmerge.gaps_on)
data3 = request.economic("US", "gdp", true)
data4 = request.financial("GOOGL", "NET_INCOME", "FY", false)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should warn on invalid gaps parameters', () => {
      const code = `//@version=6
indicator("Invalid Gaps Test")

// Invalid gaps parameter
data = request.dividends("AAPL", "dividends.amount", "invalid_gaps")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-REQUEST-GAPS-INVALID'] });
    });

    it('should handle dynamic gaps parameters', () => {
      const code = `//@version=6
indicator("Dynamic Gaps Test")

// Dynamic gaps parameter
gaps_setting = input.bool(true, "Use Gaps")
data = request.dividends("AAPL", "dividends.amount", gaps_setting)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { info: ['PSV6-REQUEST-GAPS-DYNAMIC'] });
    });
  });

  describe('PSV6-REQUEST-SYMBOL: Enhanced Symbol Validation', () => {
    it('should validate correct symbol formats', () => {
      const code = `//@version=6
indicator("Symbol Format Test")

// Valid symbol formats
data1 = request.security("AAPL", "1D", close)
data2 = request.security("NASDAQ:MSFT", "1H", close)
data3 = request.security("BINANCE:BTCUSDT", "15m", close)
data4 = request.dividends("NYSE:IBM", "dividends.amount")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should warn on symbols with spaces', () => {
      const code = `//@version=6
indicator("Symbol Spaces Test")

// Symbol with spaces
data = request.security("AAPL INC", "1D", close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-REQUEST-SYMBOL-FORMAT'] });
    });

    it('should warn on symbols with invalid characters', () => {
      const code = `//@version=6
indicator("Symbol Chars Test")

// Symbol with invalid characters
data = request.security("AAPL@#$", "1D", close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-REQUEST-SYMBOL-CHARS'] });
    });

    it('should error on empty symbols', () => {
      const code = `//@version=6
indicator("Empty Symbol Test")

// Empty symbol
data = request.security("", "1D", close)

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { errors: ['PSV6-REQUEST-SYMBOL-EMPTY'] });
    });
  });

  describe('PSV6-REQUEST-PERFORMANCE: Advanced Performance Validation', () => {
    it('should provide info on expensive request functions', () => {
      const code = `//@version=6
indicator("Expensive Requests Test")

// Expensive request functions
earnings_data = request.earnings("AAPL", "earnings.revenue")
financial_data = request.financial("MSFT", "TOTAL_REVENUE", "FY")
economic_data = request.economic("US", "gdp")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { info: ['PSV6-REQUEST-PERFORMANCE-EXPENSIVE'] });
    });

    it('should warn on multiple advanced requests', () => {
      const code = `//@version=6
indicator("Multiple Advanced Requests Test")

// Many advanced request functions
data1 = request.dividends("AAPL", "dividends.amount")
data2 = request.splits("AAPL", "splits.ratio")
data3 = request.earnings("AAPL", "earnings.revenue")
data4 = request.economic("US", "gdp")
data5 = request.financial("AAPL", "TOTAL_REVENUE", "FY")
data6 = request.dividends("MSFT", "dividends.amount")
data7 = request.earnings("GOOGL", "earnings.eps")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expectHas(result, { warnings: ['PSV6-REQUEST-PERFORMANCE-MULTIPLE'] });
    });
  });

  describe('PSV6-REQUEST-COMPLEX: Complex Usage', () => {
    it('should handle multiple request types', () => {
      const code = `//@version=6
indicator("Multiple Requests Test")

// Different request types
security_data = request.security("AAPL", "1D", close)
security_lower_tf_data = request.security_lower_tf("AAPL", "1H", close)
dividend_data = request.dividends("AAPL", "dividends.amount")
split_data = request.splits("AAPL", "splits.ratio")
earnings_data = request.earnings("AAPL", "earnings.revenue")
economic_data = request.economic("US", "gdp")
financial_data = request.financial("AAPL", "TOTAL_REVENUE", "FY")
quandl_data = request.quandl("FRED/GDP", "value")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle request functions with complex expressions', () => {
      const code = `//@version=6
indicator("Complex Request Test")

// Complex expressions in request functions
data = request.security("AAPL", "1D", (high + low + close) / 3)
data2 = request.security_lower_tf("AAPL", "1H", ta.sma(close, 20))
earnings_avg = request.earnings("AAPL", "earnings.revenue") / 1000000

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate all advanced request functions comprehensively', () => {
      const code = `//@version=6
indicator("Comprehensive Advanced Test")

// Test all advanced functions with various parameters
dividend_amount = request.dividends("AAPL", "dividends.amount", barmerge.gaps_off)
dividend_ex_date = request.dividends("MSFT", "dividends.ex_date")

split_ratio = request.splits("TSLA", "splits.ratio", true)
split_date = request.splits("GOOGL", "splits.date")

earnings_revenue = request.earnings("AAPL", "earnings.revenue", false)
earnings_eps = request.earnings("MSFT", "earnings.eps")

us_gdp = request.economic("US", "gdp", barmerge.gaps_on)
eu_inflation = request.economic("EU", "inflation")

total_revenue = request.financial("AAPL", "TOTAL_REVENUE", "FY", barmerge.gaps_off)
net_income = request.financial("MSFT", "NET_INCOME", "FQ")

plot(close)`;
      
      context.lines = code.split('\n');
      context.cleanLines = code.split('\n');
      
      const result = validator.validate(context, config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
