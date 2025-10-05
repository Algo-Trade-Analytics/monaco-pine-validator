/**
 * Valid members of Pine Script namespaces
 * Used to detect undefined namespace properties early
 */

export const NAMESPACE_MEMBERS = {
  // Global functions and built-in variables
  'global': new Set([
    // Built-in variables
    'open', 'high', 'low', 'close', 'volume', 'hl2', 'hlc3', 'ohlc4', 'hlcc4',
    'bar_index', 'last_bar_index', 'last_bar_time', 'time_tradingday', 'timenow',
    'ask', 'bid', 'second',
    // Boolean literals
    'true', 'false',
    // Global functions
    'alert', 'alertcondition', 'plot', 'plotshape', 'plotchar', 'plotarrow', 'plotbar', 'plotcandle',
    'indicator', 'library', 'hline', 'fill', 'bgcolor', 'barcolor',
    'na', 'nz', 'fixnan', 'bool', 'int', 'float', 'string',
    'time', 'timestamp', 'time_close', 'hour', 'minute', 'dayofmonth', 'dayofweek', 'month', 'year', 'weekofyear',
    'max_bars_back'
  ]),
  
  'color': new Set([
    // Color constants
    'aqua', 'black', 'blue', 'fuchsia', 'gray', 'green', 'lime', 'maroon',
    'navy', 'olive', 'orange', 'purple', 'red', 'silver', 'teal', 'white', 'yellow',
    // Color functions
    'new', 'rgb', 'from_gradient', 'r', 'g', 'b', 't',
    // Missing members from gap analysis
    'arguments', 'signatures'
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
    'correlation', 'percentile_linear_interpolation', 'percentile_nearest_rank', 'percentrank',
    // Other
    'barssince', 'cog', 'cum', 'dmi', 'highest', 'highestbars', 'iii', 'kc', 'kcw', 'linreg',
    'lowest', 'lowestbars', 'macd', 'max', 'median', 'min', 'range', 'sar', 'supertrend', 'tr', 'valuewhen', 'vwap',
    // Missing ta members
    'mode', 'rci'
  ]),
  
  'math': new Set([
    // Basic math
    'abs', 'acos', 'asin', 'atan', 'avg', 'ceil', 'cos', 'exp', 'floor', 'log',
    'log10', 'max', 'min', 'pow', 'random', 'round', 'round_to_mintick', 'sign',
    'sin', 'sqrt', 'sum', 'tan', 'todegrees', 'toradians',
    // Constants
    'pi', 'e', 'phi', 'rphi'
  ]),
  
  'str': new Set([
    // String inspection
    'contains', 'endswith', 'startswith', 'length', 'match', 'pos',
    // String transformation
    'lower', 'upper', 'trim',
    'replace', 'replace_all', 'repeat',
    // String manipulation
    'split', 'substring', 'format', 'format_time',
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
    'percentile_linear_interpolation', 'percentile_nearest_rank',
    'percentrank',
    // Utility functions
    'join',
    // Missing array members
    'abs', 'every', 'some', 'new<type>'
  ]),
  
  'request': new Set([
    'security', 'dividends', 'earnings', 'financial', 'quandl', 'seed', 'splits',
    'economic', 'currency_rate', 'security_lower_tf'
  ]),
  
  'input': new Set([
    // Basic input types
    'bool', 'int', 'float', 'string', 'color',
    // Advanced input types
    'source', 'symbol', 'timeframe', 'session', 'time',
    'text_area', 'price',
    // Missing members from gap analysis
    'arguments', 'enum', 'signatures'
  ]),
  
  'plot': new Set([
    'style_line', 'style_linebr', 'style_stepline', 'style_steplinebr',
    'style_histogram', 'style_cross', 'style_area', 'style_areabr', 'style_columns',
    'style_circles', 'style_stepline_diamond',
    // Line styles
    'linestyle_dashed', 'linestyle_dotted', 'linestyle_solid',
    // Missing members from gap analysis
    'arguments', 'signatures'
  ]),
  
  'line': new Set([
    // Creation/deletion
    'new', 'delete', 'copy', 'all',
    // Getters
    'get_price', 'get_x1', 'get_x2', 'get_y1', 'get_y2',
    // Setters
    'set_color', 'set_extend', 'set_style', 'set_width', 
    'set_x1', 'set_x2', 'set_xy1', 'set_xy2', 'set_y1', 'set_y2', 'set_xloc',
    'set_first_point', 'set_second_point',
    // Styles
    'style_solid', 'style_dotted', 'style_dashed', 'style_arrow_left', 'style_arrow_right', 'style_arrow_both',
    // Missing members from gap analysis
    'arguments', 'signatures'
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
    'style_label_upper_right', 'style_label_center', 'style_square', 'style_diamond',
    // Missing members from gap analysis
    'arguments', 'set_point', 'set_text_font_family', 'set_text_formatting', 'signatures', 'style_text_outline'
  ]),
  
  'box': new Set([
    // Creation/deletion
    'new', 'delete', 'copy', 'all',
    // Position getters
    'get_left', 'get_right', 'get_top', 'get_bottom',
    // Position setters
    'set_left', 'set_right', 'set_top', 'set_bottom',
    'set_lefttop', 'set_rightbottom', 'set_extend', 'set_xloc',
    // Style setters
    'set_bgcolor', 'set_border_color', 'set_border_style', 'set_border_width',
    // Text setters (v6)
    'set_text', 'set_text_color', 'set_text_size',
    'set_text_halign', 'set_text_valign', 'set_text_font_family', 'set_text_wrap',
    // Missing members from gap analysis
    'arguments', 'set_bottom_right_point', 'set_text_formatting', 'set_top_left_point', 'signatures'
  ]),
  
  'table': new Set([
    // Creation/deletion
    'new', 'delete', 'clear', 'all',
    // Cell modification
    'cell', 'cell_set_bgcolor', 'cell_set_text',
    'cell_set_text_size', 'cell_set_text_font_family', 'cell_set_text_formatting',
    'cell_set_text_color', 'cell_set_text_halign', 'cell_set_text_valign',
    'cell_set_width', 'cell_set_height', 'cell_set_tooltip',
    // Table setters
    'set_bgcolor', 'set_border_color', 'set_border_width', 'set_frame_color', 
    'set_frame_width', 'set_position',
    // Missing members from gap analysis
    'arguments', 'merge_cells', 'signatures'
  ]),
  
  'strategy': new Set([
    'entry', 'exit', 'close', 'close_all', 'cancel', 'cancel_all',
    'position_size', 'position_avg_price',
    // Quantity types
    'percent_of_equity', 'fixed', 'cash',
    // Strategy properties
    'wintrades', 'losstrades', 'eventrades', 'grossprofit', 'grossloss',
    'netprofit', 'equity', 'initial_capital',
    // Strategy directions
    'long', 'short',
    // Additional strategy members
    'convert_to_account', 'convert_to_symbol', 'default_entry_qty', 'order',
    'account_currency', 'avg_losing_trade', 'avg_losing_trade_percent', 'avg_trade',
    'avg_trade_percent', 'avg_winning_trade', 'avg_winning_trade_percent',
    'max_drawdown', 'max_drawdown_percent', 'max_runup', 'max_runup_percent',
    // Missing strategy members from gap analysis
    'grossloss_percent', 'grossprofit_percent', 'margin_liquidation_price',
    'max_contracts_held_all', 'max_contracts_held_long', 'max_contracts_held_short',
    'netprofit_percent', 'openprofit', 'openprofit_percent', 'position_entry_name'
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
    // Official fundamental variables from v6 docs
    'country', 'target_price_average', 'target_price_median',
    'target_price_high', 'target_price_low', 'target_price_estimates', 'target_price_date',
    // Official recommendations from v6 docs
    'recommendations_buy', 'recommendations_buy_strong', 'recommendations_sell',
    'recommendations_sell_strong', 'recommendations_hold', 'recommendations_total', 'recommendations_date',
    // Info
    'minmove', 'pricescale', 'main_tickerid'
  ]),
  
  'timeframe': new Set([
    'period', 'multiplier', 'isdaily', 'isweekly', 'ismonthly', 'isdwm',
    'isintraday', 'isseconds', 'isminutes', 'isticks',
    'change', 'from_seconds', 'in_seconds', 'main_period'
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
    'transpose', 'pinv', 'inv', 'mult', 'pow', 'diff',
    // Statistics
    'avg', 'max', 'min', 'median', 'mode', 'sum',
    // Linear algebra
    'det', 'rank', 'trace', 'eigenvalues', 'eigenvectors', 'kron',
    // Missing members from gap analysis
    'new<type>'
  ]),
  
  'ticker': new Set([
    'new', 'standard', 'heikinashi', 'renko', 'linebreak', 'kagi', 'pointfigure',
    'modify', 'inherit'
  ]),
  
  'text': new Set([
    'align_left', 'align_center', 'align_right',
    'align_top', 'align_bottom',
    'wrap_none', 'wrap_auto',
    'format_bold', 'format_italic',
    // Missing members from gap analysis
    'format_none'
  ]),
  
  'polyline': new Set([
    'new', 'delete', 'all'
  ]),
  
  'linefill': new Set([
    'new', 'delete', 'all',
    'get_line1', 'get_line2',
    'set_color',
    // Missing members from gap analysis
    'arguments', 'signatures'
  ]),
  
  'size': new Set([
    'auto', 'tiny', 'small', 'normal', 'large', 'huge'
  ]),
  
  'display': new Set([
    'none', 'all', 'data_window', 'pane', 'price_scale', 'status_line'
  ]),
  
  'chart': new Set([
    'point.new', 'point.now', 'point.from_index', 'point.from_time', 'point.copy',
    'bg_color', 'fg_color', 'is_heikinashi', 'is_kagi', 'is_linebreak', 'is_pnf', 'is_range', 'is_renko', 'is_standard', 'left_visible_bar_time', 'right_visible_bar_time'
  ]),
  
  'chart.point': new Set([
    'new', 'now', 'from_index', 'from_time', 'copy'
  ]),
  
  'map': new Set([
    'new', 'put', 'get', 'remove', 'clear', 'size', 'keys', 'values', 'contains', 'copy',
    'put_all',
    // Missing members from gap analysis
    'new<keyType, valueType>', 'new<type,type>'
  ]),
  
  'font': new Set([
    'family_default', 'family_monospace'
  ]),
  
  'format': new Set([
    'volume', 'price', 'percent', 'inherit', 'mintick'
  ]),
  
  'barmerge': new Set([
    'gaps_off', 'gaps_on',
    'lookahead_off', 'lookahead_on'
  ]),
  
  'currency': new Set([
    'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY', 'KRW', 'INR', 'BRL', 'MXN', 'RUB', 'ZAR',
    'AED', 'ARS', 'BDT', 'BHD', 'CLP', 'COP', 'EGP', 'HKD', 'IDR', 'ILS',
    'MYR', 'PHP', 'QAR', 'SAR', 'SGD', 'THB', 'TWD', 'VND',
    // Additional currencies from gap analysis
    'CZK', 'DKK', 'HUF', 'ISK', 'KES', 'KWD', 'LKR', 'MAD', 'NGN', 'NOK',
    'PKR', 'PLN', 'RON', 'SEK', 'TRY', 'VES',
    // Final currencies
    'NONE', 'PEN', 'RSD', 'TND',
    // Cryptocurrencies (official names from Pine Script v6 docs)
    'BTC', 'ETH', 'USDT'
  ]),
  
  // Nested strategy constants
  'strategy.commission': new Set([
    'percent', 'cash_per_contract', 'cash_per_order'
  ]),
  
  'strategy.oca': new Set([
    'cancel', 'reduce', 'none'
  ]),
  
  'strategy.direction': new Set([
    'long', 'short', 'all'
  ]),
  
  'strategy.risk': new Set([
    'allow_entry_in', 'max_cons_loss_days', 'max_drawdown', 
    'max_intraday_filled_orders', 'max_intraday_loss', 'max_position_size'
  ]),
  
  // Strategy closedtrades namespace (v6)
  'strategy.closedtrades': new Set([
    'first_index',  // variable
    'commission', 'entry_bar_index', 'entry_comment', 'entry_id', 'entry_price', 'entry_time',
    'exit_bar_index', 'exit_comment', 'exit_id', 'exit_price', 'exit_time',
    'max_drawdown', 'max_drawdown_percent', 'max_runup', 'max_runup_percent',
    'profit', 'profit_percent', 'size'
  ]),
  
  // Strategy opentrades namespace (v6)
  'strategy.opentrades': new Set([
    'capital_held',  // variable
    'commission', 'entry_bar_index', 'entry_comment', 'entry_id', 'entry_price', 'entry_time',
    'max_drawdown', 'max_drawdown_percent', 'max_runup', 'max_runup_percent',
    'profit', 'profit_percent', 'size'
  ]),
  
  'dividends': new Set([
    'gross', 'net', 'future_amount', 'future_ex_date', 'future_pay_date'
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
    'xcross', 'cross', 'triangleup', 'triangledown',
    'flag', 'circle', 'arrowup', 'arrowdown', 'square', 'diamond',
    // Missing members from gap analysis
    'labeldown', 'labelup'
  ]),
  
  'position': new Set([
    'top_left', 'top_center', 'top_right',
    'middle_left', 'middle_center', 'middle_right',
    'bottom_left', 'bottom_center', 'bottom_right'
  ]),
  
  // Missing namespaces from context analysis
  'dayofweek': new Set([
    'friday', 'monday', 'saturday', 'sunday', 'thursday', 'tuesday', 'wednesday',
    // Metadata members from gap analysis
    'arguments', 'signatures', 'qualifier'
  ]),
  
  'session': new Set([
    'extended', 'regular', 'isfirstbar', 'isfirstbar_regular', 'islastbar', 'islastbar_regular',
    'ismarket', 'ispostmarket', 'ispremarket'
  ]),
  
  'earnings': new Set([
    'actual', 'estimate', 'standardized', 'future_eps', 'future_period_end_time',
    'future_revenue', 'future_time'
  ]),
  
  'adjustment': new Set([
    'dividends', 'none', 'splits'
  ]),
  
  'backadjustment': new Set([
    'inherit', 'off', 'on'
  ]),
  
  'settlement_as_close': new Set([
    'inherit', 'off', 'on'
  ]),
  
  'splits': new Set([
    'denominator', 'numerator'
  ]),
  
  'order': new Set([
    'ascending', 'descending'
  ]),
  
  'scale': new Set([
    'left', 'none', 'right'
  ]),
  
  'xloc': new Set([
    'bar_index', 'bar_time'
  ]),
  
  // Alert namespace (v6)
  'alert': new Set([
    'freq_all', 'freq_once_per_bar', 'freq_once_per_bar_close'
  ]),
  
  // Hline namespace (v6)
  'hline': new Set([
    'style_dashed', 'style_dotted', 'style_solid'
  ]),
  
  // Log namespace (v6)
  'log': new Set([
    'error', 'info', 'warning'
  ]),
  
  // Runtime namespace (v6)
  'runtime': new Set([
    'error'
  ]),
  
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

