/**
 * Enhanced Textbox Validator
 * 
 * Validates Pine Script v6 enhanced textbox features and text parameters in boxes:
 * - Box text parameter validation (box.new with text)
 * - Box text setter functions (box.set_text, box.set_text_color, etc.)
 * - Text content validation (length, encoding, special characters)
 * - Text formatting validation (color, size, font, alignment)
 * - Performance analysis for text boxes
 * - Best practices for text content and styling
 * - Integration with other drawing objects
 * 
 * Priority 79: Medium priority - enhances drawing functionality with text support
 */

import { ValidationModule, ValidationContext, ValidatorConfig, ValidationError, ValidationResult } from '../core/types';
import { 
  TEXTBOX_LIMITS, 
  TEXT_ALIGNMENT_CONSTANTS, 
  TEXT_SIZE_CONSTANTS, 
  TEXT_FONT_CONSTANTS, 
  TEXT_WRAP_CONSTANTS,
  TEXT_STYLE_CONSTANTS,
  BOX_TEXT_FUNCTIONS 
} from '../core/constants';

interface TextboxCall {
  functionName: string;
  line: number;
  column: number;
  arguments: string[];
  textContent?: string;
  hasTextParameters: boolean;
}

interface TextAnalysis {
  length: number;
  hasSpecialChars: boolean;
  hasMarkup: boolean;
  hasColorCodes: boolean;
  hasUnicode: boolean;
  isDynamic: boolean;
  isEmpty: boolean;
  isNull: boolean;
}

export class EnhancedTextboxValidator implements ValidationModule {
  name = 'EnhancedTextboxValidator';
  priority = 79; // Medium priority - enhances drawing functionality

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  // Textbox tracking
  private textboxCalls: TextboxCall[] = [];
  private textboxCount = 0;
  private textContents = new Map<string, number>(); // Track repeated text content
  private hasDrawingObjects = false;
  
  // Suggestion flags
  private hasPerformanceWarning = false;
  private hasCachingSuggestion = false;
  private hasLabelSuggestion = false;
  private hasConsistencySuggestion = false;
  private hasOverlapWarning = false;

  getDependencies(): string[] {
    return ['TypeValidator', 'DrawingFunctionsValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    // Process each line for textbox function calls
    context.cleanLines.forEach((line, index) => {
      this.processLine(line, index + 1);
    });

    // Post-process validations
    this.validateTextboxPerformance();
    this.validateTextboxBestPractices();
    this.validateTextConsistency();

    // Build analysis results for other validators
    const typeMap = new Map();
    typeMap.set('textbox_analysis', {
      type: 'analysis',
      isConst: false,
      isSeries: false,
      declaredAt: { line: 1, column: 1 },
      usages: [],
      textboxCount: this.textboxCount,
      hasTextContent: this.textContents.size > 0
    });

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap,
      scriptType: null
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.textboxCalls = [];
    this.textboxCount = 0;
    this.textContents.clear();
    this.hasDrawingObjects = false;
    
    // Reset suggestion flags
    this.hasPerformanceWarning = false;
    this.hasCachingSuggestion = false;
    this.hasLabelSuggestion = false;
    this.hasConsistencySuggestion = false;
    this.hasOverlapWarning = false;
  }

  private processLine(line: string, lineNum: number): void {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('//')) {
      return;
    }

    // Check for other drawing objects
    this.checkDrawingObjects(line);

    // Check for textbox function calls
    this.detectTextboxFunctionCalls(line, lineNum);

    // Check for text boxes in loops
    this.checkLoopContext(line, lineNum);
  }

  private checkDrawingObjects(line: string): void {
    const drawingPatterns = [
      /\blabel\.new\s*\(/,
      /\btable\.new\s*\(/,
      /\bline\.new\s*\(/,
      /\blinefill\.new\s*\(/
    ];

    if (drawingPatterns.some(pattern => pattern.test(line))) {
      this.hasDrawingObjects = true;
    }
  }

  private detectTextboxFunctionCalls(line: string, lineNum: number): void {
    // Pattern 1: box.new with text parameter
    this.detectBoxNewWithText(line, lineNum);
    
    // Pattern 2: box text setter/getter functions
    this.detectBoxTextFunctions(line, lineNum);
  }

  private detectBoxNewWithText(line: string, lineNum: number): void {
    const boxNewPattern = /box\.new\s*\(/g;
    
    let match;
    while ((match = boxNewPattern.exec(line)) !== null) {
      const startIndex = match.index;
      const openParenIndex = match.index + match[0].length - 1;
      
      // Extract arguments
      const argsString = this.extractBalancedParentheses(line, openParenIndex);
      if (argsString === null) {
        // Malformed call due to unbalanced parentheses or strings
        this.addError(
          lineNum,
          startIndex + 1,
          'Malformed text parameters in box.new() call (unbalanced quotes or parentheses)',
          'PSV6-TEXTBOX-MALFORMED-TEXT'
        );
        continue;
      }
      
      const args = this.parseArguments(argsString);
      const column = startIndex + 1;

      // Check if it has text parameter
      const textParam = this.findParameter(args, 'text');
      const hasTextParameters = textParam !== undefined || this.hasTextRelatedParameters(args);

      const textboxCall: TextboxCall = {
        functionName: 'box.new',
        line: lineNum,
        column,
        arguments: args,
        textContent: textParam,
        hasTextParameters
      };

      this.textboxCalls.push(textboxCall);
      
      if (hasTextParameters) {
        this.textboxCount++;
        
        // Validate the box.new call with text
        this.validateBoxNewWithText(textboxCall);
        
        // Analyze text content
        if (textParam) {
          // Detect malformed/mismatched quotes specifically on the text parameter
          if (this.hasUnbalancedQuotes(textParam)) {
            this.addError(lineNum, column, 'Malformed text parameter: unbalanced quotes', 'PSV6-TEXTBOX-MALFORMED-TEXT');
          } else {
            this.analyzeTextContent(textParam, lineNum, column);
          }
        }
      }
    }
  }

  private detectBoxTextFunctions(line: string, lineNum: number): void {
    for (const funcName of BOX_TEXT_FUNCTIONS) {
      const pattern = new RegExp(`${funcName.replace('.', '\\.')}\\s*\\(`, 'g');
      
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const startIndex = match.index;
        const openParenIndex = match.index + match[0].length - 1;
        
        // Extract arguments
        const argsString = this.extractBalancedParentheses(line, openParenIndex);
        if (argsString === null) {
          this.addError(
            lineNum,
            startIndex + 1,
            `Malformed parameters in ${funcName}() call (unbalanced quotes or parentheses)`,
            'PSV6-TEXTBOX-MALFORMED-TEXT'
          );
          continue;
        }
        
        const args = this.parseArguments(argsString);
        const column = startIndex + 1;

        const textboxCall: TextboxCall = {
          functionName: funcName,
          line: lineNum,
          column,
          arguments: args,
          hasTextParameters: true
        };

        this.textboxCalls.push(textboxCall);
        
        // Validate the specific function
        this.validateBoxTextFunction(textboxCall);
        
        // Analyze text content for setter functions
        if (funcName === 'box.set_text' && args.length > 1) {
          if (this.hasUnbalancedQuotes(args[1])) {
            this.addError(lineNum, column, 'Malformed text parameter: unbalanced quotes', 'PSV6-TEXTBOX-MALFORMED-TEXT');
          } else {
            this.analyzeTextContent(args[1], lineNum, column);
          }
        }
      }
    }
  }

  private validateBoxNewWithText(textboxCall: TextboxCall): void {
    const args = textboxCall.arguments;
    
    // Validate text parameter type
    const textParam = this.findParameter(args, 'text');
    if (textParam && !this.isStringExpression(textParam)) {
      this.addError(
        textboxCall.line,
        textboxCall.column,
        'text parameter must be a string expression',
        'PSV6-TEXTBOX-TEXT-TYPE'
      );
    }

    // Validate text_color parameter
    const textColorParam = this.findParameter(args, 'text_color');
    if (textColorParam && !this.isColorExpression(textColorParam)) {
      this.addError(
        textboxCall.line,
        textboxCall.column,
        'text_color must be a valid color expression',
        'PSV6-TEXTBOX-COLOR-TYPE'
      );
    }

    // Validate text_size parameter (accepts size constants or numeric points)
    const textSizeParam = this.findParameter(args, 'text_size');
    if (textSizeParam && !this.isValidTextSize(textSizeParam)) {
      this.addError(
        textboxCall.line,
        textboxCall.column,
        'text_size must be a valid size constant',
        'PSV6-TEXTBOX-SIZE-TYPE'
      );
    }

    // Validate text_font parameter
    const textFontParam = this.findParameter(args, 'text_font');
    if (textFontParam && !this.isValidTextFont(textFontParam)) {
      this.addError(
        textboxCall.line,
        textboxCall.column,
        'text_font must be a valid font constant',
        'PSV6-TEXTBOX-FONT-TYPE'
      );
    }

    // Validate text alignment parameters
    const textHalignParam = this.findParameter(args, 'text_halign');
    if (textHalignParam && !this.isValidTextAlignment(textHalignParam)) {
      this.addError(
        textboxCall.line,
        textboxCall.column,
        'text_halign must be a valid alignment constant',
        'PSV6-TEXTBOX-ALIGN-TYPE'
      );
    }

    const textValignParam = this.findParameter(args, 'text_valign');
    if (textValignParam && !this.isValidTextAlignment(textValignParam)) {
      this.addError(
        textboxCall.line,
        textboxCall.column,
        'text_valign must be a valid alignment constant',
        'PSV6-TEXTBOX-ALIGN-TYPE'
      );
    }

    // Validate text_wrap parameter
    const textWrapParam = this.findParameter(args, 'text_wrap');
    if (textWrapParam && !this.isValidTextWrap(textWrapParam)) {
      this.addError(
        textboxCall.line,
        textboxCall.column,
        'text_wrap must be a valid wrap constant',
        'PSV6-TEXTBOX-WRAP-TYPE'
      );
    }

    // Check for simple text box that could be a label
    this.checkLabelSuggestion(args, textboxCall.line, textboxCall.column);

    // Validate text_style (bold/italic/underline) if provided
    const textStyleParam = this.findParameter(args, 'text_style');
    if (textStyleParam && !this.isValidTextStyle(textStyleParam)) {
      this.addError(
        textboxCall.line,
        textboxCall.column,
        'text_style must be a valid text style constant',
        'PSV6-TEXTBOX-STYLE-TYPE'
      );
    }
  }

  private hasUnbalancedQuotes(value: string): boolean {
    const dbl = (value.match(/\"/g) || []).length; // escaped quotes
    const rawDbl = (value.match(/"/g) || []).length - dbl;
    const rawSgl = (value.match(/'/g) || []).length;
    // Ignore perfectly quoted literals
    if (/^\s*"[^"]*"\s*$/.test(value) || /^\s*'[^']*'\s*$/.test(value)) return false;
    // Unbalanced if odd count of quotes present
    return (rawDbl % 2 === 1) || (rawSgl % 2 === 1);
  }

  private validateBoxTextFunction(textboxCall: TextboxCall): void {
    const funcName = textboxCall.functionName;
    const args = textboxCall.arguments;

    switch (funcName) {
      case 'box.set_text':
        this.validateBoxSetText(args, textboxCall.line, textboxCall.column);
        break;
      case 'box.set_text_color':
        this.validateBoxSetTextColor(args, textboxCall.line, textboxCall.column);
        break;
      case 'box.set_text_size':
        this.validateBoxSetTextSize(args, textboxCall.line, textboxCall.column);
        break;
      case 'box.set_text_halign':
      case 'box.set_text_valign':
        this.validateBoxSetTextAlign(args, textboxCall.line, textboxCall.column, funcName);
        break;
      case 'box.set_text_wrap':
        this.validateBoxSetTextWrap(args, textboxCall.line, textboxCall.column);
        break;
    }
  }

  private validateBoxSetText(args: string[], lineNum: number, column: number): void {
    if (args.length !== 2) {
      this.addError(lineNum, column, 'box.set_text() requires exactly 2 parameters (id, text)', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    if (!this.isStringExpression(args[1])) {
      this.addError(lineNum, column, 'text parameter must be a string expression', 'PSV6-TEXTBOX-TEXT-TYPE');
    }
  }

  private validateBoxSetTextColor(args: string[], lineNum: number, column: number): void {
    if (args.length !== 2) {
      this.addError(lineNum, column, 'box.set_text_color() requires exactly 2 parameters (id, color)', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    if (!this.isColorExpression(args[1])) {
      this.addError(lineNum, column, 'color parameter must be a valid color expression', 'PSV6-TEXTBOX-COLOR-TYPE');
    }
  }

  private validateBoxSetTextSize(args: string[], lineNum: number, column: number): void {
    if (args.length !== 2) {
      this.addError(lineNum, column, 'box.set_text_size() requires exactly 2 parameters (id, size)', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    if (!this.isValidTextSize(args[1])) {
      this.addError(lineNum, column, 'size parameter must be a valid size constant', 'PSV6-TEXTBOX-SIZE-TYPE');
    }
  }

  private validateBoxSetTextAlign(args: string[], lineNum: number, column: number, funcName: string): void {
    if (args.length !== 2) {
      this.addError(lineNum, column, `${funcName}() requires exactly 2 parameters (id, align)`, 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    if (!this.isValidTextAlignment(args[1])) {
      this.addError(lineNum, column, 'alignment parameter must be a valid alignment constant', 'PSV6-TEXTBOX-ALIGN-TYPE');
    }
  }

  private validateBoxSetTextWrap(args: string[], lineNum: number, column: number): void {
    if (args.length !== 2) {
      this.addError(lineNum, column, 'box.set_text_wrap() requires exactly 2 parameters (id, wrap)', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    if (!this.isValidTextWrap(args[1])) {
      this.addError(lineNum, column, 'wrap parameter must be a valid wrap constant', 'PSV6-TEXTBOX-WRAP-TYPE');
    }
  }

  private analyzeTextContent(textContent: string, lineNum: number, column: number): void {
    const analysis = this.performTextAnalysis(textContent);
    
    // Track repeated content
    const count = this.textContents.get(textContent) || 0;
    this.textContents.set(textContent, count + 1);

    // Validate text length
    if (analysis.length > TEXTBOX_LIMITS.MAX_TEXT_LENGTH) {
      this.addWarning(
        lineNum,
        column,
        `Text content is very long (${analysis.length} characters). Consider shorter text for better performance.`,
        'PSV6-TEXTBOX-TEXT-LENGTH'
      );
    }

    // Handle empty or null text
    if (analysis.isEmpty) {
      this.addWarning(lineNum, column, 'Empty text parameter detected', 'PSV6-TEXTBOX-EMPTY-TEXT');
    }

    if (analysis.isNull) {
      this.addWarning(lineNum, column, 'Text parameter is na', 'PSV6-TEXTBOX-NULL-TEXT');
    }

    // Provide info about special content
    if (analysis.hasSpecialChars) {
      this.addInfo(lineNum, column, 'Text contains special characters (\\n, \\t, etc.)', 'PSV6-TEXTBOX-SPECIAL-CHARS');
    }

    if (analysis.hasMarkup) {
      this.addInfo(lineNum, column, 'HTML-like markup detected in text content', 'PSV6-TEXTBOX-MARKUP-DETECTED');
    }

    if (analysis.hasColorCodes) {
      this.addInfo(lineNum, column, 'Color codes detected in text content', 'PSV6-TEXTBOX-COLOR-CODES');
    }

    if (analysis.hasUnicode) {
      this.addInfo(lineNum, column, 'Unicode characters detected in text content', 'PSV6-TEXTBOX-UNICODE-CHARS');
    }

    if (analysis.isDynamic) {
      this.addInfo(lineNum, column, 'Dynamic text content detected (variables or function calls)', 'PSV6-TEXTBOX-DYNAMIC-TEXT');
    }
  }

  private performTextAnalysis(textContent: string): TextAnalysis {
    const trimmed = textContent.trim();
    
    return {
      length: trimmed.length,
      hasSpecialChars: /\\[ntr"'\\]/.test(trimmed),
      hasMarkup: /<[^>]+>/.test(trimmed),
      hasColorCodes: /#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/.test(trimmed),
      hasUnicode: /[^\x00-\x7F]/.test(trimmed),
      isDynamic: !trimmed.match(/^["'][^"']*["']$/) && (trimmed.includes('+') || trimmed.includes('str.') || /[A-Za-z_][A-Za-z0-9_]*/.test(trimmed)),
      isEmpty: trimmed === '""' || trimmed === "''",
      isNull: trimmed === 'na'
    };
  }

  private checkLabelSuggestion(args: string[], lineNum: number, column: number): void {
    if (this.hasLabelSuggestion) return;

    // Check if this is a simple text box (no background, no border)
    const bgcolorParam = this.findParameter(args, 'bgcolor');
    const borderColorParam = this.findParameter(args, 'border_color');
    const textParam = this.findParameter(args, 'text');

    const hasNoBg = bgcolorParam === 'na' || bgcolorParam === undefined;
    const hasNoBorder = borderColorParam === 'na' || borderColorParam === undefined;
    const hasText = textParam !== undefined;

    if (hasText && hasNoBg && hasNoBorder) {
      this.addInfo(
        lineNum,
        column,
        'Consider using label.new() for simple text without background or border',
        'PSV6-TEXTBOX-LABEL-SUGGESTION'
      );
      this.hasLabelSuggestion = true;
    }
  }

  private checkLoopContext(line: string, lineNum: number): void {
    // Check if we're in a loop and there are textbox calls
    if (/\b(for|while)\b/.test(line)) {
      // Look ahead for textbox calls in the next few lines
      for (let i = lineNum; i < Math.min(lineNum + 5, this.context.cleanLines.length); i++) {
        const nextLine = this.context.cleanLines[i];
        if (/box\.new.*text\s*=|box\.set_text/.test(nextLine)) {
          this.addWarning(
            i + 1,
            1,
            'Text boxes in loop may impact performance. Consider limiting creation or using arrays.',
            'PSV6-TEXTBOX-LOOP-WARNING'
          );
          break;
        }
      }
    }
  }

  private validateTextboxPerformance(): void {
    if (!this.config.enablePerformanceAnalysis) return;

    // Check for too many textboxes
    if (this.textboxCount > TEXTBOX_LIMITS.PERFORMANCE_WARNING_THRESHOLD && !this.hasPerformanceWarning) {
      this.addWarning(
        1,
        1,
        `Many text boxes detected (${this.textboxCount}). Consider optimizing for better performance.`,
        'PSV6-TEXTBOX-PERFORMANCE-MANY'
      );
      this.hasPerformanceWarning = true;
    }

    if (this.textboxCount > TEXTBOX_LIMITS.MAX_TEXTBOXES_PER_SCRIPT) {
      this.addWarning(
        1,
        1,
        `Excessive text boxes (${this.textboxCount}). May cause performance issues.`,
        'PSV6-TEXTBOX-PERFORMANCE-EXCESSIVE'
      );
    }
  }

  private validateTextboxBestPractices(): void {
    // Suggest caching for repeated text content
    if (!this.hasCachingSuggestion) {
      for (const [content, count] of this.textContents) {
        if (count >= 3) {
          this.addInfo(
            1,
            1,
            'Consider caching repeated text content to improve performance',
            'PSV6-TEXTBOX-CACHE-SUGGESTION'
          );
          this.hasCachingSuggestion = true;
          break;
        }
      }
    }

    // Check for potential overlap
    this.checkTextboxOverlap();
  }

  private validateTextConsistency(): void {
    if (this.hasDrawingObjects && this.textboxCount > 0 && !this.hasConsistencySuggestion) {
      this.addInfo(
        1,
        1,
        'Consider consistent text styling across drawing objects (labels, boxes, tables)',
        'PSV6-TEXTBOX-CONSISTENCY-CHECK'
      );
      this.hasConsistencySuggestion = true;
    }
  }

  private checkTextboxOverlap(): void {
    if (this.hasOverlapWarning || this.textboxCalls.length < 2) return;

    // Simple overlap detection based on similar coordinates
    const boxNewCalls = this.textboxCalls.filter(call => call.functionName === 'box.new');
    
    for (let i = 0; i < boxNewCalls.length - 1; i++) {
      for (let j = i + 1; j < boxNewCalls.length; j++) {
        const call1 = boxNewCalls[i];
        const call2 = boxNewCalls[j];
        
        // Check if they're on consecutive lines (potential overlap)
        if (Math.abs(call1.line - call2.line) <= 2) {
          this.addWarning(
            call2.line,
            call2.column,
            'Potential text overlap detected between text boxes',
            'PSV6-TEXTBOX-OVERLAP-WARNING'
          );
          this.hasOverlapWarning = true;
          break;
        }
      }
      if (this.hasOverlapWarning) break;
    }
  }

  // Helper methods
  private extractBalancedParentheses(line: string, openParenIndex: number): string | null {
    let depth = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = openParenIndex; i < line.length; i++) {
      const char = line[i];
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        inString = false;
        stringChar = '';
      } else if (!inString) {
        if (char === '(') {
          depth++;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            return line.substring(openParenIndex + 1, i);
          }
        }
      }
    }
    
    return null;
  }

  private parseArguments(argsString: string): string[] {
    if (!argsString.trim()) return [];
    
    const args: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        current += char;
      } else if (inString && char === stringChar) {
        inString = false;
        stringChar = '';
        current += char;
      } else if (!inString && char === '(') {
        depth++;
        current += char;
      } else if (!inString && char === ')') {
        depth--;
        current += char;
      } else if (!inString && char === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      args.push(current.trim());
    }
    
    return args;
  }

  private findParameter(args: string[], paramName: string): string | undefined {
    for (const arg of args) {
      if (arg.includes(`${paramName}=`)) {
        const match = arg.match(new RegExp(`${paramName}\\s*=\\s*([^,]+)`));
        return match ? match[1].trim() : undefined;
      }
    }
    return undefined;
  }

  private hasTextRelatedParameters(args: string[]): boolean {
    const textParams = ['text', 'text_color', 'text_size', 'text_font', 'text_halign', 'text_valign', 'text_wrap', 'text_style'];
    return textParams.some(param => this.findParameter(args, param) !== undefined);
  }

  private isStringExpression(value: string): boolean {
    const trimmed = value.trim();
    
    // String literals
    if (trimmed.match(/^["'][^"']*["']$/)) return true;
    
    // String concatenation
    if (trimmed.includes('+') && (trimmed.includes('"') || trimmed.includes("'"))) return true;
    
    // String functions
    if (trimmed.includes('str.')) return true;
    
    // Variables (assume they could be strings)
    if (trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*$/)) return true;
    
    // String formatting
    if (trimmed.includes('str.format')) return true;
    
    return false;
  }

  private isColorExpression(value: string): boolean {
    const trimmed = value.trim();
    
    // Color namespace
    if (trimmed.startsWith('color.')) return true;
    
    // Hex colors
    if (trimmed.match(/^#[0-9A-Fa-f]{6}$/) || trimmed.match(/^#[0-9A-Fa-f]{3}$/)) return true;
    
    // na
    if (trimmed === 'na') return true;
    
    // Variables
    if (trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*$/)) return true;
    
    return false;
  }

  private isValidTextSize(value: string): boolean {
    const trimmed = value.trim();
    if (TEXT_SIZE_CONSTANTS.has(trimmed)) return true;
    // Numeric point sizes (typography points)
    const num = Number(trimmed);
    if (!Number.isNaN(num)) {
      // Accept 6..72 points as reasonable range
      return num >= 6 && num <= 72;
    }
    // Variable reference allowed
    return !!trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*$/);
  }

  private isValidTextFont(value: string): boolean {
    const trimmed = value.trim();
    return TEXT_FONT_CONSTANTS.has(trimmed) || !!trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*$/);
  }

  private isValidTextStyle(value: string): boolean {
    const trimmed = value.trim();
    return TEXT_STYLE_CONSTANTS.has(trimmed) || !!trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*$/);
  }

  private isValidTextAlignment(value: string): boolean {
    const trimmed = value.trim();
    return TEXT_ALIGNMENT_CONSTANTS.has(trimmed) || !!trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*$/);
  }

  private isValidTextWrap(value: string): boolean {
    const trimmed = value.trim();
    return TEXT_WRAP_CONSTANTS.has(trimmed) || !!trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*$/);
  }

  private addError(line: number, column: number, message: string, code: string): void {
    this.errors.push({
      line,
      column,
      message,
      severity: 'error',
      code
    });
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({
      line,
      column,
      message,
      severity: 'warning',
      code
    });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({
      line,
      column,
      message,
      severity: 'info',
      code
    });
  }

  // Getter methods for other modules
  getTextboxCalls(): TextboxCall[] {
    return [...this.textboxCalls];
  }

  getTextboxCount(): number {
    return this.textboxCount;
  }

  getTextContents(): Map<string, number> {
    return new Map(this.textContents);
  }

  hasDrawingObjectsDetected(): boolean {
    return this.hasDrawingObjects;
  }
}
