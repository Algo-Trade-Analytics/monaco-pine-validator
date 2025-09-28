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
  'position',
  'size',
  'alert',
  'request',
  'input',
  'strategy',
  'runtime',
  'chart',
  'timeframe',
  'barstate',
  'shape',
  'location',
  'currency',
  'dividends',
  'earnings',
  'linefill',
  'polyline',
  'syminfo',
  'display',
  'extend',
  'format',
  'scale',
  'adjustment',
  'backadjustment',
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
    return ['UDTValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.astContext = isAstValidationContext(context) && context.ast ? context : null;

    if (this.astContext?.ast) {
      this.validateWithAst(this.astContext.ast);
    } else {
      this.validateWithText();
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors.map((e) => ({ ...e, severity: 'error' as const })),
      warnings: this.warnings.map((w) => ({ ...w, severity: 'warning' as const })),
      info: this.info.map((i) => ({ ...i, severity: 'info' as const })),
      typeMap: context.typeMap,
      scriptType: context.scriptType,
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
    if (process.env.DEBUG_ENUM === '1') {
      console.log('[EnumValidator] addError', { line, column, code, message });
    }
    this.errors.push({ line, column, message, code });
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    if (process.env.DEBUG_ENUM === '1') {
      console.log('[EnumValidator] addWarning', { line, column, code, message });
    }
    this.warnings.push({ line, column, message, code });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    if (process.env.DEBUG_ENUM === '1') {
      console.log('[EnumValidator] addInfo', { line, column, code, message });
    }
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

  private validateWithText(): void {
    const lines = Array.isArray(this.context.rawLines)
      ? this.context.rawLines
      : Array.isArray(this.context.cleanLines)
        ? this.context.cleanLines
        : this.context.lines ?? [];

    if (lines.length === 0) {
      return;
    }

    const enumNames = new Set<string>();
    const functionParams = new Map<string, string[]>();

    for (const rawLine of lines) {
      const enumMatch = rawLine.match(/^\s*enum\s+([A-Za-z_][A-Za-z0-9_]*)/i);
      if (enumMatch) {
        enumNames.add(enumMatch[1]);
      }
    }

    for (const rawLine of lines) {
      const funcMatch = rawLine.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=>/);
      if (!funcMatch) {
        continue;
      }

      const [, name, params] = funcMatch;
      const paramNames = params
        .split(',')
        .map((segment) => segment.split('=')[0]?.trim())
        .filter((segment): segment is string => Boolean(segment));
      functionParams.set(name, paramNames);
    }

    const callPattern = /([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)\)/g;

    lines.forEach((rawLine, index) => {
      let match: RegExpExecArray | null;
      while ((match = callPattern.exec(rawLine)) !== null) {
        const [, name, argsString] = match;
        const params = functionParams.get(name);
        if (!params || params.length === 0) {
          continue;
        }

        const args = argsString.split(',').map((arg) => arg.trim());
        for (let i = 0; i < Math.min(args.length, params.length); i += 1) {
          const arg = args[i];
          const enumMatch = arg.match(/^([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)$/);
          if (!enumMatch) {
            continue;
          }

          const actualEnum = enumMatch[1];
          const expectedEnum = this.inferEnumFromParam(params[i], enumNames);
          if (!expectedEnum || expectedEnum === actualEnum) {
            continue;
          }

          const column = (match.index ?? 0) + 1;
          this.addError(
            index + 1,
            column,
            `Function parameter type mismatch: expected ${expectedEnum}, got ${actualEnum}`,
            'PSV6-ENUM-FUNCTION-TYPE-MISMATCH',
          );
        }
      }
    });
  }

  private inferEnumFromParam(paramName: string, enumNames: Set<string>): string | null {
    if (!paramName) {
      return null;
    }

    if (enumNames.has(paramName)) {
      return paramName;
    }

    const capitalized = paramName.charAt(0).toUpperCase() + paramName.slice(1);
    if (enumNames.has(capitalized)) {
      return capitalized;
    }

    return null;
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

      const rawLine = this.getLine(memberLoc.line);
      const lineWithoutComment = rawLine.replace(/\/\/.*$/, '');
      const trimmedValue = lineWithoutComment.trim();

      if (trimmedValue && !/^[A-Za-z_]/.test(trimmedValue)) {
        this.addError(memberLoc.line, memberLoc.column, `Invalid enum value name: ${trimmedValue}`, 'PSV6-ENUM-INVALID-VALUE-NAME');
        continue;
      }

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

  private getLine(lineNumber: number): string {
    if (Array.isArray(this.context.rawLines) && this.context.rawLines.length >= lineNumber) {
      return this.context.rawLines[lineNumber - 1] ?? '';
    }
    if (Array.isArray(this.context.cleanLines) && this.context.cleanLines.length >= lineNumber) {
      return this.context.cleanLines[lineNumber - 1] ?? '';
    }
    if (Array.isArray(this.context.lines) && this.context.lines.length >= lineNumber) {
      return this.context.lines[lineNumber - 1] ?? '';
    }
    return '';
  }

  private recordFunctionDeclaration(node: FunctionDeclarationNode): void {
    // console.log('record function decl', node.identifier?.name);
    if (!node.identifier) {
      return;
    }

    this.astFunctionParams.set(node.identifier.name, node.params);

    for (const param of node.params) {
      const typeName = this.getTypeReferenceName(param.typeAnnotation);
      if (!typeName) {
        continue;
      }
      const typeInfo = this.context.typeMap.get(typeName);
      if (typeInfo?.type === 'udt') {
        this.setTypeMapEntry(param.identifier.name, param.identifier, {
          type: 'udt',
          isConst: false,
          isSeries: false,
          udtName: typeInfo.udtName ?? typeName,
        });
      }
    }
  }

  private processVariableDeclaration(node: VariableDeclarationNode): void {
    const variableName = node.identifier.name;
    const typeName = this.getTypeReferenceName(node.typeAnnotation);

    if (node.initializer?.kind === 'ArrowFunctionExpression') {
      // console.log('record arrow', variableName);
      this.astFunctionParams.set(variableName, node.initializer.params);
    }

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

    if (this.isKnownNamespace(enumReference.enumName)) {
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

    if (typeName && !declaredEnum && !this.astEnumDeclarations.has(typeName)) {
      const { line, column } = node.identifier.loc.start;
      this.addError(line, column, `Type mismatch: expected ${typeName}, got ${enumReference.enumName}`, 'PSV6-ENUM-TYPE-MISMATCH');
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

    if (this.isUdtNamespace(reference.enumName)) {
      return;
    }

    if (this.isKnownNamespace(reference.enumName)) {
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
      if (typeInfo?.type === 'udt') {
        return null;
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

    if (this.isUdtNamespace(object.name)) {
      return null;
    }

    const objectType = this.context.typeMap.get(object.name)?.type;
    if (objectType === 'udt') {
      return null;
    }

    return { enumName: object.name, memberName: property.name, node: member };
  }

  private isUdtNamespace(name: string): boolean {
    const typeInfo = this.context.typeMap.get(name);
    if (typeInfo?.type === 'udt') {
      return true;
    }
    return false;
  }

  private isKnownNamespace(name: string): boolean {
    return KNOWN_NAMESPACES.has(name);
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
}
