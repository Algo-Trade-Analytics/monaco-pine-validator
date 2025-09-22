/**
 * Dynamic For-Loop validation module for Pine Script v6
 * Detects dynamic loop boundaries and modifications to loop index/bounds
 */

import {
  AstValidationContext,
  ValidationModule,
  ValidationContext,
  ValidationError,
  ValidationResult,
  ValidatorConfig,
} from '../core/types';
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

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}

export class DynamicLoopValidator implements ValidationModule {
  name = 'DynamicLoopValidator';
  priority = 76; // run near other control-flow validators

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;

  getDependencies(): string[] {
    return ['CoreValidator', 'SyntaxValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.astContext = isAstValidationContext(context) && context.ast ? context : null;

    if (this.astContext?.ast) {
      this.validateDynamicLoopsAst(this.astContext.ast);
    } else {
      this.validateDynamicForLoopsLegacy();
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

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({ line, column, message, code, severity: 'warning' });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({ line, column, message, code, severity: 'info' });
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
      this.addWarning(
        line,
        column,
        'For-loop start bound is dynamic; verify correctness and performance.',
        'PSV6-FOR-DYNAMIC-START',
      );
    }

    if (endExpression && this.isDynamicNumericExpression(endExpression, indexName)) {
      const { line, column } = endExpression.loc.start;
      this.addWarning(
        line,
        column,
        'For-loop end bound is dynamic; verify correctness and performance.',
        'PSV6-FOR-DYNAMIC-END',
      );
    }

    if (stepExpression && this.isDynamicStepExpression(stepExpression, indexName)) {
      const { line, column } = stepExpression.loc.start;
      this.addWarning(
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
            this.addWarning(
              line,
              column,
              `Loop index '${indexName}' modified inside for-loop.`,
              'PSV6-FOR-INDEX-MODIFIED',
            );
            warnedIndex = true;
          }

          if (!warnedBounds && target && boundIdentifiers.has(target)) {
            const { line, column } = assignment.loc.start;
            this.addWarning(
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
          this.addWarning(
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
    return this.isDynamicNumericExpression(expression, null);
  }

  private validateDynamicForLoopsLegacy(): void {
    interface ForFrame {
      startLine: number;
      indexVar: string;
      startExpr: string;
      endExpr: string;
      stepExpr: string | null;
      boundVars: Set<string>; // identifiers referenced by start/end/step
    }

    const loopStack: ForFrame[] = [];

    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const raw = this.context.cleanLines[i];
      const line = raw;
      const lineNum = i + 1;

      // for i = <start> to <end> [by <step>]
      const forMatch = line.match(/^\s*for\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s+to\s+(.+?)(?:\s+by\s+(.+?))?\s*$/);
      if (forMatch) {
        const [, indexVar, startExpr, endExpr, stepExprRaw] = forMatch;
        const stepExpr = stepExprRaw ?? null;

        // Heuristic checks for dynamic expressions
        const isStaticNumber = (expr: string) => /^\s*[+\-]?\d+(?:\.\d+)?\s*$/.test(expr);
        const isStaticArith = (expr: string) => /^\s*[+\-]?\d+(?:\.\d+)?(?:\s*[-+*\/]\s*[+\-]?\d+(?:\.\d+)?)*\s*$/.test(expr);
        const isDynamic = (expr: string) => !(isStaticNumber(expr) || isStaticArith(expr));

        if (isDynamic(startExpr)) {
          this.addWarning(lineNum, 1, 'For-loop start bound is dynamic; verify correctness and performance.', 'PSV6-FOR-DYNAMIC-START');
        }
        if (isDynamic(endExpr)) {
          this.addWarning(lineNum, 1, 'For-loop end bound is dynamic; verify correctness and performance.', 'PSV6-FOR-DYNAMIC-END');
        }
        if (stepExpr && isDynamic(stepExpr)) {
          this.addWarning(lineNum, 1, 'For-loop step is dynamic; verify correctness and performance.', 'PSV6-FOR-DYNAMIC-STEP');
        }

        // Collect identifiers referenced in bounds/step to detect modifications later
        const identsIn = (expr: string): string[] => {
          const ids = expr.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) || [];
          const banned = new Set(['to', 'by', 'and', 'or', 'true', 'false', 'na']);
          return ids.filter((id) => !banned.has(id));
        };

        const boundVars = new Set<string>([
          ...identsIn(startExpr),
          ...identsIn(endExpr),
          ...(stepExpr ? identsIn(stepExpr) : []),
        ]);

        loopStack.push({
          startLine: lineNum,
          indexVar,
          startExpr,
          endExpr,
          stepExpr,
          boundVars,
        });
        continue;
      }

      // end of a block
      if (/^\s*end\s*$/.test(line) && loopStack.length > 0) {
        loopStack.pop();
        continue;
      }

      // Inside for-loop: detect modifications
      if (loopStack.length > 0) {
        const current = loopStack[loopStack.length - 1];

        // Reassignment patterns (both = and :=)
        const assignMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(:=|=)\s*/);
        if (assignMatch) {
          const target = assignMatch[1];

          // Index variable modified
          if (target === current.indexVar) {
            this.addWarning(lineNum, 1, `Loop index '${current.indexVar}' modified inside for-loop.`, 'PSV6-FOR-INDEX-MODIFIED');
          }

          // Bound variable modified
          if (current.boundVars.has(target)) {
            this.addWarning(lineNum, 1, `Variable '${target}' used in for-loop bounds modified inside loop.`, 'PSV6-FOR-BOUND-MODIFIED');
          }
        }
      }
    }
  }
}

