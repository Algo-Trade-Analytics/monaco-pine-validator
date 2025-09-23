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
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;
  private usingAst = false;
  private hasNestedTernaryHistoricalCall = false;

  // Analysis tracking
  private conditionalHistoricalCalls: ConditionalHistoricalCall[] = [];
  private seriesInconsistencies: SeriesInconsistency[] = [];
  private userFunctionsWithHistorical = new Set<string>();
  private conditionalHistoricalCount = 0;
  private emittedByLineAndFunc = new Set<string>();

  // State tracking for complex analysis
  private inConditionalBlock = false;
  private inLoopBlock = false;
  private inSwitchBlock = false;
  private currentBlockDepth = 0;
  private blockStack: string[] = [];

  getDependencies(): string[] {
    return ['TypeValidator', 'FunctionValidator', 'ScopeValidator'];
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
    this.inConditionalBlock = false;
    this.inLoopBlock = false;
    this.inSwitchBlock = false;
    this.currentBlockDepth = 0;
    this.blockStack = [];
    this.astContext = null;
    this.usingAst = false;
    this.hasNestedTernaryHistoricalCall = false;
  }

  private validateLegacy(): void {
    this.identifyUserFunctionsWithHistorical();
    this.context.cleanLines.forEach((line, index) => {
      this.processLine(line, index + 1);
    });
    this.analyzeSeriesConsistencyLegacy();
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

  private identifyUserFunctionsWithHistorical(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      
      // Look for function definitions
      const functionMatch = line.match(/^\s*(\w+)\s*\([^)]*\)\s*=>/);
      if (functionMatch) {
        const functionName = functionMatch[1];
        
        // Check if function body contains historical functions
        let functionBody = line;
        let j = i + 1;
        
        // Collect multi-line function body
        while (j < this.context.cleanLines.length && this.isPartOfFunction(this.context.cleanLines[j])) {
          functionBody += ' ' + this.context.cleanLines[j];
          j++;
        }
        
        // Check if function body contains historical functions
        for (const historicalFunc of Array.from(HISTORICAL_FUNCTIONS)) {
          if (functionBody.includes(historicalFunc)) {
            this.userFunctionsWithHistorical.add(functionName);
            break;
          }
        }
      }
    }
  }

  private isPartOfFunction(line: string): boolean {
    const trimmed = line.trim();
    return trimmed !== '' && 
           !trimmed.startsWith('//') && 
           !trimmed.match(/^\w+\s*\([^)]*\)\s*=>/) && // Not another function
           !trimmed.match(/^(if|for|while|switch)\b/); // Not a control structure
  }

  private processLine(line: string, lineNum: number): void {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('//')) {
      return;
    }

    // Track block context
    this.updateBlockContext(line, lineNum);

    // Analyze different types of conditional historical usage
    this.analyzeConditionalExpressions(line, lineNum);
    this.analyzeConditionalBlocks(line, lineNum);
    this.analyzeSwitchStatements(line, lineNum);
    this.analyzeLoopStatements(line, lineNum);
    this.analyzeMethodCalls(line, lineNum);
  }

  private updateBlockContext(line: string, lineNum: number): void {
    const trimmed = line.trim();
    const currentIndent = line.length - line.trimStart().length;
    
    // Track if/else blocks
    if (trimmed.match(/^if\b/)) {
      this.inConditionalBlock = true;
      this.blockStack.push('if');
      this.currentBlockDepth = currentIndent;
    } else if (trimmed.match(/^else\b/)) {
      this.inConditionalBlock = true;
    }
    
    // Track for/while loops
    if (trimmed.match(/^(for|while)\b/)) {
      this.inLoopBlock = true;
      this.blockStack.push('loop');
      this.currentBlockDepth = currentIndent;
    }
    
    // Track switch statements
    if (trimmed.match(/^switch\b/)) {
      this.inSwitchBlock = true;
      this.blockStack.push('switch');
      this.currentBlockDepth = currentIndent;
    }
    
    // Track block endings - when indentation returns to block level or less
    if (this.blockStack.length > 0 && currentIndent <= this.currentBlockDepth && trimmed !== '' && !trimmed.match(/^(else|=>)/)) {
      // Check if we're ending blocks
      if (currentIndent < this.currentBlockDepth) {
        this.inConditionalBlock = false;
        this.inLoopBlock = false;
        this.inSwitchBlock = false;
        this.currentBlockDepth = 0;
        this.blockStack = [];
      }
    }
  }

  private analyzeConditionalExpressions(line: string, lineNum: number): void {
    // Only analyze ternary operators if not in other block contexts
    if (!this.inConditionalBlock && !this.inLoopBlock && !this.inSwitchBlock) {
      // Analyze ternary operators
      const ternaryPattern = /(.+)\s*\?\s*(.+)\s*:\s*(.+)/;
      const ternaryMatch = line.match(ternaryPattern);
      
      if (ternaryMatch) {
        const [, condition, trueExpr, falseExpr] = ternaryMatch;
        
        // Check both branches for historical functions
        this.checkExpressionForHistoricalFunctions(trueExpr, lineNum, 'ternary');
        this.checkExpressionForHistoricalFunctions(falseExpr, lineNum, 'ternary');

        // Also flag user-defined functions with historical dependencies in ternary branches
        for (const fn of Array.from(this.userFunctionsWithHistorical)) {
          const pat = new RegExp(`\\b${fn}\\s*\\(`);
          const methodRe = new RegExp(`\\b\\w+\\s*\\.\\s*${fn}\\s*\\(`);
          const isMethodCall = methodRe.test(trueExpr) || methodRe.test(falseExpr);
          if (!isMethodCall && (pat.test(trueExpr) || pat.test(falseExpr))) {
            const idx = trueExpr.search(pat);
            const baseCol = idx >= 0 ? idx + 1 : (falseExpr.search(pat) + 1) || 1;
            this.addWarning(
              lineNum,
              baseCol,
              `User function ${fn} may have historical dependencies in conditional expression`,
              'PSV6-LAZY-EVAL-USER-FUNCTION'
            );
          }
        }

        // Handle nested ternaries: explicitly scan both branches for any TA/request calls
        const combined = `${trueExpr} ${falseExpr}`;
        const callMatches = combined.match(/\b(?:ta|request)\.[A-Za-z_][A-Za-z0-9_]*\s*\(/g) || [];
        const uniqueFns = new Set<string>();
        for (const m of callMatches) {
          const fn = m.replace(/\s*\(.*/, '').trim(); // e.g., ta.sma(
          uniqueFns.add(fn);
        }
        for (const fn of uniqueFns) {
          const col = Math.max(1, line.indexOf(fn) + 1);
          this.addConditionalHistoricalCall(fn, lineNum, col, 'ternary');
        }

        // Fallback: if we still have < 2 warnings for this line, scan the whole line for TA/request calls
        const currentHistWarnings = this.warnings.filter(w => w.line === lineNum && w.code === 'PSV6-LAZY-EVAL-HISTORICAL');
        if (currentHistWarnings.length < 2 && /\?/.test(line) && /:/.test(line)) {
          const allMatches = line.match(/\b(?:ta|request)\.[A-Za-z_][A-Za-z0-9_]*\s*\(/g) || [];
          const allFns = new Set(allMatches.map(m => m.replace(/\s*\(.*/, '').trim()));
          for (const fn of allFns) {
            const key = `${lineNum}|${fn}|ternary`;
            if (!this.emittedByLineAndFunc.has(key)) {
              const col = Math.max(1, line.indexOf(fn) + 1);
              this.addConditionalHistoricalCall(fn, lineNum, col, 'ternary');
            }
          }
        }
      }
    }
  }

  private analyzeConditionalBlocks(line: string, lineNum: number): void {
    // Prefer loop-context warnings over generic conditional ones to avoid duplicates
    if (this.inConditionalBlock && !this.inLoopBlock) {
      this.checkLineForHistoricalFunctions(line, lineNum, 'if');
    }
  }

  private analyzeSwitchStatements(line: string, lineNum: number): void {
    const trimmed = line.trim();
    
    // Check for switch case arrows only when inside an active switch block
    if (this.inSwitchBlock && trimmed.includes('=>')) {
      const casePattern = /=>\s*(.+)$/;
      const caseMatch = trimmed.match(casePattern);
      
      if (caseMatch) {
        this.checkExpressionForHistoricalFunctions(caseMatch[1], lineNum, 'switch');
      }
    }
    
    // Also check for switch expressions in assignment
    const switchAssignPattern = /=\s*switch\b/;
    if (switchAssignPattern.test(trimmed)) {
      this.inSwitchBlock = true;
    }
  }

  private analyzeLoopStatements(line: string, lineNum: number): void {
    if (this.inLoopBlock) {
      this.checkLineForHistoricalFunctions(line, lineNum, 'loop');
    }
  }

  private analyzeMethodCalls(line: string, lineNum: number): void {
    // Check for method calls that might have historical dependencies
    const methodPattern = /(\w+)\.(\w+)\s*\(/g;
    let match;
    
    while ((match = methodPattern.exec(line)) !== null) {
      const objectName = match[1];
      const methodName = match[2];
      
      // Check if this is a call to a user function with historical dependencies
      if (this.userFunctionsWithHistorical.has(methodName)) {
        this.addWarning(
          lineNum,
          match.index + 1,
          `Method call may contain historical dependencies: ${methodName}`,
          'PSV6-LAZY-EVAL-METHOD'
        );
      }
    }
  }

  private checkLineForHistoricalFunctions(line: string, lineNum: number, context: ConditionalHistoricalCall['context']): void {
    for (const historicalFunc of Array.from(HISTORICAL_FUNCTIONS)) {
      if (line.includes(historicalFunc)) {
        const column = line.indexOf(historicalFunc) + 1;
        this.addConditionalHistoricalCall(historicalFunc, lineNum, column, context);
      }
    }
    
    // Check for user functions with historical dependencies
    for (const userFunc of Array.from(this.userFunctionsWithHistorical)) {
      const pattern = new RegExp(`\\b${userFunc}\\s*\\(`);
      if (pattern.test(line)) {
        const match = line.match(pattern);
        if (match) {
          this.addWarning(
            lineNum,
            match.index! + 1,
            `User function ${userFunc} may have historical dependencies`,
            'PSV6-LAZY-EVAL-USER-FUNCTION'
          );
        }
      }
    }
  }

  private checkExpressionForHistoricalFunctions(expression: string, lineNum: number, context: ConditionalHistoricalCall['context']): void {
    for (const historicalFunc of Array.from(HISTORICAL_FUNCTIONS)) {
      if (expression.includes(historicalFunc)) {
        const column = expression.indexOf(historicalFunc) + 1;
        this.addConditionalHistoricalCall(historicalFunc, lineNum, column, context);
      }
    }
  }

  private addConditionalHistoricalCall(functionName: string, lineNum: number, column: number, context: ConditionalHistoricalCall['context']): void {
    const isExpensive = EXPENSIVE_HISTORICAL_FUNCTIONS.has(functionName);
    const dedupKey = `${lineNum}|${functionName}|${context}`;
    if (this.emittedByLineAndFunc.has(dedupKey)) return;
    this.emittedByLineAndFunc.add(dedupKey);
    
    this.conditionalHistoricalCalls.push({
      functionName,
      line: lineNum,
      column,
      context,
      isExpensive
    });
    
    // Only count if/ternary contexts for multi-conditional summary
    if (context === 'if' || context === 'ternary') {
      this.conditionalHistoricalCount++;
    }
    
    // Generate appropriate warning based on context
    const contextMessages = {
      ternary: `Historical function ${functionName} in conditional expression may cause series inconsistency`,
      if: `Historical function ${functionName} in conditional block may cause incomplete series data`,
      switch: `Historical function ${functionName} in switch statement may cause inconsistent calculations`,
      loop: `Historical function ${functionName} in loop may cause performance issues and series inconsistency`,
      method: `Historical function ${functionName} in method call may cause lazy evaluation issues`
    };
    
    const codes = {
      ternary: 'PSV6-LAZY-EVAL-HISTORICAL',
      if: 'PSV6-LAZY-EVAL-CONDITIONAL',
      switch: 'PSV6-LAZY-EVAL-SWITCH',
      loop: 'PSV6-LAZY-EVAL-LOOP',
      method: 'PSV6-LAZY-EVAL-METHOD'
    };
    
    this.addWarning(lineNum, column, contextMessages[context], codes[context]);
  }

  private analyzeSeriesConsistencyLegacy(): void {
    // Detect block-based inconsistency patterns: if/else assigns series variably with historical vs na
    let currentVar: string | null = null;
    let sawHistoricalInIf = false;
    let sawNaInElse = false;
    let inIf = false;
    let inElse = false;
    let ifStartLine = -1;
    let elseStartLine = -1;

    const lines = this.context.cleanLines;
    let ifIndent = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const indent = line.length - line.trimStart().length;

      if (/^if\b/.test(trimmed)) {
        // Reset tracking for a new conditional block
        currentVar = null;
        sawHistoricalInIf = false;
        sawNaInElse = false;
        inIf = true;
        inElse = false;
        ifIndent = indent;
        ifStartLine = i + 1;
        continue;
      }
      if (/^else\b/.test(trimmed)) {
        inIf = false;
        inElse = true;
        // keep same ifIndent
        elseStartLine = i + 1;
        continue;
      }
      // Block ends if we see 'end' or dedent to ifIndent or less on a non-empty, non-else line
      if (/^end\b/.test(trimmed) || (ifIndent >= 0 && indent <= ifIndent && trimmed !== '' && !/^else\b/.test(trimmed))) {
        // Close of block: emit inconsistency if pattern observed
        if (currentVar && sawHistoricalInIf && sawNaInElse) {
          this.seriesInconsistencies.push({ variableName: currentVar, line: i + 1, inconsistencyType: 'conditional_assignment' });
          this.addWarning(i + 1, 1, `Series may have inconsistent historical data due to conditional assignment`, 'PSV6-LAZY-EVAL-SERIES-INCONSISTENCY');

          // Remove generic conditional warnings within this block to avoid duplicates
          const start = ifStartLine > 0 ? ifStartLine : (elseStartLine > 0 ? elseStartLine : i + 1);
          const end = i + 1;
          this.warnings = this.warnings.filter(w => !(w.code === 'PSV6-LAZY-EVAL-CONDITIONAL' && w.line >= start && w.line <= end));
        }
        currentVar = null;
        sawHistoricalInIf = false;
        sawNaInElse = false;
        inIf = false;
        inElse = false;
        ifIndent = -1;
        ifStartLine = -1;
        elseStartLine = -1;
        continue;
      }

      // Track assignments inside if/else branches
      const assignMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:?=\s*(.+)$/);
      if (assignMatch) {
        const varName = assignMatch[1];
        const rhs = assignMatch[2];
        if (currentVar === null) currentVar = varName;
        if (varName === currentVar) {
          const hasHistorical = Array.from(HISTORICAL_FUNCTIONS).some(func => rhs.includes(func));
          if (inIf && hasHistorical) sawHistoricalInIf = true;
          if (inElse && /\bna\b/.test(rhs)) sawNaInElse = true;
        }
      }
    }

    // EOF: handle trailing open conditional
    if (currentVar && sawHistoricalInIf && sawNaInElse) {
      const endLine = lines.length;
      this.seriesInconsistencies.push({ variableName: currentVar, line: endLine, inconsistencyType: 'conditional_assignment' });
      this.addWarning(endLine, 1, `Series may have inconsistent historical data due to conditional assignment`, 'PSV6-LAZY-EVAL-SERIES-INCONSISTENCY');
      const start = ifStartLine > 0 ? ifStartLine : (elseStartLine > 0 ? elseStartLine : endLine);
      this.warnings = this.warnings.filter(w => !(w.code === 'PSV6-LAZY-EVAL-CONDITIONAL' && w.line >= start && w.line <= endLine));
    }
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
    let hasNestedTernary = false;
    if (this.usingAst) {
      hasNestedTernary = this.hasNestedTernaryHistoricalCall;
    } else {
      const ternaryLines = new Set(ternaryHistoricalCalls.map(c => c.line));
      hasNestedTernary = Array.from(ternaryLines).some(lineNum => {
        const line = this.context.cleanLines[lineNum - 1] || '';
        return (line.match(/\?/g) || []).length > 1;
      });
    }

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
