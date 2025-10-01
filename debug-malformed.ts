import { EnhancedModularValidator } from './EnhancedModularValidator';

console.log('═══════════════════════════════════════════════════════════════');
console.log('TEST 1: Malformed Linefill Syntax');
console.log('═══════════════════════════════════════════════════════════════\n');

const code1 = `linefill.new(line1, line2,)
linefill.set_color(fill, color=)`;

const validator1 = new EnhancedModularValidator();
const result1 = validator1.validate(code1);

console.log('Expected: errors.length > 0');
console.log('Actual:', result1.errors.length);
console.log('Errors:', result1.errors.map(e => `[${e.code}] ${e.message}`));

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('TEST 2: Malformed Text Parameters');
console.log('═══════════════════════════════════════════════════════════════\n');

const code2 = `indicator("Malformed Text", overlay=true)
box.new(left=0, top=1, right=1, bottom=0, text=unclosed_string")`;

const validator2 = new EnhancedModularValidator();
const result2 = validator2.validate(code2);

console.log('Expected: errors.length >= 1 AND includes PSV6-TEXTBOX-MALFORMED-TEXT');
console.log('Actual:', result2.errors.length);
console.log('Has PSV6-TEXTBOX-MALFORMED-TEXT?', result2.errors.some(e => e.code === 'PSV6-TEXTBOX-MALFORMED-TEXT'));
console.log('Errors:', result2.errors.map(e => `[${e.code}] ${e.message}`));

