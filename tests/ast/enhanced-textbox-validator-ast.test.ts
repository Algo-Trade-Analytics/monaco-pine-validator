import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { EnhancedTextboxValidator } from '../../modules/enhanced-textbox-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createBlock,
  createCallExpression,
  createExpressionStatement,
  createForStatement,
  createIdentifier,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
} from './fixtures';

class EnhancedTextboxHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new EnhancedTextboxValidator());
  }

  protected runCoreValidation(): void {}
}

describe('EnhancedTextboxValidator (AST)', () => {
  it('flags non-string text parameters passed to box.new', () => {
    const boxIdentifier = createIdentifier('box', 0, 1);
    const newIdentifier = createIdentifier('new', 4, 1);
    const callee = createMemberExpression(boxIdentifier, newIdentifier, 0, 7, 1);

    const numberLiteral = createNumberLiteral(123, '123', 12, 1);
    const textArgument = createArgument(numberLiteral, 8, 15, 1, 'text');

    const call = createCallExpression(callee, [textArgument], 0, 16, 1);
    const statement = createExpressionStatement(call, 0, 16, 1);
    const program = createProgram([statement], 0, 16, 1, 1);

    const source = 'box.new(text=123)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedTextboxHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-TEXTBOX-TEXT-TYPE');
  });

  it('validates box.set_text parameter counts through AST traversal', () => {
    const boxIdentifier = createIdentifier('box', 0, 1);
    const setTextIdentifier = createIdentifier('set_text', 4, 1);
    const callee = createMemberExpression(boxIdentifier, setTextIdentifier, 0, 12, 1);

    const idIdentifier = createIdentifier('myBox', 13, 1);
    const idArgument = createArgument(idIdentifier, 13, 18, 1);

    const call = createCallExpression(callee, [idArgument], 0, 19, 1);
    const statement = createExpressionStatement(call, 0, 19, 1);
    const program = createProgram([statement], 0, 19, 1, 1);

    const source = 'box.set_text(myBox)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedTextboxHarness(service);

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-FUNCTION-PARAM-COUNT');
  });

  it('warns when textbox helpers execute inside loops', () => {
    const boxIdentifier = createIdentifier('box', 4, 2);
    const newIdentifier = createIdentifier('new', 8, 2);
    const callee = createMemberExpression(boxIdentifier, newIdentifier, 4, 11, 2);

    const textLiteral = createStringLiteral('Hi', '"Hi"', 15, 2);
    const textArgument = createArgument(textLiteral, 12, 19, 2, 'text');

    const call = createCallExpression(callee, [textArgument], 4, 20, 2);
    const statement = createExpressionStatement(call, 4, 20, 2);
    const block = createBlock([statement], 4, 20, 2, 2);
    const loop = createForStatement(null, null, null, block, 0, 20, 1);
    const program = createProgram([loop], 0, 20, 1, 2);

    const source = 'for i = 0 to 1\n    box.new(text="Hi")';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedTextboxHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-TEXTBOX-LOOP-WARNING');
  });

  it('reports dynamic text usage from AST-collected arguments', () => {
    const boxIdentifier = createIdentifier('box', 0, 1);
    const setTextIdentifier = createIdentifier('set_text', 4, 1);
    const callee = createMemberExpression(boxIdentifier, setTextIdentifier, 0, 12, 1);

    const idIdentifier = createIdentifier('myBox', 13, 1);
    const idArgument = createArgument(idIdentifier, 13, 18, 1);
    const dynamicIdentifier = createIdentifier('dynamicText', 20, 1);
    const textArgument = createArgument(dynamicIdentifier, 20, 31, 1);

    const call = createCallExpression(callee, [idArgument, textArgument], 0, 32, 1);
    const statement = createExpressionStatement(call, 0, 32, 1);
    const program = createProgram([statement], 0, 32, 1, 1);

    const source = 'box.set_text(myBox, dynamicText)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedTextboxHarness(service);

    const result = harness.validate(source);
    const infoCodes = result.info.map((info) => info.code);

    expect(infoCodes).toContain('PSV6-TEXTBOX-DYNAMIC-TEXT');
  });
});
