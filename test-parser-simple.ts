import { ChevrotainAstService } from './core/ast/service.js';

// Simplest possible test
const code = `//@version=6
indicator("Test")
method foo(this, x) =>
    x
plot(close)`;

const service = new ChevrotainAstService();
const result = service.parse(code, { filename: 'test.pine' });

console.log('Simple test (no generic):');
console.log('  Success:', !!result.ast);
console.log('  Errors:', result.diagnostics.syntaxErrors?.length || 0);

// Now test with generic
const code2 = `//@version=6
indicator("Test")
type Point
    float x

method foo(this<Point>, x) =>
    x
plot(close)`;

const result2 = service.parse(code2, { filename: 'test.pine' });

console.log('\nWith this<Point>:');
console.log('  Success:', !!result2.ast);
console.log('  Errors:', result2.diagnostics.syntaxErrors?.length || 0);
if (result2.diagnostics.syntaxErrors) {
  console.log('  Error details:', result2.diagnostics.syntaxErrors.map((e: any) => e.message));
}

