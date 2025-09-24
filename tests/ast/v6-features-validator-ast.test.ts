import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { V6FeaturesValidator } from '../../modules/v6-features-validator';
import { FunctionAstService } from '../../core/ast/service';
import {
  createAstDiagnostics,
  createEmptyControlFlowGraph,
  createEmptyScopeGraph,
  createEmptySymbolTable,
  createEmptyTypeEnvironment,
} from '../../core/ast/types';
import {
  createArgument,
  createCallExpression,
  createEnumDeclaration,
  createEnumMember,
  createExpressionStatement,
  createIdentifier,
  createIndexExpression,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createScriptDeclaration,
  createStringLiteral,
  createSwitchCase,
  createSwitchStatement,
  createTypeDeclaration,
  createTypeField,
  createVariableDeclaration,
} from './fixtures';
import type { AstValidationContext, TypeInfo, ValidatorConfig } from '../../core/types';

class V6FeaturesHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new V6FeaturesValidator());
  }

  protected runCoreValidation(): void {}
}

describe('V6FeaturesValidator (AST)', () => {
  it('warns about missing switch defaults and empty cases', () => {
    const discriminant = createNumberLiteral(1, '1', 7, 1);
    const emptyCase = createSwitchCase(
      createStringLiteral('long', '"long"', 4, 2),
      [],
      4,
      20,
      2,
    );
    const populatedCase = createSwitchCase(
      createStringLiteral('short', '"short"', 4, 3),
      [createExpressionStatement(createStringLiteral('sell', '"sell"', 20, 3), 20, 30, 3)],
      4,
      30,
      3,
    );
    const switchStatement = createSwitchStatement(discriminant, [emptyCase, populatedCase], 0, 64, 1, 3);
    const program = createProgram([switchStatement], 0, 64, 1, 3);
    const source = ['switch 1', '    "long" =>', '    "short" => "sell"'].join('\n');

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new V6FeaturesHarness(service);
    const result = harness.validate(source);

    const errorCodes = result.errors.map((error) => error.code);
    const warningCodes = result.warnings.map((warning) => warning.code);
    const infoCodes = result.info.map((item) => item.code);

    expect(errorCodes).toContain('PSV6-SWITCH-CASE-RESULT');
    expect(warningCodes).toContain('PSV6-SWITCH-TYPE-MISMATCH');
    expect(infoCodes).toContain('PSV6-SWITCH-NO-DEFAULT');
  });

  it('flags duplicate default clauses when traversing the AST', () => {
    const discriminant = createIdentifier('mode', 7, 1);
    const caseNode = createSwitchCase(
      createStringLiteral('buy', '"buy"', 4, 2),
      [createExpressionStatement(createNumberLiteral(1, '1', 20, 2), 20, 22, 2)],
      4,
      22,
      2,
    );
    const firstDefault = createSwitchCase(
      null,
      [createExpressionStatement(createStringLiteral('flat', '"flat"', 20, 3), 20, 28, 3)],
      4,
      28,
      3,
    );
    const secondDefault = createSwitchCase(null, [], 4, 34, 4);
    const switchStatement = createSwitchStatement(discriminant, [caseNode, firstDefault, secondDefault], 0, 80, 1, 4);
    const program = createProgram([switchStatement], 0, 80, 1, 4);
    const source = ['switch mode', '    "buy" => 1', '    => "flat"', '    =>'].join('\n');

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new V6FeaturesHarness(service);
    const result = harness.validate(source);

    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toEqual(
      expect.arrayContaining(['PSV6-SWITCH-MULTIPLE-DEFAULT', 'PSV6-SWITCH-DEFAULT-RESULT']),
    );
  });

  it('reports varip usage inside libraries', () => {
    const scriptIdentifier = createIdentifier('myLib', 10, 1);
    const scriptTitle = createArgument(createStringLiteral('My Lib', '"My Lib"', 20, 1), 14, 30, 1, 'title');
    const scriptDeclaration = createScriptDeclaration('library', scriptIdentifier, [scriptTitle], 0, 32, 1);

    const varIdentifier = createIdentifier('state', 6, 2);
    const initializer = createNumberLiteral(0, '0', 18, 2);
    const varipDeclaration = createVariableDeclaration(varIdentifier, 0, 20, 2, {
      declarationKind: 'varip',
      initializer,
    });

    const program = createProgram([scriptDeclaration, varipDeclaration], 0, 40, 1, 2);
    const source = ['library("My Lib")', 'varip state = 0'].join('\n');
    const lines = source.split('\n');

    const context: AstValidationContext = {
      lines,
      cleanLines: lines,
      rawLines: lines,
      typeMap: new Map<string, TypeInfo>(),
      usedVars: new Set<string>(),
      declaredVars: new Map<string, number>(),
      functionNames: new Set<string>(),
      methodNames: new Set<string>(),
      functionParams: new Map<string, string[]>(),
      scriptType: 'library',
      version: 6,
      hasVersion: false,
      firstVersionLine: null,
      ast: program,
      astDiagnostics: createAstDiagnostics(),
      scopeGraph: createEmptyScopeGraph(),
      symbolTable: createEmptySymbolTable(),
      typeEnvironment: createEmptyTypeEnvironment(),
      controlFlowGraph: createEmptyControlFlowGraph(),
    };

    const config: ValidatorConfig = {
      targetVersion: 6,
      strictMode: false,
      allowDeprecated: false,
      enableTypeChecking: true,
      enableControlFlowAnalysis: true,
      enablePerformanceAnalysis: true,
      enablePerformanceChecks: true,
      enableStyleChecks: true,
      enableWarnings: true,
      enableInfo: true,
      customRules: [],
      ignoredCodes: [],
    };

    const validator = new V6FeaturesValidator();
    const result = validator.validate(context, config);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-VARIP-LIBRARY');
  });

  it('surfaces dynamic request guidance for series arguments', () => {
    const requestNamespace = createIdentifier('request', 0, 1);
    const securityProperty = createIdentifier('security', 8, 1);
    const callee = createMemberExpression(requestNamespace, securityProperty, 0, 17, 1);

    const syminfoNamespace = createIdentifier('syminfo', 18, 1);
    const tickerProperty = createIdentifier('tickerid', 26, 1);
    const symbolArg = createArgument(
      createMemberExpression(syminfoNamespace, tickerProperty, 18, 36, 1),
      18,
      36,
      1,
    );

    const timeframeNamespace = createIdentifier('timeframe', 38, 1);
    const periodProperty = createIdentifier('period', 48, 1);
    const timeframeArg = createArgument(
      createMemberExpression(timeframeNamespace, periodProperty, 38, 52, 1),
      38,
      52,
      1,
    );

    const expressionArg = createArgument(createIdentifier('close', 54, 1), 54, 59, 1);
    const callExpression = createCallExpression(callee, [symbolArg, timeframeArg, expressionArg], 0, 59, 1);
    const statement = createExpressionStatement(callExpression, 0, 59, 1);

    const program = createProgram([statement], 0, 59, 1, 1);
    const source = 'request.security(syminfo.tickerid, timeframe.period, close)';

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new V6FeaturesHarness(service);
    const result = harness.validate(source);

    const infoCodes = result.info.map((item) => item.code);

    expect(infoCodes).toContain('PSV6-DYNAMIC-REQUEST');
  });

  it('validates text formatting helpers for color parameters', () => {
    const textNamespace = createIdentifier('text', 0, 1);
    const formatProperty = createIdentifier('format_color', 5, 1);
    const callee = createMemberExpression(textNamespace, formatProperty, 0, 18, 1);

    const stringArg = createArgument(createStringLiteral('Value', '"Value"', 19, 1), 19, 27, 1);
    const numericArg = createArgument(createNumberLiteral(5, '5', 29, 1), 29, 30, 1);
    const callExpression = createCallExpression(callee, [stringArg, numericArg], 0, 30, 1);
    const statement = createExpressionStatement(callExpression, 0, 30, 1);

    const program = createProgram([statement], 0, 30, 1, 1);
    const source = 'text.format_color("Value", 5)';

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new V6FeaturesHarness(service);
    const result = harness.validate(source);

    const infoCodes = result.info.map((item) => item.code);
    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(infoCodes).toContain('PSV6-TEXT-FORMAT');
    expect(warningCodes).toContain('PSV6-TEXT-FORMAT-COLOR');
  });

  it('flags enum declarations that reuse keyword names', () => {
    const enumIdentifier = createIdentifier('int', 5, 1);
    const memberIdentifier = createIdentifier('VALUE', 4, 2);
    const enumMember = createEnumMember(memberIdentifier, null, 4, 9, 2);
    const enumDeclaration = createEnumDeclaration(enumIdentifier, [enumMember], 0, 10, 1, 2);
    const program = createProgram([enumDeclaration], 0, 10, 1, 2);
    const source = ['enum int', '    VALUE'].join('\n');

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new V6FeaturesHarness(service);
    const result = harness.validate(source);

    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-ENUM-CONFLICT');
  });

  it('reminds that [0] history references are the current value', () => {
    const seriesIdentifier = createIdentifier('close', 0, 1);
    const zeroLiteral = createNumberLiteral(0, '0', 6, 1);
    const indexExpression = createIndexExpression(seriesIdentifier, zeroLiteral, 0, 7, 1);
    const statement = createExpressionStatement(indexExpression, 0, 7, 1);

    const program = createProgram([statement], 0, 7, 1, 1);
    const source = 'close[0]';

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new V6FeaturesHarness(service);
    const result = harness.validate(source);

    const infoCodes = result.info.map((item) => item.code);

    expect(infoCodes).toContain('PSV6-HISTORY-ZERO');
  });
});
