/**
 * Error Message Enhancement System
 * 
 * Provides rich context, code snippets, and actionable suggestions for validation errors.
 * Transforms basic error messages into developer-friendly, informative guidance.
 */

import type { ValidationError, Code } from './types';

/**
 * Enhanced validation error with rich context and formatting
 */
export interface EnhancedValidationError extends ValidationError {
  // Code context
  codeSnippet?: CodeSnippet;
  context?: ErrorContext;
  
  // Quick fixes
  quickFixes?: QuickFix[];
  
  // Relationships
  category?: ErrorCategory;
  isPrimary?: boolean;
  relatedErrors?: string[]; // Error IDs
  causedBy?: string; // Parent error ID
  
  // Documentation
  documentation?: DocumentationLink;
  explanation?: string;
  
  // Formatting
  formattedMessage?: string;
}

/**
 * Code snippet showing error context
 */
export interface CodeSnippet {
  beforeLines: string[];
  errorLine: string;
  afterLines: string[];
  highlightStart: number;
  highlightEnd: number;
  lineNumbers: number[];
  fullContext: string; // Pre-formatted snippet with line numbers
}

/**
 * Context information about where the error occurred
 */
export interface ErrorContext {
  functionName?: string;
  blockType?: 'global' | 'function' | 'if' | 'for' | 'while' | 'switch';
  scopeLevel: number;
  nearbyDeclarations?: string[];
  parentStructure?: string;
}

/**
 * Quick fix suggestion for automatic error correction
 */
export interface QuickFix {
  title: string;
  description: string;
  edits: CodeEdit[];
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Code edit operation for quick fixes
 */
export interface CodeEdit {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  newText: string;
}

/**
 * Documentation link for learning resources
 */
export interface DocumentationLink {
  title: string;
  url: string;
  section?: string;
}

/**
 * Error category for grouping and prioritization
 */
export enum ErrorCategory {
  SYNTAX = 'Syntax Error',
  TYPE = 'Type Error',
  SCOPE = 'Scope Error',
  PERFORMANCE = 'Performance Warning',
  STYLE = 'Style Suggestion',
  MIGRATION = 'Migration Guidance',
  SEMANTIC = 'Semantic Error',
  INDENTATION = 'Indentation Error'
}

/**
 * Extracts code snippets with context around errors
 */
export class CodeSnippetExtractor {
  /**
   * Extract a code snippet showing the error location with surrounding context
   */
  static extract(
    source: string,
    line: number,
    column: number,
    contextLines: number = 2
  ): CodeSnippet {
    const lines = source.split('\n');
    const errorLineIndex = line - 1;
    
    // Calculate snippet bounds
    const startLine = Math.max(0, errorLineIndex - contextLines);
    const endLine = Math.min(lines.length - 1, errorLineIndex + contextLines);
    
    // Extract lines
    const beforeLines = lines.slice(startLine, errorLineIndex);
    const errorLine = lines[errorLineIndex] || '';
    const afterLines = lines.slice(errorLineIndex + 1, endLine + 1);
    
    // Generate line numbers
    const lineNumbers: number[] = [];
    for (let i = startLine; i <= endLine; i++) {
      lineNumbers.push(i + 1);
    }
    
    // Create formatted snippet
    const fullContext = this.formatSnippet(
      beforeLines,
      errorLine,
      afterLines,
      lineNumbers,
      column
    );
    
    return {
      beforeLines,
      errorLine,
      afterLines,
      highlightStart: column,
      highlightEnd: column + 1,
      lineNumbers,
      fullContext
    };
  }
  
  /**
   * Format a code snippet with line numbers and error indicator
   */
  private static formatSnippet(
    beforeLines: string[],
    errorLine: string,
    afterLines: string[],
    lineNumbers: number[],
    column: number
  ): string {
    const maxLineNumWidth = String(Math.max(...lineNumbers)).length;
    const lines: string[] = [];
    
    let lineIndex = 0;
    
    // Add before lines
    for (const line of beforeLines) {
      const lineNum = lineNumbers[lineIndex];
      lines.push(this.formatLine(lineNum, line, maxLineNumWidth));
      lineIndex++;
    }
    
    // Add error line
    const errorLineNum = lineNumbers[lineIndex];
    lines.push(this.formatLine(errorLineNum, errorLine, maxLineNumWidth));
    
    // Add error indicator
    const padding = ' '.repeat(maxLineNumWidth + 3); // " | "
    const indicatorSpaces = Math.max(0, column - 1); // Ensure non-negative
    const indicator = ' '.repeat(indicatorSpaces) + '^';
    lines.push(padding + indicator);
    
    lineIndex++;
    
    // Add after lines
    for (const line of afterLines) {
      const lineNum = lineNumbers[lineIndex];
      lines.push(this.formatLine(lineNum, line, maxLineNumWidth));
      lineIndex++;
    }
    
    return lines.join('\n');
  }
  
  /**
   * Format a single line with line number
   */
  private static formatLine(lineNum: number, content: string, width: number): string {
    const paddedNum = String(lineNum).padStart(width, ' ');
    return `${paddedNum} | ${content}`;
  }
}

/**
 * Formats error messages with rich context and styling
 */
export class ErrorMessageFormatter {
  /**
   * Format an error with code snippet and context
   */
  static formatWithSnippet(
    error: EnhancedValidationError,
    source: string
  ): string {
    const parts: string[] = [];
    
    // Error header
    const severity = this.getSeverityIcon(error.severity);
    const category = error.category || 'Error';
    parts.push(`${severity} ${category}: ${error.message}${error.code ? ` (${error.code})` : ''}`);
    
    // Location
    const location = `  --> line ${error.line}, column ${error.column}`;
    if (error.context?.functionName) {
      parts.push(`${location} in function '${error.context.functionName}'`);
    } else if (error.context?.blockType && error.context.blockType !== 'global') {
      parts.push(`${location} in ${error.context.blockType} block`);
    } else {
      parts.push(`${location}`);
    }
    
    parts.push(''); // Empty line
    
    // Code snippet
    if (error.codeSnippet) {
      parts.push(error.codeSnippet.fullContext);
      parts.push(''); // Empty line
    }
    
    // Suggestion
    if (error.suggestion) {
      parts.push(`💡 Suggestion: ${error.suggestion}`);
      parts.push(''); // Empty line
    }
    
    // Quick fixes
    if (error.quickFixes && error.quickFixes.length > 0) {
      parts.push(this.formatQuickFixes(error.quickFixes));
      parts.push(''); // Empty line
    }
    
    // Explanation
    if (error.explanation) {
      parts.push(`❓ Why is this an error?`);
      parts.push(`   ${error.explanation}`);
      parts.push(''); // Empty line
    }
    
    // Documentation
    if (error.documentation) {
      parts.push(`📚 ${error.documentation.title}`);
      parts.push(`   ${error.documentation.url}`);
    }
    
    return parts.join('\n');
  }
  
  /**
   * Format quick fix suggestions
   */
  static formatQuickFixes(fixes: QuickFix[]): string {
    const lines: string[] = ['🔧 Quick Fixes:'];
    
    fixes.forEach((fix, index) => {
      const confidence = this.getConfidenceBadge(fix.confidence);
      lines.push(`  ${index + 1}. ${confidence} ${fix.title}`);
      
      if (fix.description) {
        lines.push(`     ${fix.description}`);
      }
      
      // Show the edit if it's simple (single line, short text)
      if (fix.edits.length === 1) {
        const edit = fix.edits[0];
        if (edit.startLine === edit.endLine && edit.newText.length < 80) {
          lines.push(`     Change to: ${edit.newText}`);
        }
      }
    });
    
    return lines.join('\n');
  }
  
  /**
   * Format related errors
   */
  static formatRelatedErrors(errors: EnhancedValidationError[]): string {
    const lines: string[] = [];
    
    const primary = errors.filter(e => e.isPrimary);
    const secondary = errors.filter(e => !e.isPrimary);
    
    if (primary.length > 0) {
      lines.push('❌ Primary Errors:');
      primary.forEach(err => {
        lines.push(`  • ${err.message} (line ${err.line})`);
      });
      lines.push('');
    }
    
    if (secondary.length > 0) {
      lines.push('⚠️  Related Issues:');
      secondary.forEach(err => {
        lines.push(`  • ${err.message} (line ${err.line})`);
      });
      lines.push('');
      lines.push('💡 Fix the primary errors first, and related issues may resolve automatically.');
    }
    
    return lines.join('\n');
  }
  
  /**
   * Get severity icon
   */
  private static getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'error': return '❌';
      case 'warning': return '⚠️ ';
      case 'info': return 'ℹ️ ';
      default: return '•';
    }
  }
  
  /**
   * Get confidence badge
   */
  private static getConfidenceBadge(confidence: string): string {
    switch (confidence) {
      case 'high': return '[HIGH CONFIDENCE]';
      case 'medium': return '[MEDIUM CONFIDENCE]';
      case 'low': return '[LOW CONFIDENCE]';
      default: return '';
    }
  }
}

/**
 * Enhances basic validation errors with rich context
 */
export class ErrorEnhancer {
  /**
   * Enhance a validation error with code snippet and context
   */
  static enhance(
    error: ValidationError,
    source: string,
    contextLines: number = 2
  ): EnhancedValidationError {
    const enhanced: EnhancedValidationError = { ...error };
    
    // Add code snippet
    enhanced.codeSnippet = CodeSnippetExtractor.extract(
      source,
      error.line,
      error.column,
      contextLines
    );
    
    // Add context
    enhanced.context = this.extractContext(source, error.line);
    
    // Categorize error
    enhanced.category = this.categorizeError(error.code);
    
    // Add documentation link
    enhanced.documentation = this.getDocumentationLink(error.code);
    
    // Add explanation
    enhanced.explanation = this.getExplanation(error.code);
    
    // Format the complete message
    enhanced.formattedMessage = ErrorMessageFormatter.formatWithSnippet(enhanced, source);
    
    return enhanced;
  }
  
  /**
   * Extract context information about the error location
   */
  private static extractContext(source: string, line: number): ErrorContext {
    const lines = source.split('\n');
    const context: ErrorContext = {
      scopeLevel: 0,
      blockType: 'global'
    };
    
    // Simple heuristic: check indentation to determine scope
    const errorLine = lines[line - 1];
    if (errorLine) {
      const indent = errorLine.match(/^(\s*)/)?.[1].length || 0;
      context.scopeLevel = Math.floor(indent / 4);
      
      // Look backwards for function/block declarations
      for (let i = line - 2; i >= 0; i--) {
        const prevLine = lines[i].trim();
        if (prevLine.includes('=>')) {
          const match = prevLine.match(/(\w+)\s*\([^)]*\)\s*=>/);
          if (match) {
            context.functionName = match[1];
            context.blockType = 'function';
            break;
          }
        } else if (prevLine.startsWith('if ')) {
          context.blockType = 'if';
          break;
        } else if (prevLine.startsWith('for ')) {
          context.blockType = 'for';
          break;
        } else if (prevLine.startsWith('while ')) {
          context.blockType = 'while';
          break;
        }
      }
    }
    
    return context;
  }
  
  /**
   * Categorize error based on error code
   */
  private static categorizeError(code?: string): ErrorCategory {
    if (!code) return ErrorCategory.SYNTAX;
    
    if (code.includes('SYNTAX')) return ErrorCategory.SYNTAX;
    if (code.includes('TYPE')) return ErrorCategory.TYPE;
    if (code.includes('SCOPE') || code.includes('PSU')) return ErrorCategory.SCOPE;
    if (code.includes('PERF')) return ErrorCategory.PERFORMANCE;
    if (code.includes('STYLE') || code.includes('QUALITY')) return ErrorCategory.STYLE;
    if (code.includes('MIG')) return ErrorCategory.MIGRATION;
    if (code.includes('INDENT')) return ErrorCategory.INDENTATION;
    
    return ErrorCategory.SEMANTIC;
  }
  
  /**
   * Get documentation link for error code
   */
  private static getDocumentationLink(code?: string): DocumentationLink | undefined {
    if (!code) return undefined;
    
    // Map error codes to documentation
    const docMap: Record<string, DocumentationLink> = {
      'PSV6-SYNTAX-MISSING-EQUALS': {
        title: 'Variable Declarations',
        url: 'https://www.tradingview.com/pine-script-docs/language/Variable_declarations'
      },
      'PSV6-SYNTAX-CONDITIONAL-ORDER': {
        title: 'Conditional Operator',
        url: 'https://www.tradingview.com/pine-script-docs/language/Operators#conditional-ternary-operator'
      },
      'PSV6-SYNTAX-MISSING-PARENS': {
        title: 'Function Declarations',
        url: 'https://www.tradingview.com/pine-script-docs/language/User-defined_functions'
      },
      'PSV6-INDENT-WRAP-MULTIPLE-OF-4': {
        title: 'Line Wrapping',
        url: 'https://www.tradingview.com/pine-script-docs/language/Script_structure#line-wrapping'
      },
      'PSV6-SYNTAX-ERROR': {
        title: 'Pine Script Syntax',
        url: 'https://www.tradingview.com/pine-script-docs/language/Script_structure'
      }
    };
    
    return docMap[code];
  }
  
  /**
   * Get explanation for error code
   */
  private static getExplanation(code?: string): string | undefined {
    if (!code) return undefined;
    
    const explanations: Record<string, string> = {
      'PSV6-SYNTAX-MISSING-EQUALS': 
        'In Pine Script, variables must be declared with the = operator. The syntax is: variableName = value',
      'PSV6-SYNTAX-CONDITIONAL-ORDER':
        'The conditional (ternary) operator uses the syntax: condition ? value_if_true : value_if_false',
      'PSV6-SYNTAX-MISSING-PARENS':
        'Function declarations require parentheses after the function name, even if there are no parameters',
      'PSV6-SYNTAX-MISSING-COMMA':
        'Function parameters must be separated by commas',
      'PSV6-SYNTAX-MISSING-OPERAND':
        'Binary operators (like *, /, +, -) require both a left and right operand',
      'PSV6-INDENT-WRAP-MULTIPLE-OF-4':
        'Line continuations cannot use multiples of 4 spaces for indentation (reserved for code blocks). Use 1, 2, 3, 5, 6, 7, etc. spaces instead.',
      'PSV6-SYNTAX-ERROR':
        'Control structures (if, for, while) must have an indented code block to define their local scope'
    };
    
    return explanations[code];
  }
}
