import { EnhancedModularValidator } from './EnhancedModularValidator.js';
import { ChevrotainAstService } from './core/ast/service.js';

const code1 = `//@version=6
indicator("NA Comparison")
cond = close == na
plot(cond ? 1 : 0)
`;

// First, manually parse to see if AST is working
const service = new ChevrotainAstService();
const parseResult = service.parse(code1, { filename: 'test.pine' });
console.log('Manual parse:');
console.log('  AST exists:', !!parseResult.ast);
console.log('  Diagnostics:', parseResult.diagnostics);

if (parseResult.ast) {
  console.log('  AST root:', parseResult.ast.kind);
  console.log('  AST body length:', parseResult.ast.body.length);
  
  // Print the first few body items
  parseResult.ast.body.slice(0, 5).forEach((item, i) => {
    console.log(`  Body[${i}]:`, item.kind);
  });
}

const validator = new EnhancedModularValidator();

console.log('\nTest 1: cond = close == na');
const result1 = validator.validate(code1);
console.log('  Errors:', result1.errors.map(e => e.code));
console.log('  Warnings:', result1.warnings.map(w => w.code));
console.log('  Looking for PS023:', result1.warnings.some(w => w.code === 'PS023'));

