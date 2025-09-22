import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { ArrayValidator } from '../../modules/array-validator';
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

class ArrayValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new ArrayValidator());
  }

  protected runCoreValidation(): void {}
}

describe('ArrayValidator (AST)', () => {
  it('reports type mismatches when pushing incompatible values', () => {
    const arrayIdentifier = createIdentifier('array', 8, 1);
    const newFloatIdentifier = createIdentifier('new_float', 14, 1);
    const arrayNewCallee = createMemberExpression(arrayIdentifier, newFloatIdentifier, 8, 23, 1);

    const sizeLiteral = createNumberLiteral(5, '5', 24, 1);
    const sizeArgument = createArgument(sizeLiteral, 24, 25, 1);
    const newCall = createCallExpression(arrayNewCallee, [sizeArgument], 8, 26, 1);

    const arrIdentifier = createIdentifier('arr', 4, 1);
    const declaration = createVariableDeclaration(arrIdentifier, 0, 26, 1, {
      declarationKind: 'var',
      initializer: newCall,
    });

    const arrayNamespace = createIdentifier('array', 2, 2);
    const pushIdentifier = createIdentifier('push', 8, 2);
    const pushCallee = createMemberExpression(arrayNamespace, pushIdentifier, 2, 12, 2);

    const arrArgumentValue = createIdentifier('arr', 13, 2);
    const arrArgument = createArgument(arrArgumentValue, 13, 16, 2);
    const stringLiteral = createStringLiteral('oops', '"oops"', 18, 2);
    const stringArgument = createArgument(stringLiteral, 18, 24, 2);
    const pushCall = createCallExpression(pushCallee, [arrArgument, stringArgument], 2, 25, 2);
    const pushStatement = createExpressionStatement(pushCall, 2, 25, 2);

    const program = createProgram([declaration, pushStatement], 0, 25, 1, 2);
    const source = 'var arr = array.new_float(5)\narray.push(arr, "oops")';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new ArrayValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-ARRAY-TYPE-MISMATCH');
  });

  it('flags invalid parameter counts on array helpers', () => {
    const arrayIdentifier = createIdentifier('array', 8, 1);
    const newFloatIdentifier = createIdentifier('new_float', 14, 1);
    const arrayNewCallee = createMemberExpression(arrayIdentifier, newFloatIdentifier, 8, 23, 1);

    const sizeLiteral = createNumberLiteral(1, '1', 24, 1);
    const sizeArgument = createArgument(sizeLiteral, 24, 25, 1);
    const newCall = createCallExpression(arrayNewCallee, [sizeArgument], 8, 26, 1);

    const arrIdentifier = createIdentifier('arr', 4, 1);
    const declaration = createVariableDeclaration(arrIdentifier, 0, 26, 1, {
      declarationKind: 'var',
      initializer: newCall,
    });

    const arrayNamespace = createIdentifier('array', 2, 2);
    const popIdentifier = createIdentifier('pop', 8, 2);
    const popCallee = createMemberExpression(arrayNamespace, popIdentifier, 2, 10, 2);

    const arrArgumentValue = createIdentifier('arr', 11, 2);
    const arrArgument = createArgument(arrArgumentValue, 11, 14, 2);
    const extraLiteral = createNumberLiteral(1, '1', 16, 2);
    const extraArgument = createArgument(extraLiteral, 16, 17, 2);
    const popCall = createCallExpression(popCallee, [arrArgument, extraArgument], 2, 18, 2);
    const popStatement = createExpressionStatement(popCall, 2, 18, 2);

    const program = createProgram([declaration, popStatement], 0, 18, 1, 2);
    const source = 'var arr = array.new_float(1)\narray.pop(arr, 1)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new ArrayValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-ARRAY-METHOD-PARAMS');
  });

  it('warns about expensive array operations running inside loops', () => {
    const arrayIdentifier = createIdentifier('array', 8, 1);
    const newFloatIdentifier = createIdentifier('new_float', 14, 1);
    const arrayNewCallee = createMemberExpression(arrayIdentifier, newFloatIdentifier, 8, 23, 1);

    const sizeLiteral = createNumberLiteral(1, '1', 24, 1);
    const sizeArgument = createArgument(sizeLiteral, 24, 25, 1);
    const newCall = createCallExpression(arrayNewCallee, [sizeArgument], 8, 26, 1);

    const arrIdentifier = createIdentifier('arr', 4, 1);
    const declaration = createVariableDeclaration(arrIdentifier, 0, 26, 1, {
      declarationKind: 'var',
      initializer: newCall,
    });

    const arrayNamespace = createIdentifier('array', 6, 3);
    const sortIdentifier = createIdentifier('sort', 12, 3);
    const sortCallee = createMemberExpression(arrayNamespace, sortIdentifier, 6, 16, 3);

    const arrArgumentValue = createIdentifier('arr', 17, 3);
    const arrArgument = createArgument(arrArgumentValue, 17, 20, 3);
    const sortCall = createCallExpression(sortCallee, [arrArgument], 6, 21, 3);
    const sortStatement = createExpressionStatement(sortCall, 6, 21, 3);
    const loopBody = createBlock([sortStatement], 6, 21, 3, 3);

    const loop = createForStatement(null, null, null, loopBody, 0, 21, 2);
    const program = createProgram([declaration, loop], 0, 21, 1, 3);
    const source = 'var arr = array.new_float(1)\nfor i = 0 to 1\n    array.sort(arr)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new ArrayValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-ARRAY-PERF-LOOP');
  });
});

