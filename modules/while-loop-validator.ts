/**
 * Enhanced While Loop validation module for Pine Script v6
 * Handles while loop syntax, performance, and best practices
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
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';

type LineInfo = {
  line: string;
  lineNum: number;
  indent: number;
  trimmed: string;
};

export class WhileLoopValidator implements ValidationModule {
  name = 'WhileLoopValidator';
  
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;
  private usingAst = false;

  getDependencies(): string[] {
    return ['SyntaxValidator', 'PerformanceValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.astContext = this.getAstContext(config);
    this.usingAst = !!this.astContext?.ast;

    if (this.usingAst && this.astContext?.ast) {
      this.validateWhileLoopsAst(this.astContext.ast);
      this.validateWhileLoopStructureFallback();
    } else {
      this.validateWhileLoopSyntax();
      this.validateWhileLoopPerformance();
      this.validateWhileLoopBestPractices();
      this.validateWhileLoopNesting();
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: null
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
    this.usingAst = false;
  }

  private getLineInfo(): LineInfo[] {
    return this.context.cleanLines.map((line, index) => {
      const trimmedStart = line.replace(/^\s*/, '');
      const indent = line.length - trimmedStart.length;
      return {
        line,
        lineNum: index + 1,
        indent,
        trimmed: line.trim()
      };
    });
  }

  private addError(line: number, column: number, message: string, code: string): void {
    this.errors.push({
      line,
      column,
      message,
      code,
      severity: 'error'
    });
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({
      line,
      column,
      message,
      code,
      severity: 'warning'
    });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({
      line,
      column,
      message,
      code,
      severity: 'info'
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
              'PSV6-WHILE-COMPLEX-OPERATION'
            );
          }
        },
        exit: () => {
          loopStack.pop();
        }
      }
    });

    if (maxDepth && maxDepth.depth > 3) {
      this.addWarning(
        maxDepth.line,
        maxDepth.column,
        `While loop nesting depth is ${maxDepth.depth}. Consider refactoring.`,
        'PSV6-WHILE-DEEP-NESTING'
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
            'PSV6-WHILE-INFINITE-LOOP'
          );
        } else {
          this.addWarning(
            line,
            column,
            'While loop with condition "false" will never execute',
            'PSV6-WHILE-NEVER-EXECUTES'
          );
        }
        break;
      case 'NumberLiteral':
        this.addWarning(
          line,
          column,
          'While loop with numeric condition may not behave as expected',
          'PSV6-WHILE-NUMERIC-CONDITION'
        );
        break;
      case 'StringLiteral':
        this.addWarning(
          line,
          column,
          'While loop with string condition may not behave as expected',
          'PSV6-WHILE-STRING-CONDITION'
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
        'PSV6-WHILE-COMPLEX-CONDITION'
      );
    }

    if (analysis.comparisonOperators > 2) {
      this.addInfo(
        line,
        column,
        'Consider breaking complex condition into multiple variables',
        'PSV6-WHILE-CONDITION-SIMPLIFICATION'
      );
    }

    if (analysis.hasEquality && !analysis.hasInequality) {
      this.addInfo(
        line,
        column,
        'Consider using != instead of == for while loop conditions',
        'PSV6-WHILE-CONDITION-BEST-PRACTICE'
      );
    }

    if (analysis.firstComparisonIdentifier) {
      this.addInfo(
        line,
        column,
        'Ensure loop variable is updated inside the loop to prevent infinite loops',
        'PSV6-WHILE-VARIABLE-UPDATE-REMINDER'
      );

      const identifier = analysis.firstComparisonIdentifier;
      if (identifier.name.length < 3) {
        this.addInfo(
          line,
          column,
          'Consider using more descriptive variable names in while loop conditions',
          'PSV6-WHILE-VARIABLE-NAMING'
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
      firstComparisonIdentifier: null as IdentifierNode | null
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
              'PSV6-WHILE-CONDITIONAL-BREAK'
            );
          }
        }
      },
      ForStatement: {
        enter: () => {
          complexity += 1;
        }
      },
      WhileStatement: {
        enter: () => {
          complexity += 1;
        }
      },
      SwitchStatement: {
        enter: () => {
          complexity += 1;
        }
      },
      CallExpression: {
        enter: (path) => {
          const node = (path as NodePath<CallExpressionNode>).node;
          const qualified = this.getQualifiedName(node.callee);

          if (qualified && this.isExpensiveOperation(qualified)) {
            this.addWarning(
              node.loc.start.line,
              node.loc.start.column,
              `Expensive operation "${qualified}" inside while loop may impact performance`,
              'PSV6-WHILE-EXPENSIVE-OPERATION'
            );
          }

          if (qualified && this.isComplexNamespace(qualified)) {
            complexity += 1;
          }
        }
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
              'PSV6-WHILE-VARIABLE-UPDATE-GOOD'
            );
          }
        }
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
              'PSV6-WHILE-BREAK-CONDITION'
            );
          }
        }
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
              'PSV6-WHILE-BREAK-CONDITION'
            );
          }
        }
      }
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
        return statement.cases.some((caseNode) => caseNode.consequent.some((child) => this.containsBreakOrReturn(child)));
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
      'math.log'
    ].some((operation) => name.includes(operation));
  }

  private isComplexNamespace(name: string): boolean {
    return ['ta.', 'math.', 'str.', 'array.'].some((prefix) => name.includes(prefix));
  }

  private isLoopCounterName(name: string): boolean {
    return ['i', 'j', 'k', 'index', 'counter', 'count'].includes(name);
  }

  private validateWhileLoopStructureFallback(): void {
    const whileStack: Array<{ line: number; indent: number }> = [];
    const lines = this.getLineInfo();

    for (const info of lines) {
      const { line, lineNum, indent, trimmed } = info;
      if (!trimmed) continue;

      if (/^end\b/.test(trimmed)) {
        if (whileStack.length) {
          whileStack.pop();
        }
        continue;
      }

      while (whileStack.length && indent <= whileStack[whileStack.length - 1].indent && !/^while\b/.test(trimmed)) {
        whileStack.pop();
      }

      const whileMatch = line.match(/^\s*while\s*(.*)$/);
      if (whileMatch) {
        const condition = whileMatch[1].trim();
        if (!condition) {
          this.addError(
            lineNum,
            1,
            'While loop condition cannot be empty',
            'PSV6-WHILE-EMPTY-CONDITION'
          );
        }
        whileStack.push({ line: lineNum, indent });
      }
    }

    for (const state of whileStack) {
      this.addError(state.line, 1, 'While loop missing end statement', 'PSV6-WHILE-MISSING-END');
    }
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }

    return isAstValidationContext(this.context) ? (this.context as AstValidationContext) : null;
  }

  private validateWhileLoopSyntax(): void {
    const whileStack: Array<{ line: number; indent: number }> = [];
    const lines = this.getLineInfo();

    for (const info of lines) {
      const { line, lineNum, indent, trimmed } = info;
      if (!trimmed) continue;

      if (/^end\b/.test(trimmed)) {
        if (whileStack.length) {
          whileStack.pop();
        }
        continue;
      }

      while (whileStack.length && indent <= whileStack[whileStack.length - 1].indent) {
        const orphan = whileStack.pop();
        if (orphan) {
          this.addError(orphan.line, 1, 'While loop missing end statement', 'PSV6-WHILE-MISSING-END');
        }
      }

      const whileMatch = line.match(/^\s*while\s*(.*)$/);
      if (whileMatch) {
        whileStack.push({ line: lineNum, indent });
        this.validateWhileCondition(whileMatch[1], lineNum);
      }
    }

    for (const state of whileStack) {
      this.addError(state.line, 1, 'While loop missing end statement', 'PSV6-WHILE-MISSING-END');
    }
  }

  private validateWhileLoopPerformance(): void {
    type WhileState = { line: number; indent: number; complexity: number };
    const stack: WhileState[] = [];
    const lines = this.getLineInfo();

    for (const info of lines) {
      const { line, lineNum, indent, trimmed } = info;
      if (!trimmed) continue;

      if (/^end\b/.test(trimmed)) {
        if (stack.length) {
          const state = stack.pop()!;
          if (state.complexity > 2) {
            this.addWarning(state.line, 1,
              'Complex operation inside while loop may impact performance',
              'PSV6-WHILE-COMPLEX-OPERATION');
          }
        }
        continue;
      }

      while (stack.length && indent <= stack[stack.length - 1].indent && !/^while\b/.test(trimmed)) {
        const state = stack.pop()!;
        if (state.complexity > 2) {
          this.addWarning(state.line, 1,
            'Complex operation inside while loop may impact performance',
            'PSV6-WHILE-COMPLEX-OPERATION');
        }
      }

      const whileMatch = line.match(/^\s*while\s*(.*)$/);
      if (whileMatch) {
        const condition = whileMatch[1];
        stack.push({ line: lineNum, indent, complexity: 0 });
        this.checkInfiniteLoopRisk(condition, lineNum);
        continue;
      }

      if (stack.length) {
        this.checkExpensiveOperationsInWhileLoop(line, lineNum);
        const current = stack[stack.length - 1];
        current.complexity += this.countComplexOperations(line);
      }
    }

    while (stack.length) {
      const state = stack.pop()!;
      if (state.complexity > 2) {
        this.addWarning(state.line, 1,
          'Complex operation inside while loop may impact performance',
          'PSV6-WHILE-COMPLEX-OPERATION');
      }
    }
  }

  private validateWhileLoopBestPractices(): void {
    const whileStack: Array<{ line: number; indent: number }> = [];
    const lines = this.getLineInfo();
    let inIfStatement = false;
    let ifStartLine = 0;
    let ifIndent = 0;

    for (const info of lines) {
      const { line, lineNum, indent, trimmed } = info;
      if (!trimmed) continue;

      if (/^end\b/.test(trimmed)) {
        if (whileStack.length) {
          whileStack.pop();
        }
        if (inIfStatement && indent <= ifIndent) {
          inIfStatement = false;
        }
        continue;
      }

      while (whileStack.length && indent <= whileStack[whileStack.length - 1].indent && !/^while\b/.test(trimmed)) {
        whileStack.pop();
        if (inIfStatement && indent <= ifIndent) {
          inIfStatement = false;
        }
      }

      const whileMatch = line.match(/^\s*while\s+(.+)$/);
      if (whileMatch) {
        whileStack.push({ line: lineNum, indent });
        this.checkWhileLoopBestPractices(whileMatch[1], lineNum);
        inIfStatement = false;
        continue;
      }

      if (!whileStack.length) {
        continue;
      }

      const ifMatch = line.match(/^\s*if\s+(.+)$/);
      if (ifMatch) {
        inIfStatement = true;
        ifStartLine = lineNum;
        ifIndent = indent;
      } else if (inIfStatement && indent <= ifIndent) {
        inIfStatement = false;
      }

      if (inIfStatement && (line.includes('break') || line.includes('return'))) {
        this.addInfo(ifStartLine, 1,
          'Conditional break/return in while loop. Ensure all code paths lead to termination.',
          'PSV6-WHILE-CONDITIONAL-BREAK');
        inIfStatement = false;
      }

      if (inIfStatement && line.match(/^\s*(for|while|switch)/)) {
        inIfStatement = false;
      }

      this.checkWhileLoopVariableUpdates(line, lineNum);
      this.checkWhileLoopBreakConditions(line, lineNum);
    }
  }

  private validateWhileLoopNesting(): void {
    const whileStack: Array<{ line: number; indent: number }> = [];
    let maxNestingDepth = 0;
    const lines = this.getLineInfo();

    for (const info of lines) {
      const { line, indent, trimmed } = info;
      if (!trimmed) continue;

      if (/^end\b/.test(trimmed)) {
        if (whileStack.length) {
          whileStack.pop();
        }
        continue;
      }

      while (whileStack.length && indent <= whileStack[whileStack.length - 1].indent && !/^while\b/.test(trimmed)) {
        whileStack.pop();
      }

      if (line.match(/^\s*while\s+/)) {
        whileStack.push({ line: info.lineNum, indent });
        maxNestingDepth = Math.max(maxNestingDepth, whileStack.length);
      }
    }

    if (maxNestingDepth > 3) {
      this.addWarning(1, 1,
        `While loop nesting depth is ${maxNestingDepth}. Consider refactoring.`,
        'PSV6-WHILE-DEEP-NESTING');
    }
  }

  private validateWhileCondition(condition: string, lineNum: number): void {
    const trimmed = condition.trim();
    
    // Check for empty condition
    if (!trimmed) {
      this.addError(lineNum, 1, 
        'While loop condition cannot be empty', 
        'PSV6-WHILE-EMPTY-CONDITION');
      return;
    }

    // Check for common condition patterns
    this.checkWhileConditionPatterns(trimmed, lineNum);
    this.checkWhileConditionComplexity(trimmed, lineNum);
  }

  private checkWhileConditionPatterns(condition: string, lineNum: number): void {
    // Check for potentially problematic conditions
    if (condition === 'true') {
      this.addError(lineNum, 1, 
        'While loop with condition "true" will run indefinitely', 
        'PSV6-WHILE-INFINITE-LOOP');
    }

    if (condition === 'false') {
      this.addWarning(lineNum, 1, 
        'While loop with condition "false" will never execute', 
        'PSV6-WHILE-NEVER-EXECUTES');
    }

    // Check for numeric conditions
    if (condition.match(/^\d+$/)) {
      this.addWarning(lineNum, 1, 
        'While loop with numeric condition may not behave as expected', 
        'PSV6-WHILE-NUMERIC-CONDITION');
    }

    // Check for string conditions
    if (condition.match(/^"[^"]*"$/) || condition.match(/^'[^']*'$/)) {
      this.addWarning(lineNum, 1, 
        'While loop with string condition may not behave as expected', 
        'PSV6-WHILE-STRING-CONDITION');
    }
  }

  private checkWhileConditionComplexity(condition: string, lineNum: number): void {
    // Count logical operators
    const logicalOps = (condition.match(/\b(and|or)\b/g) || []).length;
    const comparisonOps = (condition.match(/[<>=!]+/g) || []).length;
    
    if (logicalOps >= 3) {
      this.addWarning(lineNum, 1, 
        'While loop condition is complex. Consider simplifying.', 
        'PSV6-WHILE-COMPLEX-CONDITION');
    }

    if (comparisonOps > 2) {
      this.addInfo(lineNum, 1, 
        'Consider breaking complex condition into multiple variables', 
        'PSV6-WHILE-CONDITION-SIMPLIFICATION');
    }
  }

  private checkExpensiveOperationsInWhileLoop(line: string, lineNum: number): void {
    // Check for expensive operations inside while loops
    const expensiveOps = [
      'request.security', 'request.seed', 'request.quandl',
      'ta.sma', 'ta.ema', 'ta.rsi', 'ta.macd',
      'math.max', 'math.min', 'math.sqrt', 'math.log'
    ];

    for (const op of expensiveOps) {
      if (line.includes(op)) {
        this.addWarning(lineNum, 1, 
          `Expensive operation "${op}" inside while loop may impact performance`, 
          'PSV6-WHILE-EXPENSIVE-OPERATION');
      }
    }
  }

  private checkInfiniteLoopRisk(condition: string, lineNum: number): void {
    const trimmed = condition.trim();
    if (!trimmed) return;

    if (/^true(?:\b|$)/i.test(trimmed)) {
      this.addError(lineNum, 1,
        'Infinite while loop detected',
        'PSV6-WHILE-INFINITE-LOOP');
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*\s*[<>=!]/.test(trimmed)) {
      this.addInfo(lineNum, 1,
        'Ensure loop variable is updated inside the loop to prevent infinite loops',
        'PSV6-WHILE-VARIABLE-UPDATE-REMINDER');
    }
  }

  private countComplexOperations(line: string): number {
    // Count complex operations in a line
    const complexOps = [
      'if', 'for', 'while', 'switch',
      'ta.', 'math.', 'str.', 'array.'
    ];

    let complexityCount = 0;
    for (const op of complexOps) {
      if (line.includes(op)) {
        complexityCount++;
      }
    }

    return complexityCount;
  }

  private checkWhileLoopBestPractices(condition: string, lineNum: number): void {
    // Check for best practices in while loop conditions
    if (condition.includes('==') && !condition.includes('!=')) {
      this.addInfo(lineNum, 1, 
        'Consider using != instead of == for while loop conditions', 
        'PSV6-WHILE-CONDITION-BEST-PRACTICE');
    }

    // Check for proper variable naming in conditions
    const varMatch = condition.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s*[<>=!]/);
    if (varMatch) {
      const varName = varMatch[1];
      if (varName.length < 3) {
        this.addInfo(lineNum, 1, 
          'Consider using more descriptive variable names in while loop conditions', 
          'PSV6-WHILE-VARIABLE-NAMING');
      }
    }
  }

  private checkWhileLoopVariableUpdates(line: string, lineNum: number): void {
    // Check for variable updates inside while loops
    const assignMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:?=\s*(.+)$/);
    if (assignMatch) {
      const varName = assignMatch[1];
      const value = assignMatch[2];
      
      // Check if this is a loop counter update
      if (varName.match(/^(i|j|k|index|counter|count)$/)) {
        this.addInfo(lineNum, 1, 
          `Loop variable "${varName}" updated. Good practice for preventing infinite loops.`, 
          'PSV6-WHILE-VARIABLE-UPDATE-GOOD');
      }
    }
  }

  private checkWhileLoopBreakConditions(line: string, lineNum: number): void {
    // Check for break conditions inside while loops
    if (line.includes('break') || line.includes('return')) {
      this.addInfo(lineNum, 1,
        'Break/return statement found in while loop. Ensure proper loop termination.',
        'PSV6-WHILE-BREAK-CONDITION');
    }

    // Check for conditional breaks
    if (line.includes('if') && (line.includes('break') || line.includes('return'))) {
      this.addInfo(lineNum, 1,
        'Conditional break/return in while loop. Ensure all code paths lead to termination.',
        'PSV6-WHILE-CONDITIONAL-BREAK');
    }
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
