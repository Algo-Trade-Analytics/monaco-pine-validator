/**
 * Modular Ultimate Validator for Pine Script v6 - LIGHTWEIGHT VERSION
 * 
 * This is a minimal modular implementation with only core validation modules.
 * Used primarily for testing and scenarios where full validation is not needed.
 * 
 * For production use, prefer EnhancedModularValidator which includes all 47+ modules.
 * The original UltimateValidator remains as a reference implementation in archive/.
 */

import { BaseValidator } from './core/base-validator';
import { ValidationResult, ValidatorConfig } from './core/types';
import { CoreValidator } from './modules/core-validator';
import { TypeValidator } from './modules/type-validator';
import { ScopeValidator } from './modules/scope-validator';
import { SyntaxValidator } from './modules/syntax-validator';
import { V6FeaturesValidator } from './modules/v6-features-validator';
import { PerformanceValidator } from './modules/performance-validator';
import { StyleValidator } from './modules/style-validator';

export class ModularUltimateValidator extends BaseValidator {
  constructor(config: Partial<ValidatorConfig> = {}) {
    super(config);
    
    // Register validation modules (in order of priority)
    this.registerModule(new CoreValidator());           // Core validation (priority 100)
    this.registerModule(new TypeValidator());           // Type system (priority 85)
    this.registerModule(new ScopeValidator());          // Scope management (priority 80)
    this.registerModule(new SyntaxValidator());         // Basic syntax (priority 90)
    this.registerModule(new V6FeaturesValidator());     // V6 features (priority 80)
    this.registerModule(new PerformanceValidator());    // Performance (priority 70)
    this.registerModule(new StyleValidator());          // Style & quality (priority 60)
  }

  /**
   * Run core validation logic
   * This handles the basic validation that all Pine Script validators need
   */
  protected runCoreValidation(): void {
    // Basic script structure validation
    this.validateScriptStructure();
    
    // Basic syntax validation
    this.validateBasicSyntax();
    
    // Basic type validation
    this.validateBasicTypes();
  }

  /**
   * Validate basic script structure
   */
  private validateScriptStructure(): void {
    // Check for empty script
    if (this.context.cleanLines.length === 0) {
      this.addError(1, 1, 'Script is empty.', 'PS-EMPTY');
      return;
    }

    // Check for version directive
    if (!this.context.hasVersion) {
      this.addError(1, 1, 'Missing version directive. Add //@version=6 at the top.', 'PS012');
    }

    // Check for script declaration
    if (!this.context.scriptType) {
      const line = this.context.hasVersion ? 2 : 1;
      this.addError(line, 1, 'Missing script declaration. Add indicator(), strategy(), or library().', 'PS013');
    }
  }

  /**
   * Validate basic syntax elements
   */
  private validateBasicSyntax(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;
      
      // Check for basic syntax issues
      this.checkBasicSyntaxIssues(line, lineNum);
    }
  }

  /**
   * Check for basic syntax issues
   */
  private checkBasicSyntaxIssues(line: string, lineNum: number): void {
    const noStrings = this.stripStringsAndLineComment(line);

    // Check for invalid operators
    const invalidOps = ['===', '!==', '++', '--', '^', '~'];
    for (const op of invalidOps) {
      if (noStrings.includes(op)) {
        this.addWarning(lineNum, 1, `Operator '${op}' is not valid in Pine Script.`, 'PSO01');
      }
    }

    // Check for logical operators
    if (noStrings.includes('&&')) {
      this.addWarning(lineNum, 1, "Operator '&&' is not valid in Pine Script. Use 'and' instead.", 'PSO01');
    }
    if (noStrings.includes('||')) {
      this.addWarning(lineNum, 1, "Operator '||' is not valid in Pine Script. Use 'or' instead.", 'PSO01');
    }

    // Check for negative history references
    const negHist = noStrings.match(/\[\s*-\d+\s*\]/);
    if (negHist) {
      this.addError(lineNum, (negHist.index ?? 0) + 1, 'Invalid history reference: negative indexes are not allowed.', 'PS024');
    }

    // Check for NA comparisons
    if (/(\bna\s*[!=]=)|([!=]=\s*na\b)/.test(noStrings)) {
      this.addWarning(lineNum, 1, "Direct comparison with 'na' is unreliable. Use na(x), e.g., na(myValue).", 'PS023', 'Replace `x == na` with `na(x)` and `x != na` with `not na(x)`.');
    }
  }

  /**
   * Validate basic types
   */
  private validateBasicTypes(): void {
    // This is a placeholder for basic type validation
    // More sophisticated type checking is handled by the modules
  }

  /**
   * Strip strings and line comments from a line
   */
  private stripStringsAndLineComment(line: string): string {
    return this.stripStrings(line).replace(/\/\/.*$/, '');
  }

  /**
   * Strip strings from a line
   */
  protected stripStrings(line: string): string {
    return line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => ' '.repeat(m.length));
  }
}

/**
 * Factory function to create a new ModularUltimateValidator
 */
export function createModularUltimateValidator(config?: Partial<ValidatorConfig>): ModularUltimateValidator {
  return new ModularUltimateValidator(config);
}

/**
 * Convenience function for validation
 */
export function validatePineScriptV6(code: string, config?: Partial<ValidatorConfig>): ValidationResult {
  const validator = new ModularUltimateValidator(config);
  return validator.validate(code);
}