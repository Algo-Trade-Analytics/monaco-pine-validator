/**
 * Error Documentation Provider
 * 
 * Provides rich, context-aware documentation and examples for error messages
 * by leveraging the scraped Pine Script documentation structures.
 */

import { pineScriptDocumentation } from '../PineScriptContext/structures';
import type { PineFunctionMetadata } from '../PineScriptContext/structures/functions';
import type { DocumentationLink } from './error-enhancement';

/**
 * Enhanced documentation with examples and usage patterns
 */
export interface EnhancedDocumentation {
  description: string;
  syntax?: string;
  parameters?: string[];
  returns?: string;
  example?: string;
  remarks?: string;
  seeAlso?: Array<{ name: string; reference: string }>;
  commonMistakes?: string[];
  bestPractices?: string[];
}

/**
 * Provides rich documentation for Pine Script elements
 */
export class ErrorDocumentationProvider {
  /**
   * Get documentation for a function
   */
  static getFunctionDoc(functionName: string): EnhancedDocumentation | null {
    // Handle namespaced functions (e.g., "ta.sma" -> functions.ta.sma)
    const parts = functionName.split('.');
    let funcData: any = pineScriptDocumentation.functions;
    
    for (const part of parts) {
      if (funcData && typeof funcData === 'object' && part in funcData) {
        funcData = funcData[part];
      } else {
        return null;
      }
    }
    
    if (!funcData || typeof funcData !== 'object' || !funcData.name) {
      return null;
    }
    
    return this.formatFunctionDoc(funcData);
  }
  
  /**
   * Get documentation for a variable
   */
  static getVariableDoc(variableName: string): EnhancedDocumentation | null {
    const varData = pineScriptDocumentation.variables[variableName];
    if (!varData) return null;
    
    return {
      description: varData.description || '',
      syntax: varData.qualifier ? `${varData.qualifier} ${varData.type}` : varData.type,
      remarks: varData.remarks,
      seeAlso: varData.seeAlso,
      example: varData.example
    };
  }
  
  /**
   * Get documentation for a constant
   */
  static getConstantDoc(constantName: string): EnhancedDocumentation | null {
    // Handle namespaced constants (e.g., "color.red")
    const parts = constantName.split('.');
    let constData: any = pineScriptDocumentation.constants;
    
    for (const part of parts) {
      if (constData && typeof constData === 'object' && part in constData) {
        constData = constData[part];
      } else {
        return null;
      }
    }
    
    if (!constData || typeof constData !== 'object') {
      return null;
    }
    
    return {
      description: constData.description || '',
      syntax: constData.type,
      remarks: constData.remarks,
      seeAlso: constData.seeAlso
    };
  }
  
  /**
   * Get documentation for a keyword
   */
  static getKeywordDoc(keyword: string): EnhancedDocumentation | null {
    const keywordData = pineScriptDocumentation.keywords[keyword];
    if (!keywordData) return null;
    
    return {
      description: keywordData.description || '',
      syntax: keywordData.syntax,
      example: keywordData.example,
      remarks: keywordData.remarks,
      seeAlso: keywordData.seeAlso
    };
  }
  
  /**
   * Get documentation for an operator
   */
  static getOperatorDoc(operator: string): EnhancedDocumentation | null {
    const operatorData = pineScriptDocumentation.operators[operator];
    if (!operatorData) return null;
    
    return {
      description: operatorData.description || '',
      syntax: operatorData.syntax,
      example: operatorData.example,
      remarks: operatorData.remarks,
      returns: operatorData.returns
    };
  }
  
  /**
   * Get documentation for a type
   */
  static getTypeDoc(typeName: string): EnhancedDocumentation | null {
    const typeData = pineScriptDocumentation.types[typeName];
    if (!typeData) return null;
    
    return {
      description: typeData.description || '',
      example: typeData.example,
      remarks: typeData.remarks,
      seeAlso: typeData.seeAlso
    };
  }
  
  /**
   * Format function documentation
   */
  private static formatFunctionDoc(funcData: any): EnhancedDocumentation {
    const params = funcData.parameters?.map((p: any) => p.text) || [];
    
    return {
      description: funcData.description || '',
      syntax: funcData.syntax,
      parameters: params,
      returns: funcData.returns,
      example: funcData.example,
      remarks: funcData.remarks,
      seeAlso: funcData.seeAlso
    };
  }
  
  /**
   * Get usage example for a function
   */
  static getFunctionExample(functionName: string): string | null {
    const doc = this.getFunctionDoc(functionName);
    return doc?.example || null;
  }
  
  /**
   * Get common mistakes for a function
   */
  static getCommonMistakes(functionName: string): string[] {
    const mistakes: Record<string, string[]> = {
      'ta.sma': [
        'Forgetting to specify the length parameter',
        'Using a negative length value',
        'Mixing series and simple types incorrectly'
      ],
      'ta.ema': [
        'Not understanding the difference between SMA and EMA',
        'Using length < 1',
        'Expecting immediate results on first bars'
      ],
      'plot': [
        'Forgetting to assign a color',
        'Using plot() inside conditional blocks (use plotshape instead)',
        'Not understanding series vs simple values'
      ],
      'alert': [
        'Calling alert() on historical bars (only works on realtime)',
        'Not setting the frequency parameter correctly',
        'Expecting alerts without creating them in the UI'
      ],
      'strategy.entry': [
        'Not providing a unique ID for each entry',
        'Mixing long and short entries without proper exit logic',
        'Not understanding pyramiding settings'
      ]
    };
    
    return mistakes[functionName] || [];
  }
  
  /**
   * Get best practices for a function
   */
  static getBestPractices(functionName: string): string[] {
    const practices: Record<string, string[]> = {
      'ta.sma': [
        'Use appropriate length values (typically 10-200)',
        'Consider caching results if used multiple times',
        'Use ta.ema for faster response to price changes'
      ],
      'plot': [
        'Always provide meaningful titles',
        'Use consistent color schemes',
        'Consider using plotshape for conditional plotting'
      ],
      'strategy.entry': [
        'Always provide exit conditions',
        'Use meaningful entry IDs',
        'Consider using stop loss and take profit'
      ],
      'request.security': [
        'Avoid lookahead bias with gaps parameter',
        'Use barstate.isconfirmed for repaint-free results',
        'Cache expensive security calls'
      ]
    };
    
    return practices[functionName] || [];
  }
  
  /**
   * Get related functions that might be useful
   */
  static getRelatedFunctions(functionName: string): string[] {
    const doc = this.getFunctionDoc(functionName);
    if (!doc?.seeAlso) return [];
    
    return doc.seeAlso.map(item => item.name);
  }
  
  /**
   * Generate a helpful error message for unknown function
   */
  static generateUnknownFunctionMessage(functionName: string): string {
    const parts: string[] = [];
    
    parts.push(`Function '${functionName}' is not defined in Pine Script v6.`);
    
    // Try to find similar functions
    const similar = this.findSimilarFunctions(functionName);
    if (similar.length > 0) {
      parts.push(`\nDid you mean one of these?`);
      similar.slice(0, 3).forEach(name => {
        const doc = this.getFunctionDoc(name);
        parts.push(`  • ${name}${doc?.description ? ` - ${doc.description.slice(0, 60)}...` : ''}`);
      });
    }
    
    return parts.join('\n');
  }
  
  /**
   * Generate a helpful error message for wrong parameter count
   */
  static generateParameterCountMessage(
    functionName: string,
    expected: number,
    received: number
  ): string {
    const doc = this.getFunctionDoc(functionName);
    const parts: string[] = [];
    
    parts.push(`Function '${functionName}' expects ${expected} parameter(s), but received ${received}.`);
    
    if (doc?.syntax) {
      parts.push(`\nCorrect syntax: ${doc.syntax}`);
    }
    
    if (doc?.parameters && doc.parameters.length > 0) {
      parts.push(`\nParameters:`);
      doc.parameters.forEach((param, i) => {
        parts.push(`  ${i + 1}. ${param}`);
      });
    }
    
    if (doc?.example) {
      parts.push(`\nExample:\n${this.formatExample(doc.example)}`);
    }
    
    return parts.join('\n');
  }
  
  /**
   * Generate a helpful error message for type mismatch
   */
  static generateTypeMismatchMessage(
    functionName: string,
    parameterName: string,
    expectedType: string,
    receivedType: string
  ): string {
    const doc = this.getFunctionDoc(functionName);
    const parts: string[] = [];
    
    parts.push(`Parameter '${parameterName}' of function '${functionName}' expects type '${expectedType}', but received '${receivedType}'.`);
    
    if (doc?.parameters) {
      const param = doc.parameters.find(p => p.includes(parameterName));
      if (param) {
        parts.push(`\nParameter info: ${param}`);
      }
    }
    
    // Suggest type conversion
    const conversion = this.suggestTypeConversion(receivedType, expectedType);
    if (conversion) {
      parts.push(`\n💡 Tip: ${conversion}`);
    }
    
    return parts.join('\n');
  }
  
  /**
   * Find similar function names (for typo suggestions)
   */
  private static findSimilarFunctions(name: string): string[] {
    const allFunctions = this.getAllFunctionNames();
    const similar: Array<{ name: string; distance: number }> = [];
    
    for (const funcName of allFunctions) {
      const distance = this.levenshteinDistance(name.toLowerCase(), funcName.toLowerCase());
      if (distance <= 3) {
        similar.push({ name: funcName, distance });
      }
    }
    
    return similar
      .sort((a, b) => a.distance - b.distance)
      .map(item => item.name);
  }
  
  /**
   * Get all function names (including namespaced)
   */
  private static getAllFunctionNames(): string[] {
    const names: string[] = [];
    
    function collectNames(obj: any, prefix: string = '') {
      for (const key in obj) {
        const value = obj[key];
        const fullName = prefix ? `${prefix}.${key}` : key;
        
        if (value && typeof value === 'object') {
          if (value.name && value.description) {
            // This is a function metadata object
            names.push(fullName);
          } else {
            // This is a namespace, recurse
            collectNames(value, fullName);
          }
        }
      }
    }
    
    collectNames(pineScriptDocumentation.functions);
    return names;
  }
  
  /**
   * Calculate Levenshtein distance for typo detection
   */
  private static levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }
  
  /**
   * Suggest type conversion
   */
  private static suggestTypeConversion(from: string, to: string): string | null {
    const conversions: Record<string, Record<string, string>> = {
      'int': {
        'float': 'Use float(value) to convert integer to float',
        'string': 'Use str.tostring(value) to convert integer to string',
        'bool': 'Use value != 0 to convert integer to boolean'
      },
      'float': {
        'int': 'Use int(value) or math.floor(value) to convert float to integer',
        'string': 'Use str.tostring(value) to convert float to string',
        'bool': 'Use value != 0.0 to convert float to boolean'
      },
      'string': {
        'int': 'Use str.tonumber(value) to convert string to number',
        'float': 'Use str.tonumber(value) to convert string to number',
        'bool': 'Use value != "" to check if string is not empty'
      },
      'bool': {
        'int': 'Use value ? 1 : 0 to convert boolean to integer',
        'string': 'Use str.tostring(value) to convert boolean to string'
      }
    };
    
    return conversions[from]?.[to] || null;
  }
  
  /**
   * Format example code
   */
  private static formatExample(example: string): string {
    // Clean up the example (remove excessive whitespace, format nicely)
    const lines = example.split('\n');
    const formatted = lines
      .map(line => '  ' + line)
      .join('\n');
    return formatted;
  }
  
  /**
   * Get documentation URL for a function
   */
  static getDocumentationUrl(functionName: string): DocumentationLink | null {
    const baseUrl = 'https://www.tradingview.com/pine-script-docs/language';
    
    // Map function names to documentation sections
    const urlMap: Record<string, string> = {
      'ta.sma': `${baseUrl}/Built-ins#ta_sma`,
      'ta.ema': `${baseUrl}/Built-ins#ta_ema`,
      'plot': `${baseUrl}/Built-ins#plot`,
      'alert': `${baseUrl}/Built-ins#alert`,
      'strategy.entry': `${baseUrl}/Built-ins#strategy_entry`,
      'request.security': `${baseUrl}/Built-ins#request_security`,
    };
    
    const url = urlMap[functionName] || `${baseUrl}/Built-ins`;
    
    return {
      title: `${functionName} Documentation`,
      url,
      section: functionName
    };
  }
}
