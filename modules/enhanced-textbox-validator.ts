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

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidatorConfig,
  type ValidationError,
  type ValidationResult,
} from '../core/types';
import { Codes } from '../core/codes';
import { ValidationHelper } from '../core/validation-helper';
import {
  TEXTBOX_LIMITS,
  TEXT_ALIGNMENT_CONSTANTS,
  TEXT_SIZE_CONSTANTS,
  TEXT_FONT_CONSTANTS,
  TEXT_WRAP_CONSTANTS,
  TEXT_STYLE_CONSTANTS,
  BOX_TEXT_FUNCTIONS,
  EXPENSIVE_CALCULATION_FUNCTIONS,
} from '../core/constants';
import {
  type ArgumentNode,
  type CallExpressionNode,
  type ExpressionNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type ProgramNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';
import { getNodeSource } from '../core/ast/source-utils';

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

  private helper = new ValidationHelper();
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;
  private astLoopWarnings = new Set<string>();

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

    this.astContext = this.getAstContext(config);
    const ast = this.astContext?.ast;
    if (!ast) {
      return this.helper.buildResult(context);
    }

    this.collectTextboxDataAst(ast);

    // Check for malformed syntax patterns
    this.detectMalformedSyntax();

    // Post-process validations
    this.validateTextboxPerformance();
    this.validateTextboxBestPractices();
    this.validateTextConsistency();

    // Build analysis results for other validators
    const typeMap = this.context.typeMap ?? new Map();
    typeMap.set('textbox_analysis', {
      type: 'analysis',
      isConst: false,
      isSeries: false,
      declaredAt: { line: 1, column: 1 },
      usages: []
    });

    this.context.typeMap = typeMap;

    return this.helper.buildResult(context);
  }

  private reset(): void {
    this.helper.reset();
    this.textboxCalls = [];
    this.textboxCount = 0;
    this.textContents.clear();
    this.hasDrawingObjects = false;
    this.astContext = null;
    this.astLoopWarnings.clear();

    // Reset suggestion flags
    this.hasPerformanceWarning = false;
    this.hasCachingSuggestion = false;
    this.hasLabelSuggestion = false;
    this.hasConsistencySuggestion = false;
    this.hasOverlapWarning = false;
  }

  private collectTextboxDataAst(program: ProgramNode): void {
    const loopStack: Array<'for' | 'while'> = [];

    visit(program, {
      ForStatement: {
        enter: (): void => { loopStack.push('for'); },
        exit: (): void => {
          loopStack.pop();
        },
      },
      WhileStatement: {
        enter: (): void => { loopStack.push('while'); },
        exit: (): void => {
          loopStack.pop();
        },
      },
      CallExpression: {
        enter: (path) => {
          this.processAstCall(path as NodePath<CallExpressionNode>, loopStack.length > 0);
        },
      },
    });
  }

  private processAstCall(path: NodePath<CallExpressionNode>, inLoop: boolean): void {
    const node = path.node;
    const qualifiedName = this.getExpressionQualifiedName(node.callee);
    if (!qualifiedName) {
      return;
    }

    if (this.isDrawingObjectCall(qualifiedName)) {
      this.hasDrawingObjects = true;
    }

    const line = node.loc.start.line;
    const column = node.loc.start.column;
    const args = node.args.map((argument) => this.argumentToString(argument));

    if (qualifiedName === 'box.new') {
      const textParam = this.findParameter(args, 'text');
      const hasTextParameters = textParam !== undefined || this.hasTextRelatedParameters(args);

      const textboxCall: TextboxCall = {
        functionName: 'box.new',
        line,
        column,
        arguments: args,
        textContent: textParam,
        hasTextParameters,
      };

      this.textboxCalls.push(textboxCall);

      if (hasTextParameters) {
        this.textboxCount++;
        this.validateBoxNewWithText(textboxCall);
      }

      if (inLoop && hasTextParameters) {
        this.warnTextboxInLoop(line, column);
      }

      return;
    }

    if (!BOX_TEXT_FUNCTIONS.has(qualifiedName)) {
      return;
    }

    const textboxCall: TextboxCall = {
      functionName: qualifiedName,
      line,
      column,
      arguments: args,
      hasTextParameters: true,
    };

    this.textboxCalls.push(textboxCall);
    this.validateBoxTextFunction(textboxCall);

    if (inLoop) {
      this.warnTextboxInLoop(line, column);
    }
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
      this.helper.addError(lineNum, column, 'box.set_text() requires exactly 2 parameters (id, text)', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    if (!this.isStringExpression(args[1])) {
      this.helper.addError(lineNum, column, 'text parameter must be a string expression', 'PSV6-TEXTBOX-TEXT-TYPE');
      if (this.hasDanglingQuote(args[1]) || this.hasUnbalancedQuotes(args[1])) {
        this.helper.addError(lineNum, column, 'Malformed text parameter: unbalanced quotes', 'PSV6-TEXTBOX-MALFORMED-TEXT');
      }
      return;
    }

    if (this.hasDanglingQuote(args[1]) || this.hasUnbalancedQuotes(args[1])) {
      this.helper.addError(lineNum, column, 'Malformed text parameter: unbalanced quotes', 'PSV6-TEXTBOX-MALFORMED-TEXT');
      return;
    }

    this.analyzeTextContent(args[1], lineNum, column);
  }

  private validateBoxSetTextColor(args: string[], lineNum: number, column: number): void {
    if (args.length !== 2) {
      this.helper.addError(lineNum, column, 'box.set_text_color() requires exactly 2 parameters (id, color)', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    if (!this.isColorExpression(args[1])) {
      this.helper.addError(lineNum, column, 'color parameter must be a valid color expression', 'PSV6-TEXTBOX-COLOR-TYPE');
    }
  }

  private validateBoxSetTextSize(args: string[], lineNum: number, column: number): void {
    if (args.length !== 2) {
      this.helper.addError(lineNum, column, 'box.set_text_size() requires exactly 2 parameters (id, size)', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    if (!this.isValidTextSize(args[1])) {
      this.helper.addError(lineNum, column, 'size parameter must be a valid size constant', 'PSV6-TEXTBOX-SIZE-TYPE');
    }
  }

  private validateBoxSetTextAlign(args: string[], lineNum: number, column: number, funcName: string): void {
    if (args.length !== 2) {
      this.helper.addError(lineNum, column, `${funcName}() requires exactly 2 parameters (id, align)`, 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    if (!this.isValidTextAlignment(args[1])) {
      this.helper.addError(lineNum, column, 'alignment parameter must be a valid alignment constant', 'PSV6-TEXTBOX-ALIGN-TYPE');
    }
  }

  private validateBoxSetTextWrap(args: string[], lineNum: number, column: number): void {
    if (args.length !== 2) {
      this.helper.addError(lineNum, column, 'box.set_text_wrap() requires exactly 2 parameters (id, wrap)', 'PSV6-FUNCTION-PARAM-COUNT');
      return;
    }

    if (!this.isValidTextWrap(args[1])) {
      this.helper.addError(lineNum, column, 'wrap parameter must be a valid wrap constant', 'PSV6-TEXTBOX-WRAP-TYPE');
    }
  }

  private analyzeTextContent(textContent: string, lineNum: number, column: number): void {
    const analysis = this.performTextAnalysis(textContent);
    
    // Track repeated content
    const count = this.textContents.get(textContent) || 0;
    this.textContents.set(textContent, count + 1);

    // Validate text length
    if (analysis.length > TEXTBOX_LIMITS.MAX_TEXT_LENGTH) {
      this.helper.addWarning(
        lineNum,
        column,
        `Text content is very long (${analysis.length} characters). Consider shorter text for better performance.`,
        'PSV6-TEXTBOX-TEXT-LENGTH'
      );
    }

    // Handle empty or null text
    if (analysis.isEmpty) {
      this.helper.addWarning(lineNum, column, 'Empty text parameter detected', 'PSV6-TEXTBOX-EMPTY-TEXT');
    }

    if (analysis.isNull) {
      this.helper.addWarning(lineNum, column, 'Text parameter is na', 'PSV6-TEXTBOX-NULL-TEXT');
    }

    // Provide info about special content
    if (analysis.hasSpecialChars) {
      this.helper.addInfo(lineNum, column, 'Text contains special characters (\\n, \\t, etc.)', 'PSV6-TEXTBOX-SPECIAL-CHARS');
    }

    if (analysis.hasMarkup) {
      this.helper.addInfo(lineNum, column, 'HTML-like markup detected in text content', 'PSV6-TEXTBOX-MARKUP-DETECTED');
    }

    if (analysis.hasColorCodes) {
      this.helper.addInfo(lineNum, column, 'Color codes detected in text content', 'PSV6-TEXTBOX-COLOR-CODES');
    }

    if (analysis.hasUnicode) {
      this.helper.addInfo(lineNum, column, 'Unicode characters detected in text content', 'PSV6-TEXTBOX-UNICODE-CHARS');
    }

    if (analysis.isDynamic) {
      this.helper.addInfo(lineNum, column, 'Dynamic text content detected (variables or function calls)', 'PSV6-TEXTBOX-DYNAMIC-TEXT');
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
      this.helper.addInfo(
        lineNum,
        column,
        'Consider using label.new() for simple text without background or border',
        'PSV6-TEXTBOX-LABEL-SUGGESTION'
      );
      this.hasLabelSuggestion = true;
    }
  }

  private warnTextboxInLoop(line: number, column: number): void {
    const key = `${line}:${column}`;
    if (this.astLoopWarnings.has(key)) {
      return;
    }
    this.astLoopWarnings.add(key);
    this.helper.addWarning(
      line,
      column,
      'Text boxes in loop may impact performance. Consider limiting creation or using arrays.',
      'PSV6-TEXTBOX-LOOP-WARNING'
    );
  }

  private validateTextboxPerformance(): void {
    if (!this.config.enablePerformanceAnalysis) return;

    // Check for too many textboxes
    if (this.textboxCount > TEXTBOX_LIMITS.PERFORMANCE_WARNING_THRESHOLD && !this.hasPerformanceWarning) {
      this.helper.addWarning(
        1,
        1,
        `Many text boxes detected (${this.textboxCount}). Consider optimizing for better performance.`,
        'PSV6-TEXTBOX-PERFORMANCE-MANY'
      );
      this.hasPerformanceWarning = true;
    }

    if (this.textboxCount > TEXTBOX_LIMITS.MAX_TEXTBOXES_PER_SCRIPT) {
      this.helper.addWarning(
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
          this.helper.addInfo(
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
      this.helper.addInfo(
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
          this.helper.addWarning(
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

  private validateBoxNewWithText(textboxCall: TextboxCall): void {
    const args = textboxCall.arguments;
    const textParam = textboxCall.textContent ?? this.findParameter(args, 'text');

    if (textParam !== undefined) {
      const looksString = this.isStringExpression(textParam);
      if (!looksString) {
        this.helper.addError(
          textboxCall.line,
          textboxCall.column,
          'text parameter must be a string expression',
          'PSV6-TEXTBOX-TEXT-TYPE'
        );
        if (this.hasDanglingQuote(textParam) || this.hasUnbalancedQuotes(textParam)) {
          this.helper.addError(
            textboxCall.line,
            textboxCall.column,
            'Malformed text parameter: unbalanced quotes',
            'PSV6-TEXTBOX-MALFORMED-TEXT'
          );
        }
      } else if (this.hasDanglingQuote(textParam) || this.hasUnbalancedQuotes(textParam)) {
        this.helper.addError(
          textboxCall.line,
          textboxCall.column,
          'Malformed text parameter: unbalanced quotes',
          'PSV6-TEXTBOX-MALFORMED-TEXT'
        );
      } else {
        this.analyzeTextContent(textParam, textboxCall.line, textboxCall.column);
      }
    }

    const textColorParam = this.findParameter(args, 'text_color');
    if (textColorParam && !this.isColorExpression(textColorParam)) {
      this.helper.addError(
        textboxCall.line,
        textboxCall.column,
        'text_color must be a valid color expression',
        'PSV6-TEXTBOX-COLOR-TYPE'
      );
    }

    const textSizeParam = this.findParameter(args, 'text_size');
    if (textSizeParam && !this.isValidTextSize(textSizeParam)) {
      this.helper.addError(
        textboxCall.line,
        textboxCall.column,
        'text_size must be a valid size constant',
        'PSV6-TEXTBOX-SIZE-TYPE'
      );
    }

    const textFontParam = this.findParameter(args, 'text_font');
    if (textFontParam && !this.isValidTextFont(textFontParam)) {
      this.helper.addError(
        textboxCall.line,
        textboxCall.column,
        'text_font must be a valid font constant',
        'PSV6-TEXTBOX-FONT-TYPE'
      );
    }

    const textHalignParam = this.findParameter(args, 'text_halign');
    if (textHalignParam && !this.isValidTextAlignment(textHalignParam)) {
      this.helper.addError(
        textboxCall.line,
        textboxCall.column,
        'text_halign must be a valid alignment constant',
        'PSV6-TEXTBOX-ALIGN-TYPE'
      );
    }

    const textValignParam = this.findParameter(args, 'text_valign');
    if (textValignParam && !this.isValidTextAlignment(textValignParam)) {
      this.helper.addError(
        textboxCall.line,
        textboxCall.column,
        'text_valign must be a valid alignment constant',
        'PSV6-TEXTBOX-ALIGN-TYPE'
      );
    }

    const textWrapParam = this.findParameter(args, 'text_wrap');
    if (textWrapParam && !this.isValidTextWrap(textWrapParam)) {
      this.helper.addError(
        textboxCall.line,
        textboxCall.column,
        'text_wrap must be a valid wrap constant',
        'PSV6-TEXTBOX-WRAP-TYPE'
      );
    }

    this.checkLabelSuggestion(args, textboxCall.line, textboxCall.column);

    const textStyleParam = this.findParameter(args, 'text_style');
    if (textStyleParam && !this.isValidTextStyle(textStyleParam)) {
      this.helper.addError(
        textboxCall.line,
        textboxCall.column,
        'text_style must be a valid text style constant',
        'PSV6-TEXTBOX-STYLE-TYPE'
      );
    }
  }

  private hasUnbalancedQuotes(value: string): boolean {
    const trimmed = value.trim();
    if (/^"[^"]*"$/.test(trimmed) || /^'[^']*'$/.test(trimmed)) {
      return false;
    }

    const doubleQuotes = (trimmed.match(/"/g) ?? []).length - (trimmed.match(/\\"/g) ?? []).length;
    const singleQuotes = (trimmed.match(/'/g) ?? []).length - (trimmed.match(/\\'/g) ?? []).length;

    return doubleQuotes % 2 !== 0 || singleQuotes % 2 !== 0;
  }

  private hasDanglingQuote(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }

    if (/^"[^"\\]*(?:\\.[^"\\]*)*"$/.test(trimmed) || /^'[^'\\]*(?:\\.[^'\\]*)*'$/.test(trimmed)) {
      return false;
    }

    const endsWithQuote = trimmed.endsWith('"') || trimmed.endsWith("'");
    const startsWithQuote = trimmed.startsWith('"') || trimmed.startsWith("'");
    if (endsWithQuote !== startsWithQuote) {
      return true;
    }

    const unescapedDouble = trimmed.replace(/\\"/g, '').split('"').length - 1;
    if (unescapedDouble === 1) {
      return true;
    }

    const unescapedSingle = trimmed.replace(/\\'/g, '').split("'").length - 1;
    if (unescapedSingle === 1) {
      return true;
    }

    return false;
  }

  // Helper methods
  private findParameter(args: string[], paramName: string): string | undefined {
    for (const rawArg of args) {
      const arg = rawArg.trim();
      const equalsIndex = arg.indexOf('=');
      if (equalsIndex === -1) {
        continue;
      }
      const name = arg.slice(0, equalsIndex).trim();
      if (name !== paramName) {
        continue;
      }
      return arg.slice(equalsIndex + 1).trim();
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

  private argumentToString(argument: ArgumentNode): string {
    const valueText = getNodeSource(this.context, argument.value).trim();
    if (argument.name) {
      return `${argument.name.name}=${valueText}`;
    }
    return valueText;
  }

  private getExpressionQualifiedName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }
    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (member.computed) {
        return null;
      }
      const objectName = this.getExpressionQualifiedName(member.object);
      if (!objectName) {
        return null;
      }
      return `${objectName}.${member.property.name}`;
    }
    return null;
  }

  private isDrawingObjectCall(name: string): boolean {
    return name === 'label.new' || name === 'table.new' || name === 'line.new' || name === 'linefill.new';
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

  /**
   * Detects common malformed syntax patterns in cleanLines.
   * This is a fallback for when AST parsing fails or is unavailable.
   */
  private detectMalformedSyntax(): void {
    const lines = this.context.cleanLines || this.context.lines;
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('//')) {
        return;
      }
      
      // Check for textbox-related lines
      if (!trimmed.includes('box.new') && !trimmed.includes('text=')) {
        return;
      }
      
      // Pattern 1: Trailing comma before closing parenthesis
      // Example: box.new(left=0, top=1, right=1, bottom=0, text="test",)
      if (/box\.new\([^)]*,\s*\)/.test(trimmed)) {
        this.helper.addError(
          lineNum,
          1,
          'Malformed syntax: trailing comma before closing parenthesis',
          'PSV6-SYNTAX-ERROR',
        );
      }
      
      // Pattern 2: Named parameter with missing value
      // Example: box.new(left=0, top=1, right=1, bottom=0, text=)
      // But NOT: color.new(color.blue, \n 0) - this is valid line continuation
      if (/\w+\s*=\s*[,)]/.test(trimmed) && !trimmed.endsWith(',')) {
        this.helper.addError(
          lineNum,
          1,
          'Malformed syntax: named parameter missing value',
          'PSV6-SYNTAX-ERROR',
        );
      }
      
      // Pattern 3: Unclosed string in text parameter
      // Example: box.new(left=0, top=1, right=1, bottom=0, text=unclosed_string")
      if (/text=\s*[^"]*"[^"]*$/.test(trimmed)) {
        this.helper.addError(
          lineNum,
          1,
          'Malformed text parameter: unclosed string',
          'PSV6-TEXTBOX-MALFORMED-TEXT',
        );
      }
    });
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    return ensureAstContext(this.context, config);
  }
}
