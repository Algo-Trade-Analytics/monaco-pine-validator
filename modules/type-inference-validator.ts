/**
 * Enhanced Type Inference validation module for Pine Script v6
 * Handles advanced type inference, type compatibility, and type safety
 */

import {
  type ValidationModule,
  type ValidationContext,
  type ValidationError,
  type ValidationResult,
  type ValidatorConfig,
  type TypeInfo,
  type AstValidationContext,
} from '../core/types';
import { BUILTIN_FUNCTIONS_V6_RULES, NAMESPACES } from '../core/constants';
import {
  type ProgramNode,
  type VariableDeclarationNode,
  type AssignmentStatementNode,
  type ExpressionNode,
  type CallExpressionNode,
  type IfStatementNode,
  type BinaryExpressionNode,
  type ArgumentNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type TypeReferenceNode,
  type NumberLiteralNode,
  type StringLiteralNode,
  type BooleanLiteralNode,
} from '../core/ast/nodes';
import { visit } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';
import type { TypeEnvironment, TypeMetadata } from '../core/ast/types';

const SERIES_IDENTIFIERS = new Set(['open', 'high', 'low', 'close', 'volume']);
const ARITHMETIC_OPERATORS = new Set(['+', '-', '*', '/', '%', '^']);
const COMPARISON_OPERATORS = new Set(['==', '!=', '>', '<', '>=', '<=']);

const ARRAY_TYPED_CONSTRUCTORS: Record<string, string> = {
  'array.new_bool': 'bool',
  'array.new_box': 'box',
  'array.new_color': 'color',
  'array.new_float': 'float',
  'array.new_int': 'int',
  'array.new_label': 'label',
  'array.new_line': 'line',
  'array.new_linefill': 'linefill',
  'array.new_string': 'string',
  'array.new_table': 'table',
};

export class TypeInferenceValidator implements ValidationModule {
  name = 'TypeInferenceValidator';
  priority = 90; // Run before FunctionValidator to ensure type inference is complete
  
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;
  private astTypeEnvironment: TypeEnvironment | null = null;

  getDependencies(): string[] {
    return ['SyntaxValidator', 'TypeValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.astContext = this.getAstContext(config);
    this.astTypeEnvironment = this.astContext?.typeEnvironment ?? null;

    const ast = this.astContext?.ast;
    if (ast) {
      this.validateWithAst(ast);
    }

    if (Array.isArray(this.context.cleanLines) && this.context.cleanLines.length > 0) {
      this.validateTypeCompatibility();
      this.validateTypeInference();
      this.validateTypeSafety();
      this.validateImplicitConversions();
      this.validateTypeAnnotations();
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
    this.astTypeEnvironment = null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AST-backed validation
  // ──────────────────────────────────────────────────────────────────────────

  private validateWithAst(program: ProgramNode): void {
    visit(program, {
      VariableDeclaration: {
        enter: (path) => this.handleVariableDeclaration(path.node),
      },
      AssignmentStatement: {
        enter: (path) => this.handleAssignment(path.node),
      },
      IfStatement: {
        enter: (path) => this.handleIfStatement(path.node),
      },
      CallExpression: {
        enter: (path) => this.handleCallExpression(path.node),
      },
      BinaryExpression: {
        enter: (path) => this.handleBinaryExpression(path.node),
      },
    });
  }

  private handleVariableDeclaration(node: VariableDeclarationNode): void {
    const initializer = node.initializer;
    if (!initializer) {
      return;
    }

    const declaredInfo = node.typeAnnotation ? this.parseTypeReference(node.typeAnnotation) : null;
    const declaredType = declaredInfo?.type ?? null;
    const declaredElementType = declaredInfo?.elementType;
    const declaredValueType = declaredInfo?.valueType;
    const initializerType = this.getExpressionType(initializer);
    const collectionInfo = this.inferCollectionTypeFromExpression(initializer);
    const { line, column } = node.loc.start;

    if (this.isNaExpression(initializer)) {
      this.addWarning(
        line,
        column,
        "Assigning 'na' directly can lead to ambiguous comparisons. Prefer using na() helpers for checks.",
        'PSV6-TYPE-SAFETY-NA-FUNCTION',
      );
    }

    if (!declaredType || declaredType === 'unknown') {
      if (!initializerType || initializerType === 'unknown') {
        this.addWarning(
          line,
          column,
          `Unable to infer type for '${node.identifier.name}'. Consider adding an explicit annotation.`,
          'PSV6-TYPE-INFERENCE-AMBIGUOUS',
        );
      }

      if (this.isLiteralExpression(initializer)) {
        this.addInfo(
          line,
          column,
          `Consider annotating '${node.identifier.name}' with its literal type for readability.`,
          'PSV6-TYPE-ANNOTATION-SUGGESTION',
        );
      }

      if (collectionInfo) {
        this.registerVariableTypeInfo(
          node.identifier.name,
          collectionInfo.type,
          collectionInfo.elementType,
          collectionInfo.keyType,
          collectionInfo.valueType,
          line,
          column,
          node.declarationKind === 'const',
        );
      }

      return;
    }

    if (!initializerType || initializerType === 'unknown') {
      this.addWarning(
        line,
        column,
        `Unable to infer type for '${node.identifier.name}' initializer.`,
        'PSV6-TYPE-INFERENCE-AMBIGUOUS',
      );
      return;
    }

    if (declaredType === 'int' && initializerType === 'float') {
      this.addWarning(
        line,
        column,
        `Implicit float-to-int conversion for '${node.identifier.name}'. Cast explicitly to avoid truncation.`,
        'PSV6-TYPE-CONVERSION-FLOAT-TO-INT',
      );
      return;
    }

    if (!this.areTypesCompatible(declaredType, initializerType)) {
      this.addError(
        line,
        column,
        `Type mismatch: cannot assign ${initializerType} to ${declaredType} variable '${node.identifier.name}'.`,
        'PSV6-TYPE-ASSIGNMENT-MISMATCH',
      );
      this.addError(
        line,
        column,
        `Type annotation '${declaredType}' does not match assigned value type '${initializerType}'.`,
        'PSV6-TYPE-ANNOTATION-MISMATCH',
      );
      return;
    }

    if (this.isLiteralExpression(initializer)) {
      this.addInfo(
        line,
        column,
        `Type annotation '${declaredType}' for '${node.identifier.name}' is redundant for literal assignment.`,
        'PSV6-TYPE-ANNOTATION-REDUNDANT',
      );
    }

    this.registerVariableTypeInfo(
      node.identifier.name,
      declaredType,
      declaredElementType ?? collectionInfo?.elementType,
      declaredInfo?.keyType ?? collectionInfo?.keyType,
      declaredValueType ?? collectionInfo?.valueType,
      line,
      column,
      node.declarationKind === 'const',
    );
  }

  private handleAssignment(node: AssignmentStatementNode): void {
    if (!node.right) {
      return;
    }

    const right = node.right;
    const { line, column } = right.loc.start;

    if (this.isNaExpression(right)) {
      this.addWarning(
        line,
        column,
        "Assigning 'na' directly can lead to ambiguous comparisons. Prefer using na() helpers for checks.",
        'PSV6-TYPE-SAFETY-NA-FUNCTION',
      );
    }

    const valueType = this.getExpressionType(right);
    if (!valueType || valueType === 'unknown') {
      this.addWarning(
        line,
        column,
        'Unable to determine assignment type. The resulting value will be treated as series.',
        'PSV6-TYPE-INFERENCE-AMBIGUOUS',
      );
    }

    if (node.left.kind === 'Identifier') {
      const identifier = node.left as IdentifierNode;
      const inferredCollection = this.inferCollectionTypeFromExpression(right);
      if (inferredCollection) {
        this.registerVariableTypeInfo(
          identifier.name,
          inferredCollection.type,
          inferredCollection.elementType,
          inferredCollection.keyType,
          inferredCollection.valueType,
          identifier.loc.start.line,
          identifier.loc.start.column,
          false,
        );
      }
    }
  }

  private handleIfStatement(node: IfStatementNode): void {
    const test = node.test;
    const testType = this.getExpressionType(test);

    if (testType === 'bool') {
      return;
    }

    const { line, column } = test.loc.start;
    const isSeriesIdentifier = test.kind === 'Identifier' && SERIES_IDENTIFIERS.has((test as IdentifierNode).name);
    const isNumericLiteral = test.kind === 'NumberLiteral';
    const isStringLiteral = test.kind === 'StringLiteral';

    if (isNumericLiteral || isStringLiteral || isSeriesIdentifier || testType === 'series') {
      this.addWarning(line, column, 'Non-boolean expression used as condition.', 'PSV6-TYPE-CONDITIONAL-TYPE');
      this.addWarning(
        line,
        column,
        `Implicit boolean conversion of '${testType ?? 'unknown'}' expression.`,
        'PSV6-TYPE-CONVERSION-IMPLICIT-BOOL',
      );
      return;
    }

    this.addWarning(
      line,
      column,
      `Implicit boolean conversion of '${testType ?? 'unknown'}' expression.`,
      'PSV6-TYPE-CONVERSION-IMPLICIT-BOOL',
    );
  }

  private handleCallExpression(node: CallExpressionNode): void {
    const calleeName = this.resolveCalleeName(node.callee);
    if (!calleeName) {
      return;
    }

    if (calleeName === 'str.tostring' && node.args.length > 0) {
      const argumentType = this.getExpressionType(node.args[0].value);
      if (argumentType === 'string') {
        const { line, column } = node.args[0].value.loc.start;
        this.addInfo(
          line,
          column,
          'Calling str.tostring on an existing string is redundant.',
          'PSV6-TYPE-CONVERSION-REDUNDANT-STRING',
        );
      }
    }

    if (calleeName === 'ta.sma') {
      this.validateTaSmaCall(node);
      return;
    }

    if (calleeName === 'math.max') {
      this.validateMathMaxCall(node);
      return;
    }

    if (calleeName === 'ta.crossover') {
      this.validateTaCrossoverCall(node);
    }
  }

  private handleBinaryExpression(node: BinaryExpressionNode): void {
    if (this.isNaExpression(node.left) || this.isNaExpression(node.right)) {
      const { line, column } = node.loc.start;
      if (ARITHMETIC_OPERATORS.has(node.operator)) {
        this.addWarning(
          line,
          column,
          "Arithmetic with 'na' literal always yields 'na'; guard against na before performing operations.",
          'PSV6-TYPE-SAFETY-NA-ARITHMETIC',
        );
      } else if (COMPARISON_OPERATORS.has(node.operator)) {
        this.addWarning(
          line,
          column,
          "Comparisons with 'na' literal are unsafe. Use na() helpers like na(value) instead.",
          'PSV6-TYPE-SAFETY-NA-COMPARISON',
        );
      }
    }

    if (!ARITHMETIC_OPERATORS.has(node.operator)) {
      return;
    }

    const leftType = this.getExpressionType(node.left);
    const rightType = this.getExpressionType(node.right);

    if (!this.isImplicitNumericConversion(leftType, rightType)) {
      return;
    }

    const { line, column } = node.loc.start;
    this.addWarning(
      line,
      column,
      'Implicit numeric conversion detected. Cast explicitly to clarify intent.',
      'PSV6-TYPE-CONVERSION',
    );
  }

  private isImplicitNumericConversion(leftType: string | null, rightType: string | null): boolean {
    if (!leftType || !rightType) {
      return false;
    }

    return (
      (leftType === 'int' && rightType === 'float') ||
      (leftType === 'float' && rightType === 'int')
    );
  }

  private validateTaSmaCall(node: CallExpressionNode): void {
    if (node.args.length === 0) {
      return;
    }

    const sourceArg = node.args[0];
    const lengthArg = node.args[1];
    const sourceType = this.getExpressionType(sourceArg.value);

    if (sourceType && (sourceType === 'string' || sourceType === 'bool')) {
      const { line, column } = sourceArg.value.loc.start;
      this.addError(
        line,
        column,
        `ta.sma source expects numeric series but received ${sourceType}.`,
        'PSV6-TYPE-FUNCTION-PARAM-MISMATCH',
      );
    }

    if (lengthArg) {
      const lengthType = this.getExpressionType(lengthArg.value);
      const isIntegralLiteral =
        lengthArg.value.kind === 'NumberLiteral' && Number.isInteger((lengthArg.value as NumberLiteralNode).value);

      if (lengthType && lengthType !== 'int') {
        if (lengthType === 'float' && isIntegralLiteral) {
          return;
        }

        const { line, column } = lengthArg.value.loc.start;
        this.addError(
          line,
          column,
          `ta.sma length expects int but received ${lengthType}.`,
          'PSV6-TYPE-FUNCTION-PARAM-MISMATCH',
        );
      }
    }
  }

  private validateMathMaxCall(node: CallExpressionNode): void {
    const [firstArg, secondArg] = node.args;
    if (!firstArg || !secondArg) {
      return;
    }

    const firstType = this.getExpressionType(firstArg.value);
    const secondType = this.getExpressionType(secondArg.value);

    if (firstType && !this.isNumericType(firstType)) {
      const { line, column } = firstArg.value.loc.start;
      this.addError(
        line,
        column,
        `math.max expects numeric arguments but received ${firstType}.`,
        'PSV6-TYPE-FUNCTION-PARAM-MISMATCH',
      );
    }

    if (secondType && !this.isNumericType(secondType)) {
      const { line, column } = secondArg.value.loc.start;
      this.addError(
        line,
        column,
        `math.max expects numeric arguments but received ${secondType}.`,
        'PSV6-TYPE-FUNCTION-PARAM-MISMATCH',
      );
    }
  }

  private validateTaCrossoverCall(node: CallExpressionNode): void {
    if (node.args.length < 2) {
      return;
    }

    const firstType = this.getExpressionType(node.args[0].value);
    const secondType = this.getExpressionType(node.args[1].value);

    if (firstType && (firstType === 'string' || firstType === 'bool')) {
      const { line, column } = node.args[0].value.loc.start;
      this.addError(
        line,
        column,
        `ta.crossover arguments must be numeric series but received ${firstType}.`,
        'PSV6-TYPE-FUNCTION-PARAM-MISMATCH',
      );
    }

    if (secondType && (secondType === 'string' || secondType === 'bool')) {
      const { line, column } = node.args[1].value.loc.start;
      this.addError(
        line,
        column,
        `ta.crossover arguments must be numeric series but received ${secondType}.`,
        'PSV6-TYPE-FUNCTION-PARAM-MISMATCH',
      );
    }
  }

  private getExpressionType(expression: ExpressionNode): string | null {
    let resolved: string | null = null;

    if (this.astTypeEnvironment) {
      const metadata = this.astTypeEnvironment.nodeTypes.get(expression);
      const described = this.describeTypeMetadata(metadata);
      if (described && described !== 'unknown') {
        resolved = described;
      }

      if (expression.kind === 'Identifier') {
        const name = (expression as IdentifierNode).name;
        const identifierMetadata = this.astTypeEnvironment.identifiers.get(name);
        const identifierType = this.describeTypeMetadata(identifierMetadata ?? null);
        if (identifierType && identifierType !== 'unknown') {
          resolved = resolved ? this.mergeIdentifierTypes(resolved, identifierType) : identifierType;
        }

        const mappedType = this.context.typeMap?.get(name);
        if (mappedType) {
          const normalized = mappedType.type === 'series' ? 'series' : mappedType.type;
          if (normalized && normalized !== 'unknown') {
            resolved = resolved ? this.mergeIdentifierTypes(resolved, normalized) : normalized;
          }
        }
      }
    }

    if ((!resolved || resolved === 'unknown') && expression.kind === 'Identifier') {
      const mappedType = this.context.typeMap?.get((expression as IdentifierNode).name);
      if (mappedType) {
        const normalized = mappedType.type === 'series' ? 'series' : mappedType.type;
        if (normalized && normalized !== 'unknown') {
          resolved = normalized;
        }
      }
    }

    if (resolved && resolved !== 'unknown') {
      return resolved;
    }

    return this.inferLiteralType(expression);
  }

  private mergeIdentifierTypes(existing: string, candidate: string): string {
    if (existing === candidate) {
      return existing;
    }
    if (existing === 'float' && candidate === 'int') {
      return 'int';
    }
    if (candidate === 'float' && existing === 'int') {
      return 'int';
    }
    if (existing === 'series' || candidate === 'series') {
      return 'series';
    }
    return existing;
  }

  private describeTypeMetadata(metadata: TypeMetadata | null | undefined): string | null {
    if (!metadata) {
      return null;
    }
    return metadata.kind;
  }

  private inferLiteralType(expression: ExpressionNode): string | null {
    switch (expression.kind) {
      case 'NumberLiteral': {
        const literal = expression as NumberLiteralNode;
        return Number.isInteger(literal.value) ? 'int' : 'float';
      }
      case 'BooleanLiteral':
        return 'bool';
      case 'StringLiteral':
        return 'string';
      default:
        return null;
    }
  }

  private isLiteralExpression(expression: ExpressionNode): boolean {
    return expression.kind === 'NumberLiteral' || expression.kind === 'BooleanLiteral' || expression.kind === 'StringLiteral';
  }

  private isNaExpression(expression: ExpressionNode): boolean {
    return expression.kind === 'Identifier' && (expression as IdentifierNode).name === 'na';
  }

  private isNumericType(type: string | null): boolean {
    return type === 'int' || type === 'float' || type === 'series';
  }

  private areTypesCompatible(expected: string, actual: string | null): boolean {
    if (!actual) {
      return false;
    }

    if (expected === actual) {
      return true;
    }

    if (expected === 'float' && actual === 'int') {
      return true;
    }

    if (expected === 'series' && this.isNumericType(actual)) {
      return true;
    }

    if (this.isNumericType(expected) && actual === 'series') {
      return true;
    }

    return false;
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
      if (!objectName) {
        return null;
      }

      return `${objectName}.${member.property.name}`;
    }

    return null;
  }

  private parseTypeReference(reference: TypeReferenceNode): { type: TypeInfo['type']; elementType?: string; keyType?: string; valueType?: string } {
    const baseType = this.normalizeType(reference.name.name);
    if (baseType === 'array' || baseType === 'matrix') {
      const generic = reference.generics[0];
      const elementType = generic ? this.formatTypeReference(generic) : undefined;
      return elementType ? { type: baseType, elementType } : { type: baseType };
    }

    if (baseType === 'map') {
      const generics = reference.generics.map((generic) => this.formatTypeReference(generic)).filter(Boolean);
      const keyType = generics.length > 1 ? generics[0] : 'string';
      const valueType = generics.length > 0 ? generics[generics.length - 1] : undefined;
      return {
        type: baseType,
        keyType,
        valueType,
      };
    }

    return { type: baseType };
  }

  private formatTypeReference(reference: TypeReferenceNode): string {
    const base = reference.name.name;
    if (!reference.generics.length) {
      return base;
    }

    const generics = reference.generics
      .map((generic) => this.formatTypeReference(generic))
      .filter((value) => value.length > 0);

    if (!generics.length) {
      return base;
    }

    return `${base}<${generics.join(', ')}>`;
  }

  private inferCollectionTypeFromExpression(
    expression: ExpressionNode,
  ): { type: TypeInfo['type']; elementType?: string; keyType?: string; valueType?: string } | null {
    if (expression.kind !== 'CallExpression') {
      return null;
    }

    const call = expression as CallExpressionNode;
    const calleeName = this.resolveCalleeName(call.callee);
    if (!calleeName) {
      return null;
    }

    if (calleeName.startsWith('array.new')) {
      const elementType = this.extractArrayElementType(call, calleeName);
      return elementType ? { type: 'array', elementType } : { type: 'array' };
    }

    if (calleeName === 'matrix.new') {
      const elementType = this.extractMatrixElementType(call);
      return elementType ? { type: 'matrix', elementType } : { type: 'matrix' };
    }

    if (calleeName === 'map.new') {
      const { keyType, valueType } = this.extractMapTypes(call);
      return {
        type: 'map',
        keyType,
        valueType,
      };
    }

    return null;
  }

  private extractArrayElementType(call: CallExpressionNode, calleeName: string): string | undefined {
    if (Array.isArray(call.typeArguments) && call.typeArguments.length > 0) {
      const formatted = this.formatTypeReference(call.typeArguments[0]);
      if (formatted) {
        return formatted;
      }
    }

    const typedConstructor = ARRAY_TYPED_CONSTRUCTORS[calleeName];
    if (typedConstructor) {
      return typedConstructor;
    }

    if (calleeName === 'array.new' && call.args.length >= 2) {
      const resolved = this.resolveTypeIdentifier(call.args[0].value);
      if (resolved) {
        return resolved;
      }
    }

    return undefined;
  }

  private extractMatrixElementType(call: CallExpressionNode): string | undefined {
    if (Array.isArray(call.typeArguments) && call.typeArguments.length > 0) {
      const formatted = this.formatTypeReference(call.typeArguments[0]);
      if (formatted) {
        return formatted;
      }
    }

    if (call.args.length >= 3) {
      const resolved = this.resolveTypeIdentifier(call.args[0].value);
      if (resolved) {
        return resolved;
      }
    }

    return undefined;
  }

  private extractMapTypes(call: CallExpressionNode): { keyType?: string; valueType?: string } {
    if (Array.isArray(call.typeArguments) && call.typeArguments.length > 0) {
      const generics = call.typeArguments.map((arg) => this.formatTypeReference(arg)).filter(Boolean);
      const keyType = generics.length > 1 ? generics[0] : 'string';
      const valueType = generics.length > 0 ? generics[generics.length - 1] : undefined;
      return { keyType, valueType };
    }

    return { keyType: 'string' };
  }

  private resolveTypeIdentifier(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }

    if (expression.kind === 'StringLiteral') {
      return (expression as StringLiteralNode).value;
    }

    return null;
  }

  private registerVariableTypeInfo(
    name: string,
    type: TypeInfo['type'],
    elementType: string | undefined,
    keyType: string | undefined,
    valueType: string | undefined,
    line: number,
    column: number,
    isConst: boolean,
  ): void {
    if (!type || type === 'unknown') {
      return;
    }

    const normalizedElement = elementType && elementType !== 'unknown' ? elementType : undefined;
    const normalizedValue = valueType && valueType !== 'unknown' ? valueType : undefined;
    const normalizedKey = keyType && keyType !== 'unknown' ? keyType : type === 'map' ? 'string' : undefined;
    const existing = this.context.typeMap.get(name) as TypeInfo | undefined;

    if (existing) {
      const updated: TypeInfo = { ...existing };
      let changed = false;

      if (!updated.type) {
        updated.type = type;
        updated.isSeries = type === 'series' || updated.isSeries;
        changed = true;
      }

      if (normalizedElement && (!updated.elementType || updated.elementType === 'unknown')) {
        updated.elementType = normalizedElement;
        changed = true;
      }

      if (normalizedKey && (!updated.keyType || updated.keyType === 'unknown')) {
        updated.keyType = normalizedKey;
        changed = true;
      }

      if (normalizedValue && (!updated.valueType || updated.valueType === 'unknown')) {
        updated.valueType = normalizedValue;
        changed = true;
      }

      if (changed) {
        this.context.typeMap.set(name, updated);
      }
      return;
    }

    const info: TypeInfo = {
      type,
      isConst,
      isSeries: type === 'series',
      declaredAt: { line, column },
      usages: [],
    };

    if (normalizedElement) {
      info.elementType = normalizedElement;
    }

    if (normalizedKey) {
      info.keyType = normalizedKey;
    }

    if (normalizedValue) {
      info.valueType = normalizedValue;
    }

    this.context.typeMap.set(name, info);
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    return ensureAstContext(this.context, config);
  }

  private addError(line: number, column: number, message: string, code: string): void {
    this.errors.push({
      line,
      column,
      message,
      code,
      severity: 'error'
    });
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({
      line,
      column,
      message,
      code,
      severity: 'warning'
    });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({
      line,
      column,
      message,
      code,
      severity: 'info'
    });
  }

  private validateTypeCompatibility(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // First, process variable assignments to build type map
      this.processVariableAssignment(line, lineNum);
      
      // Then check for type compatibility issues
      this.checkAssignmentCompatibility(line, lineNum);
      this.checkFunctionCallCompatibility(line, lineNum);
      this.checkConditionalCompatibility(line, lineNum);
    }
  }

  private validateTypeInference(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for type inference issues
      this.checkAmbiguousTypeInference(line, lineNum);
      this.checkMissingTypeAnnotations(line, lineNum);
      this.checkInferredTypeAccuracy(line, lineNum);
    }
  }

  private validateTypeSafety(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for type safety issues
      this.checkUnsafeTypeOperations(line, lineNum);
      this.checkTypeCoercion(line, lineNum);
      this.checkNullSafety(line, lineNum);
    }
  }

  private validateImplicitConversions(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for implicit type conversions
      this.checkImplicitNumericConversion(line, lineNum);
      this.checkImplicitBooleanConversion(line, lineNum);
      this.checkImplicitStringConversion(line, lineNum);
    }
  }

  private validateTypeAnnotations(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for type annotation issues
      this.checkRedundantTypeAnnotations(line, lineNum);
      this.checkIncorrectTypeAnnotations(line, lineNum);
      this.checkMissingTypeAnnotations(line, lineNum);
    }
  }

  private checkAssignmentCompatibility(line: string, lineNum: number): void {
    // Check variable assignments for type compatibility
    // Handle both annotated and non-annotated assignments
    // Support generic annotations like array<string>, map<string>
    const annotatedMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)(?:<[^>]+>)?\s*=\s*(.+)$/);
    const simpleMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    
    if (annotatedMatch) {
      const varName = annotatedMatch[1];
      const declaredType = annotatedMatch[2];
      const expression = annotatedMatch[3];
      
      const exprType = this.inferExpressionType(expression);
      
      if (exprType && !this.areTypesCompatible(declaredType, exprType)) {
        this.addError(lineNum, 1, 
          `Type mismatch: cannot assign ${exprType} to ${declaredType} variable '${varName}'`, 
          'PSV6-TYPE-ASSIGNMENT-MISMATCH');
      }
    } else if (simpleMatch) {
      const varName = simpleMatch[1];
      const expression = simpleMatch[2];
      
      const varType = this.getVariableType(varName);
      // Use the type that was already set in the type map (by other validators) rather than inferring it again
      const exprType = this.getVariableType(varName) || this.inferExpressionType(expression);
      
      if (varType && exprType && !this.areTypesCompatible(varType, exprType)) {
        this.addError(lineNum, 1, 
          `Type mismatch: cannot assign ${exprType} to ${varType} variable '${varName}'`, 
          'PSV6-TYPE-ASSIGNMENT-MISMATCH');
      }
    }
  }

  private checkFunctionCallCompatibility(line: string, lineNum: number): void {
    // Check function calls for parameter type compatibility
    // Use a more robust regex that handles nested parentheses
    const funcMatch = line.match(/([A-Za-z_][A-Za-z0-9_]*\.?[A-Za-z_][A-Za-z0-9_]*)\s*\(/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      const startPos = funcMatch.index! + funcMatch[0].length;
      
      // Find the matching closing parenthesis
      let parenDepth = 1;
      let endPos = startPos;
      
      for (let i = startPos; i < line.length && parenDepth > 0; i++) {
        if (line[i] === '(') {
          parenDepth++;
        } else if (line[i] === ')') {
          parenDepth--;
        }
        endPos = i;
      }
      
      if (parenDepth === 0) {
        const params = line.substring(startPos, endPos);
        if (params.trim()) {
          const paramList = this.parseParameterList(params);
          this.validateFunctionParameterTypes(funcName, paramList, lineNum);
        }
      }
    }
  }

  private checkConditionalCompatibility(line: string, lineNum: number): void {
    // Check conditional expressions for type compatibility
    const ifMatch = line.match(/if\s+(.+)\s*$/);
    if (ifMatch) {
      const condition = ifMatch[1];
      const conditionType = this.inferExpressionType(condition);
      
      // Check for non-boolean conditions
      if (conditionType && conditionType !== 'bool' && conditionType !== 'series bool') {
        // Use different error codes based on the type of condition
        const isSimpleVariable = condition.match(/^[A-Za-z_][A-Za-z0-9_]*$/);
        const errorCode = isSimpleVariable ? 'PSV6-TYPE-CONVERSION-IMPLICIT-BOOL' : 'PSV6-TYPE-CONDITIONAL-TYPE';
        const message = isSimpleVariable ? 
          `Implicit boolean conversion from ${conditionType}` : 
          `Condition should be boolean, got ${conditionType}`;
        
        this.addWarning(lineNum, 1, message, errorCode);
      }
    }
  }

  private checkAmbiguousTypeInference(line: string, lineNum: number): void {
    // Check for expressions where type inference might be ambiguous
    const exprMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (exprMatch) {
      const varName = exprMatch[1];
      const expression = exprMatch[2];
      
      const inferredType = this.inferExpressionType(expression);
      if (inferredType === 'unknown') {
        const message = `Cannot infer type for expression: ${expression}`;
        if (/(\band\b|\bor\b)/.test(expression)) {
          this.addWarning(lineNum, 1, message, 'PSV6-TYPE-INFERENCE-AMBIGUOUS');
        } else {
          this.addWarning(lineNum, 1, message, 'PSV6-TYPE-INFERENCE-AMBIGUOUS');
        }
      }
    }
  }

  private checkMissingTypeAnnotations(line: string, lineNum: number): void {
    // Check for variables that could benefit from explicit type annotations
    const varMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (varMatch) {
      const varName = varMatch[1];
      const expression = varMatch[2];
      
      // Check if variable name suggests a specific type
      const suggestedType = this.suggestTypeFromVariableName(varName);
      const inferredType = this.inferExpressionType(expression);
      
      if (suggestedType && inferredType && suggestedType !== inferredType) {
        this.addInfo(lineNum, 1, 
          `Consider adding type annotation: ${varName}: ${suggestedType}`, 
          'PSV6-TYPE-ANNOTATION-SUGGESTION');
      }
    }
  }

  private checkInferredTypeAccuracy(line: string, lineNum: number): void {
    // Check if inferred types are accurate
    const funcMatch = line.match(/([A-Za-z_][A-Za-z0-9_]*\.?[A-Za-z_][A-Za-z0-9_]*)\s*\(/);
    if (!funcMatch) return;

    const rawFuncName = funcMatch[1];
    if (!this.isBuiltInFunction(rawFuncName)) {
      return;
    }

    const startPos = funcMatch.index! + funcMatch[0].length;
    let parenDepth = 1;
    let endPos = startPos;

    for (let i = startPos; i < line.length && parenDepth > 0; i++) {
      const ch = line[i];
      if (ch === '(') parenDepth++;
      else if (ch === ')') {
        parenDepth--;
        if (parenDepth === 0) {
          endPos = i;
          break;
        }
      }
    }

    if (parenDepth !== 0) return;

    const params = line.substring(startPos, endPos);
    if (!params.trim()) return;

    const paramList = this.parseParameterList(params);
    this.checkParameterTypeAccuracy(rawFuncName, paramList, lineNum);
  }

  private isBuiltInFunction(funcName: string): boolean {
    if (BUILTIN_FUNCTIONS_V6_RULES[funcName]) {
      return true;
    }

    if (!funcName.includes('.')) {
      return !!BUILTIN_FUNCTIONS_V6_RULES[funcName];
    }

    const parts = funcName.split('.');
    if (parts.length >= 2) {
      const namespace = parts[0];
      const member = parts[1];

      if (!NAMESPACES.has(namespace)) {
        return false;
      }

      const candidate = `${namespace}.${member}`;
      return !!BUILTIN_FUNCTIONS_V6_RULES[candidate];
    }

    return false;
  }

  private checkUnsafeTypeOperations(line: string, lineNum: number): void {
    // Check for potentially unsafe type operations
    if (line.includes('na') && (line.includes('+') || line.includes('-') || line.includes('*') || line.includes('/'))) {
      this.addWarning(lineNum, 1, 
        'Arithmetic operations with na may produce unexpected results', 
        'PSV6-TYPE-SAFETY-NA-ARITHMETIC');
    }
    
    if (line.includes('na') && line.includes('==') || line.includes('!=')) {
      this.addWarning(lineNum, 1, 
        'Comparison with na should use na() function', 
        'PSV6-TYPE-SAFETY-NA-COMPARISON');
    }
  }

  private checkTypeCoercion(line: string, lineNum: number): void {
    // Check for implicit type coercion
    if (line.match(/[0-9]+\s*[+\-*/]\s*[A-Za-z_]/) || line.match(/[A-Za-z_]\s*[+\-*/]\s*[0-9]+/)) {
      this.addInfo(lineNum, 1, 
        'Implicit type coercion detected. Consider explicit type conversion', 
        'PSV6-TYPE-COERCION-INFO');
    }
  }

  private checkNullSafety(line: string, lineNum: number): void {
    // Check for null safety issues
    if (line.includes('na') && !line.includes('na(')) {
      this.addWarning(lineNum, 1, 
        'Use na() function instead of na literal', 
        'PSV6-TYPE-SAFETY-NA-FUNCTION');
    }
  }

  private checkImplicitNumericConversion(line: string, lineNum: number): void {
    // Check for implicit numeric conversions
    const annotatedMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*int\s*=\s*([0-9]+\.[0-9]+)/);
    const simpleMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([0-9]+\.[0-9]+)/);
    
    if (annotatedMatch) {
      const varName = annotatedMatch[1];
      const value = annotatedMatch[2];
      this.addWarning(lineNum, 1, 
        `Implicit conversion from float to int: ${value}`, 
        'PSV6-TYPE-CONVERSION-FLOAT-TO-INT');
    } else if (simpleMatch) {
      const varName = simpleMatch[1];
      const value = simpleMatch[2];
      const varType = this.getVariableType(varName);
      if (varType === 'int') {
        this.addWarning(lineNum, 1, 
          `Implicit conversion from float to int: ${value}`, 
          'PSV6-TYPE-CONVERSION-FLOAT-TO-INT');
      }
    }
  }

  private checkImplicitBooleanConversion(line: string, lineNum: number): void {
    // Check for implicit boolean conversions in ternary operators
    const ternaryMatch = line.match(/\?\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/);
    
    if (ternaryMatch) {
      const varName = ternaryMatch[1];
      const varType = this.getVariableType(varName);
      
      if (varType && varType !== 'bool' && varType !== 'series bool' && varType !== 'color') {
        this.addWarning(lineNum, 1, 
          `Implicit boolean conversion from ${varType}`, 
          'PSV6-TYPE-CONVERSION-IMPLICIT-BOOL');
      }
    }
  }

  private checkImplicitStringConversion(line: string, lineNum: number): void {
    // Check for implicit string conversions
    const strMatch = line.match(/str\.tostring\s*\(([^)]+)\)/);
    if (strMatch) {
      const expression = strMatch[1];
      const exprType = this.inferExpressionType(expression);
      
      if (exprType === 'string') {
        this.addInfo(lineNum, 1, 
          'Redundant string conversion: expression is already a string', 
          'PSV6-TYPE-CONVERSION-REDUNDANT-STRING');
      }
    }
    
    // Check for redundant string conversion in assignments
    const assignMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*str\.tostring\s*\(([^)]+)\)/);
    if (assignMatch) {
      const varName = assignMatch[1];
      const expression = assignMatch[2];
      const exprType = this.inferExpressionType(expression);
      
      if (exprType === 'string') {
        this.addInfo(lineNum, 1, 
          'Redundant string conversion: expression is already a string', 
          'PSV6-TYPE-CONVERSION-REDUNDANT-STRING');
      }
    }
  }

  private checkRedundantTypeAnnotations(line: string, lineNum: number): void {
    // Check for redundant type annotations
    const typeMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (typeMatch) {
      const varName = typeMatch[1];
      const declaredType = typeMatch[2];
      const expression = typeMatch[3];
      
      const inferredType = this.inferExpressionType(expression);
      if (inferredType === declaredType) {
        this.addInfo(lineNum, 1, 
          `Type annotation is redundant: ${declaredType} can be inferred`, 
          'PSV6-TYPE-ANNOTATION-REDUNDANT');
      }
    }
  }

  private checkIncorrectTypeAnnotations(line: string, lineNum: number): void {
    // Check for incorrect type annotations
    const typeMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (typeMatch) {
      const varName = typeMatch[1];
      const declaredType = typeMatch[2];
      const expression = typeMatch[3];
      
      const inferredType = this.inferExpressionType(expression);
      if (inferredType && inferredType !== declaredType && !this.areTypesCompatible(declaredType, inferredType)) {
        this.addError(lineNum, 1, 
          `Type annotation mismatch: declared ${declaredType}, inferred ${inferredType}`, 
          'PSV6-TYPE-ANNOTATION-MISMATCH');
      }
    }
  }

  private validateFunctionParameterTypes(funcName: string, paramList: string[], lineNum: number): void {
    // Only validate parameter types for built-in functions
    const expectedTypes = this.getFunctionParameterTypes(funcName);
    
    // Skip validation if this is not a built-in function
    if (!expectedTypes) {
      return;
    }
    
    if (expectedTypes.length === paramList.length) {
      for (let i = 0; i < paramList.length; i++) {
        const normalized = this.normalizeParameter(paramList[i]);
        const expectedType = expectedTypes[i];
        const actualType = this.inferExpressionType(normalized.expression);

        if (!actualType || actualType === 'unknown') {
          continue; // defer to inference warnings when type cannot be determined yet
        }

        if (!this.areTypesCompatible(expectedType, actualType)) {
          this.addError(
            lineNum,
            1,
            `Parameter ${i + 1} type mismatch: expected ${expectedType}, got ${actualType}`,
            'PSV6-TYPE-FUNCTION-PARAM-MISMATCH'
          );
        }
      }
    }
  }

  private checkParameterTypeAccuracy(funcName: string, paramList: string[], lineNum: number): void {
    // Check if parameter types are accurate for the function
    for (let i = 0; i < paramList.length; i++) {
      const normalized = this.normalizeParameter(paramList[i]);
      const paramType = this.inferExpressionType(normalized.expression);
      
      if (paramType === 'unknown') {
        this.addWarning(lineNum, 1, 
          `Cannot infer type for parameter ${normalized.name ? normalized.name : i + 1} of ${funcName}`, 
          'PSV6-TYPE-INFERENCE-PARAM-UNKNOWN');
      }
    }
  }

  private normalizeParameter(param: string): { expression: string; name?: string } {
    const trimmed = param.trim();
    const namedMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (namedMatch) {
      return {
        name: namedMatch[1],
        expression: namedMatch[2].trim()
      };
    }

    return {
      expression: trimmed
    };
  }

  // Helper methods
  private processVariableAssignment(line: string, lineNum: number): void {
    // Process variable assignments to build type map
    const annotatedMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)(?:<[^>]+>)?\s*=\s*(.+)$/);
    const simpleMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    
    
    
    if (annotatedMatch) {
      const varName = annotatedMatch[1];
      const declaredType = annotatedMatch[2];
      const expression = annotatedMatch[3];
      
      // Store the declared type only if not already set by CoreValidator
      if (!this.context.typeMap.has(varName)) {
        this.context.typeMap.set(varName, {
          type: this.normalizeType(declaredType),
          isConst: false,
          isSeries: declaredType === 'series',
          declaredAt: { line: lineNum, column: 1 },
          usages: []
        });
      }
    } else if (simpleMatch) {
      const varName = simpleMatch[1];
      const expression = simpleMatch[2];
      
      // Infer type from expression and update typeMap if we have a better type
      let inferredType = this.inferExpressionType(expression);

      const normalizedExpr = expression.trim();
      if (/^input\.color\s*\(/.test(normalizedExpr)) {
        inferredType = 'color';
      }
      
      // Always check for existing types to avoid overriding types set by other validators
      const existingTypeInfo = this.context.typeMap.get(varName);
      
      if (inferredType && inferredType !== 'unknown') {
        const canOverride =
          !existingTypeInfo ||
          existingTypeInfo.type === 'unknown' ||
          existingTypeInfo.type === 'array' ||
          existingTypeInfo.type === 'matrix' ||
          existingTypeInfo.type === 'color' ||
          (existingTypeInfo.type === 'string' && (inferredType === 'color' || inferredType === 'bool'));

        if (canOverride) {
          // Extract element type from generic syntax (e.g., array.new<float>)
          const elementType = this.extractElementType(expression);
          
          // Update typeMap with inferred type if we don't have a type or have a generic type
          this.context.typeMap.set(varName, {
            type: this.normalizeType(inferredType),
            isConst: false,
            isSeries: inferredType === 'series',
            declaredAt: { line: lineNum, column: 1 },
            usages: [],
            elementType: elementType
          });
        }
      }
    }
  }

  private getVariableType(varName: string): string | null {
    const typeInfo = this.context.typeMap.get(varName);
    return typeInfo ? typeInfo.type : null;
  }

  private getVariableAssignedFunctionType(varName: string): string | null {
    // Look through the code to see if this variable is assigned a function call
    for (const line of this.context.cleanLines) {
      // Check for assignment pattern: varName = functionCall(...)
      const assignmentMatch = line.match(new RegExp(`^\\s*${varName}\\s*=\\s*([A-Za-z_][A-Za-z0-9_]*\\.[A-Za-z_][A-Za-z0-9_]*)\\s*\\(`));
      if (assignmentMatch) {
        const funcName = assignmentMatch[1];
        // Check if it's a built-in function
        if (this.context.functionNames && this.context.functionNames.has(funcName)) {
          // Infer return type based on function namespace
          if (funcName.startsWith('ta.')) {
            return 'series'; // Most TA functions return series
          } else if (funcName.startsWith('math.')) {
            return 'float'; // Most math functions return float
          } else if (funcName.startsWith('str.')) {
            // Special handling for specific string functions
            if (funcName === 'str.tonumber') {
              return 'float'; // str.tonumber returns float
            } else {
              return 'string'; // Other string functions return string
            }
          } else if (funcName.startsWith('color.')) {
            return 'color'; // Color functions return color
          }
        }
      }
    }
    return null;
  }

  private splitTopLevelTernary(expression: string): { condition: string; whenTrue: string; whenFalse: string } | null {
    let depth = 0;
    let questionIndex = -1;

    for (let i = 0; i < expression.length; i++) {
      const ch = expression[i];
      if (ch === '(' || ch === '[' || ch === '{') {
        depth++;
      } else if (ch === ')' || ch === ']' || ch === '}') {
        depth = Math.max(0, depth - 1);
      } else if (ch === '?' && depth === 0) {
        questionIndex = i;
        break;
      }
    }

    if (questionIndex === -1) {
      return null;
    }

    depth = 0;
    let nestedTernary = 0;
    let colonIndex = -1;

    for (let i = questionIndex + 1; i < expression.length; i++) {
      const ch = expression[i];
      if (ch === '(' || ch === '[' || ch === '{') {
        depth++;
      } else if (ch === ')' || ch === ']' || ch === '}') {
        depth = Math.max(0, depth - 1);
      } else if (ch === '?' && depth === 0) {
        nestedTernary++;
      } else if (ch === ':' && depth === 0) {
        if (nestedTernary === 0) {
          colonIndex = i;
          break;
        }
        nestedTernary--;
      }
    }

    if (colonIndex === -1) {
      return null;
    }

    const condition = expression.slice(0, questionIndex).trim();
    const whenTrue = expression.slice(questionIndex + 1, colonIndex).trim();
    const whenFalse = expression.slice(colonIndex + 1).trim();

    if (!condition || !whenTrue || !whenFalse) {
      return null;
    }

    return { condition, whenTrue, whenFalse };
  }

  private inferExpressionType(expression: string): string {
    const trimmed = expression.trim();
    
    // Handle literals
    if (trimmed.match(/^[0-9]+$/)) return 'int';
    if (trimmed.match(/^[0-9]+\.[0-9]+$/)) return 'float';
    if (trimmed === 'true' || trimmed === 'false') return 'bool';
    if (trimmed.match(/^"[^"]*"$/) || trimmed.match(/^'[^']*'$/)) return 'string';
    if (trimmed === 'na') return 'na';
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) return 'array';
    if (/^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/.test(trimmed)) return 'color';

    // Handle ternary expressions
    const ternaryParts = this.splitTopLevelTernary(trimmed);
    if (ternaryParts) {
      const trueType = this.inferExpressionType(ternaryParts.whenTrue);
      const falseType = this.inferExpressionType(ternaryParts.whenFalse);

      if (trueType === falseType && trueType && trueType !== 'unknown') {
        return trueType;
      }

      // Fall back to broader matches when branches differ but are compatible
      const candidateTypes = [trueType, falseType];
      if (candidateTypes.includes('color')) {
        return 'color';
      }
      if (candidateTypes.includes('series')) {
        return 'series';
      }
      if (candidateTypes.includes('float') && candidateTypes.includes('int')) {
        return 'float';
      }
      if (candidateTypes.includes('bool') && candidateTypes.every(t => t === 'bool' || t === 'unknown')) {
        return 'bool';
      }
    }
    
    // Handle built-in variables and constants
    const builtinTypes: Record<string, string> = {
      'close': 'series',
      'open': 'series',
      'high': 'series',
      'low': 'series',
      'volume': 'series',
      'time': 'series',
      'bar_index': 'series',
      'hl2': 'series',
      'hlc3': 'series',
      'ohlc4': 'series',
      'hlcc4': 'series',
      // Color constants
      'color.blue': 'color',
      'color.red': 'color',
      'color.green': 'color',
      'color.yellow': 'color',
      'color.orange': 'color',
      'color.purple': 'color',
      'color.gray': 'color',
      'color.white': 'color',
      'color.black': 'color',
      // Shape constants
      'shape.triangleup': 'int',
      'shape.triangledown': 'int',
      'shape.diamond': 'int',
      'shape.circle': 'int',
      'shape.square': 'int',
      'shape.flag': 'int',
      'shape.arrowup': 'int',
      'shape.arrowdown': 'int',
      'shape.xcross': 'int',
        'shape.cross': 'int',
        // Location constants
        'location.abovebar': 'int',
        'location.belowbar': 'int',
        'location.top': 'int',
        'location.bottom': 'int',
        'location.absolute': 'int',
        // Format constants
        'format.inherit': 'string',
        'format.mintick': 'string',
        'format.percent': 'string',
        'format.price': 'string',
        'format.volume': 'string',
        'format.integer': 'string',
        // Syminfo properties
        'syminfo.tickerid': 'string',
        'syminfo.ticker': 'string',
        'syminfo.currency': 'string',
        'syminfo.description': 'string',
        'syminfo.basecurrency': 'string',
        'syminfo.minmove': 'float',
        'syminfo.pointvalue': 'float',
        'syminfo.session': 'string',
        'syminfo.timezone': 'string',
        'syminfo.type': 'string',
        // Strategy direction enums
        'strategy.long': 'int',
        'strategy.short': 'int',
        'strategy.fixed': 'int',
        'strategy.cash': 'int',
        'strategy.percent_of_equity': 'int',
        // Strategy metrics
        'strategy.netprofit': 'series',
        'strategy.netprofit_percent': 'series',
        'strategy.openprofit': 'series',
        'strategy.openprofit_percent': 'series',
        'strategy.max_drawdown': 'series',
        'strategy.max_drawdown_percent': 'series',
        'strategy.max_runup': 'series',
        'strategy.max_runup_percent': 'series',
        'strategy.grossprofit': 'series',
        'strategy.grossprofit_percent': 'series',
        'strategy.grossloss': 'series',
        'strategy.grossloss_percent': 'series',
        'strategy.avg_trade': 'series',
        'strategy.avg_trade_percent': 'series',
        'strategy.avg_winning_trade': 'series',
        'strategy.avg_winning_trade_percent': 'series',
        'strategy.avg_losing_trade': 'series',
        'strategy.avg_losing_trade_percent': 'series',
        
        'strategy.position_size': 'series',
        'strategy.position_avg_price': 'series',
        'strategy.closedtrades': 'series',
        'strategy.wintrades': 'series',
        'strategy.losstrades': 'series',
        'strategy.equity': 'series',
        'strategy.eventrades': 'series',
        'strategy.opentrades': 'series',
        'strategy.margin_liquidation_price': 'series',
        'strategy.max_contracts_held_all': 'series',
        'strategy.max_contracts_held_long': 'series',
        'strategy.max_contracts_held_short': 'series',
        'strategy.initial_capital': 'series',
        'strategy.risk_allow_entry_in': 'series'
    };
    
    if (builtinTypes[trimmed]) {
      return builtinTypes[trimmed];
    }

    // Handle comparison expressions early (e.g., array.size(input) >= window)
    const withoutGenerics = trimmed.replace(/<[^>]*>/g, '');
    if (/(<=|>=|==|!=|<|>)/.test(withoutGenerics)) {
      return 'bool';
    }

    // Handle history references like volume[1]
    const historyMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\[[^\]]+\]$/);
    if (historyMatch) {
      const base = historyMatch[1];
      const baseType = this.inferExpressionType(base);
      if (baseType && baseType !== 'unknown') {
        return baseType;
      }
      const baseInfo = this.context.typeMap.get(base);
      if (baseInfo && baseInfo.type !== 'unknown') {
        return baseInfo.type;
      }
      return 'series';
    }

    // Handle function calls
    if (trimmed.includes('(') && trimmed.includes(')')) {
      // Handle UDT constructors (e.g., Point.new(0, 0))
      const udtConstructorMatch = trimmed.match(/^([A-Z][A-Za-z0-9_]*)\.new\s*\(/);
      if (udtConstructorMatch) {
        const udtTypeName = udtConstructorMatch[1];
        const udtTypeInfo = this.context.typeMap.get(udtTypeName);
        if (udtTypeInfo?.type === 'udt') {
          return 'udt';
        }
      }
      
      // Handle method calls (e.g., p1.distance(p2)) - but not namespace calls
      const methodCallMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
      if (methodCallMatch) {
        const objectName = methodCallMatch[1];
        const methodName = methodCallMatch[2];
        
        // Skip if this is a known namespace (ta, math, str, color, etc.)
        const knownNamespaces = ['ta', 'math', 'str', 'color', 'input', 'request', 'timeframe', 'syminfo', 'barstate', 'session', 'runtime', 'log', 'alert', 'map'];
        if (knownNamespaces.includes(objectName)) {
          // This is a namespace call, not a method call - continue to regular function call handling
        } else {
          const objectType = this.getVariableType(objectName);
          
          // For UDT method calls, assume they return float (most common case)
          if (objectType === 'udt') {
            return 'float';
          }
        }
      }
      
      // Handle regular function calls (including generic syntax like array.new<float>)
      const funcMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?)(?:<[^>]*>)?\s*\(/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const returnType = this.getFunctionReturnType(funcName);

        // Handle special case for array/matrix/map get - resolve element/value type
        if (returnType === 'element' && (funcName === 'array.get' || funcName === 'matrix.get' || funcName === 'map.get')) {
          return this.resolveElementType(trimmed, funcName);
        }
        
        
        return returnType;
      }
      
      
    }
    
    // Handle switch expressions
    if (trimmed.startsWith('switch ')) {
      // Switch expressions should have their type determined by the SwitchValidator
      // Don't override types that have already been set by other validators
      return 'unknown';
    }
    
    // Handle namespace member access (e.g., timeframe.period, ta.sma) - but not function calls
    if (trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/) && !trimmed.includes('(')) {
      const namespaceMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)$/);
      if (namespaceMatch) {
        const [, namespace, member] = namespaceMatch;
        // Handle specific namespace members
        if (namespace === 'timeframe' && member === 'period') {
          return 'string'; // timeframe.period returns a string
        } else if (namespace === 'ta') {
          return 'series'; // Most ta functions return series
        } else if (namespace === 'math') {
          return 'float'; // Most math functions return float
        } else if (namespace === 'str') {
          return 'string'; // String functions return string
        } else if (namespace === 'color') {
          return 'color'; // Color functions return color
        } else if (namespace === 'barstate') {
          return 'bool';
        } else if (namespace === 'strategy') {
          const strategyEnumMembers = new Set(['long','short','fixed','cash','percent_of_equity']);
          const strategyStringMembers = new Set(['account_currency','position_entry_name']);
          if (strategyEnumMembers.has(member)) return 'int';
          if (strategyStringMembers.has(member)) return 'string';
          return 'series';
        }
      }
    }

    // Handle field access (e.g., bar.close)
    const fieldAccessMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)$/);
    if (fieldAccessMatch) {
      const variableName = fieldAccessMatch[1];
      const fieldName = fieldAccessMatch[2];
      const fieldKey = `${variableName}.${fieldName}`;
      
      // Check if the field type is already in the type map (set by UDTValidator)
      const fieldTypeInfo = this.context.typeMap.get(fieldKey);
      if (fieldTypeInfo && fieldTypeInfo.type !== 'unknown') {
        return fieldTypeInfo.type;
      }
      return 'unknown';
    }

    // Handle variable references
    if (trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*$/)) {
      const varType = this.getVariableType(trimmed);
      if (varType && varType !== 'unknown') {
        return varType;
      }
      
      // Check if this variable is assigned a function call
      const functionType = this.getVariableAssignedFunctionType(trimmed);
      if (functionType) {
        return functionType;
      }
      
      return 'unknown';
    }
    
    // Handle arithmetic expressions
    if (trimmed.match(/[+\-*/]/)) {
      return this.inferArithmeticType(trimmed);
    }

    if (trimmed.startsWith('if ')) {
      return 'unknown';
    }

    // Handle comparison expressions
    return 'unknown';
  }

  private inferArithmeticType(expression: string): string {
    // Simple arithmetic type inference
    if (expression.includes('.')) {
      return 'float';
    }
    return 'int';
  }

  private extractElementType(expression: string): string | undefined {
    // Extract element type from generic syntax like array.new<float> or matrix.new<int>
    const genericMatch = expression.match(/<([^>]+)>/);
    if (genericMatch) {
      const elementType = genericMatch[1].trim();
      // Normalize common type names
      if (elementType === 'float' || elementType === 'int' || elementType === 'bool' || elementType === 'string' || elementType === 'color') {
        return elementType;
      }
    }
    return undefined;
  }

  private resolveElementType(expression: string, funcName: string): string {
    // Extract the first parameter (collection variable name)
    const paramMatch = expression.match(/\(([^,)]+)/);
    if (!paramMatch) return 'unknown';

    const varName = paramMatch[1].trim();
    const typeInfo: any = this.context.typeMap.get(varName);

    if (!typeInfo) return 'unknown';

    if (funcName === 'array.get' || funcName === 'matrix.get') {
      if (typeInfo.elementType) return typeInfo.elementType;
      // Fallback: arrays/matrices commonly hold floats in tests
      return 'float';
    }

    if (funcName === 'map.get') {
      if (typeof typeInfo.valueType === 'string' && typeInfo.valueType) {
        return typeInfo.valueType;
      }
      // Conservative default when value type unknown
      return 'unknown';
    }

    return 'unknown';
  }

  private getBuiltinFunctionRules(funcName: string): any {
    return BUILTIN_FUNCTIONS_V6_RULES[funcName];
  }

  private getFunctionReturnType(funcName: string): string {
    // First check if the function has a return type defined in BUILTIN_FUNCTIONS_V6_RULES
    const builtinRules = this.getBuiltinFunctionRules(funcName);
    if (builtinRules && builtinRules.returnType) {
      return builtinRules.returnType;
    }
    
    // Common function return types
    const returnTypes: Record<string, string> = {
      'close': 'series',
      'open': 'series',
      'high': 'series',
      'low': 'series',
      'volume': 'series',
      'ta.sma': 'series',
      'ta.ema': 'series',
      'ta.rsi': 'series',
      'ta.macd': 'series',
      'ta.crossover': 'bool',
      'ta.crossunder': 'bool',
      'math.max': 'float',
      'math.min': 'float',
      'str.tostring': 'string',
      'str.tonumber': 'float',
      'str.contains': 'bool',
      'str.startswith': 'bool',
      'str.endswith': 'bool',
      // input namespace
      'input.int': 'int',
      'input.float': 'float',
      'input.bool': 'bool',
      'input.string': 'string',
      'input.color': 'color',
      'input.source': 'series',
      'color.new': 'color',
      'color.from_gradient': 'color',
      'color': 'color',
      'array.new': 'array',
      'array.from': 'array',
      'array.push': 'void',
      'array.pop': 'any',
      'array.get': 'element', // Will be resolved based on array element type
      'array.set': 'void',
      'array.size': 'int',
      'array.clear': 'void',
      'array.reverse': 'void',
      'array.sort': 'void',
      'array.copy': 'array',
      'array.slice': 'array',
      'array.indexof': 'int',
      'array.lastindexof': 'int',
      'array.remove': 'void',
      'array.insert': 'void',
      'matrix.new': 'matrix',
      'matrix.set': 'void',
      'matrix.get': 'element', // Will be resolved based on matrix element type
      'matrix.rows': 'int',
      'matrix.columns': 'int',
      'matrix.copy': 'matrix',
      'matrix.fill': 'void',
      'map.new': 'map',
      // Map namespace
      'map.size': 'int',
      'map.contains': 'bool',
      'map.keys': 'array',
      'map.values': 'array',
      'map.copy': 'map',
      'map.get': 'element', // resolve via resolveElementType using map value type
      'plot': 'series',
      'chart.point.new': 'chart.point',
      'chart.point.from_time': 'chart.point',
      'line.new': 'line',
      'polyline.new': 'polyline',
      'label.new': 'label',
      'box.new': 'box',
      'hline': 'void',
      'barstate.isconfirmed': 'bool',
      'barstate.isfirst': 'bool',
      'barstate.ishistory': 'bool',
      'barstate.islast': 'bool',
      'barstate.islastconfirmedhistory': 'bool',
      'barstate.isnew': 'bool',
      'barstate.isrealtime': 'bool'
    };
    
    // Check if it's a user-defined function (not a built-in function)
    // Built-in functions are also in functionNames, so we need to check if it's actually user-defined
    if (this.context.functionNames && this.context.functionNames.has(funcName)) {
      // Check if it's a built-in function by looking at the returnTypes map
      if (returnTypes[funcName]) {
        // It's a built-in function, use the return type from the map
        return returnTypes[funcName];
      } else {
        // It's a user-defined function, assume it returns series (most common case)
        return 'series';
      }
    }
    
    // If we don't know the function, assume it returns series (most common case in Pine Script)
    // This prevents type inference errors when FunctionValidator hasn't run yet
    return returnTypes[funcName] || 'series';
  }

  private getFunctionParameterTypes(funcName: string): string[] | null {
    // Common function parameter types
    const paramTypes: Record<string, string[]> = {
      'ta.sma': ['series', 'int'],
      'ta.ema': ['series', 'int'],
      'ta.rsi': ['series', 'int'],
      'ta.macd': ['series', 'int', 'int', 'int'],
      'ta.crossover': ['series', 'series'],
      'ta.crossunder': ['series', 'series'],
      'math.max': ['float', 'float'],
      'math.min': ['float', 'float'],
      // tostring accepts any (including series/bool/numeric)
      'str.tostring': ['any', 'string'],
      'str.tonumber': ['string'],
      'plot': ['series'],
      'color': ['any'],
      'color.new': ['any', 'int']
    };
    
    return paramTypes[funcName] || null;
  }

  private suggestTypeFromVariableName(varName: string): string | null {
    // Suggest type based on variable name patterns
    if (varName.toLowerCase().includes('price') || varName.toLowerCase().includes('value')) {
      return 'float';
    }
    if (varName.toLowerCase().includes('count') || varName.toLowerCase().includes('index')) {
      return 'int';
    }
    if (varName.toLowerCase().includes('flag') || varName.toLowerCase().includes('is')) {
      return 'bool';
    }
    if (varName.toLowerCase().includes('text') || varName.toLowerCase().includes('message')) {
      return 'string';
    }
    return null;
  }

  private normalizeType(type: string): 'int' | 'float' | 'bool' | 'string' | 'color' | 'series' | 'line' | 'label' | 'box' | 'table' | 'array' | 'matrix' | 'map' | 'udt' | 'unknown' {
    // Normalize type strings to match the TypeInfo union type
    const validTypes = ['int', 'float', 'bool', 'string', 'color', 'series', 'line', 'label', 'box', 'table', 'array', 'matrix', 'map', 'udt'] as const;
    
    if (validTypes.includes(type as any)) {
      return type as any;
    }
    
    // Handle common variations
    if (type === 'series bool' || type === 'series int' || type === 'series float') {
      return 'series';
    }
    
    // Treat Pine 'na' literal as numeric for compatibility
    if (type === 'na') {
      return 'float';
    }
    
    return 'unknown';
  }

  private parseParameterList(params: string): string[] {
    // Simple parameter parsing - split by comma but respect quotes and parentheses
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let parenDepth = 0;

    for (let i = 0; i < params.length; i++) {
      const char = params[i];
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
        current += char;
      } else if (!inQuotes && char === '(') {
        parenDepth++;
        current += char;
      } else if (!inQuotes && char === ')') {
        parenDepth--;
        current += char;
      } else if (!inQuotes && char === ',' && parenDepth === 0) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      result.push(current.trim());
    }

    return result;
  }
}
