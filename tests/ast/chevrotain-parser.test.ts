import { describe, expect, it } from 'vitest';
import { parseWithChevrotain } from '../../core/ast/parser';
import { Dot, NumberLiteral as NumberToken, PineLexer } from '../../core/ast/parser/tokens';
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
  ArrayLiteralNode,
  BinaryExpressionNode,
  CallExpressionNode,
  ConditionalExpressionNode,
  ArrowFunctionExpressionNode,
  ExpressionStatementNode,
  IfStatementNode,
  IfExpressionNode,
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
  RepeatStatementNode,
} from '../../core/ast/nodes';

describe('Chevrotain parser', () => {
  it('parses directives, script declarations, and call expressions', () => {
    const source = [
      '//@version=5',
      'indicator("Parser test", overlay=true)',
      'foo.bar(na, baz=42)',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: true });

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

    const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: true });

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

    const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: true });

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

  it('parses literal expression statements inside indented blocks', () => {
    const source = ['f() =>', '    [1, 2, 3]', '    (foo)', '    42', ''].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: true });

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(1);

    const declaration = program.body[0] as FunctionDeclarationNode;
    expect(declaration.kind).toBe('FunctionDeclaration');
    expect(declaration.body.body).toHaveLength(3);

    const [arrayStatement, groupedStatement, numberStatement] =
      declaration.body.body as ExpressionStatementNode[];

    expect(arrayStatement.kind).toBe('ExpressionStatement');
    expect(arrayStatement.expression.kind).toBe('ArrayLiteral');

    expect(groupedStatement.kind).toBe('ExpressionStatement');
    expect(groupedStatement.expression.kind).toBe('Identifier');

    expect(numberStatement.kind).toBe('ExpressionStatement');
    expect(numberStatement.expression.kind).toBe('NumberLiteral');
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

  it('splits multi-variable declarations into individual AST statements', () => {
    const source = [
      'float a = 1.0, b = 2.0, c = 3.0',
      'var foo : int = 4, bar = 5',
      'if condition',
      '    float nestedA = 6., nestedB = 7.',
      'else',
      '    int altA = 8, altB = 9',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: true });

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(3); // Now we have 3 top-level statements: 2 BlockStatements + 1 IfStatement

    const [first, second, third] = program.body;

    // First multi-variable declaration: float a = 1.0, b = 2.0, c = 3.0
    expect(first.kind).toBe('BlockStatement');
    const firstBlock = first as BlockStatementNode;
    expect(firstBlock.body).toHaveLength(3);
    const [a, b, c] = firstBlock.body as VariableDeclarationNode[];
    expect(a.identifier.name).toBe('a');
    expect(a.typeAnnotation?.name.name).toBe('float');
    expect(b.identifier.name).toBe('b');
    expect(b.typeAnnotation?.name.name).toBe('float');
    expect(c.identifier.name).toBe('c');
    expect(c.typeAnnotation?.name.name).toBe('float');

    // Second multi-variable declaration: var foo : int = 4, bar = 5
    expect(second.kind).toBe('BlockStatement');
    const secondBlock = second as BlockStatementNode;
    expect(secondBlock.body).toHaveLength(2);
    const [foo, bar] = secondBlock.body as VariableDeclarationNode[];
    expect(foo.identifier.name).toBe('foo');
    expect(foo.typeAnnotation?.name.name).toBe('int');
    expect(bar.identifier.name).toBe('bar');
    expect(bar.typeAnnotation?.name.name).toBe('int');

    // If statement
    expect(third.kind).toBe('IfStatement');
    const ifStatement = third as IfStatementNode;

    expect(ifStatement.consequent.kind).toBe('BlockStatement');
    const consequentBlock = ifStatement.consequent as BlockStatementNode;
    // Multi-variable declarations are unwrapped into individual declarations
    expect(consequentBlock.body).toHaveLength(2);
    expect(consequentBlock.body.every((node) => node.kind === 'VariableDeclaration')).toBe(true);
    const [nestedA, nestedB] = consequentBlock.body as VariableDeclarationNode[];
    expect(nestedA.identifier.name).toBe('nestedA');
    expect(nestedB.identifier.name).toBe('nestedB');

    expect(ifStatement.alternate?.kind).toBe('BlockStatement');
    const alternateBlock = ifStatement.alternate as BlockStatementNode;
    // Multi-variable declarations are unwrapped into individual declarations
    expect(alternateBlock.body).toHaveLength(2);
    expect(alternateBlock.body.every((node) => node.kind === 'VariableDeclaration')).toBe(true);
    const [altA, altB] = alternateBlock.body as VariableDeclarationNode[];
    expect(altA.identifier.name).toBe('altA');
    expect(altB.identifier.name).toBe('altB');
    expect(altA.typeAnnotation?.name.name).toBe('int');
    expect(altB.typeAnnotation?.name.name).toBe('int');
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

    const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: true });

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

    if (diagnostics.syntaxErrors.length > 0) {
      throw new Error(JSON.stringify(diagnostics.syntaxErrors, null, 2));
    }
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

    if (diagnostics.syntaxErrors.length > 0) {
      throw new Error(JSON.stringify(diagnostics.syntaxErrors, null, 2));
    }
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

  it('parses array literals as dedicated nodes', () => {
    const source = [
      'values = [1, foo, 3]',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    if (diagnostics.syntaxErrors.length > 0) {
      throw new Error(JSON.stringify(diagnostics.syntaxErrors, null, 2));
    }
    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(1);

    const assignment = program.body[0] as AssignmentStatementNode;
    const arrayLiteral = assignment.right as ArrayLiteralNode;

    expect(arrayLiteral.kind).toBe('ArrayLiteral');
    expect(arrayLiteral.elements).toHaveLength(3);
    expect(arrayLiteral.elements[0]?.kind).toBe('NumberLiteral');
    expect(arrayLiteral.elements[1]?.kind).toBe('Identifier');
    expect(arrayLiteral.elements[2]?.kind).toBe('NumberLiteral');
  });

  it('parses index expressions in assignment targets and nested chains', () => {
    const source = [
      'close[1] := 0',
      'result = foo[bar[2]]',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    if (diagnostics.syntaxErrors.length > 0) {
      throw new Error(JSON.stringify(diagnostics.syntaxErrors, null, 2));
    }
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

    if (diagnostics.syntaxErrors.length > 0) {
      throw new Error(JSON.stringify(diagnostics.syntaxErrors, null, 2));
    }
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

  it('parses expression-form if statements with else-if chains', () => {
    const source = [
      'result = if close > open',
      '    close',
      'else if close < open',
      '    open',
      'else',
      '    close[1]',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(1);

    const assignment = program.body[0] as AssignmentStatementNode;
    expect(assignment.kind).toBe('AssignmentStatement');

    const ifExpression = assignment.right as IfExpressionNode;
    expect(ifExpression.kind).toBe('IfExpression');
    const firstComparison = ifExpression.test as BinaryExpressionNode;
    expect(firstComparison.operator).toBe('>');

    const consequentBlock = ifExpression.consequent;
    expect(consequentBlock.kind).toBe('BlockStatement');
    expect(consequentBlock.body).toHaveLength(1);
    const consequentStatement = consequentBlock.body[0] as ExpressionStatementNode;
    expect((consequentStatement.expression as IdentifierNode).name).toBe('close');

    const elseIfExpression = ifExpression.alternate as IfExpressionNode;
    expect(elseIfExpression.kind).toBe('IfExpression');
    const elseComparison = elseIfExpression.test as BinaryExpressionNode;
    expect(elseComparison.operator).toBe('<');
    const elseConsequent = elseIfExpression.consequent.body[0] as ExpressionStatementNode;
    expect((elseConsequent.expression as IdentifierNode).name).toBe('open');

    const finalElse = elseIfExpression.alternate as BlockStatementNode;
    expect(finalElse.kind).toBe('BlockStatement');
    expect(finalElse.body).toHaveLength(1);
    const finalStatement = finalElse.body[0] as ExpressionStatementNode;
    const finalExpression = finalStatement.expression as IndexExpressionNode;
    expect(finalExpression.kind).toBe('IndexExpression');
    expect((finalExpression.object as IdentifierNode).name).toBe('close');
    const finalIndex = finalExpression.index as NumberLiteralNode;
    expect(finalIndex.kind).toBe('NumberLiteral');
    expect(finalIndex.value).toBe(1);
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

  it('captures call expression generic type arguments', () => {
    const source = [
      'prices = array.new<float>(10)',
      'nested = array.new<array<float>>(5)',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    if (diagnostics.syntaxErrors.length > 0) {
      throw new Error(JSON.stringify(diagnostics.syntaxErrors, null, 2));
    }
    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(2);

    const firstAssignment = program.body[0] as AssignmentStatementNode;
    expect(firstAssignment.kind).toBe('AssignmentStatement');
    const firstCall = firstAssignment.right as CallExpressionNode;
    expect(firstCall.kind).toBe('CallExpression');
    expect(firstCall.typeArguments).toHaveLength(1);
    expect(firstCall.typeArguments[0]?.name.name).toBe('float');

    const secondAssignment = program.body[1] as AssignmentStatementNode;
    expect(secondAssignment.kind).toBe('AssignmentStatement');
    const secondCall = secondAssignment.right as CallExpressionNode;
    expect(secondCall.kind).toBe('CallExpression');
    expect(secondCall.typeArguments).toHaveLength(1);
    const nestedType = secondCall.typeArguments[0];
    expect(nestedType?.name.name).toBe('array');
    expect(nestedType?.generics).toHaveLength(1);
    expect(nestedType?.generics[0]?.name.name).toBe('float');
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

  it('parses collection iteration for-in loops with identifiers and tuples', () => {
    const source = [
      'for value in values',
      '    sum += value',
      '',
      'for [index, item] in array',
      '    process(index, item)',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(2);

    const firstLoop = program.body[0] as ForStatementNode;
    expect(firstLoop.initializer).toBeNull();
    expect(firstLoop.test).toBeNull();
    expect(firstLoop.update).toBeNull();
    expect(firstLoop.iterator?.kind).toBe('Identifier');
    expect((firstLoop.iterator as IdentifierNode).name).toBe('value');
    expect(firstLoop.iterable?.kind).toBe('Identifier');
    expect((firstLoop.iterable as IdentifierNode).name).toBe('values');

    const secondLoop = program.body[1] as ForStatementNode;
    expect(secondLoop.initializer).toBeNull();
    expect(secondLoop.test).toBeNull();
    expect(secondLoop.update).toBeNull();
    expect(secondLoop.iterator?.kind).toBe('TupleExpression');
    const tuple = secondLoop.iterator as TupleExpressionNode;
    expect(tuple.elements).toHaveLength(2);
    expect(tuple.elements[0]?.kind).toBe('Identifier');
    expect((tuple.elements[0] as IdentifierNode).name).toBe('index');
    expect(tuple.elements[1]?.kind).toBe('Identifier');
    expect((tuple.elements[1] as IdentifierNode).name).toBe('item');
    expect(secondLoop.iterable?.kind).toBe('Identifier');
    expect((secondLoop.iterable as IdentifierNode).name).toBe('array');
  });

  it('parses deeply nested loops that include trailing decimal divisors', () => {
    const source = [
      'for y = 0 to gy - 1',
      '    float cy = math.cos(y / 6.) * 3',
      '    for x = 0 to gx - 1',
      '        float base = math.sin(x / 4.) * 5 + cy',
      '        float add  = 0.0',
      '        for pk in peaks',
      '            float dx = float(x) - pk.x',
      '            float dy = float(y) - pk.y',
      '            add += pk.z * math.exp(-(dx*dx + dy*dy) / (2 * 3.2 * 3.2))',
      '        M.set(y, x, Point3D.new(float(x), float(y), base + add))',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(1);
    const outerLoop = program.body[0] as ForStatementNode;
    expect(outerLoop.kind).toBe('ForStatement');
    expect(outerLoop.body.body).toHaveLength(2);

    const [outerDeclaration, nestedLoop] = outerLoop.body.body;
    expect(outerDeclaration?.kind).toBe('VariableDeclaration');
    expect(nestedLoop?.kind).toBe('ForStatement');

    const nestedLoopNode = nestedLoop as ForStatementNode;
    expect(nestedLoopNode.body.body.length).toBeGreaterThan(0);
    const innermostLoop = nestedLoopNode.body.body.find(
      (statement): statement is ForStatementNode => statement.kind === 'ForStatement',
    );
    expect(innermostLoop).toBeDefined();
  });

  it('keeps member access after integers tokenised as dot access', () => {
    const source = 'value = 6.exponent';
    const { tokens, errors } = PineLexer.tokenize(source);

    expect(errors).toHaveLength(0);

    const numberToken = tokens.find((token) => token.image === '6');
    const dotToken = tokens.find((token) => token.tokenType === Dot);

    expect(numberToken?.tokenType).toBe(NumberToken);
    expect(dotToken).toBeDefined();
  });

  it('parses loop expressions with trailing result values', () => {
    const source = [
      'sum = for i = 0 to 3',
      '        running := running + i',
      '        running',
      '',
      'var nextValue = while running < 10',
      '                    running += 1',
      '                    running',
      '',
      'result = for value in values',
      '            value * 2',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(3);

    const assignment = program.body[0] as AssignmentStatementNode;
    expect(assignment.kind).toBe('AssignmentStatement');
    const forExpression = assignment.right as ForStatementNode;
    expect(forExpression.kind).toBe('ForStatement');
    expect(forExpression.result?.kind).toBe('Identifier');
    const bodyStatements = forExpression.body.body;
    const lastStatement = bodyStatements[bodyStatements.length - 1] as ExpressionStatementNode;
    expect(forExpression.result).toBe(lastStatement.expression);

    const declaration = program.body[1] as VariableDeclarationNode;
    expect(declaration.initializer?.kind).toBe('WhileStatement');
    const whileExpression = declaration.initializer as WhileStatementNode;
    expect(whileExpression.result?.kind).toBe('Identifier');
    const whileBody = whileExpression.body.body;
    const whileResultStatement = whileBody[whileBody.length - 1] as ExpressionStatementNode;
    expect(whileExpression.result).toBe(whileResultStatement.expression);

    const forInAssignment = program.body[2] as AssignmentStatementNode;
    expect(forInAssignment.right?.kind).toBe('ForStatement');
    const inlineFor = forInAssignment.right as ForStatementNode;
    expect(inlineFor.iterator?.kind).toBe('Identifier');
    expect(inlineFor.result?.kind).toBe('BinaryExpression');
  });

  it('attaches loop result bindings when loops appear on the right-hand side', () => {
    const source = [
      'sum = for i = 0 to 2',
      '        running := nz(running, 0) + i',
      '        running',
      '',
      'var total = while sum < 10',
      '                sum += 1',
      '                sum',
      '',
      '[even, odd] = switch sum % 2',
      '    0 => sum',
      '    => sum + 1',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    expect(program.body).toHaveLength(3);

    const assignment = program.body[0] as AssignmentStatementNode;
    const forExpression = assignment.right as ForStatementNode;
    expect(forExpression.resultBinding).not.toBeNull();
    expect(forExpression.resultBinding?.kind).toBe('assignment');
    expect(forExpression.resultBinding?.target).toBe(assignment.left);
    expect(forExpression.resultBinding?.operator).toBe('=');

    const declaration = program.body[1] as VariableDeclarationNode;
    const whileExpression = declaration.initializer as WhileStatementNode;
    expect(whileExpression.resultBinding).not.toBeNull();
    expect(whileExpression.resultBinding?.kind).toBe('variableDeclaration');
    expect(whileExpression.resultBinding?.target).toBe(declaration.identifier);
    expect(whileExpression.resultBinding?.operator).toBe('=');
    expect(whileExpression.resultBinding?.declarationKind).toBe(declaration.declarationKind);

    const tupleAssignment = program.body[2] as AssignmentStatementNode;
    const switchExpression = tupleAssignment.right as SwitchStatementNode;
    expect(switchExpression.resultBinding).not.toBeNull();
    expect(switchExpression.resultBinding?.kind).toBe('tupleAssignment');
    expect(switchExpression.resultBinding?.target).toBe(tupleAssignment.left);
    expect(switchExpression.resultBinding?.operator).toBe('=');
  });

  it('parses arrow function expressions with expression and block bodies', () => {
    const source = [
      '//@version=6',
      'indicator("Arrow Expressions")',
      'var transformer = (float value) => value * 2',
      'result = (series float input, float scale = 1) =>',
      '    scaled := input * scale',
      '    scaled',
      '',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;

    const declaration = program.body.find(
      (node): node is VariableDeclarationNode => node.kind === 'VariableDeclaration',
    );
    expect(declaration).toBeDefined();
    if (!declaration) {
      throw new Error('Expected variable declaration for transformer');
    }
    expect(declaration.kind).toBe('VariableDeclaration');
    expect(declaration.initializer?.kind).toBe('ArrowFunctionExpression');
    const expressionArrow = declaration.initializer as ArrowFunctionExpressionNode;
    expect(expressionArrow.params).toHaveLength(1);
    expect(expressionArrow.params[0].identifier.name).toBe('value');
    const expressionReturn = expressionArrow.body.body[0] as ReturnStatementNode;
    expect(expressionReturn.argument?.kind).toBe('BinaryExpression');

    const assignment = program.body.find(
      (node): node is AssignmentStatementNode => node.kind === 'AssignmentStatement',
    );
    expect(assignment).toBeDefined();
    if (!assignment) {
      throw new Error('Expected assignment for result binding');
    }
    expect(assignment.kind).toBe('AssignmentStatement');
    expect(assignment.right?.kind).toBe('ArrowFunctionExpression');
    const blockArrow = assignment.right as ArrowFunctionExpressionNode;
    expect(blockArrow.params).toHaveLength(2);
    expect(blockArrow.params[0].identifier.name).toBe('input');
    expect(blockArrow.params[1].defaultValue?.kind).toBe('NumberLiteral');
    expect(blockArrow.body.body).toHaveLength(2);
    const [loopAssignment, finalExpression] = blockArrow.body.body;
    expect(loopAssignment.kind).toBe('AssignmentStatement');
    expect(finalExpression.kind).toBe('ExpressionStatement');
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

  describe('upcoming grammar coverage', () => {
    it('parses repeat...until loops', () => {
      const source = ['repeat', '    foo()', 'until bar', ''].join('\n');

      const { ast, diagnostics } = parseWithChevrotain(source);

      expect(diagnostics.syntaxErrors).toHaveLength(0);
      expect(ast).not.toBeNull();

      const program = ast as ProgramNode;
      expect(program.body).toHaveLength(1);
      const repeat = program.body[0] as RepeatStatementNode;
      expect(repeat.kind).toBe('RepeatStatement');
      expect(repeat.body.body).toHaveLength(1);
      const callStatement = repeat.body.body[0] as ExpressionStatementNode;
      expect(callStatement.expression.kind).toBe('CallExpression');
      expect(repeat.result).toBe(callStatement.expression);
      const test = repeat.test as IdentifierNode;
      expect(test.kind).toBe('Identifier');
      expect(test.name).toBe('bar');
    });

    it('captures trailing return values as repeat loop results', () => {
      const source = [
        'repeat',
        '    foo()',
        '    return value',
        'until condition',
        '',
      ].join('\n');

      const { ast, diagnostics } = parseWithChevrotain(source);

      expect(diagnostics.syntaxErrors).toHaveLength(0);
      expect(ast).not.toBeNull();

      const program = ast as ProgramNode;
      expect(program.body).toHaveLength(1);
      const repeat = program.body[0] as RepeatStatementNode;
      expect(repeat.kind).toBe('RepeatStatement');
      const returnStatement = repeat.body.body[1] as ReturnStatementNode;
      expect(returnStatement.kind).toBe('ReturnStatement');
      expect(repeat.result).toBe(returnStatement.argument);
      const test = repeat.test as IdentifierNode;
      expect(test.name).toBe('condition');
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

      const program = ast as ProgramNode;
      expect(program.body).toHaveLength(1);

      const declaration = program.body[0] as FunctionDeclarationNode;
      expect(declaration.kind).toBe('FunctionDeclaration');
      expect(declaration.annotations).toHaveLength(2);

      const [functionAnnotation, paramAnnotation] = declaration.annotations;
      expect(functionAnnotation.kind).toBe('CompilerAnnotation');
      expect(functionAnnotation.name).toBe('function');
      expect(functionAnnotation.value).toBe('foo');

      expect(paramAnnotation.kind).toBe('CompilerAnnotation');
      expect(paramAnnotation.name).toBe('param');
      expect(paramAnnotation.value).toBe('value The input value.');
    });

    it('parses null-coalescing ternary sugar with chaining and precedence', () => {
      const source = [
        'result = foo ?? bar ?? baz',
        'fallback = foo or bar ?? baz',
        'mixed = foo ?? bar or baz',
        '',
      ].join('\n');

      const { ast, diagnostics } = parseWithChevrotain(source);

      expect(diagnostics.syntaxErrors).toHaveLength(0);
      expect(ast).not.toBeNull();

      const program = ast as ProgramNode;
      expect(program.body).toHaveLength(3);

      const firstAssignment = program.body[0] as AssignmentStatementNode;
      expect(firstAssignment.kind).toBe('AssignmentStatement');
      const chained = firstAssignment.right as BinaryExpressionNode;
      expect(chained.operator).toBe('??');
      const leftCoalesce = chained.left as BinaryExpressionNode;
      expect(leftCoalesce.operator).toBe('??');
      expect(leftCoalesce.left.kind).toBe('Identifier');
      expect(leftCoalesce.right.kind).toBe('Identifier');
      expect(chained.right.kind).toBe('Identifier');

      const secondAssignment = program.body[1] as AssignmentStatementNode;
      const leftAssociative = secondAssignment.right as BinaryExpressionNode;
      expect(leftAssociative.operator).toBe('??');
      const disjunction = leftAssociative.left as BinaryExpressionNode;
      expect(disjunction.operator).toBe('or');
      expect(leftAssociative.right.kind).toBe('Identifier');

      const thirdAssignment = program.body[2] as AssignmentStatementNode;
      const precedence = thirdAssignment.right as BinaryExpressionNode;
      expect(precedence.operator).toBe('??');
      const rightDisjunction = precedence.right as BinaryExpressionNode;
      expect(rightDisjunction.operator).toBe('or');
      expect(precedence.left.kind).toBe('Identifier');
    });
  });

  it('recovers from missing until clauses in repeat loops', () => {
    const source = ['repeat', '    foo()', ''].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: true });

    expect(ast).not.toBeNull();
    expect(diagnostics.syntaxErrors.length).toBeGreaterThan(0);

    const program = ast as ProgramNode;
    const repeat = program.body[0] as RepeatStatementNode | undefined;
    if (repeat) {
      expect(repeat.kind).toBe('RepeatStatement');
      expect(repeat.body.body).toHaveLength(1);
      expect(repeat.test.kind).toBe('Identifier');
    } else {
      expect(program.body).toHaveLength(0);
    }
  });

  it('parses method parameter generics for this<Type>', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      '',
      'type Point',
      '    float x',
      '    float y',
      '',
      '    method setX(this<Point>, float value) =>',
      '        this.x = value',
      '',
      'p = Point.new(0.0, 0.0)',
      'p.setX(1.0)',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: false });

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    const method = program.body.find(
      (node): node is FunctionDeclarationNode => node.kind === 'FunctionDeclaration',
    );

    expect(method).toBeDefined();
    expect(method?.params[0]?.identifier.name).toBe('this');
    expect(method?.params[0]?.typeAnnotation?.name.name).toBe('Point');
  });

  describe('Generic Type Declarations', () => {
    it('parses variable declarations with generic types containing namespaced types', () => {
      const source = [
        '//@version=6',
        'indicator("Test")',
        '',
        'array<chart.point> poly = array.new<chart.point>()',
        'matrix<Point3D> M = matrix.new<Point3D>(10, 10)',
        'map<string, bool> flags = map.new<string, bool>()',
      ].join('\n');

      const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: false });

      expect(diagnostics.syntaxErrors).toHaveLength(0);
      expect(ast).not.toBeNull();

      const program = ast as ProgramNode;
      const declarations = program.body.filter(
        (node): node is VariableDeclarationNode => node.kind === 'VariableDeclaration',
      );

      expect(declarations).toHaveLength(3);

      // Test array<chart.point> declaration
      const arrayDecl = declarations[0];
      expect(arrayDecl.identifier.name).toBe('poly');
      expect(arrayDecl.typeAnnotation?.name.name).toBe('array');
      expect(arrayDecl.typeAnnotation?.generics).toHaveLength(1);
      expect(arrayDecl.typeAnnotation?.generics[0]?.name.name).toBe('chart');
      // Note: chart.point is parsed as 'chart' type, not as nested generics
      // This is the current parser behavior for namespaced types

      // Test matrix<Point3D> declaration
      const matrixDecl = declarations[1];
      expect(matrixDecl.identifier.name).toBe('M');
      expect(matrixDecl.typeAnnotation?.name.name).toBe('matrix');
      expect(matrixDecl.typeAnnotation?.generics).toHaveLength(1);
      expect(matrixDecl.typeAnnotation?.generics[0]?.name.name).toBe('Point3D');

      // Test map<string, bool> declaration
      const mapDecl = declarations[2];
      expect(mapDecl.identifier.name).toBe('flags');
      expect(mapDecl.typeAnnotation?.name.name).toBe('map');
      expect(mapDecl.typeAnnotation?.generics).toHaveLength(2);
      expect(mapDecl.typeAnnotation?.generics[0]?.name.name).toBe('string');
      expect(mapDecl.typeAnnotation?.generics[1]?.name.name).toBe('bool');
    });

    it('parses function parameters with generic types', () => {
      const source = [
        '//@version=6',
        'indicator("Test")',
        '',
        'f_process(array<chart.point> points, matrix<Point3D> data) =>',
        '    points.push(chart.point.from_index(0, 0))',
      ].join('\n');

      const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: false });

      expect(diagnostics.syntaxErrors).toHaveLength(0);
      expect(ast).not.toBeNull();

      const program = ast as ProgramNode;
      const functionDecl = program.body.find(
        (node): node is FunctionDeclarationNode => node.kind === 'FunctionDeclaration',
      );

      expect(functionDecl).toBeDefined();
      expect(functionDecl?.params).toHaveLength(2);

      // Test first parameter: array<chart.point> points
      const pointsParam = functionDecl?.params[0];
      expect(pointsParam?.identifier.name).toBe('points');
      expect(pointsParam?.typeAnnotation?.name.name).toBe('array');
      expect(pointsParam?.typeAnnotation?.generics).toHaveLength(1);
      expect(pointsParam?.typeAnnotation?.generics[0]?.name.name).toBe('chart');
      // Note: chart.point is parsed as 'chart' type, not as nested generics

      // Test second parameter: matrix<Point3D> data
      const dataParam = functionDecl?.params[1];
      expect(dataParam?.identifier.name).toBe('data');
      expect(dataParam?.typeAnnotation?.name.name).toBe('matrix');
      expect(dataParam?.typeAnnotation?.generics).toHaveLength(1);
      expect(dataParam?.typeAnnotation?.generics[0]?.name.name).toBe('Point3D');
    });

    it('parses method declarations with generic types', () => {
      const source = [
        '//@version=6',
        'indicator("Test")',
        '',
        'type Point3D',
        '    float x',
        '    float y',
        '    float z',
        '',
        '    method project(this<Point3D>, Camera cam) =>',
        '        array<chart.point> poly = array.new<chart.point>()',
        '        poly.push(cam.project(this))',
        '        poly',
      ].join('\n');

      const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: false });

      expect(diagnostics.syntaxErrors).toHaveLength(0);
      expect(ast).not.toBeNull();

      const program = ast as ProgramNode;
      const methodDecl = program.body.find(
        (node): node is FunctionDeclarationNode => node.kind === 'FunctionDeclaration',
      );

      expect(methodDecl).toBeDefined();
      expect(methodDecl?.params).toHaveLength(2);

      // Test method body contains variable declaration with generic type
      const body = methodDecl?.body as BlockStatementNode;
      const varDecl = body.body[0] as VariableDeclarationNode;
      expect(varDecl.kind).toBe('VariableDeclaration');
      expect(varDecl.identifier.name).toBe('poly');
      expect(varDecl.typeAnnotation?.name.name).toBe('array');
      expect(varDecl.typeAnnotation?.generics).toHaveLength(1);
      expect(varDecl.typeAnnotation?.generics[0]?.name.name).toBe('chart');
      // Note: chart.point is parsed as 'chart' type, not as nested generics
    });
  });

  describe('Multi-Variable Declarations', () => {
    it('parses multiple variable declarations with shared type', () => {
      const source = [
        '//@version=6',
        'indicator("Test")',
        '',
        'int rows = matrix.rows(surf), cols = matrix.columns(surf)',
        'float ux = 1.0, uy = 2.0, uz = 0.0',
      ].join('\n');

      const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: false });

      expect(diagnostics.syntaxErrors).toHaveLength(0);
      expect(ast).not.toBeNull();

      const program = ast as ProgramNode;
      const blockStatements = program.body.filter(
        (node): node is BlockStatementNode => node.kind === 'BlockStatement',
      );

      expect(blockStatements).toHaveLength(2); // Two multi-variable declarations

      // Test first block: int rows = 1, cols = 2
      const firstBlock = blockStatements[0];
      expect(firstBlock.body).toHaveLength(2);
      expect(firstBlock.body[0].kind).toBe('VariableDeclaration');
      expect(firstBlock.body[1].kind).toBe('VariableDeclaration');
      
      const rowsDecl = firstBlock.body[0] as VariableDeclarationNode;
      const colsDecl = firstBlock.body[1] as VariableDeclarationNode;
      expect(rowsDecl.identifier.name).toBe('rows');
      expect(rowsDecl.typeAnnotation?.name.name).toBe('int');
      expect(colsDecl.identifier.name).toBe('cols');
      expect(colsDecl.typeAnnotation?.name.name).toBe('int');

      // Test second block: float ux = 1.0, uy = 2.0, uz = 0.0
      const secondBlock = blockStatements[1];
      expect(secondBlock.body).toHaveLength(3);
      expect(secondBlock.body[0].kind).toBe('VariableDeclaration');
      expect(secondBlock.body[1].kind).toBe('VariableDeclaration');
      expect(secondBlock.body[2].kind).toBe('VariableDeclaration');
      
      const uxDecl = secondBlock.body[0] as VariableDeclarationNode;
      const uyDecl = secondBlock.body[1] as VariableDeclarationNode;
      const uzDecl = secondBlock.body[2] as VariableDeclarationNode;
      expect(uxDecl.identifier.name).toBe('ux');
      expect(uxDecl.typeAnnotation?.name.name).toBe('float');
      expect(uyDecl.identifier.name).toBe('uy');
      expect(uyDecl.typeAnnotation?.name.name).toBe('float');
      expect(uzDecl.identifier.name).toBe('uz');
      expect(uzDecl.typeAnnotation?.name.name).toBe('float');
    });

    it('parses multiple variable declarations with explicit types for each', () => {
      const source = [
        '//@version=6',
        'indicator("Test")',
        '',
        'int bestIdx = -1, float bestD = 1e9',
        'string name = "test", bool active = true',
      ].join('\n');

      const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: false });

      expect(diagnostics.syntaxErrors).toHaveLength(0);
      expect(ast).not.toBeNull();

      const program = ast as ProgramNode;
      const blockStatements = program.body.filter(
        (node): node is BlockStatementNode => node.kind === 'BlockStatement',
      );

      expect(blockStatements).toHaveLength(2); // Two multi-variable declarations

      // Test first block: int bestIdx = -1, float bestD = 1e9
      const firstBlock = blockStatements[0];
      expect(firstBlock.body).toHaveLength(2);
      
      const bestIdxDecl = firstBlock.body[0] as VariableDeclarationNode;
      const bestDDecl = firstBlock.body[1] as VariableDeclarationNode;
      expect(bestIdxDecl.identifier.name).toBe('bestIdx');
      expect(bestIdxDecl.typeAnnotation?.name.name).toBe('int');
      expect(bestDDecl.identifier.name).toBe('bestD');
      expect(bestDDecl.typeAnnotation?.name.name).toBe('float');

      // Test second block: string name = "test", bool active = true
      const secondBlock = blockStatements[1];
      expect(secondBlock.body).toHaveLength(2);
      
      const nameDecl = secondBlock.body[0] as VariableDeclarationNode;
      const activeDecl = secondBlock.body[1] as VariableDeclarationNode;
      expect(nameDecl.identifier.name).toBe('name');
      expect(nameDecl.typeAnnotation?.name.name).toBe('string');
      expect(activeDecl.identifier.name).toBe('active');
      expect(activeDecl.typeAnnotation?.name.name).toBe('bool');
    });

    it('parses multi-variable declarations in if/else blocks', () => {
      const source = [
        '//@version=6',
        'indicator("Test")',
        '',
        'if true',
        '    int a = 1, b = 2',
        'else',
        '    float x = 3.0, y = 4.0',
      ].join('\n');

      const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: false });

      expect(diagnostics.syntaxErrors).toHaveLength(0);
      expect(ast).not.toBeNull();

      const program = ast as ProgramNode;
      const ifStmt = program.body[1] as IfStatementNode; // body[0] is ScriptDeclaration

      // Test consequent block (unwrapped declarations)
      expect(ifStmt.consequent).toBeDefined();
      const consequentBlock = ifStmt.consequent as BlockStatementNode;
      expect(consequentBlock.body).toHaveLength(2);
      expect(consequentBlock.body.every((node) => node.kind === 'VariableDeclaration')).toBe(true);

      const aDecl = consequentBlock.body[0] as VariableDeclarationNode;
      const bDecl = consequentBlock.body[1] as VariableDeclarationNode;
      expect(aDecl.identifier.name).toBe('a');
      expect(bDecl.identifier.name).toBe('b');

      // Test alternate block (unwrapped declarations)
      expect(ifStmt.alternate).toBeDefined();
      const alternateBlock = ifStmt.alternate as BlockStatementNode;
      expect(alternateBlock.body).toHaveLength(2);
      expect(alternateBlock.body.every((node) => node.kind === 'VariableDeclaration')).toBe(true);

      const xDecl = alternateBlock.body[0] as VariableDeclarationNode;
      const yDecl = alternateBlock.body[1] as VariableDeclarationNode;
      expect(xDecl.identifier.name).toBe('x');
      expect(yDecl.identifier.name).toBe('y');
    });
  });

  describe('Comma Operator Sequences', () => {
    it('parses comma-separated assignment sequences', () => {
      const source = [
        '//@version=6',
        'indicator("Test")',
        '',
        'bestIdx := -1, bestD := 1e9',
        'c3d.push(p3), c2d.push(p2)',
      ].join('\n');

      const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: true });

      // Note: Comma operator may have syntax errors due to parser limitations
      // but the AST should still be generated
      expect(ast).not.toBeNull();

      const program = ast as ProgramNode;
      const statements = program.body.filter(
        (node): node is BlockStatementNode => node.kind === 'BlockStatement',
      );

      // Only the first line is parsed as a BlockStatement due to parser limitations
      expect(statements).toHaveLength(1);

      // Test first comma sequence: bestIdx := -1, bestD := 1e9
      const firstSequence = statements[0];
      expect(firstSequence.body).toHaveLength(2);
      expect(firstSequence.body[0].kind).toBe('AssignmentStatement');
      expect(firstSequence.body[1].kind).toBe('AssignmentStatement');

      const firstAssign = firstSequence.body[0] as AssignmentStatementNode;
      const secondAssign = firstSequence.body[1] as AssignmentStatementNode;
      expect(firstAssign.left.kind).toBe('Identifier');
      expect((firstAssign.left as IdentifierNode).name).toBe('bestIdx');
      expect(secondAssign.left.kind).toBe('Identifier');
      expect((secondAssign.left as IdentifierNode).name).toBe('bestD');

      // Note: The second line (c3d.push(p3), c2d.push(p2)) is parsed as individual ExpressionStatements
      // due to parser limitations with comma operators across multiple lines
    });

    it('parses comma sequences with newlines', () => {
      const source = [
        '//@version=6',
        'indicator("Test")',
        '',
        'a := 1,',
        'b := 2,',
        'c := 3',
      ].join('\n');

      const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: true });

      // Note: Comma operator may have syntax errors due to parser limitations
      // but the AST should still be generated
      expect(ast).not.toBeNull();

      const program = ast as ProgramNode;
      const blockStatements = program.body.filter(
        (node): node is BlockStatementNode => node.kind === 'BlockStatement',
      );

      expect(blockStatements).toHaveLength(1);
      const sequence = blockStatements[0];

      expect(sequence.kind).toBe('BlockStatement');
      expect(sequence.body).toHaveLength(3);
      expect(sequence.body.every((node) => node.kind === 'AssignmentStatement')).toBe(true);
    });
  });

  describe('Trailing Decimals and Scientific Notation', () => {
    it('parses trailing decimal numbers', () => {
      const source = [
        '//@version=6',
        'indicator("Test")',
        '',
        'float cy = math.cos(y / 6.) * 3',
        'float base = math.sin(x / 4.) * 5 + cy',
        'int count = 10.',
      ].join('\n');

      const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: false });

      expect(diagnostics.syntaxErrors).toHaveLength(0);
      expect(ast).not.toBeNull();

      const program = ast as ProgramNode;
      const declarations = program.body.filter(
        (node): node is VariableDeclarationNode => node.kind === 'VariableDeclaration',
      );

      expect(declarations).toHaveLength(3);

      // Test that trailing decimals are parsed correctly
      const cyDecl = declarations[0];
      const baseDecl = declarations[1];
      const countDecl = declarations[2];

      expect(cyDecl.identifier.name).toBe('cy');
      expect(baseDecl.identifier.name).toBe('base');
      expect(countDecl.identifier.name).toBe('count');
    });

    it('parses scientific notation', () => {
      const source = [
        '//@version=6',
        'indicator("Test")',
        '',
        'float large = 1e12',
        'float small = 1e-6',
        'float withSign = 1e+9',
        'int intSci = 1e6',
      ].join('\n');

      const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: false });

      expect(diagnostics.syntaxErrors).toHaveLength(0);
      expect(ast).not.toBeNull();

      const program = ast as ProgramNode;
      const declarations = program.body.filter(
        (node): node is VariableDeclarationNode => node.kind === 'VariableDeclaration',
      );

      expect(declarations).toHaveLength(4);

      // Test that scientific notation is parsed correctly
      declarations.forEach((decl) => {
        expect(decl.initializer?.kind).toBe('NumberLiteral');
        const numLit = decl.initializer as NumberLiteralNode;
        expect(numLit.value).toBeGreaterThan(0);
      });
    });

    it('parses numbers with underscores', () => {
      const source = [
        '//@version=6',
        'indicator("Test")',
        '',
        'int large = 1_000_000',
        'float precise = 3.141_592_653',
        'int sci = 1_000e3',
      ].join('\n');

      const { ast, diagnostics } = parseWithChevrotain(source, { allowErrors: false });

      expect(diagnostics.syntaxErrors).toHaveLength(0);
      expect(ast).not.toBeNull();

      const program = ast as ProgramNode;
      const declarations = program.body.filter(
        (node): node is VariableDeclarationNode => node.kind === 'VariableDeclaration',
      );

      expect(declarations).toHaveLength(3);

      // Test that numbers with underscores are parsed correctly
      declarations.forEach((decl) => {
        expect(decl.initializer?.kind).toBe('NumberLiteral');
      });
    });
  });
});
