/**
 * Processes AST diagnostics and converts them to validation errors
 */

import type { AstDiagnostics } from './types';
import type { ValidationError } from '../types';
import { processParserError } from './error-translator';

/**
 * Converts AST diagnostics (parser errors) into validation errors
 */
export function convertAstDiagnosticsToErrors(
  diagnostics: AstDiagnostics,
  sourceCode?: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const syntaxError of diagnostics.syntaxErrors) {
    const line = (syntaxError as any).lineno ?? 1;
    const column = (syntaxError as any).offset ?? 1;
    
    // Translate the error message
    const friendly = processParserError(syntaxError.message, line, column, sourceCode);
    
    errors.push({
      line,
      column,
      message: friendly.message,
      severity: 'error', // Parser errors are always ERRORS
      code: friendly.code,
      suggestion: friendly.suggestion
    });
  }

  return errors;
}

/**
 * Checks if AST has critical syntax errors that should stop validation
 */
export function hasCriticalSyntaxErrors(diagnostics: AstDiagnostics): boolean {
  return diagnostics.syntaxErrors.length > 0;
}

