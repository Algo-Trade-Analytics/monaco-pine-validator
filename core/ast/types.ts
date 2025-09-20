import type { AST, Script } from '../../pynescript/ast/node';
import type { SyntaxError } from '../../pynescript/ast/error';

export type AstMode = 'disabled' | 'shadow' | 'primary';

export interface AstDiagnostics {
  syntaxErrors: SyntaxError[];
}

export interface AstParseOptions {
  filename?: string;
  allowErrors?: boolean;
}

export interface AstParseResult {
  ast: Script | null;
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
  node: AST | null;
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

export interface Position {
  line: number;
  column: number;
  offset: number;
}

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

export function createSymbolLocation(node: AST | null, line: number, column: number): SymbolLocation {
  return { node, line, column };
}

export function createAstDiagnostics(errors: SyntaxError[] = []): AstDiagnostics {
  return { syntaxErrors: [...errors] };
}
