/**
 * Core types and interfaces for the modular Pine Script v6 validator
 */

import type {
  AstConfig,
  AstDiagnostics,
  ControlFlowGraph,
  ScopeGraph,
  SymbolTable,
  TypeEnvironment,
} from './ast/types';
import type { ProgramNode } from './ast/nodes';

export interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
  suggestion?: string;
  relatedLines?: number[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
  typeMap: Map<string, TypeInfo>;
  scriptType: 'indicator' | 'strategy' | 'library' | null;
}

export interface TypeInfo {
  type: 'int' | 'float' | 'bool' | 'string' | 'color' | 'series' | 'line' | 'label' | 'box' | 'table' | 'linefill' | 'polyline' | 'chart.point' | 'array' | 'matrix' | 'map' | 'udt' | 'unknown';
  isConst: boolean;
  isSeries: boolean;
  declaredAt: { line: number; column: number };
  usages: Array<{ line: number; column: number }>;
  enumType?: string; // For enum variables to store their enum type
  elementType?: string; // For arrays and matrices to store their element type
  keyType?: string; // For maps to store the key type
  valueType?: string; // For maps to store the value type
  udtName?: string; // Preserve the specific UDT identifier when type === 'udt'
}

export interface ValidationContext {
  lines: string[];
  cleanLines: string[];
  rawLines: string[];
  sourceText?: string;
  typeMap: Map<string, TypeInfo>;
  usedVars: Set<string>;
  declaredVars: Map<string, number>;
  functionNames: Set<string>;
  methodNames: Set<string>;
  functionParams: Map<string, string[]>;
  scriptType: 'indicator' | 'strategy' | 'library' | null;
  version: number;
  hasVersion: boolean;
  firstVersionLine: number | null;
}

export interface AstValidationContext extends ValidationContext {
  ast: ProgramNode | null;
  astDiagnostics: AstDiagnostics;
  scopeGraph: ScopeGraph;
  symbolTable: SymbolTable;
  typeEnvironment: TypeEnvironment;
  controlFlowGraph: ControlFlowGraph;
}

export interface ValidatorConfig {
  targetVersion: 4 | 5 | 6;
  strictMode: boolean;
  allowDeprecated: boolean;
  enableTypeChecking: boolean;
  enableControlFlowAnalysis: boolean;
  enablePerformanceAnalysis: boolean;
  enablePerformanceChecks?: boolean;
  enableStyleChecks?: boolean;
  enableWarnings?: boolean;
  enableInfo?: boolean;
  enableCustomRuleRawScan?: boolean;
  customRules: ValidationRule[];
  ignoredCodes: string[];
  ast?: AstConfig;
}

export type RawRuleMatcher = (line: string, lineNum: number, ctx: ValidationContext) => boolean;

export interface AstRuleMatch {
  line: number;
  column: number;
  message?: string;
  severity?: 'error' | 'warning' | 'info';
  suggestion?: string;
  code?: string;
}

export type AstRuleEvaluator = (program: ProgramNode, ctx: AstValidationContext) => AstRuleMatch[] | void;

export interface ValidationRule {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  pattern?: RegExp | RawRuleMatcher;
  visitAst?: AstRuleEvaluator;
  suggestion?: string;
  mode?: 'raw' | 'ast' | 'both';
}

export interface ValidationModule {
  name: string;
  priority?: number;
  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult;
  getDependencies(): string[];
}

export type {
  AstConfig,
  AstDiagnostics,
  AstParseOptions,
  AstParseResult,
  AstService,
  ControlFlowEdge,
  ControlFlowEdgeKind,
  ControlFlowGraph,
  ControlFlowNode,
  ControlFlowNodeKind,
  ScopeGraph,
  ScopeKind,
  ScopeNode,
  SymbolKind,
  SymbolRecord,
  SymbolTable,
} from './ast/types';

export interface ScopeInfo {
  indent: number;
  params: Set<string>;
  fnName: string | null;
  variables: Set<string>;
}

export interface FunctionInfo {
  name: string;
  parameters: string[];
  returnType?: string;
  isMethod: boolean;
  declaredAt: { line: number; column: number };
}

export interface VariableInfo {
  name: string;
  type: string;
  isConst: boolean;
  isSeries: boolean;
  declaredAt: { line: number; column: number };
  scope: number;
}

export type Qualifier = 'const' | 'input' | 'simple' | 'series' | 'unknown';

export interface QualifierStrength {
  [key: string]: number;
}

export interface BuiltinFunctionRule {
  parameters?: Array<{
    name: string;
    type: string;
    qualifier?: Qualifier;
    required?: boolean;
    min?: number;
    max?: number;
  }>;
  deprecatedParams?: string[];
  v6Changes?: string;
  disallowedArgTypes?: string[];
}
