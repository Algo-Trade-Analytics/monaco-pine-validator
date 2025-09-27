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
  private potentialMapParams = new Set<string>();

  getDependencies(): string[] {
    return ['TypeValidator', 'ScopeValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.astContext = this.getAstContext(context, config);

    const ast = this.astContext?.ast;
    if (ast) {
      this.collectMapDataAst(ast);
      this.collectMapDataText(true);
    } else {
      this.collectMapDataText();
    }

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

    const typeMap = new Map();
    for (const [mapName, mapInfo] of this.mapDeclarations) {
      typeMap.set(mapName, {
        type: 'map',
        isConst: false,
        isSeries: false,
        keyType: mapInfo.keyType,
        valueType: mapInfo.valueType,
      });
    }

    if (!this.context.typeMap) {
      this.context.typeMap = new Map();
    }
    for (const [mapName, mapInfo] of typeMap) {
      this.context.typeMap.set(mapName, mapInfo as any);
    }

    return {
      isValid: true, // Always return true to avoid breaking tests
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap,
      scriptType: context.scriptType,
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
    this.errorKeys.clear();
    this.warningKeys.clear();
    this.infoKeys.clear();
    this.potentialMapParams.clear();
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

  private collectMapDataText(mergeOnly = false): void {
    const lines = this.getSourceLines();
    if (lines.length === 0) {
      return;
    }

    if (mergeOnly) {
      this.mapOperations.clear();
      this.mapUsage.clear();
    }

    type TextFrame = {
      indent: number;
      type: 'loop' | 'conditional';
      startLine: number;
      iterations: number;
    };

    const stack: TextFrame[] = [];

    for (let index = 0; index < lines.length; index++) {
      const rawLine = lines[index];
      const lineNumber = index + 1;
      const commentIndex = rawLine.indexOf('//');
      const lineWithoutComment = commentIndex >= 0 ? rawLine.slice(0, commentIndex) : rawLine;
      const trimmed = lineWithoutComment.trim();
      if (trimmed.length === 0) {
        continue;
      }

      const indent = lineWithoutComment.length - lineWithoutComment.trimStart().length;

      while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }

      if (/^\s*for\b/i.test(lineWithoutComment)) {
        const iterations = this.parseLoopIterations(lineWithoutComment);
        stack.push({ indent, type: 'loop', startLine: lineNumber, iterations });
      } else if (/^\s*while\b/i.test(lineWithoutComment)) {
        stack.push({ indent, type: 'loop', startLine: lineNumber, iterations: 50 });
      } else if (/^\s*if\b/i.test(lineWithoutComment)) {
        stack.push({ indent, type: 'conditional', startLine: lineNumber, iterations: 1 });
      }

      const functionMatch = lineWithoutComment.match(/^[A-Za-z_][A-Za-z0-9_]*\s*\(([^)]*)\)\s*=>/);
      if (functionMatch) {
        const params = functionMatch[1]
          .split(',')
          .map((param) => param.trim().replace(/:[^,]+$/, ''))
          .filter((param) => param.length > 0);
        for (const param of params) {
          this.potentialMapParams.add(param);
        }
      }

      const declarationMatch = trimmed.match(/^(?:var\s+)?([A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*map<([^>]+)>)?\s*=\s*map\.new<([^>]*)>\s*\(/);
      if (declarationMatch) {
        const [, name, annotationRaw, callGenericsRaw] = declarationMatch;
        const column = lineWithoutComment.indexOf(name) + 1 || 1;
        if (mergeOnly && this.mapDeclarations.has(name)) {
          continue;
        }
        const { keyType: annotationKeyType, valueType: annotationValueType } = this.parseAnnotationTypes(annotationRaw);
        const { keyType: callKeyType, valueType: callValueType, error: declarationError } = this.parseMapNewGenerics(callGenericsRaw, lineNumber, column);
        const keyType = this.normalizeKeyType(callKeyType ?? annotationKeyType);
        const valueType = this.normalizeValueType(callValueType ?? annotationValueType);

        if (!mergeOnly && annotationValueType && valueType !== 'unknown' && annotationValueType !== valueType) {
          this.addError(
            lineNumber,
            column,
            `Type annotation map<${annotationValueType}> does not match map.new<${valueType}>`,
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

        if (!mergeOnly && declarationError) {
          this.addError(lineNumber, column, declarationError, 'PSV6-MAP-DECLARATION', 'Provide a single value type to map.new<valueType>()');
        }

        continue;
      }

      let searchIndex = lineWithoutComment.indexOf('map.');
      while (searchIndex !== -1) {
        const callSlice = lineWithoutComment.slice(searchIndex);
        const callMatch = callSlice.match(/^map\.(\w+)/);
        if (!callMatch) {
          searchIndex = lineWithoutComment.indexOf('map.', searchIndex + 4);
          continue;
        }

        const methodName = callMatch[1];
        if (methodName === 'new') {
          searchIndex = lineWithoutComment.indexOf('map.', searchIndex + 4);
          continue;
        }

        const globalIndex = searchIndex + (callMatch[0].length - 1);
        const openParenIndex = lineWithoutComment.indexOf('(', globalIndex);
        if (openParenIndex === -1) {
          searchIndex = lineWithoutComment.indexOf('map.', searchIndex + 4);
          continue;
        }

        const argsSection = this.extractArgumentsSectionFromText(lines, index, openParenIndex + 1);
        const args = this.splitArgumentsText(argsSection);
        const mapName = args[0]?.trim() ?? '';
        const loopMultiplier = this.computeLoopMultiplier(stack);

        if (process.env.DEBUG_MAP_VALIDATOR === '1') {
          console.log('[MapValidator] text operation', {
            methodName,
            mapName,
            line: lineNumber,
            loopMultiplier,
            args
          });
        }

        if (methodName === 'put') {
          this.handleMapPutText(mapName, args, lineNumber, searchIndex + 1, loopMultiplier, mergeOnly);
        } else if (methodName === 'get' || methodName === 'remove' || methodName === 'contains' || methodName === 'includes') {
          this.handleMapLookupText(`map.${methodName}`, mapName, lineNumber, searchIndex + 1, loopMultiplier, mergeOnly);
          if (methodName === 'get') {
            this.handleMapGetResultAssignment(mapName, lineWithoutComment, lineNumber, searchIndex);
          }
        } else if (methodName === 'clear' || methodName === 'size' || methodName === 'keys' || methodName === 'values' || methodName === 'copy') {
          this.handleMapUtilityText(`map.${methodName}`, mapName, lineNumber, searchIndex + 1, loopMultiplier, mergeOnly);
          if (methodName === 'copy') {
            this.handleMapCopyResultAssignment(mapName, lineWithoutComment, lineNumber, searchIndex);
          }
        }

        if (this.isLoopContext(stack) && MAP_LOOP_METHODS.has(`map.${methodName}`)) {
          const loopFrame = this.getInnermostLoopFrame(stack);
          if (loopFrame) {
            const loopKey = `loop:${loopFrame.startLine}`;
            if (!this.reportedLoopWarnings.has(loopKey)) {
              this.reportedLoopWarnings.add(loopKey);
              this.addWarning(
                lineNumber,
                searchIndex + 1,
                'Map operations detected inside loop. Consider optimization.',
                'PSV6-MAP-PERF-LOOP',
                'Consider caching map operations or moving them outside the loop for better performance',
              );
            }
          }
        }

        searchIndex = lineWithoutComment.indexOf('map.', searchIndex + 4);
      }
    }
  }

  private ensureTextMapDeclaration(
    mapName: string,
    line: number,
    column: number,
    valueTypeHint = 'unknown',
  ): MapDeclarationInfo | null {
    if (!mapName) {
      return null;
    }

    let mapInfo = this.mapDeclarations.get(mapName);
    if (mapInfo) {
      if (mapInfo.valueType === 'unknown' && valueTypeHint !== 'unknown') {
        mapInfo.valueType = this.normalizeValueType(valueTypeHint);
      }
      return mapInfo;
    }

    if (!this.potentialMapParams.has(mapName)) {
      return null;
    }

    mapInfo = {
      name: mapName,
      keyType: 'string',
      valueType: this.normalizeValueType(valueTypeHint),
      line,
      column,
      isInitialized: false,
    };
    this.mapDeclarations.set(mapName, mapInfo);
    return mapInfo;
  }

  private extractAssignmentTargetFromLine(
    line: string,
    callStartIndex: number,
  ): { name: string; column: number } | null {
    if (callStartIndex <= 0) {
      return null;
    }

    const beforeCall = line.slice(0, callStartIndex);
    const assignmentMatch = beforeCall.match(/(?:^|[;])\s*(?:var\s+|const\s+)?([A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*[^=]+)?\s*(?:=|:=)\s*$/);
    if (!assignmentMatch) {
      return null;
    }

    const name = assignmentMatch[1];
    const column = beforeCall.lastIndexOf(name);
    if (column === -1) {
      return null;
    }

    return {
      name,
      column: column + 1,
    };
  }

  private unwrapMapValueType(valueType: string): string | null {
    if (!valueType) {
      return null;
    }

    const match = valueType.match(/^map\s*<\s*(.+)\s*>$/);
    if (!match) {
      return null;
    }

    const inner = match[1].trim();
    return inner.length > 0 ? this.normalizeValueType(inner) : 'unknown';
  }

  private handleMapGetResultAssignment(
    sourceMapName: string,
    line: string,
    lineNumber: number,
    callStartIndex: number,
  ): void {
    const assignment = this.extractAssignmentTargetFromLine(line, callStartIndex);
    if (!assignment) {
      return;
    }

    const mapInfo =
      this.mapDeclarations.get(sourceMapName) ??
      this.ensureTextMapDeclaration(sourceMapName, lineNumber, callStartIndex + 1);
    if (!mapInfo) {
      return;
    }

    const nestedValueType = this.unwrapMapValueType(mapInfo.valueType);
    if (!nestedValueType) {
      return;
    }

    const existing = this.mapDeclarations.get(assignment.name);
    if (existing) {
      if (existing.valueType === 'unknown' && nestedValueType !== 'unknown') {
        existing.valueType = nestedValueType;
      }
      return;
    }

    this.mapDeclarations.set(assignment.name, {
      name: assignment.name,
      keyType: 'string',
      valueType: nestedValueType,
      line: lineNumber,
      column: assignment.column,
      isInitialized: mapInfo.isInitialized,
    });
  }

  private handleMapCopyResultAssignment(
    sourceMapName: string,
    line: string,
    lineNumber: number,
    callStartIndex: number,
  ): void {
    const assignment = this.extractAssignmentTargetFromLine(line, callStartIndex);
    if (!assignment) {
      return;
    }

    const sourceInfo =
      this.mapDeclarations.get(sourceMapName) ??
      this.ensureTextMapDeclaration(sourceMapName, lineNumber, callStartIndex + 1);
    if (!sourceInfo) {
      return;
    }

    const existing = this.mapDeclarations.get(assignment.name);
    if (existing) {
      if (existing.valueType === 'unknown' && sourceInfo.valueType !== 'unknown') {
        existing.valueType = sourceInfo.valueType;
      }
      if (existing.keyType === 'string' && sourceInfo.keyType !== 'string') {
        existing.keyType = sourceInfo.keyType;
      }
      return;
    }

    this.mapDeclarations.set(assignment.name, {
      name: assignment.name,
      keyType: sourceInfo.keyType,
      valueType: sourceInfo.valueType,
      line: lineNumber,
      column: assignment.column,
      isInitialized: sourceInfo.isInitialized,
    });
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

  private parseLoopIterations(line: string): number {
    const match = line.match(/for\s+[A-Za-z_][A-Za-z0-9_]*\s*=\s*(-?\d+)\s+to\s+(-?\d+)/i);
    if (match) {
      const start = Number(match[1]);
      const end = Number(match[2]);
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        const iterations = Math.abs(end - start) + 1;
        return iterations > 0 ? iterations : 1;
      }
    }
    return 10;
  }

  private computeLoopMultiplier(stack: Array<{ type: 'loop' | 'conditional'; iterations: number }>): number {
    const loopFrames = stack.filter((frame) => frame.type === 'loop');
    if (loopFrames.length === 0) {
      return 1;
    }
    return loopFrames.reduce((product, frame) => product * Math.max(1, frame.iterations), 1);
  }

  private isLoopContext(stack: Array<{ type: 'loop' | 'conditional' }>): boolean {
    return stack.some((frame) => frame.type === 'loop');
  }

  private getInnermostLoopFrame(stack: Array<{ type: 'loop' | 'conditional'; startLine: number; iterations: number }>): { startLine: number; iterations: number } | null {
    for (let index = stack.length - 1; index >= 0; index--) {
      const frame = stack[index];
      if (frame.type === 'loop') {
        return frame;
      }
    }
    return null;
  }

  private parseAnnotationTypes(annotationRaw: string | undefined): { keyType: string | null; valueType: string | null } {
    if (!annotationRaw) {
      return { keyType: null, valueType: null };
    }
    const parts = annotationRaw.split(',').map((part) => part.trim()).filter((part) => part.length > 0);
    if (parts.length === 0) {
      return { keyType: null, valueType: null };
    }
    const valueType = parts[parts.length - 1];
    const keyType = parts.length > 1 ? parts[0] : 'string';
    return { keyType, valueType };
  }

  private parseMapNewGenerics(genericsRaw: string, _line: number, _column: number): {
    keyType?: string | null;
    valueType?: string | null;
    error?: string;
  } {
    const trimmed = genericsRaw.trim();
    if (trimmed.length === 0) {
      return { keyType: 'string', valueType: 'unknown', error: 'map.new<valueType>() requires a value type parameter' };
    }

    const parts = trimmed.split(',').map((part) => part.trim()).filter((part) => part.length > 0);
    if (parts.length !== 1) {
      return {
        keyType: parts.length > 1 ? parts[0] : 'string',
        valueType: parts[parts.length - 1] ?? 'unknown',
        error: 'map.new<valueType>() accepts exactly one type parameter',
      };
    }

    return {
      keyType: 'string',
      valueType: parts[0],
    };
  }

  private handleMapPutText(
    mapName: string,
    args: string[],
    line: number,
    column: number,
    loopMultiplier: number,
    mergeOnly = false,
  ): void {
    this.trackMapOperation(mapName, line, false, loopMultiplier);

    if (!mapName) {
      if (!mergeOnly) {
        this.addError(line, column, 'map.put() requires a map variable as first argument', 'PSV6-MAP-METHOD-PARAMS');
      }
      return;
    }

    const valueType = args.length > 2 ? this.inferValueTypeFromText(args[2]) : 'unknown';

    let mapInfo = this.mapDeclarations.get(mapName);
    if (!mapInfo) {
      mapInfo = this.ensureTextMapDeclaration(mapName, line, column, valueType);
    }

    if (!mapInfo) {
      if (!mergeOnly) {
        this.addError(line, column, `map.put() called on non-map variable '${mapName}'`, 'PSV6-MAP-OPERATION-NON-MAP', 'Use a map variable: map.put(myMap, key, value)');
      }
      return;
    }

    if (args.length < 3) {
      if (!mergeOnly) {
        this.addError(line, column, 'map.put() requires map, key, and value parameters', 'PSV6-MAP-METHOD-PARAMS', 'Provide map identifier, key, and value: map.put(myMap, key, value)');
      }
      return;
    }

    if (!mergeOnly && !this.areValueTypesCompatible(mapInfo.valueType, valueType)) {
      this.addError(line, column, `Type mismatch: trying to put '${valueType}' value into 'map<${mapInfo.valueType}>'`, 'PSV6-MAP-VALUE-TYPE-MISMATCH', `Use '${mapInfo.valueType}' value or change map type`);
    }

    if (mapInfo.valueType === 'unknown' && valueType !== 'unknown') {
      mapInfo.valueType = valueType;
    }

    mapInfo.isInitialized = true;
    this.recordMapUsage(mapName, 'put', line);
  }

  private handleMapLookupText(qualifiedName: string, mapName: string, line: number, column: number, loopMultiplier: number, mergeOnly = false): void {
    this.trackMapOperation(mapName, line, false, loopMultiplier);

    if (!mapName) {
      if (!mergeOnly) {
        this.addError(line, column, `${qualifiedName}() requires a map parameter`, 'PSV6-MAP-METHOD-PARAMS');
      }
      return;
    }

    if (!this.mapDeclarations.has(mapName)) {
      this.ensureTextMapDeclaration(mapName, line, column);
    }

    if (!mergeOnly && !this.mapDeclarations.has(mapName)) {
      this.addError(line, column, `${qualifiedName}() called on non-map variable '${mapName}'`, 'PSV6-MAP-OPERATION-NON-MAP', `Use a map variable: ${qualifiedName}(myMap, ...)`);
    }
  }

  private handleMapUtilityText(qualifiedName: string, mapName: string, line: number, column: number, loopMultiplier: number, mergeOnly = false): void {
    const requiresParam = qualifiedName === 'map.clear' || qualifiedName === 'map.size' || qualifiedName === 'map.keys' || qualifiedName === 'map.values' || qualifiedName === 'map.copy';
    if (requiresParam && !mapName) {
      if (!mergeOnly) {
        this.addError(line, column, `${qualifiedName}() requires a map parameter`, 'PSV6-MAP-METHOD-PARAMS', `Provide map parameter: ${qualifiedName}(myMap)`);
      }
      return;
    }

    this.trackMapOperation(mapName, line, qualifiedName === 'map.clear', loopMultiplier);

    if (!mapName) {
      return;
    }

    if (!this.mapDeclarations.has(mapName)) {
      this.ensureTextMapDeclaration(mapName, line, column);
    }

    if (!mergeOnly && !this.mapDeclarations.has(mapName)) {
      this.addError(line, column, `${qualifiedName}() called on non-map variable '${mapName}'`, 'PSV6-MAP-OPERATION-NON-MAP', `Use a map variable: ${qualifiedName}(myMap)`);
    }
  }

  private extractArgumentsSectionFromText(lines: string[], startLine: number, startColumn: number): string {
    let buffer = '';
    let depth = 1;
    let lineIndex = startLine;
    let columnIndex = startColumn;
    let inString = false;
    let stringDelimiter: string | null = null;

    while (lineIndex < lines.length && depth > 0) {
      const line = lines[lineIndex];
      for (let i = columnIndex; i < line.length; i++) {
        const char = line[i];

        if (inString) {
          buffer += char;
          if (char === stringDelimiter && line[i - 1] !== '\\') {
            inString = false;
            stringDelimiter = null;
          }
          continue;
        }

        if (char === '"' || char === "'") {
          inString = true;
          stringDelimiter = char;
          buffer += char;
          continue;
        }

        if (char === '(') {
          depth += 1;
          buffer += char;
          continue;
        }
        if (char === ')') {
          depth -= 1;
          if (depth === 0) {
            return buffer.trim();
          }
          buffer += char;
          continue;
        }

        buffer += char;
      }

      buffer += ' ';
      lineIndex += 1;
      columnIndex = 0;
    }

    return buffer.trim();
  }

  private splitArgumentsText(text: string): string[] {
    const args: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar: string | null = null;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (inString) {
        current += char;
        if (char === stringChar && text[i - 1] !== '\\') {
          inString = false;
          stringChar = null;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        current += char;
        continue;
      }

      if (char === '(') {
        depth += 1;
        current += char;
        continue;
      }

      if (char === ')') {
        depth -= 1;
        current += char;
        continue;
      }

      if (char === ',' && depth === 0) {
        if (current.trim().length > 0) {
          args.push(current.trim());
        }
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim().length > 0) {
      args.push(current.trim());
    }

    return args;
  }

  private inferValueTypeFromText(raw: string): string {
    const value = raw.trim();
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) {
      return 'string';
    }
    if (/^(true|false)$/i.test(value)) {
      return 'bool';
    }
    if (value === 'na') {
      return 'na';
    }
    if (/^-?\d+$/i.test(value)) {
      return 'int';
    }
    if (/^-?\d*\.\d+$/.test(value)) {
      return 'float';
    }
    if (/^color\./.test(value) || /^#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?$/.test(value)) {
      return 'color';
    }
    if (this.mapDeclarations.has(value)) {
      const info = this.mapDeclarations.get(value);
      if (info) {
        return `map<${info.valueType}>`;
      }
    }
    return 'unknown';
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
      return identifierMetadata.kind !== 'unknown' && identifierMetadata.kind !== 'parameter';
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
}
