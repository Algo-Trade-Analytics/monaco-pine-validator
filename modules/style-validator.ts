/**
 * Code style and quality validation module for Pine Script v6
 * Handles naming conventions, magic numbers, complexity analysis, and code organization
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidatorConfig,
  type ValidationResult,
  type ValidationError,
} from '../core/types';
import { Codes } from '../core/codes';
import { ValidationHelper } from '../core/validation-helper';
import {
  type AssignmentStatementNode,
  type BinaryExpressionNode,
  type CallExpressionNode,
  type ExpressionNode,
  type ExpressionStatementNode,
  type FunctionDeclarationNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type NumberLiteralNode,
  type ProgramNode,
  type StatementNode,
  type UnaryExpressionNode,
  type VariableDeclarationNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';

type OperationKind = 'input' | 'calculation' | 'plot' | 'strategy' | 'other';

type PoorNameRecord = { line: number; column: number };

type MagicNumberRecord = { raw: string; line: number; column: number };

export class StyleValidator implements ValidationModule {
  name = 'StyleValidator';

  private helper = new ValidationHelper();
  private context!: ValidationContext;

  getDependencies(): string[] {
    return ['SyntaxValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.helper.reset();
    this.context = context;
    const astContext = this.getAstContext(config);

    const program = astContext?.ast ?? null;
    if (!program) {
      return this.helper.buildResult(context);
    }

    this.runAstAnalysis(program);

    return this.helper.buildResult(context);
  }

  private runAstAnalysis(program: ProgramNode): void {
    this.analyzeVariableNamingAst(program);
    this.analyzeMagicNumbersAst(program);
    this.analyzeFunctionComplexityAst(program);
    this.analyzeCodeOrganizationAst(program);
  }

  private analyzeVariableNamingAst(program: ProgramNode): void {
    const poorNames = new Map<string, PoorNameRecord>();

    visit(program, {
      VariableDeclaration: {
        enter: (path) => {
          const identifier = path.node.identifier;
          this.recordPoorVariableName(identifier, poorNames);
        },
      },
      AssignmentStatement: {
        enter: (path) => {
          const identifier = this.extractIdentifier(path.node.left);
          if (identifier) {
            this.recordPoorVariableName(identifier, poorNames);
          }
        },
      },
    });

    if (poorNames.size > 0) {
      const names = Array.from(poorNames.keys());
      const preview = names.slice(0, 5).join(', ');
      const suffix = names.length > 5 ? '...' : '';
      const firstLocation = poorNames.get(names[0])!;

      this.helper.addInfo(
        firstLocation.line,
        firstLocation.column,
        `Poor variable naming detected: ${preview}${suffix}`,
        Codes.STYLE_NAMING,
        'Use descriptive variable names that clearly indicate their purpose (e.g., sma_20 instead of x).',
      );
    }
  }

  private recordPoorVariableName(identifier: IdentifierNode, store: Map<string, PoorNameRecord>): void {
    const name = identifier.name;
    if (!this.isPoorVariableName(name)) {
      return;
    }
    if (!store.has(name)) {
      store.set(name, { line: identifier.loc.start.line, column: identifier.loc.start.column });
    }
  }

  private extractIdentifier(expression: ExpressionNode | null | undefined): IdentifierNode | null {
    if (!expression) {
      return null;
    }
    if (expression.kind === 'Identifier') {
      return expression;
    }
    return null;
  }

  private analyzeMagicNumbersAst(program: ProgramNode): void {
    const numbers: MagicNumberRecord[] = [];

    visit(program, {
      NumberLiteral: {
        enter: (path) => {
          const record = this.resolveNumericLiteral(path as NodePath<NumberLiteralNode>);
          if (!record) {
            return;
          }
          if (!this.isMagicNumberValue(record.value)) {
            return;
          }
          numbers.push({ raw: record.raw, line: record.line, column: record.column });
        },
      },
    });

    if (numbers.length > 0) {
      const uniqueValues = [...new Set(numbers.map((entry) => entry.raw))];
      const preview = uniqueValues.slice(0, 3).join(', ');
      const suffix = uniqueValues.length > 3 ? '...' : '';
      const location = numbers[0];

      this.helper.addInfo(
        location.line,
        location.column,
        `Magic numbers detected: ${preview}${suffix}`,
        Codes.STYLE_MAGIC,
        'Consider defining named constants for magic numbers to improve readability and maintainability.',
      );
    }
  }

  private resolveNumericLiteral(path: NodePath<NumberLiteralNode>): { value: number; raw: string; line: number; column: number } | null {
    const { node } = path;
    let value = node.value;
    let raw = node.raw;
    let line = node.loc.start.line;
    let column = node.loc.start.column;

    const parent = path.parent;
    if (parent?.node.kind === 'UnaryExpression') {
      const unary = parent.node as UnaryExpressionNode;
      if (unary.operator === '-') {
        value = -value;
        raw = `-${raw}`;
        line = unary.loc.start.line;
        column = unary.loc.start.column;
      }
    }

    return { value, raw, line, column };
  }

  private analyzeFunctionComplexityAst(program: ProgramNode): void {
    visit(program, {
      FunctionDeclaration: {
        enter: (path) => {
          const fn = path.node;
          const complexity = this.calculateFunctionComplexityAst(fn);
          const name = fn.identifier?.name ?? 'anonymous function';
          const location = fn.identifier ?? fn;

          if (complexity > 5) {
            this.helper.addWarning(
              location.loc.start.line,
              location.loc.start.column,
              `Function '${name}' has high complexity (${complexity} conditions).`,
              Codes.STYLE_COMPLEXITY,
              'Consider breaking down complex functions into smaller, more focused functions.',
            );
          }

          const length = fn.body.loc.end.line - fn.body.loc.start.line + 1;
          if (length > 20) {
            this.helper.addInfo(
              location.loc.start.line,
              location.loc.start.column,
              `Function '${name}' is quite long (${length} lines).`,
              Codes.STYLE_FUNCTION_LENGTH,
              'Consider breaking long functions into smaller, more manageable pieces.',
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

  private analyzeCodeOrganizationAst(program: ProgramNode): void {
    let taCount = 0;
    let plotCount = 0;
    let inputCount = 0;
    const operations: Array<{ type: OperationKind; line: number; column: number }> = [];

    let firstInputLine: number | null = null;
    let firstCalculationLine: number | null = null;

    for (const statement of program.body) {
      const operation = this.getOperationTypeFromStatement(statement);
      const containsTa = this.statementContainsOperation(statement, 'calculation');
      const containsPlot = this.statementContainsOperation(statement, 'plot');
      const containsInput = this.statementContainsOperation(statement, 'input');

      if (containsTa) {
        taCount += 1;
      }
      if (containsPlot) {
        plotCount += 1;
      }
      if (containsInput) {
        inputCount += 1;
      }

      if (containsInput && firstInputLine === null) {
        firstInputLine = statement.loc.start.line;
      }

      if ((containsTa || this.isCalculationDeclaration(statement)) && firstCalculationLine === null) {
        firstCalculationLine = statement.loc.start.line;
      }

      if (operation !== 'other') {
        operations.push({ type: operation, line: statement.loc.start.line, column: statement.loc.start.column });
      }
    }

    if (taCount >= 3 && plotCount >= 1) {
      const anchor = operations.find((entry) => entry.type === 'calculation') ?? operations[0];
      const line = anchor?.line ?? 1;
      const column = anchor?.column ?? 1;

      this.helper.addInfo(
        line,
        column,
        'Consider organizing code into logical sections: inputs, calculations, and plots.',
        Codes.STYLE_ORGANIZATION,
        'Group related operations together: inputs at the top, calculations in the middle, plots at the bottom.',
      );
    }

    if (this.hasMixedSections(operations)) {
      const anchor = operations[1] ?? operations[0];
      const line = anchor?.line ?? 1;
      const column = anchor?.column ?? 1;

      this.helper.addInfo(
        line,
        column,
        'Code sections appear mixed. Consider grouping related operations.',
        Codes.STYLE_MIXED_SECTIONS,
        'Organize code into clear sections: inputs, variables, calculations, conditions, and outputs.',
      );
    }

    if (firstInputLine !== null && firstCalculationLine !== null && firstInputLine > firstCalculationLine) {
      this.helper.addWarning(
        firstInputLine,
        1,
        'Inputs should be declared before calculations.',
        Codes.STYLE_INPUT_PLACEMENT,
        'Move input declarations to the top of the script, before any calculations.',
      );
    }
  }

  private getOperationTypeFromStatement(statement: StatementNode): OperationKind {
    const containsInput = this.statementContainsOperation(statement, 'input');
    if (containsInput) {
      return 'input';
    }

    if (this.statementContainsOperation(statement, 'calculation')) {
      return 'calculation';
    }

    if (this.statementContainsOperation(statement, 'plot')) {
      return 'plot';
    }

    if (this.statementContainsOperation(statement, 'strategy')) {
      return 'strategy';
    }

    if (this.isCalculationDeclaration(statement)) {
      return 'calculation';
    }

    return 'other';
  }

  private isCalculationDeclaration(statement: StatementNode): statement is VariableDeclarationNode {
    return statement.kind === 'VariableDeclaration' &&
      (statement.declarationKind === 'var' || statement.declarationKind === 'varip' || statement.declarationKind === 'const');
  }

  private hasMixedSections(operations: Array<{ type: OperationKind }>): boolean {
    if (operations.length < 3) {
      return false;
    }
    for (let index = 1; index < operations.length - 1; index++) {
      const prev = operations[index - 1];
      const current = operations[index];
      const next = operations[index + 1];
      if (
        prev.type !== 'other' &&
        next.type !== 'other' &&
        current.type !== 'other' &&
        current.type !== prev.type &&
        current.type !== next.type
      ) {
        return true;
      }
    }
    return false;
  }

  private statementContainsOperation(statement: StatementNode, kind: OperationKind): boolean {
    if (statement.kind === 'ExpressionStatement') {
      return this.expressionContainsOperation((statement as ExpressionStatementNode).expression, kind);
    }

    if (statement.kind === 'VariableDeclaration') {
      const declaration = statement as VariableDeclarationNode;
      if (declaration.initializer && this.expressionContainsOperation(declaration.initializer, kind)) {
        return true;
      }
      if (kind === 'calculation') {
        return this.isCalculationDeclaration(declaration);
      }
    }

    if (statement.kind === 'AssignmentStatement') {
      const assignment = statement as AssignmentStatementNode;
      return this.expressionContainsOperation(assignment.right ?? assignment.left, kind);
    }

    return false;
  }

  private expressionContainsOperation(expression: ExpressionNode | null | undefined, kind: OperationKind): boolean {
    if (!expression) {
      return false;
    }

    if (expression.kind === 'CallExpression') {
      if (this.getOperationFromCall(expression) === kind) {
        return true;
      }
      if (this.expressionContainsOperation(expression.callee, kind)) {
        return true;
      }
      return expression.args.some((arg) => this.expressionContainsOperation(arg.value, kind));
    }

    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (kind === 'strategy' && this.isIdentifierWithName(member.object, 'strategy')) {
        return true;
      }
      return this.expressionContainsOperation(member.object, kind);
    }

    if (expression.kind === 'BinaryExpression') {
      const binary = expression as BinaryExpressionNode;
      return (
        this.expressionContainsOperation(binary.left, kind) ||
        this.expressionContainsOperation(binary.right, kind)
      );
    }

    if (expression.kind === 'UnaryExpression') {
      const unary = expression as UnaryExpressionNode;
      return this.expressionContainsOperation(unary.argument, kind);
    }

    if (expression.kind === 'ConditionalExpression') {
      const ternary = expression;
      return (
        this.expressionContainsOperation(ternary.test, kind) ||
        this.expressionContainsOperation(ternary.consequent, kind) ||
        this.expressionContainsOperation(ternary.alternate, kind)
      );
    }

    if (expression.kind === 'TupleExpression') {
      return expression.elements.some((element) => this.expressionContainsOperation(element ?? null, kind));
    }

    if (expression.kind === 'ArrayLiteral') {
      return expression.elements.some((element) => this.expressionContainsOperation(element ?? null, kind));
    }

    if (expression.kind === 'IndexExpression') {
      return this.expressionContainsOperation(expression.object, kind) ||
        this.expressionContainsOperation(expression.index, kind);
    }

    return false;
  }

  private getOperationFromCall(call: CallExpressionNode): OperationKind | null {
    const callee = call.callee;

    if (callee.kind === 'Identifier') {
      if (callee.name === 'plot') {
        return 'plot';
      }
      if (callee.name.startsWith('plot')) {
        return 'plot';
      }
    }

    if (callee.kind === 'MemberExpression') {
      const member = callee as MemberExpressionNode;
      if (this.isIdentifierWithName(member.object, 'ta')) {
        return 'calculation';
      }
      if (this.isIdentifierWithName(member.object, 'input')) {
        return 'input';
      }
      if (this.isIdentifierWithName(member.object, 'plot')) {
        return 'plot';
      }
      if (this.isIdentifierWithName(member.object, 'strategy')) {
        return 'strategy';
      }
    }

    return null;
  }

  private isIdentifierWithName(expression: ExpressionNode, name: string): boolean {
    return expression.kind === 'Identifier' && (expression as IdentifierNode).name === name;
  }

  private isPoorVariableName(name: string): boolean {
    if (name.length === 1 && !['i', 'j', 'k', 'x', 'y', 'z'].includes(name)) {
      return true;
    }

    if (name.length <= 2 && !['pi', 'na', 'hl2', 'hlc3', 'ohlc4'].includes(name)) {
      return true;
    }

    const poorNames = ['temp', 'tmp', 'val', 'value', 'data', 'result', 'res', 'var', 'variable'];
    return poorNames.includes(name.toLowerCase());
  }

  private isMagicNumberValue(value: number): boolean {
    const magnitude = Math.abs(value);
    const commonValues = [0, 1, 2, 3, 4, 5, 10, 100, 1000, 10000];
    if (commonValues.includes(magnitude)) {
      return false;
    }
    return magnitude >= 20;
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    return 'ast' in this.context ? (this.context as AstValidationContext) : null;
  }
}
