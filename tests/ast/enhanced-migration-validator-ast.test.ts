import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { EnhancedMigrationValidator } from '../../modules/enhanced-migration-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createAssignmentStatement,
  createCallExpression,
  createExpressionStatement,
  createIdentifier,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
} from './fixtures';

class EnhancedMigrationHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new EnhancedMigrationValidator());
  }

  protected runCoreValidation(): void {}
}

describe('EnhancedMigrationValidator (AST)', () => {
  it('warns when study() is used instead of indicator()', () => {
    const callee = createIdentifier('study', 0, 1);
    const titleLiteral = createStringLiteral('Title', '"Title"', 6, 1);
    const argument = createArgument(titleLiteral, 6, 13, 1);
    const call = createCallExpression(callee, [argument], 0, 14, 1);
    const statement = createExpressionStatement(call, 0, 14, 1);
    const program = createProgram([statement], 0, 14, 1, 1);

    const source = 'study("Title")';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedMigrationHarness(service);

    const result = harness.validate(source);
    const warningMessages = result.warnings.map((warning) => warning.message);

    expect(warningMessages).toContain(`'study()' is deprecated in Pine Script v6. Use 'indicator()' instead.`);
  });

  it('warns on security() calls and allows request.security()', () => {
    const securityCallee = createIdentifier('security', 0, 1);
    const symbolLiteral = createStringLiteral('AAPL', '"AAPL"', 9, 1);
    const argument = createArgument(symbolLiteral, 9, 15, 1);
    const securityCall = createCallExpression(securityCallee, [argument], 0, 16, 1);
    const securityStatement = createExpressionStatement(securityCall, 0, 16, 1);

    const requestIdentifier = createIdentifier('request', 0, 2);
    const memberIdentifier = createIdentifier('security', 8, 2);
    const requestMember = createMemberExpression(requestIdentifier, memberIdentifier, 0, 16, 2);
    const symbolLiteralLine2 = createStringLiteral('AAPL', '"AAPL"', 17, 2);
    const requestArgument = createArgument(symbolLiteralLine2, 17, 23, 2);
    const requestCall = createCallExpression(requestMember, [requestArgument], 0, 24, 2);
    const requestStatement = createExpressionStatement(requestCall, 0, 24, 2);

    const program = createProgram([securityStatement, requestStatement], 0, 24, 1, 2);
    const source = 'security("AAPL")\nrequest.security("AAPL")';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedMigrationHarness(service);

    const result = harness.validate(source);
    const warningColumns = result.warnings.map((warning) => warning.column);
    const securityWarnings = result.warnings.filter((warning) => warning.message.includes(`'security()' is deprecated`));

    expect(securityWarnings.length).toBe(1);
    expect(warningColumns).toContain(1);
  });

  it('warns when TA functions are missing the ta. namespace but accepts namespaced calls', () => {
    const smaCallee = createIdentifier('sma', 0, 1);
    const smaArgument = createArgument(createIdentifier('close', 4, 1), 4, 9, 1);
    const smaCall = createCallExpression(smaCallee, [smaArgument], 0, 10, 1);
    const smaStatement = createExpressionStatement(smaCall, 0, 10, 1);

    const taIdentifier = createIdentifier('ta', 0, 2);
    const taMember = createIdentifier('sma', 3, 2);
    const namespacedCallee = createMemberExpression(taIdentifier, taMember, 0, 6, 2);
    const closeArgumentLine2 = createArgument(createIdentifier('close', 7, 2), 7, 12, 2);
    const namespacedCall = createCallExpression(namespacedCallee, [closeArgumentLine2], 0, 12, 2);
    const namespacedStatement = createExpressionStatement(namespacedCall, 0, 12, 2);

    const program = createProgram([smaStatement, namespacedStatement], 0, 12, 1, 2);
    const source = 'sma(close)\nta.sma(close)';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedMigrationHarness(service);

    const result = harness.validate(source);
    const taWarnings = result.warnings.filter((warning) => warning.message.includes(`'sma()' should be namespaced`));

    expect(taWarnings.length).toBe(1);
  });

  it('warns about deprecated transp parameters discovered during AST traversal', () => {
    const plotIdentifier = createIdentifier('plot', 0, 1);
    const closeIdentifier = createIdentifier('close', 5, 1);
    const closeArgument = createArgument(closeIdentifier, 5, 10, 1);
    const transpArgument = createArgument(createNumberLiteral(50, '50', 17, 1), 11, 19, 1, 'transp');
    const plotCall = createCallExpression(plotIdentifier, [closeArgument, transpArgument], 0, 20, 1);
    const plotStatement = createExpressionStatement(plotCall, 0, 20, 1);

    const transpIdentifier = createIdentifier('transp', 0, 2);
    const assignment = createAssignmentStatement(transpIdentifier, createNumberLiteral(10, '10', 9, 2), 0, 11, 2);

    const program = createProgram([plotStatement, assignment], 0, 20, 1, 2);
    const source = 'plot(close, transp=50)\ntransp = 10';
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedMigrationHarness(service);

    const result = harness.validate(source);
    const transpWarnings = result.warnings.filter((warning) => warning.message.includes(`'transp' parameter is deprecated`));

    expect(transpWarnings.length).toBeGreaterThanOrEqual(2);
  });
});
