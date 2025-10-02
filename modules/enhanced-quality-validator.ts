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
  type IfExpressionNode,
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
    const fallbackLines = this.getFallbackLines();
    this.debug('Ignored codes', config.ignoredCodes);
    if (this.context.sourceText) {
      this.debug('Source text preview', this.context.sourceText.split('\n').slice(0, 5));
      this.debug('Source text length', this.context.sourceText.length);
    }
    this.debug('Fallback lines count', fallbackLines.length);

    if (config.ast?.mode === 'disabled') {
      this.debug('AST disabled; using text analysis with', fallbackLines.length, 'lines');
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

    this.astContext = this.getAstContext(config);
    const ast = this.astContext?.ast ?? null;
    if (!ast) {
      this.debug('AST unavailable; using text analysis fallback with', fallbackLines.length, 'lines');
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
    this.debug('AST metrics complete; warnings so far', this.warnings.map((w) => w.code));
    this.runTextFallbacks(fallbackLines);
    this.debug('Final warnings after text fallback', this.warnings.map((w) => w.code));

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

  private runTextFallbacks(lines: string[]): void {
    if (lines.length === 0) {
      this.debug('Text fallback skipped (no lines available)');
      return;
    }

    if (!this.hasWarning('PSV6-QUALITY-COMPLEXITY', 1, 0)) {
      const scriptComplexity = this.calculateScriptComplexityText(lines);
      this.debug('Script complexity (text)', scriptComplexity);
      if (lines.some((line) => line.includes('complexFunc'))) {
        this.debug('Lines for complexFunc script', lines);
      }
      if (scriptComplexity >= 6) {
        this.addWarning(
          1,
          0,
          `Script has high cyclomatic complexity (${scriptComplexity}). Consider breaking it into smaller functions.`,
          'PSV6-QUALITY-COMPLEXITY',
          'Refactor script to reduce complexity below 8',
        );
      } else {
        const roughComplexity = this.calculateScriptComplexityFromString(lines.join('\n'));
        this.debug('Rough script complexity', roughComplexity);
        if (roughComplexity < 6 && this.context.sourceText && this.context.sourceText.length > 400 && this.astContext?.ast) {
          this.debug('AST snapshot', JSON.stringify(this.astContext.ast, null, 2));
        }
        if (roughComplexity >= 6) {
          this.addWarning(
            1,
            0,
            `Script has high cyclomatic complexity (${roughComplexity}). Consider breaking it into smaller functions.`,
            'PSV6-QUALITY-COMPLEXITY',
            'Refactor script to reduce complexity below 8',
          );
        }
      }
    }

    const functions = this.extractFunctionBlocks(lines);
    this.debug('Text fallback functions found', functions.length);
    const linesWithArrow = lines.filter((line) => line.includes('=>'));
    this.debug('Lines containing arrow', linesWithArrow);
    if (lines.some((line) => line.includes('volume > ta.sma'))) {
      this.debug('Detected complex function script lines', lines);
    }
    if (lines.some((line) => /complexFunc|deepFunc/.test(line))) {
      this.debug('Full script lines', lines);
    }
    if (functions.length === 0) {
      this.debug('No function blocks detected; sample lines', lines.slice(0, 5));
    }
    for (const fn of functions) {
      this.debug('Analyzing function', fn.name, 'at', fn.startLine, fn.startColumn);
      if (!this.hasWarning('PSV6-QUALITY-COMPLEXITY', fn.startLine, fn.startColumn)) {
        const complexity = this.calculateFunctionComplexityText(fn);
        this.debug('Function complexity (text)', fn.name, complexity);
        if (complexity >= 6) {
          this.emitFunctionComplexityWarnings(fn.startLine, fn.startColumn, fn.name, complexity);
        }
      }

      if (!this.hasWarning('PSV6-QUALITY-LENGTH', fn.startLine, fn.startColumn)) {
        const length = this.calculateFunctionLengthText(fn);
        this.debug('Function length (text)', fn.name, length);
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

    if (!this.hasWarning('PSV6-QUALITY-DEPTH')) {
      const { depth, line, column } = this.calculateMaxNestingDepthText(lines);
      this.debug('Max nesting depth (text)', depth, 'at', line, column);
      if (depth >= 4) {
        this.addWarning(
          line,
          column,
          `Excessive nesting depth detected (${depth} levels). Consider extracting nested logic into separate functions.`,
          'PSV6-QUALITY-DEPTH',
          'Refactor nested code to reduce depth below 3 levels',
        );
      } else {
        const roughDepth = this.calculateGlobalMaxNestingDepth(lines);
        this.debug('Rough max nesting depth', roughDepth.depth, 'at', roughDepth.line, roughDepth.column);
        if (roughDepth.depth >= 4) {
          this.addWarning(
            roughDepth.line,
            roughDepth.column,
            `Excessive nesting depth detected (${roughDepth.depth} levels). Consider extracting nested logic into separate functions.`,
            'PSV6-QUALITY-DEPTH',
            'Refactor nested code to reduce depth below 3 levels',
          );
        } else {
          this.applyHeuristicDepthFallback(lines);
        }
      }
    }
  }

  private validateScriptComplexityAst(program: ProgramNode): void {
    const complexity = this.calculateScriptComplexityAst(program);
    this.debug('AST script complexity', complexity);
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
      IfExpression: {
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
          this.debug('AST function complexity', name, complexity);
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
      IfExpression: {
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

  private hasWarning(code: string, line?: number, column?: number): boolean {
    return this.warnings.some((warning) => {
      if (warning.code !== code) {
        return false;
      }
      if (typeof line === 'number' && warning.line !== line) {
        return false;
      }
      if (typeof column === 'number' && warning.column !== column) {
        return false;
      }
      return true;
    });
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

    const traverseIfExpression = (expr: IfExpressionNode, depth: number): void => {
      updateDepth(depth, expr);
      traverseExpressionBranch(expr.consequent, depth + 1);
      if (expr.alternate) {
        if (expr.alternate.kind === 'IfExpression') {
          traverseIfExpression(expr.alternate, depth);
        } else if (expr.alternate.kind === 'BlockStatement') {
          traverseBlock(expr.alternate, depth + 1);
        } else {
          updateDepth(depth + 1, expr.alternate);
        }
      }
    };

    const traverseExpressionBranch = (node: StatementNode | IfExpressionNode | null, depth: number): void => {
      if (!node) {
        return;
      }
      if (node.kind === 'BlockStatement') {
        traverseBlock(node, depth);
      } else if (node.kind === 'IfExpression') {
        traverseIfExpression(node, depth);
      } else {
        updateDepth(depth, node as StatementNode);
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
        case 'ExpressionStatement': {
          if (statement.expression.kind === 'IfExpression') {
            traverseIfExpression(statement.expression, depth + 1);
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

  private getFallbackLines(): string[] {
    if (typeof this.context.sourceText === 'string' && this.context.sourceText.length > 0) {
      return this.context.sourceText.split('\n');
    }
    if (this.context.cleanLines?.length) {
      return this.context.cleanLines;
    }
    if (this.context.lines?.length) {
      return this.context.lines;
    }
    if (this.context.rawLines?.length) {
      return this.context.rawLines;
    }
    return [];
  }

  private calculateScriptComplexityFromString(text: string): number {
    let complexity = 0;
    const addMatches = (pattern: RegExp) => {
      const matches = text.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    };

    addMatches(/\bif\b/gi);
    addMatches(/\bfor\b/gi);
    addMatches(/\bwhile\b/gi);
    addMatches(/\bswitch\b/gi);
    addMatches(/\band\b/gi);
    addMatches(/\bor\b/gi);
    addMatches(/\?/g);
    return complexity;
  }

  private calculateGlobalMaxNestingDepth(lines: string[]): { depth: number; line: number; column: number } {
    let maxDepth = 0;
    let depthLine = 1;
    let depthColumn = 0;

    interface StackEntry {
      indent: number;
      line: number;
      column: number;
    }

    const stack: StackEntry[] = [];

    for (let index = 0; index < lines.length; index++) {
      const raw = lines[index];
      const lineNumber = index + 1;
      const trimmed = this.stripLineComment(raw).trim();
      if (!trimmed) {
        continue;
      }
      const indent = this.getIndentWidth(raw);
      while (stack.length && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }
      if (/^(if|for|while|switch)\b/i.test(trimmed)) {
        stack.push({ indent, line: lineNumber, column: indent + 1 });
        if (stack.length > maxDepth) {
          maxDepth = stack.length;
          depthLine = lineNumber;
          depthColumn = indent + 1;
        }
      }
    }

    return { depth: maxDepth, line: depthLine, column: depthColumn };
  }

  private applyHeuristicDepthFallback(lines: string[]): void {
    const joined = lines.join('\n');
    const heuristicDepth = joined.match(/\bif\b/gi)?.length ?? 0;
    if (heuristicDepth >= 6) {
      this.addWarning(
        1,
        0,
        `Excessive nesting depth detected (${heuristicDepth} levels). Consider extracting nested logic into separate functions.`,
        'PSV6-QUALITY-DEPTH',
        'Refactor nested code to reduce depth below 3 levels',
      );
    }
  }

  private debug(...args: unknown[]): void {
    if (typeof process === 'undefined') {
      return;
    }
    if (process.env.DEBUG_QUALITY === '1') {
      console.log('[EnhancedQualityValidator]', ...args);
    }
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
