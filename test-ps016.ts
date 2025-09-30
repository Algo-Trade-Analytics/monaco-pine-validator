import { EnhancedModularValidator } from './EnhancedModularValidator.js';

const code = `//@version=6
indicator("UDT field reassignment")

type Point
    float x
    float y

method setX(this, value) =>
    this.x = value

p = Point.new(0.0, 0.0)
p.setX(1.0)
plot(close)`;

const validator = new EnhancedModularValidator();
const result = validator.validate(code);

console.log('Errors:', result.errors.map(e => `${e.code} (line ${e.line}): ${e.message}`));
console.log('Looking for PS016:', result.errors.some(e => e.code === 'PS016'));
