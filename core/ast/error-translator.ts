/**
 * Translates parser errors into user-friendly, actionable error messages
 */

export interface UserFriendlyError {
  message: string;
  suggestion?: string;
  code: string;
}

/**
 * Translates Chevrotain parser error messages into user-friendly Pine Script errors
 */
export function translateParserError(
  errorMessage: string,
  line: number,
  column: number,
  sourceCode?: string
): UserFriendlyError {

  const missingEqualsMatch = errorMessage.match(/Missing '=' after variable '([^']+)'/);
  if (missingEqualsMatch) {
    const variableName = missingEqualsMatch[1];
    return {
      message: `Missing '=' operator after variable '${variableName}'`,
      suggestion: `Assign a value using '${variableName} = ...'.`,
      code: 'PSV6-SYNTAX-MISSING-EQUALS',
    };
  }

  if (/Missing ',' between arguments/i.test(errorMessage)) {
    return {
      message: 'Missing comma between function arguments',
      suggestion: 'Separate function arguments with commas.',
      code: 'PSV6-SYNTAX-MISSING-COMMA',
    };
  }

  if (/Missing ',' between elements/i.test(errorMessage)) {
    return {
      message: 'Missing comma between elements',
      suggestion: 'Separate elements with a comma.',
      code: 'PSV6-SYNTAX-MISSING-COMMA',
    };
  }

  if (/Incorrect conditional operator order/i.test(errorMessage)) {
    return {
      message: "Incorrect conditional operator order. Use 'condition ? value_if_true : value_if_false'.",
      suggestion: "Swap the '?' and ':' operators so the question mark comes before the colon.",
      code: 'PSV6-SYNTAX-CONDITIONAL-ORDER',
    };
  }

  const missingFunctionParensMatch = errorMessage.match(/Missing parentheses in function declaration '([^']+)'/i);
  if (missingFunctionParensMatch) {
    const functionName = missingFunctionParensMatch[1];
    return {
      message: `Missing parentheses in function declaration '${functionName}'`,
      suggestion: `Add parentheses after '${functionName}', even if there are no parameters (for example '${functionName}()').`,
      code: 'PSV6-SYNTAX-MISSING-PARENS',
    };
  }

  if (/Missing argument between commas/i.test(errorMessage)) {
    return {
      message: 'Missing argument between commas',
      suggestion: 'Provide an argument between these commas.',
      code: 'PSV6-SYNTAX-EMPTY-PARAM',
    };
  }

  if (/Trailing comma without argument/i.test(errorMessage)) {
    return {
      message: 'Trailing comma without argument',
      suggestion: 'Remove the trailing comma or provide an argument after it.',
      code: 'PSV6-SYNTAX-TRAILING-COMMA',
    };
  }

  const missingBinaryOperandMatch = errorMessage.match(/Missing expression after binary operator '([^']+)'/);
  if (missingBinaryOperandMatch) {
    const operatorSymbol = missingBinaryOperandMatch[1];
    return {
      message: `Missing expression after operator '${operatorSymbol}'`,
      suggestion: `Provide an expression after '${operatorSymbol}'.`,
      code: 'PSV6-SYNTAX-MISSING-BINARY-OPERAND',
    };
  }

  if (/Missing closing bracket/i.test(errorMessage)) {
    return {
      message: 'Missing closing bracket',
      suggestion: 'Add "]" to close the collection.',
      code: 'PSV6-SYNTAX-MISSING-BRACKET',
    };
  }

  if (/Missing closing parenthesis/i.test(errorMessage)) {
    return {
      message: 'Missing closing parenthesis',
      suggestion: 'Add \')\' to complete the expression.',
      code: 'PSV6-SYNTAX-MISSING-CLOSING-PAREN',
    };
  }

  // Pattern: Mismatched input "," expecting ")"
  // Common when: Missing function parameter before comma
  if (/Mismatched input\s+"," expecting\s+"\\?"?\)"?/.test(errorMessage)) {
    return {
      message: `Missing function parameter before comma`,
      suggestion: `Expected a value or expression before the comma. Check if you forgot to provide a required parameter.`,
      code: 'PSV6-SYNTAX-MISSING-PARAM'
    };
  }

  // Pattern: Mismatched input ")" expecting ...
  // Common when: Extra closing parenthesis
  if (/Mismatched input\s+"\\?"?\)"?\s+expecting/.test(errorMessage)) {
    return {
      message: `Unexpected closing parenthesis`,
      suggestion: `There may be a missing opening parenthesis or an extra closing parenthesis.`,
      code: 'PSV6-SYNTAX-UNMATCHED-PAREN'
    };
  }

  // Pattern: Expecting ")" but found something else
  if (/expecting\s+"\\?"?\)"?/.test(errorMessage) && !errorMessage.includes('Mismatched')) {
    return {
      message: `Missing closing parenthesis`,
      suggestion: `Check if you forgot to close a function call or expression with ')'.`,
      code: 'PSV6-SYNTAX-MISSING-CLOSING-PAREN'
    };
  }

  // Pattern: Expecting "," but found something else
  if (/expecting\s+","/i.test(errorMessage)) {
    return {
      message: `Missing comma between parameters`,
      suggestion: `Function parameters should be separated by commas.`,
      code: 'PSV6-SYNTAX-MISSING-COMMA'
    };
  }

  // Pattern: end of line without line continuation
  if (/end of line without line continuation/i.test(errorMessage)) {
    return {
      message: `Unexpected end of line`,
      suggestion: `The statement appears to be incomplete. Check for missing operators or values.`,
      code: 'PSV6-SYNTAX-INCOMPLETE-STATEMENT'
    };
  }

  // Pattern: Unexpected token
  if (/unexpected token/i.test(errorMessage)) {
    const tokenMatch = errorMessage.match(/token\s+['"]([^'"]+)['"]/i);
    const token = tokenMatch ? tokenMatch[1] : 'token';
    return {
      message: `Unexpected ${token}`,
      suggestion: `Check the syntax around this token. It may be in the wrong position or context.`,
      code: 'PSV6-SYNTAX-UNEXPECTED-TOKEN'
    };
  }

  // Pattern: Cannot read properties (JavaScript error that leaked through)
  if (/Cannot read properties/i.test(errorMessage)) {
    return {
      message: `Syntax error: Unexpected structure in code`,
      suggestion: `There is a syntax error that the parser couldn't recover from. Check for missing or extra punctuation near this location.`,
      code: 'PSV6-SYNTAX-PARSE-FAILED'
    };
  }

  // Pattern: MismatchedTokenException
  if (/MismatchedTokenException/i.test(errorMessage)) {
    return {
      message: `Syntax error: Unexpected character or keyword`,
      suggestion: `Check the syntax at this location. There may be a typo or incorrect keyword usage.`,
      code: 'PSV6-SYNTAX-MISMATCHED-TOKEN'
    };
  }

  // Generic fallback
  return {
    message: `Syntax error: ${errorMessage}`,
    suggestion: `Check the Pine Script syntax at this location.`,
    code: 'PSV6-SYNTAX-ERROR'
  };
}

/**
 * Provides context-specific suggestions based on error location
 */
export function enhanceErrorWithContext(
  error: UserFriendlyError,
  line: number,
  column: number,
  sourceCode?: string
): UserFriendlyError {
  if (!sourceCode) {
    return error;
  }

  const lines = sourceCode.split('\n');
  const errorLine = lines[line - 1];
  
  if (!errorLine) {
    return error;
  }

  // Check for specific patterns in the error line
  
  // Pattern: input.int(, ...) or similar - missing first parameter
  if (error.code === 'PSV6-SYNTAX-MISSING-PARAM' && /input\.\w+\(\s*,/.test(errorLine)) {
    const match = errorLine.match(/input\.(\w+)\s*\(\s*,/);
    if (match) {
      const inputType = match[1];
      return {
        ...error,
        message: `Missing required 'defval' parameter in input.${inputType}()`,
        suggestion: `input.${inputType}() requires a default value as the first parameter. Example: input.${inputType}(10, "Label", ...)`
      };
    }
  }

  // Pattern: function calls with empty parameters
  if (error.code === 'PSV6-SYNTAX-MISSING-PARAM' && /\w+\s*\(\s*,/.test(errorLine)) {
    return {
      ...error,
      suggestion: `Function calls cannot have empty parameters. Provide a value or remove the extra comma.`
    };
  }

  return error;
}

/**
 * Main function to translate and enhance parser errors
 */
export function processParserError(
  rawError: string,
  line: number,
  column: number,
  sourceCode?: string
): UserFriendlyError {
  const translated = translateParserError(rawError, line, column, sourceCode);
  return enhanceErrorWithContext(translated, line, column, sourceCode);
}
