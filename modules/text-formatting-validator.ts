/**
 * Text Formatting validation module for Pine Script v6
 * Handles validation of text formatting functions, format strings, and performance analysis
 */

import { ValidationModule, ValidationContext, ValidationError, ValidationResult, ValidatorConfig } from '../core/types';

export class TextFormattingValidator implements ValidationModule {
  name = 'TextFormattingValidator';
  
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  getDependencies(): string[] {
    return ['SyntaxValidator', 'FunctionValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.validateTextFormattingFunctions();
    this.validateTextFormattingPerformance();

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

  private addError(line: number, column: number, message: string, code: string): void {
    this.errors.push({
      line,
      column,
      message,
      code,
      severity: 'error'
    });
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({
      line,
      column,
      message,
      code,
      severity: 'warning'
    });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({
      line,
      column,
      message,
      code,
      severity: 'info'
    });
  }

  private validateTextFormattingFunctions(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Look for str.format function calls - more flexible regex
      const formatRegex = /str\.format\s*\(\s*"([^"]*)"\s*,\s*(.+)\)/g;
      let match;
      
      while ((match = formatRegex.exec(line)) !== null) {
        const formatString = match[1];
        const parameters = match[2];
        
        this.validateFormatString(formatString, parameters, lineNum);
      }
    }
  }

  private validateFormatString(formatString: string, parameters: string, lineNum: number): void {
    // Validate format string syntax first
    this.validateFormatStringSyntax(formatString, lineNum);
    
    // Extract format placeholders: {0}, {1}, etc.
    const placeholderRegex = /\{(\d+)(?:,([^}]+))?\}/g;
    const placeholders: Array<{ index: number; format?: string }> = [];
    let match;
    
    while ((match = placeholderRegex.exec(formatString)) !== null) {
      const index = parseInt(match[1]);
      const format = match[2];
      placeholders.push({ index, format });
    }
    
    // Count parameters
    const paramCount = this.countParameters(parameters);
    
    // Validate parameter count match
    this.validateParameterCount(placeholders, paramCount, lineNum);
    
    // Validate format types
    this.validateFormatTypes(placeholders, parameters, lineNum);
  }

  private validateFormatStringSyntax(formatString: string, lineNum: number): void {
    // Check for unclosed braces
    const openBraces = (formatString.match(/\{/g) || []).length;
    const closeBraces = (formatString.match(/\}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      this.addError(lineNum, 1, 
        `Invalid format string: unclosed braces in "${formatString}"`, 
        'PSV6-TEXT-INVALID-FORMAT');
      return;
    }
    
    // Check for invalid placeholder syntax
    const invalidPlaceholderRegex = /\{[^}]*$/;
    if (invalidPlaceholderRegex.test(formatString)) {
      this.addError(lineNum, 1, 
        `Invalid format string: unclosed placeholder in "${formatString}"`, 
        'PSV6-TEXT-INVALID-FORMAT');
    }
  }

  private validateParameterCount(placeholders: Array<{ index: number; format?: string }>, paramCount: number, lineNum: number): void {
    // Find the highest placeholder index
    const maxIndex = Math.max(...placeholders.map(p => p.index));
    
    if (maxIndex >= paramCount) {
      this.addError(lineNum, 1, 
        `Format parameter mismatch: format string expects ${maxIndex + 1} parameters but only ${paramCount} provided`, 
        'PSV6-TEXT-PARAM-MISMATCH');
    }
  }

  private validateFormatTypes(placeholders: Array<{ index: number; format?: string }>, parameters: string, lineNum: number): void {
    const paramList = this.parseParameterList(parameters);
    
    for (const placeholder of placeholders) {
      if (placeholder.format) {
        const paramIndex = placeholder.index;
        if (paramIndex < paramList.length) {
          const param = paramList[paramIndex].trim();
          this.validateFormatType(placeholder.format, param, lineNum);
        }
      }
    }
  }

  private validateFormatType(format: string, parameter: string, lineNum: number): void {
    // Check for numeric format
    if (format.startsWith('number,')) {
      const numericFormat = format.substring(7);
      this.validateNumericFormat(numericFormat, parameter, lineNum);
    }
    
    // Check for date format
    if (format.startsWith('date,')) {
      const dateFormat = format.substring(5);
      this.validateDateFormat(dateFormat, parameter, lineNum);
    }
    
    // Check for time format
    if (format.startsWith('time,')) {
      const timeFormat = format.substring(5);
      this.validateTimeFormat(timeFormat, parameter, lineNum);
    }
  }

  private validateNumericFormat(format: string, parameter: string, lineNum: number): void {
    // Check for valid numeric format patterns
    const validNumericPatterns = [
      /^#+$/,           // #, ##, ###
      /^#+\.#+$/,       // #.##, ##.##
      /^#+,#+$/,        // #,###, ##,###
      /^#+,#+\.#+$/,    // #,###.##
      /^#+%$/,          // #%, ##%
      /^#+\.#+%$/       // #.##%, ##.##%
    ];
    
    const isValidFormat = validNumericPatterns.some(pattern => pattern.test(format));
    if (!isValidFormat) {
      this.addWarning(lineNum, 1, 
        `Invalid numeric format: "${format}". Use patterns like #, ##, #.##, #,###, or #%`, 
        'PSV6-TEXT-INVALID-NUMERIC-FORMAT');
    }
    
    // Check if parameter is numeric
    if (!this.isNumericParameter(parameter)) {
      this.addWarning(lineNum, 1, 
        `Non-numeric parameter "${parameter}" used with numeric format`, 
        'PSV6-TEXT-NON-NUMERIC-FORMAT');
    }
  }

  private validateDateFormat(format: string, parameter: string, lineNum: number): void {
    // Check for valid date format patterns
    const validDatePatterns = [
      /^dd\/MM\/yyyy$/,     // dd/MM/yyyy
      /^MM\/dd\/yyyy$/,     // MM/dd/yyyy
      /^yyyy-MM-dd$/,       // yyyy-MM-dd
      /^dd-MM-yyyy$/,       // dd-MM-yyyy
      /^dd\.MM\.yyyy$/,     // dd.MM.yyyy
      /^yyyy\/MM\/dd$/      // yyyy/MM/dd
    ];
    
    const isValidFormat = validDatePatterns.some(pattern => pattern.test(format));
    if (!isValidFormat) {
      this.addWarning(lineNum, 1, 
        `Invalid date format: "${format}". Use patterns like dd/MM/yyyy, MM/dd/yyyy, or yyyy-MM-dd`, 
        'PSV6-TEXT-INVALID-DATE-FORMAT');
    }
    
    // Check if parameter is date-related
    if (!this.isDateParameter(parameter)) {
      this.addWarning(lineNum, 1, 
        `Non-date parameter "${parameter}" used with date format`, 
        'PSV6-TEXT-NON-DATE-FORMAT');
    }
  }

  private validateTimeFormat(format: string, parameter: string, lineNum: number): void {
    // Check for valid time format patterns
    const validTimePatterns = [
      /^HH:mm:ss$/,         // HH:mm:ss
      /^HH:mm$/,            // HH:mm
      /^h:mm:ss$/,          // h:mm:ss
      /^h:mm$/,             // h:mm
      /^HH:mm:ss\.SSS$/     // HH:mm:ss.SSS
    ];
    
    const isValidFormat = validTimePatterns.some(pattern => pattern.test(format));
    if (!isValidFormat) {
      this.addWarning(lineNum, 1, 
        `Invalid time format: "${format}". Use patterns like HH:mm:ss, HH:mm, or h:mm:ss`, 
        'PSV6-TEXT-INVALID-TIME-FORMAT');
    }
    
    // Check if parameter is time-related
    if (!this.isTimeParameter(parameter)) {
      this.addWarning(lineNum, 1, 
        `Non-time parameter "${parameter}" used with time format`, 
        'PSV6-TEXT-NON-TIME-FORMAT');
    }
  }

  private validateTextFormattingPerformance(): void {
    // Check for text formatting in loops
    this.validateTextFormattingInLoops();
    
    // Check for complex text formatting
    this.validateComplexTextFormatting();
  }

  private validateTextFormattingInLoops(): void {
    let inLoop = false;
    let loopStartLine = 0;
    
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;
      
      // Check for loop start
      if (line.match(/^\s*for\s+/) || line.match(/^\s*while\s+/)) {
        inLoop = true;
        loopStartLine = lineNum;
        continue;
      }
      
      // Check for loop end
      if (inLoop && line.match(/^\s*end\s*$/)) {
        inLoop = false;
        continue;
      }
      
      // If we're in a loop, check for text formatting
      if (inLoop && line.includes('str.format')) {
        this.addWarning(lineNum, 1, 
          `Text formatting in loop (line ${loopStartLine}). Consider caching formatted text outside the loop for better performance`, 
          'PSV6-TEXT-PERF-LOOP');
      }
    }
  }

  private validateComplexTextFormatting(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Look for complex text formatting (multiple parameters with different formats)
      const formatRegex = /\bstr\.format\s*\(\s*"([^"]*)"\s*,\s*(.+)\)/g;
      let match;
      
      while ((match = formatRegex.exec(line)) !== null) {
        const formatString = match[1];
        const parameters = match[2];
        
        // Check for complex formatting
        const placeholderCount = (formatString.match(/\{\d+/g) || []).length;
        const paramCount = this.countParameters(parameters);
        
        if (placeholderCount >= 3 || paramCount >= 3) {
          this.addWarning(lineNum, 1, 
            `Complex text formatting with ${placeholderCount} placeholders and ${paramCount} parameters. Consider breaking into simpler expressions`, 
            'PSV6-TEXT-PERF-COMPLEX');
        }
      }
    }
  }

  private countParameters(parameters: string): number {
    return this.parseParameterList(parameters).length;
  }

  private parseParameterList(parameters: string): string[] {
    const result: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < parameters.length; i++) {
      const char = parameters[i];
      
      if (escapeNext) {
        current += char;
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        current += char;
        continue;
      }
      
      if (char === '"' && !inString) {
        inString = true;
        current += char;
        continue;
      }
      
      if (char === '"' && inString) {
        inString = false;
        current += char;
        continue;
      }
      
      if (char === '(' && !inString) {
        depth++;
        current += char;
        continue;
      }
      
      if (char === ')' && !inString) {
        depth--;
        current += char;
        continue;
      }
      
      if (char === ',' && depth === 0 && !inString) {
        result.push(current.trim());
        current = '';
        continue;
      }
      
      current += char;
    }
    
    if (current.trim()) {
      result.push(current.trim());
    }
    
    return result;
  }

  private isNumericParameter(parameter: string): boolean {
    // Check for numeric literals
    if (parameter.match(/^\d+\.?\d*$/)) return true;
    
    // Check for numeric variables
    const numericVariables = ['close', 'open', 'high', 'low', 'volume', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'];
    if (numericVariables.includes(parameter)) return true;
    
    // Check for arithmetic expressions
    if (parameter.includes('+') || parameter.includes('-') || parameter.includes('*') || parameter.includes('/')) {
      return true;
    }
    
    return false;
  }

  private isDateParameter(parameter: string): boolean {
    // Check for date-related variables
    const dateVariables = ['time', 'bar_index'];
    if (dateVariables.includes(parameter)) return true;
    
    // Check for date functions
    if (parameter.includes('time(') || parameter.includes('timestamp(')) return true;
    
    return false;
  }

  private isTimeParameter(parameter: string): boolean {
    // Check for time-related variables
    const timeVariables = ['time'];
    if (timeVariables.includes(parameter)) return true;
    
    // Check for time functions
    if (parameter.includes('time(') || parameter.includes('timestamp(')) return true;
    
    return false;
  }
}
