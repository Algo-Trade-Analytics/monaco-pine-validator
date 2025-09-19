import { ValidationModule, ValidationContext, ValidationError, ValidationResult, ValidatorConfig } from '../core/types';

export class VaripValidator implements ValidationModule {
  name = 'VaripValidator';
  
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

    this.validateVaripDeclarations();
    this.validateVaripUsage();
    this.validateVaripScope();
    this.validateVaripPerformance();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: null,
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

  private validateVaripDeclarations(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for any varip-related lines
      if (/^\s*varip\s*/.test(line)) {
        // Check for valid varip declarations with explicit type
        const varipMatch = line.match(/^\s*varip\s+[A-Za-z_][A-Za-z0-9_]*\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
        if (varipMatch) {
          const varName = varipMatch[1];
          const initialValue = varipMatch[2];

          // Validate varip syntax
          this.validateVaripSyntax(line, lineNum);
          
          // Validate varip type
          this.validateVaripType(varName, initialValue, lineNum);
          
          // Check for varip naming conventions
          this.validateVaripNaming(varName, lineNum);
        } else {
          // Check for varip declarations without explicit type (like "varip unknown_var = some_function()")
          const varipNoTypeMatch = line.match(/^\s*varip\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
          if (varipNoTypeMatch) {
            const varName = varipNoTypeMatch[1];
            const initialValue = varipNoTypeMatch[2];

            // Validate varip syntax
            this.validateVaripSyntax(line, lineNum);
            
            // Validate varip type (this will trigger type inference warning)
            this.validateVaripType(varName, initialValue, lineNum);
            
            // Check for varip naming conventions
            this.validateVaripNaming(varName, lineNum);
          } else {
            // Invalid varip syntax
            this.validateVaripSyntax(line, lineNum);
          }
        }
      }
    }
  }

  private validateVaripSyntax(line: string, lineNum: number): void {
    // Check for proper varip syntax - more flexible pattern
    if (!/^\s*varip\s+[A-Za-z_][A-Za-z0-9_]*\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*/.test(line)) {
      this.addError(lineNum, 1, 
        'Invalid varip declaration syntax. Expected: varip <type> <name> = <value>', 
        'PSV6-VARIP-SYNTAX');
    }

    // Check for missing initial value
    if (!line.includes('=')) {
      this.addError(lineNum, 1, 
        'varip declaration must include an initial value', 
        'PSV6-VARIP-INITIAL-VALUE');
    }
  }

  private validateVaripType(varName: string, initialValue: string, lineNum: number): void {
    // Check if initial value is a literal
    if (!this.isLiteralValue(initialValue)) {
      this.addWarning(lineNum, 1, 
        `varip '${varName}' should be initialized with a literal value for better performance`, 
        'PSV6-VARIP-LITERAL-INIT');
    }

    // Check for type consistency
    const inferredType = this.inferTypeFromValue(initialValue);
    if (inferredType === 'unknown') {
      this.addWarning(lineNum, 1, 
        `Could not infer type for varip '${varName}'. Consider explicit type declaration`, 
        'PSV6-VARIP-TYPE-INFERENCE');
    }
  }

  private validateVaripNaming(varName: string, lineNum: number): void {
    // Check for descriptive naming
    if (varName.length < 3) {
      this.addWarning(lineNum, 1, 
        `varip '${varName}' should have a more descriptive name`, 
        'PSV6-VARIP-NAMING');
    }

    // Check for common varip naming patterns
    if (!/^(intrabar|bar|count|state|flag|persist)/i.test(varName)) {
      this.addInfo(lineNum, 1, 
        `Consider using descriptive prefixes like 'intrabar_' or 'bar_' for varip variables`, 
        'PSV6-VARIP-NAMING-SUGGESTION');
    }
  }

  private validateVaripUsage(): void {
    const varipVariables = new Set<string>();
    
    // Collect all varip variables
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const varipMatch = line.match(/^\s*varip\s+[A-Za-z_][A-Za-z0-9_]*\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (varipMatch) {
        varipVariables.add(varipMatch[1]);
      }
    }

    // Check usage patterns
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      for (const varName of varipVariables) {
        if (line.includes(varName)) {
          // Check for proper varip usage patterns
          this.validateVaripUsagePattern(varName, line, lineNum);
        }
      }
    }
  }

  private validateVaripUsagePattern(varName: string, line: string, lineNum: number): void {
    // Skip varip declarations (they use = for initial assignment)
    if (/^\s*varip\s+/.test(line)) {
      return;
    }

    // Check for barstate.isconfirmed usage
    if (line.includes(varName) && line.includes(':=')) {
      if (!line.includes('barstate.isconfirmed') && !line.includes('barstate.isnew')) {
        this.addWarning(lineNum, 1, 
          `varip '${varName}' modification should consider barstate conditions for proper intrabar behavior`, 
          'PSV6-VARIP-BARSTATE');
      }
    }

    // Check for proper assignment operator (only for reassignments, not declarations)
    if (line.includes(varName) && line.includes('=') && !/^\s*varip\s+/.test(line)) {
      // Remove comments from the line before checking
      const lineWithoutComments = line.replace(/\/\/.*$/, '').trim();
      
      // Check if the line contains := in the actual code (not comments)
      const hasCompoundAssignment = lineWithoutComments.includes(':=');
      
      // Check if this is an assignment (not just a comparison or function call)
      // More flexible pattern to match assignments like "count = 10"
      const assignmentPattern = new RegExp(`^\\s*${varName}\\s*=\\s*`);
      
      if (assignmentPattern.test(lineWithoutComments) && !hasCompoundAssignment) {
        this.addError(lineNum, 1, 
          `varip '${varName}' should use ':=' for assignment, not '='`, 
          'PSV6-VARIP-ASSIGNMENT');
      }
    }
  }

  private validateVaripScope(): void {
    // Check for varip in inappropriate contexts
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for varip in functions
      if (line.includes('varip') && this.isInsideFunction(i)) {
        this.addError(lineNum, 1, 
          'varip declarations are not allowed inside functions', 
          'PSV6-VARIP-SCOPE-FUNCTION');
      }

      // Check for varip in loops
      if (line.includes('varip') && this.isInsideLoop(i)) {
        this.addError(lineNum, 1, 
          'varip declarations are not allowed inside loops', 
          'PSV6-VARIP-SCOPE-LOOP');
      }
    }
  }

  private validateVaripPerformance(): void {
    const varipCount = this.countVaripDeclarations();
    
    if (varipCount > 10) {
      this.addWarning(1, 1, 
        `High number of varip variables (${varipCount}). Consider if all are necessary for performance`, 
        'PSV6-VARIP-PERFORMANCE');
    }

    // Check for varip in strategy scripts
    if (this.isStrategyScript() && varipCount > 5) {
      this.addWarning(1, 1, 
        'Strategy scripts should minimize varip usage for better backtesting accuracy', 
        'PSV6-VARIP-STRATEGY');
    }
  }

  private isLiteralValue(value: string): boolean {
    const trimmed = value.trim();
    
    // Check for numeric literals
    if (/^[+\-]?\d+(\.\d+)?([eE][+\-]?\d+)?$/.test(trimmed)) return true;
    
    // Check for boolean literals
    if (trimmed === 'true' || trimmed === 'false') return true;
    
    // Check for string literals
    if (/^"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'$/.test(trimmed)) return true;
    
    // Check for na
    if (trimmed === 'na') return true;
    
    return false;
  }

  private inferTypeFromValue(value: string): string {
    const trimmed = value.trim();
    
    if (/^[+\-]?\d+(\.\d+)?([eE][+\-]?\d+)?$/.test(trimmed)) {
      return trimmed.includes('.') || /[eE]/.test(trimmed) ? 'float' : 'int';
    }
    
    if (trimmed === 'true' || trimmed === 'false') return 'bool';
    if (/^"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'$/.test(trimmed)) return 'string';
    if (trimmed === 'na') return 'unknown';
    
    return 'unknown';
  }

  private isInsideFunction(lineIndex: number): boolean {
    let functionDepth = 0;
    
    for (let i = 0; i <= lineIndex; i++) {
      const line = this.context.cleanLines[i];
      
      // Check for function start
      if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)\s*=>/.test(line)) {
        functionDepth++;
      }
      
      // Check for function end (unindent)
      if (i === lineIndex) {
        return functionDepth > 0;
      }
    }
    
    return false;
  }

  private isInsideLoop(lineIndex: number): boolean {
    let loopDepth = 0;
    
    for (let i = 0; i <= lineIndex; i++) {
      const line = this.context.cleanLines[i];
      const indent = this.getLineIndentation(line);
      
      // Check for loop start
      if (/^\s*for\s+\w+\s*=\s*\d+\s+to\s+\d+/.test(line) || /^\s*while\s+/.test(line)) {
        loopDepth++;
      }
      
      // Check for loop end (unindent)
      if (i === lineIndex) {
        return loopDepth > 0;
      }
    }
    
    return false;
  }

  private countVaripDeclarations(): number {
    let count = 0;
    
    for (const line of this.context.cleanLines) {
      if (/^\s*varip\s+/.test(line)) {
        count++;
      }
    }
    
    return count;
  }

  private isStrategyScript(): boolean {
    for (const line of this.context.cleanLines) {
      if (/^\s*strategy\s*\(/.test(line)) {
        return true;
      }
    }
    return false;
  }

  private getLineIndentation(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }
}
