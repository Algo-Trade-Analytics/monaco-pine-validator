/**
 * History Referencing validation module for Pine Script v6
 * Handles validation of history references, performance analysis, and scope validation
 */

import {
  AstValidationContext,
  ValidationModule,
  ValidationContext,
  ValidationError,
  ValidationResult,
  ValidatorConfig,
} from '../core/types';
import type {
  ArgumentNode,
  AssignmentStatementNode,
  CallExpressionNode,
  ExpressionNode,
  IdentifierNode,
  IndexExpressionNode,
  ProgramNode,
  TypeReferenceNode,
  UnaryExpressionNode,
  NumberLiteralNode,
  VariableDeclarationNode,
} from '../core/ast/nodes';
import { findAncestor, visit, type NodePath } from '../core/ast/traversal';
import type { TypeMetadata } from '../core/ast/types';

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}

const BUILTIN_HISTORY_TYPES: Record<string, string> = {
  close: 'float',
  open: 'float',
  high: 'float',
  low: 'float',
  volume: 'float',
  time: 'int',
  bar_index: 'int',
  hl2: 'float',
  hlc3: 'float',
  ohlc4: 'float',
  hlcc4: 'float',
};

export class HistoryReferencingValidator implements ValidationModule {
  name = 'HistoryReferencingValidator';

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;

  getDependencies(): string[] {
    return ['SyntaxValidator', 'TypeValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.astContext = isAstValidationContext(context) && context.ast ? context : null;

    if (this.astContext?.ast) {
      this.validateHistoryWithAst(this.astContext.ast);
    } else {
      this.validateHistoryReferencesLegacy();
      this.validateHistoryPerformanceLegacy();
      this.validateHistoryScopeLegacy();
      this.validateHistoryTypesLegacy();
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: null
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
  }

  private addError(line: number, column: number, message: string, code: string, suggestion?: string): void {
    this.errors.push({
      line,
      column,
      message,
      code,
      suggestion,
      severity: 'error'
    });
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({
      line,
      column,
      message,
      code,
      severity: 'warning'
    });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({
      line,
      column,
      message,
      code,
      severity: 'info'
    });
  }

  private validateHistoryWithAst(program: ProgramNode): void {
    if (!this.astContext) {
      return;
    }

    const varipVariables = new Set<string>();
    const warnedLoops = new Set<object>();

    visit(program, {
      VariableDeclaration: {
        enter: (path) => {
          const node = (path as NodePath<VariableDeclarationNode>).node;
          const identifierName = node.identifier.name;

          if (node.declarationKind === 'varip') {
            varipVariables.add(identifierName);

            if (node.initializer && this.expressionHasHistoryReference(node.initializer)) {
              const { line, column } = node.loc.start;
              this.addError(
                line,
                column,
                'History references are not allowed in varip assignments.',
                'PSV6-HISTORY-VARIP-CONTEXT',
              );
            }
          }

          if (node.typeAnnotation && node.initializer) {
            this.validateHistoryTypeMismatchAst(node);
          }
        },
      },
      AssignmentStatement: {
        enter: (path) => {
          const node = (path as NodePath<AssignmentStatementNode>).node;
          if (!node.right) {
            return;
          }

          const targetName = this.getIdentifierName(node.left);
          if (!targetName || !varipVariables.has(targetName)) {
            return;
          }

          if (!this.expressionHasHistoryReference(node.right)) {
            return;
          }

          const { line, column } = node.loc.start;
          this.addError(
            line,
            column,
            'History references are not allowed in varip assignments.',
            'PSV6-HISTORY-VARIP-CONTEXT',
          );
        },
      },
      CallExpression: {
        enter: (path) => {
          const node = (path as NodePath<CallExpressionNode>).node;
          for (const argument of node.args) {
            if (!this.expressionHasHistoryReference(argument.value)) {
              continue;
            }

            const { line, column } = argument.value.loc.start;
            this.addWarning(
              line,
              column,
              'History reference used in function parameter. Consider caching the value before calling the function.',
              'PSV6-HISTORY-FUNCTION-PARAM',
            );
          }
        },
      },
      IndexExpression: {
        enter: (path) => {
          this.processAstIndexExpression(path as NodePath<IndexExpressionNode>, warnedLoops);
        },
      },
    });
  }

  private processAstIndexExpression(path: NodePath<IndexExpressionNode>, warnedLoops: Set<object>): void {
    if (!this.isHistoryReference(path.node)) {
      return;
    }

    this.checkNegativeHistoryIndex(path.node);
    this.checkLargeHistoryIndex(path.node);
    this.checkNestedHistoryReference(path);
    this.checkHistoryReferenceInLoop(path, warnedLoops);
  }

  private checkNegativeHistoryIndex(node: IndexExpressionNode): void {
    const numericIndex = this.extractNumericLiteral(node.index);
    if (numericIndex === null || numericIndex >= 0) {
      return;
    }

    const { line, column } = node.index.loc.start;
    const targetVersion = this.config.targetVersion ?? 6;

    if (targetVersion < 6) {
      this.addError(
        line,
        column,
        'Invalid history reference: negative indexes are not allowed.',
        'PSV6-HISTORY-INVALID-INDEX',
      );
      return;
    }

    const metadata = this.resolveExpressionType(node.object);
    const isSeries = !metadata || metadata.kind === 'series';

    if (!isSeries) {
      return;
    }

    this.addError(
      line,
      column,
      'Invalid history reference: negative indexes are not allowed for series data.',
      'PSV6-HISTORY-INVALID-INDEX',
      'Use positive indices like close[1] for historical data, or array.get(myArray, -1) for arrays.',
    );
  }

  private checkLargeHistoryIndex(node: IndexExpressionNode): void {
    const numericIndex = this.extractNumericLiteral(node.index);
    if (numericIndex === null || numericIndex <= 1000) {
      return;
    }

    const { line, column } = node.index.loc.start;
    this.addWarning(
      line,
      column,
      `Large history index: ${numericIndex}. Consider using request.security() for historical data beyond 1000 bars`,
      'PSV6-HISTORY-LARGE-INDEX',
    );
  }

  private checkNestedHistoryReference(path: NodePath<IndexExpressionNode>): void {
    const ancestorIndex = findAncestor(
      path,
      (ancestor): ancestor is NodePath<IndexExpressionNode> => ancestor.node.kind === 'IndexExpression',
    );

    if (ancestorIndex) {
      return;
    }

    if (!this.expressionHasHistoryReference(path.node.index)) {
      return;
    }

    const { line, column } = path.node.loc.start;
    this.addWarning(
      line,
      column,
      'Nested history reference detected. This can impact performance.',
      'PSV6-HISTORY-PERF-NESTED',
    );
  }

  private checkHistoryReferenceInLoop(path: NodePath<IndexExpressionNode>, warnedLoops: Set<object>): void {
    const loopAncestor = findAncestor(path, (ancestor) => {
      const kind = ancestor.node.kind;
      return kind === 'ForStatement' || kind === 'WhileStatement';
    });

    if (!loopAncestor) {
      return;
    }

    const loopNode = loopAncestor.node;
    if (warnedLoops.has(loopNode)) {
      return;
    }

    warnedLoops.add(loopNode);

    const { line, column } = path.node.loc.start;
    const loopLine = loopNode.loc.start.line;
    this.addWarning(
      line,
      column,
      `History reference in loop (line ${loopLine}). Consider caching historical values outside the loop for better performance`,
      'PSV6-HISTORY-PERF-LOOP',
    );
  }

  private validateHistoryTypeMismatchAst(declaration: VariableDeclarationNode): void {
    const declaredType = this.getTypeAnnotationName(declaration.typeAnnotation);
    if (!declaredType || !declaration.initializer) {
      return;
    }

    const historyReference = this.findFirstHistoryReference(declaration.initializer);
    if (!historyReference?.identifier) {
      return;
    }

    const expectedType = BUILTIN_HISTORY_TYPES[historyReference.identifier];
    if (!expectedType) {
      return;
    }

    if (declaredType === expectedType) {
      return;
    }

    if (declaredType === 'float' && expectedType === 'int') {
      return;
    }

    const { line, column } = declaration.loc.start;
    this.addWarning(
      line,
      column,
      `Type mismatch: declared as '${declaredType}' but '${historyReference.identifier}[...]' yields a different type`,
      'PSV6-HISTORY-TYPE-MISMATCH',
    );
  }

  private findFirstHistoryReference(
    expression: ExpressionNode,
  ): { node: IndexExpressionNode; identifier: string | null } | null {
    let reference: { node: IndexExpressionNode; identifier: string | null } | null = null;

    visit(expression, {
      IndexExpression: {
        enter: (path) => {
          const node = (path as NodePath<IndexExpressionNode>).node;
          if (reference || !this.isHistoryReference(node)) {
            return;
          }

          reference = {
            node,
            identifier: this.getIdentifierName(node.object),
          };

          return false;
        },
      },
    });

    return reference;
  }

  private expressionHasHistoryReference(expression: ExpressionNode): boolean {
    let hasHistory = false;

    visit(expression, {
      IndexExpression: {
        enter: (path) => {
          const node = (path as NodePath<IndexExpressionNode>).node;
          if (!this.isHistoryReference(node)) {
            return;
          }

          hasHistory = true;
          return false;
        },
      },
    });

    return hasHistory;
  }

  private isHistoryReference(node: IndexExpressionNode): boolean {
    const metadata = this.resolveExpressionType(node.object);

    if (metadata) {
      if (metadata.kind === 'series') {
        return true;
      }

      if (metadata.kind === 'matrix') {
        return false;
      }

      if (metadata.kind !== 'unknown') {
        const identifier = this.getIdentifierName(node.object);
        return !!(identifier && BUILTIN_HISTORY_TYPES[identifier]);
      }
    }

    const identifier = this.getIdentifierName(node.object);
    if (identifier) {
      return !!BUILTIN_HISTORY_TYPES[identifier];
    }

    return !metadata || metadata.kind === 'unknown';
  }

  private resolveExpressionType(expression: ExpressionNode): TypeMetadata | null {
    if (!this.astContext) {
      return null;
    }

    const { typeEnvironment } = this.astContext;
    const direct = typeEnvironment.nodeTypes.get(expression);
    if (direct) {
      return direct;
    }

    if (expression.kind === 'Identifier') {
      return typeEnvironment.identifiers.get((expression as IdentifierNode).name) ?? null;
    }

    return null;
  }

  private extractNumericLiteral(expression: ExpressionNode): number | null {
    if (expression.kind === 'NumberLiteral') {
      return (expression as NumberLiteralNode).value;
    }

    if (expression.kind === 'UnaryExpression') {
      const unary = expression as UnaryExpressionNode;
      const value = this.extractNumericLiteral(unary.argument);
      if (value === null) {
        return null;
      }

      if (unary.operator === '-') {
        return -value;
      }

      if (unary.operator === '+') {
        return value;
      }
    }

    return null;
  }

  private getTypeAnnotationName(type: TypeReferenceNode | null): string | null {
    if (!type) {
      return null;
    }

    return type.name.name;
  }

  private getIdentifierName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }

    return null;
  }

  private validateHistoryReferencesLegacy(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Look for history references: variable[index]
      const historyRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*([^\]]+)\s*\]/g;
      let match;
      
      while ((match = historyRegex.exec(line)) !== null) {
        const variableName = match[1];
        const indexExpression = match[2];
        
        this.validateHistoryIndex(variableName, indexExpression, lineNum);
      }
    }
  }

  private validateHistoryIndex(variableName: string, indexExpression: string, lineNum: number): void {
    // Check for invalid negative index in history references
    if (indexExpression.includes('-')) {
      const negativeMatch = indexExpression.match(/-(\d+)/);
      if (negativeMatch) {
        // In Pine Script v6, distinguish between array operations and history references
        if (this.config.targetVersion >= 6) {
          // Check if this is part of an array operation
          const currentLine = this.context.cleanLines[lineNum - 1];
          const isArrayOperation = /array\.(get|set|slice|remove|insert|indexof|lastindexof)\s*\(\s*[^,)]*\s*,\s*[^,)]*\s*\[\s*[^]]*\s*\]/.test(currentLine);
          
          if (!isArrayOperation) {
            // This is a history reference like close[-1], which is invalid
            this.addError(lineNum, 1, 
              `Invalid history index: ${indexExpression}. History indices must be non-negative for series data`, 
              'PSV6-HISTORY-INVALID-INDEX',
              'Use positive indices like close[1] for historical data. For arrays, use array.get(myArray, -1).');
          }
          // If it's an array operation, let ArrayValidator handle it
        } else {
          // Pre-v6: all negative indices in history references are invalid
          this.addError(lineNum, 1, 
            `Invalid history index: ${indexExpression}. History indices must be non-negative`, 
            'PSV6-HISTORY-INVALID-INDEX');
        }
        return;
      }
    }

    // Check for large history index
    const numericMatch = indexExpression.match(/^(\d+)$/);
    if (numericMatch) {
      const index = parseInt(numericMatch[1]);
      if (index > 1000) {
        this.addWarning(lineNum, 1, 
          `Large history index: ${index}. Consider using request.security() for historical data beyond 1000 bars`, 
          'PSV6-HISTORY-LARGE-INDEX');
      }
    }
  }

  private validateHistoryPerformanceLegacy(): void {
    // Check for history references in loops
    this.validateHistoryInLoopsLegacy();

    // Check for nested history references
    this.validateNestedHistoryReferencesLegacy();
  }

  private validateHistoryInLoopsLegacy(): void {
    let inLoop = false;
    let loopStartLine = 0;
    
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;
      
      // Check for loop start
      if (line.match(/^\s*for\s+/) || line.match(/^\s*while\s+/)) {
        inLoop = true;
        loopStartLine = lineNum;
        continue;
      }
      
      // Check for loop end
      if (inLoop && line.match(/^\s*end\s*$/)) {
        inLoop = false;
        continue;
      }
      
      // If we're in a loop, check for history references
      if (inLoop) {
        const historyRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*([^\]]+)\s*\]/g;
        let match;
        let historyCount = 0;
        
        while ((match = historyRegex.exec(line)) !== null) {
          historyCount++;
        }
        
        if (historyCount > 0) {
          this.addWarning(lineNum, 1, 
            `History reference in loop (line ${loopStartLine}). Consider caching historical values outside the loop for better performance`, 
            'PSV6-HISTORY-PERF-LOOP');
        }
      }
    }
  }

  private validateNestedHistoryReferencesLegacy(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Look for nested history references: variable[otherVariable[index]]
      const nestedHistoryRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*([^\]]+)\s*\]\s*\]/g;
      let match;
      
      while ((match = nestedHistoryRegex.exec(line)) !== null) {
        const outerVariable = match[1];
        const innerVariable = match[2];
        const innerIndex = match[3];
        
        this.addWarning(lineNum, 1, 
          `Nested history reference: ${outerVariable}[${innerVariable}[${innerIndex}]]. This can impact performance`, 
          'PSV6-HISTORY-PERF-NESTED');
      }
    }
  }

  private validateHistoryScopeLegacy(): void {
    // Check for history references in varip context
    this.validateHistoryInVaripContextLegacy();
    
    // Check for history references in function parameters
    this.validateHistoryInFunctionParamsLegacy();
  }

  private validateHistoryInVaripContextLegacy(): void {
    let inVaripContext = false;
    
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;
      
      // Check for varip declaration
      if (line.match(/^\s*varip\s+/)) {
        inVaripContext = true;
        continue;
      }
      
      // Check for varip assignment
      if (inVaripContext && line.includes(':=')) {
        // Look for history references in varip assignment
        const historyRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*([^\]]+)\s*\]/g;
        let match;
        
        while ((match = historyRegex.exec(line)) !== null) {
          const variableName = match[1];
          const indexExpression = match[2];
          
          this.addError(lineNum, 1, 
            `History reference '${variableName}[${indexExpression}]' in varip context. History references are not allowed in varip assignments`, 
            'PSV6-HISTORY-VARIP-CONTEXT');
        }
      }
      
      // Reset varip context on next line
      if (inVaripContext && !line.includes(':=')) {
        inVaripContext = false;
      }
    }
  }

  private validateHistoryInFunctionParamsLegacy(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Look for function calls with history references in parameters
      const functionCallRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g;
      let match;
      
      while ((match = functionCallRegex.exec(line)) !== null) {
        const functionName = match[1];
        const params = match[2];
        
        // Check if parameters contain history references
        const historyRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*([^\]]+)\s*\]/g;
        let historyMatch;
        
        while ((historyMatch = historyRegex.exec(params)) !== null) {
          const variableName = historyMatch[1];
          const indexExpression = historyMatch[2];
          
          this.addWarning(lineNum, 1, 
            `History reference '${variableName}[${indexExpression}]' in function parameter. Consider passing the historical value to a variable first`, 
            'PSV6-HISTORY-FUNCTION-PARAM');
        }
      }
    }
  }

  private validateHistoryTypesLegacy(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Look for variable declarations with history references
      const declarationRegex = /^\s*(int|float|bool|string|color)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/;
      const match = line.match(declarationRegex);
      
      if (match) {
        const declaredType = match[1];
        const variableName = match[2];
        const expression = match[3];
        
        // Check if expression contains history references
        const historyRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*([^\]]+)\s*\]/g;
        let historyMatch;
        
        while ((historyMatch = historyRegex.exec(expression)) !== null) {
          const historyVariable = historyMatch[1];
          const indexExpression = historyMatch[2];
          
          // Check for type mismatch
          if (this.isTypeMismatch(declaredType, historyVariable)) {
            this.addWarning(lineNum, 1, 
              `Type mismatch: declared as '${declaredType}' but '${historyVariable}[${indexExpression}]' is a different type`, 
              'PSV6-HISTORY-TYPE-MISMATCH');
          }
        }
      }
    }
  }

  private isTypeMismatch(declaredType: string, historyVariable: string): boolean {
    // Basic type checking for common variables
    const variableTypes: { [key: string]: string } = {
      'close': 'float',
      'open': 'float',
      'high': 'float',
      'low': 'float',
      'volume': 'float',
      'time': 'int',
      'bar_index': 'int',
      'hl2': 'float',
      'hlc3': 'float',
      'ohlc4': 'float',
      'hlcc4': 'float'
    };
    
    const actualType = variableTypes[historyVariable];
    if (!actualType) return false;
    
    // Check for type mismatch
    if (declaredType === 'int' && actualType === 'float') return true;
    if (declaredType === 'float' && actualType === 'int') return false; // int to float is usually OK
    if (declaredType !== actualType) return true;
    
    return false;
  }
}
