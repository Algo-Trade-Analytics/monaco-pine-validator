import { createEmptyControlFlowGraph, } from './types';
export function buildControlFlowGraph(program) {
    const graph = createEmptyControlFlowGraph();
    if (!program) {
        return graph;
    }
    const nodes = graph.nodes;
    let nodeCounter = 0;
    const terminalNodes = new Set();
    const controlStack = [];
    const createNode = (kind, astNode, metadata) => {
        const id = `cf-${nodeCounter++}`;
        nodes.set(id, {
            id,
            kind,
            astNode: astNode ?? null,
            predecessors: new Set(),
            successors: [],
            metadata: metadata ? { ...metadata } : undefined,
        });
        return id;
    };
    const connect = (fromId, toId, kind = 'normal') => {
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
    const recordTerminator = (nodeId) => {
        terminalNodes.add(nodeId);
    };
    const buildStatements = (statements) => {
        if (statements.length === 0) {
            const placeholder = createNode('statement', null, { role: 'empty-block' });
            return { entry: placeholder, exits: [placeholder] };
        }
        let entry = null;
        let pending = [];
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
    const buildBlock = (block) => {
        const blockEntry = createNode('statement', block, { statementKind: block.kind, role: 'block-entry' });
        if (block.body.length === 0) {
            return { entry: blockEntry, exits: [blockEntry] };
        }
        const inner = buildStatements(block.body);
        connect(blockEntry, inner.entry);
        return { entry: blockEntry, exits: inner.exits };
    };
    const buildExpressionAsStatement = (expression, role) => {
        if (!expression) {
            return null;
        }
        if (expression.kind === 'IfExpression') {
            return buildIfExpression(expression, role);
        }
        const node = createNode('statement', expression, { role, expression: true });
        return { entry: node, exits: [node] };
    };
    const buildIfExpression = (expression, role) => {
        const branchNode = createNode('branch', expression, {
            statementKind: expression.kind,
            expression: true,
            role,
        });
        const consequentSegment = buildBlock(expression.consequent);
        connect(branchNode, consequentSegment.entry, 'true');
        const mergeNode = createNode('merge', null, {
            sourceKind: expression.kind,
            role,
        });
        const connectExits = (segment) => {
            const exits = segment.exits.length > 0 ? segment.exits : [segment.entry];
            exits.forEach((exit) => {
                connect(exit, mergeNode);
            });
        };
        connectExits(consequentSegment);
        if (expression.alternate) {
            if (expression.alternate.kind === 'IfExpression') {
                const alternateSegment = buildIfExpression(expression.alternate, role);
                connect(branchNode, alternateSegment.entry, 'false');
                connectExits(alternateSegment);
            }
            else {
                const alternateBlock = buildBlock(expression.alternate);
                connect(branchNode, alternateBlock.entry, 'false');
                connectExits(alternateBlock);
            }
        }
        else {
            connect(branchNode, mergeNode, 'false');
        }
        return { entry: branchNode, exits: [mergeNode] };
    };
    const wrapStatement = (statement) => {
        if (statement.kind === 'BlockStatement') {
            return buildBlock(statement);
        }
        return buildStatement(statement);
    };
    const buildIfStatement = (statement) => {
        const branchNode = createNode('branch', statement, { statementKind: statement.kind });
        const consequentSegment = wrapStatement(statement.consequent);
        connect(branchNode, consequentSegment.entry, 'true');
        const alternateSegment = statement.alternate ? wrapStatement(statement.alternate) : null;
        if (alternateSegment) {
            connect(branchNode, alternateSegment.entry, 'false');
        }
        let mergeNode = null;
        const ensureMerge = () => {
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
        }
        else {
            const nodeId = ensureMerge();
            connect(branchNode, nodeId, 'false');
        }
        return { entry: branchNode, exits: mergeNode ? [mergeNode] : [] };
    };
    const buildWhileStatement = (statement) => {
        const testNode = createNode('branch', statement, {
            statementKind: statement.kind,
            role: 'loop-test',
        });
        const exitNode = createNode('merge', null, {
            sourceKind: statement.kind,
            role: 'loop-exit',
        });
        controlStack.push({ continueTarget: testNode, breakTarget: exitNode });
        const bodySegment = buildBlock(statement.body);
        controlStack.pop();
        connect(testNode, exitNode, 'false');
        connect(testNode, bodySegment.entry, 'true');
        const bodyExits = bodySegment.exits.length > 0 ? bodySegment.exits : [bodySegment.entry];
        for (const exit of bodyExits) {
            connect(exit, testNode, 'loop');
        }
        return { entry: testNode, exits: [exitNode] };
    };
    const buildRepeatStatement = (statement) => {
        const testNode = createNode('branch', statement, {
            statementKind: statement.kind,
            role: 'loop-test',
        });
        const exitNode = createNode('merge', null, {
            sourceKind: statement.kind,
            role: 'loop-exit',
        });
        controlStack.push({ continueTarget: testNode, breakTarget: exitNode });
        const bodySegment = buildBlock(statement.body);
        controlStack.pop();
        const bodyEntry = bodySegment.entry;
        const bodyExits = bodySegment.exits.length > 0 ? bodySegment.exits : [bodyEntry];
        for (const exit of bodyExits) {
            connect(exit, testNode, 'loop');
        }
        connect(testNode, exitNode, 'true');
        connect(testNode, bodyEntry, 'false');
        return { entry: bodyEntry, exits: [exitNode] };
    };
    const buildForStatement = (statement) => {
        const exitNode = createNode('merge', null, { sourceKind: statement.kind, role: 'loop-exit' });
        const testNode = createNode('branch', statement, {
            statementKind: statement.kind,
            role: 'loop-test',
        });
        const initializerSegment = statement.initializer ? buildStatement(statement.initializer) : null;
        const iterableSegment = buildExpressionAsStatement(statement.iterable, 'loop-iterable');
        const updateSegment = buildExpressionAsStatement(statement.update, 'loop-update');
        const continueTarget = updateSegment ? updateSegment.entry : testNode;
        controlStack.push({ continueTarget, breakTarget: exitNode });
        const bodySegment = buildBlock(statement.body);
        controlStack.pop();
        const initializerExits = initializerSegment
            ? initializerSegment.exits.length > 0
                ? initializerSegment.exits
                : [initializerSegment.entry]
            : null;
        const iterableExits = iterableSegment
            ? iterableSegment.exits.length > 0
                ? iterableSegment.exits
                : [iterableSegment.entry]
            : null;
        if (initializerSegment && iterableSegment) {
            for (const exit of initializerExits ?? []) {
                connect(exit, iterableSegment.entry, 'loop-init');
            }
        }
        const preTestExits = iterableSegment ? iterableExits : initializerExits;
        if (preTestExits) {
            for (const exit of preTestExits) {
                connect(exit, testNode);
            }
        }
        connect(testNode, exitNode, 'false');
        connect(testNode, bodySegment.entry, 'true');
        const bodyExits = bodySegment.exits.length > 0 ? bodySegment.exits : [bodySegment.entry];
        for (const exit of bodyExits) {
            if (updateSegment) {
                connect(exit, updateSegment.entry, 'loop');
            }
            else {
                connect(exit, testNode, 'loop');
            }
        }
        if (updateSegment) {
            const updateExits = updateSegment.exits.length > 0 ? updateSegment.exits : [updateSegment.entry];
            for (const exit of updateExits) {
                connect(exit, testNode, 'loop');
            }
        }
        const entry = initializerSegment
            ? initializerSegment.entry
            : iterableSegment
                ? iterableSegment.entry
                : testNode;
        return { entry, exits: [exitNode] };
    };
    const buildSwitchStatement = (statement) => {
        const branchNode = createNode('branch', statement, {
            statementKind: statement.kind,
            role: 'switch-discriminant',
        });
        const exitNode = createNode('merge', null, {
            sourceKind: statement.kind,
            role: 'switch-exit',
        });
        controlStack.push({ breakTarget: exitNode });
        const caseSegments = statement.cases.map((caseNode, caseIndex) => {
            const caseEntry = createNode('statement', caseNode, {
                statementKind: caseNode.kind,
                caseIndex,
                isDefault: caseNode.test == null,
            });
            if (caseNode.consequent.length === 0) {
                return { entry: caseEntry, exits: [caseEntry] };
            }
            const statementsSegment = buildStatements(caseNode.consequent);
            connect(caseEntry, statementsSegment.entry, 'normal');
            const exits = statementsSegment.exits.length > 0 ? statementsSegment.exits : [statementsSegment.entry];
            return { entry: caseEntry, exits };
        });
        controlStack.pop();
        if (caseSegments.length === 0) {
            connect(branchNode, exitNode);
            return { entry: branchNode, exits: [exitNode] };
        }
        caseSegments.forEach((segment) => {
            connect(branchNode, segment.entry, 'case');
            segment.exits.forEach((exit) => {
                connect(exit, exitNode);
            });
        });
        return { entry: branchNode, exits: [exitNode] };
    };
    const buildStatement = (statement) => {
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
            case 'RepeatStatement':
                return buildRepeatStatement(statement);
            case 'WhileStatement':
                return buildWhileStatement(statement);
            case 'ForStatement':
                return buildForStatement(statement);
            case 'SwitchStatement':
                return buildSwitchStatement(statement);
            case 'BreakStatement': {
                const node = createNode('jump', statement, { statementKind: statement.kind, jump: 'break' });
                const context = [...controlStack].reverse().find((entry) => entry.breakTarget);
                if (context) {
                    connect(node, context.breakTarget, 'break');
                }
                else {
                    recordTerminator(node);
                }
                return { entry: node, exits: [] };
            }
            case 'ContinueStatement': {
                const node = createNode('jump', statement, { statementKind: statement.kind, jump: 'continue' });
                const context = [...controlStack].reverse().find((entry) => entry.continueTarget);
                if (context && context.continueTarget) {
                    connect(node, context.continueTarget, 'continue');
                }
                else {
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
    }
    else {
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
