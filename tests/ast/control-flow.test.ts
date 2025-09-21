import { describe, expect, it } from 'vitest';
import { buildControlFlowGraph } from '../../core/ast/control-flow';
import { createLocation, createPosition, createRange, type ProgramNode } from '../../core/ast/nodes';
import {
  createIndicatorScriptFixture,
  createControlFlowFixture,
  createReturn,
  createSwitchMatrixFixture,
} from './fixtures';

describe('buildControlFlowGraph', () => {
  it('connects sequential statements in order', () => {
    const program = createIndicatorScriptFixture();
    const graph = buildControlFlowGraph(program);

    expect(graph.entry).not.toBeNull();
    expect(graph.exit).not.toBeNull();

    const nodes = Array.from(graph.nodes.values());
    const scriptNode = nodes.find((node) => node.astNode?.kind === 'ScriptDeclaration');
    const functionNode = nodes.find((node) => node.astNode?.kind === 'FunctionDeclaration');
    const expressionNode = nodes.find((node) => node.astNode?.kind === 'ExpressionStatement');
    const exitNode = graph.exit ? graph.nodes.get(graph.exit) : null;

    expect(scriptNode).toBeDefined();
    expect(functionNode).toBeDefined();
    expect(expressionNode).toBeDefined();
    expect(exitNode).toBeDefined();

    expect(scriptNode?.successors.map((edge) => edge.target)).toContain(functionNode?.id);
    expect(functionNode?.successors.map((edge) => edge.target)).toContain(expressionNode?.id);
    expect(expressionNode?.successors.map((edge) => edge.target)).toContain(exitNode?.id);
  });

  it('models branches and loops with merge and back edges', () => {
    const program = createControlFlowFixture();
    const graph = buildControlFlowGraph(program);

    const nodes = Array.from(graph.nodes.values());
    const ifNode = nodes.find((node) => node.astNode?.kind === 'IfStatement');
    const whileNode = nodes.find((node) => node.astNode?.kind === 'WhileStatement');
    const forNode = nodes.find((node) => node.astNode?.kind === 'ForStatement');

    expect(ifNode?.kind).toBe('branch');
    const trueEdge = ifNode?.successors.find((edge) => edge.kind === 'true');
    const falseEdge = ifNode?.successors.find((edge) => edge.kind === 'false');
    expect(trueEdge).toBeDefined();
    expect(falseEdge).toBeDefined();
    if (falseEdge) {
      const mergeNode = graph.nodes.get(falseEdge.target);
      expect(mergeNode?.kind).toBe('merge');
    }

    expect(whileNode?.kind).toBe('branch');
    const whileFalse = whileNode?.successors.find((edge) => edge.kind === 'false');
    expect(whileFalse).toBeDefined();
    if (whileFalse) {
      const whileExit = graph.nodes.get(whileFalse.target);
      expect(whileExit?.metadata?.role).toBe('loop-exit');
    }
    const hasWhileBackEdge = nodes.some((node) =>
      node.successors.some((edge) => edge.kind === 'loop' && edge.target === whileNode?.id),
    );
    expect(hasWhileBackEdge).toBe(true);

    expect(forNode?.kind).toBe('branch');
    const hasForBackEdge = nodes.some((node) =>
      node.successors.some((edge) => edge.kind === 'loop' && edge.target === forNode?.id),
    );
    expect(hasForBackEdge).toBe(true);
  });

  it('connects return statements directly to the exit node', () => {
    const returnStatement = createReturn(null, 0, 6, 1);
    const program: ProgramNode = {
      kind: 'Program',
      directives: [],
      body: [returnStatement],
      loc: createLocation(createPosition(1, 1, 0), createPosition(1, 7, 6)),
      range: createRange(0, 6),
    };

    const graph = buildControlFlowGraph(program);
    const returnNode = Array.from(graph.nodes.values()).find((node) => node.astNode?.kind === 'ReturnStatement');

    expect(returnNode?.kind).toBe('terminator');
    const exitEdge = returnNode?.successors.find((edge) => edge.kind === 'return');
    expect(exitEdge?.target).toBe(graph.exit);
  });

  it('models switch statements with case edges and an exit merge', () => {
    const program = createSwitchMatrixFixture();
    const graph = buildControlFlowGraph(program);

    const switchNode = Array.from(graph.nodes.values()).find((node) => node.astNode?.kind === 'SwitchStatement');
    expect(switchNode?.kind).toBe('branch');

    const caseEdges = switchNode?.successors.filter((edge) => edge.kind === 'case') ?? [];
    expect(caseEdges).toHaveLength(3);

    const exitNode = Array.from(graph.nodes.values()).find(
      (node) => node.metadata?.role === 'switch-exit' && node.kind === 'merge',
    );
    expect(exitNode).toBeDefined();

    const exitPredecessors = Array.from(exitNode?.predecessors ?? []);
    expect(exitPredecessors.length).toBeGreaterThan(0);
  });
});
