import { describe, expect, it } from 'vitest';
import { parseWithChevrotain } from '../../core/ast/parser';
import type {
  AssignmentStatementNode,
  BlockStatementNode,
  BreakStatementNode,
  ContinueStatementNode,
  EnumDeclarationNode,
  EnumMemberNode,
  ForStatementNode,
  FunctionDeclarationNode,
  IdentifierNode,
  ImportDeclarationNode,
  IndexExpressionNode,
  MatrixLiteralNode,
  BinaryExpressionNode,
  CallExpressionNode,
  ConditionalExpressionNode,
  ExpressionStatementNode,
  IfStatementNode,
  MemberExpressionNode,
  NumberLiteralNode,
  ProgramNode,
  ReturnStatementNode,
  ScriptDeclarationNode,
  SwitchStatementNode,
  TypeDeclarationNode,
  TypeFieldNode,
  ParameterNode,
  TupleExpressionNode,
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

  it('parses import declarations with aliases', () => {
    const source = [
      'import "user/lib/1" as lib',
      'lib.run()',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(2);

    const importDeclaration = program.body[0] as ImportDeclarationNode;
    expect(importDeclaration.kind).toBe('ImportDeclaration');
    expect(importDeclaration.path.value).toBe('user/lib/1');
    expect(importDeclaration.alias.name).toBe('lib');

    const statement = program.body[1] as ExpressionStatementNode;
    const call = statement.expression as CallExpressionNode;
    const callee = call.callee as MemberExpressionNode;
    expect((callee.object as IdentifierNode).name).toBe('lib');
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

  it('recovers from unterminated else blocks while preserving parsed branches', () => {
    const source = ['if condition', '    foo()', 'else'].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: true });

    expect(diagnostics.syntaxErrors.length).toBeGreaterThan(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(Array.isArray(program.body)).toBe(true);
    expect(() => program.body.map((statement) => statement?.kind)).not.toThrow();
  });

  it('keeps partial AST data when deeply nested expressions miss closing parentheses', () => {
    const open = '('.repeat(20);
    const close = ')'.repeat(10);
    const source = `result = ${open}foo${close}`;

    const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: true });

    expect(diagnostics.syntaxErrors.length).toBeGreaterThan(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(Array.isArray(program.body)).toBe(true);
    expect(() => program.body.map((statement) => statement?.kind)).not.toThrow();
  });

  it('handles mixed indentation without dropping the partial AST', () => {
    const source = [
      'if foo',
      '    bar()',
      '   baz()',
      '',
      'qux()',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: true });

    expect(diagnostics.syntaxErrors.length).toBeGreaterThanOrEqual(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(Array.isArray(program.body)).toBe(true);
    expect(program.body.length).toBeGreaterThanOrEqual(1);
    expect(() => program.body.map((statement) => statement?.kind)).not.toThrow();
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

  it('parses tuple destructuring assignments with holes', () => {
    const source = [
      '//@version=5',
      'indicator("Tuple parse")',
      '[fast,, slow] = ta.macd(close, 12, 26, 9)',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(2);

    const assignment = program.body[1] as AssignmentStatementNode;
    expect(assignment.kind).toBe('AssignmentStatement');

    const tuple = assignment.left as TupleExpressionNode;
    expect(tuple.kind).toBe('TupleExpression');
    expect(tuple.elements).toHaveLength(3);
    expect(tuple.elements[0]?.kind).toBe('Identifier');
    expect(tuple.elements[1]).toBeNull();
    expect(tuple.elements[2]?.kind).toBe('Identifier');
  });

  it('parses matrix literals constructed from tuple rows', () => {
    const source = [
      'weights = [[1, 2],',
      '  [3, 4]]',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(1);

    const assignment = program.body[0] as AssignmentStatementNode;
    const matrix = assignment.right as MatrixLiteralNode;

    expect(matrix.kind).toBe('MatrixLiteral');
    expect(matrix.rows).toHaveLength(2);
    expect(matrix.rows[0]).toHaveLength(2);
    expect(matrix.rows[0][0]?.kind).toBe('NumberLiteral');
    expect(matrix.rows[1][1]?.kind).toBe('NumberLiteral');
  });

  it('parses index expressions in assignment targets and nested chains', () => {
    const source = [
      'close[1] := 0',
      'result = foo[bar[2]]',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(2);

    const first = program.body[0] as AssignmentStatementNode;
    expect(first.kind).toBe('AssignmentStatement');
    const indexedLeft = first.left as IndexExpressionNode;
    expect(indexedLeft.kind).toBe('IndexExpression');
    expect((indexedLeft.object as IdentifierNode).name).toBe('close');
    const leftIndex = indexedLeft.index as NumberLiteralNode;
    expect(leftIndex.kind).toBe('NumberLiteral');
    expect(leftIndex.value).toBe(1);
    expect((first.right as NumberLiteralNode).value).toBe(0);

    const second = program.body[1] as AssignmentStatementNode;
    expect((second.left as IdentifierNode).name).toBe('result');
    const outerIndex = second.right as IndexExpressionNode;
    expect(outerIndex.kind).toBe('IndexExpression');
    expect((outerIndex.object as IdentifierNode).name).toBe('foo');
    const nestedIndex = outerIndex.index as IndexExpressionNode;
    expect(nestedIndex.kind).toBe('IndexExpression');
    expect((nestedIndex.object as IdentifierNode).name).toBe('bar');
    const nestedLiteral = nestedIndex.index as NumberLiteralNode;
    expect(nestedLiteral.kind).toBe('NumberLiteral');
    expect(nestedLiteral.value).toBe(2);
  });

  it('parses conditional expressions with nested ternaries', () => {
    const source = [
      'result = condition ? foo() : otherCondition ? bar() : baz',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(1);

    const assignment = program.body[0] as AssignmentStatementNode;
    expect(assignment.kind).toBe('AssignmentStatement');

    const conditional = assignment.right as ConditionalExpressionNode;
    expect(conditional.kind).toBe('ConditionalExpression');
    expect((conditional.test as IdentifierNode).name).toBe('condition');

    const consequentCall = conditional.consequent as CallExpressionNode;
    expect(consequentCall.kind).toBe('CallExpression');
    expect((consequentCall.callee as IdentifierNode).name).toBe('foo');

    const nestedConditional = conditional.alternate as ConditionalExpressionNode;
    expect(nestedConditional.kind).toBe('ConditionalExpression');
    expect((nestedConditional.test as IdentifierNode).name).toBe('otherCondition');

    const nestedConsequent = nestedConditional.consequent as CallExpressionNode;
    expect((nestedConsequent.callee as IdentifierNode).name).toBe('bar');
    expect((nestedConditional.alternate as IdentifierNode).name).toBe('baz');
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

  it('parses enum declarations with optional values and export modifiers', () => {
    const source = [
      'enum Status',
      '    ACTIVE',
      '    INACTIVE = 1',
      '',
      'export enum Mode',
      '    AUTO',
      '    MANUAL',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(2);

    const [statusEnum, modeEnum] = program.body as [EnumDeclarationNode, EnumDeclarationNode];
    expect(statusEnum.kind).toBe('EnumDeclaration');
    expect(statusEnum.export).toBe(false);
    expect(statusEnum.identifier.name).toBe('Status');
    expect(statusEnum.members).toHaveLength(2);

    const [active, inactive] = statusEnum.members as [EnumMemberNode, EnumMemberNode];
    expect(active.identifier.name).toBe('ACTIVE');
    expect(active.value).toBeNull();
    expect(inactive.identifier.name).toBe('INACTIVE');
    expect((inactive.value as NumberLiteralNode).value).toBe(1);

    expect(modeEnum.kind).toBe('EnumDeclaration');
    expect(modeEnum.export).toBe(true);
    expect(modeEnum.identifier.name).toBe('Mode');
    expect(modeEnum.members.map((member) => member.identifier.name)).toEqual(['AUTO', 'MANUAL']);
  });

  it('parses type declarations with typed fields and respects exports', () => {
    const source = [
      'type Point',
      '    float x',
      '    array<float> values',
      '    series int level',
      '',
      'export type Vector',
      '    float x',
      '    float y',
      '',
      'method Point.new() => 0',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body.map((node) => node.kind)).toEqual([
      'TypeDeclaration',
      'TypeDeclaration',
      'FunctionDeclaration',
    ]);
    expect(program.body).toHaveLength(3);

    const pointType = program.body[0] as TypeDeclarationNode;
    expect(pointType.kind).toBe('TypeDeclaration');
    expect(pointType.export).toBe(false);
    expect(pointType.fields).toHaveLength(3);

    const [xField, valuesField, levelField] = pointType.fields as [TypeFieldNode, TypeFieldNode, TypeFieldNode];
    expect(xField.identifier.name).toBe('x');
    expect(xField.typeAnnotation?.name.name).toBe('float');
    expect(valuesField.typeAnnotation?.name.name).toBe('array');
    expect(valuesField.typeAnnotation?.generics[0]?.name.name).toBe('float');
    expect(levelField.typeAnnotation?.name.name).toBe('series');
    expect(levelField.typeAnnotation?.generics[0]?.name.name).toBe('int');

    const vectorType = program.body[1] as TypeDeclarationNode;
    expect(vectorType.export).toBe(true);
    expect(vectorType.identifier.name).toBe('Vector');
    expect(vectorType.fields.map((field) => field.identifier.name)).toEqual(['x', 'y']);

    const method = program.body[2] as FunctionDeclarationNode;
    expect(method.kind).toBe('FunctionDeclaration');
    expect(method.identifier?.name).toBe('Point.new');
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

  it('parses for loops with implicit and explicit steps', () => {
    const source = [
      'for i = 0 to 10',
      '    sum := sum + i',
      '',
      'for j := 10 to 0 by -1',
      '    foo(j)',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(2);

    const firstLoop = program.body[0] as ForStatementNode;
    expect(firstLoop.kind).toBe('ForStatement');
    expect(firstLoop.initializer?.kind).toBe('AssignmentStatement');
    const firstTest = firstLoop.test as BinaryExpressionNode;
    expect(firstTest.operator).toBe('<=');
    expect(firstTest.left.kind).toBe('Identifier');
    expect((firstTest.left as IdentifierNode).name).toBe('i');
    expect(firstTest.right.kind).toBe('NumberLiteral');
    const firstUpdate = firstLoop.update as BinaryExpressionNode;
    expect(firstUpdate.operator).toBe('+');
    expect((firstUpdate.left as IdentifierNode).name).toBe('i');
    expect(firstUpdate.right.kind).toBe('NumberLiteral');

    const secondLoop = program.body[1] as ForStatementNode;
    expect(secondLoop.kind).toBe('ForStatement');
    expect(secondLoop.initializer?.kind).toBe('AssignmentStatement');
    const secondTest = secondLoop.test as BinaryExpressionNode;
    expect(secondTest.operator).toBe('<=');
    expect((secondTest.left as IdentifierNode).name).toBe('j');
    expect(secondTest.right.kind).toBe('NumberLiteral');
    const secondUpdate = secondLoop.update as BinaryExpressionNode;
    expect(secondUpdate.operator).toBe('+');
    expect((secondUpdate.left as IdentifierNode).name).toBe('j');
    expect(secondUpdate.right.kind).toBe('UnaryExpression');
  });

  it('parses switch statements with inline and block cases', () => {
    const source = [
      'result = switch mode',
      '    "long" => "buy"',
      '    "short" =>',
      '        foo()',
      '        bar := 1',
      '    => "flat"',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(1);

    const assignment = program.body[0] as AssignmentStatementNode;
    expect(assignment.right?.kind).toBe('SwitchStatement');

    const switchStatement = assignment.right as SwitchStatementNode;
    expect(switchStatement.cases).toHaveLength(3);

    const [firstCase, secondCase, defaultCase] = switchStatement.cases;

    expect(firstCase.test?.kind).toBe('StringLiteral');
    expect(firstCase.consequent).toHaveLength(1);
    const firstExpression = firstCase.consequent[0] as ExpressionStatementNode;
    expect(firstExpression.expression.kind).toBe('StringLiteral');

    expect(secondCase.test?.kind).toBe('StringLiteral');
    expect(secondCase.consequent).toHaveLength(2);
    const nestedCall = secondCase.consequent[0] as ExpressionStatementNode;
    expect(nestedCall.expression.kind).toBe('CallExpression');
    const nestedAssignment = secondCase.consequent[1] as AssignmentStatementNode;
    expect((nestedAssignment.left as IdentifierNode).name).toBe('bar');

    expect(defaultCase.test).toBeNull();
    expect(defaultCase.consequent).toHaveLength(1);
    const defaultExpression = defaultCase.consequent[0] as ExpressionStatementNode;
    expect(defaultExpression.expression.kind).toBe('StringLiteral');
  });

  it('parses exported function declarations', () => {
    const source = [
      'export float compute(series float x) => x',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body.map((node) => node.kind)).toEqual(['FunctionDeclaration']);
    expect(program.body).toHaveLength(1);

    const declaration = program.body[0] as FunctionDeclarationNode;
    expect(declaration.kind).toBe('FunctionDeclaration');
    expect(declaration.export).toBe(true);
    expect(declaration.identifier?.name).toBe('compute');
    expect(declaration.returnType?.name.name).toBe('float');
  });

  it('parses typed function declarations with implicit return bodies', () => {
    const source = [
      '//@version=6',
      'indicator("Fn")',
      'float compute(series float x, float y=1) => x + y',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(2);

    const declaration = program.body[1] as FunctionDeclarationNode;
    expect(declaration.kind).toBe('FunctionDeclaration');
    expect(declaration.identifier?.name).toBe('compute');
    expect(declaration.returnType?.name.name).toBe('float');

    const [seriesParam, defaultParam] = declaration.params as [ParameterNode, ParameterNode];
    expect(seriesParam.identifier.name).toBe('x');
    expect(seriesParam.typeAnnotation?.name.name).toBe('series');
    expect(seriesParam.typeAnnotation?.generics[0]?.name.name).toBe('float');

    expect(defaultParam.identifier.name).toBe('y');
    expect(defaultParam.typeAnnotation?.name.name).toBe('float');
    expect(defaultParam.defaultValue?.kind).toBe('NumberLiteral');

    const body = declaration.body as BlockStatementNode;
    expect(body.body).toHaveLength(1);
    const returnStatement = body.body[0] as ReturnStatementNode;
    expect(returnStatement.kind).toBe('ReturnStatement');
    const addition = returnStatement.argument as BinaryExpressionNode;
    expect(addition.operator).toBe('+');
  });

  it('parses method-style function declarations with block bodies', () => {
    const source = [
      'method Point.move(this, dx) =>',
      '    this.x := this.x + dx',
      '    return this.x',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(1);

    const declaration = program.body[0] as FunctionDeclarationNode;
    expect(declaration.identifier?.name).toBe('Point.move');
    expect(declaration.params.map((param) => param.identifier.name)).toEqual(['this', 'dx']);
    expect(declaration.body.body).toHaveLength(2);

    const assignment = declaration.body.body[0] as AssignmentStatementNode;
    expect(assignment.kind).toBe('AssignmentStatement');

    const explicitReturn = declaration.body.body[1] as ReturnStatementNode;
    expect(explicitReturn.argument?.kind).toBe('MemberExpression');
  });

  describe.skip('upcoming grammar coverage', () => {
    it('parses repeat...until loops once implemented', () => {
      const source = ['repeat', '    foo()', 'until bar', ''].join('\n');

      const { ast, diagnostics } = parseWithChevrotain(source);

      expect(diagnostics.syntaxErrors).toHaveLength(0);
      expect(ast).not.toBeNull();
    });

    it('parses compiler annotations preceding declarations', () => {
      const source = [
        '//@function foo',
        '//@param value The input value.',
        'float foo(float value) => value',
        '',
      ].join('\n');

      const { ast, diagnostics } = parseWithChevrotain(source);

      expect(diagnostics.syntaxErrors).toHaveLength(0);
      expect(ast).not.toBeNull();
    });

    it('parses null-coalescing ternary sugar once syntax is confirmed', () => {
      const source = ['result = foo ?? bar', ''].join('\n');

      const { ast, diagnostics } = parseWithChevrotain(source);

      expect(diagnostics.syntaxErrors).toHaveLength(0);
      expect(ast).not.toBeNull();
    });
  });
});
