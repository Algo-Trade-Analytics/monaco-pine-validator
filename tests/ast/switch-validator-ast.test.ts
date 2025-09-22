import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { SwitchValidator } from '../../modules/switch-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createBooleanLiteral,
  createExpressionStatement,
  createIdentifier,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
  createSwitchCase,
  createSwitchStatement,
} from './fixtures';

class SwitchValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new SwitchValidator());
  }

  protected runCoreValidation(): void {}
}

describe('SwitchValidator (AST)', () => {
  it('warns about missing default clauses and duplicate case values', () => {
    const discriminant = createIdentifier('mode', 7, 1);
    const firstCase = createSwitchCase(
      createStringLiteral('long', '"long"', 4, 2),
      [createExpressionStatement(createStringLiteral('buy', '"buy"', 20, 2), 20, 26, 2)],
      4,
      26,
      2,
    );
    const duplicateCase = createSwitchCase(
      createStringLiteral('long', '"long"', 4, 3),
      [createExpressionStatement(createStringLiteral('sell', '"sell"', 20, 3), 20, 27, 3)],
      4,
      27,
      3,
    );
    const switchStatement = createSwitchStatement(discriminant, [firstCase, duplicateCase], 0, 64, 1, 3);
    const program = createProgram([switchStatement], 0, 64, 1, 3);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const validator = new SwitchValidatorHarness(service);

    const source = ['switch mode', '    "long" => "buy"', '    "long" => "sell"'].join('\n');

    const result = validator.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);
    const errorCodes = result.errors.map((error) => error.code);

    expect(warningCodes).toContain('PSV6-SWITCH-NO-DEFAULT');
    expect(errorCodes).toContain('PSV6-SWITCH-DUPLICATE-CASE');
  });

  it('flags invalid discriminant and case value types', () => {
    const discriminant = createNumberLiteral(1, '1', 7, 1);
    const booleanCase = createSwitchCase(
      createBooleanLiteral(true, 4, 2),
      [createExpressionStatement(createStringLiteral('one', '"one"', 20, 2), 20, 26, 2)],
      4,
      26,
      2,
    );
    const defaultCase = createSwitchCase(
      null,
      [createExpressionStatement(createStringLiteral('zero', '"zero"', 20, 3), 20, 27, 3)],
      4,
      27,
      3,
    );
    const switchStatement = createSwitchStatement(discriminant, [booleanCase, defaultCase], 0, 70, 1, 3);
    const program = createProgram([switchStatement], 0, 70, 1, 3);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const validator = new SwitchValidatorHarness(service);

    const source = ['switch 1', '    true => "one"', '    => "zero"'].join('\n');

    const result = validator.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toEqual(expect.arrayContaining(['PSV6-SWITCH-TYPE', 'PSV6-SWITCH-CASE-TYPE']));
  });

  it('reports inconsistent return types using AST metadata', () => {
    const discriminant = createIdentifier('mode', 7, 1);
    const stringCase = createSwitchCase(
      createStringLiteral('long', '"long"', 4, 2),
      [createExpressionStatement(createStringLiteral('buy', '"buy"', 20, 2), 20, 26, 2)],
      4,
      26,
      2,
    );
    const numericCase = createSwitchCase(
      createStringLiteral('short', '"short"', 4, 3),
      [createExpressionStatement(createNumberLiteral(1, '1', 20, 3), 20, 25, 3)],
      4,
      25,
      3,
    );
    const defaultCase = createSwitchCase(
      null,
      [createExpressionStatement(createStringLiteral('flat', '"flat"', 20, 4), 20, 26, 4)],
      4,
      26,
      4,
    );
    const switchStatement = createSwitchStatement(discriminant, [stringCase, numericCase, defaultCase], 0, 80, 1, 4);
    const program = createProgram([switchStatement], 0, 80, 1, 4);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const validator = new SwitchValidatorHarness(service);

    const source = ['switch mode', '    "long" => "buy"', '    "short" => 1', '    => "flat"'].join('\n');

    const result = validator.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-SWITCH-RETURN-TYPE');
  });

  it('warns when switches have deep nesting and too many cases', () => {
    const discriminant = createIdentifier('mode', 7, 1);

    const deepestSwitch = createSwitchStatement(
      createIdentifier('level3', 16, 5),
      [
        createSwitchCase(
          createStringLiteral('leaf', '"leaf"', 20, 6),
          [createExpressionStatement(createStringLiteral('z', '"z"', 30, 6), 30, 33, 6)],
          18,
          33,
          6,
        ),
      ],
      16,
      40,
      4,
      6,
    );

    const middleSwitch = createSwitchStatement(
      createIdentifier('level2', 12, 4),
      [
        createSwitchCase(
          createStringLiteral('mid', '"mid"', 16, 5),
          [deepestSwitch],
          14,
          40,
          5,
          6,
        ),
      ],
      12,
      40,
      3,
      6,
    );

    const nestedCase = createSwitchCase(
      createStringLiteral('outer', '"outer"', 8, 2),
      [middleSwitch],
      8,
      40,
      2,
      6,
    );

    const simpleCases = Array.from({ length: 20 }, (_, index) => {
      const line = 7 + index;
      return createSwitchCase(
        createStringLiteral(`case${index}`, `"case${index}"`, 8, line),
        [createExpressionStatement(createStringLiteral('value', '"value"', 20, line), 20, 27, line)],
        8,
        27,
        line,
      );
    });

    const defaultCase = createSwitchCase(
      null,
      [createExpressionStatement(createStringLiteral('default', '"default"', 20, 27), 20, 30, 27)],
      8,
      30,
      27,
    );

    const switchStatement = createSwitchStatement(
      discriminant,
      [nestedCase, ...simpleCases, defaultCase],
      0,
      220,
      1,
      27,
    );
    const program = createProgram([switchStatement], 0, 220, 1, 27);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const validator = new SwitchValidatorHarness(service);

    const nestedLines = [
      'switch mode',
      '    "outer" =>',
      '        switch level2',
      '            "mid" =>',
      '                switch level3',
      '                    "leaf" => "z"',
    ];
    const caseLines = simpleCases.map((_, index) => `    "case${index}" => "value"`);
    const source = [...nestedLines, ...caseLines, '    => "default"'].join('\n');

    const result = validator.validate(source);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toEqual(
      expect.arrayContaining(['PSV6-SWITCH-TOO-MANY-CASES', 'PSV6-SWITCH-DEEP-NESTING']),
    );
  });

  it('reports indentation and default placement style issues', () => {
    const discriminant = createIdentifier('mode', 7, 1);
    const firstCase = createSwitchCase(
      createStringLiteral('one', '"one"', 4, 2),
      [createExpressionStatement(createStringLiteral('a', '"a"', 16, 2), 16, 19, 2)],
      4,
      19,
      2,
    );
    const defaultCase = createSwitchCase(
      null,
      [createExpressionStatement(createStringLiteral('fallback', '"fallback"', 14, 3), 14, 25, 3)],
      2,
      25,
      3,
    );
    const secondCase = createSwitchCase(
      createStringLiteral('two', '"two"', 4, 4),
      [createExpressionStatement(createStringLiteral('b', '"b"', 16, 4), 16, 19, 4)],
      4,
      19,
      4,
    );

    const switchStatement = createSwitchStatement(discriminant, [firstCase, defaultCase, secondCase], 0, 80, 1, 4);
    const program = createProgram([switchStatement], 0, 80, 1, 4);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const validator = new SwitchValidatorHarness(service);

    const source = ['switch mode', '    "one" => "a"', '  => "fallback"', '    "two" => "b"'].join('\n');

    const result = validator.validate(source);
    const infoCodes = result.info.map((info) => info.code);

    expect(infoCodes).toEqual(
      expect.arrayContaining(['PSV6-SWITCH-STYLE-INDENTATION', 'PSV6-SWITCH-STYLE-DEFAULT-PLACEMENT']),
    );
  });
});
