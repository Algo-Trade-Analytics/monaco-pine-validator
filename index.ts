/**
 * Modular Pine Script v6 Validator - Main Export
 * 
 * This module provides a clean, modular architecture for Pine Script validation
 * while maintaining compatibility with the existing validator interface.
 */

// Core exports
export * from './core/types';
export * from './core/constants';
export * from './core/base-validator';

// Main validators
export * from './ModularUltimateValidator';
export * from './EnhancedModularValidator';

// Individual modules (for advanced usage)
export * from './modules/core-validator';
export * from './modules/type-validator';
export * from './modules/scope-validator';
export * from './modules/syntax-validator';
export * from './modules/v6-features-validator';
export * from './modules/switch-validator';
export * from './modules/function-validator';
export * from './modules/performance-validator';
export * from './modules/style-validator';
export * from './modules/polyline-functions-validator';
export * from './modules/time-date-functions-validator';

// Convenience exports
export { 
  createModularUltimateValidator,
  validatePineScriptV6 
} from './ModularUltimateValidator';

export {
  createEnhancedModularValidator,
  validatePineScriptV6Enhanced
} from './EnhancedModularValidator';

// Monaco worker integration
export * from './core/monaco/messages';
export * from './core/monaco/worker-harness';
export * from './core/monaco/worker';
export * from './core/monaco/semantic-model';
export * from './core/monaco/client';
