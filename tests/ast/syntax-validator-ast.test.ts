import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { SyntaxValidator } from '../../modules/syntax-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import type { ValidatorConfig } from '../../core/types';
import {
  createArgument,
  createBlock,
  createAssignmentStatement,
  createCallExpression,
  createExpressionStatement,
  createFunctionDeclaration,
  createIdentifier,
  createIndexExpression,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createScriptDeclaration,
  createStringLiteral,
  createTupleExpression,
  createVariableDeclaration,
  createVersionDirective,
  createReturn,
} from './fixtures';
import {
  createLocation,
  createPosition,
  createRange,
  type ProgramNode,
} from '../../core/ast/nodes';

class SyntaxValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService, overrides: Partial<ValidatorConfig> = {}) {
    super({ ...overrides, ast: { mode: 'primary', service } });
    this.registerModule(new SyntaxValidator());
  }

  protected runCoreValidation(): void {}
}

class DisabledSyntaxValidatorHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new SyntaxValidator());
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

describe('SyntaxValidator AST integration', () => {
  it('returns no diagnostics when AST mode is disabled', () => {
    const validator = new DisabledSyntaxValidatorHarness();
    const result = validator.validate('');

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });

  it('emits PSW01 and PS002 for misplaced and duplicate version directives', () => {
    const source = [
      'plot(close)',
      '//@version=6',
      '//@version=6',
      'indicator(title="Example")',
      '',
    ].join('\n');

    const plotCallee = createIdentifier('plot', 0, 1);
    const plotArgumentValue = createIdentifier('close', 5, 1);
    const plotArgument = createArgument(plotArgumentValue, 5, 10, 1);
    const plotCall = createCallExpression(plotCallee, [plotArgument], 0, 11, 1);
    const plotStatement = createExpressionStatement(plotCall, 0, 11, 1);

    const directivePrimary = createVersionDirective(6, 0, 12, 2);
    const directiveDuplicate = createVersionDirective(6, 0, 12, 3);

    const titleValue = createStringLiteral('Example', '"Example"', 16, 4);
    const titleArgument = createArgument(titleValue, 10, 24, 4, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 26, 4);

    const program = createProgramFromSource(source, [directivePrimary, directiveDuplicate], [plotStatement, scriptDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new SyntaxValidatorHarness(service);
    const result = validator.validate(source);

    const codes = new Set([
      ...result.errors.map((error) => error.code),
      ...result.warnings.map((warning) => warning.code),
      ...result.info.map((info) => info.code),
    ]);

    expect(codes.has('PSW01')).toBe(true);
    expect(result.errors.some((error) => error.code === 'PS002' && error.line === 3)).toBe(true);
  });

  it('advises when the script declaration is far from the top', () => {
    const source = [
      '//@version=6',
      'plot(close)',
      'plot(close)',
      'plot(close)',
      'plot(close)',
      'plot(close)',
      'plot(close)',
      'plot(close)',
      'plot(close)',
      'indicator(title="Late")',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleValue = createStringLiteral('Late', '"Late"', 16, 10);
    const titleArgument = createArgument(titleValue, 10, 24, 10, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 10);

    const plotLines = [2, 3, 4, 5, 6, 7, 8, 9];
    const plotStatements = plotLines.map((line) => {
      const callee = createIdentifier('plot', 0, line);
      const argumentValue = createIdentifier('close', 5, line);
      const argument = createArgument(argumentValue, 5, 10, line);
      const call = createCallExpression(callee, [argument], 0, 11, line);
      return createExpressionStatement(call, 0, 11, line);
    });

    const program = createProgramFromSource(source, [directive], [...plotStatements, scriptDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new SyntaxValidatorHarness(service);
    const result = validator.validate(source);

    expect(result.info.some((info) => info.code === 'PSI01')).toBe(true);
  });

  it('flags keyword conflicts for functions and variables', () => {
    const source = [
      '//@version=6',
      'indicator("Names")',
      'if() => 1',
      'var int = 1',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleValue = createStringLiteral('Names', '"Names"', 15, 2);
    const titleArgument = createArgument(titleValue, 10, 21, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 22, 2);

    const functionIdentifier = createIdentifier('if', 0, 3);
    const returnValue = createNumberLiteral(1, '1', 8, 3);
    const returnStatement = createReturn(returnValue, 5, 9, 3);
    const functionBody = createBlock([returnStatement], 5, 9, 3, 3);
    const functionDeclaration = createFunctionDeclaration(functionIdentifier, [], functionBody, 0, 9, 3);

    const varIdentifier = createIdentifier('int', 4, 4);
    const initializer = createNumberLiteral(1, '1', 10, 4);
    const varDeclaration = createVariableDeclaration(varIdentifier, 0, 11, 4, {
      declarationKind: 'var',
      initializer,
    });

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, functionDeclaration, varDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new SyntaxValidatorHarness(service);
    const result = validator.validate(source);

    expect(result.errors.some((error) => error.code === 'PS006')).toBe(true);
    expect(result.errors.some((error) => error.code === 'PS007')).toBe(true);
  });

  it('detects tuple destructuring issues and parameter counts', () => {
    const source = [
      '//@version=6',
      'indicator("Tuples")',
      '[a,, c] := result',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleValue = createStringLiteral('Tuples', '"Tuples"', 15, 2);
    const titleArgument = createArgument(titleValue, 10, 22, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 23, 2);

    const elementA = createIdentifier('a', 1, 3);
    const elementC = createIdentifier('c', 5, 3);
    const tuple = createTupleExpression([elementA, null, elementC], 0, 6, 3);
    const rhs = createIdentifier('result', 11, 3);
    const assignment = createAssignmentStatement(tuple, rhs, 0, 16, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, assignment]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new SyntaxValidatorHarness(service);
    const result = validator.validate(source);

    expect(result.errors.some((error) => error.code === 'PST03')).toBe(true);
    expect(result.warnings.some((warning) => warning.code === 'PST02')).toBe(true);
  });

  it('warns when member assignments use = and array elements are undeclared', () => {
    const source = [
      '//@version=6',
      'indicator("Fields")',
      'foo = 1',
      'foo.bar = 2',
      'baz[0] := 1',
      'qux[1] += 2',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleValue = createStringLiteral('Fields', '"Fields"', 15, 2);
    const titleArgument = createArgument(titleValue, 10, 22, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 23, 2);

    const fooIdentifier = createIdentifier('foo', 0, 3);
    const fooInitializer = createNumberLiteral(1, '1', 6, 3);
    const fooDeclaration = createVariableDeclaration(fooIdentifier, 0, 7, 3, {
      declarationKind: 'simple',
      initializer: fooInitializer,
    });

    const memberObject = createIdentifier('foo', 0, 4);
    const memberProperty = createIdentifier('bar', 4, 4);
    const fieldMember = createMemberExpression(memberObject, memberProperty, 0, 7, 4);
    const fieldAssignment = createAssignmentStatement(fieldMember, createNumberLiteral(2, '2', 10, 4), 0, 11, 4);

    const bazIdentifier = createIdentifier('baz', 0, 5);
    const bazIndex = createNumberLiteral(0, '0', 4, 5);
    const bazIndexExpression = createIndexExpression(bazIdentifier, bazIndex, 0, 6, 5);
    const bazAssignment = createAssignmentStatement(bazIndexExpression, createNumberLiteral(1, '1', 10, 5), 0, 11, 5);

    const quxIdentifier = createIdentifier('qux', 0, 6);
    const quxIndex = createNumberLiteral(1, '1', 4, 6);
    const quxIndexExpression = createIndexExpression(quxIdentifier, quxIndex, 0, 6, 6);
    const quxAssignment = createAssignmentStatement(quxIndexExpression, createNumberLiteral(2, '2', 10, 6), 0, 11, 6);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, fooDeclaration, fieldAssignment, bazAssignment, quxAssignment]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new SyntaxValidatorHarness(service);
    const result = validator.validate(source);

    expect(result.errors.some((error) => error.code === 'PS016' && error.line === 4)).toBe(true);
    expect(result.errors.some((error) => error.code === 'PS016A' && error.line === 5)).toBe(true);
    expect(result.errors.some((error) => error.code === 'PS017A' && error.line === 6)).toBe(true);
  });

  it('emits PS-EMPTY when scripts contain no executable content', () => {
    const source = '';
    const program = createProgram([], 0, 0);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new SyntaxValidatorHarness(service);
    const result = validator.validate(source);

    expect(result.errors.some((error) => error.code === 'PS-EMPTY')).toBe(true);
  });
});
