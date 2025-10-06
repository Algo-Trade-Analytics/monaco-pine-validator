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

const args = process.argv.slice(2);
const wantsHelp = args.includes('--help') || args.includes('-h');
const verbose = args.includes('--verbose') || args.includes('-v');
const mode = args.includes('--full') ? 'full' : args.includes('--smoke') ? 'smoke' : 'smoke';
const suiteFilter = extractOptionValue(args, '--suite');

if (wantsHelp) {
  console.log(`
Pine Script v6 Validator Test Runner

Usage:
  node ${path.join('tests', 'run-all-tests.js')} [options]

Options:
  --help, -h      Show this help message
  --verbose, -v   Stream Vitest output directly instead of buffering
  --full          Run the full regression suite (enables VALIDATOR_FULL_SUITE)
  --smoke         Force the smoke suite (default)
  --suite <name>  Only load spec modules whose names include the filter (comma separated)

Examples:
  node ${path.join('tests', 'run-all-tests.js')}
  node ${path.join('tests', 'run-all-tests.js')} --full
  npm run test:validator:full
`);
  process.exit(0);
}

console.log('🧪 Pine Script v6 Validator - Running All Tests');
console.log('='.repeat(60));

const specPattern = path.join('tests', 'specs', 'all-validation-tests.spec.ts');
const astPattern = path.join('tests', 'ast', '**', '*.test.ts');
const lintPattern = path.join('tests', 'constants-registry-lint.test.ts');

const suites = [
  {
    name: mode === 'full' ? 'Full validator spec suite' : 'Smoke validator spec suite',
    file: specPattern,
    command: 'npx vitest run --config vitest.validator.config.ts',
    env: {
      ...(mode === 'full' ? { VALIDATOR_FULL_SUITE: '1' } : {}),
      ...(suiteFilter ? { VALIDATOR_SUITE_FILTER: suiteFilter } : {}),
    },
  },
  {
    name: 'AST module harness',
    file: astPattern,
    command: 'npx vitest run --config vitest.config.ts',
    env: {},
  },
  {
    name: 'Constants registry lint',
    file: lintPattern,
    command: `npx vitest run ${lintPattern}`,
    env: {},
  },
];

async function runAllTests() {
  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of suites) {
    console.log(`\n📋 Running: ${suite.name}`);
    console.log(`🧾 Pattern: ${suite.file}`);
    console.log('-'.repeat(50));
    if (suiteFilter && suite.env?.VALIDATOR_SUITE_FILTER) {
      console.log(`🎯 Suite filter: ${suite.env.VALIDATOR_SUITE_FILTER}`);
    }

    try {
      const output = execSync(suite.command, {
        encoding: 'utf8',
        stdio: verbose ? 'inherit' : 'pipe',
        env: { ...process.env, ...suite.env },
      });

      if (!verbose) {
        console.log(output);
      }

      totalPassed++;
      console.log(`✅ ${suite.name} - PASSED`);
    } catch (error) {
      if (verbose) {
        console.log('❌ Test command failed');
      } else {
        console.log(error.stdout || error.message);
      }
      totalFailed++;
      console.log(`❌ ${suite.name} - FAILED`);
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

runAllTests().catch(error => {
  console.error('❌ Error running tests:', error.message);
  process.exit(1);
});

function extractOptionValue(argv, flag) {
  const withValue = argv.find((arg) => arg.startsWith(`${flag}=`));
  if (withValue) {
    return withValue.slice(flag.length + 1);
  }

  const flagIndex = argv.indexOf(flag);
  if (flagIndex !== -1 && typeof argv[flagIndex + 1] === 'string') {
    return argv[flagIndex + 1];
  }

  return null;
}
