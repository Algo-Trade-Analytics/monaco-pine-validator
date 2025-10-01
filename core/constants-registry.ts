/**
 * Central registry of constant sets used by validators.
 * This consolidates scattered literals to a single source of truth.
 */

// Built-in / display / format / extend / scale
export const DISPLAY_CONSTANTS_EXTENDED = new Set<string>([
  'display.all', 'display.data_window', 'display.none',
  'display.pane', 'display.price_scale', 'display.status_line',
  'display.price_scale_only', 'display.data_window_only'
]);

export const TEXT_FORMAT_CONSTANTS_EXTENDED = new Set<string>([
  'text.format_none', 'text.format_bold', 'text.format_italic',
  'text.format_bold_italic', 'text.format_underline', 'text.format_strikethrough'
]);

// Advanced session/timezone
export const SESSION_ADVANCED_CONSTANTS = new Set<string>([
  'session.isextended_hours','session.premarket_start','session.postmarket_end','session.trading_halt_status'
]);

// Advanced syminfo variables (fundamental/derivatives)
export const SYMINFO_ADVANCED_VARS = new Set<string>([
  'syminfo.market_cap','syminfo.pe_ratio','syminfo.dividend_yield','syminfo.beta','syminfo.avg_volume_30d',
  'syminfo.contract_size','syminfo.tick_value','syminfo.margin_requirement','syminfo.country','syminfo.sector',
  'syminfo.industry','syminfo.employees','syminfo.shareholders','syminfo.shares_outstanding_float',
  'syminfo.shares_outstanding_total','syminfo.current_contract','syminfo.expiration_date','syminfo.mincontract',
  'syminfo.root','syminfo.volumetype','syminfo.recommendations_buy','syminfo.recommendations_buy_strong',
  'syminfo.recommendations_sell','syminfo.recommendations_sell_strong','syminfo.recommendations_hold',
  'syminfo.recommendations_total','syminfo.recommendations_date','syminfo.target_price_average',
  'syminfo.target_price_high','syminfo.target_price_low','syminfo.target_price_median',
  'syminfo.target_price_estimates','syminfo.target_price_date'
]);

// Specialized drawing/table and strategy extras
export const DRAW_TABLE_EXTRA_CONSTANTS = new Set<string>([
  'box.border_style_double','table.cell_merge_horizontal','table.cell_merge_vertical'
]);

export const STRATEGY_RISK_EXTRA_CONSTANTS = new Set<string>([
  'strategy.risk.max_consecutive_losses',
  'strategy.risk.max_daily_loss',
  'strategy.risk.position_size_limit'
]);

export const STRATEGY_COMMISSION_EXTRA_CONSTANTS = new Set<string>([
  'strategy.commission.basis_points',
  'strategy.commission.per_share_tiered'
]);

// Built-in variable constants (moved from individual validators)
export const TIMEFRAME_CONSTANTS = new Set<string>([
  'timeframe.period', 'timeframe.multiplier', 'timeframe.main_period',
  'timeframe.isdaily', 'timeframe.isweekly', 'timeframe.ismonthly',
  'timeframe.isminutes', 'timeframe.isseconds', 'timeframe.isintraday',
  'timeframe.isdwm', 'timeframe.isticks'
]);

export const CURRENCY_CONSTANTS = new Set<string>([
  'currency.USD', 'currency.EUR', 'currency.GBP', 'currency.JPY',
  'currency.CHF', 'currency.CAD', 'currency.AUD', 'currency.NZD',
  'currency.CNY', 'currency.INR', 'currency.KRW', 'currency.BRL',
  'currency.RUB', 'currency.MXN', 'currency.SEK', 'currency.NOK',
  'currency.DKK', 'currency.PLN', 'currency.TRY', 'currency.ZAR'
]);

// Day of week constants
export const DAYOFWEEK_CONSTANTS = new Set<string>([
  'dayofweek.sunday', 'dayofweek.monday', 'dayofweek.tuesday', 'dayofweek.wednesday',
  'dayofweek.thursday', 'dayofweek.friday', 'dayofweek.saturday'
]);

// Bar merge constants
export const BARMERGE_CONSTANTS = new Set<string>([
  'barmerge.gaps_on', 'barmerge.gaps_off', 'barmerge.lookahead_on', 'barmerge.lookahead_off'
]);

// X/Y location constants
export const XLOC_YLOC_CONSTANTS = new Set<string>([
  'xloc.bar_index', 'xloc.bar_time', 'yloc.price', 'yloc.abovebar', 'yloc.belowbar'
]);

export const EXTEND_CONSTANTS = new Set<string>([
  'extend.none', 'extend.left', 'extend.right', 'extend.both'
]);

export const LOCATION_CONSTANTS = new Set<string>([
  'location.abovebar', 'location.belowbar', 'location.top', 'location.bottom', 'location.absolute'
]);

export const SHAPE_CONSTANTS = new Set<string>([
  'shape.arrowdown', 'shape.arrowup', 'shape.circle', 'shape.cross', 'shape.diamond', 'shape.flag',
  'shape.labeldown', 'shape.labelup', 'shape.square', 'shape.triangledown', 'shape.triangleup', 'shape.xcross'
]);

export const SIZE_CONSTANTS = new Set<string>([
  'size.tiny', 'size.small', 'size.normal', 'size.large', 'size.huge', 'size.auto'
]);

// Style constant sets used by final constants validator and drawing
export const PLOT_STYLE_CONSTANTS = new Set<string>([
  'plot.style_line', 'plot.style_stepline', 'plot.style_stepline_diamond',
  'plot.style_histogram', 'plot.style_cross', 'plot.style_area', 'plot.style_areabr',
  'plot.style_columns', 'plot.style_circles', 'plot.style_linebr', 'plot.style_steplinebr'
]);

export const LINE_STYLE_CONSTANTS = new Set<string>([
  'line.style_solid', 'line.style_dotted', 'line.style_dashed',
  'line.style_arrow_left', 'line.style_arrow_right', 'line.style_arrow_both'
]);

export const LABEL_STYLE_CONSTANTS = new Set<string>([
  'label.style_none', 'label.style_xcross', 'label.style_cross', 'label.style_triangleup',
  'label.style_triangledown', 'label.style_flag', 'label.style_circle', 'label.style_arrowup',
  'label.style_arrowdown', 'label.style_label_up', 'label.style_label_down',
  'label.style_label_left', 'label.style_label_right', 'label.style_label_lower_left',
  'label.style_label_lower_right', 'label.style_label_upper_left', 'label.style_label_upper_right',
  'label.style_label_center', 'label.style_square', 'label.style_diamond', 'label.style_text_outline'
]);

export const HLINE_STYLE_CONSTANTS = new Set<string>([
  'hline.style_solid', 'hline.style_dotted', 'hline.style_dashed'
]);

export const ORDER_CONSTANTS = new Set<string>([
  'order.ascending', 'order.descending'
]);

export const POSITION_CONSTANTS = new Set<string>([
  'position.top_left', 'position.top_center', 'position.top_right',
  'position.middle_left', 'position.middle_center', 'position.middle_right',
  'position.bottom_left', 'position.bottom_center', 'position.bottom_right'
]);
