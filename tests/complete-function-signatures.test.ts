/**
 * Complete Function Signatures Test (TDD)
 * 
 * This test drives the implementation of 100% function signature coverage
 * by testing all 355 Pine Script functions for detailed parameter validation.
 */

import { describe, it, expect } from 'vitest';
import { BUILTIN_FUNCTIONS_V6_RULES } from '../core/constants';

// All 355 Pine Script functions that MUST have detailed signatures
const ALL_PINE_FUNCTIONS = [
  // Core functions (27)
  'color.t', 'dayofmonth', 'dayofweek', 'fill', 'fixnan', 'float', 'hline', 'hour',
  'indicator', 'input', 'input.bool', 'input.color', 'input.enum', 'input.float',
  'input.int', 'input.price', 'input.session', 'input.source', 'input.string',
  'input.symbol', 'input.text_area', 'input.time', 'input.timeframe', 'int', 'label',
  'library', 'line', 'linefill', 'max_bars_back', 'minute', 'month', 'na', 'nz',
  'plot', 'plotarrow', 'plotbar', 'plotcandle', 'plotchar', 'plotshape',
  'runtime.error', 'second', 'strategy', 'string', 'table', 'time', 'time_close',
  'timestamp', 'weekofyear', 'year',
  
  // Label functions (21)
  'label.copy', 'label.delete', 'label.get_text', 'label.get_x', 'label.get_y',
  'label.new', 'label.set_color', 'label.set_point', 'label.set_size', 'label.set_style',
  'label.set_text', 'label.set_text_font_family', 'label.set_text_formatting',
  'label.set_textalign', 'label.set_textcolor', 'label.set_tooltip', 'label.set_x',
  'label.set_xloc', 'label.set_xy', 'label.set_y', 'label.set_yloc',
  
  // Line functions (21)
  'line.copy', 'line.delete', 'line.get_price', 'line.get_x1', 'line.get_x2',
  'line.get_y1', 'line.get_y2', 'line.new', 'line.set_color', 'line.set_extend',
  'line.set_first_point', 'line.set_second_point', 'line.set_style', 'line.set_width',
  'line.set_x1', 'line.set_x2', 'line.set_xloc', 'line.set_xy1', 'line.set_xy2',
  'line.set_y1', 'line.set_y2',
  
  // Math functions (25)
  'math.abs', 'math.acos', 'math.asin', 'math.atan', 'math.avg', 'math.ceil',
  'math.cos', 'math.exp', 'math.floor', 'math.log', 'math.log10', 'math.max',
  'math.min', 'math.pow', 'math.random', 'math.round', 'math.round_to_mintick',
  'math.sign', 'math.sin', 'math.sqrt', 'math.sum', 'math.tan', 'math.todegrees',
  'math.toradians',
  
  // Technical Analysis functions (60)
  'ta.alma', 'ta.atr', 'ta.barssince', 'ta.bb', 'ta.bbw', 'ta.cci', 'ta.change',
  'ta.cmo', 'ta.cog', 'ta.correlation', 'ta.cross', 'ta.crossover', 'ta.crossunder',
  'ta.cum', 'ta.dev', 'ta.dmi', 'ta.ema', 'ta.falling', 'ta.highest', 'ta.highestbars',
  'ta.hma', 'ta.kc', 'ta.kcw', 'ta.linreg', 'ta.lowest', 'ta.lowestbars', 'ta.macd',
  'ta.max', 'ta.median', 'ta.mfi', 'ta.min', 'ta.mode', 'ta.mom',
  'ta.percentile_linear_interpolation', 'ta.percentile_nearest_rank', 'ta.percentrank',
  'ta.pivot_point_levels', 'ta.pivothigh', 'ta.pivotlow', 'ta.range', 'ta.rci',
  'ta.rising', 'ta.rma', 'ta.roc', 'ta.rsi', 'ta.sar', 'ta.sma', 'ta.stdev',
  'ta.stoch', 'ta.supertrend', 'ta.swma', 'ta.tr', 'ta.tsi', 'ta.valuewhen',
  'ta.variance', 'ta.vwap', 'ta.vwma', 'ta.wma', 'ta.wpr',
  
  // String functions (17)
  'str.contains', 'str.endswith', 'str.format', 'str.format_time', 'str.length',
  'str.lower', 'str.match', 'str.pos', 'str.repeat', 'str.replace', 'str.replace_all',
  'str.split', 'str.startswith', 'str.substring', 'str.tonumber', 'str.tostring',
  'str.trim', 'str.upper',
  
  // Request functions (10)
  'request.currency_rate', 'request.dividends', 'request.earnings', 'request.economic',
  'request.financial', 'request.quandl', 'request.security', 'request.security_lower_tf',
  'request.seed', 'request.splits',
  
  // Matrix functions (43)
  'matrix.add_col', 'matrix.add_row', 'matrix.avg', 'matrix.col', 'matrix.columns',
  'matrix.concat', 'matrix.copy', 'matrix.det', 'matrix.diff', 'matrix.eigenvalues',
  'matrix.eigenvectors', 'matrix.elements_count', 'matrix.fill', 'matrix.get',
  'matrix.inv', 'matrix.is_antidiagonal', 'matrix.is_antisymmetric', 'matrix.is_binary',
  'matrix.is_diagonal', 'matrix.is_identity', 'matrix.is_square', 'matrix.is_stochastic',
  'matrix.is_symmetric', 'matrix.is_triangular', 'matrix.is_zero', 'matrix.kron',
  'matrix.max', 'matrix.median', 'matrix.min', 'matrix.mode', 'matrix.mult',
  'matrix.new', 'matrix.pinv', 'matrix.pow', 'matrix.rank', 'matrix.remove_col',
  'matrix.remove_row', 'matrix.reshape', 'matrix.reverse', 'matrix.row',
  'matrix.rows', 'matrix.set', 'matrix.sort', 'matrix.submatrix', 'matrix.sum',
  'matrix.swap_columns', 'matrix.swap_rows', 'matrix.trace', 'matrix.transpose',
  
  // Strategy functions (46)
  'strategy.cancel', 'strategy.cancel_all', 'strategy.close', 'strategy.close_all',
  'strategy.closedtrades.commission', 'strategy.closedtrades.entry_bar_index',
  'strategy.closedtrades.entry_comment', 'strategy.closedtrades.entry_id',
  'strategy.closedtrades.entry_price', 'strategy.closedtrades.entry_time',
  'strategy.closedtrades.exit_bar_index', 'strategy.closedtrades.exit_comment',
  'strategy.closedtrades.exit_id', 'strategy.closedtrades.exit_price',
  'strategy.closedtrades.exit_time', 'strategy.closedtrades.max_drawdown',
  'strategy.closedtrades.max_drawdown_percent', 'strategy.closedtrades.max_runup',
  'strategy.closedtrades.max_runup_percent', 'strategy.closedtrades.profit',
  'strategy.closedtrades.profit_percent', 'strategy.closedtrades.size',
  'strategy.convert_to_account', 'strategy.convert_to_symbol', 'strategy.default_entry_qty',
  'strategy.entry', 'strategy.exit', 'strategy.opentrades.commission',
  'strategy.opentrades.entry_bar_index', 'strategy.opentrades.entry_comment',
  'strategy.opentrades.entry_id', 'strategy.opentrades.entry_price',
  'strategy.opentrades.entry_time', 'strategy.opentrades.max_drawdown',
  'strategy.opentrades.max_drawdown_percent', 'strategy.opentrades.max_runup',
  'strategy.opentrades.max_runup_percent', 'strategy.opentrades.profit',
  'strategy.opentrades.profit_percent', 'strategy.opentrades.size', 'strategy.order',
  'strategy.risk.allow_entry_in', 'strategy.risk.max_cons_loss_days',
  'strategy.risk.max_drawdown', 'strategy.risk.max_intraday_filled_orders',
  'strategy.risk.max_intraday_loss', 'strategy.risk.max_position_size',
  
  // Table functions (21)
  'table.cell', 'table.cell_set_bgcolor', 'table.cell_set_height', 'table.cell_set_text',
  'table.cell_set_text_color', 'table.cell_set_text_font_family',
  'table.cell_set_text_formatting', 'table.cell_set_text_halign',
  'table.cell_set_text_size', 'table.cell_set_text_valign', 'table.cell_set_tooltip',
  'table.cell_set_width', 'table.clear', 'table.delete', 'table.merge_cells',
  'table.new', 'table.set_bgcolor', 'table.set_border_color', 'table.set_border_width',
  'table.set_frame_color', 'table.set_frame_width', 'table.set_position',
  
  // Map functions (11)
  'map.clear', 'map.contains', 'map.copy', 'map.get', 'map.keys', 'map.new',
  'map.put', 'map.put_all', 'map.remove', 'map.size', 'map.values',
  
  // Linefill functions (5)
  'linefill.delete', 'linefill.get_line1', 'linefill.get_line2', 'linefill.new', 'linefill.set_color',
  
  // Polyline functions (2)
  'polyline.delete', 'polyline.new',
  
  // Ticker functions (9)
  'ticker.heikinashi', 'ticker.inherit', 'ticker.kagi', 'ticker.linebreak',
  'ticker.modify', 'ticker.new', 'ticker.pointfigure', 'ticker.renko', 'ticker.standard',
  
  // Timeframe functions (3)
  'timeframe.change', 'timeframe.from_seconds', 'timeframe.in_seconds'
];

describe('TDD: Complete Function Signatures Coverage', () => {
  
  it('MUST have 100% function signature coverage (355/355)', () => {
    const totalFunctions = ALL_PINE_FUNCTIONS.length;
    let functionsWithSignatures = 0;
    const missingSignatures: string[] = [];
    const incompleteSignatures: string[] = [];

    for (const func of ALL_PINE_FUNCTIONS) {
      const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
      
      if (!rules) {
        missingSignatures.push(func);
        continue;
      }
      
      // Check for complete signature (parameters + return type)
      if (!rules.parameters || !Array.isArray(rules.parameters)) {
        incompleteSignatures.push(`${func} - missing parameters array`);
        continue;
      }
      
      if (!rules.returnType) {
        incompleteSignatures.push(`${func} - missing return type`);
        continue;
      }
      
      // Validate parameter structure
      for (const param of rules.parameters) {
        if (!param.name || !param.type) {
          incompleteSignatures.push(`${func} - invalid parameter structure`);
          break;
        }
      }
      
      functionsWithSignatures++;
    }

    const coveragePercentage = (functionsWithSignatures / totalFunctions * 100).toFixed(2);
    
    console.log(`\n🎯 TDD Target: 100% Function Signature Coverage`);
    console.log(`📊 Current: ${functionsWithSignatures}/${totalFunctions} (${coveragePercentage}%)`);
    
    if (missingSignatures.length > 0) {
      console.log(`\n❌ Missing Signatures (${missingSignatures.length}):`);
      missingSignatures.slice(0, 20).forEach((func, i) => {
        console.log(`   ${i + 1}. ${func}`);
      });
      if (missingSignatures.length > 20) {
        console.log(`   ... and ${missingSignatures.length - 20} more`);
      }
    }
    
    if (incompleteSignatures.length > 0) {
      console.log(`\n⚠️  Incomplete Signatures (${incompleteSignatures.length}):`);
      incompleteSignatures.slice(0, 10).forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }

    // TDD Assertion: MUST achieve 100% coverage
    expect(functionsWithSignatures).toBe(totalFunctions);
    expect(missingSignatures).toHaveLength(0);
    expect(incompleteSignatures).toHaveLength(0);
  });

  it('MUST have signatures for all critical core functions', () => {
    const criticalFunctions = [
      'indicator', 'strategy', 'library', 'plot', 'input', 'na', 'nz',
      'timestamp', 'time', 'hline', 'fill'
    ];
    
    for (const func of criticalFunctions) {
      expect(BUILTIN_FUNCTIONS_V6_RULES).toHaveProperty(func);
      
      const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
      expect(rules).toHaveProperty('parameters');
      expect(rules).toHaveProperty('returnType');
      expect(Array.isArray(rules.parameters)).toBe(true);
    }
  });

  it('MUST have signatures for all input functions', () => {
    const inputFunctions = [
      'input', 'input.bool', 'input.color', 'input.enum', 'input.float',
      'input.int', 'input.price', 'input.session', 'input.source', 'input.string',
      'input.symbol', 'input.text_area', 'input.time', 'input.timeframe'
    ];
    
    for (const func of inputFunctions) {
      expect(BUILTIN_FUNCTIONS_V6_RULES).toHaveProperty(func);
      
      const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
      expect(rules.parameters).toBeDefined();
      expect(rules.returnType).toBeDefined();
      
      // First parameter should be 'defval' for all input functions
      if (func !== 'input') {
        expect(rules.parameters[0].name).toBe('defval');
        expect(rules.parameters[0].required).toBe(true);
      }
    }
  });

  it('MUST have signatures for all technical analysis functions', () => {
    const taFunctions = [
      'ta.sma', 'ta.ema', 'ta.rsi', 'ta.macd', 'ta.bb', 'ta.atr', 'ta.cci',
      'ta.stoch', 'ta.crossover', 'ta.crossunder', 'ta.highest', 'ta.lowest',
      'ta.barssince', 'ta.cross', 'ta.cum', 'ta.max', 'ta.min', 'ta.median',
      'ta.mode', 'ta.cog', 'ta.valuewhen', 'ta.pivothigh', 'ta.pivotlow'
    ];
    
    for (const func of taFunctions) {
      expect(BUILTIN_FUNCTIONS_V6_RULES).toHaveProperty(func);
      
      const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
      expect(rules.parameters).toBeDefined();
      expect(rules.returnType).toBeDefined();
    }
  });

  it('MUST have signatures for all matrix functions', () => {
    const matrixFunctions = [
      'matrix.new', 'matrix.get', 'matrix.set', 'matrix.rows', 'matrix.columns',
      'matrix.add_col', 'matrix.add_row', 'matrix.avg', 'matrix.col', 'matrix.concat',
      'matrix.copy', 'matrix.det', 'matrix.diff', 'matrix.eigenvalues', 'matrix.eigenvectors',
      'matrix.elements_count', 'matrix.fill', 'matrix.inv', 'matrix.max', 'matrix.min',
      'matrix.mult', 'matrix.rank', 'matrix.remove_col', 'matrix.remove_row',
      'matrix.reshape', 'matrix.reverse', 'matrix.row', 'matrix.sort', 'matrix.submatrix',
      'matrix.sum', 'matrix.swap_columns', 'matrix.swap_rows', 'matrix.trace', 'matrix.transpose'
    ];
    
    for (const func of matrixFunctions) {
      expect(BUILTIN_FUNCTIONS_V6_RULES).toHaveProperty(func);
      
      const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
      expect(rules.parameters).toBeDefined();
      expect(rules.returnType).toBeDefined();
    }
  });

  it('MUST have signatures for all strategy functions', () => {
    const strategyFunctions = [
      'strategy.entry', 'strategy.exit', 'strategy.order', 'strategy.close', 'strategy.cancel',
      'strategy.close_all', 'strategy.cancel_all', 'strategy.convert_to_account',
      'strategy.convert_to_symbol', 'strategy.default_entry_qty'
    ];
    
    for (const func of strategyFunctions) {
      expect(BUILTIN_FUNCTIONS_V6_RULES).toHaveProperty(func);
      
      const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
      expect(rules.parameters).toBeDefined();
      expect(rules.returnType).toBeDefined();
    }
  });

  it('MUST have signatures for all request functions', () => {
    const requestFunctions = [
      'request.security', 'request.security_lower_tf', 'request.dividends',
      'request.earnings', 'request.splits', 'request.economic', 'request.financial',
      'request.currency_rate', 'request.seed', 'request.quandl'
    ];
    
    for (const func of requestFunctions) {
      expect(BUILTIN_FUNCTIONS_V6_RULES).toHaveProperty(func);
      
      const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
      expect(rules.parameters).toBeDefined();
      expect(rules.returnType).toBeDefined();
    }
  });

  it('MUST have signatures for all drawing functions', () => {
    const drawingFunctions = [
      'label.new', 'label.set_text', 'label.delete', 'label.copy',
      'line.new', 'line.set_color', 'line.delete', 'line.copy',
      'table.new', 'table.cell', 'table.delete', 'table.clear',
      'linefill.new', 'linefill.delete', 'polyline.new', 'polyline.delete'
    ];
    
    for (const func of drawingFunctions) {
      expect(BUILTIN_FUNCTIONS_V6_RULES).toHaveProperty(func);
      
      const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
      expect(rules.parameters).toBeDefined();
      expect(rules.returnType).toBeDefined();
    }
  });

  it('MUST have signatures for all utility functions', () => {
    const utilityFunctions = [
      'timeframe.change', 'timeframe.from_seconds', 'timeframe.in_seconds',
      'ticker.new', 'ticker.modify', 'ticker.heikinashi',
      'syminfo.prefix', 'syminfo.ticker',
      'log.error', 'log.info', 'log.warning', 'runtime.error'
    ];
    
    for (const func of utilityFunctions) {
      expect(BUILTIN_FUNCTIONS_V6_RULES).toHaveProperty(func);
      
      const rules = BUILTIN_FUNCTIONS_V6_RULES[func];
      expect(rules.parameters).toBeDefined();
      expect(rules.returnType).toBeDefined();
    }
  });

  it('MUST validate parameter quality for all functions', () => {
    const validTypes = [
      'int', 'float', 'bool', 'string', 'color', 'series', 'array', 'matrix', 
      'map', 'line', 'label', 'box', 'table', 'hline', 'polyline', 'linefill', 
      'any', 'element'
    ];
    
    const validQualifiers = ['const', 'input', 'simple', 'series', 'any'];
    
    for (const [funcName, rules] of Object.entries(BUILTIN_FUNCTIONS_V6_RULES)) {
      if (rules.parameters) {
        for (const param of rules.parameters) {
          // Every parameter must have name and type
          expect(param.name).toBeDefined();
          expect(param.type).toBeDefined();
          expect(typeof param.name).toBe('string');
          expect(param.name.length).toBeGreaterThan(0);
          
          // Type must be valid
          expect(validTypes).toContain(param.type);
          
          // Qualifier must be valid if present
          if (param.qualifier) {
            expect(validQualifiers).toContain(param.qualifier);
          }
          
          // Required must be boolean if present
          if (param.hasOwnProperty('required')) {
            expect(typeof param.required).toBe('boolean');
          }
        }
      }
    }
  });

  it('should show current signature coverage statistics', () => {
    const totalExpected = ALL_PINE_FUNCTIONS.length;
    const currentCount = Object.keys(BUILTIN_FUNCTIONS_V6_RULES).length;
    const coverage = (currentCount / totalExpected * 100).toFixed(2);
    
    console.log(`\n📈 Function Signature Statistics:`);
    console.log(`   Total Expected: ${totalExpected}`);
    console.log(`   Current Count: ${currentCount}`);
    console.log(`   Coverage: ${coverage}%`);
    console.log(`   Remaining: ${totalExpected - currentCount}`);
    
    // Group missing functions by category
    const missing = ALL_PINE_FUNCTIONS.filter(func => !BUILTIN_FUNCTIONS_V6_RULES[func]);
    const missingByCategory = {
      core: missing.filter(f => !f.includes('.')),
      label: missing.filter(f => f.startsWith('label.')),
      line: missing.filter(f => f.startsWith('line.')),
      matrix: missing.filter(f => f.startsWith('matrix.')),
      strategy: missing.filter(f => f.startsWith('strategy.')),
      table: missing.filter(f => f.startsWith('table.')),
      other: missing.filter(f => f.includes('.') && !['label.', 'line.', 'matrix.', 'strategy.', 'table.'].some(prefix => f.startsWith(prefix)))
    };
    
    console.log(`\n📋 Missing by Category:`);
    Object.entries(missingByCategory).forEach(([category, functions]) => {
      if (functions.length > 0) {
        console.log(`   ${category.toUpperCase()}: ${functions.length} functions`);
      }
    });
  });
});
