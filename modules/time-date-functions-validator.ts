/**
 * Time/Date Functions Validator for Pine Script v6
 * 
 * Validates time and date functions and operations:
 * - time_close() - Session close time calculations
 * - time_tradingday() - Trading day calculations  
 * - timestamp() - Advanced timestamp functions
 * - Built-in time variables (time, hour, minute, etc.)
 * - Time zone and session handling
 * - Time format validation
 * 
 * Phase 3.1: Enhancement Opportunity - Time/Date Functions
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidatorConfig,
  type ValidationError,
  type ValidationResult,
} from '../core/types';
import {
  type ArgumentNode,
  type BinaryExpressionNode,
  type CallExpressionNode,
  type ExpressionNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type NumberLiteralNode,
  type ProgramNode,
  type StringLiteralNode,
  type UnaryExpressionNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';

interface TimeFunctionCall {
  functionName: string;
  line: number;
  column: number;
  arguments: string[];
  inLoop?: boolean;
}

const TIME_DATE_FUNCTIONS = new Set(['time_close', 'time_tradingday', 'timestamp', 'timenow']);

const TIME_VARIABLE_NAMES = new Set([
  'time',
  'hour',
  'minute',
  'second',
  'year',
  'month',
  'dayofmonth',
  'dayofweek',
  'weekofyear',
]);

const VALID_SESSION_MEMBERS = new Set([
  'session.regular',
  'session.extended',
  'session.isfirstbar',
  'session.islastbar',
  'session.isfirstbar_regular',
  'session.islastbar_regular',
  'session.ismarket',
  'session.ispostmarket',
  'session.ispremarket',
]);

export class TimeDateFunctionsValidator implements ValidationModule {
  name = 'TimeDateFunctionsValidator';
  priority = 75; // Medium priority - time functions are important but not critical

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;
  private usingAst = false;
  private hasTimezoneReference = false;
  private timeComparisonEmissions: Set<string> = new Set();
  private timeArithmeticEmissions: Set<string> = new Set();

  // Time function tracking
  private timeFunctionCalls: TimeFunctionCall[] = [];
  private complexTimeExpressions = 0;

  getDependencies(): string[] {
    return ['CoreValidator', 'FunctionValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.astContext = this.getAstContext(config);
    this.usingAst = !!this.astContext?.ast;

    if (this.usingAst && this.astContext?.ast) {
      this.collectTimeDataFromAst(this.astContext.ast);
    } else {
      // Process each line for time/date function calls
      context.cleanLines.forEach((line, index) => {
        this.processLine(line, index + 1);
      });
    }

    // Perform post-validation checks
    this.validateTimePerformance();
    this.validateTimeBestPractices();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: null
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
    this.usingAst = false;
    this.hasTimezoneReference = false;
    this.timeComparisonEmissions.clear();
    this.timeArithmeticEmissions.clear();
    this.timeFunctionCalls = [];
    this.complexTimeExpressions = 0;
  }

  private collectTimeDataFromAst(program: ProgramNode): void {
    const loopStack: Array<'for' | 'while'> = [];

    visit(program, {
      ForStatement: {
        enter: () => {
          loopStack.push('for');
        },
        exit: () => {
          loopStack.pop();
        },
      },
      WhileStatement: {
        enter: () => {
          loopStack.push('while');
        },
        exit: () => {
          loopStack.pop();
        },
      },
      CallExpression: {
        enter: (path) => {
          this.processAstCall(path as NodePath<CallExpressionNode>, loopStack.length > 0);
        },
      },
      MemberExpression: {
        enter: (path) => {
          this.processAstMember(path as NodePath<MemberExpressionNode>);
        },
      },
      BinaryExpression: {
        enter: (path) => {
          this.processAstBinary(path.node as BinaryExpressionNode);
        },
      },
      StringLiteral: {
        enter: (path) => {
          this.processAstString(path.node as StringLiteralNode);
        },
      },
    });
  }

  private processAstCall(path: NodePath<CallExpressionNode>, inLoop: boolean): void {
    const node = path.node;
    const qualifiedName = this.getExpressionQualifiedName(node.callee);
    if (!qualifiedName || !TIME_DATE_FUNCTIONS.has(qualifiedName)) {
      return;
    }

    const args = node.args.map((argument) => this.argumentToString(argument));
    const line = node.loc.start.line;
    const column = node.loc.start.column;

    this.timeFunctionCalls.push({
      functionName: qualifiedName,
      arguments: args,
      line,
      column,
      inLoop,
    });

    this.validateTimeFunction(qualifiedName, args, line, column);
  }

  private processAstMember(path: NodePath<MemberExpressionNode>): void {
    const node = path.node;
    if (node.computed) {
      return;
    }

    const objectName = this.getExpressionQualifiedName(node.object);
    if (!objectName) {
      return;
    }

    const propertyName = node.property.name;
    const qualifiedName = `${objectName}.${propertyName}`;
    const line = node.loc.start.line;
    const column = node.loc.start.column;

    if (qualifiedName === 'syminfo.timezone') {
      this.hasTimezoneReference = true;
    }

    if (objectName === 'timezone') {
      this.addWarning(
        line,
        column,
        `Identifier '${qualifiedName}' is not a valid Pine Script timezone constant. Provide an explicit string (e.g., "UTC") or use syminfo.timezone.`,
        'PSV6-TIMEZONE-UNKNOWN',
      );
      return;
    }

    if (objectName === 'session' && !VALID_SESSION_MEMBERS.has(qualifiedName)) {
      this.addWarning(
        line,
        column,
        `Unknown session constant: ${qualifiedName}`,
        'PSV6-SESSION-UNKNOWN',
      );
    }
  }

  private processAstBinary(node: BinaryExpressionNode): void {
    const operator = node.operator;
    if (operator === '==' || operator === '!=') {
      const leftTime = this.getTimeVariableIdentifier(node.left);
      const rightTime = this.getTimeVariableIdentifier(node.right);
      if (leftTime && this.isNumericLiteral(node.right)) {
        this.emitTimeComparison(node, leftTime, node.right);
      } else if (rightTime && this.isNumericLiteral(node.left)) {
        this.emitTimeComparison(node, rightTime, node.left);
      }
    }

    if (operator === '+' || operator === '-') {
      const timeIdentifier = this.getTimeVariableIdentifier(node.left) ?? this.getTimeVariableIdentifier(node.right);
      if (timeIdentifier) {
        this.emitTimeArithmetic(node, timeIdentifier);
      }
    }
  }

  private processAstString(node: StringLiteralNode): void {
    const value = node.value ?? '';
    if (!value) {
      return;
    }

    if (/utc/i.test(value) || /^[A-Za-z_]+\/[A-Za-z_]+$/.test(value)) {
      this.hasTimezoneReference = true;
    }
  }

  private processLine(line: string, lineNumber: number): void {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('//')) {
      return;
    }

    this.validateTimeFunctionCalls(line, lineNumber);
    this.validateTimeVariables(line, lineNumber);
    this.validateTimeZones(line, lineNumber);
    this.validateSessionHandling(line, lineNumber);
  }

  private validateTimeFunctionCalls(line: string, lineNumber: number): void {
    // Match time function calls
    const timeFunctionRegex = /\b(time_close|time_tradingday|timestamp|timenow)\s*\(/g;
    let match;

    while ((match = timeFunctionRegex.exec(line)) !== null) {
      const functionName = match[1];
      
      // Extract parameters
      const paramMatch = this.extractFunctionParameters(line, match.index + functionName.length);
      const parameters = paramMatch ? this.splitTopLevelArgs(paramMatch) : [];
      
      // Track the function call
      this.timeFunctionCalls.push({
        functionName,
        line: lineNumber,
        column: match.index + 1,
        arguments: parameters
      });

      // Validate specific function
      this.validateTimeFunction(functionName, parameters, lineNumber, match.index + 1);
    }
  }

  private validateTimeFunction(functionName: string, args: string[], lineNum: number, column: number): void {
    switch (functionName) {
      case 'time_close':
        this.validateTimeClose(args, lineNum, column);
        break;
      case 'time_tradingday':
        this.validateTimeTradingday(args, lineNum, column);
        break;
      case 'timestamp':
        this.validateTimestamp(args, lineNum, column);
        break;
      case 'timenow':
        this.validateTimenow(args, lineNum, column);
        break;
    }
  }

  private validateTimeClose(args: string[], lineNum: number, column: number): void {
    if (args.length < 1 || !args[0].trim()) {
      this.addError(lineNum, column, 'time_close requires at least 1 parameter: timeframe', 'PSV6-TIME-CLOSE-PARAMS');
      return;
    }

    const timeframeParam = args[0].trim();
    if (!this.isValidTimeframeParameter(timeframeParam)) {
      this.addWarning(lineNum, column,
        `First parameter for time_close should be a timeframe (string or variable), got ${timeframeParam}`,
        'PSV6-TIME-CLOSE-TIMEFRAME');
    }

    let sessionParam: string | null = null;
    let timezoneParam: string | null = null;
    let barsBackParam: string | null = null;

    if (args.length >= 2) {
      const secondArg = args[1].trim();
      if (this.isTimezoneArgument(secondArg)) {
        timezoneParam = secondArg;
      } else {
        sessionParam = secondArg;
      }
    }

    if (args.length >= 3) {
      const thirdArg = args[2].trim();
      if (!timezoneParam && this.isTimezoneArgument(thirdArg)) {
        timezoneParam = thirdArg;
      } else if (!sessionParam) {
        sessionParam = thirdArg;
      } else {
        barsBackParam = thirdArg;
      }
    }

    if (args.length >= 4) {
      barsBackParam = args[3].trim();
    }

    if (sessionParam) {
      if (!this.isValidSessionParameter(sessionParam)) {
        this.addWarning(lineNum, column,
          `Invalid session parameter for time_close: ${sessionParam}. Use session.regular, session.extended, or a valid session string.`,
          'PSV6-TIME-CLOSE-SESSION');
      }
    }

    if (timezoneParam) {
      this.validateTimezoneParameter(timezoneParam, lineNum, column);
    }

    if (barsBackParam) {
      this.validateBarsBackParameter(barsBackParam, lineNum, column);
    }

    if (args.length > 4) {
      this.addWarning(lineNum, column,
        'time_close supports up to four parameters: timeframe, session, timezone, bars_back. Extra arguments will be ignored by Pine Script.',
        'PSV6-TIME-CLOSE-PARAMS-EXTRA');
    }

    this.addInfo(lineNum, column,
      'time_close calculates the bar close time for a given timeframe and session. Ensure timezone/bars_back are set when needed.',
      'PSV6-TIME-CLOSE-INFO');
  }

  private validateTimeTradingday(args: string[], lineNum: number, column: number): void {
    if (args.length < 1) {
      this.addError(lineNum, column, 'time_tradingday requires at least 1 parameter: time', 'PSV6-TIME-TRADINGDAY-PARAMS');
      return;
    }

    // Validate time parameter
    const timeParam = args[0].trim();
    if (!this.isValidTimeParameter(timeParam)) {
      this.addWarning(lineNum, column, 
        `Time parameter should be a time value or time variable: ${timeParam}`, 
        'PSV6-TIME-TRADINGDAY-TIME');
    }

    // Validate optional timezone parameter
    if (args.length >= 2) {
      this.validateTimezoneParameter(args[1], lineNum, column);
    }

    this.addInfo(lineNum, column, 'time_tradingday calculates trading day boundaries - useful for daily calculations', 'PSV6-TIME-TRADINGDAY-INFO');
  }

  private validateTimestamp(args: string[], lineNum: number, column: number): void {
    if (args.length < 6) {
      this.addError(lineNum, column, 'timestamp requires at least 6 parameters: year, month, day, hour, minute, second', 'PSV6-TIMESTAMP-PARAMS');
      return;
    }

    // Validate year parameter
    const yearParam = args[0].trim();
    const yearValue = parseInt(yearParam);
    if (!isNaN(yearValue) && (yearValue < 1970 || yearValue > 2100)) {
      this.addWarning(lineNum, column, 
        `Year value ${yearValue} is outside typical range (1970-2100)`, 
        'PSV6-TIMESTAMP-YEAR-RANGE');
    }

    // Validate month parameter
    const monthParam = args[1].trim();
    const monthValue = parseInt(monthParam);
    if (!isNaN(monthValue) && (monthValue < 1 || monthValue > 12)) {
      this.addError(lineNum, column, 
        `Month value must be between 1 and 12, got ${monthValue}`, 
        'PSV6-TIMESTAMP-MONTH-RANGE');
    }

    // Validate day parameter
    const dayParam = args[2].trim();
    const dayValue = parseInt(dayParam);
    if (!isNaN(dayValue) && (dayValue < 1 || dayValue > 31)) {
      this.addError(lineNum, column, 
        `Day value must be between 1 and 31, got ${dayValue}`, 
        'PSV6-TIMESTAMP-DAY-RANGE');
    }

    // Validate hour parameter
    const hourParam = args[3].trim();
    const hourValue = parseInt(hourParam);
    if (!isNaN(hourValue) && (hourValue < 0 || hourValue > 23)) {
      this.addError(lineNum, column, 
        `Hour value must be between 0 and 23, got ${hourValue}`, 
        'PSV6-TIMESTAMP-HOUR-RANGE');
    }

    // Validate minute parameter
    const minuteParam = args[4].trim();
    const minuteValue = parseInt(minuteParam);
    if (!isNaN(minuteValue) && (minuteValue < 0 || minuteValue > 59)) {
      this.addError(lineNum, column, 
        `Minute value must be between 0 and 59, got ${minuteValue}`, 
        'PSV6-TIMESTAMP-MINUTE-RANGE');
    }

    // Validate second parameter
    const secondParam = args[5].trim();
    const secondValue = parseInt(secondParam);
    if (!isNaN(secondValue) && (secondValue < 0 || secondValue > 59)) {
      this.addError(lineNum, column, 
        `Second value must be between 0 and 59, got ${secondValue}`, 
        'PSV6-TIMESTAMP-SECOND-RANGE');
    }

    // Validate optional timezone parameter
    if (args.length >= 7) {
      this.validateTimezoneParameter(args[6], lineNum, column);
    }

    this.addInfo(lineNum, column, 'timestamp creates specific time values - ensure parameters are valid date/time components', 'PSV6-TIMESTAMP-INFO');
  }

  private validateTimenow(args: string[], lineNum: number, column: number): void {
    if (args.length > 0) {
      this.addWarning(lineNum, column, 'timenow function takes no parameters', 'PSV6-TIMENOW-NO-PARAMS');
    }

    this.addInfo(lineNum, column, 'timenow returns current time - use for real-time calculations', 'PSV6-TIMENOW-INFO');
  }

  private validateTimeVariables(line: string, lineNumber: number): void {
    // Check for common time variable usage patterns
    const timeVariables = ['time', 'hour', 'minute', 'second', 'year', 'month', 'dayofmonth', 'dayofweek', 'weekofyear'];
    
    for (const timeVar of timeVariables) {
      if (line.includes(timeVar)) {
        // Check for common misuse patterns
        this.checkTimeVariableMisuse(line, lineNumber, timeVar);
      }
    }
  }

  private validateTimeZones(line: string, lineNumber: number): void {
    // Check for timezone usage
    const timezoneMatch = line.match(/timezone\.(\w+)/);
    if (timezoneMatch) {
      const timezone = `timezone.${timezoneMatch[1]}`;
      this.addWarning(lineNumber, 1,
        `Identifier '${timezone}' is not a valid Pine Script timezone constant. Provide an explicit string (e.g., "UTC") or use syminfo.timezone.`,
        'PSV6-TIMEZONE-UNKNOWN');
    }
  }

  private validateSessionHandling(line: string, lineNumber: number): void {
    // Check for session usage
    const sessionMatch = line.match(/session\.(\w+)/);
    if (sessionMatch) {
      const sessionConstant = `session.${sessionMatch[1]}`;
      if (!VALID_SESSION_MEMBERS.has(sessionConstant)) {
        this.addWarning(lineNumber, 1,
          `Unknown session constant: ${sessionConstant}`,
          'PSV6-SESSION-UNKNOWN');
      }
    }
  }

  private checkTimeVariableMisuse(line: string, lineNumber: number, timeVar: string): void {
    // Check for common time variable misuse patterns
    
    // Check for direct comparison with specific values (may be fragile)
    const directCompareMatch = line.match(new RegExp(`\\b${timeVar}\\s*[=!]=\\s*(\\d+)`));
    if (directCompareMatch) {
      const value = directCompareMatch[1];
      this.addWarning(lineNumber, 1, 
        `Direct comparison of ${timeVar} with ${value} may be fragile. Consider using time ranges or functions.`, 
        'PSV6-TIME-DIRECT-COMPARE');
    }

    // Check for time arithmetic without proper handling
    if (line.includes(`${timeVar} +`) || line.includes(`${timeVar} -`)) {
      this.addInfo(lineNumber, 1, 
        `Time arithmetic detected with ${timeVar}. Ensure proper time unit handling.`, 
        'PSV6-TIME-ARITHMETIC-INFO');
    }
  }

  private validateTimezoneParameter(timezoneParam: string, lineNum: number, column: number): void {
    const trimmed = timezoneParam.trim();
    
    if (!trimmed) {
      this.addError(lineNum, column, 'Timezone parameter cannot be empty', 'PSV6-TIMEZONE-EMPTY');
      return;
    }

    if (this.isStringLiteral(trimmed)) {
      // String literal timezone (custom timezone)
      const timezoneValue = trimmed.replace(/['"]/g, '');
      if (timezoneValue.length === 0) {
        this.addError(lineNum, column, 'Empty timezone string is not allowed', 'PSV6-TIMEZONE-EMPTY-STRING');
      } else if (['regular', 'extended'].includes(timezoneValue.toLowerCase())) {
        this.addWarning(lineNum, column,
          `String '${timezoneValue}' looks like a session name. Use session.* constants for sessions.`,
          'PSV6-TIMEZONE-SESSION-MISUSE');
      } else {
        this.addInfo(lineNum, column, 
          `Custom timezone specified: ${timezoneValue}. Ensure it's a valid timezone identifier.`, 
          'PSV6-TIMEZONE-CUSTOM');
      }
      return;
    }

    if (trimmed === 'syminfo.timezone') {
      return;
    }

    if (trimmed.startsWith('timezone.')) {
      this.addWarning(lineNum, column,
        `Identifier '${trimmed}' is not a valid Pine Script timezone constant. Provide a string like "UTC" or use syminfo.timezone.`,
        'PSV6-TIMEZONE-INVALID');
      return;
    }

    if (!this.isVariableReference(trimmed)) {
      this.addWarning(lineNum, column,
        `Timezone argument '${trimmed}' should be a string literal, syminfo.timezone, or a variable containing a timezone string.`,
        'PSV6-TIMEZONE-UNKNOWN');
    }
  }

  private isValidSessionParameter(sessionParam: string): boolean {
    const trimmed = sessionParam.trim();
    
    // Check for session constants
    const validSessions = ['session.regular', 'session.extended'];
    if (validSessions.includes(trimmed)) return true;
    
    // Check for string literals (validate content)
    if (this.isStringLiteral(trimmed)) {
      const stringValue = trimmed.replace(/['"]/g, '');
      // For string literals, check if they are valid session names
      const validSessionStrings = ['regular', 'extended'];
      return validSessionStrings.includes(stringValue.toLowerCase()) || this.looksLikeSessionPattern(stringValue);
    }

    // Check for variable references
    if (this.isVariableReference(trimmed)) return true;

    return false;
  }

  private isValidTimeframeParameter(timeframeParam: string): boolean {
    const trimmed = timeframeParam.trim();
    if (!trimmed) return false;

    if (this.isStringLiteral(trimmed)) {
      return true;
    }

    if (trimmed === 'timeframe.period') return true;
    if (trimmed.startsWith('timeframe.')) return true;
    if (trimmed.startsWith('input.timeframe')) return true;

    if (this.isVariableReference(trimmed)) return true;

    return false;
  }

  private isTimezoneArgument(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;

    if (this.isStringLiteral(trimmed)) {
      const timezoneValue = trimmed.slice(1, -1);
      if (!timezoneValue) return false;
      if (['regular', 'extended'].includes(timezoneValue.toLowerCase())) {
        return false;
      }
      return timezoneValue.includes('/') || timezoneValue.includes('-') || timezoneValue.toUpperCase().includes('UTC');
    }

    if (trimmed === 'syminfo.timezone') return true;
    if (trimmed.startsWith('timezone.')) return true;
    if (this.isVariableReference(trimmed) && trimmed.toLowerCase().includes('timezone')) return true;

    return false;
  }

  private validateBarsBackParameter(param: string, lineNum: number, column: number): void {
    const trimmed = param.trim();

    if (!trimmed) {
      this.addWarning(lineNum, column, 'bars_back parameter should not be empty', 'PSV6-TIME-CLOSE-BARS-BACK');
      return;
    }

    const numericValue = parseInt(trimmed, 10);
    if (!isNaN(numericValue)) {
      if (numericValue < 0) {
        this.addWarning(lineNum, column, 'bars_back should be zero or positive for time_close.', 'PSV6-TIME-CLOSE-BARS-BACK');
      }
      return;
    }

    if (!this.isVariableReference(trimmed)) {
      this.addWarning(lineNum, column,
        `bars_back parameter should be an integer or series int reference, got ${trimmed}.`,
        'PSV6-TIME-CLOSE-BARS-BACK');
    }
  }

  private looksLikeSessionPattern(value: string): boolean {
    // Session strings can be like "0930-1600" or comma separated ranges
    return /^\d{3,4}-\d{3,4}(?:,\d{3,4}-\d{3,4})*$/.test(value);
  }

  private isValidTimeParameter(timeParam: string): boolean {
    const trimmed = timeParam.trim();
    
    // Check for time variables
    const timeVariables = ['time', 'timenow', 'last_bar_time'];
    if (timeVariables.includes(trimmed)) return true;
    
    // Check for timestamp function calls
    if (trimmed.includes('timestamp(')) return true;
    
    // Check for time arithmetic
    if (trimmed.includes('time') && (trimmed.includes('+') || trimmed.includes('-'))) return true;
    
    // Check for variable references
    if (this.isVariableReference(trimmed)) return true;
    
    return false;
  }

  private validateTimePerformance(): void {
    // Check for too many time function calls
    if (this.timeFunctionCalls.length > 10) {
      this.addWarning(
        1,
        1,
        `High number of time function calls (${this.timeFunctionCalls.length}). Consider caching results.`,
        'PSV6-TIME-PERF-MANY-CALLS'
      );
    }

    // Check for complex time expressions
    if (this.complexTimeExpressions > 5) {
      this.addWarning(
        1,
        1,
        `Many complex time expressions (${this.complexTimeExpressions}). Consider simplifying for better performance.`,
        'PSV6-TIME-PERF-COMPLEX'
      );
    }

    // Check for time functions in loops
    this.checkTimeFunctionsInLoops();
  }

  private validateTimeBestPractices(): void {
    // Check for good time handling patterns
    const hasTimeClose = this.timeFunctionCalls.some(call => call.functionName === 'time_close');
    const hasTimeTradingday = this.timeFunctionCalls.some(call => call.functionName === 'time_tradingday');
    const hasTimestamp = this.timeFunctionCalls.some(call => call.functionName === 'timestamp');

    if (hasTimeClose && hasTimeTradingday) {
      this.addInfo(
        1,
        1,
        'Good time handling pattern - using both session close and trading day functions.',
        'PSV6-TIME-BEST-PRACTICE'
      );
    }

    if (hasTimestamp) {
      this.addInfo(
        1,
        1,
        'Using timestamp function for specific time calculations - ensure timezone handling is correct.',
        'PSV6-TIMESTAMP-BEST-PRACTICE'
      );
    }

    // Check for timezone awareness
    const hasTimezone = this.usingAst
      ? this.hasTimezoneReference
      : this.context.cleanLines.some(line =>
          line.includes('syminfo.timezone') || /['"]UTC['"]/i.test(line) || /['"][A-Za-z_]+\/[A-Za-z_]+['"]/i.test(line)
        );
    if ((hasTimeClose || hasTimeTradingday || hasTimestamp) && !hasTimezone) {
      this.addInfo(
        1,
        1,
        'Consider specifying timezone for time calculations to ensure consistent behavior across markets.',
        'PSV6-TIMEZONE-SUGGESTION'
      );
    }
  }

  private checkTimeFunctionsInLoops(): void {
    // Check if time functions are called inside loops (performance concern)
    for (const timeCall of this.timeFunctionCalls) {
      if (this.usingAst) {
        if (timeCall.inLoop) {
          this.addWarning(
            timeCall.line,
            timeCall.column,
            `Time function ${timeCall.functionName} inside loop may impact performance`,
            'PSV6-TIME-PERF-LOOP'
          );
        }
        continue;
      }

      if (this.isInLoop(timeCall.line)) {
        this.addWarning(
          timeCall.line,
          timeCall.column,
          `Time function ${timeCall.functionName} inside loop may impact performance`,
          'PSV6-TIME-PERF-LOOP'
        );
      }
    }
  }

  private isInLoop(lineIndex: number): boolean {
    // Look back a few lines for a for/while with greater indentation
    for (let i = lineIndex - 1; i >= 0 && i >= lineIndex - 6; i--) {
      const ln = this.context.cleanLines[i - 1] || '';
      if (/^\s*(for|while)\b/.test(ln)) return true;
    }
    return false;
  }

  private emitTimeComparison(node: BinaryExpressionNode, identifier: string, compared: ExpressionNode): void {
    const loc = node.loc?.start;
    if (!loc) {
      return;
    }
    const key = `${loc.line}:${loc.column}:compare:${identifier}`;
    if (this.timeComparisonEmissions.has(key)) {
      return;
    }
    this.timeComparisonEmissions.add(key);

    const comparedText = this.getNodeSource(compared).trim() || 'value';
    this.addWarning(
      loc.line,
      loc.column,
      `Direct comparison of ${identifier} with ${comparedText} may be fragile. Consider using time ranges or functions.`,
      'PSV6-TIME-DIRECT-COMPARE',
    );
  }

  private emitTimeArithmetic(node: BinaryExpressionNode, identifier: string): void {
    const loc = node.loc?.start;
    if (!loc) {
      return;
    }
    const key = `${loc.line}:${loc.column}:arith:${identifier}`;
    if (this.timeArithmeticEmissions.has(key)) {
      return;
    }
    this.timeArithmeticEmissions.add(key);

    this.addInfo(
      loc.line,
      loc.column,
      `Time arithmetic detected with ${identifier}. Ensure proper time unit handling.`,
      'PSV6-TIME-ARITHMETIC-INFO',
    );
  }

  private getTimeVariableIdentifier(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      const identifier = expression as IdentifierNode;
      if (TIME_VARIABLE_NAMES.has(identifier.name)) {
        return identifier.name;
      }
    }
    return null;
  }

  private isNumericLiteral(expression: ExpressionNode): expression is NumberLiteralNode {
    if (expression.kind === 'NumberLiteral') {
      return true;
    }
    if (expression.kind === 'UnaryExpression') {
      const unary = expression as UnaryExpressionNode;
      return unary.argument?.kind === 'NumberLiteral';
    }
    return false;
  }

  private extractFunctionParameters(line: string, startIndex: number): string | null {
    let parenCount = 0;
    let start = startIndex;
    let end = startIndex;
    
    // Find the opening parenthesis
    while (start < line.length && line[start] !== '(') {
      start++;
    }
    
    if (start >= line.length) return null;
    
    start++; // Skip the opening parenthesis
    end = start;
    
    // Find the matching closing parenthesis
    while (end < line.length) {
      if (line[end] === '(') {
        parenCount++;
      } else if (line[end] === ')') {
        if (parenCount === 0) {
          break;
        }
        parenCount--;
      }
      end++;
    }
    
    if (end >= line.length) return null;
    
    return line.substring(start, end).trim();
  }

  private splitTopLevelArgs(argsStr: string): string[] {
    if (!argsStr.trim()) return [];
    const args: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < argsStr.length; i++) {
      const ch = argsStr[i];
      if (!inString && (ch === '"' || ch === "'")) { 
        inString = true; 
        stringChar = ch; 
        current += ch; 
        continue; 
      }
      if (inString) { 
        current += ch; 
        if (ch === stringChar) { 
          inString = false; 
          stringChar = ''; 
        } 
        continue; 
      }
      if (ch === '(') { depth++; current += ch; continue; }
      if (ch === ')') { depth--; current += ch; continue; }
      if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    
    if (current.trim()) args.push(current.trim());
    return args;
  }

  private argumentToString(argument: ArgumentNode): string {
    const valueText = this.getNodeSource(argument.value).trim();
    if (argument.name) {
      return `${argument.name.name}=${valueText}`;
    }
    return valueText;
  }

  private getNodeSource(node: ExpressionNode | ArgumentNode): string {
    const lines = this.context.lines ?? [];
    if (!node.loc) {
      return '';
    }
    const startLineIndex = Math.max(0, node.loc.start.line - 1);
    const endLineIndex = Math.max(0, node.loc.end.line - 1);
    if (startLineIndex === endLineIndex) {
      const line = lines[startLineIndex] ?? '';
      return line.slice(node.loc.start.column - 1, Math.max(node.loc.start.column - 1, node.loc.end.column - 1));
    }

    const parts: string[] = [];
    const firstLine = lines[startLineIndex] ?? '';
    parts.push(firstLine.slice(node.loc.start.column - 1));
    for (let index = startLineIndex + 1; index < endLineIndex; index++) {
      parts.push(lines[index] ?? '');
    }
    const lastLine = lines[endLineIndex] ?? '';
    parts.push(lastLine.slice(0, Math.max(0, node.loc.end.column - 1)));
    return parts.join('\n');
  }

  private getExpressionQualifiedName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }
    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (member.computed) {
        return null;
      }
      const objectName = this.getExpressionQualifiedName(member.object);
      if (!objectName) {
        return null;
      }
      return `${objectName}.${member.property.name}`;
    }
    return null;
  }

  private isStringLiteral(value: string): boolean {
    const trimmed = value.trim();
    return (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
           (trimmed.startsWith("'") && trimmed.endsWith("'"));
  }

  private isVariableReference(value: string): boolean {
    const trimmed = value.trim();
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed);
  }

  private addError(line: number, column: number, message: string, code: string): void {
    this.errors.push({
      line,
      column,
      message,
      code,
      severity: 'error'
    });
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({
      line,
      column,
      message,
      code,
      severity: 'warning'
    });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({
      line,
      column,
      message,
      code,
      severity: 'info'
    });
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    return isAstValidationContext(this.context) ? (this.context as AstValidationContext) : null;
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
