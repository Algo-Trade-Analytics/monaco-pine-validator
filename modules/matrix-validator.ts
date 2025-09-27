/**
 * Matrix validation module for Pine Script v6
 * Handles matrix declarations, operations, performance, and best practices
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';
import {
  type ArgumentNode,
  type AssignmentStatementNode,
  type BinaryExpressionNode,
  type CallExpressionNode,
  type ExpressionNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type NumberLiteralNode,
  type ProgramNode,
  type TypeReferenceNode,
  type UnaryExpressionNode,
  type VariableDeclarationNode,
} from '../core/ast/nodes';
import { findAncestor, visit, type NodePath } from '../core/ast/traversal';

const VALID_MATRIX_ELEMENT_TYPES = new Set(['int', 'float', 'bool', 'string', 'color']);

const MATRIX_METHOD_SPECS: Array<{ name: string; params: number; description: string }> = [
  { name: 'matrix.set', params: 4, description: 'matrix.set(id, row, col, value)' },
  { name: 'matrix.get', params: 3, description: 'matrix.get(id, row, col)' },
  { name: 'matrix.rows', params: 1, description: 'matrix.rows(id)' },
  { name: 'matrix.columns', params: 1, description: 'matrix.columns(id)' },
  { name: 'matrix.copy', params: 1, description: 'matrix.copy(id)' },
  { name: 'matrix.fill', params: 2, description: 'matrix.fill(id, value)' },
];

const EXPENSIVE_MATRIX_METHODS = new Set(['matrix.fill', 'matrix.copy']);

type MatrixInfo = {
  elementType: string;
  rows: number | null;
  cols: number | null;
  line: number;
  column: number;
};

type MatrixUsageRecord = { sets: number[]; fills: number[] };

export class MatrixValidator implements ValidationModule {
  name = 'MatrixValidator';

  private errors: Array<{ line: number; column: number; message: string; code: string }> = [];
  private warnings: Array<{ line: number; column: number; message: string; code: string }> = [];
  private info: Array<{ line: number; column: number; message: string; code: string }> = [];
  private context!: ValidationContext;
  private astContext: AstValidationContext | null = null;

  private matrixDeclarations = new Map<string, MatrixInfo>();
  private matrixAllocations = 0;
  private matrixUsage = new Map<string, MatrixUsageRecord>();

  getDependencies(): string[] {
    return ['FunctionValidator'];
  }

  getPriority(): number {
    return 80;
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;

    this.astContext = this.getAstContext(config);
    const ast = this.astContext?.ast;

    if (!ast) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: context.scriptType,
      };
    }

    this.collectMatrixDataAst(ast);
    this.validateMatrixPerformanceAst();
    this.validateMatrixBestPracticesAst();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors.map((error) => ({ ...error, severity: 'error' as const })),
      warnings: this.warnings.map((warning) => ({ ...warning, severity: 'warning' as const })),
      info: this.info.map((entry) => ({ ...entry, severity: 'info' as const })),
      typeMap: context.typeMap,
      scriptType: context.scriptType,
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
    this.matrixDeclarations.clear();
    this.matrixAllocations = 0;
    this.matrixUsage.clear();
  }

  private addError(line: number, column: number, message: string, code: string): void {
    this.errors.push({ line, column, message, code });
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({ line, column, message, code });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({ line, column, message, code });
  }

  private collectMatrixDataAst(program: ProgramNode): void {
    const loopStack: NodePath[] = [];

    visit(program, {
      ForStatement: {
        enter: (path) => {
          loopStack.push(path);
        },
        exit: () => {
          loopStack.pop();
        },
      },
      WhileStatement: {
        enter: (path) => {
          loopStack.push(path);
        },
        exit: () => {
          loopStack.pop();
        },
      },
      VariableDeclaration: {
        enter: (path) => {
          this.registerMatrixTypeAnnotation(path.node);
        },
      },
      CallExpression: {
        enter: (path) => {
          const call = (path as NodePath<CallExpressionNode>).node;
          const qualifiedName = this.getExpressionQualifiedName(call.callee);
          if (!qualifiedName || !qualifiedName.startsWith('matrix.')) {
            return;
          }

          if (qualifiedName === 'matrix.new') {
            this.handleMatrixCreationAst(call, path);
          } else {
            this.handleMatrixMethodCallAst(qualifiedName, call, loopStack.length > 0);
          }
        },
      },
    });
  }

  private registerMatrixTypeAnnotation(declaration: VariableDeclarationNode): void {
    const typeAnnotation = declaration.typeAnnotation;
    if (!typeAnnotation) {
      return;
    }

    const elementType = this.extractMatrixAnnotationElement(typeAnnotation);
    if (!elementType) {
      return;
    }

    const identifier = declaration.identifier;
    const name = identifier.name;
    const line = identifier.loc.start.line;
    const column = identifier.loc.start.column;

    const info = this.matrixDeclarations.get(name) ?? {
      elementType,
      rows: null,
      cols: null,
      line,
      column,
    };

    info.elementType = elementType;
    info.line = line;
    info.column = column;

    this.matrixDeclarations.set(name, info);

    this.context.typeMap.set(name, {
      type: 'matrix',
      isConst: declaration.declarationKind === 'const',
      isSeries: false,
      declaredAt: { line, column },
      usages: [],
      elementType,
    });
  }

  private handleMatrixCreationAst(call: CallExpressionNode, path: NodePath<CallExpressionNode>): void {
    this.matrixAllocations++;

    const target = this.extractMatrixAssignmentTarget(path);
    const line = call.loc.start.line;
    const column = call.loc.start.column;

    const elementType = this.inferMatrixElementTypeFromCall(call);
    if (elementType && elementType !== 'unknown') {
      this.validateMatrixType(elementType, line, column);
    }

    const { rows, cols } = this.extractMatrixDimensionsFromCall(call);
    if (rows !== null && cols !== null) {
      this.validateMatrixDimensions(rows, cols, line, column);
    }

    if (target) {
      const info = this.matrixDeclarations.get(target.name) ?? {
        elementType: elementType ?? 'unknown',
        rows,
        cols,
        line: target.line,
        column: target.column,
      };

      if (elementType) {
        info.elementType = elementType;
      }
      info.rows = rows;
      info.cols = cols;
      info.line = target.line;
      info.column = target.column;

      this.matrixDeclarations.set(target.name, info);

      this.context.typeMap.set(target.name, {
        type: 'matrix',
        isConst: false,
        isSeries: false,
        declaredAt: { line: target.line, column: target.column },
        usages: [],
        elementType: elementType ?? 'unknown',
      });
    }
  }

  private handleMatrixMethodCallAst(qualifiedName: string, call: CallExpressionNode, inLoop: boolean): void {

    const line = call.loc.start.line;
    const column = call.loc.start.column;
    const spec = MATRIX_METHOD_SPECS.find((entry) => entry.name === qualifiedName);
    const args = call.args;

    if (spec && args.length !== spec.params) {
      this.addError(
        line,
        column,
        `Invalid parameter count for ${qualifiedName}. Expected ${spec.params}, got ${args.length}. Usage: ${spec.description}`,
        'PSV6-MATRIX-METHOD-PARAMS',
      );
    }

    const matrixArgument = args[0]?.value ?? null;
    const matrixName = matrixArgument ? this.validateMatrixVariableAst(matrixArgument, line, column) : null;

    if (qualifiedName === 'matrix.get' && matrixName && args[1] && args[2]) {
      this.validateMatrixIndexAst(matrixName, args[1], args[2], line, column);
    }

    if (qualifiedName === 'matrix.set' && matrixName) {
      if (args[1] && args[2]) {
        this.validateMatrixIndexAst(matrixName, args[1], args[2], line, column);
      }
      if (args[3]) {
        this.validateMatrixValueTypeAst(matrixName, args[3].value, line, column, 'set');
        this.recordMatrixUsage(matrixName, 'set', line);
      }
    }

    if (qualifiedName === 'matrix.fill' && matrixName && args[1]) {
      this.validateMatrixValueTypeAst(matrixName, args[1].value, line, column, 'fill');
      this.recordMatrixUsage(matrixName, 'fill', line);
    }

    if (inLoop && EXPENSIVE_MATRIX_METHODS.has(qualifiedName)) {
      this.addWarning(
        line,
        column,
        `Expensive matrix operation '${qualifiedName}' detected in loop`,
        'PSV6-MATRIX-PERF-LOOP',
      );
    }
  }

  private extractMatrixAssignmentTarget(path: NodePath<CallExpressionNode>): { name: string; line: number; column: number } | null {
    const declarationPath = findAncestor(path, (ancestor): ancestor is NodePath<VariableDeclarationNode> => {
      return ancestor.node.kind === 'VariableDeclaration';
    });

    if (declarationPath) {
      const declaration = declarationPath.node as VariableDeclarationNode;
      if (declaration.initializer === path.node) {
        const identifier = declaration.identifier;
        return {
          name: identifier.name,
          line: identifier.loc.start.line,
          column: identifier.loc.start.column,
        };
      }
    }

    const assignmentPath = findAncestor(path, (ancestor): ancestor is NodePath<AssignmentStatementNode> => {
      return ancestor.node.kind === 'AssignmentStatement';
    });

    if (assignmentPath) {
      const assignment = assignmentPath.node as AssignmentStatementNode;
      if (assignment.right === path.node && assignment.left.kind === 'Identifier') {
        const identifier = assignment.left as IdentifierNode;
        return {
          name: identifier.name,
          line: identifier.loc.start.line,
          column: identifier.loc.start.column,
        };
      }
    }

    return null;
  }

  private inferMatrixElementTypeFromCall(call: CallExpressionNode): string | null {
    const genericType = this.extractGenericElementType(call);
    if (genericType) {
      return genericType;
    }

    const args = call.args;
    if (args.length >= 1) {
      const typeArg = args[0].value;
      const resolved = this.resolveTypeIdentifier(typeArg);
      if (resolved) {
        return resolved;
      }
    }

    return null;
  }

  private extractMatrixDimensionsFromCall(call: CallExpressionNode): { rows: number | null; cols: number | null } {
    const args = call.args;
    const genericType = this.extractGenericElementType(call);

    const rowIndex = genericType ? 0 : 1;
    const colIndex = genericType ? 1 : 2;

    const rows = args[rowIndex] ? this.extractNumericLiteral(args[rowIndex].value) : null;
    const cols = args[colIndex] ? this.extractNumericLiteral(args[colIndex].value) : null;

    return { rows, cols };
  }

  private validateMatrixVariableAst(expression: ExpressionNode, line: number, column: number): string | null {
    if (expression.kind !== 'Identifier') {
      return null;
    }

    const identifier = expression as IdentifierNode;
    const name = identifier.name;

    if (this.matrixDeclarations.has(name)) {
      return name;
    }

    const typeInfo = this.context.typeMap.get(name);
    if (typeInfo?.type === 'matrix') {
      return name;
    }

    if (this.isFunctionParameter(name)) {
      return name;
    }

    this.addError(line, column, `Variable '${name}' is not declared as a matrix`, 'PSV6-MATRIX-NOT-MATRIX');
    return name;
  }

  private validateMatrixIndexAst(name: string, rowArg: ArgumentNode, colArg: ArgumentNode, line: number, column: number): void {
    const info = this.matrixDeclarations.get(name);
    if (!info) {
      return;
    }

    const rowValue = this.extractNumericLiteral(rowArg.value);
    if (rowValue !== null && info.rows !== null && (rowValue < 0 || rowValue >= info.rows)) {
      this.addWarning(
        line,
        column,
        `Matrix row index ${rowValue} is out of bounds for matrix with ${info.rows} rows`,
        'PSV6-MATRIX-INDEX-BOUNDS',
      );
    }

    const colValue = this.extractNumericLiteral(colArg.value);
    if (colValue !== null && info.cols !== null && (colValue < 0 || colValue >= info.cols)) {
      this.addWarning(
        line,
        column,
        `Matrix column index ${colValue} is out of bounds for matrix with ${info.cols} columns`,
        'PSV6-MATRIX-INDEX-BOUNDS',
      );
    }
  }

  private validateMatrixValueTypeAst(
    name: string,
    expression: ExpressionNode,
    line: number,
    column: number,
    operation: 'set' | 'fill',
  ): void {
    const info = this.matrixDeclarations.get(name);
    if (!info) {
      return;
    }

    const valueType = this.inferExpressionTypeAst(expression);
    if (!this.areTypesCompatible(info.elementType, valueType)) {
      const action = operation === 'set' ? 'set' : 'fill';
      this.addError(
        line,
        column,
        `Type mismatch: cannot ${action} ${valueType} ${operation === 'set' ? 'in' : 'into'} ${info.elementType} matrix '${name}'`,
        'PSV6-MATRIX-TYPE-MISMATCH',
      );
    }
  }

  private recordMatrixUsage(name: string, kind: 'set' | 'fill', line: number): void {
    const usage = this.matrixUsage.get(name) ?? { sets: [], fills: [] };
    if (kind === 'set') {
      usage.sets.push(line);
    } else {
      usage.fills.push(line);
    }
    this.matrixUsage.set(name, usage);
  }

  private validateMatrixType(type: string, line: number, column: number): void {
    if (!VALID_MATRIX_ELEMENT_TYPES.has(type)) {
      this.addError(
        line,
        column,
        `Invalid matrix type: ${type}. Valid types are: ${Array.from(VALID_MATRIX_ELEMENT_TYPES).join(', ')}`,
        'PSV6-MATRIX-INVALID-TYPE',
      );
    }
  }

  private validateMatrixDimensions(rows: number, cols: number, line: number, column: number): void {
    if (rows <= 0 || cols <= 0) {
      this.addError(line, column, `Matrix dimensions must be positive, got: ${rows}x${cols}`, 'PSV6-MATRIX-INVALID-DIMENSIONS');
      return;
    }

    if (rows > 1000 || cols > 1000) {
      this.addError(
        line,
        column,
        `Matrix dimensions (${rows}x${cols}) exceed the maximum limit of 1000 for a single dimension`,
        'PSV6-MATRIX-DIMENSION-LIMIT',
      );
    }
  }

  private validateMatrixPerformanceAst(): void {
    if (this.matrixAllocations > 5) {
      this.addWarning(
        1,
        1,
        `Too many matrix allocations (${this.matrixAllocations}). Consider reusing matrices or using fewer matrices.`,
        'PSV6-MATRIX-PERF-ALLOCATION',
      );
    }

    for (const [name, info] of this.matrixDeclarations) {
      if (info.rows !== null && info.cols !== null) {
        const totalElements = info.rows * info.cols;
        if (totalElements > 10000) {
          this.addWarning(
            info.line,
            info.column,
            `Large matrix '${name}' with ${totalElements} elements. Consider performance implications.`,
            'PSV6-MATRIX-PERF-LARGE',
          );
        }
      }
    }
  }

  private validateMatrixBestPracticesAst(): void {
    this.validateMatrixNaming();
    this.validateMatrixInitializationAst();
    this.validateMatrixMemoryManagementAst();
  }

  private validateMatrixNaming(): void {
    for (const [name, info] of this.matrixDeclarations) {
      if (name.length <= 2 || /^[a-z]$/.test(name) || /^mat\d*$/.test(name)) {
        this.addInfo(
          info.line,
          info.column,
          `Consider using more descriptive names for matrices. '${name}' could be improved.`,
          'PSV6-MATRIX-NAMING-SUGGESTION',
        );
      }
    }
  }

  private validateMatrixInitializationAst(): void {
    for (const [name, info] of this.matrixDeclarations) {
      const usage = this.matrixUsage.get(name);
      if (!usage) {
        this.addInfo(
          info.line,
          info.column,
          `Matrix '${name}' is declared but never initialized. Consider adding initial values.`,
          'PSV6-MATRIX-INITIALIZATION-SUGGESTION',
        );
        continue;
      }

      const hasInitialization = [...usage.sets, ...usage.fills].some((usageLine) => usageLine >= info.line);
      if (!hasInitialization) {
        this.addInfo(
          info.line,
          info.column,
          `Matrix '${name}' is declared but never initialized. Consider adding initial values.`,
          'PSV6-MATRIX-INITIALIZATION-SUGGESTION',
        );
      }
    }
  }

  private validateMatrixMemoryManagementAst(): void {
    for (const [name, info] of this.matrixDeclarations) {
      if (info.rows === null || info.cols === null) {
        continue;
      }

      const usage = this.matrixUsage.get(name);
      if (!usage) {
        continue;
      }

      const hasSet = usage.sets.length > 0;
      const hasFill = usage.fills.length > 0;

      if (hasSet && !hasFill && info.rows * info.cols > 100) {
        this.addInfo(
          info.line,
          info.column,
          `Matrix '${name}' is modified but never reset. Consider using matrix.fill() or recreating the matrix to manage memory.`,
          'PSV6-MATRIX-MEMORY-SUGGESTION',
        );
      }
    }
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    return 'ast' in this.context ? (this.context as AstValidationContext) : null;
  }

  private extractGenericElementType(call: CallExpressionNode): string | null {
    if (Array.isArray(call.typeArguments) && call.typeArguments.length > 0) {
      const formatted = this.formatTypeReference(call.typeArguments[0]);
      if (formatted) {
        return formatted;
      }
    }

    const source = this.getExpressionText(call.callee);
    const match = source.match(/matrix\.new\s*<\s*([^>]+)\s*>/i);
    if (match) {
      return match[1].trim();
    }
    return null;
  }

  private resolveTypeIdentifier(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }

    if (expression.kind === 'StringLiteral') {
      const raw = this.getExpressionText(expression).replace(/^['"]|['"]$/g, '');
      return raw;
    }

    return null;
  }

  private extractMatrixAnnotationElement(type: TypeReferenceNode): string | null {
    if (type.name.name === 'matrix' && type.generics.length > 0) {
      const generic = type.generics[0];
      return this.formatTypeReference(generic);
    }

    const source = this.getNodeSource(type).trim();
    const match = source.match(/^matrix\s*<\s*([^>]+)\s*>/i);
    if (match) {
      return match[1];
    }

    return null;
  }

  private formatTypeReference(type: TypeReferenceNode): string {
    const base = type.name.name;
    if (!base) {
      return '';
    }

    if (!Array.isArray(type.generics) || type.generics.length === 0) {
      return base;
    }

    const generics = type.generics
      .map((generic) => this.formatTypeReference(generic))
      .filter((name) => name.length > 0);

    if (generics.length === 0) {
      return base;
    }

    return `${base}<${generics.join(', ')}>`;
  }

  private isFunctionParameter(name: string): boolean {
    if (!this.astContext) {
      return false;
    }

    const record = this.astContext.symbolTable.get(name);
    if (!record) {
      return false;
    }

    const kinds = (record.metadata?.declarationKinds as string[] | undefined) ?? [];
    return kinds.includes('parameter');
  }

  private inferExpressionTypeAst(expression: ExpressionNode): string {
    switch (expression.kind) {
      case 'StringLiteral':
        return 'string';
      case 'BooleanLiteral':
        return 'bool';
      case 'NullLiteral':
        return 'unknown';
      case 'NumberLiteral': {
        const number = expression as NumberLiteralNode;
        const raw = number.raw ?? '';
        const isFloat = raw.includes('.') || /[eE]/.test(raw);
        return !isFloat && Number.isInteger(number.value) ? 'int' : 'float';
      }
      case 'Identifier': {
        const name = (expression as IdentifierNode).name;
        const matrixInfo = this.matrixDeclarations.get(name);
        if (matrixInfo) {
          return 'matrix';
        }

        const typeInfo = this.context.typeMap.get(name);
        if (typeInfo) {
          return typeInfo.elementType ?? typeInfo.type;
        }

        return 'unknown';
      }
      case 'MemberExpression': {
        const text = this.getExpressionText(expression);
        if (text.startsWith('color.') || text.startsWith('#') || text.startsWith('rgb')) {
          return 'color';
        }
        return 'unknown';
      }
      case 'CallExpression': {
        const call = expression as CallExpressionNode;
        const qualified = this.getExpressionQualifiedName(call.callee);
        if (!qualified) {
          return 'unknown';
        }

        if (qualified === 'matrix.get' && call.args.length > 0) {
          const name = this.getIdentifierName(call.args[0].value);
          if (name) {
            const info = this.matrixDeclarations.get(name);
            if (info) {
              return info.elementType;
            }
          }
        }

        if (qualified === 'matrix.new') {
          return 'matrix';
        }

        if (qualified.startsWith('ta.')) {
          return 'series';
        }

        if (qualified.startsWith('math.')) {
          return 'float';
        }

        return 'unknown';
      }
      case 'BinaryExpression': {
        const binary = expression as BinaryExpressionNode;
        if (binary.operator === '+') {
          const leftType = this.inferExpressionTypeAst(binary.left);
          const rightType = this.inferExpressionTypeAst(binary.right);
          if (leftType === 'string' || rightType === 'string') {
            return 'string';
          }
          if (leftType === 'float' || rightType === 'float') {
            return 'float';
          }
          return 'int';
        }
        return 'float';
      }
      default:
        return 'unknown';
    }
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

  private getIdentifierName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }
    return null;
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

  private getExpressionText(expression: ExpressionNode): string {
    switch (expression.kind) {
      case 'Identifier':
        return (expression as IdentifierNode).name;
      case 'MemberExpression': {
        const member = expression as MemberExpressionNode;
        if (member.computed) {
          return this.getNodeSource(member);
        }
        const objectText = this.getExpressionText(member.object);
        return `${objectText}.${member.property.name}`;
      }
      default:
        return this.getNodeSource(expression);
    }
  }

  private getNodeSource(node: { loc: { start: { line: number; column: number }; end: { line: number; column: number } } }): string {
    const lines = this.context.lines ?? [];
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

  private areTypesCompatible(expectedType: string, actualType: string): boolean {
    if (expectedType === actualType) {
      return true;
    }

    if (expectedType === 'float' && (actualType === 'int' || actualType === 'float')) {
      return true;
    }

    if (expectedType === 'int' && actualType === 'int') {
      return true;
    }

    if (expectedType === 'float' && actualType === 'series') {
      return true;
    }

    return false;
  }
}
