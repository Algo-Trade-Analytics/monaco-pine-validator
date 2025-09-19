/**
 * Pine Script v6 specific features validation module
 * Handles switch statements, varip, UDTs, dynamic requests, text formatting, enums, etc.
 */

import { ValidationModule, ValidationContext, ValidatorConfig, ValidationError, ValidationResult } from '../core/types';
import { KEYWORDS, NAMESPACES, NS_MEMBERS } from '../core/constants';

export class V6FeaturesValidator implements ValidationModule {
  name = 'V6FeaturesValidator';

  getDependencies(): string[] {
    return ['SyntaxValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    const errors: ValidationError[] = [];

    // Only run v6-specific validation if target version is 6
    if (config.targetVersion !== 6) {
      return {
        isValid: errors.length === 0,
        errors: errors,
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: null
      };
    }

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;
      const noStrings = this.stripStringsAndLineComment(line);

      // Switch statement validation
      this.validateSwitchStatement(line, lineNum, context, errors);

      // varip validation
      this.validateVaripDeclaration(line, lineNum, context, errors);

      // UDT validation
      this.validateUDTDeclaration(line, lineNum, context, errors);

      // Dynamic request validation
      this.validateDynamicRequests(line, lineNum, context, errors);

      // Text formatting validation
      this.validateTextFormatting(line, lineNum, context, errors);

      // Enum validation
      this.validateEnumDeclaration(line, lineNum, context, errors);

      // Enhanced while loop validation
      this.validateWhileLoop(line, lineNum, context, errors);

      // Enhanced history referencing
      this.validateHistoryReferencing(line, lineNum, context, errors);
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: [],
      info: [],
      typeMap: new Map(),
      scriptType: null
    };
  }

  private validateSwitchStatement(line: string, lineNum: number, context: ValidationContext, errors: ValidationError[]): void {
    const switchMatch = line.match(/^\s*switch\s+(.+)$/);
    if (switchMatch) {
      const expression = switchMatch[1].trim();
      
      // Validate switch expression
      if (!expression) {
        errors.push({
          line: lineNum,
          column: 1,
          message: 'Switch statement requires an expression.',
          severity: 'error',
          code: 'PSV6-SWITCH-EXPR'
        });
        return;
      }

      // Look for case and default clauses in subsequent lines
      this.validateSwitchCases(lineNum, context, errors, expression);
    }
  }

  private validateSwitchCases(switchLine: number, context: ValidationContext, errors: ValidationError[], switchExpression: string): void {
    let foundDefault = false;
    let caseCount = 0;
    const switchIndent = this.getLineIndentation(context.cleanLines[switchLine - 1]);

    for (let i = switchLine; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineIndent = this.getLineIndentation(line);
      
      // Stop if we've unindented back to switch level or beyond
      if (i > switchLine && lineIndent <= switchIndent && line.trim() !== '') {
        break;
      }

      // Skip empty lines
      if (line.trim() === '') continue;

      // Check for case clause
      const caseMatch = line.match(/^\s*([^=]+)\s*=>\s*(.+)$/);
      if (caseMatch) {
        caseCount++;
        const caseValue = caseMatch[1].trim();
        const caseResult = caseMatch[2].trim();

        // Validate case value type compatibility with switch expression
        this.validateCaseTypeCompatibility(caseValue, switchExpression, i + 1, errors);

        // Validate case result
        if (!caseResult) {
          errors.push({
            line: i + 1,
            column: 1,
            message: 'Case clause requires a result expression.',
            severity: 'error',
            code: 'PSV6-SWITCH-CASE-RESULT'
          });
        }
        continue;
      }

      // Check for default clause
      const defaultMatch = line.match(/^\s*=>\s*(.+)$/);
      if (defaultMatch) {
        if (foundDefault) {
          errors.push({
            line: i + 1,
            column: 1,
            message: 'Switch statement can only have one default clause.',
            severity: 'error',
            code: 'PSV6-SWITCH-MULTIPLE-DEFAULT'
          });
        }
        foundDefault = true;
        const defaultResult = defaultMatch[1].trim();
        
        if (!defaultResult) {
          errors.push({
            line: i + 1,
            column: 1,
            message: 'Default clause requires a result expression.',
            severity: 'error',
            code: 'PSV6-SWITCH-DEFAULT-RESULT'
          });
        }
        continue;
      }

      // If we reach here and it's not empty, it's invalid switch syntax
      if (line.trim() !== '') {
        errors.push({
          line: i + 1,
          column: 1,
          message: 'Invalid syntax in switch statement. Expected case or default clause.',
          severity: 'error',
          code: 'PSV6-SWITCH-INVALID-SYNTAX'
        });
      }
    }

    // Validate switch structure
    if (caseCount === 0) {
      errors.push({
        line: switchLine,
        column: 1,
        message: 'Switch statement requires at least one case clause.',
        severity: 'warning',
        code: 'PSV6-SWITCH-NO-CASES'
      });
    }

    if (!foundDefault) {
      errors.push({
        line: switchLine,
        column: 1,
        message: 'Consider adding a default clause to handle unexpected values.',
        severity: 'info',
        code: 'PSV6-SWITCH-NO-DEFAULT'
      });
    }
  }

  private validateCaseTypeCompatibility(caseValue: string, switchExpression: string, lineNum: number, errors: ValidationError[]): void {
    // Basic type compatibility check
    const caseType = this.inferType(caseValue);
    const switchType = this.inferType(switchExpression);

    if (caseType !== switchType && caseType !== 'unknown' && switchType !== 'unknown') {
      errors.push({
        line: lineNum,
        column: 1,
        message: `Case value type '${caseType}' may not be compatible with switch expression type '${switchType}'.`,
        severity: 'warning',
        code: 'PSV6-SWITCH-TYPE-MISMATCH'
      });
    }
  }

  private validateVaripDeclaration(line: string, lineNum: number, context: ValidationContext, errors: ValidationError[]): void {
    const varipMatch = line.match(/^\s*varip\s+(.+)$/);
    if (varipMatch) {
      const declaration = varipMatch[1].trim();
      
      // Validate varip syntax
      if (!declaration.includes('=')) {
        errors.push({
          line: lineNum,
          column: 1,
          message: 'varip declaration requires an initial value assignment.',
          severity: 'error',
          code: 'PSV6-VARIP-NO-INIT'
        });
        return;
      }

      // Check for varip in different script types
      if (context.scriptType === 'library') {
        errors.push({
          line: lineNum,
          column: 1,
          message: 'varip variables are not allowed in libraries.',
          severity: 'error',
          code: 'PSV6-VARIP-LIBRARY'
        });
      }

      // Warn about performance implications
      errors.push({
        line: lineNum,
        column: 1,
        message: 'varip variables maintain state within bars and may impact performance.',
        severity: 'info',
        code: 'PSV6-VARIP-PERFORMANCE',
        suggestion: 'Consider using var instead if intrabar persistence is not required.'
      });

      // Check for proper usage patterns
      this.validateVaripUsagePatterns(lineNum, context, errors);
    }
  }

  private validateVaripUsagePatterns(varipLine: number, context: ValidationContext, errors: ValidationError[]): void {
    // Look for varip usage in subsequent lines to provide context-aware suggestions
    const varipIndent = this.getLineIndentation(context.cleanLines[varipLine - 1]);
    
    for (let i = varipLine; i < Math.min(varipLine + 10, context.cleanLines.length); i++) {
      const line = context.cleanLines[i];
      const lineIndent = this.getLineIndentation(line);
      
      if (lineIndent <= varipIndent && line.trim() !== '') break;
      
      // Check for barstate.isconfirmed usage with varip
      if (line.includes('barstate.isconfirmed')) {
        errors.push({
          line: i + 1,
          column: 1,
          message: 'Consider using barstate.isconfirmed to reset varip variables on confirmed bars.',
          severity: 'info',
          code: 'PSV6-VARIP-CONFIRMED',
          suggestion: 'if barstate.isconfirmed\n    varip_var := initial_value'
        });
        break;
      }
    }
  }

  private validateUDTDeclaration(line: string, lineNum: number, context: ValidationContext, errors: ValidationError[]): void {
    const udtMatch = line.match(/^\s*type\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
    if (udtMatch) {
      const typeName = udtMatch[1];
      
      // Check for conflicts with built-in types
      if (KEYWORDS.has(typeName) || NAMESPACES.has(typeName)) {
        errors.push({
          line: lineNum,
          column: line.indexOf(typeName) + 1,
          message: `Type name '${typeName}' conflicts with a built-in keyword or type.`,
          severity: 'error',
          code: 'PSV6-UDT-CONFLICT'
        });
      }

      // Validate UDT fields in subsequent lines
      this.validateUDTFields(lineNum, context, errors, typeName);
    }
  }

  private validateUDTFields(udtLine: number, context: ValidationContext, errors: ValidationError[], typeName: string): void {
    const udtIndent = this.getLineIndentation(context.cleanLines[udtLine - 1]);
    const fields: string[] = [];

    for (let i = udtLine; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineIndent = this.getLineIndentation(line);
      
      // Stop if we've unindented back to UDT level or beyond
      if (i > udtLine && lineIndent <= udtIndent && line.trim() !== '') {
        break;
      }

      // Parse field declarations
      const fieldMatch = line.match(/^\s+(int|float|bool|string|color)\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
      if (fieldMatch) {
        const fieldType = fieldMatch[1];
        const fieldName = fieldMatch[2];
        
        // Check for duplicate field names
        if (fields.includes(fieldName)) {
          errors.push({
            line: i + 1,
            column: line.indexOf(fieldName) + 1,
            message: `Duplicate field name '${fieldName}' in type '${typeName}'.`,
            severity: 'error',
            code: 'PSV6-UDT-DUPLICATE-FIELD'
          });
        } else {
          fields.push(fieldName);
        }

        // Validate field type
        if (!['int', 'float', 'bool', 'string', 'color'].includes(fieldType)) {
          errors.push({
            line: i + 1,
            column: line.indexOf(fieldType) + 1,
            message: `Invalid field type '${fieldType}' in UDT. Only basic types are allowed.`,
            severity: 'error',
            code: 'PSV6-UDT-INVALID-TYPE'
          });
        }
      }
    }

    // Validate UDT has at least one field
    if (fields.length === 0) {
      errors.push({
        line: udtLine,
        column: 1,
        message: `Type '${typeName}' should have at least one field.`,
        severity: 'warning',
        code: 'PSV6-UDT-NO-FIELDS'
      });
    }
  }

  private validateDynamicRequests(line: string, lineNum: number, context: ValidationContext, errors: ValidationError[]): void {
    // Check for request.security with series string arguments
    const requestMatch = line.match(/request\.security\s*\(([^)]+)\)/);
    if (requestMatch) {
      const args = requestMatch[1];
      
      // Check for series string arguments
      if (args.includes('timeframe.period') || args.includes('syminfo.tickerid')) {
        errors.push({
          line: lineNum,
          column: 1,
          message: 'Dynamic data requests with series string arguments are supported in v6.',
          severity: 'info',
          code: 'PSV6-DYNAMIC-REQUEST',
          suggestion: 'Ensure proper error handling for invalid timeframes or symbols.'
        });
      }

      // Validate request parameters
      this.validateRequestParameters(args, lineNum, errors);
    }

    // Check for other request functions
    const otherRequests = ['request.dividends', 'request.earnings', 'request.splits'];
    for (const reqFunc of otherRequests) {
      if (line.includes(reqFunc)) {
        errors.push({
          line: lineNum,
          column: 1,
          message: `${reqFunc} is available in Pine Script v6.`,
          severity: 'info',
          code: 'PSV6-REQUEST-FUNCTION'
        });
      }
    }
  }

  private validateRequestParameters(args: string, lineNum: number, errors: ValidationError[]): void {
    // Basic parameter validation for request.security
    const params = args.split(',').map(p => p.trim());
    
    if (params.length < 3) {
      errors.push({
        line: lineNum,
        column: 1,
        message: 'request.security requires at least 3 parameters: symbol, timeframe, expression.',
        severity: 'error',
        code: 'PSV6-REQUEST-PARAMS'
      });
    }
  }

  private validateTextFormatting(line: string, lineNum: number, context: ValidationContext, errors: ValidationError[]): void {
    // Check for text formatting functions
    const textFormatFunctions = [
      'text.format_bold',
      'text.format_italic', 
      'text.format_color',
      'text.format_size'
    ];

    for (const func of textFormatFunctions) {
      if (line.includes(func)) {
        errors.push({
          line: lineNum,
          column: 1,
          message: `${func} is available in Pine Script v6 for text formatting.`,
          severity: 'info',
          code: 'PSV6-TEXT-FORMAT'
        });

        // Validate function usage
        this.validateTextFormatFunction(line, lineNum, func, errors);
      }
    }
  }

  private validateTextFormatFunction(line: string, lineNum: number, func: string, errors: ValidationError[]): void {
    // Basic validation for text formatting functions
    if (func === 'text.format_bold' || func === 'text.format_italic') {
      if (!line.includes('"') && !line.includes("'")) {
        errors.push({
          line: lineNum,
          column: 1,
          message: `${func} requires a string argument.`,
          severity: 'warning',
          code: 'PSV6-TEXT-FORMAT-STRING'
        });
      }
    }

    if (func === 'text.format_color') {
      if (!line.includes('color.')) {
        errors.push({
          line: lineNum,
          column: 1,
          message: `${func} requires a color argument.`,
          severity: 'warning',
          code: 'PSV6-TEXT-FORMAT-COLOR'
        });
      }
    }
  }

  private validateEnumDeclaration(line: string, lineNum: number, context: ValidationContext, errors: ValidationError[]): void {
    const enumMatch = line.match(/^\s*enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
    if (enumMatch) {
      const enumName = enumMatch[1];
      
      // Check for conflicts
      if (KEYWORDS.has(enumName) || NAMESPACES.has(enumName)) {
        errors.push({
          line: lineNum,
          column: line.indexOf(enumName) + 1,
          message: `Enum name '${enumName}' conflicts with a built-in keyword or type.`,
          severity: 'error',
          code: 'PSV6-ENUM-CONFLICT'
        });
      }

      // Validate enum values in subsequent lines
      this.validateEnumValues(lineNum, context, errors, enumName);
    }
  }

  private validateEnumValues(enumLine: number, context: ValidationContext, errors: ValidationError[], enumName: string): void {
    const enumIndent = this.getLineIndentation(context.cleanLines[enumLine - 1]);
    const values: string[] = [];

    for (let i = enumLine; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineIndent = this.getLineIndentation(line);
      
      // Stop if we've unindented back to enum level or beyond
      if (i > enumLine && lineIndent <= enumIndent && line.trim() !== '') {
        break;
      }

      // Parse enum values
      const valueMatch = line.match(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
      if (valueMatch) {
        const value = valueMatch[1];
        
        // Check for duplicate values
        if (values.includes(value)) {
          errors.push({
            line: i + 1,
            column: line.indexOf(value) + 1,
            message: `Duplicate enum value '${value}' in enum '${enumName}'.`,
            severity: 'error',
            code: 'PSV6-ENUM-DUPLICATE-VALUE'
          });
        } else {
          values.push(value);
        }
      }
    }

    // Validate enum has at least one value
    if (values.length === 0) {
      errors.push({
        line: enumLine,
        column: 1,
        message: `Enum '${enumName}' should have at least one value.`,
        severity: 'warning',
        code: 'PSV6-ENUM-NO-VALUES'
      });
    }
  }

  private validateWhileLoop(line: string, lineNum: number, context: ValidationContext, errors: ValidationError[]): void {
    const whileMatch = line.match(/^\s*while\s+(.+)$/);
    if (whileMatch) {
      const condition = whileMatch[1].trim();
      
      // Validate while condition
      if (!condition) {
        errors.push({
          line: lineNum,
          column: 1,
          message: 'While loop requires a condition.',
          severity: 'error',
          code: 'PSV6-WHILE-CONDITION'
        });
        return;
      }

      // Check for boolean condition
      const conditionType = this.inferType(condition);
      if (conditionType !== 'bool' && conditionType !== 'unknown') {
        errors.push({
          line: lineNum,
          column: 1,
          message: 'While loop condition should be boolean.',
          severity: 'warning',
          code: 'PSV6-WHILE-BOOL-CONDITION'
        });
      }

      // Check for potential infinite loops
      this.validateWhileLoopSafety(lineNum, context, errors, condition);
    }
  }

  private validateWhileLoopSafety(whileLine: number, context: ValidationContext, errors: ValidationError[], condition: string): void {
    // Look for loop variable modification in the loop body
    const whileIndent = this.getLineIndentation(context.cleanLines[whileLine - 1]);
    let foundModification = false;

    for (let i = whileLine; i < Math.min(whileLine + 20, context.cleanLines.length); i++) {
      const line = context.cleanLines[i];
      const lineIndent = this.getLineIndentation(line);
      
      if (lineIndent <= whileIndent && line.trim() !== '') break;
      
      // Check for variable modifications
      if (line.includes(':=') || line.includes('+=') || line.includes('-=')) {
        foundModification = true;
        break;
      }
    }

    if (!foundModification) {
      errors.push({
        line: whileLine,
        column: 1,
        message: 'While loop may be infinite if loop variable is not modified.',
        severity: 'warning',
        code: 'PSV6-WHILE-INFINITE',
        suggestion: 'Ensure the loop condition variable is modified within the loop body.'
      });
    }
  }

  private validateHistoryReferencing(line: string, lineNum: number, context: ValidationContext, errors: ValidationError[]): void {
    // Enhanced history referencing validation
    const historyRefs = line.match(/\[(\d+)\]/g);
    if (historyRefs) {
      for (const ref of historyRefs) {
        const index = parseInt(ref.slice(1, -1));
        
        // Warn about large history references
        if (index > 100) {
          errors.push({
            line: lineNum,
            column: line.indexOf(ref) + 1,
            message: `Large history reference [${index}] may impact performance.`,
            severity: 'warning',
            code: 'PSV6-HISTORY-LARGE',
            suggestion: 'Consider using a smaller lookback period or caching the result.'
          });
        }

        // Warn about zero index
        if (index === 0) {
          errors.push({
            line: lineNum,
            column: line.indexOf(ref) + 1,
            message: 'History reference [0] is equivalent to the current value.',
            severity: 'info',
            code: 'PSV6-HISTORY-ZERO',
            suggestion: 'Consider using the variable directly without [0].'
          });
        }
      }
    }
  }

  private inferType(expression: string): string {
    const trimmed = expression.trim();
    
    if (/^(true|false)\b/.test(trimmed)) return 'bool';
    if (/^"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/.test(trimmed)) return 'string';
    if (/^[+\-]?\d[\d_]*(?:\.\d[\d_]*)?(?:e[+\-]?\d+)?\b/i.test(trimmed)) {
      return trimmed.includes('.') || /e[+\-]/i.test(trimmed) ? 'float' : 'int';
    }
    if (/\bcolor\.(?:\w+)\b|\bcolor\.new\s*\(/.test(trimmed)) return 'color';
    
    return 'unknown';
  }

  private getLineIndentation(line: string): number {
    return line.length - line.trimStart().length;
  }

  private stripStringsAndLineComment(line: string): string {
    return this.stripStrings(line).replace(/\/\/.*$/, '');
  }

  private stripStrings(line: string): string {
    return line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => ' '.repeat(m.length));
  }
}
