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
import {
  type ProgramNode,
  type VariableDeclarationNode,
  type AssignmentStatementNode,
  type ExpressionNode,
  type CallExpressionNode,
  type ConditionalExpressionNode,
  type IfStatementNode,
  type BinaryExpressionNode,
  type ArgumentNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type TypeReferenceNode,
  type NumberLiteralNode,
  type StringLiteralNode,
  type BooleanLiteralNode,
  type ColorLiteralNode,
} from '../core/ast/nodes';
import { visit } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';
import { BUILTIN_FUNCTIONS_V6_RULES } from '../core/constants';
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

    const ast = this.astContext?.ast ?? null;
    const program = ast ?? null;
    if (!program) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: null,
      };
    }

    this.validateWithAst(program);

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
    let initializerType = this.getExpressionType(initializer);
    const collectionInfo = this.inferCollectionTypeFromExpression(initializer);
    const { line, column } = node.loc.start;

    if (process.env.DEBUG_TYPE_INFERENCE === '1' && (node.identifier.name === 'idx' || node.identifier.name === 'allBoxes' || node.identifier.name === 'eigenvals')) {
      console.log(`[TypeInference] handleVariableDeclaration for ${node.identifier.name}:`, {
        declaredType,
        initializerType,
        collectionInfo,
        initializerKind: initializer.kind,
      });
    }

    if (this.isNaExpression(initializer)) {
      this.addWarning(
        line,
        column,
        "Assigning 'na' directly can lead to ambiguous comparisons. Prefer using na() helpers for checks.",
        'PSV6-TYPE-SAFETY-NA-FUNCTION',
      );
    }

    // Check if initializer is a request function call that can return na
    if (this.isRequestFunctionCall(initializer)) {
      this.addWarning(
        line,
        column,
        "Request functions can return 'na' values. Ensure proper null-checking or use nz() for safety.",
        'PSV6-TYPE-SAFETY-NA-FUNCTION',
      );
    }

    // Only convert na to float when there's no type annotation
    // If there's a type annotation, keep it as void so it can be compatible with any type
    if (initializerType === 'void' && this.isNaExpression(initializer) && (!declaredType || declaredType === 'unknown')) {
      initializerType = 'float';
    }

    if (!declaredType || declaredType === 'unknown') {
      // Don't warn for function calls - they often have complex return types that are hard to infer
      const isFunctionCall = initializer.kind === 'CallExpression';
      if (!initializerType || initializerType === 'unknown') {
        if (!isFunctionCall) {
          this.addWarning(
            line,
            column,
            `Unable to infer type for '${node.identifier.name}'. Consider adding an explicit annotation.`,
            'PSV6-TYPE-INFERENCE-AMBIGUOUS',
          );
        }
      }

      if (this.isLiteralExpression(initializer)) {
        this.addInfo(
          line,
          column,
          `Consider annotating '${node.identifier.name}' with its literal type for readability.`,
          'PSV6-TYPE-ANNOTATION-SUGGESTION',
        );
      }

      // Register inferred type from function call or collection info
      if (initializerType && initializerType !== 'unknown') {
        if (process.env.DEBUG_TYPE_INFERENCE === '1' && node.identifier.name === 'allBoxes') {
          console.log(`[TypeInference] Registering ${node.identifier.name} with type:`, initializerType, 'collectionInfo:', collectionInfo);
        }
        this.registerVariableTypeInfo(
          node.identifier.name,
          this.normalizeType(initializerType),
          collectionInfo?.elementType,
          collectionInfo?.keyType,
          collectionInfo?.valueType,
          line,
          column,
          node.declarationKind === 'const',
        );
      } else if (collectionInfo) {
        if (process.env.DEBUG_TYPE_INFERENCE === '1' && node.identifier.name === 'allBoxes') {
          console.log(`[TypeInference] Registering ${node.identifier.name} with collectionInfo:`, collectionInfo);
        }
        this.registerVariableTypeInfo(
          node.identifier.name,
          this.normalizeType(collectionInfo.type),
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

    // Check for series qualifier mismatch
    // Example: int len = barstate.islast ? 20 : 10 (series cannot be assigned to simple)
    const initializerIsSeries = this.isSeriesExpression(initializer);
    const declaredTypeIsSimple = declaredType && declaredType !== 'series' && !node.typeAnnotation?.name.name.includes('series');
    
    // Be more lenient for function parameters - Pine Script allows flexible type qualifiers
    const isFunctionParameter = this.isInsideFunction(node);
    
    if (initializerIsSeries && declaredTypeIsSimple && !isFunctionParameter) {
      this.addError(
        line,
        column,
        `Cannot assign series expression to simple ${declaredType} variable '${node.identifier.name}'. Series values change on every bar and cannot be stored in simple variables.`,
        'PSV6-FUNCTION-PARAM-TYPE', // Using existing error code per test expectation
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

    // Check if right side is a request function call that can return na
    if (this.isRequestFunctionCall(right)) {
      this.addWarning(
        line,
        column,
        "Request functions can return 'na' values. Ensure proper null-checking or use nz() for safety.",
        'PSV6-TYPE-SAFETY-NA-FUNCTION',
      );
    }

    const valueType = this.getExpressionType(right);
    const inferredCollection = this.inferCollectionTypeFromExpression(right);
    
    if (process.env.DEBUG_TYPE_INFERENCE === '1' && node.left.kind === 'Identifier' && (node.left as IdentifierNode).name === 'allBoxes') {
      console.log('[TypeInference] handleAssignment allBoxes:', { valueType, inferredCollection, rightKind: right.kind });
    }
    
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
      const existingInfo = this.context.typeMap.get(identifier.name);

      if (!existingInfo && this.isLiteralExpression(right)) {
        this.addInfo(
          identifier.loc.start.line,
          identifier.loc.start.column,
          `Consider annotating '${identifier.name}' with its literal type for readability.`,
          'PSV6-TYPE-ANNOTATION-SUGGESTION',
        );
      }

      // Register variable type, preferring collection info if available
      if (inferredCollection) {
        this.registerVariableTypeInfo(
          identifier.name,
          this.normalizeType(inferredCollection.type),
          inferredCollection.elementType,
          inferredCollection.keyType,
          inferredCollection.valueType,
          identifier.loc.start.line,
          identifier.loc.start.column,
          false,
        );
      } else if (valueType && valueType !== 'unknown') {
        this.registerVariableTypeInfo(
          identifier.name,
          this.normalizeType(valueType),
          undefined,
          undefined,
          undefined,
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

    // In Pine Script, series expressions are commonly used in conditionals
    // Only warn for literal values that are clearly not intended as conditions
    if (isNumericLiteral || isStringLiteral) {
      this.addWarning(line, column, 'Non-boolean expression used as condition.', 'PSV6-TYPE-CONDITIONAL-TYPE');
      this.addWarning(
        line,
        column,
        `Implicit boolean conversion of '${testType ?? 'unknown'}' expression.`,
        'PSV6-TYPE-CONVERSION-IMPLICIT-BOOL',
      );
      return;
    }
    
    // For series expressions, just add an info message about implicit conversion
    if (isSeriesIdentifier || testType === 'series') {
      this.addInfo(
        line,
        column,
        `Series expression used as condition (implicit boolean conversion).`,
        'PSV6-TYPE-CONDITIONAL-SERIES',
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

    // Check for built-in .all array constants (box.all, line.all, label.all, etc.)
    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (!member.computed && member.property.name === 'all' && member.object.kind === 'Identifier') {
        const namespace = (member.object as IdentifierNode).name;
        const builtinArrayTypes: Record<string, string> = {
          'box': 'array',
          'line': 'array',
          'label': 'array',
          'table': 'array',
          'linefill': 'array',
          'polyline': 'array',
        };
        if (builtinArrayTypes[namespace]) {
          return 'array';  // Return 'array' type for .all constants
        }
      }
      // Check for syminfo.* built-in properties
      if (!member.computed && member.object.kind === 'Identifier') {
        const namespace = (member.object as IdentifierNode).name;
        const propertyName = member.property.name;
        if (namespace === 'syminfo') {
          // Most syminfo properties are strings, except for numeric ones
          if (propertyName === 'minmove' || propertyName === 'pointvalue') {
            return 'float';
          }
          return 'string';
        }
      }
    }

    // For CallExpression, check builtin return type FIRST before AST inference
    // This ensures functions like array.indexof() return 'int' not 'array'
    if (expression.kind === 'CallExpression') {
      const call = expression as CallExpressionNode;
      const calleeName = this.resolveCalleeName(call.callee);
      if (calleeName) {
        // Special handling for map.get() - resolve to actual value type
        if (calleeName === 'map.get' && call.args.length > 0) {
          const mapArg = call.args[0].value;
          if (mapArg.kind === 'Identifier') {
            const mapName = (mapArg as IdentifierNode).name;
            const mapTypeInfo = this.context.typeMap?.get(mapName);
            if (mapTypeInfo && mapTypeInfo.type === 'map' && mapTypeInfo.valueType) {
              return this.normalizeType(mapTypeInfo.valueType);
            }
          }
        }
        
        const builtinReturn = this.getBuiltinReturnType(calleeName);
        if (process.env.DEBUG_TYPE_INFERENCE === '1' && calleeName.startsWith('array.')) {
          console.log(`[TypeInference] getExpressionType for ${calleeName}:`, {
            builtinReturn,
            normalized: builtinReturn ? this.normalizeType(builtinReturn) : null,
          });
        }
        if (builtinReturn) {
          return this.normalizeType(builtinReturn);
        }
      }
    }

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

    if ((!resolved || resolved === 'unknown' || resolved === 'udt') && expression.kind === 'Identifier') {
      const mappedType = this.context.typeMap?.get((expression as IdentifierNode).name);
      if (mappedType) {
        const normalized = mappedType.type === 'series' ? 'series' : mappedType.type;
        if (normalized && normalized !== 'unknown') {
          resolved = normalized;
        }
      }
    }

    const shouldRefine = resolved === 'udt';

    if (resolved && resolved !== 'unknown' && !shouldRefine) {
      return resolved;
    }

    if (expression.kind === 'ConditionalExpression') {
      const conditional = expression as ConditionalExpressionNode;
      const consequentType = this.getExpressionType(conditional.consequent);
      const alternateType = conditional.alternate ? this.getExpressionType(conditional.alternate) : null;
      
      // IMPORTANT: If the condition is series, the result is always series
      // Example: barstate.islast ? 20 : 10 produces series int, not simple int
      const conditionIsSeries = this.isSeriesExpression(conditional.test);
      
      const merged = this.mergeConditionalTypes(consequentType, alternateType);
      if (merged) {
        // If condition is series, force result to be series
        if (conditionIsSeries && merged !== 'series') {
          return 'series';
        }
        return merged;
      }
    }

    const literal = this.inferLiteralType(expression);
    if (literal) {
      return literal;
    }

    if (resolved && resolved !== 'unknown') {
      return resolved;
    }

    return null;
  }

  /**
   * Determines if an expression produces a series value.
   * Series expressions include: series identifiers (close, high, etc.),
   * built-in series variables (barstate.*, syminfo.*, etc.),
   * and any expression that depends on series values.
   */
  private isSeriesExpression(expression: ExpressionNode | null | undefined): boolean {
    if (!expression) {
      return false;
    }

    // Check series identifiers (close, high, low, etc.)
    if (expression.kind === 'Identifier') {
      const name = (expression as IdentifierNode).name;
      if (SERIES_IDENTIFIERS.has(name)) {
        return true;
      }
      
      // Check if variable is registered as series in typeMap
      const typeInfo = this.context.typeMap.get(name);
      if (typeInfo?.isSeries) {
        return true;
      }
    }

    // Check member expressions (barstate.islast, syminfo.ticker, etc.)
    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (member.object.kind === 'Identifier') {
        const objectName = (member.object as IdentifierNode).name;
        // barstate.* members are all series
        if (objectName === 'barstate') {
          return true;
        }
        // syminfo.* members are series
        if (objectName === 'syminfo') {
          return true;
        }
      }
    }

    // Check for call expressions - some functions return series
    if (expression.kind === 'CallExpression') {
      const call = expression as CallExpressionNode;
      // ta.* functions typically return series
      if (call.callee.kind === 'MemberExpression') {
        const callee = call.callee as MemberExpressionNode;
        if (callee.object.kind === 'Identifier') {
          const objectName = (callee.object as IdentifierNode).name;
          if (objectName === 'ta' || objectName === 'math') {
            return true;
          }
        }
      }
    }

    // Binary expressions with series operands are series
    if (expression.kind === 'BinaryExpression') {
      const binary = expression as BinaryExpressionNode;
      return this.isSeriesExpression(binary.left) || this.isSeriesExpression(binary.right);
    }

    // Conditional expressions (ternary) with series condition are series
    if (expression.kind === 'ConditionalExpression') {
      const conditional = expression as ConditionalExpressionNode;
      return this.isSeriesExpression(conditional.test);
    }

    return false;
  }

  private mergeIdentifierTypes(existing: string, candidate: string): string {
    if (existing === candidate) {
      return existing;
    }
    if (existing === 'udt' && candidate !== 'unknown') {
      return candidate;
    }
    if (candidate === 'udt' && existing !== 'unknown') {
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

  private mergeConditionalTypes(
    consequentType: string | null,
    alternateType: string | null,
  ): string | null {
    if (!consequentType && !alternateType) {
      return null;
    }

    if (consequentType && !alternateType) {
      return consequentType;
    }

    if (!consequentType && alternateType) {
      return alternateType;
    }

    if (consequentType === alternateType) {
      return consequentType;
    }

    // If one branch is 'unknown' or 'void' (like na), prefer the known type
    if (consequentType === 'unknown' || consequentType === 'void') {
      return alternateType;
    }
    if (alternateType === 'unknown' || alternateType === 'void') {
      return consequentType;
    }

    const prioritized = new Set(['series', 'color', 'float', 'int', 'bool', 'string']);
    if (consequentType && alternateType) {
      if (prioritized.has(consequentType) && prioritized.has(alternateType)) {
        if (consequentType === 'series' || alternateType === 'series') {
          return 'series';
        }
        if (consequentType === 'color' || alternateType === 'color') {
          return 'color';
        }
        if ((consequentType === 'float' && alternateType === 'int') ||
            (consequentType === 'int' && alternateType === 'float')) {
          return 'float';
        }
        if (consequentType === 'bool' && alternateType === 'bool') {
          return 'bool';
        }
        if (consequentType === 'string' && alternateType === 'string') {
          return 'string';
        }
      }
    }

    return null;
  }

  private describeTypeMetadata(metadata: TypeMetadata | null | undefined): string | null {
    if (!metadata) {
      return null;
    }
    return metadata.kind;
  }

  private getBuiltinReturnType(calleeName: string): string | null {
    const rules = BUILTIN_FUNCTIONS_V6_RULES[calleeName];
    if (!rules) {
      return null;
    }

    if (typeof rules.returnType === 'string' && rules.returnType.length > 0) {
      return rules.returnType;
    }

    if (Array.isArray((rules as { overloads?: unknown }).overloads)) {
      for (const overload of (rules as { overloads: Array<{ returnType?: string }> }).overloads) {
        if (typeof overload.returnType === 'string' && overload.returnType.length > 0) {
          return overload.returnType;
        }
      }
    }

    return null;
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
      case 'ColorLiteral':
        return 'color';
      default:
        return null;
    }
  }

  private isLiteralExpression(expression: ExpressionNode): boolean {
    return (
      expression.kind === 'NumberLiteral' ||
      expression.kind === 'BooleanLiteral' ||
      expression.kind === 'StringLiteral' ||
      expression.kind === 'ColorLiteral'
    );
  }

  private isInsideFunction(node: VariableDeclarationNode): boolean {
    // Check if this variable declaration is inside a function
    // Simple heuristic: if the variable is declared with indentation, it's likely inside a function
    const column = node.loc.start.column;
    
    // Variables declared at column > 0 are likely inside functions or blocks
    return column > 0;
  }

  private isNaExpression(expression: ExpressionNode): boolean {
    // Check for both Identifier('na') and NullLiteral (which the parser uses for na)
    if (expression.kind === 'NullLiteral') {
      return true;
    }
    return expression.kind === 'Identifier' && (expression as IdentifierNode).name === 'na';
  }

  private isRequestFunctionCall(expression: ExpressionNode): boolean {
    if (expression.kind !== 'CallExpression') {
      return false;
    }
    
    const callExpr = expression as CallExpressionNode;
    const callee = callExpr.callee;
    
    if (callee.kind === 'MemberExpression') {
      const member = callee as MemberExpressionNode;
      if (member.object.kind === 'Identifier') {
        const objName = (member.object as IdentifierNode).name;
        const propName = (member.property as IdentifierNode).name;
        
        // Check if it's a request.* function
        if (objName === 'request') {
          const requestFunctions = new Set([
            'security', 'security_lower_tf', 'financial', 'economic',
            'quandl', 'dividends', 'splits', 'earnings', 'seed', 'currency_rate'
          ]);
          return requestFunctions.has(propName);
        }
      }
    }
    
    return false;
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

    // na is compatible with any type annotation
    if (actual === 'void' || actual === 'unknown') {
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

    // Color compatibility: series color expressions should be compatible with color parameters
    if (expected === 'color' && actual === 'series') {
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
    // Check for built-in .all array constants (box.all, line.all, label.all, etc.)
    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (!member.computed && member.property.name === 'all' && member.object.kind === 'Identifier') {
        const namespace = (member.object as IdentifierNode).name;
        const builtinArrayElementTypes: Record<string, string> = {
          'box': 'box',
          'line': 'line',
          'label': 'label',
          'table': 'table',
          'linefill': 'linefill',
          'polyline': 'polyline',
        };
        const elementType = builtinArrayElementTypes[namespace];
        if (elementType) {
          return { type: 'array', elementType };
        }
      }
    }

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

    // Check if the function returns a collection type (array, matrix, map)
    const functionDef = BUILTIN_FUNCTIONS_V6_RULES[calleeName];
    if (functionDef && functionDef.returnType) {
      if (functionDef.returnType === 'array') {
        // Functions like matrix.eigenvalues(), matrix.eigenvectors(), etc. return arrays
        // Try to infer element type from context if possible
        return { type: 'array' };
      }
      if (functionDef.returnType === 'matrix') {
        return { type: 'matrix' };
      }
      if (functionDef.returnType === 'map') {
        return { type: 'map' };
      }
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

    if (process.env.DEBUG_TYPE_INFERENCE === '1' && (name === 'idx' || name === 'allBoxes')) {
      console.log(`[TypeInference] registerVariableTypeInfo for ${name}:`, {
        type,
        elementType,
        keyType,
        valueType,
        existingType: this.context.typeMap.get(name)?.type,
      });
    }

    const normalizedElement = elementType && elementType !== 'unknown' ? elementType : undefined;
    const normalizedValue = valueType && valueType !== 'unknown' ? valueType : undefined;
    const normalizedKey = keyType && keyType !== 'unknown' ? keyType : type === 'map' ? 'string' : undefined;
    const existing = this.context.typeMap.get(name) as TypeInfo | undefined;

    if (existing) {
      const updated: TypeInfo = { ...existing };
      let changed = false;

      // Always update type if we have a more specific value
      // This ensures function return types override initial inferences
      if (this.shouldOverrideExistingType(updated.type, type)) {
        const previousType = updated.type;
        updated.type = type;
        updated.isSeries = type === 'series' || updated.isSeries;
        changed = true;

        if (process.env.DEBUG_TYPE_INFERENCE === '1' && name === 'idx') {
          console.log(`[TypeInference] Overriding ${name} type from ${previousType} to ${type}`);
        }
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
        if (process.env.DEBUG_TYPE_INFERENCE === '1' && name === 'idx') {
          console.log(`[TypeInference] Updated ${name} type from ${existing.type} to ${updated.type}`);
        }
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

  private shouldOverrideExistingType(existing: TypeInfo['type'], next: TypeInfo['type']): boolean {
    if (!existing || existing === 'unknown') {
      return true; // Always override unknown or missing types
    }

    if (existing === next) {
      return false;
    }

    const existingPriority = this.getTypePriority(existing);
    const nextPriority = this.getTypePriority(next);

    if (nextPriority > existingPriority) {
      return true;
    }

    // Prefer float over int when they compete at the same priority level
    if (existing === 'int' && next === 'float') {
      return true;
    }

    return false;
  }

  private getTypePriority(type: TypeInfo['type']): number {
    switch (type) {
      case 'array':
      case 'matrix':
      case 'map':
        return 1;
      case 'int':
      case 'float':
      case 'bool':
      case 'string':
      case 'color':
      case 'line':
      case 'label':
      case 'box':
      case 'table':
      case 'linefill':
      case 'polyline':
      case 'chart.point':
      case 'analysis':
      case 'udt':
        return 2;
      case 'series':
        return 3;
      default:
        return 1;
    }
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

  private getVariableType(varName: string): string | null {
    const typeInfo = this.context.typeMap.get(varName);
    if (!typeInfo) {
      return null;
    }

    if (typeInfo.type === 'udt' && typeInfo.udtName) {
      const alias = typeInfo.udtName.toLowerCase();
      const primitiveAliases = new Map<string, string>([
        ['color', 'color'],
        ['line', 'line'],
        ['label', 'label'],
        ['box', 'box'],
        ['table', 'table'],
        ['linefill', 'linefill'],
        ['polyline', 'polyline'],
        ['chart.point', 'chart.point'],
      ]);
      if (primitiveAliases.has(alias)) {
        return primitiveAliases.get(alias)!;
      }
    }

    return typeInfo.type;
  }

  private normalizeType(
    type: string,
  ): TypeInfo['type'] {
    // Normalize type strings to match the TypeInfo union type
    const normalized = type.trim().toLowerCase();
    const validTypes = new Set([
      'int',
      'float',
      'bool',
      'string',
      'color',
      'series',
      'line',
      'label',
      'box',
      'table',
      'array',
      'matrix',
      'map',
      'linefill',
      'polyline',
      'chart.point',
      'udt',
      'analysis',
      'unknown',
    ] satisfies Array<TypeInfo['type']>);

    if (normalized === 'unknown') {
      return 'unknown';
    }
    if (validTypes.has(normalized as TypeInfo['type'])) {
      return normalized as TypeInfo['type'];
    }

    // Handle generic-style annotations (e.g., "series <type>", "array<float>")
    if (normalized === 'element') {
      return 'series';
    }
    if (normalized.startsWith('series')) {
      return 'series';
    }
    if (normalized.startsWith('array')) {
      return 'array';
    }
    if (normalized.startsWith('matrix')) {
      return 'matrix';
    }
    if (normalized.startsWith('map')) {
      return 'map';
    }

    // Treat Pine 'na' literal as numeric for compatibility
    if (normalized === 'na') {
      return 'float';
    }

    return 'unknown';
  }

}
