/**
 * Dynamic For-Loop validation module for Pine Script v6
 * Detects dynamic loop boundaries and modifications to loop index/bounds
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';
import { Codes } from '../core/codes';
import { ValidationHelper } from '../core/validation-helper';
import type {
  AssignmentStatementNode,
  BinaryExpressionNode,
  BlockStatementNode,
  ExpressionNode,
  ForStatementNode,
  IdentifierNode,
  ProgramNode,
  UnaryExpressionNode,
  VariableDeclarationNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';

export class DynamicLoopValidator implements ValidationModule {
  name = 'DynamicLoopValidator';
  priority = 76; // run near other control-flow validators

  private helper = new ValidationHelper();
  private context!: ValidationContext;
  private astContext: AstValidationContext | null = null;

  getDependencies(): string[] {
    return ['CoreValidator', 'SyntaxValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.astContext = this.getAstContext(config);
    const ast = this.astContext?.ast;

    if (!ast) {
      return this.helper.buildResult(context);
    }

    this.validateDynamicLoopsAst(ast);

    return this.helper.buildResult(context);
  }

  private reset(): void {
    this.helper.reset();
    this.astContext = null;
  }


  private validateDynamicLoopsAst(program: ProgramNode): void {
    visit(program, {
      ForStatement: {
        enter: (path) => {
          const node = (path as NodePath<ForStatementNode>).node;
          this.processAstForStatement(node);
        },
      },
    });
  }

  private processAstForStatement(statement: ForStatementNode): void {
    const loopInfo = this.extractLoopInfo(statement);
    if (!loopInfo) {
      return;
    }

    const {
      indexName,
      startExpression,
      endExpression,
      stepExpression,
      boundIdentifiers,
    } = loopInfo;

    if (startExpression && this.isDynamicNumericExpression(startExpression)) {
      const { line, column } = startExpression.loc.start;
      this.helper.addWarning(
        line,
        column,
        'For-loop start bound is dynamic; verify correctness and performance.',
        'PSV6-FOR-DYNAMIC-START',
      );
    }

    if (endExpression && this.isDynamicNumericExpression(endExpression, indexName)) {
      const { line, column } = endExpression.loc.start;
      this.helper.addWarning(
        line,
        column,
        'For-loop end bound is dynamic; verify correctness and performance.',
        'PSV6-FOR-DYNAMIC-END',
      );
    }

    if (stepExpression && this.isDynamicStepExpression(stepExpression, indexName)) {
      const { line, column } = stepExpression.loc.start;
      this.helper.addWarning(
        line,
        column,
        'For-loop step is dynamic; verify correctness and performance.',
        'PSV6-FOR-DYNAMIC-STEP',
      );
    }

    this.detectLoopMutations(statement.body, indexName, boundIdentifiers);
  }

  private detectLoopMutations(
    body: BlockStatementNode,
    indexName: string,
    boundIdentifiers: Set<string>,
  ): void {
    let warnedIndex = false;
    let warnedBounds = false;

    visit(body, {
      AssignmentStatement: {
        enter: (path) => {
          const assignment = (path as NodePath<AssignmentStatementNode>).node;
          const target = this.getIdentifierName(assignment.left);
          if (!warnedIndex && target === indexName) {
            const { line, column } = assignment.loc.start;
            this.helper.addWarning(
              line,
              column,
              `Loop index '${indexName}' modified inside for-loop.`,
              'PSV6-FOR-INDEX-MODIFIED',
            );
            warnedIndex = true;
          }

          if (!warnedBounds && target && boundIdentifiers.has(target)) {
            const { line, column } = assignment.loc.start;
            this.helper.addWarning(
              line,
              column,
              `Variable '${target}' used in for-loop bounds modified inside loop.`,
              'PSV6-FOR-BOUND-MODIFIED',
            );
            warnedBounds = true;
          }
        },
      },
      VariableDeclaration: {
        enter: (path) => {
          if (warnedBounds) {
            return;
          }
          const declaration = (path as NodePath<VariableDeclarationNode>).node;
          const name = declaration.identifier.name;
          if (!boundIdentifiers.has(name)) {
            return;
          }

          const { line, column } = declaration.loc.start;
          this.helper.addWarning(
            line,
            column,
            `Variable '${name}' used in for-loop bounds modified inside loop.`,
            'PSV6-FOR-BOUND-MODIFIED',
          );
          warnedBounds = true;
        },
      },
    });
  }

  private extractLoopInfo(statement: ForStatementNode): {
    indexName: string;
    startExpression: ExpressionNode | null;
    endExpression: ExpressionNode | null;
    stepExpression: ExpressionNode | null;
    boundIdentifiers: Set<string>;
  } | null {
    const indexName = this.getLoopIndexName(statement);
    if (!indexName) {
      return null;
    }

    const startExpression = this.getInitializerExpression(statement.initializer);
    const endExpression = this.getEndExpression(statement, indexName);
    const stepExpression = this.getStepExpression(statement, indexName);

    const boundIdentifiers = new Set<string>();
    this.collectIdentifiers(startExpression, boundIdentifiers);
    this.collectIdentifiers(endExpression, boundIdentifiers);
    this.collectIdentifiers(stepExpression, boundIdentifiers);
    boundIdentifiers.delete(indexName);

    return {
      indexName,
      startExpression,
      endExpression,
      stepExpression,
      boundIdentifiers,
    };
  }

  private getLoopIndexName(statement: ForStatementNode): string | null {
    const { initializer } = statement;
    if (initializer?.kind === 'VariableDeclaration') {
      return initializer.identifier.name;
    }
    if (initializer?.kind === 'AssignmentStatement') {
      return this.getIdentifierName(initializer.left);
    }

    if (statement.update?.kind === 'Identifier') {
      return (statement.update as IdentifierNode).name;
    }

    return null;
  }

  private getInitializerExpression(
    initializer: VariableDeclarationNode | AssignmentStatementNode | null,
  ): ExpressionNode | null {
    if (!initializer) {
      return null;
    }

    if (initializer.kind === 'VariableDeclaration') {
      return initializer.initializer;
    }

    if (initializer.kind === 'AssignmentStatement') {
      return initializer.right;
    }

    return null;
  }

  private getEndExpression(statement: ForStatementNode, indexName: string): ExpressionNode | null {
    const { test } = statement;
    if (!test) {
      return null;
    }

    if (test.kind === 'BinaryExpression') {
      const binary = test as BinaryExpressionNode;
      if (this.expressionMatchesIdentifier(binary.left, indexName)) {
        return binary.right;
      }
      if (this.expressionMatchesIdentifier(binary.right, indexName)) {
        return binary.left;
      }
    }

    return test;
  }

  private getStepExpression(statement: ForStatementNode, indexName: string): ExpressionNode | null {
    const { update } = statement;
    if (!update) {
      return null;
    }

    if (update.kind === 'BinaryExpression') {
      const binary = update as BinaryExpressionNode;
      if (this.expressionMatchesIdentifier(binary.left, indexName)) {
        return binary.right;
      }
    }

    return update;
  }

  private collectIdentifiers(node: ExpressionNode | null, bucket: Set<string>): void {
    if (!node) {
      return;
    }

    visit(node, {
      Identifier: {
        enter: (path) => {
          const identifier = (path as NodePath<IdentifierNode>).node;
          bucket.add(identifier.name);
        },
      },
    });
  }

  private expressionMatchesIdentifier(expression: ExpressionNode, name: string): boolean {
    return expression.kind === 'Identifier' && (expression as IdentifierNode).name === name;
  }

  private getIdentifierName(expression: ExpressionNode | null): string | null {
    if (!expression) {
      return null;
    }
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }
    return null;
  }

  private isDynamicNumericExpression(expression: ExpressionNode, indexName?: string): boolean {
    return !this.isStaticNumericExpression(expression, indexName ?? null);
  }

  private isStaticNumericExpression(expression: ExpressionNode, indexName: string | null): boolean {
    switch (expression.kind) {
      case 'NumberLiteral':
        return true;
      case 'Identifier': {
        const identifier = expression as IdentifierNode;
        return indexName !== null && identifier.name === indexName;
      }
      case 'UnaryExpression': {
        const unary = expression as UnaryExpressionNode;
        if (unary.operator !== '+' && unary.operator !== '-') {
          return false;
        }
        return this.isStaticNumericExpression(unary.argument, indexName);
      }
      case 'BinaryExpression': {
        const binary = expression as BinaryExpressionNode;
        if (!['+', '-', '*', '/', '%'].includes(binary.operator)) {
          return false;
        }
        return (
          this.isStaticNumericExpression(binary.left, indexName) &&
          this.isStaticNumericExpression(binary.right, indexName)
        );
      }
      default:
        return false;
    }
  }

  private isDynamicStepExpression(expression: ExpressionNode, indexName: string): boolean {
    if (expression.kind === 'Identifier' && (expression as IdentifierNode).name === indexName) {
      return false;
    }
    return this.isDynamicNumericExpression(expression, undefined);
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }

    return 'ast' in this.context ? (this.context as AstValidationContext) : null;
  }
}

