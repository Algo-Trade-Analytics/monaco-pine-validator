import { describe, expect, it } from 'vitest';
import {
  type ArgumentNode,
  type BlockStatementNode,
  type CallExpressionNode,
  type ConditionalExpressionNode,
  type ExpressionStatementNode,
  type ForStatementNode,
  type FunctionDeclarationNode,
  type NumberLiteralNode,
  type ParameterNode,
  type ProgramNode,
  type ReturnStatementNode,
  type ScriptDeclarationNode,
  type StringLiteralNode,
  type IfStatementNode,
  type WhileStatementNode,
  type VariableDeclarationNode,
  createLocation,
  createPosition,
  createRange,
} from '../../core/ast/nodes';
import {
  createPath,
  findAncestor,
  visit,
  visitChildren,
  type NodePath,
} from '../../core/ast/traversal';

function span(start: number, end: number, lineStart = 1, lineEnd = lineStart) {
  return {
    loc: createLocation(
      createPosition(lineStart, start + 1, start),
      createPosition(lineEnd, end + 1, end),
    ),
    range: createRange(start, end),
  };
}

function createIdentifier(name: string, start: number, line = 1) {
  const end = start + name.length;
  return {
    kind: 'Identifier' as const,
    name,
    ...span(start, end, line),
  };
}

function createStringLiteral(value: string, raw: string, start: number, line = 1): StringLiteralNode {
  const end = start + raw.length;
  return {
    kind: 'StringLiteral',
    value,
    raw,
    ...span(start, end, line),
  };
}

function createNumberLiteral(value: number, raw: string, start: number, line = 1): NumberLiteralNode {
  const end = start + raw.length;
  return {
    kind: 'NumberLiteral',
    value,
    raw,
    ...span(start, end, line),
  };
}

function createArgument(name: string | null, value: StringLiteralNode | NumberLiteralNode, start: number, end: number, line = 1): ArgumentNode {
  return {
    kind: 'Argument',
    name: name ? createIdentifier(name, start, line) : null,
    value,
    ...span(start, end, line),
  };
}

function createParameter(name: string, start: number, line = 1): ParameterNode {
  const identifier = createIdentifier(name, start, line);
  return {
    kind: 'Parameter',
    identifier,
    typeAnnotation: null,
    defaultValue: null,
    ...span(identifier.range[0], identifier.range[1], line),
  };
}

function createReturn(argumentName: string, start: number, end: number, line = 1): ReturnStatementNode {
  return {
    kind: 'ReturnStatement',
    argument: createIdentifier(argumentName, start, line + 1),
    ...span(start, end, line),
  };
}

function createCallExpression(start: number, end: number, line = 1): CallExpressionNode {
  const callee = createIdentifier('foo', start, line);
  const literal = createNumberLiteral(1, '1', end - 1, line);
  const argument = createArgument(null, literal, end - 1, end, line);
  return {
    kind: 'CallExpression',
    callee,
    args: [argument],
    ...span(start, end, line),
  };
}

function createFunctionDeclaration(start: number, end: number, line = 1): FunctionDeclarationNode {
  const identifier = createIdentifier('foo', start, line);
  const parameter = createParameter('x', start + 4, line);
  const returnStatement = createReturn('x', start + 10, end - 5, line + 1);
  const body: BlockStatementNode = {
    kind: 'BlockStatement',
    body: [returnStatement],
    ...span(returnStatement.range[0] - 2, returnStatement.range[1] + 2, line + 1, line + 2),
  };
  return {
    kind: 'FunctionDeclaration',
    identifier,
    params: [parameter],
    body,
    export: false,
    ...span(start, end, line, line + 2),
  };
}

function createScriptDeclaration(start: number, end: number, line = 1): ScriptDeclarationNode {
  const identifier = createIdentifier('example', start + 9, line);
  const argumentValue = createStringLiteral('Example', '"Example"', start + 18, line);
  const argument = createArgument('title', argumentValue, start + 18, start + 28, line);
  return {
    kind: 'ScriptDeclaration',
    scriptType: 'indicator',
    identifier,
    arguments: [argument],
    ...span(start, end, line),
  };
}

function createProgram(): ProgramNode {
  const directive = {
    kind: 'VersionDirective' as const,
    version: 6,
    ...span(0, 12, 1),
  };
  const scriptDeclaration = createScriptDeclaration(13, 45, 2);
  const functionDeclaration = createFunctionDeclaration(46, 90, 3);
  const callExpression = createCallExpression(91, 110, 6);
  const expressionStatement: ExpressionStatementNode = {
    kind: 'ExpressionStatement',
    expression: callExpression,
    ...span(91, 110, 6),
  };

  return {
    kind: 'Program',
    directives: [directive],
    body: [scriptDeclaration, functionDeclaration, expressionStatement],
    ...span(0, 110, 1, 6),
  };
}

describe('core AST nodes traversal', () => {
  it('performs a pre-order traversal across the tree', () => {
    const program = createProgram();
    const visited: string[] = [];

    visit(program, {
      Program: { enter: () => visited.push('Program') },
      VersionDirective: { enter: () => visited.push('VersionDirective') },
      ScriptDeclaration: { enter: () => visited.push('ScriptDeclaration') },
      FunctionDeclaration: { enter: () => visited.push('FunctionDeclaration') },
      Parameter: { enter: () => visited.push('Parameter') },
      BlockStatement: { enter: () => visited.push('BlockStatement') },
      ReturnStatement: { enter: () => visited.push('ReturnStatement') },
      ExpressionStatement: { enter: () => visited.push('ExpressionStatement') },
      CallExpression: { enter: () => visited.push('CallExpression') },
      Argument: {
        enter: (path) => {
          visited.push(path.node.name ? `Argument:${path.node.name.name}` : 'Argument');
        },
      },
      Identifier: { enter: (path) => visited.push(`Identifier:${path.node.name}`) },
      StringLiteral: { enter: (path) => visited.push(`String:${path.node.value}`) },
      NumberLiteral: { enter: (path) => visited.push(`Number:${path.node.value}`) },
    });

    expect(visited).toEqual([
      'Program',
      'VersionDirective',
      'ScriptDeclaration',
      'Identifier:example',
      'Argument:title',
      'Identifier:title',
      'String:Example',
      'FunctionDeclaration',
      'Identifier:foo',
      'Parameter',
      'Identifier:x',
      'BlockStatement',
      'ReturnStatement',
      'Identifier:x',
      'ExpressionStatement',
      'CallExpression',
      'Identifier:foo',
      'Argument',
      'Number:1',
    ]);
  });

  it('allows visitors to skip child traversal', () => {
    const program = createProgram();
    const visited: string[] = [];

    visit(program, {
      BlockStatement: { enter: () => 'skip' },
      ReturnStatement: { enter: () => visited.push('ReturnStatement') },
    });

    expect(visited).toEqual([]);
  });

  it('finds the nearest ancestor that matches the predicate', () => {
    const program = createProgram();
    let assertionCount = 0;

    visit(program, {
      Identifier: {
        enter: (path) => {
          if (path.parent?.node.kind === 'ReturnStatement') {
            const fnAncestor = findAncestor(path, (ancestor): ancestor is NodePath<FunctionDeclarationNode> => {
              return ancestor.node.kind === 'FunctionDeclaration';
            });
            expect(fnAncestor).not.toBeNull();
            expect(fnAncestor?.node.identifier?.name).toBe('foo');
            assertionCount += 1;
          }
        },
      },
    });

    expect(assertionCount).toBe(1);
  });

  it('iterates direct children in declaration order', () => {
    const program = createProgram();
    let fnPath: NodePath | null = null;

    visit(program, {
      FunctionDeclaration: {
        enter: (path) => {
          if (!fnPath) {
            fnPath = path;
          }
        },
      },
    });

    expect(fnPath).not.toBeNull();

    const childKinds: string[] = [];
    const childKeys: Array<string | null> = [];
    const childIndexes: Array<number | null> = [];

    visitChildren(fnPath!, (child) => {
      childKinds.push(child.node.kind);
      childKeys.push(child.key);
      childIndexes.push(child.index);
    });

    expect(childKinds).toEqual(['Identifier', 'Parameter', 'BlockStatement']);
    expect(childKeys).toEqual(['identifier', 'params', 'body']);
    expect(childIndexes).toEqual([null, 0, null]);
  });

  it('walks control flow statements and conditional expressions', () => {
    const conditional: ConditionalExpressionNode = {
      kind: 'ConditionalExpression',
      test: createIdentifier('flag', 70),
      consequent: createIdentifier('foo', 76),
      alternate: createIdentifier('bar', 80),
      ...span(70, 83),
    };

    const ifBlock: BlockStatementNode = {
      kind: 'BlockStatement',
      body: [
        {
          kind: 'ExpressionStatement',
          expression: conditional,
          ...span(68, 84),
        } satisfies ExpressionStatementNode,
      ],
      ...span(65, 90),
    };

    const ifStatement: IfStatementNode = {
      kind: 'IfStatement',
      test: createIdentifier('ifCond', 60),
      consequent: ifBlock,
      alternate: null,
      ...span(60, 90),
    };

    const whileBody: BlockStatementNode = {
      kind: 'BlockStatement',
      body: [
        {
          kind: 'VariableDeclaration',
          declarationKind: 'var',
          identifier: createIdentifier('loopResult', 102),
          typeAnnotation: null,
          initializer: createIdentifier('loopGuard', 110),
          ...span(100, 112),
        } satisfies VariableDeclarationNode,
      ],
      ...span(98, 120),
    };

    const whileStatement: WhileStatementNode = {
      kind: 'WhileStatement',
      test: createIdentifier('loopGuard', 96),
      body: whileBody,
      ...span(95, 120),
    };

    const forInitializer: VariableDeclarationNode = {
      kind: 'VariableDeclaration',
      declarationKind: 'var',
      identifier: createIdentifier('idx', 132),
      typeAnnotation: null,
      initializer: createNumberLiteral(0, '0', 136),
      ...span(132, 138),
    };

    const forBody: BlockStatementNode = {
      kind: 'BlockStatement',
      body: [
        {
          kind: 'ExpressionStatement',
          expression: createIdentifier('idx', 150),
          ...span(148, 152),
        } satisfies ExpressionStatementNode,
      ],
      ...span(145, 160),
    };

    const forStatement: ForStatementNode = {
      kind: 'ForStatement',
      initializer: forInitializer,
      test: createIdentifier('hasNext', 140),
      update: createIdentifier('idx', 142),
      body: forBody,
      ...span(130, 160),
    };

    const program: ProgramNode = {
      kind: 'Program',
      directives: [],
      body: [ifStatement, whileStatement, forStatement],
      ...span(50, 160),
    };

    const visited: string[] = [];

    visit(program, {
      IfStatement: { enter: () => visited.push('IfStatement') },
      ConditionalExpression: { enter: () => visited.push('ConditionalExpression') },
      WhileStatement: { enter: () => visited.push('WhileStatement') },
      ForStatement: { enter: () => visited.push('ForStatement') },
      VariableDeclaration: { enter: (path) => visited.push(`Var:${path.node.identifier.name}`) },
      Identifier: { enter: (path) => visited.push(`Identifier:${path.node.name}`) },
    });

    expect(visited).toEqual([
      'IfStatement',
      'Identifier:ifCond',
      'ConditionalExpression',
      'Identifier:flag',
      'Identifier:foo',
      'Identifier:bar',
      'WhileStatement',
      'Identifier:loopGuard',
      'Var:loopResult',
      'Identifier:loopResult',
      'Identifier:loopGuard',
      'ForStatement',
      'Var:idx',
      'Identifier:idx',
      'Identifier:hasNext',
      'Identifier:idx',
      'Identifier:idx',
    ]);

    const forPath = createPath(forStatement, null, 'body', 2);
    const forChildKeys: Array<string | null> = [];
    visitChildren(forPath, (child) => {
      forChildKeys.push(child.key);
    });
    expect(forChildKeys).toEqual(['initializer', 'test', 'update', 'body']);
  });
});
