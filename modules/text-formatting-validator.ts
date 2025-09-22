/**
 * Text Formatting validation module for Pine Script v6
 * Handles validation of text formatting functions, format strings, and performance analysis
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidationError,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';
import {
  type ArgumentNode,
  type CallExpressionNode,
  type ExpressionNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type ProgramNode,
  type StringLiteralNode,
} from '../core/ast/nodes';
import { findAncestor, visit, type NodePath } from '../core/ast/traversal';

export class TextFormattingValidator implements ValidationModule {
  name = 'TextFormattingValidator';
  
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;

  private formatCalls: Array<{
    line: number;
    column: number;
    placeholderCount: number;
    parameterCount: number;
    loopLine: number | null;
  }> = [];

  getDependencies(): string[] {
    return ['SyntaxValidator', 'FunctionValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;
    this.astContext = this.getAstContext(config);

    if (this.astContext?.ast) {
      this.validateTextFormattingAst(this.astContext.ast);
    } else {
      this.validateTextFormattingFunctionsLegacy();
    }

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
    this.astContext = null;
    this.formatCalls = [];
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

  private validateTextFormattingFunctionsLegacy(): void {
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

  private validateFormatString(formatString: string, parameters: string | string[], lineNum: number): void {
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
    const parameterList = Array.isArray(parameters) ? parameters : this.parseParameterList(parameters);
    const paramCount = parameterList.length;

    // Validate parameter count match
    this.validateParameterCount(placeholders, paramCount, lineNum);

    // Validate format types
    this.validateFormatTypes(placeholders, parameterList, lineNum);
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

  private validateFormatTypes(
    placeholders: Array<{ index: number; format?: string }>,
    parameters: string[] | string,
    lineNum: number,
  ): void {
    const paramList = Array.isArray(parameters) ? parameters : this.parseParameterList(parameters);

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
    if (this.astContext?.ast) {
      this.validateTextFormattingInLoopsAst();
      this.validateComplexTextFormattingAst();
      return;
    }

    this.validateTextFormattingInLoopsLegacy();
    this.validateComplexTextFormattingLegacy();
  }

  private validateTextFormattingInLoopsLegacy(): void {
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

  private validateComplexTextFormattingLegacy(): void {
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

  private countParameters(parameters: string | string[]): number {
    if (Array.isArray(parameters)) {
      return parameters.length;
    }
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

  private validateTextFormattingAst(program: ProgramNode): void {
    visit(program, {
      CallExpression: {
        enter: (path) => this.processAstFormatCall(path as NodePath<CallExpressionNode>),
      },
    });
  }

  private processAstFormatCall(path: NodePath<CallExpressionNode>): void {
    const call = path.node;
    const qualifiedName = this.getExpressionQualifiedName(call.callee);
    if (qualifiedName !== 'str.format') {
      return;
    }

    const [formatArgument, ...rest] = call.args;
    if (!formatArgument) {
      return;
    }

    const { line, column } = call.loc.start;
    const parameterStrings = rest.map((argument) => this.argumentToString(argument));

    let formatString: string | null = null;
    if (formatArgument.value.kind === 'StringLiteral') {
      formatString = (formatArgument.value as StringLiteralNode).value;
    }

    if (formatString !== null) {
      this.validateFormatString(formatString, parameterStrings, line);
    }

    const loopAncestor = findAncestor(path, (ancestor) =>
      ancestor.node.kind === 'ForStatement' || ancestor.node.kind === 'WhileStatement');

    const placeholderCount = formatString ? (formatString.match(/\{\d+/g) || []).length : 0;

    this.formatCalls.push({
      line,
      column,
      placeholderCount,
      parameterCount: parameterStrings.length,
      loopLine: loopAncestor?.node.loc.start.line ?? null,
    });
  }

  private validateTextFormattingInLoopsAst(): void {
    for (const call of this.formatCalls) {
      if (call.loopLine === null) {
        continue;
      }

      this.addWarning(call.line, call.column,
        `Text formatting in loop (line ${call.loopLine}). Consider caching formatted text outside the loop for better performance`,
        'PSV6-TEXT-PERF-LOOP');
    }
  }

  private validateComplexTextFormattingAst(): void {
    for (const call of this.formatCalls) {
      if (call.placeholderCount >= 3 || call.parameterCount >= 3) {
        this.addWarning(call.line, call.column,
          `Complex text formatting with ${call.placeholderCount} placeholders and ${call.parameterCount} parameters. Consider breaking into simpler expressions`,
          'PSV6-TEXT-PERF-COMPLEX');
      }
    }
  }

  private argumentToString(argument: ArgumentNode): string {
    const valueText = this.getNodeSource(argument.value).trim();
    if (argument.name) {
      return `${argument.name.name}=${valueText}`;
    }
    return valueText;
  }

  private getNodeSource(node: ExpressionNode | ArgumentNode | CallExpressionNode): string {
    const lines = this.context.lines ?? [];
    if (!node.loc) {
      return '';
    }
    const startLineIndex = Math.max(0, node.loc.start.line - 1);
    const endLineIndex = Math.max(0, node.loc.end.line - 1);
    if (startLineIndex === endLineIndex) {
      const line = lines[startLineIndex] ?? '';
      return line.slice(node.loc.start.column - 1, Math.max(node.loc.start.column - 1, node.loc.end.column - 1));
    }
    const parts: string[] = [];
    const firstLine = lines[startLineIndex] ?? '';
    parts.push(firstLine.slice(node.loc.start.column - 1));
    for (let index = startLineIndex + 1; index < endLineIndex; index++) {
      parts.push(lines[index] ?? '');
    }
    const lastLine = lines[endLineIndex] ?? '';
    parts.push(lastLine.slice(0, Math.max(0, node.loc.end.column - 1)));
    return parts.join('\n');
  }

  private getExpressionQualifiedName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }
    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (member.computed) {
        return null;
      }
      const objectName = this.getExpressionQualifiedName(member.object);
      if (!objectName) {
        return null;
      }
      return `${objectName}.${member.property.name}`;
    }
    return null;
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    if (!('ast' in this.context)) {
      return null;
    }
    const astContext = this.context as AstValidationContext;
    return astContext.ast ? astContext : null;
  }
}
