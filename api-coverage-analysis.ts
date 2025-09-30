/**
 * API Coverage Analysis
 * 
 * Compare Pine Script API Reference against our validator tests and logic
 * to find gaps in coverage.
 */

import functionsRef from './PineScriptContext/structures/functions.json' assert { type: 'json' };
import variablesRef from './PineScriptContext/structures/variables.json' assert { type: 'json' };
import constantsRef from './PineScriptContext/structures/constants.json' assert { type: 'json' };
import typesRef from './PineScriptContext/structures/types.json' assert { type: 'json' };
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

console.log('🔍 API COVERAGE ANALYSIS\n');
console.log('Comparing Pine Script v6 API against Validator Tests & Logic');
console.log('='.repeat(80));

// ============================================================================
// Step 1: Load API Reference Data
// ============================================================================
console.log('\n📊 API Reference Statistics\n');

const allFunctions = Object.keys(functionsRef);
const allVariables = Object.keys(variablesRef);
const allConstants = Object.keys(constantsRef);
const allTypes = Object.keys(typesRef);

console.log(`Total Functions: ${allFunctions.length}`);
console.log(`Total Variables: ${allVariables.length}`);
console.log(`Total Constants: ${allConstants.length}`);
console.log(`Total Types: ${allTypes.length}`);
console.log(`\nTOTAL API SURFACE: ${allFunctions.length + allVariables.length + allConstants.length} items`);

// ============================================================================
// Step 2: Analyze Function Namespaces
// ============================================================================
console.log('\n\n📊 Function Namespaces\n');

const namespaces = new Map<string, string[]>();
allFunctions.forEach(func => {
  const parts = func.split('.');
  const namespace = parts.length > 1 ? parts[0] : 'global';
  if (!namespaces.has(namespace)) {
    namespaces.set(namespace, []);
  }
  namespaces.get(namespace)!.push(func);
});

const sortedNamespaces = Array.from(namespaces.entries())
  .sort((a, b) => b[1].length - a[1].length);

console.log('Top Namespaces by Function Count:\n');
sortedNamespaces.slice(0, 15).forEach(([ns, funcs]) => {
  console.log(`  ${ns.padEnd(20)} ${funcs.length.toString().padStart(4)} functions`);
});

// ============================================================================
// Step 3: Scan Test Files
// ============================================================================
console.log('\n\n📊 Test Coverage Analysis\n');

const testDir = './tests/specs';
const testFiles = readdirSync(testDir).filter(f => f.endsWith('.spec.ts'));

console.log(`Scanning ${testFiles.length} test files...\n`);

// Extract function calls from test files
const testedFunctions = new Set<string>();
const testContent = testFiles.map(file => {
  try {
    return readFileSync(join(testDir, file), 'utf-8');
  } catch {
    return '';
  }
}).join('\n');

// Find all function calls in tests (simple regex)
allFunctions.forEach(func => {
  // Check for direct function name usage
  if (testContent.includes(func)) {
    testedFunctions.add(func);
  }
});

console.log(`Functions found in tests: ${testedFunctions.size} / ${allFunctions.length}`);
console.log(`Coverage: ${(testedFunctions.size / allFunctions.length * 100).toFixed(1)}%`);

// ============================================================================
// Step 4: Identify Untested Namespaces
// ============================================================================
console.log('\n\n📊 Coverage by Namespace\n');

const namespaceCoverage = new Map<string, { total: number; tested: number }>();

sortedNamespaces.forEach(([ns, funcs]) => {
  const tested = funcs.filter(f => testedFunctions.has(f)).length;
  namespaceCoverage.set(ns, { total: funcs.length, tested });
});

const sortedCoverage = Array.from(namespaceCoverage.entries())
  .sort((a, b) => b[1].total - a[1].total);

console.log('Namespace Coverage Report:\n');
sortedCoverage.slice(0, 20).forEach(([ns, stats]) => {
  const pct = (stats.tested / stats.total * 100).toFixed(1);
  const bar = '█'.repeat(Math.floor(stats.tested / stats.total * 20)) + 
              '░'.repeat(20 - Math.floor(stats.tested / stats.total * 20));
  console.log(`  ${ns.padEnd(20)} ${bar} ${pct.padStart(5)}% (${stats.tested}/${stats.total})`);
});

// ============================================================================
// Step 5: Identify Completely Missing Namespaces
// ============================================================================
console.log('\n\n⚠️  Namespaces with LOW Coverage (<50%)\n');

const lowCoverage = sortedCoverage.filter(([_, stats]) => 
  (stats.tested / stats.total) < 0.5 && stats.total > 3
);

lowCoverage.forEach(([ns, stats]) => {
  const pct = (stats.tested / stats.total * 100).toFixed(1);
  console.log(`  ${ns.padEnd(20)} ${pct.padStart(5)}% - ${stats.total - stats.tested} untested functions`);
});

// ============================================================================
// Step 6: List Critical Untested Functions
// ============================================================================
console.log('\n\n❌ Critical Untested Functions (Top Namespaces)\n');

const criticalNamespaces = ['ta', 'request', 'strategy', 'input', 'math', 'str', 'array', 'matrix'];

criticalNamespaces.forEach(ns => {
  const funcs = namespaces.get(ns) || [];
  const untested = funcs.filter(f => !testedFunctions.has(f));
  
  if (untested.length > 0) {
    console.log(`\n${ns}.*  (${untested.length}/${funcs.length} untested):`);
    untested.slice(0, 10).forEach(f => {
      console.log(`  - ${f}`);
    });
    if (untested.length > 10) {
      console.log(`  ... and ${untested.length - 10} more`);
    }
  }
});

// ============================================================================
// Step 7: Check Variables Coverage
// ============================================================================
console.log('\n\n📊 Variable Coverage\n');

const testedVariables = allVariables.filter(v => testContent.includes(v));
console.log(`Variables tested: ${testedVariables.length} / ${allVariables.length}`);
console.log(`Coverage: ${(testedVariables.length / allVariables.length * 100).toFixed(1)}%`);

const untestedVariables = allVariables.filter(v => !testContent.includes(v));
if (untestedVariables.length > 0 && untestedVariables.length < 30) {
  console.log('\nUntested Variables:');
  untestedVariables.forEach(v => console.log(`  - ${v}`));
}

// ============================================================================
// Step 8: Check Constants Coverage
// ============================================================================
console.log('\n\n📊 Constants Coverage\n');

const testedConstants = allConstants.filter(c => testContent.includes(c));
console.log(`Constants tested: ${testedConstants.length} / ${allConstants.length}`);
console.log(`Coverage: ${(testedConstants.length / allConstants.length * 100).toFixed(1)}%`);

// Group constants by namespace
const constantNamespaces = new Map<string, string[]>();
allConstants.forEach(c => {
  const ns = c.includes('.') ? c.split('.')[0] : 'global';
  if (!constantNamespaces.has(ns)) {
    constantNamespaces.set(ns, []);
  }
  constantNamespaces.get(ns)!.push(c);
});

console.log('\nConstants by Namespace:');
Array.from(constantNamespaces.entries())
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 10)
  .forEach(([ns, consts]) => {
    const tested = consts.filter(c => testContent.includes(c)).length;
    const pct = (tested / consts.length * 100).toFixed(1);
    console.log(`  ${ns.padEnd(20)} ${tested}/${consts.length} (${pct}%)`);
  });

// ============================================================================
// Summary Report
// ============================================================================
console.log('\n\n' + '='.repeat(80));
console.log('📊 COVERAGE SUMMARY');
console.log('='.repeat(80));

const totalItems = allFunctions.length + allVariables.length + allConstants.length;
const testedItems = testedFunctions.size + testedVariables.length + testedConstants.length;
const overallCoverage = (testedItems / totalItems * 100).toFixed(1);

console.log(`\n┌─────────────────────────────────────────────────────────┐`);
console.log(`│ Overall API Coverage: ${overallCoverage}% ${' '.repeat(30 - overallCoverage.length)}│`);
console.log(`├─────────────────────────────────────────────────────────┤`);
console.log(`│ Functions: ${testedFunctions.size}/${allFunctions.length} (${(testedFunctions.size/allFunctions.length*100).toFixed(1)}%)${' '.repeat(30)}│`);
console.log(`│ Variables: ${testedVariables.length}/${allVariables.length} (${(testedVariables.length/allVariables.length*100).toFixed(1)}%)${' '.repeat(30)}│`);
console.log(`│ Constants: ${testedConstants.length}/${allConstants.length} (${(testedConstants.length/allConstants.length*100).toFixed(1)}%)${' '.repeat(30)}│`);
console.log(`└─────────────────────────────────────────────────────────┘`);

console.log('\n💡 Next Steps:\n');
console.log('1. Review low-coverage namespaces for gaps');
console.log('2. Add tests for critical untested functions');
console.log('3. Validate less common features (color.*, box.*, line.*, etc.)');
console.log('4. Consider if some functions are intentionally out of scope');
console.log('5. Document what is intentionally NOT validated\n');

// Export detailed report
const report = {
  summary: {
    totalFunctions: allFunctions.length,
    testedFunctions: testedFunctions.size,
    totalVariables: allVariables.length,
    testedVariables: testedVariables.length,
    totalConstants: allConstants.length,
    testedConstants: testedConstants.length,
    overallCoverage: parseFloat(overallCoverage)
  },
  namespaces: Object.fromEntries(namespaceCoverage),
  untestedFunctions: allFunctions.filter(f => !testedFunctions.has(f)),
  untestedVariables,
};

import { writeFileSync } from 'fs';
writeFileSync('api-coverage-report.json', JSON.stringify(report, null, 2));
console.log('📄 Detailed report saved to: api-coverage-report.json\n');

