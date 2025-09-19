/**
 * Alert Functions Validator for Pine Script v6
 * 
 * Validates alert functions and operations:
 * - alert.freq_all - Alert frequency for all occurrences
 * - alert.freq_once_per_bar - Alert frequency once per bar
 * - alert.freq_once_per_bar_close - Alert frequency once per bar close
 * - alert() function with frequency parameters
 * - alertcondition() with advanced options
 * - Alert timing and condition validation
 * 
 * Phase 3.2: Enhancement Opportunity - Alert Advanced Functions
 */

import { ValidationModule, ValidationContext, ValidatorConfig, ValidationError, ValidationResult } from '../core/types';
import { NS_MEMBERS, BUILTIN_FUNCTIONS_V6_RULES } from '../core/constants';

interface AlertFunctionCall {
  functionName: string;
  line: number;
  column: number;
  arguments: string[];
  frequency?: string;
}

const ALERT_FUNCTIONS = new Set([
  'alert', 'alertcondition'
]);

const ALERT_FREQUENCY_CONSTANTS = new Set([
  'alert.freq_all',
  'alert.freq_once_per_bar', 
  'alert.freq_once_per_bar_close'
]);

const VALID_ALERT_FREQUENCIES = new Set([
  'alert.freq_all',
  'alert.freq_once_per_bar',
  'alert.freq_once_per_bar_close'
]);

export class AlertFunctionsValidator implements ValidationModule {
  name = 'AlertFunctionsValidator';
  priority = 75; // Medium priority - alert functions are important for notifications

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  // Alert function tracking
  private alertFunctionCalls: AlertFunctionCall[] = [];
  private alertConditions = 0;
  private alertFrequencyUsage: Map<string, number> = new Map();

  getDependencies(): string[] {
    return ['CoreValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.context = context;
    this.config = config;
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.alertFunctionCalls = [];
    this.alertConditions = 0;
    this.alertFrequencyUsage.clear();

    // Validate alert functions and frequencies
    this.validateAlertFunctions();
    this.validateAlertFrequencies();
    this.validateAlertConditions();
    this.validateAlertUsagePatterns();
    this.validateAlertTiming();

    // Performance analysis
    this.analyzeAlertPerformance();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: this.context.scriptType
    };
  }

  private validateAlertFunctions(): void {
    for (let i = 0; i < this.context.lines.length; i++) {
      const line = this.context.lines[i];
      const cleanLine = this.context.cleanLines[i];

      // Find alert function calls
      this.findAlertFunctionCalls(cleanLine, i + 1);
    }
  }

  private findAlertFunctionCalls(line: string, lineNumber: number): void {
    // Match alert() and alertcondition() function calls
    const alertRegex = /\b(alert|alertcondition)\s*\(/g;
    let match;

    while ((match = alertRegex.exec(line)) !== null) {
      const functionName = match[1];
      const column = match.index + 1;

      // Extract function arguments
      const args = this.extractFunctionArguments(line, match.index + match[0].length - 1);
      
      const alertCall: AlertFunctionCall = {
        functionName,
        line: lineNumber,
        column,
        arguments: args
      };

      // Check for frequency parameter in alert() calls
      if (functionName === 'alert') {
        this.validateAlertFunction(alertCall);
      } else if (functionName === 'alertcondition') {
        this.validateAlertConditionFunction(alertCall);
      }

      this.alertFunctionCalls.push(alertCall);
    }
  }

  private validateAlertFunction(alertCall: AlertFunctionCall): void {
    const { arguments: args, line, column } = alertCall;

    // alert(message, freq) - validate frequency parameter
    if (args.length >= 2) {
      const freqArg = args[1].trim();
      
      if (VALID_ALERT_FREQUENCIES.has(freqArg)) {
        // Valid frequency constant
        this.alertFrequencyUsage.set(freqArg, (this.alertFrequencyUsage.get(freqArg) || 0) + 1);
        
        this.info.push({
          code: 'PSV6-ALERT-FREQ-VALID',
          message: `Alert frequency '${freqArg}' is properly configured`,
          line,
          column,
          severity: 'info'
        });
      } else if (freqArg && freqArg.startsWith('alert.freq_')) {
        // Invalid frequency parameter that looks like an alert frequency
        this.errors.push({
          code: 'PSV6-ALERT-FREQ-INVALID',
          message: `Invalid alert frequency '${freqArg}'. Use alert.freq_all, alert.freq_once_per_bar, or alert.freq_once_per_bar_close`,
          line,
          column,
          severity: 'error'
        });
      }
    }

    // Validate message parameter
    if (args.length >= 1) {
      const messageArg = args[0].trim();
      if (!messageArg || messageArg === '""' || messageArg === "''") {
        this.warnings.push({
          code: 'PSV6-ALERT-EMPTY-MESSAGE',
          message: 'Alert message is empty. Consider providing a descriptive message',
          line,
          column,
          severity: 'warning'
        });
      }
    }

    // Check for missing parameters
    if (args.length === 0) {
      this.errors.push({
        code: 'PSV6-ALERT-NO-PARAMS',
        message: 'alert() function requires at least a message parameter',
        line,
        column,
        severity: 'error'
      });
    }
  }

  private validateAlertConditionFunction(alertCall: AlertFunctionCall): void {
    const { arguments: args, line, column } = alertCall;

    // alertcondition(condition, title, message)
    if (args.length >= 1) {
      const conditionArg = args[0].trim();
      
      // Basic condition validation
      if (!conditionArg || conditionArg === 'true' || conditionArg === 'false') {
        this.warnings.push({
          code: 'PSV6-ALERTCONDITION-SIMPLE',
          message: 'Alert condition is very simple. Consider using more specific conditions',
          line,
          column,
          severity: 'warning'
        });
      }
    }

    // Check for title parameter
    if (args.length >= 2) {
      const titleArg = args[1].trim();
      if (!titleArg || titleArg === '""' || titleArg === "''") {
        this.warnings.push({
          code: 'PSV6-ALERTCONDITION-NO-TITLE',
          message: 'Alert condition has no title. Consider providing a descriptive title',
          line,
          column,
          severity: 'warning'
        });
      }
    }

    this.alertConditions++;
  }

  private validateAlertFrequencies(): void {
    for (let i = 0; i < this.context.lines.length; i++) {
      const line = this.context.lines[i];
      const cleanLine = this.context.cleanLines[i];

      // Find alert frequency constants usage
      for (const freq of Array.from(ALERT_FREQUENCY_CONSTANTS)) {
        if (cleanLine.includes(freq)) {
          this.alertFrequencyUsage.set(freq, (this.alertFrequencyUsage.get(freq) || 0) + 1);
          
          this.info.push({
            code: 'PSV6-ALERT-FREQ-USAGE',
            message: `Alert frequency constant '${freq}' detected`,
            line: i + 1,
            column: cleanLine.indexOf(freq) + 1,
            severity: 'info'
          });
        }
      }
    }
  }

  private validateAlertConditions(): void {
    // Check for multiple alert conditions
    if (this.alertConditions > 3) {
      this.warnings.push({
        code: 'PSV6-ALERT-MANY-CONDITIONS',
        message: `Multiple alert conditions detected (${this.alertConditions}). Consider consolidating or documenting alert logic`,
        line: 1,
        column: 1,
        severity: 'warning'
      });
    }

    // Check for no alert conditions in indicator scripts
    if (this.alertConditions === 0 && this.alertFunctionCalls.length === 0 && this.context.scriptType === 'indicator') {
      this.info.push({
        code: 'PSV6-ALERT-NO-CONDITIONS',
        message: 'No alert conditions found. Consider adding alerts for important events',
        line: 1,
        column: 1,
        severity: 'info'
      });
    }
  }

  private validateAlertUsagePatterns(): void {
    // Check for alert frequency patterns
    const freqAll = this.alertFrequencyUsage.get('alert.freq_all') || 0;
    const freqOncePerBar = this.alertFrequencyUsage.get('alert.freq_once_per_bar') || 0;
    const freqOncePerBarClose = this.alertFrequencyUsage.get('alert.freq_once_per_bar_close') || 0;

    if (freqAll > 0 && (freqOncePerBar > 0 || freqOncePerBarClose > 0)) {
      this.warnings.push({
        code: 'PSV6-ALERT-MIXED-FREQUENCIES',
        message: 'Mixed alert frequencies detected. This may cause unexpected alert behavior',
        line: 1,
        column: 1,
        severity: 'warning'
      });
    }

    // Recommend freq_once_per_bar_close for most use cases
    if (freqAll > freqOncePerBarClose && freqOncePerBarClose === 0) {
      this.info.push({
        code: 'PSV6-ALERT-RECOMMEND-BAR-CLOSE',
        message: 'Consider using alert.freq_once_per_bar_close for more reliable alerts',
        line: 1,
        column: 1,
        severity: 'info'
      });
    }
  }

  private validateAlertTiming(): void {
    // Check for alerts in conditional statements that might affect timing
    for (const alertCall of this.alertFunctionCalls) {
      const line = this.context.lines[alertCall.line - 1];
      
      // Check if alert is inside if statement
      if (line.trim().startsWith('if ') && line.includes('alert(')) {
        this.info.push({
          code: 'PSV6-ALERT-CONDITIONAL-TIMING',
          message: 'Alert inside conditional statement. Ensure timing expectations are met',
          line: alertCall.line,
          column: alertCall.column,
          severity: 'info'
        });
      }

      // Check for alerts in loops (potential performance issue)
      if (this.isInsideLoop(alertCall.line)) {
        this.warnings.push({
          code: 'PSV6-ALERT-IN-LOOP',
          message: 'Alert inside loop detected. This may cause performance issues or excessive alerts',
          line: alertCall.line,
          column: alertCall.column,
          severity: 'warning'
        });
      }
    }
  }

  private analyzeAlertPerformance(): void {
    const totalAlerts = this.alertFunctionCalls.length;
    
    if (totalAlerts > 5) {
      this.warnings.push({
        code: 'PSV6-ALERT-PERFORMANCE',
        message: `High number of alert calls (${totalAlerts}). Consider optimizing alert logic for better performance`,
        line: 1,
        column: 1,
        severity: 'warning'
      });
    }

    // Check for alert frequency that might cause spam
    const freqAll = this.alertFrequencyUsage.get('alert.freq_all') || 0;
    if (freqAll > 2) {
      this.warnings.push({
        code: 'PSV6-ALERT-SPAM-RISK',
        message: `Multiple alert.freq_all usage (${freqAll}) may cause alert spam. Consider using alert.freq_once_per_bar_close`,
        line: 1,
        column: 1,
        severity: 'warning'
      });
    }
  }

  private extractFunctionArguments(line: string, startPos: number): string[] {
    const args: string[] = [];
    let depth = 0;
    let currentArg = '';
    let inString = false;
    let stringChar = '';

    for (let i = startPos; i < line.length; i++) {
      const char = line[i];

      if (!inString) {
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
          currentArg += char;
        } else if (char === '(') {
          depth++;
          if (depth > 1) currentArg += char;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            if (currentArg.trim()) args.push(currentArg.trim());
            break;
          } else {
            currentArg += char;
          }
        } else if (char === ',' && depth === 1) {
          if (currentArg.trim()) args.push(currentArg.trim());
          currentArg = '';
        } else {
          currentArg += char;
        }
      } else {
        currentArg += char;
        if (char === stringChar && line[i - 1] !== '\\') {
          inString = false;
        }
      }
    }

    return args;
  }

  private isInsideLoop(lineNumber: number): boolean {
    // Simple check for loop context - could be enhanced
    const contextLines = 5;
    const startLine = Math.max(0, lineNumber - contextLines - 1);
    const endLine = Math.min(this.context.lines.length, lineNumber + contextLines);

    for (let i = startLine; i < endLine; i++) {
      const line = this.context.lines[i].trim();
      if (line.startsWith('for ') || line.startsWith('while ') || line.includes(' for ') || line.includes(' while ')) {
        return true;
      }
    }

    return false;
  }
}
