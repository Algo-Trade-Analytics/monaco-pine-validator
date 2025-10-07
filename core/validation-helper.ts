/**
 * Shared validation helper for consistent error handling across all modules
 * Eliminates code duplication in 46+ validator modules
 */

import type { ValidationError, ValidationResult, ValidationContext, Code } from './types';
import type { Codes } from './codes';
import { ErrorEnhancerV2 } from './error-enhancement-v2';

/**
 * Centralized validation helper for managing errors, warnings, and info messages
 * with automatic deduplication and consistent result building.
 */
export class ValidationHelper {
  private errorKeys = new Set<string>();
  private warningKeys = new Set<string>();
  private infoKeys = new Set<string>();
  
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  
  private sourceCode: string = '';
  private enhanceErrors: boolean = false;

  /**
   * Add an error message with automatic deduplication
   */
  addError(
    line: number,
    column: number,
    message: string,
    code?: Code | string,
    suggestion?: string
  ): void {
    const key = `${line}:${column}:${code ?? 'error'}:${message}`;
    if (this.errorKeys.has(key)) {
      return;
    }
    this.errorKeys.add(key);
    this.errors.push({ line, column, message, severity: 'error', code, suggestion });
  }

  /**
   * Add a warning message with automatic deduplication
   */
  addWarning(
    line: number,
    column: number,
    message: string,
    code?: Code | string,
    suggestion?: string
  ): void {
    const key = `${line}:${column}:${code ?? 'warning'}:${message}`;
    if (this.warningKeys.has(key)) {
      return;
    }
    this.warningKeys.add(key);
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  /**
   * Add an info message with automatic deduplication
   */
  addInfo(
    line: number,
    column: number,
    message: string,
    code?: Code | string,
    suggestion?: string
  ): void {
    const key = `${line}:${column}:${code ?? 'info'}:${message}`;
    if (this.infoKeys.has(key)) {
      return;
    }
    this.infoKeys.add(key);
    this.info.push({ line, column, message, severity: 'info', code, suggestion });
  }

  /**
   * Add a message with dynamic severity
   */
  addBySeverity(
    severity: 'error' | 'warning' | 'info',
    line: number,
    column: number,
    message: string,
    code?: Code | string,
    suggestion?: string
  ): void {
    if (severity === 'error') {
      this.addError(line, column, message, code, suggestion);
    } else if (severity === 'warning') {
      this.addWarning(line, column, message, code, suggestion);
    } else {
      this.addInfo(line, column, message, code, suggestion);
    }
  }

  /**
   * Add an error with dynamic severity determination based on code
   * This is useful when you want the helper to decide severity automatically
   */
  addByCode(
    line: number,
    column: number,
    message: string,
    code: Code | string,
    suggestion?: string,
    shouldBeError?: (code: string) => boolean
  ): void {
    if (shouldBeError && shouldBeError(code as string)) {
      this.addError(line, column, message, code, suggestion);
    } else {
      this.addWarning(line, column, message, code, suggestion);
    }
  }

  /**
   * Add errors from a list
   */
  addErrors(errors: ValidationError[]): void {
    for (const error of errors) {
      switch (error.severity) {
        case 'error':
          this.addError(error.line, error.column, error.message, error.code, error.suggestion);
          break;
        case 'warning':
          this.addWarning(error.line, error.column, error.message, error.code, error.suggestion);
          break;
        case 'info':
          this.addInfo(error.line, error.column, error.message, error.code, error.suggestion);
          break;
      }
    }
  }

  /**
   * Build the final validation result
   */
  buildResult(context: ValidationContext): ValidationResult {
    // Enhance errors if enabled and source code is available
    let finalErrors = this.errors;
    let finalWarnings = this.warnings;
    let finalInfo = this.info;
    
    if (this.enhanceErrors && this.sourceCode) {
      finalErrors = this.errors.map(e => ErrorEnhancerV2.enhance(e, this.sourceCode));
      finalWarnings = this.warnings.map(w => ErrorEnhancerV2.enhance(w, this.sourceCode));
      finalInfo = this.info.map(i => ErrorEnhancerV2.enhance(i, this.sourceCode));
    }
    
    return {
      isValid: this.errors.length === 0,
      errors: finalErrors,
      warnings: finalWarnings,
      info: finalInfo,
      typeMap: context.typeMap,
      scriptType: context.scriptType,
    };
  }

  /**
   * Reset all state for a new validation run
   */
  reset(): void {
    this.errorKeys.clear();
    this.warningKeys.clear();
    this.infoKeys.clear();
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.sourceCode = '';
    this.enhanceErrors = false;
  }
  
  /**
   * Set source code for error enhancement
   */
  setSourceCode(sourceCode: string): void {
    this.sourceCode = sourceCode;
  }
  
  /**
   * Enable or disable error enhancement
   */
  setEnhanceErrors(enhance: boolean): void {
    this.enhanceErrors = enhance;
  }

  // Getters for accessing arrays (for debug purposes)
  get errorList(): ValidationError[] {
    return this.errors;
  }

  get warningList(): ValidationError[] {
    return this.warnings;
  }

  get infoList(): ValidationError[] {
    return this.info;
  }

  /**
   * Get current error count
   */
  getErrorCount(): number {
    return this.errors.length;
  }

  /**
   * Get current warning count
   */
  getWarningCount(): number {
    return this.warnings.length;
  }

  /**
   * Get current info count
   */
  getInfoCount(): number {
    return this.info.length;
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Get all errors
   */
  getErrors(): ValidationError[] {
    return [...this.errors];
  }

  /**
   * Get all warnings
   */
  getWarnings(): ValidationError[] {
    return [...this.warnings];
  }

  /**
   * Get all info messages
   */
  getInfo(): ValidationError[] {
    return [...this.info];
  }
}

/**
 * Error severity classifier for determining if an error code represents
 * a critical error that should stop validation or a warning.
 */
export class ErrorSeverityClassifier {
  /**
   * Determine if a code represents a critical error
   */
  static isCriticalError(code: Code | string): boolean {
    const codeStr = code as string;
    
    // Syntax errors are critical
    if (codeStr.startsWith('PSV6-SYNTAX-')) return true;
    
    // Parameter errors are critical
    if (codeStr.includes('-PARAM')) return true;
    
    // Type errors are critical
    if (codeStr.includes('-TYPE-MISMATCH')) return true;
    
    // Unknown function/method errors are critical
    if (codeStr.includes('-UNKNOWN')) return true;
    
    // Invalid operations are critical
    if (codeStr.includes('-INVALID')) return true;
    
    // Performance issues are warnings, not errors
    if (codeStr.includes('-PERF-')) return false;
    
    // Suggestions are warnings
    if (codeStr.includes('-SUGGESTION')) return false;
    
    // Usage info is not critical
    if (codeStr.includes('-USAGE')) return false;
    if (codeStr.includes('-INFO')) return false;
    
    // Default to error for safety
    return true;
  }

  /**
   * Determine if an error should cascade and stop further validation
   */
  static shouldCascadeError(code: Code | string): boolean {
    const codeStr = code as string;
    
    // Only syntax errors should cascade
    if (codeStr.startsWith('PSV6-SYNTAX-')) return true;
    if (codeStr === 'PSV6-INDENT-') return false; // Indentation issues shouldn't cascade
    
    return false;
  }

  /**
   * Get suggested severity for a code
   */
  static getSuggestedSeverity(code: Code | string): 'error' | 'warning' | 'info' {
    const codeStr = code as string;
    
    // Info codes
    if (codeStr.includes('-INFO')) return 'info';
    if (codeStr.includes('-USAGE')) return 'info';
    
    // Warning codes
    if (codeStr.includes('-PERF-')) return 'warning';
    if (codeStr.includes('-SUGGESTION')) return 'warning';
    if (codeStr.includes('STYLE-')) return 'warning';
    
    // Error codes (default)
    if (this.isCriticalError(codeStr)) return 'error';
    
    return 'warning';
  }
}
