/**
 * Enum validation module for Pine Script v6
 * Handles enum declaration syntax, usage, and best practices
 */

import { ValidationModule, ValidationContext, ValidationResult, ValidatorConfig } from '../core/types';

export class EnumValidator implements ValidationModule {
  name = 'EnumValidator';
  
  private errors: Array<{ line: number; column: number; message: string; code: string }> = [];
  private warnings: Array<{ line: number; column: number; message: string; code: string }> = [];
  private info: Array<{ line: number; column: number; message: string; code: string }> = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  getDependencies(): string[] {
    return [];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.validateEnumDeclarations();
    this.validateEnumUsage();
    this.validateEnumBestPractices();

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

  private validateEnumDeclarations(): void {
    const enumDeclarations = new Map<string, { line: number; values: string[] }>();
    
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for enum declaration
      const enumMatch = line.match(/^\s*enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
      if (enumMatch) {
        const enumName = enumMatch[1];
        const values: string[] = [];
        let j = i + 1;
        
        // Collect enum values (including invalid ones for validation)
        while (j < this.context.cleanLines.length) {
          const valueLine = this.context.cleanLines[j];
          
          // Check if this looks like an enum value (starts with identifier-like pattern)
          const valueMatch = valueLine.match(/^\s*([A-Za-z_][A-Za-z0-9_]*|[0-9][A-Za-z0-9_]*)\s*$/);
          
          if (valueMatch) {
            values.push(valueMatch[1]);
            j++;
          } else {
            break;
          }
        }
        
        // Validate enum
        this.validateEnumDeclaration(enumName, values, lineNum);
        enumDeclarations.set(enumName, { line: lineNum, values });
        
        // Store enum type in context
        this.context.typeMap.set(enumName, {
          type: 'unknown', // Enum types are not in the standard type union
          isConst: true,
          isSeries: false,
          declaredAt: { line: lineNum, column: 1 },
          usages: []
        });
        
        // Store enum values in context for validation
        for (const value of values) {
          this.context.typeMap.set(`${enumName}.${value}`, {
            type: 'unknown',
            isConst: true,
            isSeries: false,
            declaredAt: { line: lineNum, column: 1 },
            usages: []
          });
        }
      }
    }
  }

  private validateEnumDeclaration(enumName: string, values: string[], lineNum: number): void {
    // Check for empty enum
    if (values.length === 0) {
      this.addError(lineNum, 1, 'Enum declaration must have at least one value', 'PSV6-ENUM-EMPTY');
      return;
    }

    // Check for duplicate values
    const seenValues = new Set<string>();
    for (const value of values) {
      if (seenValues.has(value)) {
        this.addError(lineNum, 1, `Duplicate enum value: ${value}`, 'PSV6-ENUM-DUPLICATE-VALUE');
      } else {
        seenValues.add(value);
      }
    }

    // Check for invalid value names
    for (const value of values) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
        this.addError(lineNum, 1, `Invalid enum value name: ${value}`, 'PSV6-ENUM-INVALID-VALUE-NAME');
      }
    }

    // Check enum naming conventions
    if (!/^[A-Z][A-Za-z0-9_]*$/.test(enumName)) {
      this.addInfo(lineNum, 1, `Consider using PascalCase for enum names: ${enumName}`, 'PSV6-ENUM-NAMING-SUGGESTION');
    }

    // Check enum value naming conventions
    for (const value of values) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(value)) {
        this.addInfo(lineNum, 1, `Consider using UPPER_CASE for enum values: ${value}`, 'PSV6-ENUM-VALUE-NAMING-SUGGESTION');
      }
    }
  }

  private validateEnumUsage(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for enum value usage (EnumName.ValueName) - but exclude known namespaces and UDT patterns
      const knownNamespaces = new Set(['array', 'matrix', 'map', 'ta', 'math', 'str', 'color', 'line', 'label', 'box', 'table', 'request', 'input', 'strategy', 'runtime', 'chart', 'dividends', 'earnings', 'linefill', 'polyline']);
      
      // Only look for enum patterns that are likely to be actual enum usage
      // Exclude UDT constructors (.new), UDT field access (this.x, other.y), and method calls
      const enumUsageMatch = line.match(/([A-Z][A-Za-z0-9_]*)\.([A-Z][A-Z0-9_]*)/g);
      if (enumUsageMatch) {
        for (const match of enumUsageMatch) {
          const [enumName, valueName] = match.split('.');
          
          // Skip if it's a known namespace (like array.new, ta.sma, etc.)
          if (knownNamespaces.has(enumName)) {
            continue;
          }
          
          this.validateEnumValueUsage(enumName, valueName, lineNum);
        }
      }

      // Check for enum variable declarations
      const enumVarMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*)/);
      if (enumVarMatch) {
        const [_, varType, varName, enumValue] = enumVarMatch;
        const ns = enumValue.split('.')[0];
        // Skip if var/varip declaration or if RHS is a known namespace call (e.g., array.new)
        if (varType === 'var' || varType === 'varip' || knownNamespaces.has(ns)) {
          // not an enum variable declaration
        } else {
          this.validateEnumVariableDeclaration(varType, varName, enumValue, lineNum);
        }
        
        // Add the variable to typeMap for later validation
        this.context.typeMap.set(varName, {
          type: 'unknown',
          isConst: false,
          isSeries: false,
          declaredAt: { line: lineNum, column: 1 },
          usages: [],
          enumType: varType // Store the enum type for later validation
        });
      }

      // Check for enum comparisons
      this.validateEnumComparisons(line, lineNum);

      // Check for enum in function calls
      this.validateEnumFunctionCalls(line, lineNum);

      // Check for enum in switch statements
      this.validateEnumSwitchCases(line, lineNum);
    }
  }

  private validateEnumValueUsage(enumName: string, valueName: string, lineNum: number): void {
    // Check if enum type exists
    const enumType = this.context.typeMap.get(enumName);
    if (!enumType) {
      this.addError(lineNum, 1, `Undefined enum type: ${enumName}`, 'PSV6-ENUM-UNDEFINED-TYPE');
      return;
    }

    // Check if enum value exists
    const enumValue = this.context.typeMap.get(`${enumName}.${valueName}`);
    if (!enumValue) {
      this.addError(lineNum, 1, `Undefined enum value: ${enumName}.${valueName}`, 'PSV6-ENUM-UNDEFINED-VALUE');
    }
  }

  private validateEnumVariableDeclaration(varType: string, varName: string, enumValue: string, lineNum: number): void {
    const [enumName, valueName] = enumValue.split('.');
    
    // Check if enum type exists
    const enumType = this.context.typeMap.get(enumName);
    if (!enumType) {
      this.addError(lineNum, 1, `Undefined enum type: ${enumName}`, 'PSV6-ENUM-UNDEFINED-TYPE');
      return;
    }

    // Check if variable type matches enum type
    if (varType !== enumName) {
      this.addError(lineNum, 1, `Type mismatch: expected ${enumName}, got ${varType}`, 'PSV6-ENUM-TYPE-MISMATCH');
    }
  }

  private validateEnumBestPractices(): void {
    // This method can be expanded to include more best practices
    // For now, it's handled in the enum declaration validation
  }

  private validateEnumComparisons(line: string, lineNum: number): void {
    // Check for enum comparisons with different types
    const enumUsageMatch = line.match(/([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)/g);
    if (enumUsageMatch && enumUsageMatch.length > 1) {
      const enumTypes = new Set<string>();
      for (const match of enumUsageMatch) {
        const [enumName] = match.split('.');
        enumTypes.add(enumName);
      }
      
      if (enumTypes.size > 1) {
        this.addWarning(lineNum, 1, 'Comparing enum values from different types', 'PSV6-ENUM-COMPARISON-TYPE-MISMATCH');
      }
    }
    
    // Check for comparisons between enum variables and enum values
    const comparisonMatch = line.match(/([A-Za-z_][A-Za-z0-9_]*)\s*[=!]=\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)/);
    if (comparisonMatch) {
      const [_, varName, enumType, enumValue] = comparisonMatch;
      
      // Check if the variable is declared as an enum type
      const varType = this.context.typeMap.get(varName);
      
      if (varType && varType.type === 'unknown') {
        // Check if the variable has a stored enum type
        const varEnumType = varType.enumType;
        
        if (varEnumType && this.context.typeMap.has(enumType) && enumType !== varEnumType) {
          this.addWarning(lineNum, 1, `Comparing enum variable of type ${varEnumType} with ${enumType} enum value`, 'PSV6-ENUM-COMPARISON-TYPE-MISMATCH');
        }
      }
    }
  }

  private validateEnumFunctionCalls(line: string, lineNum: number): void {
    // Check for function calls with enum parameters
    const functionCallMatch = line.match(/([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
    if (functionCallMatch) {
      const [_, functionName, params] = functionCallMatch;
      
      // Check if this is a function call with enum parameters
      const enumParams = params.match(/([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)/g);
      if (enumParams) {
        // Look for function definitions to understand expected parameter types
        for (let i = 0; i < this.context.cleanLines.length; i++) {
          const funcLine = this.context.cleanLines[i];
          const funcMatch = funcLine.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=>/);
          if (funcMatch && funcMatch[1] === functionName) {
            const funcParams = funcMatch[2].split(',').map(p => p.trim());
            
            // Check if any parameter name matches an enum type
            for (let j = 0; j < Math.min(funcParams.length, enumParams.length); j++) {
              const paramName = funcParams[j];
              const enumParam = enumParams[j];
              const [enumType] = enumParam.split('.');
              
              // Check if the parameter name matches an enum type name
              const paramIsEnumType = this.context.typeMap.has(paramName);
              const enumTypeExists = this.context.typeMap.has(enumType);
              
              // Heuristic: if parameter name suggests an enum type (capitalized version exists) and we're passing a different enum type
              const capitalizedParam = paramName.charAt(0).toUpperCase() + paramName.slice(1);
              const paramSuggestsEnumType = this.context.typeMap.has(capitalizedParam);
              const paramAsEnumType = this.context.typeMap.has(paramName);
              
              // If the parameter name is an enum type and the passed enum type is different
              if (paramAsEnumType && enumTypeExists && enumType !== paramName) {
                this.addError(lineNum, 1, `Function parameter type mismatch: expected ${paramName}, got ${enumType}`, 'PSV6-ENUM-FUNCTION-TYPE-MISMATCH');
              }
              // Heuristic: if parameter name suggests an enum type and we're passing a different enum type
              else if (paramSuggestsEnumType && enumTypeExists && enumType !== capitalizedParam) {
                this.addError(lineNum, 1, `Function parameter type mismatch: expected ${capitalizedParam}, got ${enumType}`, 'PSV6-ENUM-FUNCTION-TYPE-MISMATCH');
              }
            }
            break;
          }
        }
      }
    }
  }

  private validateEnumSwitchCases(line: string, lineNum: number): void {
    // Check for switch case with enum values
    const switchCaseMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*=>/);
    if (switchCaseMatch) {
      const [_, enumName, valueName] = switchCaseMatch;
      
      // Check if this enum value exists
      const enumValue = this.context.typeMap.get(`${enumName}.${valueName}`);
      if (!enumValue) {
        this.addError(lineNum, 1, `Undefined enum value in switch case: ${enumName}.${valueName}`, 'PSV6-ENUM-SWITCH-CASE-TYPE-MISMATCH');
      }
      
      // Check if this switch case matches the switch expression type
      // Look for the switch expression in previous lines
      for (let i = lineNum - 1; i >= 0; i--) {
        const prevLine = this.context.cleanLines[i];
        const switchMatch = prevLine.match(/^\s*switch\s+([A-Za-z_][A-Za-z0-9_]*)/);
        if (switchMatch) {
          const switchVarName = switchMatch[1];
          const switchVarType = this.context.typeMap.get(switchVarName);
          
          if (switchVarType && switchVarType.type === 'unknown') {
            const switchEnumType = switchVarType.enumType;
            
            if (switchEnumType && this.context.typeMap.has(enumName) && enumName !== switchEnumType) {
              this.addError(lineNum, 1, `Switch case enum type mismatch: expected ${switchEnumType}, got ${enumName}`, 'PSV6-ENUM-SWITCH-CASE-TYPE-MISMATCH');
            }
          }
          break;
        }
      }
    }
  }
}
