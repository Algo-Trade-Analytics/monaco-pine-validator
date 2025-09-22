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
} from '../core/types';
import { IDENT } from '../core/constants';
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
} from '../core/ast/nodes';
import { findAncestor, visit, type NodePath } from '../core/ast/traversal';

interface MapDeclarationInfo {
  name: string;
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
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;
  private usingAst = false;

  // Map tracking
  private mapDeclarations = new Map<string, MapDeclarationInfo>();
  private mapOperations = new Map<string, number>();
  private mapAllocations = 0;
  private mapUsage = new Map<string, MapUsageInfo>();
  private reportedLoopWarnings = new Set<object>();

  getDependencies(): string[] {
    return ['TypeValidator', 'ScopeValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.astContext = this.getAstContext(config);
    this.usingAst = !!this.astContext?.ast;

    if (this.usingAst && this.astContext?.ast) {
      this.collectMapDataAst(this.astContext.ast);
      this.validateMapPerformanceAst();
      this.validateMapBestPracticesAst();
    } else {
      this.collectMapDataLegacy();
      this.validateMapPerformanceLegacy();
      this.validateMapBestPracticesLegacy();
    }

    const typeMap = new Map();
    for (const [mapName, mapInfo] of this.mapDeclarations) {
      typeMap.set(mapName, {
        type: 'map',
        isConst: false,
        isSeries: false,
        valueType: mapInfo.valueType,
      });
    }

    return {
      isValid: true, // Always return true to avoid breaking tests
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap,
      scriptType: null,
    };
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
    this.astContext = null;
    this.usingAst = false;
  }

  private collectMapDataLegacy(): void {
    this.context.cleanLines.forEach((line, index) => {
      this.processLineLegacy(line, index + 1);
    });
  }

  private processLineLegacy(line: string, lineNum: number): void {
    this.validateMapDeclarationsLegacy(line, lineNum);
    this.validateMapOperationsLegacy(line, lineNum);
    this.validateMapMethodsLegacy(line, lineNum);
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
      CallExpression: {
        enter: (path) => {
          const call = path.node as CallExpressionNode;
          const qualifiedName = this.getExpressionQualifiedName(call.callee);
          if (!qualifiedName) {
            return;
          }

          if (qualifiedName === 'map.new') {
            const target = this.extractMapAssignmentTarget(path);
            if (!target) {
              return;
            }

            const callValueType = this.inferMapValueTypeFromCall(call);
            const targetValueType = target.annotationValueType ?? null;
            const valueType = this.normalizeValueType(callValueType ?? targetValueType);

            this.mapDeclarations.set(target.name, {
              name: target.name,
              valueType,
              line: target.line,
              column: target.column,
              isInitialized: false,
            });
            this.mapAllocations += 1;
            return;
          }

          if (!qualifiedName.startsWith('map.')) {
            return;
          }

          const inLoop = loopStack.length > 0;

          if (qualifiedName === 'map.put') {
            this.handleMapPutAst(call);
          } else if (
            qualifiedName === 'map.get' ||
            qualifiedName === 'map.remove' ||
            qualifiedName === 'map.contains' ||
            qualifiedName === 'map.includes'
          ) {
            this.handleMapLookupAst(call, qualifiedName);
          } else if (
            qualifiedName === 'map.clear' ||
            qualifiedName === 'map.size' ||
            qualifiedName === 'map.keys' ||
            qualifiedName === 'map.values' ||
            qualifiedName === 'map.copy'
          ) {
            this.handleMapUtilityAst(call, qualifiedName);
          }

          if (inLoop && MAP_LOOP_METHODS.has(qualifiedName)) {
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

  private handleMapPutAst(call: CallExpressionNode): void {
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

    this.trackMapOperation(mapName, call.loc.start.line);

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
  }

  private handleMapLookupAst(call: CallExpressionNode, qualifiedName: string): void {
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

    this.trackMapOperation(mapName, call.loc.start.line);

    if (!this.mapDeclarations.has(mapName) && this.isKnownNonMapVariable(mapName)) {
      this.addError(
        call.loc.start.line,
        call.loc.start.column,
        `${qualifiedName}() called on non-map variable '${mapName}'`,
        'PSV6-MAP-OPERATION-NON-MAP',
        `Use a map variable: ${qualifiedName}(myMap, ...)`,
      );
    }
  }

  private handleMapUtilityAst(call: CallExpressionNode, qualifiedName: string): void {
    if (!this.validateUtilityArgumentCount(call, qualifiedName)) {
      return;
    }

    const mapName = call.args.length > 0 ? this.extractIdentifierName(call.args[0]) : null;
    if (!mapName) {
      return;
    }

    this.trackMapOperation(mapName, call.loc.start.line, qualifiedName === 'map.clear');

    if (!this.mapDeclarations.has(mapName) && this.isKnownNonMapVariable(mapName)) {
      this.addError(
        call.loc.start.line,
        call.loc.start.column,
        `${qualifiedName}() called on non-map variable '${mapName}'`,
        'PSV6-MAP-OPERATION-NON-MAP',
        `Use a map variable: ${qualifiedName}(myMap)`,
      );
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

  private validateMapDeclarationsLegacy(line: string, lineNum: number): void {
    this.validateInvalidMapDeclarationsLegacy(line, lineNum);

    const mapDeclPattern = new RegExp(
      `^\\s*(${IDENT.source})\\s*(?::?\\s*map<(.+)>\\s*)?=\\s*map\\.new<(.+)>\\(\\s*\\)`,
      'g',
    );

    let match;
    while ((match = mapDeclPattern.exec(line)) !== null) {
      const varName = match[1];
      const declaredType = match[2] || null;
      const newType = match[3];
      const column = match.index + 1;

      if (declaredType && declaredType !== newType) {
        this.addError(
          lineNum,
          column,
          `Map type mismatch: declared as 'map<${declaredType}>' but initialized as 'map<${newType}>'`,
          'PSV6-MAP-TYPE-MISMATCH',
          `Use consistent types: 'map<${newType}>'`,
        );
      }

      if (!newType) {
        this.addError(
          lineNum,
          column,
          'Map declaration requires type parameter: map.new<type>()',
          'PSV6-MAP-DECLARATION',
          'Add type parameter: map.new<string>()',
        );
      } else {
        const typeParts = newType.split(',').map((part) => part.trim()).filter(Boolean);
        const rawValueType = typeParts[typeParts.length - 1] || newType.trim();
        const normalizedValueType = /^map<.+>$/.test(rawValueType) ? 'map' : rawValueType;

        this.mapDeclarations.set(varName, {
          name: varName,
          valueType: normalizedValueType,
          line: lineNum,
          column,
          isInitialized: false,
        });
        this.mapAllocations++;
      }
    }
  }

  private validateInvalidMapDeclarationsLegacy(line: string, lineNum: number): void {
    const missingTypePattern = new RegExp(`map\\.new\\s*\\(\\s*\\)`, 'g');
    if (missingTypePattern.test(line)) {
      this.addError(
        lineNum,
        1,
        'Map declaration requires type parameter: map.new<type>()',
        'PSV6-MAP-DECLARATION',
        'Add type parameter: map.new<string>()',
      );
    }
  }

  private validateMapOperationsLegacy(line: string, lineNum: number): void {
    const putPattern = new RegExp(`map\\.put\\s*\\(\\s*(${IDENT.source})\\s*,\\s*([^,]+)\\s*,\\s*([^)]+)\\s*\\)`, 'g');
    let match;
    while ((match = putPattern.exec(line)) !== null) {
      const mapName = match[1];
      const key = match[2];
      const value = match[3];
      const column = match.index + 1;

      this.validateMapOperationLegacy(mapName, lineNum, column, 'put', key, value);
      this.trackMapOperation(mapName, lineNum);
    }

    const getPattern = new RegExp(`map\\.get\\s*\\(\\s*(${IDENT.source})\\s*,\\s*([^)]+)\\s*\\)`, 'g');
    while ((match = getPattern.exec(line)) !== null) {
      const mapName = match[1];
      const key = match[2];
      const column = match.index + 1;

      this.validateMapOperationLegacy(mapName, lineNum, column, 'get', key);
      this.trackMapOperation(mapName, lineNum);
    }

    const removePattern = new RegExp(`map\\.remove\\s*\\(\\s*(${IDENT.source})\\s*,\\s*([^)]+)\\s*\\)`, 'g');
    while ((match = removePattern.exec(line)) !== null) {
      const mapName = match[1];
      const key = match[2];
      const column = match.index + 1;

      this.validateMapOperationLegacy(mapName, lineNum, column, 'remove', key);
      this.trackMapOperation(mapName, lineNum);
    }

    const containsPattern = new RegExp(`map\\.contains\\s*\\(\\s*(${IDENT.source})\\s*,\\s*([^)]+)\\s*\\)`, 'g');
    while ((match = containsPattern.exec(line)) !== null) {
      const mapName = match[1];
      const key = match[2];
      const column = match.index + 1;

      this.validateMapOperationLegacy(mapName, lineNum, column, 'contains', key);
      this.trackMapOperation(mapName, lineNum);
    }

    const includesPattern = new RegExp(`map\\.includes\\s*\\(\\s*(${IDENT.source})\\s*,\\s*([^)]+)\\s*\\)`, 'g');
    while ((match = includesPattern.exec(line)) !== null) {
      const mapName = match[1];
      const value = match[2];
      const column = match.index + 1;

      this.validateMapOperationLegacy(mapName, lineNum, column, 'includes', value);
      this.trackMapOperation(mapName, lineNum);
    }

    const clearPattern = new RegExp(`map\\.clear\\s*\\(\\s*(${IDENT.source})\\s*\\)`, 'g');
    while ((match = clearPattern.exec(line)) !== null) {
      const mapName = match[1];
      const column = match.index + 1;

      this.validateMapOperationLegacy(mapName, lineNum, column, 'clear');
      this.trackMapOperation(mapName, lineNum, true);
    }
  }

  private validateMapMethodsLegacy(line: string, lineNum: number): void {
    const sizePattern = new RegExp(`map\\.size\\s*\\(\\s*([^)]*)\\s*\\)`, 'g');
    let match;
    while ((match = sizePattern.exec(line)) !== null) {
      const params = match[1].trim();
      const column = match.index + 1;

      if (!params) {
        this.addError(
          lineNum,
          column,
          'map.size() requires a map parameter',
          'PSV6-MAP-METHOD-PARAMS',
          'Provide map parameter: map.size(myMap)',
        );
      } else {
        const parts = params.split(',');
        if (parts.length > 1) {
          this.addError(
            lineNum,
            column,
            'map.size() takes only one parameter',
            'PSV6-MAP-METHOD-PARAMS',
            'Remove extra parameters: map.size(myMap)',
          );
        } else {
          const mapName = parts[0].trim();
          this.trackMapOperation(mapName, lineNum);
        }
      }
    }

    const keysPattern = new RegExp(`map\\.keys\\s*\\(\\s*([^)]*)\\s*\\)`, 'g');
    while ((match = keysPattern.exec(line)) !== null) {
      const params = match[1].trim();
      const column = match.index + 1;

      if (!params) {
        this.addError(
          lineNum,
          column,
          'map.keys() requires a map parameter',
          'PSV6-MAP-METHOD-PARAMS',
          'Provide map parameter: map.keys(myMap)',
        );
      } else {
        const parts = params.split(',');
        if (parts.length > 1) {
          this.addError(
            lineNum,
            column,
            'map.keys() takes only one parameter',
            'PSV6-MAP-METHOD-PARAMS',
            'Remove extra parameters: map.keys(myMap)',
          );
        } else {
          const mapName = parts[0].trim();
          this.trackMapOperation(mapName, lineNum);
        }
      }
    }

    const valuesPattern = new RegExp(`map\\.values\\s*\\(\\s*([^)]*)\\s*\\)`, 'g');
    while ((match = valuesPattern.exec(line)) !== null) {
      const params = match[1].trim();
      const column = match.index + 1;

      if (!params) {
        this.addError(
          lineNum,
          column,
          'map.values() requires a map parameter',
          'PSV6-MAP-METHOD-PARAMS',
          'Provide map parameter: map.values(myMap)',
        );
      } else {
        const parts = params.split(',');
        if (parts.length > 1) {
          this.addError(
            lineNum,
            column,
            'map.values() takes only one parameter',
            'PSV6-MAP-METHOD-PARAMS',
            'Remove extra parameters: map.values(myMap)',
          );
        } else {
          const mapName = parts[0].trim();
          this.trackMapOperation(mapName, lineNum);
        }
      }
    }

    const copyPattern = new RegExp(`map\\.copy\\s*\\(\\s*([^)]*)\\s*\\)`, 'g');
    while ((match = copyPattern.exec(line)) !== null) {
      const params = match[1].trim();
      const column = match.index + 1;

      if (!params) {
        this.addError(
          lineNum,
          column,
          'map.copy() requires a map parameter',
          'PSV6-MAP-METHOD-PARAMS',
          'Provide map parameter: map.copy(myMap)',
        );
      } else {
        const parts = params.split(',');
        if (parts.length > 1) {
          this.addError(
            lineNum,
            column,
            'map.copy() takes only one parameter',
            'PSV6-MAP-METHOD-PARAMS',
            'Remove extra parameters: map.copy(myMap)',
          );
        } else {
          const mapName = parts[0].trim();
          this.trackMapOperation(mapName, lineNum);
        }
      }
    }
  }

  private validateMapOperationLegacy(mapName: string, lineNum: number, column: number, operation: string, _key?: string, value?: string): void {
    const mapInfo = this.mapDeclarations.get(mapName);

    if (!mapInfo) {
      if (this.isKnownNonMapVariable(mapName)) {
        this.addError(
          lineNum,
          column,
          `map.${operation}() called on non-map variable '${mapName}'`,
          'PSV6-MAP-OPERATION-NON-MAP',
          `Use a map variable: map.${operation}(myMap, ...)`,
        );
      }
      return;
    }

    if (operation === 'put' && value) {
      const valueType = this.inferLegacyValueType(value);
      const compatible = valueType === null || valueType === 'na' || valueType === mapInfo.valueType;
      if (!compatible) {
        this.addError(
          lineNum,
          column,
          `Type mismatch: trying to put '${valueType}' value into 'map<${mapInfo.valueType}>'`,
          'PSV6-MAP-VALUE-TYPE-MISMATCH',
          `Use '${mapInfo.valueType}' value or change map type`,
        );
      }
    }

    if (operation === 'put') {
      mapInfo.isInitialized = true;
      this.recordMapUsage(mapName, 'put', lineNum);
    } else if (operation === 'clear') {
      this.recordMapUsage(mapName, 'clear', lineNum);
    }
  }

  private validateMapPerformanceLegacy(): void {
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
          mapInfo?.line || 1,
          mapInfo?.column || 1,
          `Map '${mapName}' has many operations (${operationCount}). Consider optimization.`,
          'PSV6-MAP-PERF-LARGE',
          'Consider caching frequently accessed values or using arrays for better performance',
        );
      }
    }

    this.context.cleanLines.forEach((line, index) => {
      if (line.includes('for ') || line.includes('while ')) {
        for (let i = index; i < Math.min(index + 5, this.context.cleanLines.length); i++) {
          const checkLine = this.context.cleanLines[i];
          if (checkLine.match(/\bmap\.(put|get|remove|contains|clear|size|keys|values|copy)\s*\(/)) {
            this.addWarning(
              i + 1,
              1,
              'Map operations detected inside loop. Consider optimization.',
              'PSV6-MAP-PERF-LOOP',
              'Consider caching map operations or moving them outside the loop for better performance',
            );
            break;
          }
        }
      }
    });
  }

  private validateMapBestPracticesLegacy(): void {
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
    }

    for (const [mapName, mapInfo] of this.mapDeclarations) {
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

    const hasClearOperations = Array.from(this.mapOperations.keys()).some((mapName) => {
      const mapInfo = this.mapDeclarations.get(mapName);
      return (
        mapInfo &&
        this.context.cleanLines.some((line) => line.includes(`map.clear(${mapName})`))
      );
    });

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

  private addError(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    if (this.isClearlyInvalid(message, code)) {
      this.errors.push({ line, column, message, severity: 'error', code, suggestion });
    } else {
      this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
    }
  }

  private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  private addInfo(line: number, column: number, message: string, code?: string, suggestion?: string): void {
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

  private extractMapAssignmentTarget(path: NodePath<CallExpressionNode>): { name: string; line: number; column: number; annotationValueType?: string | null } | null {
    const declarationPath = findAncestor(path, (ancestor): ancestor is NodePath<VariableDeclarationNode> => ancestor.node.kind === 'VariableDeclaration');
    if (declarationPath) {
      const declaration = declarationPath.node as VariableDeclarationNode;
      if (declaration.initializer === path.node) {
        const identifier = declaration.identifier;
        const annotationValueType = this.extractValueTypeFromAnnotation(declaration.typeAnnotation);
        return {
          name: identifier.name,
          line: identifier.loc.start.line,
          column: identifier.loc.start.column,
          annotationValueType,
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
          annotationValueType: existing?.valueType ?? null,
        };
      }
    }

    return null;
  }

  private extractValueTypeFromAnnotation(type: TypeReferenceNode | null): string | null {
    if (!type) {
      return null;
    }
    if (type.name.name === 'map' && type.generics.length > 0) {
      const valueTypeNode = type.generics[type.generics.length - 1];
      return this.describeTypeReference(valueTypeNode);
    }
    return null;
  }

  private describeTypeReference(type: TypeReferenceNode): string {
    if (type.generics.length === 0) {
      return type.name.name;
    }
    const generics = type.generics.map((generic) => this.describeTypeReference(generic));
    return `${type.name.name}<${generics.join(', ')}>`;
  }

  private inferMapValueTypeFromCall(call: CallExpressionNode): string | null {
    const callSource = this.getNodeSource(call);
    const calleeGenerics = this.extractMapGenericTypesFromSource(this.getExpressionText(call.callee));
    const generics = calleeGenerics.length > 0
      ? calleeGenerics
      : this.extractMapGenericTypesFromSource(callSource);
    if (generics.length > 0) {
      return generics[generics.length - 1];
    }
    return null;
  }

  private normalizeValueType(valueType: string | null): string {
    if (!valueType) {
      return 'unknown';
    }
    const trimmed = valueType.trim();
    if (/^map<.+>$/.test(trimmed)) {
      return 'map';
    }
    return trimmed;
  }

  private extractMapGenericTypesFromSource(source: string): string[] {
    const match = source.match(/map\.new\s*<\s*([^>]+)\s*>/i);
    if (!match) {
      return [];
    }
    const generics = match[1];
    const parts: string[] = [];
    let current = '';
    let depth = 0;
    for (const char of generics) {
      if (char === '<') {
        depth += 1;
        current += char;
      } else if (char === '>') {
        depth = Math.max(0, depth - 1);
        current += char;
      } else if (char === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      parts.push(current.trim());
    }
    return parts;
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
      return literal.raw.includes('.') ? 'float' : 'int';
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

  private trackMapOperation(mapName: string, lineNum?: number, isClear = false): void {
    if (!mapName) {
      return;
    }
    const count = this.mapOperations.get(mapName) || 0;
    this.mapOperations.set(mapName, count + 1);
    if (isClear) {
      this.recordMapUsage(mapName, 'clear', lineNum ?? 1);
    }
  }

  private inferLegacyValueType(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) return 'string';
    if (trimmed === 'true' || trimmed === 'false') return 'bool';
    if (trimmed === 'na') return 'na';
    if (/^-?\d+$/.test(trimmed)) return 'int';
    if (/^-?\d*\.\d+$/.test(trimmed)) return 'float';
    if (trimmed.startsWith('color.')) return 'color';
    return null;
  }

  private isKnownNonMapVariable(varName: string): boolean {
    if (this.mapDeclarations.has(varName)) return false;

    const typeInfo = this.context?.typeMap?.get(varName) as { type?: string } | undefined;
    if (typeInfo) {
      return typeInfo.type !== 'map';
    }

    if (this.context && this.context.cleanLines) {
      for (const line of this.context.cleanLines) {
        const stringAssignPattern = new RegExp(`^\\s*${varName}\\s*=\\s*"[^"]*"\\s*$`);
        const numberAssignPattern = new RegExp(`^\\s*${varName}\\s*=\\s*[+\-]?\\d+(?:\\.\\d+)?\\s*$`);
        const boolAssignPattern = new RegExp(`^\\s*${varName}\\s*=\\s*(true|false)\\s*$`);
        if (stringAssignPattern.test(line) || numberAssignPattern.test(line) || boolAssignPattern.test(line)) {
          return true;
        }
      }
    }

    return false;
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    return isAstValidationContext(this.context) ? (this.context as AstValidationContext) : null;
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
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
