/**
 * Enhanced Method Validator Module
 * 
 * Handles enhanced method validation for Pine Script v6:
 * - PSV6-METHOD-INVALID: Methods on non-UDT types
 */

import { ValidationModule } from '../core/types';

export class EnhancedMethodValidator implements ValidationModule {
  name = 'EnhancedMethodValidator';
  priority = 85; // Run after type validation

  private readonly allowedInstanceMethods = new Set([
    'push','pop','get','set','size','clear','reverse','sort','sort_indices','copy','slice','concat','fill','from','from_example',
    'indexof','lastindexof','includes','binary_search','binary_search_leftmost','binary_search_rightmost','range','remove','insert',
    'unshift','shift','first','last','max','min','median','mode','abs','sum','avg','stdev','variance','standardize','covariance',
    'percentile_linear_interpolation','percentile_nearest_rank','percentrank','some','every','delete'
  ]);

  getDependencies(): string[] {
    return ['CoreValidator', 'UDTValidator'];
  }

  validate(context: any, config: any): any {
    const result = {
      errors: [],
      warnings: [],
      info: [],
      typeMap: new Map()
    };

    // Collect UDT types
    const udtTypes = this.collectUDTTypes(context.lines);

    // Validate method calls for each line
    for (let i = 0; i < context.lines.length; i++) {
      const line = context.lines[i];
      const lineNum = i + 1;
      
      this.validateMethodCallsOnNonUDT(line, lineNum, udtTypes, context.lines, result);
    }

    return result;
  }

  /**
   * PSV6-METHOD-INVALID: Validate method calls on non-UDT types
   * Warns when methods are called on variables that are not UDT instances
   */
  private validateMethodCallsOnNonUDT(line: string, lineNum: number, udtTypes: Set<string>, lines: string[], result: any): void {
    // Match method calls: variable.method()
    const methodCallMatch = line.match(/\b(\w+)\.(\w+)\s*\(/g);
    if (methodCallMatch) {
      for (const match of methodCallMatch) {
        const fullMatch = match.match(/\b(\w+)\.(\w+)\s*\(/);
        if (fullMatch) {
          const [, varName, methodName] = fullMatch;
          if (this.allowedInstanceMethods.has(methodName)) {
            continue;
          }

          // Skip built-in methods (array.new, matrix.new, etc.)
          if (this.isBuiltInMethod(varName, methodName)) {
            continue;
          }
          
          // Get the type of the variable
          const varType = this.getVariableType(varName, lines, lineNum);
          
          // Check if the variable is a UDT type
          if (!udtTypes.has(varType) && varType !== 'unknown') {
            result.warnings.push({
              line: lineNum,
              column: line.indexOf(match) + 1,
              message: `Method '${methodName}' called on non-UDT variable '${varName}' of type '${varType}'`,
              severity: 'warning',
              code: 'PSV6-METHOD-INVALID',
              suggestion: `Methods can only be called on User-Defined Type instances. Consider using a function instead.`
            });
          }
        }
      }
    }
  }

  /**
   * Collect UDT types from the code
   */
  private collectUDTTypes(lines: string[]): Set<string> {
    const udtTypes = new Set<string>();
    
    for (const line of lines) {
      // Match type declarations: type TypeName
      const typeMatch = line.match(/^\s*type\s+(\w+)/);
      if (typeMatch) {
        udtTypes.add(typeMatch[1]);
      }
    }
    
    return udtTypes;
  }

  /**
   * Check if a method call is a built-in method
   */
  private isBuiltInMethod(varName: string, methodName: string): boolean {
    const builtInMethods: Record<string, string[]> = {
      'array': ['new', 'push', 'pop', 'get', 'set', 'size', 'clear'],
      'matrix': ['new', 'get', 'set', 'rows', 'columns', 'clear'],
      'map': ['new', 'get', 'put', 'remove', 'size', 'clear'],
      'line': ['new', 'set_xy1', 'set_xy2', 'set_color', 'set_width', 'set_style', 'delete'],
      'label': ['new', 'set_text', 'set_color', 'set_style', 'delete'],
      'box': ['new', 'delete', 'set_bgcolor', 'set_border_color'],
      'table': ['new', 'cell', 'cell_set_text', 'delete', 'clear']
    };
    
    return builtInMethods[varName]?.includes(methodName) || false;
  }

  /**
   * Get the type of a variable by analyzing its declaration and usage
   */
  private getVariableType(varName: string, lines: string[], currentLine: number): string {
    // Look for variable declaration before current line
    for (let i = 0; i < currentLine - 1; i++) {
      const line = lines[i];
      
      // Check for typed declaration: type varName = value
      const typedDeclMatch = line.match(new RegExp(`\\b(int|float|bool|string|color|line|label|box|table|array|matrix|map)\\s+${varName}\\s*=`));
      if (typedDeclMatch) {
        return typedDeclMatch[1];
      }
      
      // Check for simple declaration: varName = value
      const simpleDeclMatch = line.match(new RegExp(`\\b${varName}\\s*=\\s*([^\\n]+)`));
      if (simpleDeclMatch) {
        const value = simpleDeclMatch[1].trim();
        return this.inferTypeFromValue(value);
      }
    }
    
    return 'unknown';
  }

  /**
   * Infer type from a value
   */
  private inferTypeFromValue(value: string): string {
    value = value.trim();
    
    // Numeric literals
    if (/^-?\d+$/.test(value)) return 'int';
    if (/^-?\d*\.\d+$/.test(value)) return 'float';
    
    // String literals
    if (/^["'].*["']$/.test(value)) return 'string';
    
    // Boolean literals
    if (value === 'true' || value === 'false') return 'bool';
    
    // Color literals
    if (value.startsWith('color.')) return 'color';
    
    // Array/matrix/map constructors
    if (value.includes('array.new')) return 'array';
    if (value.includes('matrix.new')) return 'matrix';
    if (value.includes('map.new')) return 'map';
    
    // Line/label/box/table constructors
    if (value.includes('line.new')) return 'line';
    if (value.includes('label.new')) return 'label';
    if (value.includes('box.new')) return 'box';
    if (value.includes('table.new')) return 'table';
    
    return 'unknown';
  }
}
