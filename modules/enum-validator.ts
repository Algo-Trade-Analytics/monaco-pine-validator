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
  type BlockStatementNode,
  type ArrowFunctionExpressionNode,
} from '../core/ast/nodes';
import { visit } from '../core/ast/traversal';
import { getSourceLine } from '../core/ast/source-utils';

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
  'plot',
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
  'order',
  'text',
  'xloc',
  'yloc',
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

interface FallbackFunctionParamInfo {
  readonly name: string;
  readonly expectedEnum: string | null;
}

interface FallbackFunctionInfo {
  readonly params: FallbackFunctionParamInfo[];
  readonly bodyText: string;
}

interface FallbackCallArgInfo {
  readonly value: string;
  readonly startIndex: number;
}

export class EnumValidator implements ValidationModule {
  name = 'EnumValidator';
  priority = 85; // Run before ScopeValidator to register enum types
  
  private errors: Array<{ line: number; column: number; message: string; code: string }> = [];
  private warnings: Array<{ line: number; column: number; message: string; code: string }> = [];
  private info: Array<{ line: number; column: number; message: string; code: string }> = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;
  private astEnumDeclarations: Map<string, EnumAstInfo> = new Map();
  private astEnumVariables: Map<string, string> = new Map();
  private astFunctionParams: Map<string, ParameterNode[]> = new Map();
  private functionParamEnumHints: Map<string, Map<string, string>> = new Map();

  getDependencies(): string[] {
    return ['UDTValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    if (config.ast?.mode === 'disabled') {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: context.typeMap,
        scriptType: context.scriptType,
      };
    }

    this.astContext = isAstValidationContext(context) && context.ast ? context : null;

    const program = this.astContext?.ast ?? null;
    if (!program) {
      this.validateWithoutAstFallback();
      return {
        isValid: this.errors.length === 0,
        errors: this.errors.map((e) => ({ ...e, severity: 'error' as const })),
        warnings: this.warnings.map((w) => ({ ...w, severity: 'warning' as const })),
        info: this.info.map((i) => ({ ...i, severity: 'info' as const })),
        typeMap: context.typeMap,
        scriptType: context.scriptType,
      };
    }

    this.validateWithAst(program);

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
    this.functionParamEnumHints.clear();
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

    this.setTypeMapEntry(enumName, node.identifier, { type: 'enum', isConst: true, isSeries: false });
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

      this.setTypeMapEntry(`${enumName}.${memberName}`, member.identifier, { type: 'enum', isConst: true, isSeries: false });
      this.recordTypeUsage(`${enumName}.${memberName}`, member.identifier);
    }

    this.astEnumDeclarations.set(enumName, info);
  }

  private getLine(lineNumber: number): string {
    return getSourceLine(this.context, lineNumber);
  }

  private recordFunctionDeclaration(node: FunctionDeclarationNode): void {
    if (!node.identifier) {
      return;
    }

    const functionName = node.identifier.name;
    this.astFunctionParams.set(functionName, node.params);
    const enumHints = this.collectParameterEnumHints(node.params, node.body);
    if (enumHints.size > 0) {
      this.functionParamEnumHints.set(functionName, enumHints);
    }

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
      const initializer = node.initializer as ArrowFunctionExpressionNode;
      this.astFunctionParams.set(variableName, initializer.params);
      const enumHints = this.collectParameterEnumHints(initializer.params, initializer.body);
      if (enumHints.size > 0) {
        this.functionParamEnumHints.set(variableName, enumHints);
      }
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
      // Skip cases where the object is a regular variable property access
      // rather than an enum namespace. Enum declarations are tracked in
      // astEnumDeclarations so a missing entry combined with a known typeMap
      // entry indicates a non-enum reference that should not raise errors.
      if (this.context.typeMap.has(reference.enumName)) {
        return;
      }

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
    const hints = this.functionParamEnumHints.get(fnName);
    if ((!params || params.length === 0) && (!hints || hints.size === 0)) {
      return;
    }

    node.args.forEach((arg, index) => {
      const reference = this.getEnumMemberReference(arg.value);
      if (!reference) {
        return;
      }

      const paramNode = params ? params[index] : undefined;
      const declaredExpectation = this.resolveParameterEnum(paramNode);
      const hintedExpectation = paramNode ? hints?.get(paramNode.identifier.name) ?? null : null;
      const expected = declaredExpectation ?? hintedExpectation;
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

    const objectInfo = this.context.typeMap.get(object.name);
    if (objectInfo?.udtName) {
      return null;
    }
    const objectType = objectInfo?.type;
    if (objectType === 'udt') {
      return null;
    }
    
    // Check if this is a variable (loop iterator, parameter, local variable)
    // These should not be treated as enum references
    // But enum type names ARE in the symbol table, so we need to check if it's actually an enum
    const symbolInfo = this.context.symbolTable.get(object.name);
    if (symbolInfo && symbolInfo.declarations.length > 0) {
      // Check if this is an enum type (not a variable)
      const isEnumType = this.astEnumDeclarations.has(object.name) || objectInfo?.type === 'enum';
      if (!isEnumType) {
        // This is a variable, not an enum type
        return null;
      }
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

  private collectParameterEnumHints(
    params: ParameterNode[],
    body: BlockStatementNode | ExpressionNode | null,
  ): Map<string, string> {
    const hints = new Map<string, string>();
    if (!body || params.length === 0) {
      return hints;
    }

    const paramNames = new Set(params.map((param) => param.identifier.name));
    if (paramNames.size === 0) {
      return hints;
    }

    const recordHint = (paramName: string | null, enumName: string | null): void => {
      if (!paramName || !enumName || !paramNames.has(paramName) || hints.has(paramName)) {
        return;
      }
      hints.set(paramName, enumName);
    };

    visit(body as BlockStatementNode, {
      BinaryExpression: {
        enter: (path) => {
          const node = path.node as BinaryExpressionNode;
          if (node.operator !== '==' && node.operator !== '!=') {
            return;
          }

          const leftIdentifier = this.getIdentifierName(node.left);
          const rightIdentifier = this.getIdentifierName(node.right);
          const leftEnum = this.getEnumMemberReference(node.left);
          const rightEnum = this.getEnumMemberReference(node.right);

          if (leftIdentifier && rightEnum) {
            recordHint(leftIdentifier, rightEnum.enumName);
          }

          if (rightIdentifier && leftEnum) {
            recordHint(rightIdentifier, leftEnum.enumName);
          }
        },
      },
      SwitchStatement: {
        enter: (path) => {
          const node = path.node as SwitchStatementNode;
          const discriminantId = this.getIdentifierName(node.discriminant);
          if (!discriminantId || !paramNames.has(discriminantId)) {
            return;
          }

          for (const caseNode of node.cases) {
            if (!caseNode.test) {
              continue;
            }
            const enumType = this.resolveExpressionEnumType(caseNode.test);
            recordHint(discriminantId, enumType);
            if (hints.has(discriminantId)) {
              break;
            }
          }
        },
      },
    });

    return hints;
  }

  private validateWithoutAstFallback(): void {
    const source = this.context.sourceText ?? this.context.rawLines?.join('\n') ?? '';
    if (!source.trim()) {
      return;
    }

    const enumMap = this.extractEnumsFromSource(source);
    if (enumMap.size === 0) {
      return;
    }

    const functionMap = this.extractFunctionDefinitionsFromSource(source, enumMap);
    if (functionMap.size === 0) {
      return;
    }

    const lineOffsets = this.computeLineOffsets(source);

    for (const [fnName, info] of functionMap.entries()) {
      const calls = this.extractFunctionCallsFromSource(source, fnName);
      for (const call of calls) {
        call.args.forEach((arg, index) => {
          if (index >= info.params.length) {
            return;
          }

          const expectedEnum = info.params[index]?.expectedEnum;
          if (!expectedEnum) {
            return;
          }

          const reference = this.parseEnumReference(arg.value);
          if (!reference) {
            return;
          }

          if (reference.enumName === expectedEnum) {
            return;
          }

          const { line, column } = this.indexToPosition(lineOffsets, arg.startIndex);
          this.addError(
            line,
            column,
            `Function parameter type mismatch: expected ${expectedEnum}, got ${reference.enumName}`,
            'PSV6-ENUM-FUNCTION-TYPE-MISMATCH',
          );
        });
      }
    }
  }

  private extractEnumsFromSource(source: string): Map<string, Set<string>> {
    const enums = new Map<string, Set<string>>();
    const lines = source.split('\n');

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const match = /^\s*enum\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(line);
      if (!match) {
        continue;
      }

      const enumName = match[1];
      if (!enums.has(enumName)) {
        enums.set(enumName, new Set());
      }

      const members = enums.get(enumName)!;
      let memberIndex = index + 1;
      while (memberIndex < lines.length) {
        const memberLine = lines[memberIndex];
        if (!/^\s/.test(memberLine)) {
          break;
        }

        const stripped = memberLine.replace(/\/\/.*$/, '').trim();
        if (stripped.length === 0) {
          memberIndex++;
          continue;
        }

        const valueMatch = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(stripped);
        if (valueMatch) {
          members.add(valueMatch[1]);
          memberIndex++;
          continue;
        }

        // Stop scanning members when encountering non-identifier content
        break;
      }

      index = memberIndex - 1;
    }

    return enums;
  }

  private extractFunctionDefinitionsFromSource(
    source: string,
    enums: Map<string, Set<string>>,
  ): Map<string, FallbackFunctionInfo> {
    const functionMap = new Map<string, FallbackFunctionInfo>();
    const functionPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=>/g;
    const knownEnumNames = new Set(enums.keys());

    let match: RegExpExecArray | null;
    while ((match = functionPattern.exec(source))) {
      const functionName = match[1];
      const paramsSource = match[2] ?? '';
      const bodyStartIndex = match.index + match[0].length;
      const bodyInfo = this.extractArrowFunctionBody(source, bodyStartIndex);
      const params = this.parseParameterList(paramsSource, knownEnumNames, bodyInfo.text);

      functionMap.set(functionName, {
        params,
        bodyText: bodyInfo.text,
      });
    }

    return functionMap;
  }

  private extractArrowFunctionBody(source: string, startIndex: number): { text: string; endIndex: number } {
    if (startIndex >= source.length) {
      return { text: '', endIndex: source.length };
    }

    if (source[startIndex] !== '\n') {
      const lineEnd = source.indexOf('\n', startIndex);
      const endIndex = lineEnd === -1 ? source.length : lineEnd;
      return { text: source.slice(startIndex, endIndex).trimEnd(), endIndex };
    }

    let currentIndex = startIndex + 1;
    const bodyLines: string[] = [];
    while (currentIndex < source.length) {
      const nextNewline = source.indexOf('\n', currentIndex);
      const lineEnd = nextNewline === -1 ? source.length : nextNewline;
      const lineText = source.slice(currentIndex, lineEnd);

      if (lineText.trim().length === 0) {
        bodyLines.push(lineText);
        currentIndex = lineEnd + 1;
        continue;
      }

      if (!/^\s/.test(lineText)) {
        break;
      }

      bodyLines.push(lineText);
      currentIndex = lineEnd + 1;
    }

    return { text: bodyLines.join('\n'), endIndex: currentIndex };
  }

  private parseParameterList(
    paramsSource: string,
    knownEnums: Set<string>,
    bodyText: string,
  ): FallbackFunctionParamInfo[] {
    const segments = this.splitCommaSeparatedValues(paramsSource);
    const params: FallbackFunctionParamInfo[] = [];

    for (const segment of segments) {
      const raw = segment.value;
      if (!raw) {
        params.push({ name: '', expectedEnum: null });
        continue;
      }

      const assignmentIndex = raw.indexOf('=');
      const valuePart = assignmentIndex === -1 ? raw : raw.slice(0, assignmentIndex).trim();
      const tokens = valuePart.trim().split(/\s+/).filter(Boolean);
      let paramName = tokens.length > 0 ? tokens[tokens.length - 1] : valuePart.trim();

      if (!IDENTIFIER_PATTERN.test(paramName)) {
        paramName = paramName.replace(/[^A-Za-z0-9_]/g, '');
      }

      let expectedEnum: string | null = null;

      if (tokens.length > 1) {
        const potentialType = tokens[0];
        if (knownEnums.has(potentialType)) {
          expectedEnum = potentialType;
        }
      }

      if (!expectedEnum) {
        if (knownEnums.has(paramName)) {
          expectedEnum = paramName;
        } else {
          const capitalized = paramName.charAt(0).toUpperCase() + paramName.slice(1);
          if (knownEnums.has(capitalized)) {
            expectedEnum = capitalized;
          }
        }
      }

      if (!expectedEnum && bodyText) {
        expectedEnum = this.inferEnumFromBody(paramName, bodyText, knownEnums);
      }

      params.push({ name: paramName, expectedEnum });
    }

    return params;
  }

  private inferEnumFromBody(paramName: string, bodyText: string, knownEnums: Set<string>): string | null {
    if (!paramName) {
      return null;
    }

    const escapedParam = this.escapeForRegExp(paramName);
    const paramPattern = new RegExp(`\\b${escapedParam}\\b`);
    const lines = bodyText.split('\n');

    for (const enumName of knownEnums) {
      const escapedEnum = this.escapeForRegExp(enumName);
      const enumPattern = new RegExp(`\\b${escapedEnum}\\.`);

      for (const line of lines) {
        if (paramPattern.test(line) && enumPattern.test(line)) {
          return enumName;
        }
      }
    }

    return null;
  }

  private extractFunctionCallsFromSource(
    source: string,
    functionName: string,
  ): Array<{ args: FallbackCallArgInfo[] }> {
    const calls: Array<{ args: FallbackCallArgInfo[] }> = [];
    const escapedName = this.escapeForRegExp(functionName);
    const pattern = new RegExp(`\\b${escapedName}\\s*\\(`, 'g');

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source))) {
      let currentIndex = pattern.lastIndex;
      let depth = 1;

      while (currentIndex < source.length && depth > 0) {
        const char = source[currentIndex];
        if (char === "\"" || char === "'") {
          currentIndex = this.skipStringLiteral(source, currentIndex);
          continue;
        }
        if (char === '(') {
          depth++;
        } else if (char === ')') {
          depth--;
        }
        currentIndex++;
      }

      if (depth !== 0) {
        break;
      }

      const closeIndex = currentIndex - 1;
      const trailing = source.slice(closeIndex + 1, closeIndex + 3);
      if (trailing === '=>' || /^\s*=>/.test(source.slice(closeIndex + 1))) {
        pattern.lastIndex = closeIndex + 1;
        continue;
      }

      const args = this.splitArguments(source.slice(pattern.lastIndex, closeIndex), pattern.lastIndex);
      if (args.length > 0) {
        calls.push({ args });
      }

      pattern.lastIndex = closeIndex + 1;
    }

    return calls;
  }

  private splitArguments(segment: string, absoluteStart: number): FallbackCallArgInfo[] {
    return this.splitCommaSeparatedValues(segment, absoluteStart)
      .map(({ value, offset }) => ({ value, startIndex: offset }))
      .filter((entry) => entry.value.length > 0);
  }

  private splitCommaSeparatedValues(input: string, absoluteStart = 0): Array<{ value: string; offset: number }> {
    const result: Array<{ value: string; offset: number }> = [];
    let depth = 0;
    let segmentStart = 0;

    const pushSegment = (end: number): void => {
      let start = segmentStart;
      while (start < end && /\s/.test(input[start])) {
        start++;
      }
      let finish = end;
      while (finish > start && /\s/.test(input[finish - 1])) {
        finish--;
      }
      if (start >= finish) {
        return;
      }
      result.push({ value: input.slice(start, finish), offset: absoluteStart + start });
    };

    for (let index = 0; index < input.length; index++) {
      const char = input[index];
      if (char === "\"" || char === "'") {
        index = this.skipStringLiteral(input, index) - 1;
        continue;
      }
      if (char === '(' || char === '[' || char === '{') {
        depth++;
        continue;
      }
      if (char === ')' || char === ']' || char === '}') {
        if (depth > 0) {
          depth--;
        }
        continue;
      }
      if (char === ',' && depth === 0) {
        pushSegment(index);
        segmentStart = index + 1;
      }
    }

    pushSegment(input.length);
    return result;
  }

  private parseEnumReference(value: string): { enumName: string; memberName: string } | null {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)$/.exec(value.trim());
    if (!match) {
      return null;
    }
    return { enumName: match[1], memberName: match[2] };
  }

  private computeLineOffsets(source: string): number[] {
    const offsets: number[] = [0];
    for (let index = 0; index < source.length; index++) {
      if (source[index] === '\n') {
        offsets.push(index + 1);
      }
    }
    return offsets;
  }

  private indexToPosition(offsets: number[], index: number): { line: number; column: number } {
    let line = 0;
    for (let i = 0; i < offsets.length; i++) {
      if (offsets[i] <= index) {
        line = i;
      } else {
        break;
      }
    }
    const lineStart = offsets[line] ?? 0;
    return {
      line: line + 1,
      column: index - lineStart + 1,
    };
  }

  private skipStringLiteral(text: string, startIndex: number): number {
    const quote = text[startIndex];
    let index = startIndex + 1;
    while (index < text.length) {
      const char = text[index];
      if (char === '\\') {
        index += 2;
        continue;
      }
      if (char === quote) {
        return index + 1;
      }
      index++;
    }
    return text.length;
  }

  private escapeForRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
