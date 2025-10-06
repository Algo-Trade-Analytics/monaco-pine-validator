/**
 * Namespace Validator Module
 * 
 * Validates namespace property access (color.*, ta.*, math.*, etc.)
 * Catches undefined properties BEFORE they cause cascading type errors
 */

import type {
  ValidationModule,
  ValidationContext,
  ValidatorConfig,
  ValidationError,
  ValidationResult,
} from '../core/types';
import { isValidNamespaceMember, getSimilarMembers } from '../core/namespace-members';
import { NS_MEMBERS, getNamespacePattern } from '../core/constants';

export class NamespaceValidator implements ValidationModule {
  name = 'NamespaceValidator';
  priority = 950; // High priority - run early to prevent cascades

  private errors: ValidationError[] = [];

  getDependencies(): string[] {
    return [];
  }

  validate(context: ValidationContext, _config: ValidatorConfig): ValidationResult {
    this.errors = [];
    
    // Check each line for namespace property access
    const lines = context.rawLines || context.lines || [];
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      this.checkNamespaceAccess(line, lineNum);
    });

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: [],
      info: [],
      typeMap: new Map(),
      scriptType: null,
    };
  }

  private checkNamespaceAccess(line: string, lineNum: number): void {
    // Skip comments
    if (line.trim().startsWith('//')) {
      return;
    }

    // Pattern: namespace.member or namespace.namespace.member (e.g., color.red, chart.point.from_index)
    // Match word.word or word.word.word patterns, but exclude method calls, quoted strings, and type annotations
    const namespacePattern = getNamespacePattern();
    namespacePattern.lastIndex = 0;
    
    let match;
    while ((match = namespacePattern.exec(line)) !== null) {
      const baseNamespace = match[1];
      const firstMember = match[2];
      const secondMember = match[3];
      const column = match.index + 1;
      
      // Check if this is a type annotation context
      if (this.isTypeAnnotationContext(line, match.index, match[0])) {
        continue;
      }
      
      let namespace = baseNamespace;
      let member = firstMember;
      
      // Handle nested namespaces like chart.point.from_index
      if (secondMember) {
        // This is a nested namespace call like chart.point.from_index
        const nestedNamespace = `${baseNamespace}.${firstMember}`;
        const nestedMembers = NS_MEMBERS[nestedNamespace as keyof typeof NS_MEMBERS];
        if (isValidNamespaceMember(baseNamespace, firstMember) || nestedMembers) {
          namespace = nestedNamespace;
          member = secondMember;
        }
      }
      
      if (!member) continue; // Skip if no member found
      
      // Check if this member exists in the namespace
      if (!isValidNamespaceMember(namespace, member)) {
        // Check if the member exists in ANY namespace (wrong namespace error)
        const correctNamespace = this.findCorrectNamespace(member);
        
        if (correctNamespace) {
          // Function exists but in wrong namespace
          this.errors.push({
            line: lineNum,
            column,
            message: `Function '${member}' should be in '${correctNamespace}' namespace, not '${namespace}'`,
            severity: 'error',
            code: 'PSV6-FUNCTION-NAMESPACE',
            suggestion: `Use ${correctNamespace}.${member} instead of ${namespace}.${member}`
          });
        } else {
          // Function doesn't exist at all
          const suggestions = getSimilarMembers(namespace, member);
          const suggestionText = suggestions.length > 0
            ? `Did you mean: ${suggestions.join(', ')}?`
            : `Check Pine Script documentation for valid ${namespace}.* members.`;
          
          this.errors.push({
            line: lineNum,
            column,
            message: `Undefined property '${member}' on '${namespace}' namespace`,
            severity: 'error',
            code: 'PSV6-UNDEFINED-NAMESPACE-MEMBER',
            suggestion: suggestionText
          });
        }
      }
    }
  }

  /**
   * Check if a namespace pattern appears in a type annotation context
   * This covers all cases where namespaces are used as types, not function calls
   */
  private isTypeAnnotationContext(line: string, matchIndex: number, matchText: string): boolean {
    const before = line.slice(0, matchIndex);
    const after = line.slice(matchIndex + matchText.length);
    
    // 1. Function parameter type: "function(chart.point cp, ...)"
    // Check if followed by space + identifier + comma/closing paren
    if (/^\s+[a-zA-Z_][a-zA-Z0-9_]*\s*[,\)]/.test(after)) {
      return true;
    }
    
    // 2. Variable declaration type: "chart.point myVar = ..."
    // Check if followed by space + identifier + equals/colon
    if (/^\s+[a-zA-Z_][a-zA-Z0-9_]*\s*[=:]/.test(after)) {
      return true;
    }
    
    // 3. Inside generic type: "array<chart.point>" or "matrix<chart.point>"
    // Already handled by negative lookbehind (?<!<) in the pattern, but double-check
    if (/<[^>]*$/.test(before) && /^[^<]*>/.test(after)) {
      return true;
    }
    
    // 4. Type field in UDT/type declaration: "type MyType\n    chart.point field"
    // Check if preceded by indentation at start of line
    if (/^\s+$/.test(before) || /^\s+[a-zA-Z_][a-zA-Z0-9_]*\s+$/.test(before)) {
      // And followed by identifier
      if (/^\s+[a-zA-Z_][a-zA-Z0-9_]*\s*$/.test(after)) {
        return true;
      }
    }
    
    // 5. Method parameter with "this" type: "method myMethod(chart.point this, ...)"
    if (/^\s+this\s*[,\)]/.test(after)) {
      return true;
    }
    
    // 6. Return type annotation (if Pine Script supports it): "function() -> chart.point"
    if (/->?\s*$/.test(before)) {
      return true;
    }
    
    // 7. Colon-based type annotation: "identifier : chart.point"
    if (/:\s*$/.test(before)) {
      return true;
    }
    
    // 8. After type keywords: "var chart.point myVar" or "const chart.point myVar"
    if (/\b(var|const|varip|int|float|bool|string|color)\s+$/.test(before)) {
      return true;
    }
    
    return false;
  }

  /**
   * Find which namespace contains the given member
   */
  private findCorrectNamespace(member: string): string | null {
    // Check if the member exists in multiple namespaces
    const namespacesWithMember: string[] = [];
    for (const [namespace, members] of Object.entries(NS_MEMBERS)) {
      if (members.has(member)) {
        namespacesWithMember.push(namespace);
      }
    }
    
    // If member exists in multiple namespaces, don't suggest a "wrong namespace" error
    // This allows functions like 'median' to exist in both 'math' and 'ta' namespaces
    if (namespacesWithMember.length > 1) {
      return null;
    }
    
    // If member exists in only one namespace, return it
    return namespacesWithMember.length === 1 ? namespacesWithMember[0] : null;
  }
}

