import { describe, expect, it } from 'vitest';
import { parseWithChevrotain } from '../../core/ast/parser';
import type {
  ProgramNode,
  VariableDeclarationNode,
  CallExpressionNode,
  ExpressionStatementNode,
  ConditionalExpressionNode,
  AssignmentStatementNode,
} from '../../core/ast/nodes';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

function getVariableDeclarations(program: ProgramNode): VariableDeclarationNode[] {
  return program.body.filter(
    (statement): statement is VariableDeclarationNode => statement.kind === 'VariableDeclaration',
  );
}

describe('Parser Error Recovery - Missing "=" operator', () => {
  it('recovers a missing "=" and marks the variable declaration metadata', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'slowEMA ta.ema(close, 35)',
      'plot(slowEMA)',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });
    expect(result.ast).not.toBeNull();

    const program = result.ast as ProgramNode;
    expect(program.body).toHaveLength(3);

    const declarations = getVariableDeclarations(program);
    expect(declarations).toHaveLength(1);

    const declaration = declarations[0];
    expect(declaration.identifier.name).toBe('slowEMA');
    expect(declaration.initializer).not.toBeNull();
    expect(declaration.initializerOperator).toBe('=');
    expect(declaration.missingInitializerOperator).toBe(true);
    expect(declaration.virtualInitializerOperator?.isVirtual).toBe(true);
    expect(declaration.recoveryErrors?.[0]?.code).toBe('MISSING_EQUALS');

    const lastStatement = program.body[2];
    expect(lastStatement.kind).toBe('ExpressionStatement');
  });

  it('reports each missing "=" and preserves subsequent declarations', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'slowEMA ta.ema(close, 35)',
      'fastEMA ta.ema(close, 10)',
      'plot(slowEMA)',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });
    expect(result.ast).not.toBeNull();

    const program = result.ast as ProgramNode;
    const declarations = getVariableDeclarations(program);
    expect(declarations).toHaveLength(2);
    expect(result.diagnostics.syntaxErrors).toHaveLength(2);

    const [slow, fast] = declarations;
    expect(slow.missingInitializerOperator).toBe(true);
    expect(fast.missingInitializerOperator).toBe(true);
    expect(slow.recoveryErrors?.[0]?.code).toBe('MISSING_EQUALS');
    expect(fast.recoveryErrors?.[0]?.code).toBe('MISSING_EQUALS');
  });

  it('allows the validator pipeline to surface PSV6-SYNTAX-MISSING-EQUALS', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'slowEMA ta.ema(close, 35)',
      'plot(slowEMA)',
      '',
    ].join('\n');

    const validator = new EnhancedModularValidator();
    const result = validator.validate(source);

    expect(result.errors.length).toBeGreaterThan(0);
    const codes = result.errors.map((error) => error.code);
    expect(codes).toContain('PSV6-SYNTAX-MISSING-EQUALS');
    expect(codes).not.toContain('MODULE_ERROR');
  });
});

describe('Parser Error Recovery - Missing Comma', () => {
  it('recovers a missing comma between call arguments and records metadata', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'plot(close high)',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });
    expect(result.ast).not.toBeNull();
    expect(result.diagnostics.syntaxErrors).toHaveLength(1);

    const program = result.ast as ProgramNode;
    const statement = program.body[1] as ExpressionStatementNode;
    const call = statement.expression as CallExpressionNode;
    expect(call.args).toHaveLength(2);

    const recovery = call.argumentRecovery;
    expect(recovery).toBeDefined();
    expect(recovery?.errors).toHaveLength(1);
    expect(recovery?.errors[0]?.code).toBe('MISSING_COMMA');
    expect(recovery?.virtualSeparators).toHaveLength(1);
    expect(recovery?.virtualSeparators[0]?.isVirtual).toBe(true);
  });

  it('reports multiple missing commas in the same argument list', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'plot(close high low)',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });
    expect(result.ast).not.toBeNull();
    expect(result.diagnostics.syntaxErrors).toHaveLength(2);

    const program = result.ast as ProgramNode;
    const statement = program.body[1] as ExpressionStatementNode;
    const call = statement.expression as CallExpressionNode;

    expect(call.args).toHaveLength(3);
    const recovery = call.argumentRecovery;
    expect(recovery).toBeDefined();
    expect(recovery?.errors).toHaveLength(2);
    expect(recovery?.virtualSeparators).toHaveLength(2);
  });

  it('allows the validator pipeline to surface PSV6-SYNTAX-MISSING-COMMA', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'plot(close high)',
      '',
    ].join('\n');

    const validator = new EnhancedModularValidator();
    const result = validator.validate(source);

    const codes = result.errors.map((error) => error.code);
    expect(codes).toContain('PSV6-SYNTAX-MISSING-COMMA');
  });
});

describe('Parser Error Recovery - Conditional Operator Order', () => {
  it('recovers swapped conditional operators with virtual tokens', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'color = close > open : color.green ? color.red',
      'plot(close, color=color)',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });
    expect(result.ast).not.toBeNull();
    expect(result.diagnostics.syntaxErrors).toHaveLength(1);

    const program = result.ast as ProgramNode;
    const assignment = program.body.find(
      (statement): statement is AssignmentStatementNode => statement.kind === 'AssignmentStatement',
    );
    expect(assignment).toBeDefined();

    const conditional = assignment?.right as ConditionalExpressionNode | undefined;
    expect(conditional).toBeDefined();
    expect(conditional?.kind).toBe('ConditionalExpression');

    const recovery = conditional?.conditionalRecovery;
    expect(recovery).toBeDefined();
    expect(recovery?.errors[0]?.code).toBe('CONDITIONAL_OPERATOR_ORDER');
    expect(recovery?.virtualQuestion.isVirtual).toBe(true);
    expect(recovery?.virtualColon.isVirtual).toBe(true);
    expect(conditional?.consequent.kind).toBe('MemberExpression');
    expect(conditional?.alternate.kind).toBe('MemberExpression');
  });

  it('allows the validator pipeline to surface PSV6-SYNTAX-CONDITIONAL-ORDER', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'color = close > open : color.green ? color.red',
      'plot(close, color=color)',
      '',
    ].join('\n');

    const validator = new EnhancedModularValidator();
    const result = validator.validate(source);

    const codes = result.errors.map((error) => error.code);
    expect(codes).toContain('PSV6-SYNTAX-CONDITIONAL-ORDER');
  });
});
