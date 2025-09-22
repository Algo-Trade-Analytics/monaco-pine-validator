/**
 * Performance analysis module for Pine Script v6
 * Handles performance optimization suggestions, memory usage analysis, and computational complexity
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
  type CallExpressionNode,
  type ExpressionNode,
  type ForStatementNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type NumberLiteralNode,
  type ProgramNode,
  type UnaryExpressionNode,
  type WhileStatementNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';

interface LoopInfo {
  node: ForStatementNode | WhileStatementNode;
  maxDepth: number;
}

export class PerformanceValidator implements ValidationModule {
  name = 'PerformanceValidator';

  private errors: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;
  private usingAst = false;

  private loopStack: LoopInfo[] = [];
  private controlDepth = 1;
  private maxNestingDepth = 1;

  private arrayAllocationCount = 0;
  private matrixAllocationCount = 0;
  private mapAllocationCount = 0;

  private requestCallCount = 0;
  private plotCallCount = 0;
  private alertCallCount = 0;

  private expensiveFunctionCounts: Map<string, number> = new Map();
  private duplicateExpensiveWarnings: Set<string> = new Set();

  getDependencies(): string[] {
    return ['SyntaxValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    if (!config.enablePerformanceAnalysis) {
      return {
        isValid: this.errors.length === 0,
        errors: this.errors,
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: null,
      };
    }

    this.astContext = this.getAstContext(config);
    this.usingAst = !!this.astContext?.ast;

    if (this.usingAst && this.astContext?.ast) {
      this.collectPerformanceDataAst(this.astContext.ast);
      this.finalizeAstDiagnostics();
    } else {
      this.runLegacyAnalysis(context);
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: [],
      info: [],
      typeMap: new Map(),
      scriptType: null,
    };
  }

  private runLegacyAnalysis(context: ValidationContext): void {
    this.analyzeMemoryUsage(context, this.errors);
    this.analyzeComputationalComplexity(context, this.errors);
    this.analyzeExpensiveOperations(context, this.errors);
    this.analyzeResourceUsage(context, this.errors);
  }

  private collectPerformanceDataAst(program: ProgramNode): void {
    this.loopStack = [];
    this.controlDepth = 1;
    this.maxNestingDepth = 1;
    this.expensiveFunctionCounts.clear();
    this.duplicateExpensiveWarnings.clear();
    this.arrayAllocationCount = 0;
    this.matrixAllocationCount = 0;
    this.mapAllocationCount = 0;
    this.requestCallCount = 0;
    this.plotCallCount = 0;
    this.alertCallCount = 0;

    visit(program, {
      BlockStatement: {
        enter: () => {
          this.controlDepth++;
          this.maxNestingDepth = Math.max(this.maxNestingDepth, this.controlDepth);
        },
        exit: () => {
          this.controlDepth = Math.max(1, this.controlDepth - 1);
        },
      },
      ForStatement: {
        enter: (path) => {
          this.enterLoop((path as NodePath<ForStatementNode>).node);
        },
        exit: () => {
          this.exitLoop();
        },
      },
      WhileStatement: {
        enter: (path) => {
          this.enterLoop((path as NodePath<WhileStatementNode>).node);
        },
        exit: () => {
          this.exitLoop();
        },
      },
      CallExpression: {
        enter: (path) => {
          this.processAstCall((path as NodePath<CallExpressionNode>).node, this.loopStack.length > 0);
        },
      },
    });
  }

  private finalizeAstDiagnostics(): void {
    if (this.maxNestingDepth > 6) {
      this.addWarning(
        1,
        1,
        `High nesting depth (${this.maxNestingDepth} levels) may impact readability and performance.`,
        'PSV6-PERF-HIGH-NESTING',
        'Consider refactoring to reduce nesting depth by extracting functions or using early returns.',
      );
    }

    if (this.arrayAllocationCount > 10) {
      this.addWarning(
        1,
        1,
        `High number of array allocations (${this.arrayAllocationCount}). Consider consolidating or reusing arrays.`,
        'PSV6-MEMORY-EXCESSIVE-ARRAYS',
        'Consider using fewer arrays or reusing existing ones to reduce memory usage.',
      );
    }

    if (this.matrixAllocationCount > 5) {
      this.addWarning(
        1,
        1,
        `High number of matrix allocations (${this.matrixAllocationCount}). Consider consolidating matrices.`,
        'PSV6-MEMORY-EXCESSIVE-MATRICES',
        'Consider using fewer matrices or alternative data structures.',
      );
    }

    if (this.mapAllocationCount > 5) {
      this.addWarning(
        1,
        1,
        `High number of map allocations (${this.mapAllocationCount}). Consider consolidating maps.`,
        'PSV6-MEMORY-EXCESSIVE-MAPS',
        'Consider using fewer maps or alternative data structures.',
      );
    }

    if (this.requestCallCount > 5) {
      this.addWarning(
        1,
        1,
        `High number of request calls (${this.requestCallCount}) may impact performance.`,
        'PSV6-PERF-EXCESSIVE-REQUESTS',
        'Consider consolidating requests or using request.security with multiple expressions.',
      );
    }

    if (this.plotCallCount > 10) {
      this.addWarning(
        1,
        1,
        `High number of plot calls (${this.plotCallCount}) may impact rendering performance.`,
        'PSV6-PERF-EXCESSIVE-PLOTS',
        'Consider reducing the number of plots or using conditional plotting.',
      );
    }

    if (this.alertCallCount > 20) {
      this.addWarning(
        1,
        1,
        `High number of alert calls (${this.alertCallCount}) may impact performance.`,
        'PSV6-PERF-EXCESSIVE-ALERTS',
        'Consider consolidating alerts or using alertcondition instead of multiple alert calls.',
      );
    }

    if (this.alertCallCount >= 2) {
      this.addError(
        1,
        1,
        `Multiple alert conditions detected (${this.alertCallCount}). Consider consolidating or documenting alert logic.`,
        'PSV6-PERF-ALERT-CONSOLIDATE',
        'Reduce duplicate alerts or combine conditions when possible.',
      );
    }
  }

  private processAstCall(node: CallExpressionNode, inLoop: boolean): void {
    const qualifiedName = this.getExpressionQualifiedName(node.callee);
    if (!qualifiedName) {
      return;
    }

    if (qualifiedName.startsWith('array.new')) {
      this.arrayAllocationCount++;
      this.handleArrayAllocation(node);
    } else if (qualifiedName.startsWith('matrix.new')) {
      this.matrixAllocationCount++;
      this.handleMatrixAllocation(node);
    } else if (qualifiedName.startsWith('map.new')) {
      this.mapAllocationCount++;
    }

    if (this.isExpensiveFunction(qualifiedName)) {
      this.handleExpensiveFunction(node, qualifiedName, inLoop);
    }

    if (this.isExpensiveNamespace(qualifiedName) && this.controlDepth > 4) {
      this.addInfo(
        node.loc.start.line,
        node.loc.start.column,
        `Expensive operation in deeply nested context (depth: ${this.controlDepth}).`,
        'PSV6-PERF-DEEP-NESTING',
        'Consider moving expensive operations to a higher scope or extracting to a function.',
      );
    }

    if (qualifiedName.startsWith('request.')) {
      this.requestCallCount++;
    }

    if (this.isPlotFunction(qualifiedName)) {
      this.plotCallCount++;
    }

    if (this.isAlertFunction(qualifiedName)) {
      this.alertCallCount++;
    }
  }

  private handleArrayAllocation(node: CallExpressionNode): void {
    const size = this.getNumericLiteralValue(node.args[0]?.value ?? null);
    if (size !== null && size > 10000) {
      this.addWarning(
        node.loc.start.line,
        node.loc.start.column,
        `Large array allocation (${size} elements) may impact memory usage.`,
        'PSV6-MEMORY-LARGE-ARRAY',
        'Consider using a smaller size or dynamic allocation if possible.',
      );
    }
  }

  private handleMatrixAllocation(node: CallExpressionNode): void {
    const rows = this.getNumericLiteralValue(node.args[0]?.value ?? null);
    const cols = this.getNumericLiteralValue(node.args[1]?.value ?? null);
    if (rows !== null && cols !== null) {
      const total = rows * cols;
      if (total > 1000) {
        this.addWarning(
          node.loc.start.line,
          node.loc.start.column,
          `Large matrix allocation (${rows}x${cols} = ${total} elements) may impact memory usage.`,
          'PSV6-MEMORY-LARGE-MATRIX',
          'Consider using a smaller matrix or alternative data structure.',
        );
      }
    }
  }

  private handleExpensiveFunction(node: CallExpressionNode, qualifiedName: string, inLoop: boolean): void {
    if (inLoop) {
      const severity = this.isVeryExpensiveFunction(qualifiedName) ? 'error' : 'warning';
      this.addDiagnostic(
        severity,
        node.loc.start.line,
        node.loc.start.column,
        `Expensive function '${qualifiedName}' detected in loop may impact performance.`,
        'PSV6-PERF-EXPENSIVE-IN-LOOP',
        'Move expensive calculations outside the loop or cache their results.',
      );
    }

    const key = `${qualifiedName}:${node.loc.start.line}`;
    const count = (this.expensiveFunctionCounts.get(key) ?? 0) + 1;
    this.expensiveFunctionCounts.set(key, count);
    if (count > 1 && !this.duplicateExpensiveWarnings.has(key)) {
      this.duplicateExpensiveWarnings.add(key);
      this.addWarning(
        node.loc.start.line,
        node.loc.start.column,
        `Multiple calls to expensive function '${qualifiedName}' on the same line.`,
        'PSV6-PERF-MULTIPLE-EXPENSIVE',
        'Consider caching the result or splitting into multiple lines.',
      );
    }
  }

  private enterLoop(node: ForStatementNode | WhileStatementNode): void {
    if (this.loopStack.length > 0) {
      const parent = this.loopStack[this.loopStack.length - 1];
      parent.maxDepth = Math.max(parent.maxDepth, 2);
    }
    this.loopStack.push({ node, maxDepth: 1 });
  }

  private exitLoop(): void {
    const loopInfo = this.loopStack.pop();
    if (!loopInfo) {
      return;
    }

    if (loopInfo.maxDepth > 1) {
      this.addWarning(
        loopInfo.node.loc.start.line,
        loopInfo.node.loc.start.column,
        `Nested loops detected (${loopInfo.maxDepth} levels) may impact performance.`,
        'PSV6-PERF-NESTED-LOOPS',
        'Consider optimizing the algorithm or reducing the number of nested iterations.',
      );
    }

    if (this.loopStack.length > 0) {
      const parent = this.loopStack[this.loopStack.length - 1];
      parent.maxDepth = Math.max(parent.maxDepth, loopInfo.maxDepth + 1);
    }
  }

  private isExpensiveFunction(name: string): boolean {
    return [
      'ta.highest',
      'ta.lowest',
      'ta.pivothigh',
      'ta.pivotlow',
      'ta.correlation',
      'ta.linreg',
      'ta.percentile_linear_interpolation',
      'ta.percentile_nearest_rank',
      'ta.percentrank',
      'request.security',
      'request.dividends',
      'request.earnings',
    ].includes(name);
  }

  private isVeryExpensiveFunction(name: string): boolean {
    return ['ta.highest', 'ta.lowest', 'ta.pivothigh', 'ta.pivotlow', 'ta.correlation', 'ta.linreg'].includes(name);
  }

  private isExpensiveNamespace(name: string): boolean {
    return name.startsWith('ta.') || name.startsWith('request.') || name.startsWith('math.');
  }

  private isPlotFunction(name: string): boolean {
    return name === 'plot' || name.startsWith('plot');
  }

  private isAlertFunction(name: string): boolean {
    return (
      name === 'alert' ||
      name === 'alertcondition' ||
      name.startsWith('alert.') ||
      name.startsWith('alertcondition.')
    );
  }

  private getExpressionQualifiedName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }

    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (member.computed) {
        return null;
      }
      const objectName = this.getExpressionQualifiedName(member.object);
      if (!objectName) {
        return null;
      }
      return `${objectName}.${member.property.name}`;
    }

    return null;
  }

  private getNumericLiteralValue(expression: ExpressionNode | null): number | null {
    if (!expression) {
      return null;
    }
    if (expression.kind === 'NumberLiteral') {
      return (expression as NumberLiteralNode).value;
    }
    if (expression.kind === 'UnaryExpression') {
      const unary = expression as UnaryExpressionNode;
      if (unary.argument.kind === 'NumberLiteral') {
        const value = (unary.argument as NumberLiteralNode).value;
        return unary.operator === '-' ? -value : value;
      }
    }
    return null;
  }

  private addDiagnostic(
    severity: ValidationError['severity'],
    line: number,
    column: number,
    message: string,
    code?: string,
    suggestion?: string,
  ): void {
    this.errors.push({ line, column, message, severity, code, suggestion });
  }

  private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.addDiagnostic('warning', line, column, message, code, suggestion);
  }

  private addError(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.addDiagnostic('error', line, column, message, code, suggestion);
  }

  private addInfo(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.addDiagnostic('info', line, column, message, code, suggestion);
  }

  private reset(): void {
    this.errors = [];
    this.astContext = null;
    this.usingAst = false;
    this.loopStack = [];
    this.controlDepth = 1;
    this.maxNestingDepth = 1;
    this.arrayAllocationCount = 0;
    this.matrixAllocationCount = 0;
    this.mapAllocationCount = 0;
    this.requestCallCount = 0;
    this.plotCallCount = 0;
    this.alertCallCount = 0;
    this.expensiveFunctionCounts = new Map();
    this.duplicateExpensiveWarnings = new Set();
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    return isAstValidationContext(this.context) ? (this.context as AstValidationContext) : null;
  }

  private analyzeMemoryUsage(context: ValidationContext, errors: ValidationError[]): void {
    let arrayCount = 0;
    let matrixCount = 0;
    let mapCount = 0;

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;

      if (line.includes('array.new')) {
        arrayCount++;

        const sizeMatch = line.match(/array\.new.*?(\d+)/);
        if (sizeMatch) {
          const size = parseInt(sizeMatch[1]);
          if (size > 10000) {
            errors.push({
              line: lineNum,
              column: 1,
              message: `Large array allocation (${size} elements) may impact memory usage.`,
              severity: 'warning',
              code: 'PSV6-MEMORY-LARGE-ARRAY',
              suggestion: 'Consider using a smaller size or dynamic allocation if possible.',
            });
          }
        }
      }

      if (line.includes('matrix.new')) {
        matrixCount++;

        const sizeMatch = line.match(/matrix\.new.*?(\d+).*?(\d+)/);
        if (sizeMatch) {
          const rows = parseInt(sizeMatch[1]);
          const cols = parseInt(sizeMatch[2]);
          const total = rows * cols;
          if (total > 1000) {
            errors.push({
              line: lineNum,
              column: 1,
              message: `Large matrix allocation (${rows}x${cols} = ${total} elements) may impact memory usage.`,
              severity: 'warning',
              code: 'PSV6-MEMORY-LARGE-MATRIX',
              suggestion: 'Consider using a smaller matrix or alternative data structure.',
            });
          }
        }
      }

      if (line.includes('map.new')) {
        mapCount++;
      }
    }

    if (arrayCount > 10) {
      errors.push({
        line: 1,
        column: 1,
        message: `High number of array allocations (${arrayCount}). Consider consolidating or reusing arrays.`,
        severity: 'warning',
        code: 'PSV6-MEMORY-EXCESSIVE-ARRAYS',
        suggestion: 'Consider using fewer arrays or reusing existing ones to reduce memory usage.',
      });
    }

    if (matrixCount > 5) {
      errors.push({
        line: 1,
        column: 1,
        message: `High number of matrix allocations (${matrixCount}). Consider consolidating matrices.`,
        severity: 'warning',
        code: 'PSV6-MEMORY-EXCESSIVE-MATRICES',
        suggestion: 'Consider using fewer matrices or alternative data structures.',
      });
    }

    if (mapCount > 5) {
      errors.push({
        line: 1,
        column: 1,
        message: `High number of map allocations (${mapCount}). Consider consolidating maps.`,
        severity: 'warning',
        code: 'PSV6-MEMORY-EXCESSIVE-MAPS',
        suggestion: 'Consider using fewer maps or alternative data structures.',
      });
    }
  }

  private analyzeComputationalComplexity(context: ValidationContext, errors: ValidationError[]): void {
    let maxNestingDepth = 0;
    let currentNestingDepth = 0;
    const nestingStack: number[] = [];

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;
      const indent = this.getLineIndentation(line);

      if (indent > nestingStack[nestingStack.length - 1] || nestingStack.length === 0) {
        nestingStack.push(indent);
        currentNestingDepth = nestingStack.length;
        maxNestingDepth = Math.max(maxNestingDepth, currentNestingDepth);
      } else {
        while (nestingStack.length > 0 && indent <= nestingStack[nestingStack.length - 1]) {
          nestingStack.pop();
        }
        currentNestingDepth = nestingStack.length;
      }

      if (this.isLoopLine(line)) {
        this.analyzeNestedLoops(i, context, errors);
      }

      this.analyzeExpensiveOperationsInContext(line, lineNum, currentNestingDepth, errors);
    }

    if (maxNestingDepth > 6) {
      errors.push({
        line: 1,
        column: 1,
        message: `High nesting depth (${maxNestingDepth} levels) may impact readability and performance.`,
        severity: 'warning',
        code: 'PSV6-PERF-HIGH-NESTING',
        suggestion: 'Consider refactoring to reduce nesting depth by extracting functions or using early returns.',
      });
    }
  }

  private analyzeNestedLoops(loopLineIndex: number, context: ValidationContext, errors: ValidationError[]): void {
    const line = context.cleanLines[loopLineIndex];
    const lineNum = loopLineIndex + 1;
    const loopIndent = this.getLineIndentation(line);
    let nestedLoopCount = 0;

    for (let i = loopLineIndex + 1; i < Math.min(loopLineIndex + 20, context.cleanLines.length); i++) {
      const nextLine = context.cleanLines[i];
      const nextIndent = this.getLineIndentation(nextLine);

      if (nextIndent <= loopIndent && nextLine.trim() !== '') {
        break;
      }

      if (this.isLoopLine(nextLine) && nextIndent > loopIndent) {
        nestedLoopCount++;
      }
    }

    if (nestedLoopCount > 0) {
      errors.push({
        line: lineNum,
        column: 1,
        message: `Nested loops detected (${nestedLoopCount + 1} levels) may impact performance.`,
        severity: 'warning',
        code: 'PSV6-PERF-NESTED-LOOPS',
        suggestion: 'Consider optimizing the algorithm or reducing the number of nested iterations.',
      });
    }
  }

  private analyzeExpensiveOperations(context: ValidationContext, errors: ValidationError[]): void {
    const expensiveFunctions = [
      'ta.highest',
      'ta.lowest',
      'ta.pivothigh',
      'ta.pivotlow',
      'ta.correlation',
      'ta.linreg',
      'ta.percentile_linear_interpolation',
      'ta.percentile_nearest_rank',
      'ta.percentrank',
      'request.security',
      'request.dividends',
      'request.earnings',
    ];

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;

      for (const func of expensiveFunctions) {
        if (line.includes(func)) {
          if (this.isInLoop(context, i)) {
            const severity = this.isVeryExpensiveFunction(func) ? 'error' : 'warning';
            errors.push({
              line: lineNum,
              column: 1,
              message: `Expensive function '${func}' detected in loop may impact performance.`,
              severity,
              code: 'PSV6-PERF-EXPENSIVE-IN-LOOP',
              suggestion: 'Move expensive calculations outside the loop or cache their results.',
            });
          }

          const functionCount = (line.match(new RegExp(func.replace('.', '\\.'), 'g')) || []).length;
          if (functionCount > 1) {
            errors.push({
              line: lineNum,
              column: 1,
              message: `Multiple calls to expensive function '${func}' on the same line.`,
              severity: 'warning',
              code: 'PSV6-PERF-MULTIPLE-EXPENSIVE',
              suggestion: 'Consider caching the result or splitting into multiple lines.',
            });
          }
        }
      }
    }
  }

  private analyzeExpensiveOperationsInContext(
    line: string,
    lineNum: number,
    nestingDepth: number,
    errors: ValidationError[],
  ): void {
    const expensiveOps = ['ta.', 'request.', 'math.'];

    for (const op of expensiveOps) {
      if (line.includes(op) && nestingDepth > 4) {
        errors.push({
          line: lineNum,
          column: 1,
          message: `Expensive operation in deeply nested context (depth: ${nestingDepth}).`,
          severity: 'info',
          code: 'PSV6-PERF-DEEP-NESTING',
          suggestion: 'Consider moving expensive operations to a higher scope or extracting to a function.',
        });
        break;
      }
    }
  }

  private analyzeResourceUsage(context: ValidationContext, errors: ValidationError[]): void {
    let requestCount = 0;
    let plotCount = 0;
    let alertCount = 0;

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;

      if (line.includes('request.')) {
        requestCount++;
      }

      if (line.includes('plot') && !line.includes('plot(')) {
        plotCount++;
      }

      if (line.includes('alert') || line.includes('alertcondition')) {
        alertCount++;
      }
    }

    if (requestCount > 5) {
      errors.push({
        line: 1,
        column: 1,
        message: `High number of request calls (${requestCount}) may impact performance.`,
        severity: 'warning',
        code: 'PSV6-PERF-EXCESSIVE-REQUESTS',
        suggestion: 'Consider consolidating requests or using request.security with multiple expressions.',
      });
    }

    if (plotCount > 10) {
      errors.push({
        line: 1,
        column: 1,
        message: `High number of plot calls (${plotCount}) may impact rendering performance.`,
        severity: 'warning',
        code: 'PSV6-PERF-EXCESSIVE-PLOTS',
        suggestion: 'Consider reducing the number of plots or using conditional plotting.',
      });
    }

    if (alertCount > 20) {
      errors.push({
        line: 1,
        column: 1,
        message: `High number of alert calls (${alertCount}) may impact performance.`,
        severity: 'warning',
        code: 'PSV6-PERF-EXCESSIVE-ALERTS',
        suggestion: 'Consider consolidating alerts or using alertcondition instead of multiple alert calls.',
      });
    }

    if (alertCount >= 2) {
      errors.push({
        line: 1,
        column: 1,
        message: `Multiple alert conditions detected (${alertCount}). Consider consolidating or documenting alert logic.`,
        severity: 'error',
        code: 'PSV6-PERF-ALERT-CONSOLIDATE',
        suggestion: 'Reduce duplicate alerts or combine conditions when possible.',
      });
    }
  }

  private isLoopLine(line: string): boolean {
    return /^\s*(for|while)\b/.test(line);
  }

  private isInLoop(context: ValidationContext, lineIndex: number): boolean {
    const line = context.cleanLines[lineIndex];
    const lineIndent = this.getLineIndentation(line);

    for (let i = lineIndex - 1; i >= 0; i--) {
      const prevLine = context.cleanLines[i];
      const prevIndent = this.getLineIndentation(prevLine);

      if (prevIndent < lineIndent && prevLine.trim() !== '') {
        break;
      }

      if (this.isLoopLine(prevLine) && prevIndent < lineIndent) {
        return true;
      }
    }

    return false;
  }

  private getLineIndentation(line: string): number {
    return line.length - line.trimStart().length;
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
