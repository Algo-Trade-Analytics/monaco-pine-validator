import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { VaripValidator } from '../../modules/varip-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createAssignmentStatement,
  createBinaryExpression,
  createBlock,
  createCallExpression,
  createFunctionDeclaration,
  createIdentifier,
  createIfStatement,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
  createTypeReference,
  createVariableDeclaration,
} from './fixtures';

class VaripValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new VaripValidator());
  }

  protected runCoreValidation(): void {}
}

class DisabledVaripValidatorHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new VaripValidator());
  }

  protected runCoreValidation(): void {}
}

describe('VaripValidator (AST)', () => {
  it('returns no diagnostics when AST mode is disabled', () => {
    const harness = new DisabledVaripValidatorHarness();
    const result = harness.validate('varip int count = 0');

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });

  it('reports PSV6-VARIP-ASSIGNMENT when reassignment uses "="', () => {
    const typeAnnotation = createTypeReference('int', 6, 1);
    const varIdentifier = createIdentifier('count', 10, 1);
    const initializer = createNumberLiteral(0, '0', 18, 1);
    const declaration = createVariableDeclaration(varIdentifier, 0, 19, 1, {
      declarationKind: 'varip',
      initializer,
      typeAnnotation,
    });

    const assignLeft = createIdentifier('count', 0, 2);
    const assignRight = createNumberLiteral(10, '10', 8, 2);
    const assignment = createAssignmentStatement(assignLeft, assignRight, 0, 10, 2);

    const program = createProgram([declaration, assignment], 0, 19, 1, 2);
    const source = 'varip int count = 0\ncount = 10';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new VaripValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-VARIP-ASSIGNMENT');
  });

  it('warns when varip reassignment lacks barstate guard', () => {
    const typeAnnotation = createTypeReference('int', 6, 1);
    const varIdentifier = createIdentifier('count', 10, 1);
    const initializer = createNumberLiteral(0, '0', 18, 1);
    const declaration = createVariableDeclaration(varIdentifier, 0, 19, 1, {
      declarationKind: 'varip',
      initializer,
      typeAnnotation,
    });

    const assignLeft = createIdentifier('count', 0, 2);
    const rightIdentifier = createIdentifier('count', 9, 2);
    const rightLiteral = createNumberLiteral(1, '1', 17, 2);
    const assignRight = createBinaryExpression('+', rightIdentifier, rightLiteral, 9, 18, 2);
    const assignment = createAssignmentStatement(assignLeft, assignRight, 0, 18, 2);

    const program = createProgram([declaration, assignment], 0, 18, 1, 2);
    const source = 'varip int count = 0\ncount := count + 1';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new VaripValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-VARIP-BARSTATE');
  });

  it('does not warn when reassignment is guarded by barstate.isconfirmed', () => {
    const typeAnnotation = createTypeReference('int', 6, 1);
    const varIdentifier = createIdentifier('count', 10, 1);
    const initializer = createNumberLiteral(0, '0', 18, 1);
    const declaration = createVariableDeclaration(varIdentifier, 0, 19, 1, {
      declarationKind: 'varip',
      initializer,
      typeAnnotation,
    });

    const barstateIdentifier = createIdentifier('barstate', 3, 2);
    const isConfirmedIdentifier = createIdentifier('isconfirmed', 13, 2);
    const guard = createMemberExpression(barstateIdentifier, isConfirmedIdentifier, 3, 24, 2);

    const assignLeft = createIdentifier('count', 4, 3);
    const assignRight = createNumberLiteral(0, '0', 13, 3);
    const assignment = createAssignmentStatement(assignLeft, assignRight, 4, 14, 3);
    const block = createBlock([assignment], 4, 14, 3, 3);
    const ifStatement = createIfStatement(guard, block, null, 0, 24, 2);

    const program = createProgram([declaration, ifStatement], 0, 24, 1, 3);
    const source = 'varip int count = 0\nif barstate.isconfirmed\n    count := 0';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new VaripValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).not.toContain('PSV6-VARIP-BARSTATE');
  });

  it('flags varip declarations inside functions', () => {
    const typeAnnotation = createTypeReference('int', 10, 2);
    const varIdentifier = createIdentifier('count', 14, 2);
    const initializer = createNumberLiteral(0, '0', 22, 2);
    const innerDeclaration = createVariableDeclaration(varIdentifier, 4, 23, 2, {
      declarationKind: 'varip',
      initializer,
      typeAnnotation,
    });
    const innerBlock = createBlock([innerDeclaration], 4, 23, 2, 2);

    const functionIdentifier = createIdentifier('fn', 0, 1);
    const fn = createFunctionDeclaration(functionIdentifier, [], innerBlock, 0, 23, 1, 2);

    const program = createProgram([fn], 0, 23, 1, 2);
    const source = 'fn() =>\n    varip int count = 0';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new VaripValidatorHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-VARIP-SCOPE-FUNCTION');
  });

  it('warns when initializer type cannot be inferred', () => {
    const varIdentifier = createIdentifier('stateTracker', 6, 1);
    const callee = createIdentifier('some_function', 23, 1);
    const argument = createArgument(createStringLiteral('close', '"close"', 36, 1), 29, 36, 1);
    const call = createCallExpression(callee, [argument], 23, 37, 1);
    const declaration = createVariableDeclaration(varIdentifier, 0, 37, 1, {
      declarationKind: 'varip',
      initializer: call,
    });

    const program = createProgram([declaration], 0, 37, 1, 1);
    const source = 'varip stateTracker = some_function("close")';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new VaripValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-VARIP-LITERAL-INIT');
    expect(warningCodes).toContain('PSV6-VARIP-TYPE-INFERENCE');
  });
});
