import { LinefillValidator } from './modules/linefill-validator';
import { ValidationContext, ValidatorConfig } from './core/types';

console.log('═══════════════════════════════════════════════════════════════');
console.log('TEST: Malformed Linefill Syntax (Direct LinefillValidator)');
console.log('═══════════════════════════════════════════════════════════════\n');

const validator = new LinefillValidator();

const context: ValidationContext = {
  lines: [],
  cleanLines: [
    'linefill.new(line1, line2,)',  // Trailing comma
    'linefill.set_color(fill, color=)'  // Missing value
  ],
  typeMap: new Map(),
  functionNames: new Set(),
  variableNames: new Set(),
  imports: new Map(),
  exports: new Set()
};

const config: ValidatorConfig = {
  targetVersion: 6,
  enablePerformanceAnalysis: true,
  enableBestPractices: true,
  maxComplexity: 100,
  maxNesting: 10
};

console.log('Input cleanLines:');
context.cleanLines.forEach((line, i) => console.log(`  ${i+1}. ${line}`));

console.log('\n═══════════════════════════════════════════════════════════════');

const result = validator.validate(context, config);

console.log('Expected: errors.length > 0');
console.log('Actual errors:', result.errors.length);
console.log('Valid:', result.isValid);

if (result.errors.length > 0) {
  console.log('\n✅ ERRORS DETECTED:');
  result.errors.forEach(e => console.log(`  - Line ${e.line}: [${e.code}] ${e.message}`));
} else {
  console.log('\n❌ NO ERRORS DETECTED');
}

