import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { expectHas, expectLacks, expectValid } from './test-utils';

const createValidator = () => new EnhancedModularValidator({
  targetVersion: 6,
  strictMode: true,
  enablePerformanceAnalysis: true
});

describe('Syminfo Variables Validation', () => {

  describe('PSV6-SYMINFO-COMPANY: Company Information Variables', () => {
    it('should validate syminfo.employees and syminfo.shareholders usage', () => {
      const code = `//@version=6
indicator("Company Info Test")

// Test company information variables
employee_count = syminfo.employees
shareholder_count = syminfo.shareholders
plot(employee_count > 1000 ? 1 : 0)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-SYMINFO-COMPANY'] });
    });

    it('should validate shares outstanding variables', () => {
      const code = `//@version=6
indicator("Shares Outstanding Test")

// Test shares outstanding variables
float_shares = syminfo.shares_outstanding_float
total_shares = syminfo.shares_outstanding_total
float_percentage = float_shares / total_shares * 100

plot(float_percentage)`;
      
      const result = createValidator().validate(code);
      const companyInfo = result.info.filter(i => i.code === 'PSV6-SYMINFO-COMPANY');
      expect(companyInfo.length).toBeGreaterThanOrEqual(2);
    });

    it('should validate sector and industry variables', () => {
      const code = `//@version=6
indicator("Sector Industry Test")

// Test sector and industry information
sector_name = syminfo.sector
industry_name = syminfo.industry
country_code = syminfo.country

// Display in table
var info_table = table.new(position.top_right, 1, 3)
if barstate.islast
    table.cell(info_table, 0, 0, sector_name)
    table.cell(info_table, 0, 1, industry_name)
    table.cell(info_table, 0, 2, country_code)

plot(close)`;
      
      const result = createValidator().validate(code);
      const companyInfo = result.info.filter(i => i.code === 'PSV6-SYMINFO-COMPANY');
      expect(companyInfo.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('PSV6-SYMINFO-RECOMMENDATIONS: Analyst Recommendations', () => {
    it('should validate analyst recommendation variables', () => {
      const code = `//@version=6
indicator("Analyst Recommendations")

// Test analyst recommendation variables
buy_count = syminfo.recommendations_buy
strong_buy_count = syminfo.recommendations_buy_strong
sell_count = syminfo.recommendations_sell
strong_sell_count = syminfo.recommendations_sell_strong
hold_count = syminfo.recommendations_hold
total_recommendations = syminfo.recommendations_total

bullish_sentiment = (buy_count + strong_buy_count) / total_recommendations * 100
plot(bullish_sentiment)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-SYMINFO-RECOMMENDATIONS', 'PSV6-FINANCIAL-DATA-USAGE'] });
    });

    it('should validate recommendations date', () => {
      const code = `//@version=6
indicator("Recommendations Date")

// Test recommendations date
rec_date = syminfo.recommendations_date
formatted_date = str.format_time(rec_date, "yyyy-MM-dd")

if barstate.islast
    label.new(bar_index, high, "Last update: " + formatted_date)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-SYMINFO-RECOMMENDATIONS'] });
    });
  });

  describe('PSV6-SYMINFO-TARGET-PRICE: Price Target Variables', () => {
    it('should validate price target variables', () => {
      const code = `//@version=6
indicator("Price Targets")

// Test price target variables
avg_target = syminfo.target_price_average
high_target = syminfo.target_price_high
low_target = syminfo.target_price_low
median_target = syminfo.target_price_median
estimates_count = syminfo.target_price_estimates

upside_potential = (avg_target - close) / close * 100
plot(upside_potential)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-SYMINFO-TARGET-PRICE', 'PSV6-FINANCIAL-DATA-USAGE'] });
    });

    it('should validate target price date', () => {
      const code = `//@version=6
indicator("Target Price Date")

// Test target price date
target_date = syminfo.target_price_date
estimates = syminfo.target_price_estimates

if barstate.islast
    label.new(bar_index, high, str.tostring(estimates) + " estimates")

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-SYMINFO-TARGET-PRICE'] });
    });
  });

  describe('PSV6-SYMINFO-ADDITIONAL: Additional Symbol Variables', () => {
    it('should validate futures-related variables', () => {
      const code = `//@version=6
indicator("Futures Info")

// Test futures-related variables
current_contract = syminfo.current_contract
expiration = syminfo.expiration_date
min_contract = syminfo.mincontract
root_symbol = syminfo.root

is_futures = not na(current_contract)
plot(is_futures ? 1 : 0)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-SYMINFO-ADDITIONAL'] });
    });

    it('should validate volume type variable', () => {
      const code = `//@version=6
indicator("Volume Type")

// Test volume type variable
vol_type = syminfo.volumetype
is_tick_volume = vol_type == "tick"
is_base_volume = vol_type == "base"

plot(is_tick_volume ? volume : na)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-SYMINFO-ADDITIONAL'] });
    });
  });

  describe('PSV6-ADDITIONAL-CONSTANTS: Additional Built-in Constants', () => {
    it('should validate dayofweek constants', () => {
      const code = `//@version=6
indicator("Day of Week Constants")

// Test dayofweek constants
is_monday = dayofweek == dayofweek.monday
is_friday = dayofweek == dayofweek.friday
is_weekend = dayofweek == dayofweek.saturday or dayofweek == dayofweek.sunday

plot(is_weekend ? 1 : 0)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-ADDITIONAL-CONSTANT'] });
    });

    it('should validate barmerge constants', () => {
      const code = `//@version=6
indicator("Barmerge Constants")

// Test barmerge constants in request.security
security_data = request.security("AAPL", "1D", close, gaps=barmerge.gaps_on, lookahead=barmerge.lookahead_off)
plot(security_data)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-ADDITIONAL-CONSTANT'] });
    });

    it('should validate xloc and yloc constants', () => {
      const code = `//@version=6
indicator("XLoc YLoc Constants")

// Test xloc and yloc constants
if barstate.islast
    line.new(time - 86400000, low, time, high, xloc=xloc.bar_time)
    label.new(bar_index, close, "Price", yloc=yloc.price)
    label.new(bar_index - 1, na, "Above", yloc=yloc.abovebar)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-ADDITIONAL-CONSTANT'] });
    });

    it('should validate font and text formatting constants', () => {
      const code = `//@version=6
indicator("Font Text Constants")

// Test font and text formatting constants
if barstate.islast
    label.new(bar_index, high, "Default Font", text_font_family=font.family_default)
    label.new(bar_index - 1, low, "Monospace", text_font_family=font.family_monospace)
    
    // Test text formatting
    box.new(bar_index - 2, open, bar_index, close, text="Bold Text", text_formatting=text.format_bold)

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { info: ['PSV6-ADDITIONAL-CONSTANT'] });
    });
  });

  describe('PSV6-SYMINFO-INTEGRATION: Comprehensive Integration', () => {
    it('should handle comprehensive usage of all syminfo and additional constants', () => {
      const code = `//@version=6
indicator("Complete Syminfo Test", overlay=true)

// Company information
employees = syminfo.employees
sector = syminfo.sector
shares_float = syminfo.shares_outstanding_float

// Analyst data
buy_recs = syminfo.recommendations_buy
avg_target = syminfo.target_price_average

// Additional info
vol_type = syminfo.volumetype
country = syminfo.country

// Constants usage
is_monday = dayofweek == dayofweek.monday
security_data = request.security("AAPL", "1D", close, gaps=barmerge.gaps_off)

// Display comprehensive info
if barstate.islast
    var info_table = table.new(position.top_right, 2, 4)
    table.cell(info_table, 0, 0, "Employees", text_font_family=font.family_default)
    table.cell(info_table, 1, 0, str.tostring(employees))
    table.cell(info_table, 0, 1, "Sector")
    table.cell(info_table, 1, 1, sector)
    table.cell(info_table, 0, 2, "Buy Recs")
    table.cell(info_table, 1, 2, str.tostring(buy_recs))
    table.cell(info_table, 0, 3, "Avg Target")
    table.cell(info_table, 1, 3, str.tostring(avg_target))

plot(close)`;
      
      const result = createValidator().validate(code);
      expectHas(result, { 
        info: ['PSV6-SYMINFO-USAGE', 'PSV6-CONSTANTS-USAGE', 'PSV6-FINANCIAL-DATA-USAGE'] 
      });
    });

    it('should provide appropriate info for scripts without specialized syminfo variables', () => {
      const code = `//@version=6
indicator("Basic Script")

// Simple script without specialized syminfo variables
basic_info = syminfo.ticker
plot(close)`;
      
      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      // Should not have specialized syminfo info messages
      expectLacks(result, { info: ['PSV6-SYMINFO-USAGE'] });
    });
  });
});

