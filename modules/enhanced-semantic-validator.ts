/**
 * Enhanced Semantic Validator Module
 * 
 * Handles enhanced semantic validation for Pine Script v6:
 * - PSV6-TYPE-FLOW: Advanced type checking
 * - PSV6-TYPE-INFERENCE: Type inference suggestions
 */

import { ValidationModule } from '../core/types';

export class EnhancedSemanticValidator implements ValidationModule {
  name = 'EnhancedSemanticValidator';
  priority = 85; // Run after type validation

  getDependencies(): string[] {
    return ['CoreValidator', 'TypeValidator'];
  }

  validate(context: any, config: any): any {
    const result = {
      errors: [],
      warnings: [],
      info: [],
      typeMap: new Map()
    };

    this.validateTypeFlow(context.lines, result);
    this.validateTypeInference(context.lines, result);

    return result;
  }

  /**
   * PSV6-TYPE-FLOW: Validate advanced type checking
   * Detects type mismatches in declarations and reassignments
   */
  private validateTypeFlow(lines: string[], result: any): void {
    const seriesVariables = new Set<string>();
    const inputVariables = new Set<string>();
    
    // First pass: collect all series and input variable declarations
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const seriesMatch = line.match(/^\s*series\s+(?:int|float|bool|string|color)\s+(\w+)/);
      if (seriesMatch) {
        seriesVariables.add(seriesMatch[1]);
      }
      
      const inputMatch = line.match(/^\s*input\s+(?:int|float|bool|string|color)\s+(\w+)/);
      if (inputMatch) {
        inputVariables.add(inputMatch[1]);
      }
    }
    
    // Second pass: check for type flow issues
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;


      // Check for series to simple assignment
      if (this.hasSeriesToSimpleAssignment(line, seriesVariables)) {
        result.errors.push({
          line: lineNum,
          column: 1,
          message: `Cannot assign series value to simple variable. Use [0] to get the current value.`,
          severity: 'error',
          code: 'PSV6-TYPE-FLOW',
          suggestion: 'Use [0] to get the current value from a series'
        });
      }

      // Check for input to series assignment in wrong context
      if (this.hasInputToSeriesAssignment(line, inputVariables)) {
        result.errors.push({
          line: lineNum,
          column: 1,
          message: `Input value assigned to series variable may cause issues. Consider the context.`,
          severity: 'error',
          code: 'PSV6-TYPE-FLOW',
          suggestion: 'Ensure input values are used appropriately in series context'
        });
      }
    }
  }

  /**
   * PSV6-TYPE-INFERENCE: Validate type inference suggestions
   * Suggests explicit types for ambiguous variables and function return types
   */
  private validateTypeInference(lines: string[], result: any): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for ambiguous variable declarations
      if (this.hasAmbiguousVariableDeclaration(line)) {
        result.info.push({
          line: lineNum,
          column: 1,
          message: `Consider adding explicit type annotation for better code clarity.`,
          severity: 'info',
          code: 'PSV6-TYPE-INFERENCE',
          suggestion: 'Add explicit type annotation (e.g., int myVar = 42)'
        });
      }

      // Check for function return type suggestions
      if (this.hasFunctionWithoutReturnType(line)) {
        result.info.push({
          line: lineNum,
          column: 1,
          message: `Consider adding explicit return type annotation for function clarity.`,
          severity: 'info',
          code: 'PSV6-TYPE-INFERENCE',
          suggestion: 'Add explicit return type annotation (e.g., int myFunction() => ...)'
        });
      }
    }
  }

  /**
   * Check if a line has series to simple assignment
   */
  private hasSeriesToSimpleAssignment(line: string, seriesVariables: Set<string>): boolean {
    // Look for patterns like: simple int len = x (without [0])
    const seriesToSimplePattern = /^\s*simple\s+(?:int|float|bool|string|color)\s+(\w+)\s*=\s*(\w+)(?!\s*\[)/;
    const match = line.match(seriesToSimplePattern);
    
    
    if (match) {
      const [, varName, rhsVar] = match;
      // Check if RHS is likely a series variable (built-in or user-defined)
      const isSeries = this.isLikelySeriesVariable(rhsVar) || seriesVariables.has(rhsVar);
      return isSeries;
    }
    
    return false;
  }

  /**
   * Check if a line has input to series assignment
   */
  private hasInputToSeriesAssignment(line: string, inputVariables: Set<string>): boolean {
    // Check if this is a series variable declaration
    const seriesDeclarationPattern = /^\s*series\s+(?:int|float|bool|string|color)\s+(\w+)\s*=/;
    const seriesMatch = line.match(seriesDeclarationPattern);
    
    if (!seriesMatch) {
      return false; // Not a series declaration
    }
    
    // Look for input variables in the expression
    for (const inputVar of inputVariables) {
      const inputVarPattern = new RegExp(`\\b${inputVar}\\b`);
      if (inputVarPattern.test(line)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if a line has ambiguous variable declaration
   */
  private hasAmbiguousVariableDeclaration(line: string): boolean {
    // Look for simple assignments without type annotation
    const ambiguousPattern = /^\s*(\w+)\s*=\s*(.+)$/;
    const match = line.match(ambiguousPattern);
    
    if (match) {
      const [, varName, value] = match;
      // Check if the value is complex and could benefit from type annotation
      return this.isComplexExpression(value);
    }
    
    return false;
  }

  /**
   * Check if a line has function without return type
   */
  private hasFunctionWithoutReturnType(line: string): boolean {
    // Look for function declarations without return type
    const functionPattern = /^\s*(\w+)\s*\([^)]*\)\s*=>/;
    const match = line.match(functionPattern);
    
    if (match) {
      const funcName = match[1];
      
      // Check if function name suggests it should have a return type
      if (this.shouldHaveReturnType(funcName)) {
        return true;
      }
      
      // Check if function body has potentially ambiguous return types
      // Look for ternary operators, which can have type ambiguity
      if (line.includes('?')) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if a variable is likely a series variable
   */
  private isLikelySeriesVariable(varName: string): boolean {
    const seriesVars = ['open', 'high', 'low', 'close', 'volume', 'time', 'bar_index', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'];
    return seriesVars.includes(varName);
  }

  /**
   * Check if an expression is complex
   */
  private isComplexExpression(value: string): boolean {
    // Check for complex expressions that could benefit from type annotation
    const complexPatterns = [
      /\([^)]+\)/, // Parentheses
      /[+\-*/%]/, // Arithmetic operators
      /ta\./, // TA functions
      /request\./, // Request functions
      /\?.*:/, // Ternary operators
    ];
    
    return complexPatterns.some(pattern => pattern.test(value));
  }

  /**
   * Check if a function should have a return type
   */
  private shouldHaveReturnType(funcName: string): boolean {
    // Functions that typically return values should have return type annotations
    const returnTypeFunctions = [
      'calculate', 'compute', 'get', 'find', 'search', 'check', 'validate',
      'process', 'transform', 'convert', 'parse', 'format', 'build', 'create'
    ];
    
    return returnTypeFunctions.some(prefix => funcName.toLowerCase().startsWith(prefix));
  }
}
