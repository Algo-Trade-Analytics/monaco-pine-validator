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
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;

  getDependencies(): string[] {
    return ['SyntaxValidator', 'TypeValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.astContext = isAstValidationContext(context) && context.ast ? context : null;

    if (this.astContext?.ast) {
      this.validateSwitchStatementsAst(this.astContext.ast);
    } else {
      this.validateSwitchStatementsLegacy();
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

  private validateSwitchStatementsLegacy(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for switch statement (standalone or in assignment)
      const switchMatch = line.match(/^\s*switch\s+(.+)$/) || line.match(/^\s*\w+\s*=\s*switch\s+(.+)$/);
      if (switchMatch) {
        this.validateSwitchStatementLegacy(i, switchMatch[1].trim());
      }
    }
  }

  private validateSwitchStatementLegacy(startLine: number, switchExpression: string): void {
    const lineNum = startLine + 1;

    // Validate switch expression type
    this.validateSwitchExpressionLegacy(switchExpression, lineNum);

    // Parse switch cases and validate
    const { cases, hasDefault, defaultLine } = this.parseSwitchCasesLegacy(startLine);

    // Validate cases
    this.validateSwitchCasesLegacy(cases, switchExpression, lineNum);
    
    // Check for missing default clause
    if (!hasDefault) {
      this.addWarning(lineNum, 1, 'Switch statement should include a default clause.', 'PSV6-SWITCH-NO-DEFAULT');
    }
    
    // Check for duplicate case values
    this.validateDuplicateCasesLegacy(cases, lineNum);
    
    // Check for deep nesting
    this.validateSwitchNestingLegacy(startLine, lineNum);
    
    // Check for too many cases
    if (cases.length > 20) {
      this.addWarning(lineNum, 1, `Switch statement has ${cases.length} cases, consider refactoring.`, 'PSV6-SWITCH-TOO-MANY-CASES');
    }
    
    // Check for deep nesting
    this.validateSwitchNestingLegacy(startLine, lineNum);

    // Update type map with switch expression type
    this.updateSwitchTypeMapLegacy(startLine, switchExpression, cases);

    // Validate switch style
    this.validateSwitchStyleLegacy(startLine, cases, hasDefault);
  }

  private validateSwitchExpressionLegacy(expression: string, lineNum: number): void {
    // Check if expression is a valid type for switch
    const trimmed = expression.trim();
    
    // Allow string literals, variables, and function calls
    if (trimmed.match(/^"[^"]*"$/) || trimmed.match(/^'[^']*'$/)) {
      // String literal - valid
      return;
    }
    
    if (trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/)) {
      // Variable or property access - valid
      return;
    }
    
    if (trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*\s*\(/)) {
      // Function call - valid
      return;
    }
    
    // Check for empty expression
    if (trimmed === '') {
      this.addError(lineNum, 1, 'Switch statement requires an expression.', 'PSV6-SWITCH-SYNTAX');
    }
    
    // Check for numeric literals (should be string for switch)
    if (trimmed.match(/^\d+$/)) {
      this.addError(lineNum, 1, 'Switch expression should be a string, not a number. Use string conversion or string literal.', 'PSV6-SWITCH-TYPE');
    }
    
    // Check for boolean literals
    if (trimmed === 'true' || trimmed === 'false') {
      this.addError(lineNum, 1, 'Switch expression should be a string, not a boolean. Use string conversion or string literal.', 'PSV6-SWITCH-TYPE');
    }
  }

  private parseSwitchCasesLegacy(startLine: number): { cases: Array<{ value: string, line: number, returnType: string }>, hasDefault: boolean, defaultLine: number } {
    const cases: Array<{ value: string, line: number, returnType: string }> = [];
    let hasDefault = false;
    let defaultLine = 0;
    let caseValues = new Set<string>();
    
    // Look for cases in subsequent lines
    for (let i = startLine + 1; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;
      
      // Check if we've reached the end of the switch (next statement at same or higher indentation)
      const currentIndent = line.length - line.trimStart().length;
      const switchIndent = this.context.cleanLines[startLine].length - this.context.cleanLines[startLine].trimStart().length;
      
      if (line.trim() === '') continue; // Skip empty lines
      
      if (currentIndent <= switchIndent && line.trim() !== '') {
        // We've reached the end of the switch statement
        break;
      }
      
      // Check for case (quoted string)
      const quotedCaseMatch = line.match(/^\s*"([^"]*)"\s*=>\s*(.+)$/);
      if (quotedCaseMatch) {
        const caseValue = quotedCaseMatch[1];
        let returnValue = quotedCaseMatch[2].trim();
        
        // Handle multi-line return values (like nested switch statements)
        if (returnValue === '' || returnValue.endsWith('=>')) {
          // This is a multi-line return value, collect the full return value
          returnValue = this.collectMultiLineReturnValueLegacy(i, startLine, switchIndent);
        }
        
        // Check for duplicate case values
        if (caseValues.has(caseValue)) {
          this.addError(lineNum, 1, `Duplicate case value: "${caseValue}"`, 'PSV6-SWITCH-DUPLICATE-CASE');
        }
        caseValues.add(caseValue);
        
        // Infer return type
        const returnType = this.inferReturnTypeLegacy(returnValue);
        
        cases.push({
          value: caseValue,
          line: lineNum,
          returnType
        });
        
        // Case values in quotes are already strings, no need to validate
        continue;
      }
      
      // Check for case (unquoted - should be string)
      const unquotedCaseMatch = line.match(/^\s*([^"'\s][^=>]*?)\s*=>\s*(.+)$/);
      if (unquotedCaseMatch) {
        const caseValue = unquotedCaseMatch[1].trim();
        const returnValue = unquotedCaseMatch[2].trim();
        
        // Check for duplicate case values
        if (caseValues.has(caseValue)) {
          this.addError(lineNum, 1, `Duplicate case value: "${caseValue}"`, 'PSV6-SWITCH-DUPLICATE-CASE');
        }
        caseValues.add(caseValue);
        
        // Infer return type
        const returnType = this.inferReturnTypeLegacy(returnValue);
        
        cases.push({
          value: caseValue,
          line: lineNum,
          returnType
        });
        
        // Validate case value type - should be string
        this.validateCaseValueLegacy(caseValue, lineNum);
        continue;
      }
      
      // Check for default clause
      const defaultMatch = line.match(/^\s*=>\s*(.+)$/);
      if (defaultMatch) {
        hasDefault = true;
        defaultLine = lineNum;
        continue;
      }
    }
    
    return { cases, hasDefault, defaultLine };
  }

  private collectMultiLineReturnValueLegacy(startLine: number, switchStartLine: number, switchIndent: number): string {
    let returnValue = '';
    let currentLine = startLine + 1;
    
    while (currentLine < this.context.cleanLines.length) {
      const line = this.context.cleanLines[currentLine];
      const lineIndent = line.length - line.trimStart().length;
      
      // Stop if we've reached the end of the switch or unindented
      if (line.trim() === '') {
        currentLine++;
        continue;
      }
      
      if (lineIndent <= switchIndent) {
        break;
      }
      
      returnValue += line + '\n';
      currentLine++;
    }
    
    return returnValue.trim();
  }

  private validateSwitchCasesLegacy(cases: Array<{ value: string, line: number, returnType: string }>, switchExpression: string, switchLine: number): void {
    if (cases.length === 0) return;
    
    // Check for consistent return types
    const returnTypes = new Set(cases.map(c => c.returnType));
    if (returnTypes.size > 1) {
      this.addError(switchLine, 1, 'Switch statement cases must have consistent return types.', 'PSV6-SWITCH-RETURN-TYPE');
    }
    
    // Case values are already validated during parsing
  }

  private validateCaseValueLegacy(caseValue: string, lineNum: number): void {
    // Case values should be strings
    if (caseValue.match(/^\d+$/)) {
      this.addError(lineNum, 1, 'Case value should be a string, not a number. Use string literal.', 'PSV6-SWITCH-CASE-TYPE');
    }
    
    if (caseValue === 'true' || caseValue === 'false') {
      this.addError(lineNum, 1, 'Case value should be a string, not a boolean. Use string literal.', 'PSV6-SWITCH-CASE-TYPE');
    }
  }

  private validateDuplicateCasesLegacy(cases: Array<{ value: string, line: number, returnType: string }>, switchLine: number): void {
    const seen = new Set<string>();
    
    cases.forEach(case_ => {
      if (seen.has(case_.value)) {
        this.addError(case_.line, 1, `Duplicate case value: "${case_.value}"`, 'PSV6-SWITCH-DUPLICATE-CASE');
      }
      seen.add(case_.value);
    });
  }

  private validateSwitchNestingLegacy(startLine: number, switchLine: number): void {
    let nestingDepth = 1; // Start with 1 for the current switch
    
    // Count nested switch statements
    for (let i = startLine; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      
      // Check if we've reached the end of the current switch
      const currentIndent = line.length - line.trimStart().length;
      const switchIndent = this.context.cleanLines[startLine].length - this.context.cleanLines[startLine].trimStart().length;
      
      
      if (line.trim() === '') continue;
      
      if (currentIndent <= switchIndent && line.trim() !== '' && i > startLine) {
        break;
      }
      
      // Check for nested switch
      if (line.match(/^\s*switch\s+/)) {
        nestingDepth++;
      }
    }
    
    if (nestingDepth > 2) {
      this.addWarning(switchLine, 1, `Switch statement has deep nesting (${nestingDepth} levels), consider refactoring.`, 'PSV6-SWITCH-DEEP-NESTING');
    }
  }

  private inferReturnTypeLegacy(value: string): string {
    const trimmed = value.trim();
    
    // String literal
    if (trimmed.match(/^"[^"]*"$/) || trimmed.match(/^'[^']*'$/)) {
      return 'string';
    }
    
    // Numeric literal
    if (trimmed.match(/^\d+(\.\d+)?$/)) {
      return trimmed.includes('.') ? 'float' : 'int';
    }
    
    // Boolean literal
    if (trimmed === 'true' || trimmed === 'false') {
      return 'bool';
    }
    
    // Color literal
    if (trimmed.match(/^color\./)) {
      return 'color';
    }
    
    // Nested switch statement - treat as valid expression
    if (trimmed.includes('switch')) {
      return 'expression';
    }
    
    // Default to unknown
    return 'unknown';
  }

  private updateSwitchTypeMapLegacy(startLine: number, switchExpression: string, cases: Array<{ value: string, line: number, returnType: string }>): void {
    // Find the variable being assigned the switch result
    const line = this.context.cleanLines[startLine];
    const assignmentMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*switch\s+(.+)$/);
    
    
    if (assignmentMatch) {
      const varName = assignmentMatch[1];
      
      // Determine the return type of the switch expression
      const returnTypes = new Set(cases.map(c => c.returnType));
      let inferredType = 'unknown';
      
      if (returnTypes.size === 1) {
        // All cases return the same type
        inferredType = returnTypes.values().next().value || 'unknown';
      } else if (returnTypes.has('int') && returnTypes.has('float')) {
        // Mixed int/float - promote to float
        inferredType = 'float';
      } else if (returnTypes.has('string') && returnTypes.has('int')) {
        // Mixed string/int - use string
        inferredType = 'string';
      } else if (returnTypes.has('string') && returnTypes.has('float')) {
        // Mixed string/float - use string
        inferredType = 'string';
      } else {
        // Mixed types - use string as fallback
        inferredType = 'string';
      }
      
      // Update the type map
      this.context.typeMap.set(varName, {
        type: inferredType as any,
        isConst: false,
        isSeries: inferredType === 'series',
        declaredAt: { line: startLine + 1, column: 1 },
        usages: []
      });
    }
  }

  private validateSwitchStyleLegacy(startLine: number, cases: Array<{ value: string, line: number, returnType: string }>, hasDefault: boolean): void {
    // Check for consistent case formatting
    this.validateCaseFormattingLegacy(cases);
    
    // Check for default clause placement
    if (hasDefault) {
      this.validateDefaultClausePlacementLegacy(startLine);
    }
  }

  private validateCaseFormattingLegacy(cases: Array<{ value: string, line: number, returnType: string }>): void {
    // Check for consistent indentation in case statements
    const indentations = cases.map(c => {
      const line = this.context.cleanLines[c.line - 1];
      return line.length - line.trimStart().length;
    });
    
    if (indentations.length > 1) {
      const firstIndent = indentations[0];
      const inconsistentIndents = indentations.filter(indent => indent !== firstIndent);
      
      if (inconsistentIndents.length > 0) {
        // Find the first inconsistent case
        const inconsistentCase = cases[indentations.findIndex(indent => indent !== firstIndent)];
        this.addInfo(inconsistentCase.line, 1, 
          'Switch cases should have consistent indentation', 
          'PSV6-SWITCH-STYLE-INDENTATION');
      }
    }
  }

  private validateDefaultClausePlacementLegacy(startLine: number): void {
    // Check if default clause is at the end (best practice)
    let defaultLine = 0;
    let lastCaseLine = 0;
    
    // Find the default clause and last case
    for (let i = startLine + 1; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const trimmed = line.trim();
      
      if (trimmed.startsWith('=>') && !trimmed.includes('case')) {
        defaultLine = i + 1;
      } else if (trimmed.includes('=>') && !trimmed.startsWith('=>')) {
        lastCaseLine = i + 1;
      }
    }
    
    // Check if default clause is not at the end
    if (defaultLine > 0 && lastCaseLine > 0 && defaultLine < lastCaseLine) {
      this.addInfo(defaultLine, 1, 
        'Default clause should be placed at the end of switch statement', 
        'PSV6-SWITCH-STYLE-DEFAULT-PLACEMENT');
    }
  }
}
