import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { StyleValidator } from '../../modules/style-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createBlock,
  createCallExpression,
  createExpressionStatement,
  createIdentifier,
  createIfStatement,
  createFunctionDeclaration,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
  createVariableDeclaration,
} from './fixtures';

class StyleValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new StyleValidator());
  }

  protected runCoreValidation(): void {}
}

class DisabledStyleValidatorHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new StyleValidator());
  }

  protected runCoreValidation(): void {}
}

describe('StyleValidator (AST)', () => {
  it('returns no diagnostics when AST mode is disabled', () => {
    const validator = new DisabledStyleValidatorHarness();
    const result = validator.validate(['var tmp = 1', 'plot(tmp)'].join('\n'));

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });

  it('reports poor variable naming from AST variable declarations', () => {
    const identifier = createIdentifier('tmp', 4, 1);
    const value = createNumberLiteral(1, '1', 10, 1);
    const declaration = createVariableDeclaration(identifier, 0, 11, 1, {
      declarationKind: 'var',
      initializer: value,
    });

    const program = createProgram([declaration], 0, 11, 1, 1);
    const source = 'var tmp = 1';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new StyleValidatorHarness(service);

    const result = harness.validate(source);
    const infoCodes = result.info.map((info) => info.code);

    expect(infoCodes).toContain('PSV6-STYLE-NAMING');
  });

  it('reports magic numbers detected via AST literals', () => {
    const identifier = createIdentifier('limit', 4, 1);
    const number = createNumberLiteral(200, '200', 12, 1);
    const declaration = createVariableDeclaration(identifier, 0, 15, 1, {
      declarationKind: 'var',
      initializer: number,
    });

    const program = createProgram([declaration], 0, 15, 1, 1);
    const source = 'var limit = 200';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new StyleValidatorHarness(service);

    const result = harness.validate(source);
    const infoCodes = result.info.map((info) => info.code);

    expect(infoCodes).toContain('PSV6-STYLE-MAGIC');
  });

  it('warns when function complexity exceeds the AST threshold', () => {
    const fnIdentifier = createIdentifier('analyze', 0, 1);

    const consequentBlock = createBlock([], 20, 25, 2, 2);
    const alternateBlock = createBlock([], 26, 30, 3, 3);
    const ifStatementA = createIfStatement(createIdentifier('condA', 8, 2), consequentBlock, alternateBlock, 4, 30, 2);

    const consequentBlockB = createBlock([], 40, 45, 4, 4);
    const alternateBlockB = createBlock([], 46, 50, 5, 5);
    const ifStatementB = createIfStatement(createIdentifier('condB', 8, 4), consequentBlockB, alternateBlockB, 32, 50, 4);

    const consequentBlockC = createBlock([], 60, 65, 6, 6);
    const alternateBlockC = createBlock([], 66, 70, 7, 7);
    const ifStatementC = createIfStatement(createIdentifier('condC', 8, 6), consequentBlockC, alternateBlockC, 52, 70, 6);

    const body = createBlock([ifStatementA, ifStatementB, ifStatementC], 0, 70, 2, 7);
    const fn = createFunctionDeclaration(fnIdentifier, [], body, 0, 70, 1, 7);

    const program = createProgram([fn], 0, 70, 1, 7);
    const source = [
      'analyze() =>',
      '    if condA',
      '        x := 1',
      '    else',
      '        x := 2',
      '    if condB',
      '        x := 3',
      '    else',
      '        x := 4',
      '    if condC',
      '        x := 5',
      '    else',
      '        x := 6',
    ].join('\n');
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new StyleValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-STYLE-COMPLEXITY');
  });

  it('warns when inputs appear after calculations in AST mode', () => {
    const taNamespace = createIdentifier('ta', 4, 1);
    const smaProperty = createIdentifier('sma', 7, 1);
    const smaCallee = createMemberExpression(taNamespace, smaProperty, 4, 12, 1);

    const closeIdentifier = createIdentifier('close', 13, 1);
    const closeArgument = createArgument(closeIdentifier, 13, 18, 1);
    const lengthLiteral = createNumberLiteral(14, '14', 20, 1);
    const lengthArgument = createArgument(lengthLiteral, 20, 22, 1);
    const smaCall = createCallExpression(smaCallee, [closeArgument, lengthArgument], 4, 23, 1);

    const valueIdentifier = createIdentifier('value', 0, 1);
    const calculation = createVariableDeclaration(valueIdentifier, 0, 23, 1, {
      declarationKind: 'var',
      initializer: smaCall,
    });

    const inputNamespace = createIdentifier('input', 0, 2);
    const intProperty = createIdentifier('int', 6, 2);
    const inputCallee = createMemberExpression(inputNamespace, intProperty, 0, 10, 2);
    const prompt = createStringLiteral('Length', '\"Length\"', 11, 2);
    const promptArgument = createArgument(prompt, 11, 20, 2);
    const defaultLength = createNumberLiteral(10, '10', 22, 2);
    const defaultArgument = createArgument(defaultLength, 22, 24, 2);
    const inputCall = createCallExpression(inputCallee, [promptArgument, defaultArgument], 0, 25, 2);
    const inputStatement = createExpressionStatement(inputCall, 0, 25, 2);

    const program = createProgram([calculation, inputStatement], 0, 25, 1, 2);
    const source = 'var value = ta.sma(close, 14)\ninput.int("Length", 10)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new StyleValidatorHarness(service);

    const result = harness.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-STYLE-INPUT-PLACEMENT');
  });
});
