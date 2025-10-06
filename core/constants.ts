export { NAMESPACE_MEMBERS } from './namespace-members';
export { NAMESPACE_MEMBERS as NS_MEMBERS } from './namespace-members';

/**
 * Core constants for the modular Pine Script v6 validator
 */

// Pine Script keywords
export const KEYWORDS = new Set([
  // control
  'if','else','for','while','switch','break','continue','return','to','by',
  // decl
  'var','varip','const','type','method','import','export','as',
  // types
  'int','float','bool','string','color','line','label','box','table','array','matrix','map',
  'linefill','polyline',
  // type qualifiers
  'simple','series',
  // literals/logicals
  'true','false','na','and','or','not',
  // color constants
  'color.aqua','color.black','color.blue','color.fuchsia','color.gray','color.green','color.lime','color.maroon','color.navy','color.olive','color.orange','color.purple','color.red','color.silver','color.teal','color.white','color.yellow',
  // shape constants
  'shape.arrowdown','shape.arrowup','shape.circle','shape.cross','shape.diamond','shape.flag','shape.labeldown','shape.labelup','shape.square','shape.triangledown','shape.triangleup','shape.xcross',
  // location constants
  'location.abovebar','location.belowbar','location.top','location.bottom','location.absolute',
  // builtins/vars from docs
  'ask','bid',
  'barstate.isconfirmed','barstate.isfirst','barstate.ishistory','barstate.islast','barstate.islastconfirmedhistory','barstate.isnew','barstate.isrealtime',
  'box.all',
  'chart.point','chart.bg_color','chart.fg_color','chart.is_heikinashi','chart.is_renko','chart.is_linebreak','chart.is_kagi','chart.is_pnf','chart.is_range','chart.is_standard','chart.left_visible_bar_time','chart.right_visible_bar_time',
  'dayofmonth','dayofweek',
  'dividends.future_amount','dividends.future_ex_date','dividends.future_pay_date',
  'earnings.future_eps','earnings.future_period_end_time','earnings.future_revenue','earnings.future_time',
  'hl2','hlc3','hlcc4','ohlc4',
  'hour','minute','month','second','last_bar_time','year','weekofyear',
  'label.all', 'label.new', 'label.delete', 'label.set_xy', 'label.set_text', 'label.set_color', 'label.set_style', 'label.set_size', 'label.set_tooltip',
  'line.all', 'linefill.all',
  'linefill.new', 'linefill.set_color', 'linefill.delete', 'linefill.get_line1', 'linefill.get_line2',
  'polyline.all',
  'table.all',
  'session.isfirstbar','session.isfirstbar_regular','session.islastbar','session.islastbar_regular','session.ismarket','session.ispostmarket','session.ispremarket','session.regular','session.extended',
  'strategy.account_currency','strategy.avg_losing_trade','strategy.avg_losing_trade_percent','strategy.avg_trade','strategy.avg_trade_percent','strategy.avg_winning_trade','strategy.avg_winning_trade_percent','strategy.closedtrades','strategy.direction','strategy.equity','strategy.eventrades','strategy.grossloss','strategy.grossloss_percent','strategy.grossprofit','strategy.grossprofit_percent','strategy.initial_capital','strategy.losstrades','strategy.margin_liquidation_price','strategy.max_contracts_held_all','strategy.max_contracts_held_long','strategy.max_contracts_held_short','strategy.max_drawdown','strategy.max_drawdown_percent','strategy.max_runup','strategy.max_runup_percent','strategy.netprofit','strategy.netprofit_percent','strategy.openprofit','strategy.openprofit_percent','strategy.opentrades','strategy.position_avg_price','strategy.position_entry_name','strategy.position_size','strategy.wintrades','strategy.risk_allow_entry_in',
  'syminfo.basecurrency','syminfo.tickerid','syminfo.ticker','syminfo.main_tickerid','syminfo.currency','syminfo.description','syminfo.minmove','syminfo.mintick','syminfo.pointvalue','syminfo.pricescale','syminfo.session','syminfo.timezone','syminfo.type','syminfo.country','syminfo.sector','syminfo.industry','syminfo.employees','syminfo.shareholders','syminfo.shares_outstanding_float','syminfo.shares_outstanding_total','syminfo.current_contract','syminfo.expiration_date','syminfo.mincontract','syminfo.root','syminfo.volumetype','syminfo.recommendations_buy','syminfo.recommendations_buy_strong','syminfo.recommendations_sell','syminfo.recommendations_sell_strong','syminfo.recommendations_hold','syminfo.recommendations_total','syminfo.recommendations_date','syminfo.target_price_average','syminfo.target_price_high','syminfo.target_price_low','syminfo.target_price_median','syminfo.target_price_estimates','syminfo.target_price_date',
  // common built-in functions
  'plot','plotshape','plotchar','plotcandle','plotbar','bgcolor','hline','fill','barcolor',
  'alert','alertcondition','log','timestamp','plotarrow',
  // core functions
  'dayofmonth','dayofweek','fixnan','float','hour','indicator','input','int','label','library','line','linefill','max_bars_back','minute','month','na','nz','second','strategy','string','table','time','time_close','weekofyear','year',
  // adjustment constants
  'adjustment.dividends','adjustment.none','adjustment.splits',
  // alert constants
  'alert.freq_all','alert.freq_once_per_bar','alert.freq_once_per_bar_close',
  // backadjustment constants
  'backadjustment.inherit','backadjustment.off','backadjustment.on',
  // barmerge constants
  'barmerge.gaps_off','barmerge.gaps_on','barmerge.lookahead_off','barmerge.lookahead_on',
  // currency constants
  'currency.AED','currency.ARS','currency.AUD','currency.BDT','currency.BHD','currency.BRL','currency.BTC','currency.CAD','currency.CHF','currency.CLP','currency.CNY','currency.COP','currency.CZK','currency.DKK','currency.EGP','currency.ETH','currency.EUR','currency.GBP','currency.HKD','currency.HUF','currency.IDR','currency.ILS','currency.INR','currency.ISK','currency.JPY','currency.KES','currency.KRW','currency.KWD','currency.LKR','currency.MAD','currency.MXN','currency.MYR','currency.NGN','currency.NOK','currency.NONE','currency.NZD','currency.PEN','currency.PHP','currency.PKR','currency.PLN','currency.QAR','currency.RON','currency.RSD','currency.RUB','currency.SAR','currency.SEK','currency.SGD','currency.THB','currency.TND','currency.TRY','currency.TWD','currency.USD','currency.USDT','currency.VES','currency.VND','currency.ZAR',
  // dayofweek constants
  'dayofweek.friday','dayofweek.monday','dayofweek.saturday','dayofweek.sunday','dayofweek.thursday','dayofweek.tuesday','dayofweek.wednesday',
  // display constants
  'display.all','display.data_window','display.none','display.pane','display.price_scale','display.status_line',
  // dividends constants
  'dividends.gross','dividends.net',
  // earnings constants
  'earnings.actual','earnings.estimate','earnings.standardized',
  // extend constants
  'extend.both','extend.left','extend.none','extend.right',
  // font constants
  'font.family_default','font.family_monospace',
  // format constants
  'format.inherit','format.mintick','format.percent','format.price','format.volume',
  // hline style constants
  'hline.style_dashed','hline.style_dotted','hline.style_solid',
  // label style constants
  'label.style_arrowdown','label.style_arrowup','label.style_circle','label.style_cross','label.style_diamond','label.style_flag','label.style_label_center','label.style_label_down','label.style_label_left','label.style_label_lower_left','label.style_label_lower_right','label.style_label_right','label.style_label_up','label.style_label_upper_left','label.style_label_upper_right','label.style_none','label.style_square','label.style_text_outline','label.style_triangledown','label.style_triangleup','label.style_xcross',
  // line style constants
  'line.style_arrow_both','line.style_arrow_left','line.style_arrow_right','line.style_dashed','line.style_dotted','line.style_solid',
  // math constants
  'math.e','math.phi','math.pi','math.rphi',
  // order constants
  'order.ascending','order.descending',
  // plot constants
  'plot.linestyle_dashed','plot.linestyle_dotted','plot.linestyle_solid','plot.style_area','plot.style_areabr','plot.style_circles','plot.style_columns','plot.style_cross','plot.style_histogram','plot.style_line','plot.style_linebr','plot.style_stepline','plot.style_stepline_diamond','plot.style_steplinebr',
  // position constants
  'position.bottom_center','position.bottom_left','position.bottom_right','position.middle_center','position.middle_left','position.middle_right','position.top_center','position.top_left','position.top_right',
  // scale constants
  'scale.left','scale.none','scale.right',
  // settlement constants
  'settlement_as_close.inherit','settlement_as_close.off','settlement_as_close.on',
  // size constants
  'size.auto','size.huge','size.large','size.normal','size.small','size.tiny',
  // splits constants
  'splits.denominator','splits.numerator',
  // strategy constants
  'strategy.cash','strategy.commission.cash_per_contract','strategy.commission.cash_per_order','strategy.commission.percent','strategy.direction.all','strategy.direction.long','strategy.direction.short','strategy.fixed','strategy.long','strategy.oca.cancel','strategy.oca.none','strategy.oca.reduce','strategy.percent_of_equity','strategy.short',
  // text constants
  'text.align_bottom','text.align_center','text.align_left','text.align_right','text.align_top','text.format_bold','text.format_italic','text.format_none','text.wrap_auto','text.wrap_none',
  // xloc constants
  'xloc.bar_index','xloc.bar_time',
  // yloc constants
  'yloc.abovebar','yloc.belowbar','yloc.price',
  // roots
  'indicator','strategy','library'
]);

// Pine Script namespaces
export const NAMESPACES = new Set([
  'ta','math','str','array','matrix','map','color','line','label','box','table',
  'barstate','syminfo','timeframe','session','timezone','request','input','strategy',
  'chart', 'dividends', 'earnings', 'linefill', 'polyline',
  // additional namespaces for constants
  'adjustment','alert','backadjustment','barmerge','currency','dayofweek','display',
  'extend','font','format','hline','location','order','plot','position','scale','settlement_as_close',
  'shape','size','splits','text','xloc','yloc',
  // additional namespaces for functions
  'log','runtime','ticker','timeframe',
  // Nested strategy namespaces (v6)
  'strategy.commission', 'strategy.oca', 'strategy.direction', 'strategy.risk',
  'strategy.closedtrades', 'strategy.opentrades',
  // Nested chart namespace (v6)
  'chart.point'
]);

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const NAMESPACE_IDENTIFIER_PATTERN = '[a-zA-Z_][a-zA-Z0-9_]*';

const namespaceRoots = (() => {
  const roots = new Set<string>();
  for (const namespace of NAMESPACES) {
    const [root] = namespace.split('.');
    roots.add(root);
  }
  return Array.from(roots).sort();
})();

const namespacePatternAllowlist = new Set([
  'color',
  'ta',
  'math',
  'str',
  'array',
  'request',
  'input',
  'plot',
  'line',
  'label',
  'box',
  'table',
  'strategy',
  'syminfo',
  'timeframe',
  'barstate',
  'matrix',
  'ticker',
  'text',
  'polyline',
  'linefill',
  'size',
  'display',
  'chart',
  'map',
  'font',
  'format',
  'barmerge',
  'currency',
  'dividends',
  'extend',
  'yloc',
  'location',
  'shape',
  'position',
  'scale',
]);

const namespacePatternRoots = namespaceRoots.filter((namespace) => namespacePatternAllowlist.has(namespace));

const namespacePatternSource = `(?<!<)(?<!\\.)(?<!:)\\b(${namespacePatternRoots
  .map(escapeRegExp)
  .join('|')})(?:\\.(${NAMESPACE_IDENTIFIER_PATTERN}))?(?:\\.(${NAMESPACE_IDENTIFIER_PATTERN}))?(?!>)`;

const delegatedNamespaceRoots = (() => {
  const preferred = new Set([
    'ta',
    'math',
    'str',
    'input',
    'line',
    'label',
    'box',
    'table',
    'map',
    'strategy',
    'array',
    'matrix',
    'polyline',
  ]);
  return namespaceRoots.filter((namespace) => preferred.has(namespace));
})();

export const getNamespacePattern = (flags = 'g'): RegExp => new RegExp(namespacePatternSource, flags);

export const getDelegatedNamespaces = (): Set<string> => new Set(delegatedNamespaceRoots);


// Pseudo variables
export const PSEUDO_VARS = new Set(['time','timenow','bar_index','last_bar_index','open','high','low','close','volume','time_close','time_tradingday']);

// Historical functions that can cause lazy evaluation issues
export const HISTORICAL_FUNCTIONS = new Set([
  // TA functions
  'ta.sma', 'ta.ema', 'ta.rsi', 'ta.macd', 'ta.stoch', 'ta.atr', 'ta.bb', 'ta.highest', 'ta.lowest',
  'ta.sar', 'ta.roc', 'ta.mom', 'ta.change', 'ta.correlation', 'ta.dev', 'ta.linreg',
  'ta.percentile_linear_interpolation', 'ta.percentile_nearest_rank', 'ta.percentrank', 'ta.pivothigh',
  'ta.pivotlow', 'ta.range', 'ta.stdev', 'ta.variance', 'ta.wma', 'ta.alma', 'ta.vwma', 'ta.swma',
  'ta.rma', 'ta.hma', 'ta.tsi', 'ta.cci', 'ta.cmo', 'ta.mfi', 'ta.obv', 'ta.pvt', 'ta.nvi',
  'ta.pvi', 'ta.wad', 'ta.crossover', 'ta.crossunder', 'ta.rising', 'ta.falling',
  // Request functions
  'request.security', 'request.security_lower_tf', 'request.dividends', 'request.splits', 
  'request.earnings', 'request.economic', 'request.quandl', 'request.financial', 'request.seed',
  // Other historical functions
  'math.sum', 'math.avg'
]);

// Expensive historical functions that have significant performance impact
export const EXPENSIVE_HISTORICAL_FUNCTIONS = new Set([
  'ta.correlation', 'ta.linreg', 'ta.percentile_linear_interpolation', 'ta.percentile_nearest_rank', 'ta.percentrank', 'ta.stdev', 'ta.variance',
  'request.security', 'request.security_lower_tf', 'request.economic', 'request.financial', 'request.seed'
]);

// Strategy order limits and performance constants
export const STRATEGY_ORDER_LIMITS = {
  // v6 has no hard 9000 order cap; keep heuristic high-order threshold
  HIGH_ORDER_COUNT_THRESHOLD: 30,
  // Threshold at which we consider pyramiding excessive in a simple heuristic
  EXCESSIVE_PYRAMIDING_THRESHOLD: 5,
  MAX_ENTRIES_PER_BAR: 3
} as const;

// Strategy functions that create orders
export const STRATEGY_ORDER_FUNCTIONS = new Set([
  'strategy.entry',
  'strategy.order',
  'strategy.exit',
  'strategy.close',
  'strategy.close_all',
  'strategy.cancel',
  'strategy.cancel_all'
]);

// Expensive calculation functions that should be cached in strategy conditions
export const EXPENSIVE_CALCULATION_FUNCTIONS = new Set([
  'ta.correlation',
  'ta.linreg', 
  'ta.percentile_linear_interpolation',
  'ta.percentile_nearest_rank',
  'ta.percentrank',
  'ta.stdev',
  'ta.variance',
  // Include common moving averages/indicators that are often costly in tight loops/conditions
  'ta.sma',
  'ta.rsi',
  'math.sum',
  'math.avg'
]);

// Request limits (heuristic, configurable if needed)
export const REQUEST_LIMITS = {
  SOFT: 32,  // near limit
  HARD: 40,  // typical cap; some tiers allow higher (e.g., 64)
} as const;

// Enhanced textbox validation constants
export const TEXTBOX_LIMITS = {
  MAX_TEXT_LENGTH: 500,
  MAX_TEXTBOXES_PER_SCRIPT: 50,
  PERFORMANCE_WARNING_THRESHOLD: 15
} as const;

// Text alignment constants
export const TEXT_ALIGNMENT_CONSTANTS = new Set([
  'text.align_left',
  'text.align_center', 
  'text.align_right',
  'text.align_top',
  'text.align_middle',
  'text.align_bottom'
]);

// Text size constants
export const TEXT_SIZE_CONSTANTS = new Set([
  'size.tiny',
  'size.small',
  'size.normal',
  'size.large',
  'size.huge',
  'size.auto'
]);

// Text font constants
export const TEXT_FONT_CONSTANTS = new Set([
  'font.default',
  'font.monospace',
  // Enhanced fonts (v6 typography)
  'font.monospace_bold'
]);

// Text wrap constants
export const TEXT_WRAP_CONSTANTS = new Set([
  'text.wrap_none',
  'text.wrap_auto'
]);

// Text style constants (bold/italic/underline)
export const TEXT_STYLE_CONSTANTS = new Set([
  'text.style_normal',
  'text.style_bold',
  'text.style_italic',
  'text.style_bold_italic',
  'text.style_underline'
]);

// Enhanced box functions with text support
export const BOX_TEXT_FUNCTIONS = new Set([
  'box.set_text',
  'box.set_text_color',
  'box.set_text_size',
  'box.set_text_halign',
  'box.set_text_valign',
  'box.set_text_wrap',
  'box.set_extend',
  'box.set_left',
  'box.set_top',
  'box.set_right',
  'box.set_bottom',
  'box.set_xloc',
  'box.get_left',
  'box.get_top',
  'box.get_right',
  'box.get_bottom',
  'box.copy'
]);

// Wildcard identifiers
export const WILDCARD_IDENT = new Set(['_']);

// Regular expressions
export const IDENT = /[A-Za-z_][A-Za-z0-9_]*/;
export const QUALIFIED_IDENT = new RegExp(`${IDENT.source}(?:\\.${IDENT.source})*`, 'g');

// Version directive
export const VERSION_RE = /^\uFEFF?\s*\/\/\s*@version=(\d+)\s*$/;

// Script declaration
export const SCRIPT_START_RE = /^\s*(indicator|strategy|library)\s*\(/;

// Function declarations
export const QUALIFIED_FN_RE = new RegExp(
  `^\\s*(?:export\\s+)?(${IDENT.source}(?:\\.${IDENT.source})*)\\s*\\(([^)]*)\\)\\s*=>`
);

export const METHOD_DECL_RE = new RegExp(
  `^\\s*method\\s+(${IDENT.source})\\s*\\(([^)]*)\\)\\s*=>`
);

// Variable declarations
export const VAR_DECL_RE = new RegExp(
  `^\\s*(?:(?:var|varip|const)\\s+)?` +
  `(?:(?:${IDENT.source}(?:\\.${IDENT.source})*(?:<[^>]+>)?)\\s+(?=${IDENT.source}\\s*=))?` +
  `(${IDENT.source})\\s*=\\s*(?![=>])`
);

// Reassignment
export const VAR_REASSIGN_RE = new RegExp(`\\b(${IDENT.source})\\s*:=`);

// Compound assignment
export const COMPOUND_ASSIGN_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*([+\-*/%])=\s*(?![=])/;

// Element reassignment
export const ELEM_REASSIGN_RE = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\[[^\]]+\]\s*:=/;

// Element compound assignment
export const ELEM_COMPOUND_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\[[^\]]+\]\s*([+\-*/%])=\s*(?![=])/;

// Simple assignment
export const SIMPLE_ASSIGN_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?![=>])/;

// Tuple destructuring
export const TUPLE_DECL_RE = /^\s*\[\s*([A-Za-z0-9_.,\s]+)\s*\]\s*=/;
export const TUPLE_REASSIGN_RE = /^\s*\[\s*([A-Za-z0-9_.,\s]+)\s*\]\s*:=/;

// Plot and strategy detection
export const PLOT_CALL_RE = /\b(?:plot|bgcolor|hline|fill|barcolor|plotcandle|plotbar|plotchar|plotshape)\s*\(/;
export const STRATEGY_ANY_RE = /\bstrategy\./;

// Qualifier strength mapping
export const QUALIFIER_STRENGTH = { 'const': 1, 'input': 2, 'simple': 3, 'series': 4, 'unknown': 5 };

// Built-in function rules for v6
export const BUILTIN_FUNCTIONS_V6_RULES: Record<string, any> = {
  // Core declaration functions
  'indicator': {
    parameters: [
      { name: 'title', type: 'string', qualifier: 'const', required: true },
      { name: 'shorttitle', type: 'string', qualifier: 'const', required: false },
      { name: 'overlay', type: 'bool', qualifier: 'const', required: false },
      { name: 'format', type: 'string', qualifier: 'const', required: false },
      { name: 'precision', type: 'int', qualifier: 'const', required: false },
      { name: 'scale', type: 'string', qualifier: 'const', required: false },
      { name: 'max_bars_back', type: 'int', qualifier: 'const', required: false },
      { name: 'timeframe', type: 'string', qualifier: 'const', required: false },
      { name: 'timeframe_gaps', type: 'bool', qualifier: 'const', required: false },
      { name: 'explicit_plot_zorder', type: 'bool', qualifier: 'const', required: false },
      { name: 'max_lines_count', type: 'int', qualifier: 'const', required: false },
      { name: 'max_labels_count', type: 'int', qualifier: 'const', required: false },
      { name: 'max_boxes_count', type: 'int', qualifier: 'const', required: false },
      { name: 'calc_bars_count', type: 'int', qualifier: 'const', required: false },
      { name: 'max_polylines_count', type: 'int', qualifier: 'const', required: false },
      { name: 'dynamic_requests', type: 'bool', qualifier: 'const', required: false },
      { name: 'behind_chart', type: 'bool', qualifier: 'const', required: false }
    ],
    returnType: 'void'
  },
  'strategy': {
    parameters: [
      { name: 'title', type: 'string', qualifier: 'const', required: true },
      { name: 'shorttitle', type: 'string', qualifier: 'const', required: false },
      { name: 'overlay', type: 'bool', qualifier: 'const', required: false },
      { name: 'format', type: 'string', qualifier: 'const', required: false },
      { name: 'precision', type: 'int', qualifier: 'const', required: false },
      { name: 'scale', type: 'string', qualifier: 'const', required: false },
      { name: 'pyramiding', type: 'int', qualifier: 'const', required: false },
      { name: 'calc_on_order_fills', type: 'bool', qualifier: 'const', required: false },
      { name: 'calc_on_every_tick', type: 'bool', qualifier: 'const', required: false },
      { name: 'max_bars_back', type: 'int', qualifier: 'const', required: false },
      { name: 'backtest_fill_limits_assumption', type: 'int', qualifier: 'const', required: false },
      { name: 'default_qty_type', type: 'string', qualifier: 'const', required: false },
      { name: 'default_qty_value', type: 'float', qualifier: 'const', required: false },
      { name: 'initial_capital', type: 'float', qualifier: 'const', required: false },
      { name: 'currency', type: 'string', qualifier: 'const', required: false },
      { name: 'slippage', type: 'int', qualifier: 'const', required: false },
      { name: 'commission_type', type: 'string', qualifier: 'const', required: false },
      { name: 'commission_value', type: 'float', qualifier: 'const', required: false },
      { name: 'process_orders_on_close', type: 'bool', qualifier: 'const', required: false },
      { name: 'close_entries_rule', type: 'string', qualifier: 'const', required: false },
      { name: 'margin_long', type: 'float', qualifier: 'const', required: false },
      { name: 'margin_short', type: 'float', qualifier: 'const', required: false }
    ],
    returnType: 'void'
  },
  'library': {
    parameters: [
      { name: 'title', type: 'string', qualifier: 'const', required: true },
      { name: 'overlay', type: 'bool', qualifier: 'const', required: false },
      { name: 'dynamic_requests', type: 'bool', qualifier: 'const', required: false }
    ],
    returnType: 'void'
  },
  
  // Core utility functions
  'na': {
    parameters: [
      { name: 'x', type: 'any', qualifier: 'simple', required: true }
    ],
    returnType: 'bool',
    disallowedArgTypes: ['bool']
  },
  'nz': {
    parameters: [
      { name: 'source', type: 'any', qualifier: 'series', required: true },
      { name: 'replacement', type: 'any', qualifier: 'series', required: false }
    ],
    returnType: 'series'
  },
  'fixnan': {
    parameters: [
      { name: 'source', type: 'series', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  
  // Type casting functions
  'int': {
    parameters: [
      { name: 'x', type: 'any', qualifier: 'any', required: true }
    ],
    returnType: 'int'
  },
  'float': {
    parameters: [
      { name: 'x', type: 'any', qualifier: 'any', required: true }
    ],
    returnType: 'float'
  },
  'string': {
    parameters: [
      { name: 'x', type: 'any', qualifier: 'any', required: true }
    ],
    returnType: 'string'
  },
  'label': {
    parameters: [
      { name: 'x', type: 'any', qualifier: 'any', required: true }
    ],
    returnType: 'label'
  },
  'line': {
    parameters: [
      { name: 'x', type: 'any', qualifier: 'any', required: true }
    ],
    returnType: 'line'
  },
  'table': {
    parameters: [
      { name: 'x', type: 'any', qualifier: 'any', required: true }
    ],
    returnType: 'table'
  },
  'linefill': {
    parameters: [
      { name: 'x', type: 'any', qualifier: 'any', required: true }
    ],
    returnType: 'linefill'
  },
  
  // Time functions
  'timestamp': {
    overloads: [
      // Overload 1: timestamp(dateString)
      {
        parameters: [
          { name: 'dateString', type: 'string', qualifier: 'simple', required: true }
        ]
      },
      // Overload 2: timestamp(year, month, day, hour, minute)
      {
        parameters: [
          { name: 'year', type: 'int', qualifier: 'simple', required: true, min: 1970, max: 2100 },
          { name: 'month', type: 'int', qualifier: 'simple', required: true, min: 1, max: 12 },
          { name: 'day', type: 'int', qualifier: 'simple', required: true, min: 1, max: 31 },
          { name: 'hour', type: 'int', qualifier: 'simple', required: true, min: 0, max: 23 },
          { name: 'minute', type: 'int', qualifier: 'simple', required: true, min: 0, max: 59 }
        ]
      },
      // Overload 3: timestamp(year, month, day, hour, minute, second)
      {
        parameters: [
          { name: 'year', type: 'int', qualifier: 'simple', required: true, min: 1970, max: 2100 },
          { name: 'month', type: 'int', qualifier: 'simple', required: true, min: 1, max: 12 },
          { name: 'day', type: 'int', qualifier: 'simple', required: true, min: 1, max: 31 },
          { name: 'hour', type: 'int', qualifier: 'simple', required: true, min: 0, max: 23 },
          { name: 'minute', type: 'int', qualifier: 'simple', required: true, min: 0, max: 59 },
          { name: 'second', type: 'int', qualifier: 'simple', required: true, min: 0, max: 59 }
        ]
      },
      // Overload 4: timestamp(year, month, day, hour, minute, second, timezone)
      {
        parameters: [
          { name: 'year', type: 'int', qualifier: 'simple', required: true, min: 1970, max: 2100 },
          { name: 'month', type: 'int', qualifier: 'simple', required: true, min: 1, max: 12 },
          { name: 'day', type: 'int', qualifier: 'simple', required: true, min: 1, max: 31 },
          { name: 'hour', type: 'int', qualifier: 'simple', required: true, min: 0, max: 23 },
          { name: 'minute', type: 'int', qualifier: 'simple', required: true, min: 0, max: 59 },
          { name: 'second', type: 'int', qualifier: 'simple', required: true, min: 0, max: 59 },
          { name: 'timezone', type: 'string', qualifier: 'simple', required: true }
        ]
      }
    ],
    returnType: 'int',
    v6Changes: 'Adds timezone support plus stricter bounds for date components.'
  },
  'time': {
    parameters: [
      { name: 'timeframe', type: 'string', qualifier: 'series', required: true },
      { name: 'session', type: 'string', qualifier: 'series', required: false },
      { name: 'timezone', type: 'string', qualifier: 'series', required: false }
    ],
    returnType: 'int'
  },
  'time_close': {
    parameters: [
      { name: 'timeframe', type: 'string', qualifier: 'series', required: true },
      { name: 'session', type: 'string', qualifier: 'series', required: false },
      { name: 'timezone', type: 'any', qualifier: 'series', required: false },
      { name: 'bars_back', type: 'int', qualifier: 'series', required: false, min: 0 }
    ],
    returnType: 'int',
    v6Changes: 'Supports timezone strings and an optional bars_back offset when requesting bar close timestamps.'
  },
  'hour': {
    parameters: [
      { name: 'time', type: 'int', qualifier: 'series', required: true },
      { name: 'timezone', type: 'string', qualifier: 'series', required: false }
    ],
    returnType: 'int'
  },
  'minute': {
    parameters: [
      { name: 'time', type: 'int', qualifier: 'series', required: true },
      { name: 'timezone', type: 'string', qualifier: 'series', required: false }
    ],
    returnType: 'int'
  },
  'second': {
    parameters: [
      { name: 'time', type: 'int', qualifier: 'series', required: true },
      { name: 'timezone', type: 'string', qualifier: 'series', required: false }
    ],
    returnType: 'int'
  },
  'dayofmonth': {
    parameters: [
      { name: 'time', type: 'int', qualifier: 'series', required: true },
      { name: 'timezone', type: 'string', qualifier: 'series', required: false }
    ],
    returnType: 'int'
  },
  'dayofweek': {
    parameters: [
      { name: 'time', type: 'int', qualifier: 'series', required: true },
      { name: 'timezone', type: 'string', qualifier: 'series', required: false }
    ],
    returnType: 'int'
  },
  'month': {
    parameters: [
      { name: 'time', type: 'int', qualifier: 'series', required: true },
      { name: 'timezone', type: 'string', qualifier: 'series', required: false }
    ],
    returnType: 'int'
  },
  'year': {
    parameters: [
      { name: 'time', type: 'int', qualifier: 'series', required: true },
      { name: 'timezone', type: 'string', qualifier: 'series', required: false }
    ],
    returnType: 'int'
  },
  'weekofyear': {
    parameters: [
      { name: 'time', type: 'int', qualifier: 'series', required: true },
      { name: 'timezone', type: 'string', qualifier: 'series', required: false }
    ],
    returnType: 'int'
  },
  
  // Core input function
  'input': {
    parameters: [
      { name: 'defval', type: 'any', qualifier: 'const', required: true },
      { name: 'title', type: 'string', qualifier: 'const', required: false },
      { name: 'tooltip', type: 'string', qualifier: 'const', required: false },
      { name: 'inline', type: 'string', qualifier: 'const', required: false },
      { name: 'group', type: 'string', qualifier: 'const', required: false },
      { name: 'display', type: 'string', qualifier: 'const', required: false },
      { name: 'active', type: 'bool', qualifier: 'input', required: false }
    ],
    returnType: 'any'
  },
  
  // Utility functions
  'max_bars_back': {
    parameters: [
      { name: 'var', type: 'any', qualifier: 'series', required: true },
      { name: 'num', type: 'int', qualifier: 'const', required: true }
    ],
    returnType: 'void'
  },
  
  // Plotting functions
  'plot': {
    parameters: [
      { name: 'series', type: 'series', qualifier: 'series', required: true },
      { name: 'title', type: 'string', qualifier: 'simple', required: false },
      { name: 'color', type: 'color', qualifier: 'simple', required: false },
      { name: 'linewidth', type: 'int', qualifier: 'input', min: 1, required: false },
      { name: 'style', type: 'int', qualifier: 'simple', required: false },
      { name: 'trackprice', type: 'bool', qualifier: 'simple', required: false },
      { name: 'transp', type: 'int', qualifier: 'simple', required: false },
      { name: 'editable', type: 'bool', qualifier: 'simple', required: false },
      { name: 'show_last', type: 'bool', qualifier: 'simple', required: false },
      { name: 'display', type: 'int', qualifier: 'simple', required: false }
    ],
    returnType: 'series',
    deprecatedParams: ['transp'],
    v6Changes: '`transp` parameter removed. Use color.new(baseColor, transparency) instead.'
  },
  'hline': {
    parameters: [
      { name: 'price', type: 'float', qualifier: 'simple', required: true },
      { name: 'title', type: 'string', qualifier: 'simple', required: false },
      { name: 'color', type: 'color', qualifier: 'simple', required: false },
      { name: 'linestyle', type: 'int', qualifier: 'simple', required: false },
      { name: 'linewidth', type: 'int', qualifier: 'input', min: 1, required: false },
      { name: 'display', type: 'int', qualifier: 'simple', required: false }
    ],
    returnType: 'void'
  },
  'fill': {
    parameters: [
      { name: 'series1', type: 'series', qualifier: 'series', required: true },
      { name: 'series2', type: 'series', qualifier: 'series', required: true },
      { name: 'color', type: 'color', qualifier: 'series', required: false },
      { name: 'top_value', type: 'series', qualifier: 'series', required: false },
      { name: 'bottom_value', type: 'series', qualifier: 'series', required: false },
      { name: 'top_color', type: 'color', qualifier: 'series', required: false },
      { name: 'bottom_color', type: 'color', qualifier: 'series', required: false },
      { name: 'title', type: 'string', qualifier: 'simple', required: false },
      { name: 'editable', type: 'bool', qualifier: 'input', required: false },
      { name: 'show_last', type: 'int', qualifier: 'input', required: false },
      { name: 'display', type: 'int', qualifier: 'simple', required: false },
      { name: 'fillgaps', type: 'bool', qualifier: 'const', required: false }
    ],
    overloads: [
      {
        parameters: [
          { name: 'hline1', type: 'series', qualifier: 'series', required: true },
          { name: 'hline2', type: 'series', qualifier: 'series', required: true },
          { name: 'color', type: 'color', qualifier: 'series', required: true },
          { name: 'title', type: 'string', qualifier: 'simple', required: false },
          { name: 'editable', type: 'bool', qualifier: 'input', required: false },
          { name: 'fillgaps', type: 'bool', qualifier: 'const', required: false },
          { name: 'display', type: 'int', qualifier: 'simple', required: false }
        ]
      },
      {
        parameters: [
          { name: 'plot1', type: 'series', qualifier: 'series', required: true },
          { name: 'plot2', type: 'series', qualifier: 'series', required: true },
          { name: 'color', type: 'color', qualifier: 'series', required: true },
          { name: 'title', type: 'string', qualifier: 'simple', required: false },
          { name: 'editable', type: 'bool', qualifier: 'input', required: false },
          { name: 'show_last', type: 'int', qualifier: 'input', required: false },
          { name: 'fillgaps', type: 'bool', qualifier: 'const', required: false },
          { name: 'display', type: 'int', qualifier: 'simple', required: false }
        ]
      },
      {
        parameters: [
          { name: 'plot1', type: 'series', qualifier: 'series', required: true },
          { name: 'plot2', type: 'series', qualifier: 'series', required: true },
          { name: 'top_value', type: 'series', qualifier: 'series', required: true },
          { name: 'bottom_value', type: 'series', qualifier: 'series', required: true },
          { name: 'top_color', type: 'color', qualifier: 'series', required: true },
          { name: 'bottom_color', type: 'color', qualifier: 'series', required: true },
          { name: 'title', type: 'string', qualifier: 'simple', required: false },
          { name: 'display', type: 'int', qualifier: 'simple', required: false },
          { name: 'fillgaps', type: 'bool', qualifier: 'const', required: false },
          { name: 'editable', type: 'bool', qualifier: 'input', required: false }
        ]
      }
    ],
    returnType: 'void',
    deprecatedParams: ['transp']
  },
  'bgcolor': {
    parameters: [
      { name: 'color', type: 'color', qualifier: 'simple', required: true }
    ],
    returnType: 'void',
    deprecatedParams: ['transp']
  },
  'plotshape': {
    parameters: [
      { name: 'series', type: 'series', qualifier: 'series', required: true },
      { name: 'title', type: 'string', qualifier: 'simple', required: false },
      { name: 'style', type: 'int', qualifier: 'simple', required: false },
      { name: 'location', type: 'int', qualifier: 'simple', required: false },
      { name: 'color', type: 'color', qualifier: 'simple', required: false },
      { name: 'size', type: 'int', qualifier: 'simple', required: false },
      { name: 'text', type: 'string', qualifier: 'simple', required: false },
      { name: 'textcolor', type: 'color', qualifier: 'simple', required: false },
      { name: 'display', type: 'int', qualifier: 'simple', required: false }
    ],
    returnType: 'void'
  },
  'plotarrow': {
    parameters: [
      { name: 'series', type: 'float', qualifier: 'series', required: true },
      { name: 'title', type: 'string', qualifier: 'const', required: false },
      { name: 'colorup', type: 'color', qualifier: 'series', required: false },
      { name: 'colordown', type: 'color', qualifier: 'series', required: false },
      { name: 'offset', type: 'int', qualifier: 'simple', required: false },
      { name: 'minheight', type: 'int', qualifier: 'input', required: false },
      { name: 'maxheight', type: 'int', qualifier: 'input', required: false },
      { name: 'editable', type: 'bool', qualifier: 'input', required: false },
      { name: 'show_last', type: 'int', qualifier: 'input', required: false },
      { name: 'display', type: 'string', qualifier: 'input', required: false }
    ],
    returnType: 'void'
  },
  'plotbar': {
    parameters: [
      { name: 'open', type: 'float', qualifier: 'series', required: true },
      { name: 'high', type: 'float', qualifier: 'series', required: true },
      { name: 'low', type: 'float', qualifier: 'series', required: true },
      { name: 'close', type: 'float', qualifier: 'series', required: true },
      { name: 'title', type: 'string', qualifier: 'const', required: false },
      { name: 'color', type: 'color', qualifier: 'series', required: false },
      { name: 'editable', type: 'bool', qualifier: 'input', required: false },
      { name: 'show_last', type: 'int', qualifier: 'input', required: false },
      { name: 'display', type: 'string', qualifier: 'input', required: false }
    ],
    returnType: 'void'
  },
  'plotcandle': {
    parameters: [
      { name: 'open', type: 'float', qualifier: 'series', required: true },
      { name: 'high', type: 'float', qualifier: 'series', required: true },
      { name: 'low', type: 'float', qualifier: 'series', required: true },
      { name: 'close', type: 'float', qualifier: 'series', required: true },
      { name: 'title', type: 'string', qualifier: 'const', required: false },
      { name: 'color', type: 'color', qualifier: 'series', required: false },
      { name: 'wickcolor', type: 'color', qualifier: 'series', required: false },
      { name: 'editable', type: 'bool', qualifier: 'input', required: false },
      { name: 'show_last', type: 'int', qualifier: 'input', required: false },
      { name: 'bordercolor', type: 'color', qualifier: 'series', required: false },
      { name: 'display', type: 'string', qualifier: 'input', required: false }
    ],
    returnType: 'void'
  },
  'plotchar': {
    parameters: [
      { name: 'series', type: 'bool', qualifier: 'series', required: true },
      { name: 'title', type: 'string', qualifier: 'const', required: false },
      { name: 'char', type: 'string', qualifier: 'input', required: false },
      { name: 'location', type: 'string', qualifier: 'input', required: false },
      { name: 'color', type: 'color', qualifier: 'series', required: false },
      { name: 'offset', type: 'int', qualifier: 'simple', required: false },
      { name: 'text', type: 'string', qualifier: 'const', required: false },
      { name: 'textcolor', type: 'color', qualifier: 'series', required: false },
      { name: 'editable', type: 'bool', qualifier: 'input', required: false },
      { name: 'size', type: 'string', qualifier: 'const', required: false },
      { name: 'show_last', type: 'int', qualifier: 'input', required: false }
    ],
    returnType: 'void'
  },

  // TA functions with qualifier requirements
  'ta.sma': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.ema': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.rsi': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.crossover': {
    parameters: [
      { name: 'source1', type: 'float', qualifier: 'series', required: true },
      { name: 'source2', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'bool'
  },
  'ta.crossunder': {
    parameters: [
      { name: 'source1', type: 'float', qualifier: 'series', required: true },
      { name: 'source2', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'bool'
  },
  'ta.rma': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.wma': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.vwma': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.swma': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'ta.alma': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true },
      { name: 'offset', type: 'float', qualifier: 'simple', required: true },
      { name: 'sigma', type: 'float', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.hma': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.stoch': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'high', type: 'float', qualifier: 'series', required: true },
      { name: 'low', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.cci': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.cmo': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.mfi': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'volume', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.tsi': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'long_length', type: 'int', qualifier: 'simple', required: true },
      { name: 'short_length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.wpr': {
    parameters: [
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.macd': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'fast_length', type: 'int', qualifier: 'simple', required: true },
      { name: 'slow_length', type: 'int', qualifier: 'simple', required: true },
      { name: 'signal_length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'tuple'
  },
  'ta.bb': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true },
      { name: 'mult', type: 'float', qualifier: 'simple', required: true }
    ],
    returnType: 'tuple'
  },
  'ta.bbw': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true },
      { name: 'mult', type: 'float', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.kc': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true },
      { name: 'mult', type: 'float', qualifier: 'simple', required: true }
    ],
    returnType: 'tuple'
  },
  'ta.kcw': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true },
      { name: 'mult', type: 'float', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.tr': {
    parameters: [],
    returnType: 'series'
  },
  'ta.sar': {
    parameters: [
      { name: 'start', type: 'float', qualifier: 'simple', required: true },
      { name: 'increment', type: 'float', qualifier: 'simple', required: true },
      { name: 'maximum', type: 'float', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.supertrend': {
    parameters: [
      { name: 'factor', type: 'float', qualifier: 'simple', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'tuple'
  },
  'ta.dmi': {
    parameters: [
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'tuple'
  },
  'ta.accdist': {
    parameters: [],
    returnType: 'series'
  },
  'ta.obv': {
    parameters: [],
    returnType: 'series'
  },
  'ta.pvi': {
    parameters: [],
    returnType: 'series'
  },
  'ta.nvi': {
    parameters: [],
    returnType: 'series'
  },
  'ta.pvt': {
    parameters: [],
    returnType: 'series'
  },
  'ta.vwap': {
    parameters: [],
    returnType: 'series'
  },
  'ta.wad': {
    parameters: [],
    returnType: 'series'
  },
  'ta.pivot_point_levels': {
    parameters: [
      { name: 'type', type: 'string', qualifier: 'simple', required: true },
      { name: 'high', type: 'float', qualifier: 'series', required: true },
      { name: 'low', type: 'float', qualifier: 'series', required: true },
      { name: 'close', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'tuple'
  },
  'ta.correlation': {
    parameters: [
      { name: 'source1', type: 'float', qualifier: 'series', required: true },
      { name: 'source2', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.covariance': {
    parameters: [
      { name: 'source1', type: 'float', qualifier: 'series', required: true },
      { name: 'source2', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.dev': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.stdev': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.variance': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.linreg': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true },
      { name: 'offset', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.percentrank': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.range': {
    parameters: [
      { name: 'high', type: 'float', qualifier: 'series', required: true },
      { name: 'low', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.highest': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.lowest': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.roc': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.mom': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.change': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: false }
    ],
    returnType: 'series'
  },
  'ta.rising': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'bool'
  },
  'ta.falling': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'bool'
  },
  'ta.atr': {
    parameters: [
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.barssince': {
    parameters: [
      { name: 'condition', type: 'bool', qualifier: 'series', required: true }
    ],
    returnType: 'int'
  },
  'ta.cross': {
    parameters: [
      { name: 'source1', type: 'float', qualifier: 'series', required: true },
      { name: 'source2', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'bool'
  },
  'ta.cum': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'ta.highestbars': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'int'
  },
  'ta.lowestbars': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'int'
  },
  'ta.max': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'ta.min': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'ta.median': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'ta.mode': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'ta.cog': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'ta.valuewhen': {
    parameters: [
      { name: 'condition', type: 'bool', qualifier: 'series', required: true },
      { name: 'source', type: 'any', qualifier: 'series', required: true },
      { name: 'occurrence', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.pivothigh': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: false },
      { name: 'leftbars', type: 'int', qualifier: 'series', required: true },
      { name: 'rightbars', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'ta.pivotlow': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: false },
      { name: 'leftbars', type: 'int', qualifier: 'series', required: true },
      { name: 'rightbars', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'ta.percentile_linear_interpolation': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'series', required: true },
      { name: 'percentage', type: 'float', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.percentile_nearest_rank': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'series', required: true },
      { name: 'percentage', type: 'float', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'ta.rci': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },

  // Math functions
  'math.max': {
    parameters: [
      { name: 'value1', type: 'float', qualifier: 'series', required: true },
      { name: 'value2', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.min': {
    parameters: [
      { name: 'value1', type: 'float', qualifier: 'series', required: true },
      { name: 'value2', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.abs': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.round': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.floor': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.ceil': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.round_to_mintick': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.pow': {
    parameters: [
      { name: 'base', type: 'float', qualifier: 'series', required: true },
      { name: 'exponent', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.sqrt': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.exp': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.log': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.log10': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.sin': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.cos': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.tan': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.asin': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.acos': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.atan': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.todegrees': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.toradians': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.sign': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'series'
  },
  'math.random': {
    parameters: [],
    returnType: 'series'
  },
  'math.sum': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },
  'math.avg': {
    parameters: [
      { name: 'source', type: 'float', qualifier: 'series', required: true },
      { name: 'length', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'series'
  },

  // Strategy functions
  'strategy.entry': {
    parameters: [
      { name: 'id', type: 'string', qualifier: 'simple', required: true },
      { name: 'direction', type: 'int', qualifier: 'simple', required: true },
      { name: 'qty', type: 'float', qualifier: 'simple', required: false },
      { name: 'limit', type: 'float', qualifier: 'simple', required: false },
      { name: 'stop', type: 'float', qualifier: 'simple', required: false },
      { name: 'oca_name', type: 'string', qualifier: 'simple', required: false },
      { name: 'oca_type', type: 'int', qualifier: 'simple', required: false },
      { name: 'comment', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'void'
  },
  'strategy.close': {
    parameters: [
      { name: 'id', type: 'string', qualifier: 'simple', required: true },
      { name: 'qty', type: 'float', qualifier: 'simple', required: false },
      { name: 'comment', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'void'
  },
  'strategy.close_all': {
    parameters: [
      { name: 'comment', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'void'
  },
  'strategy.cancel': {
    parameters: [
      { name: 'id', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'strategy.cancel_all': {
    parameters: [],
    returnType: 'void'
  },
  'strategy.order': {
    parameters: [
      { name: 'id', type: 'string', qualifier: 'simple', required: true },
      { name: 'direction', type: 'int', qualifier: 'simple', required: true },
      { name: 'qty', type: 'float', qualifier: 'simple', required: true },
      { name: 'limit', type: 'float', qualifier: 'simple', required: false },
      { name: 'stop', type: 'float', qualifier: 'simple', required: false },
      { name: 'oca_name', type: 'string', qualifier: 'simple', required: false },
      { name: 'oca_type', type: 'int', qualifier: 'simple', required: false },
      { name: 'comment', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'void'
  },
  'strategy.position_size': {
    parameters: [],
    returnType: 'float'
  },
  'strategy.equity': {
    parameters: [],
    returnType: 'float'
  },
  'strategy.initial_capital': {
    parameters: [],
    returnType: 'float'
  },
  'strategy.commission': {
    parameters: [],
    returnType: 'float'
  },
  'strategy.risk': {
    parameters: [],
    returnType: 'float'
  },
  'strategy.risk.allow_entry_in': {
    parameters: [
      { name: 'direction', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'void',
    v6Changes: 'Risk management function to control entry direction permissions.'
  },
  'strategy.risk.max_position_size': {
    parameters: [
      { name: 'size', type: 'float', qualifier: 'simple', required: true, min: 0 }
    ],
    returnType: 'void',
    v6Changes: 'Advanced risk management to set maximum position size limits.'
  },
  'strategy.risk.max_drawdown': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'simple', required: true, min: 0 },
      { name: 'type', type: 'string', qualifier: 'simple', required: true },
      { name: 'alert_message', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'void',
    v6Changes: 'Risk management function to limit maximum allowable drawdown.'
  },
  'strategy.risk.max_intraday_filled_orders': {
    parameters: [
      { name: 'count', type: 'int', qualifier: 'simple', required: true, min: 1 },
      { name: 'alert_message', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'void',
    v6Changes: 'Risk management to limit the number of intraday filled orders.'
  },

  // Polyline functions
  'polyline.new': {
    parameters: [
      { name: 'points', type: 'array', qualifier: 'simple', required: true },
      { name: 'curved', type: 'bool', qualifier: 'simple', required: false },
      { name: 'closed', type: 'bool', qualifier: 'simple', required: false },
      { name: 'xloc', type: 'string', qualifier: 'simple', required: false },
      { name: 'line_color', type: 'color', qualifier: 'simple', required: false },
      { name: 'fill_color', type: 'color', qualifier: 'simple', required: false },
      { name: 'line_style', type: 'string', qualifier: 'simple', required: false },
      { name: 'line_width', type: 'int', qualifier: 'simple', required: false, min: 1, max: 20 },
      { name: 'force_overlay', type: 'bool', qualifier: 'const', required: false }
    ],
    returnType: 'polyline',
    v6Changes: 'Create polylines with point arrays, optional curvature, fills, and overlay control.'
  },
  'polyline.delete': {
    parameters: [
      { name: 'id', type: 'polyline', qualifier: 'simple', required: true }
    ],
    returnType: 'void',
    v6Changes: 'Delete polyline and free memory.'
  },
  'time_tradingday': {
    parameters: [
      { name: 'time', type: 'any', qualifier: 'series', required: true },
      { name: 'timezone', type: 'any', qualifier: 'simple', required: false }
    ],
    returnType: 'int',
    v6Changes: 'Calculate trading day boundaries for daily calculations and session analysis.'
  },
  'timenow': {
    parameters: [],
    returnType: 'int',
    v6Changes: 'Get current time for real-time calculations and conditions.'
  },

  // Request functions
  'request.security': {
    parameters: [
      { name: 'symbol', type: 'string', qualifier: 'series' },
      { name: 'timeframe', type: 'string', qualifier: 'series' },
      { name: 'expression', type: 'any', qualifier: 'series' }
    ],
    returnType: 'series',
    v6Changes: 'Dynamic requests are enabled: `symbol` and `timeframe` arguments can now be of `series` form.'
  },
  'request.security_lower_tf': {
    parameters: [
      { name: 'symbol', type: 'string', qualifier: 'series', required: true },
      { name: 'timeframe', type: 'string', qualifier: 'series', required: true },
      { name: 'expression', type: 'any', qualifier: 'series', required: true },
      { name: 'ignore_invalid_symbol', type: 'bool', qualifier: 'series', required: false },
      { name: 'currency', type: 'string', qualifier: 'series', required: false },
      { name: 'ignore_invalid_timeframe', type: 'bool', qualifier: 'series', required: false },
      { name: 'calc_bars_count', type: 'int', qualifier: 'simple', required: false }
    ],
    returnType: 'array'
  },
  'request.dividends': {
    parameters: [
      { name: 'ticker', type: 'string', qualifier: 'series', required: true },
      { name: 'field', type: 'string', qualifier: 'series', required: false },
      { name: 'gaps', type: 'string', qualifier: 'simple', required: false },
      { name: 'lookahead', type: 'string', qualifier: 'simple', required: false },
      { name: 'ignore_invalid_symbol', type: 'bool', qualifier: 'input', required: false },
      { name: 'currency', type: 'string', qualifier: 'series', required: false }
    ],
    returnType: 'series'
  },
  'request.earnings': {
    parameters: [
      { name: 'ticker', type: 'string', qualifier: 'series', required: true },
      { name: 'field', type: 'string', qualifier: 'series', required: false },
      { name: 'gaps', type: 'string', qualifier: 'simple', required: false },
      { name: 'lookahead', type: 'string', qualifier: 'simple', required: false },
      { name: 'ignore_invalid_symbol', type: 'bool', qualifier: 'input', required: false },
      { name: 'currency', type: 'string', qualifier: 'series', required: false }
    ],
    returnType: 'series'
  },
  'request.splits': {
    parameters: [
      { name: 'ticker', type: 'string', qualifier: 'series', required: true },
      { name: 'field', type: 'string', qualifier: 'series', required: false },
      { name: 'gaps', type: 'string', qualifier: 'simple', required: false },
      { name: 'lookahead', type: 'string', qualifier: 'simple', required: false },
      { name: 'ignore_invalid_symbol', type: 'bool', qualifier: 'input', required: false }
    ],
    returnType: 'series'
  },
  'request.economic': {
    parameters: [
      { name: 'country_code', type: 'string', qualifier: 'series', required: true },
      { name: 'field', type: 'string', qualifier: 'series', required: true },
      { name: 'gaps', type: 'string', qualifier: 'simple', required: false },
      { name: 'ignore_invalid_symbol', type: 'bool', qualifier: 'input', required: false }
    ],
    returnType: 'series'
  },
  'request.financial': {
    parameters: [
      { name: 'symbol', type: 'string', qualifier: 'series', required: true },
      { name: 'financial_id', type: 'string', qualifier: 'series', required: true },
      { name: 'period', type: 'string', qualifier: 'series', required: true },
      { name: 'gaps', type: 'string', qualifier: 'simple', required: false },
      { name: 'ignore_invalid_symbol', type: 'bool', qualifier: 'input', required: false },
      { name: 'currency', type: 'string', qualifier: 'series', required: false }
    ],
    returnType: 'series'
  },
  'request.currency_rate': {
    parameters: [
      { name: 'from', type: 'string', qualifier: 'series', required: true },
      { name: 'to', type: 'string', qualifier: 'series', required: true },
      { name: 'ignore_invalid_currency', type: 'bool', qualifier: 'series', required: false }
    ],
    returnType: 'series'
  },
  'request.seed': {
    parameters: [
      { name: 'source', type: 'string', qualifier: 'series', required: true },
      { name: 'symbol', type: 'string', qualifier: 'series', required: true },
      { name: 'expression', type: 'any', qualifier: 'series', required: true },
      { name: 'ignore_invalid_symbol', type: 'bool', qualifier: 'input', required: false },
      { name: 'calc_bars_count', type: 'int', qualifier: 'simple', required: false }
    ],
    returnType: 'series'
  },
  'request.quandl': {
    parameters: [
      { name: 'ticker', type: 'string', qualifier: 'series', required: true },
      { name: 'gaps', type: 'string', qualifier: 'simple', required: false },
      { name: 'index', type: 'int', qualifier: 'series', required: false },
      { name: 'ignore_invalid_symbol', type: 'bool', qualifier: 'input', required: false }
    ],
    returnType: 'series',
    deprecated: true,
    v6Changes: 'Function deprecated due to API changes from NASDAQ Data Link'
  },
  'color.new': {
    parameters: [
      { name: 'baseColor', type: 'color', qualifier: 'series', required: true },
      { name: 'transparency', type: 'int', qualifier: 'series', required: true, min: 0, max: 100 }
    ],
    returnType: 'color'
  },
  'color.rgb': {
    parameters: [
      { name: 'red', type: 'int', qualifier: 'series', required: true, min: 0, max: 255 },
      { name: 'green', type: 'int', qualifier: 'series', required: true, min: 0, max: 255 },
      { name: 'blue', type: 'int', qualifier: 'series', required: true, min: 0, max: 255 },
      { name: 'transparency', type: 'int', qualifier: 'series', required: false, min: 0, max: 100 }
    ],
    returnType: 'color'
  },
  'color.from_gradient': {
    parameters: [
      { name: 'value', type: 'series', qualifier: 'series', required: true },
      { name: 'bottom_value', type: 'series', qualifier: 'series', required: true },
      { name: 'top_value', type: 'series', qualifier: 'series', required: true },
      { name: 'bottom_color', type: 'color', qualifier: 'series', required: true },
      { name: 'top_color', type: 'color', qualifier: 'series', required: true }
    ],
    returnType: 'color'
  },
  'color': {
    parameters: [
      { name: 'value', type: 'any', qualifier: 'simple', required: true }
    ],
    returnType: 'color'
  },

  // Collection functions
  'array.new': {
    parameters: [
      { name: 'type', type: 'string', qualifier: 'simple', optional: true },
      { name: 'size', type: 'int', qualifier: 'simple', max: 100000 }
    ],
    returnType: 'array'
  },
  'array.push': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' },
      // In practice, pushing a series value into an array is valid (value at bar)
      // Allow 'series' to avoid false positives in TDD
      { name: 'value', type: 'any', qualifier: 'series' }
    ],
    returnType: 'void'
  },
  'array.pop': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' }
    ],
    returnType: 'any'
  },
  'array.get': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' },
      { name: 'index', type: 'int', qualifier: 'simple' }
    ],
    returnType: 'element'
  },
  'array.set': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' },
      { name: 'index', type: 'int', qualifier: 'simple' },
      // Allow series values to be assigned into arrays
      { name: 'value', type: 'any', qualifier: 'series' }
    ],
    returnType: 'void'
  },
  'array.size': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' }
    ],
    returnType: 'int'
  },
  'array.clear': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' }
    ],
    returnType: 'void'
  },
  'array.reverse': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' }
    ],
    returnType: 'void'
  },
  'array.sort': {
    overloads: [
      {
        parameters: [
          { name: 'id', type: 'array', qualifier: 'simple' }
        ],
        returnType: 'void'
      },
      {
        parameters: [
          { name: 'id', type: 'array', qualifier: 'simple' },
          { name: 'order', type: 'sort_order', qualifier: 'simple', optional: true }
        ],
        returnType: 'void'
      }
    ]
  },
  'array.copy': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' }
    ],
    returnType: 'array'
  },
  'array.slice': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' },
      { name: 'start', type: 'int', qualifier: 'simple' },
      { name: 'end', type: 'int', qualifier: 'simple' }
    ],
    returnType: 'array'
  },
  'array.indexof': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' },
      { name: 'value', type: 'any', qualifier: 'simple' }
    ],
    returnType: 'int'
  },
  'array.lastindexof': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' },
      { name: 'value', type: 'any', qualifier: 'simple' }
    ],
    returnType: 'int'
  },
  'array.remove': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' },
      { name: 'index', type: 'int', qualifier: 'simple' }
    ],
    returnType: 'element'
  },
  'array.insert': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' },
      { name: 'index', type: 'int', qualifier: 'simple' },
      { name: 'value', type: 'any', qualifier: 'simple' }
    ],
    returnType: 'void'
  },
  'array.includes': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' },
      { name: 'value', type: 'any', qualifier: 'simple' }
    ],
    returnType: 'bool'
  },
  'array.binary_search': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' },
      { name: 'value', type: 'any', qualifier: 'simple' }
    ],
    returnType: 'int'
  },
  'array.binary_search_leftmost': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' },
      { name: 'value', type: 'any', qualifier: 'simple' }
    ],
    returnType: 'int'
  },
  'array.binary_search_rightmost': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' },
      { name: 'value', type: 'any', qualifier: 'simple' }
    ],
    returnType: 'int'
  },
  'array.min': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' }
    ],
    returnType: 'series'
  },
  'array.max': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' }
    ],
    returnType: 'series'
  },
  'array.sum': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' }
    ],
    returnType: 'series'
  },
  'array.avg': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' }
    ],
    returnType: 'series'
  },
  'array.median': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' }
    ],
    returnType: 'series'
  },
  'array.mode': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' }
    ],
    returnType: 'series'
  },
  'array.variance': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' }
    ],
    returnType: 'series'
  },
  'array.stdev': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' }
    ],
    returnType: 'series'
  },
  'array.range': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' }
    ],
    returnType: 'series'
  },
  'array.covariance': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' },
      { name: 'id2', type: 'array', qualifier: 'simple' }
    ],
    returnType: 'series'
  },
  'array.percentile_linear_interpolation': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' },
      { name: 'percentage', type: 'simple', qualifier: 'simple' }
    ],
    returnType: 'series'
  },
  'array.percentile_nearest_rank': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' },
      { name: 'percentage', type: 'simple', qualifier: 'simple' }
    ],
    returnType: 'series'
  },
  'array.percentrank': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' },
      { name: 'value', type: 'simple', qualifier: 'simple' }
    ],
    returnType: 'series'
  },
  'array.first': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' }
    ],
    returnType: 'element'
  },
  'array.last': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' }
    ],
    returnType: 'element'
  },
  'array.join': {
    parameters: [
      { name: 'id', type: 'array', qualifier: 'simple' },
      { name: 'separator', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'string'
  },
  'matrix.new': {
    parameters: [
      { name: 'type', type: 'string', qualifier: 'simple', optional: true },
      { name: 'rows', type: 'int', qualifier: 'simple', max: 1000 },
      { name: 'columns', type: 'int', qualifier: 'simple', max: 1000 }
    ],
    returnType: 'matrix'
  },
  'matrix.set': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'simple' },
      { name: 'row', type: 'int', qualifier: 'simple' },
      { name: 'column', type: 'int', qualifier: 'simple' },
      // Allow series values to be assigned into matrices
      { name: 'value', type: 'any', qualifier: 'series' }
    ],
    returnType: 'void'
  },
  'matrix.get': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'simple' },
      { name: 'row', type: 'int', qualifier: 'simple' },
      { name: 'column', type: 'int', qualifier: 'simple' }
    ],
    returnType: 'element'
  },
  'matrix.rows': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'simple' }
    ],
    returnType: 'int'
  },
  'matrix.columns': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'simple' }
    ],
    returnType: 'int'
  },
  'matrix.copy': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'simple' }
    ],
    returnType: 'matrix'
  },
  'matrix.fill': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'simple', required: true },
      { name: 'value', type: 'any', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'matrix.reverse': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'simple', required: true },
      { name: 'dimension', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'matrix'
  },
  'matrix.sort': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'simple', required: true },
      { name: 'order', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'matrix'
  },
  'matrix.transpose': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'simple', required: true }
    ],
    returnType: 'matrix'
  },
  
  // Map functions
  'map.new': {
    parameters: [
      { name: 'type', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'map'
  },
  'map.put': {
    parameters: [
      { name: 'id', type: 'map', qualifier: 'simple', required: true },
      { name: 'key', type: 'string', qualifier: 'simple', required: true },
      { name: 'value', type: 'any', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'map.get': {
    parameters: [
      { name: 'id', type: 'map', qualifier: 'simple', required: true },
      { name: 'key', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'element'
  },
  'map.remove': {
    parameters: [
      { name: 'id', type: 'map', qualifier: 'simple', required: true },
      { name: 'key', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'map.size': {
    parameters: [
      { name: 'id', type: 'map', qualifier: 'simple', required: true }
    ],
    returnType: 'int'
  },
  'map.clear': {
    parameters: [
      { name: 'id', type: 'map', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'map.keys': {
    parameters: [
      { name: 'id', type: 'map', qualifier: 'simple', required: true }
    ],
    returnType: 'array'
  },
  'map.values': {
    parameters: [
      { name: 'id', type: 'map', qualifier: 'simple', required: true }
    ],
    returnType: 'array'
  },
  'map.contains': {
    parameters: [
      { name: 'id', type: 'map', qualifier: 'simple', required: true },
      { name: 'key', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'bool'
  },
  'map.copy': {
    parameters: [
      { name: 'id', type: 'map', qualifier: 'simple', required: true }
    ],
    returnType: 'map'
  },
  'map.put_all': {
    parameters: [
      { name: 'id', type: 'map', qualifier: 'simple', required: true },
      { name: 'source', type: 'map', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  
  // String functions
  'str.length': {
    parameters: [
      { name: 'text', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'int'
  },
  'str.contains': {
    parameters: [
      { name: 'text', type: 'string', qualifier: 'series', required: true },
      { name: 'substring', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'bool'
  },
  'str.startswith': {
    parameters: [
      { name: 'text', type: 'string', qualifier: 'series', required: true },
      { name: 'prefix', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'bool'
  },
  'str.endswith': {
    parameters: [
      { name: 'text', type: 'string', qualifier: 'series', required: true },
      { name: 'suffix', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'bool'
  },
  'str.pos': {
    parameters: [
      { name: 'text', type: 'string', qualifier: 'series', required: true },
      { name: 'substring', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'int'
  },
  'str.substring': {
    parameters: [
      { name: 'text', type: 'string', qualifier: 'series', required: true },
      { name: 'start', type: 'int', qualifier: 'simple', required: true },
      { name: 'end', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'string'
  },
  'str.replace': {
    parameters: [
      { name: 'text', type: 'string', qualifier: 'series', required: true },
      { name: 'search', type: 'string', qualifier: 'simple', required: true },
      { name: 'replace', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'string'
  },
  'str.replace_all': {
    parameters: [
      { name: 'source', type: 'string', qualifier: 'simple', required: true },
      { name: 'target', type: 'string', qualifier: 'simple', required: true },
      { name: 'replacement', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'string'
  },
  'str.split': {
    parameters: [
      { name: 'text', type: 'string', qualifier: 'series', required: true },
      { name: 'delimiter', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'array'
  },
  'str.upper': {
    parameters: [
      { name: 'text', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'string'
  },
  'str.lower': {
    parameters: [
      { name: 'text', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'string'
  },
  'str.trim': {
    parameters: [
      { name: 'text', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'string'
  },
  'str.repeat': {
    parameters: [
      { name: 'text', type: 'string', qualifier: 'simple', required: true },
      { name: 'count', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'string'
  },
  'str.format': {
    parameters: [
      { name: 'format', type: 'string', qualifier: 'simple', required: true },
      { name: 'args', type: 'any', qualifier: 'simple', required: false, variadic: true }
    ],
    returnType: 'string'
  },
  'str.format_time': {
    parameters: [
      { name: 'time', type: 'int', qualifier: 'series', required: true },
      { name: 'format', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'string'
  },
  'str.match': {
    parameters: [
      { name: 'text', type: 'string', qualifier: 'series', required: true },
      { name: 'pattern', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'string'
  },
  'str.tostring': {
    parameters: [
      { name: 'value', type: 'any', qualifier: 'series', required: true },
      { name: 'format', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'string'
  },
  'str.tonumber': {
    parameters: [
      { name: 'text', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  
  // Input functions
  'input.int': {
    parameters: [
      { name: 'defval', type: 'int', qualifier: 'simple', required: true },
      { name: 'title', type: 'string', qualifier: 'simple', required: false },
      { name: 'minval', type: 'int', qualifier: 'simple', required: false },
      { name: 'maxval', type: 'int', qualifier: 'simple', required: false },
      { name: 'step', type: 'int', qualifier: 'simple', required: false },
      { name: 'group', type: 'string', qualifier: 'simple', required: false },
      { name: 'tooltip', type: 'string', qualifier: 'simple', required: false },
      { name: 'inline', type: 'string', qualifier: 'simple', required: false },
      { name: 'confirm', type: 'bool', qualifier: 'simple', required: false }
    ],
    returnType: 'int'
  },
  'input.float': {
    parameters: [
      { name: 'defval', type: 'float', qualifier: 'simple', required: true },
      { name: 'title', type: 'string', qualifier: 'simple', required: false },
      { name: 'minval', type: 'float', qualifier: 'simple', required: false },
      { name: 'maxval', type: 'float', qualifier: 'simple', required: false },
      { name: 'step', type: 'float', qualifier: 'simple', required: false },
      { name: 'group', type: 'string', qualifier: 'simple', required: false },
      { name: 'tooltip', type: 'string', qualifier: 'simple', required: false },
      { name: 'inline', type: 'string', qualifier: 'simple', required: false },
      { name: 'confirm', type: 'bool', qualifier: 'simple', required: false }
    ],
    returnType: 'float'
  },
  'input.bool': {
    parameters: [
      { name: 'defval', type: 'bool', qualifier: 'simple', required: true },
      { name: 'title', type: 'string', qualifier: 'simple', required: false },
      { name: 'group', type: 'string', qualifier: 'simple', required: false },
      { name: 'tooltip', type: 'string', qualifier: 'simple', required: false },
      { name: 'inline', type: 'string', qualifier: 'simple', required: false },
      { name: 'confirm', type: 'bool', qualifier: 'simple', required: false }
    ],
    returnType: 'bool'
  },
  'input.string': {
    parameters: [
      { name: 'defval', type: 'string', qualifier: 'simple', required: true },
      { name: 'title', type: 'string', qualifier: 'simple', required: false },
      { name: 'options', type: 'array', qualifier: 'simple', required: false },
      { name: 'group', type: 'string', qualifier: 'simple', required: false },
      { name: 'tooltip', type: 'string', qualifier: 'simple', required: false },
      { name: 'inline', type: 'string', qualifier: 'simple', required: false },
      { name: 'confirm', type: 'bool', qualifier: 'simple', required: false },
      { name: 'multiline', type: 'bool', qualifier: 'simple', required: false }
    ],
    returnType: 'string'
  },
  'input.color': {
    parameters: [
      { name: 'defval', type: 'color', qualifier: 'simple', required: true },
      { name: 'title', type: 'string', qualifier: 'simple', required: false },
      { name: 'group', type: 'string', qualifier: 'simple', required: false },
      { name: 'tooltip', type: 'string', qualifier: 'simple', required: false },
      { name: 'inline', type: 'string', qualifier: 'simple', required: false },
      { name: 'confirm', type: 'bool', qualifier: 'simple', required: false }
    ],
    returnType: 'color'
  },
  'input.source': {
    parameters: [
      { name: 'defval', type: 'series', qualifier: 'simple', required: true },
      { name: 'title', type: 'string', qualifier: 'simple', required: false },
      { name: 'group', type: 'string', qualifier: 'simple', required: false },
      { name: 'tooltip', type: 'string', qualifier: 'simple', required: false },
      { name: 'inline', type: 'string', qualifier: 'simple', required: false },
      { name: 'confirm', type: 'bool', qualifier: 'simple', required: false }
    ],
    returnType: 'series'
  },
  'input.timeframe': {
    parameters: [
      { name: 'defval', type: 'string', qualifier: 'simple', required: true },
      { name: 'title', type: 'string', qualifier: 'simple', required: false },
      { name: 'options', type: 'array', qualifier: 'simple', required: false },
      { name: 'group', type: 'string', qualifier: 'simple', required: false },
      { name: 'tooltip', type: 'string', qualifier: 'simple', required: false },
      { name: 'inline', type: 'string', qualifier: 'simple', required: false },
      { name: 'confirm', type: 'bool', qualifier: 'simple', required: false },
      { name: 'display', type: 'string', qualifier: 'simple', required: false },
      { name: 'active', type: 'bool', qualifier: 'input', required: false }
    ],
    returnType: 'string'
  },
  'input.session': {
    parameters: [
      { name: 'defval', type: 'string', qualifier: 'simple', required: true },
      { name: 'title', type: 'string', qualifier: 'simple', required: false },
      { name: 'options', type: 'array', qualifier: 'simple', required: false },
      { name: 'tooltip', type: 'string', qualifier: 'simple', required: false },
      { name: 'group', type: 'string', qualifier: 'simple', required: false },
      { name: 'inline', type: 'string', qualifier: 'simple', required: false },
      { name: 'confirm', type: 'bool', qualifier: 'simple', required: false },
      { name: 'display', type: 'string', qualifier: 'simple', required: false },
      { name: 'active', type: 'bool', qualifier: 'input', required: false }
    ],
    returnType: 'string'
  },
  'input.symbol': {
    parameters: [
      { name: 'defval', type: 'string', qualifier: 'simple', required: true },
      { name: 'title', type: 'string', qualifier: 'simple', required: false },
      { name: 'group', type: 'string', qualifier: 'simple', required: false },
      { name: 'tooltip', type: 'string', qualifier: 'simple', required: false },
      { name: 'inline', type: 'string', qualifier: 'simple', required: false },
      { name: 'confirm', type: 'bool', qualifier: 'simple', required: false },
      { name: 'display', type: 'string', qualifier: 'simple', required: false },
      { name: 'active', type: 'bool', qualifier: 'input', required: false }
    ],
    returnType: 'string'
  },
  'input.enum': {
    parameters: [
      { name: 'defval', type: 'any', qualifier: 'const', required: true },
      { name: 'title', type: 'string', qualifier: 'const', required: false },
      { name: 'options', type: 'array', qualifier: 'const', required: false },
      { name: 'tooltip', type: 'string', qualifier: 'const', required: false },
      { name: 'inline', type: 'string', qualifier: 'const', required: false },
      { name: 'group', type: 'string', qualifier: 'const', required: false },
      { name: 'confirm', type: 'bool', qualifier: 'const', required: false },
      { name: 'display', type: 'string', qualifier: 'const', required: false },
      { name: 'active', type: 'bool', qualifier: 'input', required: false }
    ],
    returnType: 'any'
  },
  'input.price': {
    parameters: [
      { name: 'defval', type: 'float', qualifier: 'const', required: true },
      { name: 'title', type: 'string', qualifier: 'const', required: false },
      { name: 'tooltip', type: 'string', qualifier: 'const', required: false },
      { name: 'inline', type: 'string', qualifier: 'const', required: false },
      { name: 'group', type: 'string', qualifier: 'const', required: false },
      { name: 'confirm', type: 'bool', qualifier: 'const', required: false },
      { name: 'display', type: 'string', qualifier: 'const', required: false },
      { name: 'active', type: 'bool', qualifier: 'input', required: false }
    ],
    returnType: 'float'
  },
  'input.time': {
    parameters: [
      { name: 'defval', type: 'int', qualifier: 'const', required: true },
      { name: 'title', type: 'string', qualifier: 'const', required: false },
      { name: 'tooltip', type: 'string', qualifier: 'const', required: false },
      { name: 'inline', type: 'string', qualifier: 'const', required: false },
      { name: 'group', type: 'string', qualifier: 'const', required: false },
      { name: 'confirm', type: 'bool', qualifier: 'const', required: false },
      { name: 'display', type: 'string', qualifier: 'const', required: false },
      { name: 'active', type: 'bool', qualifier: 'input', required: false }
    ],
    returnType: 'int'
  },
  'input.text_area': {
    parameters: [
      { name: 'defval', type: 'string', qualifier: 'const', required: true },
      { name: 'title', type: 'string', qualifier: 'const', required: false },
      { name: 'tooltip', type: 'string', qualifier: 'const', required: false },
      { name: 'group', type: 'string', qualifier: 'const', required: false },
      { name: 'confirm', type: 'bool', qualifier: 'const', required: false },
      { name: 'display', type: 'string', qualifier: 'const', required: false },
      { name: 'active', type: 'bool', qualifier: 'input', required: false }
    ],
    returnType: 'string'
  },
  'input.resolution': {
    parameters: [
      { name: 'defval', type: 'string', qualifier: 'simple', required: true },
      { name: 'title', type: 'string', qualifier: 'simple', required: true },
      { name: 'group', type: 'string', qualifier: 'simple', required: false },
      { name: 'tooltip', type: 'string', qualifier: 'simple', required: false },
      { name: 'inline', type: 'string', qualifier: 'simple', required: false },
      { name: 'confirm', type: 'bool', qualifier: 'simple', required: false }
    ],
    returnType: 'string'
  },

  // Drawing functions - Chart point helpers
  'chart.point.new': {
    parameters: [
      { name: 'time', type: 'series', qualifier: 'series', required: true },
      { name: 'price', type: 'series', qualifier: 'series', required: true }
    ],
    returnType: 'chart.point'
  },
  'chart.point.from_time': {
    parameters: [
      { name: 'time', type: 'series', qualifier: 'series', required: true },
      { name: 'price', type: 'series', qualifier: 'series', required: true }
    ],
    returnType: 'chart.point'
  },
  'chart.point.from_index': {
    parameters: [
      { name: 'bar_index', type: 'series', qualifier: 'series', required: true },
      { name: 'price', type: 'series', qualifier: 'series', required: true }
    ],
    returnType: 'chart.point'
  },
  'chart.point.now': {
    parameters: [
      { name: 'price', type: 'series', qualifier: 'series', required: true }
    ],
    returnType: 'chart.point'
  },
  
  // Drawing functions - Line
  'line.new': {
    parameters: [
      { name: 'x1', type: 'int', qualifier: 'simple', required: false },
      { name: 'y1', type: 'int', qualifier: 'simple', required: false },
      { name: 'x2', type: 'int', qualifier: 'simple', required: false },
      { name: 'y2', type: 'int', qualifier: 'simple', required: false },
      { name: 'point1', type: 'chart.point', qualifier: 'simple', required: false },
      { name: 'point2', type: 'chart.point', qualifier: 'simple', required: false },
      { name: 'color', type: 'color', qualifier: 'simple', required: false },
      { name: 'width', type: 'int', qualifier: 'simple', required: false },
      { name: 'style', type: 'int', qualifier: 'simple', required: false }
    ],
    returnType: 'line'
  },
  'line.set_xy1': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'simple', required: true },
      { name: 'x1', type: 'int', qualifier: 'simple', required: true },
      { name: 'y1', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'line.set_xy2': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'simple', required: true },
      { name: 'x2', type: 'int', qualifier: 'simple', required: true },
      { name: 'y2', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'line.set_color': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'simple', required: true },
      { name: 'color', type: 'color', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'line.set_width': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'simple', required: true },
      { name: 'width', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'line.set_style': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'simple', required: true },
      { name: 'style', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'line.delete': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  
  // Drawing functions - Label
  'label.new': {
    parameters: [
      { name: 'x', type: 'int', qualifier: 'simple', required: true },
      { name: 'y', type: 'int', qualifier: 'simple', required: true },
      { name: 'text', type: 'string', qualifier: 'simple', required: true },
      { name: 'color', type: 'color', qualifier: 'simple', required: false },
      { name: 'style', type: 'int', qualifier: 'simple', required: false },
      { name: 'size', type: 'int', qualifier: 'simple', required: false }
    ],
    returnType: 'label'
  },
  'label.set_text': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'simple', required: true },
      { name: 'text', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'label.set_color': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'simple', required: true },
      { name: 'color', type: 'color', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'label.set_style': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'simple', required: true },
      { name: 'style', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'label.set_size': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'simple', required: true },
      { name: 'size', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'label.set_x': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'simple', required: true },
      { name: 'x', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'label.set_y': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'simple', required: true },
      { name: 'y', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'label.set_xy': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'simple', required: true },
      { name: 'x', type: 'int', qualifier: 'simple', required: true },
      { name: 'y', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'label.delete': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  
  // Drawing functions - Box
  'box.new': {
    parameters: [
      { name: 'left', type: 'int', qualifier: 'simple', required: true },
      { name: 'top', type: 'int', qualifier: 'simple', required: true },
      { name: 'right', type: 'int', qualifier: 'simple', required: true },
      { name: 'bottom', type: 'int', qualifier: 'simple', required: true },
      { name: 'color', type: 'color', qualifier: 'simple', required: false },
      { name: 'border_color', type: 'color', qualifier: 'simple', required: false },
      { name: 'border_width', type: 'int', qualifier: 'simple', required: false },
      { name: 'border_style', type: 'int', qualifier: 'simple', required: false },
      { name: 'text', type: 'string', qualifier: 'simple', required: false },
      { name: 'text_color', type: 'color', qualifier: 'simple', required: false },
      { name: 'text_size', type: 'int', qualifier: 'simple', required: false },
      { name: 'text_font', type: 'int', qualifier: 'simple', required: false },
      { name: 'text_halign', type: 'int', qualifier: 'simple', required: false },
      { name: 'text_valign', type: 'int', qualifier: 'simple', required: false },
      { name: 'text_wrap', type: 'int', qualifier: 'simple', required: false }
    ],
    returnType: 'box'
  },
  'box.set_bgcolor': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'simple', required: true },
      { name: 'color', type: 'color', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'box.set_border_color': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'simple', required: true },
      { name: 'color', type: 'color', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'box.set_border_width': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'simple', required: true },
      { name: 'width', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'box.set_border_style': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'simple', required: true },
      { name: 'style', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'box.delete': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'box.set_text': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'simple', required: true },
      { name: 'text', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'box.set_text_color': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'simple', required: true },
      { name: 'color', type: 'color', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'box.set_text_size': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'simple', required: true },
      { name: 'size', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'box.set_text_halign': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'simple', required: true },
      { name: 'halign', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'box.set_text_valign': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'simple', required: true },
      { name: 'valign', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'box.set_text_wrap': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'simple', required: true },
      { name: 'wrap', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'box.set_extend': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'series', required: true },
      { name: 'extend', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'box.set_left': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'series', required: true },
      { name: 'left', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'box.set_top': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'series', required: true },
      { name: 'top', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'box.set_right': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'series', required: true },
      { name: 'right', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'box.set_bottom': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'series', required: true },
      { name: 'bottom', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'box.set_xloc': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'series', required: true },
      { name: 'xloc', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'box.get_left': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'series', required: true }
    ],
    returnType: 'int'
  },
  'box.get_top': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'box.get_right': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'series', required: true }
    ],
    returnType: 'int'
  },
  'box.get_bottom': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'box.copy': {
    parameters: [
      { name: 'id', type: 'box', qualifier: 'series', required: true }
    ],
    returnType: 'box'
  },
  
  // Drawing functions - Table
  'table.new': {
    parameters: [
      { name: 'position', type: 'int', qualifier: 'simple', required: true },
      { name: 'columns', type: 'int', qualifier: 'simple', required: true },
      { name: 'rows', type: 'int', qualifier: 'simple', required: true },
      { name: 'bgcolor', type: 'color', qualifier: 'simple', required: false },
      { name: 'border_width', type: 'int', qualifier: 'simple', required: false }
    ],
    returnType: 'table'
  },
  'table.cell': {
    parameters: [
      { name: 'id', type: 'table', qualifier: 'simple', required: true },
      { name: 'x', type: 'int', qualifier: 'simple', required: true },
      { name: 'y', type: 'int', qualifier: 'simple', required: true },
      { name: 'text', type: 'string', qualifier: 'simple', required: true },
      { name: 'text_color', type: 'color', qualifier: 'simple', required: false },
      { name: 'bgcolor', type: 'color', qualifier: 'simple', required: false },
      { name: 'text_size', type: 'int', qualifier: 'simple', required: false }
    ],
    returnType: 'void'
  },
  'table.cell_set_text': {
    parameters: [
      { name: 'id', type: 'table', qualifier: 'simple', required: true },
      { name: 'x', type: 'int', qualifier: 'simple', required: true },
      { name: 'y', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'table.cell_set_bgcolor': {
    parameters: [
      { name: 'id', type: 'table', qualifier: 'simple', required: true },
      { name: 'x', type: 'int', qualifier: 'simple', required: true },
      { name: 'y', type: 'int', qualifier: 'simple', required: true },
      { name: 'color', type: 'color', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'table.cell_set_text_color': {
    parameters: [
      { name: 'id', type: 'table', qualifier: 'simple', required: true },
      { name: 'x', type: 'int', qualifier: 'simple', required: true },
      { name: 'y', type: 'int', qualifier: 'simple', required: true },
      { name: 'color', type: 'color', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'table.cell_set_text_size': {
    parameters: [
      { name: 'id', type: 'table', qualifier: 'simple', required: true },
      { name: 'x', type: 'int', qualifier: 'simple', required: true },
      { name: 'y', type: 'int', qualifier: 'simple', required: true },
      { name: 'size', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'table.delete': {
    parameters: [
      { name: 'id', type: 'table', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },

  // Linefill functions
  'linefill.new': {
    parameters: [
      { name: 'line1', type: 'line', qualifier: 'simple', required: true },
      { name: 'line2', type: 'line', qualifier: 'simple', required: true },
      { name: 'color', type: 'color', qualifier: 'simple', required: false }
    ],
    returnType: 'linefill'
  },
  'linefill.set_color': {
    parameters: [
      { name: 'id', type: 'linefill', qualifier: 'simple', required: true },
      { name: 'color', type: 'color', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'linefill.delete': {
    parameters: [
      { name: 'id', type: 'linefill', qualifier: 'simple', required: true }
    ],
    returnType: 'void'
  },
  'linefill.get_line1': {
    parameters: [
      { name: 'id', type: 'linefill', qualifier: 'simple', required: true }
    ],
    returnType: 'line'
  },
  'linefill.get_line2': {
    parameters: [
      { name: 'id', type: 'linefill', qualifier: 'simple', required: true }
    ],
    returnType: 'line'
  },
  
  // Missing utility functions
  'runtime.error': {
    parameters: [
      { name: 'message', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'color.t': {
    parameters: [
      { name: 'color', type: 'color', qualifier: 'const', required: true }
    ],
    returnType: 'float'
  },
  
  // Missing syminfo functions
  'syminfo.prefix': {
    parameters: [
      { name: 'symbol', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'string'
  },
  'syminfo.ticker': {
    parameters: [
      { name: 'symbol', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'string'
  },
  
  // Missing timeframe functions
  'timeframe.change': {
    parameters: [
      { name: 'timeframe', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'bool'
  },
  'timeframe.from_seconds': {
    parameters: [
      { name: 'seconds', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'string'
  },
  'timeframe.in_seconds': {
    parameters: [
      { name: 'timeframe', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'int'
  },
  
  // Missing ticker functions
  'ticker.new': {
    parameters: [
      { name: 'prefix', type: 'string', qualifier: 'simple', required: true },
      { name: 'ticker', type: 'string', qualifier: 'simple', required: true },
      { name: 'session', type: 'string', qualifier: 'simple', required: false },
      { name: 'adjustment', type: 'string', qualifier: 'simple', required: false },
      { name: 'backadjustment', type: 'string', qualifier: 'simple', required: false },
      { name: 'settlement_as_close', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'string'
  },
  'ticker.modify': {
    parameters: [
      { name: 'tickerid', type: 'string', qualifier: 'simple', required: true },
      { name: 'session', type: 'string', qualifier: 'simple', required: false },
      { name: 'adjustment', type: 'string', qualifier: 'simple', required: false },
      { name: 'backadjustment', type: 'string', qualifier: 'simple', required: false },
      { name: 'settlement_as_close', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'string'
  },
  'ticker.heikinashi': {
    parameters: [
      { name: 'symbol', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'string'
  },
  'ticker.renko': {
    parameters: [
      { name: 'symbol', type: 'string', qualifier: 'simple', required: true },
      { name: 'style', type: 'string', qualifier: 'simple', required: true },
      { name: 'param', type: 'float', qualifier: 'simple', required: true },
      { name: 'request_wicks', type: 'bool', qualifier: 'simple', required: false },
      { name: 'source', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'string'
  },
  'ticker.linebreak': {
    parameters: [
      { name: 'symbol', type: 'string', qualifier: 'simple', required: true },
      { name: 'number_of_lines', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'string'
  },
  'ticker.kagi': {
    parameters: [
      { name: 'symbol', type: 'string', qualifier: 'simple', required: true },
      { name: 'reversal', type: 'float', qualifier: 'simple', required: true }
    ],
    returnType: 'string'
  },
  'ticker.pointfigure': {
    parameters: [
      { name: 'symbol', type: 'string', qualifier: 'simple', required: true },
      { name: 'source', type: 'string', qualifier: 'simple', required: true },
      { name: 'style', type: 'string', qualifier: 'simple', required: true },
      { name: 'param', type: 'float', qualifier: 'simple', required: true },
      { name: 'reversal', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'string'
  },
  'ticker.standard': {
    parameters: [
      { name: 'symbol', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'string'
  },
  'ticker.inherit': {
    parameters: [
      { name: 'from_tickerid', type: 'string', qualifier: 'simple', required: true },
      { name: 'symbol', type: 'string', qualifier: 'simple', required: true }
    ],
    returnType: 'string'
  },
  
  // Missing log functions
  'log.error': {
    parameters: [
      { name: 'message', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'log.info': {
    parameters: [
      { name: 'message', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'log.warning': {
    parameters: [
      { name: 'message', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  
  // Missing strategy functions  
  'strategy.exit': {
    parameters: [
      { name: 'id', type: 'string', qualifier: 'series', required: true },
      { name: 'from_entry', type: 'string', qualifier: 'series', required: false },
      { name: 'qty', type: 'float', qualifier: 'series', required: false },
      { name: 'qty_percent', type: 'float', qualifier: 'series', required: false },
      { name: 'profit', type: 'float', qualifier: 'series', required: false },
      { name: 'limit', type: 'float', qualifier: 'series', required: false },
      { name: 'loss', type: 'float', qualifier: 'series', required: false },
      { name: 'stop', type: 'float', qualifier: 'series', required: false },
      { name: 'trail_price', type: 'float', qualifier: 'series', required: false },
      { name: 'trail_points', type: 'float', qualifier: 'series', required: false },
      { name: 'trail_offset', type: 'float', qualifier: 'series', required: false },
      { name: 'oca_name', type: 'string', qualifier: 'series', required: false },
      { name: 'comment', type: 'string', qualifier: 'series', required: false },
      { name: 'alert_message', type: 'string', qualifier: 'series', required: false }
    ],
    returnType: 'void'
  },
  
  // Missing matrix functions
  'matrix.add_col': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true },
      { name: 'column', type: 'int', qualifier: 'series', required: false },
      { name: 'array_id', type: 'array', qualifier: 'any', required: false }
    ],
    returnType: 'void'
  },
  'matrix.add_row': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true },
      { name: 'row', type: 'int', qualifier: 'series', required: true },
      { name: 'array_id', type: 'array', qualifier: 'any', required: false }
    ],
    returnType: 'void'
  },
  'matrix.abs': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'matrix'
  },
  'matrix.avg': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'series'
  },
  'matrix.col': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true },
      { name: 'column', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'array'
  },
  'matrix.concat': {
    parameters: [
      { name: 'id1', type: 'matrix', qualifier: 'any', required: true },
      { name: 'id2', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'matrix'
  },
  'matrix.det': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'series'
  },
  'matrix.diff': {
    parameters: [
      { name: 'id1', type: 'matrix', qualifier: 'any', required: true },
      { name: 'id2', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'matrix'
  },
  'matrix.eigenvalues': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'array'
  },
  'matrix.eigenvectors': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'matrix'
  },
  'matrix.elements_count': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'int'
  },
  'matrix.inv': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'matrix'
  },
  'matrix.is_antidiagonal': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'bool'
  },
  'matrix.is_antisymmetric': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'bool'
  },
  'matrix.is_binary': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'bool'
  },
  'matrix.is_diagonal': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'bool'
  },
  'matrix.is_identity': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'bool'
  },
  'matrix.is_square': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'bool'
  },
  'matrix.is_stochastic': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'bool'
  },
  'matrix.is_symmetric': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'bool'
  },
  'matrix.is_triangular': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'bool'
  },
  'matrix.is_zero': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'bool'
  },
  'matrix.kron': {
    parameters: [
      { name: 'id1', type: 'matrix', qualifier: 'any', required: true },
      { name: 'id2', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'matrix'
  },
  'matrix.max': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'series'
  },
  'matrix.median': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'float'
  },
  'matrix.min': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'series'
  },
  'matrix.mode': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'float'
  },
  'matrix.mult': {
    parameters: [
      { name: 'id1', type: 'matrix', qualifier: 'any', required: true },
      { name: 'id2', type: 'any', qualifier: 'any', required: true }
    ],
    returnType: 'any'
  },
  'matrix.pinv': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'matrix'
  },
  'matrix.pow': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true },
      { name: 'power', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'matrix'
  },
  'matrix.rank': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'int'
  },
  'matrix.remove_col': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true },
      { name: 'column', type: 'int', qualifier: 'series', required: false }
    ],
    returnType: 'array'
  },
  'matrix.remove_row': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true },
      { name: 'row', type: 'int', qualifier: 'series', required: false }
    ],
    returnType: 'array'
  },
  'matrix.reshape': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true },
      { name: 'rows', type: 'int', qualifier: 'series', required: true },
      { name: 'columns', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'matrix.row': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true },
      { name: 'row', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'array'
  },
  'matrix.submatrix': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true },
      { name: 'from_row', type: 'int', qualifier: 'series', required: false },
      { name: 'to_row', type: 'int', qualifier: 'series', required: false },
      { name: 'from_column', type: 'int', qualifier: 'series', required: false },
      { name: 'to_column', type: 'int', qualifier: 'series', required: false }
    ],
    returnType: 'matrix'
  },
  'matrix.sum': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'float'
  },
  'matrix.sqrt': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'matrix'
  },
  'matrix.variance': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true },
      { name: 'biased', type: 'bool', qualifier: 'simple', required: false }
    ],
    returnType: 'float'
  },
  'matrix.stdev': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true },
      { name: 'biased', type: 'bool', qualifier: 'simple', required: false }
    ],
    returnType: 'float'
  },
  'matrix.covariance': {
    parameters: [
      { name: 'x', type: 'matrix', qualifier: 'any', required: true },
      { name: 'y', type: 'matrix', qualifier: 'any', required: true },
      { name: 'biased', type: 'bool', qualifier: 'simple', required: false }
    ],
    returnType: 'float'
  },
  'matrix.percentile_linear_interpolation': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true },
      { name: 'percentage', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'float'
  },
  'matrix.percentile_nearest_rank': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true },
      { name: 'percentage', type: 'int', qualifier: 'simple', required: true }
    ],
    returnType: 'float'
  },
  'matrix.swap_columns': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true },
      { name: 'column1', type: 'int', qualifier: 'series', required: true },
      { name: 'column2', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'matrix.swap_rows': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true },
      { name: 'row1', type: 'int', qualifier: 'series', required: true },
      { name: 'row2', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'matrix.trace': {
    parameters: [
      { name: 'id', type: 'matrix', qualifier: 'any', required: true }
    ],
    returnType: 'series'
  },
  
  // Missing label functions
  'label.copy': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'series', required: true }
    ],
    returnType: 'label'
  },
  'label.get_text': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'series', required: true }
    ],
    returnType: 'string'
  },
  'label.get_x': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'series', required: true }
    ],
    returnType: 'int'
  },
  'label.get_y': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'label.set_point': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'series', required: true },
      { name: 'point', type: 'any', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'label.set_text_font_family': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'series', required: true },
      { name: 'text_font_family', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'label.set_text_formatting': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'series', required: true },
      { name: 'text_formatting', type: 'string', qualifier: 'const', required: true }
    ],
    returnType: 'void'
  },
  'label.set_textalign': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'series', required: true },
      { name: 'textalign', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'label.set_textcolor': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'series', required: true },
      { name: 'textcolor', type: 'color', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'label.set_tooltip': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'series', required: true },
      { name: 'tooltip', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'label.set_xloc': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'series', required: true },
      { name: 'x', type: 'int', qualifier: 'series', required: true },
      { name: 'xloc', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'label.set_yloc': {
    parameters: [
      { name: 'id', type: 'label', qualifier: 'series', required: true },
      { name: 'yloc', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  
  // Missing line functions
  'line.copy': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'series', required: true }
    ],
    returnType: 'line'
  },
  'line.get_price': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'series', required: true },
      { name: 'x', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'line.get_x1': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'series', required: true }
    ],
    returnType: 'int'
  },
  'line.get_x2': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'series', required: true }
    ],
    returnType: 'int'
  },
  'line.get_y1': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'line.get_y2': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'line.set_extend': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'series', required: true },
      { name: 'extend', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'line.set_first_point': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'series', required: true },
      { name: 'point', type: 'any', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'line.set_second_point': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'series', required: true },
      { name: 'point', type: 'any', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'line.set_x1': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'series', required: true },
      { name: 'x', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'line.set_x2': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'series', required: true },
      { name: 'x', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'line.set_xloc': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'series', required: true },
      { name: 'x1', type: 'int', qualifier: 'series', required: true },
      { name: 'x2', type: 'int', qualifier: 'series', required: true },
      { name: 'xloc', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'line.set_y1': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'series', required: true },
      { name: 'y', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'line.set_y2': {
    parameters: [
      { name: 'id', type: 'line', qualifier: 'series', required: true },
      { name: 'y', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  
  // Missing table functions
  'table.cell_set_height': {
    parameters: [
      { name: 'table_id', type: 'table', qualifier: 'series', required: true },
      { name: 'column', type: 'int', qualifier: 'series', required: true },
      { name: 'row', type: 'int', qualifier: 'series', required: true },
      { name: 'height', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'table.cell_set_text_font_family': {
    parameters: [
      { name: 'table_id', type: 'table', qualifier: 'series', required: true },
      { name: 'column', type: 'int', qualifier: 'series', required: true },
      { name: 'row', type: 'int', qualifier: 'series', required: true },
      { name: 'text_font_family', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'table.cell_set_text_formatting': {
    parameters: [
      { name: 'table_id', type: 'table', qualifier: 'series', required: true },
      { name: 'column', type: 'int', qualifier: 'series', required: true },
      { name: 'row', type: 'int', qualifier: 'series', required: true },
      { name: 'text_formatting', type: 'string', qualifier: 'const', required: true }
    ],
    returnType: 'void'
  },
  'table.cell_set_text_halign': {
    parameters: [
      { name: 'table_id', type: 'table', qualifier: 'series', required: true },
      { name: 'column', type: 'int', qualifier: 'series', required: true },
      { name: 'row', type: 'int', qualifier: 'series', required: true },
      { name: 'text_halign', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'table.cell_set_text_valign': {
    parameters: [
      { name: 'table_id', type: 'table', qualifier: 'series', required: true },
      { name: 'column', type: 'int', qualifier: 'series', required: true },
      { name: 'row', type: 'int', qualifier: 'series', required: true },
      { name: 'text_valign', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'table.cell_set_tooltip': {
    parameters: [
      { name: 'table_id', type: 'table', qualifier: 'series', required: true },
      { name: 'column', type: 'int', qualifier: 'series', required: true },
      { name: 'row', type: 'int', qualifier: 'series', required: true },
      { name: 'tooltip', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'table.cell_set_width': {
    parameters: [
      { name: 'table_id', type: 'table', qualifier: 'series', required: true },
      { name: 'column', type: 'int', qualifier: 'series', required: true },
      { name: 'row', type: 'int', qualifier: 'series', required: true },
      { name: 'width', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'table.clear': {
    parameters: [
      { name: 'table_id', type: 'table', qualifier: 'series', required: true },
      { name: 'start_column', type: 'int', qualifier: 'series', required: true },
      { name: 'start_row', type: 'int', qualifier: 'series', required: true },
      { name: 'end_column', type: 'int', qualifier: 'series', required: false },
      { name: 'end_row', type: 'int', qualifier: 'series', required: false }
    ],
    returnType: 'void'
  },
  'table.merge_cells': {
    parameters: [
      { name: 'table_id', type: 'table', qualifier: 'series', required: true },
      { name: 'start_column', type: 'int', qualifier: 'series', required: true },
      { name: 'start_row', type: 'int', qualifier: 'series', required: true },
      { name: 'end_column', type: 'int', qualifier: 'series', required: true },
      { name: 'end_row', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'table.set_bgcolor': {
    parameters: [
      { name: 'table_id', type: 'table', qualifier: 'series', required: true },
      { name: 'bgcolor', type: 'color', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'table.set_border_color': {
    parameters: [
      { name: 'table_id', type: 'table', qualifier: 'series', required: true },
      { name: 'border_color', type: 'color', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'table.set_border_width': {
    parameters: [
      { name: 'table_id', type: 'table', qualifier: 'series', required: true },
      { name: 'border_width', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'table.set_frame_color': {
    parameters: [
      { name: 'table_id', type: 'table', qualifier: 'series', required: true },
      { name: 'frame_color', type: 'color', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'table.set_frame_width': {
    parameters: [
      { name: 'table_id', type: 'table', qualifier: 'series', required: true },
      { name: 'frame_width', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  'table.set_position': {
    parameters: [
      { name: 'table_id', type: 'table', qualifier: 'series', required: true },
      { name: 'position', type: 'string', qualifier: 'series', required: true }
    ],
    returnType: 'void'
  },
  
  // Missing strategy functions - closedtrades
  'strategy.closedtrades.commission': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.closedtrades.entry_bar_index': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'int'
  },
  'strategy.closedtrades.entry_comment': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'string'
  },
  'strategy.closedtrades.entry_id': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'string'
  },
  'strategy.closedtrades.entry_price': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.closedtrades.entry_time': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'int'
  },
  'strategy.closedtrades.exit_bar_index': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'int'
  },
  'strategy.closedtrades.exit_comment': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'string'
  },
  'strategy.closedtrades.exit_id': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'string'
  },
  'strategy.closedtrades.exit_price': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.closedtrades.exit_time': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'int'
  },
  'strategy.closedtrades.max_drawdown': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.closedtrades.max_drawdown_percent': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.closedtrades.max_runup': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.closedtrades.max_runup_percent': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.closedtrades.profit': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.closedtrades.profit_percent': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.closedtrades.size': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  
  // Missing strategy functions - opentrades
  'strategy.opentrades.commission': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.opentrades.entry_bar_index': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'int'
  },
  'strategy.opentrades.entry_comment': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'string'
  },
  'strategy.opentrades.entry_id': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'string'
  },
  'strategy.opentrades.entry_price': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.opentrades.entry_time': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'int'
  },
  'strategy.opentrades.max_drawdown': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.opentrades.max_drawdown_percent': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.opentrades.max_runup': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.opentrades.max_runup_percent': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.opentrades.profit': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.opentrades.profit_percent': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.opentrades.size': {
    parameters: [
      { name: 'trade_num', type: 'int', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  
  // Missing strategy risk functions
  'strategy.convert_to_account': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.convert_to_symbol': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.default_entry_qty': {
    parameters: [
      { name: 'fill_price', type: 'float', qualifier: 'series', required: true }
    ],
    returnType: 'float'
  },
  'strategy.risk.max_cons_loss_days': {
    parameters: [
      { name: 'count', type: 'int', qualifier: 'simple', required: true },
      { name: 'alert_message', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'void'
  },
  'strategy.risk.max_intraday_loss': {
    parameters: [
      { name: 'value', type: 'float', qualifier: 'simple', required: true },
      { name: 'type', type: 'string', qualifier: 'simple', required: true },
      { name: 'alert_message', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'void'
  },


  // Essential new functions only
  'alert': {
    parameters: [
      { name: 'message', type: 'string', qualifier: 'series', required: true },
      { name: 'freq', type: 'string', qualifier: 'simple', required: false }
    ],
    returnType: 'void'
  },
  'barcolor': {
    parameters: [
      { name: 'color', type: 'color', qualifier: 'series', required: true },
      { name: 'offset', type: 'int', qualifier: 'series', required: false },
      { name: 'editable', type: 'bool', qualifier: 'const', required: false },
      { name: 'show_last', type: 'int', qualifier: 'input', required: false },
      { name: 'title', type: 'string', qualifier: 'const', required: false },
      { name: 'display', type: 'string', qualifier: 'const', required: false }
    ],
    returnType: 'void'
  }
};
