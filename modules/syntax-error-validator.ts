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
  ValidationResult,
  AstValidationContext,
  ValidationError,
} from '../core/types';
import { ValidationHelper } from '../core/validation-helper';
import { convertAstDiagnosticsToErrors, hasCriticalSyntaxErrors } from '../core/ast/syntax-error-processor';
import { preCheckSyntax } from '../core/ast/syntax-pre-checker';
import { createAstDiagnostics } from '../core/ast/types';

export class SyntaxErrorValidator implements ValidationModule {
  name = 'SyntaxErrorValidator';
  priority = 999; // HIGHEST priority - run before everything else

  private helper = new ValidationHelper();
  private sourceCode: string = '';

  getDependencies(): string[] {
    return [];
  }

  validate(context: ValidationContext, _config: ValidatorConfig): ValidationResult {
    this.helper.reset();
    
    // Get source code
    this.sourceCode = this.getSourceCode(context);
    
    // STEP 1: Run textual pre-checks for high-accuracy syntax hints
    const astContext = this.isAstContext(context) ? context : null;
    const targetVersion = _config.targetVersion ?? 6;
    const preCheckErrors = preCheckSyntax(this.sourceCode, targetVersion);
    if (astContext) {
      this.attachPreCheckDiagnostics(astContext, preCheckErrors);
    }
    if (preCheckErrors.length > 0) {
      this.helper.addErrors(preCheckErrors);
      return this.helper.buildResult(context);
    }

    // STEP 2: Check if this is an AST context with diagnostics
    if (!astContext || !astContext.astDiagnostics) {
      return this.helper.buildResult(context);
    }

    // STEP 3: Convert parser errors to user-friendly validation errors
    const syntaxErrors = convertAstDiagnosticsToErrors(
      astContext.astDiagnostics,
      this.sourceCode
    );

    this.helper.addErrors(syntaxErrors);

    return this.helper.buildResult(context);
  }

  /**
   * Check if there are critical syntax errors that should stop further validation
   */
  hasCriticalErrors(context: ValidationContext): boolean {
    const astContext = this.isAstContext(context) ? context : null;
    if (!astContext || !astContext.astDiagnostics) {
      return false;
    }
    const diagnostics = astContext.astDiagnostics as { preCheckErrors?: ValidationError[] };
    if (diagnostics.preCheckErrors && diagnostics.preCheckErrors.length > 0) {
      return true;
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

  private attachPreCheckDiagnostics(
    astContext: AstValidationContext,
    preCheckErrors: ValidationError[],
  ): void {
    if (!astContext.astDiagnostics) {
      astContext.astDiagnostics = createAstDiagnostics();
    }
    const diagnostics = astContext.astDiagnostics as { preCheckErrors?: ValidationError[] };
    diagnostics.preCheckErrors = preCheckErrors;
  }
}

