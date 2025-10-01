import { EnhancedModularValidator } from './EnhancedModularValidator';

const code = `//@version=6
indicator("Enum Undefined")

enum Direction
    Long
    Short

var Direction dir = Direction.Long
if dir == Direction.Sideways
    plot(1)
plot(0)
`;

process.env.DEBUG_ENUM = '1';

const validator = new EnhancedModularValidator();
const result = validator.validate(code);

console.log('Expected: PSV6-ENUM-UNDEFINED-VALUE for Direction.Sideways');
console.log('Errors:', result.errors.length);
result.errors.forEach(e => console.log(`  - Line ${e.line}: [${e.code}] ${e.message}`));

