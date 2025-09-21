import type { SyntaxError } from '../../pynescript/ast/error';
import type { Node, ProgramNode } from './nodes';

export type AstMode = 'disabled' | 'shadow' | 'primary';

export interface AstDiagnostics {
  syntaxErrors: SyntaxError[];
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
  node: Node | null;
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

export type TypeCertainty = 'certain' | 'inferred' | 'conflict';

export type PinePrimitiveType = 'int' | 'float' | 'bool' | 'string' | 'void';

export type InferredTypeKind = PinePrimitiveType | 'function' | 'series' | 'unknown';

export interface TypeMetadata {
  kind: InferredTypeKind;
  certainty: TypeCertainty;
  sources: string[];
}

export interface TypeEnvironment {
  nodeTypes: WeakMap<Node, TypeMetadata>;
  identifiers: Map<string, TypeMetadata>;
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

export function createSymbolLocation(node: Node | null, line: number, column: number): SymbolLocation {
  return { node, line, column };
}

export function createEmptyTypeEnvironment(): TypeEnvironment {
  return {
    nodeTypes: new WeakMap<Node, TypeMetadata>(),
    identifiers: new Map<string, TypeMetadata>(),
  };
}

export function createTypeMetadata(
  kind: InferredTypeKind,
  source: string,
  certainty: TypeCertainty = 'inferred',
): TypeMetadata {
  return { kind, certainty, sources: [source] };
}

export function cloneTypeMetadata(
  metadata: TypeMetadata,
  overrides: Partial<Omit<TypeMetadata, 'sources'>> & { addSource?: string } = {},
): TypeMetadata {
  const sources = [...metadata.sources];
  if (overrides.addSource && !sources.includes(overrides.addSource)) {
    sources.push(overrides.addSource);
  }

  const { addSource: _ignored, ...rest } = overrides;

  return {
    kind: rest.kind ?? metadata.kind,
    certainty: rest.certainty ?? metadata.certainty,
    sources,
  };
}

export function createAstDiagnostics(errors: SyntaxError[] = []): AstDiagnostics {
  return { syntaxErrors: [...errors] };
}
