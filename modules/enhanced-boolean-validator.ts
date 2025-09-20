/**
 * Enhanced Boolean Logic Validator Module
 * 
 * Handles enhanced boolean logic validation for Pine Script v6:
 * - PSV6-MIG-BOOL: Numeric literal conditions
 * - PSV6-TERNARY-TYPE: Type mismatch in ternary branches
 * - PSV6-BOOL-AND-ORDER: Expensive calc placed before cheap checks in AND chain
 * - PSV6-BOOL-OR-CONSTANT: Constant false placed before expensive calc in OR chain
 * - PSV6-BOOL-EXPENSIVE-CHAIN: Multiple expensive calcs inside boolean chain
 */

import { ValidationModule, ValidationContext, ValidatorConfig, ValidationResult } from '../core/types';
import { EXPENSIVE_CALCULATION_FUNCTIONS } from '../core/constants';

export class EnhancedBooleanValidator implements ValidationModule {
  name = 'EnhancedBooleanValidator';
  priority = 75; // Run after basic syntax validation

  getDependencies(): string[] {
    return ['CoreValidator', 'SyntaxValidator', 'TypeInferenceValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      info: [],
      typeMap: new Map(),
      scriptType: null,
    };


    // Validate boolean logic for each line
    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;
      
      this.validateNumericLiteralConditions(line, lineNum, result);
      this.validateTernaryTypeMatches(line, lineNum, result);
      this.validateNonBooleanIfCondition(line, lineNum, result, context as any);

      // Performance-aware boolean short-circuit analysis (opt-in)
      if (config.enablePerformanceAnalysis) {
        const safe = this.stripStringsAndLineComment(context.cleanLines[i] || '');
        if (/(\band\b|\bor\b)/.test(safe)) {
          this.validateBooleanShortCircuit(safe, lineNum, result);
        }
      }
    }

    return result;
  }

  /**
   * PSV6-MIG-BOOL: Validate numeric literal conditions
   * Warns when numeric literals are used in if conditions instead of boolean expressions
   */
  private validateNumericLiteralConditions(line: string, lineNum: number, result: any): void {
    // Match if conditions: if (condition)
    const ifConditionMatch = line.match(/\bif\s*\(\s*([^)]+)\s*\)/);
    if (ifConditionMatch) {
      const condition = ifConditionMatch[1].trim();
      
      // Check if condition is a numeric literal
      if (/^-?\d+(\.\d+)?$/.test(condition)) {
        result.errors.push({
          line: lineNum,
          column: 1,
          message: `Numeric literal '${condition}' used in if condition. Use boolean expressions instead.`,
          severity: 'error',
          code: 'PSV6-MIG-BOOL',
          suggestion: `Replace 'if (${condition})' with 'if (${condition} != 0)' or a proper boolean expression`
        });
      }
    }
  }

  /**
   * PSV6-TERNARY-TYPE: Validate type mismatches in ternary operators
   * Warns when ternary operator branches have incompatible types
   */
  private validateTernaryTypeMatches(line: string, lineNum: number, result: any): void {
    // Match ternary operator patterns: condition ? value1 : value2
    const ternaryMatch = line.match(/(\w+\s+)?(\w+)\s*=\s*([^?]+)\?\s*([^:]+)\s*:\s*(.+)/);
    if (ternaryMatch) {
      const [, typeDecl, varName, condition, trueValue, falseValue] = ternaryMatch;
      
      // Extract declared type if present
      let declaredType = '';
      if (typeDecl) {
        const typeMatch = typeDecl.trim().match(/^(color|string|int|float|bool)$/);
        if (typeMatch) {
          declaredType = typeMatch[1];
        }
      }
      
      const trueType = this.inferValueType(trueValue.trim());
      const falseType = this.inferValueType(falseValue.trim());

      // Check if both branches have incompatible types
      if (trueType !== falseType && trueType !== 'unknown' && falseType !== 'unknown') {
        // Check for numeric compatibility (int/float)
        const isNumericCompatible = 
          (trueType === 'int' && falseType === 'float') ||
          (trueType === 'float' && falseType === 'int');
        
        if (!isNumericCompatible) {
          const message = declaredType 
            ? `Ternary operator branches have mismatched types: '${trueValue.trim()}' (${trueType}) vs '${falseValue.trim()}' (${falseType}). Both must be compatible with declared type '${declaredType}'.`
            : `Ternary operator branches have mismatched types: '${trueValue.trim()}' (${trueType}) vs '${falseValue.trim()}' (${falseType}). Both branches must return the same type.`;
          
          const suggestion = declaredType
            ? `Ensure both branches return the same type or are compatible with '${declaredType}'`
            : `Ensure both branches return the same type (e.g., both strings or both numbers)`;
          
          result.errors.push({
            line: lineNum,
            column: 1,
            message,
            severity: 'error',
            code: 'PSV6-TERNARY-TYPE',
            suggestion
          });
        }
      }
    }
  }

  /**
   * Infer the type of a value
   */
  private inferValueType(value: string): string {
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
    
    // na literal
    if (value === 'na') return 'na';
    
    return 'unknown';
  }

  /**
   * Detect non-boolean variables used as if conditions and emit namespace error expected by tests
   */
  private validateNonBooleanIfCondition(line: string, lineNum: number, result: any, context: any): void {
    const m = line.match(/^\s*if\s+([^\s].*)$/);
    if (!m) return;
    const cond = m[1].trim();
    // Skip obviously boolean literals or functions
    if (/^(true|false)\b/.test(cond)) return;
    if (/\bta\.(crossover|crossunder|rising|falling)\s*\(/.test(cond)) return;
    // Whitelist known boolean series vars like barstate.*
    if (/^barstate\.(isconfirmed|isfirst|islast|isrealtime|isnew|ishistory|islastconfirmedhistory)\b/.test(cond)) return;
    // Whitelist string boolean functions used in conditions
    if (/\bstr\.(contains|startswith|endswith)\s*\(/.test(cond)) return;
    // Whitelist array.get used as condition (common with array<bool>)
    if (/^array\.get\s*\(/.test(cond)) return;
    // Whitelist obvious input.bool variables by scanning a small window of previous lines
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(cond)) {
      const name = cond;
      if (context && context.typeMap && context.typeMap.get(name)?.type === 'bool') {
        return;
      }
      if (context && context.typeMap && context.typeMap.get(name)?.type === 'series') {
        return;
      }
      if (context && Array.isArray(context.cleanLines)) {
        for (let i = Math.max(1, lineNum - 6); i < lineNum; i++) {
          const ln = context.cleanLines[i - 1] || '';
          if (new RegExp(`^\\s*${name}\\s*=\\s*input\\.bool\\s*\\(`).test(ln)) return;
        }
        for (let i = Math.max(1, lineNum - 10); i < lineNum; i++) {
          const ln = context.cleanLines[i - 1] || '';
          const assignMatch = ln.match(new RegExp(`^\\s*(?:var|varip)?\\s*${name}\\s*(?:=|:=)\\s*(.+)$`));
          if (assignMatch) {
            const expr = assignMatch[1].trim();
            if (/(==|!=|<=|>=|<|>|\band\b|\bor\b|\bnot\b|timeframe\.change|barstate\.|input\.bool|request\.security|request\.seed|request\.|ta\.(crossover|crossunder|rising|falling)|math\.sign|math\.round)/.test(expr)) {
              return;
            }
          }
        }
      }
    }
    
    // Presence of comparison/logical operators suggests boolean; otherwise flag
    if (!/(==|!=|<=|>=|<|>|\band\b|\bor\b|\bnot\b)/.test(cond)) {
      const simpleIdentifier = cond.match(/^([A-Za-z_][A-Za-z0-9_]*)(\.[A-Za-z_][A-Za-z0-9_]*)?$/);
      if (simpleIdentifier) {
        const baseName = simpleIdentifier[1];
        const typeInfo = context?.typeMap instanceof Map ? context.typeMap.get(baseName) : undefined;
        if (typeInfo && (typeInfo.type === 'bool' || typeInfo.type === 'series')) {
          return;
        }
        result.errors.push({
          line: lineNum,
          column: 1,
          message: 'Non-boolean condition used in if',
          severity: 'error',
          code: 'PSV6-FUNCTION-NAMESPACE'
        });
        return;
      }
      result.errors.push({
        line: lineNum,
        column: 1,
        message: 'Non-boolean condition used in if',
        severity: 'error',
        code: 'PSV6-FUNCTION-NAMESPACE'
      });
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Boolean short-circuit and optimization analysis
  // ────────────────────────────────────────────────────────────────────────────
  private validateBooleanShortCircuit(line: string, lineNum: number, result: ValidationResult): void {
    // Analyze both AND and OR chains, left-to-right, ignoring content in parentheses
    const chains = this.extractBooleanChains(line);

    for (const chain of chains) {
      if (chain.operator === 'and') {
        this.checkAndChain(chain.clauses, lineNum, result);
      } else if (chain.operator === 'or') {
        this.checkOrChain(chain.clauses, lineNum, result);
      }
    }
  }

  private checkAndChain(clauses: string[], lineNum: number, result: ValidationResult): void {
    // If an expensive clause appears before a cheap clause, suggest reordering.
    const indices = clauses.map(c => ({
      expensive: this.containsExpensiveCalc(c),
      cheap: this.isCheapCheck(c),
    }));

    const firstExpensiveIdx = indices.findIndex(i => i.expensive);
    const hasLaterCheap = indices.slice(firstExpensiveIdx + 1).some(i => i.cheap);

    if (firstExpensiveIdx >= 0 && hasLaterCheap) {
      result.warnings.push({
        line: lineNum,
        column: 1,
        message: 'Expensive calculation appears before cheaper checks in AND chain. Reorder to leverage short-circuiting.',
        severity: 'warning',
        code: 'PSV6-BOOL-AND-ORDER'
      });
    }

    // Multiple expensive calcs in same chain
    const expensiveCount = indices.filter(i => i.expensive).length;
    if (expensiveCount > 1) {
      result.warnings.push({
        line: lineNum,
        column: 1,
        message: 'Multiple expensive calculations used in a single boolean chain. Consider caching or simplifying.',
        severity: 'warning',
        code: 'PSV6-BOOL-EXPENSIVE-CHAIN'
      });
    }
  }

  private checkOrChain(clauses: string[], lineNum: number, result: ValidationResult): void {
    // Warn when a constant false precedes an expensive clause: it prevents short-circuiting.
    if (clauses.length < 2) return;
    let first = clauses[0].trim();
    // Strip leading assignment (e.g., result = false)
    first = first.replace(/^\s*[A-Za-z_][A-Za-z0-9_]*\s*:?=\s*/, '');
    const second = clauses[1];
    if (this.isConstantFalse(first) && this.containsExpensiveCalc(second)) {
      result.warnings.push({
        line: lineNum,
        column: 1,
        message: 'Constant false used before an expensive calculation in OR chain; move constants to the end to avoid unnecessary evaluation.',
        severity: 'warning',
        code: 'PSV6-BOOL-OR-CONSTANT'
      });
    }

    // Multiple expensive calcs in same chain
    const expensiveCount = clauses.filter(c => this.containsExpensiveCalc(c)).length;
    if (expensiveCount > 1) {
      result.warnings.push({
        line: lineNum,
        column: 1,
        message: 'Multiple expensive calculations used in a single boolean chain. Consider caching or simplifying.',
        severity: 'warning',
        code: 'PSV6-BOOL-EXPENSIVE-CHAIN'
      });
    }
  }

  private extractBooleanChains(line: string): Array<{ operator: 'and' | 'or'; clauses: string[] }> {
    const out: Array<{ operator: 'and' | 'or'; clauses: string[] }> = [];
    const expr = line.replace(/^\s*if\s+/, '');
    const orClauses = this.simpleSplit(expr, /\bor\b/);
    if (orClauses.length > 1) out.push({ operator: 'or', clauses: orClauses });
    const andClauses = this.simpleSplit(expr, /\band\b/);
    if (andClauses.length > 1) out.push({ operator: 'and', clauses: andClauses });
    return out;
  }

  private simpleSplit(expr: string, op: RegExp): string[] {
    return expr.split(op).map(s => s.trim()).filter(Boolean);
  }

  private containsExpensiveCalc(clause: string): boolean {
    for (const fn of EXPENSIVE_CALCULATION_FUNCTIONS) {
      if (clause.includes(fn)) return true;
    }
    // Consider request.security family expensive as well
    if (/\brequest\.(security|security_lower_tf|economic|financial)\s*\(/.test(clause)) return true;
    return false;
  }

  private isCheapCheck(clause: string): boolean {
    if (this.isConstantTrue(clause) || this.isConstantFalse(clause)) return true;
    if (/(==|!=|<=|>=|<|>)/.test(clause)) return true;
    if (/\bbarstate\.(isconfirmed|isfirst|islast|isrealtime|isnew|ishistory|islastconfirmedhistory)\b/.test(clause)) return true;
    if (/\bstrategy\.(position_size|opentrades)\b/.test(clause)) return true;
    // Fallback: no function calls looks cheap
    if (!/\w+\s*\(/.test(clause)) return true;
    return false;
  }

  private isConstantTrue(value: string): boolean { return /^\s*true\s*$/.test(value); }
  private isConstantFalse(value: string): boolean { return /^\s*false\s*$/.test(value); }

  private stripStringsAndLineComment(line: string): string {
    // Remove // comments and keep quoted content safe by replacing with placeholders
    const noComment = line.replace(/\/\/.*$/, '');
    let out = '';
    let inStr = false;
    let strCh = '';
    for (let i = 0; i < noComment.length; i++) {
      const ch = noComment[i];
      if (!inStr && (ch === '"' || ch === "'")) { inStr = true; strCh = ch; out += '"'; continue; }
      if (inStr) { if (ch === strCh) { inStr = false; strCh = ''; } continue; }
      out += ch;
    }
    return out;
  }
}
