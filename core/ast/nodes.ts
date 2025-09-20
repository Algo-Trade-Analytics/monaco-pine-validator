import type { Position } from './types';

export type Range = readonly [number, number];

export interface SourceLocation {
  start: Position;
  end: Position;
}

export interface BaseNode {
  kind: NodeKind;
  loc: SourceLocation;
  range: Range;
  leadingComments?: CommentNode[];
  trailingComments?: CommentNode[];
}

export type NodeKind =
  | 'Program'
  | 'VersionDirective'
  | 'ScriptDeclaration'
  | 'BlockStatement'
  | 'ExpressionStatement'
  | 'ReturnStatement'
  | 'VariableDeclaration'
  | 'AssignmentStatement'
  | 'FunctionDeclaration'
  | 'Parameter'
  | 'CallExpression'
  | 'Argument'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'Identifier'
  | 'NumberLiteral'
  | 'StringLiteral'
  | 'BooleanLiteral'
  | 'NullLiteral'
  | 'TypeReference'
  | 'Comment';

export type Node =
  | ProgramNode
  | VersionDirectiveNode
  | ScriptDeclarationNode
  | BlockStatementNode
  | ExpressionStatementNode
  | ReturnStatementNode
  | VariableDeclarationNode
  | AssignmentStatementNode
  | FunctionDeclarationNode
  | ParameterNode
  | CallExpressionNode
  | ArgumentNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | IdentifierNode
  | NumberLiteralNode
  | StringLiteralNode
  | BooleanLiteralNode
  | NullLiteralNode
  | TypeReferenceNode
  | CommentNode;

export type DirectiveNode = VersionDirectiveNode;

export type StatementNode =
  | BlockStatementNode
  | ExpressionStatementNode
  | ReturnStatementNode
  | VariableDeclarationNode
  | AssignmentStatementNode
  | FunctionDeclarationNode
  | ScriptDeclarationNode;

export type ExpressionNode =
  | IdentifierNode
  | LiteralNode
  | CallExpressionNode
  | BinaryExpressionNode
  | UnaryExpressionNode;

export type LiteralNode =
  | NumberLiteralNode
  | StringLiteralNode
  | BooleanLiteralNode
  | NullLiteralNode;

export type DeclarationNode = FunctionDeclarationNode | VariableDeclarationNode | ScriptDeclarationNode;

export interface ProgramNode extends BaseNode {
  kind: 'Program';
  directives: DirectiveNode[];
  body: StatementNode[];
}

export interface VersionDirectiveNode extends BaseNode {
  kind: 'VersionDirective';
  version: number;
}

export interface ScriptDeclarationNode extends BaseNode {
  kind: 'ScriptDeclaration';
  scriptType: 'indicator' | 'strategy' | 'library';
  identifier: IdentifierNode | null;
  arguments: ArgumentNode[];
}

export interface BlockStatementNode extends BaseNode {
  kind: 'BlockStatement';
  body: StatementNode[];
}

export interface ExpressionStatementNode extends BaseNode {
  kind: 'ExpressionStatement';
  expression: ExpressionNode;
}

export interface ReturnStatementNode extends BaseNode {
  kind: 'ReturnStatement';
  argument: ExpressionNode | null;
}

export type VariableDeclarationKind = 'var' | 'varip' | 'const' | 'let' | 'simple';

export interface VariableDeclarationNode extends BaseNode {
  kind: 'VariableDeclaration';
  declarationKind: VariableDeclarationKind;
  identifier: IdentifierNode;
  typeAnnotation: TypeReferenceNode | null;
  initializer: ExpressionNode | null;
}

export interface AssignmentStatementNode extends BaseNode {
  kind: 'AssignmentStatement';
  left: ExpressionNode;
  right: ExpressionNode | null;
}

export interface FunctionDeclarationNode extends BaseNode {
  kind: 'FunctionDeclaration';
  identifier: IdentifierNode | null;
  params: ParameterNode[];
  body: BlockStatementNode;
  export: boolean;
}

export interface ParameterNode extends BaseNode {
  kind: 'Parameter';
  identifier: IdentifierNode;
  typeAnnotation: TypeReferenceNode | null;
  defaultValue: ExpressionNode | null;
}

export interface CallExpressionNode extends BaseNode {
  kind: 'CallExpression';
  callee: ExpressionNode;
  args: ArgumentNode[];
}

export interface ArgumentNode extends BaseNode {
  kind: 'Argument';
  name: IdentifierNode | null;
  value: ExpressionNode;
}

export interface BinaryExpressionNode extends BaseNode {
  kind: 'BinaryExpression';
  operator: string;
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface UnaryExpressionNode extends BaseNode {
  kind: 'UnaryExpression';
  operator: string;
  argument: ExpressionNode;
  prefix: boolean;
}

export interface IdentifierNode extends BaseNode {
  kind: 'Identifier';
  name: string;
}

export interface NumberLiteralNode extends BaseNode {
  kind: 'NumberLiteral';
  value: number;
  raw: string;
}

export interface StringLiteralNode extends BaseNode {
  kind: 'StringLiteral';
  value: string;
  raw: string;
}

export interface BooleanLiteralNode extends BaseNode {
  kind: 'BooleanLiteral';
  value: boolean;
}

export interface NullLiteralNode extends BaseNode {
  kind: 'NullLiteral';
}

export interface TypeReferenceNode extends BaseNode {
  kind: 'TypeReference';
  name: IdentifierNode;
  generics: TypeReferenceNode[];
}

export interface CommentNode extends BaseNode {
  kind: 'Comment';
  value: string;
  style: 'line' | 'block';
}

export function createPosition(line = 1, column = 1, offset = 0): Position {
  return { line, column, offset };
}

export function createLocation(start: Position, end: Position): SourceLocation {
  return { start, end };
}

export function createRange(start: number, end: number): Range {
  return [start, end];
}

export type NodeOfKind<K extends NodeKind> = Extract<Node, { kind: K }>;
