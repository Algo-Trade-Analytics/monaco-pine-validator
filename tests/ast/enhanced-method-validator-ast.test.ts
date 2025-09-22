import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { EnhancedMethodValidator } from '../../modules/enhanced-method-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createCallExpression,
  createExpressionStatement,
  createIdentifier,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createTypeDeclaration,
  createTypeField,
  createTypeReference,
  createVariableDeclaration,
} from './fixtures';

class EnhancedMethodHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new EnhancedMethodValidator());
  }

  protected runCoreValidation(): void {}
}

describe('EnhancedMethodValidator (AST)', () => {
  it('emits PSV6-METHOD-INVALID for methods invoked on primitive identifiers', () => {
    const variableIdentifier = createIdentifier('x', 4, 1);
    const intReference = createTypeReference('int', 0, 1);
    const initializer = createNumberLiteral(10, '10', 8, 1);
    const declaration = createVariableDeclaration(variableIdentifier, 0, 10, 1, {
      declarationKind: 'simple',
      typeAnnotation: intReference,
      initializer,
    });

    const callObject = createIdentifier('x', 0, 2);
    const methodIdentifier = createIdentifier('move', 2, 2);
    const member = createMemberExpression(callObject, methodIdentifier, 0, 9, 2);
    const argument = createArgument(createNumberLiteral(5, '5', 10, 2), 10, 11, 2);
    const call = createCallExpression(member, [argument], 0, 12, 2);
    const statement = createExpressionStatement(call, 0, 12, 2);

    const program = createProgram([declaration, statement], 0, 12, 1, 2);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedMethodHarness(service);

    const source = 'int x = 10\nx.move(5)';
    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-METHOD-INVALID');
  });

  it('recognises UDT variables constructed via namespace new calls', () => {
    const pointIdentifier = createIdentifier('Point', 0, 1);
    const xFieldIdentifier = createIdentifier('x', 4, 2);
    const yFieldIdentifier = createIdentifier('y', 4, 3);
    const floatReference = createTypeReference('float', 6, 2);
    const xField = createTypeField(xFieldIdentifier, floatReference, 4, 11, 2, 2);
    const yField = createTypeField(yFieldIdentifier, floatReference, 4, 11, 3, 3);
    const typeDeclaration = createTypeDeclaration(pointIdentifier, [xField, yField], 0, 11, 1, 3);

    const instanceIdentifier = createIdentifier('myPoint', 0, 4);
    const namespaceIdentifier = createIdentifier('Point', 10, 4);
    const newIdentifier = createIdentifier('new', 16, 4);
    const constructorMember = createMemberExpression(namespaceIdentifier, newIdentifier, 10, 20, 4);
    const firstArgument = createArgument(createNumberLiteral(1, '1', 21, 4), 21, 22, 4);
    const secondArgument = createArgument(createNumberLiteral(2, '2', 24, 4), 24, 25, 4);
    const constructorCall = createCallExpression(constructorMember, [firstArgument, secondArgument], 10, 26, 4);
    const pointDeclaration = createVariableDeclaration(instanceIdentifier, 0, 26, 4, {
      declarationKind: 'simple',
      initializer: constructorCall,
    });

    const callObject = createIdentifier('myPoint', 0, 5);
    const moveIdentifier = createIdentifier('move', 8, 5);
    const member = createMemberExpression(callObject, moveIdentifier, 0, 14, 5);
    const argument = createArgument(createNumberLiteral(5, '5', 15, 5), 15, 16, 5);
    const call = createCallExpression(member, [argument], 0, 17, 5);
    const statement = createExpressionStatement(call, 0, 17, 5);

    const program = createProgram([typeDeclaration, pointDeclaration, statement], 0, 17, 1, 5);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedMethodHarness(service);

    const source = 'type Point\n    float x\n    float y\nmyPoint = Point.new(1, 2)\nmyPoint.move(5)';
    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).not.toContain('PSV6-METHOD-INVALID');
  });
});
