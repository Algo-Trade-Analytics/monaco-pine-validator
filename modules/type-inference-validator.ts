/**
 * Enhanced Type Inference validation module for Pine Script v6
 * Handles advanced type inference, type compatibility, and type safety
 */

import { ValidationModule, ValidationContext, ValidationError, ValidationResult, ValidatorConfig, TypeInfo } from '../core/types';
import { BUILTIN_FUNCTIONS_V6_RULES, NAMESPACES } from '../core/constants';

export class TypeInferenceValidator implements ValidationModule {
  name = 'TypeInferenceValidator';
  priority = 90; // Run before FunctionValidator to ensure type inference is complete
  
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  getDependencies(): string[] {
    return ['SyntaxValidator', 'TypeValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;
    

    this.validateTypeCompatibility();
    this.validateTypeInference();
    this.validateTypeSafety();
    this.validateImplicitConversions();
    this.validateTypeAnnotations();

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
          this.addError(lineNum, 1, message, 'PSV6-TYPE-INFERENCE-AMBIGUOUS');
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

  private areTypesCompatible(type1: string, type2: string): boolean {
    // Type compatibility rules
    if (type1 === 'any' || type2 === 'any') return true;
    if (type1 === type2) return true;
    
    // Numeric compatibility
    if ((type1 === 'int' || type1 === 'float') && (type2 === 'int' || type2 === 'float')) {
      return true;
    }
    
    // Series compatibility
    if ((type1 === 'series' || type1 === 'series int' || type1 === 'series float') && 
        (type2 === 'series' || type2 === 'series int' || type2 === 'series float')) {
      return true;
    }
    
    // Float/int to series compatibility (Pine Script allows scalar values to be passed to series parameters)
    if (type1 === 'series' && (type2 === 'float' || type2 === 'int')) {
      return true;
    }
    
    // Boolean compatibility
    if ((type1 === 'bool' || type1 === 'series bool') && 
        (type2 === 'bool' || type2 === 'series bool')) {
      return true;
    }
    
    // String compatibility
    if (type1 === 'string' && type2 === 'string') {
      return true;
    }
    
    // na compatibility (na can be assigned to any type)
    if (type2 === 'na') {
      return true;
    }
    
    // Literal to series compatibility (literals can be assigned to series)
    if (type1 === 'series' && (type2 === 'int' || type2 === 'float' || type2 === 'bool')) {
      return true;
    }
    
    // Series to numeric compatibility (series can be used where numeric is expected)
    if ((type1 === 'int' || type1 === 'float') && type2 === 'series') {
      return true;
    }

    return false;
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
