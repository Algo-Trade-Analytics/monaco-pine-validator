import { describe, expect, it } from 'vitest';
import { buildScopeGraph } from '../../core/ast/scope';
import { createNamespaceAccessFixture, createSwitchMatrixFixture } from './fixtures';
import {
  type ArgumentNode,
  type BlockStatementNode,
  type CallExpressionNode,
  type ArrowFunctionExpressionNode,
  type ConditionalExpressionNode,
  type ExpressionStatementNode,
  type ForStatementNode,
  type FunctionDeclarationNode,
  type IdentifierNode,
  type IfStatementNode,
  type NumberLiteralNode,
  type ParameterNode,
  type ProgramNode,
  type ReturnStatementNode,
  type VariableDeclarationNode,
  type WhileStatementNode,
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
      annotations: [],
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
      annotations: [],
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
      returnType: null,
      annotations: [],
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

  it('records references for member expressions', () => {
    const program = createNamespaceAccessFixture();
    const { symbolTable } = buildScopeGraph(program);

    const timeframeRecord = symbolTable.get('timeframe');
    expect(timeframeRecord).toBeDefined();
    expect(timeframeRecord?.references).toHaveLength(2);

    const periodRecord = symbolTable.get('period');
    expect(periodRecord?.references).toHaveLength(1);

    const isDailyRecord = symbolTable.get('isdaily');
    expect(isDailyRecord?.references).toHaveLength(1);
  });

  it('captures scope metadata for control-flow constructs', () => {
    const conditionalExpression: ConditionalExpressionNode = {
      kind: 'ConditionalExpression',
      test: identifier('flag', 120),
      consequent: identifier('foo', 125),
      alternate: identifier('bar', 130),
      loc: locFrom(120, 131),
      range: createRange(120, 131),
    };

    const ifBlock: BlockStatementNode = {
      kind: 'BlockStatement',
      body: [],
      loc: locFrom(110, 150),
      range: createRange(110, 150),
    };

    ifBlock.body = [
      {
        kind: 'ExpressionStatement',
        expression: conditionalExpression,
        loc: locFrom(112, 140),
        range: createRange(112, 140),
      } satisfies ExpressionStatementNode,
    ];

    const ifStatement: IfStatementNode = {
      kind: 'IfStatement',
      test: identifier('ifCond', 100),
      consequent: ifBlock,
      alternate: null,
      loc: locFrom(100, 150),
      range: createRange(100, 150),
    };

    const whileBody: BlockStatementNode = {
      kind: 'BlockStatement',
      body: [],
      loc: locFrom(160, 190),
      range: createRange(160, 190),
    };

    const loopVariable: VariableDeclarationNode = {
      kind: 'VariableDeclaration',
      declarationKind: 'var',
      identifier: identifier('loopResult', 165),
      typeAnnotation: null,
      initializer: identifier('loopGuard', 170),
      annotations: [],
      loc: locFrom(165, 175),
      range: createRange(165, 175),
    };
    whileBody.body = [loopVariable];

    const whileStatement: WhileStatementNode = {
      kind: 'WhileStatement',
      test: identifier('loopGuard', 160),
      body: whileBody,
      result: null,
      resultBinding: null,
      loc: locFrom(160, 190),
      range: createRange(160, 190),
    };

    const forBody: BlockStatementNode = {
      kind: 'BlockStatement',
      body: [],
      loc: locFrom(200, 240),
      range: createRange(200, 240),
    };

    const loopIndex = identifier('idx', 205);
    const forInitializer: VariableDeclarationNode = {
      kind: 'VariableDeclaration',
      declarationKind: 'var',
      identifier: loopIndex,
      typeAnnotation: null,
      initializer: numberLiteral(0, 210),
      annotations: [],
      loc: locFrom(205, 215),
      range: createRange(205, 215),
    };

    const forExpression: ExpressionStatementNode = {
      kind: 'ExpressionStatement',
      expression: identifier('idx', 225),
      loc: locFrom(220, 226),
      range: createRange(220, 226),
    };
    forBody.body = [forExpression];

    const forStatement: ForStatementNode = {
      kind: 'ForStatement',
      initializer: forInitializer,
      iterator: null,
      iterable: null,
      test: identifier('hasNext', 216),
      update: identifier('idx', 218),
      body: forBody,
      result: null,
      resultBinding: null,
      loc: locFrom(200, 240),
      range: createRange(200, 240),
    };

    const program: ProgramNode = {
      kind: 'Program',
      directives: [],
      body: [ifStatement, whileStatement, forStatement],
      loc: createLocation(createPosition(1, 1, 0), createPosition(1, 1, 250)),
      range: createRange(0, 250),
    };

    const { scopeGraph, symbolTable } = buildScopeGraph(program);

    const loopScopes = Array.from(scopeGraph.nodes.values()).filter((scope) => scope.kind === 'loop');
    expect(loopScopes).toHaveLength(2);
    expect(loopScopes.some((scope) => scope.metadata?.loopType === 'while')).toBe(true);
    expect(loopScopes.some((scope) => scope.metadata?.loopType === 'for')).toBe(true);

    const idxRecord = symbolTable.get('idx');
    expect(idxRecord?.kind).toBe('variable');
    expect(idxRecord?.declarations).toHaveLength(1);
    expect(idxRecord?.references).toHaveLength(2);

    const conditionRecord = symbolTable.get('ifCond');
    expect(conditionRecord?.references).toHaveLength(1);

    const flagRecord = symbolTable.get('flag');
    expect(flagRecord?.references).toHaveLength(1);

    const loopGuardRecord = symbolTable.get('loopGuard');
    expect(loopGuardRecord?.references).toHaveLength(2);

    const hasNextRecord = symbolTable.get('hasNext');
    expect(hasNextRecord?.references).toHaveLength(1);
  });

  it('collects references inside switch statements and index expressions', () => {
    const program = createSwitchMatrixFixture();
    const { symbolTable } = buildScopeGraph(program);

    const directionRecord = symbolTable.get('direction');
    expect(directionRecord?.references).toHaveLength(1);

    const closeRecord = symbolTable.get('close');
    expect(closeRecord?.references).toHaveLength(2);

    const signalRecord = symbolTable.get('signal');
    expect(signalRecord?.references).toHaveLength(3);
  });

  it('creates function scopes for arrow function expressions', () => {
    const paramIdentifier = identifier('value', 20);
    const parameter: ParameterNode = {
      kind: 'Parameter',
      identifier: paramIdentifier,
      typeAnnotation: null,
      defaultValue: null,
      loc: locFrom(20, 25),
      range: createRange(20, 25),
    };

    const returnStatement: ReturnStatementNode = {
      kind: 'ReturnStatement',
      argument: identifier('value', 40),
      loc: locFrom(38, 45),
      range: createRange(38, 45),
    };

    const arrowBody: BlockStatementNode = {
      kind: 'BlockStatement',
      body: [returnStatement],
      loc: locFrom(30, 50),
      range: createRange(30, 50),
    };

    const arrowExpression: ArrowFunctionExpressionNode = {
      kind: 'ArrowFunctionExpression',
      params: [parameter],
      body: arrowBody,
      loc: locFrom(15, 50),
      range: createRange(15, 50),
    };

    const declaration: VariableDeclarationNode = {
      kind: 'VariableDeclaration',
      declarationKind: 'var',
      identifier: identifier('handler', 5),
      typeAnnotation: null,
      initializer: arrowExpression,
      annotations: [],
      loc: locFrom(5, 50),
      range: createRange(5, 50),
    };

    const program: ProgramNode = {
      kind: 'Program',
      directives: [],
      body: [declaration],
      loc: createLocation(createPosition(1, 1, 0), createPosition(1, 60, 59)),
      range: createRange(0, 59),
    };

    const { scopeGraph } = buildScopeGraph(program);

    expect(scopeGraph.root).toBeDefined();
    const rootScope = scopeGraph.root ? scopeGraph.nodes.get(scopeGraph.root) : null;
    expect(rootScope?.symbols.has('handler')).toBe(true);
    const childScopes = rootScope ? Array.from(rootScope.children) : [];
    expect(childScopes).toHaveLength(1);
    const arrowScope = childScopes[0] ? scopeGraph.nodes.get(childScopes[0]) : null;
    expect(arrowScope?.kind).toBe('function');
    expect(Array.from(arrowScope?.symbols ?? [])).toContain('value');
  });
});
