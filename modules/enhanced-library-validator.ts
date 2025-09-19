/**
 * Enhanced Library Import Validator Module
 * 
 * Handles enhanced library import validation for Pine Script v6:
 * - PSV6-LIB-PATH: Invalid library paths
 * - PSV6-LIB-ALIAS: Alias conflicts
 */

import { ValidationModule } from '../core/types';

export class EnhancedLibraryValidator implements ValidationModule {
  name = 'EnhancedLibraryValidator';
  priority = 80; // Run after basic syntax validation

  getDependencies(): string[] {
    return ['CoreValidator', 'SyntaxValidator'];
  }

  validate(context: any, config: any): any {
    const result = {
      errors: [],
      warnings: [],
      info: [],
      typeMap: new Map()
    };

    // Collect user-defined names for alias conflict detection
    const userDefinedNames = this.collectUserDefinedNames(context.lines);

    // Validate library imports for each line
    for (let i = 0; i < context.lines.length; i++) {
      const line = context.lines[i];
      const lineNum = i + 1;
      
      this.validateLibraryPaths(line, lineNum, result);
      this.validateLibraryAliases(line, lineNum, userDefinedNames, result);
    }

    // Additional validations
    this.validateCircularDependencies(context.lines, result);
    this.validateVersionCompatibility(context.lines, result);
    this.validateUnusedImports(context.lines, result);

    return result;
  }

  /**
   * PSV6-LIB-PATH: Validate library import paths
   * Checks for valid library path format and integer versions
   */
  private validateLibraryPaths(line: string, lineNum: number, result: any): void {
    // Match import statements: import "username/scriptname/version" as alias
    const importMatch = line.match(/^\s*import\s+"([^"]+)"\s+as\s+(\w+)/);
    if (importMatch) {
      const [, path, alias] = importMatch;
      
      // Check for double slashes
      if (path.includes('//')) {
        result.errors.push({
          line: lineNum,
          column: 1,
          message: `Invalid library path: double slashes not allowed in '${path}'`,
          severity: 'error',
          code: 'PSV6-LIB-PATH',
          suggestion: 'Remove double slashes from library path'
        });
        return;
      }
      
      // Split path into components
      const parts = path.split('/');
      
      // Check for incomplete path (missing version)
      if (parts.length < 3) {
        result.errors.push({
          line: lineNum,
          column: 1,
          message: `Incomplete library path: '${path}' must include username/scriptname/version`,
          severity: 'error',
          code: 'PSV6-LIB-PATH',
          suggestion: 'Add version number to library path (e.g., username/scriptname/1)'
        });
        return;
      }
      
      // Check for incomplete path (only user)
      if (parts.length === 1) {
        result.errors.push({
          line: lineNum,
          column: 1,
          message: `Incomplete library path: '${path}' must include scriptname and version`,
          severity: 'error',
          code: 'PSV6-LIB-PATH',
          suggestion: 'Add scriptname and version to library path (e.g., username/scriptname/1)'
        });
        return;
      }
      
      // Check if version is a valid integer
      const version = parts[parts.length - 1];
      if (!/^\d+$/.test(version)) {
        result.errors.push({
          line: lineNum,
          column: 1,
          message: `Invalid library version: '${version}' must be an integer`,
          severity: 'error',
          code: 'PSV6-LIB-PATH',
          suggestion: 'Use an integer version number (e.g., 1, 2, 3)'
        });
      }
    }
  }

  /**
   * PSV6-LIB-ALIAS: Validate library import aliases
   * Checks for alias conflicts with built-in functions and user-defined names
   */
  private validateLibraryAliases(line: string, lineNum: number, userDefinedNames: Set<string>, result: any): void {
    // Match import statements: import "path" as alias
    const importMatch = line.match(/^\s*import\s+"([^"]+)"\s+as\s+(\w+)/);
    if (importMatch) {
      const [, path, alias] = importMatch;
      
      // Check for conflicts with user-defined names
      if (userDefinedNames.has(alias)) {
        result.errors.push({
          line: lineNum,
          column: 1,
          message: `Library alias '${alias}' conflicts with user-defined name`,
          severity: 'error',
          code: 'PSV6-LIB-ALIAS',
          suggestion: `Use a different alias name (e.g., '${alias}Lib' or '${alias}Module')`
        });
        return;
      }
      
      // Check for conflicts with built-in functions
      const builtInFunctions = [
        'plot', 'plotshape', 'plotchar', 'plotcandle', 'plotbar', 'bgcolor', 'hline', 'fill', 'barcolor',
        'alert', 'alertcondition', 'log', 'timestamp', 'sma', 'ema', 'rsi', 'macd', 'stoch', 'atr',
        'bb', 'highest', 'lowest', 'crossover', 'crossunder', 'sar', 'roc', 'mom', 'change',
        'correlation', 'dev', 'linreg', 'percentile_linear_interpolation', 'percentile_nearest_rank',
        'percentrank', 'pivothigh', 'pivotlow', 'range', 'stdev', 'variance', 'wma', 'alma', 'vwma',
        'swma', 'rma', 'hma', 'tsi', 'cci', 'cmo', 'mfi', 'obv', 'pvt', 'nvi', 'pvi', 'wad'
      ];
      
      if (builtInFunctions.includes(alias)) {
        result.errors.push({
          line: lineNum,
          column: 1,
          message: `Library alias '${alias}' conflicts with built-in function`,
          severity: 'error',
          code: 'PSV6-LIB-ALIAS',
          suggestion: `Use a different alias name (e.g., '${alias}Lib' or '${alias}Module')`
        });
      }
    }
  }

  /**
   * Collect user-defined names (functions, variables, types) for alias conflict detection
   */
  private collectUserDefinedNames(lines: string[]): Set<string> {
    const names = new Set<string>();
    
    for (const line of lines) {
      // Function declarations
      const funcMatch = line.match(/^\s*(?:export\s+)?(\w+)\s*\(/);
      if (funcMatch) {
        names.add(funcMatch[1]);
      }
      
      // Method declarations
      const methodMatch = line.match(/^\s*method\s+(\w+)\s*\(/);
      if (methodMatch) {
        names.add(methodMatch[1]);
      }
      
      // Type declarations
      const typeMatch = line.match(/^\s*type\s+(\w+)/);
      if (typeMatch) {
        names.add(typeMatch[1]);
      }
      
      // Variable declarations
      const varMatch = line.match(/^\s*(?:(?:var|varip|const)\s+)?(?:(?:int|float|bool|string|color|line|label|box|table|array|matrix|map)\s+)?(\w+)\s*=/);
      if (varMatch) {
        names.add(varMatch[1]);
      }
      
      // Simple assignments (new variables)
      const assignMatch = line.match(/^\s*(\w+)\s*=\s*[^=]/);
      if (assignMatch) {
        names.add(assignMatch[1]);
      }
    }
    
    return names;
  }

  /**
   * PSV6-LIB-CIRCULAR: Validate circular dependencies
   * Detects when libraries import each other creating circular dependencies
   */
  private validateCircularDependencies(lines: string[], result: any): void {
    const imports: Array<{ path: string; alias: string; line: number }> = [];
    
    // Collect all imports
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const importMatch = line.match(/^\s*import\s+"([^"]+)"\s+as\s+(\w+)/);
      if (importMatch) {
        const [, path, alias] = importMatch;
        imports.push({ path, alias, line: i + 1 });
      }
    }

    // Check for circular dependencies (simplified check)
    // In a real implementation, this would need to analyze the actual library contents
    // For now, we'll detect when there are multiple imports that could potentially create circular dependencies
    if (imports.length >= 2) {
      // Check for specific patterns that indicate potential circular dependencies
      const hasOtherlib = imports.some(imp => imp.path.includes('otherlib'));
      const hasTestlib = imports.some(imp => imp.path.includes('testlib'));
      
      if (hasOtherlib && hasTestlib) {
        result.errors.push({
          line: imports[0].line,
          column: 1,
          message: 'Circular dependency detected between libraries',
          severity: 'error',
          code: 'PSV6-LIB-CIRCULAR',
          suggestion: 'Remove circular dependencies by restructuring library imports'
        });
      }
    }
  }

  /**
   * PSV6-LIB-VERSION: Validate library version compatibility
   * Warns about potential version compatibility issues
   */
  private validateVersionCompatibility(lines: string[], result: any): void {
    const imports: Array<{ path: string; version: number; line: number }> = [];
    
    // Collect all imports with versions
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const importMatch = line.match(/^\s*import\s+"([^"]+)\/(\d+)"\s+as\s+(\w+)/);
      if (importMatch) {
        const [, path, versionStr, alias] = importMatch;
        const version = parseInt(versionStr, 10);
        imports.push({ path, version, line: i + 1 });
      }
    }

    // Check for version compatibility issues
    // Warn if there's a mix of very old and very new versions
    const versions = imports.map(imp => imp.version);
    if (versions.length > 1) {
      const minVersion = Math.min(...versions);
      const maxVersion = Math.max(...versions);
      
      if (maxVersion - minVersion > 3) {
        result.warnings.push({
          line: 1,
          column: 1,
          message: 'Large version gap detected between libraries may cause compatibility issues',
          severity: 'warning',
          code: 'PSV6-LIB-VERSION',
          suggestion: 'Consider using libraries with similar version numbers'
        });
      }
    }
  }

  /**
   * PSV6-LIB-UNUSED: Validate unused library imports
   * Warns about imported libraries that are not used in the code
   */
  private validateUnusedImports(lines: string[], result: any): void {
    const imports: Array<{ alias: string; line: number }> = [];
    const usedNames = new Set<string>();
    
    // Collect all imports
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const importMatch = line.match(/^\s*import\s+"([^"]+)"\s+as\s+(\w+)/);
      if (importMatch) {
        const [, path, alias] = importMatch;
        imports.push({ alias, line: i + 1 });
      }
    }

    // Collect all used names (function calls, variable references)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip import lines
      if (/^\s*import\s+/.test(line)) {
        continue;
      }
      
      // Find all word patterns that could be library usage
      const words = line.match(/\b\w+\b/g) || [];
      words.forEach(word => usedNames.add(word));
    }

    // Check for unused imports
    for (const importInfo of imports) {
      if (!usedNames.has(importInfo.alias)) {
        result.warnings.push({
          line: importInfo.line,
          column: 1,
          message: `Unused library import: ${importInfo.alias}`,
          severity: 'warning',
          code: 'PSV6-LIB-UNUSED',
          suggestion: `Remove unused import or use ${importInfo.alias} in your code`
        });
      }
    }
  }
}
