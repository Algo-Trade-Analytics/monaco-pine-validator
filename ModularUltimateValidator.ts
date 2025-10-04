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
import { EnumValidator } from './modules/enum-validator';
import { UDTValidator } from './modules/udt-validator';
import { ensureAstContext } from './core/ast/context-utils';

export class ModularUltimateValidator extends BaseValidator {
  constructor(config: Partial<ValidatorConfig> = {}) {
    super(config);
    
    // Register validation modules (in order of priority)
    this.registerModule(new CoreValidator());           // Core validation (priority 100)
    this.registerModule(new SyntaxValidator());         // Basic syntax (priority 90)
    this.registerModule(new UDTValidator());            // UDT validation (priority 85)
    this.registerModule(new EnumValidator());           // Enum validation (priority 85)
    this.registerModule(new TypeValidator());           // Type system (priority 85)
    this.registerModule(new ScopeValidator());          // Scope management (priority 80)
    this.registerModule(new V6FeaturesValidator());     // V6 features (priority 80)
    this.registerModule(new PerformanceValidator());    // Performance (priority 70)
    this.registerModule(new StyleValidator());          // Style & quality (priority 60)
  }

  /**
   * Run core validation logic
   * This handles the basic validation that all Pine Script validators need
   */
  protected runCoreValidation(): void {
    ensureAstContext(this.context, this.config);
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
