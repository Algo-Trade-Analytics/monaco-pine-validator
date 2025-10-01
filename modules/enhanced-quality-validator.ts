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

interface TextFunctionBlock {
  name: string;
  startLine: number;
  startColumn: number;
  indent: number;
  body: Array<{ text: string; lineNumber: number; indent: number }>;
}

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

    if (config.ast?.mode === 'disabled') {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: context.scriptType ?? null,
      };
    }

    this.astContext = this.getAstContext(config);
    const ast = this.astContext?.ast ?? null;
    if (!ast) {
      const fallbackLines = this.context.cleanLines?.length
        ? this.context.cleanLines
        : this.context.lines ?? [];
      if (fallbackLines.length > 0) {
        this.validateWithText(fallbackLines);
      }
      return {
        isValid: this.errors.length === 0,
        errors: this.errors,
        warnings: this.warnings,
        info: this.info,
        typeMap: new Map(),
        scriptType: context.scriptType ?? null,
      };
    }

    this.validateWithAst(ast);

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

  private validateWithText(lines: string[]): void {
    this.validateScriptComplexityText(lines);
    this.validateFunctionMetricsText(lines);
    this.validateNestingDepthText(lines);
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
            this.emitFunctionComplexityWarnings(
              anchor.loc.start.line,
              anchor.loc.start.column,
              name,
              complexity,
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

  private validateScriptComplexityText(lines: string[]): void {
    const complexity = this.calculateScriptComplexityText(lines);
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

  private calculateScriptComplexityText(lines: string[]): number {
    let complexity = 0;
    for (const rawLine of lines) {
      const line = this.stripLineComment(rawLine);
      if (!line) {
        continue;
      }
      const tokens = line.split(/\b/);
      for (const token of tokens) {
        switch (token.trim()) {
          case 'if':
          case 'for':
          case 'while':
          case 'switch':
            complexity += 1;
            break;
          default:
            break;
        }
      }
      if (/(?:\sand\s|\sor\s)/.test(line)) {
        complexity += 1;
      }
      if (line.includes('?') && line.includes(':')) {
        complexity += 1;
      }
    }
    return complexity;
  }

  private validateFunctionMetricsText(lines: string[]): void {
    const functions = this.extractFunctionBlocks(lines);
    for (const fn of functions) {
      const complexity = this.calculateFunctionComplexityText(fn);
      if (complexity >= 6) {
        this.emitFunctionComplexityWarnings(fn.startLine, fn.startColumn, fn.name, complexity);
      }

      const length = this.calculateFunctionLengthText(fn);
      if (length > 50) {
        this.addWarning(
          fn.startLine,
          fn.startColumn,
          `Function '${fn.name}' is very long (${length} lines). Consider breaking it into smaller functions.`,
          'PSV6-QUALITY-LENGTH',
          'Refactor function to reduce length below 50 lines',
        );
      }
    }
  }

  private emitFunctionComplexityWarnings(line: number, column: number, name: string, complexity: number): void {
    this.addWarning(
      line,
      column,
      `Function '${name}' has high cyclomatic complexity (${complexity}). Consider breaking it into smaller functions.`,
      'PSV6-QUALITY-COMPLEXITY',
      'Refactor function to reduce complexity below 8',
    );

    if (!this.hasWarning('PSV6-STYLE-COMPLEXITY', line, column)) {
      this.warnings.push({
        line,
        column,
        message: `Function '${name}' has high complexity (${complexity}). Consider breaking it into smaller functions.`,
        severity: 'warning',
        code: 'PSV6-STYLE-COMPLEXITY',
        suggestion: 'Consider breaking down complex functions into smaller routines.',
      });
    }
  }

  private hasWarning(code: string, line: number, column: number): boolean {
    return this.warnings.some((warning) => warning.code === code && warning.line === line && warning.column === column);
  }

  private calculateFunctionComplexityText(fn: TextFunctionBlock): number {
    let complexity = 0;
    for (const entry of fn.body) {
      const line = this.stripLineComment(entry.text);
      if (!line) {
        continue;
      }
      if (/\b(if|for|while|switch)\b/.test(line)) {
        complexity += 1;
      }
      if (/(?:\sand\s|\sor\s)/.test(line)) {
        complexity += 1;
      }
      if (line.includes('?') && line.includes(':')) {
        complexity += 1;
      }
    }
    return complexity;
  }

  private calculateFunctionLengthText(fn: TextFunctionBlock): number {
    let count = 0;
    for (const entry of fn.body) {
      if (entry.text.trim().length > 0) {
        count += 1;
      }
    }
    return count;
  }

  private validateNestingDepthText(lines: string[]): void {
    const { depth, line, column } = this.calculateMaxNestingDepthText(lines);
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

  private calculateMaxNestingDepthText(lines: string[]): { depth: number; line: number; column: number } {
    let maxDepth = 0;
    let depthLine = 1;
    let depthColumn = 0;

    interface StackEntry {
      indent: number;
      line: number;
      column: number;
    }

    const stack: StackEntry[] = [];

    const functions = this.extractFunctionBlocks(lines);
    for (const fn of functions) {
      stack.length = 0;
      for (const entry of fn.body) {
        const trimmed = this.stripLineComment(entry.text).trim();
        if (!trimmed) {
          continue;
        }
        const indent = entry.indent;
        while (stack.length && indent <= stack[stack.length - 1].indent) {
          stack.pop();
        }
        if (/^(if|for|while|switch)\b/.test(trimmed)) {
          stack.push({ indent, line: entry.lineNumber, column: indent + 1 });
          if (stack.length > maxDepth) {
            maxDepth = stack.length;
            depthLine = entry.lineNumber;
            depthColumn = indent + 1;
          }
        }
      }
    }

    return { depth: maxDepth, line: depthLine, column: depthColumn };
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

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (config.ast && config.ast.mode === 'disabled') {
      return null;
    }
    if (!isAstValidationContext(this.context) || !this.context.ast) {
      return null;
    }
    return this.context as AstValidationContext;
  }

  private extractFunctionBlocks(lines: string[]): TextFunctionBlock[] {
    const blocks: TextFunctionBlock[] = [];
    const pattern = /^(\s*)([A-Za-z_][A-Za-z0-9_\.]*)\s*\([^)]*\)\s*=>\s*$/;
    const total = lines.length;

    let index = 0;
    while (index < total) {
      const line = lines[index];
      const match = pattern.exec(line);
      if (!match) {
        index += 1;
        continue;
      }

      const indent = this.getIndentWidth(match[1] ?? '');
      const name = match[2];
      const startLine = index + 1;
      const startColumn = indent + 1;

      const body: Array<{ text: string; lineNumber: number; indent: number }> = [];
      let cursor = index + 1;
      while (cursor < total) {
        const bodyLine = lines[cursor];
        const bodyIndent = this.getIndentWidth(bodyLine);
        const trimmed = bodyLine.trim();
        if (trimmed.length === 0) {
          body.push({ text: bodyLine, lineNumber: cursor + 1, indent: bodyIndent });
          cursor += 1;
          continue;
        }
        if (bodyIndent <= indent) {
          break;
        }
        body.push({ text: bodyLine, lineNumber: cursor + 1, indent: bodyIndent });
        cursor += 1;
      }

      blocks.push({ name, startLine, startColumn, indent, body });
      index = cursor;
    }

    return blocks;
  }

  private getIndentWidth(line: string): number {
    let width = 0;
    for (const char of line) {
      if (char === ' ') {
        width += 1;
      } else if (char === '\t') {
        width += 4;
      } else {
        break;
      }
    }
    return width;
  }

  private stripLineComment(line: string): string {
    const commentIndex = line.indexOf('//');
    if (commentIndex === -1) {
      return line;
    }
    return line.slice(0, commentIndex);
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
