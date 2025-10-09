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
import { Codes } from '../core/codes';
import { ValidationHelper } from '../core/validation-helper';
import { ensureAstContext } from '../core/ast/context-utils';
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
import { getNodeSource } from '../core/ast/source-utils';

const VALID_MATRIX_ELEMENT_TYPES = new Set(['int', 'float', 'bool', 'string', 'color']);

const MATRIX_METHOD_SPECS: Array<{ name: string; params: number; description: string }> = [
  // Basic operations
  { name: 'matrix.set', params: 4, description: 'matrix.set(id, row, col, value)' },
  { name: 'matrix.get', params: 3, description: 'matrix.get(id, row, col)' },
  { name: 'matrix.rows', params: 1, description: 'matrix.rows(id)' },
  { name: 'matrix.columns', params: 1, description: 'matrix.columns(id)' },
  { name: 'matrix.copy', params: 1, description: 'matrix.copy(id)' },
  { name: 'matrix.fill', params: 2, description: 'matrix.fill(id, value)' },
  { name: 'matrix.elements_count', params: 1, description: 'matrix.elements_count(id)' },
  
  // Row/Column manipulation
  { name: 'matrix.add_row', params: 3, description: 'matrix.add_row(id, row_num, values)' },
  { name: 'matrix.add_col', params: 3, description: 'matrix.add_col(id, col_num, values)' },
  { name: 'matrix.remove_row', params: 2, description: 'matrix.remove_row(id, row_num)' },
  { name: 'matrix.remove_col', params: 2, description: 'matrix.remove_col(id, col_num)' },
  
  // Math operations
  { name: 'matrix.sum', params: 1, description: 'matrix.sum(id)' },
  { name: 'matrix.avg', params: 1, description: 'matrix.avg(id)' },
  { name: 'matrix.min', params: 1, description: 'matrix.min(id)' },
  { name: 'matrix.max', params: 1, description: 'matrix.max(id)' },
  { name: 'matrix.median', params: 1, description: 'matrix.median(id)' },
  { name: 'matrix.mode', params: 1, description: 'matrix.mode(id)' },
  { name: 'matrix.add', params: 2, description: 'matrix.add(id1, id2)' },
  { name: 'matrix.sub', params: 2, description: 'matrix.sub(id1, id2)' },
  { name: 'matrix.mult', params: 2, description: 'matrix.mult(id1, id2)' },
  { name: 'matrix.div', params: 2, description: 'matrix.div(id1, id2)' },
  { name: 'matrix.pow', params: 2, description: 'matrix.pow(id, power)' },
  { name: 'matrix.sqrt', params: 1, description: 'matrix.sqrt(id)' },
  { name: 'matrix.abs', params: 1, description: 'matrix.abs(id)' },
  { name: 'matrix.diff', params: 2, description: 'matrix.diff(id1, id2)' },
  
  // Statistical operations
  { name: 'matrix.variance', params: 1, description: 'matrix.variance(id)' },
  { name: 'matrix.stdev', params: 1, description: 'matrix.stdev(id)' },
  { name: 'matrix.covariance', params: 2, description: 'matrix.covariance(id1, id2)' },
  { name: 'matrix.percentile_linear_interpolation', params: 2, description: 'matrix.percentile_linear_interpolation(id, percentage)' },
  { name: 'matrix.percentile_nearest_rank', params: 2, description: 'matrix.percentile_nearest_rank(id, percentage)' },
  
  // Linear algebra
  { name: 'matrix.det', params: 1, description: 'matrix.det(id)' },
  { name: 'matrix.inv', params: 1, description: 'matrix.inv(id)' },
  { name: 'matrix.pinv', params: 1, description: 'matrix.pinv(id)' },
  { name: 'matrix.rank', params: 1, description: 'matrix.rank(id)' },
  { name: 'matrix.transpose', params: 1, description: 'matrix.transpose(id)' },
  { name: 'matrix.eigenvalues', params: 1, description: 'matrix.eigenvalues(id)' },
  { name: 'matrix.eigenvectors', params: 1, description: 'matrix.eigenvectors(id)' },
  
  // Transformations
  { name: 'matrix.reshape', params: 3, description: 'matrix.reshape(id, rows, columns)' },
  { name: 'matrix.reverse', params: 1, description: 'matrix.reverse(id)' },
  { name: 'matrix.concat', params: 3, description: 'matrix.concat(id1, id2, axis)' },
  
  // Helper functions
  { name: 'matrix.is_square', params: 1, description: 'matrix.is_square(id)' },
  { name: 'matrix.is_identity', params: 1, description: 'matrix.is_identity(id)' },
  { name: 'matrix.is_symmetric', params: 1, description: 'matrix.is_symmetric(id)' },
];

const MATRIX_METHOD_RETURNS: Record<string, { type: 'matrix' | 'array' | 'int' | 'float' | 'bool' | 'series'; elementFromInput?: boolean; elementType?: string }> = {
  'matrix.eigenvalues': { type: 'array', elementType: 'float' },
};

const EXPENSIVE_MATRIX_METHODS = new Set([
  'matrix.fill', 
  'matrix.copy',
  'matrix.mult',
  'matrix.inv',
  'matrix.pinv',
  'matrix.eigenvalues',
  'matrix.eigenvectors',
  'matrix.det',
  'matrix.reshape',
]);

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

  private helper = new ValidationHelper();
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
    this.context = context;
    this.reset();

    this.astContext = this.getAstContext(context, config);
    const ast = this.astContext?.ast;

    if (!ast) {
      return this.helper.buildResult(context);
    }

    this.collectMatrixDataAst(ast);
    this.validateMatrixPerformanceAst();
    this.validateMatrixBestPracticesAst();

    return this.helper.buildResult(context);
  }

  private reset(): void {
    this.helper.reset();
    this.astContext = null;
    this.matrixDeclarations.clear();
    this.matrixAllocations = 0;
    this.matrixUsage.clear();
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
            this.handleMatrixMethodCallAst(qualifiedName, call, path as NodePath<CallExpressionNode>, loopStack.length > 0);
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
    const hasGenericType = Array.isArray(call.typeArguments) && call.typeArguments.length > 0;
    const normalizedElementType = elementType && elementType.trim().length > 0 ? elementType.trim() : null;
    const elementTypeIsKnown = normalizedElementType ? 
      (VALID_MATRIX_ELEMENT_TYPES.has(normalizedElementType) || 
       this.context.typeMap.has(normalizedElementType)) : false;

    if (!normalizedElementType || normalizedElementType === 'unknown') {
      this.helper.addError(
        line,
        column,
        'Matrix declarations must specify a valid element type, e.g. matrix.new<float>(rows, cols).',
        'PSV6-MATRIX-INVALID-SYNTAX',
      );
    }

    if (normalizedElementType && !elementTypeIsKnown) {
      this.helper.addError(
        line,
        column,
        `Unknown matrix element type '${normalizedElementType}'. Supported types: ${Array.from(VALID_MATRIX_ELEMENT_TYPES).join(', ')}.`,
        'PSV6-MATRIX-INVALID-SYNTAX',
      );
    }

    if (normalizedElementType && normalizedElementType !== 'unknown') {
      this.validateMatrixType(normalizedElementType, line, column);
    }

    const args = call.args;
    const typeProvidedViaArgument = !hasGenericType && elementTypeIsKnown;
    const dimensionArgumentCount = args.length - (typeProvidedViaArgument ? 1 : 0);
    const allowEmptyMatrix = dimensionArgumentCount === 0;

    if (!allowEmptyMatrix && dimensionArgumentCount < 2) {
      this.helper.addError(
        line,
        column,
        'Matrix declarations must provide both row and column dimensions.',
        'PSV6-MATRIX-INVALID-SYNTAX',
      );
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

  private handleMatrixMethodCallAst(
    qualifiedName: string,
    call: CallExpressionNode,
    path: NodePath<CallExpressionNode>,
    inLoop: boolean,
  ): void {

    const line = call.loc.start.line;
    const column = call.loc.start.column;
    const spec = MATRIX_METHOD_SPECS.find((entry) => entry.name === qualifiedName);
    const args = call.args;
    const assignmentTarget = this.extractMatrixAssignmentTarget(path);

    if (spec && args.length !== spec.params) {
      this.helper.addError(
        line,
        column,
        `Invalid parameter count for ${qualifiedName}. Expected ${spec.params}, got ${args.length}. Usage: ${spec.description}`,
        'PSV6-FUNCTION-PARAM-COUNT',
      );
    }

    const matrixArgument = args[0]?.value ?? null;
    const matrixName = matrixArgument ? this.validateMatrixVariableAst(matrixArgument, line, column) : null;

    // Existing validations
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

    // Linear algebra validations
    if (qualifiedName === 'matrix.inv' || qualifiedName === 'matrix.det') {
      this.validateSquareMatrix(matrixName, line, column, qualifiedName);
    }

    if (qualifiedName === 'matrix.eigenvalues' || qualifiedName === 'matrix.eigenvectors') {
      this.validateSquareMatrix(matrixName, line, column, qualifiedName);
    }

    // Matrix multiplication dimension check
    if (qualifiedName === 'matrix.mult' && args.length >= 2) {
      this.validateMatrixMultiplicationDimensions(args[0], args[1], line, column);
    }

    // Reshape validation
    if (qualifiedName === 'matrix.reshape' && matrixName && args.length >= 3) {
      this.validateReshapeDimensions(matrixName, args[1], args[2], line, column);
    }

    // Row/Column operations
    if (qualifiedName === 'matrix.add_row' || qualifiedName === 'matrix.remove_row') {
      this.validateRowOperation(matrixName, args[1], line, column, qualifiedName);
    }

    if (qualifiedName === 'matrix.add_col' || qualifiedName === 'matrix.remove_col') {
      this.validateColOperation(matrixName, args[1], line, column, qualifiedName);
    }

    // Covariance validation (requires compatible dimensions)
    if (qualifiedName === 'matrix.covariance' && args.length >= 2) {
      this.validateCovarianceDimensions(args[0], args[1], line, column);
    }

    // Performance warning for expensive operations in loops
    if (inLoop && EXPENSIVE_MATRIX_METHODS.has(qualifiedName)) {
      this.helper.addWarning(
        line,
        column,
        `Expensive matrix operation '${qualifiedName}' detected in loop. Consider moving outside loop if possible.`,
        'PSV6-MATRIX-PERF-LOOP',
      );
    }

    if (assignmentTarget) {
      this.registerMatrixMethodReturnType(qualifiedName, assignmentTarget, matrixName);
    }
  }

  private registerMatrixMethodReturnType(
    qualifiedName: string,
    target: { name: string; line: number; column: number },
    sourceMatrix: string | null,
  ): void {
    const returnInfo = MATRIX_METHOD_RETURNS[qualifiedName];
    if (!returnInfo) {
      return;
    }

    const { name, line, column } = target;

    if (returnInfo.type === 'array') {
      const elementType = returnInfo.elementType
        ?? (returnInfo.elementFromInput && sourceMatrix
          ? this.matrixDeclarations.get(sourceMatrix)?.elementType ?? 'unknown'
          : 'unknown');

      this.context.typeMap.set(name, {
        type: 'array',
        isConst: false,
        isSeries: false,
        declaredAt: { line, column },
        usages: [],
        elementType,
      });
      return;
    }

    if (returnInfo.type === 'matrix') {
      const elementType = returnInfo.elementFromInput && sourceMatrix
        ? this.matrixDeclarations.get(sourceMatrix)?.elementType ?? 'unknown'
        : returnInfo.elementType ?? 'unknown';

      this.matrixDeclarations.set(name, {
        elementType,
        rows: null,
        cols: null,
        line,
        column,
      });

      this.context.typeMap.set(name, {
        type: 'matrix',
        isConst: false,
        isSeries: false,
        declaredAt: { line, column },
        usages: [],
        elementType,
      });
      return;
    }

    const isSeries = returnInfo.type === 'series';
    this.context.typeMap.set(name, {
      type: returnInfo.type,
      isConst: false,
      isSeries,
      declaredAt: { line, column },
      usages: [],
    });
  }

  private validateSquareMatrix(matrixName: string | null, line: number, column: number, operation: string): void {
    if (!matrixName) return;
    
    const info = this.matrixDeclarations.get(matrixName);
    if (!info) return;
    
    if (info.rows !== null && info.cols !== null && info.rows !== info.cols) {
      this.helper.addError(
        line,
        column,
        `${operation} requires a square matrix, but '${matrixName}' is ${info.rows}x${info.cols}`,
        'PSV6-MATRIX-NOT-SQUARE',
      );
    }
  }

  private validateMatrixMultiplicationDimensions(
    arg1: ArgumentNode,
    arg2: ArgumentNode,
    line: number,
    column: number
  ): void {
    const matrix1Name = arg1.value.kind === 'Identifier' ? (arg1.value as IdentifierNode).name : null;
    const matrix2Name = arg2.value.kind === 'Identifier' ? (arg2.value as IdentifierNode).name : null;
    
    if (!matrix1Name || !matrix2Name) return;
    
    const info1 = this.matrixDeclarations.get(matrix1Name);
    const info2 = this.matrixDeclarations.get(matrix2Name);
    
    if (!info1 || !info2) return;
    
    if (info1.cols !== null && info2.rows !== null && info1.cols !== info2.rows) {
      this.helper.addError(
        line,
        column,
        `Matrix multiplication dimension mismatch: '${matrix1Name}' columns (${info1.cols}) must equal '${matrix2Name}' rows (${info2.rows})`,
        'PSV6-MATRIX-DIMENSION-MISMATCH',
      );
    }
  }

  private validateReshapeDimensions(
    matrixName: string | null,
    rowsArg: ArgumentNode,
    colsArg: ArgumentNode,
    line: number,
    column: number
  ): void {
    if (!matrixName) return;
    
    const info = this.matrixDeclarations.get(matrixName);
    if (!info || info.rows === null || info.cols === null) return;
    
    const newRows = this.extractNumericLiteral(rowsArg.value);
    const newCols = this.extractNumericLiteral(colsArg.value);
    
    if (newRows !== null && newCols !== null) {
      const originalElements = info.rows * info.cols;
      const newElements = newRows * newCols;
      
      if (originalElements !== newElements) {
        this.helper.addError(
          line,
          column,
          `Reshape dimension mismatch: original matrix has ${originalElements} elements but reshape requires ${newElements} elements`,
          'PSV6-MATRIX-RESHAPE-MISMATCH',
        );
      }
    }
  }

  private validateRowOperation(
    matrixName: string | null,
    rowArg: ArgumentNode | undefined,
    line: number,
    column: number,
    operation: string
  ): void {
    if (!matrixName || !rowArg) return;
    
    // Validate parameter type - row_num should be int
    const rowType = this.inferExpressionTypeAst(rowArg.value);
    if (rowType === 'string' || rowType === 'bool' || rowType === 'color') {
      this.helper.addError(
        line,
        column,
        `${operation}: row parameter must be an integer, got ${rowType}`,
        'PSV6-FUNCTION-PARAM-TYPE',
      );
      return;
    }
    
    const info = this.matrixDeclarations.get(matrixName);
    if (!info || info.rows === null) return;
    
    const rowNum = this.extractNumericLiteral(rowArg.value);
    if (rowNum !== null && (rowNum < 0 || rowNum > info.rows)) {
      this.helper.addError(
        line,
        column,
        `${operation}: row index ${rowNum} is out of bounds for matrix with ${info.rows} rows`,
        'PSV6-MATRIX-INDEX-OUT-OF-BOUNDS',
      );
    }
  }

  private validateColOperation(
    matrixName: string | null,
    colArg: ArgumentNode | undefined,
    line: number,
    column: number,
    operation: string
  ): void {
    if (!matrixName || !colArg) return;
    
    const info = this.matrixDeclarations.get(matrixName);
    if (!info || info.cols === null) return;
    
    const colNum = this.extractNumericLiteral(colArg.value);
    if (colNum !== null && (colNum < 0 || colNum > info.cols)) {
      this.helper.addError(
        line,
        column,
        `${operation}: column index ${colNum} is out of bounds for matrix with ${info.cols} columns`,
        'PSV6-MATRIX-INDEX-OUT-OF-BOUNDS',
      );
    }
  }

  private validateCovarianceDimensions(
    arg1: ArgumentNode,
    arg2: ArgumentNode,
    line: number,
    column: number
  ): void {
    const matrix1Name = arg1.value.kind === 'Identifier' ? (arg1.value as IdentifierNode).name : null;
    const matrix2Name = arg2.value.kind === 'Identifier' ? (arg2.value as IdentifierNode).name : null;
    
    if (!matrix1Name || !matrix2Name) return;
    
    const info1 = this.matrixDeclarations.get(matrix1Name);
    const info2 = this.matrixDeclarations.get(matrix2Name);
    
    if (info1 && info2) {
      const size1 = info1.rows !== null && info1.cols !== null ? info1.rows * info1.cols : null;
      const size2 = info2.rows !== null && info2.cols !== null ? info2.rows * info2.cols : null;
      
      if (size1 !== null && size2 !== null && size1 !== size2) {
        this.helper.addWarning(
          line,
          column,
          `Covariance calculation: matrices should have the same number of elements for meaningful results`,
          'PSV6-MATRIX-COVARIANCE-SIZE',
        );
      }
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

    this.helper.addError(line, column, `Variable '${name}' is not declared as a matrix`, 'PSV6-MATRIX-NOT-MATRIX');
    return name;
  }

  private validateMatrixIndexAst(name: string, rowArg: ArgumentNode, colArg: ArgumentNode, line: number, column: number): void {
    const info = this.matrixDeclarations.get(name);
    if (!info) {
      return;
    }

    const rowValue = this.extractNumericLiteral(rowArg.value);
    if (rowValue !== null && info.rows !== null && (rowValue < 0 || rowValue >= info.rows)) {
      this.helper.addWarning(
        line,
        column,
        `Matrix row index ${rowValue} is out of bounds for matrix with ${info.rows} rows`,
        'PSV6-MATRIX-INDEX-BOUNDS',
      );
    }

    const colValue = this.extractNumericLiteral(colArg.value);
    if (colValue !== null && info.cols !== null && (colValue < 0 || colValue >= info.cols)) {
      this.helper.addWarning(
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
    
    // For matrix.fill(), an array parameter is acceptable (it will fill the matrix with array values)
    if (operation === 'fill' && valueType === 'array') {
      return; // Array is valid for fill operation
    }
    
    if (!this.areTypesCompatible(info.elementType, valueType)) {
      const action = operation === 'set' ? 'set' : 'fill';
      this.helper.addError(
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
    if (!VALID_MATRIX_ELEMENT_TYPES.has(type) && !this.context.typeMap.has(type)) {
      this.helper.addError(
        line,
        column,
        `Invalid matrix type: ${type}. Valid types are: ${Array.from(VALID_MATRIX_ELEMENT_TYPES).join(', ')}, or user-defined types`,
        'PSV6-MATRIX-INVALID-TYPE',
      );
    }
  }

  private validateMatrixDimensions(rows: number, cols: number, line: number, column: number): void {
    if (rows <= 0 || cols <= 0) {
      this.helper.addError(line, column, `Matrix dimensions must be positive, got: ${rows}x${cols}`, 'PSV6-MATRIX-INVALID-DIMENSIONS');
      return;
    }

    if (rows > 1000 || cols > 1000) {
      this.helper.addError(
        line,
        column,
        `Matrix dimensions (${rows}x${cols}) exceed the maximum limit of 1000 for a single dimension`,
        'PSV6-MATRIX-DIMENSION-LIMIT',
      );
    }
  }

  private validateMatrixPerformanceAst(): void {
    if (this.matrixAllocations > 5) {
      this.helper.addWarning(
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
          this.helper.addWarning(
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
        this.helper.addInfo(
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
        this.helper.addInfo(
          info.line,
          info.column,
          `Matrix '${name}' is declared but never initialized. Consider adding initial values.`,
          'PSV6-MATRIX-INITIALIZATION-SUGGESTION',
        );
        continue;
      }

      const hasInitialization = [...usage.sets, ...usage.fills].some((usageLine) => usageLine >= info.line);
      if (!hasInitialization) {
        this.helper.addInfo(
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
        this.helper.addInfo(
          info.line,
          info.column,
          `Matrix '${name}' is modified but never reset. Consider using matrix.fill() or recreating the matrix to manage memory.`,
          'PSV6-MATRIX-MEMORY-SUGGESTION',
        );
      }
    }
  }


  private getAstContext(
    context: ValidationContext,
    config: ValidatorConfig,
  ): AstValidationContext | null {
    return ensureAstContext(context, config);
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

    const source = getNodeSource(this.context, type).trim();
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
      case 'UnaryExpression': {
        // Handle negative/positive numbers like -5.0
        const unary = expression as UnaryExpressionNode;
        if (unary.operator === '-' || unary.operator === '+') {
          return this.inferExpressionTypeAst(unary.argument);
        }
        return 'unknown';
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

        // Handle array functions that return arrays
        if (qualified.startsWith('array.')) {
          const arrayCreators = ['array.new', 'array.from', 'array.from_example', 'array.copy', 'array.slice', 'array.concat'];
          if (arrayCreators.some(creator => qualified.startsWith(creator))) {
            return 'array';
          }
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
          return getNodeSource(this.context, member);
        }
        const objectText = this.getExpressionText(member.object);
        return `${objectText}.${member.property.name}`;
      }
      default:
        return getNodeSource(this.context, expression);
    }
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
