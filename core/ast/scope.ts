import {
  createEmptyScopeGraph,
  createEmptySymbolTable,
  createSymbolLocation,
  createSymbolRecord,
  type ScopeGraph,
  type ScopeKind,
  type ScopeNode,
  type SymbolKind,
  type SymbolTable,
} from './types';
import {
  type AssignmentStatementNode,
  type BlockStatementNode,
  type CallExpressionNode,
  type ConditionalExpressionNode,
  type ContinueStatementNode,
  type ExpressionNode,
  type ExpressionStatementNode,
  type ForStatementNode,
  type IndexExpressionNode,
  type MatrixLiteralNode,
  type MemberExpressionNode,
  type FunctionDeclarationNode,
  type IfStatementNode,
  type IdentifierNode,
  type ParameterNode,
  type ProgramNode,
  type ReturnStatementNode,
  type ScriptDeclarationNode,
  type StatementNode,
  type SwitchStatementNode,
  type WhileStatementNode,
  type BreakStatementNode,
  type VariableDeclarationNode,
} from './nodes';

export interface ScopeBuildResult {
  scopeGraph: ScopeGraph;
  symbolTable: SymbolTable;
}

interface ScopeFrame {
  node: ScopeNode;
}

export function buildScopeGraph(program: ProgramNode | null): ScopeBuildResult {
  const scopeGraph = createEmptyScopeGraph();
  const symbolTable = createEmptySymbolTable();

  if (!program) {
    return { scopeGraph, symbolTable };
  }

  let scopeCounter = 0;
  const scopeStack: ScopeFrame[] = [];

  const pushScope = (kind: ScopeKind, source: BlockStatementNode | ProgramNode, metadata?: Record<string, unknown>): ScopeNode => {
    const id = `scope-${scopeCounter++}`;
    const parentFrame = scopeStack[scopeStack.length - 1] ?? null;
    const node: ScopeNode = {
      id,
      kind,
      parent: parentFrame?.node.id ?? null,
      children: new Set<string>(),
      symbols: new Set<string>(),
      metadata: {
        nodeKind: source.kind,
        range: source.range,
        ...(metadata ?? {}),
      },
    };

    scopeGraph.nodes.set(id, node);

    if (parentFrame) {
      parentFrame.node.children.add(id);
    } else {
      scopeGraph.root = id;
    }

    scopeStack.push({ node });
    return node;
  };

  const popScope = (): void => {
    scopeStack.pop();
  };

  const currentScope = (): ScopeNode | null => {
    const frame = scopeStack[scopeStack.length - 1];
    return frame?.node ?? null;
  };

  const upsertSymbolRecord = (name: string, kind: SymbolKind, locationNode: IdentifierNode) => {
    const existing = symbolTable.get(name);
    const location = createSymbolLocation(locationNode, locationNode.loc.start.line, locationNode.loc.start.column);

    if (!existing) {
      const record = createSymbolRecord(name, kind, location);
      const scopeId = currentScope()?.id;
      record.metadata = scopeId ? { declarationScopes: [scopeId] } : undefined;
      symbolTable.set(name, record);
      return record;
    }

    if (existing.kind === 'unknown') {
      existing.kind = kind;
    }

    existing.declarations.push(location);

    const scopeId = currentScope()?.id;
    if (scopeId) {
      if (existing.metadata) {
        const scopes = (existing.metadata.declarationScopes as string[] | undefined) ?? [];
        scopes.push(scopeId);
        existing.metadata.declarationScopes = scopes;
      } else {
        existing.metadata = { declarationScopes: [scopeId] };
      }
    }

    return existing;
  };

  const declare = (identifier: IdentifierNode | null | undefined, kind: SymbolKind): void => {
    if (!identifier) {
      return;
    }

    const scope = currentScope();
    if (!scope) {
      return;
    }

    scope.symbols.add(identifier.name);
    upsertSymbolRecord(identifier.name, kind, identifier);
  };

  const recordReference = (identifier: IdentifierNode | null | undefined): void => {
    if (!identifier) {
      return;
    }

    const location = createSymbolLocation(identifier, identifier.loc.start.line, identifier.loc.start.column);
    const existing = symbolTable.get(identifier.name);
    if (existing) {
      existing.references.push(location);
      return;
    }

    const record = createSymbolRecord(identifier.name, 'unknown');
    record.references.push(location);
    symbolTable.set(identifier.name, record);
  };

  const visitExpression = (expression: ExpressionNode | null | undefined): void => {
    if (!expression) {
      return;
    }

    switch (expression.kind) {
      case 'Identifier':
        recordReference(expression);
        break;
      case 'CallExpression': {
        const call = expression as CallExpressionNode;
        visitExpression(call.callee);
        call.args.forEach((arg) => {
          if (arg.name) {
            recordReference(arg.name);
          }
          visitExpression(arg.value);
        });
        break;
      }
      case 'BinaryExpression': {
        const binary = expression;
        visitExpression(binary.left);
        visitExpression(binary.right);
        break;
      }
      case 'UnaryExpression': {
        const unary = expression;
        visitExpression(unary.argument);
        break;
      }
      case 'MemberExpression': {
        const member = expression as MemberExpressionNode;
        visitExpression(member.object);
        recordReference(member.property);
        break;
      }
      case 'IndexExpression': {
        const indexExpression = expression as IndexExpressionNode;
        visitExpression(indexExpression.object);
        visitExpression(indexExpression.index);
        break;
      }
      case 'MatrixLiteral': {
        const matrix = expression as MatrixLiteralNode;
        matrix.rows.forEach((row) => {
          row.forEach((element) => {
            visitExpression(element);
          });
        });
        break;
      }
      case 'ConditionalExpression': {
        const conditional = expression as ConditionalExpressionNode;
        visitExpression(conditional.test);
        visitExpression(conditional.consequent);
        visitExpression(conditional.alternate);
        break;
      }
      default:
        break;
    }
  };

  const visitStatement = (statement: StatementNode): void => {
    switch (statement.kind) {
      case 'VariableDeclaration': {
        const variable = statement as VariableDeclarationNode;
        declare(variable.identifier, 'variable');
        visitExpression(variable.initializer);
        break;
      }
      case 'AssignmentStatement': {
        const assignment = statement as AssignmentStatementNode;
        visitExpression(assignment.left);
        visitExpression(assignment.right);
        break;
      }
      case 'ExpressionStatement': {
        const exprStatement = statement as ExpressionStatementNode;
        visitExpression(exprStatement.expression);
        break;
      }
      case 'ReturnStatement': {
        const returnStatement = statement as ReturnStatementNode;
        visitExpression(returnStatement.argument);
        break;
      }
      case 'BlockStatement': {
        const block = statement as BlockStatementNode;
        pushScope('block', block);
        block.body.forEach(visitStatement);
        popScope();
        break;
      }
      case 'FunctionDeclaration': {
        const fn = statement as FunctionDeclarationNode;
        declare(fn.identifier, 'function');
        pushScope('function', fn.body, {
          functionName: fn.identifier?.name ?? null,
          export: fn.export,
        });
        fn.params.forEach((param) => {
          declare(param.identifier, 'parameter');
          visitExpression(param.defaultValue);
        });
        fn.body.body.forEach(visitStatement);
        popScope();
        break;
      }
      case 'IfStatement': {
        const ifStatement = statement as IfStatementNode;
        visitExpression(ifStatement.test);
        visitStatement(ifStatement.consequent);
        if (ifStatement.alternate) {
          visitStatement(ifStatement.alternate);
        }
        break;
      }
      case 'WhileStatement': {
        const whileStatement = statement as WhileStatementNode;
        visitExpression(whileStatement.test);
        pushScope('loop', whileStatement.body, { loopType: 'while' });
        visitStatement(whileStatement.body);
        popScope();
        break;
      }
      case 'ForStatement': {
        const forStatement = statement as ForStatementNode;
        pushScope('loop', forStatement.body, { loopType: 'for' });
        if (forStatement.initializer) {
          visitStatement(forStatement.initializer);
        }
        visitExpression(forStatement.test);
        visitExpression(forStatement.update);
        visitStatement(forStatement.body);
        popScope();
        break;
      }
      case 'SwitchStatement': {
        const switchStatement = statement as SwitchStatementNode;
        visitExpression(switchStatement.discriminant);
        switchStatement.cases.forEach((caseNode) => {
          if (caseNode.test) {
            visitExpression(caseNode.test);
          }
          caseNode.consequent.forEach((caseStatement) => {
            visitStatement(caseStatement);
          });
        });
        break;
      }
      case 'BreakStatement':
      case 'ContinueStatement':
        break;
      case 'ScriptDeclaration': {
        const script = statement as ScriptDeclarationNode;
        declare(script.identifier, 'namespace');
        script.arguments.forEach((argument) => {
          if (argument.name) {
            recordReference(argument.name);
          }
          visitExpression(argument.value);
        });
        break;
      }
      default:
        break;
    }
  };

  const visitProgram = (node: ProgramNode): void => {
    pushScope('module', node, { directives: node.directives.length });
    node.body.forEach(visitStatement);
    popScope();
  };

  visitProgram(program);

  return { scopeGraph, symbolTable };
}
