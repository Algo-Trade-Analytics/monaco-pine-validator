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
import { isValidNamespaceMember, getSimilarMembers, NAMESPACE_MEMBERS } from '../core/namespace-members';

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

    // Pattern: namespace.member (e.g., color.red, ta.sma, math.abs)
    // Match word.word patterns, but exclude method calls and quoted strings
    const namespacePattern = /\b(color|ta|math|str|array|request|input|plot|line|label|box|table|strategy|syminfo|timeframe|barstate|matrix|ticker|text|polyline|linefill|size|display|chart|map|font|format|barmerge|currency|dividends|extend|yloc|location|shape|position)\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
    
    let match;
    while ((match = namespacePattern.exec(line)) !== null) {
      const namespace = match[1];
      const member = match[2];
      const column = match.index + 1;
      
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
   * Find which namespace contains the given member
   */
  private findCorrectNamespace(member: string): string | null {
    // Check if the member exists in multiple namespaces
    const namespacesWithMember: string[] = [];
    for (const [namespace, members] of Object.entries(NAMESPACE_MEMBERS)) {
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

