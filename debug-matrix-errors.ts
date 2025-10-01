import { EnhancedModularValidator } from './EnhancedModularValidator';
import { ChevrotainAstService } from './core/ast/service';

const code1 = `//@version=6
indicator("Matrix Add Row Error")

m = matrix.new<float>(2, 2, 0.0)
matrix.add_row(m)  // Missing required parameters
plot(close)
`;

const code2 = `//@version=6
indicator("Matrix Type Error")

m = matrix.new<float>(2, 2, 0.0)
matrix.add_row(m, "invalid", array.from(1.0, 2.0))  // row_num should be int
plot(close)
`;

const validator = new EnhancedModularValidator({
  targetVersion: 6,
  strictMode: true,
  enablePerformanceAnalysis: true,
  ast: {
    mode: 'primary',
    service: new ChevrotainAstService(),
  },
});

console.log('=== TEST 1: matrix.add_row(m) - Missing parameters ===');
const result1 = validator.validate(code1);
console.log('Errors:', result1.errors.map(e => `[${e.code}] ${e.message}`));
console.log('Has PSV6-FUNCTION-PARAM-COUNT?', result1.errors.some(e => e.code === 'PSV6-FUNCTION-PARAM-COUNT'));

console.log('\n=== TEST 2: matrix.add_row(m, "invalid", ...) - Wrong type ===');
const result2 = validator.validate(code2);
console.log('Errors:', result2.errors.map(e => `[${e.code}] ${e.message}`));
console.log('Has PSV6-MATRIX-PARAM-TYPE or PSV6-FUNCTION-PARAM-TYPE?', 
  result2.errors.some(e => e.code === 'PSV6-MATRIX-PARAM-TYPE' || e.code === 'PSV6-FUNCTION-PARAM-TYPE'));

