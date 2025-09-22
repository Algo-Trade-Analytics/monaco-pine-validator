import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { CoreValidator } from '../../modules/core-validator';
import { TypeValidator } from '../../modules/type-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import type { ValidatorConfig } from '../../core/types';
import {
  createArgument,
  createAssignmentStatement,
  createBlock,
  createConditionalExpression,
  createFunctionDeclaration,
  createIdentifier,
  createNumberLiteral,
  createReturn,
  createScriptDeclaration,
  createStringLiteral,
  createTypeReference,
  createVariableDeclaration,
  createVersionDirective,
} from './fixtures';
import { createLocation, createPosition, createRange, type ProgramNode } from '../../core/ast/nodes';

class TypeValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService, overrides: Partial<ValidatorConfig> = {}) {
    super({ ...overrides, ast: { mode: 'primary', service } });
    this.registerModule(new CoreValidator());
    this.registerModule(new TypeValidator());
  }

  protected runCoreValidation(): void {}
}

function createProgramFromSource(
  source: string,
  directives: ProgramNode['directives'],
  body: ProgramNode['body'],
): ProgramNode {
  const endOffset = source.length;
  const lines = source.split(/\r?\n/);
  const endLine = lines.length;
  const lastLineLength = endLine > 0 ? lines[endLine - 1].length : 0;

  return {
    kind: 'Program',
    directives,
    body,
    loc: createLocation(
      createPosition(1, 1, 0),
      createPosition(endLine, lastLineLength + 1, endOffset),
    ),
    range: createRange(0, endOffset),
  };
}

describe('TypeValidator AST integration', () => {
  it('emits PSV6-TYPE-MISMATCH when initializer types conflict with annotations', () => {
    const source = [
      '//@version=6',
      'indicator("Types")',
      'int foo = "bar"',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleLiteral = createStringLiteral('Types', '"Types"', 10, 2);
    const titleArgument = createArgument(titleLiteral, 9, 21, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 22, 2);

    const identifier = createIdentifier('foo', 4, 3);
    const annotation = createTypeReference('int', 0, 3);
    const initializer = createStringLiteral('bar', '"bar"', 12, 3);
    const declaration = createVariableDeclaration(identifier, 0, 20, 3, {
      declarationKind: 'simple',
      initializer,
      typeAnnotation: annotation,
    });

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, declaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new TypeValidatorHarness(service);
    const result = validator.validate(source);

    const mismatch = result.errors.find((error) => error.code === 'PSV6-TYPE-MISMATCH');
    expect(mismatch).toBeDefined();
    expect(mismatch).toMatchObject({ line: 3, column: 5 });
  });

  it('emits PSV6-TERNARY-TYPE for conflicting conditional branches', () => {
    const source = [
      '//@version=6',
      'indicator("Ternary")',
      'var result = cond ? 1 : "two"',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleLiteral = createStringLiteral('Ternary', '"Ternary"', 10, 2);
    const titleArgument = createArgument(titleLiteral, 9, 24, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 25, 2);

    const variableIdentifier = createIdentifier('result', 4, 3);
    const condition = createIdentifier('cond', 15, 3);
    const consequent = createNumberLiteral(1, '1', 22, 3);
    const alternate = createStringLiteral('two', '"two"', 26, 3);
    const conditional = createConditionalExpression(condition, consequent, alternate, 12, 31, 3);
    const declaration = createVariableDeclaration(variableIdentifier, 0, 31, 3, {
      declarationKind: 'var',
      initializer: conditional,
    });

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, declaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new TypeValidatorHarness(service);
    const result = validator.validate(source);

    const ternaryError = result.errors.find((error) => error.code === 'PSV6-TERNARY-TYPE');
    expect(ternaryError).toBeDefined();
    expect(ternaryError).toMatchObject({ line: 3, column: 13 });
  });

  it('emits PSV6-FUNCTION-RETURN-TYPE when return branches disagree', () => {
    const source = [
      '//@version=6',
      'indicator("Returns")',
      'myFunc() =>',
      '    return 1',
      '    return "two"',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleLiteral = createStringLiteral('Returns', '"Returns"', 10, 2);
    const titleArgument = createArgument(titleLiteral, 9, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);

    const functionIdentifier = createIdentifier('myFunc', 0, 3);
    const firstReturn = createReturn(createNumberLiteral(1, '1', 12, 4), 4, 13, 4);
    const secondReturn = createReturn(createStringLiteral('two', '"two"', 11, 5), 4, 16, 5);
    const functionBody = createBlock([firstReturn, secondReturn], 4, 16, 4, 5);
    const functionDeclaration = createFunctionDeclaration(functionIdentifier, [], functionBody, 0, 16, 3, 5);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, functionDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new TypeValidatorHarness(service);
    const result = validator.validate(source);

    const returnError = result.errors.find((error) => error.code === 'PSV6-FUNCTION-RETURN-TYPE');
    expect(returnError).toBeDefined();
    expect(returnError).toMatchObject({ line: 3, column: 1 });
  });

  it('emits PSV6-TYPE-INCONSISTENT when reassignments change primitive type', () => {
    const source = [
      '//@version=6',
      'indicator("Consistency")',
      'var foo = 1',
      'foo := "two"',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleLiteral = createStringLiteral('Consistency', '"Consistency"', 10, 2);
    const titleArgument = createArgument(titleLiteral, 9, 32, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 33, 2);

    const declarationIdentifier = createIdentifier('foo', 4, 3);
    const initializer = createNumberLiteral(1, '1', 10, 3);
    const declaration = createVariableDeclaration(declarationIdentifier, 0, 11, 3, {
      declarationKind: 'var',
      initializer,
    });

    const assignmentIdentifier = createIdentifier('foo', 0, 4);
    const assignmentValue = createStringLiteral('two', '"two"', 7, 4);
    const assignment = createAssignmentStatement(assignmentIdentifier, assignmentValue, 0, 12, 4);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, declaration, assignment]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new TypeValidatorHarness(service);
    const result = validator.validate(source);

    const inconsistent = result.warnings.find((warning) => warning.code === 'PSV6-TYPE-INCONSISTENT');
    expect(inconsistent).toBeDefined();
    expect(inconsistent).toMatchObject({ line: 4, column: 1 });
  });
});
