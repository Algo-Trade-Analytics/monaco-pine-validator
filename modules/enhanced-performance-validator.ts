/**
 * Enhanced Performance Validator Module
 * 
 * Handles enhanced performance validation for Pine Script v6:
 * - PSV6-PERF-TA: Expensive TA functions in nested loops
 */

import { ValidationModule } from '../core/types';

export class EnhancedPerformanceValidator implements ValidationModule {
  name = 'EnhancedPerformanceValidator';
  priority = 70; // Run after basic syntax validation

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

    this.validateExpensiveFunctionsInNestedLoops(context.lines, result);
    this.validateRepaintIssues(context.lines, result);
    this.validateAlertConsolidation(context.lines, result);

    return result;
  }

  /**
   * PSV6-PERF-TA: Validate expensive TA functions in nested loops
   * Warns about expensive functions like pivothigh, pivotlow, request.security in nested loops
   */
  private validateExpensiveFunctionsInNestedLoops(lines: string[], result: any): void {
    const expensiveFunctions = [
      'pivothigh', 'pivotlow', 'request.security', 'request.security_lower_tf',
      'ta.highest', 'ta.lowest', 'ta.pivothigh', 'ta.pivotlow',
      'highest', 'lowest' // Non-namespaced versions
    ];
    
    const loopStack: Array<{ indent: number; lineNum: number }> = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const indent = this.getLineIndentation(line);
      
      // Remove loops that we've exited (unindented) - do this BEFORE checking for new loops
      while (loopStack.length > 0 && indent <= loopStack[loopStack.length - 1].indent) {
        loopStack.pop();
      }
      
      // Check if this line starts a loop
      if (/^\s*(for|while)\b/.test(line)) {
        loopStack.push({ indent, lineNum });
      }
      
      // If we're in a nested loop (more than one loop level)
      if (loopStack.length > 1) {
        // Check for expensive functions in this line
        for (const func of expensiveFunctions) {
          const funcRegex = new RegExp(`\\b${func}\\s*\\(`, 'g');
          let match;
          while ((match = funcRegex.exec(line)) !== null) {
            result.errors.push({
              line: lineNum,
              column: match.index + 1,
              message: `Expensive function '${func}' called in nested loop may impact performance`,
              severity: 'error',
              code: 'PSV6-PERF-NESTED-TA',
              suggestion: `Consider moving '${func}' outside the loop or caching its result`
            });
          }
        }
      }
    }
  }

  /**
   * PSV6-REPAINT-SECURITY: Validate repaint issues with request.security
   * PSV6-REPAINT-LOOKAHEAD: Validate lookahead issues
   * PSV6-FUTURE-DATA: Validate negative history references
   * PSV6-REPAINT-HTF: Validate HTF data usage
   */
  private validateRepaintIssues(lines: string[], result: any): void {
    let hasBarstateConfirmed = false;
    let hasRequestSecurity = false;
    let hasLookahead = false;
    let hasNegativeHistory = false;
    let hasHTFData = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for barstate.isconfirmed
      if (/barstate\.isconfirmed/.test(line)) {
        hasBarstateConfirmed = true;
      }

      // Check for request.security
      if (/request\.security\s*\(/.test(line)) {
        hasRequestSecurity = true;
        
        // Check for lookahead parameter
        if (/lookahead\s*=\s*barmerge\.lookahead_on/.test(line)) {
          hasLookahead = true;
          result.warnings.push({
            line: lineNum,
            column: 1,
            message: 'request.security with lookahead enabled may cause repainting',
            severity: 'warning',
            code: 'PSV6-REPAINT-LOOKAHEAD',
            suggestion: 'Consider using barstate.isconfirmed to prevent repainting'
          });
        }
      }

      // Check for negative history references (e.g., close[-1], close[1])
      if (/close\[-?\d+\]|open\[-?\d+\]|high\[-?\d+\]|low\[-?\d+\]/.test(line)) {
        const negativeMatch = line.match(/(\w+)\[(-?\d+)\]/);
        if (negativeMatch && parseInt(negativeMatch[2]) < 0) {
          hasNegativeHistory = true;
          result.errors.push({
            line: lineNum,
            column: 1,
            message: 'Negative history reference may cause future data leakage',
            severity: 'error',
            code: 'PSV6-FUTURE-DATA',
            suggestion: 'Use positive history references only'
          });
        }
      }

      // Check for HTF data usage without confirmation
      // Look for request.security with any timeframe parameter (including timeframe.period)
      if (/request\.security\s*\([^)]*timeframe/.test(line) && !hasBarstateConfirmed) {
        hasHTFData = true;
      }
    }

    // Warn about request.security without barstate.isconfirmed
    if (hasRequestSecurity && !hasBarstateConfirmed) {
      result.warnings.push({
        line: 1,
        column: 1,
        message: 'request.security used without barstate.isconfirmed may cause repainting',
        severity: 'warning',
        code: 'PSV6-REPAINT-SECURITY',
        suggestion: 'Use barstate.isconfirmed to prevent repainting'
      });
    }

    // Warn about HTF data usage
    if (hasHTFData && !hasBarstateConfirmed) {
      result.warnings.push({
        line: 1,
        column: 1,
        message: 'Higher timeframe data used without confirmation may cause repainting',
        severity: 'warning',
        code: 'PSV6-REPAINT-HTF',
        suggestion: 'Use barstate.isconfirmed when accessing HTF data'
      });
    }
  }

  /**
   * PSV6-PERF-ALERT-CONSOLIDATE: Flag multiple alert/alertcondition usage
   */
  private validateAlertConsolidation(lines: string[], result: any): void {
    let alertCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\balert(condition)?\s*\(/.test(line)) {
        alertCount++;
      }
    }
    if (alertCount >= 2) {
      result.warnings.push({
        line: 1,
        column: 1,
        message: `Multiple alert conditions detected (${alertCount}). Consider consolidating or documenting alert logic.`,
        severity: 'warning',
        code: 'PSV6-PERF-ALERT-CONSOLIDATE',
        suggestion: 'Reduce duplicate alerts or combine conditions when possible.'
      });
    }
  }

  /**
   * Get the indentation level of a line
   */
  private getLineIndentation(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }
}
