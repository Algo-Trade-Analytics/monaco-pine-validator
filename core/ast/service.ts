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
