/**
 * Map Functions Validator
 *
 * Validates Pine Script v6 Map functions and operations:
 * - Map declaration syntax validation
 * - Map operations (get, put, remove, size, clear, keys, values, contains, copy)
 * - Map type safety and consistency
 * - Map performance analysis
 * - Map best practices suggestions
 *
 * Priority 1.1: CRITICAL GAPS - Map Functions (0% Coverage)
 */

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
  type ArgumentNode,
  type AssignmentStatementNode,
  type BooleanLiteralNode,
  type CallExpressionNode,
  type ExpressionNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type NullLiteralNode,
  type NumberLiteralNode,
  type ProgramNode,
  type StringLiteralNode,
  type TypeReferenceNode,
  type UnaryExpressionNode,
  type VariableDeclarationNode,
  type ForStatementNode,
  type WhileStatementNode,
  type RepeatStatementNode,
} from '../core/ast/nodes';
import { findAncestor, visit, type NodePath } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';

interface MapDeclarationInfo {
  name: string;
  keyType: string;
  valueType: string;
  line: number;
  column: number;
  isInitialized: boolean;
}

interface MapUsageInfo {
  puts: number[];
  clears: number[];
}

const MAP_LOOP_METHODS = new Set([
  'map.put',
  'map.get',
  'map.remove',
  'map.contains',
  'map.includes',
  'map.clear',
  'map.size',
  'map.keys',
  'map.values',
  'map.copy',
]);

export class MapValidator implements ValidationModule {
  name = 'MapValidator';
  priority = 92; // Run before TypeInferenceValidator so map value types are available for inference

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private astContext: AstValidationContext | null = null;

  // Map tracking
  private mapDeclarations = new Map<string, MapDeclarationInfo>();
  private mapOperations = new Map<string, number>();
  private mapAllocations = 0;
  private mapUsage = new Map<string, MapUsageInfo>();
  private reportedLoopWarnings = new Set<object>();
  private errorKeys = new Set<string>();
  private warningKeys = new Set<string>();
  private infoKeys = new Set<string>();

  getDependencies(): string[] {
    return ['TypeValidator', 'ScopeValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.astContext = this.getAstContext(context, config);

    const ast = this.astContext?.ast;
    if (!ast) {
      this.collectMapDataText();
      this.validateMapPerformanceAst();
      this.validateMapBestPracticesAst();
      return this.buildModuleResult(context.scriptType);
    }

    this.collectMapDataAst(ast);

    if (process.env.DEBUG_MAP_VALIDATOR === '1') {
      const declarationSnapshot = Array.from(this.mapDeclarations.entries()).map(([name, info]) => ({
        name,
        keyType: info.keyType,
        valueType: info.valueType,
        isInitialized: info.isInitialized,
      }));
      console.log('[MapValidator] debug snapshot', {
        declarations: declarationSnapshot,
        operations: Array.from(this.mapOperations.entries()),
        errors: this.errors,
        warnings: this.warnings,
      });
    }

    this.validateMapPerformanceAst();
    this.validateMapBestPracticesAst();

    return this.buildModuleResult(context.scriptType);
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.mapDeclarations.clear();
    this.mapOperations.clear();
    this.mapAllocations = 0;
    this.mapUsage.clear();
    this.reportedLoopWarnings.clear();
    this.errorKeys.clear();
    this.warningKeys.clear();
    this.infoKeys.clear();
    this.astContext = null;
  }

  private collectMapDataAst(program: ProgramNode): void {
    const loopStack: NodePath[] = [];

    visit(program, {
      ForStatement: {
        enter: (path) => {
          loopStack.push(path);
        },
        exit: () => {
          loopStack.pop();
        },
      },
      WhileStatement: {
        enter: (path) => {
          loopStack.push(path);
        },
        exit: () => {
          loopStack.pop();
        },
      },
      RepeatStatement: {
        enter: (path) => {
          loopStack.push(path);
        },
        exit: () => {
          loopStack.pop();
        },
      },
      CallExpression: {
        enter: (path) => {
          const callPath = path as NodePath<CallExpressionNode>;
          const call = callPath.node;
          const qualifiedName = this.getExpressionQualifiedName(call.callee);
          if (!qualifiedName) {
            return;
          }

          if (qualifiedName === 'map.new') {
            const target = this.extractMapAssignmentTarget(callPath);
            if (!target) {
              return;
            }

            const genericsCount = call.typeArguments.length;
            if (genericsCount !== 1) {
              const message = genericsCount === 0
                ? 'map.new<valueType>() requires a value type parameter'
                : 'map.new<valueType>() accepts exactly one type parameter';
              this.addError(
                call.loc.start.line,
                call.loc.start.column,
                message,
                'PSV6-MAP-DECLARATION',
                'Provide a single value type to map.new<valueType>()',
              );
            }

            const callTypes = this.inferMapTypesFromCall(call);
            const targetKeyType = target.annotationKeyType ?? null;
            const targetValueType = target.annotationValueType ?? null;
            const keyType = this.normalizeKeyType(callTypes.keyType ?? targetKeyType);
            const valueType = this.normalizeValueType(callTypes.valueType ?? targetValueType);

            this.mapDeclarations.set(target.name, {
              name: target.name,
              keyType,
              valueType,
              line: target.line,
              column: target.column,
              isInitialized: false,
            });
            this.mapAllocations += 1;
            this.setVariableType(target.name, target.line, target.column, {
              type: 'map',
              keyType,
              valueType,
            });
            return;
          }

          if (!qualifiedName.startsWith('map.')) {
            return;
          }

          const loopMultiplier = this.computeLoopMultiplier(loopStack);

          if (qualifiedName === 'map.put') {
            this.handleMapPutAst(callPath, loopMultiplier);
          } else if (
            qualifiedName === 'map.get' ||
            qualifiedName === 'map.remove' ||
            qualifiedName === 'map.contains' ||
            qualifiedName === 'map.includes'
          ) {
            this.handleMapLookupAst(callPath, qualifiedName, loopMultiplier);
          } else if (
            qualifiedName === 'map.clear' ||
            qualifiedName === 'map.size' ||
            qualifiedName === 'map.keys' ||
            qualifiedName === 'map.values' ||
            qualifiedName === 'map.copy'
          ) {
            this.handleMapUtilityAst(callPath, qualifiedName, loopMultiplier);
          }

          if (loopStack.length > 0 && MAP_LOOP_METHODS.has(qualifiedName)) {
            const loopNode = loopStack[loopStack.length - 1]?.node;
            if (loopNode && !this.reportedLoopWarnings.has(loopNode)) {
              this.reportedLoopWarnings.add(loopNode);
              this.addWarning(
                call.loc.start.line,
                call.loc.start.column,
                'Map operations detected inside loop. Consider optimization.',
                'PSV6-MAP-PERF-LOOP',
                'Consider caching map operations or moving them outside the loop for better performance',
              );
            }
          }
        },
      },
    });
  }

  private collectMapDataText(_mergeOnly = false): void {
    // Limited textual fallback for scenarios where Chevrotain parsing fails (e.g. type annotations).
    const lines = Array.isArray(this.context.cleanLines) ? this.context.cleanLines : [];
    if (lines.length === 0) {
      return;
    }

    const declarationPattern = /^(?:var\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*map<([^>]+)>)?\s*=\s*map\.new<([^>]*)>/i;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const commentIndex = rawLine.indexOf('//');
      const line = (commentIndex >= 0 ? rawLine.slice(0, commentIndex) : rawLine).trim();
      if (!line) {
        continue;
      }

      const match = line.match(declarationPattern);
      if (!match) {
        continue;
      }

      const [, name, annotationRaw, callRaw] = match;
      const lineNumber = i + 1;
      const column = rawLine.indexOf(name) + 1;

      const annotationTypes = this.parseAnnotationTypes(annotationRaw);
      const callTypes = this.parseMapNewGenericsText(callRaw);

      if (callTypes.error) {
        this.addError(
          lineNumber,
          column,
          callTypes.error,
          'PSV6-MAP-DECLARATION',
          'Provide a single value type to map.new<valueType>()',
        );
      }

      const keyType = this.normalizeKeyType(callTypes.keyType ?? annotationTypes.keyType);
      const valueType = this.normalizeValueType(callTypes.valueType ?? annotationTypes.valueType);

      if (
        annotationTypes.valueType &&
        valueType !== 'unknown' &&
        annotationTypes.valueType !== valueType
      ) {
        this.addError(
          lineNumber,
          column,
          `Type annotation map<${annotationTypes.valueType}> does not match map.new<${valueType}>`,
          'PSV6-MAP-TYPE-MISMATCH',
          'Ensure map annotation matches map.new type parameter',
        );
      }

      this.mapDeclarations.set(name, {
        name,
        keyType,
        valueType,
        line: lineNumber,
        column,
        isInitialized: false,
      });
      this.mapAllocations += 1;
      this.setVariableType(name, lineNumber, column, {
        type: 'map',
        keyType,
        valueType,
      });
    }
  }

  private parseAnnotationTypes(raw: string | undefined | null): { keyType: string | null; valueType: string | null } {
    if (!raw) {
      return { keyType: null, valueType: null };
    }

    const tokens = this.splitTopLevelCsv(raw.trim());
    if (tokens.length === 0) {
      return { keyType: null, valueType: null };
    }

    if (tokens.length === 1) {
      return { keyType: 'string', valueType: tokens[0] ?? null };
    }

    return {
      keyType: tokens[0] ?? null,
      valueType: tokens[tokens.length - 1] ?? null,
    };
  }

  private parseMapNewGenericsText(raw: string | undefined | null): { keyType?: string; valueType?: string; error?: string } {
    const content = (raw ?? '').trim();
    if (!content) {
      return { error: 'map.new<valueType>() requires a value type parameter' };
    }

    const tokens = this.splitTopLevelCsv(content);
    if (tokens.length > 1) {
      return {
        valueType: tokens[tokens.length - 1],
        error: 'map.new<valueType>() accepts exactly one type parameter',
      };
    }

    return {
      valueType: tokens[0],
    };
  }

  private handleMapPutAst(path: NodePath<CallExpressionNode>, loopMultiplier: number): void {
    const call = path.node;
    if (call.args.length < 1) {
      this.addError(
        call.loc.start.line,
        call.loc.start.column,
        'map.put() requires map, key, and value parameters',
        'PSV6-MAP-METHOD-PARAMS',
      );
      return;
    }

    const mapName = this.extractIdentifierName(call.args[0]);
    if (!mapName) {
      return;
    }

    this.trackMapOperation(mapName, call.loc.start.line, false, loopMultiplier);

    const mapInfo = this.mapDeclarations.get(mapName);
    if (!mapInfo) {
      if (this.isKnownNonMapVariable(mapName)) {
        this.addError(
          call.loc.start.line,
          call.loc.start.column,
          `map.put() called on non-map variable '${mapName}'`,
          'PSV6-MAP-OPERATION-NON-MAP',
          'Use a map variable: map.put(myMap, ...)',
        );
      }
      return;
    }

    if (call.args.length < 3) {
      this.addError(
        call.loc.start.line,
        call.loc.start.column,
        'map.put() requires map, key, and value parameters',
        'PSV6-MAP-METHOD-PARAMS',
        'Provide map identifier, key, and value: map.put(myMap, key, value)',
      );
      return;
    }

    const valueType = this.inferExpressionValueType(call.args[2].value);
    if (!this.areValueTypesCompatible(mapInfo.valueType, valueType)) {
      this.addError(
        call.loc.start.line,
        call.loc.start.column,
        `Type mismatch: trying to put '${valueType}' value into 'map<${mapInfo.valueType}>'`,
        'PSV6-MAP-VALUE-TYPE-MISMATCH',
        `Use '${mapInfo.valueType}' value or change map type`,
      );
    }

    mapInfo.isInitialized = true;
    this.recordMapUsage(mapName, 'put', call.loc.start.line);

    if (mapInfo.valueType === 'unknown' && valueType !== 'unknown') {
      mapInfo.valueType = valueType;
    }

    const assignmentTarget = this.findAssignmentTarget(path);
    if (assignmentTarget && valueType.startsWith('map<')) {
      const nestedValueType = this.unwrapMapValueType(valueType) ?? 'unknown';
      this.mapDeclarations.set(assignmentTarget.name, {
        name: assignmentTarget.name,
        keyType: 'string',
        valueType: nestedValueType,
        line: assignmentTarget.line,
        column: assignmentTarget.column,
        isInitialized: true,
      });
      this.setVariableType(assignmentTarget.name, assignmentTarget.line, assignmentTarget.column, {
        type: 'map',
        keyType: 'string',
        valueType: nestedValueType,
      });
    }
  }

  private handleMapLookupAst(
    path: NodePath<CallExpressionNode>,
    qualifiedName: string,
    loopMultiplier: number,
  ): void {
    const call = path.node;
    if (call.args.length < 1) {
      this.addError(
        call.loc.start.line,
        call.loc.start.column,
        `${qualifiedName}() requires a map parameter`,
        'PSV6-MAP-METHOD-PARAMS',
      );
      return;
    }

    const mapName = this.extractIdentifierName(call.args[0]);
    if (!mapName) {
      return;
    }

    this.trackMapOperation(mapName, call.loc.start.line, qualifiedName === 'map.clear', loopMultiplier);

    if (!this.mapDeclarations.has(mapName) && this.isKnownNonMapVariable(mapName)) {
      this.addError(
        call.loc.start.line,
        call.loc.start.column,
        `${qualifiedName}() called on non-map variable '${mapName}'`,
        'PSV6-MAP-OPERATION-NON-MAP',
        `Use a map variable: ${qualifiedName}(myMap, ...)`,
      );
      return;
    }

    if (qualifiedName === 'map.get') {
      this.handleMapGetResult(path, mapName);
    } else if (qualifiedName === 'map.contains' || qualifiedName === 'map.includes') {
      this.assignCallResult(path, {
        type: 'bool',
      });
    }
  }

  private handleMapUtilityAst(
    path: NodePath<CallExpressionNode>,
    qualifiedName: string,
    loopMultiplier: number,
  ): void {
    const call = path.node;
    if (!this.validateUtilityArgumentCount(call, qualifiedName)) {
      return;
    }

    const mapName = call.args.length > 0 ? this.extractIdentifierName(call.args[0]) : null;
    if (!mapName) {
      return;
    }

    this.trackMapOperation(mapName, call.loc.start.line, qualifiedName === 'map.clear', loopMultiplier);

    if (!this.mapDeclarations.has(mapName) && this.isKnownNonMapVariable(mapName)) {
      this.addError(
        call.loc.start.line,
        call.loc.start.column,
        `${qualifiedName}() called on non-map variable '${mapName}'`,
        'PSV6-MAP-OPERATION-NON-MAP',
        `Use a map variable: ${qualifiedName}(myMap)`,
      );
      return;
    }

    const assignmentTarget = this.findAssignmentTarget(path);
    if (!assignmentTarget) {
      return;
    }

    const mapInfo = this.mapDeclarations.get(mapName ?? '');

    switch (qualifiedName) {
      case 'map.keys': {
        this.assignCallResult(path, {
          type: 'array',
          elementType: 'string',
        });
        break;
      }
      case 'map.values': {
        const elementType = this.normalizeValueType(mapInfo?.valueType ?? 'unknown');
        this.assignCallResult(path, {
          type: 'array',
          elementType,
        });
        break;
      }
      case 'map.size': {
        this.assignCallResult(path, { type: 'int' });
        break;
      }
      case 'map.clear': {
        // clear returns void; nothing to assign
        break;
      }
      case 'map.copy': {
        if (!mapInfo) {
          break;
        }
        this.mapDeclarations.set(assignmentTarget.name, {
          name: assignmentTarget.name,
          keyType: mapInfo.keyType,
          valueType: mapInfo.valueType,
          line: assignmentTarget.line,
          column: assignmentTarget.column,
          isInitialized: mapInfo.isInitialized,
        });
        this.assignCallResult(path, {
          type: 'map',
          keyType: mapInfo.keyType,
          valueType: mapInfo.valueType,
        });
        break;
      }
    }
  }

  private validateUtilityArgumentCount(call: CallExpressionNode, qualifiedName: string): boolean {
    if (
      qualifiedName === 'map.clear' ||
      qualifiedName === 'map.size' ||
      qualifiedName === 'map.keys' ||
      qualifiedName === 'map.values' ||
      qualifiedName === 'map.copy'
    ) {
      if (call.args.length === 0) {
        this.addError(
          call.loc.start.line,
          call.loc.start.column,
          `${qualifiedName}() requires a map parameter`,
          'PSV6-MAP-METHOD-PARAMS',
          `Provide map parameter: ${qualifiedName}(myMap)`,
        );
        return false;
      }

      if (call.args.length > 1) {
        this.addError(
          call.loc.start.line,
          call.loc.start.column,
          `${qualifiedName}() takes only one parameter`,
          'PSV6-MAP-METHOD-PARAMS',
          `Remove extra parameters: ${qualifiedName}(myMap)`,
        );
        return false;
      }
    }
    return true;
  }

  private validateMapPerformanceAst(): void {
    if (this.mapAllocations > 10) {
      this.addWarning(
        1,
        1,
        `Too many map allocations (${this.mapAllocations}). Consider reusing maps or using arrays.`,
        'PSV6-MAP-PERF-ALLOCATION',
        'Consider using arrays for simple key-value storage or reusing existing maps',
      );
    }

    for (const [mapName, operationCount] of this.mapOperations) {
      if (operationCount > 100) {
        const mapInfo = this.mapDeclarations.get(mapName);
        this.addWarning(
          mapInfo?.line ?? 1,
          mapInfo?.column ?? 1,
          `Map '${mapName}' has many operations (${operationCount}). Consider optimization.`,
          'PSV6-MAP-PERF-LARGE',
          'Consider caching frequently accessed values or using arrays for better performance',
        );
      }
    }
  }

  private validateMapBestPracticesAst(): void {
    for (const [mapName, mapInfo] of this.mapDeclarations) {
      if (mapName.length <= 2 || /^m\d*$/.test(mapName)) {
        this.addInfo(
          mapInfo.line,
          mapInfo.column,
          `Consider using a more descriptive name for map '${mapName}'`,
          'PSV6-MAP-NAMING',
          'Use descriptive names like "priceMap" or "userSettings"',
        );
      }

      if (!mapInfo.isInitialized) {
        this.addInfo(
          mapInfo.line,
          mapInfo.column,
          `Map '${mapName}' is declared but never initialized with values`,
          'PSV6-MAP-INITIALIZATION',
          'Initialize the map with data or remove if unused',
        );
      }
    }

    const hasClearOperations = Array.from(this.mapUsage.values()).some((usage) => usage.clears.length > 0);
    if (this.mapAllocations > 0 && !hasClearOperations) {
      this.addInfo(
        1,
        1,
        'Consider using map.clear() to free memory when maps are no longer needed',
        'PSV6-MAP-MEMORY',
        'Add map.clear(myMap) calls to free memory',
      );
    }
  }

  private buildModuleResult(scriptType: ValidationContext['scriptType']): ValidationResult {
    const typeMap = new Map<string, TypeInfo>();

    if (!this.context.typeMap) {
      this.context.typeMap = new Map();
    }

    for (const [mapName, mapInfo] of this.mapDeclarations) {
      const existing = this.context.typeMap.get(mapName);
      const typeInfo: TypeInfo = existing
        ? {
            ...existing,
            usages: Array.isArray(existing.usages) ? [...existing.usages] : [],
          }
        : {
            type: 'map',
            isConst: false,
            isSeries: false,
            declaredAt: { line: mapInfo.line, column: mapInfo.column },
            usages: [],
          };

      typeInfo.type = 'map';
      typeInfo.isConst = typeInfo.isConst ?? false;
      typeInfo.isSeries = false;
      if (!typeInfo.declaredAt) {
        typeInfo.declaredAt = { line: mapInfo.line, column: mapInfo.column };
      }
      typeInfo.keyType = mapInfo.keyType;
      typeInfo.valueType = mapInfo.valueType;

      this.context.typeMap.set(mapName, typeInfo);
      typeMap.set(mapName, typeInfo);
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap,
      scriptType,
    };
  }

  private addError(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    const key = `${line}:${column}:${code ?? 'error'}:${message}`;
    if (this.errorKeys.has(key)) {
      return;
    }
    this.errorKeys.add(key);
    if (this.isClearlyInvalid(message, code)) {
      this.errors.push({ line, column, message, severity: 'error', code, suggestion });
    } else {
      this.warningKeys.add(key);
      this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
    }
  }

  private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    const key = `${line}:${column}:${code ?? 'warning'}:${message}`;
    if (this.warningKeys.has(key)) {
      return;
    }
    this.warningKeys.add(key);
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  private addInfo(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    const key = `${line}:${column}:${code ?? 'info'}:${message}`;
    if (this.infoKeys.has(key)) {
      return;
    }
    this.infoKeys.add(key);
    this.info.push({ line, column, message, severity: 'info', code, suggestion });
  }

  private isClearlyInvalid(_message: string, code?: string): boolean {
    if (code === 'PSV6-MAP-DECLARATION') return true;
    if (code === 'PSV6-MAP-OPERATION-NON-MAP') return true;
    if (code === 'PSV6-MAP-METHOD-PARAMS') return true;
    if (code === 'PSV6-MAP-TYPE-MISMATCH' || code === 'PSV6-MAP-VALUE-TYPE-MISMATCH') return true;
    return false;
  }

  private extractIdentifierName(argument: ArgumentNode | undefined): string | null {
    if (!argument) {
      return null;
    }
    const value = argument.value;
    if (value.kind === 'Identifier') {
      return (value as IdentifierNode).name;
    }
    return null;
  }

  private extractMapAssignmentTarget(path: NodePath<CallExpressionNode>): {
    name: string;
    line: number;
    column: number;
    annotationKeyType?: string | null;
    annotationValueType?: string | null;
  } | null {
    const declarationPath = findAncestor(path, (ancestor): ancestor is NodePath<VariableDeclarationNode> => ancestor.node.kind === 'VariableDeclaration');
    if (declarationPath) {
      const declaration = declarationPath.node as VariableDeclarationNode;
      if (declaration.initializer === path.node) {
        const identifier = declaration.identifier;
        const annotationTypes = this.extractMapAnnotationTypes(declaration.typeAnnotation);
        return {
          name: identifier.name,
          line: identifier.loc.start.line,
          column: identifier.loc.start.column,
          annotationKeyType: annotationTypes.keyType,
          annotationValueType: annotationTypes.valueType,
        };
      }
    }

    const assignmentPath = findAncestor(path, (ancestor): ancestor is NodePath<AssignmentStatementNode> => ancestor.node.kind === 'AssignmentStatement');
    if (assignmentPath) {
      const assignment = assignmentPath.node as AssignmentStatementNode;
      if (assignment.right === path.node && assignment.left.kind === 'Identifier') {
        const identifier = assignment.left as IdentifierNode;
        const existing = this.mapDeclarations.get(identifier.name);
        return {
          name: identifier.name,
          line: identifier.loc.start.line,
          column: identifier.loc.start.column,
          annotationKeyType: existing?.keyType ?? null,
          annotationValueType: existing?.valueType ?? null,
        };
      }
    }

    return null;
  }

  private findAssignmentTarget(path: NodePath<CallExpressionNode>): {
    name: string;
    line: number;
    column: number;
  } | null {
    const declarationPath = findAncestor(path, (ancestor): ancestor is NodePath<VariableDeclarationNode> => ancestor.node.kind === 'VariableDeclaration');
    if (declarationPath) {
      const declaration = declarationPath.node as VariableDeclarationNode;
      if (declaration.initializer === path.node) {
        const identifier = declaration.identifier;
        return {
          name: identifier.name,
          line: identifier.loc.start.line,
          column: identifier.loc.start.column,
        };
      }
    }

    const assignmentPath = findAncestor(path, (ancestor): ancestor is NodePath<AssignmentStatementNode> => ancestor.node.kind === 'AssignmentStatement');
    if (assignmentPath) {
      const assignment = assignmentPath.node as AssignmentStatementNode;
      if (assignment.right === path.node && assignment.left.kind === 'Identifier') {
        const identifier = assignment.left as IdentifierNode;
        return {
          name: identifier.name,
          line: identifier.loc.start.line,
          column: identifier.loc.start.column,
        };
      }
    }

    return null;
  }

  private extractMapAnnotationTypes(type: TypeReferenceNode | null): { keyType: string | null; valueType: string | null } {
    if (!type) {
      return { keyType: null, valueType: null };
    }
    if (type.name.name === 'map' && type.generics.length > 0) {
      const generics = type.generics.map((node) => this.describeTypeReference(node));
      const valueType = generics[generics.length - 1] ?? null;
      const keyType = generics.length > 1 ? generics[0] : 'string';
      return {
        keyType,
        valueType,
      };
    }
    return { keyType: null, valueType: null };
  }

  private describeTypeReference(type: TypeReferenceNode): string {
    if (type.generics.length === 0) {
      return type.name.name;
    }
    const generics = type.generics.map((generic) => this.describeTypeReference(generic));
    return `${type.name.name}<${generics.join(', ')}>`;
  }

  private assignCallResult(
    path: NodePath<CallExpressionNode>,
    info: { type: TypeInfo['type']; elementType?: string; keyType?: string; valueType?: string },
  ): void {
    const target = this.findAssignmentTarget(path);
    if (!target) {
      return;
    }

    if (!this.context.typeMap) {
      this.context.typeMap = new Map();
    }

    const existing = this.context.typeMap.get(target.name);
    const typeInfo: TypeInfo = existing ?? {
      type: info.type,
      isConst: false,
      isSeries: info.type === 'series',
      declaredAt: { line: target.line, column: target.column },
      usages: [],
    };

    typeInfo.type = info.type;
    typeInfo.isConst = typeInfo.isConst ?? false;
    typeInfo.isSeries = info.type === 'series' ? true : (typeInfo.isSeries ?? false);

    if (info.elementType) {
      typeInfo.elementType = info.elementType;
    }
    if (info.keyType) {
      typeInfo.keyType = info.keyType;
    }
    if (info.valueType) {
      typeInfo.valueType = info.valueType;
    }

    this.context.typeMap.set(target.name, typeInfo);
  }

  private handleMapGetResult(path: NodePath<CallExpressionNode>, mapName: string): void {
    const mapInfo = this.mapDeclarations.get(mapName);
    if (!mapInfo) {
      return;
    }

    const target = this.findAssignmentTarget(path);
    if (!target) {
      return;
    }

    const valueType = this.normalizeValueType(mapInfo.valueType);
    const nestedValueType = this.unwrapMapValueType(valueType);

    if (valueType.startsWith('map<') && nestedValueType) {
      this.mapDeclarations.set(target.name, {
        name: target.name,
        keyType: 'string',
        valueType: nestedValueType,
        line: target.line,
        column: target.column,
        isInitialized: mapInfo.isInitialized,
      });
      this.assignCallResult(path, {
        type: 'map',
        keyType: 'string',
        valueType: nestedValueType,
      });
      return;
    }

    const scalarType = valueType === 'na' ? 'float' : valueType;
    if (scalarType !== 'unknown' && this.isValidType(scalarType)) {
      this.assignCallResult(path, { type: scalarType as TypeInfo['type'] });
    }
  }

  private setVariableType(
    name: string,
    line: number,
    column: number,
    options: { type: TypeInfo['type']; keyType?: string; valueType?: string; elementType?: string },
  ): void {
    if (!this.context.typeMap) {
      this.context.typeMap = new Map();
    }

    const existing = this.context.typeMap.get(name);
    const typeInfo: TypeInfo = existing ?? {
      type: options.type,
      isConst: false,
      isSeries: options.type === 'series',
      declaredAt: { line, column },
      usages: [],
    };

    typeInfo.type = options.type;
    typeInfo.isConst = typeInfo.isConst ?? false;
    typeInfo.isSeries = options.type === 'series' ? true : (typeInfo.isSeries ?? false);

    if (options.keyType) {
      typeInfo.keyType = options.keyType;
    }
    if (options.valueType) {
      typeInfo.valueType = options.valueType;
    }
    if (options.elementType) {
      typeInfo.elementType = options.elementType;
    }

    this.context.typeMap.set(name, typeInfo);
  }

  private inferMapTypesFromCall(call: CallExpressionNode): { keyType?: string; valueType?: string } {
    if (Array.isArray(call.typeArguments) && call.typeArguments.length > 0) {
      const generics = call.typeArguments.map((arg) => this.describeTypeReference(arg)).filter(Boolean);
      return {
        keyType: generics.length > 1 ? generics[0] : 'string',
        valueType: generics[generics.length - 1],
      };
    }

    return { keyType: 'string' };
  }

  private normalizeKeyType(keyType: string | null | undefined): string {
    if (!keyType || keyType === 'unknown') {
      return 'string';
    }
    const trimmed = keyType.trim();
    return trimmed.length > 0 ? trimmed : 'string';
  }

  private normalizeValueType(valueType: string | null): string {
    if (!valueType) {
      return 'unknown';
    }
    const trimmed = valueType.trim();
    return trimmed.length > 0 ? trimmed : 'unknown';
  }

  private inferExpressionValueType(expression: ExpressionNode): string {
    if (expression.kind === 'StringLiteral') {
      return 'string';
    }
    if (expression.kind === 'BooleanLiteral') {
      return (expression as BooleanLiteralNode).value ? 'bool' : 'bool';
    }
    if (expression.kind === 'NullLiteral') {
      return 'na';
    }
    if (expression.kind === 'NumberLiteral') {
      const literal = expression as NumberLiteralNode;
      const raw = typeof literal.raw === 'string' ? literal.raw : String((literal as any).value ?? '');
      return raw.includes('.') ? 'float' : 'int';
    }
    if (expression.kind === 'UnaryExpression') {
      const unary = expression as UnaryExpressionNode;
      return this.inferExpressionValueType(unary.argument);
    }
    if (expression.kind === 'Identifier') {
      const identifier = expression as IdentifierNode;
      const typeInfo = this.context.typeMap?.get(identifier.name) as { type?: string } | undefined;
      if (typeInfo?.type) {
        return typeInfo.type;
      }
      return 'unknown';
    }
    if (expression.kind === 'CallExpression') {
      const text = this.getExpressionText(expression);
      if (/^color\./.test(text)) {
        return 'color';
      }
    }
    return 'unknown';
  }

  private areValueTypesCompatible(expected: string, actual: string): boolean {
    if (expected === 'unknown' || actual === 'unknown') {
      return true;
    }
    if (actual === 'na') {
      return true;
    }
    if (actual === 'map' && expected.startsWith('map<')) {
      return true;
    }
    return expected === actual;
  }

  private getExpressionQualifiedName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }
    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (member.computed) {
        return null;
      }
      const objectName = this.getExpressionQualifiedName(member.object);
      if (!objectName) {
        return null;
      }
      return `${objectName}.${member.property.name}`;
    }
    return null;
  }

  private getExpressionText(expression: ExpressionNode): string {
    return this.getNodeSource(expression);
  }

  private getNodeSource(node: { loc: { start: { line: number; column: number }; end: { line: number; column: number } } }): string {
    const lines = this.context.lines ?? [];
    const startLineIndex = Math.max(0, node.loc.start.line - 1);
    const endLineIndex = Math.max(0, node.loc.end.line - 1);

    if (startLineIndex === endLineIndex) {
      const line = lines[startLineIndex] ?? '';
      return line.slice(node.loc.start.column - 1, Math.max(node.loc.start.column - 1, node.loc.end.column - 1));
    }

    const parts: string[] = [];
    const firstLine = lines[startLineIndex] ?? '';
    parts.push(firstLine.slice(node.loc.start.column - 1));

    for (let index = startLineIndex + 1; index < endLineIndex; index++) {
      parts.push(lines[index] ?? '');
    }

    const lastLine = lines[endLineIndex] ?? '';
    parts.push(lastLine.slice(0, Math.max(0, node.loc.end.column - 1)));
    return parts.join('\n');
  }

  private recordMapUsage(mapName: string, kind: 'put' | 'clear', line: number): void {
    const usage = this.mapUsage.get(mapName) ?? { puts: [], clears: [] };
    if (kind === 'put') {
      usage.puts.push(line);
    } else if (kind === 'clear') {
      usage.clears.push(line);
    }
    this.mapUsage.set(mapName, usage);
  }

  private trackMapOperation(mapName: string, lineNum?: number, isClear = false, count = 1): void {
    if (!mapName) {
      return;
    }
    const current = this.mapOperations.get(mapName) || 0;
    this.mapOperations.set(mapName, current + Math.max(1, count));
    if (isClear) {
      this.recordMapUsage(mapName, 'clear', lineNum ?? 1);
    }
  }

  private computeLoopMultiplier(loopStack: NodePath[]): number {
    if (loopStack.length === 0) {
      return 1;
    }

    let multiplier = 1;

    for (const loopPath of loopStack) {
      const node = loopPath.node;
      if (node.kind === 'ForStatement') {
        const estimate = this.estimateForLoopIterations(node as ForStatementNode);
        multiplier *= estimate ?? 25;
      } else if (node.kind === 'RepeatStatement') {
        const estimate = this.estimateRepeatIterations(node as RepeatStatementNode);
        multiplier *= estimate ?? 25;
      } else if (node.kind === 'WhileStatement') {
        multiplier *= 50;
      }

      if (multiplier >= 1000) {
        return 1000;
      }
    }

    return Math.max(1, Math.min(multiplier, 1000));
  }

  private estimateForLoopIterations(loop: ForStatementNode): number | null {
    const loopSource = this.getNodeSource(loop);
    const rangeMatch = /for\s+\w+\s*=\s*(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)/i.exec(loopSource);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        const span = Math.abs(end - start);
        if (span === 0) {
          return 1;
        }
        return Math.max(1, Math.min(1000, Math.round(span) + 1));
      }
    }

    const inMatch = /for\s+\w+\s+in\s+/i.exec(loopSource);
    if (inMatch) {
      return 25;
    }

    return null;
  }

  private estimateRepeatIterations(loop: RepeatStatementNode): number | null {
    const loopSource = this.getNodeSource(loop);
    const match = /repeat\s+(-?\d+(?:\.\d+)?)/i.exec(loopSource);
    if (match) {
      const iterations = Number(match[1]);
      if (Number.isFinite(iterations) && iterations > 0) {
        return Math.max(1, Math.min(1000, Math.round(iterations)));
      }
    }
    return null;
  }

  private splitTopLevelCsv(content: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';

    for (const char of content) {
      if (char === '<') {
        depth += 1;
        current += char;
        continue;
      }

      if (char === '>') {
        depth = Math.max(0, depth - 1);
        current += char;
        continue;
      }

      if (char === ',' && depth === 0) {
        if (current.trim().length > 0) {
          parts.push(current.trim());
        }
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim().length > 0) {
      parts.push(current.trim());
    }

    return parts;
  }

  private unwrapMapValueType(valueType: string | null | undefined): string | null {
    if (!valueType) {
      return null;
    }

    const trimmed = valueType.trim();
    const match = /^map<(.+)>$/i.exec(trimmed);
    if (!match) {
      return null;
    }

    return match[1]?.trim() ?? null;
  }

  private isKnownNonMapVariable(varName: string): boolean {
    if (this.mapDeclarations.has(varName)) return false;

    const typeInfo = this.context?.typeMap?.get(varName) as { type?: string } | undefined;
    if (typeInfo) {
      if (typeInfo.type === undefined || typeInfo.type === 'unknown') {
        return false;
      }
      return typeInfo.type !== 'map';
    }

    const identifierMetadata = this.astContext?.typeEnvironment?.identifiers.get(varName);
    if (identifierMetadata) {
      return identifierMetadata.kind !== 'unknown';
    }

    return false;
  }

  private getAstContext(
    context: ValidationContext,
    config: ValidatorConfig,
  ): AstValidationContext | null {
    return ensureAstContext(context, config);
  }

  // Getter methods for other modules
  getMapDeclarations(): Map<string, MapDeclarationInfo> {
    return new Map(this.mapDeclarations);
  }

  getMapOperations(): Map<string, number> {
    return new Map(this.mapOperations);
  }

  isMapVariable(varName: string): boolean {
    return this.mapDeclarations.has(varName);
  }

  getMapValueType(varName: string): string | null {
    return this.mapDeclarations.get(varName)?.valueType || null;
  }

  getMapKeyType(varName: string): string | null {
    return this.mapDeclarations.get(varName)?.keyType || null;
  }

  private isValidType(type: string): type is TypeInfo['type'] {
    const validTypes: TypeInfo['type'][] = [
      'string', 'float', 'int', 'series', 'array', 'map', 'bool', 
      'color', 'line', 'label', 'box', 'table', 'linefill', 
      'polyline', 'chart.point', 'matrix', 'udt', 'unknown'
    ];
    return validTypes.includes(type as TypeInfo['type']);
  }
}
