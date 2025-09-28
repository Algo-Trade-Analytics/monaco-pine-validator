import { EnhancedModularValidator } from './EnhancedModularValidator.ts';

const validator = new EnhancedModularValidator();
const code = `//@version=6
indicator("Test")

type PriceBar
    float o
    float h
    float l
    float c

isBullish(PriceBar bar) =>
    bar.c > bar.o

myBar = PriceBar.new(open, high, low, close)
bgcolor(isBullish(myBar) ? color.new(color.green, 80) : na)
`;

const result = validator.validate(code);
console.log('errors', result.errors.map(e => `${e.code}:${e.message}`));
console.log('warnings', result.warnings.map(e => `${e.code}:${e.message}`));
