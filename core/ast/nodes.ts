export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface SourceLocation {
  start: Position;
  end: Position;
}

export type SourceRange = readonly [number, number];

export interface BaseNode {
  kind: string;
  loc: SourceLocation;
  range: SourceRange;
}

export interface VersionDirectiveNode extends BaseNode {
  kind: 'VersionDirective';
  value: number;
  raw: string;
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
  raw: string;
}

export type LiteralNode = NumberLiteralNode | StringLiteralNode | BooleanLiteralNode;

export type BinaryOperator =
  | 'and'
  | 'or'
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>=';

export interface BinaryExpressionNode extends BaseNode {
  kind: 'BinaryExpression';
  operator: BinaryOperator;
  left: ExpressionNode;
  right: ExpressionNode;
}

export type ExpressionNode =
  | BinaryExpressionNode
  | CallExpressionNode
  | IdentifierNode
  | LiteralNode;

export interface ArgumentNode extends BaseNode {
  kind: 'Argument';
  name?: IdentifierNode | null;
  value: ExpressionNode;
}

export interface CallExpressionNode extends BaseNode {
  kind: 'CallExpression';
  callee: IdentifierNode;
  args: ArgumentNode[];
}

export type ScriptKind = 'indicator' | 'strategy' | 'library';

export interface ScriptDeclarationNode extends BaseNode {
  kind: 'ScriptDeclaration';
  scriptType: ScriptKind;
  call: CallExpressionNode;
}

export interface VariableDeclarationNode extends BaseNode {
  kind: 'VariableDeclaration';
  keyword: 'var' | 'varip';
  identifier: IdentifierNode;
  value: ExpressionNode | null;
}

export interface AssignmentNode extends BaseNode {
  kind: 'AssignmentStatement';
  identifier: IdentifierNode;
  value: ExpressionNode;
}

export interface ExpressionStatementNode extends BaseNode {
  kind: 'ExpressionStatement';
  expression: ExpressionNode;
}

export type StatementNode =
  | ScriptDeclarationNode
  | VariableDeclarationNode
  | AssignmentNode
  | ExpressionStatementNode;

export interface ProgramNode extends BaseNode {
  kind: 'Program';
  version: VersionDirectiveNode | null;
  body: StatementNode[];
}

export type AstNode =
  | ProgramNode
  | VersionDirectiveNode
  | StatementNode
  | ExpressionNode
  | ArgumentNode;

export function createLocation(start: Position, end: Position): SourceLocation {
  return { start, end };
}

export function createRange(startOffset: number, endOffset: number): SourceRange {
  return [startOffset, endOffset];
}

export function spanRange(
  left: BaseNode | null | undefined,
  right: BaseNode | null | undefined,
): {
  loc: SourceLocation;
  range: SourceRange;
} {
  const fallbackPosition: Position = { line: 1, column: 1, offset: 0 };
  const start = left?.loc?.start ?? right?.loc?.start ?? fallbackPosition;
  const end = right?.loc?.end ?? left?.loc?.end ?? fallbackPosition;
  const startOffset = left?.range?.[0] ?? right?.range?.[0] ?? 0;
  const endOffset = right?.range?.[1] ?? left?.range?.[1] ?? startOffset;

  return {
    loc: { start, end },
    range: [startOffset, endOffset],
  };
}
