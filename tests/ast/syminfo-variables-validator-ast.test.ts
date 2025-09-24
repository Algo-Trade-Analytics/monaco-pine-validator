import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import { SyminfoVariablesValidator } from '../../modules/syminfo-variables-validator';
import {
  createExpressionStatement,
  createIdentifier,
  createMemberExpression,
  createProgram,
} from './fixtures';

class SyminfoValidatorHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new SyminfoVariablesValidator());
  }

  protected runCoreValidation(): void {}
}

class SyminfoValidatorDisabledHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new SyminfoVariablesValidator());
  }

  protected runCoreValidation(): void {}
}

describe('SyminfoVariablesValidator (AST)', () => {
  it('records company syminfo variables through AST traversal', () => {
    const syminfoNamespace = createIdentifier('syminfo', 0, 1);
    const employeesProperty = createIdentifier('employees', 8, 1);
    const employeesMember = createMemberExpression(syminfoNamespace, employeesProperty, 0, 17, 1);
    const usageStatement = createExpressionStatement(employeesMember, 0, 17, 1);

    const program = createProgram([usageStatement], 0, 17, 1, 1);
    const source = 'syminfo.employees';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new SyminfoValidatorHarness(service);

    const result = harness.validate(source);
    const infoCodes = result.info.map((message) => message.code);

    expect(infoCodes).toContain('PSV6-SYMINFO-COMPANY');
    expect(infoCodes).toContain('PSV6-SYMINFO-USAGE');
  });

  it('captures additional constants via AST member expressions', () => {
    const settlementNamespace = createIdentifier('settlement_as_close', 0, 1);
    const inheritProperty = createIdentifier('inherit', 21, 1);
    const settlementConstant = createMemberExpression(settlementNamespace, inheritProperty, 0, 29, 1);
    const settlementStatement = createExpressionStatement(settlementConstant, 0, 29, 1);

    const textNamespace = createIdentifier('text', 0, 2);
    const wrapAutoProperty = createIdentifier('wrap_auto', 5, 2);
    const textWrapAuto = createMemberExpression(textNamespace, wrapAutoProperty, 0, 14, 2);
    const textStatement = createExpressionStatement(textWrapAuto, 0, 14, 2);

    const program = createProgram([settlementStatement, textStatement], 0, 29, 1, 2);
    const source = 'settlement_as_close.inherit\ntext.wrap_auto';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new SyminfoValidatorHarness(service);

    const result = harness.validate(source);
    const infoCodes = result.info.map((message) => message.code);

    const additionalConstantMessages = result.info.filter((message) => message.code === 'PSV6-ADDITIONAL-CONSTANT');

    expect(additionalConstantMessages.length).toBeGreaterThanOrEqual(2);
    expect(infoCodes).toContain('PSV6-CONSTANTS-USAGE');
  });

  it('summarises financial syminfo usage when recommendations are referenced', () => {
    const syminfoNamespace = createIdentifier('syminfo', 0, 1);
    const recommendations = createIdentifier('recommendations_buy', 8, 1);
    const recommendationMember = createMemberExpression(syminfoNamespace, recommendations, 0, 28, 1);
    const recommendationStatement = createExpressionStatement(recommendationMember, 0, 28, 1);

    const program = createProgram([recommendationStatement], 0, 28, 1, 1);
    const source = 'syminfo.recommendations_buy';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new SyminfoValidatorHarness(service);

    const result = harness.validate(source);
    const infoCodes = result.info.map((message) => message.code);

    expect(infoCodes).toContain('PSV6-SYMINFO-RECOMMENDATIONS');
    expect(infoCodes).toContain('PSV6-FINANCIAL-DATA-USAGE');
  });

  it('returns no diagnostics when AST mode is disabled', () => {
    const harness = new SyminfoValidatorDisabledHarness();

    const result = harness.validate('syminfo.employees');

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });
});

