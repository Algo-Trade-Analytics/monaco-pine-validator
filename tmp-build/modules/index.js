/**
 * Centralized module registration for the Pine Script v6 validator
 * Modules are ordered by priority (lower numbers = higher priority)
 */
// Core modules
import { CoreValidator } from './core-validator';
import { SyntaxValidator } from './syntax-validator';
import { ScopeValidator } from './scope-validator';
import { TypeValidator } from './type-validator';
import { TypeInferenceValidator } from './type-inference-validator';
// Function validators
import { FunctionValidator } from './function-validator';
import { FunctionDeclarationsValidator } from './functions/function-declarations';
import { FunctionTypesValidator } from './functions/function-types';
import { StringFunctionsValidator } from './string-functions-validator';
import { MathFunctionsValidator } from './math-functions-validator';
import { TAFunctionsValidator } from './ta-functions-validator';
import { InputFunctionsValidator } from './input-functions-validator';
import { TimeDateFunctionsValidator } from './time-date-functions-validator';
import { AlertFunctionsValidator } from './alert-functions-validator';
import { DrawingFunctionsValidator } from './drawing-functions-validator';
import { PolylineFunctionsValidator } from './polyline-functions-validator';
import { TickerFunctionsValidator } from './ticker-functions-validator';
// Strategy modules
import { StrategyFunctionsValidator } from './strategy-functions-validator';
import { StrategyOrderLimitsValidator } from './strategy-order-limits-validator';
import { EnhancedStrategyValidator } from './enhanced-strategy-validator';
// Built-in variables and constants
import { BuiltinVariablesValidator } from './builtin-variables-validator';
import { SyminfoVariablesValidator } from './syminfo-variables-validator';
import { FinalConstantsValidator } from './final-constants-validator';
// Data structures
import { ArrayValidator } from './array-validator';
import { MatrixValidator } from './matrix-validator';
import { MapValidator } from './map-validator';
import { UDTValidator } from './udt-validator';
import { EnumValidator } from './enum-validator';
// Advanced features
import { V6FeaturesValidator } from './v6-features-validator';
import { VaripValidator } from './varip-validator';
import { SwitchValidator } from './switch-validator';
import { WhileLoopValidator } from './while-loop-validator';
import { HistoryReferencingValidator } from './history-referencing-validator';
import { DynamicDataValidator } from './dynamic-data-validator';
import { DynamicLoopValidator } from './dynamic-loop-validator';
import { LazyEvaluationValidator } from './lazy-evaluation-validator';
// Style and formatting
import { TextFormattingValidator } from './text-formatting-validator';
import { StyleValidator } from './style-validator';
import { LinefillValidator } from './linefill-validator';
import { EnhancedTextboxValidator } from './enhanced-textbox-validator';
// Performance and quality
import { PerformanceValidator } from './performance-validator';
import { EnhancedPerformanceValidator } from './enhanced-performance-validator';
import { EnhancedQualityValidator } from './enhanced-quality-validator';
import { EnhancedResourceValidator } from './enhanced-resource-validator';
// Enhanced modules
import { EnhancedBooleanValidator } from './enhanced-boolean-validator';
import { EnhancedLibraryValidator } from './enhanced-library-validator';
import { EnhancedMethodValidator } from './enhanced-method-validator';
import { EnhancedMigrationValidator } from './enhanced-migration-validator';
import { EnhancedSemanticValidator } from './enhanced-semantic-validator';
/**
 * Ordered list of all validation modules by priority
 * Lower priority numbers execute first
 */
export const ALL_MODULES = [
    // Core validation (priority 1-10)
    { module: CoreValidator, priority: 1 },
    { module: SyntaxValidator, priority: 2 },
    { module: ScopeValidator, priority: 3 },
    { module: TypeValidator, priority: 4 },
    { module: TypeInferenceValidator, priority: 5 },
    // Function validation (priority 11-30)
    { module: FunctionValidator, priority: 95 },
    { module: FunctionDeclarationsValidator, priority: 95 },
    { module: FunctionTypesValidator, priority: 93 },
    { module: StringFunctionsValidator, priority: 85 },
    { module: MathFunctionsValidator, priority: 83 },
    { module: TAFunctionsValidator, priority: 84 },
    { module: InputFunctionsValidator, priority: 87 },
    { module: TimeDateFunctionsValidator, priority: 75 },
    { module: AlertFunctionsValidator, priority: 75 },
    { module: DrawingFunctionsValidator, priority: 86 },
    { module: PolylineFunctionsValidator, priority: 86 },
    { module: TickerFunctionsValidator, priority: 66 },
    // Strategy modules (priority 31-35)
    { module: StrategyFunctionsValidator, priority: 31 },
    { module: StrategyOrderLimitsValidator, priority: 32 },
    { module: EnhancedStrategyValidator, priority: 33 },
    // Built-in variables and constants (priority 36-40)
    { module: BuiltinVariablesValidator, priority: 67 },
    { module: SyminfoVariablesValidator, priority: 68 },
    { module: FinalConstantsValidator, priority: 65 },
    // Data structures (priority 41-50)
    { module: ArrayValidator, priority: 41 },
    { module: MatrixValidator, priority: 42 },
    { module: MapValidator, priority: 43 },
    { module: UDTValidator, priority: 44 },
    { module: EnumValidator, priority: 45 },
    // Advanced features (priority 51-65)
    { module: V6FeaturesValidator, priority: 51 },
    { module: VaripValidator, priority: 52 },
    { module: SwitchValidator, priority: 53 },
    { module: WhileLoopValidator, priority: 54 },
    { module: HistoryReferencingValidator, priority: 55 },
    { module: DynamicDataValidator, priority: 56 },
    { module: DynamicLoopValidator, priority: 57 },
    { module: LazyEvaluationValidator, priority: 58 },
    // Style and formatting (priority 70-80)
    { module: TextFormattingValidator, priority: 75 },
    { module: StyleValidator, priority: 60 },
    { module: LinefillValidator, priority: 85 },
    { module: EnhancedTextboxValidator, priority: 79 },
    // Performance and quality (priority 81-90)
    { module: PerformanceValidator, priority: 70 },
    { module: EnhancedPerformanceValidator, priority: 70 },
    { module: EnhancedQualityValidator, priority: 60 },
    { module: EnhancedResourceValidator, priority: 70 },
    // Enhanced modules (priority 91-100)
    { module: EnhancedBooleanValidator, priority: 91 },
    { module: EnhancedLibraryValidator, priority: 92 },
    { module: EnhancedMethodValidator, priority: 93 },
    { module: EnhancedMigrationValidator, priority: 94 },
    { module: EnhancedSemanticValidator, priority: 95 }
];
/**
 * Get all modules sorted by priority
 */
export function getModulesByPriority() {
    return ALL_MODULES.sort((a, b) => a.priority - b.priority);
}
/**
 * Get total module count
 */
export function getTotalModuleCount() {
    return ALL_MODULES.length;
}
