/**
 * Enhanced Quality Validator Module
 *
 * Handles enhanced code quality validation for Pine Script v6:
 * - PSV6-QUALITY-COMPLEXITY: Cyclomatic complexity
 * - PSV6-QUALITY-DEPTH: Nesting depth warnings
 * - PSV6-QUALITY-LENGTH: Function length suggestions
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
  type BlockStatementNode,
  type FunctionDeclarationNode,
  type ProgramNode,
  type StatementNode,
  type SwitchCaseNode,
} from '../core/ast/nodes';
import { visit } from '../core/ast/traversal';

export class EnhancedQualityValidator implements ValidationModule {
  name = 'EnhancedQualityValidator';
  priority = 60; // Run after other validations

  private context!: ValidationContext;
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

    this.astContext = this.getAstContext(config);
    const ast = this.astContext?.ast;
    if (!ast) {
      this.validateWithText();
    } else {
      this.validateWithAst(ast);
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

  // ──────────────────────────────────────────────────────────────────────────
  // AST validation
  // ──────────────────────────────────────────────────────────────────────────
  private validateWithAst(program: ProgramNode): void {
    this.validateScriptComplexityAst(program);
    this.validateFunctionMetricsAst(program);
    this.validateNestingDepthAst(program);
  }

  private validateWithText(): void {
    const lines = this.getSourceLines();
    if (lines.length === 0) {
      return;
    }

    const complexity = this.calculateTextComplexity(lines);
    if (complexity >= 6) {
      this.addWarning(
        1,
        0,
        `Script has high cyclomatic complexity (${complexity}). Consider breaking it into smaller functions.`,
        'PSV6-QUALITY-COMPLEXITY',
        'Refactor script to reduce complexity below 8',
      );
    }

    const { depth, line } = this.calculateTextNestingDepth(lines);
    if (depth >= 4) {
      this.addWarning(
        line,
        1,
        `Excessive nesting depth detected (${depth} levels). Consider extracting nested logic into separate functions.`,
        'PSV6-QUALITY-DEPTH',
        'Refactor nested code to reduce depth below 3 levels',
      );
    }
  }

  private validateScriptComplexityAst(program: ProgramNode): void {
    const complexity = this.calculateScriptComplexityAst(program);
    if (complexity >= 6) {
      this.addWarning(
        1,
        0,
        `Script has high cyclomatic complexity (${complexity}). Consider breaking it into smaller functions.`,
        'PSV6-QUALITY-COMPLEXITY',
        'Refactor script to reduce complexity below 8',
      );
    }
  }

  private calculateScriptComplexityAst(program: ProgramNode): number {
    let complexity = 0;

    visit(program, {
      IfStatement: {
        enter: (path) => {
          complexity += 1;
          if (path.node.alternate) {
            complexity += 1;
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
      SwitchCase: {
        enter: (path) => {
          if (path.node.test) {
            complexity += 1;
          }
        },
      },
      ConditionalExpression: {
        enter: () => {
          complexity += 1;
        },
      },
      BinaryExpression: {
        enter: (binaryPath) => {
          const operator = binaryPath.node.operator;
          if (operator === 'and' || operator === 'or') {
            complexity += 1;
          }
        },
      },
    });

    return complexity;
  }

  private validateFunctionMetricsAst(program: ProgramNode): void {
    visit(program, {
      FunctionDeclaration: {
        enter: (path) => {
          const fn = path.node as FunctionDeclarationNode;
          const anchor = fn.identifier ?? fn;
          const name = fn.identifier?.name ?? 'anonymous';

          const complexity = this.calculateFunctionComplexityAst(fn);
          if (complexity >= 6) {
            this.addWarning(
              anchor.loc.start.line,
              anchor.loc.start.column,
              `Function '${name}' has high cyclomatic complexity (${complexity}). Consider breaking it into smaller functions.`,
              'PSV6-QUALITY-COMPLEXITY',
              'Refactor function to reduce complexity below 8',
            );
          }

          const length = this.calculateFunctionLengthAst(fn);
          if (length > 50) {
            this.addWarning(
              anchor.loc.start.line,
              anchor.loc.start.column,
              `Function '${name}' is very long (${length} lines). Consider breaking it into smaller functions.`,
              'PSV6-QUALITY-LENGTH',
              'Refactor function to reduce length below 50 lines',
            );
          }
        },
      },
    });
  }

  private calculateFunctionComplexityAst(fn: FunctionDeclarationNode): number {
    let complexity = 0;

    visit(fn.body, {
      IfStatement: {
        enter: (path) => {
          complexity += 1;
          if (path.node.alternate) {
            complexity += 1;
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
      SwitchCase: {
        enter: (path) => {
          if (path.node.test) {
            complexity += 1;
          }
        },
      },
      ConditionalExpression: {
        enter: () => {
          complexity += 1;
        },
      },
      BinaryExpression: {
        enter: (binaryPath) => {
          const operator = binaryPath.node.operator;
          if (operator === 'and' || operator === 'or') {
            complexity += 1;
          }
        },
      },
      FunctionDeclaration: {
        enter: () => 'skip',
      },
    });

    return complexity;
  }

  private calculateFunctionLengthAst(fn: FunctionDeclarationNode): number {
    const startLine = fn.body.loc.start.line;
    const endLine = fn.body.loc.end.line;
    if (endLine < startLine) {
      return 0;
    }
    return endLine - startLine + 1;
  }

  private validateNestingDepthAst(program: ProgramNode): void {
    const { depth, line, column } = this.calculateMaxNestingDepthAst(program);
    if (depth >= 4) {
      this.addWarning(
        line,
        column,
        `Excessive nesting depth detected (${depth} levels). Consider extracting nested logic into separate functions.`,
        'PSV6-QUALITY-DEPTH',
        'Refactor nested code to reduce depth below 3 levels',
      );
    }
  }

  private calculateMaxNestingDepthAst(program: ProgramNode): { depth: number; line: number; column: number } {
    let maxDepth = 0;
    let line = 1;
    let column = 0;

    const updateDepth = (depth: number, node: StatementNode | SwitchCaseNode | BlockStatementNode) => {
      if (depth > maxDepth) {
        maxDepth = depth;
        line = node.loc.start.line;
        column = node.loc.start.column;
      }
    };

    const traverseBlock = (block: BlockStatementNode | null, depth: number): void => {
      if (!block) {
        return;
      }
      updateDepth(depth, block);
      for (const statement of block.body) {
        traverseStatement(statement, depth);
      }
    };

    const traverseStatement = (statement: StatementNode | null, depth: number): void => {
      if (!statement) {
        return;
      }

      updateDepth(depth, statement);

      switch (statement.kind) {
        case 'BlockStatement': {
          traverseBlock(statement, depth);
          break;
        }
        case 'IfStatement': {
          traverseStatement(statement.consequent, depth + 1);
          if (statement.alternate) {
            if (statement.alternate.kind === 'IfStatement') {
              traverseStatement(statement.alternate, depth);
            } else {
              traverseStatement(statement.alternate, depth + 1);
            }
          }
          break;
        }
        case 'ForStatement': {
          traverseBlock(statement.body, depth + 1);
          break;
        }
        case 'WhileStatement': {
          traverseBlock(statement.body, depth + 1);
          break;
        }
        case 'SwitchStatement': {
          for (const caseNode of statement.cases) {
            const caseDepth = depth + 1;
            updateDepth(caseDepth, caseNode);
            for (const consequent of caseNode.consequent) {
              traverseStatement(consequent, caseDepth + 1);
            }
          }
          break;
        }
        case 'FunctionDeclaration': {
          traverseBlock(statement.body, depth + 1);
          break;
        }
        default:
          break;
      }
    };

    for (const statement of program.body) {
      traverseStatement(statement, 0);
    }

    return { depth: maxDepth, line, column };
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

  private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  private getSourceLines(): string[] {
    if (Array.isArray(this.context.cleanLines) && this.context.cleanLines.length > 0) {
      return [...this.context.cleanLines];
    }
    if (Array.isArray(this.context.lines) && this.context.lines.length > 0) {
      return [...this.context.lines];
    }
    if (Array.isArray(this.context.rawLines) && this.context.rawLines.length > 0) {
      return [...this.context.rawLines];
    }
    return [];
  }

  private stripInlineComment(line: string): string {
    const idx = line.indexOf('//');
    return idx >= 0 ? line.slice(0, idx) : line;
  }

  private calculateTextComplexity(lines: string[]): number {
    let complexity = 0;
    const controlPattern = /^(?:if|else\s+if|for|while|switch)\b/i;

    for (const rawLine of lines) {
      const line = this.stripInlineComment(rawLine).trim();
      if (!line) {
        continue;
      }

      if (controlPattern.test(line)) {
        complexity += 1;
        if (/^else\s+if\b/i.test(line)) {
          complexity += 1;
        }
      }

      if (line.includes('?') && line.includes(':')) {
        complexity += 1;
      }

      if (/\b(?:and|or)\b/.test(line)) {
        complexity += 1;
      }
    }

    return complexity;
  }

  private calculateTextNestingDepth(lines: string[]): { depth: number; line: number } {
    const stack: number[] = [];
    let maxDepth = 0;
    let depthLine = 1;

    lines.forEach((rawLine, index) => {
      const withoutComment = this.stripInlineComment(rawLine);
      const trimmed = withoutComment.trim();
      if (!trimmed) {
        return;
      }

      const indent = withoutComment.length - withoutComment.replace(/^[\s\t]*/, '').length;

      while (stack.length > 0 && indent <= stack[stack.length - 1]) {
        stack.pop();
      }

      if (/^(?:if|else\s+if|for|while|switch)\b/i.test(trimmed)) {
        stack.push(indent);
        if (stack.length > maxDepth) {
          maxDepth = stack.length;
          depthLine = index + 1;
        }
      }
    });

    return { depth: maxDepth, line: depthLine };
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (config.ast && config.ast.mode === 'disabled') {
      return null;
    }
    if (!isAstValidationContext(this.context) || !this.context.ast) {
      return null;
    }
    return this.context as AstValidationContext;
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
