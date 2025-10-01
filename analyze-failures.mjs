import { execSync } from 'child_process';

const output = execSync('npm run test:validator:full 2>&1', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

const lines = output.split('\n');
const failures = lines.filter(line => line.trim().startsWith('❯'));

const categories = {};
for (const line of failures) {
  const match = line.match(/❯ tests\/specs\/all-validation-tests\.spec\.ts > ([^>]+) >/);
  if (match) {
    const category = match[1].trim();
    categories[category] = (categories[category] || 0) + 1;
  }
}

console.log('📊 Test Failures by Category:\n');
const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
for (const [category, count] of sorted) {
  console.log(`  ${count.toString().padStart(3)} - ${category}`);
}

console.log(`\n📈 Total Failures: ${failures.length}`);
console.log(`📈 Total Categories: ${Object.keys(categories).length}`);
