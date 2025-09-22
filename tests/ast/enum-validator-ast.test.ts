import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import { EnumValidator } from '../../modules/enum-validator';
import {
  createArgument,
  createBinaryExpression,
  createBlock,
  createCallExpression,
  createEnumDeclaration,
  createEnumMember,
  createExpressionStatement,
  createFunctionDeclaration,
  createIdentifier,
  createMemberExpression,
  createProgram,
  createReturn,
  createSwitchCase,
  createSwitchStatement,
  createTypeReference,
  createVariableDeclaration,
  createParameter,
} from './fixtures';

class EnumValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new EnumValidator());
  }

  protected runCoreValidation(): void {}
}

function createStatusEnum(): ReturnType<typeof createEnumDeclaration> {
  const statusIdentifier = createIdentifier('Status', 0, 1);
  const activeMember = createEnumMember(createIdentifier('ACTIVE', 0, 2), null, 0, 6, 2);
  return createEnumDeclaration(statusIdentifier, [activeMember], 0, 6, 1, 2);
}

function createColorEnum(): ReturnType<typeof createEnumDeclaration> {
  const colorIdentifier = createIdentifier('Color', 8, 1);
  const redMember = createEnumMember(createIdentifier('RED', 8, 2), null, 8, 11, 2);
  return createEnumDeclaration(colorIdentifier, [redMember], 8, 11, 1, 2);
}

describe('EnumValidator (AST)', () => {
  it('reports undefined enum values from AST member expressions', () => {
    const statusEnum = createStatusEnum();

    const statusIdentifier = createIdentifier('Status', 0, 3);
    const unknownMember = createMemberExpression(statusIdentifier, createIdentifier('UNKNOWN', 7, 3), 0, 14, 3);
    const typeAnnotation = createTypeReference('Status', 0, 3);
    const variable = createVariableDeclaration(createIdentifier('current', 16, 3), 0, 24, 3, {
      declarationKind: 'simple',
      typeAnnotation,
      initializer: unknownMember,
    });

    const program = createProgram([statusEnum, variable], 0, 24, 1, 3);
    const source = 'enum Status\n    ACTIVE\nStatus current = Status.UNKNOWN';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnumValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((message) => message.code);

    expect(errorCodes).toContain('PSV6-ENUM-UNDEFINED-VALUE');
  });

  it('warns when comparing enum values from different types', () => {
    const statusEnum = createStatusEnum();
    const colorEnum = createColorEnum();

    const statusValue = createMemberExpression(createIdentifier('Status', 0, 3), createIdentifier('ACTIVE', 7, 3), 0, 14, 3);
    const statusVariable = createVariableDeclaration(createIdentifier('current', 16, 3), 0, 24, 3, {
      declarationKind: 'simple',
      typeAnnotation: createTypeReference('Status', 16, 3),
      initializer: statusValue,
    });

    const colorValue = createMemberExpression(createIdentifier('Color', 0, 4), createIdentifier('RED', 6, 4), 0, 10, 4);
    const comparison = createBinaryExpression('==', createIdentifier('current', 0, 4), colorValue, 0, 14, 4);
    const comparisonStatement = createExpressionStatement(comparison, 0, 14, 4);

    const program = createProgram([statusEnum, colorEnum, statusVariable, comparisonStatement], 0, 24, 1, 4);
    const source = 'enum Status\n    ACTIVE\nenum Color\n    RED\nStatus current = Status.ACTIVE\ncurrent == Color.RED';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnumValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((message) => message.code);

    expect(warningCodes).toContain('PSV6-ENUM-COMPARISON-TYPE-MISMATCH');
  });

  it('errors when passing mismatched enums to functions', () => {
    const statusEnum = createStatusEnum();
    const colorEnum = createColorEnum();

    const param = createParameter('status', 0, 3);
    const returnStatement = createReturn(createIdentifier('status', 7, 4), 2, 8, 4);
    const body = createBlock([returnStatement], 0, 8, 4, 4);
    const functionDeclaration = createFunctionDeclaration(createIdentifier('f', 0, 3), [param], body, 0, 8, 3, 4);

    const colorValue = createMemberExpression(createIdentifier('Color', 0, 5), createIdentifier('RED', 6, 5), 0, 10, 5);
    const argument = createArgument(colorValue, 2, 12, 5);
    const callExpression = createCallExpression(createIdentifier('f', 0, 5), [argument], 0, 12, 5);
    const callStatement = createExpressionStatement(callExpression, 0, 12, 5);

    const program = createProgram([statusEnum, colorEnum, functionDeclaration, callStatement], 0, 12, 1, 5);
    const source = 'enum Status\n    ACTIVE\nenum Color\n    RED\nf(status) =>\n    status\nf(Color.RED)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnumValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((message) => message.code);

    expect(errorCodes).toContain('PSV6-ENUM-FUNCTION-TYPE-MISMATCH');
  });

  it('errors when switch cases use mismatched enums', () => {
    const statusEnum = createStatusEnum();
    const colorEnum = createColorEnum();

    const statusValue = createMemberExpression(createIdentifier('Status', 0, 3), createIdentifier('ACTIVE', 7, 3), 0, 14, 3);
    const statusVariable = createVariableDeclaration(createIdentifier('current', 16, 3), 0, 24, 3, {
      declarationKind: 'simple',
      typeAnnotation: createTypeReference('Status', 16, 3),
      initializer: statusValue,
    });

    const statusCase = createSwitchCase(
      createMemberExpression(createIdentifier('Status', 0, 4), createIdentifier('ACTIVE', 7, 4), 0, 14, 4),
      [],
      0,
      14,
      4,
    );
    const colorCase = createSwitchCase(
      createMemberExpression(createIdentifier('Color', 0, 5), createIdentifier('RED', 6, 5), 0, 10, 5),
      [],
      0,
      10,
      5,
    );
    const switchStatement = createSwitchStatement(createIdentifier('current', 7, 4), [statusCase, colorCase], 0, 14, 4, 5);

    const program = createProgram([statusEnum, colorEnum, statusVariable, switchStatement], 0, 24, 1, 5);
    const source = 'enum Status\n    ACTIVE\nenum Color\n    RED\nStatus current = Status.ACTIVE\nswitch current\n    Status.ACTIVE =>\n    Color.RED =>';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnumValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((message) => message.code);

    expect(errorCodes).toContain('PSV6-ENUM-SWITCH-CASE-TYPE-MISMATCH');
  });

  it('reports undefined enum types when declarations are missing', () => {
    const statusIdentifier = createIdentifier('Status', 0, 1);
    const activeMember = createMemberExpression(statusIdentifier, createIdentifier('ACTIVE', 7, 1), 0, 14, 1);
    const typeAnnotation = createTypeReference('Status', 0, 1);
    const variable = createVariableDeclaration(createIdentifier('current', 16, 1), 0, 24, 1, {
      declarationKind: 'simple',
      typeAnnotation,
      initializer: activeMember,
    });

    const program = createProgram([variable], 0, 24, 1, 1);
    const source = 'Status current = Status.ACTIVE';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnumValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((message) => message.code);

    expect(errorCodes).toContain('PSV6-ENUM-UNDEFINED-TYPE');
  });
});

