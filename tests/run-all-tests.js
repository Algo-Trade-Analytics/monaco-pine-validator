#!/usr/bin/env node

/**
 * Script to run all Pine Script v6 validator tests
 *
 * Usage:
 *   node tests/run-all-tests.js
 *   npm run test:validator
 */

import { execSync } from 'node:child_process';
import path from 'node:path';

console.log('🧪 Pine Script v6 Validator - Running All Tests');
console.log('='.repeat(60));

const specsDir = path.join('tests', 'specs');
const allTestsSpec = path.join(specsDir, 'all-validation-tests.spec.ts');

const testFiles = [allTestsSpec];

const testCommands = [`npx vitest run --config vitest.validator.config.ts`];

async function runAllTests() {
  let totalPassed = 0;
  let totalFailed = 0;

  for (let i = 0; i < testCommands.length; i++) {
    const command = testCommands[i];
    const testFile = testFiles[i];

    console.log(`\n📋 Running: ${testFile}`);
    console.log('-'.repeat(50));

    try {
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      console.log(output);
      totalPassed++;
      console.log(`✅ ${testFile} - PASSED`);
    } catch (error) {
      console.log(error.stdout || error.message);
      totalFailed++;
      console.log(`❌ ${testFile} - FAILED`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary:');
  console.log(`✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`📈 Total: ${totalPassed + totalFailed}`);

  if (totalFailed === 0) {
    console.log('\n🎉 All test suites passed successfully!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some test suites failed. Please check the output above.');
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Pine Script v6 Validator Test Runner

Usage:
  node ${path.join('tests', 'run-all-tests.js')} [options]

Options:
  --help, -h     Show this help message
  --verbose, -v  Show verbose output

Examples:
  node ${path.join('tests', 'run-all-tests.js')}
  npm run test:validator
`);
  process.exit(0);
}

runAllTests().catch(error => {
  console.error('❌ Error running tests:', error.message);
  process.exit(1);
});
