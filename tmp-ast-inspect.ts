import { ChevrotainAstService } from './core/ast/service';
import { createAstDiagnostics } from './core/ast/types';

const code = `//@version=6\nindicator("Test")\nmyFunc() =>\n    if close > open\n        "bullish"\n    else\n        123`;

const service = new ChevrotainAstService();
const { ast, diagnostics } = service.parse(code, { filename: 'test.pine', allowErrors: true });
console.log('Diagnostics', diagnostics);
console.log(JSON.stringify(ast, null, 2));
