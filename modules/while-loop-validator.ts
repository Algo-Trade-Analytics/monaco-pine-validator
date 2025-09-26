/**
 * Enhanced While Loop validation module for Pine Script v6
 * Handles while loop syntax, performance, and best practices
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidationError,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';
import type {
  AssignmentStatementNode,
  BinaryExpressionNode,
  BlockStatementNode,
  BreakStatementNode,
  CallExpressionNode,
  ExpressionNode,
  IdentifierNode,
  IfStatementNode,
  MemberExpressionNode,
  ProgramNode,
  ReturnStatementNode,
  StatementNode,
  WhileStatementNode,
  ArrayLiteralNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';

export class WhileLoopValidator implements ValidationModule {
  name = 'WhileLoopValidator';

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];

  getDependencies(): string[] {
    return ['SyntaxValidator', 'PerformanceValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();

    const astContext = this.getAstContext(context, config);
    if (!astContext?.ast) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: context.scriptType,
      };
    }

    this.validateWhileLoopsAst(astContext.ast);

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: context.scriptType,
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }

  private addError(line: number, column: number, message: string, code: string): void {
    this.errors.push({
      line,
      column,
      message,
      code,
      severity: 'error',
    });
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({
      line,
      column,
      message,
      code,
      severity: 'warning',
    });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({
      line,
      column,
      message,
      code,
      severity: 'info',
    });
  }

  private validateWhileLoopsAst(program: ProgramNode): void {
    interface NestingRecord {
      depth: number;
      line: number;
      column: number;
    }

    let maxDepth: NestingRecord | null = null;
    const loopStack: WhileStatementNode[] = [];

    visit(program, {
      WhileStatement: {
        enter: (path) => {
          const statement = (path as NodePath<WhileStatementNode>).node;
          loopStack.push(statement);

          if (!maxDepth || loopStack.length > maxDepth.depth) {
            const { line, column } = statement.loc.start;
            maxDepth = { depth: loopStack.length, line, column };
          }

          this.evaluateWhileCondition(statement);
          const complexity = this.analyseWhileBody(statement.body);
          if (complexity > 2) {
            const { line, column } = statement.loc.start;
            this.addWarning(
              line,
              column,
              'Complex operation inside while loop may impact performance',
              'PSV6-WHILE-COMPLEX-OPERATION',
            );
          }
        },
        exit: () => {
          loopStack.pop();
        },
      },
    });

    if (maxDepth && maxDepth.depth > 3) {
      this.addWarning(
        maxDepth.line,
        maxDepth.column,
        `While loop nesting depth is ${maxDepth.depth}. Consider refactoring.`,
        'PSV6-WHILE-DEEP-NESTING',
      );
    }
  }

  private evaluateWhileCondition(statement: WhileStatementNode): void {
    const { line, column } = statement.loc.start;
    const { test } = statement;

    switch (test.kind) {
      case 'BooleanLiteral':
        if (test.value) {
          this.addError(
            line,
            column,
            'While loop with condition "true" will run indefinitely',
            'PSV6-WHILE-INFINITE-LOOP',
          );
        } else {
          this.addWarning(
            line,
            column,
            'While loop with condition "false" will never execute',
            'PSV6-WHILE-NEVER-EXECUTES',
          );
        }
        break;
      case 'NumberLiteral':
        this.addWarning(
          line,
          column,
          'While loop with numeric condition may not behave as expected',
          'PSV6-WHILE-NUMERIC-CONDITION',
        );
        break;
      case 'StringLiteral':
        this.addWarning(
          line,
          column,
          'While loop with string condition may not behave as expected',
          'PSV6-WHILE-STRING-CONDITION',
        );
        break;
      default:
        break;
    }

    const analysis = this.analyseConditionExpression(test);

    if (analysis.logicalOperators >= 3) {
      this.addWarning(
        line,
        column,
        'While loop condition is complex. Consider simplifying.',
        'PSV6-WHILE-COMPLEX-CONDITION',
      );
    }

    if (analysis.comparisonOperators > 2) {
      this.addInfo(
        line,
        column,
        'Consider breaking complex condition into multiple variables',
        'PSV6-WHILE-CONDITION-SIMPLIFICATION',
      );
    }

    if (analysis.hasEquality && !analysis.hasInequality) {
      this.addInfo(
        line,
        column,
        'Consider using != instead of == for while loop conditions',
        'PSV6-WHILE-CONDITION-BEST-PRACTICE',
      );
    }

    if (analysis.firstComparisonIdentifier) {
      this.addInfo(
        line,
        column,
        'Ensure loop variable is updated inside the loop to prevent infinite loops',
        'PSV6-WHILE-VARIABLE-UPDATE-REMINDER',
      );

      const identifier = analysis.firstComparisonIdentifier;
      if (identifier.name.length < 3) {
        this.addInfo(
          line,
          column,
          'Consider using more descriptive variable names in while loop conditions',
          'PSV6-WHILE-VARIABLE-NAMING',
        );
      }
    }
  }

  private analyseConditionExpression(expression: ExpressionNode): {
    logicalOperators: number;
    comparisonOperators: number;
    hasEquality: boolean;
    hasInequality: boolean;
    firstComparisonIdentifier: IdentifierNode | null;
  } {
    const state = {
      logicalOperators: 0,
      comparisonOperators: 0,
      hasEquality: false,
      hasInequality: false,
      firstComparisonIdentifier: null as IdentifierNode | null,
    };

    const visitExpression = (node: ExpressionNode | null): void => {
      if (!node) {
        return;
      }

      switch (node.kind) {
        case 'BinaryExpression': {
          const operator = node.operator;
          if (operator === 'and' || operator === 'or') {
            state.logicalOperators += 1;
          }

          if (['==', '!=', '<', '<=', '>', '>='].includes(operator)) {
            state.comparisonOperators += 1;
            if (operator === '==') {
              state.hasEquality = true;
            }
            if (operator === '!=') {
              state.hasInequality = true;
            }

            if (!state.firstComparisonIdentifier) {
              const identifier = this.extractComparisonIdentifier(node);
              if (identifier) {
                state.firstComparisonIdentifier = identifier;
              }
            }
          }

          visitExpression(node.left);
          visitExpression(node.right);
          break;
        }
        case 'UnaryExpression':
          visitExpression(node.argument);
          break;
        case 'ConditionalExpression':
          visitExpression(node.test);
          visitExpression(node.consequent);
          visitExpression(node.alternate);
          break;
        case 'CallExpression':
          visitExpression(node.callee as ExpressionNode);
          for (const arg of node.args) {
            visitExpression(arg.value);
          }
          break;
        case 'MemberExpression':
          visitExpression(node.object);
          break;
        case 'TupleExpression':
          for (const element of node.elements) {
            if (element) {
              visitExpression(element);
            }
          }
          break;
        case 'ArrayLiteral':
          for (const element of (node as ArrayLiteralNode).elements) {
            if (element) {
              visitExpression(element);
            }
          }
          break;
        case 'IndexExpression':
          visitExpression(node.object);
          visitExpression(node.index);
          break;
        default:
          break;
      }
    };

    visitExpression(expression);
    return state;
  }

  private extractComparisonIdentifier(expression: BinaryExpressionNode): IdentifierNode | null {
    const left = expression.left;
    const right = expression.right;

    if (left.kind === 'Identifier') {
      return left;
    }
    if (right.kind === 'Identifier') {
      return right;
    }

    return null;
  }

  private analyseWhileBody(body: BlockStatementNode): number {
    let complexity = 0;
    const breakLines = new Set<number>();
    const conditionalBreakLines = new Set<number>();
    const updateLines = new Set<number>();

    visit(body, {
      IfStatement: {
        enter: (path) => {
          const node = (path as NodePath<IfStatementNode>).node;
          complexity += 1;

          if (this.containsBreakOrReturn(node) && !conditionalBreakLines.has(node.loc.start.line)) {
            conditionalBreakLines.add(node.loc.start.line);
            this.addInfo(
              node.loc.start.line,
              node.loc.start.column,
              'Conditional break/return in while loop. Ensure all code paths lead to termination.',
              'PSV6-WHILE-CONDITIONAL-BREAK',
            );
          }
        },
      },
      ForStatement: {
        enter: () => {
          complexity += 1;
        },
      },
      WhileStatement: {
        enter: () => {
          complexity += 1;
        },
      },
      SwitchStatement: {
        enter: () => {
          complexity += 1;
        },
      },
      CallExpression: {
        enter: (path) => {
          const node = (path as NodePath<CallExpressionNode>).node;
          const qualified = this.getQualifiedName(node.callee as ExpressionNode);

          if (qualified && this.isExpensiveOperation(qualified)) {
            this.addWarning(
              node.loc.start.line,
              node.loc.start.column,
              `Expensive operation "${qualified}" inside while loop may impact performance`,
              'PSV6-WHILE-EXPENSIVE-OPERATION',
            );
          }

          if (qualified && this.isComplexNamespace(qualified)) {
            complexity += 1;
          }
        },
      },
      AssignmentStatement: {
        enter: (path) => {
          const node = (path as NodePath<AssignmentStatementNode>).node;
          const target = this.getAssignmentTarget(node.left);
          if (target && this.isLoopCounterName(target) && !updateLines.has(node.loc.start.line)) {
            updateLines.add(node.loc.start.line);
            this.addInfo(
              node.loc.start.line,
              node.loc.start.column,
              `Loop variable "${target}" updated. Good practice for preventing infinite loops.`,
              'PSV6-WHILE-VARIABLE-UPDATE-GOOD',
            );
          }
        },
      },
      BreakStatement: {
        enter: (path) => {
          const node = (path as NodePath<BreakStatementNode>).node;
          if (!breakLines.has(node.loc.start.line)) {
            breakLines.add(node.loc.start.line);
            this.addInfo(
              node.loc.start.line,
              node.loc.start.column,
              'Break/return statement found in while loop. Ensure proper loop termination.',
              'PSV6-WHILE-BREAK-CONDITION',
            );
          }
        },
      },
      ReturnStatement: {
        enter: (path) => {
          const node = (path as NodePath<ReturnStatementNode>).node;
          if (!breakLines.has(node.loc.start.line)) {
            breakLines.add(node.loc.start.line);
            this.addInfo(
              node.loc.start.line,
              node.loc.start.column,
              'Break/return statement found in while loop. Ensure proper loop termination.',
              'PSV6-WHILE-BREAK-CONDITION',
            );
          }
        },
      },
    });

    return complexity;
  }

  private containsBreakOrReturn(statement: StatementNode): boolean {
    switch (statement.kind) {
      case 'BreakStatement':
      case 'ReturnStatement':
        return true;
      case 'BlockStatement':
        return statement.body.some((child) => this.containsBreakOrReturn(child));
      case 'IfStatement':
        return (
          this.containsBreakOrReturn(statement.consequent) ||
          (statement.alternate ? this.containsBreakOrReturn(statement.alternate) : false)
        );
      case 'WhileStatement':
      case 'ForStatement':
        return this.containsBreakOrReturn(statement.body);
      case 'SwitchStatement':
        return statement.cases.some((caseNode) =>
          caseNode.consequent.some((child) => this.containsBreakOrReturn(child)),
        );
      default:
        return false;
    }
  }

  private getAssignmentTarget(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return expression.name;
    }

    if (expression.kind === 'MemberExpression' && !expression.computed) {
      const object = this.getQualifiedName(expression.object);
      if (object) {
        return `${object}.${expression.property.name}`;
      }
    }

    return null;
  }

  private getQualifiedName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return expression.name;
    }

    if (expression.kind === 'MemberExpression' && !expression.computed) {
      const object = this.getQualifiedName(expression.object);
      if (!object) {
        return null;
      }
      return `${object}.${expression.property.name}`;
    }

    return null;
  }

  private isExpensiveOperation(name: string): boolean {
    return [
      'request.security',
      'request.seed',
      'request.quandl',
      'ta.sma',
      'ta.ema',
      'ta.rsi',
      'ta.macd',
      'math.max',
      'math.min',
      'math.sqrt',
      'math.log',
    ].some((operation) => name.includes(operation));
  }

  private isComplexNamespace(name: string): boolean {
    return ['ta.', 'math.', 'str.', 'array.'].some((prefix) => name.includes(prefix));
  }

  private isLoopCounterName(name: string): boolean {
    return ['i', 'j', 'k', 'index', 'counter', 'count'].includes(name);
  }

  private getAstContext(
    context: ValidationContext,
    config: ValidatorConfig,
  ): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }

    return isAstValidationContext(context) ? (context as AstValidationContext) : null;
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
