import { EnhancedModularValidator } from './EnhancedModularValidator';

console.log('═══════════════════════════════════════════════════════════════');
console.log('TEST: Malformed Linefill Syntax');
console.log('═══════════════════════════════════════════════════════════════\n');

const code = `//@version=6
indicator("Malformed Linefill Test")
line1 = line.new(bar_index, high, bar_index[1], low[1])
line2 = line.new(bar_index, low, bar_index[1], high[1])
linefill.new(line1, line2,)
linefill.set_color(fill, color=)
`;

console.log('Code to validate:');
console.log(code);
console.log('\n═══════════════════════════════════════════════════════════════');

const validator = new EnhancedModularValidator();

try {
  const result = validator.validate(code);
  
  console.log('Expected: errors.length > 0 (graceful handling)');
  console.log('Actual errors:', result.errors.length);
  console.log('Valid:', result.isValid);
  
  if (result.errors.length > 0) {
    console.log('\nErrors detected:');
    result.errors.forEach(e => console.log(`  - Line ${e.line}: [${e.code}] ${e.message}`));
  } else {
    console.log('\n❌ NO ERRORS DETECTED - This is the problem!');
  }
  
  console.log('\n✅ Validator did not crash - graceful handling works');
} catch (error) {
  console.log('\n❌ VALIDATOR CRASHED:');
  console.log(error);
}

