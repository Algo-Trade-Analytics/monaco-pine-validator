/**
 * Switch Statement Validation Module for Pine Script v6
 * Handles validation of switch statements, case values, and default clauses
 */

import { ValidationModule, ValidationContext, ValidatorConfig, ValidationError, ValidationResult } from '../core/types';

export class SwitchValidator implements ValidationModule {
  name = 'SwitchValidator';
  priority = 95; // Runs before TypeInferenceValidator to provide switch type information

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
    

    // Validate switch statements
    this.validateSwitchStatements();

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

  private validateSwitchStatements(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for switch statement (standalone or in assignment)
      const switchMatch = line.match(/^\s*switch\s+(.+)$/) || line.match(/^\s*\w+\s*=\s*switch\s+(.+)$/);
      if (switchMatch) {
        this.validateSwitchStatement(i, switchMatch[1].trim());
      }
    }
  }

  private validateSwitchStatement(startLine: number, switchExpression: string): void {
    const lineNum = startLine + 1;
    
    // Validate switch expression type
    this.validateSwitchExpression(switchExpression, lineNum);
    
    // Parse switch cases and validate
    const { cases, hasDefault, defaultLine } = this.parseSwitchCases(startLine);
    
    // Validate cases
    this.validateSwitchCases(cases, switchExpression, lineNum);
    
    // Check for missing default clause
    if (!hasDefault) {
      this.addWarning(lineNum, 1, 'Switch statement should include a default clause.', 'PSV6-SWITCH-NO-DEFAULT');
    }
    
    // Check for duplicate case values
    this.validateDuplicateCases(cases, lineNum);
    
    // Check for deep nesting
    this.validateSwitchNesting(startLine, lineNum);
    
    // Check for too many cases
    if (cases.length > 20) {
      this.addWarning(lineNum, 1, `Switch statement has ${cases.length} cases, consider refactoring.`, 'PSV6-SWITCH-TOO-MANY-CASES');
    }
    
    // Check for deep nesting
    this.validateSwitchNesting(startLine, lineNum);
    
    // Update type map with switch expression type
    this.updateSwitchTypeMap(startLine, switchExpression, cases);
    
    // Validate switch style
    this.validateSwitchStyle(startLine, cases, hasDefault);
  }

  private validateSwitchExpression(expression: string, lineNum: number): void {
    // Check if expression is a valid type for switch
    const trimmed = expression.trim();
    
    // Allow string literals, variables, and function calls
    if (trimmed.match(/^"[^"]*"$/) || trimmed.match(/^'[^']*'$/)) {
      // String literal - valid
      return;
    }
    
    if (trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/)) {
      // Variable or property access - valid
      return;
    }
    
    if (trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*\s*\(/)) {
      // Function call - valid
      return;
    }
    
    // Check for empty expression
    if (trimmed === '') {
      this.addError(lineNum, 1, 'Switch statement requires an expression.', 'PSV6-SWITCH-SYNTAX');
    }
    
    // Check for numeric literals (should be string for switch)
    if (trimmed.match(/^\d+$/)) {
      this.addError(lineNum, 1, 'Switch expression should be a string, not a number. Use string conversion or string literal.', 'PSV6-SWITCH-TYPE');
    }
    
    // Check for boolean literals
    if (trimmed === 'true' || trimmed === 'false') {
      this.addError(lineNum, 1, 'Switch expression should be a string, not a boolean. Use string conversion or string literal.', 'PSV6-SWITCH-TYPE');
    }
  }

  private parseSwitchCases(startLine: number): { cases: Array<{ value: string, line: number, returnType: string }>, hasDefault: boolean, defaultLine: number } {
    const cases: Array<{ value: string, line: number, returnType: string }> = [];
    let hasDefault = false;
    let defaultLine = 0;
    let caseValues = new Set<string>();
    
    // Look for cases in subsequent lines
    for (let i = startLine + 1; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;
      
      // Check if we've reached the end of the switch (next statement at same or higher indentation)
      const currentIndent = line.length - line.trimStart().length;
      const switchIndent = this.context.cleanLines[startLine].length - this.context.cleanLines[startLine].trimStart().length;
      
      if (line.trim() === '') continue; // Skip empty lines
      
      if (currentIndent <= switchIndent && line.trim() !== '') {
        // We've reached the end of the switch statement
        break;
      }
      
      // Check for case (quoted string)
      const quotedCaseMatch = line.match(/^\s*"([^"]*)"\s*=>\s*(.+)$/);
      if (quotedCaseMatch) {
        const caseValue = quotedCaseMatch[1];
        let returnValue = quotedCaseMatch[2].trim();
        
        // Handle multi-line return values (like nested switch statements)
        if (returnValue === '' || returnValue.endsWith('=>')) {
          // This is a multi-line return value, collect the full return value
          returnValue = this.collectMultiLineReturnValue(i, startLine, switchIndent);
        }
        
        // Check for duplicate case values
        if (caseValues.has(caseValue)) {
          this.addError(lineNum, 1, `Duplicate case value: "${caseValue}"`, 'PSV6-SWITCH-DUPLICATE-CASE');
        }
        caseValues.add(caseValue);
        
        // Infer return type
        const returnType = this.inferReturnType(returnValue);
        
        cases.push({
          value: caseValue,
          line: lineNum,
          returnType
        });
        
        // Case values in quotes are already strings, no need to validate
        continue;
      }
      
      // Check for case (unquoted - should be string)
      const unquotedCaseMatch = line.match(/^\s*([^"'\s][^=>]*?)\s*=>\s*(.+)$/);
      if (unquotedCaseMatch) {
        const caseValue = unquotedCaseMatch[1].trim();
        const returnValue = unquotedCaseMatch[2].trim();
        
        // Check for duplicate case values
        if (caseValues.has(caseValue)) {
          this.addError(lineNum, 1, `Duplicate case value: "${caseValue}"`, 'PSV6-SWITCH-DUPLICATE-CASE');
        }
        caseValues.add(caseValue);
        
        // Infer return type
        const returnType = this.inferReturnType(returnValue);
        
        cases.push({
          value: caseValue,
          line: lineNum,
          returnType
        });
        
        // Validate case value type - should be string
        this.validateCaseValue(caseValue, lineNum);
        continue;
      }
      
      // Check for default clause
      const defaultMatch = line.match(/^\s*=>\s*(.+)$/);
      if (defaultMatch) {
        hasDefault = true;
        defaultLine = lineNum;
        continue;
      }
    }
    
    return { cases, hasDefault, defaultLine };
  }

  private collectMultiLineReturnValue(startLine: number, switchStartLine: number, switchIndent: number): string {
    let returnValue = '';
    let currentLine = startLine + 1;
    
    while (currentLine < this.context.cleanLines.length) {
      const line = this.context.cleanLines[currentLine];
      const lineIndent = line.length - line.trimStart().length;
      
      // Stop if we've reached the end of the switch or unindented
      if (line.trim() === '') {
        currentLine++;
        continue;
      }
      
      if (lineIndent <= switchIndent) {
        break;
      }
      
      returnValue += line + '\n';
      currentLine++;
    }
    
    return returnValue.trim();
  }

  private validateSwitchCases(cases: Array<{ value: string, line: number, returnType: string }>, switchExpression: string, switchLine: number): void {
    if (cases.length === 0) return;
    
    // Check for consistent return types
    const returnTypes = new Set(cases.map(c => c.returnType));
    if (returnTypes.size > 1) {
      this.addError(switchLine, 1, 'Switch statement cases must have consistent return types.', 'PSV6-SWITCH-RETURN-TYPE');
    }
    
    // Case values are already validated during parsing
  }

  private validateCaseValue(caseValue: string, lineNum: number): void {
    // Case values should be strings
    if (caseValue.match(/^\d+$/)) {
      this.addError(lineNum, 1, 'Case value should be a string, not a number. Use string literal.', 'PSV6-SWITCH-CASE-TYPE');
    }
    
    if (caseValue === 'true' || caseValue === 'false') {
      this.addError(lineNum, 1, 'Case value should be a string, not a boolean. Use string literal.', 'PSV6-SWITCH-CASE-TYPE');
    }
  }

  private validateDuplicateCases(cases: Array<{ value: string, line: number, returnType: string }>, switchLine: number): void {
    const seen = new Set<string>();
    
    cases.forEach(case_ => {
      if (seen.has(case_.value)) {
        this.addError(case_.line, 1, `Duplicate case value: "${case_.value}"`, 'PSV6-SWITCH-DUPLICATE-CASE');
      }
      seen.add(case_.value);
    });
  }

  private validateSwitchNesting(startLine: number, switchLine: number): void {
    let nestingDepth = 1; // Start with 1 for the current switch
    
    // Count nested switch statements
    for (let i = startLine; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      
      // Check if we've reached the end of the current switch
      const currentIndent = line.length - line.trimStart().length;
      const switchIndent = this.context.cleanLines[startLine].length - this.context.cleanLines[startLine].trimStart().length;
      
      
      if (line.trim() === '') continue;
      
      if (currentIndent <= switchIndent && line.trim() !== '' && i > startLine) {
        break;
      }
      
      // Check for nested switch
      if (line.match(/^\s*switch\s+/)) {
        nestingDepth++;
      }
    }
    
    if (nestingDepth > 2) {
      this.addWarning(switchLine, 1, `Switch statement has deep nesting (${nestingDepth} levels), consider refactoring.`, 'PSV6-SWITCH-DEEP-NESTING');
    }
  }

  private inferReturnType(value: string): string {
    const trimmed = value.trim();
    
    // String literal
    if (trimmed.match(/^"[^"]*"$/) || trimmed.match(/^'[^']*'$/)) {
      return 'string';
    }
    
    // Numeric literal
    if (trimmed.match(/^\d+(\.\d+)?$/)) {
      return trimmed.includes('.') ? 'float' : 'int';
    }
    
    // Boolean literal
    if (trimmed === 'true' || trimmed === 'false') {
      return 'bool';
    }
    
    // Color literal
    if (trimmed.match(/^color\./)) {
      return 'color';
    }
    
    // Nested switch statement - treat as valid expression
    if (trimmed.includes('switch')) {
      return 'expression';
    }
    
    // Default to unknown
    return 'unknown';
  }

  private updateSwitchTypeMap(startLine: number, switchExpression: string, cases: Array<{ value: string, line: number, returnType: string }>): void {
    // Find the variable being assigned the switch result
    const line = this.context.cleanLines[startLine];
    const assignmentMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*switch\s+(.+)$/);
    
    
    if (assignmentMatch) {
      const varName = assignmentMatch[1];
      
      // Determine the return type of the switch expression
      const returnTypes = new Set(cases.map(c => c.returnType));
      let inferredType = 'unknown';
      
      if (returnTypes.size === 1) {
        // All cases return the same type
        inferredType = returnTypes.values().next().value || 'unknown';
      } else if (returnTypes.has('int') && returnTypes.has('float')) {
        // Mixed int/float - promote to float
        inferredType = 'float';
      } else if (returnTypes.has('string') && returnTypes.has('int')) {
        // Mixed string/int - use string
        inferredType = 'string';
      } else if (returnTypes.has('string') && returnTypes.has('float')) {
        // Mixed string/float - use string
        inferredType = 'string';
      } else {
        // Mixed types - use string as fallback
        inferredType = 'string';
      }
      
      // Update the type map
      this.context.typeMap.set(varName, {
        type: inferredType as any,
        isConst: false,
        isSeries: inferredType === 'series',
        declaredAt: { line: startLine + 1, column: 1 },
        usages: []
      });
    }
  }

  private validateSwitchStyle(startLine: number, cases: Array<{ value: string, line: number, returnType: string }>, hasDefault: boolean): void {
    // Check for consistent case formatting
    this.validateCaseFormatting(cases);
    
    // Check for default clause placement
    if (hasDefault) {
      this.validateDefaultClausePlacement(startLine);
    }
  }

  private validateCaseFormatting(cases: Array<{ value: string, line: number, returnType: string }>): void {
    // Check for consistent indentation in case statements
    const indentations = cases.map(c => {
      const line = this.context.cleanLines[c.line - 1];
      return line.length - line.trimStart().length;
    });
    
    if (indentations.length > 1) {
      const firstIndent = indentations[0];
      const inconsistentIndents = indentations.filter(indent => indent !== firstIndent);
      
      if (inconsistentIndents.length > 0) {
        // Find the first inconsistent case
        const inconsistentCase = cases[indentations.findIndex(indent => indent !== firstIndent)];
        this.addInfo(inconsistentCase.line, 1, 
          'Switch cases should have consistent indentation', 
          'PSV6-SWITCH-STYLE-INDENTATION');
      }
    }
  }

  private validateDefaultClausePlacement(startLine: number): void {
    // Check if default clause is at the end (best practice)
    let defaultLine = 0;
    let lastCaseLine = 0;
    
    // Find the default clause and last case
    for (let i = startLine + 1; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const trimmed = line.trim();
      
      if (trimmed.startsWith('=>') && !trimmed.includes('case')) {
        defaultLine = i + 1;
      } else if (trimmed.includes('=>') && !trimmed.startsWith('=>')) {
        lastCaseLine = i + 1;
      }
    }
    
    // Check if default clause is not at the end
    if (defaultLine > 0 && lastCaseLine > 0 && defaultLine < lastCaseLine) {
      this.addInfo(defaultLine, 1, 
        'Default clause should be placed at the end of switch statement', 
        'PSV6-SWITCH-STYLE-DEFAULT-PLACEMENT');
    }
  }
}
