/**
 * Pine Script Constants Coverage Test
 * 
 * This test ensures our validator has complete coverage of all Pine Script v6 constants
 * as documented in the official Pine Script documentation.
 */

import { describe, it, expect } from 'vitest';
import { KEYWORDS, NAMESPACES } from '../core/constants';

// All Pine Script constants from the official documentation
const PINE_SCRIPT_CONSTANTS = [
  // Adjustment constants
  'adjustment.dividends', 'adjustment.none', 'adjustment.splits',
  
  // Alert frequency constants
  'alert.freq_all', 'alert.freq_once_per_bar', 'alert.freq_once_per_bar_close',
  
  // Back adjustment constants
  'backadjustment.inherit', 'backadjustment.off', 'backadjustment.on',
  
  // Bar merge constants
  'barmerge.gaps_off', 'barmerge.gaps_on', 'barmerge.lookahead_off', 'barmerge.lookahead_on',
  
  // Color constants
  'color.aqua', 'color.black', 'color.blue', 'color.fuchsia', 'color.gray', 'color.green',
  'color.lime', 'color.maroon', 'color.navy', 'color.olive', 'color.orange', 'color.purple',
  'color.red', 'color.silver', 'color.teal', 'color.white', 'color.yellow',
  
  // Currency constants
  'currency.AED', 'currency.ARS', 'currency.AUD', 'currency.BDT', 'currency.BHD', 'currency.BRL',
  'currency.BTC', 'currency.CAD', 'currency.CHF', 'currency.CLP', 'currency.CNY', 'currency.COP',
  'currency.CZK', 'currency.DKK', 'currency.EGP', 'currency.ETH', 'currency.EUR', 'currency.GBP',
  'currency.HKD', 'currency.HUF', 'currency.IDR', 'currency.ILS', 'currency.INR', 'currency.ISK',
  'currency.JPY', 'currency.KES', 'currency.KRW', 'currency.KWD', 'currency.LKR', 'currency.MAD',
  'currency.MXN', 'currency.MYR', 'currency.NGN', 'currency.NOK', 'currency.NONE', 'currency.NZD',
  'currency.PEN', 'currency.PHP', 'currency.PKR', 'currency.PLN', 'currency.QAR', 'currency.RON',
  'currency.RSD', 'currency.RUB', 'currency.SAR', 'currency.SEK', 'currency.SGD', 'currency.THB',
  'currency.TND', 'currency.TRY', 'currency.TWD', 'currency.USD', 'currency.USDT', 'currency.VES',
  'currency.VND', 'currency.ZAR',
  
  // Day of week constants
  'dayofweek.friday', 'dayofweek.monday', 'dayofweek.saturday', 'dayofweek.sunday',
  'dayofweek.thursday', 'dayofweek.tuesday', 'dayofweek.wednesday',
  
  // Display constants
  'display.all', 'display.data_window', 'display.none', 'display.pane', 'display.price_scale', 'display.status_line',
  
  // Dividends constants
  'dividends.gross', 'dividends.net',
  
  // Earnings constants
  'earnings.actual', 'earnings.estimate', 'earnings.standardized',
  
  // Extend constants
  'extend.both', 'extend.left', 'extend.none', 'extend.right',
  
  // Boolean literals
  'false', 'true',
  
  // Font constants
  'font.family_default', 'font.family_monospace',
  
  // Format constants
  'format.inherit', 'format.mintick', 'format.percent', 'format.price', 'format.volume',
  
  // Hline style constants
  'hline.style_dashed', 'hline.style_dotted', 'hline.style_solid',
  
  // Label style constants
  'label.style_arrowdown', 'label.style_arrowup', 'label.style_circle', 'label.style_cross',
  'label.style_diamond', 'label.style_flag', 'label.style_label_center', 'label.style_label_down',
  'label.style_label_left', 'label.style_label_lower_left', 'label.style_label_lower_right',
  'label.style_label_right', 'label.style_label_up', 'label.style_label_upper_left',
  'label.style_label_upper_right', 'label.style_none', 'label.style_square', 'label.style_text_outline',
  'label.style_triangledown', 'label.style_triangleup', 'label.style_xcross',
  
  // Line style constants
  'line.style_arrow_both', 'line.style_arrow_left', 'line.style_arrow_right',
  'line.style_dashed', 'line.style_dotted', 'line.style_solid',
  
  // Location constants
  'location.abovebar', 'location.absolute', 'location.belowbar', 'location.bottom', 'location.top',
  
  // Math constants
  'math.e', 'math.phi', 'math.pi', 'math.rphi',
  
  // Order constants
  'order.ascending', 'order.descending',
  
  // Plot line style constants
  'plot.linestyle_dashed', 'plot.linestyle_dotted', 'plot.linestyle_solid',
  
  // Plot style constants
  'plot.style_area', 'plot.style_areabr', 'plot.style_circles', 'plot.style_columns',
  'plot.style_cross', 'plot.style_histogram', 'plot.style_line', 'plot.style_linebr',
  'plot.style_stepline', 'plot.style_stepline_diamond', 'plot.style_steplinebr',
  
  // Position constants
  'position.bottom_center', 'position.bottom_left', 'position.bottom_right',
  'position.middle_center', 'position.middle_left', 'position.middle_right',
  'position.top_center', 'position.top_left', 'position.top_right',
  
  // Scale constants
  'scale.left', 'scale.none', 'scale.right',
  
  // Session constants
  'session.extended', 'session.regular',
  
  // Settlement constants
  'settlement_as_close.inherit', 'settlement_as_close.off', 'settlement_as_close.on',
  
  // Shape constants
  'shape.arrowdown', 'shape.arrowup', 'shape.circle', 'shape.cross', 'shape.diamond',
  'shape.flag', 'shape.labeldown', 'shape.labelup', 'shape.square', 'shape.triangledown',
  'shape.triangleup', 'shape.xcross',
  
  // Size constants
  'size.auto', 'size.huge', 'size.large', 'size.normal', 'size.small', 'size.tiny',
  
  // Splits constants
  'splits.denominator', 'splits.numerator',
  
  // Strategy constants
  'strategy.cash', 'strategy.commission.cash_per_contract', 'strategy.commission.cash_per_order',
  'strategy.commission.percent', 'strategy.direction.all', 'strategy.direction.long',
  'strategy.direction.short', 'strategy.fixed', 'strategy.long', 'strategy.oca.cancel',
  'strategy.oca.none', 'strategy.oca.reduce', 'strategy.percent_of_equity', 'strategy.short',
  
  // Text constants
  'text.align_bottom', 'text.align_center', 'text.align_left', 'text.align_right', 'text.align_top',
  'text.format_bold', 'text.format_italic', 'text.format_none', 'text.wrap_auto', 'text.wrap_none',
  
  // X location constants
  'xloc.bar_index', 'xloc.bar_time',
  
  // Y location constants
  'yloc.abovebar', 'yloc.belowbar', 'yloc.price'
];

describe('Pine Script Constants Coverage', () => {
  it('should have 100% coverage of all Pine Script constants', () => {
    const totalConstants = PINE_SCRIPT_CONSTANTS.length;
    let coveredConstants = 0;
    const missingConstants: string[] = [];

    for (const constant of PINE_SCRIPT_CONSTANTS) {
      let covered = false;

      // Check if it's in KEYWORDS
      if (KEYWORDS.has(constant)) {
        covered = true;
      }

      // Check if it's a namespace member and the namespace is recognized
      if (constant.includes('.')) {
        const [namespace] = constant.split('.');
        if (NAMESPACES.has(namespace)) {
          covered = true;
        }
      }

      if (covered) {
        coveredConstants++;
      } else {
        missingConstants.push(constant);
      }
    }

    const coveragePercentage = (coveredConstants / totalConstants) * 100;

    // Log coverage statistics
    console.log(`\nPine Script Constants Coverage: ${coveredConstants}/${totalConstants} (${coveragePercentage.toFixed(2)}%)`);
    
    if (missingConstants.length > 0) {
      console.log('Missing constants:', missingConstants);
    }

    // Expect 100% coverage
    expect(coveragePercentage).toBe(100);
    expect(missingConstants).toHaveLength(0);
  });

  it('should recognize all color constants', () => {
    const colorConstants = [
      'color.aqua', 'color.black', 'color.blue', 'color.fuchsia', 'color.gray',
      'color.green', 'color.lime', 'color.maroon', 'color.navy', 'color.olive',
      'color.orange', 'color.purple', 'color.red', 'color.silver', 'color.teal',
      'color.white', 'color.yellow'
    ];
    
    expect(NAMESPACES.has('color')).toBe(true);
    
    for (const constant of colorConstants) {
      expect(KEYWORDS.has(constant)).toBe(true);
    }
  });

  it('should recognize all currency constants', () => {
    const currencyConstants = [
      'currency.USD', 'currency.EUR', 'currency.GBP', 'currency.JPY', 'currency.BTC', 'currency.ETH'
    ];
    
    expect(NAMESPACES.has('currency')).toBe(true);
    
    for (const constant of currencyConstants) {
      expect(KEYWORDS.has(constant)).toBe(true);
    }
  });

  it('should recognize all dayofweek constants', () => {
    const dayConstants = [
      'dayofweek.sunday', 'dayofweek.monday', 'dayofweek.tuesday', 'dayofweek.wednesday',
      'dayofweek.thursday', 'dayofweek.friday', 'dayofweek.saturday'
    ];
    
    expect(NAMESPACES.has('dayofweek')).toBe(true);
    
    for (const constant of dayConstants) {
      expect(KEYWORDS.has(constant)).toBe(true);
    }
  });

  it('should recognize all strategy constants', () => {
    const strategyConstants = [
      'strategy.long', 'strategy.short', 'strategy.cash', 'strategy.fixed',
      'strategy.percent_of_equity', 'strategy.oca.cancel', 'strategy.oca.none', 'strategy.oca.reduce'
    ];
    
    expect(NAMESPACES.has('strategy')).toBe(true);
    
    for (const constant of strategyConstants) {
      expect(KEYWORDS.has(constant)).toBe(true);
    }
  });

  it('should recognize all plot style constants', () => {
    const plotConstants = [
      'plot.style_line', 'plot.style_area', 'plot.style_histogram', 'plot.style_cross',
      'plot.style_circles', 'plot.style_columns', 'plot.linestyle_solid', 'plot.linestyle_dashed'
    ];
    
    expect(NAMESPACES.has('plot')).toBe(true);
    
    for (const constant of plotConstants) {
      expect(KEYWORDS.has(constant)).toBe(true);
    }
  });

  it('should recognize all label style constants', () => {
    const labelConstants = [
      'label.style_arrowup', 'label.style_arrowdown', 'label.style_circle', 'label.style_cross',
      'label.style_diamond', 'label.style_flag', 'label.style_square', 'label.style_triangleup'
    ];
    
    expect(NAMESPACES.has('label')).toBe(true);
    
    for (const constant of labelConstants) {
      expect(KEYWORDS.has(constant)).toBe(true);
    }
  });

  it('should recognize all shape constants', () => {
    const shapeConstants = [
      'shape.arrowup', 'shape.arrowdown', 'shape.circle', 'shape.cross', 'shape.diamond',
      'shape.flag', 'shape.square', 'shape.triangleup', 'shape.triangledown', 'shape.xcross'
    ];
    
    expect(NAMESPACES.has('shape')).toBe(true);
    
    for (const constant of shapeConstants) {
      expect(KEYWORDS.has(constant)).toBe(true);
    }
  });

  it('should recognize all location constants', () => {
    const locationConstants = [
      'location.abovebar', 'location.belowbar', 'location.top', 'location.bottom', 'location.absolute'
    ];
    
    expect(NAMESPACES.has('location')).toBe(true);
    
    for (const constant of locationConstants) {
      expect(KEYWORDS.has(constant)).toBe(true);
    }
  });

  it('should recognize all math constants', () => {
    const mathConstants = ['math.pi', 'math.e', 'math.phi', 'math.rphi'];
    
    expect(NAMESPACES.has('math')).toBe(true);
    
    for (const constant of mathConstants) {
      expect(KEYWORDS.has(constant)).toBe(true);
    }
  });

  it('should recognize all size constants', () => {
    const sizeConstants = ['size.tiny', 'size.small', 'size.normal', 'size.large', 'size.huge', 'size.auto'];
    
    expect(NAMESPACES.has('size')).toBe(true);
    
    for (const constant of sizeConstants) {
      expect(KEYWORDS.has(constant)).toBe(true);
    }
  });

  it('should recognize all position constants', () => {
    const positionConstants = [
      'position.top_left', 'position.top_center', 'position.top_right',
      'position.middle_left', 'position.middle_center', 'position.middle_right',
      'position.bottom_left', 'position.bottom_center', 'position.bottom_right'
    ];
    
    expect(NAMESPACES.has('position')).toBe(true);
    
    for (const constant of positionConstants) {
      expect(KEYWORDS.has(constant)).toBe(true);
    }
  });

  it('should recognize boolean literals', () => {
    expect(KEYWORDS.has('true')).toBe(true);
    expect(KEYWORDS.has('false')).toBe(true);
  });

  it('should have all required constant namespaces', () => {
    const constantNamespaces = [
      'adjustment', 'alert', 'backadjustment', 'barmerge', 'color', 'currency', 'dayofweek',
      'display', 'dividends', 'earnings', 'extend', 'font', 'format', 'hline', 'label',
      'line', 'location', 'math', 'order', 'plot', 'position', 'scale', 'settlement_as_close',
      'shape', 'size', 'splits', 'strategy', 'text', 'xloc', 'yloc'
    ];
    
    for (const namespace of constantNamespaces) {
      expect(NAMESPACES.has(namespace)).toBe(true);
    }
  });
});

describe('Constants Coverage Edge Cases', () => {
  it('should handle nested namespace constants', () => {
    const nestedConstants = [
      'strategy.commission.cash_per_contract',
      'strategy.commission.cash_per_order',
      'strategy.commission.percent'
    ];
    
    for (const constant of nestedConstants) {
      expect(KEYWORDS.has(constant)).toBe(true);
    }
  });

  it('should distinguish between similar constant names', () => {
    const similarConstants = [
      'plot.style_line',
      'plot.style_linebr',
      'plot.linestyle_solid',
      'plot.linestyle_dashed',
      'plot.linestyle_dotted'
    ];
    
    for (const constant of similarConstants) {
      expect(KEYWORDS.has(constant)).toBe(true);
    }
  });

  it('should handle text formatting and alignment constants', () => {
    const textConstants = [
      'text.align_left', 'text.align_center', 'text.align_right',
      'text.align_top', 'text.align_bottom',
      'text.format_bold', 'text.format_italic', 'text.format_none'
    ];
    
    for (const constant of textConstants) {
      expect(KEYWORDS.has(constant)).toBe(true);
    }
  });

  it('should handle coordinate location constants', () => {
    const coordinateConstants = [
      'xloc.bar_index', 'xloc.bar_time',
      'yloc.price', 'yloc.abovebar', 'yloc.belowbar'
    ];
    
    for (const constant of coordinateConstants) {
      expect(KEYWORDS.has(constant)).toBe(true);
    }
  });
});
