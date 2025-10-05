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
const CONTINUATION_SYMBOL_HINTS = ['(', '[', '{', '+', '-', '*', '/', '%', '?', ':', '<', '>', '&', '|', '^', '.', '='];
const CONTINUATION_MULTI_CHAR_HINTS = ['<=', '>=', '==', '!=', ':=', '->', '=>', '+=', '-=', '*=', '/=', '%=', '&&', '||', '??'];
const CONTINUATION_WORD_HINTS = ['and', 'or', 'xor', 'in', 'not'];

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
  
  // First pass: Check for closing parenthesis at multiples of 4
  // This is a TradingView rule that our parser doesn't enforce
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check if line is only a closing parenthesis or bracket
    if (trimmed === ')' || trimmed === ']') {
      const indent = line.match(/^(\s*)/)?.[0].replace(/\t/g, '    ').length || 0;
      
      // If at a multiple of 4, it's invalid in TradingView
      if (indent % 4 === 0) {
        const suggested = indent > 0 ? indent - 1 : 1;
        errors.push({
          line: i + 1,
          column: indent + 1,
          message: `Closing ${trimmed} at column ${indent} (multiple of 4) will fail in TradingView. Use non-multiple-of-4 indentation for line continuations.`,
          severity: 'error',
          code: 'PSV6-SYNTAX-CLOSING-PAREN',
          suggestion: `Move to column ${suggested} (or any non-multiple-of-4 like ${indent + 1}, ${indent + 2}).`
        });
      }
    }
  }
  
  // Second pass: Check for line wrapping with multiples of 4
  // Pattern: Line ends with operator/= and next line is at wrong indent
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];
    
    if (!line || !nextLine) continue;
    
    const lineIndent = line.match(/^(\s*)/)?.[0].replace(/\t/g, '    ').length || 0;
    const trimmed = line.trim();
    const nextTrimmed = nextLine.trim();
    
    // Skip comments and empty lines
    if (trimmed.startsWith('//') || trimmed === '' || nextTrimmed.startsWith('//') || nextTrimmed === '') {
      continue;
    }
    
    // Check if line ends with operators/punctuation that suggest continuation
    // But exclude function declarations (ending with ) =>, => )
    const isFunctionDeclaration = /\)\s*=>|=>\s*$/.test(trimmed);
    
    // Only check for line continuation if the line ends with an operator/punctuation
    // but NOT if it's part of a comment (ends with // or contains //)
    const hasComment = trimmed.includes('//');
        // Check for any continuation hint (comma, operators, etc.)
        const continuationHint = hasContinuationHint(trimmed);
        
        // Only allow 4+ space continuations for very specific patterns
        const isSwitchCase = /^\s*[^=]*\s*=>/.test(nextTrimmed);
        const isSpecificContinuation = 
          trimmed.endsWith('(') || trimmed.endsWith('[') || trimmed.endsWith('{') ||
          trimmed.endsWith('&&') || trimmed.endsWith('||') || trimmed.endsWith('=>') || trimmed.endsWith('=') ||
          (trimmed.endsWith(',') && isInsideFunctionCall(trimmed));
        
        if (!isFunctionDeclaration && (continuationHint || isSwitchCase) && !hasComment) {
      const nextIndent = nextLine.match(/^(\s*)/)?.[0].replace(/\t/g, '    ').length || 0;
      const relativeIndent = Math.abs(nextIndent - lineIndent);

      const allowMultipleOfFour =
        nextIndent >= 4 &&
        (isSpecificContinuation || isSwitchCase);

      // Rule 1: At global scope (indent 0), continuation at multiple of 4 (including 0) is likely invalid
      if (lineIndent === 0 && nextIndent % 4 === 0 && !allowMultipleOfFour) {
        const suggested = nextIndent === 0 ? 1 : nextIndent - 1;
        errors.push({
          line: i + 2,
          column: nextIndent + 1,
          message: `Line continuation at column ${nextIndent} (multiple of 4) will likely fail in TradingView. Use non-multiple-of-4 indentation.`,
          severity: 'warning',
          code: 'PSV6-INDENT-WRAP-MULTIPLE-OF-4',
          suggestion: `Try ${suggested} spaces or ${nextIndent + 1} spaces (non-multiple-of-4).`
        });
      }
      // Rule 2: Inside a block (indent = multiple of 4), continuation at block boundaries is invalid
      else if (lineIndent % 4 === 0 && lineIndent > 0 && !allowMultipleOfFour) {
        // If continuation is at any multiple of 4 (0, 4, 8, 12...) it's invalid
        if (nextIndent % 4 === 0) {
          const suggested = lineIndent + 1;
          errors.push({
            line: i + 2,
            column: nextIndent + 1,
            message: `Line continuation inside block cannot be at ${nextIndent} spaces (multiple of 4). Must be beyond block level (${lineIndent}) using non-multiple-of-4.`,
            severity: 'warning',
            code: 'PSV6-INDENT-WRAP-BLOCK',
            suggestion: `Try ${suggested} spaces or ${lineIndent + 2} spaces (block + non-multiple-of-4).`
          });
        }
      }
    }
  }
  
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

function hasContinuationHint(line: string): boolean {
  const withoutComment = line.split('//')[0];
  const trimmed = withoutComment.trimEnd();

  if (trimmed.trim() === '') {
    return false;
  }

  const lowerTrimmed = trimmed.toLowerCase();

  for (const hint of CONTINUATION_MULTI_CHAR_HINTS) {
    if (lowerTrimmed.endsWith(hint)) {
      return true;
    }
  }

  const wordMatch = lowerTrimmed.match(/([a-z_][a-z0-9_]*)$/i);
  if (wordMatch) {
    const token = wordMatch[1].toLowerCase();
    if (CONTINUATION_WORD_HINTS.includes(token)) {
      return true;
    }
  }

  const lastChar = trimmed.charAt(trimmed.length - 1);
  if (CONTINUATION_SYMBOL_HINTS.includes(lastChar)) {
    return true;
  }

  return false;
}

function isInsideFunctionCall(line: string): boolean {
  // Simple heuristic: check if there are unmatched opening parentheses before the comma
  let parenCount = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '(') {
      parenCount++;
    } else if (line[i] === ')') {
      parenCount--;
    }
  }
  // If there are unmatched opening parentheses, we're likely in a function call
  return parenCount > 0;
}

/**
 * Check if pre-check found critical errors
 */
export function hasCriticalPreCheckErrors(errors: ValidationError[]): boolean {
  return errors.length > 0;
}

