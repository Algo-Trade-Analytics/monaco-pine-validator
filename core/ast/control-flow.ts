import {
  type ControlFlowEdgeKind,
  type ControlFlowGraph,
  type ControlFlowNodeKind,
  createEmptyControlFlowGraph,
} from './types';
import {
  type BlockStatementNode,
  type ExpressionNode,
  type ForStatementNode,
  type IfStatementNode,
  type ProgramNode,
  type StatementNode,
  type WhileStatementNode,
} from './nodes';

interface GraphSegment {
  entry: string;
  exits: string[];
}

interface LoopContext {
  continueTarget: string;
  breakTarget: string;
}

export function buildControlFlowGraph(program: ProgramNode | null): ControlFlowGraph {
  const graph = createEmptyControlFlowGraph();

  if (!program) {
    return graph;
  }

  const nodes = graph.nodes;
  let nodeCounter = 0;
  const terminalNodes = new Set<string>();
  const loopStack: LoopContext[] = [];

  const createNode = (
    kind: ControlFlowNodeKind,
    astNode: StatementNode | ExpressionNode | ProgramNode | null,
    metadata?: Record<string, unknown>,
  ): string => {
    const id = `cf-${nodeCounter++}`;
    nodes.set(id, {
      id,
      kind,
      astNode: astNode ?? null,
      predecessors: new Set<string>(),
      successors: [],
      metadata: metadata ? { ...metadata } : undefined,
    });
    return id;
  };

  const connect = (fromId: string, toId: string, kind: ControlFlowEdgeKind = 'normal'): void => {
    const from = nodes.get(fromId);
    const to = nodes.get(toId);
    if (!from || !to) {
      return;
    }

    if (!from.successors.some((edge) => edge.target === toId && edge.kind === kind)) {
      from.successors.push({ target: toId, kind });
    }
    to.predecessors.add(fromId);
  };

  const recordTerminator = (nodeId: string): void => {
    terminalNodes.add(nodeId);
  };

  const buildStatements = (statements: StatementNode[]): GraphSegment => {
    if (statements.length === 0) {
      const placeholder = createNode('statement', null, { role: 'empty-block' });
      return { entry: placeholder, exits: [placeholder] };
    }

    let entry: string | null = null;
    let pending: string[] = [];

    for (const statement of statements) {
      const segment = buildStatement(statement);
      if (!entry) {
        entry = segment.entry;
      }

      if (pending.length > 0) {
        for (const from of pending) {
          connect(from, segment.entry);
        }
      }

      pending = segment.exits.slice();
    }

    return {
      entry: entry ?? createNode('statement', null, { role: 'empty-block' }),
      exits: pending,
    };
  };

  const buildBlock = (block: BlockStatementNode): GraphSegment => {
    const blockEntry = createNode('statement', block, { statementKind: block.kind, role: 'block-entry' });
    if (block.body.length === 0) {
      return { entry: blockEntry, exits: [blockEntry] };
    }

    const inner = buildStatements(block.body);
    connect(blockEntry, inner.entry);
    return { entry: blockEntry, exits: inner.exits };
  };

  const buildExpressionAsStatement = (
    expression: ExpressionNode | null | undefined,
    role: string,
  ): GraphSegment | null => {
    if (!expression) {
      return null;
    }
    const node = createNode('statement', expression, { role, expression: true });
    return { entry: node, exits: [node] };
  };

  const wrapStatement = (statement: StatementNode): GraphSegment => {
    if (statement.kind === 'BlockStatement') {
      return buildBlock(statement);
    }
    return buildStatement(statement);
  };

  const buildIfStatement = (statement: IfStatementNode): GraphSegment => {
    const branchNode = createNode('branch', statement, { statementKind: statement.kind });
    const consequentSegment = wrapStatement(statement.consequent);
    connect(branchNode, consequentSegment.entry, 'true');

    const alternateSegment = statement.alternate ? wrapStatement(statement.alternate) : null;
    if (alternateSegment) {
      connect(branchNode, alternateSegment.entry, 'false');
    }

    let mergeNode: string | null = null;
    const ensureMerge = (): string => {
      if (!mergeNode) {
        mergeNode = createNode('merge', null, { sourceKind: statement.kind });
      }
      return mergeNode;
    };

    if (consequentSegment.exits.length > 0) {
      const nodeId = ensureMerge();
      for (const exit of consequentSegment.exits) {
        connect(exit, nodeId);
      }
    }

    if (alternateSegment) {
      if (alternateSegment.exits.length > 0) {
        const nodeId = ensureMerge();
        for (const exit of alternateSegment.exits) {
          connect(exit, nodeId);
        }
      }
    } else {
      const nodeId = ensureMerge();
      connect(branchNode, nodeId, 'false');
    }

    return { entry: branchNode, exits: mergeNode ? [mergeNode] : [] };
  };

  const buildWhileStatement = (statement: WhileStatementNode): GraphSegment => {
    const testNode = createNode('branch', statement, {
      statementKind: statement.kind,
      role: 'loop-test',
    });
    const exitNode = createNode('merge', null, {
      sourceKind: statement.kind,
      role: 'loop-exit',
    });

    loopStack.push({ continueTarget: testNode, breakTarget: exitNode });
    const bodySegment = buildBlock(statement.body);
    loopStack.pop();

    connect(testNode, exitNode, 'false');
    connect(testNode, bodySegment.entry, 'true');

    const bodyExits = bodySegment.exits.length > 0 ? bodySegment.exits : [bodySegment.entry];
    for (const exit of bodyExits) {
      connect(exit, testNode, 'loop');
    }

    return { entry: testNode, exits: [exitNode] };
  };

  const buildForStatement = (statement: ForStatementNode): GraphSegment => {
    const exitNode = createNode('merge', null, { sourceKind: statement.kind, role: 'loop-exit' });
    const testNode = createNode('branch', statement, {
      statementKind: statement.kind,
      role: 'loop-test',
    });

    const initializerSegment = statement.initializer ? buildStatement(statement.initializer) : null;
    const updateSegment = buildExpressionAsStatement(statement.update, 'loop-update');
    const continueTarget = updateSegment ? updateSegment.entry : testNode;

    loopStack.push({ continueTarget, breakTarget: exitNode });
    const bodySegment = buildBlock(statement.body);
    loopStack.pop();

    if (initializerSegment) {
      const initExits = initializerSegment.exits.length > 0 ? initializerSegment.exits : [initializerSegment.entry];
      for (const exit of initExits) {
        connect(exit, testNode);
      }
    }

    connect(testNode, exitNode, 'false');

    connect(testNode, bodySegment.entry, 'true');
    const bodyExits = bodySegment.exits.length > 0 ? bodySegment.exits : [bodySegment.entry];
    for (const exit of bodyExits) {
      if (updateSegment) {
        connect(exit, updateSegment.entry, 'loop');
      } else {
        connect(exit, testNode, 'loop');
      }
    }

    if (updateSegment) {
      const updateExits = updateSegment.exits.length > 0 ? updateSegment.exits : [updateSegment.entry];
      for (const exit of updateExits) {
        connect(exit, testNode, 'loop');
      }
    }

    const entry = initializerSegment ? initializerSegment.entry : testNode;
    return { entry, exits: [exitNode] };
  };

  const buildStatement = (statement: StatementNode): GraphSegment => {
    switch (statement.kind) {
      case 'BlockStatement':
        return buildBlock(statement);
      case 'ExpressionStatement':
      case 'AssignmentStatement':
      case 'VariableDeclaration':
      case 'FunctionDeclaration':
      case 'ScriptDeclaration': {
        const node = createNode('statement', statement, { statementKind: statement.kind });
        return { entry: node, exits: [node] };
      }
      case 'ReturnStatement': {
        const node = createNode('terminator', statement, { statementKind: statement.kind });
        recordTerminator(node);
        return { entry: node, exits: [] };
      }
      case 'IfStatement':
        return buildIfStatement(statement);
      case 'WhileStatement':
        return buildWhileStatement(statement);
      case 'ForStatement':
        return buildForStatement(statement);
      case 'BreakStatement': {
        const node = createNode('jump', statement, { statementKind: statement.kind, jump: 'break' });
        const loop = loopStack[loopStack.length - 1];
        if (loop) {
          connect(node, loop.breakTarget, 'break');
        } else {
          recordTerminator(node);
        }
        return { entry: node, exits: [] };
      }
      case 'ContinueStatement': {
        const node = createNode('jump', statement, { statementKind: statement.kind, jump: 'continue' });
        const loop = loopStack[loopStack.length - 1];
        if (loop) {
          connect(node, loop.continueTarget, 'continue');
        } else {
          recordTerminator(node);
        }
        return { entry: node, exits: [] };
      }
      default: {
        const node = createNode('statement', statement, { statementKind: statement.kind });
        return { entry: node, exits: [node] };
      }
    }
  };

  const entryNode = createNode('entry', program, { statementKind: program.kind });
  const exitNode = createNode('exit', null, { role: 'program-exit' });
  graph.entry = entryNode;
  graph.exit = exitNode;

  if (program.body.length === 0) {
    connect(entryNode, exitNode);
  } else {
    const bodySegment = buildStatements(program.body);
    connect(entryNode, bodySegment.entry);

    if (bodySegment.exits.length > 0) {
      for (const exit of bodySegment.exits) {
        connect(exit, exitNode);
      }
    }
  }

  for (const terminator of terminalNodes) {
    connect(terminator, exitNode, 'return');
  }

  if (nodes.get(entryNode)?.successors.length === 0) {
    connect(entryNode, exitNode);
  }

  return graph;
}
