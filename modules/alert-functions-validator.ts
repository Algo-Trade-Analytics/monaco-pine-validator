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
import { ValidationHelper } from '../core/validation-helper';
import {
  type ArgumentNode,
  type CallExpressionNode,
  type ExpressionNode,
  type MemberExpressionNode,
  type ProgramNode,
  type IdentifierNode,
  type BinaryExpressionNode,
} from '../core/ast/nodes';
import { findAncestor, type NodePath, visit } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';

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

  private helper = new ValidationHelper();
  private context!: ValidationContext;
  private astContext: AstValidationContext | null = null;

  // Alert function tracking
  private alertFunctionCalls: AlertFunctionCall[] = [];
  private alertConditions = 0;
  private alertFrequencyUsage: Map<string, number> = new Map();
  private recordedFrequencyKeys = new Set<string>();

  getDependencies(): string[] {
    return ['CoreValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();

    this.context = context;

    this.astContext = ensureAstContext(context, config);

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

    if (process.env.DEBUG_ALERT === '1') {
      // eslint-disable-next-line no-console
      console.log('[AlertFunctionsValidator] summary', {
        calls: this.alertFunctionCalls.length,
        usage: Object.fromEntries(this.alertFrequencyUsage),
        infoCount: this.helper.infoList.length,
        errorCount: this.helper.errorList.length,
      });
    }

    return this.helper.buildResult(context);
  }

  private reset(): void {
    this.helper.reset();
    this.alertFunctionCalls = [];
    this.alertConditions = 0;
    this.alertFrequencyUsage.clear();
    this.recordedFrequencyKeys.clear();
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
      Identifier: {
        enter: (path) => this.processIdentifier(path.node.name, path.node.loc?.start ?? null),
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
      this.helper.addError(alertCall.line, alertCall.column, 'alert() function requires at least a message parameter', 'PSV6-ALERT-NO-PARAMS');
      return;
    }

    const messageArg = call.args[0]?.value;
    if (messageArg?.kind === 'StringLiteral' && messageArg.value.length === 0) {
      const { line, column } = messageArg.loc.start;
      this.helper.addWarning(line, column, 'Alert message is empty. Consider providing a descriptive message', 'PSV6-ALERT-EMPTY-MESSAGE');
    }

    const freqArgument = this.findAstFrequencyArgument(call.args);
    if (!freqArgument) {
      return;
    }

    const frequencyPath = this.getAlertFrequencyPath(freqArgument.value);
    const { line, column } = freqArgument.value.loc.start;

    if (frequencyPath && VALID_ALERT_FREQUENCIES.has(frequencyPath)) {
      alertCall.frequency = frequencyPath;
      this.recordAlertFrequencyUsage(frequencyPath, line, column);
      this.helper.addInfo(line, column, `Alert frequency '${frequencyPath}' is properly configured`, 'PSV6-ALERT-FREQ-VALID');
    } else if (frequencyPath && frequencyPath.startsWith('alert.freq_')) {
      this.helper.addError(line, column, `Invalid alert frequency '${frequencyPath}'. Use alert.freq_all, alert.freq_once_per_bar, or alert.freq_once_per_bar_close`, 'PSV6-ALERT-FREQ-INVALID');
    }
  }

  private validateAstAlertConditionCall(call: CallExpressionNode): void {
    const conditionArg = call.args[0]?.value;
    if (conditionArg?.kind === 'BooleanLiteral') {
      const { line, column } = conditionArg.loc.start;
      this.helper.addWarning(line, column, 'Alert condition is very simple. Consider using more specific conditions', 'PSV6-ALERTCONDITION-SIMPLE');
    }

    const titleArg = call.args[1]?.value;
    if (titleArg?.kind === 'StringLiteral' && titleArg.value.length === 0) {
      const { line, column } = titleArg.loc.start;
      this.helper.addWarning(line, column, 'Alert condition has no title. Consider providing a descriptive title', 'PSV6-ALERTCONDITION-NO-TITLE');
    }

    if (conditionArg) {
      const resolved = this.resolveConditionType(conditionArg);
      if (!resolved || !resolved.type || resolved.type === 'unknown') {
        const { line, column } = conditionArg.loc?.start ?? call.loc.start;
        this.helper.addError(line, column, 'Unable to determine alert condition type. Expected a series bool expression.', 'PSV6-ALERT-CONDITION-TYPE');
      }
    }
  }

  private processAstMemberExpression(path: NodePath<MemberExpressionNode>): void {
    const qualified = this.getAlertFrequencyPath(path.node);
    if (!qualified || !ALERT_FREQUENCY_CONSTANTS.has(qualified)) {
      return;
    }
    const { line, column } = path.node.loc.start;
    this.recordAlertFrequencyUsage(qualified, line, column);
  }

  private validateAlertConditions(): void {
    if (this.alertConditions > 3) {
      this.helper.addWarning(1, 1, `Multiple alert conditions detected (${this.alertConditions}). Consider consolidating or documenting alert logic`, 'PSV6-ALERT-MANY-CONDITIONS');
    }

    if (this.alertConditions === 0 && this.alertFunctionCalls.length === 0 && this.context.scriptType === 'indicator') {
      this.helper.addInfo(1, 1, 'No alert conditions found. Consider adding alerts for important events', 'PSV6-ALERT-NO-CONDITIONS');
    }
  }

  private validateAlertUsagePatterns(): void {
    const freqAll = this.alertFrequencyUsage.get('alert.freq_all') || 0;
    const freqOncePerBar = this.alertFrequencyUsage.get('alert.freq_once_per_bar') || 0;
    const freqOncePerBarClose = this.alertFrequencyUsage.get('alert.freq_once_per_bar_close') || 0;

    if (freqAll > 0 && (freqOncePerBar > 0 || freqOncePerBarClose > 0)) {
      this.helper.addWarning(1, 1, 'Mixed alert frequencies detected. This may cause unexpected alert behavior', 'PSV6-ALERT-MIXED-FREQUENCIES');
    }

    if (freqAll > freqOncePerBarClose && freqOncePerBarClose === 0) {
      this.helper.addInfo(1, 1, 'Consider using alert.freq_once_per_bar_close for more reliable alerts', 'PSV6-ALERT-RECOMMEND-BAR-CLOSE');
    }
  }

  private validateAlertTimingAst(): void {
    for (const alertCall of this.alertFunctionCalls) {
      if (alertCall.inConditional) {
        this.helper.addInfo(alertCall.line, alertCall.column, 'Alert inside conditional statement. Ensure timing expectations are met', 'PSV6-ALERT-CONDITIONAL-TIMING');
      }

      if (alertCall.inLoop) {
        this.helper.addWarning(alertCall.line, alertCall.column, 'Alert inside loop detected. This may cause performance issues or excessive alerts', 'PSV6-ALERT-IN-LOOP');
      }
    }
  }

  private analyzeAlertPerformance(): void {
    const totalAlerts = this.alertFunctionCalls.length;

    if (totalAlerts > 5) {
      this.helper.addWarning(1, 1, `High number of alert calls (${totalAlerts}). Consider optimizing alert logic for better performance`, 'PSV6-ALERT-PERFORMANCE');
    }

    const freqAll = this.alertFrequencyUsage.get('alert.freq_all') || 0;
    if (freqAll >= 2) {
      this.helper.addWarning(1, 1, `Multiple alert.freq_all usage (${freqAll}) may cause alert spam. Consider using alert.freq_once_per_bar_close`, 'PSV6-ALERT-SPAM-RISK');
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

  private resolveConditionType(expression: ExpressionNode | null): { type: string | null; isSeries: boolean } | null {
    if (!expression) {
      return null;
    }

    if (expression.kind === 'Identifier') {
      const identifier = expression as IdentifierNode;
      const info = this.context.typeMap.get(identifier.name);
      if (info) {
        return { type: info.type ?? null, isSeries: info.isSeries ?? false };
      }
      return { type: null, isSeries: false };
    }

    if (expression.kind === 'BooleanLiteral') {
      return { type: 'bool', isSeries: false };
    }

    if (expression.kind === 'BinaryExpression') {
      const binary = expression as BinaryExpressionNode;
      if (['and', 'or', '==', '!=', '>', '<', '>=', '<='].includes(binary.operator)) {
        return { type: 'bool', isSeries: true };
      }
    }

    if (expression.kind === 'CallExpression') {
      return { type: 'bool', isSeries: true };
    }

    return { type: null, isSeries: false };
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

  private processIdentifier(name: string, loc: { line: number; column: number } | null): void {
    if (!loc) {
      return;
    }

    if (!name.startsWith('alert.freq_')) {
      return;
    }

    this.recordAlertFrequencyUsage(name, loc.line, loc.column);
  }

  private recordAlertFrequencyUsage(frequency: string, line: number, column: number): void {
    const key = `${frequency}:${line}:${column}`;
    if (this.recordedFrequencyKeys.has(key)) {
      return;
    }

    this.recordedFrequencyKeys.add(key);
    this.alertFrequencyUsage.set(frequency, (this.alertFrequencyUsage.get(frequency) || 0) + 1);
    this.helper.addInfo(line, column, `Alert frequency constant '${frequency}' detected`, 'PSV6-ALERT-FREQ-USAGE');
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
