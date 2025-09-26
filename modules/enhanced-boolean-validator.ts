/**
 * Enhanced Boolean Logic Validator Module
 *
 * Handles enhanced boolean logic validation for Pine Script v6:
 * - PSV6-MIG-BOOL: Numeric literal conditions
 * - PSV6-BOOL-AND-ORDER: Expensive calc placed before cheap checks in AND chain
 * - PSV6-BOOL-OR-CONSTANT: Constant false placed before expensive calc in OR chain
 * - PSV6-BOOL-EXPENSIVE-CHAIN: Multiple expensive calcs inside boolean chain
 * - PSV6-FUNCTION-NAMESPACE: Non-boolean identifiers used as conditions
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidatorConfig,
  type ValidationError,
  type ValidationResult,
} from '../core/types';
import { EXPENSIVE_CALCULATION_FUNCTIONS } from '../core/constants';
import {
  type ArgumentNode,
  type BinaryExpressionNode,
  type BooleanLiteralNode,
  type CallExpressionNode,
  type ConditionalExpressionNode,
  type ExpressionNode,
  type IdentifierNode,
  type IfStatementNode,
  type MemberExpressionNode,
  type NumberLiteralNode,
  type ProgramNode,
  type TupleExpressionNode,
  type ArrayLiteralNode,
  type UnaryExpressionNode,
} from '../core/ast/nodes';
import type { TypeMetadata } from '../core/ast/types';
import { visit, type NodePath } from '../core/ast/traversal';

export class EnhancedBooleanValidator implements ValidationModule {
  name = 'EnhancedBooleanValidator';
  priority = 75; // Run after basic syntax validation

  private config!: ValidatorConfig;
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private astContext: AstValidationContext | null = null;

  getDependencies(): string[] {
    return ['CoreValidator', 'SyntaxValidator', 'TypeInferenceValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.config = config;

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

    this.validateWithAst(this.astContext.ast);

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: null,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AST validation
  // ──────────────────────────────────────────────────────────────────────────
  private validateWithAst(program: ProgramNode): void {
    visit(program, {
      IfStatement: {
        enter: (path: NodePath<IfStatementNode>) => {
          const node = path.node;
          const test = node.test;
          this.validateAstNumericLiteralCondition(test);
          this.validateAstBooleanCondition(test);
          if (this.config.enablePerformanceAnalysis) {
            this.validateAstBooleanShortCircuit(test);
          }
        },
      },
    });
  }

  private validateAstNumericLiteralCondition(test: ExpressionNode): void {
    if (!this.isNumericLiteralExpression(test)) {
      return;
    }

    const literalText = this.getExpressionText(test);
    const { line, column } = test.loc.start;
    this.addError(
      line,
      column,
      `Numeric literal '${literalText}' used in if condition. Use boolean expressions instead.`,
      'PSV6-MIG-BOOL',
      `Replace 'if (${literalText})' with 'if (${literalText} != 0)' or a proper boolean expression`,
    );
  }

  private validateAstBooleanCondition(test: ExpressionNode): void {
    if (!this.astContext) {
      return;
    }

    if (this.isBooleanishExpression(test)) {
      return;
    }

    const metadata = this.astContext.typeEnvironment.nodeTypes.get(test);
    if (metadata) {
      if (this.isBooleanishMetadata(metadata) || metadata.kind === 'unknown') {
        return;
      }
      this.reportNonBooleanCondition(test);
      return;
    }

    if (test.kind === 'Identifier') {
      const identifier = test as IdentifierNode;
      const identifierMetadata = this.astContext.typeEnvironment.identifiers.get(identifier.name);
      if (identifierMetadata && !this.isBooleanishMetadata(identifierMetadata) && identifierMetadata.kind !== 'unknown') {
        this.reportNonBooleanCondition(test);
      }
      return;
    }

    if (test.kind === 'MemberExpression') {
      const member = test as MemberExpressionNode;
      const root = this.resolveBaseIdentifier(member.object as ExpressionNode);
      if (!root) {
        return;
      }
      const identifierMetadata = this.astContext.typeEnvironment.identifiers.get(root.name);
      if (identifierMetadata && !this.isBooleanishMetadata(identifierMetadata) && identifierMetadata.kind !== 'unknown') {
        this.reportNonBooleanCondition(test);
      }
    }
  }

  private reportNonBooleanCondition(node: ExpressionNode): void {
    const { line, column } = node.loc.start;
    this.addError(line, column, 'Non-boolean condition used in if', 'PSV6-FUNCTION-NAMESPACE');
  }

  private validateAstBooleanShortCircuit(test: ExpressionNode): void {
    const chains = this.collectBooleanChains(test);
    if (!chains.length) {
      return;
    }

    const { line, column } = test.loc.start;

    for (const chain of chains) {
      if (chain.operator === 'and') {
        this.evaluateAstAndChain(chain.clauses, line, column);
      } else {
        this.evaluateAstOrChain(chain.clauses, line, column);
      }
    }
  }

  private evaluateAstAndChain(clauses: ExpressionNode[], line: number, column: number): void {
    const metadata = clauses.map((clause) => ({
      expensive: this.containsExpensiveCalcAst(clause),
      cheap: this.isCheapCheckAst(clause),
    }));

    const firstExpensiveIndex = metadata.findIndex((entry) => entry.expensive);
    if (firstExpensiveIndex >= 0) {
      const hasLaterCheap = metadata.slice(firstExpensiveIndex + 1).some((entry) => entry.cheap);
      if (hasLaterCheap) {
        this.addWarning(
          line,
          column,
          'Expensive calculation appears before cheaper checks in AND chain. Reorder to leverage short-circuiting.',
          'PSV6-BOOL-AND-ORDER',
        );
      }
    }

    const expensiveCount = metadata.filter((entry) => entry.expensive).length;
    if (expensiveCount > 1) {
      this.addWarning(
        line,
        column,
        'Multiple expensive calculations used in a single boolean chain. Consider caching or simplifying.',
        'PSV6-BOOL-EXPENSIVE-CHAIN',
      );
    }
  }

  private evaluateAstOrChain(clauses: ExpressionNode[], line: number, column: number): void {
    if (clauses.length < 2) {
      return;
    }

    if (this.isConstantFalseAst(clauses[0]) && this.containsExpensiveCalcAst(clauses[1])) {
      this.addWarning(
        line,
        column,
        'Constant false used before an expensive calculation in OR chain; move constants to the end to avoid unnecessary evaluation.',
        'PSV6-BOOL-OR-CONSTANT',
      );
    }

    const expensiveCount = clauses.filter((clause) => this.containsExpensiveCalcAst(clause)).length;
    if (expensiveCount > 1) {
      this.addWarning(
        line,
        column,
        'Multiple expensive calculations used in a single boolean chain. Consider caching or simplifying.',
        'PSV6-BOOL-EXPENSIVE-CHAIN',
      );
    }
  }

  private collectBooleanChains(test: ExpressionNode): Array<{ operator: 'and' | 'or'; clauses: ExpressionNode[] }> {
    const chains: Array<{ operator: 'and' | 'or'; clauses: ExpressionNode[] }> = [];
    const andClauses = this.flattenBooleanChain(test, 'and');
    if (andClauses.length > 1) {
      chains.push({ operator: 'and', clauses: andClauses });
    }
    const orClauses = this.flattenBooleanChain(test, 'or');
    if (orClauses.length > 1) {
      chains.push({ operator: 'or', clauses: orClauses });
    }
    return chains;
  }

  private flattenBooleanChain(node: ExpressionNode, operator: 'and' | 'or'): ExpressionNode[] {
    const clauses: ExpressionNode[] = [];

    const flatten = (expression: ExpressionNode): void => {
      if (expression.kind === 'BinaryExpression' && (expression as BinaryExpressionNode).operator === operator) {
        const binary = expression as BinaryExpressionNode;
        flatten(binary.left as ExpressionNode);
        flatten(binary.right as ExpressionNode);
        return;
      }
      clauses.push(expression);
    };

    flatten(node);
    return clauses;
  }

  private containsExpensiveCalcAst(expression: ExpressionNode): boolean {
    return this.expressionSome(expression, (node) => {
      if (node.kind !== 'CallExpression') {
        return false;
      }
      const call = node as CallExpressionNode;
      const calleeName = this.getExpressionText(call.callee as ExpressionNode);
      if (!calleeName) {
        return false;
      }
      if (EXPENSIVE_CALCULATION_FUNCTIONS.has(calleeName)) {
        return true;
      }
      return /^request\.(security|security_lower_tf|economic|financial|seed)\b/.test(calleeName);
    });
  }

  private isCheapCheckAst(expression: ExpressionNode): boolean {
    if (this.isConstantTrueAst(expression) || this.isConstantFalseAst(expression)) {
      return true;
    }

    if (expression.kind === 'BinaryExpression') {
      const binary = expression as BinaryExpressionNode;
      if (['==', '!=', '<', '>', '<=', '>='].includes(binary.operator)) {
        return true;
      }
    }

    if (expression.kind === 'MemberExpression') {
      const text = this.getExpressionText(expression);
      if (/^barstate\.(isconfirmed|isfirst|islast|isrealtime|isnew|ishistory|islastconfirmedhistory)\b/.test(text)) {
        return true;
      }
      if (/^strategy\.(position_size|opentrades)\b/.test(text)) {
        return true;
      }
    }

    return !this.containsCallExpressionAst(expression);
  }

  private isConstantTrueAst(expression: ExpressionNode): boolean {
    return expression.kind === 'BooleanLiteral' && (expression as BooleanLiteralNode).value === true;
  }

  private isConstantFalseAst(expression: ExpressionNode): boolean {
    return expression.kind === 'BooleanLiteral' && (expression as BooleanLiteralNode).value === false;
  }

  private containsCallExpressionAst(expression: ExpressionNode): boolean {
    return this.expressionSome(expression, (node) => node.kind === 'CallExpression');
  }

  private isBooleanishExpression(expression: ExpressionNode): boolean {
    if (!this.astContext) {
      return false;
    }

    const metadata = this.astContext.typeEnvironment.nodeTypes.get(expression);
    if (metadata && this.isBooleanishMetadata(metadata)) {
      return true;
    }

    switch (expression.kind) {
      case 'BooleanLiteral':
        return true;
      case 'UnaryExpression': {
        const unary = expression as UnaryExpressionNode;
        if (['not', '!'].includes(unary.operator)) {
          return this.isBooleanishExpression(unary.argument as ExpressionNode);
        }
        return false;
      }
      case 'BinaryExpression': {
        const binary = expression as BinaryExpressionNode;
        if (['and', 'or'].includes(binary.operator)) {
          return (
            this.isBooleanishExpression(binary.left as ExpressionNode) &&
            this.isBooleanishExpression(binary.right as ExpressionNode)
          );
        }
        if (['==', '!=', '<', '>', '<=', '>='].includes(binary.operator)) {
          return true;
        }
        return false;
      }
      case 'CallExpression': {
        const call = expression as CallExpressionNode;
        const calleeName = this.getExpressionText(call.callee as ExpressionNode);
        if (/^ta\.(crossover|crossunder|rising|falling|cross)\b/.test(calleeName)) {
          return true;
        }
        if (/^str\.(contains|startswith|endswith)\b/.test(calleeName)) {
          return true;
        }
        if (/^array\.get\b/.test(calleeName)) {
          return true;
        }
        if (/^math\.(sign|round)\b/.test(calleeName)) {
          return true;
        }
        return false;
      }
      case 'MemberExpression': {
        const text = this.getExpressionText(expression);
        if (/^barstate\.(isconfirmed|isfirst|islast|isrealtime|isnew|ishistory|islastconfirmedhistory)\b/.test(text)) {
          return true;
        }
        if (/^strategy\.(position_size|opentrades)\b/.test(text)) {
          return true;
        }
        return false;
      }
      case 'Identifier': {
        const identifier = expression as IdentifierNode;
        const identifierMetadata = this.astContext.typeEnvironment.identifiers.get(identifier.name);
        return !!identifierMetadata && this.isBooleanishMetadata(identifierMetadata);
      }
      default:
        return false;
    }
  }

  private isBooleanishMetadata(metadata: TypeMetadata): boolean {
    return metadata.kind === 'bool' || metadata.kind === 'series';
  }

  private resolveBaseIdentifier(expression: ExpressionNode): IdentifierNode | null {
    if (expression.kind === 'Identifier') {
      return expression as IdentifierNode;
    }
    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      return this.resolveBaseIdentifier(member.object as ExpressionNode);
    }
    return null;
  }

  private expressionSome(expression: ExpressionNode | null | undefined, predicate: (node: ExpressionNode) => boolean): boolean {
    if (!expression) {
      return false;
    }

    if (predicate(expression)) {
      return true;
    }

    switch (expression.kind) {
      case 'BinaryExpression': {
        const binary = expression as BinaryExpressionNode;
        return (
          this.expressionSome(binary.left as ExpressionNode, predicate) ||
          this.expressionSome(binary.right as ExpressionNode, predicate)
        );
      }
      case 'UnaryExpression': {
        const unary = expression as UnaryExpressionNode;
        return this.expressionSome(unary.argument as ExpressionNode, predicate);
      }
      case 'CallExpression': {
        const call = expression as CallExpressionNode;
        if (this.expressionSome(call.callee as ExpressionNode, predicate)) {
          return true;
        }
        return call.args.some((argument: ArgumentNode) => this.expressionSome(argument.value, predicate));
      }
      case 'ConditionalExpression': {
        const conditional = expression as ConditionalExpressionNode;
        return (
          this.expressionSome(conditional.test, predicate) ||
          this.expressionSome(conditional.consequent, predicate) ||
          this.expressionSome(conditional.alternate, predicate)
        );
      }
      case 'MemberExpression': {
        const member = expression as MemberExpressionNode;
        return this.expressionSome(member.object as ExpressionNode, predicate);
      }
      case 'TupleExpression': {
        const tuple = expression as TupleExpressionNode;
        return tuple.elements.some((element) => this.expressionSome(element ?? null, predicate));
      }
      case 'ArrayLiteral': {
        const arrayLiteral = expression as ArrayLiteralNode;
        return arrayLiteral.elements.some((element) => this.expressionSome(element ?? null, predicate));
      }
      default:
        return false;
    }
  }

  private isNumericLiteralExpression(expression: ExpressionNode): boolean {
    if (expression.kind === 'NumberLiteral') {
      return true;
    }
    if (expression.kind === 'UnaryExpression') {
      const unary = expression as UnaryExpressionNode;
      return ['+', '-'].includes(unary.operator) && this.isNumericLiteralExpression(unary.argument as ExpressionNode);
    }
    return false;
  }

  private getExpressionText(expression: ExpressionNode): string {
    switch (expression.kind) {
      case 'Identifier':
        return (expression as IdentifierNode).name;
      case 'NumberLiteral':
        return (expression as NumberLiteralNode).raw ?? String((expression as NumberLiteralNode).value);
      case 'BooleanLiteral':
        return (expression as BooleanLiteralNode).value ? 'true' : 'false';
      case 'StringLiteral':
        return (expression as any).raw ?? JSON.stringify((expression as any).value);
      case 'NullLiteral':
        return 'na';
      case 'UnaryExpression': {
        const unary = expression as UnaryExpressionNode;
        return `${unary.operator}${this.getExpressionText(unary.argument as ExpressionNode)}`;
      }
      case 'BinaryExpression': {
        const binary = expression as BinaryExpressionNode;
        const left = this.getExpressionText(binary.left as ExpressionNode);
        const right = this.getExpressionText(binary.right as ExpressionNode);
        return `${left} ${binary.operator} ${right}`;
      }
      case 'CallExpression': {
        const call = expression as CallExpressionNode;
        const callee = this.getExpressionText(call.callee as ExpressionNode);
        const args = call.args.map((arg) => this.getExpressionText(arg.value));
        return `${callee}(${args.join(', ')})`;
      }
      case 'MemberExpression': {
        const member = expression as MemberExpressionNode;
        const object = this.getExpressionText(member.object as ExpressionNode);
        return `${object}.${member.property.name}`;
      }
      case 'ConditionalExpression': {
        const conditional = expression as ConditionalExpressionNode;
        return `${this.getExpressionText(conditional.test)} ? ${this.getExpressionText(conditional.consequent)} : ${this.getExpressionText(conditional.alternate)}`;
      }
      case 'TupleExpression': {
        const tuple = expression as TupleExpressionNode;
        return `[${tuple.elements.map((element) => (element ? this.getExpressionText(element) : '')).join(', ')}]`;
      }
      case 'ArrayLiteral': {
        const arrayLiteral = expression as ArrayLiteralNode;
        return `[${arrayLiteral.elements
          .map((element) => (element ? this.getExpressionText(element) : ''))
          .join(', ')}]`;
      }
      default:
        return expression.kind;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Shared helpers
  // ──────────────────────────────────────────────────────────────────────────
  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
  }

  private addError(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.errors.push({ line, column, message, severity: 'error', code, suggestion });
  }

  private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
