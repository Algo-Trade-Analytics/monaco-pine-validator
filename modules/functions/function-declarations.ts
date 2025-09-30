/**
 * Function Declarations Validator
 * 
 * Handles parsing and validation of Pine Script function declarations:
 * - Function declaration syntax validation
 * - Parameter list parsing and validation
 * - Method declaration validation
 * - Duplicate parameter detection
 * 
 * Extracted from function-validator.ts to improve maintainability.
 */

import {
  ValidationModule,
  ValidationContext,
  ValidatorConfig,
  ValidationError,
  ValidationResult,
  AstValidationContext,
} from '../../core/types';
import { IDENT } from '../../core/constants';
import type { FunctionDeclarationNode, ParameterNode, ProgramNode, TypeReferenceNode } from '../../core/ast/nodes';
import { visit } from '../../core/ast/traversal';
import { getSourceLines } from '../../core/ast/source-utils';

interface FunctionInfo {
  name: string;
  parameters: string[];
  returnType: string;
  line: number;
  column: number;
  isMethod: boolean;
}

export class FunctionDeclarationsValidator implements ValidationModule {
  name = 'FunctionDeclarationsValidator';
  priority = 95; // High priority - function declarations are fundamental

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;

  // Function tracking
  private functionNames = new Set<string>();
  private methodNames = new Set<string>();
  private functionParams = new Map<string, string[]>();
  private functionHeaderLine = new Map<string, number>();
  private userFunctions: Map<string, FunctionInfo> = new Map();

  getDependencies(): string[] {
    return ['SyntaxValidator']; // Depends on basic syntax validation
  }

  validate(context: ValidationContext, _config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;

    const astContext = this.isAstContext(context) ? context : null;
    const program = astContext?.ast;

    if (!program) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: null,
      };
    }

    this.collectFunctionsFromAst(program);
    this.collectStaticFunctionDeclarations(getSourceLines(context));

    // Update the shared context with function information
    if (this.context.functionNames) {
      for (const funcName of this.functionNames) {
        this.context.functionNames.add(funcName);
      }
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: null
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.functionNames.clear();
    this.methodNames.clear();
    this.functionParams.clear();
    this.functionHeaderLine.clear();
    this.userFunctions.clear();
  }

  private addError(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.errors.push({ line, column, message, severity: 'error', code, suggestion });
  }

  private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  private addInfo(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.info.push({ line, column, message, severity: 'info', code, suggestion });
  }

  private isAstContext(context: ValidationContext): context is AstValidationContext {
    return 'ast' in context;
  }

  private collectFunctionsFromAst(program: ProgramNode): void {
    visit(program, {
      FunctionDeclaration: {
        enter: (path) => {
          this.processAstFunctionDeclaration(path.node as FunctionDeclarationNode);
        },
      },
    });
  }

  private processAstFunctionDeclaration(fn: FunctionDeclarationNode): void {
    if (!fn.identifier) {
      return;
    }

    const fullName = fn.identifier.name;
    const params = fn.params.map((param) => this.formatAstParameter(param));
    const paramNames = fn.params.map((param) => param.identifier.name).filter(Boolean);
    const headerLine = fn.loc.start.line;
    const headerColumn = fn.loc.start.column;
    const hasThisParam = paramNames.includes('this');
    const isMethodCandidate = fullName.includes('.');
    const isMethod = isMethodCandidate && hasThisParam;
    const storeName = isMethod ? fullName.split('.').pop() ?? fullName : fullName;

    this.functionNames.add(storeName);
    this.functionParams.set(storeName, params);
    this.context.functionParams.set(storeName, params);
    this.functionHeaderLine.set(storeName, headerLine);
    this.userFunctions.set(storeName, {
      name: storeName,
      parameters: paramNames,
      returnType: 'unknown',
      line: headerLine,
      column: headerColumn,
      isMethod,
    });

    if (isMethod && fullName !== storeName) {
      this.methodNames.add(storeName);
      this.context.methodNames?.add(storeName);
      this.functionNames.add(fullName);
      this.functionParams.set(fullName, params);
      this.context.functionParams.set(fullName, params);
      this.functionHeaderLine.set(fullName, headerLine);
      this.userFunctions.set(fullName, {
        name: fullName,
        parameters: paramNames,
        returnType: 'unknown',
        line: headerLine,
        column: headerColumn,
        isMethod,
      });
    }

    const seen = new Set<string>();
    for (const paramName of paramNames) {
      if (!paramName) {
        continue;
      }
      if (seen.has(paramName)) {
        const message = paramName === 'this' && isMethod
          ? `Duplicate 'this' parameter in method '${fullName}'.`
          : `Duplicate parameter '${paramName}' in function '${fullName}'.`;
        this.addError(headerLine, headerColumn, message, 'PSDUP01');
      }
      seen.add(paramName);
    }
  }

  private formatAstParameter(param: ParameterNode): string {
    const typeAnnotation = param.typeAnnotation ? `${this.stringifyAstTypeReference(param.typeAnnotation)} ` : '';
    const name = param.identifier.name;
    const defaultValue = param.defaultValue ? ' = <default>' : '';
    return `${typeAnnotation}${name}${defaultValue}`.trim();
  }

  private stringifyAstTypeReference(type: TypeReferenceNode): string {
    const base = type.name.name;
    if (!type.generics.length) {
      return base;
    }

    const generics = type.generics.map((generic) => this.stringifyAstTypeReference(generic));
    return `${base}<${generics.join(', ')}>`;
  }

  private collectStaticFunctionDeclarations(lines: string[]): void {
    const START_STATIC = new RegExp(`^\\s*(?:export\\s+)?static\\s+(${IDENT.source})\\s+(${IDENT.source})\\s*\\(`);
    const FULL_STATIC = new RegExp(
      `^\\s*(?:export\\s+)?static\\s+(${IDENT.source})\\s+(${IDENT.source})\\s*\\(([\\s\\S]*?)\\)\\s*=>`,
      'm',
    );

    let buffer = '';
    let startIndex = -1;
    let linesSeen = 0;
    const MAX_HEADER_LINES = 12;

    const reset = () => {
      buffer = '';
      startIndex = -1;
      linesSeen = 0;
    };

    const processBuffer = () => {
      if (startIndex < 0) {
        return;
      }
      const match = buffer.match(FULL_STATIC);
      if (!match) {
        return;
      }

      const typeName = match[1];
      const methodName = match[2];
      const paramsRaw = match[3];
      const params = paramsRaw.split(',').map((param) => param.trim()).filter(Boolean);
      const full = `${typeName}.${methodName}`;
      const lineNum = startIndex + 1;

      if (!this.functionNames.has(full)) {
        this.functionNames.add(full);
      }
      if (!this.functionParams.has(full)) {
        this.functionParams.set(full, params);
      }
      if (!this.context.functionParams.has(full)) {
        this.context.functionParams.set(full, params);
      }
      if (!this.functionHeaderLine.has(full)) {
        this.functionHeaderLine.set(full, lineNum);
      }
      if (!this.userFunctions.has(full)) {
        const namesOnly = this.extractNamesFromRawParams(params);
        this.userFunctions.set(full, {
          name: full,
          parameters: namesOnly,
          returnType: 'unknown',
          line: lineNum,
          column: 1,
          isMethod: false,
        });
      }

      this.addError(lineNum, 1, `'static' is not a valid type keyword in Pine Script v6.`, 'PSV6-STATIC-UNSUPPORTED');
    };

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (startIndex < 0) {
        const staticMatch = line.match(START_STATIC);
        if (!staticMatch) {
          continue;
        }

        startIndex = index;
        buffer = `${line}\n`;
        linesSeen = 1;

        if (/=>/.test(line)) {
          processBuffer();
          reset();
        }
        continue;
      }

      buffer += `${line}\n`;
      linesSeen++;

      if (/=>/.test(line)) {
        processBuffer();
        reset();
        continue;
      }

      if (linesSeen >= MAX_HEADER_LINES) {
        reset();
      }
    }
  }

  private extractNamesFromRawParams(params: string[]): string[] {
    return params
      .map((param) => {
        const withoutDefault = param.split('=')[0]?.trim() ?? '';
        const cleaned = withoutDefault.replace(/<[^>]*>/g, '').trim();
        if (!cleaned) {
          return '';
        }
        const tokens = cleaned.split(/\s+/);
        return tokens[tokens.length - 1] ?? '';
      })
      .filter(Boolean);
  }

  // Getter methods for other modules to access collected data
  getFunctionNames(): Set<string> {
    return new Set(this.functionNames);
  }

  getMethodNames(): Set<string> {
    return new Set(this.methodNames);
  }

  getFunctionParams(): Map<string, string[]> {
    return new Map(this.functionParams);
  }

  getFunctionHeaderLine(): Map<string, number> {
    return new Map(this.functionHeaderLine);
  }

  getUserFunctions(): Map<string, FunctionInfo> {
    return new Map(this.userFunctions);
  }
}
