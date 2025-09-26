import type { Node, NodeKind, NodeOfKind } from './nodes';
import {
  type ArgumentNode,
  type AssignmentStatementNode,
  type BinaryExpressionNode,
  type BlockStatementNode,
  type ArrowFunctionExpressionNode,
  type ImportDeclarationNode,
  type CallExpressionNode,
  type ConditionalExpressionNode,
  type ContinueStatementNode,
  type ExpressionStatementNode,
  type MemberExpressionNode,
  type ForStatementNode,
  type FunctionDeclarationNode,
  type IfStatementNode,
  type IfExpressionNode,
  type IndexExpressionNode,
  type MatrixLiteralNode,
  type ParameterNode,
  type ProgramNode,
  type ReturnStatementNode,
  type ScriptDeclarationNode,
  type EnumDeclarationNode,
  type EnumMemberNode,
  type TypeDeclarationNode,
  type TypeFieldNode,
  type SwitchCaseNode,
  type SwitchStatementNode,
  type TypeReferenceNode,
  type TupleExpressionNode,
  type UnaryExpressionNode,
  type VariableDeclarationNode,
  type RepeatStatementNode,
  type WhileStatementNode,
  type BreakStatementNode,
} from './nodes';

export interface NodePath<T extends Node = Node> {
  node: T;
  parent: NodePath | null;
  key: string | null;
  index: number | null;
}

export type VisitorResult = void | boolean | 'skip';

export type Visitor<K extends NodeKind = NodeKind> = {
  enter?: (path: NodePath<NodeOfKind<K>>) => VisitorResult;
  exit?: (path: NodePath<NodeOfKind<K>>) => void;
};

export type VisitorMap = { [K in NodeKind]?: Visitor<K> };

export function createPath<T extends Node>(node: T, parent: NodePath | null, key: string | null, index: number | null): NodePath<T> {
  return { node, parent, key, index };
}

export function visit<T extends Node>(
  node: T | null | undefined,
  visitors: VisitorMap,
  parent: NodePath | null = null,
  key: string | null = null,
  index: number | null = null,
): void {
  if (!node) {
    return;
  }

  const path = createPath(node, parent, key, index);
  const kind = node.kind;
  const visitor = visitors[kind] as Visitor<typeof kind> | undefined;

  let shouldTraverse = true;
  if (visitor?.enter) {
    const result = visitor.enter(path as NodePath<NodeOfKind<typeof kind>>);
    if (result === false || result === 'skip') {
      shouldTraverse = false;
    }
  }

  if (shouldTraverse) {
    visitChildren(path, (child) => {
      visit(child.node, visitors, child.parent, child.key, child.index);
    });
  }

  if (visitor?.exit) {
    visitor.exit(path as NodePath<NodeOfKind<typeof kind>>);
  }
}

export function visitChildren(path: NodePath, iteratee: (child: NodePath) => void): void {
  for (const child of collectChildren(path)) {
    iteratee(child);
  }
}

export function findAncestor<T extends Node = Node>(path: NodePath | null, predicate: (ancestor: NodePath<Node>) => ancestor is NodePath<T>): NodePath<T> | null;
export function findAncestor(path: NodePath | null, predicate: (ancestor: NodePath<Node>) => boolean): NodePath | null;
export function findAncestor(path: NodePath | null, predicate: (ancestor: NodePath<Node>) => boolean): NodePath | null {
  let current = path?.parent ?? null;
  while (current) {
    if (predicate(current)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

interface ChildEntry<T extends Node = Node> {
  node: T;
  parent: NodePath;
  key: string | null;
  index: number | null;
}

function collectChildren(path: NodePath): ChildEntry[] {
  const { node } = path;
  const children: ChildEntry[] = [];
  const push = (child: Node | null | undefined, key: string | null, index: number | null = null) => {
    if (child) {
      children.push({ node: child, parent: path, key, index });
    }
  };

  if (node.leadingComments) {
    node.leadingComments.forEach((comment, commentIndex) => {
      push(comment, 'leadingComments', commentIndex);
    });
  }

  if (node.trailingComments) {
    node.trailingComments.forEach((comment, commentIndex) => {
      push(comment, 'trailingComments', commentIndex);
    });
  }

  switch (node.kind) {
    case 'Program': {
      const program = node as ProgramNode;
      program.directives.forEach((directive, directiveIndex) => {
        push(directive, 'directives', directiveIndex);
      });
      program.body.forEach((statement, statementIndex) => {
        push(statement, 'body', statementIndex);
      });
      break;
    }
    case 'VersionDirective':
      break;
    case 'ScriptDeclaration': {
      const declaration = node as ScriptDeclarationNode;
      push(declaration.identifier, 'identifier');
      declaration.arguments.forEach((argument, argumentIndex) => {
        push(argument, 'arguments', argumentIndex);
      });
      break;
    }
    case 'ImportDeclaration': {
      const declaration = node as ImportDeclarationNode;
      push(declaration.path, 'path');
      push(declaration.alias, 'alias');
      break;
    }
    case 'BlockStatement': {
      const block = node as BlockStatementNode;
      block.body.forEach((statement, statementIndex) => {
        push(statement, 'body', statementIndex);
      });
      break;
    }
    case 'ExpressionStatement': {
      const expression = node as ExpressionStatementNode;
      push(expression.expression, 'expression');
      break;
    }
    case 'ArrowFunctionExpression': {
      const arrow = node as ArrowFunctionExpressionNode;
      arrow.params.forEach((param, paramIndex) => {
        push(param, 'params', paramIndex);
      });
      push(arrow.body, 'body');
      break;
    }
    case 'ReturnStatement': {
      const returnStmt = node as ReturnStatementNode;
      push(returnStmt.argument, 'argument');
      break;
    }
    case 'VariableDeclaration': {
      const declaration = node as VariableDeclarationNode;
      push(declaration.identifier, 'identifier');
      push(declaration.typeAnnotation, 'typeAnnotation');
      push(declaration.initializer, 'initializer');
      break;
    }
    case 'AssignmentStatement': {
      const assignment = node as AssignmentStatementNode;
      push(assignment.left, 'left');
      push(assignment.right, 'right');
      break;
    }
    case 'TupleExpression': {
      const tuple = node as TupleExpressionNode;
      tuple.elements.forEach((element, elementIndex) => {
        push(element, 'elements', elementIndex);
      });
      break;
    }
    case 'EnumDeclaration': {
      const enumDeclaration = node as EnumDeclarationNode;
      push(enumDeclaration.identifier, 'identifier');
      enumDeclaration.members.forEach((member, memberIndex) => {
        push(member, 'members', memberIndex);
      });
      break;
    }
    case 'EnumMember': {
      const member = node as EnumMemberNode;
      push(member.identifier, 'identifier');
      push(member.value, 'value');
      break;
    }
    case 'TypeDeclaration': {
      const typeDeclaration = node as TypeDeclarationNode;
      push(typeDeclaration.identifier, 'identifier');
      typeDeclaration.fields.forEach((field, fieldIndex) => {
        push(field, 'fields', fieldIndex);
      });
      break;
    }
    case 'TypeField': {
      const field = node as TypeFieldNode;
      push(field.identifier, 'identifier');
      push(field.typeAnnotation, 'typeAnnotation');
      break;
    }
    case 'FunctionDeclaration': {
      const fn = node as FunctionDeclarationNode;
      push(fn.identifier, 'identifier');
      fn.params.forEach((param, paramIndex) => {
        push(param, 'params', paramIndex);
      });
      push(fn.body, 'body');
      break;
    }
    case 'IfStatement': {
      const ifStatement = node as IfStatementNode;
      push(ifStatement.test, 'test');
      push(ifStatement.consequent, 'consequent');
      push(ifStatement.alternate, 'alternate');
      break;
    }
    case 'IfExpression': {
      const ifExpression = node as IfExpressionNode;
      push(ifExpression.test, 'test');
      push(ifExpression.consequent, 'consequent');
      push(ifExpression.alternate, 'alternate');
      break;
    }
    case 'RepeatStatement': {
      const repeatStatement = node as RepeatStatementNode;
      push(repeatStatement.body, 'body');
      push(repeatStatement.test, 'test');
      push(repeatStatement.result, 'result');
      break;
    }
    case 'WhileStatement': {
      const whileStatement = node as WhileStatementNode;
      push(whileStatement.test, 'test');
      push(whileStatement.body, 'body');
      push(whileStatement.result, 'result');
      break;
    }
    case 'MemberExpression': {
      const member = node as MemberExpressionNode;
      push(member.object, 'object');
      push(member.property, 'property');
      break;
    }
    case 'ForStatement': {
      const forStatement = node as ForStatementNode;
      push(forStatement.initializer, 'initializer');
      push(forStatement.iterator, 'iterator');
      push(forStatement.iterable, 'iterable');
      push(forStatement.test, 'test');
      push(forStatement.update, 'update');
      push(forStatement.body, 'body');
      push(forStatement.result, 'result');
      break;
    }
    case 'SwitchStatement': {
      const switchStatement = node as SwitchStatementNode;
      push(switchStatement.discriminant, 'discriminant');
      switchStatement.cases.forEach((caseNode, caseIndex) => {
        push(caseNode, 'cases', caseIndex);
      });
      break;
    }
    case 'SwitchCase': {
      const switchCase = node as SwitchCaseNode;
      push(switchCase.test, 'test');
      switchCase.consequent.forEach((statement, statementIndex) => {
        push(statement, 'consequent', statementIndex);
      });
      break;
    }
    case 'BreakStatement':
    case 'ContinueStatement':
      break;
    case 'Parameter': {
      const param = node as ParameterNode;
      push(param.identifier, 'identifier');
      push(param.typeAnnotation, 'typeAnnotation');
      push(param.defaultValue, 'defaultValue');
      break;
    }
    case 'CallExpression': {
      const call = node as CallExpressionNode;
      push(call.callee, 'callee');
      call.args.forEach((argument, argIndex) => {
        push(argument, 'args', argIndex);
      });
      break;
    }
    case 'Argument': {
      const argument = node as ArgumentNode;
      push(argument.name, 'name');
      push(argument.value, 'value');
      break;
    }
    case 'BinaryExpression': {
      const binary = node as BinaryExpressionNode;
      push(binary.left, 'left');
      push(binary.right, 'right');
      break;
    }
    case 'UnaryExpression': {
      const unary = node as UnaryExpressionNode;
      push(unary.argument, 'argument');
      break;
    }
    case 'ConditionalExpression': {
      const conditional = node as ConditionalExpressionNode;
      push(conditional.test, 'test');
      push(conditional.consequent, 'consequent');
      push(conditional.alternate, 'alternate');
      break;
    }
    case 'IndexExpression': {
      const indexExpression = node as IndexExpressionNode;
      push(indexExpression.object, 'object');
      push(indexExpression.index, 'index');
      break;
    }
    case 'MatrixLiteral': {
      const matrix = node as MatrixLiteralNode;
      matrix.rows.forEach((row, rowIndex) => {
        row.forEach((element, columnIndex) => {
          push(element, `rows.${rowIndex}`, columnIndex);
        });
      });
      break;
    }
    case 'Identifier':
    case 'NumberLiteral':
    case 'StringLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
      break;
    case 'TypeReference': {
      const typeReference = node as TypeReferenceNode;
      push(typeReference.name, 'name');
      typeReference.generics.forEach((genericNode, genericIndex) => {
        push(genericNode, 'generics', genericIndex);
      });
      break;
    }
    case 'Comment':
      break;
    default: {
      const exhaustiveCheck: never = node;
      throw new Error('Unhandled node kind in traversal');
    }
  }

  return children;
}
