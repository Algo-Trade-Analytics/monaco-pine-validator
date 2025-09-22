import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { PolylineFunctionsValidator } from '../../modules/polyline-functions-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createCallExpression,
  createExpressionStatement,
  createIdentifier,
  createMemberExpression,
  createProgram,
  createVariableDeclaration,
} from './fixtures';

class PolylineValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new PolylineFunctionsValidator());
  }

  protected runCoreValidation(): void {}
}

describe('PolylineFunctionsValidator (AST)', () => {
  it('reports missing points argument for polyline.new', () => {
    const source = 'polyline.new()';
    const polylineIdentifier = createIdentifier('polyline', source.indexOf('polyline'), 1);
    const newIdentifier = createIdentifier('new', source.indexOf('new'), 1);
    const callee = createMemberExpression(
      polylineIdentifier,
      newIdentifier,
      source.indexOf('polyline'),
      source.indexOf('new') + 'new'.length,
      1,
    );

    const call = createCallExpression(callee, [], 0, source.length, 1);
    const statement = createExpressionStatement(call, 0, source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new PolylineValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-POLYLINE-NEW-PARAMS');
  });

  it('warns about deleting unknown polyline identifiers', () => {
    const source = 'polyline.delete(foo)';
    const polylineIdentifier = createIdentifier('polyline', source.indexOf('polyline'), 1);
    const deleteIdentifier = createIdentifier('delete', source.indexOf('delete'), 1);
    const callee = createMemberExpression(
      polylineIdentifier,
      deleteIdentifier,
      source.indexOf('polyline'),
      source.indexOf('delete') + 'delete'.length,
      1,
    );

    const fooIdentifier = createIdentifier('foo', source.indexOf('foo'), 1);
    const fooArgument = createArgument(
      fooIdentifier,
      source.indexOf('foo'),
      source.indexOf('foo') + 'foo'.length,
      1,
    );

    const call = createCallExpression(callee, [fooArgument], 0, source.length, 1);
    const statement = createExpressionStatement(call, 0, source.length, 1);
    const program = createProgram([statement], 0, source.length, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new PolylineValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-POLYLINE-ID-UNKNOWN');
  });

  it('tracks polyline ids created via assignments and recognises lifecycle patterns', () => {
    const source = 'var id = polyline.new(points)\npolyline.delete(id)';

    const newPolylineIdentifier = createIdentifier('polyline', source.indexOf('polyline'), 1);
    const newIdentifier = createIdentifier('new', source.indexOf('new'), 1);
    const newCallee = createMemberExpression(
      newPolylineIdentifier,
      newIdentifier,
      source.indexOf('polyline'),
      source.indexOf('new') + 'new'.length,
      1,
    );

    const pointsIdentifier = createIdentifier('points', source.indexOf('points'), 1);
    const pointsArgument = createArgument(
      pointsIdentifier,
      source.indexOf('points'),
      source.indexOf('points') + 'points'.length,
      1,
    );

    const newCall = createCallExpression(
      newCallee,
      [pointsArgument],
      source.indexOf('polyline'),
      source.indexOf(')') + 1,
      1,
    );

    const idIdentifier = createIdentifier('id', source.indexOf('id'), 1);
    const declaration = createVariableDeclaration(idIdentifier, 0, source.indexOf(')') + 1, 1, {
      declarationKind: 'var',
      initializer: newCall,
    });

    const newlineIndex = source.indexOf('\n');
    const deletePolylineIdentifier = createIdentifier('polyline', source.indexOf('polyline', newlineIndex + 1), 2);
    const deleteIdentifier = createIdentifier('delete', source.indexOf('delete'), 2);
    const deleteCallee = createMemberExpression(
      deletePolylineIdentifier,
      deleteIdentifier,
      source.indexOf('polyline', newlineIndex + 1),
      source.indexOf('delete') + 'delete'.length,
      2,
    );

    const idUsageIdentifier = createIdentifier('id', source.lastIndexOf('id'), 2);
    const idArgument = createArgument(
      idUsageIdentifier,
      source.lastIndexOf('id'),
      source.lastIndexOf('id') + 'id'.length,
      2,
    );

    const deleteCall = createCallExpression(
      deleteCallee,
      [idArgument],
      source.indexOf('polyline', newlineIndex + 1),
      source.length,
      2,
    );
    const deleteStatement = createExpressionStatement(
      deleteCall,
      source.indexOf('polyline', newlineIndex + 1),
      source.length,
      2,
    );

    const program = createProgram([declaration, deleteStatement], 0, source.length, 1, 2);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new PolylineValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);
    const infoCodes = result.info.map((info) => info.code);

    expect(result.typeMap.has('id')).toBe(true);
    expect(warningCodes).not.toContain('PSV6-POLYLINE-ID-UNKNOWN');
    expect(infoCodes).toContain('PSV6-POLYLINE-BEST-PRACTICE');
  });
});
