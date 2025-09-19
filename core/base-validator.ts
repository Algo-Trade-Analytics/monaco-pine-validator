/**
 * Base validator class for the modular Pine Script v6 validator
 */

import { 
  ValidationError, 
  ValidationResult, 
  ValidationContext, 
  ValidatorConfig, 
  ValidationModule,
  TypeInfo,
  ScopeInfo
} from './types';
import { KEYWORDS, NAMESPACES, NS_MEMBERS, PSEUDO_VARS, WILDCARD_IDENT } from './constants';

export abstract class BaseValidator {
  protected errors: ValidationError[] = [];
  protected warnings: ValidationError[] = [];
  protected info: ValidationError[] = [];
  protected typeMap = new Map<string, TypeInfo>();
  protected context: ValidationContext;
  protected modules: ValidationModule[] = [];

  // State tracking
  protected declared = new Map<string, number>();
  protected declIndent = new Map<string, number>();
  protected declaredSites = new Set<string>();
  protected constNames = new Set<string>();
  protected functionNames = new Set<string>();
  protected methodNames = new Set<string>();
  protected functionParams = new Map<string, string[]>();
  protected functionHeaderLine = new Map<string, number>();
  protected used = new Set<string>();
  protected paramUsage = new Map<string, Set<string>>();
  protected typeFields = new Map<string, Set<string>>();

  // Scope tracking
  protected scopeStack: ScopeInfo[] = [];
  protected indentStack: number[] = [];
  protected paren = 0;
  protected bracket = 0;
  protected brace = 0;

  // Script state
  protected hasVersion = false;
  protected firstVersionLine: number | null = null;
  protected scriptType: 'indicator' | 'strategy' | 'library' | null = null;
  protected scriptDeclParsed = false;
  protected sawBrace = false;
  protected sawTabIndent = false;
  protected sawSpaceIndent = false;

  constructor(protected config: Partial<ValidatorConfig> = {}) {
    this.config = {
      targetVersion: 6,
      strictMode: false,
      allowDeprecated: true,
      enableTypeChecking: true,
      enableControlFlowAnalysis: true,
      enablePerformanceAnalysis: false,
      customRules: [],
      ignoredCodes: [],
      ...config
    };

    this.context = {
      lines: [],
      cleanLines: [],
      rawLines: [],
      typeMap: this.typeMap,
      usedVars: this.used,
      declaredVars: this.declared,
      functionNames: this.functionNames,
      methodNames: this.methodNames,
      functionParams: this.functionParams,
      scriptType: null,
      version: this.config.targetVersion || 6,
      hasVersion: false,
      firstVersionLine: null
    };
  }

  /**
   * Register a validation module
   */
  protected registerModule(module: ValidationModule): void {
    this.modules.push(module);
  }

  /**
   * Main validation entry point
   */
  validate(code: string): ValidationResult {
    this.reset();
    this.prepareContext(code);
    this.runValidation();
    return this.buildResult();
  }

  /**
   * Reset all state for a fresh validation run
   */
  protected reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.typeMap.clear();
    this.declared.clear();
    this.declIndent.clear();
    this.declaredSites.clear();
    this.constNames.clear();
    this.functionNames.clear();
    this.methodNames.clear();
    this.functionParams.clear();
    this.functionHeaderLine.clear();
    this.used.clear();
    this.paramUsage.clear();
    this.typeFields.clear();
    this.scopeStack = [{ indent: -1, params: new Set(), fnName: null, variables: new Set() }];
    this.indentStack = [0];
    this.paren = 0;
    this.bracket = 0;
    this.brace = 0;
    this.hasVersion = false;
    this.firstVersionLine = null;
    this.scriptType = null;
    this.scriptDeclParsed = false;
    this.sawBrace = false;
    this.sawTabIndent = false;
    this.sawSpaceIndent = false;
  }

  /**
   * Prepare the validation context
   */
  protected prepareContext(code: string): void {
    // Strip BOM and normalize newlines
    code = code.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

    this.context.rawLines = code.split('\n');
    this.context.lines = this.context.rawLines.slice();
    this.context.cleanLines = this.stripLineCommentsKeepingStrings(code).split('\n');

    // Update context with current state
    this.context.typeMap = this.typeMap;
    this.context.usedVars = this.used;
    this.context.declaredVars = this.declared;
    this.context.functionNames = this.functionNames;
    this.context.methodNames = this.methodNames;
    this.context.functionParams = this.functionParams;
    this.context.scriptType = this.scriptType;
    this.context.hasVersion = this.hasVersion;
    this.context.firstVersionLine = this.firstVersionLine;
  }

  /**
   * Run the validation process
   */
  protected runValidation(): void {
    // Run core validation first
    this.runCoreValidation();

    // Run registered modules
    for (const module of this.modules) {
      try {
        const moduleResult = module.validate(this.context, this.config as ValidatorConfig);
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
   * Run core validation logic (to be implemented by subclasses)
   */
  protected abstract runCoreValidation(): void;

  /**
   * Build the final validation result
   */
  protected buildResult(): ValidationResult {
    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: this.typeMap,
      scriptType: this.scriptType
    };
  }

  /**
   * Add errors from a module
   */
  protected addErrors(errors: ValidationError[]): void {
    for (const error of errors) {
      switch (error.severity) {
        case 'error':
          this.errors.push(error);
          break;
        case 'warning':
          this.warnings.push(error);
          break;
        case 'info':
          this.info.push(error);
          break;
      }
    }
  }

  /**
   * Add a single error
   */
  protected addError(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.errors.push({ line, column, message, severity: 'error', code, suggestion });
  }

  /**
   * Add a single warning
   */
  protected addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  /**
   * Add a single info message
   */
  protected addInfo(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.info.push({ line, column, message, severity: 'info', code, suggestion });
  }

  /**
   * Add by severity
   */
  protected addBySeverity(sev: 'error' | 'warning' | 'info', line: number, col: number, msg: string, code?: string, sugg?: string): void {
    if (sev === 'error') this.addError(line, col, msg, code, sugg);
    else if (sev === 'warning') this.addWarning(line, col, msg, code, sugg);
    else this.addInfo(line, col, msg, code, sugg);
  }

  /**
   * Add multiple warnings
   */
  protected addWarnings(warnings: ValidationError[]): void {
    for (const warning of warnings) {
      this.addWarning(warning.line, warning.column, warning.message, warning.code, warning.suggestion);
    }
  }

  /**
   * Add multiple info messages
   */
  protected addInfoMessages(info: ValidationError[]): void {
    for (const infoMsg of info) {
      this.addInfo(infoMsg.line, infoMsg.column, infoMsg.message, infoMsg.code, infoMsg.suggestion);
    }
  }

  /**
   * Strip line comments while keeping strings intact
   */
  protected stripLineCommentsKeepingStrings(text: string): string {
    const KEEP_VERSION = /^\uFEFF?\s*\/\/\s*@version=\d+\s*$/;
    let out = '';
    let inStr: '"' | "'" | null = null;
    let esc = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const nxt = text[i + 1] || '';

      // Detect and handle '//' comments
      if (!inStr && ch === '/' && nxt === '/') {
        // Get the full current line
        let bol = i;
        while (bol > 0 && text[bol - 1] !== '\n') bol--;
        let eol = i;
        while (eol < text.length && text[eol] !== '\n') eol++;
        const line = text.slice(bol, eol);

        if (KEEP_VERSION.test(line)) {
          out += line;
          i = eol - 1;
          continue;
        }
        // Drop comment to EOL
        while (i < text.length && text[i] !== '\n') i++;
        out += '\n';
        continue;
      }

      if (inStr) {
        out += ch;
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === inStr) { inStr = null; }
        continue;
      }
      if (ch === '"' || ch === "'") { inStr = ch as '"' | "'"; out += ch; continue; }

      out += ch;
    }
    return out;
  }

  /**
   * Strip strings from a line
   */
  protected stripStrings(line: string): string {
    return line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => ' '.repeat(m.length));
  }

  /**
   * Get current scope
   */
  protected currentScope(): ScopeInfo {
    return this.scopeStack[this.scopeStack.length - 1];
  }

  /**
   * Apply custom rules
   */
  protected applyCustomRules(): void {
    for (const rule of (this.config.customRules || [])) {
      for (let i = 0; i < this.context.cleanLines.length; i++) {
        const line = this.context.cleanLines[i];
        const lineNum = i + 1;
        let match = false;
        if (rule.pattern instanceof RegExp) {
          match = rule.pattern.test(line);
        } else {
          match = rule.pattern(line, lineNum, this.context);
        }
        if (match) {
          this.addBySeverity(rule.severity, lineNum, 1, rule.message, rule.id, rule.suggestion);
        }
      }
    }
  }

  /**
   * Filter ignored codes
   */
  protected filterIgnoredCodes(): void {
    const ignore = new Set(this.config.ignoredCodes || []);
    const dedupe = <T extends ValidationError>(list: T[]) => {
      const seen = new Set<string>();
      const out: T[] = [];
      for (const item of list) {
        if (ignore.has(item.code || '')) continue;
        const key = `${item.severity}|${item.code || ''}|${item.line}|${item.column}|${item.message}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
      }
      return out;
    };
    this.errors = dedupe(this.errors);
    this.warnings = dedupe(this.warnings);
    this.info = dedupe(this.info);
  }
}
