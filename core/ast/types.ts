import type { AstNode, Position, ProgramNode, SourceLocation, SourceRange } from './nodes';

export type AstDiagnosticSeverity = 'error' | 'warning' | 'info';

export type AstSyntaxErrorPhase = 'lexing' | 'parsing';

export type AstMode = 'disabled' | 'shadow' | 'primary';

export interface AstSyntaxError {
  message: string;
  code: string;
  severity: AstDiagnosticSeverity;
  phase: AstSyntaxErrorPhase;
  range: SourceRange;
  loc: SourceLocation;
  cause?: unknown;
}

export interface AstDiagnostics {
  syntaxErrors: AstSyntaxError[];
}

export interface AstParseOptions {
  filename?: string;
  allowErrors?: boolean;
}

export interface AstParseResult {
  ast: ProgramNode | null;
  diagnostics: AstDiagnostics;
}

export interface AstService {
  parse(source: string, options?: AstParseOptions): AstParseResult;
}

export interface AstConfig {
  mode: AstMode;
  service?: AstService | null;
}

export type SymbolKind =
  | 'variable'
  | 'function'
  | 'type'
  | 'enum'
  | 'namespace'
  | 'parameter'
  | 'unknown';

export interface SymbolLocation {
  node: AstNode | null;
  line: number;
  column: number;
}

export interface SymbolRecord {
  name: string;
  kind: SymbolKind;
  declarations: SymbolLocation[];
  references: SymbolLocation[];
  metadata?: Record<string, unknown>;
}

export type SymbolTable = Map<string, SymbolRecord>;

export type ScopeKind = 'module' | 'block' | 'function' | 'loop' | 'conditional' | 'namespace';

export interface ScopeNode {
  id: string;
  kind: ScopeKind;
  parent: string | null;
  children: Set<string>;
  symbols: Set<string>;
  metadata?: Record<string, unknown>;
}

export interface ScopeGraph {
  root: string | null;
  nodes: Map<string, ScopeNode>;
}

export type AstTypeKind = 'float' | 'int' | 'bool' | 'string' | 'series' | 'unknown';

export type AstTypeSourceReason =
  | 'literal'
  | 'identifier'
  | 'call'
  | 'binary'
  | 'declaration'
  | 'assignment'
  | 'unknown';

export interface AstTypeSource {
  node: AstNode | null;
  reason: AstTypeSourceReason;
}

export interface AstTypeAnnotation {
  kind: AstTypeKind;
  isSeries: boolean;
  sources: AstTypeSource[];
}

export type AstTypeTable = Map<string, AstTypeAnnotation>;

export function createEmptySymbolTable(): SymbolTable {
  return new Map<string, SymbolRecord>();
}

export function createEmptyScopeGraph(): ScopeGraph {
  return {
    root: null,
    nodes: new Map<string, ScopeNode>(),
  };
}

export function createSymbolRecord(name: string, kind: SymbolKind, location?: SymbolLocation): SymbolRecord {
  return {
    name,
    kind,
    declarations: location ? [location] : [],
    references: [],
  };
}

export function createSymbolLocation(node: AstNode | null, line: number, column: number): SymbolLocation {
  return { node, line, column };
}

export function createAstDiagnostics(errors: AstSyntaxError[] = []): AstDiagnostics {
  return { syntaxErrors: [...errors] };
}

export function createEmptyTypeTable(): AstTypeTable {
  return new Map();
}

export type { Position, ProgramNode };
