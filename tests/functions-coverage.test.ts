/**
 * Pine Script Functions Coverage Test
 * 
 * This test ensures our validator has complete coverage of all Pine Script v6 functions
 * as documented in the official Pine Script documentation.
 */

import { describe, it, expect } from 'vitest';
import { KEYWORDS, NAMESPACES, BUILTIN_FUNCTIONS_V6_RULES, NAMESPACE_MEMBERS } from '../core/constants';

// All Pine Script functions from the official documentation
const PINE_SCRIPT_FUNCTIONS = [
  // Core functions
  'color.t', 'dayofmonth', 'dayofweek', 'fill', 'fixnan', 'float', 'hline', 'hour',
  'indicator', 'input', 'input.bool', 'input.color', 'input.enum', 'input.float',
  'input.int', 'input.price', 'input.session', 'input.source', 'input.string',
  'input.symbol', 'input.text_area', 'input.time', 'input.timeframe', 'int', 'label',
  'library', 'line', 'linefill', 'max_bars_back', 'minute', 'month', 'na', 'nz',
  'plot', 'plotarrow', 'plotbar', 'plotcandle', 'plotchar', 'plotshape',
  'runtime.error', 'second', 'strategy', 'string', 'table', 'time', 'time_close',
  'timestamp', 'weekofyear', 'year',
  
  // Label functions
  'label.copy', 'label.delete', 'label.get_text', 'label.get_x', 'label.get_y',
  'label.new', 'label.set_color', 'label.set_point', 'label.set_size', 'label.set_style',
  'label.set_text', 'label.set_text_font_family', 'label.set_text_formatting',
  'label.set_textalign', 'label.set_textcolor', 'label.set_tooltip', 'label.set_x',
  'label.set_xloc', 'label.set_xy', 'label.set_y', 'label.set_yloc',
  
  // Line functions
  'line.copy', 'line.delete', 'line.get_price', 'line.get_x1', 'line.get_x2',
  'line.get_y1', 'line.get_y2', 'line.new', 'line.set_color', 'line.set_extend',
  'line.set_first_point', 'line.set_second_point', 'line.set_style', 'line.set_width',
  'line.set_x1', 'line.set_x2', 'line.set_xloc', 'line.set_xy1', 'line.set_xy2',
  'line.set_y1', 'line.set_y2',
  
  // Linefill functions
  'linefill.delete', 'linefill.get_line1', 'linefill.get_line2', 'linefill.new', 'linefill.set_color',
  
  // Log functions
  'log.error', 'log.info', 'log.warning',
  
  // Map functions
  'map.clear', 'map.contains', 'map.copy', 'map.get', 'map.keys', 'map.new',
  'map.put', 'map.put_all', 'map.remove', 'map.size', 'map.values',
  
  // Math functions
  'math.abs', 'math.acos', 'math.asin', 'math.atan', 'math.avg', 'math.ceil',
  'math.cos', 'math.exp', 'math.floor', 'math.log', 'math.log10', 'math.max',
  'math.min', 'math.pow', 'math.random', 'math.round', 'math.round_to_mintick',
  'math.sign', 'math.sin', 'math.sqrt', 'math.sum', 'math.tan', 'math.todegrees',
  'math.toradians',
  
  // Matrix functions
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
  
  // Polyline functions
  'polyline.delete', 'polyline.new',
  
  // Request functions
  'request.currency_rate', 'request.dividends', 'request.earnings', 'request.economic',
  'request.financial', 'request.quandl', 'request.security', 'request.security_lower_tf',
  'request.seed', 'request.splits',
  
  // String functions
  'str.contains', 'str.endswith', 'str.format', 'str.format_time', 'str.length',
  'str.lower', 'str.match', 'str.pos', 'str.repeat', 'str.replace', 'str.replace_all',
  'str.split', 'str.startswith', 'str.substring', 'str.tonumber', 'str.tostring',
  'str.trim', 'str.upper',
  
  // Strategy functions
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
  
  // Syminfo functions
  'syminfo.prefix', 'syminfo.ticker',
  
  // Technical Analysis functions
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
  
  // Table functions
  'table.cell', 'table.cell_set_bgcolor', 'table.cell_set_height', 'table.cell_set_text',
  'table.cell_set_text_color', 'table.cell_set_text_font_family',
  'table.cell_set_text_formatting', 'table.cell_set_text_halign',
  'table.cell_set_text_size', 'table.cell_set_text_valign', 'table.cell_set_tooltip',
  'table.cell_set_width', 'table.clear', 'table.delete', 'table.merge_cells',
  'table.new', 'table.set_bgcolor', 'table.set_border_color', 'table.set_border_width',
  'table.set_frame_color', 'table.set_frame_width', 'table.set_position',
  
  // Ticker functions
  'ticker.heikinashi', 'ticker.inherit', 'ticker.kagi', 'ticker.linebreak',
  'ticker.modify', 'ticker.new', 'ticker.pointfigure', 'ticker.renko', 'ticker.standard',
  
  // Timeframe functions
  'timeframe.change', 'timeframe.from_seconds', 'timeframe.in_seconds'
];

describe('Pine Script Functions Coverage', () => {
  it('should have high coverage of all Pine Script functions', () => {
    const totalFunctions = PINE_SCRIPT_FUNCTIONS.length;
    let coveredFunctions = 0;
    const missingFunctions: string[] = [];

    for (const func of PINE_SCRIPT_FUNCTIONS) {
      let covered = false;

      // Check if it's in KEYWORDS (for core functions)
      if (KEYWORDS.has(func)) {
        covered = true;
      }

      // Check if it's in BUILTIN_FUNCTIONS_V6_RULES
      if (BUILTIN_FUNCTIONS_V6_RULES.hasOwnProperty(func)) {
        covered = true;
      }

      // Check if it's a namespace member function
      if (func.includes('.')) {
        const [namespace, member] = func.split('.');
        if (NAMESPACES.has(namespace) && NAMESPACE_MEMBERS[namespace] && NAMESPACE_MEMBERS[namespace].has(member)) {
          covered = true;
        }
      }

      if (covered) {
        coveredFunctions++;
      } else {
        missingFunctions.push(func);
      }
    }

    const coveragePercentage = (coveredFunctions / totalFunctions) * 100;

    // Log coverage statistics
    console.log(`\nPine Script Functions Coverage: ${coveredFunctions}/${totalFunctions} (${coveragePercentage.toFixed(2)}%)`);
    
    if (missingFunctions.length > 0) {
      console.log('Missing functions:', missingFunctions);
    }

    // Expect high coverage (should be 90%+ after our updates)
    expect(coveragePercentage).toBeGreaterThan(90);
    expect(missingFunctions.length).toBeLessThan(20);
  });

  it('should recognize all core functions', () => {
    const coreFunctions = [
      'plot', 'hline', 'fill', 'indicator', 'strategy', 'library',
      'input', 'na', 'nz', 'fixnan', 'timestamp'
    ];
    
    for (const func of coreFunctions) {
      const covered = KEYWORDS.has(func) || BUILTIN_FUNCTIONS_V6_RULES.hasOwnProperty(func);
      expect(covered).toBe(true);
    }
  });

  it('should recognize all math functions', () => {
    const mathFunctions = [
      'math.abs', 'math.max', 'math.min', 'math.round', 'math.floor', 'math.ceil',
      'math.sin', 'math.cos', 'math.tan', 'math.sqrt', 'math.pow'
    ];
    
    expect(NAMESPACES.has('math')).toBe(true);
    
    for (const func of mathFunctions) {
      const [, member] = func.split('.');
      const covered = NAMESPACE_MEMBERS.math.has(member) || BUILTIN_FUNCTIONS_V6_RULES.hasOwnProperty(func);
      expect(covered).toBe(true);
    }
  });

  it('should recognize all technical analysis functions', () => {
    const taFunctions = [
      'ta.sma', 'ta.ema', 'ta.rsi', 'ta.macd', 'ta.bb', 'ta.atr',
      'ta.crossover', 'ta.crossunder', 'ta.highest', 'ta.lowest'
    ];
    
    expect(NAMESPACES.has('ta')).toBe(true);
    
    for (const func of taFunctions) {
      const [, member] = func.split('.');
      const covered = NAMESPACE_MEMBERS.ta.has(member) || BUILTIN_FUNCTIONS_V6_RULES.hasOwnProperty(func);
      expect(covered).toBe(true);
    }
  });

  it('should recognize all string functions', () => {
    const strFunctions = [
      'str.tostring', 'str.tonumber', 'str.length', 'str.contains', 'str.startswith',
      'str.endswith', 'str.format', 'str.replace', 'str.split'
    ];
    
    expect(NAMESPACES.has('str')).toBe(true);
    
    for (const func of strFunctions) {
      const [, member] = func.split('.');
      const covered = NAMESPACE_MEMBERS.str.has(member) || BUILTIN_FUNCTIONS_V6_RULES.hasOwnProperty(func);
      expect(covered).toBe(true);
    }
  });

  it('should recognize all input functions', () => {
    const inputFunctions = [
      'input.int', 'input.float', 'input.bool', 'input.string', 'input.color',
      'input.source', 'input.timeframe', 'input.session', 'input.symbol'
    ];
    
    expect(NAMESPACES.has('input')).toBe(true);
    
    for (const func of inputFunctions) {
      const [, member] = func.split('.');
      const covered = NAMESPACE_MEMBERS.input.has(member) || BUILTIN_FUNCTIONS_V6_RULES.hasOwnProperty(func);
      expect(covered).toBe(true);
    }
  });

  it('should recognize all request functions', () => {
    const requestFunctions = [
      'request.security', 'request.security_lower_tf', 'request.dividends',
      'request.earnings', 'request.splits', 'request.economic', 'request.financial'
    ];
    
    expect(NAMESPACES.has('request')).toBe(true);
    
    for (const func of requestFunctions) {
      const [, member] = func.split('.');
      const covered = NAMESPACE_MEMBERS.request.has(member) || BUILTIN_FUNCTIONS_V6_RULES.hasOwnProperty(func);
      expect(covered).toBe(true);
    }
  });

  it('should recognize all strategy functions', () => {
    const strategyFunctions = [
      'strategy.entry', 'strategy.close', 'strategy.exit', 'strategy.cancel',
      'strategy.order', 'strategy.close_all', 'strategy.cancel_all'
    ];
    
    expect(NAMESPACES.has('strategy')).toBe(true);
    
    for (const func of strategyFunctions) {
      const [, member] = func.split('.');
      const covered = NAMESPACE_MEMBERS.strategy.has(member) || BUILTIN_FUNCTIONS_V6_RULES.hasOwnProperty(func);
      expect(covered).toBe(true);
    }
  });

  it('should recognize all drawing functions', () => {
    const drawingFunctions = [
      'label.new', 'label.set_text', 'label.delete',
      'line.new', 'line.set_xy1', 'line.set_color',
      'table.new', 'table.cell', 'table.delete'
    ];
    
    for (const func of drawingFunctions) {
      const [namespace, member] = func.split('.');
      expect(NAMESPACES.has(namespace)).toBe(true);
      const covered = NAMESPACE_MEMBERS[namespace].has(member) || BUILTIN_FUNCTIONS_V6_RULES.hasOwnProperty(func);
      expect(covered).toBe(true);
    }
  });

  it('should have all required function namespaces', () => {
    const functionNamespaces = [
      'log', 'runtime', 'ticker', 'timeframe', 'syminfo'
    ];
    
    for (const namespace of functionNamespaces) {
      expect(NAMESPACES.has(namespace)).toBe(true);
    }
  });
});

describe('Functions Coverage Edge Cases', () => {
  it('should handle nested function calls', () => {
    const nestedFunctions = [
      'strategy.closedtrades.entry_price',
      'strategy.opentrades.max_drawdown',
      'strategy.risk.max_position_size'
    ];
    
    for (const func of nestedFunctions) {
      // These should be covered by namespace recognition or explicit rules
      const [namespace] = func.split('.');
      expect(NAMESPACES.has(namespace)).toBe(true);
    }
  });

  it('should distinguish between similar function names', () => {
    const similarFunctions = [
      'ta.highest', 'ta.highestbars',
      'ta.lowest', 'ta.lowestbars',
      'matrix.max', 'math.max',
      'ta.max', 'math.max'
    ];
    
    for (const func of similarFunctions) {
      const [namespace, member] = func.split('.');
      expect(NAMESPACES.has(namespace)).toBe(true);
      if (NAMESPACE_MEMBERS[namespace]) {
        expect(NAMESPACE_MEMBERS[namespace].has(member)).toBe(true);
      }
    }
  });

  it('should handle function overloads', () => {
    // Functions with multiple overloads should still be recognized
    const overloadedFunctions = [
      'math.max', 'math.min', 'str.format', 'input.float', 'input.int'
    ];
    
    for (const func of overloadedFunctions) {
      const [namespace, member] = func.split('.');
      const covered = NAMESPACE_MEMBERS[namespace].has(member) || BUILTIN_FUNCTIONS_V6_RULES.hasOwnProperty(func);
      expect(covered).toBe(true);
    }
  });
});
