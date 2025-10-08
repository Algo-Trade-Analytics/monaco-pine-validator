/**
 * Pre-Parser Syntax Checker
 * 
 * Catches common syntax errors before the parser runs, providing
 * accurate line/column information and clear error messages.
 */

import type { ValidationError } from '../types';
import { checkIndentation } from './indentation-checker';
import { KEYWORDS } from '../constants';

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
export function preCheckSyntax(sourceCode: string, targetVersion: number = 6): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Check for empty parameters and other patterns
  const lines = sourceCode.split('\n');
  
  // Check for version directive compatibility (fallback when AST parsing fails)
  const versionMatch = sourceCode.match(/^\/\/@version=(\d+)/m);
  if (versionMatch) {
    const scriptVersion = parseInt(versionMatch[1], 10);
    if (scriptVersion !== targetVersion) {
      const severity = scriptVersion < targetVersion ? 'error' : 'warning';
      errors.push({
        line: 1,
        column: 1,
        message: `Script declares //@version=${scriptVersion} but targetVersion is ${targetVersion}.`,
        severity,
        code: 'PS001'
      });
    }
  }
  
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
  
  // Second pass: Check for common syntax errors
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('//')) {
      continue;
    }
    
    // Check for missing = in variable assignments
    checkMissingAssignmentOperator(line, lineNum, errors);
    
    // Check for incorrect conditional operator order
    checkConditionalOperatorOrder(line, lineNum, errors);
    
    // Check for missing parentheses in function declarations
    checkFunctionDeclarationParentheses(line, lineNum, errors);
    
    // Check for missing commas in function calls
    checkMissingCommas(line, lineNum, errors);
    
    // Check for binary operators without left/right values
    checkBinaryOperators(line, lineNum, errors);
  }
  
  // Third pass: Check for line wrapping with multiples of 4
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
    
    // Skip block statements and if expressions - these are NOT line continuations
    // Block statements: if, else if, else, for, while, switch cases
    // If expressions: standalone else, else if (these are part of if expressions)
    const isBlockStatement = /^\s*(if|else\s+if|else|for|while|switch|case|default)\s/.test(nextTrimmed);
    const isIfExpressionPart = /^\s*(else\s+if|else)(\s|$)/.test(nextTrimmed);
    if (isBlockStatement || isIfExpressionPart) {
      continue;
    }
    
    // Skip if expressions - lines ending with "if" followed by an if expression
    // Pattern: "variable = if" followed by "    expression" or "else if" or "else"
    const isIfExpressionStart = trimmed.endsWith('if') && 
                               (nextTrimmed.startsWith('    ') || 
                                nextTrimmed.startsWith('else') ||
                                /^\s*(if|else\s+if|else)\s/.test(nextTrimmed));
    if (isIfExpressionStart) {
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

/**
 * Check for missing = operators in variable assignments
 */
function checkMissingAssignmentOperator(line: string, lineNum: number, errors: ValidationError[]): void {
  // Pattern: identifier followed by whitespace then identifier (without =)
  // Example: "slowEMA ta.ema(close, 35)" should be "slowEMA = ta.ema(close, 35)"
  const missingEqualsPattern = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_.]*\s*\()/;
  const match = line.match(missingEqualsPattern);
  
  if (match) {
    const [, indent, varName, funcCall] = match;
    
    // Skip if the variable name is a Pine Script keyword
    const normalizedVar = varName.toLowerCase();
    if (KEYWORDS.has(normalizedVar)) {
      return;
    }
    
    // Make sure this isn't already a valid assignment with =
    if (!line.includes('=')) {
      const column = indent.length + varName.length + 2; // Position after varName + space
      errors.push({
        line: lineNum,
        column,
        message: `Missing '=' operator. Use '${varName} = ${funcCall.trim()}' for variable assignment.`,
        severity: 'error',
        code: 'PSV6-SYNTAX-MISSING-EQUALS'
      });
    }
  }
}

/**
 * Check for incorrect conditional operator order (?: vs :?)
 */
function checkConditionalOperatorOrder(line: string, lineNum: number, errors: ValidationError[]): void {
  // Remove comments first
  const withoutComments = line.split('//')[0].split('/*')[0];
  const trimmed = withoutComments.trim();
  
  // Skip if the line is empty after removing comments
  if (!trimmed) {
    return;
  }
  
  // Pattern: value : value ? value (incorrect order)
  // Should be: value ? value : value
  // But we need to be careful not to flag nested ternaries like: a ? b : c ? d : e
  const incorrectOrderPattern = /([^?:]*)\s*:\s*([^?:]*)\s*\?\s*([^?:]*)/;
  const match = trimmed.match(incorrectOrderPattern);
  
  if (match) {
    // Additional check: make sure this isn't a valid nested ternary
    // Valid nested: "a ? b : c ? d : e" (the : before c is valid)
    // Invalid: "a : b ? c" (the : before b is invalid)
    const beforeColon = match[1].trim();
    const afterColon = match[2].trim();
    const afterQuestion = match[3].trim();
    
    // If there's a ? before the colon, it's likely a nested ternary
    if (beforeColon.includes('?')) {
      return;
    }
    
    // Additional check: if this looks like a valid nested ternary
    // Valid: "1 : shortCond ? -1" (value : condition ? value)
    // Invalid: "close > open : color.green ? color.red" (condition : value ? value)
    if (afterQuestion.trim() && afterColon.trim()) {
      // Only allow this pattern if the part before the colon doesn't contain operators
      // that suggest it's a condition (like >, <, ==, etc.)
      const conditionOperators = ['>', '<', '>=', '<=', '==', '!=', '&&', '||'];
      const hasConditionOperators = conditionOperators.some(op => beforeColon.includes(op));
      
      if (!hasConditionOperators) {
        return; // This looks like a valid nested ternary
      }
    }
    
    // If there's no ? before the colon and it doesn't look like a nested ternary, it's likely an invalid order
    const colonIndex = trimmed.indexOf(':');
    errors.push({
      line: lineNum,
      column: colonIndex + 1,
      message: "Incorrect conditional operator order. Use 'condition ? value_if_true : value_if_false'.",
      severity: 'error',
      code: 'PSV6-SYNTAX-CONDITIONAL-ORDER'
    });
  }
}

/**
 * Check for missing parentheses in function declarations
 */
function checkFunctionDeclarationParentheses(line: string, lineNum: number, errors: ValidationError[]): void {
  // Pattern: identifier => expression (missing parentheses)
  // Should be: identifier() => expression
  const missingParensPattern = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=>/;
  const match = line.match(missingParensPattern);
  
  if (match) {
    const [, indent, funcName] = match;
    const column = indent.length + funcName.length + 1;
    errors.push({
      line: lineNum,
      column,
      message: `Missing parentheses in function declaration. Use '${funcName}() =>' instead of '${funcName} =>'.`,
      severity: 'error',
      code: 'PSV6-SYNTAX-MISSING-PARENS'
    });
  }
}

/**
 * Check for missing commas in function argument lists
 */
function checkMissingCommas(line: string, lineNum: number, errors: ValidationError[]): void {
  // Remove inline comments before processing
  const withoutComments = line.split('//')[0].split('/*')[0];
  const trimmed = withoutComments.trim();
  
  // Skip switch statements and function declarations
  if (withoutComments.includes('switch') || withoutComments.includes('=>')) {
    return;
  }
  
  // Skip variable declarations (var, varip, const, type, method)
  if (trimmed.startsWith('var ') || trimmed.startsWith('varip ') || 
      trimmed.startsWith('const ') || trimmed.startsWith('type ') || 
      trimmed.startsWith('method ')) {
    return;
  }
  
  // Skip type declarations (chart.point, array<type>, matrix<type>, map<type>, etc.)
  // Pattern: typeName variableName = ...
  const typeDeclarationPattern = /^(\s*)([A-Za-z_][A-Za-z0-9_.]*<[^>]*>|[A-Za-z_][A-Za-z0-9_.]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/;
  if (typeDeclarationPattern.test(trimmed)) {
    return;
  }
  
  // Skip lines that are comments (start with // or /*)
  if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
    return;
  }
  
  // Skip lines with logical operators (and, or, not) - these are valid syntax
  const logicalOperators = ['and', 'or', 'not'];
  const hasLogicalOperators = logicalOperators.some(op => 
    trimmed.includes(` ${op} `) || 
    trimmed.includes(` ${op})`) || 
    trimmed.includes(` ${op},`) ||
    trimmed.includes(` ${op}`) ||
    trimmed.endsWith(` ${op}`)
  );
  if (hasLogicalOperators) {
    return;
  }
  
  // Pattern: function(arg1 arg2) - missing comma between arguments
  // But be more specific to avoid false positives
  const missingCommaPattern = /(\w+)\s+([A-Za-z_][A-Za-z0-9_]*\s*[=)])/;
  const match = withoutComments.match(missingCommaPattern);
  
  if (match) {
    const [, arg1, arg2] = match;
    
    // Additional checks to avoid false positives
    // Skip if it looks like a variable assignment (arg1 = value)
    if (arg2.includes('=') && !withoutComments.includes('(')) {
      return;
    }
    
    // Skip if it's inside a switch case (looks like "case => value")
    if (trimmed.startsWith('"') && withoutComments.includes('=>')) {
      return;
    }
    
    // Skip if arg1 is a logical operator
    if (logicalOperators.includes(arg1.toLowerCase())) {
      return;
    }
    
    const commaIndex = withoutComments.indexOf(arg2);
    errors.push({
      line: lineNum,
      column: commaIndex,
      message: `Missing comma between function arguments. Use '${arg1}, ${arg2.trim()}' instead.`,
      severity: 'error',
      code: 'PSV6-SYNTAX-MISSING-COMMA'
    });
  }
}

/**
 * Check for binary operators without proper left/right values
 */
function checkBinaryOperators(line: string, lineNum: number, errors: ValidationError[]): void {
  // Remove comments from the line before processing
  const withoutComments = line.split('//')[0].split('/*')[0];
  const trimmed = withoutComments.trim();
  
  // Skip if the line is empty after removing comments
  if (!trimmed) {
    return;
  }
  
  // Skip switch statements and function declarations that use =>
  if (line.includes('=>') && (line.includes('switch') || line.trim().includes('=>'))) {
    return;
  }
  
  // Skip function calls - they can have complex parameter expressions
  if (line.includes('(') && line.includes(')')) {
    return;
  }
  
  // Skip variable declarations - they can have unary operators like -1
  if (trimmed.includes('=') && !trimmed.includes('(')) {
    return;
  }
  
  // Skip lines with string literals - they can contain operators like </div>
  if (trimmed.includes('"') || trimmed.includes("'")) {
    return;
  }
  
  // Pattern: operator operator (two operators in a row) but exclude valid combinations
  // Examples: "10 * / close", "value + - 5"
  // Exclude: "=>" (switch/function), "==", "!=", "<=", ">=", "&&", "||", etc.
  const doubleOperatorPattern = /([+\-*/%=<>!&|^])\s*([+\-*/%=<>!&|^])/;
  const match = withoutComments.match(doubleOperatorPattern);
  
  if (match) {
    const [, op1, op2] = match;
    const combined = op1 + op2;
    
    // Skip valid operator combinations
    const validCombinations = ['==', '!=', '<=', '>=', '&&', '||', '=>', '+=', '-=', '*=', '/=', '%='];
    if (validCombinations.includes(combined)) {
      return;
    }
    
    // Skip unary operators (when they appear after certain operators)
    // Examples: "x * -2", "y + -5", "z / -3" are valid unary minus
    const unaryAfterOperators = ['*', '/', '+', '-', '=', '(', ',', ' ', '\t', '>', '<', '!', '&', '|', '^'];
    if (op2 === '-' && unaryAfterOperators.includes(op1)) {
      return;
    }
    
    // Skip unary plus (less common but valid)
    if (op2 === '+' && unaryAfterOperators.includes(op1)) {
      return;
    }
    
    // Improved column calculation
    const matchOffset = match.index ?? withoutComments.indexOf(match[0]);
    const op2Offset = matchOffset + match[0].length - 1;
    const operatorIndex = line.indexOf(op2, op2Offset);
    const column = operatorIndex >= 0 ? operatorIndex + 1 : op2Offset + 1;
    
    errors.push({
      line: lineNum,
      column,
      message: `Binary operator '${op2}' is missing a left operand. Check for missing values or incorrect operator usage.`,
      severity: 'error',
      code: 'PSV6-SYNTAX-MISSING-OPERAND'
    });
  }
}

