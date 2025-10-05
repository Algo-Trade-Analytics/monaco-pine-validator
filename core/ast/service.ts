import { SyntaxError } from '../../pynescript/ast/error';
import { parseWithChevrotain } from './parser';
import { AstParseOptions, AstParseResult, AstService, createAstDiagnostics } from './types';

export class NullAstService implements AstService {
  parse(_source: string, _options?: AstParseOptions): AstParseResult {
    return {
      ast: null,
      diagnostics: createAstDiagnostics(),
    };
  }
}

export class FunctionAstService implements AstService {
  constructor(private readonly handler: (source: string, options?: AstParseOptions) => AstParseResult) {}

  parse(source: string, options?: AstParseOptions): AstParseResult {
    return this.handler(source, options);
  }
}

export function createNullAstService(): AstService {
  return new NullAstService();
}

export class ChevrotainAstService implements AstService {
  parse(source: string, options: AstParseOptions = {}): AstParseResult {
    try {
      // Always request a best-effort AST so downstream validators can still
      // reason about the script even when Chevrotain reports syntax errors.
      //
      // The module harness uses the FunctionAstService with
      // `allowErrors: true`, which meant the harness received partial ASTs
      // while the production validator (via ChevrotainAstService) returned
      // `null`.  Modules such as the function/type validators silently
      // skipped their AST-based logic, causing the full validator regression
      // suite to miss diagnostics like PSV6-FUNCTION-RETURN-TYPE and PSDUP01.
      // Align the production service with the harness behaviour so both
      // environments analyse the same AST snapshot.
      return parseWithChevrotain(source, { ...options, allowErrors: true });
    } catch (error) {
      const syntaxError =
        error instanceof SyntaxError
          ? error
          : new SyntaxError(error instanceof Error ? error.message : 'Unknown parser error');
      return {
        ast: null,
        diagnostics: createAstDiagnostics([syntaxError]),
      };
    }
  }
}
