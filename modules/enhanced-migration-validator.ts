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

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}

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

  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private astContext: AstValidationContext | null = null;

  getDependencies(): string[] {
    return ['CoreValidator', 'SyntaxValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.astContext = this.getAstContext();

    if (this.astContext?.ast) {
      this.validateWithAst(this.astContext.ast);
    } else {
      this.validateLegacy();
    }

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
    this.astContext = null;
  }

  private getAstContext(): AstValidationContext | null {
    if (!this.config.ast || this.config.ast.mode === 'disabled') {
      return null;
    }

    return isAstValidationContext(this.context) ? (this.context as AstValidationContext) : null;
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
        this.addWarning(line, column, `'transp' parameter is deprecated in Pine Script v6. Use 'color.new()' instead.`, 'PSV6-MIG-SYNTAX', 'Replace transp=50 with color.new(color.red, 50)');
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
    this.addWarning(line, column, `'transp' parameter is deprecated in Pine Script v6. Use 'color.new()' instead.`, 'PSV6-MIG-SYNTAX', 'Replace transp=50 with color.new(color.red, 50)');
  }

  private validateAstTranspDeclaration(node: VariableDeclarationNode): void {
    if (node.identifier.name !== 'transp' || !node.initializer) {
      return;
    }

    const { line, column } = node.identifier.loc.start;
    this.addWarning(line, column, `'transp' parameter is deprecated in Pine Script v6. Use 'color.new()' instead.`, 'PSV6-MIG-SYNTAX', 'Replace transp=50 with color.new(color.red, 50)');
  }

  private validateLegacy(): void {
    for (let i = 0; i < this.context.lines.length; i++) {
      const line = this.context.lines[i];
      const lineNum = i + 1;
      this.validateOldSyntaxPatterns(line, lineNum);
    }
  }

  private validateOldSyntaxPatterns(line: string, lineNum: number): void {
    if (/\bstudy\s*\(/.test(line)) {
      this.addWarning(lineNum, 1, `'study()' is deprecated in Pine Script v6. Use 'indicator()' instead.`, 'PSV6-MIG-SYNTAX', 'Replace study() with indicator()');
    }

    if (/\btransp\s*=/.test(line)) {
      this.addWarning(lineNum, 1, `'transp' parameter is deprecated in Pine Script v6. Use 'color.new()' instead.`, 'PSV6-MIG-SYNTAX', 'Replace transp=50 with color.new(color.red, 50)');
    }

    const securityRegex = /\bsecurity\s*\(/g;
    let securityMatch: RegExpExecArray | null;
    while ((securityMatch = securityRegex.exec(line)) !== null) {
      const beforeMatch = line.substring(0, securityMatch.index);
      const lastWord = beforeMatch.match(/\b(\w+)\s*\.?\s*$/);

      if (lastWord && SECURITY_ALLOWED_PREFIXES.has(lastWord[1])) {
        continue;
      }

      this.addWarning(
        lineNum,
        securityMatch.index + 1,
        `'security()' is deprecated in Pine Script v6. Use 'request.security()' instead.`,
        'PSV6-MIG-SYNTAX',
        'Replace security() with request.security()',
      );
    }

    for (const func of NON_NAMESPACED_TA_FUNCTIONS) {
      const regex = new RegExp(`\\b${func}\\s*\\(`, 'g');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(line)) !== null) {
        const beforeMatch = line.substring(0, match.index);
        const lastWord = beforeMatch.match(/\b(\w+)\s*\.?\s*$/);

        if (lastWord && TA_ALLOWED_PREFIXES.has(lastWord[1])) {
          continue;
        }

        this.addWarning(
          lineNum,
          match.index + 1,
          `'${func}()' should be namespaced in Pine Script v6. Use 'ta.${func}()' instead.`,
          'PSV6-MIG-SYNTAX',
          `Replace ${func}() with ta.${func}()`
        );
      }
    }
  }

  private reportStudyDeprecation(callee: ExpressionNode): void {
    const { line, column } = this.getCallLocation(callee);
    this.addWarning(line, column, `'study()' is deprecated in Pine Script v6. Use 'indicator()' instead.`, 'PSV6-MIG-SYNTAX', 'Replace study() with indicator()');
  }

  private reportSecurityDeprecation(callee: ExpressionNode): void {
    const { line, column } = this.getCallLocation(callee);
    this.addWarning(line, column, `'security()' is deprecated in Pine Script v6. Use 'request.security()' instead.`, 'PSV6-MIG-SYNTAX', 'Replace security() with request.security()');
  }

  private reportTaNamespaceWarning(callee: ExpressionNode, functionName: string): void {
    const { line, column } = this.getCallLocation(callee);
    this.addWarning(line, column, `'${functionName}()' should be namespaced in Pine Script v6. Use 'ta.${functionName}()' instead.`, 'PSV6-MIG-SYNTAX', `Replace ${functionName}() with ta.${functionName}()`);
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

  private addWarning(line: number, column: number, message: string, code: string, suggestion?: string): void {
    this.warnings.push({
      line,
      column,
      message,
      code,
      suggestion,
      severity: 'warning',
    });
  }
}
