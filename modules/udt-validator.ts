import { ValidationModule, ValidationContext, ValidationError, ValidationResult, ValidatorConfig, TypeInfo } from '../core/types';

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

export class UDTValidator implements ValidationModule {
  name = 'UDTValidator';
  priority = 95; // High priority - must run before TypeInferenceValidator
  
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private udtTypes = new Map<string, UDTInfo>();
  private udtDeclarations: UDTDeclaration[] = [];
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
    try {
      this.reset();
      this.context = context;
      this.config = config;

      this.collectUDTDeclarations();
      this.validateUDTDeclarations();
      this.validateMethodDeclarations();
      this.validateMethodCalls();
      this.validateFieldAccess();

      return {
        isValid: this.errors.length === 0,
        errors: this.errors,
        warnings: this.warnings,
        info: this.info,
        typeMap: new Map(),
        scriptType: null
      };
    } catch (error) {
      console.error('DEBUG: UDT Validator error:', error);
      console.error('DEBUG: UDT Validator error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return {
        isValid: false,
        errors: [{ line: 1, column: 1, message: `Error in UDT validator: ${error}`, code: 'UDT-ERROR', severity: 'error' }],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: null
      };
    }
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.udtTypes.clear();
    this.udtDeclarations = [];
  }

  private addError(line: number, column: number, message: string, code: string): void {
    this.errors.push({ line, column, message, code, severity: 'error' });
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({ line, column, message, code, severity: 'warning' });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({
      line,
      column,
      message,
      code,
      severity: 'info'
    });
  }

  private collectUDTDeclarations(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for UDT declarations: type TypeName
      const udtMatch = line.match(/^\s*type\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
      if (udtMatch) {
        const udtName = udtMatch[1];
        const fields: Array<{ name: string; type: string }> = [];
        const methods: Array<{ name: string; line: number; hasThis: boolean; thisType?: string }> = [];

        // Collect fields for this UDT (inside the type definition)
        this.collectUDTFields(udtName, i, fields);

        // Store the declaration
        this.udtDeclarations.push({
          name: udtName,
          line: lineNum,
          fields,
          methods
        });

        // Store in the types map (this will overwrite duplicates, which is fine for the final type info)
        this.udtTypes.set(udtName, {
          name: udtName,
          fields,
          methods,
          line: lineNum
        });
        
        // Also update the shared context for other validators
        this.context.typeMap.set(udtName, {
          type: 'udt',
          isConst: false,
          isSeries: false,
          declaredAt: { line: lineNum, column: 1 },
          usages: []
        });
        
        // Add to usedVars to prevent undefined reference warnings
        if (this.context.usedVars) {
          this.context.usedVars.add(udtName);
        }
      }
    }

    // Collect methods separately (they are declared outside UDT definitions)
    this.collectUDTMethods();
  }

  private collectUDTFields(udtName: string, startLine: number, fields: Array<{ name: string; type: string }>): void {
    const baseIndent = this.getLineIndentation(this.context.cleanLines[startLine]);
    
    for (let i = startLine + 1; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineIndent = this.getLineIndentation(line);
      
      // Stop if we've unindented back to the UDT level or beyond
      if (lineIndent <= baseIndent && line.trim() !== '') {
        break;
      }
      
      const trimmed = line.trim();
      
      // Skip empty lines
      if (trimmed === '') {
        continue;
      }
      
      // Check for field declarations: type fieldName
      const fieldMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_.]*(?:<[^>]+>)?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
      if (fieldMatch) {
        const fieldType = fieldMatch[1];
        const fieldName = fieldMatch[2];
        fields.push({ name: fieldName, type: fieldType });

        const parsedType = this.parseFieldType(fieldType);
        const typeInfo: TypeInfo = {
          type: parsedType.baseType,
          isConst: false,
          isSeries: parsedType.baseType === 'series',
          declaredAt: { line: i + 1, column: 1 },
          usages: []
        };

        if (parsedType.elementType) {
          typeInfo.elementType = parsedType.elementType;
        }
        if (parsedType.udtName) {
          typeInfo.udtName = parsedType.udtName;
        }

        this.context.typeMap.set(`${udtName}.${fieldName}`, typeInfo);
      }
    }
  }

  private collectUDTMethods(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;
      
      // Check for method declarations: method methodName(...) =>
      const methodMatch = line.match(/^\s*method\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=>/);
      if (methodMatch) {
        const methodName = methodMatch[1];
        const params = methodMatch[2];
        
        // Find which UDT this method belongs to by checking the first parameter
        const udtName = this.findUDTForMethod(params);
        if (udtName && this.udtTypes.has(udtName)) {
          const udtInfo = this.udtTypes.get(udtName)!;
          
          // Check if first parameter is 'this' with proper typing
          const hasThis = this.hasProperThisParameter(params, udtName);
          const thisType = this.extractThisType(params);
          
          udtInfo.methods.push({
            name: methodName,
            line: lineNum,
            hasThis,
            thisType
          });
        }
      }
    }
  }

  private findUDTForMethod(params: string): string | null {
    const trimmed = params.trim();
    if (trimmed === '') return null;
    
    const paramList = this.parseParameterList(trimmed);
    if (paramList.length === 0) return null;
    
    const firstParam = paramList[0].trim();
    
    // Check for typed 'this' parameter: this<TypeName>
    const thisMatch = firstParam.match(/^this<([A-Za-z_][A-Za-z0-9_]*)>/);
    if (thisMatch) {
      return thisMatch[1];
    }
    
    // Check for untyped 'this' parameter - we need to infer the type
    if (firstParam === 'this') {
      // For untyped 'this', we'll need to look at the method body or context
      // For now, we'll return null and handle it in validation
      return null;
    }
    
    // Only associate methods with UDTs if they have 'this' as the first parameter
    // Methods with UDT parameters (like Point p) are NOT methods of that UDT
    return null;
  }

  private hasProperThisParameter(params: string, udtName: string): boolean {
    const trimmed = params.trim();
    if (trimmed === '') return false;
    
    // Split parameters and check first one
    const paramList = this.parseParameterList(trimmed);
    if (paramList.length === 0) return false;
    
    const firstParam = paramList[0].trim();
    
    // Check for proper 'this' parameter: this<TypeName> or this<TypeName>, ...
    const thisMatch = firstParam.match(/^this<([A-Za-z_][A-Za-z0-9_]*)>/);
    if (thisMatch) {
      const thisType = thisMatch[1];
      return thisType === udtName;
    }
    
    // Check for untyped 'this' parameter
    return firstParam === 'this';
  }

  private extractThisType(params: string): string | undefined {
    const trimmed = params.trim();
    if (trimmed === '') return undefined;
    
    const paramList = this.parseParameterList(trimmed);
    if (paramList.length === 0) return undefined;
    
    const firstParam = paramList[0].trim();
    const thisMatch = firstParam.match(/^this<([A-Za-z_][A-Za-z0-9_]*)>/);
    
    return thisMatch ? thisMatch[1] : undefined;
  }

  private parseParameterList(params: string): string[] {
    // Simple parameter parsing - split by comma but handle nested parentheses
    const result: string[] = [];
    let current = '';
    let depth = 0;
    
    for (let i = 0; i < params.length; i++) {
      const char = params[i];
      
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
      } else if (char === ',' && depth === 0) {
        result.push(current.trim());
        current = '';
        continue;
      }
      
      current += char;
    }
    
    if (current.trim()) {
      result.push(current.trim());
    }
    
    return result;
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

  private validateMethodDeclarations(): void {
    // First, collect all methods that don't have proper UDT association
    const orphanMethods: Array<{ name: string; line: number; params: string }> = [];
    
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;
      
      const methodMatch = line.match(/^\s*method\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=>/);
      if (methodMatch) {
        const methodName = methodMatch[1];
        const params = methodMatch[2];
        
        // Check if this method is associated with any UDT
        const udtName = this.findUDTForMethod(params);
        
        if (!udtName) {
          orphanMethods.push({ name: methodName, line: lineNum, params });
        }
      }
    }
    
    // Validate orphan methods (methods without proper 'this' parameter)
    for (const method of orphanMethods) {
      const hasThis = this.hasProperThisParameter(method.params, '');
      
      if (!hasThis) {
        this.addError(method.line, 1, 
          `Method '${method.name}' must have 'this' as first parameter`, 
          'PSV6-METHOD-THIS');
      } else {
        // Check if 'this' parameter is properly typed
        const thisType = this.extractThisType(method.params);
        if (!thisType) {
          this.addInfo(method.line, 1, 
            `Consider adding type annotation to 'this' parameter`, 
            'PSV6-METHOD-TYPE');
        }
      }
    }
    
    // Validate methods that are properly associated with UDTs
    for (const [udtName, udtInfo] of this.udtTypes.entries()) {
      for (const method of udtInfo.methods) {
        // Check if 'this' parameter is properly typed
        if (method.hasThis && !method.thisType) {
          this.addInfo(method.line, 1, 
            `Consider adding type annotation to 'this' parameter: this<${udtName}>`, 
            'PSV6-METHOD-TYPE');
        }
      }
    }
  }

  private validateMethodCalls(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Look for method calls: variable.method(...)
      const methodCallRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
      let match;
      
      while ((match = methodCallRegex.exec(line)) !== null) {
        const variableName = match[1];
        const methodName = match[2];
        
        // Check if this is a method call on a non-UDT variable
        this.validateMethodCallOnVariable(variableName, methodName, lineNum);
      }
    }
  }

  private validateMethodCallOnVariable(variableName: string, methodName: string, lineNum: number): void {
    if (this.allowedInstanceMethods.has(methodName)) {
      return;
    }
    // Check if the variable is a known UDT instance
    const isUDTInstance = this.isUDTInstance(variableName);

    if (!isUDTInstance) {
      // Check if this looks like a method call on a primitive type
      if (this.isPrimitiveType(variableName)) {
        this.addWarning(lineNum, 1, 
          `Method '${methodName}' called on primitive type variable '${variableName}'`, 
          'PSV6-METHOD-INVALID');
      }
    }
  }

  private isUDTInstance(variableName: string): boolean {
    return this.getUDTTypeForVariable(variableName) !== null;
  }

  private validateFieldAccess(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Look for field access: variable.field (without parentheses)
      const fieldAccessRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)/g;
      let match;
      
      while ((match = fieldAccessRegex.exec(line)) !== null) {
        const variableName = match[1];
        const fieldName = match[2];
        const matchEnd = match.index + match[0].length;
        
        // Check if this is followed by parentheses (method call) - if so, skip
        const afterMatch = line.substring(matchEnd);
        if (afterMatch.match(/^\s*\(/)) {
          continue; // This is a method call, not field access
        }
        
        // Check if this is a valid field access on a UDT instance
        this.validateFieldAccessOnVariable(variableName, fieldName, lineNum);
      }
    }
  }

  private validateFieldAccessOnVariable(variableName: string, fieldName: string, lineNum: number): void {
    // Check if the variable is a known UDT instance
    const udtType = this.getUDTTypeForVariable(variableName);
    
    if (udtType) {
      // Check if the field exists in the UDT
      const udtInfo = this.udtTypes.get(udtType);
      if (udtInfo) {
        const fieldExists = udtInfo.fields.some(field => field.name === fieldName);
        if (!fieldExists) {
          this.addError(lineNum, 1, 
            `Field '${fieldName}' does not exist in UDT '${udtType}'`, 
            'PSV6-UDT-FIELD-NOT-FOUND');
        } else {
          // Update the type map with the field type
          const field = udtInfo.fields.find(f => f.name === fieldName);
          if (field) {
            const parsedType = this.parseFieldType(field.type);
            const typeInfo: TypeInfo = {
              type: parsedType.baseType,
              isConst: false,
              isSeries: parsedType.baseType === 'series',
              declaredAt: { line: lineNum, column: 1 },
              usages: []
            };

            if (parsedType.elementType) {
              typeInfo.elementType = parsedType.elementType;
            }
            if (parsedType.udtName) {
              typeInfo.udtName = parsedType.udtName;
            }

            this.context.typeMap.set(`${variableName}.${fieldName}`, typeInfo);
          }
        }
      }
    }
  }

  private getUDTTypeForVariable(variableName: string): string | null {
    const ctorPattern = /^([A-Za-z_][A-Za-z0-9_]*)\.new\s*\(/;

    for (const line of this.context.cleanLines) {
      const assignmentIndex = line.indexOf(':=');
      const equalsIndex = assignmentIndex >= 0 ? assignmentIndex : line.indexOf('=');
      if (equalsIndex === -1) continue;

      const operatorLength = assignmentIndex >= 0 ? 2 : 1;
      const lhs = line.slice(0, equalsIndex).trim();
      const rhs = line.slice(equalsIndex + operatorLength).trim();

      const ctorMatch = rhs.match(ctorPattern);
      if (!ctorMatch) continue;
      const udtCandidate = ctorMatch[1];
      if (!this.udtTypes.has(udtCandidate)) continue;

      const lhsTokens = lhs.split(/\s+/);
      if (!lhsTokens.length) continue;
      const declaredVar = lhsTokens[lhsTokens.length - 1];
      if (declaredVar === variableName) {
        return udtCandidate;
      }
    }

    return null;
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

  private normalizeType(type: string): TypeInfo['type'] {
    return this.parseFieldType(type).baseType;
  }

  private isPrimitiveType(variableName: string): boolean {
    // Check if this variable was declared as a primitive type
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      
      // Look for declarations like: int variableName, float variableName, etc.
      const primitiveTypes = ['int', 'float', 'bool', 'string', 'color', 'series', 'input'];
      for (const type of primitiveTypes) {
        const declarationMatch = line.match(new RegExp(`^\\s*${type}\\s+${variableName}\\s*[=;]`));
        if (declarationMatch) {
          return true;
        }
      }
    }
    
    // Check if it's a built-in variable
    const builtInVariables = ['open', 'high', 'low', 'close', 'volume', 'time', 'bar_index', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'];
    if (builtInVariables.includes(variableName)) {
      return true;
    }
    
    // Check if it's a literal value (numbers, strings, etc.)
    if (variableName.match(/^\d+\.?\d*$/) || variableName.match(/^"[^"]*"$/) || variableName === 'true' || variableName === 'false') {
      return true;
    }
    
    return false;
  }

  private getLineIndentation(line: string): number {
    return line.length - line.trimStart().length;
  }
}
