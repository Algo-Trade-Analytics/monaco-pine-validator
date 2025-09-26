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
  | 'ImportDeclaration'
  | 'ExpressionStatement'
  | 'ReturnStatement'
  | 'VariableDeclaration'
  | 'AssignmentStatement'
  | 'EnumDeclaration'
  | 'EnumMember'
  | 'TypeDeclaration'
  | 'TypeField'
  | 'FunctionDeclaration'
  | 'IfStatement'
  | 'RepeatStatement'
  | 'WhileStatement'
  | 'ForStatement'
  | 'SwitchStatement'
  | 'SwitchCase'
  | 'MemberExpression'
  | 'BreakStatement'
  | 'ContinueStatement'
  | 'Parameter'
  | 'CallExpression'
  | 'Argument'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'ConditionalExpression'
  | 'TupleExpression'
  | 'IndexExpression'
  | 'MatrixLiteral'
  | 'CompilerAnnotation'
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
  | ImportDeclarationNode
  | ExpressionStatementNode
  | ReturnStatementNode
  | VariableDeclarationNode
  | AssignmentStatementNode
  | EnumDeclarationNode
  | EnumMemberNode
  | TypeDeclarationNode
  | TypeFieldNode
  | FunctionDeclarationNode
  | IfStatementNode
  | RepeatStatementNode
  | WhileStatementNode
  | ForStatementNode
  | SwitchStatementNode
  | SwitchCaseNode
  | BreakStatementNode
  | ContinueStatementNode
  | ParameterNode
  | CallExpressionNode
  | ArgumentNode
  | MemberExpressionNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | ConditionalExpressionNode
  | TupleExpressionNode
  | IndexExpressionNode
  | MatrixLiteralNode
  | CompilerAnnotationNode
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
  | ImportDeclarationNode
  | ExpressionStatementNode
  | ReturnStatementNode
  | VariableDeclarationNode
  | AssignmentStatementNode
  | EnumDeclarationNode
  | EnumMemberNode
  | TypeDeclarationNode
  | FunctionDeclarationNode
  | IfStatementNode
  | RepeatStatementNode
  | WhileStatementNode
  | ForStatementNode
  | SwitchStatementNode
  | BreakStatementNode
  | ContinueStatementNode
  | ScriptDeclarationNode;

export type ExpressionNode =
  | IdentifierNode
  | LiteralNode
  | CallExpressionNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | MemberExpressionNode
  | ConditionalExpressionNode
  | TupleExpressionNode
  | IndexExpressionNode
  | MatrixLiteralNode
  | SwitchStatementNode;

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
  annotations: CompilerAnnotationNode[];
}

export interface ImportDeclarationNode extends BaseNode {
  kind: 'ImportDeclaration';
  path: StringLiteralNode;
  alias: IdentifierNode;
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
  annotations: CompilerAnnotationNode[];
}

export interface AssignmentStatementNode extends BaseNode {
  kind: 'AssignmentStatement';
  left: ExpressionNode;
  right: ExpressionNode | null;
}

export interface TupleExpressionNode extends BaseNode {
  kind: 'TupleExpression';
  elements: (ExpressionNode | null)[];
}

export interface EnumMemberNode extends BaseNode {
  kind: 'EnumMember';
  identifier: IdentifierNode;
  value: ExpressionNode | null;
}

export interface EnumDeclarationNode extends BaseNode {
  kind: 'EnumDeclaration';
  identifier: IdentifierNode;
  members: EnumMemberNode[];
  export: boolean;
  annotations: CompilerAnnotationNode[];
}

export interface TypeDeclarationNode extends BaseNode {
  kind: 'TypeDeclaration';
  identifier: IdentifierNode;
  fields: TypeFieldNode[];
  export: boolean;
  annotations: CompilerAnnotationNode[];
}

export interface TypeFieldNode extends BaseNode {
  kind: 'TypeField';
  identifier: IdentifierNode;
  typeAnnotation: TypeReferenceNode | null;
}

export interface FunctionDeclarationNode extends BaseNode {
  kind: 'FunctionDeclaration';
  identifier: IdentifierNode | null;
  params: ParameterNode[];
  body: BlockStatementNode;
  export: boolean;
  returnType: TypeReferenceNode | null;
  annotations: CompilerAnnotationNode[];
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

export interface MemberExpressionNode extends BaseNode {
  kind: 'MemberExpression';
  object: ExpressionNode;
  property: IdentifierNode;
  computed: boolean;
}

export interface IfStatementNode extends BaseNode {
  kind: 'IfStatement';
  test: ExpressionNode;
  consequent: StatementNode;
  alternate: StatementNode | null;
}

export interface RepeatStatementNode extends BaseNode {
  kind: 'RepeatStatement';
  body: BlockStatementNode;
  test: ExpressionNode;
}

export interface WhileStatementNode extends BaseNode {
  kind: 'WhileStatement';
  test: ExpressionNode;
  body: BlockStatementNode;
}

export interface ForStatementNode extends BaseNode {
  kind: 'ForStatement';
  initializer: VariableDeclarationNode | AssignmentStatementNode | null;
  iterator: ExpressionNode | null;
  iterable: ExpressionNode | null;
  test: ExpressionNode | null;
  update: ExpressionNode | null;
  body: BlockStatementNode;
}

export interface SwitchStatementNode extends BaseNode {
  kind: 'SwitchStatement';
  discriminant: ExpressionNode;
  cases: SwitchCaseNode[];
}

export interface SwitchCaseNode extends BaseNode {
  kind: 'SwitchCase';
  test: ExpressionNode | null;
  consequent: StatementNode[];
}

export interface BreakStatementNode extends BaseNode {
  kind: 'BreakStatement';
}

export interface ContinueStatementNode extends BaseNode {
  kind: 'ContinueStatement';
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

export interface ConditionalExpressionNode extends BaseNode {
  kind: 'ConditionalExpression';
  test: ExpressionNode;
  consequent: ExpressionNode;
  alternate: ExpressionNode;
}

export interface IndexExpressionNode extends BaseNode {
  kind: 'IndexExpression';
  object: ExpressionNode;
  index: ExpressionNode;
}

export interface MatrixLiteralNode extends BaseNode {
  kind: 'MatrixLiteral';
  rows: ExpressionNode[][];
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

export interface CompilerAnnotationNode extends BaseNode {
  kind: 'CompilerAnnotation';
  name: string;
  value: string;
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
