/**
 * Syntax Error Validator Module
 * 
 * Processes parser/syntax errors and converts them to user-friendly error messages.
 * This module runs FIRST to catch syntax errors before they cause cascading false errors.
 */

import type {
  ValidationModule,
  ValidationContext,
  ValidatorConfig,
  ValidationError,
  ValidationResult,
  AstValidationContext,
} from '../core/types';
import { convertAstDiagnosticsToErrors, hasCriticalSyntaxErrors } from '../core/ast/syntax-error-processor';
import { preCheckSyntax } from '../core/ast/syntax-pre-checker';

export class SyntaxErrorValidator implements ValidationModule {
  name = 'SyntaxErrorValidator';
  priority = 999; // HIGHEST priority - run before everything else

  private errors: ValidationError[] = [];
  private sourceCode: string = '';

  validate(context: ValidationContext, _config: ValidatorConfig): ValidationResult {
    this.errors = [];
    
    // Get source code
    this.sourceCode = this.getSourceCode(context);
    
    // STEP 1: Run pre-parser syntax checks for common patterns
    // These provide accurate line/column info before the parser crashes
    const preCheckErrors = preCheckSyntax(this.sourceCode);
    if (preCheckErrors.length > 0) {
      this.errors.push(...preCheckErrors);
      return this.buildResult();
    }
    
    // STEP 2: Check if this is an AST context with diagnostics
    const astContext = this.isAstContext(context) ? context : null;
    if (!astContext || !astContext.astDiagnostics) {
      return this.buildResult();
    }

    // STEP 3: Convert parser errors to user-friendly validation errors
    const syntaxErrors = convertAstDiagnosticsToErrors(
      astContext.astDiagnostics,
      this.sourceCode
    );

    this.errors.push(...syntaxErrors);

    return this.buildResult();
  }

  /**
   * Check if there are critical syntax errors that should stop further validation
   */
  hasCriticalErrors(context: ValidationContext): boolean {
    const astContext = this.isAstContext(context) ? context : null;
    if (!astContext || !astContext.astDiagnostics) {
      return false;
    }
    return hasCriticalSyntaxErrors(astContext.astDiagnostics);
  }

  private isAstContext(context: ValidationContext): context is AstValidationContext {
    return 'ast' in context && 'astDiagnostics' in context;
  }

  private getSourceCode(context: ValidationContext): string {
    if (context.lines && context.lines.length > 0) {
      return context.lines.join('\n');
    }
    if (context.cleanLines && context.cleanLines.length > 0) {
      return context.cleanLines.join('\n');
    }
    if (context.rawLines && context.rawLines.length > 0) {
      return context.rawLines.join('\n');
    }
    return '';
  }

  private buildResult(): ValidationResult {
    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: [],
      info: [],
      typeMap: new Map(),
      scriptType: null,
    };
  }
}

