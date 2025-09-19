/**
 * Matrix validation module for Pine Script v6
 * Handles matrix declarations, operations, performance, and best practices
 */

import { ValidationModule, ValidationContext, ValidationResult, ValidatorConfig } from '../core/types';

export class MatrixValidator implements ValidationModule {
  name = 'MatrixValidator';
  
  private errors: Array<{ line: number; column: number; message: string; code: string }> = [];
  private warnings: Array<{ line: number; column: number; message: string; code: string }> = [];
  private info: Array<{ line: number; column: number; message: string; code: string }> = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  // Matrix tracking
  private matrixDeclarations = new Map<string, { type: string; rows: number; cols: number; line: number; elementType: string }>();
  private matrixAllocations = 0;
  private matrixOperations = 0;

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

    this.validateMatrixDeclarations();
    this.validateMatrixOperations();
    this.validateMatrixTypeConsistency();
    this.validateMatrixPerformance();
    this.validateMatrixBestPractices();

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
    this.matrixDeclarations.clear();
    this.matrixAllocations = 0;
    this.matrixOperations = 0;
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

  private validateMatrixDeclarations(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for matrix.new declarations
      this.validateMatrixNewDeclaration(line, lineNum);
      
      // Check for matrix type annotations
      this.validateMatrixTypeAnnotation(line, lineNum);
    }
  }

  private validateMatrixNewDeclaration(line: string, lineNum: number): void {
    // Match both generic syntax: matrix.new<type>(rows, cols) and old syntax: matrix.new(type, rows, cols)
    const genericMatch = line.match(/matrix\.new<([^>]+)>\s*\(\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(.+))?\)/);
    const oldMatch = line.match(/matrix\.new\s*\(\s*([^,)]+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(.+))?\)/);
    
    if (genericMatch) {
      const [_, type, rowsStr, colsStr, initialValue] = genericMatch;
      const rows = parseInt(rowsStr, 10);
      const cols = parseInt(colsStr, 10);
      
      this.validateMatrixType(type, lineNum);
      this.validateMatrixDimensions(rows, cols, lineNum);
      this.matrixAllocations++;
      
      // Extract variable name if this is an assignment
      const varMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*matrix\.new/);
      if (varMatch) {
        const varName = varMatch[1];
        this.matrixDeclarations.set(varName, { type, rows, cols, line: lineNum, elementType: type });
        
        // Store in context typeMap
        this.context.typeMap.set(varName, {
          type: 'matrix',
          isConst: false,
          isSeries: false,
          declaredAt: { line: lineNum, column: 1 },
          usages: []
        });
      }
    } else if (oldMatch) {
      const [_, type, rowsStr, colsStr, initialValue] = oldMatch;
      const rows = parseInt(rowsStr, 10);
      const cols = parseInt(colsStr, 10);
      
      this.validateMatrixType(type, lineNum);
      this.validateMatrixDimensions(rows, cols, lineNum);
      this.matrixAllocations++;
      
      // Extract variable name if this is an assignment
      const varMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*matrix\.new/);
      if (varMatch) {
        const varName = varMatch[1];
        this.matrixDeclarations.set(varName, { type, rows, cols, line: lineNum, elementType: type });
        
        // Store in context typeMap
        this.context.typeMap.set(varName, {
          type: 'matrix',
          isConst: false,
          isSeries: false,
          declaredAt: { line: lineNum, column: 1 },
          usages: []
        });
      }
    } else if (line.includes('matrix.new')) {
      // Invalid syntax
      this.addError(lineNum, 1, 'Invalid matrix.new syntax. Use matrix.new<type>(rows, cols) or matrix.new(type, rows, cols)', 'PSV6-MATRIX-INVALID-SYNTAX');
    }
  }

  private validateMatrixTypeAnnotation(line: string, lineNum: number): void {
    // Check for matrix<type> variable declarations
    const matrixTypeMatch = line.match(/^\s*matrix<([^>]+)>\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (matrixTypeMatch) {
      const [_, type, varName] = matrixTypeMatch;
      this.validateMatrixType(type, lineNum);
      
      // Store in context typeMap
      this.context.typeMap.set(varName, {
        type: 'matrix',
        isConst: false,
        isSeries: false,
        declaredAt: { line: lineNum, column: 1 },
        usages: []
      });
    }
  }

  private validateMatrixType(type: string, lineNum: number): void {
    const validTypes = ['int', 'float', 'bool', 'string', 'color'];
    if (!validTypes.includes(type)) {
      this.addError(lineNum, 1, `Invalid matrix type: ${type}. Valid types are: ${validTypes.join(', ')}`, 'PSV6-MATRIX-INVALID-TYPE');
    }
  }

  private validateMatrixDimensions(rows: number, cols: number, lineNum: number): void {
    if (rows <= 0 || cols <= 0) {
      this.addError(lineNum, 1, `Matrix dimensions must be positive, got: ${rows}x${cols}`, 'PSV6-MATRIX-INVALID-DIMENSIONS');
    } else if (rows > 1000 || cols > 1000) {
      this.addError(lineNum, 1, `Matrix dimensions (${rows}x${cols}) exceed the maximum limit of 1000 for a single dimension`, 'PSV6-MATRIX-DIMENSION-LIMIT');
    }
  }

  private validateMatrixOperations(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for matrix method calls
      this.validateMatrixMethodCalls(line, lineNum);
      
      // Check for matrix index operations
      this.validateMatrixIndexOperations(line, lineNum);
    }
  }

  private validateMatrixMethodCalls(line: string, lineNum: number): void {
    // Matrix method patterns
    const matrixMethods = [
      { name: 'matrix.set', params: 4, description: 'matrix.set(id, row, col, value)' },
      { name: 'matrix.get', params: 3, description: 'matrix.get(id, row, col)' },
      { name: 'matrix.rows', params: 1, description: 'matrix.rows(id)' },
      { name: 'matrix.columns', params: 1, description: 'matrix.columns(id)' },
      { name: 'matrix.copy', params: 1, description: 'matrix.copy(id)' },
      { name: 'matrix.fill', params: 2, description: 'matrix.fill(id, value)' }
    ];

    for (const method of matrixMethods) {
      const methodRegex = new RegExp(`\\b${method.name.replace('.', '\\.')}\\s*\\(`);
      if (methodRegex.test(line)) {
        this.matrixOperations++;
        
        // Extract method call
        const methodCallMatch = line.match(new RegExp(`\\b${method.name.replace('.', '\\.')}\\s*\\(([^)]*)\\)`));
        if (methodCallMatch) {
          const params = methodCallMatch[1].split(',').map(p => p.trim()).filter(p => p.length > 0);
          
          // Validate parameter count
          if (params.length !== method.params) {
            this.addError(lineNum, 1, `Invalid parameter count for ${method.name}. Expected ${method.params}, got ${params.length}. Usage: ${method.description}`, 'PSV6-MATRIX-METHOD-PARAMS');
          }
          
          // Validate matrix variable for methods that take matrix as first parameter
          if (params.length > 0) {
            const matrixVar = params[0];
            this.validateMatrixVariable(matrixVar, lineNum);
          }
        }
      }
    }
  }

  private validateMatrixIndexOperations(line: string, lineNum: number): void {
    // Check for matrix.get and matrix.set with index validation
    const getMatch = line.match(/matrix\.get\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^)]+)\s*\)/);
    const setMatch = line.match(/matrix\.set\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^)]+)\s*\)/);
    
    if (getMatch) {
      const [_, matrixVar, row, col] = getMatch;
      this.validateMatrixIndex(matrixVar, row, col, lineNum);
    }
    
    if (setMatch) {
      const [_, matrixVar, row, col] = setMatch;
      this.validateMatrixIndex(matrixVar, row, col, lineNum);
    }
  }

  private validateMatrixVariable(matrixVar: string, lineNum: number): void {
    // Check if variable is declared as a matrix
    const matrixInfo = this.matrixDeclarations.get(matrixVar);
    const typeInfo = this.context.typeMap.get(matrixVar);
    
    // If it's in matrixDeclarations, it's definitely a matrix
    if (matrixInfo) {
      return;
    }
    
    // If it's in typeMap, check if the type is 'matrix'
    if (typeInfo && typeInfo.type === 'matrix') {
      return;
    }
    
    // Skip validation for function parameters (they might be matrices passed from outside)
    // This is a limitation - we can't always determine function parameter types
    if (this.isLikelyFunctionParameter(matrixVar, lineNum)) {
      return;
    }
    
    // If it's not declared at all, or not declared as a matrix, it's an error
    this.addError(lineNum, 1, `Variable '${matrixVar}' is not declared as a matrix`, 'PSV6-MATRIX-NOT-MATRIX');
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

  private validateMatrixIndex(matrixVar: string, row: string, col: string, lineNum: number): void {
    const matrixInfo = this.matrixDeclarations.get(matrixVar);
    if (matrixInfo) {
      // Check for literal index values
      const rowMatch = row.match(/^\s*(\d+)\s*$/);
      const colMatch = col.match(/^\s*(\d+)\s*$/);
      
      if (rowMatch) {
        const rowValue = parseInt(rowMatch[1], 10);
        if (rowValue < 0 || rowValue >= matrixInfo.rows) {
          this.addWarning(lineNum, 1, `Matrix row index ${rowValue} is out of bounds for matrix with ${matrixInfo.rows} rows`, 'PSV6-MATRIX-INDEX-BOUNDS');
        }
      }
      
      if (colMatch) {
        const colValue = parseInt(colMatch[1], 10);
        if (colValue < 0 || colValue >= matrixInfo.cols) {
          this.addWarning(lineNum, 1, `Matrix column index ${colValue} is out of bounds for matrix with ${matrixInfo.cols} columns`, 'PSV6-MATRIX-INDEX-BOUNDS');
        }
      }
    }
  }

  private validateMatrixTypeConsistency(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for matrix.set operations with type mismatches
      const setMatch = line.match(/matrix\.set\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^)]+)\s*\)/);
      if (setMatch) {
        const [_, matrixVar, row, col, value] = setMatch;
        this.validateMatrixSetType(matrixVar.trim(), value.trim(), lineNum);
      }
    }
  }

  private validateMatrixSetType(matrixVar: string, value: string, lineNum: number): void {
    const matrixInfo = this.matrixDeclarations.get(matrixVar);
    if (!matrixInfo) return;

    const valueType = this.inferValueType(value);
    if (!this.areTypesCompatible(matrixInfo.elementType, valueType)) {
      this.addError(lineNum, 1, `Type mismatch: cannot set ${valueType} in ${matrixInfo.elementType} matrix '${matrixVar}'`, 'PSV6-MATRIX-TYPE-MISMATCH');
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
    
    // Built-in variables (series)
    if (['open', 'high', 'low', 'close', 'volume', 'time', 'bar_index', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'].includes(trimmed)) {
      return 'float'; // Series variables are typically float
    }
    
    // Handle arithmetic expressions (e.g., value * 2, price + 1, etc.)
    if (/[*+\-\/]/.test(trimmed)) {
      // For arithmetic expressions, assume float result
      return 'float';
    }
    
    // Handle function calls (e.g., matrix.get(matrix, 0, 0))
    if (trimmed.includes('(') && trimmed.includes(')')) {
      // Check if it's matrix.get - return the element type
      const matrixGetMatch = trimmed.match(/matrix\.get\s*\(\s*([^,)]+)\s*,\s*[^)]+\s*,\s*[^)]+\s*\)/);
      if (matrixGetMatch) {
        const matrixVar = matrixGetMatch[1].trim();
        const matrixInfo = this.matrixDeclarations.get(matrixVar);
        if (matrixInfo) {
          return matrixInfo.elementType;
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

  private validateMatrixPerformance(): void {
    // Check for too many matrix allocations
    if (this.matrixAllocations > 5) {
      this.addWarning(1, 1, `Too many matrix allocations (${this.matrixAllocations}). Consider reusing matrices or using fewer matrices.`, 'PSV6-MATRIX-PERF-ALLOCATION');
    }
    
    // Check for expensive operations in loops
    this.validateMatrixOperationsInLoops();
    
    // Check for large matrix operations
    this.validateLargeMatrixOperations();
  }

  private validateMatrixOperationsInLoops(): void {
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
        const expensiveOps = ['matrix.fill', 'matrix.copy'];
        for (const op of expensiveOps) {
          if (line.includes(op)) {
            this.addWarning(lineNum, 1, `Expensive matrix operation '${op}' detected in loop starting at line ${loopStartLine}`, 'PSV6-MATRIX-PERF-LOOP');
          }
        }
      }
    }
  }

  private validateLargeMatrixOperations(): void {
    for (const [varName, matrixInfo] of this.matrixDeclarations) {
      const totalElements = matrixInfo.rows * matrixInfo.cols;
      if (totalElements > 10000) {
        this.addWarning(matrixInfo.line, 1, `Large matrix '${varName}' with ${totalElements} elements. Consider performance implications.`, 'PSV6-MATRIX-PERF-LARGE');
      }
    }
  }

  private validateMatrixBestPractices(): void {
    this.validateMatrixNaming();
    this.validateMatrixInitialization();
    this.validateMatrixMemoryManagement();
  }

  private validateMatrixNaming(): void {
    for (const [varName, matrixInfo] of this.matrixDeclarations) {
      // Check for poor naming conventions
      if (varName.length <= 2 || /^[a-z]$/.test(varName) || /^mat\d*$/.test(varName)) {
        this.addInfo(matrixInfo.line, 1, `Consider using more descriptive names for matrices. '${varName}' could be improved.`, 'PSV6-MATRIX-NAMING-SUGGESTION');
      }
    }
  }

  private validateMatrixInitialization(): void {
    // Check for matrices that are used without initialization
    for (const [varName, matrixInfo] of this.matrixDeclarations) {
      let hasInitialization = false;
      
      // Look for matrix.set operations after declaration
      for (let i = matrixInfo.line; i < this.context.cleanLines.length; i++) {
        const line = this.context.cleanLines[i];
        if (line.includes(`matrix.set(${varName}`)) {
          hasInitialization = true;
          break;
        }
      }
      
      if (!hasInitialization) {
        this.addInfo(matrixInfo.line, 1, `Matrix '${varName}' is declared but never initialized. Consider adding initial values.`, 'PSV6-MATRIX-INITIALIZATION-SUGGESTION');
      }
    }
  }

  private validateMatrixMemoryManagement(): void {
    // Check for matrices that grow large but are never cleared
    for (const [varName, matrixInfo] of this.matrixDeclarations) {
      let hasReset = false;
      let hasSet = false;
      
      for (let i = matrixInfo.line; i < this.context.cleanLines.length; i++) {
        const line = this.context.cleanLines[i];
        if (line.includes(`matrix.fill(${varName}`)) {
          hasReset = true;
        }
        if (line.includes(`matrix.set(${varName}`)) {
          hasSet = true;
        }
      }
      
      if (hasSet && !hasReset && (matrixInfo.rows * matrixInfo.cols) > 100) {
        this.addInfo(matrixInfo.line, 1, `Matrix '${varName}' is modified but never reset. Consider using matrix.fill() or recreating the matrix to manage memory.`, 'PSV6-MATRIX-MEMORY-SUGGESTION');
      }
    }
  }

  private getIndentationLevel(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }
}
