/**
 * AST-Based Indentation Validator for Pine Script
 * 
 * This validator implements the complete Pine Script indentation rules:
 * 1. Block indentation: multiples of 4 spaces or tabs
 * 2. Line wrapping: any non-multiple-of-4 indentation
 * 3. Proper validation in all contexts (global, functions, conditionals, loops)
 * 
 * References:
 * - https://www.tradingview.com/pine-script-docs/concepts/script-structure/
 * - https://www.tradingview.com/pine-script-docs/concepts/style-guide/
 */

import type { ValidationError } from '../types';
import type {
  Node,
  ProgramNode,
  FunctionDeclarationNode,
  IfStatementNode,
  IfExpressionNode,
  ForStatementNode,
  WhileStatementNode,
  SwitchStatementNode,
  BlockStatementNode,
  ExpressionStatementNode,
  VariableDeclarationNode,
  AssignmentStatementNode,
  TypeDeclarationNode,
  EnumDeclarationNode
} from './nodes';

const CONTINUATION_SYMBOL_HINTS = ['(', '[', '{', '+', '-', '*', '/', '%', '?', ':', '<', '>', '&', '|', '^', '.', '='];
const CONTINUATION_MULTI_CHAR_HINTS = ['<=', '>=', '==', '!=', ':=', '->', '=>', '+=', '-=', '*=', '/=', '%=', '&&', '||', '??'];
const CONTINUATION_WORD_HINTS = ['and', 'or', 'xor', 'in', 'not'];

function hasContinuationHint(text: string): boolean {
  const trimmed = text.trimEnd();
  if (trimmed.trim() === '') {
    return false;
  }

  const lowerTrimmed = trimmed.toLowerCase();

  for (const hint of CONTINUATION_MULTI_CHAR_HINTS) {
    if (lowerTrimmed.endsWith(hint)) {
      return true;
    }
  }

  const wordMatch = lowerTrimmed.match(/([a-z_][a-z0-9_]*)$/i);
  if (wordMatch) {
    const token = wordMatch[1].toLowerCase();
    if (CONTINUATION_WORD_HINTS.includes(token)) {
      return true;
    }
  }

  const lastChar = trimmed.charAt(trimmed.length - 1);
  if (CONTINUATION_SYMBOL_HINTS.includes(lastChar)) {
    return true;
  }

  return false;
}

interface IndentationContext {
  blockIndent: number;           // Current block indentation level (0, 4, 8, 12, ...)
  expectedBlockIndent: number;   // Expected indent for next block
  inBlock: boolean;              // Are we inside a block?
  blockType: 'function' | 'if' | 'else' | 'for' | 'while' | 'switch' | null;
  parentContext: IndentationContext | null;
}

/**
 * Validates indentation rules for Pine Script code using AST
 */
export class ASTIndentationValidator {
  private errors: ValidationError[] = [];
  private sourceLines: string[];
  private context: IndentationContext;
  private seenTabs = false;
  private seenSpaces = false;
  private firstTabLine = 0;
  private firstSpaceLine = 0;

  constructor(private source: string, private ast: ProgramNode | null) {
    this.sourceLines = source.split('\n');
    this.context = {
      blockIndent: 0,
      expectedBlockIndent: 0,
      inBlock: false,
      blockType: null,
      parentContext: null
    };
  }

  /**
   * Main validation entry point
   */
  validate(): ValidationError[] {
    if (!this.ast) {
      // If AST parsing failed, skip indentation validation
      return [];
    }

    // First pass: Check for mixed tabs and spaces across all lines
    const hasMixedIndent = this.checkMixedIndentation();
    
    // If mixed indentation detected, don't validate further
    // (other indentation errors would be noise)
    if (hasMixedIndent) {
      return this.errors;
    }

    this.checkClosingDelimiterIndentation();
    // Validate the program node (contains all top-level statements)
    if (this.ast.kind === 'Program' && this.ast.body) {
      for (const stmt of this.ast.body) {
        this.validateNode(stmt);
      }
    }

    return this.errors;
  }

  /**
   * Check for mixed tabs and spaces across the entire script
   * Returns true if mixed indentation was detected
   * 
   * NOTE: TradingView appears to be lenient about mixing tabs and spaces
   * across different scopes (e.g., spaces in global, tabs in functions).
   * We only check for mixing within the same line, which is definitely invalid.
   */
  private checkMixedIndentation(): boolean {
    // Check for tabs and spaces mixed on the SAME line (definitely invalid)
    for (let i = 0; i < this.sourceLines.length; i++) {
      const line = this.sourceLines[i];
      if (!line || line.trim() === '' || line.trim().startsWith('//')) {
        continue;
      }

      // Check if the same line has both tabs and spaces in its leading whitespace
      const leadingWhitespace = line.match(/^[\t ]+/)?.[0] || '';
      const hasBothTabsAndSpaces = leadingWhitespace.includes('\t') && leadingWhitespace.includes(' ');

      if (hasBothTabsAndSpaces) {
        this.addError(
          i + 1,
          1,
          `Mixed tabs and spaces in indentation on the same line`,
          'PSI02'
        );
        return true; // Mixed indentation detected
      }
    }
    
    return false; // No mixed indentation
  }

  private checkClosingDelimiterIndentation(): void {
    for (let i = 0; i < this.sourceLines.length; i++) {
      const rawLine = this.sourceLines[i];
      if (!rawLine) {
        continue;
      }

      const trimmed = rawLine.trim();
      if (trimmed !== ')' && trimmed !== ']') {
        continue;
      }

      const indent = this.getIndentWidth(rawLine);
      if (indent % 4 !== 0) {
        continue;
      }

      this.addError(
        i + 1,
        indent + 1,
        `Closing ${trimmed} at column ${indent} (multiple of 4) will fail in TradingView. Use non-multiple-of-4 indentation for line continuations.`,
        'PSV6-SYNTAX-CLOSING-PAREN',
      );
    }
  }

  private getIndentWidth(line: string): number {
    const leadingWhitespace = line.match(/^[\t ]*/)?.[0] ?? '';
    return leadingWhitespace.replace(/\t/g, '    ').length;
  }

  /**
   * Validate a single AST node and its children
   */
  private validateNode(node: Node): void {
    if (!node) return;

    // Different validation logic based on node kind
    switch (node.kind) {
      case 'FunctionDeclaration':
        this.validateFunctionDeclaration(node as FunctionDeclarationNode);
        break;
      
      case 'TypeDeclaration':
        this.validateTypeDeclaration(node as TypeDeclarationNode);
        break;
      
      case 'EnumDeclaration':
        this.validateEnumDeclaration(node as EnumDeclarationNode);
        break;
      
      case 'IfStatement':
        this.validateIfStatement(node as IfStatementNode);
        break;
      
      case 'IfExpression':
        this.validateIfExpression(node as IfExpressionNode);
        break;
      
      case 'ForStatement':
        this.validateForStatement(node as ForStatementNode);
        break;
      
      case 'WhileStatement':
        this.validateWhileStatement(node as WhileStatementNode);
        break;
      
      case 'SwitchStatement':
        this.validateSwitchStatement(node as SwitchStatementNode);
        break;
      
      case 'VariableDeclaration':
      case 'AssignmentStatement':
      case 'ExpressionStatement':
        this.validateStatement(node);
        break;
      
      default:
        // For other nodes, just validate children
        this.validateChildren(node);
    }
  }

  /**
   * Validate function declaration indentation
   * Rules:
   * - Function header at global scope: column 0
   * - Function body: header indent + 4
   * - Check for invalid line wrapping after =>
   */
  private validateFunctionDeclaration(node: FunctionDeclarationNode): void {
    const headerLine = node.loc.start.line - 1; // 0-indexed
    const headerIndent = this.getLineIndent(headerLine);

    // Special case: Methods defined inside UDT type declarations are indented at 4 spaces
    // but the parser treats them as separate top-level functions
    // Skip validation for functions at indent 4 when context expects 0 (likely UDT methods)
    const isLikelyUdtMethod = this.context.blockIndent === 0 && headerIndent === 4;
    
    // Function header should be at current block level
    if (!isLikelyUdtMethod && headerIndent !== this.context.blockIndent) {
      this.addError(
        node.loc.start.line,
        headerIndent + 1,
        `Function declaration should be at indent ${this.context.blockIndent}, got ${headerIndent}`,
        'PSV6-INDENT-INCONSISTENT'
      );
    }

    // Check for invalid line wrapping after function declaration
    // This returns true if the function is in wrap format (and validation is complete)
    const isWrapFormat = this.validateFunctionLineWrapping(node);

    // Push new context for function body
    const bodyContext: IndentationContext = {
      blockIndent: headerIndent + 4,
      expectedBlockIndent: headerIndent + 4,
      inBlock: true,
      blockType: 'function',
      parentContext: this.context
    };

    const prevContext = this.context;
    this.context = bodyContext;

    // Validate function body
    // Skip if wrap format (already validated) or arrow function (single line)
    if (node.body && !isWrapFormat) {
      // For arrow functions, the body can be on the same line as the header
      // In that case, don't validate indentation (it's part of the function declaration line)
      const bodyStartLine = node.body.loc.start.line;
      const isArrowFunction = bodyStartLine === node.loc.start.line;
      
      if (!isArrowFunction) {
        // Regular function with body on separate lines - validate normally
        this.validateBlock(node.body, headerIndent + 4);
      }
      // else: Arrow function body is on the same line - skip indentation validation
    }

    // Pop context
    this.context = prevContext;
  }

  /**
   * Validate type declaration indentation
   * Rules:
   * - Type header at global scope: column 0
   * - Type fields and methods: header indent + 4
   */
  private validateTypeDeclaration(node: TypeDeclarationNode): void {
    const headerLine = node.loc.start.line - 1;
    const headerIndent = this.getLineIndent(headerLine);

    // Type header should be at current block level
    if (headerIndent !== this.context.blockIndent) {
      this.addError(
        node.loc.start.line,
        headerIndent + 1,
        `Type declaration should be at indent ${this.context.blockIndent}, got ${headerIndent}`,
        'PSV6-INDENT-INCONSISTENT'
      );
    }

    // Push new context for type body (fields and methods)
    const prevContext = this.context;
    this.context = {
      blockIndent: headerIndent + 4,
      expectedBlockIndent: headerIndent + 4,
      inBlock: true,
      blockType: null,
      parentContext: prevContext
    };

    // Validate fields and methods
    if (node.fields) {
      for (const field of node.fields) {
        // Fields can be TypeField or FunctionDeclaration (methods)
        if ((field as Node).kind === 'FunctionDeclaration') {
          // Method inside type - validate with current context
          this.validateNode(field as Node);
        }
        // TypeField nodes don't need indentation validation (handled by parser)
      }
    }

    // Pop context
    this.context = prevContext;
  }

  /**
   * Validate enum declaration indentation
   * Rules:
   * - Enum header at global scope: column 0
   * - Enum members: header indent + 4
   */
  private validateEnumDeclaration(node: EnumDeclarationNode): void {
    const headerLine = node.loc.start.line - 1;
    const headerIndent = this.getLineIndent(headerLine);

    // Enum header should be at current block level
    if (headerIndent !== this.context.blockIndent) {
      this.addError(
        node.loc.start.line,
        headerIndent + 1,
        `Enum declaration should be at indent ${this.context.blockIndent}, got ${headerIndent}`,
        'PSV6-INDENT-INCONSISTENT'
      );
    }

    // Enum members are typically on the same lines as values, no further validation needed
    // The parser handles the structure
  }

  /**
   * Validate a block statement (function body, if body, loop body, etc.)
   */
  private validateBlock(block: BlockStatementNode | Node, expectedIndent: number): void {
    if (!block) return;

    // Handle different block types
    if (block.kind === 'BlockStatement') {
      const blockNode = block as BlockStatementNode;
      if (blockNode.body) {
        for (const stmt of blockNode.body) {
          this.validateBlockStatement(stmt, expectedIndent);
        }
      }
    } else {
      // Single statement (no explicit block)
      this.validateBlockStatement(block, expectedIndent);
    }
  }

  /**
   * Validate a statement within a block
   */
  private validateBlockStatement(stmt: Node, expectedIndent: number): void {
    const stmtStartLine = stmt.loc.start.line - 1;
    const stmtEndLine = stmt.loc.end.line - 1;
    const stmtIndent = this.getLineIndent(stmtStartLine);
    const parentBlockIndent = this.context.parentContext
      ? this.context.parentContext.blockIndent
      : null;

    // Skip validation for ExpressionStatements containing comma operator sequences (TupleExpression)
    // These are synthesized by the parser for comma operators (e.g., "a := 1, b := 2")
    // and may have incorrect location info that confuses the indentation validator
    if (stmt.kind === 'ExpressionStatement') {
      const exprStmt = stmt as any;
      if (exprStmt.expression && exprStmt.expression.kind === 'TupleExpression') {
        // Skip indentation validation for comma operator sequences
        // The individual expressions have already been parsed and validated
        return;
      }
    }

    // Check if this is a block-type statement (has its own body)
    const isBlockStatement = stmt.kind === 'IfStatement' || stmt.kind === 'ForStatement' || 
                           stmt.kind === 'WhileStatement' || stmt.kind === 'FunctionDeclaration' ||
                           stmt.kind === 'SwitchStatement';

    // For block statements, their body spans multiple lines but those aren't "continuation lines"
    // They're statements inside the block that will be validated separately
    if (stmtEndLine > stmtStartLine && !isBlockStatement) {
      // This is a truly multi-line statement (not a block statement)
      // First line: must be at expected block indent
      if (stmtIndent % 4 === 0) {
        // This looks like a block-level statement
        if (stmtIndent !== expectedIndent) {
          this.addError(
            stmt.loc.start.line,
            stmtIndent + 1,
            `Statement should be indented with ${expectedIndent} spaces (block level), got ${stmtIndent}`,
            'PSV6-INDENT-BLOCK-MISMATCH'
          );
        }
      }

      // Check if this is a single expression with consistent indentation vs a wrapped statement
      let hasConsistentIndent = true;
      let firstNonEmptyIndent = stmtIndent;
      
      // Check if all non-empty lines have the same indentation
      for (let lineIdx = stmtStartLine + 1; lineIdx <= stmtEndLine; lineIdx++) {
        const line = this.sourceLines[lineIdx];
        if (!line || line.trim() === '' || line.trim().startsWith('//')) {
          continue;
        }
        
        const lineIndent = this.getLineIndent(lineIdx);
        if (lineIndent !== firstNonEmptyIndent) {
          hasConsistentIndent = false;
          break;
        }
      }
      
      if (hasConsistentIndent) {
        // This is a single expression with consistent indentation
        // For function bodies, be more permissive - allow any consistent indentation > header
        // This matches TradingView's more lenient behavior
        if (stmtIndent < this.context.blockIndent) {
          this.addError(
            stmt.loc.start.line,
            stmtIndent + 1,
            `Statement should be indented at least ${this.context.blockIndent} spaces (got ${stmtIndent})`,
            'PSV6-INDENT-BLOCK-MISMATCH'
          );
        }
        if (
          (
            stmt.kind === 'AssignmentStatement' ||
            stmt.kind === 'VariableDeclaration' ||
            stmt.kind === 'ExpressionStatement'
          ) &&
          stmtEndLine > stmtStartLine
        ) {
          for (let lineIdx = stmtStartLine + 1; lineIdx <= stmtEndLine; lineIdx++) {
            const line = this.sourceLines[lineIdx];
            if (!line || line.trim() === '' || line.trim().startsWith('//')) {
              continue;
            }
            const lineIndent = this.getLineIndent(lineIdx);
            this.validateWrapIndentation(lineIdx + 1, lineIndent, stmtIndent);
          }
        }
        // Note: We allow any indentation > header indent to match TradingView's leniency
      } else {
        // This is a wrapped statement - validate continuation lines as wraps
        for (let lineIdx = stmtStartLine + 1; lineIdx <= stmtEndLine; lineIdx++) {
          const line = this.sourceLines[lineIdx];
          if (!line || line.trim() === '' || line.trim().startsWith('//')) {
            continue; // Skip empty lines and comments
          }

          const lineIndent = this.getLineIndent(lineIdx);
          this.validateWrapIndentation(lineIdx + 1, lineIndent, stmtIndent);
        }
      }
    } else {
      // Allow both block statements and regular statements at parent block indent + 4 in control flow contexts
      const allowSiblingAtParentIndent =
        this.isControlFlowBlockContext() &&
        parentBlockIndent !== null &&
        parentBlockIndent >= 0 &&
        stmtIndent === parentBlockIndent + 4;

      if (!allowSiblingAtParentIndent && stmtIndent !== expectedIndent) {
        this.addError(
          stmt.loc.start.line,
          stmtIndent + 1,
          `Statement should be indented with ${expectedIndent} spaces (block level), got ${stmtIndent}`,
          'PSV6-INDENT-BLOCK-MISMATCH'
        );
      }
    }

    // Recursively validate block statements (they have their own validation logic)
    if (isBlockStatement) {
      this.validateNode(stmt);
    }
    // Don't recurse for simple statements - their indentation is already validated
  }

  private isControlFlowBlockContext(): boolean {
    const blockType = this.context.blockType;
    return blockType === 'if' ||
      blockType === 'else' ||
      blockType === 'for' ||
      blockType === 'while' ||
      blockType === 'switch';
  }

  /**
   * Validate a general statement (variable declaration, assignment, expression)
   * This is called for statements at the top level, not for statements inside blocks
   * (those go through validateBlockStatement instead)
   */
  private validateStatement(stmt: Node): void {
    // Special handling for assignment with switch expression
    // result = switch ...
    if (stmt.kind === 'AssignmentStatement') {
      const assignStmt = stmt as AssignmentStatementNode;
      if (assignStmt.right && assignStmt.right.kind === 'SwitchStatement') {
        // This is a switch expression - validate the switch, not as wrapped lines
        this.validateSwitchStatement(assignStmt.right as SwitchStatementNode);
        return;
      }
      if (assignStmt.right && assignStmt.right.kind === 'IfExpression') {
        // This is an if expression - validate the if expression, not as wrapped lines
        this.validateIfExpression(assignStmt.right as IfExpressionNode);
        return;
      }
    }

    const stmtStartLine = stmt.loc.start.line - 1;
    const stmtEndLine = stmt.loc.end.line - 1;
    const stmtIndent = this.getLineIndent(stmtStartLine);

    // Check if this is a multi-line statement
    if (stmtEndLine > stmtStartLine) {
      // Validate continuation lines
      for (let lineIdx = stmtStartLine + 1; lineIdx <= stmtEndLine; lineIdx++) {
        const line = this.sourceLines[lineIdx];
        if (!line || line.trim() === '' || line.trim().startsWith('//')) {
          continue;
        }

        const lineIndent = this.getLineIndent(lineIdx);
        this.validateWrapIndentation(lineIdx + 1, lineIndent, this.context.blockIndent);
      }
    }

    // Recursively validate children (but NOT for simple expression statements - already validated above)
    this.validateChildren(stmt);
  }

  /**
   * Validate if statement indentation
   */
  private validateIfStatement(node: IfStatementNode): void {
    const headerLine = node.loc.start.line - 1;
    const headerIndent = this.getLineIndent(headerLine);

    // If header should be at current block level
    if (headerIndent !== this.context.blockIndent) {
      this.addError(
        node.loc.start.line,
        headerIndent + 1,
        `If statement should be at indent ${this.context.blockIndent}, got ${headerIndent}`,
        'PSV6-INDENT-BLOCK-MISMATCH'
      );
    }

    // Validate consequent (then branch)
    if (node.consequent) {
      const prevContext = this.context;
      this.context = {
        blockIndent: headerIndent + 4,
        expectedBlockIndent: headerIndent + 4,
        inBlock: true,
        blockType: 'if',
        parentContext: prevContext
      };

      this.validateBlock(node.consequent, headerIndent + 4);
      this.context = prevContext;
    }

    // Validate alternate (else/else-if branch)
    if (node.alternate) {
      // If alternate is another IfStatement (else-if), it should be at the same level as the original if
      // If alternate is a block/statement (else), its body should be indented
      if (node.alternate.kind === 'IfStatement') {
        // else-if: validate at the same block level as the original if
        this.validateNode(node.alternate);
      } else {
        // else: validate the body with indentation
        const prevContext = this.context;
        this.context = {
          blockIndent: headerIndent + 4,
          expectedBlockIndent: headerIndent + 4,
          inBlock: true,
          blockType: 'else',
          parentContext: prevContext
        };

        this.validateBlock(node.alternate, headerIndent + 4);
        this.context = prevContext;
      }
    }
  }

  /**
   * Validate if expression indentation (e.g., "value = if condition ... else ...")
   * If expressions follow different rules than if statements - they don't use block indentation
   */
  private validateIfExpression(node: IfExpressionNode): void {
    // If expressions don't use block indentation rules
    // They are part of expressions and should be validated as such
    // Just validate the children without changing the indentation context
    
    // Validate test condition
    this.validateNode(node.test);
    
    // Validate consequent (then branch)
    if (node.consequent) {
      this.validateNode(node.consequent);
    }
    
    // Validate alternate (else/else-if branch)
    if (node.alternate) {
      if (node.alternate.kind === 'IfExpression') {
        // else-if: validate recursively
        this.validateIfExpression(node.alternate);
      } else {
        // else: validate the block
        this.validateNode(node.alternate);
      }
    }
  }

  /**
   * Validate for loop indentation
   */
  private validateForStatement(node: ForStatementNode): void {
    const headerLine = node.loc.start.line - 1;
    const headerIndent = this.getLineIndent(headerLine);

    // For header should be at current block level
    if (headerIndent !== this.context.blockIndent) {
      this.addError(
        node.loc.start.line,
        headerIndent + 1,
        `For statement should be at indent ${this.context.blockIndent}, got ${headerIndent}`,
        'PSV6-INDENT-BLOCK-MISMATCH'
      );
    }

    // Validate loop body
    if (!node.body || (node.body.kind === 'BlockStatement' && (node.body.body?.length ?? 0) === 0)) {
      this.addError(
        node.loc.end.line,
        headerIndent + 1,
        'For loop requires an indented body.',
        'PSV6-SYNTAX-ERROR'
      );
      return;
    }

    const bodyStartIndex = (node.body?.loc.start.line ?? node.loc.end.line) - 1;
    this.validateHeaderContinuationLines(headerLine + 1, bodyStartIndex, headerIndent);

    const prevContext = this.context;
    this.context = {
      blockIndent: headerIndent + 4,
      expectedBlockIndent: headerIndent + 4,
      inBlock: true,
      blockType: 'for',
      parentContext: prevContext
    };

    this.validateBlock(node.body, headerIndent + 4);
    this.context = prevContext;
  }

  /**
   * Validate while loop indentation
   */
  private validateWhileStatement(node: WhileStatementNode): void {
    const headerLine = node.loc.start.line - 1;
    const headerIndent = this.getLineIndent(headerLine);

    // While header should be at current block level
    if (headerIndent !== this.context.blockIndent) {
      this.addError(
        node.loc.start.line,
        headerIndent + 1,
        `While statement should be at indent ${this.context.blockIndent}, got ${headerIndent}`,
        'PSV6-INDENT-BLOCK-MISMATCH'
      );
    }

    // Validate loop body
    if (!node.body || (node.body.kind === 'BlockStatement' && (node.body.body?.length ?? 0) === 0)) {
      this.addError(
        node.loc.end.line,
        headerIndent + 1,
        'While loop requires an indented body.',
        'PSV6-SYNTAX-ERROR'
      );
      return;
    }

    const bodyStartIndex = (node.body?.loc.start.line ?? node.loc.end.line) - 1;
    this.validateHeaderContinuationLines(headerLine + 1, bodyStartIndex, headerIndent);

    const prevContext = this.context;
    this.context = {
      blockIndent: headerIndent + 4,
      expectedBlockIndent: headerIndent + 4,
      inBlock: true,
      blockType: 'while',
      parentContext: prevContext
    };

    this.validateBlock(node.body, headerIndent + 4);
    this.context = prevContext;
  }

  /**
   * Validate switch statement indentation
   * 
   * Pine Script switch expressions:
   *   result = switch condition
   *       case1 => value1    // ← case at header + 4
   *       case2 => value2    // ← consequent on same line
   *       => defaultValue
   */
  private validateSwitchStatement(node: SwitchStatementNode): void {
    const headerLine = node.loc.start.line - 1;
    const headerIndent = this.getLineIndent(headerLine);

    // For switch expressions (result = switch ...), the switch keyword is on the same line as assignment
    // So we check if this line starts with "switch" to determine expected case indent
    const headerLineText = this.sourceLines[headerLine];
    const isSwitchExpression = headerLineText.trim().startsWith('switch') || headerLineText.includes('= switch');
    
    // Expected case indent: if standalone switch, cases at header + 4
    // If part of assignment (result = switch ...), cases at assignment line indent + 4
    let expectedCaseIndent = headerIndent + 4;
    
    // For assignment expressions, find the actual base indent
    if (isSwitchExpression && headerLineText.includes('=')) {
      // Assignment like: result = switch condition
      // Cases should be at result's indent + 4
      expectedCaseIndent = headerIndent + 4;
    }

    // Validate each case
    if (node.cases) {
      for (const caseNode of node.cases) {
        // Case should be at expected indent
        const caseLine = caseNode.loc.start.line - 1;
        const caseIndent = this.getLineIndent(caseLine);

        // Only validate if case is on a different line than switch header
        if (caseLine !== headerLine && caseIndent !== expectedCaseIndent) {
          this.addError(
            caseNode.loc.start.line,
            caseIndent + 1,
            `Switch case should be indented with ${expectedCaseIndent} spaces, got ${caseIndent}`,
            'PSV6-INDENT-BLOCK-MISMATCH'
          );
        }

        // For switch expressions (case => value), the consequent is on the same line
        // Don't validate consequent indentation separately - it's part of the case line
        // Just recursively validate the expressions themselves
        if (caseNode.consequent && Array.isArray(caseNode.consequent)) {
          for (const cons of caseNode.consequent) {
            // Only validate if consequent is actually a separate statement (block switch)
            if (cons.loc.start.line !== caseNode.loc.start.line) {
              const prevContext = this.context;
              this.context = {
                blockIndent: caseIndent + 4,
                expectedBlockIndent: caseIndent + 4,
                inBlock: true,
                blockType: 'switch',
                parentContext: prevContext
              };

              this.validateNode(cons);
              this.context = prevContext;
            }
          }
        }
      }
    }
  }

  /**
   * Validate line wrapping after function declaration
   * Pine Script function body rules:
   * 1. Single-line format: Use non-multiple-of-4 indentation (wrap), comma-separated statements
   * 2. Multi-line format: Use exactly +4 spaces for block, new statements at block level
   * 3. Cannot mix: Once you start with wrap indent, all lines must be wrap (or comma-separated)
   * 
   * @returns true if the function is in wrap format (single-line), false otherwise
   */
  private validateFunctionLineWrapping(node: FunctionDeclarationNode): boolean {
    const headerLineIndex = node.loc.start.line - 1; // 0-indexed
    const headerLine = this.sourceLines[headerLineIndex];
    const headerIndent = this.getLineIndent(headerLineIndex);
    
    // Only check if function header ends with =>
    if (!headerLine || !headerLine.trim().endsWith('=>')) {
      return false; // Not a wrap format check
    }

    // Calculate expected block indent early
    const expectedBlockIndent = headerIndent + 4;

    // Find all non-empty lines in the function body
    const bodyStartLine = headerLineIndex + 1;
    const bodyEndLine = node.body ? node.body.loc.end.line - 1 : headerLineIndex;
    
    // Check if function body is on same line as header (single-line function)
    const isSingleLineFunctionOnHeader = node.body && node.body.loc.start.line === node.loc.start.line && bodyStartLine > bodyEndLine;
    
    // If body is on the same line as header, check what comes next
    if (isSingleLineFunctionOnHeader) {
      // Check if there's suspicious code on the next line
      const nextLineIndex = headerLineIndex + 1;
      if (nextLineIndex < this.sourceLines.length) {
        const nextLine = this.sourceLines[nextLineIndex];
        const nextLineIndent = this.getLineIndent(nextLineIndex);
        
        // If next line is at column 0 and looks like code (not blank/comment), it's likely meant to be in the function
        if (nextLine && nextLine.trim() !== '' && !nextLine.trim().startsWith('//') && nextLineIndent === 0) {
          this.addError(
            nextLineIndex + 1,
            1,
            `Function body cannot start at column 0. Use ${expectedBlockIndent} spaces for block format, or ${expectedBlockIndent - 1} or fewer (non-multiple-of-4) for single-line format.`,
            'PSV6-INDENT-WRAP-INVALID'
          );
        }
      }
      return false; // Function parsed but no actual body to validate
    }

    if (bodyStartLine > bodyEndLine) {
      return false; // No body lines to validate
    }

    const bodyLines: Array<{ lineIndex: number; indent: number; text: string }> = [];
    
    for (let i = bodyStartLine; i <= bodyEndLine && i < this.sourceLines.length; i++) {
      const line = this.sourceLines[i];
      if (!line || line.trim() === '' || line.trim().startsWith('//')) {
        continue;
      }
      
      bodyLines.push({
        lineIndex: i,
        indent: this.getLineIndent(i),
        text: line.trim()
      });
    }

    if (bodyLines.length === 0) {
      return false; // No body lines to validate
    }

    const firstBodyLine = bodyLines[0];
    const firstBodyIndent = firstBodyLine.indent;

    // Determine function format based on first line
    const isBlockFormat = firstBodyIndent === expectedBlockIndent;
    const isWrapFormat = firstBodyIndent > 0 && firstBodyIndent % 4 !== 0;
    const isInvalidIndent = firstBodyIndent === 0 || (firstBodyIndent % 4 === 0 && firstBodyIndent !== expectedBlockIndent);

    // Special case: If there are no body lines but the next line after => looks like it should be in the function
    // This catches the case where column 0 causes parser to treat it as a global statement
    if (bodyLines.length === 0) {
      // Check if there's a line immediately after the function header
      const nextLineIndex = headerLineIndex + 1;
      if (nextLineIndex < this.sourceLines.length) {
        const nextLine = this.sourceLines[nextLineIndex];
        const nextLineIndent = this.getLineIndent(nextLineIndex);
        
        // If next line is at column 0 and looks like code (not blank/comment), warn about it
        if (nextLine && nextLine.trim() !== '' && !nextLine.trim().startsWith('//') && nextLineIndent === 0) {
          this.addError(
            nextLineIndex + 1,
            1,
            `Function body cannot start at column 0. Use ${expectedBlockIndent} spaces for block format, or ${expectedBlockIndent - 1} or fewer (non-multiple-of-4) for single-line format.`,
            'PSV6-INDENT-WRAP-INVALID'
          );
        }
      }
      return false;
    }

    // Invalid: First line at column 0 or wrong multiple of 4
    if (isInvalidIndent) {
      this.addError(
        firstBodyLine.lineIndex + 1,
        1,
        `Invalid function body indentation: use ${expectedBlockIndent} spaces for block format, or ${expectedBlockIndent - 1} or fewer (non-multiple-of-4) for single-line format.`,
        'PSV6-INDENT-WRAP-INVALID'
      );
      return false; // Invalid format, not wrap format
    }

    // Validate remaining lines based on detected format
    if (!isBlockFormat && isWrapFormat) {
      // Wrap format (single-line): All lines should be wrap indents (non-multiple-of-4)
      // Mixing block-level indents is invalid
      this.validateWrapFormatBody(bodyLines, headerLineIndex);
      return true; // This is wrap format, validation complete
    }
    
    // Block format - let validateBlock handle it
    return false;
  }

  /**
   * Validate block format function body
   * All statements must start at expectedBlockIndent (multiple of 4)
   */
  private validateBlockFormatBody(
    bodyLines: Array<{ lineIndex: number; indent: number; text: string }>,
    expectedBlockIndent: number,
    headerLineIndex: number
  ): void {
    for (const line of bodyLines) {
      // Check if this line starts a new statement (at block level) or is a continuation
      if (line.indent === expectedBlockIndent) {
        // New statement at correct block level - OK
        continue;
      } else if (line.indent > expectedBlockIndent && line.indent % 4 !== 0) {
        // Wrap continuation within the block - OK
        continue;
      } else {
        // Invalid: Wrong indentation
        this.addError(
          line.lineIndex + 1,
          1,
          `In block format, statements must start at ${expectedBlockIndent} spaces, wraps must use non-multiple-of-4 indentation.`,
          'PSV6-INDENT-BLOCK-MISMATCH'
        );
      }
    }
  }

  /**
   * Validate wrap format function body (single-line with wraps)
   * In wrap format, all lines must use non-multiple-of-4 indentation
   * They don't need to be indented MORE than each other - just stay in wrap format
   */
  private validateWrapFormatBody(
    bodyLines: Array<{ lineIndex: number; indent: number; text: string }>,
    headerLineIndex: number
  ): void {
    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i];
      
      // In wrap format, if a line is at a multiple-of-4 indent, it's trying to be a new statement
      // but that's invalid without proper block format
      if (line.indent % 4 === 0) {
        this.addError(
          line.lineIndex + 1,
          1,
          `In single-line format, all lines must use wrap indentation (non-multiple-of-4). Use block format (4 spaces) for multiple statements, or separate with commas.`,
          'PSV6-INDENT-WRAP-INVALID'
        );
      }
    }
  }

  /**
   * Validate wrap indentation for continuation lines
   * Pine Script Rules:
   * - Continuation lines must NOT use multiples of 4 spaces (reserved for blocks)
   * - At global scope (baseIndent=0), continuation must be > 0
   * - Inside blocks, continuation can be ANY non-multiple-of-4 (including < block level)
   */
  private validateWrapIndentation(lineNum: number, indent: number, baseIndent: number): void {
    const relativeIndent = indent - baseIndent;
    const wrapIndent = Math.abs(relativeIndent);

    // Rule 1: Continuation must actually change indentation relative to the statement header
    if (wrapIndent === 0) {
      this.addError(
        lineNum,
        indent + 1,
        'Line continuation cannot stay at the block indentation. Use a non-multiple-of-4 indentation offset.',
        'PSV6-INDENT-WRAP-INSUFFICIENT',
      );
      return;
    }

    // Rule 2: Wrapped line must NOT use a multiple-of-4 relative offset (reserved for blocks)
    if (wrapIndent % 4 === 0) {
      const spaceLabel = wrapIndent === 1 ? 'space' : 'spaces';
      this.addError(
        lineNum,
        indent + 1,
        `Line continuation cannot use ${wrapIndent} ${spaceLabel} of relative indentation (multiples of 4 are reserved for blocks).`,
        'PSV6-INDENT-WRAP-MULTIPLE-OF-4',
      );
      return;
    }
  }

  private validateHeaderContinuationLines(startIndex: number, endExclusive: number, baseIndent: number): void {
    if (endExclusive <= startIndex) {
      return;
    }

    for (let lineIdx = startIndex; lineIdx < endExclusive; lineIdx++) {
      if (lineIdx < 0 || lineIdx >= this.sourceLines.length) {
        continue;
      }
      const rawLine = this.sourceLines[lineIdx];
      if (!rawLine) {
        continue;
      }
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed.startsWith('//')) {
        continue;
      }
      const indent = this.getLineIndent(lineIdx);
      this.validateWrapIndentation(lineIdx + 1, indent, baseIndent);
    }
  }

  private hasContinuationHintBefore(lineNum: number): boolean {
    const previousLine = this.findPreviousCodeLine(lineNum - 2);
    if (!previousLine) {
      return false;
    }

    // Check if this is a switch case expression (starts with case value and =>)
    const currentLine = this.sourceLines[lineNum - 1];
    if (currentLine && this.isSwitchCaseExpression(currentLine)) {
      return true; // Switch cases should be allowed at 4+ spaces
    }

    // Only allow 4+ space continuations for very specific patterns
    const trimmed = previousLine.trimEnd();
    
    // Allow for opening parentheses, brackets, braces (function calls, arrays, objects)
    if (trimmed.endsWith('(') || trimmed.endsWith('[') || trimmed.endsWith('{')) {
      return true;
    }
    
    // Allow for specific operators that commonly use multi-line expressions
    if (trimmed.endsWith('&&') || trimmed.endsWith('||') || trimmed.endsWith('=>') || trimmed.endsWith('=')) {
      return true;
    }
    
    // Allow commas only in function call contexts (check if we're inside parentheses)
    if (trimmed.endsWith(',')) {
      return this.isInsideFunctionCall(previousLine);
    }
    
    // Don't allow for other operators or general continuation hints
    return false;
  }

  private isInsideFunctionCall(line: string): boolean {
    // Simple heuristic: check if there are unmatched opening parentheses before the comma
    let parenCount = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '(') {
        parenCount++;
      } else if (line[i] === ')') {
        parenCount--;
      }
    }
    // If there are unmatched opening parentheses, we're likely in a function call
    return parenCount > 0;
  }

  private isSwitchCaseExpression(line: string): boolean {
    const trimmed = line.trim();
    // Switch case pattern: "case_value => expression" or just "=> expression"
    return /^\s*[^=]*\s*=>/.test(trimmed);
  }

  private isNamedParameterContext(lineNum: number): boolean {
    const previousLine = this.findPreviousCodeLine(lineNum - 2);
    if (!previousLine) {
      return false;
    }

    const trimmed = previousLine.trimEnd();
    
    // Allow multiples of 4 for:
    // 1. Variable assignments: "variable = expression" (top-level context)
    // 2. Named parameter contexts: "parameter = value," (but only for top-level function calls)
    // NOT for: "function(value," (positional parameters or nested function calls)
    
    // Variable assignment pattern: "variable = expression"
    const assignmentPattern = /\w+\s*=\s*[^=]*$/;
    
    // Named parameter pattern: "parameter = value," (only for top-level calls)
    const namedParamPattern = /\w+\s*=\s*[^,)]+[,)]?\s*$/;
    
    // Check if this is a variable assignment (always allow)
    if (assignmentPattern.test(trimmed)) {
      return true;
    }
    
    // Check if this is a named parameter in a top-level function call
    if (namedParamPattern.test(trimmed)) {
      // Find the function call start line to determine if it's top-level
      const functionCallStartLine = this.findFunctionCallStartLine(lineNum);
      if (functionCallStartLine) {
        return this.isTopLevelFunctionCall(functionCallStartLine);
      }
    }
    
    return false;
  }

  private findFunctionCallStartLine(currentLineNum: number): string | null {
    // Look backwards to find the function call start (line ending with '(')
    for (let i = currentLineNum - 2; i >= 0; i--) {
      const line = this.sourceLines[i];
      if (!line) {
        continue;
      }
      const trimmed = line.trim();
      if (trimmed.endsWith('(')) {
        return line;
      }
    }
    return null;
  }

  private isTopLevelFunctionCall(line: string): boolean {
    // Check if this is a top-level function call (no nesting)
    // Pattern: starts with function name followed by opening paren
    // NOT: nested calls like "color.new(color.blue,"
    const trimmed = line.trim();
    const topLevelPattern = /^\w+\s*\(/;  // starts with identifier followed by (
    const nestedPattern = /\.\w+\s*\(/;   // contains .identifier followed by (
    
    return topLevelPattern.test(trimmed) && !nestedPattern.test(trimmed);
  }

  private findPreviousCodeLine(startIndex: number): string | null {
    for (let i = startIndex; i >= 0; i--) {
      const line = this.sourceLines[i];
      if (!line) {
        continue;
      }

      const withoutComment = line.split('//')[0];
      if (withoutComment.trim() === '') {
        continue;
      }

      return withoutComment;
    }

    return null;
  }

  /**
   * Get the indentation level of a line
   */
  private getLineIndent(lineIndex: number): number {
    if (lineIndex < 0 || lineIndex >= this.sourceLines.length) {
      return 0;
    }

    const line = this.sourceLines[lineIndex];
    const match = line.match(/^(\s*)/);
    if (!match) return 0;

    const whitespace = match[0];
    // Convert tabs to 4 spaces
    return whitespace.replace(/\t/g, '    ').length;
  }

  /**
   * Recursively validate child nodes
   */
  private validateChildren(node: Node): void {
    if (!node) return;

    // Iterate through all properties looking for child nodes
    for (const key in node) {
      if (key === 'parent' || key === 'loc') continue; // Skip parent refs and location info
      
      const value = (node as unknown as Record<string, unknown>)[key];
      
      if (Array.isArray(value)) {
        value.forEach(child => {
          if (child && typeof child === 'object' && 'type' in child) {
            this.validateNode(child as Node);
          }
        });
      } else if (value && typeof value === 'object' && 'type' in value) {
        this.validateNode(value as unknown as Node);
      }
    }
  }

  /**
   * Add an error to the list
   */
  private addError(
    line: number,
    column: number,
    message: string,
    code: string
  ): void {
    this.errors.push({
      line,
      column,
      message,
      severity: 'error',
      code,
      suggestion: this.getSuggestion(code, line, column)
    });
  }

  /**
   * Add a warning to the list
   */
  private addWarning(
    line: number,
    column: number,
    message: string,
    code: string
  ): void {
    this.errors.push({
      line,
      column,
      message,
      severity: 'warning',
      code,
      suggestion: this.getSuggestion(code, line, column)
    });
  }

  /**
   * Get suggestion based on error code
   */
  private getSuggestion(code: string, line: number, column: number): string {
    switch (code) {
      case 'PSV6-INDENT-WRAP-MULTIPLE-OF-4':
        return 'Use a non-multiple-of-4 indentation (e.g., 2, 3, 5, 6, 7 spaces) for line continuations.';
      case 'PSV6-INDENT-WRAP-INSUFFICIENT':
        return 'Indent continuation lines more than the block base level.';
      case 'PSV6-INDENT-WRAP-INVALID':
        return 'Either make it a single-line function or use proper indentation: 4+ spaces for function body, or 1-3 spaces for line wrapping.';
      case 'PSV6-INDENT-INCONSISTENT':
        return 'Use consistent indentation. Blocks use multiples of 4 spaces, wraps use non-multiples of 4.';
      case 'PSV6-SYNTAX-CLOSING-PAREN': {
        const indent = Math.max(0, column - 1);
        const suggestionOptions = new Set<number>();
        if (indent > 0) {
          suggestionOptions.add(indent - 1);
        }
        suggestionOptions.add(indent + 1);
        suggestionOptions.add(indent + 2);
        const formatted = Array.from(suggestionOptions)
          .filter((value) => value > 0)
          .slice(0, 3)
          .join(', ');
        return formatted
          ? `Move the closing delimiter to a non-multiple-of-4 column (for example ${formatted}).`
          : 'Move the closing delimiter to a non-multiple-of-4 column.';
      }
      default:
        return '';
    }
  }
}

/**
 * Convenience function to validate indentation using AST
 */
export function validateIndentationWithAST(source: string, ast: ProgramNode | null): ValidationError[] {
  const validator = new ASTIndentationValidator(source, ast);
  return validator.validate();
}
