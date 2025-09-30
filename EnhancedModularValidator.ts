/**
 * Enhanced Modular Validator for Pine Script v6
 *
 * This class wires together the full catalog of validator modules used across the
 * Monaco worker and local tooling.  The implementation still mirrors the legacy
 * production validator, but several modules now expect Chevrotain AST data that
 * now enables the Chevrotain AST service by default.  With parsing active the
 * Vitest run currently reports a nine-test smoke suite (9 passing / 0 failing
 * assertions as of the October 2023 snapshot) while the broader 1,021-spec
 * regression set remains deferred until rule implementations catch up with the
 * fixtures.
 */

import { BaseValidator } from './core/base-validator';
import { ValidationResult, ValidatorConfig, ValidationContext } from './core/types';
import { CoreValidator } from './modules/core-validator';
import { TypeValidator } from './modules/type-validator';
import { ScopeValidator } from './modules/scope-validator';
import { SyntaxValidator } from './modules/syntax-validator';
import { V6FeaturesValidator } from './modules/v6-features-validator';
import { PerformanceValidator } from './modules/performance-validator';
import { StyleValidator } from './modules/style-validator';
import { SwitchValidator } from './modules/switch-validator';
import { FunctionValidator } from './modules/function-validator';
import { FunctionDeclarationsValidator } from './modules/functions/function-declarations';
import { FunctionTypesValidator } from './modules/functions/function-types';
import { VaripValidator } from './modules/varip-validator';
import { UDTValidator } from './modules/udt-validator';
import { DynamicDataValidator } from './modules/dynamic-data-validator';
import { TypeInferenceValidator } from './modules/type-inference-validator';
import { WhileLoopValidator } from './modules/while-loop-validator';
import { HistoryReferencingValidator } from './modules/history-referencing-validator';
import { TextFormattingValidator } from './modules/text-formatting-validator';
import { EnumValidator } from './modules/enum-validator';
import { ArrayValidator } from './modules/array-validator';
import { MatrixValidator } from './modules/matrix-validator';
import { MapValidator } from './modules/map-validator';
import { ChartValidator } from './modules/chart-validator';
import { StringFunctionsValidator } from './modules/string-functions-validator';
import { InputFunctionsValidator } from './modules/input-functions-validator';
import { DrawingFunctionsValidator } from './modules/drawing-functions-validator';
import { TAFunctionsValidator } from './modules/ta-functions-validator';
import { MathFunctionsValidator } from './modules/math-functions-validator';
import { StrategyFunctionsValidator } from './modules/strategy-functions-validator';
import { EnhancedBooleanValidator } from './modules/enhanced-boolean-validator';
import { EnhancedLibraryValidator } from './modules/enhanced-library-validator';
import { EnhancedPerformanceValidator } from './modules/enhanced-performance-validator';
import { EnhancedMethodValidator } from './modules/enhanced-method-validator';
import { EnhancedMigrationValidator } from './modules/enhanced-migration-validator';
import { EnhancedResourceValidator } from './modules/enhanced-resource-validator';
import { EnhancedSemanticValidator } from './modules/enhanced-semantic-validator';
import { EnhancedQualityValidator } from './modules/enhanced-quality-validator';
import { EnhancedStrategyValidator } from './modules/enhanced-strategy-validator';
import { LinefillValidator } from './modules/linefill-validator';
import { LazyEvaluationValidator } from './modules/lazy-evaluation-validator';
import { StrategyOrderLimitsValidator } from './modules/strategy-order-limits-validator';
import { EnhancedTextboxValidator } from './modules/enhanced-textbox-validator';
import { DynamicLoopValidator } from './modules/dynamic-loop-validator';
// Polyline drawing validator
import { PolylineFunctionsValidator } from './modules/polyline-functions-validator';
import { TimeDateFunctionsValidator } from './modules/time-date-functions-validator';
import { AlertFunctionsValidator } from './modules/alert-functions-validator';
import { BuiltinVariablesValidator } from './modules/builtin-variables-validator';
import { SyminfoVariablesValidator } from './modules/syminfo-variables-validator';
import { FinalConstantsValidator } from './modules/final-constants-validator';
import { TickerFunctionsValidator } from './modules/ticker-functions-validator';

export class EnhancedModularValidator extends BaseValidator {
  protected functionHeaderLine = new Map<string, number>();

  constructor(config: Partial<ValidatorConfig> = {}) {
    super(config);
    
    // Register all validation modules in priority order
    // Core validation is handled by CoreValidator module (priority 100)
    this.registerModule(new CoreValidator());           // Core validation (priority 100) - runs first
    this.registerModule(new ArrayValidator());          // Array validation (priority 90) - must run before FunctionValidator
    this.registerModule(new MatrixValidator());         // Matrix validation (priority 90) - must run before FunctionValidator
            this.registerModule(new MapValidator());            // Map validation (priority 88) - must run before FunctionValidator
            this.registerModule(new ChartValidator());          // Chart validation (priority 70) - handles chart.point.* functions
            this.registerModule(new StringFunctionsValidator()); // String functions validation (priority 85) - essential for Pine Script
            this.registerModule(new InputFunctionsValidator());  // Input functions validation (priority 87) - essential for Pine Script
            this.registerModule(new DrawingFunctionsValidator()); // Drawing functions validation (priority 86) - essential for Pine Script
            this.registerModule(new PolylineFunctionsValidator()); // Polyline functions validation (priority 86)
            this.registerModule(new LinefillValidator());        // Linefill functions validation (priority 85) - essential for Pine Script v6
            this.registerModule(new TAFunctionsValidator());     // TA functions validation (priority 84) - essential for Pine Script
            this.registerModule(new LazyEvaluationValidator());  // Lazy evaluation detection (priority 83) - critical for v6 consistency
            this.registerModule(new MathFunctionsValidator());   // Math functions validation (priority 83) - essential for Pine Script
            this.registerModule(new StrategyFunctionsValidator()); // Strategy functions validation (priority 82) - essential for Pine Script
            this.registerModule(new StrategyOrderLimitsValidator()); // Strategy order limits validation (priority 81) - important for strategy performance
            this.registerModule(new EnhancedTextboxValidator());  // Enhanced textbox validation (priority 79) - enhances drawing functionality
    // Re-enable validation modules one by one to identify the problematic one
    this.registerModule(new SyntaxValidator());         // Basic syntax (priority 90)
    this.registerModule(new FunctionDeclarationsValidator()); // Function declarations (priority 95) - runs before full function validation
    this.registerModule(new FunctionTypesValidator()); // Function type validation (priority 93) - runs after built-in validation
    this.registerModule(new FunctionValidator());       // Function validation (priority 95) - must run before TypeInferenceValidator
    this.registerModule(new TypeValidator());           // Type system (priority 85)
    this.registerModule(new UDTValidator());            // User-Defined Types (priority 95)
    this.registerModule(new EnumValidator());           // Enum support (priority 85)
    this.registerModule(new DynamicDataValidator());    // Dynamic data requests (priority 85)
    this.registerModule(new TypeInferenceValidator());  // Enhanced type inference (priority 90)
    this.registerModule(new ScopeValidator());          // Scope management (priority 80)
    this.registerModule(new V6FeaturesValidator());     // V6 features (priority 80)
    this.registerModule(new SwitchValidator());         // Switch statements (priority 75)
    this.registerModule(new VaripValidator());          // Varip declarations (priority 75)
    this.registerModule(new WhileLoopValidator());      // Enhanced while loop validation (priority 75)
    this.registerModule(new DynamicLoopValidator());    // Dynamic for-loop validation (priority 76)
    this.registerModule(new HistoryReferencingValidator()); // History referencing (priority 75)
    this.registerModule(new TextFormattingValidator());     // Text formatting (priority 75)
    this.registerModule(new TimeDateFunctionsValidator());  // Time/date functions (priority 75)
    this.registerModule(new AlertFunctionsValidator());     // Alert functions validation (priority 75)
    this.registerModule(new BuiltinVariablesValidator());   // Built-in variables validation (priority 70)
    this.registerModule(new SyminfoVariablesValidator());   // Syminfo variables validation (priority 68)
    this.registerModule(new FinalConstantsValidator());     // Final constants validation (priority 65)
    this.registerModule(new TickerFunctionsValidator());    // Specialized ticker functions (priority 66)
    this.registerModule(new EnhancedBooleanValidator());    // Enhanced boolean logic (priority 75)
    this.registerModule(new EnhancedLibraryValidator());    // Enhanced library validation (priority 80)
    this.registerModule(new EnhancedMigrationValidator());  // Enhanced migration (priority 75)
    this.registerModule(new EnhancedPerformanceValidator()); // Enhanced performance (priority 70)
    this.registerModule(new EnhancedMethodValidator());     // Enhanced method validation (priority 85)
    this.registerModule(new EnhancedResourceValidator());   // Enhanced resource validation (priority 70)
    this.registerModule(new EnhancedSemanticValidator());   // Enhanced semantic validation (priority 85)
    // this.registerModule(new PerformanceValidator());    // Performance (priority 70) - DISABLED: redundant with enhanced modules
    this.registerModule(new StyleValidator());          // Style & quality (priority 60)
    this.registerModule(new EnhancedQualityValidator());    // Enhanced quality validation (priority 60)
    this.registerModule(new EnhancedStrategyValidator());    // Enhanced strategy validation (priority 75)
  }

  /**
   * Validate Pine Script code with comprehensive checks
   * 
   * This method provides the same interface as the original EnhancedPineScriptValidator
   * and UltimateValidator, but uses the modular architecture internally.
   * 
   * @param code - The Pine Script code to validate
   * @returns ValidationResult with errors, warnings, and info messages
   */
  validate(code: string): ValidationResult;
  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult;
  validate(codeOrContext: string | ValidationContext, config?: ValidatorConfig): ValidationResult {
    if (typeof codeOrContext === 'string') {
      // Use the base validator's validate method which orchestrates all modules
      return super.validate(codeOrContext);
    } else {
      // Use the provided context and config
      this.rebuildConfig(config);
      this.reset();

      const normalized = this.normaliseContext(codeOrContext);

      const joinLines = (lines?: string[]): string | null => {
        if (!Array.isArray(lines) || lines.length === 0) {
          return null;
        }
        return lines.join('\n');
      };

      const source =
        joinLines(normalized.rawLines) ??
        joinLines(normalized.lines) ??
        joinLines(normalized.cleanLines) ??
        '';

      this.prepareContext(source);

      if (normalized.lines?.length) {
        this.context.lines = [...normalized.lines];
      }
      if (normalized.cleanLines?.length) {
        this.context.cleanLines = [...normalized.cleanLines];
      }
      if (normalized.rawLines?.length) {
        this.context.rawLines = [...normalized.rawLines];
      }

      if (normalized.ast) {
        this.context.ast = normalized.ast;
      }
      if (normalized.astDiagnostics) {
        this.context.astDiagnostics = normalized.astDiagnostics;
      }
      if (normalized.scopeGraph) {
        this.context.scopeGraph = normalized.scopeGraph;
      }
      if (normalized.symbolTable) {
        this.context.symbolTable = normalized.symbolTable;
      }
      if (normalized.typeEnvironment) {
        this.context.typeEnvironment = normalized.typeEnvironment;
      }
      if (normalized.controlFlowGraph) {
        this.context.controlFlowGraph = normalized.controlFlowGraph;
      }

      this.runValidation();
      return this.buildResult();
    }
  }

  /**
   * Override runValidation to properly merge context updates from modules
   */
  protected runValidation(): void {
    // Run core validation first
    this.runCoreValidation();

    // Sort modules by priority (higher priority runs first)
    const sortedModules = [...this.modules].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Run registered modules
    for (const module of sortedModules) {
      try {
        const moduleResult = module.validate(this.context, this.config as ValidatorConfig);
        
        // Merge the module's typeMap back into the shared context
        if (moduleResult.typeMap) {
          for (const [key, value] of moduleResult.typeMap) {
            this.context.typeMap.set(key, value);
          }
        }
        
        // Add errors normally for all modules
        this.addErrors(moduleResult.errors);
        
        this.addWarnings(moduleResult.warnings);
        this.addInfoMessages(moduleResult.info);
      } catch (error) {
        this.addError(1, 1, `Error in ${module.name} module: ${error}`, 'MODULE-ERROR');
      }
    }

    // Apply custom rules
    this.applyCustomRules();

    // Filter ignored codes
    this.filterIgnoredCodes();
  }

  /**
   * Get completion suggestions for a given position
   * 
   * This provides the same completion functionality as the original validator.
   * 
   * @param position - The cursor position in the code
   * @returns Array of completion items
   */
  getCompletions(position?: { line: number; column: number }): any[] {
    // This would be implemented by aggregating completions from all modules
    // For now, return a basic set of completions
    return [
      { label: 'indicator', kind: 'keyword', detail: 'Script declaration' },
      { label: 'strategy', kind: 'keyword', detail: 'Script declaration' },
      { label: 'library', kind: 'keyword', detail: 'Script declaration' },
      { label: 'plot', kind: 'function', detail: 'Plot function' },
      { label: 'ta.sma', kind: 'function', detail: 'Simple Moving Average' },
      { label: 'ta.ema', kind: 'function', detail: 'Exponential Moving Average' },
      { label: 'ta.rsi', kind: 'function', detail: 'Relative Strength Index' },
      { label: 'var', kind: 'keyword', detail: 'Variable declaration' },
      { label: 'varip', kind: 'keyword', detail: 'Intrabar persistent variable' },
      { label: 'const', kind: 'keyword', detail: 'Constant declaration' },
      { label: 'if', kind: 'keyword', detail: 'Conditional statement' },
      { label: 'for', kind: 'keyword', detail: 'Loop statement' },
      { label: 'while', kind: 'keyword', detail: 'Loop statement' },
      { label: 'switch', kind: 'keyword', detail: 'Switch statement (v6)' },
      { label: 'type', kind: 'keyword', detail: 'User-defined type (v6)' },
      { label: 'method', kind: 'keyword', detail: 'Method declaration (v6)' },
    ];
  }

  /**
   * Get hover information for a given position
   * 
   * This provides the same hover functionality as the original validator.
   * 
   * @param position - The cursor position in the code
   * @returns Hover information string or null
   */
  getHoverInfo(position: { line: number; column: number }): string | null {
    // This would be implemented by aggregating hover info from all modules
    // For now, return basic hover info
    if (position.line < 1 || position.line > this.context.lines.length) return null;
    
    const line = this.context.lines[position.line - 1] || '';
    const safe = this.stripStringsAndLineComment(line);
    
    // Simple token detection for hover info
    const tokens = safe.match(/\b\w+\b/g) || [];
    for (const token of tokens) {
      if (position.column >= safe.indexOf(token) && position.column <= safe.indexOf(token) + token.length) {
        return this.getTokenHoverInfo(token);
      }
    }
    
    return null;
  }

  /**
   * Get validation statistics
   * 
   * @returns Object with validation statistics
   */
  getValidationStats(): {
    totalErrors: number;
    totalWarnings: number;
    totalInfo: number;
    moduleStats: Array<{ name: string; errors: number; warnings: number; info: number }>;
  } {
    const stats = {
      totalErrors: this.errors.length,
      totalWarnings: this.warnings.length,
      totalInfo: this.info.length,
      moduleStats: this.modules.map(module => ({
        name: module.name,
        errors: 0, // Would be tracked per module
        warnings: 0,
        info: 0
      }))
    };
    
    return stats;
  }

  /**
   * Get the current validation context
   * 
   * @returns The current validation context
   */
  getContext() {
    return this.context;
  }

  /**
   * Get the current configuration
   * 
   * @returns The current validator configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Update the validator configuration
   * 
   * @param newConfig - Partial configuration to update
   */
  updateConfig(newConfig: Partial<ValidatorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Enable or disable specific validation modules
   * 
   * @param moduleName - Name of the module to enable/disable
   * @param enabled - Whether to enable or disable the module
   */
  setModuleEnabled(moduleName: string, enabled: boolean): void {
    // This would be implemented to dynamically enable/disable modules
    // For now, this is a placeholder - module management is handled at construction time
    // Future enhancement: implement dynamic module enable/disable functionality
  }

  /**
   * Get list of available validation modules
   * 
   * @returns Array of module names
   */
  getAvailableModules(): string[] {
    return this.modules.map(module => module.name);
  }

  // Private helper methods
  private stripStringsAndLineComment(line: string): string {
    return this.stripStrings(line).replace(/\/\/.*$/, '');
  }

  protected stripStrings(line: string): string {
    return line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => ' '.repeat(m.length));
  }

  protected runCoreValidation(): void {
    // Core validation is now handled by the CoreValidator module
    // This method is kept for compatibility but the actual core validation
    // is performed by the CoreValidator module which runs first (priority 100)
    
    // Initialize built-in variables in type map for other modules to use
    this.initializeBuiltInVariables();
    
    // Initialize built-in functions for other modules to use
    this.initializeBuiltInFunctions();
  }

  protected buildResult(): ValidationResult {
    // Update our scriptType from the context (set by CoreValidator)
    this.scriptType = this.context.scriptType;
    const result = super.buildResult();
    if (process.env.DEBUG_FINAL_VALIDATOR === '1') {
      console.log('[EnhancedModularValidator] final snapshot', {
        errors: result.errors,
        warnings: result.warnings,
        typeMapKeys: Array.from(result.typeMap.keys()),
      });
    }
    return result;
  }

  private initializeBuiltInVariables(): void {
    // Built-in series variables
    const seriesVars = ['open', 'high', 'low', 'close', 'volume', 'time', 'timenow', 'bar_index', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'];
    
    // Built-in time/date variables
    const timeVars = ['year', 'month', 'dayofmonth', 'dayofweek', 'hour', 'minute', 'second', 'weekofyear', 'last_bar_time'];
    timeVars.forEach(varName => {
      this.context.typeMap.set(varName, {
        type: 'int',
        isConst: true,
        isSeries: true,
        declaredAt: { line: 0, column: 0 },
        usages: []
      } as any);
    });
    seriesVars.forEach(varName => {
      this.context.typeMap.set(varName, {
        type: 'series',
        isConst: true,
        isSeries: true,
        declaredAt: { line: 0, column: 0 },
        usages: []
      } as any);
    });

    // Built-in constants
    const boolVars = ['true', 'false'];
    boolVars.forEach(varName => {
      this.context.typeMap.set(varName, {
        type: 'bool',
        isConst: true,
        isSeries: false,
        declaredAt: { line: 0, column: 0 },
        usages: []
      } as any);
    });

    // Built-in na
    this.context.typeMap.set('na', {
      type: 'unknown',
      isConst: true,
      isSeries: false,
      declaredAt: { line: 0, column: 0 },
      usages: []
    } as any);

    // Built-in namespace objects
    this.context.typeMap.set('timeframe', {
      type: 'unknown', // Namespace object
      isConst: true,
      isSeries: false,
      declaredAt: { line: 0, column: 0 },
      usages: []
    } as any);
    
    this.context.typeMap.set('session', {
      type: 'unknown', // Namespace object
      isConst: true,
      isSeries: false,
      declaredAt: { line: 0, column: 0 },
      usages: []
    } as any);
    
    // Initialize built-in functions in context
    this.initializeBuiltInFunctions();
  }

  private initializeBuiltInFunctions(): void {
    // Add built-in functions to the context
    const builtInFunctions = [
      // TA functions
      'ta.sma', 'ta.ema', 'ta.rsi', 'ta.macd', 'ta.stoch', 'ta.atr', 'ta.bb', 'ta.highest', 'ta.lowest',
      'ta.crossover', 'ta.crossunder', 'ta.sar', 'ta.roc', 'ta.mom', 'ta.change', 'ta.correlation',
      'ta.dev', 'ta.linreg', 'ta.percentile_linear_interpolation', 'ta.percentile_nearest_rank',
      'ta.percentrank', 'ta.pivothigh', 'ta.pivotlow', 'ta.range', 'ta.stdev', 'ta.variance', 'ta.wma',
      'ta.alma', 'ta.vwma', 'ta.swma', 'ta.rma', 'ta.hma', 'ta.tsi', 'ta.cci', 'ta.cmo', 'ta.mfi',
      'ta.obv', 'ta.pvt', 'ta.nvi', 'ta.pvi', 'ta.wad',
      
      // Math functions
      'math.max', 'math.min', 'math.abs', 'math.round', 'math.floor', 'math.ceil', 'math.pow',
      'math.sqrt', 'math.log', 'math.exp', 'math.sin', 'math.cos', 'math.tan', 'math.asin',
      'math.acos', 'math.atan', 'math.todegrees', 'math.toradians', 'math.sign',
      'math.sum', 'math.avg', 'math.random', 'math.round_to_mintick',
      
      // String functions
      'str.tostring', 'str.tonumber', 'str.length', 'str.contains', 'str.substring', 'str.replace',
      'str.split', 'str.format', 'str.startswith', 'str.endswith', 'str.pos', 'str.match',
      'str.trim', 'str.upper', 'str.lower',
      
      // Plotting functions
      'plot', 'plotshape', 'plotchar', 'plotcandle', 'plotbar', 'bgcolor', 'hline', 'fill', 'barcolor',
      
      // Time/Date functions
      'time_close', 'time_tradingday', 'timestamp', 'timenow',
      
      // Other built-in functions
      'alert', 'alertcondition', 'log'
    ];

    builtInFunctions.forEach(funcName => {
      if (this.context.functionNames) {
        this.context.functionNames.add(funcName);
      }
    });

    // Add built-in constants to usedVars to prevent undefined reference warnings
    const builtInConstants = [
      // Color constants
      'color.blue', 'color.red', 'color.green', 'color.yellow', 'color.orange', 'color.purple', 'color.gray', 'color.white', 'color.black',
      // Shape constants
      'shape.triangleup', 'shape.triangledown', 'shape.diamond', 'shape.circle', 'shape.square', 'shape.flag', 'shape.arrowup', 'shape.arrowdown', 'shape.xcross', 'shape.cross',
        // Location constants
      'location.abovebar', 'location.belowbar', 'location.top', 'location.bottom', 'location.absolute',
      // Syminfo properties
      'syminfo.tickerid', 'syminfo.ticker', 'syminfo.currency', 'syminfo.description', 'syminfo.basecurrency',
      'syminfo.minmove', 'syminfo.pointvalue', 'syminfo.session', 'syminfo.timezone', 'syminfo.type'
    ];

    builtInConstants.forEach(constant => {
      if (this.context.usedVars) {
        this.context.usedVars.add(constant);
      }
    });
  }




  private getTokenHoverInfo(token: string): string {
    // Basic hover info for common tokens
    const hoverInfo: Record<string, string> = {
      'indicator': '**indicator** — Script declaration for indicators',
      'strategy': '**strategy** — Script declaration for strategies',
      'library': '**library** — Script declaration for libraries',
      'plot': '**plot** — Plot a series on the chart',
      'var': '**var** — Variable declaration (persistent across bars)',
      'varip': '**varip** — Intrabar persistent variable (v6)',
      'const': '**const** — Constant declaration',
      'if': '**if** — Conditional statement',
      'for': '**for** — Loop statement',
      'while': '**while** — Loop statement',
      'switch': '**switch** — Switch statement (v6)',
      'type': '**type** — User-defined type declaration (v6)',
      'method': '**method** — Method declaration (v6)',
      'ta.sma': '**ta.sma** — Simple Moving Average',
      'ta.ema': '**ta.ema** — Exponential Moving Average',
      'ta.rsi': '**ta.rsi** — Relative Strength Index',
    };
    
    return hoverInfo[token] || `**${token}** — Pine Script identifier`;
  }
}

// Factory function for easy creation
export function createEnhancedModularValidator(config?: Partial<ValidatorConfig>): EnhancedModularValidator {
  return new EnhancedModularValidator(config);
}

// Convenience function for validation
export function validatePineScriptV6Enhanced(code: string, config?: Partial<ValidatorConfig>): ValidationResult {
  const validator = new EnhancedModularValidator(config);
  return validator.validate(code);
}
