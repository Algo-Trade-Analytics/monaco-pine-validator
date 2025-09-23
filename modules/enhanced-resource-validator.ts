/**
 * Enhanced Resource Validator Module
 *
 * Handles enhanced resource validation for Pine Script v6:
 * - PSV6-RES-MEMORY: Memory usage warnings
 * - PSV6-RES-COMPLEXITY: Computational complexity
 */

import {
  type AstValidationContext,
  type ValidationContext,
  type ValidationError,
  type ValidationModule,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';
import {
  type BinaryExpressionNode,
  type CallExpressionNode,
  type ExpressionNode,
  type ForStatementNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type NumberLiteralNode,
  type ProgramNode,
  type UnaryExpressionNode,
  type VariableDeclarationNode,
  type WhileStatementNode,
} from '../core/ast/nodes';
import { findAncestor, visit, type NodePath } from '../core/ast/traversal';

export class EnhancedResourceValidator implements ValidationModule {
  name = 'EnhancedResourceValidator';
  priority = 70; // Run after basic syntax validation

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;
  private usingAst = false;

  private totalCollectionElements = 0;
  private arrayAllocationCount = 0;
  private varAllocationElements = 0;
  private sawVarAllocation = false;
  private loopStack: Array<ForStatementNode | WhileStatementNode> = [];

  getDependencies(): string[] {
    return ['CoreValidator', 'SyntaxValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.astContext = this.getAstContext(config);
    this.usingAst = !!this.astContext?.ast;

    if (this.usingAst && this.astContext?.ast) {
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
    this.usingAst = false;
    this.totalCollectionElements = 0;
    this.arrayAllocationCount = 0;
    this.varAllocationElements = 0;
    this.sawVarAllocation = false;
    this.loopStack = [];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AST validation
  // ──────────────────────────────────────────────────────────────────────────

  private validateWithAst(program: ProgramNode): void {
    this.loopStack = [];

    visit(program, {
      CallExpression: {
        enter: (path: NodePath<CallExpressionNode>) => {
          this.processAllocationCall(path);
        },
      },
      ForStatement: {
        enter: (path: NodePath<ForStatementNode>) => {
          this.enterLoop(path);
        },
        exit: () => {
          this.exitLoop();
        },
      },
      WhileStatement: {
        enter: (path: NodePath<WhileStatementNode>) => {
          this.enterLoop(path);
        },
        exit: () => {
          this.exitLoop();
        },
      },
    });

    this.finalizeAstMemoryDiagnostics();
  }

  private processAllocationCall(path: NodePath<CallExpressionNode>): void {
    const node = path.node;
    if (node.callee.kind !== 'MemberExpression') {
      return;
    }

    const member = node.callee as MemberExpressionNode;
    if (member.computed || member.property.kind !== 'Identifier') {
      return;
    }

    const namespace = this.getIdentifierName(member.object);
    if (!namespace) {
      return;
    }

    const method = member.property.name;
    const isVarDeclaration = this.isVarDeclaration(path);

    if (namespace === 'array' && method.startsWith('new')) {
      this.arrayAllocationCount++;

      const sizeArgument = node.args[0] ?? null;
      const sizeValue = sizeArgument ? this.extractNumericLiteral(sizeArgument.value) : null;

      if (sizeValue !== null) {
        this.totalCollectionElements += sizeValue;
      }

      if (sizeValue !== null && sizeValue > 50000) {
        const { line, column } = node.loc.start;
        this.addWarning(
          line,
          column,
          `Large array allocation detected: ${sizeValue} elements. Consider using smaller arrays or alternative data structures.`,
          'PSV6-MEMORY-ARRAYS',
          'Consider using smaller arrays or alternative data structures',
        );
      }

      if (isVarDeclaration) {
        this.sawVarAllocation = true;
        if (sizeValue !== null) {
          this.varAllocationElements += sizeValue;
          if (sizeValue >= 50000) {
            const { line, column } = node.loc.start;
            this.addError(line, column, 'Type issue detected due to large array allocation', 'PSV6-ENUM-UNDEFINED-TYPE');
          }
        }
      }

      return;
    }

    if (namespace === 'matrix' && method === 'new') {
      const rowArgument = node.args[0] ?? null;
      const colArgument = node.args[1] ?? null;
      const rows = rowArgument ? this.extractNumericLiteral(rowArgument.value) : null;
      const cols = colArgument ? this.extractNumericLiteral(colArgument.value) : null;

      if (rows !== null && cols !== null) {
        const total = rows * cols;
        this.totalCollectionElements += total;

        if (total > 50000) {
          const { line, column } = node.loc.start;
          this.addWarning(
            line,
            column,
            `Large matrix allocation detected: ${rows}x${cols} = ${total} elements. Consider using smaller matrices.`,
            'PSV6-MEMORY-ARRAYS',
            'Consider using smaller matrices or alternative data structures',
          );
        }

        if (isVarDeclaration) {
          this.sawVarAllocation = true;
          this.varAllocationElements += total;
        }
      } else if (isVarDeclaration) {
        this.sawVarAllocation = true;
      }
    }
  }

  private finalizeAstMemoryDiagnostics(): void {
    if (this.totalCollectionElements >= 30000) {
      this.addWarning(
        1,
        1,
        `High total collection elements detected: ${this.totalCollectionElements}. This may impact performance.`,
        'PSV6-MEMORY-LARGE-COLLECTION',
        'Consider reducing the number of collection elements or using alternative approaches',
      );
    }

    if (this.sawVarAllocation && this.varAllocationElements >= 30000) {
      this.addError(1, 1, 'Type issue detected due to high total collection elements', 'PSV6-ENUM-UNDEFINED-TYPE');
    }

    if (this.arrayAllocationCount > 10) {
      this.addWarning(
        1,
        1,
        `Excessive array usage detected: ${this.arrayAllocationCount} arrays. This may impact performance.`,
        'PSV6-MEMORY-ARRAYS',
        'Consider reducing the number of arrays or using alternative data structures',
      );
    }
  }

  private enterLoop(path: NodePath<ForStatementNode | WhileStatementNode>): void {
    this.loopStack.push(path.node);

    const node = path.node;
    const test = node.kind === 'ForStatement' ? node.test : node.test;
    if (this.hasConditionalComplexity(test)) {
      const { line, column } = node.loc.start;
      this.addWarning(
        line,
        column,
        'Conditional complexity detected in loop bounds. This may impact performance.',
        'PSV6-PERF-NESTED-LOOPS',
        'Consider simplifying loop bounds or pre-calculating values',
      );
    }

    if (this.loopStack.length > 1) {
      const bound = node.kind === 'ForStatement'
        ? this.extractLoopBound((node as ForStatementNode).test)
        : this.extractLoopBound((node as WhileStatementNode).test);

      if (bound !== null && bound >= 1000) {
        const { line, column } = node.loc.start;
        this.addWarning(
          line,
          column,
          `Large loop bounds detected in nested loop: bound: ${bound}. This may impact performance.`,
          'PSV6-PERF-NESTED-LOOPS',
          'Consider reducing loop bounds or optimizing the algorithm',
        );
      }
    }
  }

  private exitLoop(): void {
    this.loopStack.pop();
  }

  private hasConditionalComplexity(expression: ExpressionNode | null): boolean {
    if (!expression) {
      return false;
    }

    let complex = false;

    visit(expression, {
      BinaryExpression: {
        enter: (path: NodePath<BinaryExpressionNode>) => {
          const operator = path.node.operator;
          if (operator === '&&' || operator === '||' || operator === 'and' || operator === 'or') {
            complex = true;
            return false;
          }
        },
      },
      ConditionalExpression: {
        enter: () => {
          complex = true;
          return false;
        },
      },
    });

    return complex;
  }

  private extractLoopBound(expression: ExpressionNode | null): number | null {
    if (!expression || expression.kind !== 'BinaryExpression') {
      return null;
    }

    const binary = expression as BinaryExpressionNode;
    const rightValue = this.extractNumericLiteral(binary.right);
    if (rightValue !== null && this.containsIdentifier(binary.left)) {
      return rightValue;
    }

    const leftValue = this.extractNumericLiteral(binary.left);
    if (leftValue !== null && this.containsIdentifier(binary.right)) {
      return leftValue;
    }

    return null;
  }

  private containsIdentifier(expression: ExpressionNode): boolean {
    let found = false;
    visit(expression, {
      Identifier: {
        enter: () => {
          found = true;
          return false;
        },
      },
    });
    return found;
  }

  private extractNumericLiteral(expression: ExpressionNode): number | null {
    if (expression.kind === 'NumberLiteral') {
      return (expression as NumberLiteralNode).value;
    }

    if (expression.kind === 'UnaryExpression') {
      const unary = expression as UnaryExpressionNode;
      const value = this.extractNumericLiteral(unary.argument);
      if (value === null) {
        return null;
      }
      return unary.operator === '-' ? -value : value;
    }

    return null;
  }

  private getIdentifierName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }
    return null;
  }

  private isVarDeclaration(path: NodePath<CallExpressionNode>): boolean {
    const declarationAncestor = findAncestor(
      path,
      (ancestor): ancestor is NodePath<VariableDeclarationNode> => ancestor.node.kind === 'VariableDeclaration',
    );

    if (!declarationAncestor) {
      return false;
    }

    const declaration = declarationAncestor.node as VariableDeclarationNode;
    return declaration.declarationKind === 'var';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Legacy validation
  // ──────────────────────────────────────────────────────────────────────────

  private validateLegacy(): void {
    this.validateMemoryUsageLegacy();
    this.validateComputationalComplexityLegacy();
  }

  private validateMemoryUsageLegacy(): void {
    let totalCollectionElements = 0;
    let arrayCount = 0;
    const largeCollections: Array<{ line: number; size: number; type: string }> = [];
    let varAllocElements = 0;
    let sawVarAlloc = false;

    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      const arrayMatch = line.match(/array\.new<[^>]+>\s*\(\s*(\d+)\s*\)/);
      if (arrayMatch) {
        const size = parseInt(arrayMatch[1], 10);
        totalCollectionElements += size;
        arrayCount++;
        const isVarDecl = /^\s*var\b/.test(line);
        if (isVarDecl) {
          varAllocElements += size;
          sawVarAlloc = true;
        }

        if (size > 50000) {
          largeCollections.push({ line: lineNum, size, type: 'array' });
          this.addWarning(
            lineNum,
            1,
            `Large array allocation detected: ${size} elements. Consider using smaller arrays or alternative data structures.`,
            'PSV6-MEMORY-ARRAYS',
            'Consider using smaller arrays or alternative data structures',
          );
        }

        if (isVarDecl && size >= 50000) {
          this.addError(lineNum, 1, 'Type issue detected due to large array allocation', 'PSV6-ENUM-UNDEFINED-TYPE');
        }
      }

      const arrayNoSizeMatch = line.match(/array\.new<[^>]+>\s*\(\s*\)/);
      if (arrayNoSizeMatch) {
        arrayCount++;
      }

      const matrixMatch = line.match(/matrix\.new<[^>]+>\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (matrixMatch) {
        const rows = parseInt(matrixMatch[1], 10);
        const cols = parseInt(matrixMatch[2], 10);
        const totalElements = rows * cols;
        totalCollectionElements += totalElements;
        const isVarDecl = /^\s*var\b/.test(line);
        if (isVarDecl) {
          varAllocElements += totalElements;
          sawVarAlloc = true;
        }

        if (totalElements > 50000) {
          largeCollections.push({ line: lineNum, size: totalElements, type: 'matrix' });
          this.addWarning(
            lineNum,
            1,
            `Large matrix allocation detected: ${rows}x${cols} = ${totalElements} elements. Consider using smaller matrices.`,
            'PSV6-MEMORY-ARRAYS',
            'Consider using smaller matrices or alternative data structures',
          );
        }
      }
    }

    if (totalCollectionElements >= 30000) {
      this.addWarning(
        1,
        1,
        `High total collection elements detected: ${totalCollectionElements}. This may impact performance.`,
        'PSV6-MEMORY-LARGE-COLLECTION',
        'Consider reducing the number of collection elements or using alternative approaches',
      );
    }

    if (sawVarAlloc && varAllocElements >= 30000) {
      this.addError(1, 1, 'Type issue detected due to high total collection elements', 'PSV6-ENUM-UNDEFINED-TYPE');
    }

    if (arrayCount > 10) {
      this.addWarning(
        1,
        1,
        `Excessive array usage detected: ${arrayCount} arrays. This may impact performance.`,
        'PSV6-MEMORY-ARRAYS',
        'Consider reducing the number of arrays or using alternative data structures',
      );
    }
  }

  private validateComputationalComplexityLegacy(): void {
    const loopStack: number[] = [];

    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;
      const indent = this.getLineIndentation(line);

      const isLoop = /^\s*(for|while)\b/.test(line);
      if (isLoop) {
        loopStack.push(indent);

        if (this.hasConditionalComplexityLegacy(line)) {
          this.addWarning(
            lineNum,
            1,
            'Conditional complexity detected in loop bounds. This may impact performance.',
            'PSV6-PERF-NESTED-LOOPS',
            'Consider simplifying loop bounds or pre-calculating values',
          );
        }
      }

      while (loopStack.length > 0 && indent < loopStack[loopStack.length - 1]) {
        loopStack.pop();
      }

      if (loopStack.length > 1) {
        const largeBounds = this.detectLargeLoopBoundsLegacy(line);
        if (largeBounds) {
          this.addWarning(
            lineNum,
            1,
            `Large loop bounds detected in nested loop: ${largeBounds}. This may impact performance.`,
            'PSV6-PERF-NESTED-LOOPS',
            'Consider reducing loop bounds or optimizing the algorithm',
          );
        }
      }
    }
  }

  private hasConditionalComplexityLegacy(line: string): boolean {
    const complexConditionPattern = /(?:if|for|while)\s*\([^)]*(?:&&|\|\||\?|:)[^)]*\)/;
    const ternaryPattern = /\?.*:/;
    return complexConditionPattern.test(line) || ternaryPattern.test(line);
  }

  private detectLargeLoopBoundsLegacy(line: string): string | null {
    const forMatch = line.match(/for\s+[^=]+\s*=\s*\d+\s+to\s+(\d+)/);
    if (forMatch) {
      const bound = parseInt(forMatch[1], 10);
      if (bound >= 1000) {
        return `bound: ${bound}`;
      }
    }

    const whileMatch = line.match(/while\s+[^<>=]+[<>=]\s*(\d+)/);
    if (whileMatch) {
      const bound = parseInt(whileMatch[1], 10);
      if (bound >= 1000) {
        return `bound: ${bound}`;
      }
    }

    return null;
  }

  private getLineIndentation(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  private addError(line: number, column: number, message: string, code: string, suggestion?: string): void {
    this.errors.push({
      line,
      column,
      message,
      code,
      suggestion,
      severity: 'error',
    });
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

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({
      line,
      column,
      message,
      code,
      severity: 'info',
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
