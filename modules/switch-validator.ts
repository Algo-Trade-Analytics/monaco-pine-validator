/**
 * Switch Statement Validation Module for Pine Script v6
 * Handles validation of switch statements, case values, and default clauses
 */

import {
  AstValidationContext,
  ValidationModule,
  ValidationContext,
  ValidatorConfig,
  ValidationError,
  ValidationResult,
} from '../core/types';
import type {
  AssignmentStatementNode,
  ExpressionNode,
  ExpressionStatementNode,
  ProgramNode,
  ReturnStatementNode,
  SwitchCaseNode,
  SwitchStatementNode,
  VariableDeclarationNode,
} from '../core/ast/nodes';
import { visit } from '../core/ast/traversal';
import type { TypeMetadata } from '../core/ast/types';

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}

export class SwitchValidator implements ValidationModule {
  name = 'SwitchValidator';
  priority = 95; // Runs before TypeInferenceValidator to provide switch type information

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private astContext: AstValidationContext | null = null;

  getDependencies(): string[] {
    return ['SyntaxValidator', 'TypeValidator'];
  }

  validate(context: ValidationContext, _config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;

    void _config;

    this.astContext = isAstValidationContext(context) && context.ast ? context : null;
    const ast = this.astContext?.ast;

    if (!ast) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: context.scriptType,
      };
    }

    this.validateSwitchStatementsAst(ast);

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: context.scriptType,
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
  }

  private addError(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.errors.push({ line, column, message, severity: 'error', code, suggestion });
  }

  private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  private addInfo(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.info.push({ line, column, message, severity: 'info', code, suggestion });
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
      this.addWarning(
        line,
        column,
        'Switch statement should include a default clause.',
        'PSV6-SWITCH-NO-DEFAULT',
      );
    }

    if (statement.cases.length > 20) {
      const { line, column } = statement.loc.start;
      this.addWarning(
        line,
        column,
        `Switch statement has ${statement.cases.length} cases, consider refactoring.`,
        'PSV6-SWITCH-TOO-MANY-CASES',
      );
    }

    if (returnTypes.size > 1) {
      const { line, column } = statement.loc.start;
      this.addError(
        line,
        column,
        'Switch statement cases must have consistent return types.',
        'PSV6-SWITCH-RETURN-TYPE',
      );
    }

    const nestingDepth = this.computeSwitchNestingDepth(statement);
    if (nestingDepth > 2) {
      const { line, column } = statement.loc.start;
      this.addWarning(
        line,
        column,
        `Switch statement has deep nesting (${nestingDepth} levels), consider refactoring.`,
        'PSV6-SWITCH-DEEP-NESTING',
      );
    }

    this.validateSwitchStyleAst(statement.cases);
  }

  private validateSwitchExpressionAst(statement: SwitchStatementNode): void {
    const expression = statement.discriminant;
    if (!expression) {
      const { line, column } = statement.loc.start;
      this.addError(line, column, 'Switch statement requires an expression.', 'PSV6-SWITCH-SYNTAX');
      return;
    }

    switch (expression.kind) {
      case 'StringLiteral':
      case 'Identifier':
      case 'MemberExpression':
      case 'CallExpression':
        return;
      case 'NumberLiteral': {
        const { line, column } = expression.loc.start;
        this.addError(
          line,
          column,
          'Switch expression should be a string, not a number. Use string conversion or string literal.',
          'PSV6-SWITCH-TYPE',
        );
        return;
      }
      case 'BooleanLiteral': {
        const { line, column } = expression.loc.start;
        this.addError(
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
      this.addError(
        line,
        column,
        'Case value should be a string, not a number. Use string literal.',
        'PSV6-SWITCH-CASE-TYPE',
      );
    } else if (test.kind === 'BooleanLiteral') {
      this.addError(
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
      this.addError(line, column, `Duplicate case value: ${key}`, 'PSV6-SWITCH-DUPLICATE-CASE');
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

  private computeSwitchNestingDepth(statement: SwitchStatementNode): number {
    let maxDepth = 0;
    const stack: number[] = [];

    visit(statement, {
      SwitchStatement: {
        enter: () => {
          const parentDepth = stack.length > 0 ? stack[stack.length - 1] : 0;
          const currentDepth = parentDepth + 1;
          stack.push(currentDepth);
          if (currentDepth > maxDepth) {
            maxDepth = currentDepth;
          }
        },
        exit: () => {
          stack.pop();
        },
      },
    });

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

    const indentations = cases.map((caseNode) => {
      const line = caseNode.loc.start.line;
      const sourceLine = this.context.cleanLines[line - 1] ?? '';
      return sourceLine.length - sourceLine.trimStart().length;
    });

    const [firstIndent, ...rest] = indentations;
    const mismatchIndex = rest.findIndex((indent) => indent !== firstIndent);
    if (mismatchIndex === -1) {
      return;
    }

    const caseNode = cases[mismatchIndex + 1];
    const { line } = caseNode.loc.start;
    this.addInfo(line, 1, 'Switch cases should have consistent indentation', 'PSV6-SWITCH-STYLE-INDENTATION');
  }

  private validateDefaultClausePlacementAst(cases: SwitchCaseNode[]): void {
    const defaultIndex = cases.findIndex((caseNode) => !caseNode.test);
    if (defaultIndex === -1 || defaultIndex === cases.length - 1) {
      return;
    }

    const defaultCase = cases[defaultIndex];
    const { line, column } = defaultCase.loc.start;
    this.addInfo(
      line,
      column,
      'Default clause should be placed at the end of switch statement',
      'PSV6-SWITCH-STYLE-DEFAULT-PLACEMENT',
    );
  }

}
