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
   */
  private checkMixedIndentation(): boolean {
    let firstTabLine = 0;
    let firstSpaceLine = 0;

    for (let i = 0; i < this.sourceLines.length; i++) {
      const line = this.sourceLines[i];
      if (!line || line.trim() === '' || line.trim().startsWith('//')) {
        continue;
      }

      const hasLeadingTab = /^\t/.test(line);
      const hasLeadingSpaces = /^ /.test(line);

      if (hasLeadingTab && firstTabLine === 0) {
        firstTabLine = i + 1;
      }
      if (hasLeadingSpaces && firstSpaceLine === 0) {
        firstSpaceLine = i + 1;
      }

      // If we've seen both tabs and spaces, report it
      if (firstTabLine > 0 && firstSpaceLine > 0) {
        const warningLine = Math.max(firstTabLine, firstSpaceLine);
        this.addWarning(
          warningLine,
          1,
          `Mixed tabs and spaces in indentation (tabs on line ${firstTabLine}, spaces on line ${firstSpaceLine})`,
          'PSI02'
        );
        return true; // Mixed indentation detected
      }
    }
    
    return false; // No mixed indentation
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
    if (node.body) {
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
        if (field.kind === 'FunctionDeclaration') {
          // Method inside type - validate with current context
          this.validateNode(field);
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

      // Continuation lines: must use wrap indentation (non-multiple-of-4)
      for (let lineIdx = stmtStartLine + 1; lineIdx <= stmtEndLine; lineIdx++) {
        const line = this.sourceLines[lineIdx];
        if (!line || line.trim() === '' || line.trim().startsWith('//')) {
          continue; // Skip empty lines and comments
        }

        const lineIndent = this.getLineIndent(lineIdx);
        this.validateWrapIndentation(lineIdx + 1, lineIndent, expectedIndent);
      }
    } else {
      // Single-line statement OR block statement: header should be at expected block indent
      if (stmtIndent !== expectedIndent) {
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

  /**
   * Validate a general statement (variable declaration, assignment, expression)
   * This is called for statements at the top level, not for statements inside blocks
   * (those go through validateBlockStatement instead)
   */
  private validateStatement(stmt: Node): void {
    // Special handling for assignment with switch expression
    // result = switch ...
    if (stmt.kind === 'AssignmentStatement') {
      const assignStmt = stmt as any;
      if (assignStmt.right && assignStmt.right.kind === 'SwitchStatement') {
        // This is a switch expression - validate the switch, not as wrapped lines
        this.validateSwitchStatement(assignStmt.right as SwitchStatementNode);
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
    if (node.body) {
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
    if (node.body) {
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
   * Validate wrap indentation for continuation lines
   * Pine Script Rules:
   * - Continuation lines must be indented MORE than the base line
   * - Continuation lines must NOT use multiples of 4 spaces (reserved for blocks)
   */
  private validateWrapIndentation(lineNum: number, indent: number, baseIndent: number): void {
    // Rule 1: Wrapped line must be indented more than the base
    if (indent <= baseIndent) {
      this.addError(
        lineNum,
        indent + 1,
        `Line continuation must be indented more than the base level (expected > ${baseIndent}, got ${indent})`,
        'PSV6-INDENT-WRAP-INSUFFICIENT'
      );
      return;
    }

    // Rule 2: Wrapped line must NOT be at a multiple-of-4 boundary
    if (indent % 4 === 0) {
      this.addError(
        lineNum,
        indent + 1,
        `Line continuation cannot use ${indent} spaces (multiples of 4 are reserved for blocks)`,
        'PSV6-INDENT-WRAP-MULTIPLE-OF-4'
      );
    }
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
  private validateChildren(node: any): void {
    if (!node) return;

    // Iterate through all properties looking for child nodes
    for (const key in node) {
      if (key === 'parent' || key === 'loc') continue; // Skip parent refs and location info
      
      const value = node[key];
      
      if (Array.isArray(value)) {
        value.forEach(child => {
          if (child && typeof child === 'object' && child.type) {
            this.validateNode(child);
          }
        });
      } else if (value && typeof value === 'object' && value.type) {
        this.validateNode(value);
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
      case 'PSV6-INDENT-INCONSISTENT':
        return 'Use consistent indentation. Blocks use multiples of 4 spaces, wraps use non-multiples of 4.';
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

