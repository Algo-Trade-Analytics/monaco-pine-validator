import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { UDTValidator } from '../../modules/udt-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import type { AstValidationContext } from '../../core/types';
import {
  createArgument,
  createBlock,
  createCallExpression,
  createExpressionStatement,
  createFunctionDeclaration,
  createIdentifier,
  createMemberExpression,
  createNumberLiteral,
  createParameter,
  createProgram,
  createTypeDeclaration,
  createTypeField,
  createTypeReference,
  createVariableDeclaration,
} from './fixtures';

class UdtValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new UDTValidator());
  }

  protected runCoreValidation(): void {}

  exposeContext(): AstValidationContext {
    return this.context as AstValidationContext;
  }
}

class DisabledUdtValidatorHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new UDTValidator());
  }

  protected runCoreValidation(): void {}
}

describe('UDTValidator (AST)', () => {
  it('returns no diagnostics when AST mode is disabled', () => {
    const harness = new DisabledUdtValidatorHarness();
    const result = harness.validate('type Point\n    float x');

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });

  it('reports duplicate type declarations', () => {
    const pointIdentifier = createIdentifier('Point', 0, 1);
    const floatReference = createTypeReference('float', 5, 2);
    const xField = createTypeField(createIdentifier('x', 11, 2), floatReference, 5, 12, 2, 2);
    const firstDeclaration = createTypeDeclaration(pointIdentifier, [xField], 0, 15, 1, 2);

    const secondIdentifier = createIdentifier('Point', 0, 4);
    const yField = createTypeField(createIdentifier('y', 11, 5), floatReference, 5, 12, 5, 5);
    const secondDeclaration = createTypeDeclaration(secondIdentifier, [yField], 0, 15, 4, 5);

    const program = createProgram([firstDeclaration, secondDeclaration], 0, 15, 1, 5);
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new UdtValidatorHarness(service);

    const result = harness.validate('');
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-UDT-DUPLICATE');
  });

  it('warns for empty type declarations', () => {
    const emptyIdentifier = createIdentifier('Shape', 0, 1);
    const declaration = createTypeDeclaration(emptyIdentifier, [], 0, 5, 1, 1);
    const program = createProgram([declaration], 0, 5, 1, 1);
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new UdtValidatorHarness(service);

    const result = harness.validate('');
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-UDT-EMPTY');
  });

  it("flags methods that don't declare 'this' as the first parameter", () => {
    const pointIdentifier = createIdentifier('Point', 0, 1);
    const floatReference = createTypeReference('float', 5, 2);
    const xField = createTypeField(createIdentifier('x', 11, 2), floatReference, 5, 12, 2, 2);
    const declaration = createTypeDeclaration(pointIdentifier, [xField], 0, 12, 1, 2);

    const methodIdentifier = createIdentifier('Point.move', 0, 4);
    const dxParam = createParameter('dx', 12, 4);
    const methodBody = createBlock([], 0, 0, 5, 5);
    const method = createFunctionDeclaration(methodIdentifier, [dxParam], methodBody, 0, 0, 4);

    const program = createProgram([declaration, method], 0, 12, 1, 5);
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new UdtValidatorHarness(service);

    const result = harness.validate('');
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-METHOD-THIS');
  });

  it("suggests annotating 'this' parameters without explicit types", () => {
    const pointIdentifier = createIdentifier('Point', 0, 1);
    const floatReference = createTypeReference('float', 5, 2);
    const xField = createTypeField(createIdentifier('x', 11, 2), floatReference, 5, 12, 2, 2);
    const declaration = createTypeDeclaration(pointIdentifier, [xField], 0, 12, 1, 2);

    const methodIdentifier = createIdentifier('Point.move', 0, 4);
    const thisParam = createParameter('this', 12, 4);
    const dxParam = createParameter('dx', 17, 4);
    const methodBody = createBlock([], 0, 0, 5, 5);
    const method = createFunctionDeclaration(methodIdentifier, [thisParam, dxParam], methodBody, 0, 0, 4);

    const program = createProgram([declaration, method], 0, 12, 1, 5);
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new UdtValidatorHarness(service);

    const result = harness.validate('');
    const infoCodes = result.info.map((info) => info.code);

    expect(infoCodes).toContain('PSV6-METHOD-TYPE');
  });

  it('reports invalid field access on user-defined types', () => {
    const pointIdentifier = createIdentifier('Point', 0, 1);
    const floatReference = createTypeReference('float', 5, 2);
    const xField = createTypeField(createIdentifier('x', 11, 2), floatReference, 5, 12, 2, 2);
    const declaration = createTypeDeclaration(pointIdentifier, [xField], 0, 12, 1, 2);

    const pointVarIdentifier = createIdentifier('point', 0, 3);
    const namespaceIdentifier = createIdentifier('Point', 12, 3);
    const constructorIdentifier = createIdentifier('new', 18, 3);
    const constructorCallee = createMemberExpression(namespaceIdentifier, constructorIdentifier, 12, 21, 3);
    const xValue = createNumberLiteral(1, '1', 22, 3);
    const yValue = createNumberLiteral(2, '2', 25, 3);
    const constructorCall = createCallExpression(
      constructorCallee,
      [
        createArgument(xValue, 22, 23, 3),
        createArgument(yValue, 25, 26, 3),
      ],
      12,
      27,
      3,
    );
    const pointDeclaration = createVariableDeclaration(pointVarIdentifier, 0, 27, 3, {
      typeAnnotation: createTypeReference('Point', 6, 3),
      initializer: constructorCall,
    });

    const member = createMemberExpression(pointVarIdentifier, createIdentifier('y', 0, 4), 0, 5, 4);
    const accessStatement = createExpressionStatement(member, 0, 5, 4);

    const program = createProgram([declaration, pointDeclaration, accessStatement], 0, 27, 1, 4);
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new UdtValidatorHarness(service);

    const result = harness.validate('');
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-UDT-FIELD-NOT-FOUND');
  });

  it('warns about method calls on primitive identifiers', () => {
    const pointIdentifier = createIdentifier('Point', 0, 1);
    const floatReference = createTypeReference('float', 5, 2);
    const xField = createTypeField(createIdentifier('x', 11, 2), floatReference, 5, 12, 2, 2);
    const declaration = createTypeDeclaration(pointIdentifier, [xField], 0, 12, 1, 2);

    const counterIdentifier = createIdentifier('count', 0, 3);
    const counterDeclaration = createVariableDeclaration(counterIdentifier, 0, 10, 3, {
      typeAnnotation: createTypeReference('int', 6, 3),
      initializer: createNumberLiteral(0, '0', 9, 3),
    });

    const methodCallee = createMemberExpression(counterIdentifier, createIdentifier('move', 12, 4), 0, 16, 4);
    const methodCall = createCallExpression(methodCallee, [], 0, 18, 4);
    const methodStatement = createExpressionStatement(methodCall, 0, 18, 4);

    const program = createProgram([declaration, counterDeclaration, methodStatement], 0, 18, 1, 4);
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new UdtValidatorHarness(service);

    const result = harness.validate('');
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-METHOD-INVALID');
  });

  it('validates UDTs with generic type parameters in matrix declarations', () => {
    const point3DType = createTypeDeclaration(
      createIdentifier('Point3D', 0, 1),
      [
        createTypeField(createIdentifier('x', 0, 2), createTypeReference(createIdentifier('float', 0, 2), [])),
        createTypeField(createIdentifier('y', 0, 3), createTypeReference(createIdentifier('float', 0, 3), [])),
        createTypeField(createIdentifier('z', 0, 4), createTypeReference(createIdentifier('float', 0, 4), [])),
      ],
      0, 1
    );

    const matrixDecl = createVariableDeclaration(
      'simple',
      createIdentifier('M', 0, 5),
      createTypeReference(createIdentifier('matrix', 0, 5), [
        createTypeReference(createIdentifier('Point3D', 0, 5), [])
      ]),
      createCallExpression(
        createMemberExpression(createIdentifier('matrix', 0, 5), createIdentifier('new', 0, 5)),
        [
          createArgument(createNumberLiteral(10, 0, 5)),
          createArgument(createNumberLiteral(10, 0, 5)),
        ],
        0, 5
      ),
      '=',
      0, 5
    );

    const program = createProgram([point3DType, matrixDecl], 0, 24, 1, 1);
    const source = [
      'type Point3D',
      '    float x',
      '    float y',
      '    float z',
      'matrix<Point3D> M = matrix.new<Point3D>(10, 10)',
    ].join('\n');
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new UdtValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((message) => message.code);

    // Should not have UDT-related errors
    expect(errorCodes).not.toContain('PSV6-ENUM-UNDEFINED-TYPE');
    expect(errorCodes).not.toContain('PSU02');
  });

  it('validates UDTs in method parameter type annotations', () => {
    const point3DType = createTypeDeclaration(
      createIdentifier('Point3D', 0, 1),
      [
        createTypeField(createIdentifier('x', 0, 2), createTypeReference(createIdentifier('float', 0, 2), [])),
        createTypeField(createIdentifier('y', 0, 3), createTypeReference(createIdentifier('float', 0, 3), [])),
        createTypeField(createIdentifier('z', 0, 4), createTypeReference(createIdentifier('float', 0, 4), [])),
      ],
      0, 1
    );

    const cameraType = createTypeDeclaration(
      createIdentifier('Camera', 0, 5),
      [
        createTypeField(createIdentifier('anchorX', 0, 6), createTypeReference(createIdentifier('int', 0, 6), [])),
        createTypeField(createIdentifier('anchorY', 0, 7), createTypeReference(createIdentifier('float', 0, 7), [])),
      ],
      0, 5
    );

    const methodDecl = createFunctionDeclaration(
      createIdentifier('project', 0, 8),
      [
        createParameter(
          createIdentifier('this', 0, 8),
          createTypeReference(createIdentifier('Point3D', 0, 8), []),
          null
        ),
        createParameter(
          createIdentifier('cam', 0, 8),
          createTypeReference(createIdentifier('Camera', 0, 8), []),
          null
        ),
      ],
      createBlock([
        createExpressionStatement(createIdentifier('chart.point.from_index(0, 0)', 0, 9))
      ], 0, 9),
      null,
      0, 8
    );

    const program = createProgram([point3DType, cameraType, methodDecl], 0, 24, 1, 1);
    const source = [
      'type Point3D',
      '    float x',
      '    float y',
      '    float z',
      'type Camera',
      '    int anchorX',
      '    float anchorY',
      'method project(this<Point3D>, Camera cam) =>',
      '    chart.point.from_index(0, 0)',
    ].join('\n');
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new UdtValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((message) => message.code);

    // Should not have UDT-related errors
    expect(errorCodes).not.toContain('PSV6-ENUM-UNDEFINED-TYPE');
    expect(errorCodes).not.toContain('PSU02');
  });

  it('validates UDTs in array declarations with generic types', () => {
    const point3DType = createTypeDeclaration(
      createIdentifier('Point3D', 0, 1),
      [
        createTypeField(createIdentifier('x', 0, 2), createTypeReference(createIdentifier('float', 0, 2), [])),
        createTypeField(createIdentifier('y', 0, 3), createTypeReference(createIdentifier('float', 0, 3), [])),
        createTypeField(createIdentifier('z', 0, 4), createTypeReference(createIdentifier('float', 0, 4), [])),
      ],
      0, 1
    );

    const arrayDecl = createVariableDeclaration(
      'simple',
      createIdentifier('points', 0, 5),
      createTypeReference(createIdentifier('array', 0, 5), [
        createTypeReference(createIdentifier('Point3D', 0, 5), [])
      ]),
      createCallExpression(
        createMemberExpression(createIdentifier('array', 0, 5), createIdentifier('new', 0, 5)),
        [],
        0, 5
      ),
      '=',
      0, 5
    );

    const program = createProgram([point3DType, arrayDecl], 0, 24, 1, 1);
    const source = [
      'type Point3D',
      '    float x',
      '    float y',
      '    float z',
      'array<Point3D> points = array.new<Point3D>()',
    ].join('\n');
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new UdtValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((message) => message.code);

    // Should not have UDT-related errors
    expect(errorCodes).not.toContain('PSV6-ENUM-UNDEFINED-TYPE');
    expect(errorCodes).not.toContain('PSU02');
  });

  it('validates UDTs in function return type annotations', () => {
    const point3DType = createTypeDeclaration(
      createIdentifier('Point3D', 0, 1),
      [
        createTypeField(createIdentifier('x', 0, 2), createTypeReference(createIdentifier('float', 0, 2), [])),
        createTypeField(createIdentifier('y', 0, 3), createTypeReference(createIdentifier('float', 0, 3), [])),
        createTypeField(createIdentifier('z', 0, 4), createTypeReference(createIdentifier('float', 0, 4), [])),
      ],
      0, 1
    );

    const functionDecl = createFunctionDeclaration(
      createIdentifier('createPoint', 0, 5),
      [
        createParameter(
          createIdentifier('x', 0, 5),
          createTypeReference(createIdentifier('float', 0, 5), []),
          null
        ),
        createParameter(
          createIdentifier('y', 0, 5),
          createTypeReference(createIdentifier('float', 0, 5), []),
          null
        ),
        createParameter(
          createIdentifier('z', 0, 5),
          createTypeReference(createIdentifier('float', 0, 5), []),
          null
        ),
      ],
      createBlock([
        createExpressionStatement(createCallExpression(
          createMemberExpression(createIdentifier('Point3D', 0, 6), createIdentifier('new', 0, 6)),
          [
            createArgument(createIdentifier('x', 0, 6)),
            createArgument(createIdentifier('y', 0, 6)),
            createArgument(createIdentifier('z', 0, 6)),
          ],
          0, 6
        ))
      ], 0, 6),
      createTypeReference(createIdentifier('Point3D', 0, 5), []),
      0, 5
    );

    const program = createProgram([point3DType, functionDecl], 0, 24, 1, 1);
    const source = [
      'type Point3D',
      '    float x',
      '    float y',
      '    float z',
      'f_createPoint(float x, float y, float z): Point3D =>',
      '    Point3D.new(x, y, z)',
    ].join('\n');
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new UdtValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((message) => message.code);

    // Should not have UDT-related errors
    expect(errorCodes).not.toContain('PSV6-ENUM-UNDEFINED-TYPE');
    expect(errorCodes).not.toContain('PSU02');
  });
});
