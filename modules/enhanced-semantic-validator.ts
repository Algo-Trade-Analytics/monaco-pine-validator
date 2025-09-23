/**
 * Enhanced Semantic Validator Module
 *
 * Handles enhanced semantic validation for Pine Script v6:
 * - PSV6-TYPE-FLOW: Advanced type checking
 * - PSV6-TYPE-INFERENCE: Type inference suggestions
 */

import {
  type AstValidationContext,
  type ValidationContext,
  type ValidationError,
  type ValidationModule,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';
import type {
  AssignmentStatementNode,
  BinaryExpressionNode,
  CallExpressionNode,
  ConditionalExpressionNode,
  ExpressionNode,
  FunctionDeclarationNode,
  IdentifierNode,
  MemberExpressionNode,
  ProgramNode,
  TypeReferenceNode,
  VariableDeclarationNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';
import type { TypeMetadata } from '../core/ast/types';

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}

interface TypeReferenceInfo {
  qualifier: 'simple' | 'series' | 'input' | null;
  baseType: string | null;
}

export class EnhancedSemanticValidator implements ValidationModule {
  name = 'EnhancedSemanticValidator';
  priority = 85; // Run after type validation

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;

  getDependencies(): string[] {
    return ['CoreValidator', 'TypeValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.astContext = isAstValidationContext(context) && context.ast ? context : null;

    if (this.astContext?.ast) {
      this.validateWithAst(this.astContext.ast);
    } else {
      this.validateTypeFlowLegacy(context.lines);
      this.validateTypeInferenceLegacy(context.lines);
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: null,
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
  }

  private addError(line: number, column: number, message: string, code: string, suggestion?: string): void {
    this.errors.push({
      line,
      column,
      message,
      severity: 'error',
      code,
      suggestion,
    });
  }

  private addInfo(line: number, column: number, message: string, code: string, suggestion?: string): void {
    if (this.config.enableInfo === false) {
      return;
    }
    this.info.push({
      line,
      column,
      message,
      severity: 'info',
      code,
      suggestion,
    });
  }

  private validateWithAst(program: ProgramNode): void {
    if (!this.astContext) {
      return;
    }

    const typedVariables = new Set<string>();
    const inputVariables = new Set<string>();

    visit(program, {
      VariableDeclaration: {
        enter: (path) => {
          const node = (path as NodePath<VariableDeclarationNode>).node;
          this.handleAstVariableDeclaration(node, typedVariables, inputVariables);
        },
      },
      AssignmentStatement: {
        enter: (path) => {
          const node = (path as NodePath<AssignmentStatementNode>).node;
          this.handleAstAssignment(node, typedVariables);
        },
      },
      FunctionDeclaration: {
        enter: (path) => {
          const node = (path as NodePath<FunctionDeclarationNode>).node;
          this.handleAstFunctionDeclaration(node);
        },
      },
    });
  }

  private handleAstVariableDeclaration(
    node: VariableDeclarationNode,
    typedVariables: Set<string>,
    inputVariables: Set<string>,
  ): void {
    const name = node.identifier.name;

    if (node.typeAnnotation) {
      typedVariables.add(name);
    }

    const typeInfo = this.interpretTypeReference(node.typeAnnotation);
    if (typeInfo.qualifier === 'input') {
      inputVariables.add(name);
    }

    if (!node.initializer || !this.astContext) {
      return;
    }

    const initializerType = this.getExpressionType(node.initializer);

    if (this.shouldFlagSeriesToSimple(typeInfo, initializerType)) {
      const { line, column } = node.loc.start;
      this.addError(
        line,
        column,
        "Cannot assign series value to simple variable. Use [0] to get the current value.",
        'PSV6-TYPE-FLOW',
        'Use [0] to get the current value from a series',
      );
    }

    if (
      typeInfo.qualifier === 'series' &&
      this.expressionUsesIdentifiers(node.initializer, inputVariables)
    ) {
      const { line, column } = node.loc.start;
      this.addError(
        line,
        column,
        'Input value assigned to series variable may cause issues. Consider the context.',
        'PSV6-TYPE-FLOW',
        'Ensure input values are used appropriately in series context',
      );
    }

    if (!node.typeAnnotation && this.isComplexExpression(node.initializer)) {
      const { line, column } = node.loc.start;
      this.addInfo(
        line,
        column,
        'Consider adding explicit type annotation for better code clarity.',
        'PSV6-TYPE-INFERENCE',
        'Add explicit type annotation (e.g., int myVar = 42)',
      );
    }
  }

  private handleAstAssignment(
    node: AssignmentStatementNode,
    typedVariables: Set<string>,
  ): void {
    if (!node.right || node.left.kind !== 'Identifier') {
      return;
    }

    const identifier = node.left as IdentifierNode;
    if (typedVariables.has(identifier.name)) {
      return;
    }

    if (!this.isComplexExpression(node.right)) {
      return;
    }

    const { line, column } = node.loc.start;
    this.addInfo(
      line,
      column,
      'Consider adding explicit type annotation for better code clarity.',
      'PSV6-TYPE-INFERENCE',
      'Add explicit type annotation (e.g., int myVar = 42)',
    );
  }

  private handleAstFunctionDeclaration(node: FunctionDeclarationNode): void {
    if (node.returnType) {
      return;
    }

    const identifier = node.identifier?.name ?? null;
    if (!identifier) {
      return;
    }

    if (!this.shouldHaveReturnType(identifier) && !this.blockContainsConditional(node)) {
      return;
    }

    const { line, column } = node.loc.start;
    this.addInfo(
      line,
      column,
      'Consider adding explicit return type annotation for function clarity.',
      'PSV6-TYPE-INFERENCE',
      'Add explicit return type annotation (e.g., int myFunction() => ...)',
    );
  }

  private blockContainsConditional(node: FunctionDeclarationNode): boolean {
    let found = false;

    visit(node.body, {
      ConditionalExpression: {
        enter: () => {
          found = true;
          return false;
        },
      },
    });

    return found;
  }

  private interpretTypeReference(reference: TypeReferenceNode | null): TypeReferenceInfo {
    if (!reference) {
      return { qualifier: null, baseType: null };
    }

    const name = reference.name.name;
    if (name === 'series' || name === 'simple' || name === 'input') {
      const base = reference.generics[0] ? this.stringifyTypeReference(reference.generics[0]) : null;
      return { qualifier: name as TypeReferenceInfo['qualifier'], baseType: base };
    }

    return { qualifier: null, baseType: name };
  }

  private stringifyTypeReference(reference: TypeReferenceNode): string {
    const base = reference.name.name;
    if (reference.generics.length === 0) {
      return base;
    }
    const generic = reference.generics.map((child) => this.stringifyTypeReference(child)).join(', ');
    return `${base}<${generic}>`;
  }

  private getExpressionType(expression: ExpressionNode): TypeMetadata | null {
    return this.astContext?.typeEnvironment.nodeTypes.get(expression) ?? null;
  }

  private shouldFlagSeriesToSimple(
    typeInfo: TypeReferenceInfo,
    initializerType: TypeMetadata | null,
  ): boolean {
    if (!initializerType || initializerType.kind !== 'series') {
      return false;
    }

    if (typeInfo.qualifier === 'series') {
      return false;
    }

    if (typeInfo.qualifier === 'input') {
      return false;
    }

    if (typeInfo.qualifier === 'simple') {
      return true;
    }

    if (typeInfo.baseType && this.isPrimitiveType(typeInfo.baseType)) {
      return true;
    }

    return false;
  }

  private isPrimitiveType(name: string): boolean {
    return ['int', 'float', 'bool', 'string', 'color'].includes(name);
  }

  private expressionUsesIdentifiers(expression: ExpressionNode, identifiers: Set<string>): boolean {
    let found = false;

    visit(expression, {
      Identifier: {
        enter: (path) => {
          const identifier = (path as NodePath<IdentifierNode>).node;
          if (identifiers.has(identifier.name)) {
            found = true;
            return false;
          }
          return undefined;
        },
      },
    });

    return found;
  }

  private isComplexExpression(expression: ExpressionNode): boolean {
    switch (expression.kind) {
      case 'ConditionalExpression':
        return true;
      case 'BinaryExpression': {
        const binary = expression as BinaryExpressionNode;
        return ['+', '-', '*', '/', '%', '^'].includes(binary.operator);
      }
      case 'CallExpression': {
        const call = expression as CallExpressionNode;
        const calleeName = this.resolveCalleeName(call.callee);
        return Boolean(calleeName && (calleeName.startsWith('ta.') || calleeName.startsWith('request.')));
      }
      default:
        return false;
    }
  }

  private resolveCalleeName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }

    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (member.computed) {
        return null;
      }
      const objectName = this.resolveCalleeName(member.object);
      return objectName ? `${objectName}.${member.property.name}` : null;
    }

    return null;
  }

  // Legacy fallbacks ----------------------------------------------------------------

  private validateTypeFlowLegacy(lines: string[]): void {
    const seriesVariables = new Set<string>();
    const inputVariables = new Set<string>();

    for (const line of lines) {
      const seriesMatch = line.match(/^\s*series\s+(?:int|float|bool|string|color)\s+(\w+)/);
      if (seriesMatch) {
        seriesVariables.add(seriesMatch[1]);
      }

      const inputMatch = line.match(/^\s*input\s+(?:int|float|bool|string|color)\s+(\w+)/);
      if (inputMatch) {
        inputVariables.add(inputMatch[1]);
      }
    }

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      if (this.hasSeriesToSimpleAssignment(line, seriesVariables)) {
        this.addError(
          lineNum,
          1,
          'Cannot assign series value to simple variable. Use [0] to get the current value.',
          'PSV6-TYPE-FLOW',
          'Use [0] to get the current value from a series',
        );
      }

      if (this.hasInputToSeriesAssignment(line, inputVariables)) {
        this.addError(
          lineNum,
          1,
          'Input value assigned to series variable may cause issues. Consider the context.',
          'PSV6-TYPE-FLOW',
          'Ensure input values are used appropriately in series context',
        );
      }
    });
  }

  private validateTypeInferenceLegacy(lines: string[]): void {
    lines.forEach((line, index) => {
      const lineNum = index + 1;

      if (this.hasAmbiguousVariableDeclaration(line)) {
        this.addInfo(
          lineNum,
          1,
          'Consider adding explicit type annotation for better code clarity.',
          'PSV6-TYPE-INFERENCE',
          'Add explicit type annotation (e.g., int myVar = 42)',
        );
      }

      if (this.hasFunctionWithoutReturnType(line)) {
        this.addInfo(
          lineNum,
          1,
          'Consider adding explicit return type annotation for function clarity.',
          'PSV6-TYPE-INFERENCE',
          'Add explicit return type annotation (e.g., int myFunction() => ...)',
        );
      }
    });
  }

  /**
   * Check if a line has series to simple assignment
   */
  private hasSeriesToSimpleAssignment(line: string, seriesVariables: Set<string>): boolean {
    const seriesToSimplePattern = /^\s*simple\s+(?:int|float|bool|string|color)\s+(\w+)\s*=\s*(\w+)(?!\s*\[)/;
    const match = line.match(seriesToSimplePattern);

    if (match) {
      const [, , rhsVar] = match;
      const isSeries = this.isLikelySeriesVariable(rhsVar) || seriesVariables.has(rhsVar);
      return isSeries;
    }

    return false;
  }

  /**
   * Check if a line has input to series assignment
   */
  private hasInputToSeriesAssignment(line: string, inputVariables: Set<string>): boolean {
    const seriesDeclarationPattern = /^\s*series\s+(?:int|float|bool|string|color)\s+(\w+)\s*=/;
    const seriesMatch = line.match(seriesDeclarationPattern);

    if (!seriesMatch) {
      return false;
    }

    for (const inputVar of inputVariables) {
      const inputVarPattern = new RegExp(`\\b${inputVar}\\b`);
      if (inputVarPattern.test(line)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a line has ambiguous variable declaration
   */
  private hasAmbiguousVariableDeclaration(line: string): boolean {
    const ambiguousPattern = /^\s*(\w+)\s*=\s*(.+)$/;
    const match = line.match(ambiguousPattern);

    if (match) {
      const [, , value] = match;
      return this.isComplexExpressionString(value);
    }

    return false;
  }

  /**
   * Check if a line has function without return type
   */
  private hasFunctionWithoutReturnType(line: string): boolean {
    const functionPattern = /^\s*(\w+)\s*\([^)]*\)\s*=>/;
    const match = line.match(functionPattern);

    if (!match) {
      return false;
    }

    const funcName = match[1];
    if (this.shouldHaveReturnType(funcName)) {
      return true;
    }

    return line.includes('?');
  }

  private isLikelySeriesVariable(varName: string): boolean {
    const seriesVars = ['open', 'high', 'low', 'close', 'volume', 'time', 'bar_index', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'];
    return seriesVars.includes(varName);
  }

  private isComplexExpressionString(value: string): boolean {
    const complexPatterns = [/\([^)]+\)/, /[+\-*/%]/, /ta\./, /request\./, /\?.*:/];
    return complexPatterns.some((pattern) => pattern.test(value));
  }

  private shouldHaveReturnType(funcName: string): boolean {
    const returnTypeFunctions = [
      'calculate',
      'compute',
      'get',
      'find',
      'search',
      'check',
      'validate',
      'process',
      'transform',
      'convert',
      'parse',
      'format',
      'build',
      'create',
    ];

    return returnTypeFunctions.some((prefix) => funcName.toLowerCase().startsWith(prefix));
  }
}
