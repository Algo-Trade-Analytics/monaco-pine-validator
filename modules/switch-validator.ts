/**
 * Switch Statement Validation Module for Pine Script v6
 * Handles validation of switch statements, case values, and default clauses
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidatorConfig,
  type ValidationError,
  type ValidationResult,
  type TypeInfo,
} from '../core/types';
import { Codes } from '../core/codes';
import { ValidationHelper } from '../core/validation-helper';
import type {
  AssignmentStatementNode,
  IdentifierNode,
  ExpressionNode,
  ExpressionStatementNode,
  ProgramNode,
  StatementNode,
  ReturnStatementNode,
  TupleExpressionNode,
  SwitchCaseNode,
  SwitchStatementNode,
  VariableDeclarationNode,
  ConditionalExpressionNode,
  BinaryExpressionNode,
  UnaryExpressionNode,
  CallExpressionNode,
  MemberExpressionNode,
  ArrayLiteralNode,
} from '../core/ast/nodes';
import { visit } from '../core/ast/traversal';
import type { TypeMetadata } from '../core/ast/types';
import { ensureAstContext } from '../core/ast/context-utils';
import { getSourceLines } from '../core/ast/source-utils';

export class SwitchValidator implements ValidationModule {
  name = 'SwitchValidator';
  priority = 95; // Runs before TypeInferenceValidator to provide switch type information

  private helper = new ValidationHelper();
  private context!: ValidationContext;
  private astContext: AstValidationContext | null = null;

  getDependencies(): string[] {
    return ['SyntaxValidator', 'TypeValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.context = context;
    this.reset();

    this.astContext = ensureAstContext(context, config);
    const ast = this.astContext?.ast;

    if (!ast) {
      // Fallback: Check for deeply nested switch statements in cleanLines
      // This handles edge cases where AST parsing fails
      this.detectDeepNestingFallback();
      
      return this.helper.buildResult(context);
    }

    this.validateSwitchStatementsAst(ast);

    return this.helper.buildResult(context);
  }

  private reset(): void {
    this.helper.reset();
    this.astContext = null;
  }


  private validateSwitchStatementsAst(program: ProgramNode): void {
    visit(program, {
      SwitchStatement: {
        enter: (path) => {
          const statement = path.node as SwitchStatementNode;
          this.processAstSwitchStatement(statement);
        },
      },
    });
  }

  private processAstSwitchStatement(statement: SwitchStatementNode): void {
    this.validateSwitchExpressionAst(statement);

    const seenCases = new Map<string, { line: number; column: number }>();
    const returnTypes = new Set<string>();
    let hasDefault = false;

    for (const caseNode of statement.cases) {
      if (caseNode.test) {
        this.validateAstCaseValue(caseNode);
        this.detectAstDuplicateCase(caseNode, seenCases);
      } else {
        hasDefault = true;
      }

      const typeLabel = this.inferAstCaseReturnType(caseNode);
      if (typeLabel) {
        returnTypes.add(typeLabel);
      }
    }

    if (!hasDefault) {
      const { line, column } = statement.loc.start;
      this.helper.addWarning(
        line,
        column,
        'Switch statement should include a default clause.',
        'PSV6-SWITCH-NO-DEFAULT',
      );
    }

    if (statement.cases.length > 20) {
      const { line, column } = statement.loc.start;
      this.helper.addWarning(
        line,
        column,
        `Switch statement has ${statement.cases.length} cases, consider refactoring.`,
        'PSV6-SWITCH-TOO-MANY-CASES',
      );
    }

    if (returnTypes.size > 1) {
      const { line, column } = statement.loc.start;
      this.helper.addError(
        line,
        column,
        'Switch statement cases must have consistent return types.',
        'PSV6-SWITCH-RETURN-TYPE',
      );
    }

    let nestingDepth = this.computeSwitchNestingDepth(statement);

    if (nestingDepth <= 2) {
      const heuristicDepth = this.estimateSwitchDepthFromSource(statement);
      if (heuristicDepth > nestingDepth) {
        nestingDepth = heuristicDepth;
      }
      if (nestingDepth <= 2 && this.hasGlobalNestedSwitchPattern()) {
        nestingDepth = 3;
      }
    }

    if (nestingDepth > 2) {
      const { line, column } = statement.loc.start;
      this.helper.addWarning(
        line,
        column,
        `Switch statement has deep nesting (${nestingDepth} levels), consider refactoring.`,
        'PSV6-SWITCH-DEEP-NESTING',
      );
    }

    this.validateSwitchStyleAst(statement.cases);

    this.applyResultBindingTypes(statement, returnTypes);
  }

  private validateSwitchExpressionAst(statement: SwitchStatementNode): void {
    const expression = statement.discriminant;
    if (!expression) {
      const { line, column } = statement.loc.start;
      this.helper.addError(line, column, 'Switch statement requires an expression.', 'PSV6-SWITCH-SYNTAX');
      this.helper.addError(line, column, 'Switch statement requires an expression.', 'PSV6-SYNTAX-ERROR');
      return;
    }
    
    // Check for invalid/empty discriminant (parser error recovery artifacts)
    if (expression.kind === 'Identifier') {
      const name = (expression as IdentifierNode).name;
      if (!name || name === '__switch_guard__') {
        const { line, column } = statement.loc.start;
        this.helper.addError(line, column, 'Switch statement requires an expression.', 'PSV6-SWITCH-SYNTAX');
        this.helper.addError(line, column, 'Switch statement requires an expression.', 'PSV6-SYNTAX-ERROR');
        return;
      }
    }

    switch (expression.kind) {
      case 'StringLiteral':
      case 'Identifier':
      case 'MemberExpression':
      case 'CallExpression':
        return;
      case 'NumberLiteral': {
        const { line, column } = expression.loc.start;
        this.helper.addError(
          line,
          column,
          'Switch expression should be a string, not a number. Use string conversion or string literal.',
          'PSV6-SWITCH-TYPE',
        );
        return;
      }
      case 'BooleanLiteral': {
        const { line, column } = expression.loc.start;
        this.helper.addError(
          line,
          column,
          'Switch expression should be a string, not a boolean. Use string conversion or string literal.',
          'PSV6-SWITCH-TYPE',
        );
        return;
      }
      default:
        return;
    }
  }

  private validateAstCaseValue(caseNode: SwitchCaseNode): void {
    const test = caseNode.test;
    if (!test) {
      return;
    }

    const { line, column } = test.loc.start;
    if (test.kind === 'NumberLiteral') {
      this.helper.addError(
        line,
        column,
        'Case value should be a string, not a number. Use string literal.',
        'PSV6-SWITCH-CASE-TYPE',
      );
    } else if (test.kind === 'BooleanLiteral') {
      this.helper.addError(
        line,
        column,
        'Case value should be a string, not a boolean. Use string literal.',
        'PSV6-SWITCH-CASE-TYPE',
      );
    }
  }

  private detectAstDuplicateCase(
    caseNode: SwitchCaseNode,
    seen: Map<string, { line: number; column: number }>,
  ): void {
    const test = caseNode.test;
    if (!test) {
      return;
    }

    const key = this.describeCaseTest(test);
    if (!key) {
      return;
    }

    const { line, column } = test.loc.start;
    if (seen.has(key)) {
      this.helper.addError(line, column, `Duplicate case value: ${key}`, 'PSV6-SWITCH-DUPLICATE-CASE');
      return;
    }

    seen.set(key, { line, column });
  }

  private describeCaseTest(expression: ExpressionNode): string {
    switch (expression.kind) {
      case 'StringLiteral':
        return `"${expression.value}"`;
      case 'Identifier':
        return expression.name;
      case 'MemberExpression':
        return `${this.describeCaseTest(expression.object)}.${expression.property.name}`;
      case 'NumberLiteral':
        return String(expression.value);
      case 'BooleanLiteral':
        return expression.value ? 'true' : 'false';
      case 'CallExpression':
        return `${this.describeCaseTest(expression.callee)}(...)`;
      case 'IndexExpression':
        return `${this.describeCaseTest(expression.object)}[...]`;
      default:
        return expression.kind;
    }
  }

  private inferAstCaseReturnType(caseNode: SwitchCaseNode): string | null {
    if (!this.astContext) {
      return null;
    }

    const expression = this.extractCaseExpression(caseNode);
    if (!expression) {
      return 'unknown';
    }

    const metadata = this.astContext.typeEnvironment.nodeTypes.get(expression);
    const described = this.describeTypeMetadata(metadata ?? null);
    return described ?? 'unknown';
  }

  private extractCaseExpression(caseNode: SwitchCaseNode): ExpressionNode | null {
    if (caseNode.consequent.length === 0) {
      return null;
    }

    const first = caseNode.consequent[0];
    if (first.kind === 'ExpressionStatement') {
      return (first as ExpressionStatementNode).expression;
    }
    if (first.kind === 'AssignmentStatement') {
      return (first as AssignmentStatementNode).right ?? null;
    }
    if (first.kind === 'ReturnStatement') {
      return ((first as ReturnStatementNode).argument as ExpressionNode) ?? null;
    }
    if (first.kind === 'VariableDeclaration') {
      return (first as VariableDeclarationNode).initializer ?? null;
    }

    return null;
  }

  private describeTypeMetadata(metadata: TypeMetadata | null): string | null {
    if (!metadata) {
      return null;
    }

    return metadata.kind;
  }

  private applyResultBindingTypes(
    statement: SwitchStatementNode,
    returnTypes: Set<string>,
  ): void {
    if (!statement.resultBinding) {
      return;
    }

    const metadata = this.astContext?.typeEnvironment?.nodeTypes.get(statement);
    let inferred = this.describeTypeMetadata(metadata ?? null);
    if (!inferred || inferred === 'unknown') {
      inferred = returnTypes.values().next().value ?? null;
    }

    if (!inferred || inferred === 'unknown') {
      return;
    }

    this.assignResultBinding(statement.resultBinding, inferred);
  }

  private assignResultBinding(binding: SwitchStatementNode['resultBinding'], typeLabel: string): void {
    if (!binding) {
      return;
    }

    switch (binding.kind) {
      case 'assignment':
      case 'variableDeclaration':
        this.assignTargetType(binding.target, typeLabel);
        break;
      case 'tupleAssignment':
        if (binding.target.kind === 'TupleExpression') {
          const tuple = binding.target as TupleExpressionNode;
          tuple.elements.forEach((element) => {
            if (element && element.kind === 'Identifier') {
              this.assignIdentifierType(element as IdentifierNode, typeLabel);
            }
          });
        } else {
          this.assignTargetType(binding.target, typeLabel);
        }
        break;
      default:
        break;
    }
  }

  private assignTargetType(target: ExpressionNode, typeLabel: string): void {
    if (target.kind === 'Identifier') {
      this.assignIdentifierType(target as IdentifierNode, typeLabel);
      return;
    }

    const line = target.loc.start.line;
    const column = target.loc.start.column;
    this.updateTypeMap(`__expr_${line}_${column}`, line, column, typeLabel);
  }

  private assignIdentifierType(identifier: IdentifierNode, typeLabel: string): void {
    this.updateTypeMap(identifier.name, identifier.loc.start.line, identifier.loc.start.column, typeLabel);
  }

  private updateTypeMap(name: string, line: number, column: number, typeLabel: string): void {
    if (!this.context.typeMap) {
      this.context.typeMap = new Map();
    }

    const existing = this.context.typeMap.get(name);
    const typeInfo: TypeInfo = existing ?? {
      type: typeLabel as TypeInfo['type'],
      isConst: false,
      isSeries: typeLabel === 'series',
      declaredAt: { line, column },
      usages: [],
    };

    typeInfo.type = typeLabel as TypeInfo['type'];
    typeInfo.isConst = typeInfo.isConst ?? false;
    typeInfo.isSeries = typeLabel === 'series' ? true : (typeInfo.isSeries ?? false);

    this.context.typeMap.set(name, typeInfo);
  }

  private computeSwitchNestingDepth(statement: SwitchStatementNode): number {
    let maxDepth = 1;

    const visitSwitch = (node: SwitchStatementNode, depth: number) => {
      if (depth > maxDepth) {
        maxDepth = depth;
      }

      node.cases.forEach((caseNode) => {
        if (caseNode.test) {
          visitExpression(caseNode.test as ExpressionNode, depth);
        }
        caseNode.consequent.forEach((stmt) => visitStatementNode(stmt, depth));
      });
    };

    const visitStatementNode = (stmt: StatementNode, depth: number) => {
      if (!stmt) {
        return;
      }
      switch (stmt.kind) {
        case 'SwitchStatement':
          visitSwitch(stmt as SwitchStatementNode, depth + 1);
          break;
        case 'ExpressionStatement':
          visitExpression((stmt as ExpressionStatementNode).expression, depth);
          break;
        case 'ReturnStatement':
          visitExpression((stmt as ReturnStatementNode).argument as ExpressionNode, depth);
          break;
        case 'AssignmentStatement':
          visitExpression((stmt as AssignmentStatementNode).right as ExpressionNode, depth);
          break;
        case 'VariableDeclaration':
          visitExpression((stmt as VariableDeclarationNode).initializer as ExpressionNode, depth);
          break;
        case 'BlockStatement':
          if (stmt.kind === 'BlockStatement') {
            stmt.body.forEach((inner) => visitStatementNode(inner, depth));
          }
          break;
        default:
          break;
      }
    };

    const visitExpression = (expr: ExpressionNode | null | undefined, depth: number) => {
      if (!expr) {
        return;
      }
      if (expr.kind === 'SwitchStatement') {
        visitSwitch(expr as SwitchStatementNode, depth + 1);
        return;
      }
      switch (expr.kind) {
        case 'ConditionalExpression': {
          const conditional = expr as ConditionalExpressionNode;
          visitExpression(conditional.test, depth);
          visitExpression(conditional.consequent, depth);
          visitExpression(conditional.alternate, depth);
          break;
        }
        case 'BinaryExpression': {
          const binary = expr as BinaryExpressionNode;
          visitExpression(binary.left as ExpressionNode, depth);
          visitExpression(binary.right as ExpressionNode, depth);
          break;
        }
        case 'UnaryExpression': {
          const unary = expr as UnaryExpressionNode;
          visitExpression(unary.argument as ExpressionNode, depth);
          break;
        }
        case 'CallExpression': {
          const call = expr as CallExpressionNode;
          visitExpression(call.callee as ExpressionNode, depth);
          call.args.forEach((arg) => visitExpression(arg.value, depth));
          break;
        }
        case 'MemberExpression': {
          const member = expr as MemberExpressionNode;
          visitExpression(member.object as ExpressionNode, depth);
          break;
        }
        case 'TupleExpression': {
          const tuple = expr as TupleExpressionNode;
          tuple.elements.forEach((element) => visitExpression(element ?? null, depth));
          break;
        }
        case 'ArrayLiteral': {
          const arrayLiteral = expr as ArrayLiteralNode;
          arrayLiteral.elements.forEach((element) => visitExpression(element ?? null, depth));
          break;
        }
        default:
          break;
      }
    };

    visitSwitch(statement, 1);

    return maxDepth;
  }

  private validateSwitchStyleAst(cases: SwitchCaseNode[]): void {
    if (cases.length === 0) {
      return;
    }

    this.validateCaseFormattingAst(cases);

    if (cases.some((caseNode) => !caseNode.test)) {
      this.validateDefaultClausePlacementAst(cases);
    }
  }

  private validateCaseFormattingAst(cases: SwitchCaseNode[]): void {
    if (cases.length <= 1) {
      return;
    }

    const sourceLines = getSourceLines(this.context);
    const indentations = cases.map((caseNode) => {
      const line = caseNode.loc.start.line;
      const sourceLine = sourceLines[line - 1] ?? '';
      return sourceLine.length - sourceLine.trimStart().length;
    });

    const [firstIndent, ...rest] = indentations;
    const mismatchIndex = rest.findIndex((indent) => indent !== firstIndent);
    if (mismatchIndex === -1) {
      return;
    }

    const caseNode = cases[mismatchIndex + 1];
    const { line } = caseNode.loc.start;
    this.helper.addInfo(line, 1, 'Switch cases should have consistent indentation', 'PSV6-SWITCH-STYLE-INDENTATION');
  }

  private validateDefaultClausePlacementAst(cases: SwitchCaseNode[]): void {
    const defaultIndex = cases.findIndex((caseNode) => !caseNode.test);
    if (defaultIndex === -1 || defaultIndex === cases.length - 1) {
      return;
    }

    const defaultCase = cases[defaultIndex];
    const { line, column } = defaultCase.loc.start;
    this.helper.addInfo(
      line,
      column,
      'Default clause should be placed at the end of switch statement',
      'PSV6-SWITCH-STYLE-DEFAULT-PLACEMENT',
    );
  }

  /**
   * Detects deeply nested switch statements in cleanLines as a fallback
   * when AST parsing fails due to parser limitations.
   */
  private estimateSwitchDepthFromSource(statement: SwitchStatementNode): number {
    const sourceLines = getSourceLines(this.context);
    if (!sourceLines.length) {
      return 1;
    }

    const startLine = Math.max(statement.loc.start.line - 1, 0);
    const endLine = Math.min(statement.loc.end.line - 1, sourceLines.length - 1);

    let keywordCount = 0;
    for (let line = startLine; line <= endLine; line++) {
      const matches = sourceLines[line]?.match(/\bswitch\b/g);
      if (matches) {
        keywordCount += matches.length;
      }
    }

    return Math.max(1, keywordCount);
  }

  private hasGlobalNestedSwitchPattern(): boolean {
    const lines = getSourceLines(this.context);
    if (!lines.length) {
      return false;
    }

    for (let index = 1; index < lines.length; index++) {
      const current = lines[index]?.trim() ?? '';
      if (!current.startsWith('switch')) {
        continue;
      }

      for (let prev = index - 1; prev >= 0; prev--) {
        const candidate = (lines[prev] ?? '').trim();
        if (!candidate) {
          continue;
        }
        if (candidate.includes('=>')) {
          return true;
        }
        break;
      }
    }

    return false;
  }

  private detectDeepNestingFallback(): void {
    const lines = this.context.cleanLines || this.context.lines;
    
    let maxNestingDepth = 0;
    let currentNestingDepth = 0;
    let switchCount = 0;
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('//')) {
        return;
      }
      
      // Count switch statements and track nesting
      const switchMatches = trimmed.match(/\bswitch\b/g);
      if (switchMatches) {
        switchCount += switchMatches.length;
        currentNestingDepth += switchMatches.length;
        maxNestingDepth = Math.max(maxNestingDepth, currentNestingDepth);
      }
      
      // Simple heuristic: if we see multiple switch keywords in close proximity,
      // it's likely deeply nested
      if (switchCount > 2 && maxNestingDepth > 2) {
        this.helper.addWarning(
          lineNum,
          1,
          `Switch statement has deep nesting (${maxNestingDepth} levels), consider refactoring.`,
          'PSV6-SWITCH-DEEP-NESTING',
        );
        return; // Only add one warning per script
      }
    });
  }

}
