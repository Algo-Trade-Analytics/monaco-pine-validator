/**
 * Scope Management Validation Module
 * 
 * Handles variable scope, declaration validation, and access control for Pine Script v6.
 * Extracts scope management logic from EnhancedPineScriptValidator.
 */

import { ValidationModule, ValidationContext, ValidatorConfig, ValidationError, ValidationResult, ScopeInfo } from '../core/types';
import { 
  IDENT, KEYWORDS, NAMESPACES, PSEUDO_VARS, WILDCARD_IDENT,
  QUALIFIED_FN_RE, METHOD_DECL_RE, VAR_DECL_RE, SIMPLE_ASSIGN_RE
} from '../core/constants';

export class ScopeValidator implements ValidationModule {
  name = 'ScopeValidator';
  priority = 80; // High priority, runs after CoreValidator

  // Error tracking
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];

  // Context and config
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  // Scope tracking
  private scopeStack: ScopeInfo[] = [];
  private indentStack: number[] = [0];
  private declared = new Map<string, number>();
  private declIndent = new Map<string, number>();
  private declBlockKey = new Map<string, string>();
  private declaredSites = new Set<string>();
  private used = new Set<string>();
  private everDeclared = new Set<string>();
  private functionParams = new Map<string, string[]>();
  private paramUsage = new Map<string, Set<string>>();
  private switchStack: Array<{ indent: number; caseCounter: number; currentKey: string | null }> = [];
  private currentCaseKey: string | null = null;
  private caseVariables = new Map<string, Set<string>>();

  getDependencies(): string[] {
    return ['CoreValidator']; // Depends on core validation
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    if (context.functionParams) {
      for (const [fn, params] of context.functionParams.entries()) {
        this.functionParams.set(fn, params);
      }
    }

    // Run scope validation checks
    this.validateVariableDeclarations();
    this.validateVariableAccess();
    this.validateScopeConsistency();
    this.validateParameterUsage();

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
    this.scopeStack = [{ indent: -1, params: new Set(), fnName: null, variables: new Set() }];
    this.indentStack = [0];
    this.declared.clear();
    this.declIndent.clear();
    this.declBlockKey.clear();
    this.everDeclared.clear();
    this.declaredSites.clear();
    this.used.clear();
    this.functionParams.clear();
    this.paramUsage.clear();
    this.switchStack = [];
    this.currentCaseKey = null;
    this.caseVariables.clear();
  }

  private validateVariableDeclarations(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;
      const strippedNoStrings = this.stripStringsAndLineComment(line);
      const indent = line.length - line.trimStart().length;
      const trimmed = line.trim();

      this.updateSwitchState(trimmed, indent);
      // Handle indentation and scope changes
      this.updateScope(line, lineNum, indent);

      // Check variable declarations
      this.checkVariableDeclarations(line, lineNum, strippedNoStrings);
      
      // Check reassignments
      this.checkReassignments(line, lineNum, strippedNoStrings);
    }

    while (this.switchStack.length) {
      const popped = this.switchStack.pop();
      if (popped?.currentKey) {
        this.releaseCaseVariables(popped.currentKey);
      }
    }
    this.currentCaseKey = null;
  }

  private validateVariableAccess(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;
      const strippedNoStrings = this.stripStringsAndLineComment(line);

      // Check variable usage
      this.checkVariableUsage(line, lineNum, strippedNoStrings);
    }
  }

  private validateScopeConsistency(): void {
    // Check for unused variables
    this.checkUnusedVariables();
    
    // Check for shadowed variables
    this.checkShadowedVariables();
    
    // Check for variables used before declaration
    this.checkVariablesUsedBeforeDeclaration();
  }

  private validateParameterUsage(): void {
    // Check for unused function parameters
    this.checkUnusedParameters();
    
    // Check for parameter shadowing
    this.checkParameterShadowing();
  }

  private updateScope(line: string, lineNum: number, indent: number): void {
    const topIndent = this.indentStack[this.indentStack.length - 1];
    const prevLine = this.findPrevNonEmpty(lineNum - 1);

    if (indent > topIndent) {
      this.indentStack.push(indent);
      
      const endsWithArrow = !!prevLine && /\)\s*=>\s*$/.test(prevLine.trim());
      
      if (prevLine && (QUALIFIED_FN_RE.test(prevLine) || METHOD_DECL_RE.test(prevLine))) {
        const m = prevLine.match(QUALIFIED_FN_RE) || prevLine.match(METHOD_DECL_RE)!;
        const name = m[1];
        const rawParams = (this.functionParams.get(name) || []);
        const params = rawParams.map(p => {
          const cleaned = p.trim().replace(/<[^>]*>/g, '');
          return cleaned.split(/\s+/).pop()!;
        }).filter(Boolean);
        
        this.scopeStack.push({ indent, params: new Set(params), fnName: name, variables: new Set() });
        if (!this.paramUsage.has(name)) this.paramUsage.set(name, new Set());
      } else if (endsWithArrow) {
        const MAX_HDR_LOOKBACK = 8;
        let fnName: string | null = null;
        for (let k = 1; k <= MAX_HDR_LOOKBACK && (lineNum - 1 - k) >= 0; k++) {
          const lno = lineNum - 1 - k;
          const L = (this.context.cleanLines[lno] || '').trim();
          if (/^(if|for|while|switch)\b/.test(L)) break;
          const mStart = L.match(new RegExp(`^\\s*(?:export\\s+)?(${IDENT.source}(?:\\.${IDENT.source})*)\\s*\\(`)) || L.match(new RegExp(`^\\s*method\\s+(${IDENT.source})\\s*\\(`)) || L.match(new RegExp(`^\\s*(?:export\\s+)?func\\s+(${IDENT.source})\\s*\\(`));
          if (mStart) {
            fnName = mStart[1] === 'func' ? (L.match(new RegExp(`^\\s*(?:export\\s+)?func\\s+(${IDENT.source})`))?.[1] ?? 'func') : mStart[1];
            break;
          }
          if (/\)\s*=>\s*$/.test(L)) break;
        }
        if (fnName && this.functionParams.has(fnName)) {
          const rawParams = (this.functionParams.get(fnName) || []);
          const params = rawParams.map(p => {
            const cleaned = p.trim().replace(/<[^>]*>/g, '');
            return cleaned.split(/\s+/).pop()!;
          }).filter(Boolean);
          this.scopeStack.push({ indent, params: new Set(params), fnName, variables: new Set() });
          if (!this.paramUsage.has(fnName)) this.paramUsage.set(fnName, new Set());
        }
      } else {
        // Regular block scope
        this.scopeStack.push({ indent, params: new Set(), fnName: null, variables: new Set() });
      }
    } else if (indent < topIndent) {
      while (this.indentStack.length > 1 && indent < this.indentStack[this.indentStack.length - 1]) {
        this.indentStack.pop();
      }
      while (this.scopeStack.length > 1 && indent < this.scopeStack[this.scopeStack.length - 1].indent) {
        const poppedScope = this.scopeStack.pop();
        if (poppedScope) {
          this.releaseScopeVariables(poppedScope);
        }
      }
      if (indent !== this.indentStack[this.indentStack.length - 1]) {
        this.addWarning(lineNum, 1, 'Indentation does not match previous block level.', 'PS018');
      }
    }
  }

  private checkVariableDeclarations(line: string, lineNum: number, strippedNoStrings: string): void {
    const trimmed = line.trim();
    if (/^(?:default|[A-Za-z_][A-Za-z0-9_]*)\s*=>/.test(trimmed)) {
      // Switch case labels are not variable declarations
      return;
    }
    // Check for variable declarations
    const decl = line.match(VAR_DECL_RE);
    if (decl) {
      const name = decl[1];
      this.handleNewVariable(name, lineNum, line.indexOf(name) + 1);
    } else {
      // Detect for-loop iterator declarations: for i = ...
      const forMatch = line.match(new RegExp(`^\\s*for\\s+(${IDENT.source})\\s*=\\s*`));
      if (forMatch) {
        const iterator = forMatch[1];
        this.handleNewVariable(iterator, lineNum, line.indexOf(iterator) + 1);
      }

      // Detect for-in loop (for i in ...)
      const forInMatch = line.match(new RegExp(`^\\s*for\\s+(${IDENT.source})\\s+in\b`));
      if (forInMatch) {
        const iterator = forInMatch[1];
        this.handleNewVariable(iterator, lineNum, line.indexOf(iterator) + 1);
      }

      // Detect destructured for loops: for [a, b] in ...
      const destructForMatch = line.match(/^\s*for\s*\[([^\]]+)\]\s+in\b/);
      if (destructForMatch) {
        const content = destructForMatch[1];
        const baseIndex = line.indexOf('[') + 1;
        content.split(',').forEach(fragment => {
          const name = fragment.trim();
          if (!name || name === '_' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
            return;
          }
          const col = baseIndex + content.indexOf(name) + 1;
          this.handleNewVariable(name, lineNum, col);
        });
      }

      // Check for simple assignments that might be new variables
      if (SIMPLE_ASSIGN_RE.test(strippedNoStrings)
          && !/^\s*(if|for|while)\b/.test(strippedNoStrings)
          && this.findNamedArgsCached(line).size === 0) {
        const m = strippedNoStrings.match(SIMPLE_ASSIGN_RE)!;
        const varName = m[1];
        const col = line.indexOf(varName) + 1;

        if (!KEYWORDS.has(varName)) {
          this.handleNewVariable(varName, lineNum, col);
        }
      }
    }
  }

  private checkReassignments(line: string, lineNum: number, strippedNoStrings: string): void {
    // Check for reassignments with :=
    const reassignMatch = strippedNoStrings.match(new RegExp(`\\b(${IDENT.source})\\s*:=`));
    if (reassignMatch) {
      const varName = reassignMatch[1];
      const col = line.indexOf(varName) + 1;
      
      // Check if this is a UDT field assignment (this.field := value)
      const udtFieldMatch = strippedNoStrings.match(/^\s*this\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*/);
      if (udtFieldMatch) {
        // This is a UDT field assignment - it's valid if we're inside a method
        // The UDTValidator will handle field validation separately
        return;
      }
      
      // Check if this is a method parameter
      if (this.isMethodParameter(varName, lineNum)) {
        // This is a method parameter - it's valid
        return;
      }
      
      // Check if variable is declared in context or is a function parameter
      const isDeclared = this.context.declaredVars.has(varName) || this.currentScope().params.has(varName);
      if (!isDeclared) {
        const duplicatePS016 = this.errors.some(e => e.code === 'PS016' && e.line === lineNum && e.column === col);
        if (!duplicatePS016) {
          this.addError(lineNum, col, `Variable '${varName}' not declared before ':='. Use '=' on first assignment.`, 'PS016');
        }
      }
      this.used.add(varName);
    }

    // Check for compound assignments
    const compoundMatch = strippedNoStrings.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*([+\-*/%])=\s*(?![=])/);
    if (compoundMatch) {
      const [, name, op] = compoundMatch;
      const col = line.indexOf(name) + 1;
      
      if (!this.declared.has(name) && !this.currentScope().params.has(name)) {
        this.addError(lineNum, col, `Variable '${name}' not declared before '${op}='. Use '=' for first assignment or declare it.`, 'PS017');
      }
      this.used.add(name);
    }
  }

  private checkVariableUsage(line: string, lineNum: number, strippedNoStrings: string): void {
    // Find all variable references
    const re = new RegExp(IDENT.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(strippedNoStrings))) {
      const tok = m[0];
      const col = (m.index ?? 0) + 1;
      const startIndex = m.index ?? 0;
      const prevChar = startIndex > 0 ? strippedNoStrings[startIndex - 1] : '';
      if (prevChar === '#') {
        continue;
      }
      
      if (WILDCARD_IDENT.has(tok)) { this.used.add(tok); continue; }
      if (KEYWORDS.has(tok) || PSEUDO_VARS.has(tok) || NAMESPACES.has(tok)) { this.used.add(tok); continue; }
      
      // Check if it's a variable reference
      if (this.declared.has(tok) || this.currentScope().params.has(tok) || this.everDeclared.has(tok)) {
        this.used.add(tok);
        
        // Mark parameter usage
        if (this.currentScope().params.has(tok)) {
          const fnName = this.currentScope().fnName;
          if (fnName) {
            this.paramUsage.get(fnName)?.add(tok);
          }
        }
      } else if (!this.isFunctionCall(tok, strippedNoStrings, col - 1)) {
        // Check if it's a function call or a known identifier from other validators
        // Also check if it's a parameter name in the current function call
        const isParameterName = this.isParameterName(tok, strippedNoStrings, col - 1);
        
        // Check if this is a UDT field access (this.field)
        const isUdtFieldAccess = this.isUdtFieldAccess(tok, strippedNoStrings, col - 1);
        
        // Check if this is a method parameter
        const isMethodParam = this.isMethodParameter(tok, lineNum);

        const precedingCharIndex = (m.index ?? 0) - 1;
        const precedingChar = precedingCharIndex >= 0 ? strippedNoStrings[precedingCharIndex] : '';
        let isNamespaceMember = false;
        if (precedingChar === '.') {
          const before = strippedNoStrings.substring(0, precedingCharIndex).trimEnd();
          const matchNamespace = before.match(new RegExp(`${IDENT.source}$`));
          if (matchNamespace) {
            const ns = matchNamespace[0];
            if (NAMESPACES.has(ns)) {
              isNamespaceMember = true;
            }
          }
        }

        if (!this.context.functionNames.has(tok) && !this.context.usedVars.has(tok) && !isParameterName && !isUdtFieldAccess && !isMethodParam && !isNamespaceMember) {
          this.addWarning(lineNum, col, `Potential undefined reference '${tok}'.`, 'PSU02');
        }
      }
    }
  }

  private isParameterName(token: string, line: string, position: number): boolean {
    // Check if the token is a parameter name in a function call
    // Look for patterns like: function(param=value) or function(param=)
    const beforeToken = line.substring(0, position);
    const afterToken = line.substring(position + token.length);
    
    // Check if we're inside a function call (after an opening parenthesis)
    const lastOpenParen = beforeToken.lastIndexOf('(');
    const lastCloseParen = beforeToken.lastIndexOf(')');
    
    if (lastOpenParen > lastCloseParen) {
      // We're inside a function call
      // Check if the token is followed by '=' (parameter assignment)
      if (afterToken.trimStart().startsWith('=')) {
        // This looks like a parameter name
        return true;
      }
    }
    
    return false;
  }

  private checkUnusedVariables(): void {
    const IGNORE_UNUSED = new Set(['_']);
    const functionParamSet = new Set([...this.functionParams.values()].flat().map(p => p.trim().split(/\s+/).pop()!));
    
    for (const [name, line] of this.declared.entries()) {
      if (IGNORE_UNUSED.has(name)) continue;
      if (!this.used.has(name) && !KEYWORDS.has(name) && !this.context.functionNames.has(name) && !functionParamSet.has(name)) {
        this.addWarning(line, 1, `Variable '${name}' is declared but never used.`, 'PSU01');
      }
    }
  }

  private checkShadowedVariables(): void {
    // Check for variable shadowing
    for (const [name, line] of this.declared.entries()) {
      const currentIndent = this.declIndent.get(name);
      if (currentIndent !== undefined) {
        // Check if there's a variable with the same name at a different indent level
        for (const [otherName, otherLine] of this.declared.entries()) {
          if (name === otherName && line !== otherLine) {
            const otherIndent = this.declIndent.get(otherName);
            if (otherIndent !== undefined && otherIndent < currentIndent) {
              this.addWarning(line, 1, `Variable '${name}' shadows an outer declaration.`, 'PSW04');
            }
          }
        }
      }
    }
  }

  private checkVariablesUsedBeforeDeclaration(): void {
    // This is a simplified check - in a full implementation, we'd track declaration order
    // For now, we'll just check that all used variables are declared somewhere
    for (const usedVar of this.used) {
      if (!this.declared.has(usedVar) && 
          !this.currentScope().params.has(usedVar) && 
          !KEYWORDS.has(usedVar) && 
          !PSEUDO_VARS.has(usedVar) &&
          !NAMESPACES.has(usedVar) &&
          !this.context.functionNames.has(usedVar) &&
          !this.everDeclared.has(usedVar)) {
        // This would need more sophisticated tracking to determine the exact line
        this.addWarning(1, 1, `Variable '${usedVar}' may be used before declaration.`, 'PSU03');
      }
    }
  }

  private checkUnusedParameters(): void {
    for (const [fn, params] of this.functionParams.entries()) {
      if (/^(indicator|strategy|library)$/.test(fn)) continue;
      
      const headerLine = 1; // Simplified - would need proper tracking
      const usedInFn = this.paramUsage.get(fn) ?? new Set<string>();
      
      const cleanedParams = params.map(s => {
        const cleaned = s.trim().replace(/<[^>]*>/g, '');
        return cleaned.split(/\s+/).pop()!;
      }).filter(Boolean);
      
      for (const p of cleanedParams) {
        if (p === '_' || (this.context.methodNames.has(fn) && p === 'this')) continue;
        // Skip PSU-PARAM warnings for dotted function names (known limitation)
        if (fn.includes('.')) continue;
        if (!usedInFn.has(p)) {
          this.addWarning(headerLine, 1, `Parameter '${p}' in '${fn}' is never used.`, 'PSU-PARAM');
        }
      }
    }
  }

  private checkParameterShadowing(): void {
    // Check for parameters that shadow outer variables
    for (const scope of this.scopeStack) {
      if (scope.fnName) {
        const params = scope.params;
        for (const param of params) {
          if (this.declared.has(param)) {
            this.addWarning(1, 1, `Parameter '${param}' shadows an outer variable.`, 'PSW05');
          }
        }
      }
    }
  }

  private handleNewVariable(name: string, line: number, col: number): void {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) { 
      this.addError(line, col, `Invalid identifier '${name}'.`, 'PS006'); 
      return; 
    }
    if (KEYWORDS.has(name) || PSEUDO_VARS.has(name)) {
      this.addError(line, col, `Identifier '${name}' conflicts with a Pine keyword/builtin.`, 'PS007');
      return;
    }

    const paramsHere = this.currentScope().params;
    if (paramsHere.has(name) && name !== 'this') {
        this.addWarning(line, col, `Identifier '${name}' shadows a function parameter.`, 'PSW05', 'Rename the local or the parameter to avoid confusion.');
    }

    const siteKey = `${line}:${name}`;
    if (this.declaredSites.has(siteKey)) return;
    this.declaredSites.add(siteKey);
    
    const currentIndent = this.indentStack[this.indentStack.length - 1];
    const currentBlockKey = this.getCurrentBlockKey(currentIndent);
    const prevIndent = this.declIndent.get(name);
    const prevBlockKey = this.declBlockKey.get(name);
    if (prevBlockKey !== undefined) {
      if (prevBlockKey === currentBlockKey) {
        this.addWarning(line, col, `Identifier '${name}' already declared in this block; use ':=' to reassign.`, 'PSW03');
        return;
      }
      if (prevIndent !== undefined && prevIndent < currentIndent) {
        this.addWarning(line, col, `Identifier '${name}' shadows an outer declaration.`, 'PSW04');
      }
    }

    this.declared.set(name, line);
    this.declIndent.set(name, currentIndent);
    this.declBlockKey.set(name, currentBlockKey);
    this.currentScope().variables.add(name);

    if (this.currentCaseKey) {
      if (!this.caseVariables.has(this.currentCaseKey)) {
        this.caseVariables.set(this.currentCaseKey, new Set());
      }
      this.caseVariables.get(this.currentCaseKey)!.add(name);
    }

    this.everDeclared.add(name);
  }

  private isFunctionCall(tok: string, line: string, pos: number): boolean {
    // Check if the token is followed by '(' indicating a function call
    const afterToken = line.slice(pos + tok.length);
    return /^\s*\(/.test(afterToken);
  }

  private findNamedArgsCached(line: string): Set<string> {
    const s = this.stripStringsAndLineComment(line);
    const out = new Set<string>();
    let depth = 0;
    let inFunctionCall = false;
    
    const isScriptDecl = /^\s*(indicator|strategy|library)\s*\(/.test(s);
    
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '(') {
          depth++;
          if (!isScriptDecl) inFunctionCall = true;
        }
        else if (ch === ')') {
          depth = Math.max(0, depth - 1);
          if (depth === 0) inFunctionCall = false;
        }
        else if (ch === '=' && depth > 0 && inFunctionCall) {
            const prev = s[i - 1] || '';
            const next = s[i + 1] || '';
            if (prev === '=' || prev === '!' || prev === '<' || prev === '>' || prev === ':' || next === '=') continue;
            const left = /[A-Za-z_][A-Za-z0-9_]*\s*$/.exec(s.slice(0, i));
            if (!left) continue;
            const name = left[0].trim();
            const before = s.slice(0, i - name.length).trimEnd();
            const sentinel = before.slice(-1);
            if (sentinel === '(' || sentinel === ',') out.add(name);
        }
    }
    return out;
  }

  private findPrevNonEmpty(lineNum: number): string | null {
    for (let i=lineNum-1;i>=0;i--) { 
      const t=this.context.cleanLines[i].trim(); 
      if (t!=='') return this.context.cleanLines[i]; 
    }
    return null;
  }

  private currentScope(): ScopeInfo {
      return this.scopeStack[this.scopeStack.length - 1];
  }

  private getCurrentBlockKey(currentIndent: number): string {
    return `${currentIndent}|${this.currentCaseKey ?? ''}`;
  }

  private releaseScopeVariables(scope: ScopeInfo): void {
    for (const variable of scope.variables) {
      this.declared.delete(variable);
      this.declIndent.delete(variable);
      this.declBlockKey.delete(variable);
    }
  }

  private updateSwitchState(trimmed: string, indent: number): void {
    const isNonEmpty = trimmed !== '';

    // Pop switches that we have exited
    while (this.switchStack.length) {
      const top = this.switchStack[this.switchStack.length - 1];
      if (indent < top.indent && isNonEmpty) {
        const popped = this.switchStack.pop();
        if (popped?.currentKey) {
          this.releaseCaseVariables(popped.currentKey);
        }
        continue;
      }
      break;
    }

    if (/^switch\b/.test(trimmed)) {
      this.switchStack.push({ indent, caseCounter: 0, currentKey: null });
      this.currentCaseKey = null;
      return;
    }

    const top = this.switchStack[this.switchStack.length - 1];
    if (!top) {
      this.currentCaseKey = null;
      return;
    }

    const caseMatch = trimmed.match(/^(default|[A-Za-z_][A-Za-z0-9_]*)\s*=>/);
    if (caseMatch) {
      if (top.currentKey) {
        this.releaseCaseVariables(top.currentKey);
      }
      top.caseCounter += 1;
      top.currentKey = `${top.indent}:${top.caseCounter}`;
      this.currentCaseKey = top.currentKey;
      return;
    }

    if (indent <= top.indent && isNonEmpty) {
      if (top.currentKey) {
        this.releaseCaseVariables(top.currentKey);
      }
      top.currentKey = null;
      if (indent < top.indent) {
        const popped = this.switchStack.pop();
        if (popped?.currentKey) {
          this.releaseCaseVariables(popped.currentKey);
        }
        const newTop = this.switchStack[this.switchStack.length - 1];
        this.currentCaseKey = newTop?.currentKey ?? null;
        return;
      }
    }

    this.currentCaseKey = top.currentKey;
  }

  private releaseCaseVariables(caseKey: string): void {
    const vars = this.caseVariables.get(caseKey);
    if (!vars) return;
    for (const name of vars) {
      this.declared.delete(name);
      this.declIndent.delete(name);
      this.declBlockKey.delete(name);
    }
    this.caseVariables.delete(caseKey);
  }

  // Utility methods
  private stripStringsAndLineComment(line: string): string {
    return this.stripStrings(line).replace(/\/\/.*$/, '');
  }

  private stripStrings(line: string): string {
    return line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => ' '.repeat(m.length));
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

  private isMethodParameter(varName: string, lineNum: number): boolean {
    // Check if we're inside a method definition by looking backwards for method declarations
    for (let i = lineNum - 1; i >= 0; i--) {
      const line = this.context.cleanLines[i];
      
      // Look for method declaration: method methodName(...) =>
      // Support both: method move(this<Rectangle>, float deltaX, float deltaY) =>
      // and: method move(this<Rectangle>, deltaX, deltaY) =>
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
        
        // If we found a method declaration, check if we're still within its scope
        // by looking at the indentation of subsequent lines
        const methodIndent = this.getLineIndentation(line);
        const currentLineIndent = this.getLineIndentation(this.context.cleanLines[lineNum - 1]);
        
        // If current line is indented more than the method declaration, we're inside the method
        if (currentLineIndent > methodIndent) {
          // We're inside this method - check if the variable is a parameter
          return paramList.some(param => this.extractParameterName(param) === varName);
        }
      }
      
      // Stop if we hit a non-indented line (we've left the method scope)
      const currentIndent = this.getLineIndentation(line);
      const nextLineIndent = i < this.context.cleanLines.length - 1 ? 
        this.getLineIndentation(this.context.cleanLines[i + 1]) : 0;
      
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
    // Extract parameter name from typed parameter (e.g., "float deltaX" -> "deltaX")
    // Handle both: "float deltaX" and "deltaX"
    const trimmed = param.trim();
    
    // If it contains a space, take the last word (parameter name)
    if (trimmed.includes(' ')) {
      const parts = trimmed.split(/\s+/);
      return parts[parts.length - 1];
    }
    
    // If it's a simple parameter name, return as-is
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    return match ? match[1] : trimmed;
  }

  private getLineIndentation(line: string): number {
    return line.length - line.trimStart().length;
  }

  private isUdtFieldAccess(token: string, line: string, position: number): boolean {
    // Check if this token is part of a UDT field access pattern like "this.field"
    // Look backwards from the position to see if there's a "this." before the token
    const beforeToken = line.substring(0, position);
    const afterToken = line.substring(position + token.length);
    
    // Check for pattern: this.token
    const udtFieldPattern = new RegExp(`this\\.${token}\\b`);
    if (udtFieldPattern.test(line)) {
      return true;
    }
    
    // Also check if this is a UDT field name that's being accessed
    // Look for UDT field declarations in the code
    for (const cleanLine of this.context.cleanLines) {
      // Look for UDT field declarations: type fieldName (support generics and dotted namespaces)
      const fieldMatch = cleanLine.match(new RegExp(`^\\s*(?:${IDENT.source}(?:\\.${IDENT.source})*(?:<[^>]+>)?)\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*$`));
      if (fieldMatch && fieldMatch[1] === token) {
        // This token is a UDT field name
        return true;
      }
    }
    
    return false;
  }
}
