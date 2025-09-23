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
  private config!: ValidatorConfig;
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private astContext: AstValidationContext | null = null;
  private usingAst = false;

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

  // ──────────────────────────────────────────────────────────────────────────
  // AST validation
  // ──────────────────────────────────────────────────────────────────────────
  private validateWithAst(program: ProgramNode): void {
    this.validateScriptComplexityAst(program);
    this.validateFunctionMetricsAst(program);
    this.validateNestingDepthAst(program);
  }

  private validateScriptComplexityAst(program: ProgramNode): void {
    const complexity = this.calculateScriptComplexityAst(program);
    if (complexity > 8) {
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
          if (complexity > 8) {
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
    if (depth > 3) {
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
  // Legacy validation
  // ──────────────────────────────────────────────────────────────────────────
  private validateLegacy(): void {
    const lines = this.context.lines;
    this.validateCyclomaticComplexityLegacy(lines);
    this.validateNestingDepthLegacy(lines);
    this.validateFunctionLengthLegacy(lines);
  }

  private validateCyclomaticComplexityLegacy(lines: string[]): void {
    let scriptComplexity = 0;
    let currentFunctionComplexity = 0;
    let currentFunctionName = '';
    let currentFunctionStartLine = 0;
    let inFunction = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const indent = this.getLineIndentation(line);

      if (this.isFunctionStart(line)) {
        if (inFunction && currentFunctionComplexity > 8) {
          this.addWarning(
            currentFunctionStartLine,
            1,
            `Function '${currentFunctionName}' has high cyclomatic complexity (${currentFunctionComplexity}). Consider breaking it into smaller functions.`,
            'PSV6-QUALITY-COMPLEXITY',
            'Refactor function to reduce complexity below 8',
          );
        }

        const funcMatch = line.match(/(\w+)\s*\(/);
        currentFunctionName = funcMatch ? funcMatch[1] : 'anonymous';
        currentFunctionStartLine = lineNum;
        currentFunctionComplexity = 0;
        inFunction = true;
      }

      if (inFunction && indent === 0 && line.trim() !== '') {
        if (currentFunctionComplexity > 8) {
          this.addWarning(
            currentFunctionStartLine,
            1,
            `Function '${currentFunctionName}' has high cyclomatic complexity (${currentFunctionComplexity}). Consider breaking it into smaller functions.`,
            'PSV6-QUALITY-COMPLEXITY',
            'Refactor function to reduce complexity below 8',
          );
        }
        inFunction = false;
        currentFunctionComplexity = 0;
      }

      const lineComplexity = this.getLineComplexity(line);
      scriptComplexity += lineComplexity;
      if (inFunction) {
        currentFunctionComplexity += lineComplexity;
      }
    }

    if (scriptComplexity > 8) {
      this.addWarning(
        1,
        0,
        `Script has high cyclomatic complexity (${scriptComplexity}). Consider breaking it into smaller functions.`,
        'PSV6-QUALITY-COMPLEXITY',
        'Refactor script to reduce complexity below 8',
      );
    }
  }

  private validateNestingDepthLegacy(lines: string[]): void {
    const indentStack: number[] = [0];
    let maxDepth = 0;
    let deepestLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const indent = this.getLineIndentation(line);

      if (line.trim() === '') {
        continue;
      }

      if (indent > indentStack[indentStack.length - 1]) {
        indentStack.push(indent);
      } else if (indent < indentStack[indentStack.length - 1]) {
        while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]) {
          indentStack.pop();
        }
      }

      const currentDepth = indentStack.length - 1;
      if (currentDepth > maxDepth) {
        maxDepth = currentDepth;
        deepestLine = lineNum;
      }
    }

    if (maxDepth > 3) {
      this.addWarning(
        deepestLine,
        0,
        `Excessive nesting depth detected (${maxDepth} levels). Consider extracting nested logic into separate functions.`,
        'PSV6-QUALITY-DEPTH',
        'Refactor nested code to reduce depth below 3 levels',
      );
    }
  }

  private validateFunctionLengthLegacy(lines: string[]): void {
    let currentFunctionStartLine = 0;
    let currentFunctionName = '';
    let inFunction = false;
    let functionLineCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const indent = this.getLineIndentation(line);

      if (this.isFunctionStart(line)) {
        if (inFunction && functionLineCount > 50) {
          this.addWarning(
            currentFunctionStartLine,
            1,
            `Function '${currentFunctionName}' is very long (${functionLineCount} lines). Consider breaking it into smaller functions.`,
            'PSV6-QUALITY-LENGTH',
            'Refactor function to reduce length below 50 lines',
          );
        }

        const funcMatch = line.match(/(\w+)\s*\(/);
        currentFunctionName = funcMatch ? funcMatch[1] : 'anonymous';
        currentFunctionStartLine = lineNum;
        functionLineCount = 1;
        inFunction = true;
      } else if (inFunction) {
        if (indent === 0 && line.trim() !== '') {
          if (functionLineCount > 50) {
            this.addWarning(
              currentFunctionStartLine,
              1,
              `Function '${currentFunctionName}' is very long (${functionLineCount} lines). Consider breaking it into smaller functions.`,
              'PSV6-QUALITY-LENGTH',
              'Refactor function to reduce length below 50 lines',
            );
          }
          inFunction = false;
          functionLineCount = 0;
        } else {
          functionLineCount += 1;
        }
      }
    }

    if (inFunction && functionLineCount > 50) {
      this.addWarning(
        currentFunctionStartLine,
        1,
        `Function '${currentFunctionName}' is very long (${functionLineCount} lines). Consider breaking it into smaller functions.`,
        'PSV6-QUALITY-LENGTH',
        'Refactor function to reduce length below 50 lines',
      );
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
    this.usingAst = false;
  }

  private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  private isFunctionStart(line: string): boolean {
    return /^\s*\w+\s*\([^)]*\)\s*=>/.test(line);
  }

  private getLineComplexity(line: string): number {
    let complexity = 0;

    if (/\bif\b/.test(line)) complexity++;
    if (/\belse\b/.test(line)) complexity++;
    if (/\bfor\b/.test(line)) complexity++;
    if (/\bwhile\b/.test(line)) complexity++;
    if (/\bswitch\b/.test(line)) complexity++;
    if (/\bcase\b/.test(line)) complexity++;

    if (/\band\b/.test(line)) complexity++;
    if (/\bor\b/.test(line)) complexity++;

    if (/\?/.test(line)) complexity++;

    return complexity;
  }

  private getLineIndentation(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    return isAstValidationContext(this.context) && this.context.ast ? (this.context as AstValidationContext) : null;
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
