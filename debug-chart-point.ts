import { EnhancedModularValidator } from './EnhancedModularValidator';

console.log('═══════════════════════════════════════════════════════════════');
console.log('TEST 1: chart.point with polyline');
console.log('═══════════════════════════════════════════════════════════════\n');

const code1 = `//@version=6
indicator("Chart Point Polyline")

var polyline pl = na

if bar_index % 10 == 0
    points = array.new<chart.point>()
    array.push(points, chart.point.now(high))
    array.push(points, chart.point.now(low))
    pl := polyline.new(points)
`;

const validator1 = new EnhancedModularValidator();
const result1 = validator1.validate(code1);

console.log('Expected: Valid (no errors)');
console.log('Result Valid:', result1.isValid);
console.log('Errors:', result1.errors.length);
result1.errors.forEach(e => console.log(`  - Line ${e.line}: [${e.code}] ${e.message}`));
console.log('Warnings:', result1.warnings.length);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('TEST 2: chart.point type in array');
console.log('═══════════════════════════════════════════════════════════════\n');

const code2 = `//@version=6
indicator("Chart Point Array")

points = array.new<chart.point>()
array.push(points, chart.point.now(high))
array.push(points, chart.point.now(low))

firstPoint = array.get(points, 0)
plot(firstPoint.price)
`;

const validator2 = new EnhancedModularValidator();
const result2 = validator2.validate(code2);

console.log('Expected: Valid (no errors)');
console.log('Result Valid:', result2.isValid);
console.log('Errors:', result2.errors.length);
result2.errors.forEach(e => console.log(`  - Line ${e.line}: [${e.code}] ${e.message}`));

console.log('\nTypeMap Analysis:');
console.log('  points:', result2.typeMap.get('points'));
console.log('  firstPoint:', result2.typeMap.get('firstPoint'));

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('TEST 3: chart.point cleanup pattern');
console.log('═══════════════════════════════════════════════════════════════\n');

const code3 = `//@version=6
indicator("Chart Point Cleanup")

var array<chart.point> points = array.new<chart.point>()

// Add point with size limit
if array.size(points) > 100
    array.shift(points)
    
array.push(points, chart.point.now(close))
`;

const validator3 = new EnhancedModularValidator();
const result3 = validator3.validate(code3);

console.log('Expected: Valid (no errors)');
console.log('Result Valid:', result3.isValid);
console.log('Errors:', result3.errors.length);
result3.errors.forEach(e => console.log(`  - Line ${e.line}: [${e.code}] ${e.message}`));

console.log('\nTypeMap Analysis:');
console.log('  points:', result3.typeMap.get('points'));

