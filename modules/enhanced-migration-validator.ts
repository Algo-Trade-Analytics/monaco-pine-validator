/**
 * Enhanced Migration Validator Module
 * 
 * Handles enhanced migration validation for Pine Script v6:
 * - PSV6-MIG-SYNTAX: Old syntax patterns
 */

import { ValidationModule } from '../core/types';

export class EnhancedMigrationValidator implements ValidationModule {
  name = 'EnhancedMigrationValidator';
  priority = 75; // Run after basic syntax validation

  getDependencies(): string[] {
    return ['CoreValidator', 'SyntaxValidator'];
  }

  validate(context: any, config: any): any {
    const result = {
      errors: [],
      warnings: [],
      info: [],
      typeMap: new Map()
    };

    // Validate old syntax patterns for each line
    for (let i = 0; i < context.lines.length; i++) {
      const line = context.lines[i];
      const lineNum = i + 1;
      
      this.validateOldSyntaxPatterns(line, lineNum, result);
    }

    return result;
  }

  /**
   * PSV6-MIG-SYNTAX: Validate old syntax patterns
   * Suggests v6 syntax for deprecated patterns
   */
  private validateOldSyntaxPatterns(line: string, lineNum: number, result: any): void {
    // Check for study() instead of indicator()
    if (/\bstudy\s*\(/.test(line)) {
      result.warnings.push({
        line: lineNum,
        column: 1,
        message: `'study()' is deprecated in Pine Script v6. Use 'indicator()' instead.`,
        severity: 'warning',
        code: 'PSV6-MIG-SYNTAX',
        suggestion: 'Replace study() with indicator()'
      });
    }

    // Check for transp parameter instead of color.new()
    if (/\btransp\s*=/.test(line)) {
      result.warnings.push({
        line: lineNum,
        column: 1,
        message: `'transp' parameter is deprecated in Pine Script v6. Use 'color.new()' instead.`,
        severity: 'warning',
        code: 'PSV6-MIG-SYNTAX',
        suggestion: 'Replace transp=50 with color.new(color.red, 50)'
      });
    }

    // Check for security() instead of request.security()
    const securityRegex = /\bsecurity\s*\(/g;
    let securityMatch;
    while ((securityMatch = securityRegex.exec(line)) !== null) {
      // Check if this function is already namespaced by looking at the context before it
      const beforeMatch = line.substring(0, securityMatch.index);
      const lastWord = beforeMatch.match(/\b(\w+)\s*\.?\s*$/);
      
      // Skip if the function is already namespaced (preceded by request., ta., math., str., etc.)
      if (lastWord && ['request', 'ta', 'math', 'str', 'color', 'input', 'strategy', 'runtime', 'log', 'alert', 'barstate', 'syminfo', 'timeframe', 'session'].includes(lastWord[1])) {
        continue;
      }
      result.warnings.push({
        line: lineNum,
        column: securityMatch.index + 1,
        message: `'security()' is deprecated in Pine Script v6. Use 'request.security()' instead.`,
        severity: 'warning',
        code: 'PSV6-MIG-SYNTAX',
        suggestion: 'Replace security() with request.security()'
      });
    }

    // Check for non-namespaced TA functions
    const nonNamespacedTA = [
      'sma', 'ema', 'rsi', 'macd', 'stoch', 'atr', 'bb', 'highest', 'lowest',
      'crossover', 'crossunder', 'sar', 'roc', 'mom', 'change', 'correlation',
      'dev', 'linreg', 'percentile_linear_interpolation', 'percentile_nearest_rank', 'percentrank',
      'pivothigh', 'pivotlow', 'range', 'stdev', 'variance', 'wma', 'alma',
      'vwma', 'swma', 'rma', 'hma', 'tsi', 'cci', 'cmo', 'mfi', 'obv',
      'pvt', 'nvi', 'pvi', 'wad'
    ];

    for (const func of nonNamespacedTA) {
      // Check for non-namespaced function calls
      const regex = new RegExp(`\\b${func}\\s*\\(`, 'g');
      let match;
      while ((match = regex.exec(line)) !== null) {
        // Check if this function is already namespaced by looking at the context before it
        const beforeMatch = line.substring(0, match.index);
        const lastWord = beforeMatch.match(/\b(\w+)\s*\.?\s*$/);
        
        // Skip if the function is already namespaced (preceded by ta., math., str., etc.)
        if (lastWord && ['ta', 'math', 'str', 'array', 'matrix', 'map', 'color', 'request', 'input', 'strategy', 'runtime', 'log', 'alert', 'barstate', 'syminfo', 'timeframe', 'session'].includes(lastWord[1])) {
          continue;
        }
        result.warnings.push({
          line: lineNum,
          column: match.index + 1,
          message: `'${func}()' should be namespaced in Pine Script v6. Use 'ta.${func}()' instead.`,
          severity: 'warning',
          code: 'PSV6-MIG-SYNTAX',
          suggestion: `Replace ${func}() with ta.${func}()`
        });
      }
    }
  }
}
