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
  type CallExpressionNode,
  type ExpressionNode,
  type MemberExpressionNode,
  type ProgramNode,
} from '../core/ast/nodes';
import { findAncestor, type NodePath, visit } from '../core/ast/traversal';

interface AlertFunctionCall {
  functionName: string;
  line: number;
  column: number;
  arguments: string[];
  frequency?: string;
  inConditional?: boolean;
  inLoop?: boolean;
}

const ALERT_FUNCTIONS = new Set(['alert', 'alertcondition']);

const ALERT_FREQUENCY_CONSTANTS = new Set([
  'alert.freq_all',
  'alert.freq_once_per_bar',
  'alert.freq_once_per_bar_close',
]);

const VALID_ALERT_FREQUENCIES = new Set([
  'alert.freq_all',
  'alert.freq_once_per_bar',
  'alert.freq_once_per_bar_close',
]);

export class AlertFunctionsValidator implements ValidationModule {
  name = 'AlertFunctionsValidator';
  priority = 75; // Medium priority - alert functions are important for notifications

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private astContext: AstValidationContext | null = null;

  // Alert function tracking
  private alertFunctionCalls: AlertFunctionCall[] = [];
  private alertConditions = 0;
  private alertFrequencyUsage: Map<string, number> = new Map();

  getDependencies(): string[] {
    return ['CoreValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.context = context;
    this.reset();

    if (!config.ast || config.ast.mode === 'disabled') {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: null,
      };
    }

    this.astContext = isAstValidationContext(context) && context.ast ? context : null;

    if (!this.astContext?.ast) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: null,
      };
    }

    this.collectAlertDataFromAst(this.astContext.ast);
    this.validateAlertConditions();
    this.validateAlertUsagePatterns();
    this.validateAlertTimingAst();
    this.analyzeAlertPerformance();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: null,
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.alertFunctionCalls = [];
    this.alertConditions = 0;
    this.alertFrequencyUsage.clear();
    this.astContext = null;
  }

  private collectAlertDataFromAst(program: ProgramNode): void {
    visit(program, {
      CallExpression: {
        enter: (path) => this.processAstAlertCall(path as NodePath<CallExpressionNode>),
      },
      MemberExpression: {
        enter: (path) => this.processAstMemberExpression(path as NodePath<MemberExpressionNode>),
      },
    });
  }

  private processAstAlertCall(path: NodePath<CallExpressionNode>): void {
    const call = path.node;
    const calleePath = this.resolveExpressionPath(call.callee);
    if (!calleePath || calleePath.length !== 1) {
      return;
    }

    const callee = calleePath[0];
    if (!ALERT_FUNCTIONS.has(callee)) {
      return;
    }

    const { line, column } = call.loc.start;
    const alertCall: AlertFunctionCall = {
      functionName: callee,
      line,
      column,
      arguments: call.args.map((argument) => this.formatExpression(argument.value)),
      inConditional: !!findAncestor(path, (ancestor) => ancestor.node.kind === 'IfStatement'),
      inLoop: !!findAncestor(path, (ancestor) =>
        ancestor.node.kind === 'ForStatement' ||
        ancestor.node.kind === 'WhileStatement' ||
        ancestor.node.kind === 'RepeatStatement'),
    };

    if (callee === 'alert') {
      this.validateAstAlertCall(call, alertCall);
    } else {
      this.validateAstAlertConditionCall(call);
      this.alertConditions++;
    }

    this.alertFunctionCalls.push(alertCall);
  }

  private validateAstAlertCall(call: CallExpressionNode, alertCall: AlertFunctionCall): void {
    if (call.args.length === 0) {
      this.errors.push({
        code: 'PSV6-ALERT-NO-PARAMS',
        message: 'alert() function requires at least a message parameter',
        line: alertCall.line,
        column: alertCall.column,
        severity: 'error',
      });
      return;
    }

    const messageArg = call.args[0]?.value;
    if (messageArg?.kind === 'StringLiteral' && messageArg.value.length === 0) {
      const { line, column } = messageArg.loc.start;
      this.warnings.push({
        code: 'PSV6-ALERT-EMPTY-MESSAGE',
        message: 'Alert message is empty. Consider providing a descriptive message',
        line,
        column,
        severity: 'warning',
      });
    }

    const freqArgument = this.findAstFrequencyArgument(call.args);
    if (!freqArgument) {
      return;
    }

    const frequencyPath = this.getAlertFrequencyPath(freqArgument.value);
    const { line, column } = freqArgument.value.loc.start;

    if (frequencyPath && VALID_ALERT_FREQUENCIES.has(frequencyPath)) {
      alertCall.frequency = frequencyPath;
      this.alertFrequencyUsage.set(
        frequencyPath,
        (this.alertFrequencyUsage.get(frequencyPath) || 0) + 1,
      );
      this.info.push({
        code: 'PSV6-ALERT-FREQ-VALID',
        message: `Alert frequency '${frequencyPath}' is properly configured`,
        line,
        column,
        severity: 'info',
      });
    } else if (frequencyPath && frequencyPath.startsWith('alert.freq_')) {
      this.errors.push({
        code: 'PSV6-ALERT-FREQ-INVALID',
        message:
          `Invalid alert frequency '${frequencyPath}'. Use alert.freq_all, alert.freq_once_per_bar, or alert.freq_once_per_bar_close`,
        line,
        column,
        severity: 'error',
      });
    }
  }

  private validateAstAlertConditionCall(call: CallExpressionNode): void {
    const conditionArg = call.args[0]?.value;
    if (conditionArg?.kind === 'BooleanLiteral') {
      const { line, column } = conditionArg.loc.start;
      this.warnings.push({
        code: 'PSV6-ALERTCONDITION-SIMPLE',
        message: 'Alert condition is very simple. Consider using more specific conditions',
        line,
        column,
        severity: 'warning',
      });
    }

    const titleArg = call.args[1]?.value;
    if (titleArg?.kind === 'StringLiteral' && titleArg.value.length === 0) {
      const { line, column } = titleArg.loc.start;
      this.warnings.push({
        code: 'PSV6-ALERTCONDITION-NO-TITLE',
        message: 'Alert condition has no title. Consider providing a descriptive title',
        line,
        column,
        severity: 'warning',
      });
    }
  }

  private processAstMemberExpression(path: NodePath<MemberExpressionNode>): void {
    const qualified = this.getAlertFrequencyPath(path.node);
    if (!qualified || !ALERT_FREQUENCY_CONSTANTS.has(qualified)) {
      return;
    }

    const { line, column } = path.node.loc.start;
    this.alertFrequencyUsage.set(qualified, (this.alertFrequencyUsage.get(qualified) || 0) + 1);
    this.info.push({
      code: 'PSV6-ALERT-FREQ-USAGE',
      message: `Alert frequency constant '${qualified}' detected`,
      line,
      column,
      severity: 'info',
    });
  }

  private validateAlertConditions(): void {
    if (this.alertConditions > 3) {
      this.warnings.push({
        code: 'PSV6-ALERT-MANY-CONDITIONS',
        message: `Multiple alert conditions detected (${this.alertConditions}). Consider consolidating or documenting alert logic`,
        line: 1,
        column: 1,
        severity: 'warning',
      });
    }

    if (this.alertConditions === 0 && this.alertFunctionCalls.length === 0 && this.context.scriptType === 'indicator') {
      this.info.push({
        code: 'PSV6-ALERT-NO-CONDITIONS',
        message: 'No alert conditions found. Consider adding alerts for important events',
        line: 1,
        column: 1,
        severity: 'info',
      });
    }
  }

  private validateAlertUsagePatterns(): void {
    const freqAll = this.alertFrequencyUsage.get('alert.freq_all') || 0;
    const freqOncePerBar = this.alertFrequencyUsage.get('alert.freq_once_per_bar') || 0;
    const freqOncePerBarClose = this.alertFrequencyUsage.get('alert.freq_once_per_bar_close') || 0;

    if (freqAll > 0 && (freqOncePerBar > 0 || freqOncePerBarClose > 0)) {
      this.warnings.push({
        code: 'PSV6-ALERT-MIXED-FREQUENCIES',
        message: 'Mixed alert frequencies detected. This may cause unexpected alert behavior',
        line: 1,
        column: 1,
        severity: 'warning',
      });
    }

    if (freqAll > freqOncePerBarClose && freqOncePerBarClose === 0) {
      this.info.push({
        code: 'PSV6-ALERT-RECOMMEND-BAR-CLOSE',
        message: 'Consider using alert.freq_once_per_bar_close for more reliable alerts',
        line: 1,
        column: 1,
        severity: 'info',
      });
    }
  }

  private validateAlertTimingAst(): void {
    for (const alertCall of this.alertFunctionCalls) {
      if (alertCall.inConditional) {
        this.info.push({
          code: 'PSV6-ALERT-CONDITIONAL-TIMING',
          message: 'Alert inside conditional statement. Ensure timing expectations are met',
          line: alertCall.line,
          column: alertCall.column,
          severity: 'info',
        });
      }

      if (alertCall.inLoop) {
        this.warnings.push({
          code: 'PSV6-ALERT-IN-LOOP',
          message: 'Alert inside loop detected. This may cause performance issues or excessive alerts',
          line: alertCall.line,
          column: alertCall.column,
          severity: 'warning',
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
        severity: 'warning',
      });
    }

    const freqAll = this.alertFrequencyUsage.get('alert.freq_all') || 0;
    if (freqAll > 2) {
      this.warnings.push({
        code: 'PSV6-ALERT-SPAM-RISK',
        message: `Multiple alert.freq_all usage (${freqAll}) may cause alert spam. Consider using alert.freq_once_per_bar_close`,
        line: 1,
        column: 1,
        severity: 'warning',
      });
    }
  }

  private findAstFrequencyArgument(args: ArgumentNode[]): ArgumentNode | null {
    for (const argument of args) {
      if (argument.name?.name === 'freq') {
        return argument;
      }
    }

    if (args.length >= 2 && !args[1].name) {
      return args[1];
    }

    return null;
  }

  private resolveExpressionPath(expression: ExpressionNode): string[] | null {
    if (expression.kind === 'Identifier') {
      return [expression.name];
    }

    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (member.computed) {
        return null;
      }
      const objectPath = this.resolveExpressionPath(member.object);
      if (!objectPath) {
        return null;
      }
      return [...objectPath, member.property.name];
    }

    return null;
  }

  private getAlertFrequencyPath(expression: ExpressionNode): string | null {
    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (member.computed) {
        return null;
      }
      const objectPath = this.resolveExpressionPath(member.object);
      if (!objectPath || objectPath[0] !== 'alert') {
        return null;
      }
      return `alert.${member.property.name}`;
    }

    if (expression.kind === 'Identifier' && expression.name.startsWith('alert.freq_')) {
      return expression.name;
    }

    return null;
  }

  private formatExpression(expression: ExpressionNode): string {
    switch (expression.kind) {
      case 'StringLiteral':
        return expression.raw ?? `"${expression.value}"`;
      case 'NumberLiteral':
        return expression.raw;
      case 'BooleanLiteral':
        return expression.value ? 'true' : 'false';
      case 'Identifier':
        return expression.name;
      case 'MemberExpression': {
        const path = this.resolveExpressionPath(expression);
        return path ? path.join('.') : 'member';
      }
      case 'CallExpression': {
        const path = this.resolveExpressionPath(expression.callee);
        const callee = path ? path.join('.') : 'call';
        const args = expression.args.map((arg) => this.formatExpression(arg.value)).join(', ');
        return `${callee}(${args})`;
      }
      default:
        return expression.kind;
    }
  }

}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
