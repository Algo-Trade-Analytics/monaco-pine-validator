/**
 * History Referencing validation module for Pine Script v6
 * Handles validation of history references, performance analysis, and scope validation
 */

import { ValidationModule, ValidationContext, ValidationError, ValidationResult, ValidatorConfig } from '../core/types';

export class HistoryReferencingValidator implements ValidationModule {
  name = 'HistoryReferencingValidator';
  
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  getDependencies(): string[] {
    return ['SyntaxValidator', 'TypeValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.validateHistoryReferences();
    this.validateHistoryPerformance();
    this.validateHistoryScope();
    this.validateHistoryTypes();

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

  private addError(line: number, column: number, message: string, code: string, suggestion?: string): void {
    this.errors.push({
      line,
      column,
      message,
      code,
      suggestion,
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

  private validateHistoryReferences(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Look for history references: variable[index]
      const historyRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*([^\]]+)\s*\]/g;
      let match;
      
      while ((match = historyRegex.exec(line)) !== null) {
        const variableName = match[1];
        const indexExpression = match[2];
        
        this.validateHistoryIndex(variableName, indexExpression, lineNum);
      }
    }
  }

  private validateHistoryIndex(variableName: string, indexExpression: string, lineNum: number): void {
    // Check for invalid negative index in history references
    if (indexExpression.includes('-')) {
      const negativeMatch = indexExpression.match(/-(\d+)/);
      if (negativeMatch) {
        // In Pine Script v6, distinguish between array operations and history references
        if (this.config.targetVersion >= 6) {
          // Check if this is part of an array operation
          const currentLine = this.context.cleanLines[lineNum - 1];
          const isArrayOperation = /array\.(get|set|slice|remove|insert|indexof|lastindexof)\s*\(\s*[^,)]*\s*,\s*[^,)]*\s*\[\s*[^]]*\s*\]/.test(currentLine);
          
          if (!isArrayOperation) {
            // This is a history reference like close[-1], which is invalid
            this.addError(lineNum, 1, 
              `Invalid history index: ${indexExpression}. History indices must be non-negative for series data`, 
              'PSV6-HISTORY-INVALID-INDEX',
              'Use positive indices like close[1] for historical data. For arrays, use array.get(myArray, -1).');
          }
          // If it's an array operation, let ArrayValidator handle it
        } else {
          // Pre-v6: all negative indices in history references are invalid
          this.addError(lineNum, 1, 
            `Invalid history index: ${indexExpression}. History indices must be non-negative`, 
            'PSV6-HISTORY-INVALID-INDEX');
        }
        return;
      }
    }

    // Check for large history index
    const numericMatch = indexExpression.match(/^(\d+)$/);
    if (numericMatch) {
      const index = parseInt(numericMatch[1]);
      if (index > 1000) {
        this.addWarning(lineNum, 1, 
          `Large history index: ${index}. Consider using request.security() for historical data beyond 1000 bars`, 
          'PSV6-HISTORY-LARGE-INDEX');
      }
    }
  }

  private validateHistoryPerformance(): void {
    // Check for history references in loops
    this.validateHistoryInLoops();
    
    // Check for nested history references
    this.validateNestedHistoryReferences();
  }

  private validateHistoryInLoops(): void {
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
      
      // If we're in a loop, check for history references
      if (inLoop) {
        const historyRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*([^\]]+)\s*\]/g;
        let match;
        let historyCount = 0;
        
        while ((match = historyRegex.exec(line)) !== null) {
          historyCount++;
        }
        
        if (historyCount > 0) {
          this.addWarning(lineNum, 1, 
            `History reference in loop (line ${loopStartLine}). Consider caching historical values outside the loop for better performance`, 
            'PSV6-HISTORY-PERF-LOOP');
        }
      }
    }
  }

  private validateNestedHistoryReferences(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Look for nested history references: variable[otherVariable[index]]
      const nestedHistoryRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*([^\]]+)\s*\]\s*\]/g;
      let match;
      
      while ((match = nestedHistoryRegex.exec(line)) !== null) {
        const outerVariable = match[1];
        const innerVariable = match[2];
        const innerIndex = match[3];
        
        this.addWarning(lineNum, 1, 
          `Nested history reference: ${outerVariable}[${innerVariable}[${innerIndex}]]. This can impact performance`, 
          'PSV6-HISTORY-PERF-NESTED');
      }
    }
  }

  private validateHistoryScope(): void {
    // Check for history references in varip context
    this.validateHistoryInVaripContext();
    
    // Check for history references in function parameters
    this.validateHistoryInFunctionParams();
  }

  private validateHistoryInVaripContext(): void {
    let inVaripContext = false;
    
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;
      
      // Check for varip declaration
      if (line.match(/^\s*varip\s+/)) {
        inVaripContext = true;
        continue;
      }
      
      // Check for varip assignment
      if (inVaripContext && line.includes(':=')) {
        // Look for history references in varip assignment
        const historyRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*([^\]]+)\s*\]/g;
        let match;
        
        while ((match = historyRegex.exec(line)) !== null) {
          const variableName = match[1];
          const indexExpression = match[2];
          
          this.addError(lineNum, 1, 
            `History reference '${variableName}[${indexExpression}]' in varip context. History references are not allowed in varip assignments`, 
            'PSV6-HISTORY-VARIP-CONTEXT');
        }
      }
      
      // Reset varip context on next line
      if (inVaripContext && !line.includes(':=')) {
        inVaripContext = false;
      }
    }
  }

  private validateHistoryInFunctionParams(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Look for function calls with history references in parameters
      const functionCallRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g;
      let match;
      
      while ((match = functionCallRegex.exec(line)) !== null) {
        const functionName = match[1];
        const params = match[2];
        
        // Check if parameters contain history references
        const historyRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*([^\]]+)\s*\]/g;
        let historyMatch;
        
        while ((historyMatch = historyRegex.exec(params)) !== null) {
          const variableName = historyMatch[1];
          const indexExpression = historyMatch[2];
          
          this.addWarning(lineNum, 1, 
            `History reference '${variableName}[${indexExpression}]' in function parameter. Consider passing the historical value to a variable first`, 
            'PSV6-HISTORY-FUNCTION-PARAM');
        }
      }
    }
  }

  private validateHistoryTypes(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Look for variable declarations with history references
      const declarationRegex = /^\s*(int|float|bool|string|color)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/;
      const match = line.match(declarationRegex);
      
      if (match) {
        const declaredType = match[1];
        const variableName = match[2];
        const expression = match[3];
        
        // Check if expression contains history references
        const historyRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*([^\]]+)\s*\]/g;
        let historyMatch;
        
        while ((historyMatch = historyRegex.exec(expression)) !== null) {
          const historyVariable = historyMatch[1];
          const indexExpression = historyMatch[2];
          
          // Check for type mismatch
          if (this.isTypeMismatch(declaredType, historyVariable)) {
            this.addWarning(lineNum, 1, 
              `Type mismatch: declared as '${declaredType}' but '${historyVariable}[${indexExpression}]' is a different type`, 
              'PSV6-HISTORY-TYPE-MISMATCH');
          }
        }
      }
    }
  }

  private isTypeMismatch(declaredType: string, historyVariable: string): boolean {
    // Basic type checking for common variables
    const variableTypes: { [key: string]: string } = {
      'close': 'float',
      'open': 'float',
      'high': 'float',
      'low': 'float',
      'volume': 'float',
      'time': 'int',
      'bar_index': 'int',
      'hl2': 'float',
      'hlc3': 'float',
      'ohlc4': 'float',
      'hlcc4': 'float'
    };
    
    const actualType = variableTypes[historyVariable];
    if (!actualType) return false;
    
    // Check for type mismatch
    if (declaredType === 'int' && actualType === 'float') return true;
    if (declaredType === 'float' && actualType === 'int') return false; // int to float is usually OK
    if (declaredType !== actualType) return true;
    
    return false;
  }
}
