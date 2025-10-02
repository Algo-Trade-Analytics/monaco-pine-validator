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
    'accdist', 'alma', 'atr', 'barssince', 'bb', 'bbw', 'change', 'cmo', 'cog',
    'correlation', 'cross', 'crossover', 'crossunder', 'cum', 'dev', 'dmi', 'ema',
    'falling', 'highest', 'highestbars', 'hma', 'iii', 'kc', 'kcw', 'linreg',
    'lowest', 'lowestbars', 'macd', 'max', 'median', 'mfi', 'min', 'mom', 'obv',
    'percentile_linear_interpolation', 'percentile_nearest_rank', 'percentrank',
    'pivothigh', 'pivotlow', 'pvi', 'range', 'rising', 'rma', 'roc', 'rsi', 'sar',
    'sma', 'stdev', 'stoch', 'supertrend', 'swma', 'tr', 'tsi', 'valuewhen',
    'variance', 'vwap', 'vwma', 'wad', 'wma', 'wpr'
  ]),
  
  'math': new Set([
    'abs', 'acos', 'asin', 'atan', 'avg', 'ceil', 'cos', 'exp', 'floor', 'log',
    'log10', 'max', 'min', 'pow', 'random', 'round', 'round_to_mintick', 'sign',
    'sin', 'sqrt', 'sum', 'tan', 'todegrees', 'toradians'
  ]),
  
  'str': new Set([
    'contains', 'endswith', 'format', 'length', 'lower', 'match', 'pos',
    'replace', 'replace_all', 'split', 'startswith', 'substring', 'tonumber',
    'tostring', 'upper'
  ]),
  
  'array': new Set([
    'new', 'new_bool', 'new_int', 'new_float', 'new_string', 'new_color',
    'new_line', 'new_label', 'new_box', 'new_table', 'new_linefill',
    'from', 'get', 'set', 'push', 'pop', 'shift', 'unshift', 'insert', 'remove',
    'clear', 'size', 'includes', 'indexof', 'lastindexof', 'slice', 'reverse',
    'sort', 'sort_indices', 'concat', 'copy', 'fill', 'join', 'min', 'max',
    'sum', 'avg', 'variance', 'stdev', 'median', 'mode', 'range', 'percentile',
    'covariance', 'standardize', 'binary_search', 'binary_search_leftmost',
    'binary_search_rightmost'
  ]),
  
  'request': new Set([
    'security', 'dividends', 'earnings', 'financial', 'quandl', 'seed', 'splits'
  ]),
  
  'input': new Set([
    'bool', 'color', 'float', 'int', 'session', 'source', 'string', 'symbol',
    'text_area', 'time', 'timeframe'
  ]),
  
  'plot': new Set([
    'style_line', 'style_linebr', 'style_stepline', 'style_steplinebr',
    'style_histogram', 'style_cross', 'style_area', 'style_areabr', 'style_columns',
    'style_circles', 'style_line_diamond', 'style_cross_diamond'
  ]),
  
  'line': new Set([
    'new', 'delete', 'get_price', 'get_x1', 'get_x2', 'get_y1', 'get_y2',
    'set_color', 'set_extend', 'set_style', 'set_width', 'set_x1', 'set_x2',
    'set_xy1', 'set_xy2', 'set_y1', 'set_y2', 'copy', 'all', 'style_solid',
    'style_dotted', 'style_dashed', 'style_arrow_left', 'style_arrow_right',
    'style_arrow_both', 'extend_none', 'extend_right', 'extend_left', 'extend_both'
  ]),
  
  'label': new Set([
    'new', 'delete', 'copy', 'get_x', 'get_y', 'get_text', 'set_color',
    'set_size', 'set_style', 'set_text', 'set_textcolor', 'set_tooltip',
    'set_x', 'set_xy', 'set_y', 'set_yloc', 'all', 'style_none',
    'style_xcross', 'style_cross', 'style_triangleup', 'style_triangledown',
    'style_flag', 'style_circle', 'style_arrowup', 'style_arrowdown',
    'style_label_up', 'style_label_down', 'style_label_left', 'style_label_right',
    'style_label_lower_left', 'style_label_lower_right', 'style_label_upper_left',
    'style_label_upper_right', 'style_label_center', 'style_square', 'style_diamond'
  ]),
  
  'box': new Set([
    'new', 'delete', 'copy', 'get_left', 'get_right', 'get_top', 'get_bottom',
    'set_bgcolor', 'set_border_color', 'set_border_style', 'set_border_width',
    'set_extend', 'set_left', 'set_lefttop', 'set_right', 'set_rightbottom',
    'set_top', 'set_bottom', 'all'
  ]),
  
  'table': new Set([
    'new', 'delete', 'clear', 'cell', 'cell_set_bgcolor', 'cell_set_text',
    'cell_set_text_color', 'cell_set_text_font_family', 'cell_set_text_halign',
    'cell_set_text_valign', 'cell_set_text_size', 'cell_set_tooltip',
    'cell_set_width', 'cell_set_height', 'set_bgcolor', 'set_border_color',
    'set_border_width', 'set_frame_color', 'set_frame_width', 'set_position'
  ]),
  
  'strategy': new Set([
    'entry', 'exit', 'close', 'close_all', 'cancel', 'cancel_all', 'risk',
    'opentrades', 'position_size', 'position_avg_price', 'closedtrades',
    'wintrades', 'losstrades', 'eventrades', 'grossprofit', 'grossloss',
    'netprofit', 'percent_of_equity', 'account'
  ]),
  
  'syminfo': new Set([
    'tickerid', 'ticker', 'prefix', 'root', 'currency', 'basecurrency', 'type',
    'timezone', 'session', 'mintick', 'pointvalue', 'description', 'volumetype'
  ]),
  
  'timeframe': new Set([
    'period', 'multiplier', 'isdaily', 'isweekly', 'ismonthly', 'isdwm',
    'isintraday', 'isseconds', 'isminutes'
  ]),
  
  'barstate': new Set([
    'isconfirmed', 'isfirst', 'ishistory', 'islast', 'islastconfirmedhistory',
    'isnew', 'isrealtime'
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

