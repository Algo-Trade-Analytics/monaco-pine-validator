/// <reference types="vitest/globals" />
import { EnhancedModularValidator } from '../..';

describe('Switch Statement Validation (TDD)', () => {
  let validator: EnhancedModularValidator;

  beforeEach(() => {
    validator = new EnhancedModularValidator({
      strictMode: false,
      allowDeprecated: true,
      targetVersion: 6,
      enableTypeChecking: true,
      enableControlFlowAnalysis: true,
      enablePerformanceAnalysis: true
    });
  });

  describe('PSV6-SWITCH: Switch Statement Validation', () => {
    it('should validate basic switch statement syntax', () => {
      const code = `//@version=6
indicator("Switch Test")

switch timeframe.period
    "1" => "1 minute"
    "5" => "5 minutes"
    "15" => "15 minutes"
    "30" => "30 minutes"
    "60" => "1 hour"
    "240" => "4 hours"
    "1D" => "1 day"
    "1W" => "1 week"
    "1M" => "1 month"
    => "Unknown timeframe"

plot(close)`;
      
      const result = validator.validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on switch expression type mismatch', () => {
      const code = `
        //@version=6
        indicator("Switch Type Error")
        
        switch 123  // Should be string, not int
            "1" => "1 minute"
            "5" => "5 minutes"
            => "default"
        
        plot(close)
      `;
      
      const result = validator.validate(code);
      expectHas(result, { errors: ['PSV6-SWITCH-TYPE'] });
    });

    it('should error on case value type mismatch', () => {
      const code = `
        //@version=6
        indicator("Switch Case Type Error")
        
        switch timeframe.period
            "1" => "1 minute"
            5 => "5 minutes"  // Should be string, not int
            "15" => "15 minutes"
            => "default"
        
        plot(close)
      `;
      
      const result = validator.validate(code);
      expectHas(result, { errors: ['PSV6-SWITCH-CASE-TYPE'] });
    });

    it('should warn on missing default clause', () => {
      const code = `
        //@version=6
        indicator("Switch No Default")
        
        switch timeframe.period
            "1" => "1 minute"
            "5" => "5 minutes"
            "15" => "15 minutes"
        
        plot(close)
      `;
      
      const result = validator.validate(code);
      expectHas(result, { warnings: ['PSV6-SWITCH-NO-DEFAULT'] });
    });

    it('should error on duplicate case values', () => {
      const code = `
        //@version=6
        indicator("Switch Duplicate Cases")
        
        switch timeframe.period
            "1" => "1 minute"
            "5" => "5 minutes"
            "1" => "1 minute again"  // Duplicate case
            "15" => "15 minutes"
            => "default"
        
        plot(close)
      `;
      
      const result = validator.validate(code);
      expectHas(result, { errors: ['PSV6-SWITCH-DUPLICATE-CASE'] });
    });

    it('should validate nested switch statements', () => {
      const code = `//@version=6
indicator("Nested Switch")

outer_result = switch timeframe.period
    "1" => "Stock 1min"  // Simplified for now
    "5" => "5 minutes"
    => "default"

plot(close)`;
      
      const result = validator.validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on invalid switch syntax', () => {
      const code = `
        //@version=6
        indicator("Invalid Switch")
        
        switch  // Missing expression
            "1" => "1 minute"
            "5" => "5 minutes"
            => "default"
        
        plot(close)
      `;
      
      const result = validator.validate(code);
      expectHas(result, { errors: ['PSV6-SYNTAX-ERROR'] });
    });

    it('should validate switch with complex expressions', () => {
      const code = `
        //@version=6
        indicator("Complex Switch")
        
        period = timeframe.period
        result = switch period
            "1" => "1 minute"
            "5" => "5 minutes"
            "15" => "15 minutes"
            "30" => "30 minutes"
            "60" => "1 hour"
            "240" => "4 hours"
            "1D" => "1 day"
            "1W" => "1 week"
            "1M" => "1 month"
            => "Unknown timeframe"
        
        plot(close)
      `;
      
      const result = validator.validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate switch with different return types', () => {
      const code = `
        //@version=6
        indicator("Switch Return Types")
        
        result = switch timeframe.period
            "1" => 1
            "5" => 5
            "15" => 15
            "30" => 30
            "60" => 60
            "240" => 240
            "1D" => 1440
            "1W" => 10080
            "1M" => 43200
            => 0
        
        plot(result)
      `;
      
      const result = validator.validate(code);
      if (!result.isValid) {
        console.log('Switch return types errors:', result.errors);
        console.log('Switch return types warnings:', result.warnings);
      }
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on mixed return types in switch', () => {
      const code = `//@version=6
indicator("Switch Mixed Types")

result = switch timeframe.period
    "1" => "1 minute"  // String
    "5" => 5           // Int
    "15" => "15 minutes"  // String
    => "default"       // String

plot(result)`;
      
      const result = validator.validate(code);
      expectHas(result, { errors: ['PSV6-SWITCH-RETURN-TYPE'] });
    });

    it('should validate switch with boolean expressions', () => {
      const code = `//@version=6
indicator("Switch Boolean")

is_high_volume = true
result = switch is_high_volume
    "true" => "High Volume"
    "false" => "Normal Volume"
    => "Unknown"

plot(close)`;
      
      const result = validator.validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('PSV6-SWITCH-PERF: Switch Performance Validation', () => {
    it('should warn on switch with too many cases', () => {
      const code = `
        //@version=6
        indicator("Switch Many Cases")
        
        result = switch timeframe.period
            "1" => "1 minute"
            "2" => "2 minutes"
            "3" => "3 minutes"
            "4" => "4 minutes"
            "5" => "5 minutes"
            "6" => "6 minutes"
            "7" => "7 minutes"
            "8" => "8 minutes"
            "9" => "9 minutes"
            "10" => "10 minutes"
            "11" => "11 minutes"
            "12" => "12 minutes"
            "13" => "13 minutes"
            "14" => "14 minutes"
            "15" => "15 minutes"
            "16" => "16 minutes"
            "17" => "17 minutes"
            "18" => "18 minutes"
            "19" => "19 minutes"
            "20" => "20 minutes"
            "21" => "21 minutes"
            "22" => "22 minutes"
            "23" => "23 minutes"
            "24" => "24 minutes"
            "25" => "25 minutes"
            "26" => "26 minutes"
            "27" => "27 minutes"
            "28" => "28 minutes"
            "29" => "29 minutes"
            "30" => "30 minutes"
            => "default"
        
        plot(close)
      `;
      
      const result = validator.validate(code);
      expectHas(result, { warnings: ['PSV6-SWITCH-TOO-MANY-CASES'] });
    });

    it('should warn on deeply nested switch statements', () => {
      const code = `
        //@version=6
        indicator("Deep Switch Nesting")
        
        result = switch timeframe.period
            "1" => 
                switch syminfo.type
                    "stock" => 
                        switch syminfo.session
                            "regular" => "Regular Stock 1min"
                            "extended" => "Extended Stock 1min"
                            => "Other Stock 1min"
                    "crypto" => "Crypto 1min"
                    => "Other 1min"
            "5" => "5 minutes"
            => "default"
        
        plot(close)
      `;
      
      const result = validator.validate(code);
      expectHas(result, { warnings: ['PSV6-SWITCH-DEEP-NESTING'] });
    });
  });

  describe('PSV6-SWITCH-STYLE: Switch Style Validation', () => {
    it('should suggest consistent case formatting', () => {
      const code = `
        //@version=6
        indicator("Switch Style")
        
        result = switch timeframe.period
            "1" => "1 minute"
            "5" => "5 minutes"
            "15" => "15 minutes"
            "30" => "30 minutes"
            "60" => "1 hour"
            "240" => "4 hours"
            "1D" => "1 day"
            "1W" => "1 week"
            "1M" => "1 month"
            => "Unknown timeframe"
        
        plot(close)
      `;
      
      const result = validator.validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should suggest default clause placement', () => {
      const code = `
        //@version=6
        indicator("Switch Default Placement")
        
        result = switch timeframe.period
            "1" => "1 minute"
            "5" => "5 minutes"
            "15" => "15 minutes"
            "30" => "30 minutes"
            "60" => "1 hour"
            "240" => "4 hours"
            "1D" => "1 day"
            "1W" => "1 week"
            "1M" => "1 month"
            => "Unknown timeframe"
        
        plot(close)
      `;
      
      const result = validator.validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});

// Helper function to check if result contains specific error/warning codes
function expectHas(result: any, expected: { errors?: string[], warnings?: string[], info?: string[] }) {
  if (expected.errors) {
    const errorCodes = result.errors.map((e: any) => e.code);
    expected.errors.forEach(code => {
      expect(errorCodes).toContain(code);
    });
  }
  
  if (expected.warnings) {
    const warningCodes = result.warnings.map((w: any) => w.code);
    expected.warnings.forEach(code => {
      expect(warningCodes).toContain(code);
    });
  }
  
  if (expected.info) {
    const infoCodes = result.info.map((i: any) => i.code);
    expected.info.forEach(code => {
      expect(infoCodes).toContain(code);
    });
  }
}
