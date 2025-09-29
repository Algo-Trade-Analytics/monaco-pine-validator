/**
 * Linefill Validator
 * 
 * Validates Pine Script v6 Linefill functions and operations:
 * - Linefill creation validation (linefill.new)
 * - Linefill modification validation (linefill.set_color)
 * - Linefill deletion validation (linefill.delete)
 * - Linefill getter validation (linefill.get_line1, linefill.get_line2)
 * - Parameter type checking for all linefill functions
 * - Performance analysis for excessive linefills
 * - Best practices suggestions
 * 
 * Priority 85: High priority - linefills are important v6 drawing features
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
import {
  type ArgumentNode,
  type AssignmentStatementNode,
  type CallExpressionNode,
  type ExpressionNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type ProgramNode,
  type VariableDeclarationNode,
} from '../core/ast/nodes';
import { visit } from '../core/ast/traversal';
import { NS_MEMBERS } from '../core/constants';
import { ensureAstContext } from '../core/ast/context-utils';

interface LinefillFunctionCall {
  name: string;
  line: number;
  column: number;
  arguments: string[];
  inLoop?: boolean;
}

export class LinefillValidator implements ValidationModule {
  name = 'LinefillValidator';
  priority = 85; // High priority - linefills are important v6 drawing features

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private astContext: AstValidationContext | null = null;

  // Linefill function tracking
  private linefillFunctionCalls: LinefillFunctionCall[] = [];
  private linefillOperations = new Map<string, number>();
  private linefillCount = 0;
  private linefillIdentifiers: Set<string> = new Set();
  private typeMapUpdates: Map<string, TypeInfo> = new Map();
  
  // Suggestion flags to prevent duplicates
  private hasComplexOperationWarning = false;
  private hasCacheSuggestion = false;
  private hasCleanupSuggestion = false;
  private hasTransparencySuggestion = false;

  getDependencies(): string[] {
    return ['TypeValidator', 'FunctionValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.astContext = this.getAstContext(config);

    if (config.ast?.mode === 'disabled') {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: context.scriptType,
      };
    }

    const ast = this.astContext?.ast;
    if (!ast) {
      if (this.containsLinefillSyntax()) {
        this.addError(
          1,
          1,
          'Unable to parse linefill expression. Check linefill syntax.',
          'PSV6-LINEFILL-SYNTAX'
        );
      }
      return {
        isValid: this.errors.length === 0,
        errors: this.errors,
        warnings: this.warnings,
        info: this.info,
        typeMap: new Map(),
        scriptType: context.scriptType,
      };
    }

    this.collectLinefillDataFromAst(ast);

    // Post-process validations
    this.validateLinefillPerformance();
    this.validateLinefillBestPractices();

    // Build type map for other validators
    const typeMap = new Map<string, TypeInfo>();
    for (const [name, info] of this.typeMapUpdates) {
      typeMap.set(name, info);
    }
    typeMap.set('linefill.new', {
      type: 'linefill',
      isConst: false,
      isSeries: false,
      declaredAt: { line: 1, column: 1 },
      usages: [],
    });

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap,
      scriptType: null
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.linefillFunctionCalls = [];
    this.linefillOperations.clear();
    this.linefillCount = 0;
    this.linefillIdentifiers.clear();
    this.typeMapUpdates.clear();
    this.astContext = null;

    // Reset suggestion flags
    this.hasComplexOperationWarning = false;
    this.hasCacheSuggestion = false;
    this.hasCleanupSuggestion = false;
    this.hasTransparencySuggestion = false;
  }

  private containsLinefillSyntax(): boolean {
    const lines = this.context.cleanLines?.length ? this.context.cleanLines : this.context.lines ?? [];
    return lines.some((line) => line.includes('linefill.'));
  }

  private collectLinefillDataFromAst(program: ProgramNode): void {
    const loopStack: Array<'for' | 'while'> = [];

    visit(program, {
      VariableDeclaration: {
        enter: (path) => {
          this.registerAstLinefillDeclaration(path.node as VariableDeclarationNode);
        },
      },
      AssignmentStatement: {
        enter: (path) => {
          this.registerAstLinefillAssignment(path.node as AssignmentStatementNode);
        },
      },
      ForStatement: {
        enter: () => {
          loopStack.push('for');
        },
        exit: () => {
          loopStack.pop();
        },
      },
      WhileStatement: {
        enter: () => {
          loopStack.push('while');
        },
        exit: () => {
          loopStack.pop();
        },
      },
      CallExpression: {
        enter: (path) => {
          this.processAstCall(path.node as CallExpressionNode, loopStack.length > 0);
        },
      },
    });
  }

  private processAstCall(call: CallExpressionNode, inLoop: boolean): void {
    if (call.callee.kind !== 'MemberExpression') {
      return;
    }

    const member = call.callee as MemberExpressionNode;
    if (member.computed || !this.isLinefillNamespace(member.object)) {
      return;
    }

    const functionName = member.property.name;
    const args = call.args.map((argument) => this.getArgumentText(argument));
    const line = member.property.loc.start.line;
    const column = member.property.loc.start.column;

    this.recordLinefillCall(functionName, args, line, column, inLoop);
  }

  private registerAstLinefillDeclaration(declaration: VariableDeclarationNode): void {
    if (!declaration.initializer || declaration.initializer.kind !== 'CallExpression') {
      return;
    }

    const call = declaration.initializer as CallExpressionNode;
    if (!this.isLinefillNewCall(call)) {
      return;
    }

    this.registerLinefillIdentifier(declaration.identifier);
  }

  private registerAstLinefillAssignment(assignment: AssignmentStatementNode): void {
    if (!assignment.right || assignment.right.kind !== 'CallExpression') {
      return;
    }

    const call = assignment.right as CallExpressionNode;
    if (!this.isLinefillNewCall(call)) {
      return;
    }

    const identifier = this.extractAssignedIdentifier(assignment.left);
    if (!identifier) {
      return;
    }

    this.registerLinefillIdentifier(identifier);
  }

  private registerLinefillIdentifier(identifier: IdentifierNode): void {
    const name = identifier.name;
    if (!name) {
      return;
    }

    this.linefillIdentifiers.add(name);

    const line = identifier.loc?.start.line ?? 1;
    const column = identifier.loc?.start.column ?? 1;

    const typeInfo: TypeInfo = {
      type: 'linefill',
      isConst: false,
      isSeries: false,
      declaredAt: { line, column },
      usages: [],
    };

    this.typeMapUpdates.set(name, typeInfo);
    this.context.typeMap.set(name, typeInfo);
  }

  private recordLinefillCall(
    functionName: string,
    args: string[],
    lineNum: number,
    column: number,
    inLoop: boolean,
  ): void {
    if (process.env.DEBUG_LINEFILL === '1') {
      // eslint-disable-next-line no-console
      console.log('[LinefillValidator] call', functionName, args);
    }
    this.linefillFunctionCalls.push({
      name: functionName,
      line: lineNum,
      column,
      arguments: args,
      inLoop,
    });

    this.validateLinefillFunction(functionName, args, lineNum, column);

    const count = this.linefillOperations.get(functionName) || 0;
    this.linefillOperations.set(functionName, count + 1);

    if (functionName === 'new') {
      this.linefillCount++;
    }

    if (inLoop) {
      this.addWarning(lineNum, column, 'Linefill operation in loop', 'PSV6-LINEFILL-PERF-LOOP');
    }

    if (!this.hasComplexOperationWarning) {
      const callsOnLine = this.linefillFunctionCalls.filter((call) => call.line === lineNum);
      if (callsOnLine.length > 1) {
        this.addWarning(lineNum, column, 'Multiple linefill operations on one line', 'PSV6-LINEFILL-PERF-COMPLEX');
        this.hasComplexOperationWarning = true;
      }
    }
  }

  private validateLinefillFunction(functionName: string, args: string[], lineNum: number, column: number): void {
    // Check if it's a known linefill function
    if (!NS_MEMBERS.linefill || !NS_MEMBERS.linefill.has(functionName)) {
      this.addError(lineNum, column, `Unknown linefill function: linefill.${functionName}`, 'PSV6-LINEFILL-UNKNOWN-FUNCTION');
      return;
    }

    switch (functionName) {
      case 'new':
        this.validateLinefillNew(args, lineNum, column);
        break;
      case 'set_color':
        this.validateLinefillSetColor(args, lineNum, column);
        break;
      case 'delete':
        this.validateLinefillDelete(args, lineNum, column);
        break;
      case 'get_line1':
        this.validateLinefillGetLine1(args, lineNum, column);
        break;
      case 'get_line2':
        this.validateLinefillGetLine2(args, lineNum, column);
        break;
      default:
        this.addError(lineNum, column, `Unknown linefill function: linefill.${functionName}`, 'PSV6-LINEFILL-UNKNOWN-FUNCTION');
    }
  }

  private validateLinefillNew(args: string[], lineNum: number, column: number): void {
    if (args.length < 2) {
      this.addError(lineNum, column, 'linefill.new() requires at least 2 parameters (line1, line2)', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    // Validate line parameters
    const line1 = args[0].trim();
    const line2 = args[1].trim();

    if (!this.isLineObject(line1)) {
      this.addError(lineNum, column, 'Parameter 1 must be a line object', 'PSV6-FUNCTION-PARAM-TYPE');
    }

    if (!this.isLineObject(line2)) {
      this.addError(lineNum, column, 'Parameter 2 must be a line object', 'PSV6-FUNCTION-PARAM-TYPE');
    }

    // Validate optional color parameter
    if (args.length > 2) {
      const color = args[2].trim();
      if (!this.isColorExpression(color)) {
        this.addError(lineNum, column, 'color parameter must be a valid color', 'PSV6-FUNCTION-PARAM-TYPE');
      }
    }

    // Best practice suggestions - suggest transparency for solid colors (only once)
    if (!this.hasTransparencySuggestion) {
      if (args.length > 2) {
        const color = args[2].trim();
        // Suggest transparency if using a solid color (not already using color.new)
        if (color.startsWith('color=color.') && !color.includes('color.new')) {
          this.addInfo(lineNum, column, 'Consider using color.new() for transparency', 'PSV6-LINEFILL-TRANSPARENCY-SUGGESTION');
          this.hasTransparencySuggestion = true;
        }
      } else {
        // Suggest adding color with transparency
        this.addInfo(lineNum, column, 'Consider using color.new() for transparency', 'PSV6-LINEFILL-TRANSPARENCY-SUGGESTION');
        this.hasTransparencySuggestion = true;
      }
    }
  }

  private validateLinefillSetColor(args: string[], lineNum: number, column: number): void {
    if (args.length !== 2) {
      this.addError(lineNum, column, 'linefill.set_color() requires exactly 2 parameters', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    const linefillId = args[0].trim();
    const color = args[1].trim();

    if (!this.isLinefillObject(linefillId)) {
      this.addError(lineNum, column, 'Parameter 1 must be a linefill object', 'PSV6-FUNCTION-PARAM-TYPE');
    }

    if (!this.isColorExpression(color)) {
      this.addError(lineNum, column, 'color parameter must be a valid color', 'PSV6-FUNCTION-PARAM-TYPE');
    }
  }

  private validateLinefillDelete(args: string[], lineNum: number, column: number): void {
    if (args.length !== 1) {
      this.addError(lineNum, column, 'linefill.delete() requires exactly 1 parameter', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    const linefillId = args[0].trim();
    if (!this.isLinefillObject(linefillId)) {
      this.addError(lineNum, column, 'Parameter must be a linefill object', 'PSV6-FUNCTION-PARAM-TYPE');
    }
  }

  private validateLinefillGetLine1(args: string[], lineNum: number, column: number): void {
    if (args.length !== 1) {
      this.addError(lineNum, column, 'linefill.get_line1() requires exactly 1 parameter', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    const linefillId = args[0].trim();
    if (!this.isLinefillObject(linefillId)) {
      this.addError(lineNum, column, 'Parameter must be a linefill object', 'PSV6-FUNCTION-PARAM-TYPE');
    }
  }

  private validateLinefillGetLine2(args: string[], lineNum: number, column: number): void {
    if (args.length !== 1) {
      this.addError(lineNum, column, 'linefill.get_line2() requires exactly 1 parameter', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    const linefillId = args[0].trim();
    if (!this.isLinefillObject(linefillId)) {
      this.addError(lineNum, column, 'Parameter must be a linefill object', 'PSV6-FUNCTION-PARAM-TYPE');
    }
  }

  private validateLinefillPerformance(): void {
    // Check for too many linefill objects
    if (this.linefillCount > 10) {
      this.addWarning(
        0,
        0,
        `Too many linefill objects (${this.linefillCount}). Consider optimizing for better performance.`,
        'PSV6-LINEFILL-PERF-MANY'
      );
    }
  }

  private validateLinefillBestPractices(): void {
    // Check for repeated identical calls
    const callCounts = new Map<string, number>();
    for (const call of this.linefillFunctionCalls) {
      const key = `${call.name}(${call.arguments.join(',')})`;
      callCounts.set(key, (callCounts.get(key) || 0) + 1);
    }

    for (const [key, count] of callCounts) {
      if (count >= 3 && !this.hasCacheSuggestion) {
        const funcName = key.split('(')[0];
        this.addInfo(
          1,
          1,
          `Multiple similar linefill operations detected. Consider caching results.`,
          'PSV6-LINEFILL-CACHE-SUGGESTION'
        );
        this.hasCacheSuggestion = true;
        break; // Only suggest once
      }
    }

    // Suggest cleanup for many linefills
    if (this.linefillCount >= 5 && !this.hasCleanupSuggestion) {
      this.addInfo(
        1,
        1,
        'Consider using linefill.delete() to clean up unused linefills and improve performance.',
        'PSV6-LINEFILL-CLEANUP-SUGGESTION'
      );
      this.hasCleanupSuggestion = true;
    }
  }

  private isLineObject(value: string): boolean {
    const trimmed = value.trim();
    
    // Check if it's a line.new() call
    if (trimmed.includes('line.new(')) {
      return true;
    }
    
    // Check if it's a linefill getter call
    if (trimmed.includes('linefill.get_line')) {
      return true;
    }
    
    // Check if it's a variable that might be a line (from type map)
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      const typeInfo = this.context.typeMap.get(trimmed);
      if (typeInfo && typeInfo.type === 'line') {
        return true;
      }
    }
    
    // Be lenient - assume variables could be line objects
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      return true;
    }
    
    return false;
  }

  private isLinefillObject(value: string): boolean {
    const trimmed = value.trim();

    // Check if it's a linefill.new() call
    if (trimmed.includes('linefill.new(')) {
      return true;
    }

    if (this.linefillIdentifiers.has(trimmed)) {
      return true;
    }

    // Check if it's a variable that might be a linefill (from type map)
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      const typeInfo = this.context.typeMap.get(trimmed);
      // Accept 'map' as the type for linefill objects, since 'linefill' is not a valid type in the type system
      if (typeInfo && typeInfo.type === 'map') {
        return true;
      }
    }
    // Be lenient - assume variables could be linefill objects
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      return true;
    }
    
    return false;
  }

  private isColorExpression(value: string): boolean {
    const trimmed = value.trim();
    
    // Check for color namespace functions
    if (trimmed.includes('color.')) {
      return true;
    }
    
    // Check for hex colors
    if (trimmed.startsWith('#')) {
      return true;
    }
    
    // Check for rgb functions
    if (trimmed.startsWith('rgb')) {
      return true;
    }
    
    // Check for na
    if (trimmed === 'na') {
      return true;
    }
    
    // Check if it's a variable that might be a color
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      const typeInfo = this.context.typeMap.get(trimmed);
      if (typeInfo && typeInfo.type === 'color') {
        return true;
      }
      // Be lenient for variables
      return true;
    }
    
    return false;
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
  getLinefillFunctionCalls(): LinefillFunctionCall[] {
    return [...this.linefillFunctionCalls];
  }

  getLinefillOperations(): Map<string, number> {
    return new Map(this.linefillOperations);
  }

  getLinefillCount(): number {
    return this.linefillCount;
  }

  private getArgumentText(argument: ArgumentNode): string {
    const valueText = this.getExpressionText(argument.value).trim();
    if (argument.name) {
      return `${argument.name.name}=${valueText}`;
    }
    return valueText;
  }

  private getExpressionText(expression: ExpressionNode): string {
    switch (expression.kind) {
      case 'Identifier':
        return (expression as IdentifierNode).name;
      case 'MemberExpression': {
        const member = expression as MemberExpressionNode;
        if (member.computed) {
          return this.getNodeSource(member);
        }
        const objectText = this.getExpressionText(member.object);
        return `${objectText}.${member.property.name}`;
      }
      case 'CallExpression':
        return this.getNodeSource(expression);
      default:
        return this.getNodeSource(expression);
    }
  }

  private getNodeSource(node: ExpressionNode | ArgumentNode | CallExpressionNode | MemberExpressionNode): string {
    const sourceLines = (this.context.lines && this.context.lines.length > 0)
      ? this.context.lines
      : (this.context.cleanLines && this.context.cleanLines.length > 0)
        ? this.context.cleanLines
        : [];
    if (!node.loc) {
      return '';
    }
    const startLineIndex = Math.max(0, node.loc.start.line - 1);
    const endLineIndex = Math.max(0, node.loc.end.line - 1);
    if (startLineIndex === endLineIndex) {
      const line = sourceLines[startLineIndex] ?? '';
      return line.slice(node.loc.start.column - 1, Math.max(node.loc.start.column - 1, node.loc.end.column - 1));
    }
    const parts: string[] = [];
    const firstLine = sourceLines[startLineIndex] ?? '';
    parts.push(firstLine.slice(node.loc.start.column - 1));
    for (let index = startLineIndex + 1; index < endLineIndex; index++) {
      parts.push(sourceLines[index] ?? '');
    }
    const lastLine = sourceLines[endLineIndex] ?? '';
    parts.push(lastLine.slice(0, Math.max(0, node.loc.end.column - 1)));
    return parts.join('\n');
  }

  private isLinefillNamespace(expression: ExpressionNode): boolean {
    return expression.kind === 'Identifier' && (expression as IdentifierNode).name === 'linefill';
  }

  private isLinefillNewCall(call: CallExpressionNode): boolean {
    if (call.callee.kind !== 'MemberExpression') {
      return false;
    }

    const member = call.callee as MemberExpressionNode;
    return !member.computed && this.isLinefillNamespace(member.object) && member.property.name === 'new';
  }

  private extractAssignedIdentifier(expression: ExpressionNode): IdentifierNode | null {
    if (expression.kind === 'Identifier') {
      return expression as IdentifierNode;
    }
    return null;
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    return ensureAstContext(this.context, config);
  }
}
