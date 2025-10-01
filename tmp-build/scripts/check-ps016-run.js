import { EnhancedModularValidator } from '../EnhancedModularValidator.ts';
const code = `//@version=6
indicator("UDT field reassignment")

type Point
    float x
    float y

    method setX(this<Point>, float value) =>
        this.x = value

p = Point.new(0.0, 0.0)
p.setX(1.0)
plot(close)`;
const validator = new EnhancedModularValidator();
const result = validator.validate(code);
console.log('Error codes:', result.errors.map(error => error.code));
console.log('Messages:', result.errors.map(error => `${error.code}: ${error.message}`));
