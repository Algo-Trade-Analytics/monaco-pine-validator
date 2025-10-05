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

  it('validates enum declarations with input.enum calls', () => {
    const paletteEnum = createEnumDeclaration(
      createIdentifier('PaletteOpt', 0, 1),
      [
        createEnumMember(createIdentifier('RAINBOW', 0, 2), null, 0, 6, 2),
        createEnumMember(createIdentifier('SUNSET_WAVE', 0, 3), null, 0, 6, 3),
      ],
      0, 6, 1, 3
    );

    const inputEnumCall = createCallExpression(
      createMemberExpression(createIdentifier('input', 0, 4), createIdentifier('enum', 0, 4)),
      [
        createArgument(createMemberExpression(createIdentifier('PaletteOpt', 0, 4), createIdentifier('SUNSET_WAVE', 0, 4))),
        createArgument(createIdentifier('"Base Gradient Palette"', 0, 4)),
      ],
      0, 4
    );

    const variable = createVariableDeclaration(
      'simple',
      createIdentifier('paletteChoice', 0, 4),
      createTypeReference(createIdentifier('PaletteOpt', 0, 4), []),
      inputEnumCall,
      '=',
      0, 4
    );

    const program = createProgram([paletteEnum, variable], 0, 24, 1, 1);
    const source = [
      'enum PaletteOpt',
      '    RAINBOW',
      '    SUNSET_WAVE',
      'PaletteOpt paletteChoice = input.enum(PaletteOpt.SUNSET_WAVE, "Base Gradient Palette")',
    ].join('\n');
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnumValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((message) => message.code);

    // Should not have any enum-related errors
    expect(errorCodes).not.toContain('PSV6-ENUM-UNDEFINED-TYPE');
    expect(errorCodes).not.toContain('PSU02');
  });

  it('distinguishes between enum types and loop variables', () => {
    const pointEnum = createEnumDeclaration(
      createIdentifier('PointType', 0, 1),
      [
        createEnumMember(createIdentifier('CIRCLE', 0, 2), null, 0, 6, 2),
        createEnumMember(createIdentifier('SQUARE', 0, 3), null, 0, 6, 3),
      ],
      0, 6, 1, 3
    );

    // Create a for loop with iterator 'pk' (should not be flagged as enum)
    const forLoop = createBlock([
      createVariableDeclaration(
        createIdentifier('pk', 0, 5),
        0, 5,
        1, 1,
        {
          declarationKind: 'simple',
          initializer: createIdentifier('peaks', 0, 5),
          initializerOperator: null
        }
      ),
    ], 0, 5);

    const program = createProgram([pointEnum, forLoop], 0, 24, 1, 1);
    const source = [
      'enum PointType',
      '    CIRCLE',
      '    SQUARE',
      'for pk in peaks',
      '    // pk should not be flagged as undefined enum',
    ].join('\n');
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnumValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((message) => message.code);

    // Should not flag 'pk' as an undefined enum type
    expect(errorCodes).not.toContain('PSV6-ENUM-UNDEFINED-TYPE');
  });

  it('validates enum member references in switch statements', () => {
    const statusEnum = createEnumDeclaration(
      createIdentifier('Status', 0, 1),
      [
        createEnumMember(createIdentifier('ACTIVE', 0, 2), null, 0, 6, 2),
        createEnumMember(createIdentifier('INACTIVE', 0, 3), null, 0, 6, 3),
      ],
      0, 6, 1, 3
    );

    const switchStmt = createSwitchStatement(
      createMemberExpression(createIdentifier('Status', 0, 4), createIdentifier('ACTIVE', 0, 4)),
      [
        createSwitchCase(
          createMemberExpression(createIdentifier('Status', 0, 5), createIdentifier('ACTIVE', 0, 5)),
          [createExpressionStatement(createIdentifier('"Active"', 0, 6))]
        ),
        createSwitchCase(
          createMemberExpression(createIdentifier('Status', 0, 7), createIdentifier('INACTIVE', 0, 7)),
          [createExpressionStatement(createIdentifier('"Inactive"', 0, 8))]
        ),
      ],
      0, 4
    );

    const program = createProgram([statusEnum, switchStmt], 0, 24, 1, 1);
    const source = [
      'enum Status',
      '    ACTIVE',
      '    INACTIVE',
      'switch Status.ACTIVE',
      '    Status.ACTIVE => "Active"',
      '    Status.INACTIVE => "Inactive"',
    ].join('\n');
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnumValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((message) => message.code);

    // Should not have any enum-related errors
    expect(errorCodes).not.toContain('PSV6-ENUM-UNDEFINED-TYPE');
  });
});

