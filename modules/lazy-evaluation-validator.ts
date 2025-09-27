/**
 * Lazy Evaluation Validator
 * 
 * Validates Pine Script v6 lazy evaluation patterns and potential issues:
 * - Detects historical functions in conditional expressions
 * - Identifies series inconsistency patterns
 * - Warns about performance implications of conditional historical calculations
 * - Suggests best practices for consistent series data
 * - Analyzes switch statements, loops, and complex conditional structures
 * 
 * Priority 83: High priority - lazy evaluation can cause subtle bugs and performance issues
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidatorConfig,
  type ValidationError,
  type ValidationResult,
} from '../core/types';
import { HISTORICAL_FUNCTIONS, EXPENSIVE_HISTORICAL_FUNCTIONS } from '../core/constants';
import {
  type AssignmentStatementNode,
  type CallExpressionNode,
  type ConditionalExpressionNode,
  type ExpressionNode,
  type ForStatementNode,
  type FunctionDeclarationNode,
  type IdentifierNode,
  type IfStatementNode,
  type MemberExpressionNode,
  type ProgramNode,
  type StatementNode,
  type SwitchCaseNode,
  type VariableDeclarationNode,
  type WhileStatementNode,
} from '../core/ast/nodes';
import { findAncestor, visit, type NodePath } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';

interface ConditionalHistoricalCall {
  functionName: string;
  line: number;
  column: number;
  context: 'ternary' | 'if' | 'switch' | 'loop' | 'method';
  isExpensive: boolean;
}

interface SeriesInconsistency {
  variableName: string;
  line: number;
  inconsistencyType: 'conditional_assignment' | 'mixed_sources' | 'partial_calculation';
}

interface PendingUserCall {
  name: string;
  line: number;
  column: number;
  context: Exclude<ConditionalHistoricalCall['context'], 'switch' | 'method'>;
}

interface PendingMethodCall {
  name: string;
  line: number;
  column: number;
}

interface FunctionStackEntry {
  name: string | null;
  hasHistorical: boolean;
}

export class LazyEvaluationValidator implements ValidationModule {
  name = 'LazyEvaluationValidator';
  priority = 83; // High priority - lazy evaluation issues can cause subtle bugs

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;
  private hasNestedTernaryHistoricalCall = false;

  // Analysis tracking
  private conditionalHistoricalCalls: ConditionalHistoricalCall[] = [];
  private seriesInconsistencies: SeriesInconsistency[] = [];
  private userFunctionsWithHistorical = new Set<string>();
  private conditionalHistoricalCount = 0;
  private emittedByLineAndFunc = new Set<string>();

  // State tracking for complex analysis

  getDependencies(): string[] {
    return ['TypeValidator', 'FunctionValidator', 'ScopeValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.config = config;

    this.astContext = ensureAstContext(context, config);
    if (!this.astContext?.ast) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: null,
      };
    }

    this.validateWithAst(this.astContext.ast);
    this.analyzePerformanceImpact();
    this.provideBestPracticesSuggestions();

    const typeMap = new Map();
    typeMap.set('conditional_historical_functions', {
      type: 'analysis',
      isConst: false,
      isSeries: false,
      count: this.conditionalHistoricalCount,
    });

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap,
      scriptType: null,
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.conditionalHistoricalCalls = [];
    this.seriesInconsistencies = [];
    this.userFunctionsWithHistorical.clear();
    this.conditionalHistoricalCount = 0;
    this.emittedByLineAndFunc.clear();
    this.astContext = null;
    this.hasNestedTernaryHistoricalCall = false;
  }

  private validateWithAst(program: ProgramNode): void {
    const pendingUserCalls: PendingUserCall[] = [];
    const pendingMethodCalls: PendingMethodCall[] = [];
    const functionStack: FunctionStackEntry[] = [];
    const ifStatements: IfStatementNode[] = [];

    visit(program, {
      FunctionDeclaration: {
        enter: (path: NodePath<FunctionDeclarationNode>) => {
          const identifier = path.node.identifier;
          functionStack.push({ name: identifier?.name ?? null, hasHistorical: false });
        },
        exit: () => {
          const entry = functionStack.pop();
          if (entry?.name && entry.hasHistorical) {
            this.userFunctionsWithHistorical.add(entry.name);
          }
        },
      },
      IfStatement: {
        enter: (path: NodePath<IfStatementNode>) => {
          ifStatements.push(path.node);
        },
      },
      CallExpression: {
        enter: (path: NodePath<CallExpressionNode>) => {
          this.handleAstCallExpression(path, pendingUserCalls, pendingMethodCalls, functionStack);
        },
      },
    });

    this.emitUserFunctionWarnings(pendingUserCalls);
    this.emitMethodWarnings(pendingMethodCalls);
    this.analyzeSeriesConsistencyAst(ifStatements);
  }

  private handleAstCallExpression(
    path: NodePath<CallExpressionNode>,
    pendingUserCalls: PendingUserCall[],
    pendingMethodCalls: PendingMethodCall[],
    functionStack: FunctionStackEntry[],
  ): void {
    const call = path.node;
    const location = this.getCallLocation(call.callee);
    const qualifiedName = this.getExpressionQualifiedName(call.callee);

    if (qualifiedName && HISTORICAL_FUNCTIONS.has(qualifiedName)) {
      const context = this.determineCallContext(path);
      if (context) {
        this.addConditionalHistoricalCall(qualifiedName, location.line, location.column, context);
        if (context === 'ternary' && this.isNestedTernary(path)) {
          this.hasNestedTernaryHistoricalCall = true;
        }
      }
      const currentFunction = functionStack[functionStack.length - 1];
      if (currentFunction) {
        currentFunction.hasHistorical = true;
      }
    }

    const calleeInfo = this.getUserFunctionCallInfo(call.callee);
    if (!calleeInfo) {
      return;
    }

    if (calleeInfo.isMethod) {
      pendingMethodCalls.push({ name: calleeInfo.name, line: location.line, column: location.column });
      return;
    }

    const context = this.determineCallContext(path);
    if (context === 'ternary' || context === 'if' || context === 'loop') {
      pendingUserCalls.push({ name: calleeInfo.name, line: location.line, column: location.column, context });
    }
  }

  private emitUserFunctionWarnings(calls: PendingUserCall[]): void {
    const seen = new Set<string>();
    for (const call of calls) {
      if (!this.userFunctionsWithHistorical.has(call.name)) {
        continue;
      }

      const key = `${call.name}:${call.line}:${call.column}:${call.context}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      if (call.context === 'ternary') {
        this.addWarning(
          call.line,
          call.column,
          `User function ${call.name} may have historical dependencies in conditional expression`,
          'PSV6-LAZY-EVAL-USER-FUNCTION',
        );
      } else {
        this.addWarning(
          call.line,
          call.column,
          `User function ${call.name} may have historical dependencies`,
          'PSV6-LAZY-EVAL-USER-FUNCTION',
        );
      }
    }
  }

  private emitMethodWarnings(calls: PendingMethodCall[]): void {
    const seen = new Set<string>();
    for (const call of calls) {
      if (!this.userFunctionsWithHistorical.has(call.name)) {
        continue;
      }

      const key = `${call.name}:${call.line}:${call.column}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      this.addWarning(
        call.line,
        call.column,
        `Method call may contain historical dependencies: ${call.name}`,
        'PSV6-LAZY-EVAL-METHOD',
      );
    }
  }

  private determineCallContext(path: NodePath<CallExpressionNode>): ConditionalHistoricalCall['context'] | null {
    const loopAncestor = findAncestor(
      path,
      (ancestor): ancestor is NodePath<ForStatementNode | WhileStatementNode> =>
        ancestor.node.kind === 'ForStatement' || ancestor.node.kind === 'WhileStatement',
    );
    if (loopAncestor) {
      return 'loop';
    }

    const switchAncestor = findAncestor(
      path,
      (ancestor): ancestor is NodePath<SwitchCaseNode> => ancestor.node.kind === 'SwitchCase',
    );
    if (switchAncestor) {
      return 'switch';
    }

    const ternaryAncestor = findAncestor(
      path,
      (ancestor): ancestor is NodePath<ConditionalExpressionNode> => ancestor.node.kind === 'ConditionalExpression',
    );
    if (ternaryAncestor) {
      return 'ternary';
    }

    const ifAncestor = findAncestor(
      path,
      (ancestor): ancestor is NodePath<IfStatementNode> => ancestor.node.kind === 'IfStatement',
    );
    if (ifAncestor) {
      return 'if';
    }

    return null;
  }

  private isNestedTernary(path: NodePath<CallExpressionNode>): boolean {
    const ternaryAncestor = findAncestor(
      path,
      (ancestor): ancestor is NodePath<ConditionalExpressionNode> => ancestor.node.kind === 'ConditionalExpression',
    );
    if (!ternaryAncestor) {
      return false;
    }
    return !!findAncestor(
      ternaryAncestor,
      (ancestor): ancestor is NodePath<ConditionalExpressionNode> => ancestor.node.kind === 'ConditionalExpression',
    );
  }

  private getUserFunctionCallInfo(
    expression: ExpressionNode,
  ): { name: string; isMethod: boolean } | null {
    if (expression.kind === 'Identifier') {
      return { name: (expression as IdentifierNode).name, isMethod: false };
    }
    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (member.computed) {
        return null;
      }
      return { name: member.property.name, isMethod: true };
    }
    return null;
  }

  private getCallLocation(expression: ExpressionNode): { line: number; column: number } {
    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      return { line: member.property.loc.start.line, column: member.property.loc.start.column };
    }
    return { line: expression.loc.start.line, column: expression.loc.start.column };
  }

  private addConditionalHistoricalCall(
    functionName: string,
    lineNum: number,
    column: number,
    context: ConditionalHistoricalCall['context'],
  ): void {
    const isExpensive = EXPENSIVE_HISTORICAL_FUNCTIONS.has(functionName);
    const dedupKey = `${lineNum}|${functionName}|${context}`;
    if (this.emittedByLineAndFunc.has(dedupKey)) {
      return;
    }
    this.emittedByLineAndFunc.add(dedupKey);

    this.conditionalHistoricalCalls.push({
      functionName,
      line: lineNum,
      column,
      context,
      isExpensive,
    });

    if (context === 'if' || context === 'ternary') {
      this.conditionalHistoricalCount++;
    }

    const contextMessages: Record<ConditionalHistoricalCall['context'], string> = {
      ternary: `Historical function ${functionName} in conditional expression may cause series inconsistency`,
      if: `Historical function ${functionName} in conditional block may cause incomplete series data`,
      switch: `Historical function ${functionName} in switch statement may cause inconsistent calculations`,
      loop: `Historical function ${functionName} in loop may cause performance issues and series inconsistency`,
      method: `Historical function ${functionName} in method call may cause lazy evaluation issues`,
    };

    const codes: Record<ConditionalHistoricalCall['context'], string> = {
      ternary: 'PSV6-LAZY-EVAL-HISTORICAL',
      if: 'PSV6-LAZY-EVAL-CONDITIONAL',
      switch: 'PSV6-LAZY-EVAL-SWITCH',
      loop: 'PSV6-LAZY-EVAL-LOOP',
      method: 'PSV6-LAZY-EVAL-METHOD',
    };

    this.addWarning(lineNum, column, contextMessages[context], codes[context]);
  }

  private analyzeSeriesConsistencyAst(ifStatements: IfStatementNode[]): void {
    for (const statement of ifStatements) {
      const consequentAssignments = this.collectAssignmentsFromStatement(statement.consequent);
      const alternateAssignments = this.collectAssignmentsFromStatement(statement.alternate);

      for (const [variableName, info] of consequentAssignments) {
        const alternateInfo = alternateAssignments.get(variableName);
        if (info.hasHistorical && alternateInfo?.hasNa) {
          const startLine = Math.min(
            statement.loc.start.line,
            statement.consequent.loc.start.line,
            statement.alternate?.loc.start.line ?? statement.loc.start.line,
          );
          const endLine = Math.max(
            statement.loc.end.line,
            statement.consequent.loc.end.line,
            statement.alternate?.loc.end.line ?? statement.loc.end.line,
          );
          const line = endLine;
          const column = statement.loc.start.column ?? 1;
          this.seriesInconsistencies.push({
            variableName,
            line,
            inconsistencyType: 'conditional_assignment',
          });
          this.addWarning(
            line,
            column,
            'Series may have inconsistent historical data due to conditional assignment',
            'PSV6-LAZY-EVAL-SERIES-INCONSISTENCY',
          );
          this.removeConditionalWarningsInRange(startLine, endLine);
        }
      }
    }
  }

  private removeConditionalWarningsInRange(startLine: number, endLine: number): void {
    this.warnings = this.warnings.filter((warning) => {
      if (warning.code !== 'PSV6-LAZY-EVAL-CONDITIONAL') {
        return true;
      }
      return warning.line < startLine || warning.line > endLine;
    });
  }

  private collectAssignmentsFromStatement(
    statement: StatementNode | null,
  ): Map<string, { hasHistorical: boolean; hasNa: boolean }> {
    const assignments = new Map<string, { hasHistorical: boolean; hasNa: boolean }>();
    if (!statement) {
      return assignments;
    }

    visit(statement, {
      AssignmentStatement: {
        enter: (path) => {
          const node = path.node as AssignmentStatementNode;
          if (node.left.kind !== 'Identifier' || !node.right) {
            return;
          }
          const identifier = node.left as IdentifierNode;
          const entry = assignments.get(identifier.name) ?? { hasHistorical: false, hasNa: false };
          if (this.expressionContainsHistoricalCall(node.right)) {
            entry.hasHistorical = true;
          }
          if (this.expressionContainsNa(node.right)) {
            entry.hasNa = true;
          }
          assignments.set(identifier.name, entry);
        },
      },
      VariableDeclaration: {
        enter: (path) => {
          const node = path.node as VariableDeclarationNode;
          const identifier = node.identifier.name;
          const entry = assignments.get(identifier) ?? { hasHistorical: false, hasNa: false };
          if (node.initializer && this.expressionContainsHistoricalCall(node.initializer)) {
            entry.hasHistorical = true;
          }
          if (node.initializer && this.expressionContainsNa(node.initializer)) {
            entry.hasNa = true;
          }
          assignments.set(identifier, entry);
        },
      },
    });

    return assignments;
  }

  private expressionContainsHistoricalCall(expression: ExpressionNode): boolean {
    let found = false;
    visit(expression, {
      CallExpression: {
        enter: (path) => {
          const qualifiedName = this.getExpressionQualifiedName((path.node as CallExpressionNode).callee);
          if (qualifiedName && HISTORICAL_FUNCTIONS.has(qualifiedName)) {
            found = true;
            return false;
          }
          return undefined;
        },
      },
    });
    return found;
  }

  private expressionContainsNa(expression: ExpressionNode): boolean {
    let found = false;
    visit(expression, {
      Identifier: {
        enter: (path) => {
          if ((path.node as IdentifierNode).name === 'na') {
            found = true;
            return false;
          }
          return undefined;
        },
      },
    });
    return found;
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
        return member.property.name;
      }
      return `${objectName}.${member.property.name}`;
    }
    return null;
  }

  private analyzePerformanceImpact(): void {
    if (!this.config.enablePerformanceAnalysis) return;
    
    // Check for expensive historical functions in conditionals
    const expensiveCalls = this.conditionalHistoricalCalls.filter(call => call.isExpensive && !call.functionName.startsWith('request.'));
    
    for (const call of expensiveCalls) {
      this.addWarning(
        call.line,
        call.column,
        `Expensive historical calculation in conditional may impact performance`,
        'PSV6-LAZY-EVAL-PERFORMANCE'
      );
    }
    
    // Warn about many conditional historical calculations
    if (this.conditionalHistoricalCount >= 4) {
      this.addWarning(
        1,
        1,
        `Multiple conditional historical calculations detected (${this.conditionalHistoricalCount}). Consider pre-calculating values.`,
        'PSV6-LAZY-EVAL-MANY-CONDITIONALS'
      );
    }
  }

  private provideBestPracticesSuggestions(): void {
    if (!this.config.enablePerformanceAnalysis) return;
    
    // Suggest pre-calculation for ternary expressions with historical functions
    const ternaryHistoricalCalls = this.conditionalHistoricalCalls.filter(call => call.context === 'ternary');
    const hasNestedTernary = this.hasNestedTernaryHistoricalCall;

    // If nested ternary or multiple historical calls in ternary, prefer pattern suggestion over precalc
    if (hasNestedTernary) {
      if (ternaryHistoricalCalls.length > 0) {
        this.addInfo(
          ternaryHistoricalCalls[0].line,
          ternaryHistoricalCalls[0].column,
          'Consider using consistent calculation pattern or pre-calculating all variants to avoid lazy evaluation issues',
          'PSV6-LAZY-EVAL-PATTERN-SUGGESTION'
        );
      }
    } else if (ternaryHistoricalCalls.length > 0) {
      this.addInfo(
        ternaryHistoricalCalls[0].line,
        ternaryHistoricalCalls[0].column,
        'Consider pre-calculating historical values outside conditional expressions to ensure series consistency',
        'PSV6-LAZY-EVAL-PRECALC-SUGGESTION'
      );
    }
    
    // Suggest var declarations for consistent series
    const conditionalCalls = this.conditionalHistoricalCalls.filter(call => call.context === 'if');
    
    if (conditionalCalls.length > 0) {
      this.addInfo(
        conditionalCalls[0].line,
        conditionalCalls[0].column,
        'Consider using var declaration for consistent series initialization across all bars',
        'PSV6-LAZY-EVAL-VAR-SUGGESTION'
      );
    }
    
    // Suggest pattern improvements for complex conditionals
    const switchCalls = this.conditionalHistoricalCalls.filter(call => call.context === 'switch');
    if (switchCalls.length >= 2) {
      this.addInfo(
        switchCalls[0].line,
        switchCalls[0].column,
        'Consider using consistent calculation pattern or pre-calculating all variants to avoid lazy evaluation issues',
        'PSV6-LAZY-EVAL-PATTERN-SUGGESTION'
      );
    }
  }

  private addError(line: number, column: number, message: string, code: string): void {
    this.errors.push({
      line,
      column,
      message,
      severity: 'error',
      code
    });
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({
      line,
      column,
      message,
      severity: 'warning',
      code
    });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({
      line,
      column,
      message,
      severity: 'info',
      code
    });
  }

  // Getter methods for other modules
  getConditionalHistoricalCalls(): ConditionalHistoricalCall[] {
    return [...this.conditionalHistoricalCalls];
  }

  getSeriesInconsistencies(): SeriesInconsistency[] {
    return [...this.seriesInconsistencies];
  }

  getUserFunctionsWithHistorical(): Set<string> {
    return new Set(this.userFunctionsWithHistorical);
  }

  getConditionalHistoricalCount(): number {
    return this.conditionalHistoricalCount;
  }

}
