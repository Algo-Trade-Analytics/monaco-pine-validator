import { SyntaxError } from '../../pynescript/ast/error';
import { parseWithChevrotain } from './parser';
import { createAstDiagnostics } from './types';
export class NullAstService {
    parse(_source, _options) {
        return {
            ast: null,
            diagnostics: createAstDiagnostics(),
        };
    }
}
export class FunctionAstService {
    constructor(handler) {
        this.handler = handler;
    }
    parse(source, options) {
        return this.handler(source, options);
    }
}
export function createNullAstService() {
    return new NullAstService();
}
export class ChevrotainAstService {
    parse(source, options = {}) {
        try {
            return parseWithChevrotain(source, options);
        }
        catch (error) {
            const syntaxError = error instanceof SyntaxError
                ? error
                : new SyntaxError(error instanceof Error ? error.message : 'Unknown parser error');
            return {
                ast: null,
                diagnostics: createAstDiagnostics([syntaxError]),
            };
        }
    }
}
