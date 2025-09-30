import { visit, type VisitorMap } from './ast/traversal';
import type { ProgramNode } from './ast/nodes';
import type {
  AstRuleMatch,
  AstValidationContext,
  ValidationRule,
} from './types';

export interface AstVisitorRuleContext {
  program: ProgramNode;
  context: AstValidationContext;
  report: (match: AstRuleMatch) => void;
}

export type AstVisitorFactory = (context: AstVisitorRuleContext) => VisitorMap;

export interface AstVisitorRuleOptions {
  id: string;
  message: string;
  severity?: 'error' | 'warning' | 'info';
  suggestion?: string;
  visitor: AstVisitorFactory;
}

export function createAstVisitorRule(options: AstVisitorRuleOptions): ValidationRule {
  const severity = options.severity ?? 'warning';

  return {
    id: options.id,
    message: options.message,
    severity,
    suggestion: options.suggestion,
    mode: 'ast',
    visitAst(program, context) {
      const matches: AstRuleMatch[] = [];
      const report = (match: AstRuleMatch) => {
        matches.push({
          line: match.line ?? 1,
          column: match.column ?? 1,
          message: match.message ?? options.message,
          severity: match.severity ?? severity,
          suggestion: match.suggestion ?? options.suggestion,
          code: match.code ?? options.id,
        });
      };

      const visitor = options.visitor({ program, context, report });
      visit(program, visitor);
      return matches;
    },
  };
}
