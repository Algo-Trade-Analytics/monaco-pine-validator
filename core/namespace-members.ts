/**
 * Valid members of Pine Script namespaces
 * Used to detect undefined namespace properties early
 */

export const NAMESPACE_MEMBERS = {
  'color': new Set([
    // Color constants
    'aqua', 'black', 'blue', 'fuchsia', 'gray', 'green', 'lime', 'maroon',
    'navy', 'olive', 'orange', 'purple', 'red', 'silver', 'teal', 'white', 'yellow',
    // Color functions
    'new', 'rgb', 'from_gradient', 'r', 'g', 'b', 't'
  ]),
  
  'ta': new Set([
    // Moving averages
    'accdist', 'alma', 'ema', 'hma', 'rma', 'sma', 'swma', 'vwma', 'wma',
    // Oscillators
    'cci', 'cmo', 'mfi', 'rsi', 'stoch', 'tsi', 'wpr',
    // Momentum
    'change', 'mom', 'roc',
    // Volatility
    'atr', 'bb', 'bbw', 'dev', 'stdev', 'variance',
    // Volume
    'nvi', 'obv', 'pvi', 'pvt', 'wad', 'wvad',
    // Pivots
    'pivothigh', 'pivotlow', 'pivot_point_levels',
    // Crosses and patterns
    'cross', 'crossover', 'crossunder', 'falling', 'rising',
    // Statistics
    'correlation', 'covariance', 'percentile_linear_interpolation', 'percentile_nearest_rank', 'percentrank',
    // Other
    'barssince', 'cog', 'cum', 'dmi', 'highest', 'highestbars', 'iii', 'kc', 'kcw', 'linreg',
    'lowest', 'lowestbars', 'macd', 'max', 'median', 'min', 'range', 'sar', 'supertrend', 'tr', 'valuewhen', 'vwap'
  ]),
  
  'math': new Set([
    // Basic math
    'abs', 'acos', 'asin', 'atan', 'atan2', 'avg', 'ceil', 'cos', 'exp', 'floor', 'log',
    'log10', 'max', 'min', 'pow', 'random', 'round', 'round_to_mintick', 'sign',
    'sin', 'sqrt', 'sum', 'tan', 'todegrees', 'toradians',
    // Constants
    'pi', 'e', 'phi', 'rphi',
    // Statistics (v6)
    'median', 'mode'
  ]),
  
  'str': new Set([
    // String inspection
    'contains', 'endswith', 'startswith', 'length', 'match', 'pos',
    // String transformation
    'lower', 'upper', 'capitalize', 'trim', 'trim_left', 'trim_right',
    'replace', 'replace_all', 'repeat',
    // String manipulation
    'split', 'substring', 'format', 'format_time', 'join',
    // String conversion
    'tonumber', 'tostring'
  ]),
  
  'array': new Set([
    // Creation functions
    'new', 'new_bool', 'new_int', 'new_float', 'new_string', 'new_color',
    'new_line', 'new_label', 'new_box', 'new_table', 'new_linefill',
    'from', 'copy',
    // Access functions
    'get', 'set', 'first', 'last', 'slice',
    // Modification functions
    'push', 'pop', 'shift', 'unshift', 'insert', 'remove', 'clear', 'fill',
    'reverse', 'sort', 'sort_indices', 'concat',
    // Search functions
    'includes', 'indexof', 'lastindexof', 'binary_search', 'binary_search_leftmost',
    'binary_search_rightmost',
    // Aggregation functions
    'size', 'sum', 'avg', 'min', 'max', 'median', 'mode', 'range',
    // Statistical functions
    'variance', 'stdev', 'covariance', 'standardize',
    'percentile', 'percentile_linear_interpolation', 'percentile_nearest_rank',
    'percentrank',
    // Utility functions
    'join'
  ]),
  
  'request': new Set([
    'security', 'dividends', 'earnings', 'financial', 'quandl', 'seed', 'splits',
    'economic', 'currency_rate'
  ]),
  
  'input': new Set([
    // Basic input types
    'bool', 'int', 'float', 'string', 'color',
    // Advanced input types
    'source', 'symbol', 'timeframe', 'session', 'time',
    'text_area', 'price', 'resolution'
  ]),
  
  'plot': new Set([
    'style_line', 'style_linebr', 'style_stepline', 'style_steplinebr',
    'style_histogram', 'style_cross', 'style_area', 'style_areabr', 'style_columns',
    'style_circles', 'style_line_diamond', 'style_cross_diamond', 'style_linebreak', 'style_stepline_diamond'
  ]),
  
  'line': new Set([
    // Creation/deletion
    'new', 'delete', 'copy', 'all',
    // Getters
    'get_price', 'get_x1', 'get_x2', 'get_y1', 'get_y2',
    // Setters
    'set_color', 'set_extend', 'set_style', 'set_width', 
    'set_x1', 'set_x2', 'set_xy1', 'set_xy2', 'set_y1', 'set_y2', 'set_xloc',
    // Styles
    'style_solid', 'style_dotted', 'style_dashed', 'style_arrow_left', 'style_arrow_right', 'style_arrow_both',
    // Extend modes
    'extend_none', 'extend_right', 'extend_left', 'extend_both'
  ]),
  
  'label': new Set([
    // Creation/deletion
    'new', 'delete', 'copy', 'all',
    // Getters
    'get_x', 'get_y', 'get_text',
    // Setters
    'set_color', 'set_size', 'set_style', 'set_text', 'set_textcolor', 'set_tooltip', 'set_textalign',
    'set_x', 'set_xy', 'set_y', 'set_yloc', 'set_xloc',
    // Styles
    'style_none', 'style_xcross', 'style_cross', 'style_triangleup', 'style_triangledown',
    'style_flag', 'style_circle', 'style_arrowup', 'style_arrowdown',
    'style_label_up', 'style_label_down', 'style_label_left', 'style_label_right',
    'style_label_lower_left', 'style_label_lower_right', 'style_label_upper_left',
    'style_label_upper_right', 'style_label_center', 'style_square', 'style_diamond'
  ]),
  
  'box': new Set([
    // Creation/deletion
    'new', 'delete', 'copy', 'all',
    // Position getters
    'get_left', 'get_right', 'get_top', 'get_bottom',
    // Position setters
    'set_left', 'set_right', 'set_top', 'set_bottom',
    'set_lefttop', 'set_rightbottom', 'set_extend',
    // Style setters
    'set_bgcolor', 'set_border_color', 'set_border_style', 'set_border_width',
    // Text setters (v6)
    'set_text', 'set_text_color', 'set_text_size',
    'set_text_halign', 'set_text_valign', 'set_text_font_family', 'set_text_wrap',
    // Border styles
    'border_style_double', 'border_style_solid', 'border_style_dashed',
    // Note: box.get_text and box.set_text_font do NOT exist in Pine Script v6
    // They are intentionally excluded to catch errors
  ]),
  
  'table': new Set([
    'new', 'delete', 'clear', 'cell', 'cell_set_bgcolor', 'cell_set_text',
    'cell_set_text_color', 'cell_set_text_font_family', 'cell_set_text_halign',
    'cell_set_text_valign', 'cell_set_text_size', 'cell_set_tooltip',
    'cell_set_width', 'cell_set_height', 'set_bgcolor', 'set_border_color',
    'set_border_width', 'set_frame_color', 'set_frame_width', 'set_position',
    // Cell merge constants
    'cell_merge_horizontal', 'cell_merge_vertical', 'cell_merge_none'
  ]),
  
  'strategy': new Set([
    'entry', 'exit', 'close', 'close_all', 'cancel', 'cancel_all', 'risk',
    'opentrades', 'position_size', 'position_avg_price', 'closedtrades',
    // Quantity types
    'percent_of_equity', 'fixed', 'cash',
    // Strategy properties
    'wintrades', 'losstrades', 'eventrades', 'grossprofit', 'grossloss',
    'netprofit', 'account', 'equity', 'initial_capital',
    // Strategy directions
    'long', 'short',
    // Nested constants
    'commission', 'oca', 'direction'
  ]),
  
  'syminfo': new Set([
    'tickerid', 'ticker', 'prefix', 'root', 'currency', 'basecurrency', 'type',
    'timezone', 'session', 'mintick', 'pointvalue', 'description', 'volumetype',
    // Futures-related
    'current_contract', 'expiration_date', 'mincontract',
    // Company information
    'employees', 'shareholders', 'sector', 'industry',
    // Shares outstanding
    'shares_outstanding_float', 'shares_outstanding_total',
    // Fundamental variables
    'country', 'target_price_average', 'target_price_median', 'target_price_mode',
    'target_price_high', 'target_price_low', 'target_price_stddev', 'target_price_estimates', 'target_price_date',
    // Recommendations (both old and new naming)
    'recommendation_mean', 'recommendation_all', 'recommendation_buy',
    'recommendation_hold', 'recommendation_sell', 'recommendation_strong_buy',
    'recommendation_strong_sell', 'recommendations_buy', 'recommendations_hold',
    'recommendations_sell', 'recommendations_buy_strong', 'recommendations_sell_strong',
    'recommendations_total', 'recommendations_date',
    // Financial data
    'earnings_per_share', 'earnings_per_share_basic',
    'earnings_per_share_diluted', 'book_value', 'cash_flow_per_share',
    'current_ratio', 'debt_to_equity', 'dividend_yield', 'ebitda',
    'enterprise_value', 'enterprise_value_ebitda', 'enterprise_value_revenue',
    'gross_profit', 'gross_profit_margin', 'market_cap', 'net_income',
    'net_income_margin', 'operating_margin', 'price_to_book', 'price_to_cash_flow',
    'price_to_earnings', 'price_to_earnings_forward', 'price_to_sales',
    'quick_ratio', 'return_on_assets', 'return_on_equity', 'revenue',
    'revenue_per_share', 'total_debt', 'total_debt_to_equity', 'total_revenue',
    // Additional specialized variables
    'pe_ratio', 'beta', 'avg_volume_30d', 'contract_size', 'tick_value', 'margin_requirement'
  ]),
  
  'timeframe': new Set([
    'period', 'multiplier', 'isdaily', 'isweekly', 'ismonthly', 'isdwm',
    'isintraday', 'isseconds', 'isminutes', 'isticks'
  ]),
  
  'barstate': new Set([
    'isconfirmed', 'isfirst', 'ishistory', 'islast', 'islastconfirmedhistory',
    'isnew', 'isrealtime'
  ]),
  
  'matrix': new Set([
    // Creation
    'new', 'copy',
    // Access
    'get', 'set', 'row', 'col', 'submatrix',
    // Modification
    'add_row', 'add_col', 'remove_row', 'remove_col',
    'fill', 'swap_rows', 'swap_columns', 'reverse', 'sort',
    'reshape', 'concat',
    // Dimensions
    'rows', 'columns', 'elements_count', 'is_square', 'is_zero',
    'is_binary', 'is_identity', 'is_stochastic', 'is_symmetric',
    'is_antisymmetric', 'is_triangular', 'is_antidiagonal', 'is_diagonal',
    // Operations
    'transpose', 'pinv', 'inv', 'mult', 'pow', 'diff', 'abs', 'sqrt',
    // Statistics
    'avg', 'max', 'min', 'median', 'mode', 'sum', 'stdev', 'variance',
    'covariance', 'percentile_linear_interpolation', 'percentile_nearest_rank',
    // Linear algebra
    'det', 'rank', 'trace', 'eigenvalues', 'eigenvectors', 'kron'
  ]),
  
  'ticker': new Set([
    'new', 'standard', 'heikinashi', 'renko', 'linebreak', 'kagi', 'pointfigure',
    'modify', 'inherit'
  ]),
  
  'text': new Set([
    'align_left', 'align_center', 'align_right',
    'align_top', 'align_bottom',
    'wrap_none', 'wrap_auto',
    'format_bold', 'format_italic', 'format_normal',
    'format_bold_italic', 'format_underline', 'format_strikethrough'
  ]),
  
  'polyline': new Set([
    'new', 'delete', 'all', 'copy', 'from_line',
    'get_point', 'clear', 'set_point'
  ]),
  
  'linefill': new Set([
    'new', 'delete', 'all', 'copy',
    'get_line1', 'get_line2',
    'set_color'
  ]),
  
  'size': new Set([
    'auto', 'tiny', 'small', 'normal', 'large', 'huge'
  ]),
  
  'display': new Set([
    'none', 'all', 'data_window', 'pane', 'price_scale', 'status_line',
    'price_scale_only', 'data_window_only'
  ]),
  
  'chart': new Set([
    'point', 'point.new', 'point.now', 'point.from_index'
  ]),
  
  'chart.point': new Set([
    'new', 'now', 'from_index', 'from_time'
  ]),
  
  'map': new Set([
    'new', 'put', 'get', 'remove', 'clear', 'size', 'keys', 'values', 'contains', 'copy'
  ]),
  
  'font': new Set([
    'default', 'monospace', 'monospace_bold', 'serif', 'serif_bold', 'sans_serif', 'sans_serif_bold',
    'family_default', 'family_monospace'
  ]),
  
  'format': new Set([
    'volume', 'price', 'percent', 'date', 'time', 'inherit'
  ]),
  
  'barmerge': new Set([
    'gaps_off', 'gaps_on', 'gaps_left', 'gaps_right', 'gaps_middle',
    'lookahead_off', 'lookahead_on'
  ]),
  
  'currency': new Set([
    'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY', 'KRW', 'INR', 'BRL', 'MXN', 'RUB', 'ZAR'
  ]),
  
  // Nested strategy constants
  'strategy.commission': new Set([
    'percent', 'cash'
  ]),
  
  'strategy.oca': new Set([
    'cancel', 'reduce'
  ]),
  
  'strategy.direction': new Set([
    'long', 'short', 'all'
  ]),
  
  'dividends': new Set([
    'gross', 'net'
  ]),
  
  'extend': new Set([
    'none', 'right', 'left', 'both'
  ]),
  
  'yloc': new Set([
    'price', 'abovebar', 'belowbar'
  ]),
  
  'location': new Set([
    'abovebar', 'belowbar', 'top', 'bottom', 'absolute'
  ]),
  
  'shape': new Set([
    'none', 'xcross', 'cross', 'triangleup', 'triangledown',
    'flag', 'circle', 'arrowup', 'arrowdown', 'square', 'diamond'
  ]),
  
  'position': new Set([
    'top_left', 'top_center', 'top_right',
    'middle_left', 'middle_center', 'middle_right',
    'bottom_left', 'bottom_center', 'bottom_right'
  ])
};

/**
 * Check if a namespace member is valid
 */
export function isValidNamespaceMember(namespace: string, member: string): boolean {
  const members = NAMESPACE_MEMBERS[namespace as keyof typeof NAMESPACE_MEMBERS];
  return members ? members.has(member) : false;
}

/**
 * Get suggestions for similar members (for "did you mean?" hints)
 */
export function getSimilarMembers(namespace: string, member: string, maxSuggestions = 3): string[] {
  const members = NAMESPACE_MEMBERS[namespace as keyof typeof NAMESPACE_MEMBERS];
  if (!members) return [];
  
  const suggestions: Array<{member: string, score: number}> = [];
  
  for (const validMember of members) {
    // Simple similarity: count matching characters
    const score = calculateSimilarity(member.toLowerCase(), validMember.toLowerCase());
    suggestions.push({ member: validMember, score });
  }
  
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions)
    .filter(s => s.score > 0.3) // Only show if somewhat similar
    .map(s => s.member);
}

function calculateSimilarity(a: string, b: string): number {
  // Levenshtein distance-based similarity
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(a, b);
  return 1 - (distance / maxLen);
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

