import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { MapValidator } from '../../modules/map-validator';
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

class MapValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new MapValidator());
  }

  protected runCoreValidation(): void {}
}

class MapValidatorDisabledHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new MapValidator());
  }

  protected runCoreValidation(): void {}
}

describe('MapValidator (AST)', () => {
  it('reports type mismatches when putting incompatible values', () => {
    const mapNamespace = createIdentifier('map', 12, 1);
    const newIdentifier = createIdentifier('new', 16, 1);
    const mapNewCallee = createMemberExpression(mapNamespace, newIdentifier, 12, 19, 1);
    const mapNewCall = createCallExpression(mapNewCallee, [], 12, 33, 1);

    const mapIdentifier = createIdentifier('myMap', 5, 1);
    const declaration = createVariableDeclaration(mapIdentifier, 0, 33, 1, {
      declarationKind: 'var',
      initializer: mapNewCall,
    });

    const mapPutNamespace = createIdentifier('map', 1, 2);
    const putIdentifier = createIdentifier('put', 5, 2);
    const mapPutCallee = createMemberExpression(mapPutNamespace, putIdentifier, 1, 8, 2);

    const mapArgValue = createIdentifier('myMap', 9, 2);
    const mapArgument = createArgument(mapArgValue, 9, 14, 2);
    const keyLiteral = createStringLiteral('key', '"key"', 16, 2);
    const keyArgument = createArgument(keyLiteral, 16, 21, 2);
    const valueLiteral = createNumberLiteral(1, '1', 23, 2);
    const valueArgument = createArgument(valueLiteral, 23, 24, 2);
    const mapPutCall = createCallExpression(mapPutCallee, [mapArgument, keyArgument, valueArgument], 1, 24, 2);
    const mapPutStatement = createExpressionStatement(mapPutCall, 1, 24, 2);

    const program = createProgram([declaration, mapPutStatement], 0, 24, 1, 2);
    const source = 'var myMap = map.new<string>()\nmap.put(myMap, "key", 1)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new MapValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-MAP-VALUE-TYPE-MISMATCH');
  });

  it('requires map arguments for size helper', () => {
    const mapNamespace = createIdentifier('map', 1, 1);
    const sizeIdentifier = createIdentifier('size', 5, 1);
    const sizeCallee = createMemberExpression(mapNamespace, sizeIdentifier, 1, 9, 1);
    const sizeCall = createCallExpression(sizeCallee, [], 1, 11, 1);
    const sizeStatement = createExpressionStatement(sizeCall, 1, 11, 1);

    const program = createProgram([sizeStatement], 0, 11, 1, 1);
    const source = 'map.size()';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new MapValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-MAP-METHOD-PARAMS');
  });

  it('warns about map operations executed inside loops', () => {
    const mapNamespace = createIdentifier('map', 12, 1);
    const newIdentifier = createIdentifier('new', 16, 1);
    const mapNewCallee = createMemberExpression(mapNamespace, newIdentifier, 12, 19, 1);
    const mapNewCall = createCallExpression(mapNewCallee, [], 12, 33, 1);

    const mapIdentifier = createIdentifier('myMap', 5, 1);
    const declaration = createVariableDeclaration(mapIdentifier, 0, 33, 1, {
      declarationKind: 'var',
      initializer: mapNewCall,
    });

    const mapPutNamespace = createIdentifier('map', 6, 3);
    const putIdentifier = createIdentifier('put', 10, 3);
    const mapPutCallee = createMemberExpression(mapPutNamespace, putIdentifier, 6, 13, 3);

    const mapArgValue = createIdentifier('myMap', 14, 3);
    const mapArgument = createArgument(mapArgValue, 14, 19, 3);
    const keyLiteral = createStringLiteral('key', '"key"', 21, 3);
    const keyArgument = createArgument(keyLiteral, 21, 26, 3);
    const valueLiteral = createStringLiteral('value', '"value"', 28, 3);
    const valueArgument = createArgument(valueLiteral, 28, 35, 3);
    const mapPutCall = createCallExpression(mapPutCallee, [mapArgument, keyArgument, valueArgument], 6, 36, 3);
    const mapPutStatement = createExpressionStatement(mapPutCall, 6, 36, 3);
    const loopBody = createBlock([mapPutStatement], 6, 36, 3, 3);

    const loop = createForStatement(null, null, null, loopBody, 0, 36, 2);
    const program = createProgram([declaration, loop], 0, 36, 1, 3);
    const source = 'var myMap = map.new<string>()\nfor i = 0 to 1\n    map.put(myMap, "key", "value")';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new MapValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-MAP-PERF-LOOP');
  });

  it('returns no diagnostics when AST mode is disabled', () => {
    const harness = new MapValidatorDisabledHarness();

    const result = harness.validate('map.size()');

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });
});
