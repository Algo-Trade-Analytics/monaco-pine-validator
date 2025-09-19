/**
 * Array validation module for Pine Script v6
 * Handles array declarations, operations, performance, and best practices
 */

import { ValidationModule, ValidationContext, ValidationResult, ValidatorConfig } from '../core/types';

export class ArrayValidator implements ValidationModule {
  name = 'ArrayValidator';
  
  private errors: Array<{ line: number; column: number; message: string; code: string }> = [];
  private warnings: Array<{ line: number; column: number; message: string; code: string }> = [];
  private info: Array<{ line: number; column: number; message: string; code: string }> = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  // Array tracking
  private arrayDeclarations = new Map<string, { type: string; size: number; line: number; elementType: string }>();
  private arrayAllocations = 0;
  private arrayOperations = 0;

  getDependencies(): string[] {
    return ['FunctionValidator'];
  }

  getPriority(): number {
    return 80; // Run after FunctionValidator to benefit from function type information
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.validateArrayDeclarations();
    this.validateArrayOperations();
    this.validateArrayTypeConsistency();
    this.validateArrayPerformance();
    this.validateArrayBestPractices();

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
    this.arrayDeclarations.clear();
    this.arrayAllocations = 0;
    this.arrayOperations = 0;
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

  private validateArrayDeclarations(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for array.new declarations
      this.validateArrayNewDeclaration(line, lineNum);
      
      // Check for array type annotations
      this.validateArrayTypeAnnotation(line, lineNum);
    }
  }

  private validateArrayNewDeclaration(line: string, lineNum: number): void {
    // Match both generic syntax: array.new<type>([size[, initial]]) and old syntax: array.new(type, size[, initial])
    // Also support typed convenience constructors: array.new_float(), array.new_string(), etc.
    // Allow empty constructor: array.new<type>()
    const typedConstructorMatch = line.match(/array\.new_(bool|box|color|float|int|label|line|linefill|string|table)\s*\(([^)]*)\)/);
    if (typedConstructorMatch) {
      const [, elemType, argsSection] = typedConstructorMatch;
      const args = this.splitTopLevelArgs(argsSection || '');
      const sizeArg = args[0]?.trim();
      const size = sizeArg && /^[-+]?\d+$/.test(sizeArg) ? parseInt(sizeArg, 10) : 0;

      this.validateArrayType(elemType, lineNum);
      if (sizeArg && /^[-+]?\d+$/.test(sizeArg)) {
        this.validateArraySize(size, lineNum);
      }

      this.arrayAllocations++;

      const varMatch = line.match(/^\s*(?:var|varip)?\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*array\.new_/);
      if (varMatch) {
        const varName = varMatch[1];
        this.arrayDeclarations.set(varName, { type: elemType, size, line: lineNum, elementType: elemType });
        this.context.typeMap.set(varName, {
          type: 'array',
          isConst: false,
          isSeries: false,
          declaredAt: { line: lineNum, column: 1 },
          usages: [],
          elementType: elemType
        });
      }
      return;
    }

    const genericMatch = line.match(/array\.new<([^>]+)>\s*\(\s*(?:([0-9]+)\s*(?:,\s*(.+))?)?\)/);
    const oldMatch = line.match(/array\.new\s*\(\s*([^,)]+)\s*,\s*(\d+)(?:\s*,\s*(.+))?\)/);
    
    if (genericMatch) {
      const [_, type, sizeStr, initialValue] = genericMatch;
      const size = sizeStr ? parseInt(sizeStr, 10) : 0;
      
      this.validateArrayType(type, lineNum);
      if (sizeStr) this.validateArraySize(size, lineNum);
      this.arrayAllocations++;
      
      // Extract variable name if this is an assignment
      const varMatch = line.match(/^\s*(?:var|varip)?\s*(?:array<[^>]+>|[A-Za-z_][A-Za-z0-9_]*\[\])?\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*array\.new/);
      if (varMatch) {
        const varName = varMatch[1];
        this.arrayDeclarations.set(varName, { type, size, line: lineNum, elementType: type });
        
        // Store in context typeMap
        this.context.typeMap.set(varName, {
          type: 'array',
          isConst: false,
          isSeries: false,
          declaredAt: { line: lineNum, column: 1 },
          usages: [],
          elementType: type
        });
      }
    } else if (oldMatch) {
      const [_, type, sizeStr, initialValue] = oldMatch;
      const size = parseInt(sizeStr, 10);
      
      this.validateArrayType(type, lineNum);
      this.validateArraySize(size, lineNum);
      this.arrayAllocations++;
      
      // Extract variable name if this is an assignment
      const varMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*array\.new/);
      if (varMatch) {
        const varName = varMatch[1];
        this.arrayDeclarations.set(varName, { type, size, line: lineNum, elementType: type });
        
        // Store in context typeMap
        this.context.typeMap.set(varName, {
          type: 'array',
          isConst: false,
          isSeries: false,
          declaredAt: { line: lineNum, column: 1 },
          usages: []
        });
      }
    } else if (line.includes('array.new')) {
      // Invalid syntax
      this.addError(lineNum, 1, 'Invalid array.new syntax. Use array.new<type>(size) or array.new(type, size)', 'PSV6-ARRAY-INVALID-SYNTAX');
    }
  }

  private validateArrayTypeAnnotation(line: string, lineNum: number): void {
    // Check for array<type> variable declarations
    const arrayTypeMatch = line.match(/^\s*array<([^>]+)>\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (arrayTypeMatch) {
      const [_, type, varName] = arrayTypeMatch;
      this.validateArrayType(type, lineNum);
      
      // Store in context typeMap
      this.context.typeMap.set(varName, {
        type: 'array',
        isConst: false,
        isSeries: false,
        declaredAt: { line: lineNum, column: 1 },
        usages: [],
        elementType: type
      });
    }

    // Support typed drawing arrays like: var line[] lines = ... or line[] lines = ...
    const drawingArrayMatch = line.match(/^\s*(?:var|varip)?\s*(line|label|box|table)\[\]\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (drawingArrayMatch) {
      const [, elemType, varName] = drawingArrayMatch;
      this.arrayDeclarations.set(varName, { type: elemType, size: 0, line: lineNum, elementType: elemType });
      this.context.typeMap.set(varName, {
        type: 'array',
        isConst: false,
        isSeries: false,
        declaredAt: { line: lineNum, column: 1 },
        usages: [],
        elementType: elemType
      });
    }
  }

  private validateArrayType(type: string, lineNum: number): void {
    const validTypes = ['int', 'float', 'bool', 'string', 'color', 'line', 'label', 'box', 'table', 'linefill', 'chart.point'];
    const typeInfo = this.context.typeMap.get(type);
    const isUDT = typeInfo?.type === 'udt';

    if (!validTypes.includes(type) && !isUDT) {
      this.addError(lineNum, 1, `Invalid array type: ${type}. Valid types are: ${validTypes.join(', ')}`, 'PSV6-ARRAY-INVALID-TYPE');
    }
  }

  private validateArraySize(size: number, lineNum: number): void {
    // Allow zero-size arrays (common initialization pattern)
    if (size < 0) {
      this.addError(lineNum, 1, `Array size must be non-negative, got: ${size}`, 'PSV6-ARRAY-INVALID-SIZE');
    } else if (size > 100000) {
      this.addError(lineNum, 1, `Array size (${size}) exceeds the maximum limit of 100,000`, 'PSV6-ARRAY-SIZE-LIMIT');
    }
  }

  private validateArrayOperations(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for array method calls
      this.validateArrayMethodCalls(line, lineNum);
      
      // Check for array index operations
      this.validateArrayIndexOperations(line, lineNum);
    }
  }

  private validateArrayMethodCalls(line: string, lineNum: number): void {
    // Array method patterns
    const arrayMethods: Array<{ name: string; params?: number; description: string }> = [
      { name: 'array.push', params: 2, description: 'array.push(id, value)' },
      { name: 'array.pop', params: 1, description: 'array.pop(id)' },
      { name: 'array.get', params: 2, description: 'array.get(id, index)' },
      { name: 'array.set', params: 3, description: 'array.set(id, index, value)' },
      { name: 'array.size', params: 1, description: 'array.size(id)' },
      { name: 'array.clear', params: 1, description: 'array.clear(id)' },
      { name: 'array.reverse', params: 1, description: 'array.reverse(id)' },
      { name: 'array.sort', params: 1, description: 'array.sort(id)' },
      { name: 'array.sort_indices', params: 1, description: 'array.sort_indices(id)' },
      { name: 'array.copy', params: 1, description: 'array.copy(id)' },
      { name: 'array.slice', params: 3, description: 'array.slice(id, start, end)' },
      { name: 'array.concat', params: 2, description: 'array.concat(id, other)' },
      { name: 'array.fill', params: 2, description: 'array.fill(id, value)' },
      { name: 'array.from', description: 'array.from(source, ...values)' },
      { name: 'array.from_example', description: 'array.from_example(id, example)' },
      { name: 'array.indexof', params: 2, description: 'array.indexof(id, value)' },
      { name: 'array.lastindexof', params: 2, description: 'array.lastindexof(id, value)' },
      { name: 'array.binary_search', description: 'array.binary_search(id, value, comparator?)' },
      { name: 'array.binary_search_leftmost', description: 'array.binary_search_leftmost(id, value)' },
      { name: 'array.binary_search_rightmost', description: 'array.binary_search_rightmost(id, value)' },
      { name: 'array.range', params: 3, description: 'array.range(id, start, end)' },
      { name: 'array.remove', params: 2, description: 'array.remove(id, index)' },
      { name: 'array.insert', params: 3, description: 'array.insert(id, index, value)' },
      { name: 'array.first', params: 1, description: 'array.first(id)' },
      { name: 'array.last', params: 1, description: 'array.last(id)' },
      { name: 'array.max', params: 1, description: 'array.max(id)' },
      { name: 'array.min', params: 1, description: 'array.min(id)' },
      { name: 'array.median', params: 1, description: 'array.median(id)' },
      { name: 'array.mode', params: 1, description: 'array.mode(id)' },
      { name: 'array.abs', params: 1, description: 'array.abs(id)' },
      { name: 'array.sum', params: 1, description: 'array.sum(id)' },
      { name: 'array.avg', params: 1, description: 'array.avg(id)' },
      { name: 'array.stdev', params: 1, description: 'array.stdev(id)' },
      { name: 'array.variance', params: 1, description: 'array.variance(id)' },
      { name: 'array.standardize', params: 1, description: 'array.standardize(id)' },
      { name: 'array.covariance', params: 2, description: 'array.covariance(id, other)' },
      { name: 'array.percentile_linear_interpolation', description: 'array.percentile_linear_interpolation(id, percentile)' },
      { name: 'array.percentile_nearest_rank', description: 'array.percentile_nearest_rank(id, percentile)' },
      { name: 'array.percentrank', description: 'array.percentrank(id, percentile)' },
      { name: 'array.some', params: 2, description: 'array.some(id, predicate)' },
      { name: 'array.every', params: 2, description: 'array.every(id, predicate)' }
    ];

    for (const method of arrayMethods) {
      const methodRegex = new RegExp(`\\b${method.name.replace('.', '\\.')}\\s*\\(`);
      if (methodRegex.test(line)) {
        this.arrayOperations++;
        
        // Extract method call
        const methodCallMatch = line.match(new RegExp(`\\b${method.name.replace('.', '\\.')}\\s*\\(([^)]*)\\)`));
        if (methodCallMatch) {
          const params = this.splitTopLevelArgs(methodCallMatch[1]);
          
          // Validate parameter count
          if (typeof method.params === 'number' && params.length !== method.params) {
            this.addError(lineNum, 1, `Invalid parameter count for ${method.name}. Expected ${method.params}, got ${params.length}. Usage: ${method.description}`, 'PSV6-ARRAY-METHOD-PARAMS');
          }
          
          // Validate array variable for methods that take array as first parameter
          if (params.length > 0) {
            const arrayVar = params[0];
            this.validateArrayVariable(arrayVar, lineNum);
          }
        }
      }
    }
  }

  // Split by commas at top level only (ignore commas inside nested parens/strings)
  private splitTopLevelArgs(s: string): string[] {
    const out: string[] = [];
    let current = '';
    let depth = 0;
    let inStr = false;
    let strCh = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (!inStr && (ch === '"' || ch === '\'')) { inStr = true; strCh = ch; current += ch; continue; }
      if (inStr) { current += ch; if (ch === strCh) { inStr = false; strCh = ''; } continue; }
      if (ch === '(') { depth++; current += ch; continue; }
      if (ch === ')') { depth--; current += ch; continue; }
      if (ch === ',' && depth === 0) { out.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    if (current.trim()) out.push(current.trim());
    return out;
  }

  private validateArrayIndexOperations(line: string, lineNum: number): void {
    // Check for array.get and array.set with index validation
    const getMatch = line.match(/array\.get\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/);
    const setMatch = line.match(/array\.set\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^)]+)\s*\)/);
    
    if (getMatch) {
      const [_, arrayVar, index] = getMatch;
      this.validateArrayIndex(arrayVar, index, lineNum);
    }
    
    if (setMatch) {
      const [_, arrayVar, index] = setMatch;
      this.validateArrayIndex(arrayVar, index, lineNum);
    }
  }

  private validateArrayVariable(arrayVar: string, lineNum: number): void {
    // Check if variable is declared as an array
    const arrayInfo = this.arrayDeclarations.get(arrayVar);
    const typeInfo = this.context.typeMap.get(arrayVar);
    
    // If it's in arrayDeclarations, it's definitely an array
    if (arrayInfo) {
      return;
    }
    
    // If it's in typeMap, check if the type is 'array'
    if (typeInfo && typeInfo.type === 'array') {
      return;
    }
    
    // Skip validation for function parameters (they might be arrays passed from outside)
    // This is a limitation - we can't always determine function parameter types
    if (this.isLikelyFunctionParameter(arrayVar, lineNum)) {
      return;
    }
    
    // If it's not declared at all, or not declared as an array, it's an error
    this.addError(lineNum, 1, `Variable '${arrayVar}' is not declared as an array`, 'PSV6-ARRAY-NOT-ARRAY');
  }

  private isLikelyFunctionParameter(varName: string, lineNum: number): boolean {
    // Check if we're inside a function definition
    // Look backwards from current line to find function definition
    for (let i = lineNum - 1; i >= 0; i--) {
      const line = this.context.cleanLines[i];
      // Check for function definition pattern: functionName(param1, param2) =>
      const funcMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*=>/);
      if (funcMatch) {
        // We're inside a function, so this variable could be a parameter
        return true;
      }
      // If we hit a non-indented line, we're not in a function anymore
      if (line.trim() && !line.match(/^\s/)) {
        break;
      }
    }
    return false;
  }

  private validateArrayIndex(arrayVar: string, index: string, lineNum: number): void {
    const arrayInfo = this.arrayDeclarations.get(arrayVar);
    if (arrayInfo) {
      // Check for literal index values
      const indexMatch = index.match(/^\s*(\d+)\s*$/);
      if (indexMatch) {
        const indexValue = parseInt(indexMatch[1], 10);
        if (indexValue < 0 || indexValue >= arrayInfo.size) {
          this.addWarning(lineNum, 1, `Array index ${indexValue} is out of bounds for array of size ${arrayInfo.size}`, 'PSV6-ARRAY-INDEX-BOUNDS');
        }
      }
      
      // Check for negative indices that are too large
      const negativeMatch = index.match(/^\s*-\s*(\d+)\s*$/);
      if (negativeMatch) {
        const negativeValue = parseInt(negativeMatch[1], 10);
        if (negativeValue > arrayInfo.size) {
          this.addWarning(lineNum, 1, `Negative array index -${negativeValue} is out of bounds for array of size ${arrayInfo.size}`, 'PSV6-ARRAY-INDEX-BOUNDS');
        }
      }
    }
  }

  private validateArrayTypeConsistency(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for array.push operations with type mismatches
      const pushMatch = line.match(/array\.push\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/);
      if (pushMatch) {
        const [_, arrayVar, value] = pushMatch;
        this.validateArrayPushType(arrayVar.trim(), value.trim(), lineNum);
      }

      // Check for array.set operations with type mismatches
      const setMatch = line.match(/array\.set\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^)]+)\s*\)/);
      if (setMatch) {
        const [_, arrayVar, index, value] = setMatch;
        this.validateArraySetType(arrayVar.trim(), value.trim(), lineNum);
      }
    }
  }

  private validateArrayPushType(arrayVar: string, value: string, lineNum: number): void {
    const arrayInfo = this.arrayDeclarations.get(arrayVar);
    if (!arrayInfo) return;

    const valueType = this.inferValueType(value);
    if (!valueType || valueType === 'unknown' || arrayInfo.elementType === 'unknown') {
      return; // Defer until type inference can provide stronger signal
    }
    if (!this.areTypesCompatible(arrayInfo.elementType, valueType)) {
      this.addError(lineNum, 1, `Type mismatch: cannot push ${valueType} to ${arrayInfo.elementType} array '${arrayVar}'`, 'PSV6-ARRAY-TYPE-MISMATCH');
    }
  }

  private validateArraySetType(arrayVar: string, value: string, lineNum: number): void {
    const arrayInfo = this.arrayDeclarations.get(arrayVar);
    if (!arrayInfo) return;

    const valueType = this.inferValueType(value);
    if (!valueType || valueType === 'unknown' || arrayInfo.elementType === 'unknown') {
      return;
    }
    if (!this.areTypesCompatible(arrayInfo.elementType, valueType)) {
      this.addError(lineNum, 1, `Type mismatch: cannot set ${valueType} in ${arrayInfo.elementType} array '${arrayVar}'`, 'PSV6-ARRAY-TYPE-MISMATCH');
    }
  }

  private inferValueType(value: string): string {
    const trimmed = value.trim();
    
    // String literal
    if (trimmed.match(/^"[^"]*"$/) || trimmed.match(/^'[^']*'$/)) {
      return 'string';
    }
    
    // Numeric literal
    if (trimmed.match(/^[+\-]?\d+(\.\d+)?([eE][+\-]?\d+)?$/)) {
      return trimmed.includes('.') || /[eE]/.test(trimmed) ? 'float' : 'int';
    }
    
    // Boolean literal
    if (trimmed === 'true' || trimmed === 'false') {
      return 'bool';
    }
    
    // Color literal
    if (trimmed.match(/^color\./)) {
      return 'color';
    }

    // Drawing object constructors
    if (/^line\.new\s*\(/.test(trimmed)) return 'line';
    if (/^label\.new\s*\(/.test(trimmed)) return 'label';
    if (/^box\.new\s*\(/.test(trimmed)) return 'box';
    if (/^table\.new\s*\(/.test(trimmed)) return 'table';
    
    // Built-in variables (series)
    if (['open', 'high', 'low', 'close', 'volume', 'time', 'bar_index', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'].includes(trimmed)) {
      return 'float'; // Series variables are typically float
    }
    
    // Handle arithmetic expressions (e.g., value * 2, price + 1, etc.)
    if (/[*+\-\/]/.test(trimmed)) {
      // For arithmetic expressions, assume float result
      return 'float';
    }
    
    // Handle function calls (e.g., array.get(arr, 0))
    if (trimmed.includes('(') && trimmed.includes(')')) {
      // Check if it's array.get - return the element type
      const arrayGetMatch = trimmed.match(/array\.get\s*\(\s*([^,)]+)\s*,\s*[^)]+\s*\)/);
      if (arrayGetMatch) {
        const arrayVar = arrayGetMatch[1].trim();
        const arrayInfo = this.arrayDeclarations.get(arrayVar);
        if (arrayInfo) {
          return arrayInfo.elementType;
        }
      }
      
      // For other function calls, assume float result
      return 'float';
    }
    
    // Variable reference - check typeMap
    const typeInfo = this.context.typeMap.get(trimmed);
    if (typeInfo) {
      return typeInfo.type;
    }
    
    return 'unknown';
  }

  private areTypesCompatible(expectedType: string, actualType: string): boolean {
    // Exact match
    if (expectedType === actualType) return true;
    
    // Numeric compatibility
    if (expectedType === 'float' && (actualType === 'int' || actualType === 'float')) return true;
    if (expectedType === 'int' && actualType === 'int') return true;
    
    // Series compatibility (series can be used where float is expected)
    if (expectedType === 'float' && actualType === 'series') return true;
    
    return false;
  }

  private validateArrayPerformance(): void {
    // Check for too many array allocations
    if (this.arrayAllocations > 5) {
      this.addWarning(1, 1, `Too many array allocations (${this.arrayAllocations}). Consider reusing arrays or using fewer arrays.`, 'PSV6-ARRAY-PERF-ALLOCATION');
    }
    
    // Check for expensive operations in loops
    this.validateArrayOperationsInLoops();
    
    // Check for large array operations
    this.validateLargeArrayOperations();
  }

  private validateArrayOperationsInLoops(): void {
    let inLoop = false;
    let loopStartLine = 0;
    
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;
      
      // Detect loop start
      if (/^\s*(for|while)\s/.test(line)) {
        inLoop = true;
        loopStartLine = lineNum;
      }
      
      // Detect loop end
      if (inLoop && /^\s*$/.test(line) && this.getIndentationLevel(line) === 0) {
        inLoop = false;
      }
      
      // Check for expensive operations in loops
      if (inLoop) {
        const expensiveOps = ['array.reverse', 'array.sort', 'array.copy'];
        for (const op of expensiveOps) {
          if (line.includes(op)) {
            this.addWarning(lineNum, 1, `Expensive array operation '${op}' detected in loop starting at line ${loopStartLine}`, 'PSV6-ARRAY-PERF-LOOP');
          }
        }
      }
    }
  }

  private validateLargeArrayOperations(): void {
    for (const [varName, arrayInfo] of this.arrayDeclarations) {
      if (arrayInfo.size > 10000) {
        this.addWarning(arrayInfo.line, 1, `Large array '${varName}' with size ${arrayInfo.size}. Consider performance implications.`, 'PSV6-ARRAY-PERF-LARGE');
      }
    }
  }

  private validateArrayBestPractices(): void {
    this.validateArrayNaming();
    this.validateArrayInitialization();
    this.validateArrayMemoryManagement();
  }

  private validateArrayNaming(): void {
    for (const [varName, arrayInfo] of this.arrayDeclarations) {
      // Check for poor naming conventions
      if (varName.length <= 2 || /^[a-z]$/.test(varName) || /^arr\d*$/.test(varName)) {
        this.addInfo(arrayInfo.line, 1, `Consider using more descriptive names for arrays. '${varName}' could be improved.`, 'PSV6-ARRAY-NAMING-SUGGESTION');
      }
    }
  }

  private validateArrayInitialization(): void {
    // Check for arrays that are used without initialization
    for (const [varName, arrayInfo] of this.arrayDeclarations) {
      let hasInitialization = false;
      
      // Look for array.push or array.set operations after declaration
      for (let i = arrayInfo.line; i < this.context.cleanLines.length; i++) {
        const line = this.context.cleanLines[i];
        if (line.includes(`array.push(${varName}`) || line.includes(`array.set(${varName}`)) {
          hasInitialization = true;
          break;
        }
      }
      
      if (!hasInitialization) {
        this.addInfo(arrayInfo.line, 1, `Array '${varName}' is declared but never initialized. Consider adding initial values.`, 'PSV6-ARRAY-INITIALIZATION-SUGGESTION');
      }
    }
  }

  private validateArrayMemoryManagement(): void {
    // Check for arrays that grow large but are never cleared
    for (const [varName, arrayInfo] of this.arrayDeclarations) {
      let hasClear = false;
      let hasPush = false;
      
      for (let i = arrayInfo.line; i < this.context.cleanLines.length; i++) {
        const line = this.context.cleanLines[i];
        if (line.includes(`array.clear(${varName}`)) {
          hasClear = true;
        }
        if (line.includes(`array.push(${varName}`)) {
          hasPush = true;
        }
      }
      
      if (hasPush && !hasClear && arrayInfo.size > 100) {
        this.addInfo(arrayInfo.line, 1, `Array '${varName}' grows but is never cleared. Consider using array.clear() for memory management.`, 'PSV6-ARRAY-MEMORY-SUGGESTION');
      }
    }
  }

  private getIndentationLevel(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }
}
