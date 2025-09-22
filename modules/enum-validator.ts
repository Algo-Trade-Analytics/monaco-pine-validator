/**
 * Enum validation module for Pine Script v6
 * Handles enum declaration syntax, usage, and best practices
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidationResult,
  type ValidatorConfig,
  type TypeInfo,
} from '../core/types';
import {
  type ArgumentNode,
  type BinaryExpressionNode,
  type CallExpressionNode,
  type EnumDeclarationNode,
  type EnumMemberNode,
  type ExpressionNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type ParameterNode,
  type ProgramNode,
  type FunctionDeclarationNode,
  type SwitchStatementNode,
  type TypeReferenceNode,
  type VariableDeclarationNode,
} from '../core/ast/nodes';
import { visit } from '../core/ast/traversal';

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}

const KNOWN_NAMESPACES = new Set([
  'array',
  'matrix',
  'map',
  'ta',
  'math',
  'str',
  'color',
  'line',
  'label',
  'box',
  'table',
  'request',
  'input',
  'strategy',
  'runtime',
  'chart',
  'dividends',
  'earnings',
  'linefill',
  'polyline',
]);

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ENUM_NAME_PATTERN = /^[A-Z][A-Za-z0-9_]*$/;
const ENUM_VALUE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

interface EnumAstInfo {
  readonly node: EnumDeclarationNode;
  readonly members: Map<string, EnumMemberNode>;
}

export class EnumValidator implements ValidationModule {
  name = 'EnumValidator';
  
  private errors: Array<{ line: number; column: number; message: string; code: string }> = [];
  private warnings: Array<{ line: number; column: number; message: string; code: string }> = [];
  private info: Array<{ line: number; column: number; message: string; code: string }> = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;
  private astEnumDeclarations: Map<string, EnumAstInfo> = new Map();
  private astEnumVariables: Map<string, string> = new Map();
  private astFunctionParams: Map<string, ParameterNode[]> = new Map();

  getDependencies(): string[] {
    return [];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.astContext = isAstValidationContext(context) && context.ast ? context : null;

    if (this.astContext?.ast) {
      this.validateWithAst(this.astContext.ast);
    } else {
      this.validateEnumDeclarationsLegacy();
      this.validateEnumUsageLegacy();
      this.validateEnumBestPracticesLegacy();
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors.map(e => ({ ...e, severity: 'error' as const })),
      warnings: this.warnings.map(w => ({ ...w, severity: 'warning' as const })),
      info: this.info.map(i => ({ ...i, severity: 'info' as const })),
      typeMap: context.typeMap,
      scriptType: context.scriptType
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
    this.astEnumDeclarations.clear();
    this.astEnumVariables.clear();
    this.astFunctionParams.clear();
  }

  private addError(line: number, column: number, message: string, code: string): void {
    this.errors.push({ line, column, message, code });
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({ line, column, message, code });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({ line, column, message, code });
  }

  private validateWithAst(program: ProgramNode): void {
    visit(program, {
      EnumDeclaration: {
        enter: (path) => {
          this.processEnumDeclaration(path.node as EnumDeclarationNode);
        },
      },
      FunctionDeclaration: {
        enter: (path) => {
          this.recordFunctionDeclaration(path.node as FunctionDeclarationNode);
        },
      },
    });

    visit(program, {
      VariableDeclaration: {
        enter: (path) => {
          this.processVariableDeclaration(path.node as VariableDeclarationNode);
        },
      },
      MemberExpression: {
        enter: (path) => {
          this.processMemberExpression(path.node as MemberExpressionNode);
        },
      },
      BinaryExpression: {
        enter: (path) => {
          this.processBinaryExpression(path.node as BinaryExpressionNode);
        },
      },
      CallExpression: {
        enter: (path) => {
          this.processCallExpression(path.node as CallExpressionNode);
        },
      },
      SwitchStatement: {
        enter: (path) => {
          this.processSwitchStatement(path.node as SwitchStatementNode);
        },
      },
    });
  }

  private processEnumDeclaration(node: EnumDeclarationNode): void {
    const enumName = node.identifier.name;
    const { line, column } = node.identifier.loc.start;

    this.setTypeMapEntry(enumName, node.identifier, { isConst: true, isSeries: false });
    this.recordTypeUsage(enumName, node.identifier);

    if (!ENUM_NAME_PATTERN.test(enumName)) {
      this.addInfo(line, column, `Consider using PascalCase for enum names: ${enumName}`, 'PSV6-ENUM-NAMING-SUGGESTION');
    }

    if (node.members.length === 0) {
      this.addError(line, column, 'Enum declaration must have at least one value', 'PSV6-ENUM-EMPTY');
    }

    const seen = new Set<string>();
    const info: EnumAstInfo = { node, members: new Map() };

    for (const member of node.members) {
      const memberName = member.identifier.name;
      const memberLoc = member.identifier.loc.start;

      if (!IDENTIFIER_PATTERN.test(memberName)) {
        this.addError(memberLoc.line, memberLoc.column, `Invalid enum value name: ${memberName}`, 'PSV6-ENUM-INVALID-VALUE-NAME');
        continue;
      }

      if (seen.has(memberName)) {
        this.addError(memberLoc.line, memberLoc.column, `Duplicate enum value: ${memberName}`, 'PSV6-ENUM-DUPLICATE-VALUE');
      } else {
        seen.add(memberName);
        info.members.set(memberName, member);
      }

      if (!ENUM_VALUE_PATTERN.test(memberName)) {
        this.addInfo(memberLoc.line, memberLoc.column, `Consider using UPPER_CASE for enum values: ${memberName}`, 'PSV6-ENUM-VALUE-NAMING-SUGGESTION');
      }

      this.setTypeMapEntry(`${enumName}.${memberName}`, member.identifier, { isConst: true, isSeries: false });
      this.recordTypeUsage(`${enumName}.${memberName}`, member.identifier);
    }

    this.astEnumDeclarations.set(enumName, info);
  }

  private recordFunctionDeclaration(node: FunctionDeclarationNode): void {
    if (!node.identifier) {
      return;
    }

    this.astFunctionParams.set(node.identifier.name, node.params);
  }

  private processVariableDeclaration(node: VariableDeclarationNode): void {
    const variableName = node.identifier.name;
    const typeName = this.getTypeReferenceName(node.typeAnnotation);

    let declaredEnum: string | null = null;
    if (typeName && this.astEnumDeclarations.has(typeName)) {
      declaredEnum = typeName;
      this.astEnumVariables.set(variableName, typeName);
      this.setTypeMapEntry(variableName, node.identifier, {
        enumType: typeName,
        isConst: node.declarationKind === 'const',
        isSeries: false,
      });
    }

    const enumReference = this.getEnumMemberReference(node.initializer);
    if (!enumReference) {
      return;
    }

    const enumInfo = this.astEnumDeclarations.get(enumReference.enumName);
    if (!enumInfo) {
      const { line, column } = enumReference.node.object.loc.start;
      this.addError(line, column, `Undefined enum type: ${enumReference.enumName}`, 'PSV6-ENUM-UNDEFINED-TYPE');
      return;
    }

    if (!enumInfo.members.has(enumReference.memberName)) {
      const { line, column } = enumReference.node.property.loc.start;
      this.addError(line, column, `Undefined enum value: ${enumReference.enumName}.${enumReference.memberName}`, 'PSV6-ENUM-UNDEFINED-VALUE');
    } else {
      this.recordTypeUsage(`${enumReference.enumName}.${enumReference.memberName}`, enumReference.node.property);
    }

    if (declaredEnum && declaredEnum !== enumReference.enumName) {
      const { line, column } = node.identifier.loc.start;
      this.addError(line, column, `Type mismatch: expected ${declaredEnum}, got ${enumReference.enumName}`, 'PSV6-ENUM-TYPE-MISMATCH');
      return;
    }

    if (!declaredEnum) {
      this.astEnumVariables.set(variableName, enumReference.enumName);
      this.setTypeMapEntry(variableName, node.identifier, {
        enumType: enumReference.enumName,
        isConst: node.declarationKind === 'const',
        isSeries: false,
      });
    }
  }

  private processMemberExpression(node: MemberExpressionNode): void {
    const reference = this.getEnumMemberReference(node);
    if (!reference) {
      return;
    }

    if (KNOWN_NAMESPACES.has(reference.enumName)) {
      return;
    }

    const enumInfo = this.astEnumDeclarations.get(reference.enumName);
    if (!enumInfo) {
      const { line, column } = reference.node.object.loc.start;
      this.addError(line, column, `Undefined enum type: ${reference.enumName}`, 'PSV6-ENUM-UNDEFINED-TYPE');
      return;
    }

    if (!enumInfo.members.has(reference.memberName)) {
      const { line, column } = reference.node.property.loc.start;
      this.addError(line, column, `Undefined enum value: ${reference.enumName}.${reference.memberName}`, 'PSV6-ENUM-UNDEFINED-VALUE');
      return;
    }

    this.recordTypeUsage(`${reference.enumName}.${reference.memberName}`, reference.node.property);
  }

  private processBinaryExpression(node: BinaryExpressionNode): void {
    if (node.operator !== '==' && node.operator !== '!=') {
      return;
    }

    const leftReference = this.getEnumMemberReference(node.left);
    const rightReference = this.getEnumMemberReference(node.right);

    if (leftReference && rightReference) {
      if (leftReference.enumName !== rightReference.enumName) {
        const { line, column } = node.loc.start;
        this.addWarning(line, column, 'Comparing enum values from different types', 'PSV6-ENUM-COMPARISON-TYPE-MISMATCH');
      }
      return;
    }

    const leftType = this.resolveExpressionEnumType(node.left);
    const rightType = this.resolveExpressionEnumType(node.right);

    if (!leftType || !rightType || leftType === rightType) {
      return;
    }

    const identifier = this.getIdentifierName(leftReference ? node.right : node.left);
    const variableType = leftReference ? rightType : leftType;
    const enumType = leftReference ? leftReference!.enumName : rightReference!.enumName;

    const { line, column } = node.loc.start;
    if (identifier) {
      this.addWarning(
        line,
        column,
        `Comparing enum variable of type ${variableType} with ${enumType} enum value`,
        'PSV6-ENUM-COMPARISON-TYPE-MISMATCH',
      );
    } else {
      this.addWarning(line, column, 'Comparing enum values from different types', 'PSV6-ENUM-COMPARISON-TYPE-MISMATCH');
    }
  }

  private processCallExpression(node: CallExpressionNode): void {
    if (node.callee.kind !== 'Identifier') {
      return;
    }

    const fnName = (node.callee as IdentifierNode).name;
    const params = this.astFunctionParams.get(fnName);
    if (!params || params.length === 0) {
      return;
    }

    node.args.forEach((arg, index) => {
      const reference = this.getEnumMemberReference(arg.value);
      if (!reference) {
        return;
      }

      const expected = this.resolveParameterEnum(params[index]);
      if (!expected || expected === reference.enumName) {
        return;
      }

      const { line, column } = arg.value.loc.start;
      this.addError(
        line,
        column,
        `Function parameter type mismatch: expected ${expected}, got ${reference.enumName}`,
        'PSV6-ENUM-FUNCTION-TYPE-MISMATCH',
      );
    });
  }

  private processSwitchStatement(node: SwitchStatementNode): void {
    const discriminantType = this.resolveExpressionEnumType(node.discriminant);

    node.cases.forEach((caseNode) => {
      if (!caseNode.test) {
        return;
      }

      const reference = this.getEnumMemberReference(caseNode.test);
      if (!reference) {
        return;
      }

      const enumInfo = this.astEnumDeclarations.get(reference.enumName);
      if (!enumInfo) {
        const { line, column } = reference.node.object.loc.start;
        this.addError(line, column, `Undefined enum type: ${reference.enumName}`, 'PSV6-ENUM-UNDEFINED-TYPE');
        return;
      }

      if (!enumInfo.members.has(reference.memberName)) {
        const { line, column } = reference.node.property.loc.start;
        this.addError(
          line,
          column,
          `Undefined enum value in switch case: ${reference.enumName}.${reference.memberName}`,
          'PSV6-ENUM-SWITCH-CASE-TYPE-MISMATCH',
        );
        return;
      }

      this.recordTypeUsage(`${reference.enumName}.${reference.memberName}`, reference.node.property);

      if (discriminantType && discriminantType !== reference.enumName) {
        const { line, column } = caseNode.loc.start;
        this.addError(
          line,
          column,
          `Switch case enum type mismatch: expected ${discriminantType}, got ${reference.enumName}`,
          'PSV6-ENUM-SWITCH-CASE-TYPE-MISMATCH',
        );
      }
    });
  }

  private resolveExpressionEnumType(expression: ExpressionNode | null): string | null {
    if (!expression) {
      return null;
    }

    const reference = this.getEnumMemberReference(expression);
    if (reference) {
      return this.astEnumDeclarations.has(reference.enumName) ? reference.enumName : null;
    }

    if (expression.kind === 'Identifier') {
      const identifier = expression as IdentifierNode;
      const fromDeclaration = this.astEnumVariables.get(identifier.name);
      if (fromDeclaration) {
        return fromDeclaration;
      }
      const typeInfo = this.context.typeMap.get(identifier.name);
      if (typeInfo?.enumType) {
        return typeInfo.enumType;
      }
    }

    return null;
  }

  private resolveParameterEnum(param: ParameterNode | undefined): string | null {
    if (!param) {
      return null;
    }

    const annotated = this.getTypeReferenceName(param.typeAnnotation);
    if (annotated && this.astEnumDeclarations.has(annotated)) {
      return annotated;
    }

    const paramName = param.identifier.name;
    if (this.astEnumDeclarations.has(paramName)) {
      return paramName;
    }

    const capitalized = paramName.charAt(0).toUpperCase() + paramName.slice(1);
    if (this.astEnumDeclarations.has(capitalized)) {
      return capitalized;
    }

    return null;
  }

  private getEnumMemberReference(
    expression: ExpressionNode | null,
  ): { enumName: string; memberName: string; node: MemberExpressionNode } | null {
    if (!expression || expression.kind !== 'MemberExpression') {
      return null;
    }

    const member = expression as MemberExpressionNode;
    if (member.computed) {
      return null;
    }

    if (member.object.kind !== 'Identifier' || member.property.kind !== 'Identifier') {
      return null;
    }

    const object = member.object as IdentifierNode;
    const property = member.property as IdentifierNode;
    return { enumName: object.name, memberName: property.name, node: member };
  }

  private setTypeMapEntry(name: string, node: { loc: { start: { line: number; column: number } } }, overrides: Partial<TypeInfo> = {}): void {
    const existing = this.context.typeMap.get(name);
    const declaredAt = overrides.declaredAt ?? existing?.declaredAt ?? {
      line: node.loc.start.line,
      column: node.loc.start.column,
    };

    const info: TypeInfo = {
      type: overrides.type ?? existing?.type ?? 'unknown',
      isConst: overrides.isConst ?? existing?.isConst ?? false,
      isSeries: overrides.isSeries ?? existing?.isSeries ?? false,
      declaredAt,
      usages: existing?.usages ?? [],
    };

    if (overrides.enumType !== undefined || existing?.enumType !== undefined) {
      info.enumType = overrides.enumType ?? existing?.enumType;
    }
    if (overrides.elementType !== undefined || existing?.elementType !== undefined) {
      info.elementType = overrides.elementType ?? existing?.elementType;
    }
    if (overrides.udtName !== undefined || existing?.udtName !== undefined) {
      info.udtName = overrides.udtName ?? existing?.udtName;
    }

    this.context.typeMap.set(name, info);
  }

  private recordTypeUsage(name: string, node: { loc: { start: { line: number; column: number } } }): void {
    const info = this.context.typeMap.get(name);
    if (!info) {
      this.setTypeMapEntry(name, node);
      return this.recordTypeUsage(name, node);
    }

    info.usages.push({ line: node.loc.start.line, column: node.loc.start.column });
  }

  private getTypeReferenceName(type: TypeReferenceNode | null): string | null {
    if (!type) {
      return null;
    }

    return type.name.name;
  }

  private getIdentifierName(expression: ExpressionNode | null): string | null {
    if (!expression || expression.kind !== 'Identifier') {
      return null;
    }

    return (expression as IdentifierNode).name;
  }

  private validateEnumDeclarationsLegacy(): void {
    const enumDeclarations = new Map<string, { line: number; values: string[] }>();
    
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for enum declaration
      const enumMatch = line.match(/^\s*enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
      if (enumMatch) {
        const enumName = enumMatch[1];
        const values: string[] = [];
        let j = i + 1;
        
        // Collect enum values (including invalid ones for validation)
        while (j < this.context.cleanLines.length) {
          const valueLine = this.context.cleanLines[j];
          
          // Check if this looks like an enum value (starts with identifier-like pattern)
          const valueMatch = valueLine.match(/^\s*([A-Za-z_][A-Za-z0-9_]*|[0-9][A-Za-z0-9_]*)\s*$/);
          
          if (valueMatch) {
            values.push(valueMatch[1]);
            j++;
          } else {
            break;
          }
        }
        
        // Validate enum
        this.validateEnumDeclarationLegacy(enumName, values, lineNum);
        enumDeclarations.set(enumName, { line: lineNum, values });
        
        // Store enum type in context
        this.context.typeMap.set(enumName, {
          type: 'unknown', // Enum types are not in the standard type union
          isConst: true,
          isSeries: false,
          declaredAt: { line: lineNum, column: 1 },
          usages: []
        });
        
        // Store enum values in context for validation
        for (const value of values) {
          this.context.typeMap.set(`${enumName}.${value}`, {
            type: 'unknown',
            isConst: true,
            isSeries: false,
            declaredAt: { line: lineNum, column: 1 },
            usages: []
          });
        }
      }
    }
  }

  private validateEnumDeclarationLegacy(enumName: string, values: string[], lineNum: number): void {
    // Check for empty enum
    if (values.length === 0) {
      this.addError(lineNum, 1, 'Enum declaration must have at least one value', 'PSV6-ENUM-EMPTY');
      return;
    }

    // Check for duplicate values
    const seenValues = new Set<string>();
    for (const value of values) {
      if (seenValues.has(value)) {
        this.addError(lineNum, 1, `Duplicate enum value: ${value}`, 'PSV6-ENUM-DUPLICATE-VALUE');
      } else {
        seenValues.add(value);
      }
    }

    // Check for invalid value names
    for (const value of values) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
        this.addError(lineNum, 1, `Invalid enum value name: ${value}`, 'PSV6-ENUM-INVALID-VALUE-NAME');
      }
    }

    // Check enum naming conventions
    if (!/^[A-Z][A-Za-z0-9_]*$/.test(enumName)) {
      this.addInfo(lineNum, 1, `Consider using PascalCase for enum names: ${enumName}`, 'PSV6-ENUM-NAMING-SUGGESTION');
    }

    // Check enum value naming conventions
    for (const value of values) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(value)) {
        this.addInfo(lineNum, 1, `Consider using UPPER_CASE for enum values: ${value}`, 'PSV6-ENUM-VALUE-NAMING-SUGGESTION');
      }
    }
  }

  private validateEnumUsageLegacy(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for enum value usage (EnumName.ValueName) - but exclude known namespaces and UDT patterns
      const knownNamespaces = new Set(['array', 'matrix', 'map', 'ta', 'math', 'str', 'color', 'line', 'label', 'box', 'table', 'request', 'input', 'strategy', 'runtime', 'chart', 'dividends', 'earnings', 'linefill', 'polyline']);
      
      // Only look for enum patterns that are likely to be actual enum usage
      // Exclude UDT constructors (.new), UDT field access (this.x, other.y), and method calls
      const enumUsageMatch = line.match(/([A-Z][A-Za-z0-9_]*)\.([A-Z][A-Z0-9_]*)/g);
      if (enumUsageMatch) {
        for (const match of enumUsageMatch) {
          const [enumName, valueName] = match.split('.');
          
          // Skip if it's a known namespace (like array.new, ta.sma, etc.)
          if (knownNamespaces.has(enumName)) {
            continue;
          }
          
          this.validateEnumValueUsageLegacy(enumName, valueName, lineNum);
        }
      }

      // Check for enum variable declarations
      const enumVarMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*)/);
      if (enumVarMatch) {
        const [_, varType, varName, enumValue] = enumVarMatch;
        const ns = enumValue.split('.')[0];
        // Skip if var/varip declaration or if RHS is a known namespace call (e.g., array.new)
        if (varType === 'var' || varType === 'varip' || knownNamespaces.has(ns)) {
          // not an enum variable declaration
        } else {
          this.validateEnumVariableDeclarationLegacy(varType, varName, enumValue, lineNum);
        }
        
        // Add the variable to typeMap for later validation
        this.context.typeMap.set(varName, {
          type: 'unknown',
          isConst: false,
          isSeries: false,
          declaredAt: { line: lineNum, column: 1 },
          usages: [],
          enumType: varType // Store the enum type for later validation
        });
      }

      // Check for enum comparisons
      this.validateEnumComparisonsLegacy(line, lineNum);

      // Check for enum in function calls
      this.validateEnumFunctionCallsLegacy(line, lineNum);

      // Check for enum in switch statements
      this.validateEnumSwitchCasesLegacy(line, lineNum);
    }
  }

  private validateEnumValueUsageLegacy(enumName: string, valueName: string, lineNum: number): void {
    // Check if enum type exists
    const enumType = this.context.typeMap.get(enumName);
    if (!enumType) {
      this.addError(lineNum, 1, `Undefined enum type: ${enumName}`, 'PSV6-ENUM-UNDEFINED-TYPE');
      return;
    }

    // Check if enum value exists
    const enumValue = this.context.typeMap.get(`${enumName}.${valueName}`);
    if (!enumValue) {
      this.addError(lineNum, 1, `Undefined enum value: ${enumName}.${valueName}`, 'PSV6-ENUM-UNDEFINED-VALUE');
    }
  }

  private validateEnumVariableDeclarationLegacy(varType: string, varName: string, enumValue: string, lineNum: number): void {
    const [enumName, valueName] = enumValue.split('.');
    
    // Check if enum type exists
    const enumType = this.context.typeMap.get(enumName);
    if (!enumType) {
      this.addError(lineNum, 1, `Undefined enum type: ${enumName}`, 'PSV6-ENUM-UNDEFINED-TYPE');
      return;
    }

    // Check if variable type matches enum type
    if (varType !== enumName) {
      this.addError(lineNum, 1, `Type mismatch: expected ${enumName}, got ${varType}`, 'PSV6-ENUM-TYPE-MISMATCH');
    }
  }

  private validateEnumBestPracticesLegacy(): void {
    // This method can be expanded to include more best practices
    // For now, it's handled in the enum declaration validation
  }

  private validateEnumComparisonsLegacy(line: string, lineNum: number): void {
    // Check for enum comparisons with different types
    const enumUsageMatch = line.match(/([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)/g);
    if (enumUsageMatch && enumUsageMatch.length > 1) {
      const enumTypes = new Set<string>();
      for (const match of enumUsageMatch) {
        const [enumName] = match.split('.');
        enumTypes.add(enumName);
      }
      
      if (enumTypes.size > 1) {
        this.addWarning(lineNum, 1, 'Comparing enum values from different types', 'PSV6-ENUM-COMPARISON-TYPE-MISMATCH');
      }
    }
    
    // Check for comparisons between enum variables and enum values
    const comparisonMatch = line.match(/([A-Za-z_][A-Za-z0-9_]*)\s*[=!]=\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)/);
    if (comparisonMatch) {
      const [_, varName, enumType, enumValue] = comparisonMatch;
      
      // Check if the variable is declared as an enum type
      const varType = this.context.typeMap.get(varName);
      
      if (varType && varType.type === 'unknown') {
        // Check if the variable has a stored enum type
        const varEnumType = varType.enumType;
        
        if (varEnumType && this.context.typeMap.has(enumType) && enumType !== varEnumType) {
          this.addWarning(lineNum, 1, `Comparing enum variable of type ${varEnumType} with ${enumType} enum value`, 'PSV6-ENUM-COMPARISON-TYPE-MISMATCH');
        }
      }
    }
  }

  private validateEnumFunctionCallsLegacy(line: string, lineNum: number): void {
    // Check for function calls with enum parameters
    const functionCallMatch = line.match(/([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
    if (functionCallMatch) {
      const [_, functionName, params] = functionCallMatch;
      
      // Check if this is a function call with enum parameters
      const enumParams = params.match(/([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)/g);
      if (enumParams) {
        // Look for function definitions to understand expected parameter types
        for (let i = 0; i < this.context.cleanLines.length; i++) {
          const funcLine = this.context.cleanLines[i];
          const funcMatch = funcLine.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=>/);
          if (funcMatch && funcMatch[1] === functionName) {
            const funcParams = funcMatch[2].split(',').map(p => p.trim());
            
            // Check if any parameter name matches an enum type
            for (let j = 0; j < Math.min(funcParams.length, enumParams.length); j++) {
              const paramName = funcParams[j];
              const enumParam = enumParams[j];
              const [enumType] = enumParam.split('.');
              
              // Check if the parameter name matches an enum type name
              const paramIsEnumType = this.context.typeMap.has(paramName);
              const enumTypeExists = this.context.typeMap.has(enumType);
              
              // Heuristic: if parameter name suggests an enum type (capitalized version exists) and we're passing a different enum type
              const capitalizedParam = paramName.charAt(0).toUpperCase() + paramName.slice(1);
              const paramSuggestsEnumType = this.context.typeMap.has(capitalizedParam);
              const paramAsEnumType = this.context.typeMap.has(paramName);
              
              // If the parameter name is an enum type and the passed enum type is different
              if (paramAsEnumType && enumTypeExists && enumType !== paramName) {
                this.addError(lineNum, 1, `Function parameter type mismatch: expected ${paramName}, got ${enumType}`, 'PSV6-ENUM-FUNCTION-TYPE-MISMATCH');
              }
              // Heuristic: if parameter name suggests an enum type and we're passing a different enum type
              else if (paramSuggestsEnumType && enumTypeExists && enumType !== capitalizedParam) {
                this.addError(lineNum, 1, `Function parameter type mismatch: expected ${capitalizedParam}, got ${enumType}`, 'PSV6-ENUM-FUNCTION-TYPE-MISMATCH');
              }
            }
            break;
          }
        }
      }
    }
  }

  private validateEnumSwitchCasesLegacy(line: string, lineNum: number): void {
    // Check for switch case with enum values
    const switchCaseMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*=>/);
    if (switchCaseMatch) {
      const [_, enumName, valueName] = switchCaseMatch;
      
      // Check if this enum value exists
      const enumValue = this.context.typeMap.get(`${enumName}.${valueName}`);
      if (!enumValue) {
        this.addError(lineNum, 1, `Undefined enum value in switch case: ${enumName}.${valueName}`, 'PSV6-ENUM-SWITCH-CASE-TYPE-MISMATCH');
      }
      
      // Check if this switch case matches the switch expression type
      // Look for the switch expression in previous lines
      for (let i = lineNum - 1; i >= 0; i--) {
        const prevLine = this.context.cleanLines[i];
        const switchMatch = prevLine.match(/^\s*switch\s+([A-Za-z_][A-Za-z0-9_]*)/);
        if (switchMatch) {
          const switchVarName = switchMatch[1];
          const switchVarType = this.context.typeMap.get(switchVarName);
          
          if (switchVarType && switchVarType.type === 'unknown') {
            const switchEnumType = switchVarType.enumType;
            
            if (switchEnumType && this.context.typeMap.has(enumName) && enumName !== switchEnumType) {
              this.addError(lineNum, 1, `Switch case enum type mismatch: expected ${switchEnumType}, got ${enumName}`, 'PSV6-ENUM-SWITCH-CASE-TYPE-MISMATCH');
            }
          }
          break;
        }
      }
    }
  }
}
