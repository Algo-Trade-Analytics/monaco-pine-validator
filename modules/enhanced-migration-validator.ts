/**
 * Enhanced Migration Validator Module
 *
 * Handles enhanced migration validation for Pine Script v6:
 * - PSV6-MIG-SYNTAX: Old syntax patterns
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidationError,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';
import { Codes } from '../core/codes';
import { ValidationHelper } from '../core/validation-helper';
import {
  type ArgumentNode,
  type AssignmentStatementNode,
  type CallExpressionNode,
  type ExpressionNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type ProgramNode,
  type VariableDeclarationNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';

const SECURITY_ALLOWED_PREFIXES = new Set([
  'request',
  'ta',
  'math',
  'str',
  'color',
  'input',
  'strategy',
  'runtime',
  'log',
  'alert',
  'barstate',
  'syminfo',
  'timeframe',
  'session',
]);

const TA_ALLOWED_PREFIXES = new Set([
  'ta',
  'math',
  'str',
  'array',
  'matrix',
  'map',
  'color',
  'request',
  'input',
  'strategy',
  'runtime',
  'log',
  'alert',
  'barstate',
  'syminfo',
  'timeframe',
  'session',
]);

const NON_NAMESPACED_TA_FUNCTIONS = new Set([
  'sma',
  'ema',
  'rsi',
  'macd',
  'stoch',
  'atr',
  'bb',
  'highest',
  'lowest',
  'crossover',
  'crossunder',
  'sar',
  'roc',
  'mom',
  'change',
  'correlation',
  'dev',
  'linreg',
  'percentile_linear_interpolation',
  'percentile_nearest_rank',
  'percentrank',
  'pivothigh',
  'pivotlow',
  'range',
  'stdev',
  'variance',
  'wma',
  'alma',
  'vwma',
  'swma',
  'rma',
  'hma',
  'tsi',
  'cci',
  'cmo',
  'mfi',
  'obv',
  'pvt',
  'nvi',
  'pvi',
  'wad',
]);

export class EnhancedMigrationValidator implements ValidationModule {
  name = 'EnhancedMigrationValidator';
  priority = 75; // Run after basic syntax validation

  private helper = new ValidationHelper();
  private astContext: AstValidationContext | null = null;

  getDependencies(): string[] {
    return ['CoreValidator', 'SyntaxValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.astContext = ensureAstContext(context, config);

    if (!this.astContext?.ast) {
      return this.helper.buildResult(context);
    }

    this.validateWithAst(this.astContext.ast);

    return this.helper.buildResult(context);
  }

  private reset(): void {
    this.helper.reset();
    this.astContext = null;
  }

  private validateWithAst(program: ProgramNode): void {
    visit(program, {
      CallExpression: {
        enter: (path: NodePath<CallExpressionNode>) => {
          this.validateAstCallExpression(path.node);
        },
      },
      AssignmentStatement: {
        enter: (path: NodePath<AssignmentStatementNode>) => {
          this.validateAstTranspAssignment(path.node);
        },
      },
      VariableDeclaration: {
        enter: (path: NodePath<VariableDeclarationNode>) => {
          this.validateAstTranspDeclaration(path.node);
        },
      },
    });
  }

  private validateAstCallExpression(call: CallExpressionNode): void {
    const functionName = this.getCallExpressionName(call.callee);
    if (!functionName) {
      return;
    }

    if (functionName === 'study') {
      this.reportStudyDeprecation(call.callee);
    }

    if (functionName === 'security') {
      this.validateAstSecurityCall(call);
    }

    if (NON_NAMESPACED_TA_FUNCTIONS.has(functionName)) {
      this.validateAstTaNamespace(call, functionName);
    }

    this.validateAstTranspArgument(call.args);
  }

  private validateAstSecurityCall(call: CallExpressionNode): void {
    const namespace = this.getCallNamespace(call.callee);
    if (namespace && SECURITY_ALLOWED_PREFIXES.has(namespace)) {
      return;
    }

    this.reportSecurityDeprecation(call.callee);
  }

  private validateAstTaNamespace(call: CallExpressionNode, functionName: string): void {
    const namespace = this.getCallNamespace(call.callee);
    if (namespace && TA_ALLOWED_PREFIXES.has(namespace)) {
      return;
    }

    this.reportTaNamespaceWarning(call.callee, functionName);
  }

  private validateAstTranspArgument(args: ArgumentNode[]): void {
    for (const argument of args) {
      if (argument.name?.name === 'transp') {
        const { line, column } = argument.name.loc.start;
        this.helper.addWarning(line, column, `'transp' parameter is deprecated in Pine Script v6. Use 'color.new()' instead.`, 'PSV6-MIG-SYNTAX', 'Replace transp=50 with color.new(color.red, 50)');
      }
    }
  }

  private validateAstTranspAssignment(node: AssignmentStatementNode): void {
    if (node.left.kind !== 'Identifier') {
      return;
    }

    const identifier = node.left as IdentifierNode;
    if (identifier.name !== 'transp') {
      return;
    }

    const { line, column } = identifier.loc.start;
    this.helper.addWarning(line, column, `'transp' parameter is deprecated in Pine Script v6. Use 'color.new()' instead.`, 'PSV6-MIG-SYNTAX', 'Replace transp=50 with color.new(color.red, 50)');
  }

  private validateAstTranspDeclaration(node: VariableDeclarationNode): void {
    if (node.identifier.name !== 'transp' || !node.initializer) {
      return;
    }

    const { line, column } = node.identifier.loc.start;
    this.helper.addWarning(line, column, `'transp' parameter is deprecated in Pine Script v6. Use 'color.new()' instead.`, 'PSV6-MIG-SYNTAX', 'Replace transp=50 with color.new(color.red, 50)');
  }

  private reportStudyDeprecation(callee: ExpressionNode): void {
    const { line, column } = this.getCallLocation(callee);
    this.helper.addWarning(line, column, `'study()' is deprecated in Pine Script v6. Use 'indicator()' instead.`, 'PSV6-MIG-SYNTAX', 'Replace study() with indicator()');
  }

  private reportSecurityDeprecation(callee: ExpressionNode): void {
    const { line, column } = this.getCallLocation(callee);
    this.helper.addWarning(line, column, `'security()' is deprecated in Pine Script v6. Use 'request.security()' instead.`, 'PSV6-MIG-SYNTAX', 'Replace security() with request.security()');
  }

  private reportTaNamespaceWarning(callee: ExpressionNode, functionName: string): void {
    const { line, column } = this.getCallLocation(callee);
    this.helper.addWarning(line, column, `'${functionName}()' should be namespaced in Pine Script v6. Use 'ta.${functionName}()' instead.`, 'PSV6-MIG-SYNTAX', `Replace ${functionName}() with ta.${functionName}()`);
  }

  private getCallExpressionName(callee: ExpressionNode): string | null {
    if (callee.kind === 'Identifier') {
      return (callee as IdentifierNode).name;
    }

    if (callee.kind === 'MemberExpression') {
      const member = callee as MemberExpressionNode;
      if (!member.computed) {
        return member.property.name;
      }
    }

    return null;
  }

  private getCallNamespace(callee: ExpressionNode): string | null {
    if (callee.kind !== 'MemberExpression') {
      return null;
    }

    const member = callee as MemberExpressionNode;
    return this.getRightmostIdentifier(member.object);
  }

  private getRightmostIdentifier(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }

    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (member.computed) {
        return null;
      }
      return member.property.name;
    }

    return null;
  }

  private getCallLocation(callee: ExpressionNode): { line: number; column: number } {
    if (callee.kind === 'MemberExpression') {
      const member = callee as MemberExpressionNode;
      return member.property.loc.start;
    }

    return callee.loc.start;
  }

}
