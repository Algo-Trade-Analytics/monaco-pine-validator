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
  createIdentifier,
  createIfStatement,
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
});
