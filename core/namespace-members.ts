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
    // Global functions
    'alert', 'alertcondition', 'plot', 'plotshape', 'plotchar', 'plotarrow', 'plotbar', 'plotcandle',
    'indicator', 'strategy', 'library', 'hline', 'fill', 'bgcolor', 'barcolor',
    'na', 'nz', 'fixnan', 'if', 'bool', 'int', 'float', 'string',
    'time', 'timestamp', 'time_close', 'hour', 'minute', 'dayofmonth', 'dayofweek', 'month', 'year', 'weekofyear',
    'max_bars_back', 'log', 'runtime'
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
    'correlation', 'covariance', 'percentile_linear_interpolation', 'percentile_nearest_rank', 'percentrank',
    // Other
    'barssince', 'cog', 'cum', 'dmi', 'highest', 'highestbars', 'iii', 'kc', 'kcw', 'linreg',
    'lowest', 'lowestbars', 'macd', 'max', 'median', 'min', 'range', 'sar', 'supertrend', 'tr', 'valuewhen', 'vwap',
    // Missing ta members
    'mode', 'rci'
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
    'text_area', 'price', 'resolution',
    // Missing members from gap analysis
    'arguments', 'enum', 'signatures'
  ]),
  
  'plot': new Set([
    'style_line', 'style_linebr', 'style_stepline', 'style_steplinebr',
    'style_histogram', 'style_cross', 'style_area', 'style_areabr', 'style_columns',
    'style_circles', 'style_line_diamond', 'style_cross_diamond', 'style_linebreak', 'style_stepline_diamond',
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
    // Styles
    'style_solid', 'style_dotted', 'style_dashed', 'style_arrow_left', 'style_arrow_right', 'style_arrow_both',
    // Extend modes
    'extend_none', 'extend_right', 'extend_left', 'extend_both',
    // Missing members from gap analysis
    'arguments', 'set_first_point', 'signatures'
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
    'set_lefttop', 'set_rightbottom', 'set_extend',
    // Style setters
    'set_bgcolor', 'set_border_color', 'set_border_style', 'set_border_width',
    // Text setters (v6)
    'set_text', 'set_text_color', 'set_text_size',
    'set_text_halign', 'set_text_valign', 'set_text_font_family', 'set_text_wrap',
    // Border styles
    'border_style_double', 'border_style_solid', 'border_style_dashed',
    // Missing members from gap analysis
    'arguments', 'set_bottom_right_point', 'set_text_formatting', 'set_top_left_point', 'signatures',
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
    'cell_merge_horizontal', 'cell_merge_vertical', 'cell_merge_none',
    // Missing members from gap analysis
    'arguments', 'cell_set_text_formatting', 'merge_cells', 'signatures', 'all'
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
    'commission', 'oca', 'direction',
    // Additional strategy members
    'convert_to_account', 'convert_to_symbol', 'default_entry_qty', 'order',
    'account_currency', 'avg_losing_trade', 'avg_losing_trade_percent', 'avg_trade',
    'avg_trade_percent', 'avg_winning_trade', 'avg_winning_trade_percent',
    'max_consecutive_losses', 'max_consecutive_wins', 'max_drawdown',
    'max_drawdown_percent', 'max_runup', 'max_runup_percent',
    'profit_factor', 'recovery_factor', 'sharpe_ratio', 'sortino_ratio',
    'total_closed_trades', 'total_open_trades', 'total_trades',
    // Missing strategy members from gap analysis
    'grossloss_percent', 'grossprofit_percent', 'margin_liquidation_price',
    'max_contracts_held_all', 'max_contracts_held_long', 'max_contracts_held_short',
    'netprofit_percent', 'openprofit',
    // Final missing strategy members
    'arguments', 'signatures', 'openprofit_percent', 'position_entry_name'
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
    'pe_ratio', 'beta', 'avg_volume_30d', 'contract_size', 'tick_value', 'margin_requirement',
    // Missing syminfo members
    'main_tickerid', 'minmove', 'pricescale'
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
    'transpose', 'pinv', 'inv', 'mult', 'pow', 'diff', 'abs', 'sqrt',
    // Statistics
    'avg', 'max', 'min', 'median', 'mode', 'sum', 'stdev', 'variance',
    'covariance', 'percentile_linear_interpolation', 'percentile_nearest_rank',
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
    'format_bold', 'format_italic', 'format_normal',
    'format_bold_italic', 'format_underline', 'format_strikethrough',
    // Missing members from gap analysis
    'format_none'
  ]),
  
  'polyline': new Set([
    'new', 'delete', 'all', 'copy', 'from_line',
    'get_point', 'clear', 'set_point'
  ]),
  
  'linefill': new Set([
    'new', 'delete', 'all', 'copy',
    'get_line1', 'get_line2',
    'set_color',
    // Missing members from gap analysis
    'arguments', 'signatures'
  ]),
  
  'size': new Set([
    'auto', 'tiny', 'small', 'normal', 'large', 'huge'
  ]),
  
  'display': new Set([
    'none', 'all', 'data_window', 'pane', 'price_scale', 'status_line',
    'price_scale_only', 'data_window_only'
  ]),
  
  'chart': new Set([
    'point', 'point.new', 'point.now', 'point.from_index',
    'bg_color', 'fg_color', 'is_heikinashi', 'is_kagi', 'is_linebreak', 'is_pnf', 'is_range', 'is_renko', 'is_standard', 'left_visible_bar_time', 'right_visible_bar_time'
  ]),
  
  'chart.point': new Set([
    'new', 'now', 'from_index', 'from_time'
  ]),
  
  'map': new Set([
    'new', 'put', 'get', 'remove', 'clear', 'size', 'keys', 'values', 'contains', 'copy',
    'put_all',
    // Missing members from gap analysis
    'new<keyType, valueType>', 'new<type,type>'
  ]),
  
  'font': new Set([
    'default', 'monospace', 'monospace_bold', 'serif', 'serif_bold', 'sans_serif', 'sans_serif_bold',
    'family_default', 'family_monospace'
  ]),
  
  'format': new Set([
    'volume', 'price', 'percent', 'date', 'time', 'inherit', 'mintick'
  ]),
  
  'barmerge': new Set([
    'gaps_off', 'gaps_on', 'gaps_left', 'gaps_right', 'gaps_middle',
    'lookahead_off', 'lookahead_on'
  ]),
  
  'currency': new Set([
    'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY', 'KRW', 'INR', 'BRL', 'MXN', 'RUB', 'ZAR',
    'AED', 'ARS', 'BDT', 'BHD', 'CLP', 'COP', 'EGP', 'HKD', 'IDR', 'ILS',
    'MYR', 'PHP', 'QAR', 'SAR', 'SGD', 'THB', 'TWD', 'VND',
    // Additional missing currencies from gap analysis
    'CZK', 'DKK', 'HUF', 'ISK', 'KES', 'KWD', 'LKR', 'MAD', 'NGN', 'NOK',
    'PKR', 'PLN', 'RON', 'SEK', 'SZL', 'TRY', 'UAH', 'UGX', 'UYU', 'VES',
    // Final missing currencies
    'NONE', 'PEN', 'RSD', 'TND',
    'Bitcoin', 'Ethereum', 'Tether'
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
  
  'strategy.risk': new Set([
    'allow_entry_in', 'max_cons_loss_days', 'max_drawdown', 
    'max_intraday_filled_orders', 'max_intraday_loss', 'max_position_size'
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
    'none', 'xcross', 'cross', 'triangleup', 'triangledown',
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
  
  // Crypto currency namespaces
  'Bitcoin': new Set([
    'qualifier'
  ]),
  
  'Ethereum': new Set([
    'qualifier'
  ]),
  
  'Euro': new Set([
    'qualifier'
  ]),
  
  'Tether': new Set([
    'qualifier'
  ]),
  
  // Built-in variable namespaces
  'ask': new Set([
    'qualifier'
  ]),
  
  'bar_index': new Set([
    'qualifier'
  ]),
  
  'bid': new Set([
    'qualifier'
  ]),
  
  'close': new Set([
    'qualifier'
  ]),
  
  'high': new Set([
    'qualifier'
  ]),
  
  'hl2': new Set([
    'qualifier'
  ]),
  
  'hlc3': new Set([
    'qualifier'
  ]),
  
  'hlcc4': new Set([
    'qualifier'
  ]),
  
  'last_bar_index': new Set([
    'qualifier'
  ]),
  
  'last_bar_time': new Set([
    'qualifier'
  ]),
  
  'low': new Set([
    'qualifier'
  ]),
  
  'ohlc4': new Set([
    'qualifier'
  ]),
  
  'open': new Set([
    'qualifier'
  ]),
  
  'second': new Set([
    'qualifier'
  ]),
  
  'time_tradingday': new Set([
    'qualifier'
  ]),
  
  'timenow': new Set([
    'qualifier'
  ]),
  
  'volume': new Set([
    'qualifier'
  ]),
  
  // Function namespaces with signatures
  'alert': new Set([
    'arguments', 'signatures', 'freq_all', 'freq_once_per_bar', 'freq_once_per_bar_close'
  ]),
  
  'alertcondition': new Set([
    'arguments', 'signatures'
  ]),
  
  'barcolor': new Set([
    'arguments', 'signatures'
  ]),
  
  'bgcolor': new Set([
    'arguments', 'signatures'
  ]),
  
  'bool': new Set([
    'arguments', 'signatures'
  ]),
  
  'fill': new Set([
    'arguments', 'signatures'
  ]),
  
  'fixnan': new Set([
    'arguments', 'signatures'
  ]),
  
  'float': new Set([
    'arguments', 'signatures'
  ]),
  
  'hline': new Set([
    'arguments', 'signatures', 'style_dashed', 'style_dotted', 'style_solid'
  ]),
  
  'if': new Set([
    'arguments', 'signatures'
  ]),
  
  'indicator': new Set([
    'arguments', 'signatures'
  ]),
  
  'int': new Set([
    'arguments', 'signatures'
  ]),
  
  'library': new Set([
    'arguments', 'signatures'
  ]),
  
  'log': new Set([
    'error', 'info', 'warning'
  ]),
  
  'max_bars_back': new Set([
    'arguments', 'signatures'
  ]),
  
  'na': new Set([
    'arguments', 'signatures', 'qualifier'
  ]),
  
  'nz': new Set([
    'arguments', 'signatures'
  ]),
  
  'plotarrow': new Set([
    'arguments', 'signatures'
  ]),
  
  'plotbar': new Set([
    'arguments', 'signatures'
  ]),
  
  'plotcandle': new Set([
    'arguments', 'signatures'
  ]),
  
  'plotchar': new Set([
    'arguments', 'signatures'
  ]),
  
  'plotshape': new Set([
    'arguments', 'signatures'
  ]),
  
  'reopenPositionAfter': new Set([
    'arguments', 'signatures'
  ]),
  
  'runtime': new Set([
    'error'
  ]),
  
  'string': new Set([
    'arguments', 'signatures'
  ]),
  
  'time': new Set([
    'arguments', 'signatures', 'qualifier'
  ]),
  
  'time_close': new Set([
    'arguments', 'signatures', 'qualifier'
  ]),
  
  'timestamp': new Set([
    'arguments', 'signatures'
  ]),
  
  // Time-related namespaces
  'dayofmonth': new Set([
    'arguments', 'signatures', 'qualifier'
  ]),
  
  'hour': new Set([
    'arguments', 'signatures', 'qualifier'
  ]),
  
  'minute': new Set([
    'arguments', 'signatures', 'qualifier'
  ]),
  
  'month': new Set([
    'arguments', 'signatures', 'qualifier'
  ]),
  
  'weekofyear': new Set([
    'arguments', 'signatures', 'qualifier'
  ]),
  
  'year': new Set([
    'arguments', 'signatures', 'qualifier'
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

