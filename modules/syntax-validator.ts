/**
 * Syntax validation module for Pine Script v6
 * Handles basic syntax validation, script declarations, and structural checks
 */

import { ValidationModule, ValidationContext, ValidatorConfig, ValidationError, ValidationResult } from '../core/types';
import { 
  VERSION_RE, 
  SCRIPT_START_RE, 
  QUALIFIED_FN_RE, 
  METHOD_DECL_RE,
  VAR_DECL_RE,
  VAR_REASSIGN_RE,
  COMPOUND_ASSIGN_RE,
  ELEM_REASSIGN_RE,
  ELEM_COMPOUND_RE,
  SIMPLE_ASSIGN_RE,
  TUPLE_DECL_RE,
  TUPLE_REASSIGN_RE,
  KEYWORDS,
  NAMESPACES,
  NS_MEMBERS,
  PSEUDO_VARS,
  WILDCARD_IDENT,
  IDENT
} from '../core/constants';

export class SyntaxValidator implements ValidationModule {
  name = 'SyntaxValidator';

  getDependencies(): string[] {
    return [];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    const errors: ValidationError[] = [];

    // Check version directive
    this.validateVersionDirective(context, errors);

    // Check script declaration
    this.validateScriptDeclaration(context, errors);

    // Validate syntax elements
    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;
      
      this.validateLine(line, lineNum, context, config, errors);
    }

    // Post-validation checks
    this.validateOverallStructure(context, errors);

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: [],
      info: [],
      typeMap: new Map(),
      scriptType: null
    };
  }

  private validateVersionDirective(context: ValidationContext, errors: ValidationError[]): void {
    // CoreValidator emits PS012 (missing version) — avoid duplicating it here
    if (!context.hasVersion) {
      return;
    }

    const versionLine = context.firstVersionLine;
    if (versionLine && versionLine !== 1) {
      const sourceLines = context.rawLines?.length ? context.rawLines : context.cleanLines;
      const onlyCommentsAbove = sourceLines.slice(0, versionLine - 1).every(raw => {
        const trimmed = (raw || '').trim();
        if (trimmed === '') return true;
        if (/^\/\//.test(trimmed)) return true;
        if (/^\/\*/.test(trimmed) || /^\*/.test(trimmed) || /^\*\//.test(trimmed)) return true;
        return false;
      });

      if (!onlyCommentsAbove) {
        errors.push({
          line: versionLine,
          column: 1,
          message: 'Version directive should be on the first line.',
          severity: 'warning',
          code: 'PSW01'
        });
      }
    }
  }

  private validateScriptDeclaration(context: ValidationContext, errors: ValidationError[]): void {
    // CoreValidator emits PS013 (missing script declaration) — avoid duplicating it here
    if (!context.scriptType) {
      return;
    } else {
      // Check if script declaration is at the top
      const firstReal = context.cleanLines.findIndex(l => l.trim() && !VERSION_RE.test(l));
      if (firstReal > -1 && !this.hasScriptDeclStartingAtOrSoon(context, firstReal)) {
        errors.push({
          line: firstReal + 1,
          column: 1,
          message: 'Consider placing the script declaration at the top for clarity.',
          severity: 'info',
          code: 'PSI01'
        });
      }
    }
  }

  private validateLine(line: string, lineNum: number, context: ValidationContext, config: ValidatorConfig, errors: ValidationError[]): void {
    const t = line.trim();
    if (t === '') return;

    const noStrings = this.stripStringsAndLineComment(line);

    // Version directive validation
    if (VERSION_RE.test(line)) {
      this.validateVersionLine(line, lineNum, context, config, errors);
      return;
    }

    // Script declaration validation
    if (SCRIPT_START_RE.test(line)) {
      this.validateScriptDeclLine(line, lineNum, context, errors);
      return;
    }

    // Function declaration validation
    if (QUALIFIED_FN_RE.test(line) || METHOD_DECL_RE.test(line)) {
      this.validateFunctionDeclaration(line, lineNum, context, errors);
    }

    // Variable declaration validation
    if (VAR_DECL_RE.test(line)) {
      this.validateVariableDeclaration(line, lineNum, context, errors);
    }

    // Reassignment validation
    if (VAR_REASSIGN_RE.test(line)) {
      this.validateReassignment(line, lineNum, context, errors);
    }

    // Compound assignment validation
    if (COMPOUND_ASSIGN_RE.test(line)) {
      this.validateCompoundAssignment(line, lineNum, context, errors);
    }

    // Element operations validation
    if (ELEM_REASSIGN_RE.test(noStrings)) {
      this.validateElementReassignment(line, lineNum, context, errors);
    }

    if (ELEM_COMPOUND_RE.test(noStrings)) {
      this.validateElementCompoundAssignment(line, lineNum, context, errors);
    }

    // Tuple destructuring validation
    if (TUPLE_DECL_RE.test(line)) {
      this.validateTupleDeclaration(line, lineNum, context, errors);
    }

    if (TUPLE_REASSIGN_RE.test(noStrings)) {
      this.validateTupleReassignment(noStrings, lineNum, errors);
    }

    this.validateFieldAssignmentOperators(line, lineNum, context, errors);

    // Operator validation
    this.validateOperators(line, lineNum, noStrings, context, errors);

    // History reference validation
    this.validateHistoryReferences(noStrings, lineNum, errors);

    // NA comparison validation
    this.validateNAComparisons(noStrings, lineNum, errors);
  }

  private validateVersionLine(line: string, lineNum: number, context: ValidationContext, config: ValidatorConfig, errors: ValidationError[]): void {
    const m = line.match(VERSION_RE);
    if (m) {
      const v = parseInt(m[1], 10);
      if (context.firstVersionLine === null) {
        if (config.targetVersion && v !== config.targetVersion) {
          const sev = v < config.targetVersion ? 'error' : 'warning';
          errors.push({
            line: lineNum,
            column: 1,
            message: `Script declares //@version=${v} but targetVersion is ${config.targetVersion}.`,
            severity: sev,
            code: 'PS001'
          });
        }
        if (v < 5) {
          errors.push({
            line: lineNum,
            column: 1,
            message: `Pine version ${v} is deprecated. Prefer v5 or v6.`,
            severity: 'warning',
            code: 'PSW02'
          });
        }
      } else if (lineNum !== context.firstVersionLine) {
        errors.push({
          line: lineNum,
          column: 1,
          message: 'Multiple //@version directives. Only one allowed.',
          severity: 'error',
          code: 'PS002'
        });
      }
    }
  }

  private validateScriptDeclLine(line: string, lineNum: number, context: ValidationContext, errors: ValidationError[]): void {
    const m = line.match(SCRIPT_START_RE);
    if (m) {
      const scriptType = m[1] as 'indicator' | 'strategy' | 'library';
      if (context.scriptType && context.scriptType !== scriptType) {
        errors.push({
          line: lineNum,
          column: 1,
          message: `Multiple script declarations not allowed (already '${context.scriptType}').`,
          severity: 'error',
          code: 'PS004B'
        });
      }
    }
  }

  private validateFunctionDeclaration(line: string, lineNum: number, context: ValidationContext, errors: ValidationError[]): void {
    const funcMatch = line.match(QUALIFIED_FN_RE);
    const methMatch = line.match(METHOD_DECL_RE);
    
    if (funcMatch) {
      const name = funcMatch[1];
      if (KEYWORDS.has(name)) {
        errors.push({
          line: lineNum,
          column: line.indexOf(name) + 1,
          message: `Function name '${name}' conflicts with a Pine keyword.`,
          severity: 'error',
          code: 'PS006'
        });
      }
    } else if (methMatch) {
      const name = methMatch[1];
      if (KEYWORDS.has(name)) {
        errors.push({
          line: lineNum,
          column: line.indexOf(name) + 1,
          message: `Method name '${name}' conflicts with a Pine keyword.`,
          severity: 'error',
          code: 'PS006'
        });
      }
    }
  }

  private validateVariableDeclaration(line: string, lineNum: number, context: ValidationContext, errors: ValidationError[]): void {
    const decl = line.match(VAR_DECL_RE);
    if (decl) {
      const name = decl[1];
      if (KEYWORDS.has(name) || PSEUDO_VARS.has(name)) {
        errors.push({
          line: lineNum,
          column: line.indexOf(name) + 1,
          message: `Identifier '${name}' conflicts with a Pine keyword/builtin.`,
          severity: 'error',
          code: 'PS007'
        });
      }
    }
  }

  private validateReassignment(line: string, lineNum: number, context: ValidationContext, errors: ValidationError[]): void {
    const m = line.match(VAR_REASSIGN_RE);
    if (m) {
      const varName = m[1];
      
      // Check if this is a UDT field assignment (this.field := value)
      const udtFieldMatch = line.match(/^\s*this\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*/);
      if (udtFieldMatch) {
        // This is a UDT field assignment - it's valid if we're inside a method
        // The UDTValidator will handle field validation separately
        return;
      }
      
      // Check if this is a method parameter
      if (this.isMethodParameter(varName, lineNum, context)) {
        // This is a method parameter - it's valid
        return;
      }
      
      const column = line.indexOf(varName) + 1;
      const nextChar = line[column - 1 + varName.length];
      const prevChar = column > 1 ? line[column - 2] : '';
      if (nextChar === '.' || prevChar === '.') {
        return;
      }

      if (!context.declaredVars.has(varName)) {
        errors.push({
          line: lineNum,
          column,
          message: `Variable '${varName}' not declared before ':='. Use '=' on first assignment.`,
          severity: 'error',
          code: 'PS016'
        });
      }
    }
  }

  private validateCompoundAssignment(line: string, lineNum: number, context: ValidationContext, errors: ValidationError[]): void {
    const comp = line.match(COMPOUND_ASSIGN_RE);
    if (comp) {
      const name = comp[1];
      if (!context.declaredVars.has(name)) {
        errors.push({
          line: lineNum,
          column: line.indexOf(name) + 1,
          message: `Variable '${name}' not declared before '${comp[2]}='. Use '=' for first assignment or declare it.`,
          severity: 'error',
          code: 'PS017'
        });
      }
    }
  }

  private validateElementReassignment(line: string, lineNum: number, context: ValidationContext, errors: ValidationError[]): void {
    const elemReassign = this.stripStringsAndLineComment(line).match(ELEM_REASSIGN_RE);
    if (elemReassign) {
      const base = elemReassign[1];
      if (!context.declaredVars.has(base)) {
        errors.push({
          line: lineNum,
          column: line.indexOf(base) + 1,
          message: `Variable '${base}' not declared before ':=' on element.`,
          severity: 'error',
          code: 'PS016A'
        });
      }
    }
  }

  private validateElementCompoundAssignment(line: string, lineNum: number, context: ValidationContext, errors: ValidationError[]): void {
    const elemCompound = this.stripStringsAndLineComment(line).match(ELEM_COMPOUND_RE);
    if (elemCompound) {
      const base = elemCompound[1];
      const op = elemCompound[2];
      if (!context.declaredVars.has(base)) {
        errors.push({
          line: lineNum,
          column: line.indexOf(base) + 1,
          message: `Variable '${base}' not declared before '${op}=' on element.`,
          severity: 'error',
          code: 'PS017A'
        });
      }
    }
  }

  private validateTupleDeclaration(line: string, lineNum: number, context: ValidationContext, errors: ValidationError[]): void {
    const tupleMatch = line.match(TUPLE_DECL_RE);
    if (tupleMatch) {
      const content = tupleMatch[1];
      if (/^\s*,|,\s*,|,\s*$/.test(content)) {
        errors.push({
          line: lineNum,
          column: line.indexOf('[') + 1,
          message: 'Empty slot in destructuring tuple.',
          severity: 'warning',
          code: 'PST02'
        });
      }
    }
  }

  private validateTupleReassignment(noStrings: string, lineNum: number, errors: ValidationError[]): void {
    if (TUPLE_REASSIGN_RE.test(noStrings)) {
      errors.push({
        line: lineNum,
        column: 1,
        message: 'Tuple destructuring must use "=" (not ":=").',
        severity: 'error',
        code: 'PST03'
      });
    }
  }

  private validateFieldAssignmentOperators(line: string, lineNum: number, context: ValidationContext, errors: ValidationError[]): void {
    const stripped = this.stripStrings(line);
    const fieldAssignRe = /\b((?:this)|[A-Za-z_][A-Za-z0-9_]*)\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?![=>])/g;
    const declaredVars = context.declaredVars ?? new Map<string, number>();
    let match: RegExpExecArray | null;

    while ((match = fieldAssignRe.exec(stripped)) !== null) {
      const base = match[1];
      const field = match[2];

      if (NAMESPACES.has(base) || KEYWORDS.has(base) || KEYWORDS.has(`${base}.${field}`)) {
        continue;
      }

      if (base !== 'this' && !declaredVars.has(base)) {
        continue;
      }

      const eqOffset = match[0].indexOf('=');
      const column = match.index + eqOffset + 1;

      errors.push({
        line: lineNum,
        column,
        message: `Use ':=' to assign to '${base}.${field}'. '=' is reserved for the first assignment.`,
        severity: 'error',
        code: 'PS016'
      });
    }
  }

  private validateOperators(line: string, lineNum: number, noStrings: string, context: ValidationContext, errors: ValidationError[]): void {
    // Check for invalid operators
    const invalidOps = ['===', '!==', '++', '--', '^', '~'];
    for (const op of invalidOps) {
      let from = 0;
      while (true) {
        const idx = noStrings.indexOf(op, from);
        if (idx === -1) break;
        errors.push({
          line: lineNum,
          column: idx + 1,
          message: `Operator '${op}' is not valid in Pine Script.`,
          severity: 'warning',
          code: 'PSO01'
        });
        from = idx + op.length;
      }
    }

    // Check for && and || operators
    const logicalOps = ['&&', '||'];
    for (const op of logicalOps) {
      let from = 0;
      while (true) {
        const idx = noStrings.indexOf(op, from);
        if (idx === -1) break;
        errors.push({
          line: lineNum,
          column: idx + 1,
          message: `Operator '${op}' is not valid in Pine Script. Use 'and'/'or' instead.`,
          severity: 'warning',
          code: 'PSO01'
        });
        from = idx + op.length;
      }
    }

    // Check for ! operator
    const bangScan = noStrings.replace(/!=/g, '  ');
    let p = bangScan.indexOf('!');
    while (p !== -1) {
      errors.push({
        line: lineNum,
        column: p + 1,
        message: "Operator '!' is not valid in Pine. Use 'not'.",
        severity: 'warning',
        code: 'PSO01'
      });
      p = bangScan.indexOf('!', p + 1);
    }
  }

  private validateHistoryReferences(noStrings: string, lineNum: number, errors: ValidationError[]): void {
    const negHist = noStrings.match(/\[\s*-\d+\s*\]/);
    if (negHist) {
      errors.push({
        line: lineNum,
        column: (negHist.index ?? 0) + 1,
        message: 'Invalid history reference: negative indexes are not allowed.',
        severity: 'error',
        code: 'PS024'
      });
    }
  }

  private validateNAComparisons(noStrings: string, lineNum: number, errors: ValidationError[]): void {
    if (/(\bna\s*[!=]=)|([!=]=\s*na\b)/.test(noStrings)) {
      errors.push({
        line: lineNum,
        column: 1,
        message: "Direct comparison with 'na' is unreliable. Use na(x), e.g., na(myValue).",
        severity: 'warning',
        code: 'PS023',
        suggestion: 'Replace `x == na` with `na(x)` and `x != na` with `not na(x)`.'
      });
    }
  }

  private validateOverallStructure(context: ValidationContext, errors: ValidationError[]): void {
    // Check for unmatched brackets (this would need to be tracked during line-by-line validation)
    // For now, we'll add a placeholder
    if (context.cleanLines.length === 0) {
      errors.push({
        line: 1,
        column: 1,
        message: 'Script is empty.',
        severity: 'error',
        code: 'PS-EMPTY'
      });
    }
  }

  private hasScriptDeclStartingAtOrSoon(context: ValidationContext, idx: number, lookahead = 6): boolean {
    for (let i = idx; i < Math.min(idx + lookahead, context.cleanLines.length); i++) {
      if (SCRIPT_START_RE.test(context.cleanLines[i])) return true;
      if (context.cleanLines[i].trim() && !/^[('"\s,)]/.test(context.cleanLines[i])) break;
    }
    return false;
  }

  private stripStringsAndLineComment(line: string): string {
    return this.stripStrings(line).replace(/\/\/.*$/, '');
  }

  private stripStrings(line: string): string {
    return line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => ' '.repeat(m.length));
  }

  private isMethodParameter(varName: string, lineNum: number, context: ValidationContext): boolean {
    // Check if we're inside a method definition by looking backwards for method declarations
    for (let i = lineNum - 1; i >= 0; i--) {
      const line = context.cleanLines[i];
      
      // Look for method declaration: method methodName(...) =>
      const methodMatch = line.match(/^\s*method\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=>/);
      if (methodMatch) {
        const params = methodMatch[2];
        
        // Check if the variable name is in the method parameters
        // Handle both typed (newX<float>) and untyped (newX) parameters
        const paramList = this.parseParameterList(params);
        for (const param of paramList) {
          const paramName = this.extractParameterName(param);
          if (paramName === varName) {
            return true;
          }
        }
        
        // Also check for 'this' parameter
        if (varName === 'this') {
          return true;
        }
      }
      
      // Stop if we hit a non-indented line (we've left the method scope)
      const currentIndent = this.getLineIndentation(line);
      const nextLineIndent = i < context.cleanLines.length - 1 ? 
        this.getLineIndentation(context.cleanLines[i + 1]) : 0;
      
      if (currentIndent === 0 && nextLineIndent > 0) {
        // We found a method declaration, but we're past its scope
        break;
      }
    }
    
    return false;
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

  private extractParameterName(param: string): string {
    // Extract parameter name from typed parameter (e.g., "newX<float>" -> "newX")
    // or return the parameter as-is if untyped
    const match = param.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    return match ? match[1] : param.trim();
  }

  private getLineIndentation(line: string): number {
    return line.length - line.trimStart().length;
  }
}
