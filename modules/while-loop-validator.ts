/**
 * Enhanced While Loop validation module for Pine Script v6
 * Handles while loop syntax, performance, and best practices
 */

import { ValidationModule, ValidationContext, ValidationError, ValidationResult, ValidatorConfig } from '../core/types';

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

  getDependencies(): string[] {
    return ['SyntaxValidator', 'PerformanceValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.validateWhileLoopSyntax();
    this.validateWhileLoopPerformance();
    this.validateWhileLoopBestPractices();
    this.validateWhileLoopNesting();

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
        whileStack.pop();
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
