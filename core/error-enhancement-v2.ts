/**
 * Enhanced Error Message System V2
 * 
 * Leverages scraped Pine Script documentation to provide even richer,
 * more contextual error messages with real examples and best practices.
 */

import type { ValidationError } from './types';
import {
  ErrorEnhancer,
  ErrorMessageFormatter,
  type EnhancedValidationError,
  type QuickFix
} from './error-enhancement';
import { ErrorDocumentationProvider } from './error-documentation-provider';

/**
 * Enhanced error with documentation-driven suggestions
 */
export interface DocumentationEnhancedError extends EnhancedValidationError {
  officialExample?: string;
  commonMistakes?: string[];
  bestPractices?: string[];
  relatedFunctions?: string[];
  similarFunctions?: string[];
}

/**
 * V2 Error Enhancer with documentation integration
 */
export class ErrorEnhancerV2 {
  /**
   * Enhance error with documentation-driven context
   */
  static enhance(
    error: ValidationError,
    source: string,
    contextLines: number = 2
  ): DocumentationEnhancedError {
    // Start with base enhancement
    const baseEnhanced = ErrorEnhancer.enhance(error, source, contextLines);
    
    // Add documentation-driven enhancements
    const docEnhanced: DocumentationEnhancedError = {
      ...baseEnhanced
    };
    
    // Extract function/variable names from error context
    const entities = this.extractEntities(error, source);
    
    // Add documentation-specific enhancements
    if (entities.functionName) {
      this.enhanceWithFunctionDoc(docEnhanced, entities.functionName, error);
    }
    
    if (entities.variableName) {
      this.enhanceWithVariableDoc(docEnhanced, entities.variableName);
    }
    
    // Regenerate formatted message with new information
    docEnhanced.formattedMessage = this.formatEnhancedMessage(docEnhanced, source);
    
    return docEnhanced;
  }
  
  /**
   * Extract entity names from error context
   */
  private static extractEntities(error: ValidationError, source: string): {
    functionName?: string;
    variableName?: string;
    constantName?: string;
  } {
    const entities: any = {};
    
    // Extract from error message
    const functionMatch = error.message.match(/function\s+'([^']+)'/i) ||
                         error.message.match(/Function\s+'([^']+)'/i) ||
                         error.message.match(/\b(ta\.\w+|strategy\.\w+|request\.\w+|math\.\w+|str\.\w+|array\.\w+)\b/);
    
    if (functionMatch) {
      entities.functionName = functionMatch[1];
    }
    
    // Extract from source code at error location
    const lines = source.split('\n');
    const errorLine = lines[error.line - 1];
    if (errorLine) {
      // Look for function calls
      const callMatch = errorLine.match(/(\w+(?:\.\w+)*)\s*\(/);
      if (callMatch) {
        entities.functionName = entities.functionName || callMatch[1];
      }
      
      // Look for variable names
      const varMatch = errorLine.match(/\b([a-z_]\w*)\s*=/i);
      if (varMatch) {
        entities.variableName = varMatch[1];
      }
    }
    
    return entities;
  }
  
  /**
   * Enhance error with function documentation
   */
  private static enhanceWithFunctionDoc(
    error: DocumentationEnhancedError,
    functionName: string,
    originalError: ValidationError
  ): void {
    const doc = ErrorDocumentationProvider.getFunctionDoc(functionName);
    
    if (doc) {
      // Add official example
      if (doc.example) {
        error.officialExample = doc.example;
      }
      
      // Add common mistakes
      const mistakes = ErrorDocumentationProvider.getCommonMistakes(functionName);
      if (mistakes.length > 0) {
        error.commonMistakes = mistakes;
      }
      
      // Add best practices
      const practices = ErrorDocumentationProvider.getBestPractices(functionName);
      if (practices.length > 0) {
        error.bestPractices = practices;
      }
      
      // Add related functions
      const related = ErrorDocumentationProvider.getRelatedFunctions(functionName);
      if (related.length > 0) {
        error.relatedFunctions = related;
      }
      
      // Update documentation link
      const docUrl = ErrorDocumentationProvider.getDocumentationUrl(functionName);
      if (docUrl) {
        error.documentation = docUrl;
      }
      
      // Enhance explanation with official description
      if (doc.description && !error.explanation) {
        error.explanation = doc.description;
      }
    }
    
    // Handle specific error types
    if (originalError.code?.includes('UNKNOWN')) {
      const message = ErrorDocumentationProvider.generateUnknownFunctionMessage(functionName);
      error.suggestion = message;
      
      // Add similar functions for typos
      error.similarFunctions = ErrorDocumentationProvider['findSimilarFunctions'](functionName);
    }
  }
  
  /**
   * Enhance error with variable documentation
   */
  private static enhanceWithVariableDoc(
    error: DocumentationEnhancedError,
    variableName: string
  ): void {
    const doc = ErrorDocumentationProvider.getVariableDoc(variableName);
    
    if (doc) {
      if (doc.description && !error.explanation) {
        error.explanation = doc.description;
      }
      
      if (doc.example) {
        error.officialExample = doc.example;
      }
    }
  }
  
  /**
   * Format enhanced message with documentation
   */
  private static formatEnhancedMessage(
    error: DocumentationEnhancedError,
    source: string
  ): string {
    const parts: string[] = [];
    
    // Use base formatter for standard sections
    const baseFormatted = ErrorMessageFormatter.formatWithSnippet(error, source);
    parts.push(baseFormatted);
    
    // Add documentation-specific sections
    
    // Similar functions (for typos)
    if (error.similarFunctions && error.similarFunctions.length > 0) {
      parts.push('');
      parts.push('🔍 Did you mean one of these?');
      error.similarFunctions.slice(0, 3).forEach(name => {
        const doc = ErrorDocumentationProvider.getFunctionDoc(name);
        const desc = doc?.description?.slice(0, 60) || '';
        parts.push(`  • ${name}${desc ? ` - ${desc}...` : ''}`);
      });
    }
    
    // Official example
    if (error.officialExample) {
      parts.push('');
      parts.push('📖 Official Example:');
      const formatted = this.formatCodeExample(error.officialExample);
      parts.push(formatted);
    }
    
    // Common mistakes
    if (error.commonMistakes && error.commonMistakes.length > 0) {
      parts.push('');
      parts.push('⚠️  Common Mistakes to Avoid:');
      error.commonMistakes.forEach((mistake, i) => {
        parts.push(`  ${i + 1}. ${mistake}`);
      });
    }
    
    // Best practices
    if (error.bestPractices && error.bestPractices.length > 0) {
      parts.push('');
      parts.push('✨ Best Practices:');
      error.bestPractices.forEach((practice, i) => {
        parts.push(`  ${i + 1}. ${practice}`);
      });
    }
    
    // Related functions
    if (error.relatedFunctions && error.relatedFunctions.length > 0) {
      parts.push('');
      parts.push('🔗 Related Functions:');
      error.relatedFunctions.slice(0, 5).forEach(name => {
        parts.push(`  • ${name}`);
      });
    }
    
    return parts.join('\n');
  }
  
  /**
   * Format code example
   */
  private static formatCodeExample(example: string): string {
    const lines = example.split('\n');
    const formatted = lines
      .slice(0, 10) // Limit to 10 lines
      .map(line => '  ' + line)
      .join('\n');
    
    if (lines.length > 10) {
      return formatted + '\n  ... (see documentation for full example)';
    }
    
    return formatted;
  }
  
  /**
   * Generate enhanced error for unknown function
   */
  static enhanceUnknownFunctionError(
    functionName: string,
    line: number,
    column: number,
    source: string
  ): DocumentationEnhancedError {
    const basicError: ValidationError = {
      line,
      column,
      message: `Unknown function '${functionName}'`,
      severity: 'error',
      code: 'PSV6-FUNCTION-UNKNOWN'
    };
    
    const enhanced = this.enhance(basicError, source);
    
    // Add specific suggestions for unknown functions
    const similar = ErrorDocumentationProvider['findSimilarFunctions'](functionName);
    if (similar.length > 0) {
      enhanced.similarFunctions = similar;
      enhanced.suggestion = `Did you mean '${similar[0]}'? Check spelling and namespace (e.g., ta.sma, not sma).`;
    } else {
      enhanced.suggestion = 'Check the function name and ensure it includes the correct namespace (e.g., ta.sma, strategy.entry).';
    }
    
    return enhanced;
  }
  
  /**
   * Generate enhanced error for wrong parameter count
   */
  static enhanceParameterCountError(
    functionName: string,
    expected: number,
    received: number,
    line: number,
    column: number,
    source: string
  ): DocumentationEnhancedError {
    const message = ErrorDocumentationProvider.generateParameterCountMessage(
      functionName,
      expected,
      received
    );
    
    const basicError: ValidationError = {
      line,
      column,
      message: `Wrong number of parameters for '${functionName}'`,
      severity: 'error',
      code: 'PSV6-FUNCTION-PARAM-COUNT',
      suggestion: message
    };
    
    return this.enhance(basicError, source);
  }
  
  /**
   * Generate enhanced error for type mismatch
   */
  static enhanceTypeMismatchError(
    functionName: string,
    parameterName: string,
    expectedType: string,
    receivedType: string,
    line: number,
    column: number,
    source: string
  ): DocumentationEnhancedError {
    const message = ErrorDocumentationProvider.generateTypeMismatchMessage(
      functionName,
      parameterName,
      expectedType,
      receivedType
    );
    
    const basicError: ValidationError = {
      line,
      column,
      message: `Type mismatch for parameter '${parameterName}'`,
      severity: 'error',
      code: 'PSV6-TYPE-MISMATCH',
      suggestion: message
    };
    
    return this.enhance(basicError, source);
  }
}

/**
 * Helper to generate quick fixes with documentation context
 */
export class DocumentationAwareQuickFixGenerator {
  /**
   * Generate quick fixes for unknown function
   */
  static generateUnknownFunctionFixes(
    functionName: string,
    line: number,
    column: number
  ): QuickFix[] {
    const fixes: QuickFix[] = [];
    const similar = ErrorDocumentationProvider['findSimilarFunctions'](functionName);
    
    // Suggest similar functions
    similar.slice(0, 3).forEach(similarName => {
      const doc = ErrorDocumentationProvider.getFunctionDoc(similarName);
      fixes.push({
        title: `Change to '${similarName}'`,
        description: doc?.description?.slice(0, 80) || `Use ${similarName} instead`,
        edits: [{
          startLine: line,
          startColumn: column,
          endLine: line,
          endColumn: column + functionName.length,
          newText: similarName
        }],
        confidence: similar.indexOf(similarName) === 0 ? 'high' : 'medium'
      });
    });
    
    return fixes;
  }
  
  /**
   * Generate quick fixes for missing parameters
   */
  static generateMissingParameterFixes(
    functionName: string,
    line: number,
    column: number,
    currentParams: number,
    requiredParams: number
  ): QuickFix[] {
    const fixes: QuickFix[] = [];
    const doc = ErrorDocumentationProvider.getFunctionDoc(functionName);
    
    if (doc?.syntax) {
      fixes.push({
        title: 'Show correct syntax',
        description: doc.syntax,
        edits: [],
        confidence: 'high'
      });
    }
    
    return fixes;
  }
}
