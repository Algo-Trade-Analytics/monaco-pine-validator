import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { DrawingFunctionsValidator } from '../../modules/drawing-functions-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createBlock,
  createCallExpression,
  createExpressionStatement,
  createIdentifier,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
  createWhileStatement,
} from './fixtures';

class DrawingFunctionsHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new DrawingFunctionsValidator());
  }

  protected runCoreValidation(): void {}
}

class DrawingFunctionsDisabledHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new DrawingFunctionsValidator());
  }

  protected runCoreValidation(): void {}
}

describe('DrawingFunctionsValidator (AST)', () => {
  it('enforces required parameter counts for drawing constructors', () => {
    const namespace = createIdentifier('line', 0, 1);
    const fn = createIdentifier('new', 5, 1);
    const callee = createMemberExpression(namespace, fn, 0, 8, 1);

    const first = createArgument(createNumberLiteral(1, '1', 9, 1), 9, 10, 1);
    const second = createArgument(createNumberLiteral(2, '2', 11, 1), 11, 12, 1);
    const third = createArgument(createNumberLiteral(3, '3', 13, 1), 13, 14, 1);

    const call = createCallExpression(callee, [first, second, third], 0, 15, 1);
    const statement = createExpressionStatement(call, 0, 15, 1);
    const program = createProgram([statement], 0, 15, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new DrawingFunctionsHarness(service);

    const result = harness.validate('line.new(1,2,3)');
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-FUNCTION-PARAM-COUNT');
  });

  it('flags unknown drawing helpers discovered during AST traversal', () => {
    const namespace = createIdentifier('line', 0, 1);
    const fn = createIdentifier('missing', 5, 1);
    const callee = createMemberExpression(namespace, fn, 0, 12, 1);

    const first = createArgument(createNumberLiteral(1, '1', 13, 1), 13, 14, 1);
    const second = createArgument(createNumberLiteral(2, '2', 15, 1), 15, 16, 1);
    const third = createArgument(createNumberLiteral(3, '3', 17, 1), 17, 18, 1);
    const fourth = createArgument(createNumberLiteral(4, '4', 19, 1), 19, 20, 1);

    const call = createCallExpression(callee, [first, second, third, fourth], 0, 21, 1);
    const statement = createExpressionStatement(call, 0, 21, 1);
    const program = createProgram([statement], 0, 21, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new DrawingFunctionsHarness(service);

    const result = harness.validate('line.missing(1,2,3,4)');
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-LINE-UNKNOWN-FUNCTION');
  });

  it('warns when drawing constructors execute inside loops', () => {
    const condition = createIdentifier('condition', 6, 1);

    const namespace = createIdentifier('label', 4, 2);
    const fn = createIdentifier('new', 10, 2);
    const callee = createMemberExpression(namespace, fn, 4, 13, 2);

    const first = createArgument(createNumberLiteral(1, '1', 14, 2), 14, 15, 2);
    const second = createArgument(createNumberLiteral(2, '2', 16, 2), 16, 17, 2);
    const text = createArgument(createStringLiteral('text', '"text"', 18, 2), 18, 24, 2);

    const call = createCallExpression(callee, [first, second, text], 4, 25, 2);
    const statement = createExpressionStatement(call, 4, 25, 2);
    const block = createBlock([statement], 4, 25, 2, 2);
    const loop = createWhileStatement(condition, block, 0, 25, 1);
    const program = createProgram([loop], 0, 25, 1, 2);

    const source = 'while condition\n    label.new(1,2,"text")';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new DrawingFunctionsHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-DRAWING-IN-LOOP');
  });

  it('surfaces complex expression and style guidance from AST argument text', () => {
    const namespace = createIdentifier('line', 0, 1);
    const fn = createIdentifier('new', 5, 1);
    const callee = createMemberExpression(namespace, fn, 0, 8, 1);

    const taNamespace = createIdentifier('ta', 9, 1);
    const smaIdentifier = createIdentifier('sma', 12, 1);
    const taCallee = createMemberExpression(taNamespace, smaIdentifier, 9, 15, 1);

    const closeIdentifier = createIdentifier('close', 16, 1);
    const closeArgument = createArgument(closeIdentifier, 16, 21, 1);
    const lengthLiteral = createNumberLiteral(14, '14', 22, 1);
    const lengthArgument = createArgument(lengthLiteral, 22, 24, 1);

    const taCall = createCallExpression(taCallee, [closeArgument, lengthArgument], 9, 25, 1);
    const taArgument = createArgument(taCall, 9, 26, 1);

    const second = createArgument(createIdentifier('close', 27, 1), 27, 32, 1);
    const third = createArgument(createIdentifier('close', 33, 1), 33, 38, 1);
    const fourth = createArgument(createIdentifier('close', 39, 1), 39, 44, 1);
    const widthValue = createNumberLiteral(6, '6', 51, 1);
    const widthArgument = createArgument(widthValue, 45, 52, 1, 'width');

    const call = createCallExpression(callee, [taArgument, second, third, fourth, widthArgument], 0, 53, 1);
    const statement = createExpressionStatement(call, 0, 53, 1);
    const program = createProgram([statement], 0, 53, 1, 1);

    const source = 'line.new(ta.sma(close,14),close,close,close,width=6)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new DrawingFunctionsHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);
    const infoCodes = result.info.map((info) => info.code);

    expect(warningCodes).toContain('PSV6-DRAWING-COMPLEX-EXPRESSION');
    expect(infoCodes).toContain('PSV6-DRAWING-STYLE-SUGGESTION');
  });

  it('returns no diagnostics when AST mode is disabled', () => {
    const harness = new DrawingFunctionsDisabledHarness();

    const result = harness.validate('line.new(1, 2, 3, 4)');

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });
});
