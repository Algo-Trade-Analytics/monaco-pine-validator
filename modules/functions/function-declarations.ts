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

import { ValidationModule, ValidationContext, ValidatorConfig, ValidationError, ValidationResult } from '../../core/types';
import { IDENT } from '../../core/constants';

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
  private config!: ValidatorConfig;

  // Function tracking
  private functionNames = new Set<string>();
  private methodNames = new Set<string>();
  private functionParams = new Map<string, string[]>();
  private functionHeaderLine = new Map<string, number>();
  private userFunctions: Map<string, FunctionInfo> = new Map();

  getDependencies(): string[] {
    return ['SyntaxValidator']; // Depends on basic syntax validation
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    // Collect and validate function declarations
    this.collectFunctions(context.cleanLines);

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

  /**
   * Collect function declarations (extracted from function-validator.ts)
   * Handles both single-line and multi-line function declarations
   */
  private collectFunctions(lines: string[]): void {
    const START_QUAL = new RegExp(`^\\s*(?:export\\s+)?(${IDENT.source}(?:\\.${IDENT.source})*)\\s*\\(`);
    const START_STATIC = new RegExp(`^\\s*(?:export\\s+)?static\\s+(${IDENT.source})\\s+(${IDENT.source})\\s*\\(`);
    const START_FUNC = new RegExp(`^\\s*(?:export\\s+)?func\\s+(${IDENT.source}(?:\\.${IDENT.source})*)\\s*\\(`);
    const START_METH = new RegExp(`^\\s*method\\s+(${IDENT.source}(?:\\.${IDENT.source})*)\\s*\\(`);
    let buf = '';
    let startIdx = -1;
    let name: string | null = null;
    let linesSeen = 0;
    const MAX_HDR_LINES = 12;

    const reset = () => { buf = ''; startIdx = -1; name = null; linesSeen = 0; };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (startIdx < 0) {
        const staticMatch = line.match(START_STATIC);
        if (staticMatch) {
          startIdx = i;
          name = `${staticMatch[1]}.${staticMatch[2]}`;
          buf = line + '\n';
          linesSeen = 1;

          if (/=>/.test(line)) {
            this.processFunctionDeclaration(buf, startIdx + 1);
            reset();
          }
          continue;
        }

        const funcMatch = line.match(START_FUNC);
        if (funcMatch) {
          startIdx = i;
          name = funcMatch[1];
          buf = line + '\n';
          linesSeen = 1;

          if (/=>/.test(line)) {
            this.processFunctionDeclaration(buf, startIdx + 1);
            reset();
          }
          continue;
        }

        const methodMatch = line.match(START_METH);
        const qualMatch = methodMatch ? null : line.match(START_QUAL);
        const m = methodMatch || qualMatch;
        if (m) {
          const before = line.slice(0, m.index ?? 0);
          const dotted = before.endsWith('.') || /\.\s*$/.test(before);
          let candidate = methodMatch ? methodMatch[1] : m[1];

          if (candidate === 'func') {
            const fallback = line.match(/^\s*(?:export\s+)?func\s+(${IDENT.source}(?:\.${IDENT.source})*)\s*\(/);
            if (fallback) candidate = fallback[1];
          }

          // Skip script declarations (indicator/strategy/library)
          if (/^(indicator|strategy|library)$/.test(candidate)) {
            continue;
          }

          if (!dotted && !/=\s*[^=]/.test(line.substring(0, line.indexOf('(')))) {
            startIdx = i;
            name = candidate;
            buf = line + '\n';
            linesSeen = 1;

            // Check if this line also contains => (single-line method)
            if (/=>/.test(line)) {
              this.processFunctionDeclaration(buf, startIdx + 1);
              reset();
            }
          }
        }
        continue;
      }

      // collecting
      if (line.trim() === '') {
        buf += line + '\n';
        continue; // Allow blank lines without penalty
      }
      if (/^(if|for|while|switch|export\s+\S+\s+as\s+\S+)\b/.test(line.trim())) { reset(); continue; }
      buf += line + '\n';
      linesSeen++;

      // Header ended without => (very likely a call or something else)
      if (/\)\s*$/.test(line) && !/=>/.test(buf)) { reset(); continue; }

      if (/=>/.test(line)) {
        this.processFunctionDeclaration(buf, startIdx + 1);
        reset();
        continue;
      }

      if (linesSeen >= MAX_HDR_LINES) reset(); // safety bail
    }
  }

  private processFunctionDeclaration(buf: string, lineNum: number): void {
    const staticMatch = buf.match(new RegExp(`^\\s*(?:export\\s+)?static\\s+(${IDENT.source})\\s+(${IDENT.source})\\s*\\(([\\s\\S]*?)\\)\\s*=>`, 'm'));
    if (staticMatch) {
      const typeName = staticMatch[1];
      const methodName = staticMatch[2];
      const paramsRaw = staticMatch[3];
      const full = `${typeName}.${methodName}`;
      const params = paramsRaw.split(',').map(s => s.trim()).filter(Boolean);

      this.functionNames.add(full);
      this.functionParams.set(full, params);
      this.functionHeaderLine.set(full, lineNum);

      const namesOnly = params.map(p => {
        const beforeDefault = p.split('=')[0]?.trim() ?? '';
        const cleaned = beforeDefault.replace(/<[^>]*>/g, '').trim();
        if (!cleaned) return '';
        const tokens = cleaned.split(/\s+/);
        return tokens[tokens.length - 1] ?? '';
      }).filter(Boolean);

      const seen = new Set<string>();
      namesOnly.forEach((p) => {
        if (seen.has(p)) {
          this.addError(lineNum, 1, `Duplicate parameter '${p}' in function '${full}'.`, 'PSDUP01');
        }
        seen.add(p);
      });

      this.userFunctions.set(full, {
        name: full,
        parameters: namesOnly,
        returnType: 'unknown',
        line: lineNum,
        column: 1,
        isMethod: false
      });

      this.addError(lineNum, 1, `'static' is not a valid type keyword in Pine Script v6.`, 'PSV6-STATIC-UNSUPPORTED');
      return;
    }

    const methodDecl = buf.match(new RegExp(`^\\s*method\\s+(${IDENT.source}(?:\\.${IDENT.source})*)\\s*\\(([\\s\\S]*?)\\)\\s*=>`, 'm'));
    const generalDecl = methodDecl ? null : buf.match(new RegExp(`^\\s*(?:export\\s+)?(${IDENT.source}(?:\\.${IDENT.source})*)\\s*\\(([\\s\\S]*?)\\)\\s*=>`, 'm'));
    const m = methodDecl || generalDecl;

    if (m) {
      const full = m[1];
      const isMethod = !!methodDecl;
      let storeName = full;
      if (isMethod && full.includes('.')) {
        storeName = full.split('.').pop()!;
      } else if (!isMethod && full === 'func') {
        const funcNameMatch = buf.match(/^\s*(?:export\s+)?func\s+(${IDENT.source}(?:\.${IDENT.source})*)\s*\(/m);
        if (funcNameMatch) {
          storeName = funcNameMatch[1];
        }
      }
      if (isMethod) this.methodNames.add(storeName);

      const params = m[2].split(',').map(s => s.trim()).filter(Boolean);
      this.functionNames.add(storeName);
      if (isMethod && full !== storeName) {
        this.functionNames.add(full);
      }
      this.functionParams.set(storeName, params);
      if (isMethod && full !== storeName) {
        this.functionParams.set(full, params);
      }
      this.functionHeaderLine.set(storeName, lineNum);
      if (isMethod && full !== storeName) {
        this.functionHeaderLine.set(full, lineNum);
      }

      // Parse parameter names, handling type annotations and default values like "bool x = na"
      const namesOnly = params.map(p => {
        const beforeDefault = p.split('=')[0]?.trim() ?? '';
        const cleaned = beforeDefault.replace(/<[^>]*>/g, '').trim();
        if (!cleaned) return '';
        const tokens = cleaned.split(/\s+/);
        return tokens[tokens.length - 1] ?? '';
      }).filter(Boolean);

      const seen = new Set<string>();
      namesOnly.forEach((p) => {
        if (seen.has(p)) {
          const msg = (isMethod && p === 'this')
            ? `Duplicate 'this' parameter in method '${full}'.`
            : `Duplicate parameter '${p}' in function '${full}'.`;
          this.addError(lineNum, 1, msg, 'PSDUP01');
        }
        seen.add(p);
      });

      // Store function info for later validation
      const funcInfo: FunctionInfo = {
        name: storeName,
        parameters: namesOnly,
        returnType: 'unknown',
        line: lineNum,
        column: 1,
        isMethod
      };

      this.userFunctions.set(storeName, funcInfo);
      if (isMethod && full !== storeName) {
        this.userFunctions.set(full, funcInfo);
      }
    }
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
