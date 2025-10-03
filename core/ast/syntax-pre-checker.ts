/**
 * Pre-Parser Syntax Checker
 * 
 * Catches common syntax errors before the parser runs, providing
 * accurate line/column information and clear error messages.
 */

import type { ValidationError } from '../types';
import { checkIndentation } from './indentation-checker';

export interface SyntaxPattern {
  pattern: RegExp;
  code: string;
  message: (match: RegExpMatchArray, line: number, col: number) => string;
  suggestion: (match: RegExpMatchArray) => string;
}

/**
 * Common syntax error patterns to check before parsing
 */
const SYNTAX_PATTERNS: SyntaxPattern[] = [
  // Empty parameter after opening parenthesis: func(, ...)
  {
    pattern: /(\w+(?:\.\w+)?)\s*\(\s*,/,
    code: 'PSV6-SYNTAX-EMPTY-PARAM',
    message: (match) => `Missing parameter in ${match[1]}() call`,
    suggestion: (match) => {
      const funcName = match[1];
      if (funcName.startsWith('input.')) {
        return `${funcName}() requires a default value as the first parameter. Example: ${funcName}(10, "Label", ...)`;
      }
      return `Function calls cannot have empty parameters. Provide a value or expression as the first parameter.`;
    }
  },
  
  // Empty parameter between commas: func(a, , b) - but not tuple destructuring [a, , c]
  {
    pattern: /[a-zA-Z_][a-zA-Z0-9_]*(?:\.\w+)?\s*\([^)]*,\s*,/,
    code: 'PSV6-SYNTAX-EMPTY-PARAM',
    message: () => `Empty parameter between commas`,
    suggestion: () => `Function calls cannot have empty parameters. Remove the extra comma or provide a value.`
  },
  
  // Empty parameter before closing paren: func(a, )
  {
    pattern: /,\s*\)/,
    code: 'PSV6-SYNTAX-TRAILING-COMMA',
    message: () => `Trailing comma before closing parenthesis`,
    suggestion: () => `Remove the trailing comma or provide a parameter value.`
  },
];

/**
 * Pre-check source code for common syntax errors before parsing
 * 
 * Note: Indentation checking is now done via AST-based validation
 */
export function preCheckSyntax(sourceCode: string): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Check for empty parameters and other patterns
  const lines = sourceCode.split('\n');
  
  lines.forEach((line, lineIndex) => {
    const lineNum = lineIndex + 1;
    
    // Skip comments and empty lines
    if (line.trim().startsWith('//') || line.trim() === '') {
      return;
    }
    
    // Check each pattern
    for (const syntaxPattern of SYNTAX_PATTERNS) {
      const match = line.match(syntaxPattern.pattern);
      if (match && match.index !== undefined) {
        const column = match.index + 1;
        
        errors.push({
          line: lineNum,
          column,
          message: syntaxPattern.message(match, lineNum, column),
          severity: 'error',
          code: syntaxPattern.code,
          suggestion: syntaxPattern.suggestion(match)
        });
        
        // Only report first error per line to avoid noise
        break;
      }
    }
  });
  
  return errors;
}

/**
 * Check if pre-check found critical errors
 */
export function hasCriticalPreCheckErrors(errors: ValidationError[]): boolean {
  return errors.length > 0;
}

