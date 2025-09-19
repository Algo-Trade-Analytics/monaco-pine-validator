/**
 * Performance analysis module for Pine Script v6
 * Handles performance optimization suggestions, memory usage analysis, and computational complexity
 */

import { ValidationModule, ValidationContext, ValidatorConfig, ValidationError, ValidationResult } from '../core/types';

export class PerformanceValidator implements ValidationModule {
  name = 'PerformanceValidator';

  getDependencies(): string[] {
    return ['SyntaxValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    const errors: ValidationError[] = [];

    // Only run performance analysis if enabled
    if (!config.enablePerformanceAnalysis) {
      return {
        isValid: errors.length === 0,
        errors: errors,
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: null
      };
    }

    // Analyze memory usage
    this.analyzeMemoryUsage(context, errors);

    // Analyze computational complexity
    this.analyzeComputationalComplexity(context, errors);

    // Analyze expensive operations in loops
    this.analyzeExpensiveOperations(context, errors);

    // Analyze resource usage
    this.analyzeResourceUsage(context, errors);

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: [],
      info: [],
      typeMap: new Map(),
      scriptType: null
    };
  }

  private analyzeMemoryUsage(context: ValidationContext, errors: ValidationError[]): void {
    let arrayCount = 0;
    let matrixCount = 0;
    let mapCount = 0;
    let largeAllocations = 0;

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;

      // Count array allocations
      if (line.includes('array.new')) {
        arrayCount++;
        
        // Check for large array allocations
        const sizeMatch = line.match(/array\.new.*?(\d+)/);
        if (sizeMatch) {
          const size = parseInt(sizeMatch[1]);
          if (size > 10000) {
            largeAllocations++;
            errors.push({
              line: lineNum,
              column: 1,
              message: `Large array allocation (${size} elements) may impact memory usage.`,
              severity: 'warning',
              code: 'PSV6-MEMORY-LARGE-ARRAY',
              suggestion: 'Consider using a smaller size or dynamic allocation if possible.'
            });
          }
        }
      }

      // Count matrix allocations
      if (line.includes('matrix.new')) {
        matrixCount++;
        
        // Check for large matrix allocations
        const sizeMatch = line.match(/matrix\.new.*?(\d+).*?(\d+)/);
        if (sizeMatch) {
          const rows = parseInt(sizeMatch[1]);
          const cols = parseInt(sizeMatch[2]);
          const total = rows * cols;
          if (total > 1000) {
            largeAllocations++;
            errors.push({
              line: lineNum,
              column: 1,
              message: `Large matrix allocation (${rows}x${cols} = ${total} elements) may impact memory usage.`,
              severity: 'warning',
              code: 'PSV6-MEMORY-LARGE-MATRIX',
              suggestion: 'Consider using a smaller matrix or alternative data structure.'
            });
          }
        }
      }

      // Count map allocations
      if (line.includes('map.new')) {
        mapCount++;
      }
    }

    // Warn about excessive collection usage
    if (arrayCount > 10) {
      errors.push({
        line: 1,
        column: 1,
        message: `High number of array allocations (${arrayCount}). Consider consolidating or reusing arrays.`,
        severity: 'warning',
        code: 'PSV6-MEMORY-EXCESSIVE-ARRAYS',
        suggestion: 'Consider using fewer arrays or reusing existing ones to reduce memory usage.'
      });
    }

    if (matrixCount > 5) {
      errors.push({
        line: 1,
        column: 1,
        message: `High number of matrix allocations (${matrixCount}). Consider consolidating matrices.`,
        severity: 'warning',
        code: 'PSV6-MEMORY-EXCESSIVE-MATRICES',
        suggestion: 'Consider using fewer matrices or alternative data structures.'
      });
    }

    if (mapCount > 5) {
      errors.push({
        line: 1,
        column: 1,
        message: `High number of map allocations (${mapCount}). Consider consolidating maps.`,
        severity: 'warning',
        code: 'PSV6-MEMORY-EXCESSIVE-MAPS',
        suggestion: 'Consider using fewer maps or alternative data structures.'
      });
    }
  }

  private analyzeComputationalComplexity(context: ValidationContext, errors: ValidationError[]): void {
    let maxNestingDepth = 0;
    let currentNestingDepth = 0;
    const nestingStack: number[] = [];

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;
      const indent = this.getLineIndentation(line);

      // Track nesting depth
      if (indent > nestingStack[nestingStack.length - 1] || nestingStack.length === 0) {
        nestingStack.push(indent);
        currentNestingDepth = nestingStack.length;
        maxNestingDepth = Math.max(maxNestingDepth, currentNestingDepth);
      } else {
        // Pop from stack until we find matching indent
        while (nestingStack.length > 0 && indent <= nestingStack[nestingStack.length - 1]) {
          nestingStack.pop();
        }
        currentNestingDepth = nestingStack.length;
      }

      // Check for nested loops
      if (this.isLoopLine(line)) {
        this.analyzeNestedLoops(i, context, errors);
      }

      // Check for expensive operations
      this.analyzeExpensiveOperationsInContext(line, lineNum, currentNestingDepth, errors);
    }

    // Warn about excessive nesting
    if (maxNestingDepth > 6) {
      errors.push({
        line: 1,
        column: 1,
        message: `High nesting depth (${maxNestingDepth} levels) may impact readability and performance.`,
        severity: 'warning',
        code: 'PSV6-PERF-HIGH-NESTING',
        suggestion: 'Consider refactoring to reduce nesting depth by extracting functions or using early returns.'
      });
    }
  }

  private analyzeNestedLoops(loopLineIndex: number, context: ValidationContext, errors: ValidationError[]): void {
    const line = context.cleanLines[loopLineIndex];
    const lineNum = loopLineIndex + 1;
    const loopIndent = this.getLineIndentation(line);
    let nestedLoopCount = 0;

    // Count nested loops within the next 20 lines
    for (let i = loopLineIndex + 1; i < Math.min(loopLineIndex + 20, context.cleanLines.length); i++) {
      const nextLine = context.cleanLines[i];
      const nextIndent = this.getLineIndentation(nextLine);
      
      // Stop if we've unindented back to loop level or beyond
      if (nextIndent <= loopIndent && nextLine.trim() !== '') {
        break;
      }

      if (this.isLoopLine(nextLine) && nextIndent > loopIndent) {
        nestedLoopCount++;
      }
    }

    if (nestedLoopCount > 0) {
      errors.push({
        line: lineNum,
        column: 1,
        message: `Nested loops detected (${nestedLoopCount + 1} levels) may impact performance.`,
        severity: 'warning',
        code: 'PSV6-PERF-NESTED-LOOPS',
        suggestion: 'Consider optimizing the algorithm or reducing the number of nested iterations.'
      });
    }
  }

  private analyzeExpensiveOperations(context: ValidationContext, errors: ValidationError[]): void {
    const expensiveFunctions = [
      'ta.highest', 'ta.lowest', 'ta.pivothigh', 'ta.pivotlow',
      'ta.correlation', 'ta.linreg', 'ta.percentile_linear_interpolation', 'ta.percentile_nearest_rank',
      'ta.percentrank', 'request.security', 'request.dividends', 'request.earnings'
    ];

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;

      for (const func of expensiveFunctions) {
        if (line.includes(func)) {
          // Check if this expensive function is in a loop
          if (this.isInLoop(context, i)) {
            const severity = this.isVeryExpensiveFunction(func) ? 'error' : 'warning';
            errors.push({
              line: lineNum,
              column: 1,
              message: `Expensive function '${func}' detected in loop may impact performance.`,
              severity,
              code: 'PSV6-PERF-EXPENSIVE-IN-LOOP',
              suggestion: 'Move expensive calculations outside the loop or cache their results.'
            });
          }

          // Check for multiple expensive functions on the same line
          const functionCount = (line.match(new RegExp(func.replace('.', '\\.'), 'g')) || []).length;
          if (functionCount > 1) {
            errors.push({
              line: lineNum,
              column: 1,
              message: `Multiple calls to expensive function '${func}' on the same line.`,
              severity: 'warning',
              code: 'PSV6-PERF-MULTIPLE-EXPENSIVE',
              suggestion: 'Consider caching the result or splitting into multiple lines.'
            });
          }
        }
      }
    }
  }

  private analyzeExpensiveOperationsInContext(line: string, lineNum: number, nestingDepth: number, errors: ValidationError[]): void {
    // Check for expensive operations in deeply nested contexts
    const expensiveOps = ['ta.', 'request.', 'math.'];
    
    for (const op of expensiveOps) {
      if (line.includes(op) && nestingDepth > 4) {
        errors.push({
          line: lineNum,
          column: 1,
          message: `Expensive operation in deeply nested context (depth: ${nestingDepth}).`,
          severity: 'info',
          code: 'PSV6-PERF-DEEP-NESTING',
          suggestion: 'Consider moving expensive operations to a higher scope or extracting to a function.'
        });
        break;
      }
    }
  }

  private analyzeResourceUsage(context: ValidationContext, errors: ValidationError[]): void {
    let requestCount = 0;
    let plotCount = 0;
    let alertCount = 0;

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;

      // Count request calls
      if (line.includes('request.')) {
        requestCount++;
      }

      // Count plot calls
      if (line.includes('plot') && !line.includes('plot(')) {
        plotCount++;
      }

      // Count alert calls
      if (line.includes('alert') || line.includes('alertcondition')) {
        alertCount++;
      }
    }

    // Warn about excessive resource usage
    if (requestCount > 5) {
      errors.push({
        line: 1,
        column: 1,
        message: `High number of request calls (${requestCount}) may impact performance.`,
        severity: 'warning',
        code: 'PSV6-PERF-EXCESSIVE-REQUESTS',
        suggestion: 'Consider consolidating requests or using request.security with multiple expressions.'
      });
    }

    if (plotCount > 10) {
      errors.push({
        line: 1,
        column: 1,
        message: `High number of plot calls (${plotCount}) may impact rendering performance.`,
        severity: 'warning',
        code: 'PSV6-PERF-EXCESSIVE-PLOTS',
        suggestion: 'Consider reducing the number of plots or using conditional plotting.'
      });
    }

    if (alertCount > 20) {
      errors.push({
        line: 1,
        column: 1,
        message: `High number of alert calls (${alertCount}) may impact performance.`,
        severity: 'warning',
        code: 'PSV6-PERF-EXCESSIVE-ALERTS',
        suggestion: 'Consider consolidating alerts or using alertcondition instead of multiple alert calls.'
      });
    }

    // Encourage consolidation of multiple alertconditions into fewer signals
    if (alertCount >= 2) {
      errors.push({
        line: 1,
        column: 1,
        message: `Multiple alert conditions detected (${alertCount}). Consider consolidating or documenting alert logic.`,
        severity: 'error',
        code: 'PSV6-PERF-ALERT-CONSOLIDATE',
        suggestion: 'Reduce duplicate alerts or combine conditions when possible.'
      });
    }
  }

  private isLoopLine(line: string): boolean {
    return /^\s*(for|while)\b/.test(line);
  }

  private isInLoop(context: ValidationContext, lineIndex: number): boolean {
    const line = context.cleanLines[lineIndex];
    const lineIndent = this.getLineIndentation(line);

    // Look backwards for loop declarations
    for (let i = lineIndex - 1; i >= 0; i--) {
      const prevLine = context.cleanLines[i];
      const prevIndent = this.getLineIndentation(prevLine);
      
      // If we've unindented, we're no longer in the loop
      if (prevIndent < lineIndent && prevLine.trim() !== '') {
        break;
      }

      // Check if this line is a loop declaration
      if (this.isLoopLine(prevLine) && prevIndent < lineIndent) {
        return true;
      }
    }

    return false;
  }

  private isVeryExpensiveFunction(func: string): boolean {
    const veryExpensive = [
      'ta.highest', 'ta.lowest', 'ta.pivothigh', 'ta.pivotlow',
      'ta.correlation', 'ta.linreg'
    ];
    return veryExpensive.includes(func);
  }

  private getLineIndentation(line: string): number {
    return line.length - line.trimStart().length;
  }
}
