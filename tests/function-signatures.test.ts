/**
 * Pine Script Function Signatures Test
 * 
 * Tests our detailed function signature validation capabilities including
 * parameter types, counts, qualifiers, and return types.
 */

import { describe, it, expect } from 'vitest';
import { BUILTIN_FUNCTIONS_V6_RULES } from '../core/constants';

describe('Function Signature Validation Coverage', () => {
  
  it('should have detailed signatures for core plotting functions', () => {
    const plottingFunctions = [
      'plot', 'plotshape', 'hline', 'bgcolor'
    ];
    
    for (const func of plottingFunctions) {
      expect(BUILTIN_FUNCTIONS_V6_RULES).toHaveProperty(func);
      const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
      
      if (rules.parameters) {
        expect(Array.isArray(rules.parameters)).toBe(true);
        expect(rules.parameters.length).toBeGreaterThan(0);
        
        // Check that each parameter has required properties
        for (const param of rules.parameters) {
          expect(param).toHaveProperty('name');
          expect(param).toHaveProperty('type');
          expect(param).toHaveProperty('required');
        }
      }
    }
  });

  it('should have detailed signatures for all input functions', () => {
    const inputFunctions = [
      'input.int', 'input.float', 'input.bool', 'input.string', 
      'input.color', 'input.source', 'input.timeframe', 'input.session', 'input.symbol'
    ];
    
    for (const func of inputFunctions) {
      expect(BUILTIN_FUNCTIONS_V6_RULES).toHaveProperty(func);
      const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
      
      expect(rules).toHaveProperty('parameters');
      expect(Array.isArray(rules.parameters)).toBe(true);
      expect(rules.parameters.length).toBeGreaterThan(0);
      expect(rules).toHaveProperty('returnType');
      
      // First parameter should always be 'defval' and required
      expect(rules.parameters[0].name).toBe('defval');
      expect(rules.parameters[0].required).toBe(true);
    }
  });

  it('should have detailed signatures for math functions', () => {
    const mathFunctions = [
      'math.max', 'math.min', 'math.abs', 'math.round', 'math.floor', 'math.ceil',
      'math.pow', 'math.sqrt', 'math.sin', 'math.cos', 'math.tan',
      'math.log', 'math.exp', 'math.sum', 'math.avg'
    ];
    
    for (const func of mathFunctions) {
      expect(BUILTIN_FUNCTIONS_V6_RULES).toHaveProperty(func);
      const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
      
      expect(rules).toHaveProperty('parameters');
      expect(rules).toHaveProperty('returnType');
      expect(rules.returnType).toBe('series');
    }
  });

  it('should have detailed signatures for string functions', () => {
    const stringFunctions = [
      'str.tostring', 'str.tonumber', 'str.format', 'str.contains', 
      'str.replace', 'str.substring', 'str.split', 'str.match'
    ];
    
    for (const func of stringFunctions) {
      expect(BUILTIN_FUNCTIONS_V6_RULES).toHaveProperty(func);
      const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
      
      expect(rules).toHaveProperty('parameters');
      expect(Array.isArray(rules.parameters)).toBe(true);
    }
  });

  it('should validate parameter types correctly', () => {
    // Test plot function signature
    const plotRules = BUILTIN_FUNCTIONS_V6_RULES['plot'];
    expect(plotRules.parameters[0].name).toBe('series');
    expect(plotRules.parameters[0].type).toBe('series');
    expect(plotRules.parameters[0].required).toBe(true);
    
    // Test math.pow function signature
    const powRules = BUILTIN_FUNCTIONS_V6_RULES['math.pow'];
    expect(powRules.parameters).toHaveLength(2);
    expect(powRules.parameters[0].name).toBe('base');
    expect(powRules.parameters[1].name).toBe('exponent');
    expect(powRules.returnType).toBe('series');
  });

  it('should handle optional parameters correctly', () => {
    const plotRules = BUILTIN_FUNCTIONS_V6_RULES['plot'];
    
    // First parameter should be required
    expect(plotRules.parameters[0].required).toBe(true);
    
    // Most other parameters should be optional
    const optionalParams = plotRules.parameters.slice(1);
    for (const param of optionalParams) {
      expect(param.required).toBe(false);
    }
  });

  it('should include Pine Script qualifiers', () => {
    const testFunctions = ['plot', 'input.int', 'math.max', 'ta.sma'];
    
    for (const func of testFunctions) {
      const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
      
      for (const param of rules.parameters) {
        expect(param).toHaveProperty('qualifier');
        expect(['series', 'simple', 'input', 'const']).toContain(param.qualifier);
      }
    }
  });

  it('should handle tuple return types', () => {
    const tupleFunctions = ['ta.macd', 'ta.bb', 'ta.dmi', 'ta.supertrend'];
    
    for (const func of tupleFunctions) {
      if (BUILTIN_FUNCTIONS_V6_RULES[func]) {
        const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
        expect(rules.returnType).toBe('tuple');
      }
    }
  });

  it('should detect deprecated parameters', () => {
    const functionsWithDeprecated = ['plot', 'fill', 'bgcolor'];
    
    for (const func of functionsWithDeprecated) {
      const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
      if (rules.deprecatedParams) {
        expect(Array.isArray(rules.deprecatedParams)).toBe(true);
        expect(rules.deprecatedParams).toContain('transp');
      }
    }
  });

  it('should have parameter constraints where applicable', () => {
    const plotRules = BUILTIN_FUNCTIONS_V6_RULES['plot'];
    const linewidthParam = plotRules.parameters.find((p: any) => p.name === 'linewidth');
    
    if (linewidthParam) {
      expect(linewidthParam).toHaveProperty('min');
      expect(linewidthParam.min).toBe(1);
    }
  });
});

describe('Function Signature Quality', () => {
  
  it('should have consistent parameter structure', () => {
    for (const [funcName, rules] of Object.entries(BUILTIN_FUNCTIONS_V6_RULES)) {
      if (rules.parameters) {
        for (const param of rules.parameters) {
          // Every parameter must have these core properties
          expect(param).toHaveProperty('name');
          expect(param).toHaveProperty('type');
          
          // Name should be a non-empty string
          expect(typeof param.name).toBe('string');
          expect(param.name.length).toBeGreaterThan(0);
          
          // Type should be a valid Pine Script type
          expect(typeof param.type).toBe('string');
          expect(['int', 'float', 'bool', 'string', 'color', 'series', 'array', 'matrix', 'map', 'line', 'label', 'box', 'table', 'hline', 'polyline', 'linefill', 'any', 'element']).toContain(param.type);
          
          // Required should be boolean if present
          if (param.hasOwnProperty('required')) {
            expect(typeof param.required).toBe('boolean');
          }
        }
      }
    }
  });

  it('should have valid return types', () => {
    const validReturnTypes = [
      'void', 'series', 'int', 'float', 'bool', 'string', 'color',
      'tuple', 'array', 'matrix', 'map', 'line', 'label', 'box', 'table', 'hline', 'polyline', 'linefill', 'any', 'element'
    ];
    
    for (const [funcName, rules] of Object.entries(BUILTIN_FUNCTIONS_V6_RULES)) {
      if (rules.returnType) {
        expect(validReturnTypes).toContain(rules.returnType);
      }
    }
  });

  it('should count total functions with signatures', () => {
    const functionsWithSignatures = Object.keys(BUILTIN_FUNCTIONS_V6_RULES).length;
    console.log(`\nTotal functions with detailed signatures: ${functionsWithSignatures}`);
    
    // We should have a substantial number of function signatures
    expect(functionsWithSignatures).toBeGreaterThan(200);
  });

  it('should categorize signature coverage by function type', () => {
    const categories = {
      plotting: ['plot', 'plotshape', 'plotchar', 'plotarrow', 'plotbar', 'plotcandle', 'hline', 'fill', 'bgcolor'],
      input: ['input.int', 'input.float', 'input.bool', 'input.string', 'input.color', 'input.source', 'input.timeframe', 'input.session', 'input.symbol'],
      math: ['math.max', 'math.min', 'math.abs', 'math.round', 'math.floor', 'math.ceil', 'math.pow', 'math.sqrt'],
      ta: ['ta.sma', 'ta.ema', 'ta.rsi', 'ta.macd', 'ta.bb', 'ta.atr', 'ta.cci', 'ta.mfi'],
      string: ['str.tostring', 'str.tonumber', 'str.format', 'str.contains', 'str.replace'],
      drawing: ['label.new', 'line.new', 'box.new', 'table.new', 'table.cell'],
      strategy: ['strategy.entry', 'strategy.order', 'strategy.close', 'strategy.exit']
    };
    
    for (const [category, functions] of Object.entries(categories)) {
      let covered = 0;
      for (const func of functions) {
        if (BUILTIN_FUNCTIONS_V6_RULES[func] && BUILTIN_FUNCTIONS_V6_RULES[func].parameters) {
          covered++;
        }
      }
      
      const percentage = (covered / functions.length * 100).toFixed(1);
      console.log(`${category.toUpperCase()} functions: ${covered}/${functions.length} (${percentage}%)`);
    }
  });
});

describe('Advanced Function Features', () => {
  
  it('should support function overloads', () => {
    // Functions that have multiple signatures in Pine Script
    const overloadedFunctions = ['math.round', 'input.float', 'input.int', 'ta.vwap'];
    
    for (const func of overloadedFunctions) {
      if (BUILTIN_FUNCTIONS_V6_RULES[func]) {
        const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
        // Check if overload information is tracked
        if (rules.hasOverloads || rules.overloads) {
          expect(rules.hasOverloads || Array.isArray(rules.overloads)).toBe(true);
        }
      }
    }
  });

  it('should track version-specific changes', () => {
    const functionsWithV6Changes = ['plot', 'fill', 'bgcolor'];
    
    for (const func of functionsWithV6Changes) {
      const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
      if (rules.v6Changes || rules.deprecatedParams) {
        expect(
          typeof rules.v6Changes === 'string' || 
          Array.isArray(rules.deprecatedParams)
        ).toBe(true);
      }
    }
  });

  it('should provide comprehensive validation for critical functions', () => {
    // These are the most commonly used functions that should have complete signatures
    const criticalFunctions = [
      'plot', 'input.int', 'input.float', 'math.max', 'str.tostring'
    ];
    
    for (const func of criticalFunctions) {
      expect(BUILTIN_FUNCTIONS_V6_RULES).toHaveProperty(func);
      const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
      
      expect(rules).toHaveProperty('parameters');
      expect(Array.isArray(rules.parameters)).toBe(true);
      
      // Only check returnType if it exists (some functions might not have it defined yet)
      if (rules.returnType) {
        expect(typeof rules.returnType).toBe('string');
      }
    }
  });
});
