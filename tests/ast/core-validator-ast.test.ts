import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { CoreValidator } from '../../modules/core-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import type { AstValidationContext } from '../../core/types';
import {
  createArgument,
  createAssignmentStatement,
  createBlock,
  createBinaryExpression,
  createCallExpression,
  createConditionalExpression,
  createExpressionStatement,
  createFunctionDeclaration,
  createForStatement,
  createIdentifier,
  createIndexExpression,
  createIfStatement,
  createMemberExpression,
  createParameter,
  createNumberLiteral,
  createReturn,
  createStringLiteral,
  createScriptDeclaration,
  createUnaryExpression,
  createVariableDeclaration,
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

  it('flags strategy namespace member usage in indicators even without calls', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'value = strategy.long',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleValue = createStringLiteral('Example', '"Example"', 15, 2);
    const titleArgument = createArgument(titleValue, 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const valueIdentifier = createIdentifier('value', 0, 3);
    const strategyNamespace = createIdentifier('strategy', 9, 3);
    const longProperty = createIdentifier('long', 18, 3);
    const strategyMember = createMemberExpression(strategyNamespace, longProperty, 9, 22, 3);
    const assignment = createAssignmentStatement(valueIdentifier, strategyMember, 0, 22, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, assignment]);
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

  it('reports negative history indexing through AST index expressions', () => {
    const source = [
      '//@version=6',
      'indicator("Example")',
      'values = close[-1]',
      'plot(close)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const valuesIdentifier = createIdentifier('values', 0, 3);
    const closeIdentifier = createIdentifier('close', 10, 3);
    const negativeIndex = createUnaryExpression('-', createNumberLiteral(1, '1', 16, 3), 15, 17, 3);
    const historyAccess = createIndexExpression(closeIdentifier, negativeIndex, 10, 17, 3);
    const assignment = createAssignmentStatement(valuesIdentifier, historyAccess, 0, 18, 3);
    const plotCallee = createIdentifier('plot', 0, 4);
    const plotArg = createArgument(createIdentifier('close', 5, 4), 5, 10, 4);
    const plotCall = createCallExpression(plotCallee, [plotArg], 0, 10, 4);
    const plotStatement = createExpressionStatement(plotCall, 0, 10, 4);

    const program = createProgramFromSource(
      source,
      [directive],
      [scriptDeclaration, assignment, plotStatement],
    );
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const historyErrors = result.errors.filter((error) => error.code === 'PS024');
    expect(historyErrors).toHaveLength(1);
    expect(historyErrors[0]?.line).toBe(3);
  });

  it('reports numeric literal conditions for v6 scripts via AST traversal', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'if 1',
      '    plot(close)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const literalCondition = createNumberLiteral(1, '1', 4, 3);
    const plotArg = createArgument(createIdentifier('close', 14, 4), 14, 19, 4);
    const plotCall = createCallExpression(createIdentifier('plot', 9, 4), [plotArg], 9, 19, 4);
    const plotStatement = createExpressionStatement(plotCall, 9, 19, 4);
    const consequentBlock = createBlock([plotStatement], 8, 20, 3, 4);
    const ifStatement = createIfStatement(literalCondition, consequentBlock, null, 4, 20, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, ifStatement]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const numericLiteralErrors = result.errors.filter((error) => error.code === 'PSV6-001');
    expect(numericLiteralErrors).toHaveLength(1);
    expect(numericLiteralErrors[0]?.line).toBe(3);
  });

  it('reports numeric identifier conditions using AST type metadata', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'var value = 1',
      'if value',
      '    plot(close)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const valueIdentifier = createIdentifier('value', 4, 3);
    const valueInitializer = createNumberLiteral(1, '1', 13, 3);
    const valueDeclaration = createVariableDeclaration(valueIdentifier, 4, 15, 3, {
      declarationKind: 'var',
      initializer: valueInitializer,
    });
    const valueReference = createIdentifier('value', 4, 4);
    const plotArg = createArgument(createIdentifier('close', 14, 5), 14, 19, 5);
    const plotCall = createCallExpression(createIdentifier('plot', 9, 5), [plotArg], 9, 19, 5);
    const plotStatement = createExpressionStatement(plotCall, 9, 19, 5);
    const consequentBlock = createBlock([plotStatement], 8, 20, 4, 5);
    const ifStatement = createIfStatement(valueReference, consequentBlock, null, 4, 20, 4);

    const program = createProgramFromSource(
      source,
      [directive],
      [scriptDeclaration, valueDeclaration, ifStatement],
    );
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const numericIdentifierErrors = result.errors.filter((error) => error.code === 'PSV6-001');
    expect(numericIdentifierErrors).toHaveLength(1);
    expect(numericIdentifierErrors[0]?.line).toBe(4);
  });

  it('reports numeric literal loop conditions for v6 for statements via AST traversal', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'for i = 0 to 10',
      '    plot(i)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const loopIdentifier = createIdentifier('i', 4, 3);
    const initializer = createVariableDeclaration(loopIdentifier, 4, 11, 3, {
      declarationKind: 'var',
      initializer: createNumberLiteral(0, '0', 9, 3),
    });
    const loopTest = createNumberLiteral(10, '10', 15, 3);
    const loopUpdate = createIdentifier('i', 19, 3);
    const plotArgument = createArgument(createIdentifier('i', 9, 4), 9, 10, 4);
    const plotCall = createCallExpression(createIdentifier('plot', 4, 4), [plotArgument], 4, 11, 4);
    const plotStatement = createExpressionStatement(plotCall, 4, 11, 4);
    const loopBody = createBlock([plotStatement], 4, 12, 4, 4);
    const forStatement = createForStatement(initializer, loopTest, loopUpdate, loopBody, 0, 20, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, forStatement]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const numericLoopErrors = result.errors.filter((error) => error.code === 'PSV6-001');
    expect(numericLoopErrors).toHaveLength(1);
    expect(numericLoopErrors[0]?.line).toBe(3);
  });

  it('reports numeric identifier ternary conditions using AST type metadata', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'var base = 1',
      'plot(base ? close : open)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const baseIdentifier = createIdentifier('base', 4, 3);
    const baseDeclaration = createVariableDeclaration(baseIdentifier, 4, 13, 3, {
      declarationKind: 'var',
      initializer: createNumberLiteral(1, '1', 12, 3),
    });
    const baseCondition = createIdentifier('base', 5, 4);
    const closeIdentifier = createIdentifier('close', 12, 4);
    const openIdentifier = createIdentifier('open', 19, 4);
    const conditionalExpression = createConditionalExpression(baseCondition, closeIdentifier, openIdentifier, 9, 24, 4);
    const plotArgument = createArgument(conditionalExpression, 9, 25, 4);
    const plotCall = createCallExpression(createIdentifier('plot', 4, 4), [plotArgument], 4, 26, 4);
    const plotStatement = createExpressionStatement(plotCall, 4, 26, 4);

    const program = createProgramFromSource(
      source,
      [directive],
      [scriptDeclaration, baseDeclaration, plotStatement],
    );
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const numericConditionalErrors = result.errors.filter((error) => error.code === 'PSV6-001');
    expect(numericConditionalErrors).toHaveLength(1);
    expect(numericConditionalErrors[0]?.line).toBe(4);
  });

  it('reports linewidth zero arguments through AST call analysis', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'plot(close, linewidth=0)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const closeArgument = createArgument(createIdentifier('close', 5, 3), 5, 10, 3);
    const linewidthArgument = createArgument(createNumberLiteral(0, '0', 20, 3), 16, 24, 3, 'linewidth');
    const plotCall = createCallExpression(
      createIdentifier('plot', 0, 3),
      [closeArgument, linewidthArgument],
      0,
      25,
      3,
    );
    const plotStatement = createExpressionStatement(plotCall, 0, 25, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, plotStatement]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const linewidthErrors = result.errors.filter((error) => error.code === 'PSV6-002');
    expect(linewidthErrors).toHaveLength(1);
    expect(linewidthErrors[0]?.line).toBe(3);
  });

  it('warns on direct na comparisons through AST binary expressions', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'value = close == na',
      'plot(close)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const closeIdentifier = createIdentifier('close', 9, 3);
    const naIdentifier = createIdentifier('na', 18, 3);
    const equalityExpression = createBinaryExpression('==', closeIdentifier, naIdentifier, 9, 20, 3);
    const assignment = createAssignmentStatement(createIdentifier('value', 0, 3), equalityExpression, 0, 20, 3);
    const plotArgument = createArgument(createIdentifier('close', 5, 4), 5, 10, 4);
    const plotCall = createCallExpression(createIdentifier('plot', 0, 4), [plotArgument], 0, 10, 4);
    const plotStatement = createExpressionStatement(plotCall, 0, 10, 4);

    const program = createProgramFromSource(
      source,
      [directive],
      [scriptDeclaration, assignment, plotStatement],
    );
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const naWarnings = result.warnings.filter((warning) => warning.code === 'PS023');
    expect(naWarnings).toHaveLength(1);
    expect(naWarnings[0]?.line).toBe(3);
  });

  it('reports unreachable statements after return using AST control flow', () => {
    const source = [
      '//@version=6',
      'indicator("Unreachable")',
      'f(x) =>',
      '    return x',
      '    plot(x)',
      'plot(close)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleLiteral = createStringLiteral('Unreachable', '"Unreachable"', 10, 2);
    const titleArgument = createArgument(titleLiteral, 10, 23, 2);
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);

    const fnIdentifier = createIdentifier('f', 0, 3);
    const fnParameter = createParameter('x', 2, 3);
    const returnValue = createIdentifier('x', 11, 4);
    const returnStatement = createReturn(returnValue, 4, 12, 4);
    const innerPlotCallee = createIdentifier('plot', 4, 5);
    const innerPlotArgument = createArgument(createIdentifier('x', 9, 5), 9, 10, 5);
    const innerPlotCall = createCallExpression(innerPlotCallee, [innerPlotArgument], 4, 11, 5);
    const innerPlotStatement = createExpressionStatement(innerPlotCall, 4, 11, 5);
    const functionBlock = createBlock([returnStatement, innerPlotStatement], 4, 11, 4, 5);
    const functionDeclaration = createFunctionDeclaration(fnIdentifier, [fnParameter], functionBlock, 0, 11, 3, 5);

    const topPlotCallee = createIdentifier('plot', 0, 6);
    const topPlotArgument = createArgument(createIdentifier('close', 5, 6), 5, 10, 6);
    const topPlotCall = createCallExpression(topPlotCallee, [topPlotArgument], 0, 11, 6);
    const topPlotStatement = createExpressionStatement(topPlotCall, 0, 11, 6);

    const program = createProgramFromSource(
      source,
      [directive],
      [scriptDeclaration, functionDeclaration, topPlotStatement],
    );
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const unreachableWarnings = result.warnings.filter((warning) => warning.code === 'PSC001');
    expect(unreachableWarnings).toHaveLength(1);
    expect(unreachableWarnings[0]?.line).toBe(5);
    expect(unreachableWarnings[0]?.message).toContain('line 4');
  });
});
