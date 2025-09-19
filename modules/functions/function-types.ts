/**
 * Function Types Validator
 * 
 * Handles function type checking and validation:
 * - Function return type inference and validation
 * - Return type usage validation in expressions
 * - Inconsistent return type detection
 * - Function complexity analysis
 * - Type compatibility checking
 * 
 * Extracted from function-validator.ts to improve maintainability.
 */

import { ValidationModule, ValidationContext, ValidatorConfig, ValidationError, ValidationResult } from '../../core/types';
import { BUILTIN_FUNCTIONS_V6_RULES, NS_MEMBERS } from '../../core/constants';

interface FunctionCall {
  name: string;
  arguments: string[];
  line: number;
  column: number;
  startIndex: number;
}

export class FunctionTypesValidator implements ValidationModule {
  name = 'FunctionTypesValidator';
  priority = 93; // High priority - runs after function declarations and built-in validation

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  getDependencies(): string[] {
    return ['SyntaxValidator', 'FunctionDeclarationsValidator', 'BuiltinFunctionsValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    // Validate function types and return type usage
    this.validateInconsistentReturnTypes();
    this.validateFunctionComplexity();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: null
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }

  private addError(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.errors.push({ line, column, message, severity: 'error', code, suggestion });
  }

  private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  private addInfo(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.info.push({ line, column, message, severity: 'info', code, suggestion });
  }

  /**
   * Validate inconsistent return types in user-defined functions
   */
  private validateInconsistentReturnTypes(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      let funcName: string | null = null;
      const staticMatch = line.match(/^\s*(?:export\s+)?static\s+([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*=>/);
      if (staticMatch) {
        funcName = `${staticMatch[1]}.${staticMatch[2]}`;
      } else {
        const methodMatch = line.match(/^\s*method\s+([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?)\s*\([^)]*\)\s*=>/);
        if (methodMatch) {
          funcName = methodMatch[1];
        } else {
          const funcMatch = line.match(/^\s*(?:export\s+)?func\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*=>/);
          if (funcMatch) {
            funcName = funcMatch[1];
          } else {
            const generalMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*=>/);
            if (generalMatch) {
              funcName = generalMatch[1];
            }
          }
        }
      }

      if (funcName) {
        const lineNum = i + 1;
        
        // Find the function body and analyze return types
        const returnTypes = this.analyzeFunctionReturnTypes(funcName, i);
        if (returnTypes.length > 1) {
          this.addError(lineNum, 1, 
            `Function '${funcName}' has inconsistent return types: ${returnTypes.join(', ')}`, 
            'PSV6-FUNCTION-RETURN-TYPE');
        }
      }
    }
  }

  /**
   * Analyze return types in a function body
   */
  private analyzeFunctionReturnTypes(funcName: string, startLine: number): string[] {
    const returnTypes = new Set<string>();
    const baseIndent = this.getLineIndentation(this.context.cleanLines[startLine]);
    
    // Look for return statements in the function body
    for (let i = startLine + 1; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineIndent = this.getLineIndentation(line);
      
      // Stop if we've unindented back to the function level or beyond
      if (lineIndent <= baseIndent && line.trim() !== '') {
        break;
      }
      
      // Look for return values (expressions that are not assignments or control structures)
      if (lineIndent > baseIndent) {
        const trimmed = line.trim();
        
        // Skip control structures
        if (/^(if|for|while|switch|plot\b|array\.|map\.)/.test(trimmed)) {
          continue;
        }
        
        // Skip assignments
        if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*=/.test(trimmed)) {
          continue;
        }
        
        // This looks like a return value - analyze its type
        const returnType = this.inferReturnValueType(trimmed);
        if (returnType !== 'unknown') {
          returnTypes.add(returnType);
        }
      }
    }
    
    return Array.from(returnTypes);
  }

  /**
   * Infer the type of a return value expression
   */
  private inferReturnValueType(expression: string): string {
    const trimmed = expression.trim();
    
    // String literals
    if (/^"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'$/.test(trimmed)) {
      return 'string';
    }
    
    // Numeric literals
    if (/^[+\-]?\d+(\.\d+)?([eE][+\-]?\d+)?$/.test(trimmed)) {
      return trimmed.includes('.') || /[eE]/.test(trimmed) ? 'float' : 'int';
    }
    
    // Boolean literals
    if (trimmed === 'true' || trimmed === 'false') {
      return 'bool';
    }
    
    // Function calls
    if (trimmed.includes('(') && trimmed.includes(')')) {
      const funcMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*\.?[A-Za-z_][A-Za-z0-9_]*)\s*\(/);
      if (funcMatch) {
        return this.getFunctionReturnType(funcMatch[1]);
      }
    }
    
    // Variable references
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      const typeInfo = this.context.typeMap.get(trimmed);
      if (typeInfo) {
        return typeInfo.type;
      }

      const inferred = this.findAssignedType(trimmed);
      if (inferred && inferred !== 'unknown') {
        return inferred;
      }
    }
    
    return 'unknown';
  }

  private findAssignedType(varName: string): string | null {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i].trim();
      if (!line.startsWith(varName)) continue;
      if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*array\.new<([^>]+)>/.test(line)) {
        return 'array';
      }
      if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*map\.new<([^>]+)>/.test(line)) {
        return 'map';
      }
    }
    return null;
  }

  /**
   * Get the return type of a function
   */
  private getFunctionReturnType(funcName: string): string {
    // TA functions that return boolean
    const taBooleanFunctions = [
      'ta.crossover', 'ta.crossunder', 'ta.rising', 'ta.falling'
    ];
    
    // TA functions that return float
    const taFloatFunctions = [
      'ta.sma', 'ta.ema', 'ta.rsi', 'ta.macd', 'ta.stoch', 'ta.atr', 'ta.bb', 'ta.highest', 'ta.lowest',
      'ta.sar', 'ta.roc', 'ta.mom', 'ta.change', 'ta.correlation', 'ta.dev', 'ta.linreg',
      'ta.percentile_linear_interpolation', 'ta.percentile_nearest_rank', 'ta.percentrank', 'ta.pivothigh',
      'ta.pivotlow', 'ta.range', 'ta.stdev', 'ta.variance', 'ta.wma', 'ta.alma', 'ta.vwma', 'ta.swma',
      'ta.rma', 'ta.hma', 'ta.tsi', 'ta.cci', 'ta.cmo', 'ta.mfi', 'ta.obv', 'ta.pvt', 'ta.nvi',
      'ta.pvi', 'ta.wad', 'ta.iii', 'ta.wvad'
    ];
    
    // Math functions
    if (funcName.startsWith('math.')) return 'float';
    
    // String functions
    if (funcName.startsWith('str.')) return 'string';
    
    // Color functions
    if (funcName.startsWith('color.')) return 'color';
    
    // Input functions
    if (funcName.startsWith('input.')) {
      const builtinRule = BUILTIN_FUNCTIONS_V6_RULES[funcName];
      if (builtinRule?.returnType) {
        return builtinRule.returnType;
      }
    }
    
    // Specific TA function return types
    if (taBooleanFunctions.includes(funcName)) return 'bool';
    if (taFloatFunctions.includes(funcName)) return 'series';
    
    // General TA functions (default to series)
    if (funcName.startsWith('ta.')) return 'series';
    
    // Array namespace
    if (funcName.startsWith('array.')) {
      const member = funcName.split('.')[1];
      if (member.startsWith('new')) return 'array';
      if (['copy','slice','concat','from','from_example','range','sort_indices'].includes(member)) return 'array';
      if (['size','indexof','lastindexof','binary_search','binary_search_leftmost','binary_search_rightmost'].includes(member)) return 'int';
      if (member === 'get') return 'unknown';
      if (['push','pop','set','clear','reverse','sort','remove','insert','unshift','shift','fill','standardize'].includes(member)) return 'void';
      if (['some','every'].includes(member)) return 'bool';
      if (['sum','avg','stdev','variance','median','mode','max','min','abs','covariance','percentile_linear_interpolation','percentile_nearest_rank','percentrank'].includes(member)) {
        return 'series';
      }
      if (['first','last'].includes(member)) return 'unknown';
      return 'array';
    }

    // Map namespace
    if (funcName.startsWith('map.')) {
      const member = funcName.split('.')[1];
      if (member === 'new') return 'map';
      if (member === 'size') return 'int';
      if (member === 'contains') return 'bool';
      if (member === 'keys' || member === 'values') return 'array';
      if (member === 'copy') return 'map';
      if (member === 'get') return 'unknown';
      if (['put','remove','clear','put_all'].includes(member)) return 'void';
      return 'map';
    }

    // Plotting functions
    if (['plot', 'plotshape', 'plotchar', 'plotcandle', 'plotbar', 'bgcolor', 'hline', 'fill', 'barcolor'].includes(funcName)) {
      return 'series';
    }
    
    // Check if it's a user-defined function
    if (this.context.functionNames && this.context.functionNames.has(funcName)) {
      // For now, assume user functions return series
      return 'series';
    }
    
    // Default for most functions
    return 'series';
  }

  /**
   * Validate function complexity
   */
  private validateFunctionComplexity(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const funcMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*=>/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const lineNum = i + 1;
        
        // Calculate function complexity
        const complexity = this.calculateFunctionComplexity(funcName, i);
        
        // Warn on high complexity
        if (complexity > 10) {
          this.addWarning(lineNum, 1, 
            `Function '${funcName}' has high complexity (${complexity}). Consider breaking it into smaller functions.`, 
            'PSV6-FUNCTION-COMPLEXITY');
        }
        
        // Check function length
        const functionLength = this.calculateFunctionLength(funcName, i);
        if (functionLength > 50) {
          this.addWarning(lineNum, 1, 
            `Function '${funcName}' is very long (${functionLength} lines). Consider breaking it into smaller functions.`, 
            'PSV6-FUNCTION-LENGTH');
        }
      }
    }
  }

  /**
   * Calculate cyclomatic complexity of a function
   */
  private calculateFunctionComplexity(funcName: string, startLine: number): number {
    let complexity = 1; // Base complexity
    const baseIndent = this.getLineIndentation(this.context.cleanLines[startLine]);
    
    for (let i = startLine + 1; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineIndent = this.getLineIndentation(line);
      
      // Stop if we've unindented back to the function level or beyond
      if (lineIndent <= baseIndent && line.trim() !== '') {
        break;
      }
      
      // Count decision points
      if (lineIndent > baseIndent) {
        const trimmed = line.trim();
        
        // if statements
        if (/^\s*if\s+/.test(trimmed)) {
          complexity++;
        }
        
        // else if statements
        if (/^\s*else\s+if\s+/.test(trimmed)) {
          complexity++;
        }
        
        // for loops
        if (/^\s*for\s+/.test(trimmed)) {
          complexity++;
        }
        
        // while loops
        if (/^\s*while\s+/.test(trimmed)) {
          complexity++;
        }
        
        // switch statements
        if (/^\s*switch\s+/.test(trimmed)) {
          complexity++;
        }
        
        // case statements
        if (/^\s*case\s+/.test(trimmed)) {
          complexity++;
        }
        
        // logical operators
        if (/\b(and|or)\b/.test(trimmed)) {
          complexity++;
        }
      }
    }
    
    return complexity;
  }

  /**
   * Calculate the length of a function
   */
  private calculateFunctionLength(funcName: string, startLine: number): number {
    const baseIndent = this.getLineIndentation(this.context.cleanLines[startLine]);
    let length = 0;
    
    for (let i = startLine + 1; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineIndent = this.getLineIndentation(line);
      
      // Stop if we've unindented back to the function level or beyond
      if (lineIndent <= baseIndent && line.trim() !== '') {
        break;
      }
      
      if (lineIndent > baseIndent) {
        length++;
      }
    }
    
    return length;
  }

  /**
   * Get the indentation level of a line
   */
  private getLineIndentation(line: string): number {
    return line.length - line.trimStart().length;
  }

  /**
   * Validate return type usage in expressions
   */
  public validateReturnTypeUsage(funcName: string, call: FunctionCall): void {
    const returnType = this.getFunctionReturnType(funcName);
    
    // Get the line where this function call occurs
    const line = this.context.lines[call.line - 1];
    if (!line) return;
    
    // Find the function call in the line
    const funcCallStart = line.indexOf(funcName, call.startIndex);
    if (funcCallStart === -1) return;
    
    // Find the end of the function call
    let funcCallEnd = funcCallStart + funcName.length;
    let parenCount = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = funcCallStart; i < line.length; i++) {
      const char = line[i];
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        inString = false;
      } else if (!inString && char === '(') {
        parenCount++;
      } else if (!inString && char === ')') {
        parenCount--;
        if (parenCount === 0) {
          funcCallEnd = i + 1;
          break;
        }
      }
    }
    
    // Check the context around the function call
    const beforeCall = line.substring(0, funcCallStart).trim();
    const afterCall = line.substring(funcCallEnd).trim();
    
    // Check for arithmetic operations with boolean return types
    if (returnType === 'series' && this.isBooleanFunction(funcName)) {
      // Check if it's used in arithmetic operations
      if (this.isArithmeticContext(beforeCall, afterCall)) {
        this.addError(call.line, call.column, 
          `Boolean function '${funcName}' cannot be used in arithmetic operations`, 
          'PSV6-FUNCTION-RETURN-TYPE');
      }
    }
    
    // Check for string operations with non-string return types
    if (returnType !== 'string' && this.isStringContext(beforeCall, afterCall)) {
      this.addError(call.line, call.column, 
        `Function '${funcName}' returns ${returnType}, cannot be used in string operations`, 
        'PSV6-FUNCTION-RETURN-TYPE');
    }
  }

  /**
   * Check if a function returns boolean
   */
  private isBooleanFunction(funcName: string): boolean {
    const booleanFunctions = [
      'ta.crossover', 'ta.crossunder', 'ta.rising', 'ta.falling'
    ];
    return booleanFunctions.includes(funcName);
  }

  /**
   * Check if the context suggests arithmetic operations
   */
  private isArithmeticContext(before: string, after: string): boolean {
    const arithmeticOps = ['+', '-', '*', '/', '%', '^'];
    return arithmeticOps.some(op => before.endsWith(op) || after.startsWith(op));
  }

  /**
   * Check if the context suggests string operations
   */
  private isStringContext(before: string, after: string): boolean {
    const stringOps = ['+', 'str.'];
    return stringOps.some(op => before.endsWith(op) || after.startsWith(op));
  }
}
