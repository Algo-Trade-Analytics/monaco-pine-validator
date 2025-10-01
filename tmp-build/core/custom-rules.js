import { visit } from './ast/traversal';
export function createAstVisitorRule(options) {
    const severity = options.severity ?? 'warning';
    return {
        id: options.id,
        message: options.message,
        severity,
        suggestion: options.suggestion,
        mode: 'ast',
        visitAst(program, context) {
            const matches = [];
            const report = (match) => {
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
