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

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private astContext: AstValidationContext | null = null;
  private usingAst = false;

  getDependencies(): string[] {
    return ['SyntaxValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.astContext = this.getAstContext(config);
    this.usingAst = !!this.astContext?.ast;

    if (this.usingAst && this.astContext?.ast) {
      this.runAstAnalysis(this.astContext.ast);
    } else {
      this.runLegacyAnalysis(this.context);
    }

    // Textual style checks still operate on clean lines regardless of AST availability
    this.analyzeCodeQualityTextual(this.context);

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: context.typeMap,
      scriptType: context.scriptType,
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
    this.usingAst = false;
  }

  private runAstAnalysis(program: ProgramNode): void {
    this.analyzeVariableNamingAst(program);
    this.analyzeMagicNumbersAst(program);
    this.analyzeFunctionComplexityAst(program);
    this.analyzeCodeOrganizationAst(program);
  }

  private runLegacyAnalysis(context: ValidationContext): void {
    this.analyzeVariableNamingLegacy(context);
    this.analyzeMagicNumbersLegacy(context);
    this.analyzeFunctionComplexityLegacy(context);
    this.analyzeCodeOrganizationLegacy(context);
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

      this.addInfo(
        firstLocation.line,
        firstLocation.column,
        `Poor variable naming detected: ${preview}${suffix}`,
        'PSV6-STYLE-NAMING',
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

      this.addInfo(
        location.line,
        location.column,
        `Magic numbers detected: ${preview}${suffix}`,
        'PSV6-STYLE-MAGIC',
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
            this.addWarning(
              location.loc.start.line,
              location.loc.start.column,
              `Function '${name}' has high complexity (${complexity} conditions).`,
              'PSV6-STYLE-COMPLEXITY',
              'Consider breaking down complex functions into smaller, more focused functions.',
            );
          }

          const length = fn.body.loc.end.line - fn.body.loc.start.line + 1;
          if (length > 20) {
            this.addInfo(
              location.loc.start.line,
              location.loc.start.column,
              `Function '${name}' is quite long (${length} lines).`,
              'PSV6-STYLE-FUNCTION-LENGTH',
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

      this.addInfo(
        line,
        column,
        'Consider organizing code into logical sections: inputs, calculations, and plots.',
        'PSV6-STYLE-ORGANIZATION',
        'Group related operations together: inputs at the top, calculations in the middle, plots at the bottom.',
      );
    }

    if (this.hasMixedSections(operations)) {
      const anchor = operations[1] ?? operations[0];
      const line = anchor?.line ?? 1;
      const column = anchor?.column ?? 1;

      this.addInfo(
        line,
        column,
        'Code sections appear mixed. Consider grouping related operations.',
        'PSV6-STYLE-MIXED-SECTIONS',
        'Organize code into clear sections: inputs, variables, calculations, conditions, and outputs.',
      );
    }

    if (firstInputLine !== null && firstCalculationLine !== null && firstInputLine > firstCalculationLine) {
      this.addWarning(
        firstInputLine,
        1,
        'Inputs should be declared before calculations.',
        'PSV6-STYLE-INPUT-PLACEMENT',
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

  private analyzeVariableNamingLegacy(context: ValidationContext): void {
    const poorNames: string[] = [];
    const variableDeclarations = new Map<string, number>();

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;

      const varMatch = line.match(/^\s*(?:var|varip|const)?\s*(?:int|float|bool|string|color)?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
      if (varMatch) {
        const varName = varMatch[1];
        variableDeclarations.set(varName, lineNum);

        if (this.isPoorVariableName(varName)) {
          poorNames.push(varName);
        }
      }

      const assignMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*[^=]/);
      if (assignMatch && !line.includes('if ') && !line.includes('for ') && !line.includes('while ')) {
        const varName = assignMatch[1];
        if (!variableDeclarations.has(varName) && this.isPoorVariableName(varName)) {
          poorNames.push(varName);
        }
      }
    }

    if (poorNames.length > 0) {
      this.addInfo(
        1,
        1,
        `Poor variable naming detected: ${poorNames.slice(0, 5).join(', ')}${poorNames.length > 5 ? '...' : ''}`,
        'PSV6-STYLE-NAMING',
        'Use descriptive variable names that clearly indicate their purpose (e.g., sma_20 instead of x).',
      );
    }
  }

  private analyzeMagicNumbersLegacy(context: ValidationContext): void {
    const magicNumbers: Array<{ value: string; line: number }> = [];

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;
      const noStrings = this.stripStringsAndLineComment(line);

      const numberMatches = noStrings.match(/\b(\d+(?:\.\d+)?)\b/g);
      if (!numberMatches) {
        continue;
      }

      for (const match of numberMatches) {
        const value = parseFloat(match);
        if (value < 5 || value === 100 || value === 1000 || value === 10000) {
          continue;
        }

        if (this.isMagicNumberValue(value)) {
          magicNumbers.push({ value: match, line: lineNum });
        }
      }
    }

    if (magicNumbers.length > 0) {
      const uniqueValues = [...new Set(magicNumbers.map((m) => m.value))];
      this.addInfo(
        magicNumbers[0]?.line ?? 1,
        1,
        `Magic numbers detected: ${uniqueValues.slice(0, 3).join(', ')}${uniqueValues.length > 3 ? '...' : ''}`,
        'PSV6-STYLE-MAGIC',
        'Consider defining named constants for magic numbers to improve readability and maintainability.',
      );
    }
  }

  private analyzeFunctionComplexityLegacy(context: ValidationContext): void {
    const functions = this.extractFunctions(context);

    for (const func of functions) {
      const complexity = this.calculateFunctionComplexityLegacy(func, context);

      if (complexity > 5) {
        this.addWarning(
          func.startLine,
          1,
          `Function '${func.name}' has high complexity (${complexity} conditions).`,
          'PSV6-STYLE-COMPLEXITY',
          'Consider breaking down complex functions into smaller, more focused functions.',
        );
      }

      const length = func.endLine - func.startLine + 1;
      if (length > 20) {
        this.addInfo(
          func.startLine,
          1,
          `Function '${func.name}' is quite long (${length} lines).`,
          'PSV6-STYLE-FUNCTION-LENGTH',
          'Consider breaking long functions into smaller, more manageable pieces.',
        );
      }
    }
  }

  private analyzeCodeOrganizationLegacy(context: ValidationContext): void {
    let taCount = 0;
    let plotCount = 0;
    let inputCount = 0;
    let mixedSections = false;

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];

      if (line.includes('ta.')) taCount++;
      if (line.includes('plot(')) plotCount++;
      if (line.includes('input.')) inputCount++;

      if (i > 0 && i < context.cleanLines.length - 1) {
        const prevLine = context.cleanLines[i - 1];
        const nextLine = context.cleanLines[i + 1];

        if (this.hasDifferentOperationTypes(line, prevLine, nextLine)) {
          mixedSections = true;
        }
      }
    }

    if (taCount >= 3 && plotCount >= 1) {
      this.addInfo(
        1,
        1,
        'Consider organizing code into logical sections: inputs, calculations, and plots.',
        'PSV6-STYLE-ORGANIZATION',
        'Group related operations together: inputs at the top, calculations in the middle, plots at the bottom.',
      );
    }

    if (mixedSections) {
      this.addInfo(
        1,
        1,
        'Code sections appear mixed. Consider grouping related operations.',
        'PSV6-STYLE-MIXED-SECTIONS',
        'Organize code into clear sections: inputs, variables, calculations, conditions, and outputs.',
      );
    }

    if (inputCount > 0) {
      this.validateInputPlacementLegacy(context);
    }
  }

  private analyzeCodeQualityTextual(context: ValidationContext): void {
    this.checkCommentedCode(context);
    this.checkLongLines(context);
    this.checkIndentationConsistency(context);
    this.checkDeadCode(context);
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

  private extractFunctions(context: ValidationContext): Array<{ name: string; startLine: number; endLine: number }> {
    const functions: Array<{ name: string; startLine: number; endLine: number }> = [];

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];

      const funcMatch = line.match(/^\s*(\w+)\s*\([^)]*\)\s*=>/);
      if (!funcMatch) {
        continue;
      }

      const funcName = funcMatch[1];
      const startLine = i + 1;
      let endLine = context.cleanLines.length;

      for (let j = i + 1; j < context.cleanLines.length; j++) {
        const nextLine = context.cleanLines[j];
        if (
          nextLine.match(/^\s*\w+\s*\([^)]*\)\s*=>/) ||
          nextLine.match(/^\s*(indicator|strategy|library)\s*\(/)
        ) {
          endLine = j;
          break;
        }
      }

      functions.push({ name: funcName, startLine, endLine });
    }

    return functions;
  }

  private calculateFunctionComplexityLegacy(
    func: { name: string; startLine: number; endLine: number },
    context: ValidationContext,
  ): number {
    let complexity = 0;

    for (let i = func.startLine - 1; i < func.endLine - 1; i++) {
      const line = context.cleanLines[i];

      if (line.includes('if ') || line.includes('else')) complexity++;
      if (line.includes('switch')) complexity++;
      if (line.includes('for ') || line.includes('while ')) complexity++;

      const andCount = (line.match(/\band\b/g) || []).length;
      const orCount = (line.match(/\bor\b/g) || []).length;
      complexity += andCount + orCount;
    }

    return complexity;
  }

  private hasDifferentOperationTypes(line: string, prevLine: string, nextLine: string): boolean {
    const getOperationType = (l: string) => {
      if (l.includes('input.')) return 'input';
      if (l.includes('ta.')) return 'calculation';
      if (l.includes('plot(')) return 'plot';
      if (l.includes('strategy.')) return 'strategy';
      return 'other';
    };

    const currentType = getOperationType(line);
    const prevType = getOperationType(prevLine);
    const nextType = getOperationType(nextLine);

    return (
      currentType !== prevType &&
      currentType !== nextType &&
      prevType !== 'other' &&
      nextType !== 'other'
    );
  }

  private validateInputPlacementLegacy(context: ValidationContext): void {
    let firstInputLine = -1;
    let firstCalculationLine = -1;

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];

      if (line.includes('input.') && firstInputLine === -1) {
        firstInputLine = i + 1;
      }

      if ((line.includes('ta.') || line.includes('var ') || line.includes('const ')) && firstCalculationLine === -1) {
        firstCalculationLine = i + 1;
      }
    }

    if (firstInputLine > firstCalculationLine && firstCalculationLine !== -1) {
      this.addWarning(
        firstInputLine,
        1,
        'Inputs should be declared before calculations.',
        'PSV6-STYLE-INPUT-PLACEMENT',
        'Move input declarations to the top of the script, before any calculations.',
      );
    }
  }

  private checkCommentedCode(context: ValidationContext): void {
    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;

      if (!line.trim().startsWith('//')) {
        continue;
      }

      const uncommented = line.replace(/^\/\/\s*/, '').trim();
      if (this.looksLikeCode(uncommented)) {
        this.addInfo(
          lineNum,
          1,
          'Commented code detected. Consider removing or documenting why it\'s commented.',
          'PSV6-STYLE-COMMENTED-CODE',
          'Remove commented code or add a comment explaining why it\'s kept.',
        );
      }
    }
  }

  private checkLongLines(context: ValidationContext): void {
    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;

      if (line.length > 120) {
        this.addInfo(
          lineNum,
          1,
          `Line is quite long (${line.length} characters).`,
          'PSV6-STYLE-LONG-LINE',
          'Consider breaking long lines for better readability.',
        );
      }
    }
  }

  private checkIndentationConsistency(context: ValidationContext): void {
    let hasTabs = false;
    let hasSpaces = false;

    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];

      if (line.startsWith('\t')) hasTabs = true;
      if (line.startsWith(' ')) hasSpaces = true;
    }

    if (hasTabs && hasSpaces) {
      this.addWarning(
        1,
        1,
        'Mixed tabs and spaces for indentation detected.',
        'PSV6-STYLE-MIXED-INDENTATION',
        'Use consistent indentation (either tabs or spaces, but not both).',
      );
    }
  }

  private checkDeadCode(context: ValidationContext): void {
    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;

      if (!line.includes('return') || i >= context.cleanLines.length - 1) {
        continue;
      }

      const nextLine = context.cleanLines[i + 1];
      if (nextLine.trim() !== '' && !nextLine.match(/^\s*(else|elif)/)) {
        this.addWarning(
          lineNum + 1,
          1,
          'Code after return statement may be unreachable.',
          'PSV6-STYLE-UNREACHABLE-CODE',
          'Remove unreachable code or restructure the logic.',
        );
      }
    }
  }

  private looksLikeCode(line: string): boolean {
    const codePatterns = [
      /^\w+\s*=/,
      /^\w+\s*\(/,
      /^\s*(if|for|while|switch)\b/,
      /^\s*(var|const|varip)\b/,
      /^\s*return\b/,
      /^\s*plot\b/,
      /^\s*strategy\./,
    ];

    return codePatterns.some((pattern) => pattern.test(line));
  }

  private stripStringsAndLineComment(line: string): string {
    return this.stripStrings(line).replace(/\/\/.*$/, '');
  }

  private stripStrings(line: string): string {
    return line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => ' '.repeat(m.length));
  }

  private addInfo(line: number, column: number, message: string, code: string, suggestion?: string): void {
    this.info.push({ line, column, message, severity: 'info', code, suggestion });
  }

  private addWarning(line: number, column: number, message: string, code: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  private addError(line: number, column: number, message: string, code: string, suggestion?: string): void {
    this.errors.push({ line, column, message, severity: 'error', code, suggestion });
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    return 'ast' in this.context ? (this.context as AstValidationContext) : null;
  }
}
