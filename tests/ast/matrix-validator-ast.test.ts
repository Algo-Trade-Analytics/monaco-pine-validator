import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { MatrixValidator } from '../../modules/matrix-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createBlock,
  createCallExpression,
  createExpressionStatement,
  createForStatement,
  createIdentifier,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
  createVariableDeclaration,
} from './fixtures';

class MatrixValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new MatrixValidator());
  }

  protected runCoreValidation(): void {}
}

describe('MatrixValidator (AST)', () => {
  it('reports type mismatches when setting incompatible values', () => {
    const matrixIdentifier = createIdentifier('matrix', 10, 1);
    const newIdentifier = createIdentifier('new', 17, 1);
    const matrixNewCallee = createMemberExpression(matrixIdentifier, newIdentifier, 10, 20, 1);

    const typeLiteral = createStringLiteral('float', '"float"', 21, 1);
    const typeArgument = createArgument(typeLiteral, 21, 28, 1);
    const rowLiteral = createNumberLiteral(2, '2', 30, 1);
    const rowArgument = createArgument(rowLiteral, 30, 31, 1);
    const colLiteral = createNumberLiteral(2, '2', 33, 1);
    const colArgument = createArgument(colLiteral, 33, 34, 1);
    const newCall = createCallExpression(matrixNewCallee, [typeArgument, rowArgument, colArgument], 10, 35, 1);

    const matIdentifier = createIdentifier('mat', 4, 1);
    const declaration = createVariableDeclaration(matIdentifier, 0, 35, 1, {
      declarationKind: 'var',
      initializer: newCall,
    });

    const matrixNamespace = createIdentifier('matrix', 0, 2);
    const setIdentifier = createIdentifier('set', 7, 2);
    const setCallee = createMemberExpression(matrixNamespace, setIdentifier, 0, 10, 2);

    const matArgumentValue = createIdentifier('mat', 11, 2);
    const matArgument = createArgument(matArgumentValue, 11, 14, 2);
    const rowZeroLiteral = createNumberLiteral(0, '0', 16, 2);
    const rowZeroArgument = createArgument(rowZeroLiteral, 16, 17, 2);
    const colZeroLiteral = createNumberLiteral(0, '0', 19, 2);
    const colZeroArgument = createArgument(colZeroLiteral, 19, 20, 2);
    const stringLiteral = createStringLiteral('oops', '"oops"', 22, 2);
    const stringArgument = createArgument(stringLiteral, 22, 28, 2);
    const setCall = createCallExpression(setCallee, [matArgument, rowZeroArgument, colZeroArgument, stringArgument], 0, 29, 2);
    const setStatement = createExpressionStatement(setCall, 0, 29, 2);

    const program = createProgram([declaration, setStatement], 0, 29, 1, 2);
    const source = 'var mat = matrix.new("float", 2, 2)\nmatrix.set(mat, 0, 0, "oops")';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new MatrixValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-MATRIX-TYPE-MISMATCH');
  });

  it('flags invalid parameter counts on matrix helpers', () => {
    const matrixIdentifier = createIdentifier('matrix', 10, 1);
    const newIdentifier = createIdentifier('new', 17, 1);
    const matrixNewCallee = createMemberExpression(matrixIdentifier, newIdentifier, 10, 20, 1);

    const typeLiteral = createStringLiteral('float', '"float"', 21, 1);
    const typeArgument = createArgument(typeLiteral, 21, 28, 1);
    const rowLiteral = createNumberLiteral(2, '2', 30, 1);
    const rowArgument = createArgument(rowLiteral, 30, 31, 1);
    const colLiteral = createNumberLiteral(2, '2', 33, 1);
    const colArgument = createArgument(colLiteral, 33, 34, 1);
    const newCall = createCallExpression(matrixNewCallee, [typeArgument, rowArgument, colArgument], 10, 35, 1);

    const matIdentifier = createIdentifier('mat', 4, 1);
    const declaration = createVariableDeclaration(matIdentifier, 0, 35, 1, {
      declarationKind: 'var',
      initializer: newCall,
    });

    const matrixNamespace = createIdentifier('matrix', 0, 2);
    const getIdentifier = createIdentifier('get', 7, 2);
    const getCallee = createMemberExpression(matrixNamespace, getIdentifier, 0, 10, 2);

    const matArgumentValue = createIdentifier('mat', 11, 2);
    const matArgument = createArgument(matArgumentValue, 11, 14, 2);
    const rowZeroLiteral = createNumberLiteral(0, '0', 16, 2);
    const rowZeroArgument = createArgument(rowZeroLiteral, 16, 17, 2);
    const getCall = createCallExpression(getCallee, [matArgument, rowZeroArgument], 0, 18, 2);
    const getStatement = createExpressionStatement(getCall, 0, 18, 2);

    const program = createProgram([declaration, getStatement], 0, 18, 1, 2);
    const source = 'var mat = matrix.new("float", 2, 2)\nmatrix.get(mat, 0)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new MatrixValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-MATRIX-METHOD-PARAMS');
  });

  it('warns about expensive matrix operations running inside loops', () => {
    const matrixIdentifier = createIdentifier('matrix', 10, 1);
    const newIdentifier = createIdentifier('new', 17, 1);
    const matrixNewCallee = createMemberExpression(matrixIdentifier, newIdentifier, 10, 20, 1);

    const typeLiteral = createStringLiteral('float', '"float"', 21, 1);
    const typeArgument = createArgument(typeLiteral, 21, 28, 1);
    const rowLiteral = createNumberLiteral(2, '2', 30, 1);
    const rowArgument = createArgument(rowLiteral, 30, 31, 1);
    const colLiteral = createNumberLiteral(2, '2', 33, 1);
    const colArgument = createArgument(colLiteral, 33, 34, 1);
    const newCall = createCallExpression(matrixNewCallee, [typeArgument, rowArgument, colArgument], 10, 35, 1);

    const matIdentifier = createIdentifier('mat', 4, 1);
    const declaration = createVariableDeclaration(matIdentifier, 0, 35, 1, {
      declarationKind: 'var',
      initializer: newCall,
    });

    const matrixNamespace = createIdentifier('matrix', 4, 3);
    const fillIdentifier = createIdentifier('fill', 11, 3);
    const fillCallee = createMemberExpression(matrixNamespace, fillIdentifier, 4, 15, 3);

    const matArgumentValue = createIdentifier('mat', 16, 3);
    const matArgument = createArgument(matArgumentValue, 16, 19, 3);
    const zeroLiteral = createNumberLiteral(0, '0', 21, 3);
    const zeroArgument = createArgument(zeroLiteral, 21, 22, 3);
    const fillCall = createCallExpression(fillCallee, [matArgument, zeroArgument], 4, 23, 3);
    const fillStatement = createExpressionStatement(fillCall, 4, 23, 3);
    const loopBody = createBlock([fillStatement], 4, 23, 3, 3);

    const loop = createForStatement(null, null, null, loopBody, 0, 23, 2);
    const program = createProgram([declaration, loop], 0, 23, 1, 3);
    const source = 'var mat = matrix.new("float", 2, 2)\nfor i = 0 to 1\n    matrix.fill(mat, 0)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new MatrixValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-MATRIX-PERF-LOOP');
  });
});
