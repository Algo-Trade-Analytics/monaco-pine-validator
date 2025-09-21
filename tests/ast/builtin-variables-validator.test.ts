import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { BuiltinVariablesValidator } from '../../modules/builtin-variables-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createIdentifier,
  createMemberExpression,
  createVariableDeclaration,
} from './fixtures';
import { createLocation, createPosition, createRange, type ProgramNode } from '../../core/ast/nodes';
import { Codes } from '../../core/codes';

class BuiltinValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new BuiltinVariablesValidator());
  }

  protected runCoreValidation(): void {}
}

function createBuiltinConstantsProgram(): ProgramNode {
  const timeframeDecl = createVariableDeclaration(
    createIdentifier('tfDaily', 0, 3),
    0,
    28,
    3,
    {
      declarationKind: 'var',
      initializer: createMemberExpression(
        createIdentifier('timeframe', 11, 3),
        createIdentifier('isdaily', 21, 3),
        11,
        29,
        3,
      ),
    },
  );

  const displayDecl = createVariableDeclaration(
    createIdentifier('displaySetting', 0, 4),
    0,
    36,
    4,
    {
      declarationKind: 'var',
      initializer: createMemberExpression(
        createIdentifier('display', 20, 4),
        createIdentifier('all', 28, 4),
        20,
        31,
        4,
      ),
    },
  );

  const extendDecl = createVariableDeclaration(
    createIdentifier('extendSetting', 0, 5),
    0,
    34,
    5,
    {
      declarationKind: 'var',
      initializer: createMemberExpression(
        createIdentifier('extend', 20, 5),
        createIdentifier('right', 27, 5),
        20,
        32,
        5,
      ),
    },
  );

  const formatDecl = createVariableDeclaration(
    createIdentifier('formatSetting', 0, 6),
    0,
    36,
    6,
    {
      declarationKind: 'var',
      initializer: createMemberExpression(
        createIdentifier('format', 20, 6),
        createIdentifier('price', 27, 6),
        20,
        32,
        6,
      ),
    },
  );

  const currencyDecl = createVariableDeclaration(
    createIdentifier('currencySetting', 0, 7),
    0,
    38,
    7,
    {
      declarationKind: 'var',
      initializer: createMemberExpression(
        createIdentifier('currency', 22, 7),
        createIdentifier('USD', 31, 7),
        22,
        34,
        7,
      ),
    },
  );

  const scaleDecl = createVariableDeclaration(
    createIdentifier('scaleSetting', 0, 8),
    0,
    34,
    8,
    {
      declarationKind: 'var',
      initializer: createMemberExpression(
        createIdentifier('scale', 20, 8),
        createIdentifier('left', 26, 8),
        20,
        30,
        8,
      ),
    },
  );

  const adjustmentDecl = createVariableDeclaration(
    createIdentifier('adjustmentSetting', 0, 9),
    0,
    42,
    9,
    {
      declarationKind: 'var',
      initializer: createMemberExpression(
        createIdentifier('adjustment', 24, 9),
        createIdentifier('none', 35, 9),
        24,
        39,
        9,
      ),
    },
  );

  const backadjustmentDecl = createVariableDeclaration(
    createIdentifier('backadjustmentSetting', 0, 10),
    0,
    48,
    10,
    {
      declarationKind: 'var',
      initializer: createMemberExpression(
        createIdentifier('backadjustment', 28, 10),
        createIdentifier('off', 43, 10),
        28,
        46,
        10,
      ),
    },
  );

  return {
    kind: 'Program',
    directives: [],
    body: [
      timeframeDecl,
      displayDecl,
      extendDecl,
      formatDecl,
      currencyDecl,
      scaleDecl,
      adjustmentDecl,
      backadjustmentDecl,
    ],
    loc: createLocation(createPosition(1, 1, 0), createPosition(10, 50, 0)),
    range: createRange(0, 50),
  };
}

describe('BuiltinVariablesValidator (AST)', () => {
  it('records built-in constant usage from AST member expressions', () => {
    const astProgram = createBuiltinConstantsProgram();
    const service = new FunctionAstService(() => ({
      ast: astProgram,
      diagnostics: createAstDiagnostics(),
    }));
    const validator = new BuiltinValidatorHarness(service);
    const source = `//@version=6\nindicator("Builtin AST")\n` +
      `var tfDaily = timeframe.isdaily\n` +
      `var displaySetting = display.all\n` +
      `var extendSetting = extend.right\n` +
      `var formatSetting = format.price\n` +
      `var currencySetting = currency.USD\n` +
      `var scaleSetting = scale.left\n` +
      `var adjustmentSetting = adjustment.none\n` +
      `var backadjustmentSetting = backadjustment.off\n`;

    const result = validator.validate(source);

    expect(result.isValid).toBe(true);

    const occurrencesByCode = new Map<string, number>();
    for (const info of result.info) {
      occurrencesByCode.set(info.code ?? '', (occurrencesByCode.get(info.code ?? '') ?? 0) + 1);
    }

    expect(occurrencesByCode.get(Codes.TIMEFRAME_CONSTANT)).toBe(1);
    expect(occurrencesByCode.get(Codes.DISPLAY_CONSTANT)).toBe(1);
    expect(occurrencesByCode.get(Codes.EXTEND_CONSTANT)).toBe(1);
    expect(occurrencesByCode.get(Codes.FORMAT_CONSTANT)).toBe(1);
    expect(occurrencesByCode.get(Codes.CURRENCY_CONSTANT)).toBe(1);
    expect(occurrencesByCode.get(Codes.SCALE_CONSTANT)).toBe(1);
    expect(occurrencesByCode.get(Codes.ADJUSTMENT_CONSTANT)).toBe(1);
    expect(occurrencesByCode.get(Codes.BACKADJUSTMENT_CONSTANT)).toBe(1);

    expect(result.info.some((info) => info.code === Codes.BUILTIN_VARS_INFO)).toBe(true);
    expect(result.info.some((info) => info.code === Codes.CURRENCY_USAGE)).toBe(true);
    expect(result.info.some((info) => info.code === Codes.DISPLAY_USAGE)).toBe(true);
    expect(result.info.some((info) => info.code === Codes.SCALE_USAGE)).toBe(true);
    expect(result.info.some((info) => info.code === Codes.ADJUSTMENT_USAGE)).toBe(true);
  });
});

