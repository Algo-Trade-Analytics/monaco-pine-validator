import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { CoreValidator } from '../../modules/core-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import type { AstValidationContext, ValidatorConfig } from '../../core/types';
import {
  createArgument,
  createAssignmentStatement,
  createBooleanLiteral,
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
  createTypeReference,
  createTypeDeclaration,
  createTypeField,
  createTupleExpression,
  createUnaryExpression,
  createWhileStatement,
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
  constructor(service: FunctionAstService, overrides: Partial<ValidatorConfig> = {}) {
    super({ ...overrides, ast: { mode: 'primary', service } });
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

  it("warns when method declarations don't place 'this' as the first parameter", () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'method Point.distance(target, this) => target',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleValue = createStringLiteral('Example', '"Example"', 15, 2);
    const titleArgument = createArgument(titleValue, 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);

    const functionIdentifier = createIdentifier('Point.distance', 7, 3);
    const targetParam = createParameter('target', 22, 3);
    const thisParam = createParameter('this', 30, 3);
    const returnIdentifier = createIdentifier('target', 39, 3);
    const returnStatement = createReturn(returnIdentifier, 36, 45, 3);
    const body = createBlock([returnStatement], 36, 45, 3);
    const methodDeclaration = createFunctionDeclaration(
      functionIdentifier,
      [targetParam, thisParam],
      body,
      0,
      45,
      3,
    );

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, methodDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const misplacedThisWarnings = result.warnings.filter((warning) => warning.code === 'PSM01');
    expect(misplacedThisWarnings).toHaveLength(1);
    expect(misplacedThisWarnings[0]?.line).toBe(3);
    expect(misplacedThisWarnings[0]?.column).toBe(31);

    const context = validator.exposeContext();
    expect(context.functionParams.get('Point.distance')).toEqual(['target', 'this']);
    expect(context.methodNames.has('Point.distance')).toBe(true);
  });

  it('emits duplicate parameter diagnostics from AST function declarations', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'myFunction(value, value) => value',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleValue = createStringLiteral('Example', '"Example"', 15, 2);
    const titleArgument = createArgument(titleValue, 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);

    const functionIdentifier = createIdentifier('myFunction', 0, 3);
    const firstParam = createParameter('value', 12, 3);
    const duplicateParam = createParameter('value', 19, 3);
    const returnIdentifier = createIdentifier('value', 27, 3);
    const returnStatement = createReturn(returnIdentifier, 24, 33, 3);
    const body = createBlock([returnStatement], 24, 33, 3);
    const functionDeclaration = createFunctionDeclaration(
      functionIdentifier,
      [firstParam, duplicateParam],
      body,
      0,
      33,
      3,
    );

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, functionDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const duplicateErrors = result.errors.filter((error) => error.code === 'PSDUP01');
    expect(duplicateErrors).toHaveLength(1);
    expect(duplicateErrors[0]?.line).toBe(3);
    expect(duplicateErrors[0]?.column).toBe(20);

    expect(validator.exposeContext().functionParams.get('myFunction')).toEqual(['value', 'value']);
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

  it('registers type declarations and their fields through AST traversal', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'type Point',
      '    float x',
      '    float y',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleValue = createStringLiteral('Example', '"Example"', 18, 2);
    const titleArgument = createArgument(titleValue, 15, 26, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 27, 2);

    const typeIdentifier = createIdentifier('Point', 5, 3);
    const xType = createTypeReference('float', 4, 4);
    const xIdentifier = createIdentifier('x', 10, 4);
    const xField = createTypeField(xIdentifier, xType, 4, xIdentifier.range[1], 4);
    const yType = createTypeReference('float', 4, 5);
    const yIdentifier = createIdentifier('y', 10, 5);
    const yField = createTypeField(yIdentifier, yType, 4, yIdentifier.range[1], 5);
    const typeDeclaration = createTypeDeclaration(typeIdentifier, [xField, yField], 0, yIdentifier.range[1], 3, 5);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, typeDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    validator.validate(source);

    const context = validator.exposeContext();
    expect(context.declaredVars.get('Point')).toBe(3);

    const coreModule = ((validator as any).modules[0] ?? null) as CoreValidator | null;
    expect(coreModule).not.toBeNull();

    const typeFields: Map<string, Set<string>> = (coreModule as any).typeFields;
    expect(typeFields.get('Point')).toEqual(new Set(['x', 'y']));
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

  it('warns on assignments in conditional tests using AST binary expressions', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'var value = 0',
      'if (value = 2)',
      '    plot(value)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const valueIdentifier = createIdentifier('value', 4, 3);
    const valueInitializer = createNumberLiteral(0, '0', 13, 3);
    const valueDeclaration = createVariableDeclaration(valueIdentifier, 4, 15, 3, {
      declarationKind: 'var',
      initializer: valueInitializer,
    });
    const conditionLeft = createIdentifier('value', 5, 4);
    const conditionRight = createNumberLiteral(2, '2', 15, 4);
    const assignmentCondition = createBinaryExpression('=', conditionLeft, conditionRight, 5, 16, 4);
    const plotCallee = createIdentifier('plot', 5, 5);
    const plotArgument = createArgument(createIdentifier('value', 10, 5), 10, 15, 5);
    const plotCall = createCallExpression(plotCallee, [plotArgument], 5, 16, 5);
    const plotStatement = createExpressionStatement(plotCall, 5, 16, 5);
    const consequentBlock = createBlock([plotStatement], 4, 17, 4, 5);
    const ifStatement = createIfStatement(assignmentCondition, consequentBlock, null, 4, 17, 4);

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

    const assignmentWarnings = result.warnings.filter((warning) => warning.code === 'PSO02');
    expect(assignmentWarnings).toHaveLength(1);
    expect(assignmentWarnings[0]?.line).toBe(4);
  });

  it('flags invalid var/const combinations through AST variable declarations', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'var const foo = 1',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const fooIdentifier = createIdentifier('foo', 10, 3);
    const fooInitializer = createNumberLiteral(1, '1', 16, 3);
    const fooDeclaration = createVariableDeclaration(fooIdentifier, 10, 17, 3, {
      declarationKind: 'var',
      initializer: fooInitializer,
    });

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, fooDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const invalidDeclarations = result.errors.filter((error) => error.code === 'PSD01');
    expect(invalidDeclarations).toHaveLength(1);
    expect(invalidDeclarations[0]?.line).toBe(3);
  });

  it('flags := usage in declarations via AST analysis', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'var foo := 1',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const fooIdentifier = createIdentifier('foo', 4, 3);
    const fooInitializer = createNumberLiteral(1, '1', 11, 3);
    const fooDeclaration = createVariableDeclaration(fooIdentifier, 4, 12, 3, {
      declarationKind: 'var',
      initializer: fooInitializer,
    });

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, fooDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const assignErrors = result.errors.filter((error) => error.code === 'PSD02');
    expect(assignErrors).toHaveLength(1);
    expect(assignErrors[0]?.line).toBe(3);
  });

  it('prevents const reassignment with = using AST assignments', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'const limit = 5',
      'limit = limit + 1',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const limitIdentifier = createIdentifier('limit', 6, 3);
    const limitInitializer = createNumberLiteral(5, '5', 14, 3);
    const limitDeclaration = createVariableDeclaration(limitIdentifier, 6, 15, 3, {
      declarationKind: 'const',
      initializer: limitInitializer,
    });
    const assignmentLeft = createIdentifier('limit', 0, 4);
    const assignmentRight = createBinaryExpression(
      '+',
      createIdentifier('limit', 8, 4),
      createNumberLiteral(1, '1', 16, 4),
      8,
      17,
      4,
    );
    const reassignment = createAssignmentStatement(assignmentLeft, assignmentRight, 0, 17, 4);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, limitDeclaration, reassignment]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const constErrors = result.errors.filter((error) => error.code === 'PS019');
    expect(constErrors).toHaveLength(1);
    expect(constErrors[0]?.line).toBe(4);
    expect(constErrors[0]?.message).toContain("with '='");
  });

  it('prevents const reassignment with := using AST assignments', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'const limit = 5',
      'limit := limit + 1',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const limitIdentifier = createIdentifier('limit', 6, 3);
    const limitInitializer = createNumberLiteral(5, '5', 14, 3);
    const limitDeclaration = createVariableDeclaration(limitIdentifier, 6, 15, 3, {
      declarationKind: 'const',
      initializer: limitInitializer,
    });
    const assignmentLeft = createIdentifier('limit', 0, 4);
    const assignmentRight = createBinaryExpression(
      '+',
      createIdentifier('limit', 9, 4),
      createNumberLiteral(1, '1', 17, 4),
      9,
      18,
      4,
    );
    const reassignment = createAssignmentStatement(assignmentLeft, assignmentRight, 0, 18, 4);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, limitDeclaration, reassignment]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const constErrors = result.errors.filter((error) => error.code === 'PS019');
    expect(constErrors).toHaveLength(1);
    expect(constErrors[0]?.line).toBe(4);
    expect(constErrors[0]?.message).toContain("with ':='");
  });

  it('enforces = usage for tuple destructuring via AST assignments', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      '[fast, slow] := request.security("TICKER", "D", close)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const fastIdentifier = createIdentifier('fast', 1, 3);
    const slowIdentifier = createIdentifier('slow', 7, 3);
    const tuplePattern = createTupleExpression([fastIdentifier, slowIdentifier], 0, 12, 3);
    const requestIdentifier = createIdentifier('request', 15, 3);
    const securityProperty = createIdentifier('security', 23, 3);
    const requestMember = createMemberExpression(requestIdentifier, securityProperty, 15, 31, 3);
    const tickerArgument = createArgument(createStringLiteral('TICKER', '"TICKER"', 32, 3), 32, 41, 3);
    const timeframeArgument = createArgument(createStringLiteral('D', '"D"', 43, 3), 43, 47, 3);
    const closeArgument = createArgument(createIdentifier('close', 49, 3), 49, 54, 3);
    const requestCall = createCallExpression(requestMember, [tickerArgument, timeframeArgument, closeArgument], 15, 55, 3);
    const assignment = createAssignmentStatement(tuplePattern, requestCall, 0, 55, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, assignment]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const tupleErrors = result.errors.filter((error) => error.code === 'PST03');
    expect(tupleErrors).toHaveLength(1);
    expect(tupleErrors[0]?.line).toBe(3);
  });

  it('warns on dotted tuple bindings through AST member expressions', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      '[foo, this.bar] = array.shift(myArray)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const fooIdentifier = createIdentifier('foo', 1, 3);
    const thisIdentifier = createIdentifier('this', 7, 3);
    const barIdentifier = createIdentifier('bar', 12, 3);
    const memberBinding = createMemberExpression(thisIdentifier, barIdentifier, 7, 15, 3);
    const tuplePattern = createTupleExpression([fooIdentifier, memberBinding], 0, 15, 3);
    const arrayNamespace = createIdentifier('array', 18, 3);
    const shiftProperty = createIdentifier('shift', 24, 3);
    const shiftMember = createMemberExpression(arrayNamespace, shiftProperty, 18, 27, 3);
    const arrayArgument = createArgument(createIdentifier('myArray', 29, 3), 29, 36, 3);
    const shiftCall = createCallExpression(shiftMember, [arrayArgument], 18, 37, 3);
    const assignment = createAssignmentStatement(tuplePattern, shiftCall, 0, 37, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, assignment]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const dottedWarnings = result.warnings.filter((warning) => warning.code === 'PST01');
    expect(dottedWarnings).toHaveLength(1);
    expect(dottedWarnings[0]?.line).toBe(3);
  });

  it('emits empty-slot tuple warnings when AST patterns include gaps', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      '[first, , third] = request.security("TICKER", "D", close)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const firstIdentifier = createIdentifier('first', 1, 3);
    const thirdIdentifier = createIdentifier('third', 10, 3);
    const tuplePattern = createTupleExpression([firstIdentifier, null, thirdIdentifier], 0, 15, 3);
    const requestIdentifier = createIdentifier('request', 18, 3);
    const securityProperty = createIdentifier('security', 26, 3);
    const requestMember = createMemberExpression(requestIdentifier, securityProperty, 18, 34, 3);
    const tickerArgument = createArgument(createStringLiteral('TICKER', '"TICKER"', 35, 3), 35, 44, 3);
    const timeframeArgument = createArgument(createStringLiteral('D', '"D"', 46, 3), 46, 50, 3);
    const closeArgument = createArgument(createIdentifier('close', 52, 3), 52, 57, 3);
    const requestCall = createCallExpression(requestMember, [tickerArgument, timeframeArgument, closeArgument], 18, 58, 3);
    const assignment = createAssignmentStatement(tuplePattern, requestCall, 0, 58, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, assignment]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const tupleWarnings = result.warnings.filter((warning) => warning.code === 'PST02');
    expect(tupleWarnings).toHaveLength(1);
    expect(tupleWarnings[0]?.line).toBe(3);
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

  it('warns on disallowed logical operator tokens via AST binary expressions', () => {
    const source = [
      '//@version=6',
      'indicator("Ops")',
      'plot(condA && condB)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Ops', '"Ops"', 15, 2), 10, 21, 2);
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 22, 2);
    const leftCondition = createIdentifier('condA', 5, 3);
    const rightCondition = createIdentifier('condB', 14, 3);
    const logicalExpression = createBinaryExpression('&&', leftCondition, rightCondition, 5, 19, 3);
    const plotArgument = createArgument(logicalExpression, 5, 19, 3);
    const plotCall = createCallExpression(createIdentifier('plot', 0, 3), [plotArgument], 0, 20, 3);
    const plotStatement = createExpressionStatement(plotCall, 0, 20, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, plotStatement]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const invalidOperatorWarnings = result.warnings.filter((warning) => warning.code === 'PSO01');
    expect(invalidOperatorWarnings).toHaveLength(1);
    expect(invalidOperatorWarnings[0]?.line).toBe(3);
    expect(invalidOperatorWarnings[0]?.message).toContain("'&&'");
  });

  it('warns on expensive operations in loops when performance analysis is enabled', () => {
    const source = [
      '//@version=6',
      'indicator(title="Perf")',
      'var keepGoing = true',
      'while keepGoing',
      '    request.security(syminfo.tickerid, timeframe.period, close)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Perf', '"Perf"', 15, 2), 10, 21, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 22, 2);
    const keepGoingIdentifier = createIdentifier('keepGoing', 4, 3);
    const keepGoingInitializer = createBooleanLiteral(true, 17, 3);
    const keepGoingDeclaration = createVariableDeclaration(keepGoingIdentifier, 4, 21, 3, {
      declarationKind: 'var',
      initializer: keepGoingInitializer,
    });
    const loopTest = createIdentifier('keepGoing', 7, 4);
    const requestNamespace = createIdentifier('request', 5, 5);
    const securityProperty = createIdentifier('security', 13, 5);
    const requestCallee = createMemberExpression(requestNamespace, securityProperty, 5, 22, 5);
    const tickerNamespace = createIdentifier('syminfo', 23, 5);
    const tickerProperty = createIdentifier('tickerid', 31, 5);
    const tickerArgument = createMemberExpression(tickerNamespace, tickerProperty, 23, 41, 5);
    const timeframeNamespace = createIdentifier('timeframe', 43, 5);
    const timeframeProperty = createIdentifier('period', 52, 5);
    const timeframeArgument = createMemberExpression(timeframeNamespace, timeframeProperty, 43, 58, 5);
    const closeArgument = createIdentifier('close', 60, 5);
    const requestArguments = [
      createArgument(tickerArgument, 23, 41, 5),
      createArgument(timeframeArgument, 43, 58, 5),
      createArgument(closeArgument, 60, 65, 5),
    ];
    const requestCall = createCallExpression(requestCallee, requestArguments, 5, 66, 5);
    const requestStatement = createExpressionStatement(requestCall, 5, 66, 5);
    const loopBody = createBlock([requestStatement], 4, 67, 4, 5);
    const whileStatement = createWhileStatement(loopTest, loopBody, 4, 67, 4);

    const program = createProgramFromSource(
      source,
      [directive],
      [scriptDeclaration, keepGoingDeclaration, whileStatement],
    );
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service, { enablePerformanceAnalysis: true });
    const result = validator.validate(source);

    const expensiveWarnings = result.warnings.filter((warning) => warning.code === 'PSP001');
    expect(expensiveWarnings).toHaveLength(1);
    expect(expensiveWarnings[0]?.line).toBe(5);
  });

  it('warns on dense history references when performance analysis is enabled', () => {
    const source = [
      '//@version=6',
      'indicator("Hist flood")',
      '_ = close[1] + close[2] + close[3] + close[4] + close[5] + close[6]',
      'plot(close)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleLiteral = createStringLiteral('Hist flood', '"Hist flood"', 15, 2);
    const titleArgument = createArgument(titleLiteral, 10, 27, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 28, 2);

    const makeHistoryReference = (start: number, literal: number) => {
      const identifier = createIdentifier('close', start, 3);
      const literalNode = createNumberLiteral(literal, literal.toString(), start + 6, 3);
      return createIndexExpression(identifier, literalNode, start, literalNode.range[1] + 1, 3);
    };

    const historyReferences = [
      makeHistoryReference(4, 1),
      makeHistoryReference(16, 2),
      makeHistoryReference(28, 3),
      makeHistoryReference(40, 4),
      makeHistoryReference(52, 5),
      makeHistoryReference(64, 6),
    ];

    const expressionStart = historyReferences[0]!.range[0];
    let sumExpression = historyReferences[0]!;
    for (let index = 1; index < historyReferences.length; index++) {
      const reference = historyReferences[index]!;
      sumExpression = createBinaryExpression('+', sumExpression, reference, expressionStart, reference.range[1], 3);
    }

    const assignmentTarget = createIdentifier('_', 0, 3);
    const assignment = createAssignmentStatement(assignmentTarget, sumExpression, 0, sumExpression.range[1], 3);

    const plotArgument = createArgument(createIdentifier('close', 5, 4), 5, 10, 4);
    const plotCall = createCallExpression(createIdentifier('plot', 0, 4), [plotArgument], 0, 11, 4);
    const plotStatement = createExpressionStatement(plotCall, 0, 11, 4);

    const program = createProgramFromSource(
      source,
      [directive],
      [scriptDeclaration, assignment, plotStatement],
    );
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service, { enablePerformanceAnalysis: true });
    const result = validator.validate(source);

    const historyWarnings = result.warnings.filter((warning) => warning.code === 'PSP002');
    expect(historyWarnings).toHaveLength(1);
    expect(historyWarnings[0]?.line).toBe(3);
  });

  it('warns on increment operators surfaced by AST unary expressions', () => {
    const source = [
      '//@version=6',
      'indicator("Ops")',
      'var counter = 0',
      'counter++',
      'plot(counter)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Ops', '"Ops"', 15, 2), 10, 21, 2);
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 22, 2);
    const counterIdentifier = createIdentifier('counter', 4, 3);
    const counterDeclaration = createVariableDeclaration(counterIdentifier, 4, 17, 3, {
      declarationKind: 'var',
      initializer: createNumberLiteral(0, '0', 16, 3),
    });
    const incrementExpression = createUnaryExpression('++', createIdentifier('counter', 0, 4), 0, 9, 4, false);
    const incrementStatement = createExpressionStatement(incrementExpression, 0, 9, 4);
    const plotArgument = createArgument(createIdentifier('counter', 5, 5), 5, 12, 5);
    const plotCall = createCallExpression(createIdentifier('plot', 0, 5), [plotArgument], 0, 13, 5);
    const plotStatement = createExpressionStatement(plotCall, 0, 13, 5);

    const program = createProgramFromSource(
      source,
      [directive],
      [scriptDeclaration, counterDeclaration, incrementStatement, plotStatement],
    );
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const invalidOperatorWarnings = result.warnings.filter((warning) => warning.code === 'PSO01');
    expect(invalidOperatorWarnings).toHaveLength(1);
    expect(invalidOperatorWarnings[0]?.line).toBe(4);
    expect(invalidOperatorWarnings[0]?.message).toContain("'++'");
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

  it('warns when input calls appear inside non-global scopes using AST placement checks', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'compute(x) =>',
      '    input.int(1)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const functionIdentifier = createIdentifier('compute', 0, 3);
    const functionParam = createParameter('x', 8, 3);
    const inputNamespace = createIdentifier('input', 4, 4);
    const inputProperty = createIdentifier('int', 10, 4);
    const inputMember = createMemberExpression(inputNamespace, inputProperty, 4, 12, 4);
    const inputArgument = createArgument(createNumberLiteral(1, '1', 14, 4), 13, 15, 4);
    const inputCall = createCallExpression(inputMember, [inputArgument], 4, 16, 4);
    const inputStatement = createExpressionStatement(inputCall, 4, 16, 4);
    const functionBody = createBlock([inputStatement], 4, 17, 4, 4);
    const functionDeclaration = createFunctionDeclaration(functionIdentifier, [functionParam], functionBody, 0, 17, 3, 4);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, functionDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const inputWarnings = result.warnings.filter((warning) => warning.code === 'PS027');
    expect(inputWarnings).toHaveLength(1);
    expect(inputWarnings[0]?.line).toBe(4);
  });

  it('allows top-level input calls without emitting placement warnings', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'input.int(1)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const inputNamespace = createIdentifier('input', 0, 3);
    const inputProperty = createIdentifier('int', 6, 3);
    const inputMember = createMemberExpression(inputNamespace, inputProperty, 0, 8, 3);
    const inputArgument = createArgument(createNumberLiteral(1, '1', 10, 3), 9, 11, 3);
    const inputCall = createCallExpression(inputMember, [inputArgument], 0, 12, 3);
    const inputStatement = createExpressionStatement(inputCall, 0, 12, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, inputStatement]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const inputWarnings = result.warnings.filter((warning) => warning.code === 'PS027');
    expect(inputWarnings).toHaveLength(0);
  });

  it('tracks function parameter usage through AST identifier traversal', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'sum(value) =>',
      '    return value + 1',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const functionIdentifier = createIdentifier('sum', 0, 3);
    const functionParam = createParameter('value', 4, 3);
    const returnArgument = createBinaryExpression(
      '+',
      createIdentifier('value', 11, 4),
      createNumberLiteral(1, '1', 19, 4),
      11,
      20,
      4,
    );
    const returnStatement = createReturn(returnArgument, 4, 20, 4);
    const functionBody = createBlock([returnStatement], 4, 21, 4, 4);
    const functionDeclaration = createFunctionDeclaration(functionIdentifier, [functionParam], functionBody, 0, 21, 3, 4);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, functionDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const paramWarnings = result.warnings.filter((warning) => warning.code === 'PSU-PARAM');
    expect(paramWarnings).toHaveLength(0);
  });

  it('emits PSU-PARAM warnings when parameters are never referenced', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'sum(value) =>',
      '    return 0',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const functionIdentifier = createIdentifier('sum', 0, 3);
    const functionParam = createParameter('value', 4, 3);
    const returnStatement = createReturn(createNumberLiteral(0, '0', 12, 4), 4, 13, 4);
    const functionBody = createBlock([returnStatement], 4, 14, 4, 4);
    const functionDeclaration = createFunctionDeclaration(functionIdentifier, [functionParam], functionBody, 0, 14, 3, 4);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, functionDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const paramWarnings = result.warnings.filter((warning) => warning.code === 'PSU-PARAM');
    expect(paramWarnings).toHaveLength(1);
    expect(paramWarnings[0]?.line).toBe(3);
  });

  it('tracks variable usage through AST identifier traversal to suppress PSU01 warnings', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'var setting = input.int(1)',
      'plot(setting)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const settingIdentifier = createIdentifier('setting', 4, 3);
    const inputNamespace = createIdentifier('input', 15, 3);
    const inputProperty = createIdentifier('int', 21, 3);
    const inputMember = createMemberExpression(inputNamespace, inputProperty, 15, 23, 3);
    const inputArgument = createArgument(createNumberLiteral(1, '1', 25, 3), 24, 26, 3);
    const inputCall = createCallExpression(inputMember, [inputArgument], 15, 27, 3);
    const settingDeclaration = createVariableDeclaration(settingIdentifier, 4, 27, 3, {
      declarationKind: 'var',
      initializer: inputCall,
    });
    const plotArgument = createArgument(createIdentifier('setting', 5, 4), 5, 12, 4);
    const plotCall = createCallExpression(createIdentifier('plot', 0, 4), [plotArgument], 0, 12, 4);
    const plotStatement = createExpressionStatement(plotCall, 0, 12, 4);

    const program = createProgramFromSource(
      source,
      [directive],
      [scriptDeclaration, settingDeclaration, plotStatement],
    );
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const unusedWarnings = result.warnings.filter((warning) => warning.code === 'PSU01');
    expect(unusedWarnings).toHaveLength(0);
  });

  it('emits PSU01 warnings when declared variables are never used', () => {
    const source = [
      '//@version=6',
      'indicator(title="Example")',
      'var unused = 1',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const unusedIdentifier = createIdentifier('unused', 4, 3);
    const unusedDeclaration = createVariableDeclaration(unusedIdentifier, 4, 16, 3, {
      declarationKind: 'var',
      initializer: createNumberLiteral(1, '1', 16, 3),
    });

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, unusedDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new CoreValidatorHarness(service);
    const result = validator.validate(source);

    const unusedWarnings = result.warnings.filter((warning) => warning.code === 'PSU01');
    expect(unusedWarnings).toHaveLength(1);
    expect(unusedWarnings[0]?.line).toBe(3);
  });
});
