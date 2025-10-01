import { EnhancedModularValidator } from './EnhancedModularValidator';

const code = `//@version=6
indicator("Chart Point Cleanup")

var array<chart.point> points = array.new<chart.point>()

// Add point with size limit
if array.size(points) > 100
    array.shift(points)
    
array.push(points, chart.point.now(close))
`;

const validator = new EnhancedModularValidator();
const result = validator.validate(code);

console.log('Expected: Valid (no errors)');
console.log('Result Valid:', result.isValid);
console.log('Errors:', result.errors.length);
result.errors.forEach(e => console.log(`  - Line ${e.line}: [${e.code}] ${e.message}`));

console.log('\nTypeMap Analysis:');
const pointsType = result.typeMap.get('points');
console.log('  points in typeMap?', pointsType ? 'YES' : 'NO');
if (pointsType) {
  console.log('  points:', JSON.stringify(pointsType, null, 2));
}

console.log('\nLine 4:', code.split('\n')[3]);
console.log('This line has BOTH:');
console.log('  1. Type annotation: var array<chart.point> points');
console.log('  2. Initializer: array.new<chart.point>()');
console.log('\nThe workaround fixes the initializer but not the type annotation');

