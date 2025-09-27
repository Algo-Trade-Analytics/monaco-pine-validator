import { ChevrotainAstService } from '../core/ast/service';

const service = new ChevrotainAstService();
const source = `//@version=6
indicator("Test")
stringMap = map.new<string>()
`;
const result = service.parse(source, { filename: 'test.pine' });
console.log('Diagnostics:', result.diagnostics);
if (!result.ast) {
  console.log('AST null');
  process.exit(0);
}
console.log(JSON.stringify(result.ast.body[1], null, 2));
