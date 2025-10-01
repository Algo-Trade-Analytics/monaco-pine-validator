import { parse } from './core/ast/parser';

const code = `//@version=6
indicator("Chart Point Cleanup")

var array<chart.point> points = array.new<chart.point>()

// Add point with size limit
if array.size(points) > 100
    array.shift(points)
    
array.push(points, chart.point.now(close))
`;

console.log('Parsing code...\n');
const result = parse(code, 'test.pine');

console.log('Parse success?', !result.errors || result.errors.length === 0);
console.log('Errors:', result.errors?.length || 0);
if (result.errors && result.errors.length > 0) {
  result.errors.forEach(e => console.log('  -', e.message, 'at line', e.line));
}

console.log('\nAST body length:', result.ast?.body.length);
result.ast?.body.forEach((stmt, i) => {
  console.log(`  ${i}: ${stmt.kind}`, stmt.kind === 'VariableDeclaration' ? `(${(stmt as any).identifier.name})` : '');
});

