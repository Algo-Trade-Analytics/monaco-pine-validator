/**
 * Enhanced Quality Validator Module
 * 
 * Handles enhanced code quality validation for Pine Script v6:
 * - PSV6-QUALITY-COMPLEXITY: Cyclomatic complexity
 * - PSV6-QUALITY-DEPTH: Nesting depth warnings
 * - PSV6-QUALITY-LENGTH: Function length suggestions
 */

import { ValidationModule } from '../core/types';

export class EnhancedQualityValidator implements ValidationModule {
  name = 'EnhancedQualityValidator';
  priority = 60; // Run after other validations

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

    this.validateCyclomaticComplexity(context.lines, result);
    this.validateNestingDepth(context.lines, result);
    this.validateFunctionLength(context.lines, result);

    return result;
  }

  /**
   * PSV6-QUALITY-COMPLEXITY: Validate cyclomatic complexity
   * Warns about high cyclomatic complexity in functions and the overall script
   */
  private validateCyclomaticComplexity(lines: string[], result: any): void {
    let scriptComplexity = 0;
    let currentFunctionComplexity = 0;
    let currentFunctionName = '';
    let currentFunctionStartLine = 0;
    let inFunction = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const indent = this.getLineIndentation(line);

      // Check for function start
      if (this.isFunctionStart(line)) {
        // Save previous function complexity if any
        if (inFunction && currentFunctionComplexity > 8) {
          result.warnings.push({
            line: currentFunctionStartLine,
            column: 1,
            message: `Function '${currentFunctionName}' has high cyclomatic complexity (${currentFunctionComplexity}). Consider breaking it into smaller functions.`,
            severity: 'warning',
            code: 'PSV6-QUALITY-COMPLEXITY',
            suggestion: `Refactor function to reduce complexity below 8`
          });
        }

        // Start new function
        const funcMatch = line.match(/(\w+)\s*\(/);
        currentFunctionName = funcMatch ? funcMatch[1] : 'anonymous';
        currentFunctionStartLine = lineNum;
        currentFunctionComplexity = 0;
        inFunction = true;
      }

      // Check for function end (unindented or end of file)
      if (inFunction && indent === 0 && line.trim() !== '') {
        // Function ended
        if (currentFunctionComplexity > 8) {
          result.warnings.push({
            line: currentFunctionStartLine,
            column: 1,
            message: `Function '${currentFunctionName}' has high cyclomatic complexity (${currentFunctionComplexity}). Consider breaking it into smaller functions.`,
            severity: 'warning',
            code: 'PSV6-QUALITY-COMPLEXITY',
            suggestion: `Refactor function to reduce complexity below 8`
          });
        }
        inFunction = false;
        currentFunctionComplexity = 0;
      }

      // Calculate complexity for current line
      const lineComplexity = this.getLineComplexity(line);
      scriptComplexity += lineComplexity;
      if (inFunction) {
        currentFunctionComplexity += lineComplexity;
      }
    }

    // Check overall script complexity
    if (scriptComplexity > 8) {
      result.warnings.push({
        line: 1,
        column: 0,
        message: `Script has high cyclomatic complexity (${scriptComplexity}). Consider breaking it into smaller functions.`,
        severity: 'warning',
        code: 'PSV6-QUALITY-COMPLEXITY',
        suggestion: `Refactor script to reduce complexity below 8`
      });
    }
  }

  /**
   * PSV6-QUALITY-DEPTH: Validate nesting depth
   * Warns about excessive nesting depth
   */
  private validateNestingDepth(lines: string[], result: any): void {
    const indentStack: number[] = [0];
    let maxDepth = 0;
    let deepestLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const indent = this.getLineIndentation(line);

      if (line.trim() === '') continue;

      // Update indent stack
      if (indent > indentStack[indentStack.length - 1]) {
        indentStack.push(indent);
      } else if (indent < indentStack[indentStack.length - 1]) {
        while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]) {
          indentStack.pop();
        }
      }

      // Track maximum depth
      const currentDepth = indentStack.length - 1;
      if (currentDepth > maxDepth) {
        maxDepth = currentDepth;
        deepestLine = lineNum;
      }
    }

    if (maxDepth > 3) {
      result.warnings.push({
        line: deepestLine,
        column: 0,
        message: `Excessive nesting depth detected (${maxDepth} levels). Consider extracting nested logic into separate functions.`,
        severity: 'warning',
        code: 'PSV6-QUALITY-DEPTH',
        suggestion: `Refactor nested code to reduce depth below 3 levels`
      });
    }
  }

  /**
   * PSV6-QUALITY-LENGTH: Validate function length
   * Warns about very long functions
   */
  private validateFunctionLength(lines: string[], result: any): void {
    let currentFunctionStartLine = 0;
    let currentFunctionName = '';
    let inFunction = false;
    let functionLineCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const indent = this.getLineIndentation(line);

      // Check for function start
      if (this.isFunctionStart(line)) {
        // Save previous function length if any
        if (inFunction && functionLineCount > 50) {
          result.warnings.push({
            line: currentFunctionStartLine,
            column: 1,
            message: `Function '${currentFunctionName}' is very long (${functionLineCount} lines). Consider breaking it into smaller functions.`,
            severity: 'warning',
            code: 'PSV6-QUALITY-LENGTH',
            suggestion: `Refactor function to reduce length below 50 lines`
          });
        }

        // Start new function
        const funcMatch = line.match(/(\w+)\s*\(/);
        currentFunctionName = funcMatch ? funcMatch[1] : 'anonymous';
        currentFunctionStartLine = lineNum;
        functionLineCount = 1;
        inFunction = true;
      } else if (inFunction) {
        // Check for function end (unindented or end of file)
        if (indent === 0 && line.trim() !== '') {
          // Function ended
          if (functionLineCount > 50) {
            result.warnings.push({
              line: currentFunctionStartLine,
              column: 1,
              message: `Function '${currentFunctionName}' is very long (${functionLineCount} lines). Consider breaking it into smaller functions.`,
              severity: 'warning',
              code: 'PSV6-QUALITY-LENGTH',
              suggestion: `Refactor function to reduce length below 50 lines`
            });
          }
          inFunction = false;
          functionLineCount = 0;
        } else {
          functionLineCount++;
        }
      }
    }

    // Check last function if file ends in function
    if (inFunction && functionLineCount > 50) {
      result.warnings.push({
        line: currentFunctionStartLine,
        column: 1,
        message: `Function '${currentFunctionName}' is very long (${functionLineCount} lines). Consider breaking it into smaller functions.`,
        severity: 'warning',
        code: 'PSV6-QUALITY-LENGTH',
        suggestion: `Refactor function to reduce length below 50 lines`
      });
    }
  }

  /**
   * Check if a line is a function start
   */
  private isFunctionStart(line: string): boolean {
    return /^\s*\w+\s*\([^)]*\)\s*=>/.test(line);
  }

  /**
   * Get the complexity of a line
   */
  private getLineComplexity(line: string): number {
    let complexity = 0;
    
    // Control flow statements
    if (/\bif\b/.test(line)) complexity++;
    if (/\belse\b/.test(line)) complexity++;
    if (/\bfor\b/.test(line)) complexity++;
    if (/\bwhile\b/.test(line)) complexity++;
    if (/\bswitch\b/.test(line)) complexity++;
    if (/\bcase\b/.test(line)) complexity++;
    
    // Logical operators
    if (/\band\b/.test(line)) complexity++;
    if (/\bor\b/.test(line)) complexity++;
    
    // Ternary operators
    if (/\?/.test(line)) complexity++;
    
    return complexity;
  }

  /**
   * Get the indentation level of a line
   */
  private getLineIndentation(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }
}
