import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { CoreValidator } from '../../modules/core-validator';
import { ScopeValidator } from '../../modules/scope-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import type { ValidatorConfig } from '../../core/types';
import {
  createArgument,
  createBlock,
  createBooleanLiteral,
  createCallExpression,
  createExpressionStatement,
  createIdentifier,
  createIfStatement,
  createMemberExpression,
  createNumberLiteral,
  createScriptDeclaration,
  createStringLiteral,
  createVariableDeclaration,
  createVersionDirective,
} from './fixtures';
import {
  createLocation,
  createPosition,
  createRange,
  type ProgramNode,
} from '../../core/ast/nodes';

class ScopeValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService, overrides: Partial<ValidatorConfig> = {}) {
    super({ ...overrides, ast: { mode: 'primary', service } });
    this.registerModule(new CoreValidator());
    this.registerModule(new ScopeValidator());
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

describe('ScopeValidator AST integration', () => {
  it('emits PSW03 for duplicate declarations in the same block', () => {
    const source = [
      '//@version=6',
      'indicator("Dup")',
      'var foo = 1',
      'var foo = 2',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const title = createStringLiteral('Dup', '"Dup"', 10, 2);
    const titleArgument = createArgument(title, 9, 20, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 21, 2);

    const firstIdentifier = createIdentifier('foo', 4, 3);
    const firstInitializer = createNumberLiteral(1, '1', 10, 3);
    const firstDeclaration = createVariableDeclaration(firstIdentifier, 0, 12, 3, {
      declarationKind: 'var',
      initializer: firstInitializer,
    });

    const secondIdentifier = createIdentifier('foo', 4, 4);
    const secondInitializer = createNumberLiteral(2, '2', 10, 4);
    const secondDeclaration = createVariableDeclaration(secondIdentifier, 0, 12, 4, {
      declarationKind: 'var',
      initializer: secondInitializer,
    });

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, firstDeclaration, secondDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new ScopeValidatorHarness(service);
    const result = validator.validate(source);

    const duplicateWarning = result.warnings.find((warning) => warning.code === 'PSW03');
    expect(duplicateWarning).toBeDefined();
    expect(duplicateWarning).toMatchObject({ line: 4, column: 5 });
  });

  it('emits PSW04 when nested declarations shadow outer variables', () => {
    const source = [
      '//@version=6',
      'indicator("Shadow")',
      'var foo = 1',
      'if true',
      '    var foo = 2',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const title = createStringLiteral('Shadow', '"Shadow"', 10, 2);
    const titleArgument = createArgument(title, 9, 24, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 25, 2);

    const outerIdentifier = createIdentifier('foo', 4, 3);
    const outerInitializer = createNumberLiteral(1, '1', 10, 3);
    const outerDeclaration = createVariableDeclaration(outerIdentifier, 0, 12, 3, {
      declarationKind: 'var',
      initializer: outerInitializer,
    });

    const innerIdentifier = createIdentifier('foo', 8, 5);
    const innerInitializer = createNumberLiteral(2, '2', 14, 5);
    const innerDeclaration = createVariableDeclaration(innerIdentifier, 4, 16, 5, {
      declarationKind: 'var',
      initializer: innerInitializer,
    });
    const block = createBlock([innerDeclaration], 4, 16, 5, 5);
    const condition = createBooleanLiteral(true, 3, 4);
    const ifStatement = createIfStatement(condition, block, null, 0, 16, 4);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, outerDeclaration, ifStatement]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new ScopeValidatorHarness(service);
    const result = validator.validate(source);

    const shadowWarning = result.warnings.find((warning) => warning.code === 'PSW04' && warning.line === 5);
    expect(shadowWarning).toBeDefined();
    expect(shadowWarning).toMatchObject({ column: 9 });
  });

  it('emits PSU02 when encountering references without declarations', () => {
    const source = [
      '//@version=6',
      'indicator("Undefined")',
      'plot(foo)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const title = createStringLiteral('Undefined', '"Undefined"', 10, 2);
    const titleArgument = createArgument(title, 9, 27, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 28, 2);

    const fooReference = createIdentifier('foo', 5, 3);
    const fooArgument = createArgument(fooReference, 5, 8, 3);
    const plotCall = createCallExpression(createIdentifier('plot', 0, 3), [fooArgument], 0, 9, 3);
    const plotStatement = createExpressionStatement(plotCall, 0, 9, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, plotStatement]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new ScopeValidatorHarness(service);
    const result = validator.validate(source);

    const undefinedWarning = result.warnings.find((warning) => warning.code === 'PSU02');
    expect(undefinedWarning).toBeDefined();
    expect(undefinedWarning).toMatchObject({ line: 3, column: 6 });
  });

  it('does not emit PSU02 for named arguments', () => {
    const source = [
      '//@version=6',
      'indicator("Args")',
      'plot(title="Example")',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const title = createStringLiteral('Args', '"Args"', 10, 2);
    const titleArgument = createArgument(title, 9, 21, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 22, 2);

    const valueLiteral = createStringLiteral('Example', '"Example"', 11, 3);
    const namedArgument = createArgument(valueLiteral, 5, 20, 3, 'title');
    const plotCall = createCallExpression(createIdentifier('plot', 0, 3), [namedArgument], 0, 20, 3);
    const plotStatement = createExpressionStatement(plotCall, 0, 20, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, plotStatement]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new ScopeValidatorHarness(service);
    const result = validator.validate(source);

    const undefinedWarnings = result.warnings.filter((warning) => warning.code === 'PSU02');
    expect(undefinedWarnings).toHaveLength(0);
  });

  it('does not emit PSU02 for namespace member accesses', () => {
    const source = [
      '//@version=6',
      'indicator("Namespace")',
      'var foo = input.int(1)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const title = createStringLiteral('Namespace', '"Namespace"', 10, 2);
    const titleArgument = createArgument(title, 9, 26, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 27, 2);

    const namespaceIdentifier = createIdentifier('input', 10, 3);
    const propertyIdentifier = createIdentifier('int', 16, 3);
    const memberExpression = createMemberExpression(namespaceIdentifier, propertyIdentifier, 10, 19, 3);
    const argument = createArgument(createNumberLiteral(1, '1', 20, 3), 20, 21, 3);
    const callExpression = createCallExpression(memberExpression, [argument], 10, 21, 3);
    const variableIdentifier = createIdentifier('foo', 4, 3);
    const variableDeclaration = createVariableDeclaration(variableIdentifier, 0, 21, 3, {
      declarationKind: 'var',
      initializer: callExpression,
    });

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, variableDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new ScopeValidatorHarness(service);
    const result = validator.validate(source);

    const undefinedWarnings = result.warnings.filter((warning) => warning.code === 'PSU02');
    expect(undefinedWarnings).toHaveLength(0);
  });
});
