import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidationError,
  type ValidationResult,
  type ValidatorConfig,
  type TypeInfo,
} from '../core/types';
import {
  type AssignmentStatementNode,
  type CallExpressionNode,
  type ExpressionNode,
  type FunctionDeclarationNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type ParameterNode,
  type ProgramNode,
  type TypeDeclarationNode,
  type TypeFieldNode,
  type TypeReferenceNode,
  type VariableDeclarationNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';

interface UDTInfo {
  name: string;
  fields: Array<{ name: string; type: string }>;
  methods: Array<{ name: string; line: number; hasThis: boolean; thisType?: string }>;
  line: number;
}

interface UDTDeclaration {
  name: string;
  line: number;
  fields: Array<{ name: string; type: string }>;
  methods: Array<{ name: string; line: number; hasThis: boolean; thisType?: string }>;
}

interface AstMethodMetadata {
  node: FunctionDeclarationNode;
  methodName: string;
  udtName: string | null;
  hasThis: boolean;
  thisParam: ParameterNode | null;
  thisTypeName: string | null;
  line: number;
  column: number;
}

type VariableTypeRecord =
  | { kind: 'udt'; name: string }
  | { kind: 'primitive'; name: string }
  | { kind: 'unknown'; name: string };

export class UDTValidator implements ValidationModule {
  name = 'UDTValidator';
  priority = 95; // High priority - must run before TypeInferenceValidator
  
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private astMethodMetadata: AstMethodMetadata[] = [];
  private astMethodMetadataMap: WeakMap<FunctionDeclarationNode, AstMethodMetadata> = new WeakMap();
  private udtTypes = new Map<string, UDTInfo>();
  private udtDeclarations: UDTDeclaration[] = [];
  private errorKeys = new Set<string>();
  private warningKeys = new Set<string>();
  private infoKeys = new Set<string>();
  private readonly allowedInstanceMethods = new Set([
    'push','pop','get','set','size','clear','reverse','sort','sort_indices','copy','slice','concat','fill','from','from_example',
    'indexof','lastindexof','includes','binary_search','binary_search_leftmost','binary_search_rightmost','range','remove','insert',
    'unshift','shift','first','last','max','min','median','mode','abs','sum','avg','stdev','variance','standardize','covariance',
    'percentile_linear_interpolation','percentile_nearest_rank','percentrank','some','every','delete'
  ]);

  getDependencies(): string[] {
    return ['SyntaxValidator', 'TypeValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;

    const astContext = this.getAstContext(config);
    if (astContext?.ast) {
      this.validateWithAst(astContext.ast);
    }

    this.validateWithText();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: context.typeMap ?? new Map(),
      scriptType: context.scriptType ?? null,
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astMethodMetadata = [];
    this.astMethodMetadataMap = new WeakMap();
    this.udtTypes.clear();
    this.udtDeclarations = [];
    this.errorKeys.clear();
    this.warningKeys.clear();
    this.infoKeys.clear();
  }

  private addError(line: number, column: number, message: string, code: string): void {
    const key = `${line}:${column}:${code}`;
    if (this.errorKeys.has(key)) {
      return;
    }
    this.errorKeys.add(key);
    this.errors.push({ line, column, message, code, severity: 'error' });
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    const key = `${line}:${column}:${code}`;
    if (this.warningKeys.has(key)) {
      return;
    }
    this.warningKeys.add(key);
    this.warnings.push({ line, column, message, code, severity: 'warning' });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    const key = `${line}:${column}:${code}`;
    if (this.infoKeys.has(key)) {
      return;
    }
    this.infoKeys.add(key);
    this.info.push({
      line,
      column,
      message,
      code,
      severity: 'info'
    });
  }

  private validateWithAst(program: ProgramNode): void {
    this.collectUdtDataFromAst(program);
    this.validateUDTDeclarations();
    this.validateMethodDeclarationsAst();
    this.validateMethodCallsAndFieldsAst(program);
  }

  private validateWithText(): void {
    const lines = this.getSourceLines();
    if (lines.length === 0) {
      return;
    }

    this.collectUdtDataFromText(lines);
  }

  private collectUdtDataFromAst(program: ProgramNode): void {
    this.udtDeclarations = [];
    this.udtTypes.clear();
    this.astMethodMetadata = [];
    this.astMethodMetadataMap = new WeakMap();

    visit(program, {
      TypeDeclaration: {
        enter: (path: NodePath<TypeDeclarationNode>) => {
          this.handleAstTypeDeclaration(path.node);
        },
      },
      FunctionDeclaration: {
        enter: (path: NodePath<FunctionDeclarationNode>) => {
          this.handleAstFunctionDeclaration(path.node);
        },
      },
    });
  }

  private collectUdtDataFromText(lines: string[]): void {
    interface TextTypeContext {
      name: string;
      indent: number;
      fields: Map<string, number>;
    }

    let currentType: TextTypeContext | null = null;

    const typeRegex = /^type\s+([A-Za-z_][A-Za-z0-9_]*)/;
    const methodRegex = /^method\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/;
    const fieldRegex = /^([A-Za-z_][A-Za-z0-9_<>,]*)\s+([A-Za-z_][A-Za-z0-9_]*)\b/;

    for (let index = 0; index < lines.length; index++) {
      const rawLine = lines[index];
      const withoutComment = this.stripInlineComment(rawLine);
      const trimmed = withoutComment.trim();
      if (!trimmed) {
        continue;
      }

      const indent = withoutComment.length - withoutComment.trimStart().length;

      const typeMatch = trimmed.match(typeRegex);
      if (typeMatch) {
        currentType = {
          name: typeMatch[1],
          indent,
          fields: new Map(),
        };
        continue;
      }

      if (currentType && indent <= currentType.indent && !trimmed.startsWith('method ')) {
        currentType = null;
      }

      const methodMatch = trimmed.match(methodRegex);
      if (methodMatch) {
        const methodName = methodMatch[1];
        const params = methodMatch[2] ?? '';
        const lineNumber = index + 1;
        const columnNumber = indent + 1;

        const thisMatch = params.match(/this\s*<\s*([A-Za-z_][A-Za-z0-9_]*)\s*>/);
        const thisType = thisMatch?.[1] ?? null;
        const expectedType = currentType?.name ?? null;

        if (!thisMatch || (expectedType && thisType !== expectedType)) {
          this.addError(lineNumber, columnNumber, `Method '${methodName}' must declare this parameter referencing its UDT type`, 'PSV6-METHOD-THIS');
          this.addError(lineNumber, columnNumber, `Method '${methodName}' is missing a valid this parameter`, 'PS016');
          this.addWarning(lineNumber, columnNumber, `Method '${methodName}' declared without explicit type context`, 'PSU03');
        }

        continue;
      }

      if (currentType) {
        const fieldMatch = trimmed.match(fieldRegex);
        if (fieldMatch) {
          const fieldName = fieldMatch[2];
          const existingLine = currentType.fields.get(fieldName);
          if (existingLine !== undefined) {
            this.addError(
              index + 1,
              indent + 1,
              `Duplicate field '${fieldName}' in type ${currentType.name}`,
              'PSV6-UDT-DUPLICATE-FIELD',
            );
          } else {
            currentType.fields.set(fieldName, index + 1);
          }
        }
      } else if (trimmed.startsWith('method ')) {
        const lineNumber = index + 1;
        const columnNumber = indent + 1;
        this.addError(lineNumber, columnNumber, 'Method declarations outside type blocks must include this<T> parameter', 'PSV6-METHOD-THIS');
        this.addError(lineNumber, columnNumber, 'Method declaration missing this parameter', 'PS016');
        this.addWarning(lineNumber, columnNumber, 'Method declared without UDT context', 'PSU03');
      }
    }
  }

  private getSourceLines(): string[] {
    if (Array.isArray(this.context.cleanLines) && this.context.cleanLines.length > 0) {
      return [...this.context.cleanLines];
    }
    if (Array.isArray(this.context.lines) && this.context.lines.length > 0) {
      return [...this.context.lines];
    }
    if (Array.isArray(this.context.rawLines) && this.context.rawLines.length > 0) {
      return [...this.context.rawLines];
    }
    return [];
  }

  private stripInlineComment(line: string): string {
    const idx = line.indexOf('//');
    return idx >= 0 ? line.slice(0, idx) : line;
  }

  private handleAstTypeDeclaration(node: TypeDeclarationNode): void {
    const udtName = node.identifier.name;
    const fields: Array<{ name: string; type: string }> = [];

    for (const field of node.fields) {
      const fieldName = field.identifier.name;
      const typeString = field.typeAnnotation ? this.stringifyAstTypeReference(field.typeAnnotation) : 'unknown';
      fields.push({ name: fieldName, type: typeString });

      const parsedType = this.parseFieldType(typeString);
      const typeInfo: TypeInfo = {
        type: parsedType.baseType,
        isConst: false,
        isSeries: parsedType.baseType === 'series',
        declaredAt: { line: field.loc.start.line, column: field.loc.start.column },
        usages: [],
      };

      if (parsedType.elementType) {
        typeInfo.elementType = parsedType.elementType;
      }
      if (parsedType.udtName) {
        typeInfo.udtName = parsedType.udtName;
      }

      this.context.typeMap.set(`${udtName}.${fieldName}`, typeInfo);
    }

    const declaration: UDTDeclaration = {
      name: udtName,
      line: node.loc.start.line,
      fields: [...fields],
      methods: [],
    };
    this.udtDeclarations.push(declaration);

    const existing = this.udtTypes.get(udtName);
    const methods = existing?.methods ?? [];
    const info: UDTInfo = {
      name: udtName,
      fields: [...fields],
      methods,
      line: node.loc.start.line,
    };
    this.udtTypes.set(udtName, info);

    this.context.typeMap.set(udtName, {
      type: 'udt',
      isConst: false,
      isSeries: false,
      declaredAt: { line: node.loc.start.line, column: node.loc.start.column },
      usages: [],
    });

    if (this.context.usedVars) {
      this.context.usedVars.add(udtName);
    }
  }

  private handleAstFunctionDeclaration(node: FunctionDeclarationNode): void {
    if (!node.identifier) {
      return;
    }

    const fullName = node.identifier.name;
    const firstParam = node.params[0] ?? null;
    const hasThis = Boolean(firstParam && firstParam.identifier.name === 'this');
    const isMethodCandidate = fullName.includes('.') || hasThis;

    if (!isMethodCandidate) {
      return;
    }

    const methodName = fullName.includes('.') ? fullName.split('.').pop() ?? fullName : fullName;
    let udtName: string | null = null;

    if (fullName.includes('.')) {
      const [maybeType] = fullName.split('.');
      if (maybeType) {
        udtName = maybeType;
      }
    }

    let thisTypeName: string | null = null;
    if (firstParam?.typeAnnotation) {
      const parsed = this.parseFieldType(this.stringifyAstTypeReference(firstParam.typeAnnotation));
      if (parsed.baseType === 'udt' && parsed.udtName) {
        thisTypeName = parsed.udtName;
      } else if (parsed.baseType !== 'unknown') {
        thisTypeName = parsed.baseType;
      }
    }

    if (!udtName && thisTypeName && this.udtTypes.has(thisTypeName)) {
      udtName = thisTypeName;
    }

    const metadata: AstMethodMetadata = {
      node,
      methodName,
      udtName,
      hasThis,
      thisParam: firstParam ?? null,
      thisTypeName,
      line: node.loc.start.line,
      column: node.loc.start.column,
    };

    this.astMethodMetadata.push(metadata);
    this.astMethodMetadataMap.set(node, metadata);

    if (udtName) {
      const udtInfo = this.udtTypes.get(udtName) ?? {
        name: udtName,
        fields: [],
        methods: [],
        line: node.loc.start.line,
      };

      udtInfo.methods.push({ name: methodName, line: node.loc.start.line, hasThis, thisType: thisTypeName ?? undefined });
      this.udtTypes.set(udtName, udtInfo);
    }
  }

  private validateMethodDeclarationsAst(): void {
    for (const metadata of this.astMethodMetadata) {
      if (!metadata.hasThis) {
        this.addError(
          metadata.line,
          metadata.column,
          `Method '${metadata.methodName}' must have 'this' as first parameter`,
          'PSV6-METHOD-THIS',
        );
        continue;
      }

      if (!metadata.thisParam?.typeAnnotation) {
        this.addInfo(
          metadata.line,
          metadata.column,
          "Consider adding type annotation to 'this' parameter",
          'PSV6-METHOD-TYPE',
        );
      }
    }
  }

  private validateMethodCallsAndFieldsAst(program: ProgramNode): void {
    const scopeStack: Array<Map<string, VariableTypeRecord>> = [new Map()];

    visit(program, {
      FunctionDeclaration: {
        enter: (path: NodePath<FunctionDeclarationNode>) => {
          scopeStack.push(new Map());
          const metadata = this.astMethodMetadataMap.get(path.node) ?? null;

          if (metadata?.hasThis) {
            const udtName = metadata.thisTypeName ?? metadata.udtName;
            if (udtName) {
              this.assignVariableType('this', { kind: 'udt', name: udtName }, scopeStack);
            } else {
              this.assignVariableType('this', { kind: 'unknown', name: 'this' }, scopeStack);
            }
          }

          for (const param of path.node.params) {
            if (param.identifier.name === 'this') {
              continue;
            }
            const paramType = this.interpretTypeReference(param.typeAnnotation);
            if (paramType) {
              this.assignVariableType(param.identifier.name, paramType, scopeStack);
            }
          }
        },
        exit: () => {
          scopeStack.pop();
        },
      },
      BlockStatement: {
        enter: () => {
          scopeStack.push(new Map());
        },
        exit: () => {
          scopeStack.pop();
        },
      },
      VariableDeclaration: {
        enter: (path: NodePath<VariableDeclarationNode>) => {
          this.recordAstVariableDeclaration(path.node, scopeStack);
        },
      },
      AssignmentStatement: {
        enter: (path: NodePath<AssignmentStatementNode>) => {
          this.recordAstAssignment(path.node, scopeStack);
        },
      },
      CallExpression: {
        enter: (path: NodePath<CallExpressionNode>) => {
          this.validateAstMethodCall(path.node, scopeStack);
        },
      },
      MemberExpression: {
        enter: (path: NodePath<MemberExpressionNode>) => {
          this.validateAstFieldAccess(path, scopeStack);
        },
      },
    });
  }

  private recordAstVariableDeclaration(
    node: VariableDeclarationNode,
    scopeStack: Array<Map<string, VariableTypeRecord>>,
  ): void {
    const name = node.identifier.name;
    const location = { line: node.identifier.loc.start.line, column: node.identifier.loc.start.column };
    const isConst = node.declarationKind === 'const';

    const annotationType = this.interpretTypeReference(node.typeAnnotation);
    if (annotationType) {
      this.assignVariableType(name, annotationType, scopeStack);
      this.storeVariableType(name, location, annotationType, isConst);
    }

    if (node.initializer) {
      const initializerType = this.inferAstExpressionVariableType(node.initializer, scopeStack);
      if (initializerType) {
        this.assignVariableType(name, initializerType, scopeStack);
        this.storeVariableType(name, location, initializerType, isConst);
      }
    }
  }

  private recordAstAssignment(
    node: AssignmentStatementNode,
    scopeStack: Array<Map<string, VariableTypeRecord>>,
  ): void {
    if (node.left.kind !== 'Identifier' || !node.right) {
      return;
    }

    const identifier = node.left as IdentifierNode;
    const inferredType = this.inferAstExpressionVariableType(node.right, scopeStack);
    if (!inferredType) {
      return;
    }

    this.assignVariableType(identifier.name, inferredType, scopeStack);
    const loc = { line: identifier.loc.start.line, column: identifier.loc.start.column };
    this.storeVariableType(identifier.name, loc, inferredType, false);
  }

  private validateAstMethodCall(
    node: CallExpressionNode,
    scopeStack: Array<Map<string, VariableTypeRecord>>,
  ): void {
    if (node.callee.kind !== 'MemberExpression') {
      return;
    }

    const member = node.callee as MemberExpressionNode;
    if (member.computed || member.object.kind !== 'Identifier') {
      return;
    }

    const objectIdentifier = member.object as IdentifierNode;
    const objectName = objectIdentifier.name;
    if (objectName === 'this') {
      return;
    }

    const methodName = member.property.name;
    if (this.allowedInstanceMethods.has(methodName)) {
      return;
    }

    const objectType = this.resolveVariableType(objectName, scopeStack);
    if (!objectType || objectType.kind === 'udt' || objectType.kind === 'unknown') {
      return;
    }

    const line = member.property.loc.start.line;
    const column = member.property.loc.start.column;
    this.addWarning(
      line,
      column,
      `Method '${methodName}' called on primitive type variable '${objectName}'`,
      'PSV6-METHOD-INVALID',
    );
  }

  private validateAstFieldAccess(
    path: NodePath<MemberExpressionNode>,
    scopeStack: Array<Map<string, VariableTypeRecord>>,
  ): void {
    const node = path.node;
    if (node.computed) {
      return;
    }

    const parent = path.parent;
    if (parent && parent.node.kind === 'CallExpression' && parent.key === 'callee') {
      return;
    }

    if (node.object.kind !== 'Identifier') {
      return;
    }

    const objectIdentifier = node.object as IdentifierNode;
    const objectName = objectIdentifier.name;
    const objectType = this.resolveVariableType(objectName, scopeStack);
    if (!objectType || objectType.kind !== 'udt') {
      return;
    }

    const udtInfo = this.udtTypes.get(objectType.name);
    if (!udtInfo) {
      return;
    }

    const fieldName = node.property.name;
    const field = udtInfo.fields.find((entry) => entry.name === fieldName);
    const line = node.property.loc.start.line;
    const column = node.property.loc.start.column;

    if (!field) {
      this.addError(line, column, `Field '${fieldName}' does not exist in UDT '${objectType.name}'`, 'PSV6-UDT-FIELD-NOT-FOUND');
      return;
    }

    const parsedType = this.parseFieldType(field.type);
    const typeInfo: TypeInfo = {
      type: parsedType.baseType,
      isConst: false,
      isSeries: parsedType.baseType === 'series',
      declaredAt: { line, column },
      usages: [],
    };

    if (parsedType.elementType) {
      typeInfo.elementType = parsedType.elementType;
    }
    if (parsedType.udtName) {
      typeInfo.udtName = parsedType.udtName;
    }

    this.context.typeMap.set(`${objectName}.${fieldName}`, typeInfo);
  }

  private assignVariableType(
    name: string,
    type: VariableTypeRecord,
    scopeStack: Array<Map<string, VariableTypeRecord>>,
  ): void {
    if (!scopeStack.length) {
      return;
    }
    scopeStack[scopeStack.length - 1].set(name, type);
  }

  private storeVariableType(
    name: string,
    location: { line: number; column: number },
    record: VariableTypeRecord,
    isConst: boolean,
  ): void {
    const existing = this.context.typeMap.get(name);
    const declaredAt = existing?.declaredAt ?? location;
    const usages = existing?.usages ?? [];

    const info: TypeInfo = {
      type: this.mapVariableRecordToType(record),
      isConst: existing?.isConst ?? isConst,
      isSeries:
        existing?.isSeries ??
        (record.kind === 'primitive' && (record.name === 'series' || record.name === 'series float' || record.name === 'series int')),
      declaredAt,
      usages,
    };

    if (record.kind === 'udt') {
      info.udtName = record.name;
    } else if (existing?.udtName) {
      info.udtName = existing.udtName;
    }

    if (existing?.elementType) {
      info.elementType = existing.elementType;
    }
    if (existing?.keyType) {
      info.keyType = existing.keyType;
    }
    if (existing?.valueType) {
      info.valueType = existing.valueType;
    }
    if (existing?.enumType) {
      info.enumType = existing.enumType;
    }

    this.context.typeMap.set(name, info);
  }

  private mapVariableRecordToType(record: VariableTypeRecord): TypeInfo['type'] {
    if (record.kind === 'udt') {
      return 'udt';
    }
    if (record.kind === 'primitive') {
      const primitive = record.name.toLowerCase();
      switch (primitive) {
        case 'int':
        case 'float':
        case 'bool':
        case 'string':
        case 'color':
        case 'series':
        case 'line':
        case 'label':
        case 'box':
        case 'table':
        case 'linefill':
        case 'polyline':
        case 'chart.point':
        case 'array':
        case 'matrix':
        case 'map':
          return primitive as TypeInfo['type'];
        default:
          return 'unknown';
      }
    }
    return 'unknown';
  }

  private resolveVariableType(
    name: string,
    scopeStack: Array<Map<string, VariableTypeRecord>>,
  ): VariableTypeRecord | null {
    for (let index = scopeStack.length - 1; index >= 0; index--) {
      const scope = scopeStack[index];
      if (scope.has(name)) {
        return scope.get(name)!;
      }
    }

    return null;
  }

  private interpretTypeReference(type: TypeReferenceNode | null): VariableTypeRecord | null {
    if (!type) {
      return null;
    }

    const typeString = this.stringifyAstTypeReference(type);
    const parsed = this.parseFieldType(typeString);

    if (parsed.baseType === 'udt') {
      const name = parsed.udtName ?? typeString;
      return { kind: 'udt', name };
    }

    if (parsed.baseType === 'unknown') {
      return { kind: 'unknown', name: 'unknown' };
    }

    return { kind: 'primitive', name: parsed.baseType };
  }

  private inferAstExpressionVariableType(
    expression: ExpressionNode,
    scopeStack: Array<Map<string, VariableTypeRecord>>,
  ): VariableTypeRecord | null {
    switch (expression.kind) {
      case 'Identifier': {
        const identifier = expression as IdentifierNode;
        return this.resolveVariableType(identifier.name, scopeStack);
      }
      case 'CallExpression': {
        const call = expression as CallExpressionNode;
        if (call.callee.kind === 'MemberExpression') {
          const member = call.callee as MemberExpressionNode;
          if (!member.computed) {
            if (member.object.kind === 'Identifier' && member.property.name === 'new') {
              return { kind: 'udt', name: (member.object as IdentifierNode).name };
            }

            if (member.object.kind === 'Identifier') {
              const objectType = this.resolveVariableType((member.object as IdentifierNode).name, scopeStack);
              if (objectType?.kind === 'udt') {
                const udtInfo = this.udtTypes.get(objectType.name);
                const field = udtInfo?.fields.find((entry) => entry.name === member.property.name);
                if (field) {
                  const parsed = this.parseFieldType(field.type);
                  if (parsed.baseType === 'udt' && parsed.udtName) {
                    return { kind: 'udt', name: parsed.udtName };
                  }
                  if (parsed.baseType !== 'unknown') {
                    return { kind: 'primitive', name: parsed.baseType };
                  }
                }
              }
            }
          }
        } else if (call.callee.kind === 'Identifier') {
          const callee = call.callee as IdentifierNode;
          if (callee.name.includes('.')) {
            const [maybeType, property] = callee.name.split('.');
            if (property === 'new' && maybeType) {
              return { kind: 'udt', name: maybeType };
            }
          }
        }
        return null;
      }
      case 'MemberExpression': {
        const member = expression as MemberExpressionNode;
        if (member.computed || member.object.kind !== 'Identifier') {
          return null;
        }

        const objectType = this.resolveVariableType((member.object as IdentifierNode).name, scopeStack);
        if (objectType?.kind !== 'udt') {
          return null;
        }

        const udtInfo = this.udtTypes.get(objectType.name);
        const field = udtInfo?.fields.find((entry) => entry.name === member.property.name);
        if (!field) {
          return null;
        }

        const parsed = this.parseFieldType(field.type);
        if (parsed.baseType === 'udt' && parsed.udtName) {
          return { kind: 'udt', name: parsed.udtName };
        }
        if (parsed.baseType !== 'unknown') {
          return { kind: 'primitive', name: parsed.baseType };
        }
        return null;
      }
      default:
        return null;
    }
  }

  private stringifyAstTypeReference(type: TypeReferenceNode): string {
    const base = type.name.name;
    if (!type.generics.length) {
      return base;
    }

    const generics = type.generics.map((generic) => this.stringifyAstTypeReference(generic));
    return `${base}<${generics.join(', ')}>`;
  }

  private validateUDTDeclarations(): void {
    // Check for duplicate UDT names
    const udtNames = new Map<string, number[]>();
    
    // Collect all UDT names and their line numbers
    for (const declaration of this.udtDeclarations) {
      if (!udtNames.has(declaration.name)) {
        udtNames.set(declaration.name, []);
      }
      udtNames.get(declaration.name)!.push(declaration.line);
    }
    
    // Check for duplicates
    for (const [udtName, lines] of udtNames.entries()) {
      if (lines.length > 1) {
        // Report error for all duplicate declarations except the first one
        for (let i = 1; i < lines.length; i++) {
          this.addError(lines[i], 1, 
            `Duplicate UDT name '${udtName}' (first declared at line ${lines[0]})`, 
            'PSV6-UDT-DUPLICATE');
        }
      }
    }
    
    // Check for empty UDTs
    for (const [udtName, udtInfo] of this.udtTypes.entries()) {
      if (udtInfo.fields.length === 0 && udtInfo.methods.length === 0) {
        this.addWarning(udtInfo.line, 1, 
          `UDT '${udtName}' has no fields or methods`, 
          'PSV6-UDT-EMPTY');
      }
    }
  }

  private parseFieldType(type: string): { baseType: TypeInfo['type']; elementType?: string; udtName?: string } {
    const trimmed = type.trim();

    if (trimmed.startsWith('array<') && trimmed.endsWith('>')) {
      const inner = this.extractGenericInner(trimmed);
      return { baseType: 'array', elementType: inner };
    }

    if (trimmed.startsWith('map<') && trimmed.endsWith('>')) {
      const inner = this.extractGenericInner(trimmed);
      const [keyType, valueType] = this.splitGenericParameters(inner);
      return { baseType: 'map', elementType: (valueType ?? 'unknown').trim() };
    }

    if (trimmed.startsWith('matrix<') && trimmed.endsWith('>')) {
      const inner = this.extractGenericInner(trimmed);
      return { baseType: 'matrix', elementType: inner };
    }

    const primitiveTypes: Array<TypeInfo['type']> = [
      'int','float','bool','string','color','series','line','label','box','table','linefill','polyline','chart.point','array','matrix','map','udt','unknown'
    ];

    if (primitiveTypes.includes(trimmed as TypeInfo['type'])) {
      return { baseType: trimmed as TypeInfo['type'] };
    }

    return { baseType: 'udt', udtName: trimmed };
  }

  private extractGenericInner(type: string): string {
    const start = type.indexOf('<');
    const end = type.lastIndexOf('>');
    if (start === -1 || end === -1 || end <= start) {
      return type;
    }
    return type.substring(start + 1, end).trim();
  }

  private splitGenericParameters(inner: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i];
      if (ch === '<') {
        depth++;
        current += ch;
        continue;
      }
      if (ch === '>') {
        depth--;
        current += ch;
        continue;
      }
      if (ch === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }

    return isAstValidationContext(this.context) && this.context.ast ? (this.context as AstValidationContext) : null;
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
