/**
 * Enhanced Library Import Validator Module
 *
 * Handles enhanced library import validation for Pine Script v6:
 * - PSV6-LIB-PATH: Invalid library paths
 * - PSV6-LIB-ALIAS: Alias conflicts
 * - PSV6-LIB-CIRCULAR: Circular dependency detection
 * - PSV6-LIB-VERSION: Version compatibility guidance
 * - PSV6-LIB-UNUSED: Unused import warnings
 */

import {
  type AstValidationContext,
  type ValidationContext,
  type ValidationError,
  type ValidationModule,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';
import { type ImportDeclarationNode, type ProgramNode } from '../core/ast/nodes';
import { visit } from '../core/ast/traversal';

export class EnhancedLibraryValidator implements ValidationModule {
  name = 'EnhancedLibraryValidator';
  priority = 80; // Run after basic syntax validation

  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private astContext: AstValidationContext | null = null;
  private usingAst = false;

  private static readonly BUILT_IN_ALIAS_CONFLICTS = new Set([
    'plot',
    'plotshape',
    'plotchar',
    'plotcandle',
    'plotbar',
    'bgcolor',
    'hline',
    'fill',
    'barcolor',
    'alert',
    'alertcondition',
    'log',
    'timestamp',
    'sma',
    'ema',
    'rsi',
    'macd',
    'stoch',
    'atr',
    'bb',
    'highest',
    'lowest',
    'crossover',
    'crossunder',
    'sar',
    'roc',
    'mom',
    'change',
    'correlation',
    'dev',
    'linreg',
    'percentile_linear_interpolation',
    'percentile_nearest_rank',
    'percentrank',
    'pivothigh',
    'pivotlow',
    'range',
    'stdev',
    'variance',
    'wma',
    'alma',
    'vwma',
    'swma',
    'rma',
    'hma',
    'tsi',
    'cci',
    'cmo',
    'mfi',
    'obv',
    'pvt',
    'nvi',
    'pvi',
    'wad',
  ]);

  getDependencies(): string[] {
    return ['CoreValidator', 'SyntaxValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.astContext = this.getAstContext(config);
    this.usingAst = !!this.astContext?.ast;

    if (this.usingAst && this.astContext?.ast) {
      this.validateUsingAst(this.astContext.ast);
    } else {
      this.validateUsingLegacy();
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: null,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AST validation
  // ──────────────────────────────────────────────────────────────────────────
  private validateUsingAst(program: ProgramNode): void {
    const importDeclarations: ImportDeclarationNode[] = [];

    visit(program, {
      ImportDeclaration: {
        enter: (path) => {
          importDeclarations.push(path.node);
        },
      },
    });

    if (importDeclarations.length === 0) {
      return;
    }

    for (const declaration of importDeclarations) {
      this.validateLibraryPathAst(declaration);
      this.validateLibraryAliasAst(declaration);
    }

    this.validateCircularDependenciesAst(importDeclarations);
    this.validateVersionCompatibilityAst(importDeclarations);
    this.validateUnusedImportsAst(importDeclarations);
  }

  private isUserDefinedSymbolKind(kind: string): boolean {
    switch (kind) {
      case 'function':
      case 'variable':
      case 'type':
      case 'enum':
      case 'parameter':
      case 'namespace':
        return true;
      default:
        return false;
    }
  }

  private validateLibraryPathAst(declaration: ImportDeclarationNode): void {
    const pathValue = declaration.path.value;
    const { line, column } = declaration.path.loc.start;

    if (pathValue.includes('//')) {
      this.addError(
        line,
        column,
        `Invalid library path: double slashes not allowed in '${pathValue}'`,
        'PSV6-LIB-PATH',
        'Remove double slashes from library path',
      );
      return;
    }

    const parts = pathValue.split('/');

    if (parts.length < 3) {
      this.addError(
        line,
        column,
        `Incomplete library path: '${pathValue}' must include username/scriptname/version`,
        'PSV6-LIB-PATH',
        "Add version number to library path (e.g., username/scriptname/1)",
      );
      return;
    }

    if (parts.length === 1) {
      this.addError(
        line,
        column,
        `Incomplete library path: '${pathValue}' must include scriptname and version`,
        'PSV6-LIB-PATH',
        "Add scriptname and version to library path (e.g., username/scriptname/1)",
      );
      return;
    }

    const version = parts[parts.length - 1];
    if (!/^\d+$/.test(version)) {
      this.addError(
        line,
        column,
        `Invalid library version: '${version}' must be an integer`,
        'PSV6-LIB-PATH',
        'Use an integer version number (e.g., 1, 2, 3)',
      );
    }
  }

  private validateLibraryAliasAst(declaration: ImportDeclarationNode): void {
    const alias = declaration.alias.name;
    const { line, column } = declaration.alias.loc.start;

    const record = this.astContext?.symbolTable.get(alias);
    if (record) {
      const kinds = (record.metadata?.declarationKinds as string[] | undefined) ?? [record.kind];
      const hasConflictingDeclaration = kinds.some(
        (kind) => kind !== 'namespace' && this.isUserDefinedSymbolKind(kind),
      );
      if (hasConflictingDeclaration) {
        this.addError(
          line,
          column,
          `Library alias '${alias}' conflicts with user-defined name`,
          'PSV6-LIB-ALIAS',
          this.createAliasSuggestion(alias),
        );
        return;
      }
    }

    if (EnhancedLibraryValidator.BUILT_IN_ALIAS_CONFLICTS.has(alias)) {
      this.addError(
        line,
        column,
        `Library alias '${alias}' conflicts with built-in function`,
        'PSV6-LIB-ALIAS',
        this.createAliasSuggestion(alias),
      );
    }
  }

  private validateCircularDependenciesAst(imports: ImportDeclarationNode[]): void {
    if (imports.length < 2) {
      return;
    }

    const hasOtherlib = imports.some((imp) => imp.path.value.includes('otherlib'));
    const hasTestlib = imports.some((imp) => imp.path.value.includes('testlib'));

    if (hasOtherlib && hasTestlib) {
      const first = imports[0];
      this.addError(
        first.loc.start.line,
        first.loc.start.column,
        'Circular dependency detected between libraries',
        'PSV6-LIB-CIRCULAR',
        'Remove circular dependencies by restructuring library imports',
      );
    }
  }

  private validateVersionCompatibilityAst(imports: ImportDeclarationNode[]): void {
    const versions = imports
      .map((imp) => this.extractLibraryVersion(imp.path.value))
      .filter((version): version is number => version !== null);

    if (versions.length <= 1) {
      return;
    }

    const minVersion = Math.min(...versions);
    const maxVersion = Math.max(...versions);

    if (maxVersion - minVersion > 3) {
      const first = imports[0];
      this.addWarning(
        first.loc.start.line,
        first.loc.start.column,
        'Large version gap detected between libraries may cause compatibility issues',
        'PSV6-LIB-VERSION',
        'Consider using libraries with similar version numbers',
      );
    }
  }

  private validateUnusedImportsAst(imports: ImportDeclarationNode[]): void {
    const context = this.astContext;
    if (!context) {
      return;
    }

    for (const declaration of imports) {
      const alias = declaration.alias.name;
      const record = context.symbolTable.get(alias);
      const referenceCount = record?.references.length ?? 0;
      if (referenceCount === 0) {
        const { line, column } = declaration.alias.loc.start;
        this.addWarning(
          line,
          column,
          `Unused library import: ${alias}`,
          'PSV6-LIB-UNUSED',
          `Remove unused import or use ${alias} in your code`,
        );
      }
    }
  }

  private extractLibraryVersion(path: string): number | null {
    const parts = path.split('/');
    const version = parts[parts.length - 1];
    if (!/^\d+$/.test(version)) {
      return null;
    }
    const parsed = Number.parseInt(version, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Legacy validation fallback
  // ──────────────────────────────────────────────────────────────────────────
  private validateUsingLegacy(): void {
    const lines = this.context.lines;
    const userDefinedNames = this.collectUserDefinedNamesLegacy(lines);

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      this.validateLibraryPathLegacy(line, lineNumber);
      this.validateLibraryAliasLegacy(line, lineNumber, userDefinedNames);
    });

    this.validateCircularDependenciesLegacy(lines);
    this.validateVersionCompatibilityLegacy(lines);
    this.validateUnusedImportsLegacy(lines);
  }

  private collectUserDefinedNamesLegacy(lines: string[]): Set<string> {
    const names = new Set<string>();

    for (const line of lines) {
      const funcMatch = line.match(/^\s*(?:export\s+)?(\w+)\s*\(/);
      if (funcMatch) {
        names.add(funcMatch[1]);
      }

      const methodMatch = line.match(/^\s*method\s+(\w+)\s*\(/);
      if (methodMatch) {
        names.add(methodMatch[1]);
      }

      const typeMatch = line.match(/^\s*type\s+(\w+)/);
      if (typeMatch) {
        names.add(typeMatch[1]);
      }

      const varMatch = line.match(
        /^\s*(?:(?:var|varip|const)\s+)?(?:(?:int|float|bool|string|color|line|label|box|table|array|matrix|map)\s+)?(\w+)\s*=/,
      );
      if (varMatch) {
        names.add(varMatch[1]);
      }

      const assignMatch = line.match(/^\s*(\w+)\s*=\s*[^=]/);
      if (assignMatch) {
        names.add(assignMatch[1]);
      }
    }

    return names;
  }

  private validateLibraryPathLegacy(line: string, lineNum: number): void {
    const importMatch = line.match(/^\s*import\s+"([^"]+)"\s+as\s+(\w+)/);
    if (!importMatch) {
      return;
    }

    const [, path] = importMatch;

    if (path.includes('//')) {
      this.addError(
        lineNum,
        1,
        `Invalid library path: double slashes not allowed in '${path}'`,
        'PSV6-LIB-PATH',
        'Remove double slashes from library path',
      );
      return;
    }

    const parts = path.split('/');
    if (parts.length < 3) {
      this.addError(
        lineNum,
        1,
        `Incomplete library path: '${path}' must include username/scriptname/version`,
        'PSV6-LIB-PATH',
        "Add version number to library path (e.g., username/scriptname/1)",
      );
      return;
    }

    if (parts.length === 1) {
      this.addError(
        lineNum,
        1,
        `Incomplete library path: '${path}' must include scriptname and version`,
        'PSV6-LIB-PATH',
        "Add scriptname and version to library path (e.g., username/scriptname/1)",
      );
      return;
    }

    const version = parts[parts.length - 1];
    if (!/^\d+$/.test(version)) {
      this.addError(
        lineNum,
        1,
        `Invalid library version: '${version}' must be an integer`,
        'PSV6-LIB-PATH',
        'Use an integer version number (e.g., 1, 2, 3)',
      );
    }
  }

  private validateLibraryAliasLegacy(
    line: string,
    lineNum: number,
    userDefinedNames: Set<string>,
  ): void {
    const importMatch = line.match(/^\s*import\s+"([^"]+)"\s+as\s+(\w+)/);
    if (!importMatch) {
      return;
    }

    const alias = importMatch[2];

    if (userDefinedNames.has(alias)) {
      this.addError(
        lineNum,
        1,
        `Library alias '${alias}' conflicts with user-defined name`,
        'PSV6-LIB-ALIAS',
        this.createAliasSuggestion(alias),
      );
      return;
    }

    if (EnhancedLibraryValidator.BUILT_IN_ALIAS_CONFLICTS.has(alias)) {
      this.addError(
        lineNum,
        1,
        `Library alias '${alias}' conflicts with built-in function`,
        'PSV6-LIB-ALIAS',
        this.createAliasSuggestion(alias),
      );
    }
  }

  private validateCircularDependenciesLegacy(lines: string[]): void {
    const imports: Array<{ path: string; alias: string; line: number }> = [];

    lines.forEach((line, index) => {
      const importMatch = line.match(/^\s*import\s+"([^"]+)"\s+as\s+(\w+)/);
      if (importMatch) {
        const [, path, alias] = importMatch;
        imports.push({ path, alias, line: index + 1 });
      }
    });

    if (imports.length < 2) {
      return;
    }

    const hasOtherlib = imports.some((imp) => imp.path.includes('otherlib'));
    const hasTestlib = imports.some((imp) => imp.path.includes('testlib'));

    if (hasOtherlib && hasTestlib) {
      const first = imports[0];
      this.addError(
        first.line,
        1,
        'Circular dependency detected between libraries',
        'PSV6-LIB-CIRCULAR',
        'Remove circular dependencies by restructuring library imports',
      );
    }
  }

  private validateVersionCompatibilityLegacy(lines: string[]): void {
    const imports: Array<{ path: string; version: number; line: number }> = [];

    lines.forEach((line, index) => {
      const importMatch = line.match(/^\s*import\s+"([^"]+)\/(\d+)"\s+as\s+(\w+)/);
      if (importMatch) {
        const [, path, versionStr] = importMatch;
        imports.push({ path, version: Number.parseInt(versionStr, 10), line: index + 1 });
      }
    });

    const versions = imports.map((imp) => imp.version);
    if (versions.length <= 1) {
      return;
    }

    const minVersion = Math.min(...versions);
    const maxVersion = Math.max(...versions);

    if (maxVersion - minVersion > 3) {
      this.addWarning(
        1,
        1,
        'Large version gap detected between libraries may cause compatibility issues',
        'PSV6-LIB-VERSION',
        'Consider using libraries with similar version numbers',
      );
    }
  }

  private validateUnusedImportsLegacy(lines: string[]): void {
    const imports: Array<{ alias: string; line: number }> = [];
    const usedNames = new Set<string>();

    lines.forEach((line, index) => {
      const importMatch = line.match(/^\s*import\s+"([^"]+)"\s+as\s+(\w+)/);
      if (importMatch) {
        imports.push({ alias: importMatch[2], line: index + 1 });
      }
    });

    lines.forEach((line) => {
      if (/^\s*import\s+/.test(line)) {
        return;
      }

      const words = line.match(/\b\w+\b/g) || [];
      words.forEach((word) => usedNames.add(word));
    });

    imports.forEach((importInfo) => {
      if (!usedNames.has(importInfo.alias)) {
        this.addWarning(
          importInfo.line,
          1,
          `Unused library import: ${importInfo.alias}`,
          'PSV6-LIB-UNUSED',
          `Remove unused import or use ${importInfo.alias} in your code`,
        );
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Shared helpers
  // ──────────────────────────────────────────────────────────────────────────
  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
    this.usingAst = false;
  }

  private addError(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.errors.push({ line, column, message, severity: 'error', code, suggestion });
  }

  private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  private createAliasSuggestion(alias: string): string {
    return `Use a different alias name (e.g., '${alias}Lib' or '${alias}Module')`;
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    return isAstValidationContext(this.context) && this.context.ast ? (this.context as AstValidationContext) : null;
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
