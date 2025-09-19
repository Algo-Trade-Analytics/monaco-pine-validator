/**
 * Code style and quality validation module for Pine Script v6
 * Handles naming conventions, magic numbers, complexity analysis, and code organization
 */

import { ValidationModule, ValidationContext, ValidatorConfig, ValidationError, ValidationResult } from '../core/types';

export class StyleValidator implements ValidationModule {
  name = 'StyleValidator';

  getDependencies(): string[] {
    return ['SyntaxValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    const errors: ValidationError[] = [];

    // Analyze variable naming
    this.analyzeVariableNaming(context, errors);

    // Analyze magic numbers
    this.analyzeMagicNumbers(context, errors);

    // Analyze function complexity
    this.analyzeFunctionComplexity(context, errors);

    // Analyze code organization
    this.analyzeCodeOrganization(context, errors);

    // Analyze code quality metrics
    this.analyzeCodeQuality(context, errors);

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: [],
      info: [],
      typeMap: new Map(),
      scriptType: null
    };
  }

  private analyzeVariableNaming(context: ValidationContext, errors: ValidationError[]): void {
    const poorNames: string[] = [];
    const variableDeclarations = new Map<string, number>();

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;

      // Find variable declarations
      const varMatch = line.match(/^\s*(?:var|varip|const)?\s*(?:int|float|bool|string|color)?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
      if (varMatch) {
        const varName = varMatch[1];
        variableDeclarations.set(varName, lineNum);

        // Check for poor naming
        if (this.isPoorVariableName(varName)) {
          poorNames.push(varName);
        }
      }

      // Find simple assignments
      const assignMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*[^=]/);
      if (assignMatch && !line.includes('if ') && !line.includes('for ') && !line.includes('while ')) {
        const varName = assignMatch[1];
        if (!variableDeclarations.has(varName) && this.isPoorVariableName(varName)) {
          poorNames.push(varName);
        }
      }
    }

    // Report poor naming
    if (poorNames.length > 0) {
      errors.push({
        line: 1,
        column: 1,
        message: `Poor variable naming detected: ${poorNames.slice(0, 5).join(', ')}${poorNames.length > 5 ? '...' : ''}`,
        severity: 'info',
        code: 'PSV6-STYLE-NAMING',
        suggestion: 'Use descriptive variable names that clearly indicate their purpose (e.g., sma_20 instead of x).'
      });
    }
  }

  private analyzeMagicNumbers(context: ValidationContext, errors: ValidationError[]): void {
    const magicNumbers: Array<{ value: string; line: number; suggestion: string }> = [];

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;
      const noStrings = this.stripStringsAndLineComment(line);

      // Find numeric literals
      const numberMatches = noStrings.match(/\b(\d+(?:\.\d+)?)\b/g);
      if (numberMatches) {
        for (const match of numberMatches) {
          const value = parseFloat(match);
          
          // Skip common small numbers and percentages
          if (value < 5 || value === 100 || value === 1000 || value === 10000) {
            continue;
          }

          // Check if it's a magic number
          if (this.isMagicNumber(value, line)) {
            const suggestion = this.suggestConstantName(match);
            magicNumbers.push({
              value: match,
              line: lineNum,
              suggestion
            });
          }
        }
      }
    }

    // Report magic numbers
    if (magicNumbers.length > 0) {
      const uniqueValues = [...new Set(magicNumbers.map(m => m.value))];
      errors.push({
        line: 1,
        column: 1,
        message: `Magic numbers detected: ${uniqueValues.slice(0, 3).join(', ')}${uniqueValues.length > 3 ? '...' : ''}`,
        severity: 'info',
        code: 'PSV6-STYLE-MAGIC',
        suggestion: 'Consider defining named constants for magic numbers to improve readability and maintainability.'
      });
    }
  }

  private analyzeFunctionComplexity(context: ValidationContext, errors: ValidationError[]): void {
    const functions = this.extractFunctions(context);

    for (const func of functions) {
      const complexity = this.calculateFunctionComplexity(func, context);
      
      if (complexity > 5) {
        errors.push({
          line: func.startLine,
          column: 1,
          message: `Function '${func.name}' has high complexity (${complexity} conditions).`,
          severity: 'warning',
          code: 'PSV6-STYLE-COMPLEXITY',
          suggestion: 'Consider breaking down complex functions into smaller, more focused functions.'
        });
      }

      // Check function length
      const length = func.endLine - func.startLine + 1;
      if (length > 20) {
        errors.push({
          line: func.startLine,
          column: 1,
          message: `Function '${func.name}' is quite long (${length} lines).`,
          severity: 'info',
          code: 'PSV6-STYLE-FUNCTION-LENGTH',
          suggestion: 'Consider breaking long functions into smaller, more manageable pieces.'
        });
      }
    }
  }

  private analyzeCodeOrganization(context: ValidationContext, errors: ValidationError[]): void {
    let taCount = 0;
    let plotCount = 0;
    let inputCount = 0;
    let mixedSections = false;

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;

      // Count different types of operations
      if (line.includes('ta.')) taCount++;
      if (line.includes('plot(')) plotCount++;
      if (line.includes('input.')) inputCount++;

      // Check for mixed sections (different types of operations close together)
      if (i > 0 && i < context.cleanLines.length - 1) {
        const prevLine = context.cleanLines[i - 1];
        const nextLine = context.cleanLines[i + 1];
        
        if (this.hasDifferentOperationTypes(line, prevLine, nextLine)) {
          mixedSections = true;
        }
      }
    }

    // Suggest organization improvements
    if (taCount >= 3 && plotCount >= 1) {
      errors.push({
        line: 1,
        column: 1,
        message: 'Consider organizing code into logical sections: inputs, calculations, and plots.',
        severity: 'info',
        code: 'PSV6-STYLE-ORGANIZATION',
        suggestion: 'Group related operations together: inputs at the top, calculations in the middle, plots at the bottom.'
      });
    }

    if (mixedSections) {
      errors.push({
        line: 1,
        column: 1,
        message: 'Code sections appear mixed. Consider grouping related operations.',
        severity: 'info',
        code: 'PSV6-STYLE-MIXED-SECTIONS',
        suggestion: 'Organize code into clear sections: inputs, variables, calculations, conditions, and outputs.'
      });
    }

    // Check input placement
    if (inputCount > 0) {
      this.validateInputPlacement(context, errors);
    }
  }

  private analyzeCodeQuality(context: ValidationContext, errors: ValidationError[]): void {
    // Check for commented code
    this.checkCommentedCode(context, errors);

    // Check for long lines
    this.checkLongLines(context, errors);

    // Check for inconsistent indentation
    this.checkIndentationConsistency(context, errors);

    // Check for dead code
    this.checkDeadCode(context, errors);
  }

  private isPoorVariableName(name: string): boolean {
    // Single letter names (except common ones)
    if (name.length === 1 && !['i', 'j', 'k', 'x', 'y', 'z'].includes(name)) {
      return true;
    }

    // Very short names
    if (name.length <= 2 && !['pi', 'na', 'hl2', 'hlc3', 'ohlc4'].includes(name)) {
      return true;
    }

    // Common poor names
    const poorNames = ['temp', 'tmp', 'val', 'value', 'data', 'result', 'res', 'var', 'variable'];
    return poorNames.includes(name.toLowerCase());
  }

  private isMagicNumber(value: number, line: string): boolean {
    // Skip common values (but allow 20 and 50 as they are often magic numbers in trading)
    const commonValues = [0, 1, 2, 3, 4, 5, 10, 100, 1000, 10000];
    if (commonValues.includes(value)) {
      return false;
    }

    // Consider numbers >= 20 as potential magic numbers
    // Even in TA functions, 20 and 50 are often magic numbers that should be constants
    return value >= 20;
  }

  private suggestConstantName(number: string): string {
    const value = parseFloat(number);
    
    // Common suggestions
    const suggestions: Record<number, string> = {
      14: 'RSI_LENGTH',
      20: 'SMA_LENGTH',
      50: 'SMA_LONG_LENGTH',
      200: 'SMA_VERY_LONG_LENGTH',
      70: 'RSI_OVERBOUGHT',
      30: 'RSI_OVERSOLD',
      0.02: 'COMMISSION_RATE',
      0.1: 'SLIPPAGE_RATE'
    };

    return suggestions[value] || `CONSTANT_${number.replace('.', '_')}`;
  }

  private extractFunctions(context: ValidationContext): Array<{ name: string; startLine: number; endLine: number }> {
    const functions: Array<{ name: string; startLine: number; endLine: number }> = [];
    
    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      
      // Look for function declarations
      const funcMatch = line.match(/^\s*(\w+)\s*\([^)]*\)\s*=>/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const startLine = i + 1;
        
        // Find the end of the function (next function or end of file)
        let endLine = context.cleanLines.length;
        for (let j = i + 1; j < context.cleanLines.length; j++) {
          const nextLine = context.cleanLines[j];
          if (nextLine.match(/^\s*\w+\s*\([^)]*\)\s*=>/) || 
              nextLine.match(/^\s*(indicator|strategy|library)\s*\(/)) {
            endLine = j;
            break;
          }
        }
        
        functions.push({ name: funcName, startLine, endLine });
      }
    }
    
    return functions;
  }

  private calculateFunctionComplexity(func: { name: string; startLine: number; endLine: number }, context: ValidationContext): number {
    let complexity = 0;
    
    for (let i = func.startLine - 1; i < func.endLine - 1; i++) {
      const line = context.cleanLines[i];
      
      // Count conditional statements
      if (line.includes('if ') || line.includes('else')) complexity++;
      if (line.includes('switch')) complexity++;
      if (line.includes('for ') || line.includes('while ')) complexity++;
      
      // Count logical operators
      const andCount = (line.match(/\band\b/g) || []).length;
      const orCount = (line.match(/\bor\b/g) || []).length;
      complexity += andCount + orCount;
    }
    
    return complexity;
  }

  private hasDifferentOperationTypes(line: string, prevLine: string, nextLine: string): boolean {
    const getOperationType = (l: string) => {
      if (l.includes('input.')) return 'input';
      if (l.includes('ta.')) return 'calculation';
      if (l.includes('plot(')) return 'plot';
      if (l.includes('strategy.')) return 'strategy';
      return 'other';
    };

    const currentType = getOperationType(line);
    const prevType = getOperationType(prevLine);
    const nextType = getOperationType(nextLine);

    return currentType !== prevType && currentType !== nextType && 
           prevType !== 'other' && nextType !== 'other';
  }

  private validateInputPlacement(context: ValidationContext, errors: ValidationError[]): void {
    let firstInputLine = -1;
    let firstCalculationLine = -1;

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      
      if (line.includes('input.') && firstInputLine === -1) {
        firstInputLine = i + 1;
      }
      
      if ((line.includes('ta.') || line.includes('var ') || line.includes('const ')) && firstCalculationLine === -1) {
        firstCalculationLine = i + 1;
      }
    }

    if (firstInputLine > firstCalculationLine && firstCalculationLine !== -1) {
      errors.push({
        line: firstInputLine,
        column: 1,
        message: 'Inputs should be declared before calculations.',
        severity: 'warning',
        code: 'PSV6-STYLE-INPUT-PLACEMENT',
        suggestion: 'Move input declarations to the top of the script, before any calculations.'
      });
    }
  }

  private checkCommentedCode(context: ValidationContext, errors: ValidationError[]): void {
    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;

      // Check for commented code (lines that look like code but are commented)
      if (line.trim().startsWith('//')) {
        const uncommented = line.replace(/^\/\/\s*/, '').trim();
        
        // Check if it looks like code
        if (this.looksLikeCode(uncommented)) {
          errors.push({
            line: lineNum,
            column: 1,
            message: 'Commented code detected. Consider removing or documenting why it\'s commented.',
            severity: 'info',
            code: 'PSV6-STYLE-COMMENTED-CODE',
            suggestion: 'Remove commented code or add a comment explaining why it\'s kept.'
          });
        }
      }
    }
  }

  private checkLongLines(context: ValidationContext, errors: ValidationError[]): void {
    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;

      if (line.length > 120) {
        errors.push({
          line: lineNum,
          column: 1,
          message: `Line is quite long (${line.length} characters).`,
          severity: 'info',
          code: 'PSV6-STYLE-LONG-LINE',
          suggestion: 'Consider breaking long lines for better readability.'
        });
      }
    }
  }

  private checkIndentationConsistency(context: ValidationContext, errors: ValidationError[]): void {
    let hasTabs = false;
    let hasSpaces = false;

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      
      if (line.startsWith('\t')) hasTabs = true;
      if (line.startsWith(' ')) hasSpaces = true;
    }

    if (hasTabs && hasSpaces) {
      errors.push({
        line: 1,
        column: 1,
        message: 'Mixed tabs and spaces for indentation detected.',
        severity: 'warning',
        code: 'PSV6-STYLE-MIXED-INDENTATION',
        suggestion: 'Use consistent indentation (either tabs or spaces, but not both).'
      });
    }
  }

  private checkDeadCode(context: ValidationContext, errors: ValidationError[]): void {
    // This is a simplified check - in a real implementation, you'd need more sophisticated analysis
    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;

      // Check for unreachable code after return statements
      if (line.includes('return') && i < context.cleanLines.length - 1) {
        const nextLine = context.cleanLines[i + 1];
        if (nextLine.trim() !== '' && !nextLine.match(/^\s*(else|elif)/)) {
          errors.push({
            line: lineNum + 1,
            column: 1,
            message: 'Code after return statement may be unreachable.',
            severity: 'warning',
            code: 'PSV6-STYLE-UNREACHABLE-CODE',
            suggestion: 'Remove unreachable code or restructure the logic.'
          });
        }
      }
    }
  }

  private looksLikeCode(line: string): boolean {
    // Simple heuristic to detect if a line looks like code
    const codePatterns = [
      /^\w+\s*=/,
      /^\w+\s*\(/,
      /^\s*(if|for|while|switch)\b/,
      /^\s*(var|const|varip)\b/,
      /^\s*return\b/,
      /^\s*plot\b/,
      /^\s*strategy\./
    ];

    return codePatterns.some(pattern => pattern.test(line));
  }

  private stripStringsAndLineComment(line: string): string {
    return this.stripStrings(line).replace(/\/\/.*$/, '');
  }

  private stripStrings(line: string): string {
    return line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => ' '.repeat(m.length));
  }
}
