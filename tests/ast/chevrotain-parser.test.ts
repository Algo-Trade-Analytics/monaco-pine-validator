import { describe, expect, it } from 'vitest';
import { parseWithChevrotain } from '../../core/ast/parser';
import type {
  AssignmentStatementNode,
  BlockStatementNode,
  BreakStatementNode,
  ContinueStatementNode,
  IdentifierNode,
  BinaryExpressionNode,
  CallExpressionNode,
  ExpressionStatementNode,
  IfStatementNode,
  MemberExpressionNode,
  ProgramNode,
  ReturnStatementNode,
  ScriptDeclarationNode,
  UnaryExpressionNode,
  VariableDeclarationNode,
  WhileStatementNode,
} from '../../core/ast/nodes';

describe('Chevrotain parser', () => {
  it('parses directives, script declarations, and call expressions', () => {
    const source = [
      '//@version=5',
      'indicator("Parser test", overlay=true)',
      'foo.bar(na, baz=42)',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.kind).toBe('Program');
    expect(program.directives).toHaveLength(1);
    expect(program.directives[0].kind).toBe('VersionDirective');
    expect(program.directives[0].version).toBe(5);

    expect(program.body).toHaveLength(2);

    const declaration = program.body[0] as ScriptDeclarationNode;
    expect(declaration.kind).toBe('ScriptDeclaration');
    expect(declaration.scriptType).toBe('indicator');
    expect(declaration.arguments).toHaveLength(2);

    const [titleArg, overlayArg] = declaration.arguments;
    expect(titleArg.name).toBeNull();
    expect(titleArg.value.kind).toBe('StringLiteral');

    expect(overlayArg.name?.kind).toBe('Identifier');
    expect(overlayArg.name?.name).toBe('overlay');
    expect(overlayArg.value.kind).toBe('BooleanLiteral');

    const expressionStatement = program.body[1] as ExpressionStatementNode;
    expect(expressionStatement.kind).toBe('ExpressionStatement');

    const call = expressionStatement.expression as CallExpressionNode;
    expect(call.kind).toBe('CallExpression');
    expect(call.args).toHaveLength(2);

    const callee = call.callee as MemberExpressionNode;
    expect(callee.kind).toBe('MemberExpression');
    expect(callee.object.kind).toBe('Identifier');
    expect(callee.property.kind).toBe('Identifier');

    const [firstArg, secondArg] = call.args;
    expect(firstArg.name).toBeNull();
    expect(firstArg.value.kind).toBe('NullLiteral');

    expect(secondArg.name?.kind).toBe('Identifier');
    expect(secondArg.name?.name).toBe('baz');
    expect(secondArg.value.kind).toBe('NumberLiteral');
  });

  it('parses empty argument lists without introducing spurious errors', () => {
    const source = ['foo()', 'indicator()', ''].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(2);

    const callStatement = program.body[0] as ExpressionStatementNode;
    const call = callStatement.expression as CallExpressionNode;
    expect(call.kind).toBe('CallExpression');
    expect(call.args).toHaveLength(0);

    const declaration = program.body[1] as ScriptDeclarationNode;
    expect(declaration.kind).toBe('ScriptDeclaration');
    expect(declaration.arguments).toHaveLength(0);
  });

  it('tolerates missing closing tokens when error recovery is enabled', () => {
    const source = 'indicator(';

    const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: true });

    expect(diagnostics.syntaxErrors.length).toBeGreaterThan(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.kind).toBe('Program');
    expect(() => program.body.map((statement) => statement.loc)).not.toThrow();
  });

  it('parses assignment statements with operator precedence and unary expressions', () => {
    const source = [
      'foo = 1 + 2 * 3',
      'bar = -foo',
      'baz = not bar or foo > 0',
      'foo.bar = baz',
      'qux := foo',
      'quux += 5',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(6);

    const first = program.body[0] as AssignmentStatementNode;
    expect(first.kind).toBe('AssignmentStatement');
    expect(first.left.kind).toBe('Identifier');
    const addition = first.right as BinaryExpressionNode;
    expect(addition.operator).toBe('+');
    expect(addition.left.kind).toBe('NumberLiteral');
    const multiplication = addition.right as BinaryExpressionNode;
    expect(multiplication.operator).toBe('*');
    expect(multiplication.left.kind).toBe('NumberLiteral');
    expect(multiplication.right.kind).toBe('NumberLiteral');

    const second = program.body[1] as AssignmentStatementNode;
    expect(second.left.kind).toBe('Identifier');
    const unary = second.right as UnaryExpressionNode;
    expect(unary.operator).toBe('-');
    expect(unary.argument.kind).toBe('Identifier');

    const third = program.body[2] as AssignmentStatementNode;
    const disjunction = third.right as BinaryExpressionNode;
    expect(disjunction.operator).toBe('or');
    const negation = disjunction.left as UnaryExpressionNode;
    expect(negation.operator).toBe('not');
    const comparison = disjunction.right as BinaryExpressionNode;
    expect(comparison.operator).toBe('>');

    const fourth = program.body[3] as AssignmentStatementNode;
    expect(fourth.left.kind).toBe('MemberExpression');
    expect(fourth.right?.kind).toBe('Identifier');

    const fifth = program.body[4] as AssignmentStatementNode;
    expect(fifth.left.kind).toBe('Identifier');
    expect((fifth.left as IdentifierNode).name).toBe('qux');
    expect(fifth.right?.kind).toBe('Identifier');

    const sixth = program.body[5] as AssignmentStatementNode;
    expect(sixth.left.kind).toBe('Identifier');
    expect((sixth.left as IdentifierNode).name).toBe('quux');
    expect(sixth.right?.kind).toBe('NumberLiteral');
  });

  it('parses variable declarations with optional types and declaration keywords', () => {
    const source = [
      'var foo = 1',
      'const float bar = 2.0',
      'input int userInput = 10',
      'series float result = userInput',
      'array<float> values = array.new_float()',
      'var baz',
      'let qux := foo',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(7);

    const [
      first,
      second,
      third,
      fourth,
      fifth,
      sixth,
      seventh,
    ] = program.body as VariableDeclarationNode[];

    expect(first.declarationKind).toBe('var');
    expect(first.identifier.name).toBe('foo');
    expect(first.typeAnnotation).toBeNull();
    expect(first.initializer?.kind).toBe('NumberLiteral');

    expect(second.declarationKind).toBe('const');
    expect(second.identifier.name).toBe('bar');
    expect(second.typeAnnotation?.kind).toBe('TypeReference');
    expect(second.typeAnnotation?.name.name).toBe('float');

    expect(third.declarationKind).toBe('simple');
    expect(third.identifier.name).toBe('userInput');
    expect(third.typeAnnotation?.name.name).toBe('input');
    expect(third.typeAnnotation?.generics).toHaveLength(1);
    expect(third.typeAnnotation?.generics[0]?.name.name).toBe('int');

    expect(fourth.declarationKind).toBe('simple');
    expect(fourth.identifier.name).toBe('result');
    expect(fourth.typeAnnotation?.name.name).toBe('series');
    expect(fourth.typeAnnotation?.generics[0]?.name.name).toBe('float');
    expect(fourth.initializer?.kind).toBe('Identifier');

    expect(fifth.declarationKind).toBe('simple');
    expect(fifth.identifier.name).toBe('values');
    expect(fifth.typeAnnotation?.name.name).toBe('array');
    expect(fifth.typeAnnotation?.generics[0]?.name.name).toBe('float');
    expect(fifth.initializer?.kind).toBe('CallExpression');

    expect(sixth.declarationKind).toBe('var');
    expect(sixth.identifier.name).toBe('baz');
    expect(sixth.initializer).toBeNull();

    expect(seventh.declarationKind).toBe('let');
    expect(seventh.identifier.name).toBe('qux');
    expect(seventh.initializer?.kind).toBe('Identifier');
  });

  it('parses if/else statements with indentation-based blocks', () => {
    const source = [
      'if condition',
      '    foo := 1',
      '    bar()',
      'else if otherCondition',
      '    baz()',
      'else',
      '    qux := foo',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(1);

    const rootIf = program.body[0] as IfStatementNode;
    expect(rootIf.kind).toBe('IfStatement');

    const rootConsequent = rootIf.consequent as BlockStatementNode;
    expect(rootConsequent.kind).toBe('BlockStatement');
    expect(rootConsequent.body).toHaveLength(2);

    const assignment = rootConsequent.body[0] as AssignmentStatementNode;
    expect((assignment.left as IdentifierNode).name).toBe('foo');
    expect(assignment.right?.kind).toBe('NumberLiteral');

    const callStatement = rootConsequent.body[1] as ExpressionStatementNode;
    const call = callStatement.expression as CallExpressionNode;
    expect(call.kind).toBe('CallExpression');

    const elseIf = rootIf.alternate as IfStatementNode;
    expect(elseIf.kind).toBe('IfStatement');

    const elseIfBlock = elseIf.consequent as BlockStatementNode;
    expect(elseIfBlock.body).toHaveLength(1);
    const nestedCall = elseIfBlock.body[0] as ExpressionStatementNode;
    expect(nestedCall.expression.kind).toBe('CallExpression');

    const finalElse = elseIf.alternate as BlockStatementNode;
    expect(finalElse.kind).toBe('BlockStatement');
    expect(finalElse.body).toHaveLength(1);
    const finalAssignment = finalElse.body[0] as AssignmentStatementNode;
    expect((finalAssignment.left as IdentifierNode).name).toBe('qux');
    expect(finalAssignment.right?.kind).toBe('Identifier');
  });

  it('parses while loops and flow-control statements', () => {
    const source = [
      'while foo < 10',
      '    foo += 1',
      '    if foo > 5',
      '        break',
      '',
      'while bar',
      '    continue',
      '',
      'return',
      'return foo',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(4);

    const firstWhile = program.body[0] as WhileStatementNode;
    expect(firstWhile.kind).toBe('WhileStatement');
    const loopTest = firstWhile.test as BinaryExpressionNode;
    expect(loopTest.operator).toBe('<');
    const loopBody = firstWhile.body;
    expect(loopBody.kind).toBe('BlockStatement');
    expect(loopBody.body).toHaveLength(2);

    const increment = loopBody.body[0] as AssignmentStatementNode;
    expect(increment.kind).toBe('AssignmentStatement');

    const nestedIf = loopBody.body[1] as IfStatementNode;
    expect(nestedIf.kind).toBe('IfStatement');
    const nestedBlock = nestedIf.consequent as BlockStatementNode;
    expect(nestedBlock.body).toHaveLength(1);
    const breakStatement = nestedBlock.body[0] as BreakStatementNode;
    expect(breakStatement.kind).toBe('BreakStatement');

    const secondWhile = program.body[1] as WhileStatementNode;
    expect(secondWhile.kind).toBe('WhileStatement');
    const continueBlock = secondWhile.body;
    expect(continueBlock.body).toHaveLength(1);
    const continueStatement = continueBlock.body[0] as ContinueStatementNode;
    expect(continueStatement.kind).toBe('ContinueStatement');

    const bareReturn = program.body[2] as ReturnStatementNode;
    expect(bareReturn.kind).toBe('ReturnStatement');
    expect(bareReturn.argument).toBeNull();

    const valueReturn = program.body[3] as ReturnStatementNode;
    expect(valueReturn.kind).toBe('ReturnStatement');
    expect(valueReturn.argument?.kind).toBe('Identifier');
  });
});
