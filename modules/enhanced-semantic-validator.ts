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
import { Codes } from '../core/codes';
import { ValidationHelper } from '../core/validation-helper';
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

  private helper = new ValidationHelper();
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;

  getDependencies(): string[] {
    return ['CoreValidator', 'TypeValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.config = config;

    this.astContext = isAstValidationContext(context) && context.ast ? context : null;

    if (!this.astContext?.ast) {
      return this.helper.buildResult(context);
    }

    this.validateWithAst(this.astContext.ast);

    return this.helper.buildResult(context);
  }

  private reset(): void {
    this.helper.reset();
    this.astContext = null;
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
      this.helper.addError(
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
      this.helper.addError(
        line,
        column,
        'Input value assigned to series variable may cause issues. Consider the context.',
        'PSV6-TYPE-FLOW',
        'Ensure input values are used appropriately in series context',
      );
    }

    if (!node.typeAnnotation && this.isComplexExpression(node.initializer)) {
      const { line, column } = node.loc.start;
      this.helper.addInfo(
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
    this.helper.addInfo(
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
    this.helper.addInfo(
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

    // Only flag if explicitly declared as 'simple'
    if (typeInfo.qualifier === 'simple') {
      return true;
    }

    // In Pine Script v6, primitive types without a qualifier default to 'series', not 'simple'
    // So we should NOT flag them when qualifier is null
    // if (typeInfo.baseType && this.isPrimitiveType(typeInfo.baseType)) {
    //   return true;
    // }

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

}
