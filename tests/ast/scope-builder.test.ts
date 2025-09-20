import { describe, expect, it } from 'vitest';
import { buildScopeGraph } from '../../core/ast/scope';
import {
  type ArgumentNode,
  type BlockStatementNode,
  type CallExpressionNode,
  type ExpressionStatementNode,
  type FunctionDeclarationNode,
  type IdentifierNode,
  type NumberLiteralNode,
  type ParameterNode,
  type ProgramNode,
  type ReturnStatementNode,
  type VariableDeclarationNode,
  createLocation,
  createPosition,
  createRange,
} from '../../core/ast/nodes';

function locFrom(start: number, end: number) {
  return createLocation(createPosition(1, start + 1, start), createPosition(1, end + 1, end));
}

function identifier(name: string, start: number): IdentifierNode {
  const end = start + name.length;
  return {
    kind: 'Identifier',
    name,
    loc: locFrom(start, end),
    range: createRange(start, end),
  };
}

function numberLiteral(value: number, start: number): NumberLiteralNode {
  const raw = value.toString();
  const end = start + raw.length;
  return {
    kind: 'NumberLiteral',
    value,
    raw,
    loc: locFrom(start, end),
    range: createRange(start, end),
  };
}

describe('buildScopeGraph', () => {
  it('constructs scopes and symbol table entries from a program', () => {
    const fooIdentifier = identifier('foo', 10);
    const fooInitializer = numberLiteral(42, 15);
    const globalVariable: VariableDeclarationNode = {
      kind: 'VariableDeclaration',
      declarationKind: 'var',
      identifier: fooIdentifier,
      typeAnnotation: null,
      initializer: fooInitializer,
      loc: locFrom(10, 17),
      range: createRange(10, 17),
    };

    const parameterIdentifier = identifier('x', 35);
    const parameter: ParameterNode = {
      kind: 'Parameter',
      identifier: parameterIdentifier,
      typeAnnotation: null,
      defaultValue: null,
      loc: locFrom(35, 36),
      range: createRange(35, 36),
    };

    const block: BlockStatementNode = {
      kind: 'BlockStatement',
      body: [],
      loc: locFrom(40, 70),
      range: createRange(40, 70),
    };

    const innerVariable: VariableDeclarationNode = {
      kind: 'VariableDeclaration',
      declarationKind: 'var',
      identifier: identifier('y', 45),
      typeAnnotation: null,
      initializer: identifier('foo', 50),
      loc: locFrom(45, 53),
      range: createRange(45, 53),
    };

    const returnStatement: ReturnStatementNode = {
      kind: 'ReturnStatement',
      argument: identifier('x', 60),
      loc: locFrom(58, 61),
      range: createRange(58, 61),
    };

    block.body = [innerVariable, returnStatement];

    const functionDeclaration: FunctionDeclarationNode = {
      kind: 'FunctionDeclaration',
      identifier: identifier('compute', 30),
      params: [parameter],
      body: block,
      export: false,
      loc: locFrom(30, 70),
      range: createRange(30, 70),
    };

    const callArgument: ArgumentNode = {
      kind: 'Argument',
      name: null,
      value: identifier('foo', 88),
      loc: locFrom(87, 91),
      range: createRange(87, 91),
    };

    const callExpression: CallExpressionNode = {
      kind: 'CallExpression',
      callee: identifier('compute', 80),
      args: [callArgument],
      loc: locFrom(80, 91),
      range: createRange(80, 91),
    };

    const callStatement: ExpressionStatementNode = {
      kind: 'ExpressionStatement',
      expression: callExpression,
      loc: locFrom(80, 91),
      range: createRange(80, 91),
    };

    const program: ProgramNode = {
      kind: 'Program',
      directives: [],
      body: [globalVariable, functionDeclaration, callStatement],
      loc: createLocation(createPosition(1, 1, 0), createPosition(6, 1, 100)),
      range: createRange(0, 100),
    };

    const { scopeGraph, symbolTable } = buildScopeGraph(program);

    expect(scopeGraph.root).toBe('scope-0');
    const rootScope = scopeGraph.root ? scopeGraph.nodes.get(scopeGraph.root) : null;
    expect(rootScope).not.toBeNull();
    expect(rootScope?.kind).toBe('module');
    expect(Array.from(rootScope?.symbols ?? [])).toEqual(expect.arrayContaining(['foo', 'compute']));
    expect(rootScope?.children.size).toBe(1);

    const functionScopeId = rootScope ? Array.from(rootScope.children)[0] : null;
    expect(functionScopeId).toBeDefined();
    const functionScope = functionScopeId ? scopeGraph.nodes.get(functionScopeId) : null;
    expect(functionScope?.kind).toBe('function');
    expect(Array.from(functionScope?.symbols ?? [])).toEqual(expect.arrayContaining(['x', 'y']));

    const fooRecord = symbolTable.get('foo');
    expect(fooRecord?.kind).toBe('variable');
    expect(fooRecord?.declarations).toHaveLength(1);
    expect(fooRecord?.references).toHaveLength(2);

    const computeRecord = symbolTable.get('compute');
    expect(computeRecord?.kind).toBe('function');
    expect(computeRecord?.declarations).toHaveLength(1);
    expect(computeRecord?.references).toHaveLength(1);

    const parameterRecord = symbolTable.get('x');
    expect(parameterRecord?.kind).toBe('parameter');
    expect(parameterRecord?.declarations).toHaveLength(1);
    expect(parameterRecord?.references).toHaveLength(1);

    const innerVariableRecord = symbolTable.get('y');
    expect(innerVariableRecord?.kind).toBe('variable');
    expect(innerVariableRecord?.declarations).toHaveLength(1);
    expect(innerVariableRecord?.references).toHaveLength(0);
  });

  it('returns empty structures when the program is null', () => {
    const { scopeGraph, symbolTable } = buildScopeGraph(null);
    expect(scopeGraph.root).toBeNull();
    expect(scopeGraph.nodes.size).toBe(0);
    expect(symbolTable.size).toBe(0);
  });
});
