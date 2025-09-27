import { ChevrotainAstService } from '../core/ast/service';

const service = new ChevrotainAstService();
const source = `//@version=6
indicator("Test")
myMap = map.new<string>()
for i = 0 to 10
    map.put(myMap, "k", "v")
`;
const result = service.parse(source, { filename: 'test.pine' });
if (!result.ast) {
  console.error('No AST');
  process.exit(1);
}
console.log(JSON.stringify(result.ast.body, null, 2));
