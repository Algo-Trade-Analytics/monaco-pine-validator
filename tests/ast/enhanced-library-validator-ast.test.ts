import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { EnhancedLibraryValidator } from '../../modules/enhanced-library-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createCallExpression,
  createExpressionStatement,
  createIdentifier,
  createImportDeclaration,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
  createVariableDeclaration,
} from './fixtures';

class EnhancedLibraryValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new EnhancedLibraryValidator());
  }

  protected runCoreValidation(): void {}
}

describe('EnhancedLibraryValidator (AST)', () => {
  it('reports invalid library paths', () => {
    const path = createStringLiteral('user//lib/1', '"user//lib/1"', 7, 1);
    const alias = createIdentifier('lib', 23, 1);
    const importDeclaration = createImportDeclaration(path, alias, 0, 26, 1);
    const program = createProgram([importDeclaration], 0, 26, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedLibraryValidatorHarness(service);

    const result = harness.validate('import "user//lib/1" as lib');

    expect(result.errors.map((error) => error.code)).toContain('PSV6-LIB-PATH');
  });

  it('detects alias conflicts with user-defined names', () => {
    const path = createStringLiteral('user/lib/1', '"user/lib/1"', 7, 1);
    const alias = createIdentifier('foo', 21, 1);
    const importDeclaration = createImportDeclaration(path, alias, 0, 24, 1);

    const variableIdentifier = createIdentifier('foo', 0, 2);
    const variableInitializer = createNumberLiteral(1, '1', 6, 2);
    const variableDeclaration = createVariableDeclaration(variableIdentifier, 0, 10, 2, {
      initializer: variableInitializer,
    });

    const program = createProgram([importDeclaration, variableDeclaration], 0, 40, 1, 2);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedLibraryValidatorHarness(service);

    const result = harness.validate('import "user/lib/1" as foo\nfoo = 1');

    expect(result.errors.map((error) => error.code)).toContain('PSV6-LIB-ALIAS');
  });

  it('detects built-in alias conflicts', () => {
    const path = createStringLiteral('user/lib/1', '"user/lib/1"', 7, 1);
    const alias = createIdentifier('plot', 21, 1);
    const importDeclaration = createImportDeclaration(path, alias, 0, 26, 1);
    const program = createProgram([importDeclaration], 0, 26, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedLibraryValidatorHarness(service);

    const result = harness.validate('import "user/lib/1" as plot');

    expect(result.errors.map((error) => error.code)).toContain('PSV6-LIB-ALIAS');
  });

  it('warns about version gaps across imports', () => {
    const firstPath = createStringLiteral('user/lib/1', '"user/lib/1"', 7, 1);
    const firstAlias = createIdentifier('libOne', 21, 1);
    const firstImport = createImportDeclaration(firstPath, firstAlias, 0, 28, 1);

    const secondPath = createStringLiteral('user/lib/10', '"user/lib/10"', 7, 2);
    const secondAlias = createIdentifier('libTwo', 22, 2);
    const secondImport = createImportDeclaration(secondPath, secondAlias, 0, 30, 2);

    const program = createProgram([firstImport, secondImport], 0, 30, 1, 2);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedLibraryValidatorHarness(service);

    const result = harness.validate('import "user/lib/1" as libOne\nimport "user/lib/10" as libTwo');

    expect(result.warnings.map((warning) => warning.code)).toContain('PSV6-LIB-VERSION');
  });

  it('warns on unused library imports', () => {
    const path = createStringLiteral('user/lib/1', '"user/lib/1"', 7, 1);
    const alias = createIdentifier('unused', 21, 1);
    const importDeclaration = createImportDeclaration(path, alias, 0, 27, 1);
    const program = createProgram([importDeclaration], 0, 27, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedLibraryValidatorHarness(service);

    const result = harness.validate('import "user/lib/1" as unused');

    expect(result.warnings.map((warning) => warning.code)).toContain('PSV6-LIB-UNUSED');
  });

  it('does not warn when imported alias is used', () => {
    const path = createStringLiteral('user/lib/1', '"user/lib/1"', 7, 1);
    const alias = createIdentifier('lib', 21, 1);
    const importDeclaration = createImportDeclaration(path, alias, 0, 24, 1);

    const memberObject = createIdentifier('lib', 0, 2);
    const memberProperty = createIdentifier('run', 4, 2);
    const memberExpression = createMemberExpression(memberObject, memberProperty, 0, 8, 2);
    const callExpression = createCallExpression(memberExpression, [], 0, 10, 2);
    const callStatement = createExpressionStatement(callExpression, 0, 10, 2);

    const program = createProgram([importDeclaration, callStatement], 0, 32, 1, 2);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedLibraryValidatorHarness(service);

    const result = harness.validate('import "user/lib/1" as lib\nlib.run()');

    expect(result.warnings.map((warning) => warning.code)).not.toContain('PSV6-LIB-UNUSED');
  });

  it('detects circular library dependencies', () => {
    const firstPath = createStringLiteral('user/otherlib/1', '"user/otherlib/1"', 7, 1);
    const firstAlias = createIdentifier('one', 25, 1);
    const firstImport = createImportDeclaration(firstPath, firstAlias, 0, 29, 1);

    const secondPath = createStringLiteral('user/testlib/1', '"user/testlib/1"', 7, 2);
    const secondAlias = createIdentifier('two', 24, 2);
    const secondImport = createImportDeclaration(secondPath, secondAlias, 0, 28, 2);

    const program = createProgram([firstImport, secondImport], 0, 28, 1, 2);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedLibraryValidatorHarness(service);

    const result = harness.validate('import "user/otherlib/1" as one\nimport "user/testlib/1" as two');

    expect(result.errors.map((error) => error.code)).toContain('PSV6-LIB-CIRCULAR');
  });
});
