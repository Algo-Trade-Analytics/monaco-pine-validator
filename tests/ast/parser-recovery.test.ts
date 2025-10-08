import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseWithChevrotain } from '../../core/ast/parser';
import type {
  ProgramNode,
  VariableDeclarationNode,
  CallExpressionNode,
  ExpressionStatementNode,
  ConditionalExpressionNode,
  AssignmentStatementNode,
  BinaryExpressionNode,
  IdentifierNode,
  FunctionDeclarationNode,
  ArrayLiteralNode,
  IndexExpressionNode,
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
    expect(result.diagnostics.syntaxErrors).toHaveLength(0);

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
    expect(result.diagnostics.syntaxErrors).toHaveLength(0);

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
    expect(result.diagnostics.syntaxErrors).toHaveLength(0);

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
    expect(result.diagnostics.syntaxErrors).toHaveLength(0);

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

describe('Parser Error Recovery - Binary Operators', () => {
  it('recovers a missing right-hand operand before a closing parenthesis', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'plot(close + )',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });
    expect(result.diagnostics.syntaxErrors).toHaveLength(0);

    const program = result.ast as ProgramNode;
    const statement = program.body[1] as ExpressionStatementNode;
    const call = statement.expression as CallExpressionNode;
    const binary = call.args[0]?.value as BinaryExpressionNode;
    expect(binary?.kind).toBe('BinaryExpression');
    expect(binary?.binaryRecovery?.[0]?.errors[0]?.code).toBe('MISSING_BINARY_OPERAND');
    expect(binary?.binaryRecovery?.[0]?.missingSide).toBe('right');
    expect(binary?.right.kind).toBe('Identifier');
    expect((binary?.right as IdentifierNode).name).toBe('__missing_operand__');
  });

  it('does not emit recovery when the operand is present', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'plot(close + open)',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });
    expect(result.diagnostics.syntaxErrors).toHaveLength(0);

    const program = result.ast as ProgramNode;
    const statement = program.body[1] as ExpressionStatementNode;
    const call = statement.expression as CallExpressionNode;
    const binary = call.args[0]?.value as BinaryExpressionNode;
    expect(binary?.binaryRecovery).toBeUndefined();
  });

  it('recovers multiple missing operands within a chained expression', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'plot(close + open - )',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });
    expect(result.diagnostics.syntaxErrors).toHaveLength(0);

    const program = result.ast as ProgramNode;
    const statement = program.body[1] as ExpressionStatementNode;
    const call = statement.expression as CallExpressionNode;
    const binary = call.args[0]?.value as BinaryExpressionNode;
    expect(binary?.binaryRecovery?.[0]?.errors[0]?.code).toBe('MISSING_BINARY_OPERAND');
    expect(binary?.operator).toBe('-');
  });

  it('surfaces PSV6-SYNTAX-MISSING-BINARY-OPERAND through the validator pipeline', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'plot(close + )',
      '',
    ].join('\n');

    const validator = new EnhancedModularValidator();
    const result = validator.validate(source);

    const codes = result.errors.map((error) => error.code);
    expect(codes).toContain('PSV6-SYNTAX-MISSING-BINARY-OPERAND');
  });
});

describe('Parser Error Recovery - Function Parentheses', () => {
  it('recovers missing parentheses in a function declaration', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'closeHigh => close - high',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });
    expect(result.diagnostics.syntaxErrors).toHaveLength(0);
    const program = result.ast as ProgramNode;
    const func = program.body.find(
      (statement): statement is FunctionDeclarationNode => statement.kind === 'FunctionDeclaration',
    );
    expect(func).toBeDefined();
    expect(func?.params).toHaveLength(0);
    const recovery = func?.functionRecovery?.missingParentheses;
    expect(recovery?.errors[0]?.code).toBe('MISSING_FUNCTION_PARENS');
    expect(recovery?.virtualLParen?.isVirtual).toBe(true);
    expect(recovery?.virtualRParen?.isVirtual).toBe(true);
  });

  it('does not emit recovery metadata when parentheses are present', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'closeHigh() => close - high',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });
    expect(result.diagnostics.syntaxErrors).toHaveLength(0);

    const program = result.ast as ProgramNode;
    const func = program.body.find(
      (statement): statement is FunctionDeclarationNode => statement.kind === 'FunctionDeclaration',
    );
    expect(func?.functionRecovery).toBeUndefined();
  });

  it('surfaces PSV6-SYNTAX-MISSING-PARENS through the validator pipeline', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'closeHigh => close - high',
      '',
    ].join('\n');

    const validator = new EnhancedModularValidator();
    const result = validator.validate(source);

    const codes = result.errors.map((error) => error.code);
    expect(codes).toContain('PSV6-SYNTAX-MISSING-PARENS');
  });
});

describe('Parser Error Recovery - Call Arguments', () => {
  it('does not report closing recovery on well-formed function calls', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'plot(close, color=color.red)',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });
    expect(result.diagnostics.syntaxErrors).toHaveLength(0);

    const program = result.ast as ProgramNode;
    const statement = program.body[1] as ExpressionStatementNode;
    const call = statement.expression as CallExpressionNode;
    expect(call.argumentRecovery?.virtualClosing).toBeUndefined();
  });
  it('recovers missing first argument with a placeholder expression', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'value = input.int(, "Label")',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });

    const program = result.ast as ProgramNode;
    const assignment = program.body.find(
      (statement): statement is AssignmentStatementNode => statement.kind === 'AssignmentStatement',
    );
    expect(assignment).toBeDefined();
    const call = assignment?.right as CallExpressionNode | undefined;
    expect(call?.kind).toBe('CallExpression');
    const recovery = call?.argumentRecovery;
    expect(recovery?.virtualArguments?.length).toBe(1);
    expect(recovery?.errors[0]?.code).toBe('EMPTY_ARGUMENT');
  });

  it('recovers a trailing comma with a placeholder expression', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'plot(close, )',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });

    const program = result.ast as ProgramNode;
    const statement = program.body[1] as ExpressionStatementNode;
    const call = statement.expression as CallExpressionNode;
    const recovery = call.argumentRecovery;
    expect(recovery?.virtualArguments?.length).toBe(1);
    expect(recovery?.errors[0]?.code).toBe('TRAILING_COMMA');
  });

  it('recovers missing arguments between commas while preserving later arguments', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'plot(close,, open)',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });
    const program = result.ast as ProgramNode;
    const statement = program.body[1] as ExpressionStatementNode;
    const call = statement.expression as CallExpressionNode;
    expect(call.args).toHaveLength(3);
    const recovery = call.argumentRecovery;
    expect(recovery?.virtualArguments?.length).toBeGreaterThanOrEqual(1);
    expect(recovery?.errors.find((error) => error.code === 'EMPTY_ARGUMENT')).toBeDefined();
  });

  it('surfaces PSV6-SYNTAX-EMPTY-PARAM through the validator pipeline', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'value = input.int(, "Label")',
      '',
    ].join('\n');

    const validator = new EnhancedModularValidator();
    const result = validator.validate(source);
    const codes = result.errors.map((error) => error.code);
    expect(codes).toContain('PSV6-SYNTAX-EMPTY-PARAM');
  });

  it('surfaces PSV6-SYNTAX-TRAILING-COMMA through the validator pipeline', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'plot(close, )',
      '',
    ].join('\n');

    const validator = new EnhancedModularValidator();
    const result = validator.validate(source);
    const codes = result.errors.map((error) => error.code);
    expect(codes).toContain('PSV6-SYNTAX-TRAILING-COMMA');
  });

  it('recovers missing closing bracket in array literal', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'values = [close, open',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });

    const program = result.ast as ProgramNode;
    const assignment = program.body.find(
      (statement): statement is AssignmentStatementNode => statement.kind === 'AssignmentStatement',
    );
    const array = assignment?.right as ArrayLiteralNode | undefined;
    expect(array?.collectionRecovery?.errors.some((error) => error.code === 'MISSING_BRACKET')).toBe(true);
    expect(array?.collectionRecovery?.virtualClosing?.isVirtual).toBe(true);
  });

  it('surfaces PSV6-SYNTAX-MISSING-BRACKET through the validator pipeline', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'values = [close, open',
      '',
    ].join('\n');

    const validator = new EnhancedModularValidator();
    const result = validator.validate(source);
    const codes = result.errors.map((error) => error.code);
    expect(codes).toContain('PSV6-SYNTAX-MISSING-BRACKET');
  });

  it('recovers missing closing parenthesis in a function call', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'plot(close, color=color.red',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });

    const program = result.ast as ProgramNode;
    const statement = program.body[1] as ExpressionStatementNode;
    const call = statement.expression as CallExpressionNode;
    const recovery = call.argumentRecovery;
    expect(recovery?.virtualClosing?.isVirtual).toBe(true);
    expect(recovery?.errors.some((error) => error.code === 'MISSING_CLOSING_PAREN')).toBe(true);
  });

  it('surfaces PSV6-SYNTAX-MISSING-CLOSING-PAREN through the validator pipeline', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'plot(close, color=color.red',
      '',
    ].join('\n');

    const validator = new EnhancedModularValidator();
    const result = validator.validate(source);
    const codes = result.errors.map((error) => error.code);
    expect(codes).toContain('PSV6-SYNTAX-MISSING-CLOSING-PAREN');
  });
});

describe('Parser Error Recovery - Array Elements', () => {
  it('recovers missing array element between commas', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'values = [close, , open]',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });

    const program = result.ast as ProgramNode;
    const assignment = program.body.find(
      (statement): statement is AssignmentStatementNode => statement.kind === 'AssignmentStatement',
    );
    expect(assignment).toBeDefined();
    const array = assignment?.right as ArrayLiteralNode | undefined;
    expect(array?.kind).toBe('ArrayLiteral');
    const recovery = array?.collectionRecovery;
    expect(recovery?.virtualElements.length).toBeGreaterThan(0);
    expect(recovery?.errors[0]?.code).toBe('EMPTY_ARGUMENT');
  });

  it('recovers trailing comma without element', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'values = [close, open, ]',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });

    const program = result.ast as ProgramNode;
    const assignment = program.body.find(
      (statement): statement is AssignmentStatementNode => statement.kind === 'AssignmentStatement',
    );
    const array = assignment?.right as ArrayLiteralNode | undefined;
    expect(array?.collectionRecovery?.errors.some((error) => error.code === 'TRAILING_COMMA')).toBe(true);
  });

  it('surfaces PSV6-SYNTAX-EMPTY-PARAM for missing array elements', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'values = [close, , open]',
      '',
    ].join('\n');

    const validator = new EnhancedModularValidator();
    const result = validator.validate(source);
    const codes = result.errors.map((error) => error.code);
    expect(codes).toContain('PSV6-SYNTAX-EMPTY-PARAM');
  });

  it('surfaces PSV6-SYNTAX-TRAILING-COMMA for trailing array commas', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'values = [close, open, ]',
      '',
    ].join('\n');

    const validator = new EnhancedModularValidator();
    const result = validator.validate(source);
    const codes = result.errors.map((error) => error.code);
    expect(codes).toContain('PSV6-SYNTAX-TRAILING-COMMA');
  });
});

describe('Parser Error Recovery - Index Expressions', () => {
  it('recovers a missing closing bracket in an index expression', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      'value = close[bar_index',
      'plot(value)',
      '',
    ].join('\n');

    const result = parseWithChevrotain(source, { allowErrors: true });

    const program = result.ast as ProgramNode;
    const assignment = program.body.find(
      (statement): statement is AssignmentStatementNode => statement.kind === 'AssignmentStatement',
    );
    expect(assignment).toBeDefined();
    const indexExpression = assignment?.right as IndexExpressionNode | undefined;
    expect(indexExpression?.indexRecovery?.virtualClosing?.isVirtual).toBe(true);
    expect(indexExpression?.indexRecovery?.errors.some((error) => error.code === 'MISSING_BRACKET')).toBe(true);
  });
});

describe('Parser Recovery - Real World Scripts', () => {
  it('parses Uptrick Volatility without recovery diagnostics', () => {
    const source = readFileSync('./tests/popular-pine-scripts/Uptrick-Volatility.pine', 'utf8');
    const result = parseWithChevrotain(source, { allowErrors: true });
    expect(result.diagnostics.syntaxErrors).toHaveLength(0);
  });
});
