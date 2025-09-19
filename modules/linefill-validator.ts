/**
 * Linefill Validator
 * 
 * Validates Pine Script v6 Linefill functions and operations:
 * - Linefill creation validation (linefill.new)
 * - Linefill modification validation (linefill.set_color)
 * - Linefill deletion validation (linefill.delete)
 * - Linefill getter validation (linefill.get_line1, linefill.get_line2)
 * - Parameter type checking for all linefill functions
 * - Performance analysis for excessive linefills
 * - Best practices suggestions
 * 
 * Priority 85: High priority - linefills are important v6 drawing features
 */

import { ValidationModule, ValidationContext, ValidatorConfig, ValidationError, ValidationResult } from '../core/types';
import { IDENT, NS_MEMBERS, BUILTIN_FUNCTIONS_V6_RULES } from '../core/constants';

interface LinefillFunctionCall {
  name: string;
  line: number;
  column: number;
  arguments: string[];
}

export class LinefillValidator implements ValidationModule {
  name = 'LinefillValidator';
  priority = 85; // High priority - linefills are important v6 drawing features

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  // Linefill function tracking
  private linefillFunctionCalls: LinefillFunctionCall[] = [];
  private linefillOperations = new Map<string, number>();
  private linefillCount = 0;
  
  // Suggestion flags to prevent duplicates
  private hasComplexOperationWarning = false;
  private hasCacheSuggestion = false;
  private hasCleanupSuggestion = false;
  private hasTransparencySuggestion = false;

  getDependencies(): string[] {
    return ['TypeValidator', 'FunctionValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    // Process each line for linefill function calls
    context.cleanLines.forEach((line, index) => {
      this.processLine(line, index + 1);
    });

    // Post-process validations
    this.validateLinefillPerformance();
    this.validateLinefillBestPractices();

    // Build type map for other validators
    const typeMap = new Map();
    for (const call of this.linefillFunctionCalls) {
      if (call.name === 'new') {
        typeMap.set('linefill.new', {
          type: 'linefill',
          isConst: false,
          isSeries: false
        });
      }
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap,
      scriptType: null
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.linefillFunctionCalls = [];
    this.linefillOperations.clear();
    this.linefillCount = 0;
    
    // Reset suggestion flags
    this.hasComplexOperationWarning = false;
    this.hasCacheSuggestion = false;
    this.hasCleanupSuggestion = false;
    this.hasTransparencySuggestion = false;
  }

  private processLine(line: string, lineNum: number): void {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('//')) {
      return;
    }

    this.validateLinefillFunctionCalls(line, lineNum);
  }

  private validateLinefillFunctionCalls(line: string, lineNum: number): void {
    // Pattern: linefill.functionName(args...)
    const linefillFunctionPattern = new RegExp(`linefill\\.(\\w+)\\s*\\(`, 'g');
    
    let match;
    while ((match = linefillFunctionPattern.exec(line)) !== null) {
      const functionName = match[1];
      const startIndex = match.index;
      const openParenIndex = match.index + match[0].length - 1;
      
      // Find the matching closing parenthesis
      const argsString = this.extractBalancedParentheses(line, openParenIndex);
      if (argsString === null) continue; // Skip if we can't find balanced parentheses
      
      const column = startIndex + 1;

      // Parse arguments
      const args = this.parseArguments(argsString);

      // Store function call
      this.linefillFunctionCalls.push({
        name: functionName,
        line: lineNum,
        column,
        arguments: args
      });

      // Validate specific function
      this.validateLinefillFunction(functionName, args, lineNum, column);
      
      // Track operation
      const count = this.linefillOperations.get(functionName) || 0;
      this.linefillOperations.set(functionName, count + 1);

      // Count linefill objects for performance analysis
      if (functionName === 'new') {
        this.linefillCount++;
      }

      // Performance analysis - check for loops
      this.checkForLoopContext(lineNum, column);
      
      // Check for multiple operations on same line
      const linefillCallsOnLine = (line.match(/\blinefill\.[A-Za-z_][A-Za-z0-9_]*\s*\(/g) || []).length;
      if (linefillCallsOnLine > 1 && !this.hasComplexOperationWarning) {
        this.addWarning(lineNum, 1, 'Multiple linefill operations on one line', 'PSV6-LINEFILL-PERF-COMPLEX');
        this.hasComplexOperationWarning = true;
      }
    }
  }

  private validateLinefillFunction(functionName: string, args: string[], lineNum: number, column: number): void {
    // Check if it's a known linefill function
    if (!NS_MEMBERS.linefill || !NS_MEMBERS.linefill.has(functionName)) {
      this.addError(lineNum, column, `Unknown linefill function: linefill.${functionName}`, 'PSV6-LINEFILL-UNKNOWN-FUNCTION');
      return;
    }

    switch (functionName) {
      case 'new':
        this.validateLinefillNew(args, lineNum, column);
        break;
      case 'set_color':
        this.validateLinefillSetColor(args, lineNum, column);
        break;
      case 'delete':
        this.validateLinefillDelete(args, lineNum, column);
        break;
      case 'get_line1':
        this.validateLinefillGetLine1(args, lineNum, column);
        break;
      case 'get_line2':
        this.validateLinefillGetLine2(args, lineNum, column);
        break;
      default:
        this.addError(lineNum, column, `Unknown linefill function: linefill.${functionName}`, 'PSV6-LINEFILL-UNKNOWN-FUNCTION');
    }
  }

  private validateLinefillNew(args: string[], lineNum: number, column: number): void {
    if (args.length < 2) {
      this.addError(lineNum, column, 'linefill.new() requires at least 2 parameters (line1, line2)', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    // Validate line parameters
    const line1 = args[0].trim();
    const line2 = args[1].trim();

    if (!this.isLineObject(line1)) {
      this.addError(lineNum, column, 'Parameter 1 must be a line object', 'PSV6-FUNCTION-PARAM-TYPE');
    }

    if (!this.isLineObject(line2)) {
      this.addError(lineNum, column, 'Parameter 2 must be a line object', 'PSV6-FUNCTION-PARAM-TYPE');
    }

    // Validate optional color parameter
    if (args.length > 2) {
      const color = args[2].trim();
      if (!this.isColorExpression(color)) {
        this.addError(lineNum, column, 'color parameter must be a valid color', 'PSV6-FUNCTION-PARAM-TYPE');
      }
    }

    // Best practice suggestions - suggest transparency for solid colors (only once)
    if (!this.hasTransparencySuggestion) {
      if (args.length > 2) {
        const color = args[2].trim();
        // Suggest transparency if using a solid color (not already using color.new)
        if (color.startsWith('color=color.') && !color.includes('color.new')) {
          this.addInfo(lineNum, column, 'Consider using color.new() for transparency', 'PSV6-LINEFILL-TRANSPARENCY-SUGGESTION');
          this.hasTransparencySuggestion = true;
        }
      } else {
        // Suggest adding color with transparency
        this.addInfo(lineNum, column, 'Consider using color.new() for transparency', 'PSV6-LINEFILL-TRANSPARENCY-SUGGESTION');
        this.hasTransparencySuggestion = true;
      }
    }
  }

  private validateLinefillSetColor(args: string[], lineNum: number, column: number): void {
    if (args.length !== 2) {
      this.addError(lineNum, column, 'linefill.set_color() requires exactly 2 parameters', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    const linefillId = args[0].trim();
    const color = args[1].trim();

    if (!this.isLinefillObject(linefillId)) {
      this.addError(lineNum, column, 'Parameter 1 must be a linefill object', 'PSV6-FUNCTION-PARAM-TYPE');
    }

    if (!this.isColorExpression(color)) {
      this.addError(lineNum, column, 'color parameter must be a valid color', 'PSV6-FUNCTION-PARAM-TYPE');
    }
  }

  private validateLinefillDelete(args: string[], lineNum: number, column: number): void {
    if (args.length !== 1) {
      this.addError(lineNum, column, 'linefill.delete() requires exactly 1 parameter', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    const linefillId = args[0].trim();
    if (!this.isLinefillObject(linefillId)) {
      this.addError(lineNum, column, 'Parameter must be a linefill object', 'PSV6-FUNCTION-PARAM-TYPE');
    }
  }

  private validateLinefillGetLine1(args: string[], lineNum: number, column: number): void {
    if (args.length !== 1) {
      this.addError(lineNum, column, 'linefill.get_line1() requires exactly 1 parameter', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    const linefillId = args[0].trim();
    if (!this.isLinefillObject(linefillId)) {
      this.addError(lineNum, column, 'Parameter must be a linefill object', 'PSV6-FUNCTION-PARAM-TYPE');
    }
  }

  private validateLinefillGetLine2(args: string[], lineNum: number, column: number): void {
    if (args.length !== 1) {
      this.addError(lineNum, column, 'linefill.get_line2() requires exactly 1 parameter', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    const linefillId = args[0].trim();
    if (!this.isLinefillObject(linefillId)) {
      this.addError(lineNum, column, 'Parameter must be a linefill object', 'PSV6-FUNCTION-PARAM-TYPE');
    }
  }

  private validateLinefillPerformance(): void {
    // Check for too many linefill objects
    if (this.linefillCount > 10) {
      this.addWarning(
        0,
        0,
        `Too many linefill objects (${this.linefillCount}). Consider optimizing for better performance.`,
        'PSV6-LINEFILL-PERF-MANY'
      );
    }
  }

  private validateLinefillBestPractices(): void {
    // Check for repeated identical calls
    const callCounts = new Map<string, number>();
    for (const call of this.linefillFunctionCalls) {
      const key = `${call.name}(${call.arguments.join(',')})`;
      callCounts.set(key, (callCounts.get(key) || 0) + 1);
    }

    for (const [key, count] of callCounts) {
      if (count >= 3 && !this.hasCacheSuggestion) {
        const funcName = key.split('(')[0];
        this.addInfo(
          1,
          1,
          `Multiple similar linefill operations detected. Consider caching results.`,
          'PSV6-LINEFILL-CACHE-SUGGESTION'
        );
        this.hasCacheSuggestion = true;
        break; // Only suggest once
      }
    }

    // Suggest cleanup for many linefills
    if (this.linefillCount >= 5 && !this.hasCleanupSuggestion) {
      this.addInfo(
        1,
        1,
        'Consider using linefill.delete() to clean up unused linefills and improve performance.',
        'PSV6-LINEFILL-CLEANUP-SUGGESTION'
      );
      this.hasCleanupSuggestion = true;
    }
  }

  private checkForLoopContext(lineNum: number, column: number): void {
    // Check if we're in a loop by looking at previous lines
    for (let i = Math.max(1, lineNum - 3); i <= lineNum; i++) {
      const line = this.context.cleanLines[i - 1] || '';
      if (/\b(for|while)\b/.test(line)) {
        this.addWarning(lineNum, column, 'Linefill operation in loop', 'PSV6-LINEFILL-PERF-LOOP');
        break;
      }
    }
  }

  // Helper methods
  private extractBalancedParentheses(line: string, openParenIndex: number): string | null {
    let depth = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = openParenIndex; i < line.length; i++) {
      const char = line[i];
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        inString = false;
        stringChar = '';
      } else if (!inString) {
        if (char === '(') {
          depth++;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            // Found the matching closing parenthesis
            return line.substring(openParenIndex + 1, i);
          }
        }
      }
    }
    
    return null; // No matching closing parenthesis found
  }

  private parseArguments(argsString: string): string[] {
    if (!argsString.trim()) return [];
    
    const args: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        current += char;
      } else if (inString && char === stringChar) {
        inString = false;
        stringChar = '';
        current += char;
      } else if (!inString && char === '(') {
        depth++;
        current += char;
      } else if (!inString && char === ')') {
        depth--;
        current += char;
      } else if (!inString && char === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      args.push(current.trim());
    }
    
    return args;
  }

  private isLineObject(value: string): boolean {
    const trimmed = value.trim();
    
    // Check if it's a line.new() call
    if (trimmed.includes('line.new(')) {
      return true;
    }
    
    // Check if it's a linefill getter call
    if (trimmed.includes('linefill.get_line')) {
      return true;
    }
    
    // Check if it's a variable that might be a line (from type map)
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      const typeInfo = this.context.typeMap.get(trimmed);
      if (typeInfo && typeInfo.type === 'line') {
        return true;
      }
    }
    
    // Be lenient - assume variables could be line objects
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      return true;
    }
    
    return false;
  }

  private isLinefillObject(value: string): boolean {
    const trimmed = value.trim();
    
    // Check if it's a linefill.new() call
    if (trimmed.includes('linefill.new(')) {
      return true;
    }
    
    // Check if it's a variable that might be a linefill (from type map)
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      const typeInfo = this.context.typeMap.get(trimmed);
      // Accept 'map' as the type for linefill objects, since 'linefill' is not a valid type in the type system
      if (typeInfo && typeInfo.type === 'map') {
        return true;
      }
    }
    // Be lenient - assume variables could be linefill objects
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      return true;
    }
    
    return false;
  }

  private isColorExpression(value: string): boolean {
    const trimmed = value.trim();
    
    // Check for color namespace functions
    if (trimmed.includes('color.')) {
      return true;
    }
    
    // Check for hex colors
    if (trimmed.startsWith('#')) {
      return true;
    }
    
    // Check for rgb functions
    if (trimmed.startsWith('rgb')) {
      return true;
    }
    
    // Check for na
    if (trimmed === 'na') {
      return true;
    }
    
    // Check if it's a variable that might be a color
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      const typeInfo = this.context.typeMap.get(trimmed);
      if (typeInfo && typeInfo.type === 'color') {
        return true;
      }
      // Be lenient for variables
      return true;
    }
    
    return false;
  }

  private addError(line: number, column: number, message: string, code: string): void {
    this.errors.push({
      line,
      column,
      message,
      severity: 'error',
      code
    });
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({
      line,
      column,
      message,
      severity: 'warning',
      code
    });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({
      line,
      column,
      message,
      severity: 'info',
      code
    });
  }

  // Getter methods for other modules
  getLinefillFunctionCalls(): LinefillFunctionCall[] {
    return [...this.linefillFunctionCalls];
  }

  getLinefillOperations(): Map<string, number> {
    return new Map(this.linefillOperations);
  }

  getLinefillCount(): number {
    return this.linefillCount;
  }
}
