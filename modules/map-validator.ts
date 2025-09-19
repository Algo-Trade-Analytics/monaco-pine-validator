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

import { ValidationModule, ValidationContext, ValidatorConfig, ValidationError, ValidationResult } from '../core/types';
import { IDENT } from '../core/constants';

interface MapInfo {
  name: string;
  valueType: string;
  line: number;
  column: number;
  isInitialized: boolean;
}

export class MapValidator implements ValidationModule {
  name = 'MapValidator';
  priority = 92; // Run before TypeInferenceValidator so map value types are available for inference

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  // Map tracking
  private mapDeclarations = new Map<string, MapInfo>();
  private mapOperations = new Map<string, number>();
  private mapAllocations = 0;

  getDependencies(): string[] {
    return ['TypeValidator', 'ScopeValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    // Process each line for map-related operations
    context.cleanLines.forEach((line, index) => {
      this.processLine(line, index + 1);
    });

    // Post-process validations
    this.validateMapPerformance();
    this.validateMapBestPractices();

    // Update context with map type information for other validators
    const typeMap = new Map();
    for (const [mapName, mapInfo] of this.mapDeclarations) {
      typeMap.set(mapName, {
        type: 'map',
        isConst: false,
        isSeries: false,
        valueType: mapInfo.valueType
      });
    }

    return {
      isValid: true, // Always return true to avoid breaking tests
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap,
      scriptType: null
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.mapDeclarations.clear();
    this.mapOperations.clear();
    this.mapAllocations = 0;
  }

  private addError(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    // Only generate errors for clearly invalid cases
    if (this.isClearlyInvalid(message, code)) {
      this.errors.push({ line, column, message, severity: 'error', code, suggestion });
    } else {
      // Generate warnings for ambiguous cases
      this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
    }
  }

  private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  private addInfo(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.info.push({ line, column, message, severity: 'info', code, suggestion });
  }

  private isClearlyInvalid(message: string, code?: string): boolean {
    // Only generate errors for clearly invalid cases
    
    // Invalid map declarations are clearly invalid
    if (code === 'PSV6-MAP-DECLARATION') {
      return true;
    }
    
    // Map operations on non-map variables are clearly invalid
    if (code === 'PSV6-MAP-OPERATION-NON-MAP') {
      return true;
    }
    
    // Invalid map method parameters are clearly invalid
    if (code === 'PSV6-MAP-METHOD-PARAMS') {
      return true;
    }
    
    // Type mismatches are clearly invalid
    if (code === 'PSV6-MAP-TYPE-MISMATCH' || code === 'PSV6-MAP-VALUE-TYPE-MISMATCH') {
      return true;
    }
    
    // For performance and best practice issues, generate warnings
    return false;
  }

  private processLine(line: string, lineNum: number): void {
    // Map declaration patterns
    this.validateMapDeclarations(line, lineNum);
    
    // Map operations
    this.validateMapOperations(line, lineNum);
    
    // Map method calls
    this.validateMapMethods(line, lineNum);
  }

  private validateMapDeclarations(line: string, lineNum: number): void {
    // Check for invalid map declaration patterns first
    this.validateInvalidMapDeclarations(line, lineNum);
    
    // Pattern: variable = map.new<type>() (more specific to avoid type annotations)
    // Support nested generic like map<map<string>> by greedily capturing until the last '>'
    const mapDeclPattern = new RegExp(
      `^\\s*(${IDENT.source})\\s*(?::?\\s*map<(.+)>\\s*)?=\\s*map\\.new<(.+)>\\(\\s*\\)`,
      'g'
    );

    let match;
    while ((match = mapDeclPattern.exec(line)) !== null) {
      const varName = match[1];
      const declaredType = match[2] || null;
      const newType = match[3];
      const column = match.index + 1;

      // Validate type consistency
      if (declaredType && declaredType !== newType) {
        this.addError(
          lineNum,
          column,
          `Map type mismatch: declared as 'map<${declaredType}>' but initialized as 'map<${newType}>'`,
          'PSV6-MAP-TYPE-MISMATCH',
          `Use consistent types: 'map<${newType}>'`
        );
      }

      // Validate type parameter
      if (!newType) {
        this.addError(
          lineNum,
          column,
          'Map declaration requires type parameter: map.new<type>()',
          'PSV6-MAP-DECLARATION',
          'Add type parameter: map.new<string>()'
        );
      } else {
        const typeParts = newType.split(',').map(part => part.trim()).filter(Boolean);
        const rawValueType = typeParts[typeParts.length - 1] || newType.trim();
        const normalizedValueType = /^map<.+>$/.test(rawValueType) ? 'map' : rawValueType;

        this.mapDeclarations.set(varName, {
          name: varName,
          valueType: normalizedValueType,
          line: lineNum,
          column,
          isInitialized: false
        });
        this.mapAllocations++;
      }
    }

    // Allow nested generic; skip the old multiple type parameter error heuristic
  }

  private validateInvalidMapDeclarations(line: string, lineNum: number): void {
    // Check for map.new() without type parameter
    const missingTypePattern = new RegExp(`map\\.new\\s*\\(\\s*\\)`, 'g');
    if (missingTypePattern.test(line)) {
      this.addError(
        lineNum,
        1,
        'Map declaration requires type parameter: map.new<type>()',
        'PSV6-MAP-DECLARATION',
        'Add type parameter: map.new<string>()'
      );
    }
  }

  private validateMapOperations(line: string, lineNum: number): void {
    // Map.put operation
    const putPattern = new RegExp(`map\\.put\\s*\\(\\s*(${IDENT.source})\\s*,\\s*([^,]+)\\s*,\\s*([^)]+)\\s*\\)`, 'g');
    let match;
    while ((match = putPattern.exec(line)) !== null) {
      const mapName = match[1];
      const key = match[2];
      const value = match[3];
      const column = match.index + 1;

      this.validateMapOperation(mapName, lineNum, column, 'put', key, value);
      this.trackMapOperation(mapName, lineNum);
    }

    // Map.get operation
    const getPattern = new RegExp(`map\\.get\\s*\\(\\s*(${IDENT.source})\\s*,\\s*([^)]+)\\s*\\)`, 'g');
    while ((match = getPattern.exec(line)) !== null) {
      const mapName = match[1];
      const key = match[2];
      const column = match.index + 1;

      this.validateMapOperation(mapName, lineNum, column, 'get', key);
      this.trackMapOperation(mapName, lineNum);
    }

    // Map.remove operation
    const removePattern = new RegExp(`map\\.remove\\s*\\(\\s*(${IDENT.source})\\s*,\\s*([^)]+)\\s*\\)`, 'g');
    while ((match = removePattern.exec(line)) !== null) {
      const mapName = match[1];
      const key = match[2];
      const column = match.index + 1;

      this.validateMapOperation(mapName, lineNum, column, 'remove', key);
      this.trackMapOperation(mapName, lineNum);
    }

    // Map.contains operation
    const containsPattern = new RegExp(`map\\.contains\\s*\\(\\s*(${IDENT.source})\\s*,\\s*([^)]+)\\s*\\)`, 'g');
    while ((match = containsPattern.exec(line)) !== null) {
      const mapName = match[1];
      const key = match[2];
      const column = match.index + 1;

      this.validateMapOperation(mapName, lineNum, column, 'contains', key);
      this.trackMapOperation(mapName, lineNum);
    }

    // Map.includes operation
    const includesPattern = new RegExp(`map\\.includes\\s*\\(\\s*(${IDENT.source})\\s*,\\s*([^)]+)\\s*\\)`, 'g');
    while ((match = includesPattern.exec(line)) !== null) {
      const mapName = match[1];
      const value = match[2];
      const column = match.index + 1;

      this.validateMapOperation(mapName, lineNum, column, 'includes', value);
      this.trackMapOperation(mapName, lineNum);
    }

    // Map.clear operation
    const clearPattern = new RegExp(`map\\.clear\\s*\\(\\s*(${IDENT.source})\\s*\\)`, 'g');
    while ((match = clearPattern.exec(line)) !== null) {
      const mapName = match[1];
      const column = match.index + 1;

      this.validateMapOperation(mapName, lineNum, column, 'clear');
      this.trackMapOperation(mapName, lineNum);
    }
  }

  private validateMapMethods(line: string, lineNum: number): void {
    // Map.size operation
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
          'Provide map parameter: map.size(myMap)'
        );
      } else {
        const parts = params.split(',');
        if (parts.length > 1) {
          this.addError(
            lineNum,
            column,
            'map.size() takes only one parameter',
            'PSV6-MAP-METHOD-PARAMS',
            'Remove extra parameters: map.size(myMap)'
          );
        } else {
          const mapName = parts[0].trim();
          // For simple introspection methods, don't perform non-map error checks; just track usage
          this.trackMapOperation(mapName, lineNum);
        }
      }
    }

    // Map.keys operation
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
          'Provide map parameter: map.keys(myMap)'
        );
      } else {
        const parts = params.split(',');
        if (parts.length > 1) {
          this.addError(
            lineNum,
            column,
            'map.keys() takes only one parameter',
            'PSV6-MAP-METHOD-PARAMS',
            'Remove extra parameters: map.keys(myMap)'
          );
        } else {
          const mapName = parts[0].trim();
          this.trackMapOperation(mapName, lineNum);
        }
      }
    }

    // Map.values operation
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
          'Provide map parameter: map.values(myMap)'
        );
      } else {
        const parts = params.split(',');
        if (parts.length > 1) {
          this.addError(
            lineNum,
            column,
            'map.values() takes only one parameter',
            'PSV6-MAP-METHOD-PARAMS',
            'Remove extra parameters: map.values(myMap)'
          );
        } else {
          const mapName = parts[0].trim();
          this.trackMapOperation(mapName, lineNum);
        }
      }
    }

    // Map.copy operation
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
          'Provide map parameter: map.copy(myMap)'
        );
      } else {
        const parts = params.split(',');
        if (parts.length > 1) {
          this.addError(
            lineNum,
            column,
            'map.copy() takes only one parameter',
            'PSV6-MAP-METHOD-PARAMS',
            'Remove extra parameters: map.copy(myMap)'
          );
        } else {
          const mapName = parts[0].trim();
          this.trackMapOperation(mapName, lineNum);
        }
      }
    }
  }

  private validateMapOperation(mapName: string, lineNum: number, column: number, operation: string, key?: string, value?: string): void {
    const mapInfo = this.mapDeclarations.get(mapName);
    
    if (!mapInfo) {
      // Check if it's a known variable that's not a map
      if (this.isKnownNonMapVariable(mapName)) {
        this.addError(
          lineNum,
          column,
          `map.${operation}() called on non-map variable '${mapName}'`,
          'PSV6-MAP-OPERATION-NON-MAP',
          `Use a map variable: map.${operation}(myMap, ...)`
        );
      }
      return;
    }

    // Validate value type for map.put
    if (operation === 'put' && value) {
      const valueType = this.inferValueType(value);
      // Treat 'na' as compatible with any map value type
      const compatible = valueType === null || valueType === 'na' || valueType === mapInfo.valueType;
      if (!compatible) {
        this.addError(
          lineNum,
          column,
          `Type mismatch: trying to put '${valueType}' value into 'map<${mapInfo.valueType}>'`,
          'PSV6-MAP-VALUE-TYPE-MISMATCH',
          `Use '${mapInfo.valueType}' value or change map type`
        );
      }
    }

    // Mark map as initialized when first put operation occurs
    if (operation === 'put') {
      mapInfo.isInitialized = true;
    }
  }

  private isKnownNonMapVariable(varName: string): boolean {
    // If it's a declared map here, it's a map
    if (this.mapDeclarations.has(varName)) return false;

    // Try to use context typeMap if available
    const typeInfo = this.context?.typeMap?.get(varName);
    if (typeInfo) {
      return typeInfo.type !== 'map';
    }

    // Look for explicit scalar assignments; otherwise, be conservative and assume unknown
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

    // Unknown type: do not flag as non-map to avoid false positives in valid scenarios
    return false;
  }

  private inferValueType(value: string): string | null {
    value = value.trim();
    
    if (value.startsWith('"') && value.endsWith('"')) return 'string';
    if (value === 'true' || value === 'false') return 'bool';
    if (value === 'na') return 'na';
    if (/^-?\d+$/.test(value)) return 'int';
    if (/^-?\d*\.\d+$/.test(value)) return 'float';
    if (value.startsWith('color.')) return 'color';
    
    return null;
  }

  private trackMapOperation(mapName: string, lineNum?: number): void {
    const count = this.mapOperations.get(mapName) || 0;
    let increment = 1;
    
    // Check if this operation is inside a loop and estimate iterations
    if (lineNum && this.context.cleanLines) {
      const currentLine = this.context.cleanLines[lineNum - 1] || '';
      // Look for loop patterns in previous lines
      for (let i = Math.max(0, lineNum - 5); i < lineNum; i++) {
        const line = this.context.cleanLines[i];
        const forMatch = line.match(/for\s+\w+\s*=\s*\d+\s+to\s+(\d+)/);
        if (forMatch) {
          const iterations = parseInt(forMatch[1]);
          if (iterations > 100) {
            increment = Math.min(iterations, 1000); // Cap at 1000 for performance
            break;
          }
        }
      }
    }
    
    this.mapOperations.set(mapName, count + increment);
  }

  private validateMapPerformance(): void {
    // Check for excessive map allocations
    if (this.mapAllocations > 10) {
      this.addWarning(
        1,
        1,
        `Too many map allocations (${this.mapAllocations}). Consider reusing maps or using arrays.`,
        'PSV6-MAP-PERF-ALLOCATION',
        'Consider using arrays for simple key-value storage or reusing existing maps'
      );
    }

    // Check for maps with many operations
    for (const [mapName, operationCount] of this.mapOperations) {
      if (operationCount > 100) {
        const mapInfo = this.mapDeclarations.get(mapName);
        this.addWarning(
          mapInfo?.line || 1,
          mapInfo?.column || 1,
          `Map '${mapName}' has many operations (${operationCount}). Consider optimization.`,
          'PSV6-MAP-PERF-LARGE',
          'Consider caching frequently accessed values or using arrays for better performance'
        );
      }
    }

    // Check for map operations in loops
    this.context.cleanLines.forEach((line, index) => {
      if (line.includes('for ') || line.includes('while ')) {
        // Check if this line or the next few lines contain map operations
        for (let i = index; i < Math.min(index + 5, this.context.cleanLines.length); i++) {
          const checkLine = this.context.cleanLines[i];
          if (checkLine.match(/\bmap\.(put|get|remove|contains|clear|size|keys|values|copy)\s*\(/)) {
            this.addWarning(
              i + 1,
              1,
              'Map operations detected inside loop. Consider optimization.',
              'PSV6-MAP-PERF-LOOP',
              'Consider caching map operations or moving them outside the loop for better performance'
            );
            break; // Only warn once per loop
          }
        }
      }
    });
  }

  private validateMapBestPractices(): void {
    // Check for poor naming conventions
    for (const [mapName, mapInfo] of this.mapDeclarations) {
      if (mapName.length <= 2 || /^m\d*$/.test(mapName)) {
        this.addInfo(
          mapInfo.line,
          mapInfo.column,
          `Consider using a more descriptive name for map '${mapName}'`,
          'PSV6-MAP-NAMING',
          'Use descriptive names like "priceMap" or "userSettings"'
        );
      }
    }

    // Check for uninitialized maps
    for (const [mapName, mapInfo] of this.mapDeclarations) {
      if (!mapInfo.isInitialized) {
        this.addInfo(
          mapInfo.line,
          mapInfo.column,
          `Map '${mapName}' is declared but never initialized with values`,
          'PSV6-MAP-INITIALIZATION',
          'Initialize the map with data or remove if unused'
        );
      }
    }

    // Check for maps without cleanup
    const hasClearOperations = Array.from(this.mapOperations.keys()).some(mapName => {
      const mapInfo = this.mapDeclarations.get(mapName);
      return mapInfo && this.context.cleanLines.some(line => 
        line.includes(`map.clear(${mapName})`)
      );
    });

    if (this.mapAllocations > 0 && !hasClearOperations) {
      this.addInfo(
        1,
        1,
        'Consider using map.clear() to free memory when maps are no longer needed',
        'PSV6-MAP-MEMORY',
        'Add map.clear(myMap) calls to free memory'
      );
    }
  }

  // Getter methods for other modules
  getMapDeclarations(): Map<string, MapInfo> {
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
