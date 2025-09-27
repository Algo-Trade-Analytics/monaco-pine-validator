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
import {
  TEXTBOX_LIMITS,
  TEXT_ALIGNMENT_CONSTANTS,
  TEXT_SIZE_CONSTANTS,
  TEXT_FONT_CONSTANTS,
  TEXT_WRAP_CONSTANTS,
  TEXT_STYLE_CONSTANTS,
  BOX_TEXT_FUNCTIONS
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

    if ((!this.context.lines || this.context.lines.length === 0) && this.context.cleanLines && this.context.cleanLines.length > 0) {
      this.context.lines = [...this.context.cleanLines];
    }
    if ((!this.context.rawLines || this.context.rawLines.length === 0) && this.context.cleanLines && this.context.cleanLines.length > 0) {
      this.context.rawLines = [...this.context.cleanLines];
    }

    this.astContext = this.getAstContext(config);

    if (this.astContext?.ast) {
      this.collectTextboxDataAst(this.astContext.ast);
    } else {
      this.collectTextboxDataFromText();
    }

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

    this.context.typeMap = typeMap;

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
        enter: () => loopStack.push('for'),
        exit: () => {
          loopStack.pop();
        },
      },
      WhileStatement: {
        enter: () => loopStack.push('while'),
        exit: () => {
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

  private collectTextboxDataFromText(): void {
    const lines = (this.context.cleanLines && this.context.cleanLines.length > 0)
      ? this.context.cleanLines
      : (this.context.lines && this.context.lines.length > 0)
        ? this.context.lines
        : this.context.rawLines ?? [];

    if (lines.length === 0) {
      return;
    }

    type Frame = { indent: number; type: 'loop' | 'conditional'; hasExpensive?: boolean };
    const stack: Frame[] = [];
    const loopRegex = /^\s*(for|while)\b/;
    const conditionalRegex = /^\s*if\b/;
    const drawingRegex = /\b(?:label|linefill|line|polyline|table)\./;
    const callRegex = /(box\.(?:new|set_text|set_text_color|set_text_size|set_text_halign|set_text_valign|set_text_wrap|set_text_style))\s*\(/g;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const rawLine = lines[lineIndex];
      const indent = rawLine.length - rawLine.replace(/^\s+/, '').length;
      const trimmed = rawLine.trim();

      if (process.env.DEBUG_ENH_TEXTBOX === '1') {
        console.log('[EnhancedTextboxValidator] line', lineIndex + 1, trimmed);
      }

      while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }

      if (loopRegex.test(trimmed)) {
        stack.push({ indent, type: 'loop' });
      } else if (conditionalRegex.test(trimmed)) {
        stack.push({ indent, type: 'conditional', hasExpensive: this.lineHasExpensiveCalculation(trimmed) });
      }

      if (drawingRegex.test(trimmed)) {
        this.hasDrawingObjects = true;
      }

      callRegex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = callRegex.exec(trimmed)) !== null) {
        const qualifiedName = match[1];
        const openParenGlobalIndex = rawLine.indexOf('(', match.index >= 0 ? match.index : 0);
        const argsSection = this.extractArgumentsSection(lines, lineIndex, openParenGlobalIndex + 1);
        const args = this.splitArguments(argsSection);

        const inLoop = stack.some(frame => frame.type === 'loop');
        const conditionalFrame = [...stack].reverse().find(frame => frame.type === 'conditional');
        const hasExpensiveCondition = Boolean(conditionalFrame?.hasExpensive);

        if (qualifiedName === 'box.new') {
          const textParam = this.findParameter(args, 'text');
          const hasTextParameters = textParam !== undefined || this.hasTextRelatedParameters(args);

       const textboxCall: TextboxCall = {
          functionName: 'box.new',
          line: lineIndex + 1,
          column: openParenGlobalIndex >= 0 ? openParenGlobalIndex + 1 : 1,
          arguments: args,
          textContent: textParam,
          hasTextParameters,
        };

        if (process.env.DEBUG_ENH_TEXTBOX === '1') {
          console.log('[EnhancedTextboxValidator] parsed call', textboxCall);
        }

        this.textboxCalls.push(textboxCall);

        if (hasTextParameters) {
          this.textboxCount++;
          this.validateBoxNewWithText(textboxCall);
        }

        if (inLoop && hasTextParameters) {
          this.warnTextboxInLoop(textboxCall.line, textboxCall.column);
        }

          continue;
        }

        if (!BOX_TEXT_FUNCTIONS.has(qualifiedName)) {
          continue;
        }

        const textboxCall: TextboxCall = {
          functionName: qualifiedName,
          line: lineIndex + 1,
          column: openParenGlobalIndex >= 0 ? openParenGlobalIndex + 1 : 1,
          arguments: args,
          hasTextParameters: true,
        };

        if (process.env.DEBUG_ENH_TEXTBOX === '1') {
          console.log('[EnhancedTextboxValidator] parsed call', textboxCall);
        }

        this.textboxCalls.push(textboxCall);
        this.validateBoxTextFunction(textboxCall);

        if (inLoop) {
          this.warnTextboxInLoop(textboxCall.line, textboxCall.column);
        }
      }
    }
  }

  private extractArgumentsSection(lines: string[], startLine: number, startColumn: number): string {
    let buffer = '';
    let depth = 1;
    let lineIndex = startLine;
    let columnIndex = startColumn;
    let inString = false;
    let stringDelimiter: string | null = null;

    while (lineIndex < lines.length && depth > 0) {
      const line = lines[lineIndex];
      for (let i = columnIndex; i < line.length; i++) {
        const char = line[i];

        if (inString) {
          buffer += char;
          if (char === stringDelimiter && line[i - 1] !== '\\') {
            inString = false;
            stringDelimiter = null;
          }
          continue;
        }

        if (char === '"' || char === "'") {
          inString = true;
          stringDelimiter = char;
          buffer += char;
          continue;
        }

        if (char === '(') {
          depth += 1;
          buffer += char;
          continue;
        }
        if (char === ')') {
          depth -= 1;
          if (depth === 0) {
            return buffer.trim();
          }
          buffer += char;
          continue;
        }

        buffer += char;
      }

      buffer += ' ';
      lineIndex += 1;
      columnIndex = 0;
    }

    return buffer.trim();
  }

  private splitArguments(text: string): string[] {
    const args: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar: string | null = null;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (inString) {
        current += char;
        if (char === stringChar && text[i - 1] !== '\\') {
          inString = false;
          stringChar = null;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        current += char;
        continue;
      }

      if (char === '(') {
        depth += 1;
        current += char;
        continue;
      }
      if (char === ')') {
        depth -= 1;
        current += char;
        continue;
      }
      if (char === ',' && depth === 0) {
        if (current.trim().length > 0) {
          args.push(current.trim());
        }
        current = '';
        continue;
      }
      current += char;
    }

    if (current.trim().length > 0) {
      args.push(current.trim());
    }

    return args;
  }

  private validateBoxNewWithText(textboxCall: TextboxCall): void {
    const args = textboxCall.arguments;
    
    // Validate text parameter type
    const textParam = this.findParameter(args, 'text');
    if (textParam) {
      const looksString = this.isStringExpression(textParam);
      if (!looksString) {
        this.addError(
          textboxCall.line,
          textboxCall.column,
          'text parameter must be a string expression',
          'PSV6-TEXTBOX-TEXT-TYPE'
        );
        if (this.hasDanglingQuote(textParam) || this.hasUnbalancedQuotes(textParam)) {
          this.addError(
            textboxCall.line,
            textboxCall.column,
            'Malformed text parameter: unbalanced quotes',
            'PSV6-TEXTBOX-MALFORMED-TEXT'
          );
        }
      } else if (this.hasDanglingQuote(textParam) || this.hasUnbalancedQuotes(textParam)) {
        this.addError(
          textboxCall.line,
          textboxCall.column,
          'Malformed text parameter: unbalanced quotes',
          'PSV6-TEXTBOX-MALFORMED-TEXT'
        );
      } else {
        this.analyzeTextContent(textParam, textboxCall.line, textboxCall.column);
      }
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

  private hasDanglingQuote(value: string): boolean {
    const trimmed = value.trim();
    // Quick exits for clean literals and identifiers
    if (trimmed.length === 0) return false;
    if (/^"[^"\\]*(?:\\.[^"\\]*)*"$/.test(trimmed) || /^'[^'\\]*(?:\\.[^'\\]*)*'$/.test(trimmed)) {
      return false;
    }

    const unescapedDouble = trimmed.replace(/\\"/g, '').split('"').length - 1;
    const unescapedSingle = trimmed.replace(/\\'/g, '').split("'").length - 1;

    // Lone quote or trailing/leading quote without its pair
    if (unescapedDouble === 1 || unescapedSingle === 1) {
      return true;
    }

    const endsWithQuote = trimmed.endsWith('"') || trimmed.endsWith("'");
    const startsWithQuote = trimmed.startsWith('"') || trimmed.startsWith("'");
    if (endsWithQuote !== startsWithQuote) {
      return true;
    }

    // Mixed usage like foo"bar or "bar)" should still flag
    if (/^[^"']+["']$/.test(trimmed) || /^["'][^"']+[)\]\}]?$/.test(trimmed)) {
      return true;
    }

    return false;
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
      if (this.hasDanglingQuote(args[1]) || this.hasUnbalancedQuotes(args[1])) {
        this.addError(lineNum, column, 'Malformed text parameter: unbalanced quotes', 'PSV6-TEXTBOX-MALFORMED-TEXT');
      }
      return;
    }

    if (this.hasDanglingQuote(args[1]) || this.hasUnbalancedQuotes(args[1])) {
      this.addError(lineNum, column, 'Malformed text parameter: unbalanced quotes', 'PSV6-TEXTBOX-MALFORMED-TEXT');
      return;
    }

    this.analyzeTextContent(args[1], lineNum, column);
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

  private warnTextboxInLoop(line: number, column: number): void {
    const key = `${line}:${column}`;
    if (this.astLoopWarnings.has(key)) {
      return;
    }
    this.astLoopWarnings.add(key);
    this.addWarning(
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
    const valueText = this.getNodeSource(argument.value).trim();
    if (argument.name) {
      return `${argument.name.name}=${valueText}`;
    }
    return valueText;
  }

  private getNodeSource(node: ExpressionNode | ArgumentNode | CallExpressionNode): string {
    const lines = this.context.lines ?? [];
    if (!node.loc) {
      return '';
    }
    const startLineIndex = Math.max(0, node.loc.start.line - 1);
    const endLineIndex = Math.max(0, node.loc.end.line - 1);
    if (startLineIndex === endLineIndex) {
      const line = lines[startLineIndex] ?? '';
      return line.slice(node.loc.start.column - 1, Math.max(node.loc.start.column - 1, node.loc.end.column - 1));
    }
    const parts: string[] = [];
    const firstLine = lines[startLineIndex] ?? '';
    parts.push(firstLine.slice(node.loc.start.column - 1));
    for (let index = startLineIndex + 1; index < endLineIndex; index++) {
      parts.push(lines[index] ?? '');
    }
    const lastLine = lines[endLineIndex] ?? '';
    parts.push(lastLine.slice(0, Math.max(0, node.loc.end.column - 1)));
    return parts.join('\n');
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

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    return ensureAstContext(this.context, config);
  }
}
