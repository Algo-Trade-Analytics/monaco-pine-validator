import { describe, expect, it, vi } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import type { AstValidationContext, AstService, ValidatorConfig } from '../../core/types';
import { CoreValidator } from '../../modules/core-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createAssignmentStatement,
  createCallExpression,
  createExpressionStatement,
  createIdentifier,
  createIndexExpression,
  createNumberLiteral,
  createScriptDeclaration,
  createStringLiteral,
  createUnaryExpression,
  createVersionDirective,
} from './fixtures';
import {
  createLocation,
  createPosition,
  createRange,
  type ProgramNode,
} from '../../core/ast/nodes';
import { createMonacoWorkerHarness } from '../../core/monaco/worker-harness';
import { MarkerSeverity } from '../../core/ast/diagnostics';
import { SyntaxError } from '../../pynescript/ast/error';

class CoreWorkerValidator extends BaseValidator {
  constructor(config: Partial<ValidatorConfig>) {
    super(config);
    this.registerModule(new CoreValidator());
  }

  protected runCoreValidation(): void {}

  getAstContext(): AstValidationContext {
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
  const endLine = lines.length || 1;
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

describe('Monaco worker harness', () => {
  it('produces Monaco markers from AST-backed diagnostics', async () => {
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
    const astService = new FunctionAstService(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));

    const harness = createMonacoWorkerHarness({
      markerSource: 'worker',
      astService,
      createValidator: (config) => new CoreWorkerValidator(config),
    });

    const response = await harness.validate({ code: source, version: 1 });

    expect(response.result.errors.some((error) => error.code === 'PS024')).toBe(true);
    expect(harness.getLastContext()?.scriptType).toBe('indicator');

    expect(response.semanticModel.ast).toBe(program);
    expect(response.semanticModel.symbols.some((symbol) => symbol.name === 'values')).toBe(true);
    expect(response.hoverData.some((entry) => entry.name === 'values')).toBe(true);
    const valuesHover = response.hoverData.find((entry) => entry.name === 'values');
    expect(valuesHover?.type).toBeDefined();

    const ps024Marker = response.markers.find((marker) => marker.code === 'PS024');
    expect(ps024Marker).toBeDefined();
    expect(ps024Marker?.source).toBe('worker');
    expect(ps024Marker?.severity).toBe(MarkerSeverity.Error);
    expect(ps024Marker?.startLineNumber).toBe(3);
  });

  it('returns syntax markers when the parser reports errors', async () => {
    const syntaxError = new SyntaxError('Unexpected token', {
      filename: 'script.pine',
      lineno: 2,
      offset: 5,
      end_lineno: 2,
      end_offset: 6,
    });

    const astService = new FunctionAstService(() => ({
      ast: null,
      diagnostics: createAstDiagnostics([syntaxError]),
    }));

    const harness = createMonacoWorkerHarness({
      markerSource: 'worker',
      astService,
      createValidator: (config) => new CoreWorkerValidator(config),
    });

    const response = await harness.validate({
      code: '//@version=6\nindicator("Example")',
      version: 7,
    });

    expect(response.syntaxMarkers).toHaveLength(1);
    expect(response.syntaxMarkers[0]).toMatchObject({
      message: 'Unexpected token',
      startLineNumber: 2,
      startColumn: 5,
      severity: MarkerSeverity.Error,
    });
    expect(response.markers.some((marker) => marker.message === 'Unexpected token')).toBe(true);
  });

  it('caches validation results when the document version is unchanged', async () => {
    const source = [
      '//@version=6',
      'indicator("Example")',
      'plot(close)',
      '',
    ].join('\n');

    const directive = createVersionDirective(6, 0, 12, 1);
    const titleArgument = createArgument(createStringLiteral('Example', '"Example"', 15, 2), 10, 23, 2, 'title');
    const scriptDeclaration = createScriptDeclaration('indicator', null, [titleArgument], 0, 24, 2);
    const plotCallee = createIdentifier('plot', 0, 3);
    const plotArg = createArgument(createIdentifier('close', 5, 3), 5, 10, 3);
    const plotCall = createCallExpression(plotCallee, [plotArg], 0, 10, 3);
    const plotStatement = createExpressionStatement(plotCall, 0, 10, 3);

    const program = createProgramFromSource(source, [directive], [scriptDeclaration, plotStatement]);
    const parse = vi.fn(() => ({
      ast: program,
      diagnostics: createAstDiagnostics(),
    }));
    const service: AstService = { parse };

    const harness = createMonacoWorkerHarness({
      astService: service,
      createValidator: (config) => new CoreWorkerValidator(config),
    });

    const first = await harness.validate({ code: source, version: 1 });
    const second = await harness.validate({ code: source, version: 1 });

    expect(parse).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);

    const context = harness.getLastContext();
    expect(context?.ast).toBe(program);
  });
});
