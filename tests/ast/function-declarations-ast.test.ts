import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { FunctionDeclarationsValidator } from '../../modules/functions/function-declarations';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import type { AstValidationContext, ValidatorConfig } from '../../core/types';
import {
  createArgument,
  createBlock,
  createFunctionDeclaration,
  createIdentifier,
  createParameter,
  createReturn,
  createScriptDeclaration,
  createStringLiteral,
  createTypeReference,
  createVersionDirective,
} from './fixtures';
import {
  createLocation,
  createPosition,
  createRange,
  type ProgramNode,
} from '../../core/ast/nodes';

class FunctionDeclarationsHarness extends BaseValidator {
  constructor(service: FunctionAstService, overrides: Partial<ValidatorConfig> = {}) {
    super({ ...overrides, ast: { mode: 'primary', service } });
    this.registerModule(new FunctionDeclarationsValidator());
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

describe('FunctionDeclarationsValidator AST integration', () => {
  it('collects function declarations from AST traversal', () => {
    const source = [
      '//@version=6',
      'indicator("Example")',
      'myFunc(float value) =>',
      '    value',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const title = createStringLiteral('Example', '"Example"', 15, 2);
    const titleArgument = createArgument(title, 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);

    const identifier = createIdentifier('myFunc', 0, 3);
    const parameter = {
      ...createParameter('value', 17, 3),
      typeAnnotation: createTypeReference('float', 7, 3),
    };
    const returnIdentifier = createIdentifier('value', 9, 4);
    const returnStatement = createReturn(returnIdentifier, 5, 14, 4);
    const body = createBlock([returnStatement], 5, 14, 4);
    const functionDeclaration = createFunctionDeclaration(identifier, [parameter], body, 0, 14, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, functionDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new FunctionDeclarationsHarness(service);
    const result = validator.validate(source);
    const context = validator.exposeContext();

    expect(result.errors).toEqual([]);
    expect(Array.from(context.functionNames)).toContain('myFunc');
    expect(context.functionParams.get('myFunc')).toEqual(['float value']);
  });

  it('emits PSDUP01 when AST parameters repeat names', () => {
    const source = [
      '//@version=6',
      'indicator("Dup")',
      'dup(x, x) =>',
      '    x',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const title = createStringLiteral('Dup', '"Dup"', 15, 2);
    const titleArgument = createArgument(title, 10, 20, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 21, 2);

    const identifier = createIdentifier('dup', 0, 3);
    const firstParam = createParameter('x', 4, 3);
    const secondParam = createParameter('x', 7, 3);
    const returnIdentifier = createIdentifier('x', 7, 4);
    const returnStatement = createReturn(returnIdentifier, 5, 8, 4);
    const body = createBlock([returnStatement], 5, 8, 4);
    const functionDeclaration = createFunctionDeclaration(identifier, [firstParam, secondParam], body, 0, 8, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, functionDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new FunctionDeclarationsHarness(service);
    const result = validator.validate(source);

    expect(result.errors.some((error) => error.code === 'PSDUP01')).toBe(true);
  });

  it('registers method metadata for dotted declarations', () => {
    const source = [
      '//@version=6',
      'indicator("Method")',
      'method Point.move(this, dx) =>',
      '    this.x := this.x + dx',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const title = createStringLiteral('Method', '"Method"', 15, 2);
    const titleArgument = createArgument(title, 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);

    const identifier = createIdentifier('Point.move', 0, 3);
    const thisParam = createParameter('this', 18, 3);
    const dxParam = createParameter('dx', 24, 3);
    const body = createBlock([], 0, 0, 4);
    const functionDeclaration = createFunctionDeclaration(identifier, [thisParam, dxParam], body, 0, 0, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, functionDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new FunctionDeclarationsHarness(service);
    validator.validate(source);
    const context = validator.exposeContext();

    expect(context.functionNames.has('move')).toBe(true);
    expect(context.functionNames.has('Point.move')).toBe(true);
    expect(context.methodNames.has('move')).toBe(true);
    expect(context.functionParams.get('Point.move')).toEqual(['this', 'dx']);
  });

  it('flags static declarations when AST traversal succeeds', () => {
    const source = [
      '//@version=6',
      'indicator("Static")',
      'type Rectangle',
      '    float x',
      '    static Rectangle new(float x) =>',
      '        Rectangle.new(x)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const title = createStringLiteral('Static', '"Static"', 15, 2);
    const titleArgument = createArgument(title, 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration]);
    const service = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const validator = new FunctionDeclarationsHarness(service);
    const result = validator.validate(source);

    expect(result.errors.some((error) => error.code === 'PSV6-STATIC-UNSUPPORTED')).toBe(true);
  });
});
