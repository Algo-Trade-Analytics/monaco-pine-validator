import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { CoreValidator } from '../../modules/core-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import type { AstValidationContext } from '../../core/types';
import {
  createArgument,
  createCallExpression,
  createExpressionStatement,
  createIdentifier,
  createMemberExpression,
  createNumberLiteral,
  createStringLiteral,
  createScriptDeclaration,
  createVersionDirective,
} from './fixtures';
import {
  createLocation,
  createPosition,
  createRange,
  type ProgramNode,
} from '../../core/ast/nodes';

class CoreValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new CoreValidator());
  }

  protected runCoreValidation(): void {}

  exposeContext(): AstValidationContext {
    return this.context;
  }
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

describe('CoreValidator AST integration', () => {
  it('derives version placement warnings and script metadata from the AST program', () => {
    const source = [
      '// comment',
      '//@version=6',
      'indicator(title="Example")',
      'plot(close)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 2);
    const titleValue = createStringLiteral('Example', '"Example"', 15, 3);
    const titleArgument = createArgument(titleValue, 10, 23, 3, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 3);
    const plotCallee = createIdentifier('plot', 0, 4);
    const plotArgValue = createIdentifier('close', 5, 4);
    const plotArgument = createArgument(plotArgValue, 5, 10, 4);
    const plotCall = createCallExpression(plotCallee, [plotArgument], 0, 10, 4);
    const plotStatement = createExpressionStatement(plotCall, 0, 10, 4);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, plotStatement]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    expect(validator.exposeContext().scriptType).toBe('indicator');
    expect(result.warnings.some((warning) => warning.code === 'PSW01')).toBe(true);
    expect(result.errors.some((error) => error.code === 'PS005')).toBe(false);
    expect(result.warnings.some((warning) => warning.code === 'PS014')).toBe(false);
  });

  it('flags missing titles for non-indicator scripts using AST metadata', () => {
    const source = [
      '//@version=6',
      'strategy()',
      'strategy.entry("Long")',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const scriptDeclaration = createScriptDeclaration('strategy', null, [], 0, 10, 2);
    const strategyNamespace = createIdentifier('strategy', 0, 3);
    const entryIdentifier = createIdentifier('entry', 9, 3);
    const entryCallee = createMemberExpression(strategyNamespace, entryIdentifier, 0, 14, 3);
    const entryArgument = createArgument(createStringLiteral('Long', '"Long"', 16, 3), 15, 22, 3);
    const entryCall = createCallExpression(entryCallee, [entryArgument], 0, 23, 3);
    const entryStatement = createExpressionStatement(entryCall, 0, 23, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, entryStatement]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    expect(result.errors.some((error) => error.code === 'PS005' && error.line === 2)).toBe(true);
  });

  it('reports strategy namespace calls in indicators using AST traversal', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'strategy.entry("Long", strategy.long)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleValue = createStringLiteral('Example', '"Example"', 15, 2);
    const titleArgument = createArgument(titleValue, 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const strategyNamespace = createIdentifier('strategy', 0, 3);
    const entryProperty = createIdentifier('entry', 9, 3);
    const entryCallee = createMemberExpression(strategyNamespace, entryProperty, 0, 14, 3);
    const enumNamespace = createIdentifier('strategy', 18, 3);
    const enumProperty = createIdentifier('long', 27, 3);
    const enumMember = createMemberExpression(enumNamespace, enumProperty, 18, 31, 3);
    const entryArgs = [
      createArgument(createStringLiteral('Long', '"Long"', 16, 3), 15, 22, 3),
      createArgument(enumMember, 24, 31, 3),
    ];
    const entryCall = createCallExpression(entryCallee, entryArgs, 0, 32, 3);
    const entryStatement = createExpressionStatement(entryCall, 0, 32, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, entryStatement]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const strategyNamespaceErrors = result.errors.filter((error) => error.code === 'PS020');
    expect(strategyNamespaceErrors).toHaveLength(1);
    expect(strategyNamespaceErrors[0]?.line).toBe(3);
  });

  it('marks strategy scripts with namespace calls so PS015 is suppressed', () => {
    const source = [
      '//@version=6',
      'strategy(title="Example")',
      'strategy.entry("Long", strategy.long)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleValue = createStringLiteral('Example', '"Example"', 15, 2);
    const titleArgument = createArgument(titleValue, 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('strategy', null, [titleArgument], 0, 24, 2);
    const strategyNamespace = createIdentifier('strategy', 0, 3);
    const entryProperty = createIdentifier('entry', 9, 3);
    const entryCallee = createMemberExpression(strategyNamespace, entryProperty, 0, 14, 3);
    const enumNamespace = createIdentifier('strategy', 18, 3);
    const enumProperty = createIdentifier('long', 27, 3);
    const enumMember = createMemberExpression(enumNamespace, enumProperty, 18, 31, 3);
    const entryArgs = [
      createArgument(createStringLiteral('Long', '"Long"', 16, 3), 15, 22, 3),
      createArgument(enumMember, 24, 31, 3),
    ];
    const entryCall = createCallExpression(entryCallee, entryArgs, 0, 32, 3);
    const entryStatement = createExpressionStatement(entryCall, 0, 32, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, entryStatement]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    expect(result.warnings.some((warning) => warning.code === 'PS015')).toBe(false);
  });

  it('detects plotting and input restrictions in libraries through AST calls', () => {
    const source = [
      '//@version=6',
      'library(title="Lib")',
      'plot(close)',
      'input.int(1)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleValue = createStringLiteral('Lib', '"Lib"', 13, 2);
    const titleArgument = createArgument(titleValue, 10, 19, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('library', null, [titleArgument], 0, 20, 2);
    const plotCallee = createIdentifier('plot', 0, 3);
    const plotArg = createArgument(createIdentifier('close', 5, 3), 5, 10, 3);
    const plotCall = createCallExpression(plotCallee, [plotArg], 0, 11, 3);
    const plotStatement = createExpressionStatement(plotCall, 0, 11, 3);
    const inputNamespace = createIdentifier('input', 0, 4);
    const intProperty = createIdentifier('int', 6, 4);
    const inputMember = createMemberExpression(inputNamespace, intProperty, 0, 9, 4);
    const inputLiteral = createNumberLiteral(1, '1', 10, 4);
    const inputArg = createArgument(inputLiteral, 10, 11, 4);
    const inputCall = createCallExpression(inputMember, [inputArg], 0, 12, 4);
    const inputStatement = createExpressionStatement(inputCall, 0, 12, 4);

    const program = createProgramFromSource(
      source,
      [directive],
      [scriptDeclaration, plotStatement, inputStatement],
    );
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const plottingErrors = result.errors.filter((error) => error.code === 'PS021');
    const inputErrors = result.errors.filter((error) => error.code === 'PS026');

    expect(plottingErrors).toHaveLength(1);
    expect(plottingErrors[0]?.line).toBe(3);
    expect(inputErrors).toHaveLength(1);
    expect(inputErrors[0]?.line).toBe(4);
  });

  it('reports duplicate version directives surfaced by the AST', () => {
    const source = [
      '//@version=6',
      '//@version=5',
      'indicator(title="Example")',
      'plot(close)',
      '',
    ].join('\n');

    const primaryDirective = createVersionDirective(6, 0, 12, 1);
    const duplicateDirective = createVersionDirective(5, 0, 12, 2);
    const titleValue = createStringLiteral('Example', '"Example"', 15, 3);
    const titleArgument = createArgument(titleValue, 10, 23, 3, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 3);
    const plotCallee = createIdentifier('plot', 0, 4);
    const plotArgValue = createIdentifier('close', 5, 4);
    const plotArgument = createArgument(plotArgValue, 5, 10, 4);
    const plotCall = createCallExpression(plotCallee, [plotArgument], 0, 10, 4);
    const plotStatement = createExpressionStatement(plotCall, 0, 10, 4);

    const program = createProgramFromSource(
      source,
      [primaryDirective, duplicateDirective],
      [scriptDeclaration, plotStatement],
    );
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const duplicateVersionErrors = result.errors.filter((error) => error.code === 'PS002');
    expect(duplicateVersionErrors).toHaveLength(1);
    expect(duplicateVersionErrors[0]?.line).toBe(2);
  });
});
